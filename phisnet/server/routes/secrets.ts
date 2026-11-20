import { Express, Request, Response } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import SecretsService from "../services/secrets.service";
import { db } from "../db";
import { organizations } from "../../shared/schema";
import { eq } from "drizzle-orm";
import {pool} from '../db';

export function registerSecretsRoutes(app: Express) {
  /**
   * GET /api/secrets/status
   * Get encryption status for current organization
   */
  app.get("/api/secrets/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as Express.User;
      const orgId = (user as any).organizationId;

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      res.json({
        hasKey: !!org.encryptionKey,
        rotationAvailable:process.env.SECRET_ROTATION_ENABLED==='true'&&process.env.WORKER_DELIVERY_PAUSED!=='true',
        rotation:(await pool.query('SELECT state,processed,last_error,created_at,completed_at FROM secret_rotation_jobs WHERE organization_id=$1 ORDER BY id DESC LIMIT 1',[orgId])).rows[0]||null,
        // Note: lastRotation timestamp not yet implemented in schema
        // Will require adding keyRotatedAt timestamp to organizations table
      });
    } catch (error) {
      console.error("Get encryption status error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to retrieve encryption status",
      });
    }
  });

  /**
   * POST /api/secrets/rotate
   * Rotate organization encryption key (admin only)
   * NOTE: This is currently a placeholder implementation
   * Full implementation requires decrypting and re-encrypting all sensitive data
   */
  app.post("/api/secrets/rotate", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    if(process.env.SECRET_ROTATION_ENABLED!=='true'||process.env.WORKER_DELIVERY_PAUSED==='true')return res.status(409).json({message:'Enable rotation after verifying an encrypted backup and an active worker'});
    try {
      const user = req.user as Express.User;
      const orgId = (user as any).organizationId;

      // TODO: Implement full key rotation
      // Current implementation is placeholder
      const job=await SecretsService.rotateOrgKey(orgId);

      res.json({
        message: "Versioned key rotation queued. Prior keys are retained while the worker re-encrypts stored secrets.",
        job,
      });
    } catch (error: any) {
      console.error("Key rotation error:", error);
      res.status(error.status === 409 ? 409 : 500).json({
        message: error instanceof Error ? error.message : "Failed to rotate encryption key",
      });
    }
  });
  app.post('/api/secrets/rotate/resume',isAuthenticated,isAdmin,async(req,res)=>{
    if(process.env.SECRET_ROTATION_ENABLED!=='true')return res.status(409).json({message:'Rotation is disabled'});
    const updated=await pool.query("UPDATE secret_rotation_jobs SET state='queued',last_error=NULL WHERE organization_id=$1 AND state='failed' RETURNING id",[req.user!.organizationId]);
    res.status(updated.rowCount?200:409).json({resumed:!!updated.rowCount});
  });

  /**
   * POST /api/secrets/initialize
   * Initialize encryption key for organization (admin only)
   */
  app.post("/api/secrets/initialize", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user as Express.User;
      const orgId = (user as any).organizationId;

      await SecretsService.ensureOrgKey(orgId);

      res.json({ message: "Encryption key initialized successfully" });
    } catch (error) {
      console.error("Key initialization error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to initialize encryption key",
      });
    }
  });
}

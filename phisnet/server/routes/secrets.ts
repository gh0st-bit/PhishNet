import { Express, Request, Response } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import SecretsService from "../services/secrets.service";
import { db } from "../db";
import { organizations } from "../../shared/schema";
import { eq } from "drizzle-orm";

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
    try {
      const user = req.user as Express.User;
      const orgId = (user as any).organizationId;

      // TODO: Implement full key rotation
      // Current implementation is placeholder
      await SecretsService.rotateOrgKey(orgId);

      res.json({
        message: "Encryption key rotation initiated",
        warning: "Full implementation pending - requires re-encrypting all sensitive data",
      });
    } catch (error) {
      console.error("Key rotation error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to rotate encryption key",
      });
    }
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

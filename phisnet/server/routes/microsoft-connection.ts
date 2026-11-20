import type { Express } from "express";
import { isAuthenticated, hasOrganization, isAdminOrOrgAdmin } from "../auth";
import { pool } from "../db";
import SecretsService from "../services/secrets.service";
import { microsoftSmtpTransport } from "../services/microsoft-smtp";
import { z } from "zod";
export function registerMicrosoftConnection(app: Express) {
  app.use(
    "/api/pilot/microsoft",
    isAuthenticated,
    hasOrganization,
    isAdminOrOrgAdmin,
  );
  app.get("/api/pilot/microsoft", async (req, res) =>
    res.json({
      externalEnabled:
        process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED === "true" &&
        process.env.MAIL_TRANSPORT !== "sink",
      connections: (
        await pool.query(
          "SELECT o.profile_id,o.tenant_id,o.client_id,o.enabled,o.updated_at,s.name FROM smtp_oauth_connections o JOIN smtp_profiles s ON s.id=o.profile_id WHERE o.organization_id=$1",
          [req.user!.organizationId],
        )
      ).rows,
    }),
  );
  app.put("/api/pilot/microsoft/:id", async (req, res) => {
    const body = z
      .object({
        tenantId: z.uuid(),
        clientId: z.uuid(),
        clientSecret: z.string().min(8).max(4096).optional(),
        enabled: z.boolean().default(false),
      })
      .parse(req.body);
    const id = Number(req.params.id),
      org = req.user!.organizationId;
    const profile = (
      await pool.query(
        "SELECT id FROM smtp_profiles WHERE id=$1 AND organization_id=$2",
        [id, org],
      )
    ).rows[0];
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    const prior = (
      await pool.query(
        "SELECT client_secret FROM smtp_oauth_connections WHERE profile_id=$1 AND organization_id=$2",
        [id, org],
      )
    ).rows[0];
    const encrypted = body.clientSecret
      ? await SecretsService.encrypt(org, body.clientSecret)
      : prior?.client_secret;
    if (!encrypted)
      return res
        .status(400)
        .json({ message: "Client secret is required for a new connection" });
    await pool.query(
      `INSERT INTO smtp_oauth_connections(profile_id,organization_id,tenant_id,client_id,client_secret,enabled) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(profile_id) DO UPDATE SET tenant_id=$3,client_id=$4,client_secret=$5,enabled=$6,updated_at=now()`,
      [id, org, body.tenantId, body.clientId, encrypted, body.enabled],
    );
    res.json({
      saved: true,
      message: "Saved. No connection or email was attempted.",
    });
  });
  app.post("/api/pilot/microsoft/:id/verify", async (req, res) => {
    if (
      process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED !== "true" ||
      process.env.MAIL_TRANSPORT === "sink"
    )
      return res
        .status(409)
        .json({
          message: "External connections are disabled in this environment",
        });
    const transport = await microsoftSmtpTransport(
      Number(req.params.id),
      req.user!.organizationId,
    );
    try {
      await transport.verify();
      res.json({
        authenticated: true,
        message:
          "SMTP authentication succeeded. No message was sent; inbox placement remains unverified.",
      });
    } catch {
      res
        .status(422)
        .json({
          message:
            "SMTP authentication failed. Review mailbox permissions and SMTP AUTH configuration.",
        });
    } finally {
      transport.close();
    }
  });
}

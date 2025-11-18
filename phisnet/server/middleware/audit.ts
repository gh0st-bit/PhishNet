import type { Request, Response, NextFunction } from "express";
import { AuditService } from "../services/audit.service";

export interface AuditOptions {
  action: string;
  resource?: string;
  getResourceId?: (req: Request) => number | undefined;
  getMetadata?: (req: Request, res: Response) => Record<string, any>;
}

/**
 * Middleware to automatically log auditable actions
 */
export function auditMiddleware(options: AuditOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Capture original send to log after response
    const originalSend = res.send;
    const originalJson = res.json;

    let responseLogged = false;

    const logAudit = async () => {
      if (responseLogged) return;
      responseLogged = true;

      try {
        // Only log successful operations (2xx status)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const user = (req as any).user;
          if (!user || !user.organizationId) return;

          const resourceId = options.getResourceId ? options.getResourceId(req) : undefined;
          const metadata = options.getMetadata ? options.getMetadata(req, res) : {};

          await AuditService.log({
            context: {
              userId: user.id,
              organizationId: user.organizationId,
              ip: req.ip || req.socket.remoteAddress,
              userAgent: req.get("user-agent"),
            },
            action: options.action,
            resource: options.resource,
            resourceId,
            metadata,
          });
        }
      } catch (error) {
        // Don't fail the request if audit logging fails
        console.error("[Audit] Failed to log action:", error);
      }
    };

    res.send = function (data: any): Response {
      logAudit();
      return originalSend.call(this, data);
    };

    res.json = function (data: any): Response {
      logAudit();
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Manual audit logging helper for complex scenarios
 */
export async function logAudit(
  req: Request,
  action: string,
  resource?: string,
  resourceId?: number,
  metadata?: Record<string, any>
) {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) return;

    await AuditService.log({
      context: {
        userId: user.id,
        organizationId: user.organizationId,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get("user-agent"),
      },
      action,
      resource,
      resourceId,
      metadata,
    });
  } catch (error) {
    console.error("[Audit] Failed to log action:", error);
  }
}

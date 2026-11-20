import nodemailer from "nodemailer";
import { pool } from "../db";
import SecretsService from "./secrets.service";
export async function microsoftSmtpTransport(
  profileId: number,
  organizationId: number,
  onDataStarted?: () => void,
) {
  const {
    rows: [connection],
  } = await pool.query(
    `SELECT o.*,s.username,s.from_email FROM smtp_oauth_connections o JOIN smtp_profiles s ON s.id=o.profile_id WHERE o.profile_id=$1 AND o.organization_id=$2 AND o.enabled`,
    [profileId, organizationId],
  );
  if (!connection)
    throw Object.assign(new Error("Microsoft 365 connection is not enabled"), {
      code: "PROVIDER_CONFIG",
    });
  if (
    process.env.SIMULATION_EXTERNAL_DELIVERY_ENABLED !== "true" ||
    process.env.MAIL_TRANSPORT === "sink"
  )
    throw Object.assign(new Error("External delivery is disabled"), {
      code: "PROVIDER_CONFIG",
    });
  const secret = await SecretsService.decrypt(
    organizationId,
    connection.client_secret,
  );
  const token = await fetch(
    `https://login.microsoftonline.com/${connection.tenant_id}/oauth2/v2.0/token`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: connection.client_id,
        client_secret: secret,
        grant_type: "client_credentials",
        scope: "https://outlook.office365.com/.default",
      }),
    },
  );
  if (!token.ok)
    throw Object.assign(
      new Error(
        "Microsoft authorization failed. Review application consent and mailbox scope.",
      ),
      { code: "OAUTH_AUTH" },
    );
  const data = (await token.json()) as { access_token?: string };
  if (!data.access_token)
    throw Object.assign(new Error("Microsoft did not return a token"), {
      code: "OAUTH_AUTH",
    });
  const logger = {
    trace() {},
    info() {},
    warn() {},
    error() {},
    fatal() {},
    debug(data: any, message: string, ...args: any[]) {
      if (
        data?.tnx === "client" &&
        (message === "DATA" || (message === "%s" && args[0] === "DATA"))
      )
        onDataStarted?.();
    },
  };
  return nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      type: "OAuth2",
      user: connection.username || connection.from_email,
      accessToken: data.access_token,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    logger,
    debug: true,
  });
}

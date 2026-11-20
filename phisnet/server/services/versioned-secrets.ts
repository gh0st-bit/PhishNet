import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scrypt,
} from "node:crypto";
import { promisify } from "node:util";
import { pool } from "../db";
const derive = promisify(scrypt);
export function encryptedValue(value: string) {
  if (/^v2:[0-9a-f-]{36}:/.test(value)) return true;
  const buffer = Buffer.from(value || "", "base64");
  return buffer.length > 65 && buffer[0] === 1;
}
async function key(material: string, salt: Buffer) {
  const master = Buffer.from(process.env.MASTER_ENCRYPTION_KEY || "", "base64");
  if (master.length !== 32)
    throw new Error("MASTER_ENCRYPTION_KEY must encode exactly 32 bytes");
  return (await derive(
    Buffer.concat([Buffer.from(material, "base64"), master]),
    salt,
    32,
  )) as Buffer;
}
async function seal(material: string, text: string) {
  const salt = randomBytes(32),
    iv = randomBytes(16),
    cipher = createCipheriv("aes-256-gcm", await key(material, salt), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([
    Buffer.from([1]),
    salt,
    iv,
    cipher.getAuthTag(),
    data,
  ]).toString("base64");
}
async function unseal(material: string, value: string) {
  const data = Buffer.from(value, "base64");
  if (data.length < 65 || data[0] !== 1)
    throw new Error("Invalid encrypted value");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    await key(material, data.subarray(1, 33)),
    data.subarray(33, 49),
  );
  decipher.setAuthTag(data.subarray(49, 65));
  return Buffer.concat([
    decipher.update(data.subarray(65)),
    decipher.final(),
  ]).toString("utf8");
}
async function legacy(org: number, client: any = pool) {
  const row = (
    await client.query("SELECT encryption_key FROM organizations WHERE id=$1", [
      org,
    ])
  ).rows[0];
  if (!row?.encryption_key)
    throw new Error("Organization encryption key not found");
  return row.encryption_key;
}
export async function encryptSecret(org: number, text: string) {
  if (!text) return text;
  const current = (
    await pool.query(
      "SELECT id,key_material FROM organization_secret_keys WHERE organization_id=$1 AND active",
      [org],
    )
  ).rows[0];
  return current
    ? "v2:" + current.id + ":" + (await seal(current.key_material, text))
    : await seal(await legacy(org), text);
}
export async function decryptSecret(
  org: number,
  value: string,
  client: any = pool,
) {
  if (!value) return value;
  const match = /^v2:([0-9a-f-]{36}):(.+)$/.exec(value);
  if (!match) return unseal(await legacy(org, client), value);
  const record = (
    await client.query(
      "SELECT key_material FROM organization_secret_keys WHERE organization_id=$1 AND id=$2",
      [org, match[1]],
    )
  ).rows[0];
  if (!record) throw new Error("Encryption key version not found");
  return unseal(record.key_material, match[2]);
}
export async function queueSecretRotation(org: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT id FROM organizations WHERE id=$1 FOR UPDATE",
      [org],
    );
    if (!found.rowCount)
      throw Object.assign(new Error("Organization not found"), { status: 404 });
    if (
      (
        await client.query(
          "SELECT 1 FROM secret_rotation_jobs WHERE organization_id=$1 AND state IN ('queued','failed')",
          [org],
        )
      ).rowCount
    )
      throw Object.assign(
        new Error(
          "Complete or resume the current rotation before starting another",
        ),
        { status: 409 },
      );
    const id = randomUUID();
    await client.query(
      "UPDATE organization_secret_keys SET active=false WHERE organization_id=$1 AND active",
      [org],
    );
    await client.query(
      "INSERT INTO organization_secret_keys(id,organization_id,key_material) VALUES($1,$2,$3)",
      [id, org, randomBytes(32).toString("base64")],
    );
    const {
      rows: [job],
    } = await client.query(
      "INSERT INTO secret_rotation_jobs(organization_id,key_id) VALUES($1,$2) RETURNING id,state",
      [org, id],
    );
    await client.query("COMMIT");
    return job;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
const stores = [
  ["smtp_profiles", "password"],
  ["smtp_oauth_connections", "client_secret"],
  ["sso_config", "client_secret"],
  ["users", "two_factor_secret"],
  ["credential_captures", "password"],
  ["campaign_results", "submitted_data->>'encryptedPassword'"],
] as const;
export async function processSecretRotation() {
  const client = await pool.connect();
  let jobId: number | undefined;
  try {
    await client.query("BEGIN");
    const {
      rows: [job],
    } = await client.query(
      "SELECT j.*,k.key_material FROM secret_rotation_jobs j JOIN organization_secret_keys k ON k.id=j.key_id WHERE j.state='queued' ORDER BY j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED",
    );
    if (!job) {
      await client.query("COMMIT");
      return false;
    }
    jobId = job.id;
    let processed = 0;
    for (const [table, column] of stores) {
      const idColumn = table === "smtp_oauth_connections" ? "profile_id" : "id";
      const { rows } = await client.query(
        `SELECT ${idColumn} AS id,${column} AS value FROM ${table} WHERE organization_id=$1 AND COALESCE(${column},'')<>'' AND ${column} NOT LIKE $2 LIMIT 20 FOR UPDATE SKIP LOCKED`,
        [job.organization_id, "v2:" + job.key_id + ":%"],
      );
      for (const row of rows) {
        const plain = encryptedValue(row.value)
          ? await decryptSecret(job.organization_id, row.value, client)
          : row.value;
        const sealed =
          "v2:" + job.key_id + ":" + (await seal(job.key_material, plain));
        const update =
          table === "campaign_results"
            ? "submitted_data=jsonb_set(submitted_data,'{encryptedPassword}',to_jsonb($2::text))"
            : column + "=$2";
        await client.query(
          `UPDATE ${table} SET ${update} WHERE ${idColumn}=$1 AND organization_id=$3`,
          [row.id, sealed, job.organization_id],
        );
        processed++;
      }
    }
    await client.query(
      "UPDATE secret_rotation_jobs SET processed=processed+$2,state=CASE WHEN $2=0 THEN 'completed' ELSE 'queued' END,completed_at=CASE WHEN $2=0 THEN now() ELSE NULL END,last_error=NULL WHERE id=$1",
      [job.id, processed],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    if (jobId) {
      await pool.query(
        "UPDATE secret_rotation_jobs SET state='failed',last_error='Re-encryption failed; prior key versions are retained' WHERE id=$1",
        [jobId],
      );
      return false;
    }
    throw error;
  } finally {
    client.release();
  }
}

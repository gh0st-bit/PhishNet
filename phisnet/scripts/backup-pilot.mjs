import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  lstat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  scryptSync,
} from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import pg from "pg";
const run = promisify(execFile);
const magic = Buffer.from("PHISHNET-BACKUP-1\n");
export function packBackup(data, key) {
  if (key.length !== 32) throw new Error("Backup key must be 32 bytes");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(data)),
    cipher.final(),
  ]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), bytes]);
}
export function unpackBackup(bytes, key) {
  if (!bytes.subarray(0, magic.length).equals(magic))
    throw new Error("Invalid backup format");
  const start = magic.length,
    decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      bytes.subarray(start, start + 12),
    );
  decipher.setAuthTag(bytes.subarray(start + 12, start + 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(start + 28)),
      decipher.final(),
    ]).toString(),
  );
}
const tables = [
  "organizations",
  "users",
  "campaigns",
  "groups",
  "targets",
  "smtp_profiles",
  "email_templates",
  "landing_pages",
  "training_modules",
  "training_progress",
  "articles",
  "quizzes",
  "points_events",
  "content_versions",
  "teams",
  "team_members",
  "team_managers",
  "learning_paths",
  "learning_path_assignments",
  "learning_path_steps",
  "organization_secret_keys",
  "secret_rotation_jobs",
];
function pgEnvironment(url) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
  };
}
function binary(name) {
  return process.env.PG_BIN
    ? path.join(
        process.env.PG_BIN,
        name + (process.platform === "win32" ? ".exe" : ""),
      )
    : process.platform === "win32"
      ? path.join("C:/Program Files/PostgreSQL/18/bin", name + ".exe")
      : name;
}
async function assets(root, relative = "", files = []) {
  let entries;
  try {
    entries = await readdir(path.join(root, relative));
  } catch (e) {
    if (e.code === "ENOENT") return files;
    throw e;
  }
  for (const name of entries) {
    const rel = path.join(relative, name),
      file = path.join(root, rel),
      stat = await lstat(file);
    if (stat.isSymbolicLink())
      throw new Error("Backup refuses symlinked assets");
    if (stat.isDirectory()) await assets(root, rel, files);
    else {
      if (files.reduce((n, f) => n + f.size, 0) + stat.size > 268435456)
        throw new Error("Local asset backup exceeds 256 MB pilot limit");
      files.push({
        path: rel.replaceAll("\\", "/"),
        size: stat.size,
        data: (await readFile(file)).toString("base64"),
      });
    }
  }
  return files;
}
async function counts(client, requested = tables) {
  const out = {};
  for (const t of requested) {
    if (!tables.includes(t)) throw new Error("Unsupported backup table");
    out[t] = (
      await client.query(`SELECT count(*)::int AS n FROM ${t}`)
    ).rows[0].n;
  }
  return out;
}
async function main() {
  const args = process.argv.slice(2),
    audit = args.includes("--audit");
  const env = {
    ...process.env,
    ...parse(await readFile(audit ? ".env.audit" : ".env")),
  };
  if (audit && new URL(env.DATABASE_URL).pathname !== "/phishnet_audit")
    throw new Error("Audit backup requires phishnet_audit");
  if (env.ASSET_STORAGE === "s3")
    throw new Error(
      "S3 objects require a separate verified bucket backup; local backup cannot claim completeness",
    );
  const outputArg = args.indexOf("--output"),
    file = path.resolve(
      outputArg >= 0 ? args[outputArg + 1] : "backups/audit-drills/pilot.pnb",
    );
  await mkdir(path.dirname(file), { recursive: true });
  let key = env.BACKUP_ENCRYPTION_KEY;
  if (audit && !key) {
    try {
      key = parse(await readFile(".env.audit.backup")).BACKUP_ENCRYPTION_KEY;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      key = randomBytes(32).toString("base64");
      await writeFile(
        ".env.audit.backup",
        "BACKUP_ENCRYPTION_KEY=" + key + "\n",
        { mode: 0o600, flag: "wx" },
      );
    }
  }
  if (!key || Buffer.from(key, "base64").length !== 32)
    throw new Error(
      "Set an independent BACKUP_ENCRYPTION_KEY (base64 32 bytes)",
    );
  if (key === env.MASTER_ENCRYPTION_KEY)
    throw new Error(
      "Backup encryption key must be independent of the application master key",
    );
  if (Buffer.from(env.MASTER_ENCRYPTION_KEY || "", "base64").length !== 32)
    throw new Error("A valid application master key is required");
  const encryption = Buffer.from(key, "base64");
  if (args.includes("--verify") || args.includes("--restore-drill")) {
    const data = unpackBackup(await readFile(file), encryption);
    if (
      createHash("sha256")
        .update(Buffer.from(data.dump, "base64"))
        .digest("hex") !== data.dumpSha256
    )
      throw new Error("Dump checksum mismatch");
    if (!args.includes("--restore-drill")) {
      console.log(
        JSON.stringify({
          verified: true,
          createdAt: data.createdAt,
          counts: data.counts,
          assets: data.assets.length,
        }),
      );
      return;
    }
    if (!audit)
      throw new Error(
        "Restore drill is limited to --audit; production restore requires the recovery runbook",
      );
    const source = new URL(
        env.MIGRATION_DATABASE_URL ||
          env.CONTROL_DATABASE_URL ||
          env.DATABASE_URL,
      ),
      name = "phishnet_restore_check_" + Date.now();
    if (
      !/^phishnet_restore_check_[0-9]+$/.test(name) ||
      name === source.pathname.slice(1)
    )
      throw new Error("Invalid isolated restore destination");
    const admin = new pg.Client({ connectionString: source.href });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
    } finally {
      await admin.end();
    }
    const target = new URL(source);
    target.pathname = "/" + name;
    const temp = file + ".restore.tmp";
    await writeFile(temp, Buffer.from(data.dump, "base64"), {
      mode: 0o600,
      flag: "wx",
    });
    const started = Date.now();
    try {
      await run(
        binary("pg_restore"),
        ["--no-owner", "--no-acl", "--exit-on-error", "--dbname", name, temp],
        { env: pgEnvironment(target), maxBuffer: 1048576 },
      );
    } finally {
      await unlink(temp);
    }
    const restored = new pg.Client({ connectionString: target.href });
    await restored.connect();
    let actual,
      verifiedSecrets = 0;
    try {
      actual = await counts(restored, Object.keys(data.counts));
      for (const t of Object.keys(data.counts))
        if (actual[t] !== data.counts[t])
          throw new Error("Restore count mismatch: " + t);
      const rows = (
        await restored.query(
          "SELECT s.password,o.encryption_key,s.organization_id FROM smtp_profiles s JOIN organizations o ON o.id=s.organization_id WHERE s.password<>'' LIMIT 10",
        )
      ).rows;
      for (const row of rows) {
        let value = row.password,
          material = row.encryption_key;
        const match = /^v2:([0-9a-f-]{36}):(.+)$/.exec(value);
        if (match) {
          material = (
            await restored.query(
              "SELECT key_material FROM organization_secret_keys WHERE organization_id=$1 AND id=$2",
              [row.organization_id, match[1]],
            )
          ).rows[0]?.key_material;
          value = match[2];
        }
        const bytes = Buffer.from(value, "base64");
        if (bytes.length <= 65 || bytes[0] !== 1) continue;
        const derived = scryptSync(
            Buffer.concat([
              Buffer.from(material, "base64"),
              Buffer.from(data.keys.master, "base64"),
            ]),
            bytes.subarray(1, 33),
            32,
          ),
          decipher = createDecipheriv(
            "aes-256-gcm",
            derived,
            bytes.subarray(33, 49),
          );
        decipher.setAuthTag(bytes.subarray(49, 65));
        Buffer.concat([decipher.update(bytes.subarray(65)), decipher.final()]);
        verifiedSecrets++;
      }
    } finally {
      await restored.end();
    }
    const restoreRoot = path.resolve(
      "backups/audit-drills/restored-assets-" + name,
    );
    await mkdir(restoreRoot, { recursive: true });
    for (const asset of data.assets) {
      if (
        asset.path.split("/").some((p) => p === ".." || p === "") ||
        path.isAbsolute(asset.path)
      )
        throw new Error("Invalid asset path");
      const destination = path.resolve(restoreRoot, asset.path);
      if (!destination.startsWith(restoreRoot + path.sep))
        throw new Error("Asset escapes restore directory");
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, Buffer.from(asset.data, "base64"), {
        flag: "wx",
        mode: 0o600,
      });
    }
    const proof = {
      at: new Date().toISOString(),
      restoredDatabase: name,
      counts: actual,
      assets: data.assets.length,
      verifiedEncryptedSecrets: verifiedSecrets,
      elapsedSeconds: Math.round((Date.now() - started) / 1000),
      originalDatabaseChanged: false,
      scope:
        "Isolated database and local asset restoration; deployment and off-host recovery not certified",
    };
    await mkdir("logs/pilot", { recursive: true });
    await writeFile(
      "logs/pilot/restore-drill.json",
      JSON.stringify(proof, null, 2),
    );
    console.log(JSON.stringify(proof));
    return;
  }
  const source = new URL(
      env.MIGRATION_DATABASE_URL ||
        env.CONTROL_DATABASE_URL ||
        env.DATABASE_URL,
    ),
    client = new pg.Client({ connectionString: source.href }),
    temp = file + ".dump.tmp";
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await client.query("SELECT pg_export_snapshot() AS id"))
      .rows[0].id;
    const totals = await counts(client);
    await run(
      binary("pg_dump"),
      [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--snapshot",
        snapshot,
        "--file",
        temp,
      ],
      { env: pgEnvironment(source), maxBuffer: 1048576 },
    );
    await client.query("COMMIT");
    const dump = await readFile(temp);
    if (dump.length > 268435456)
      throw new Error("Database dump exceeds 256 MB pilot limit");
    const data = {
      version: 1,
      createdAt: new Date().toISOString(),
      counts: totals,
      dump: dump.toString("base64"),
      dumpSha256: createHash("sha256").update(dump).digest("hex"),
      assets: await assets(path.resolve(env.UPLOAD_ROOT || "uploads")),
      keys: { master: env.MASTER_ENCRYPTION_KEY, session: env.SESSION_SECRET },
      sourceDatabase: source.pathname.slice(1),
    };
    await writeFile(file, packBackup(data, encryption), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        backup: file,
        encrypted: true,
        counts: totals,
        assets: data.assets.length,
        keyPrinted: false,
      }),
    );
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
    await unlink(temp).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(() => {
    console.error(
      "Backup or restore failed. Check configuration, PostgreSQL tools and protected local logs. Credentials were not printed.",
    );
    process.exitCode = 1;
  });

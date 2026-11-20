import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createCipheriv, scryptSync } from "node:crypto";
import { pool } from "../../server/db";
import SecretsService from "../../server/services/secrets.service";
import { processSecretRotation } from "../../server/services/versioned-secrets";
import { previewEmployees } from "../../server/services/pilot-onboarding";
import { rate } from "../../shared/product-metrics";
import { storage } from "../../server/storage";
import { unknownTemplateVariables } from "../../server/services/template-validation";
import { renderTemplate } from "../../server/services/email-service";
import { answerMatches } from "../../shared/quiz-grading";

test("CSV supports one column, mapping, invalid/duplicate rows and bounded imports", () => {
  assert.equal(
    previewEmployees("email\na@b.test", { email: "email" }).rows[0].error,
    "",
  );
  const rows = previewEmployees(
    "Address,Name\na@b.test,A\ninvalid,B\nA@B.test,C",
    { email: "Address", firstName: "Name" },
  ).rows;
  assert.match(rows[1].error, /Invalid/);
  assert.match(rows[2].error, /Duplicate/);
  assert.equal(rows[0].firstName, "A");
  assert.throws(
    () => previewEmployees("email\na@b.test", { email: "missing" }),
    /column/,
  );
  assert.throws(
    () =>
      previewEmployees(
        "email\n" +
          Array.from({ length: 1001 }, (_, i) => `a${i}@b.test`).join("\n"),
        { email: "email" },
      ),
    /1,000/,
  );
});
test("metric rates use accepted-message denominators and handle no deliveries", () => {
  assert.equal(rate(1, 2), 50);
  assert.equal(rate(2, 3), 66.7);
  assert.equal(rate(0, 0), 0);
});
test("assessment grading handles unordered selections and rejects missing or duplicate answers", () => {
  assert.equal(
    answerMatches(
      "multiple_select",
      ["Report", "Verify"],
      ["Verify", "Report"],
    ),
    true,
  );
  assert.equal(
    answerMatches("multiple_select", ["Report", "Report"], ["Report"]),
    false,
  );
  assert.equal(answerMatches("fill_blank", " Verify ", "verify"), true);
  assert.equal(answerMatches("true_false", true, "True"), true);
  assert.equal(answerMatches("multiple_choice", undefined, undefined), false);
});
test("template preflight and renderer agree on supported variables and escape recipient data", () => {
  assert.deepEqual(
    unknownTemplateVariables("{{ .Email }} {{FirstName}} {{NotSupported}}"),
    ["NotSupported"],
  );
  const html = renderTemplate(
    "<p>{{ .Email }} {{FirstName}}</p>",
    { id: 1, email: "a@b.test", firstName: "<script>" } as any,
    { sender_name: "Audit" } as any,
    { id: 1 } as any,
  );
  assert.ok(html.includes("a@b.test"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.throws(
    () => renderTemplate("{{Unknown}}", {} as any, {} as any, {} as any),
    /Unsupported/,
  );
});

test("versioned rotation preserves legacy secrets, rolls back failed batches and resumes safely", async () => {
  const material = randomBytes(32).toString("base64");
  const {
    rows: [org],
  } = await pool.query(
    "INSERT INTO organizations(name,encryption_key) VALUES($1,$2) RETURNING id",
    ["Disposable key audit " + Date.now(), material],
  );
  try {
    const salt = randomBytes(32),
      iv = randomBytes(16),
      key = scryptSync(
        Buffer.concat([
          Buffer.from(material, "base64"),
          Buffer.from(process.env.MASTER_ENCRYPTION_KEY!, "base64"),
        ]),
        salt,
        32,
      ),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    const content = Buffer.concat([
      cipher.update("legacy secret"),
      cipher.final(),
    ]);
    const old = Buffer.concat([
      Buffer.from([1]),
      salt,
      iv,
      cipher.getAuthTag(),
      content,
    ]).toString("base64");
    assert.equal(await SecretsService.decrypt(org.id, old), "legacy secret");
    const {
      rows: [smtp],
    } = await pool.query(
      `INSERT INTO smtp_profiles(name,host,port,username,password,from_email,from_name,organization_id) VALUES('Key audit','localhost',1025,'audit',$1,'audit@review.test','Audit',$2) RETURNING id`,
      [old, org.id],
    );
    const first = await SecretsService.rotateOrgKey(org.id);
    await assert.rejects(
      () => SecretsService.rotateOrgKey(org.id),
      /current rotation/,
    );
    assert.equal(await SecretsService.decrypt(org.id, old), "legacy secret");
    const fresh = await SecretsService.encrypt(org.id, "new secret");
    assert.match(fresh, /^v2:/);
    assert.equal(await SecretsService.decrypt(org.id, fresh), "new secret");
    for (let i = 0; i < 3; i++) await processSecretRotation();
    assert.equal(
      (
        await pool.query("SELECT state FROM secret_rotation_jobs WHERE id=$1", [
          first.id,
        ])
      ).rows[0].state,
      "completed",
    );
    const migrated = (
      await pool.query("SELECT password FROM smtp_profiles WHERE id=$1", [
        smtp.id,
      ])
    ).rows[0].password;
    assert.match(migrated, /^v2:/);
    assert.equal(
      await SecretsService.decrypt(org.id, migrated),
      "legacy secret",
    );
    const bad = Buffer.from(old, "base64");
    bad[bad.length - 1] ^= 1;
    const {
      rows: [broken],
    } = await pool.query(
      `INSERT INTO smtp_profiles(name,host,port,username,password,from_email,from_name,organization_id) VALUES('Broken audit','localhost',1025,'audit',$1,'audit@review.test','Audit',$2) RETURNING id`,
      [bad.toString("base64"), org.id],
    );
    const second = await SecretsService.rotateOrgKey(org.id);
    await processSecretRotation();
    assert.equal(
      (
        await pool.query("SELECT state FROM secret_rotation_jobs WHERE id=$1", [
          second.id,
        ])
      ).rows[0].state,
      "failed",
    );
    assert.equal(
      (
        await pool.query("SELECT password FROM smtp_profiles WHERE id=$1", [
          smtp.id,
        ])
      ).rows[0].password,
      migrated,
      "Failure must roll back the batch",
    );
    assert.equal(
      await SecretsService.decrypt(org.id, migrated),
      "legacy secret",
    );
    await pool.query("DELETE FROM smtp_profiles WHERE id=$1", [broken.id]);
    await pool.query(
      "UPDATE secret_rotation_jobs SET state='queued' WHERE id=$1",
      [second.id],
    );
    for (let i = 0; i < 3; i++) await processSecretRotation();
    assert.equal(
      (
        await pool.query("SELECT state FROM secret_rotation_jobs WHERE id=$1", [
          second.id,
        ])
      ).rows[0].state,
      "completed",
    );
    assert.equal(await SecretsService.decrypt(org.id, fresh), "new secret");
  } finally {
    await pool.query("DELETE FROM organizations WHERE id=$1", [org.id]);
  }
});
after(async () => {
  storage.stopSessionStore();
  await pool.end();
});

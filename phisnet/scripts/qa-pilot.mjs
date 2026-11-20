import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const review = JSON.parse(readFileSync("logs/role-review/accounts.json")),
  base = "http://localhost:5000",
  cookies = {},
  results = [],
  requests = [],
  suffix = Date.now();
async function request(
  actor,
  path,
  method = "GET",
  body,
  statuses = [200, 201],
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: cookies[actor] || "",
      Origin: base,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  const redact = (v) =>
    JSON.parse(
      JSON.stringify(v ?? null, (k, value) =>
        /password|secret|token/i.test(k) ? "[redacted]" : value,
      ),
    );
  requests.push({
    actor,
    path,
    method,
    input: redact(body),
    status: response.status,
    response: redact(data),
  });
  assert.ok(
    statuses.includes(response.status),
    `${actor} ${path}: ${response.status} ${raw.slice(0, 200)}`,
  );
  if (path === "/api/login")
    cookies[actor] = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  return data;
}
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, status: "FAIL", error: e.message });
    console.log("FAIL", name, e.message);
  }
}
let createdUser,
  excludedUser,
  createdModule,
  createdPath,
  createdQuiz,
  team,
  team2;
try {
  for (const actor of ["owner", "manager", "employee", "beta"])
    await request(actor, "/api/login", "POST", {
      email: review.accounts[actor].email,
      password: review.password,
    });
  await check(
    "Readiness reports configuration without claiming delivery proof",
    async () => {
      const data = await request("owner", "/api/pilot/readiness");
      assert.equal(data.externalDeliveryVerified, false);
      assert.equal(data.mailMode, "local-only");
      assert.ok(data.metrics.accepted);
    },
  );
  await check(
    "CSV mapping, invalid rows and duplicates are previewed without creating users",
    async () => {
      const data = await request("owner", "/api/pilot/import/preview", "POST", {
        csv: "Address,First\nnew.person@review.test,New\nnot-an-email,Invalid\nnew.person@review.test,Duplicate",
        mapping: { email: "Address", firstName: "First" },
      });
      assert.equal(data.rows[0].status, "new");
      assert.equal(data.rows[1].status, "invalid");
      assert.match(data.rows[2].error, /Duplicate/);
    },
  );
  await check("Invalid import mapping returns 400", () =>
    request(
      "owner",
      "/api/pilot/import/preview",
      "POST",
      { csv: "email\na@b.test", mapping: { email: "missing" } },
      [400],
    ),
  );
  await check(
    "Employee and manager cannot access organization setup",
    async () => {
      await request("employee", "/api/pilot/readiness", "GET", undefined, [
        403,
      ]);
      await request("manager", "/api/pilot/readiness", "GET", undefined, [403]);
    },
  );
  await check(
    "Create a disposable employee and a team restricted to the QA manager",
    async () => {
      const roles = await request("owner", "/api/roles");
      createdUser = await request("owner", "/api/users", "POST", {
        email: `qa.pilot.${suffix}@review.test`,
        firstName: "Pilot",
        lastName: "Review",
        password: review.password,
        roleId: roles.find((r) => r.name === "User").id,
        isActive: true,
      });
      await request("learner", "/api/login", "POST", {
        email: createdUser.email,
        password: review.password,
      });
      team = await request("owner", "/api/pilot/teams", "POST", {
        name: `QA scoped team ${suffix}`,
        members: [createdUser.id],
        managers: [review.accounts.manager.id],
      });
      excludedUser = await request("owner", "/api/users", "POST", {
        email: `qa.excluded.${suffix}@review.test`,
        firstName: "Outside",
        lastName: "Team",
        password: review.password,
        roleId: roles.find((r) => r.name === "User").id,
        isActive: true,
      });
      team2 = await request("owner", "/api/pilot/teams", "POST", {
        name: `QA excluded team ${suffix}`,
        members: [excludedUser.id],
        managers: [],
      });
    },
  );
  await check(
    "Manager overview and CSV exclude unassigned people",
    async () => {
      const data = await request("manager", "/api/manager/overview");
      assert.ok(data.members.some((m) => m.id === createdUser.id));
      assert.ok(!data.members.some((m) => m.id === excludedUser.id));
      const csv = await request("manager", "/api/manager/export");
      assert.ok(csv.includes(createdUser.email));
      assert.ok(!csv.includes(excludedUser.email));
    },
  );
  await check(
    "Manager cannot read legacy management data or create campaigns",
    async () => {
      for (const path of [
        "/api/campaigns",
        "/api/users",
        "/api/reports/data",
        "/api/smtp-profiles",
        "/api/dashboard/overview",
      ])
        await request("manager", path, "GET", undefined, [403]);
      await request(
        "manager",
        "/api/lab/campaigns",
        "POST",
        { name: "must not create", userIds: [createdUser.id] },
        [403],
      );
    },
  );
  await check("Cross-tenant team assignments are rejected", async () => {
    await request(
      "owner",
      "/api/pilot/teams",
      "POST",
      {
        name: "Invalid foreign member",
        members: [review.accounts.beta.id],
        managers: [],
      },
      [400],
    );
    await request(
      "beta",
      `/api/pilot/teams/${team.id}`,
      "PUT",
      { name: "Foreign edit", members: [], managers: [] },
      [404],
    );
  });
  await check(
    "Create and assign learning without sending simulation mail",
    async () => {
      const response = await request(
        "owner",
        "/api/admin/training-modules",
        "POST",
        {
          title: `QA versioned lesson ${suffix}`,
          category: "phishing",
          difficulty: "beginner",
          durationMinutes: 2,
          transcript:
            "Original lesson transcript: verify requests through a trusted channel.",
        },
      );
      createdModule = response.module;
      await request("owner", "/api/admin/training-assignments", "POST", {
        userIds: [createdUser.id],
        moduleId: createdModule.id,
        dueDays: 7,
      });
    },
  );
  await check(
    "Assigned lesson content stays stable after an admin edit",
    async () => {
      await request(
        "owner",
        `/api/admin/training-modules/${createdModule.id}`,
        "PUT",
        { title: "Edited title " + suffix, transcript: "Changed transcript" },
      );
      const response = await request(
        "learner",
        `/api/employee/training/${createdModule.id}`,
      );
      assert.equal(response.module.title, createdModule.title);
      assert.match(response.module.transcript, /Original lesson/);
      const versions = await request(
        "owner",
        `/api/pilot/content-history/training_modules/${createdModule.id}`,
      );
      assert.ok(versions.length >= 2);
    },
  );
  await check(
    "Completing and retrying lesson awards points only once",
    async () => {
      const path = `/api/employee/training/${createdModule.id}/progress`;
      await request("learner", path, "POST", {
        progressPercentage: 100,
        status: "completed",
        videoTimestamp: 0,
      });
      await request("learner", path, "POST", {
        progressPercentage: 100,
        status: "completed",
        videoTimestamp: 0,
      });
      const points = await request("learner", "/api/employee/points-history");
      assert.equal(
        points.events.filter((e) => e.reason === "training_completion").length,
        1,
      );
      assert.equal(
        points.events.find((e) => e.reason === "training_completion").points,
        50,
      );
    },
  );
  await check(
    "Manager reminders reject completed and out-of-team assignments",
    async () => {
      const data = await request("manager", "/api/manager/overview");
      const a = data.assignments.find((a) => a.user_id === createdUser.id);
      await request(
        "manager",
        `/api/manager/assignments/${a.id}/remind`,
        "POST",
        undefined,
        [409],
      );
      await request(
        "manager",
        "/api/manager/assignments/2147483647/remind",
        "POST",
        undefined,
        [404],
      );
    },
  );
  await check(
    "Learning paths capture content and enforce prerequisites",
    async () => {
      createdQuiz = (
        await request("owner", "/api/admin/quizzes", "POST", {
          title: "QA path quiz " + suffix,
          description: "Disposable path assessment",
          passingScore: 80,
          published: true,
        })
      ).quiz;
      await request(
        "owner",
        `/api/admin/quizzes/${createdQuiz.id}/questions`,
        "POST",
        {
          questionType: "multiple_select",
          questionText: "Which are useful responses?",
          options: ["Verify", "Report", "Share passwords"],
          correctAnswer: ["Verify", "Report"],
          points: 1,
          orderIndex: 0,
        },
      );
      await request(
        "owner",
        `/api/admin/quizzes/${createdQuiz.id}/publish`,
        "PATCH",
        { published: true },
      );
      createdPath = await request(
        "owner",
        "/api/pilot/learning-paths",
        "POST",
        {
          name: "QA ordered path " + suffix,
          steps: [
            { kind: "module", id: createdModule.id },
            { kind: "quiz", id: createdQuiz.id },
          ],
        },
      );
      await request(
        "owner",
        `/api/pilot/learning-paths/${createdPath.id}/assign`,
        "POST",
        { userIds: [createdUser.id], dueDays: 7 },
      );
      const list = await request("learner", "/api/employee/learning-paths"),
        assignment = list.find((p) => p.name === "QA ordered path " + suffix);
      createdPath.assignmentId = assignment.id;
      await request(
        "manager",
        `/api/manager/paths/${assignment.id}/remind`,
        "POST",
        {},
      );
      await request(
        "manager",
        `/api/manager/paths/${assignment.id}/remind`,
        "POST",
        {},
        [409],
      );
      const detail = await request(
        "learner",
        `/api/employee/learning-paths/${assignment.id}`,
      );
      assert.equal(detail.steps[1].locked, true);
      assert.ok(!JSON.stringify(detail).includes("correct_answer"));
      await request(
        "learner",
        `/api/employee/learning-paths/${assignment.id}/steps/1`,
        "POST",
        { answers: {} },
        [409],
      );
      await request(
        "learner",
        `/api/employee/learning-paths/${assignment.id}/steps/0`,
        "POST",
        { acknowledged: true },
      );
    },
  );
  await check(
    "Path assessment grades on the server and duplicate completion is idempotent",
    async () => {
      const endpoint = `/api/employee/learning-paths/${createdPath.assignmentId}`,
        detail = await request("learner", endpoint),
        question = detail.steps[1].content.questions[0];
      await request(
        "learner",
        endpoint + "/steps/1",
        "POST",
        { answers: { [question.id]: ["Share passwords"] } },
        [422],
      );
      const passed = await request("learner", endpoint + "/steps/1", "POST", {
        answers: { [question.id]: ["Report", "Verify"] },
      });
      assert.equal(passed.pathCompleted, true);
      const duplicate = await request(
        "learner",
        endpoint + "/steps/1",
        "POST",
        { answers: {} },
      );
      assert.equal(duplicate.duplicate, true);
      await request("employee", endpoint, "GET", undefined, [404]);
      const manager = await request("manager", "/api/manager/overview");
      assert.ok(
        manager.paths.some(
          (p) => p.id === createdPath.assignmentId && p.completed_at,
        ),
      );
    },
  );
  await check(
    "Microsoft credentials cannot be verified while external delivery is disabled",
    () =>
      request("owner", "/api/pilot/microsoft/1/verify", "POST", undefined, [
        409,
      ]),
  );
  await check(
    "Unmatched authenticated reports are deduplicated without changing campaign outcomes",
    async () => {
      const before = await request("owner", "/api/dashboard/overview?days=0");
      const body = {
        messageKey: `<qa-report-${suffix}@review.test>`,
        subject: "Disposable unmatched report",
      };
      const first = await request(
        "learner",
        "/api/employee/report-message",
        "POST",
        body,
      );
      assert.equal(first.matched, false);
      const duplicate = await request(
        "learner",
        "/api/employee/report-message",
        "POST",
        body,
      );
      assert.equal(duplicate.duplicate, true);
      const after = await request("owner", "/api/dashboard/overview?days=0");
      assert.equal(after.signals.reported, before.signals.reported);
    },
  );
  await check(
    "Customer and demonstration overview filters are explicit",
    async () => {
      const all = await request(
          "owner",
          "/api/dashboard/overview?days=0&dataset=all",
        ),
        demo = await request(
          "owner",
          "/api/dashboard/overview?days=0&dataset=demo",
        ),
        customer = await request(
          "owner",
          "/api/dashboard/overview?days=0&dataset=customer",
        );
      assert.equal(
        all.campaigns.total,
        demo.campaigns.total + customer.campaigns.total,
      );
      await request(
        "owner",
        "/api/dashboard/overview?dataset=invalid",
        "GET",
        undefined,
        [400],
      );
    },
  );
  await check(
    "Six original lessons and twelve draft scenarios install without duplication or campaigns",
    async () => {
      const before = await request("owner", "/api/dashboard/overview?days=0");
      const first = await request(
          "owner",
          "/api/pilot/starter-content/install",
          "POST",
          {},
        ),
        again = await request(
          "owner",
          "/api/pilot/starter-content/install",
          "POST",
          {},
        );
      assert.equal(first.modules.length, 6);
      assert.equal(first.templates.length, 12);
      assert.deepEqual(again, first);
      const after = await request("owner", "/api/dashboard/overview?days=0");
      assert.equal(after.campaigns.total, before.campaigns.total);
    },
  );
  await check(
    "Leaderboard privacy preference is enforced by the employee API",
    async () => {
      const original = await request("owner", "/api/organization/preferences");
      try {
        await request("owner", "/api/organization/preferences", "PUT", {
          ...original,
          leaderboardEnabled: false,
        });
        const hidden = await request("employee", "/api/employee/leaderboard");
        assert.deepEqual(hidden.leaderboard, []);
        assert.equal(hidden.enabled, false);
        await request("owner", "/api/organization/preferences", "PUT", {
          ...original,
          leaderboardEnabled: true,
        });
        const visible = await request("employee", "/api/employee/leaderboard");
        assert.ok(Array.isArray(visible.leaderboard));
      } finally {
        await request(
          "owner",
          "/api/organization/preferences",
          "PUT",
          original,
        );
      }
    },
  );
} finally {
  for (const t of [team, team2])
    if (t) await request("owner", `/api/pilot/teams/${t.id}`, "DELETE");
  if (createdModule)
    await request(
      "owner",
      `/api/admin/training-modules/${createdModule.id}`,
      "DELETE",
    );
  if (createdUser)
    await request("owner", `/api/users/${createdUser.id}`, "DELETE");
  if (excludedUser)
    await request("owner", `/api/users/${excludedUser.id}`, "DELETE");
  if (createdPath)
    await request(
      "owner",
      `/api/pilot/learning-paths/${createdPath.id}`,
      "DELETE",
    );
  if (createdQuiz)
    await request("owner", `/api/admin/quizzes/${createdQuiz.id}`, "DELETE");
  mkdirSync("logs/pilot", { recursive: true });
  writeFileSync(
    "logs/pilot/api-review.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        simulationLaunched: false,
        results,
        requests,
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify({
    passed: results.filter((r) => r.status === "PASS").length,
    failed: results.filter((r) => r.status === "FAIL").length,
  }),
);
if (results.some((r) => r.status === "FAIL")) process.exitCode = 1;

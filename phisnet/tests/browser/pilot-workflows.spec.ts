import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
const review = JSON.parse(
  readFileSync("logs/role-review/accounts.json", "utf8"),
);
test.use({ trace: "off" });
// Every page the signed-in role can reach, as listed by the Ctrl+K palette.
async function reachablePages(page:any){await page.getByRole('button',{name:'Search or jump to a page',exact:true}).click();const list=page.getByRole('listbox',{name:'Pages',exact:true});await expect(list).toBeVisible();const names=await list.getByRole('option').evaluateAll((os:Element[])=>os.map(o=>o.firstElementChild?.textContent));await page.keyboard.press('Escape');await expect(list).toHaveCount(0);return names;}
test('manager sidebar and dashboard expose only assigned-team reporting',async({page})=>{
 const login=await page.request.post('/api/login',{data:{email:review.accounts.manager.email,password:review.password}});expect(login.status()).toBe(200);
 await page.goto('/manager');await expect(page.getByRole('main').getByRole('heading',{name:'Manager dashboard',exact:true})).toBeVisible();await expect(page.getByText('QA Review Pilot Team',{exact:false})).toBeVisible();
 const pages=await reachablePages(page);expect(pages).not.toContain('Campaigns');expect(pages).not.toContain('Users');expect((await page.request.get('/api/reports/data')).status()).toBe(403);
 await page.screenshot({path:'logs/pilot/manager-assigned-teams.png',fullPage:true});
});
async function owner(context: any) {
  expect(
    (
      await context.request.post("/api/login", {
        data: { email: review.accounts.owner.email, password: review.password },
      })
    ).status(),
  ).toBe(200);
}
async function post(context: any, path: string, data: any) {
  const response = await context.request.post(path, { data });
  expect(response.ok(), path + ": " + (await response.text())).toBe(true);
  return response.json();
}
for (const width of [1280, 390])
  test(`setup preview works without sending invitations at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await owner(page.context());
    await page.goto("/org-admin/setup");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", { name: "Setup & teams", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await page.getByRole("button",{name:"2. People & teams",exact:true}).click();
    await page
      .getByLabel("CSV text", { exact: true })
      .fill(
        "email,firstName,lastName\nnew.browser@review.test,New,Person\ninvalid,Invalid,Row\nnew.browser@review.test,Duplicate,Row",
      );
    await page
      .getByRole("button", { name: "Preview import", exact: true })
      .click();
    await expect(
      page.getByText("Invalid email address", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Duplicate email in this file", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Send selected invitations",
        exact: true,
      }),
    ).toBeDisabled();
    await page.getByRole("button",{name:"3. Delivery",exact:true}).click();
    await expect(
      page.getByRole("heading", {
        name: "Microsoft 365 connection",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Verify SMTP authentication",
        exact: true,
      }),
    ).toBeDisabled();
    await page.getByRole("button",{name:"2. People & teams",exact:true}).click();
    await expect(
      page
        .getByRole("group", { name: "Managers", exact: true })
        .getByLabel(review.accounts.manager.email, { exact: true }),
    ).toBeVisible();
    mkdirSync("logs/pilot", { recursive: true });
    await page.screenshot({
      path: `logs/pilot/setup-${width}.png`,
      fullPage: true,
    });
  });

test("employee completes frozen learning path through the actual UI", async ({
  browser,
}) => {
  const admin = await browser.newContext({ baseURL: process.env.E2E_BASE_URL||"http://localhost:5000" });
  await owner(admin);
  const learner = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL||"http://localhost:5000",
  });
  const suffix = Date.now();
  let user: any, module: any, quiz: any, path: any;
  try {
    const roles = await (await admin.request.get("/api/roles")).json();
    user = await post(admin, "/api/users", {
      email: `qa.browser.path.${suffix}@review.test`,
      firstName: "Browser",
      lastName: "Learner",
      password: review.password,
      isActive: true,
      roleId: roles.find((r: any) => r.name === "User").id,
    });
    module = (
      await post(admin, "/api/admin/training-modules", {
        title: "Frozen browser lesson " + suffix,
        category: "phishing",
        difficulty: "beginner",
        durationMinutes: 2,
        transcript: "Verify requests using a trusted channel.",
      })
    ).module;
    quiz = (
      await post(admin, "/api/admin/quizzes", {
        title: "Browser path assessment " + suffix,
        passingScore: 80,
        published: true,
      })
    ).quiz;
    await post(admin, `/api/admin/quizzes/${quiz.id}/questions`, {
      questionType: "multiple_select",
      questionText: "Choose the useful responses",
      options: ["Verify", "Report", "Share passwords"],
      correctAnswer: ["Verify", "Report"],
      orderIndex: 0,
      points: 1,
    });
    expect(
      (
        await admin.request.patch(`/api/admin/quizzes/${quiz.id}/publish`, {
          data: { published: true },
        })
      ).ok(),
    ).toBe(true);
    path = await post(admin, "/api/pilot/learning-paths", {
      name: "Browser ordered path " + suffix,
      steps: [
        { kind: "module", id: module.id },
        { kind: "quiz", id: quiz.id },
      ],
    });
    await post(admin, `/api/pilot/learning-paths/${path.id}/assign`, {
      userIds: [user.id],
      dueDays: 7,
    });
    await admin.request.put(`/api/admin/training-modules/${module.id}`, {
      data: { transcript: "Changed after assignment" },
    });
    expect(
      (
        await learner.request.post("/api/login", {
          data: { email: user.email, password: review.password },
        })
      ).status(),
    ).toBe(200);
    const page = await learner.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/employee/learning-paths");
    await page
      .getByRole("button", {
        name: new RegExp("Browser ordered path " + suffix),
      })
      .click();
    await expect(
      page.getByText("Verify requests using a trusted channel.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Step 2:/ })).toBeDisabled();
    await page
      .getByRole("button", { name: "I have reviewed this step", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Step completed");
    await page.getByRole("button", { name: /Step 2:/ }).click();
    await page.getByLabel("Report", { exact: true }).check();
    await page.getByLabel("Verify", { exact: true }).check();
    await page
      .getByRole("button", { name: "Submit path assessment", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Learning path completed",
    );
    expect(errors).toEqual([]);
    await page.screenshot({
      path: "logs/pilot/completed-learning-path.png",
      fullPage: true,
    });
  } finally {
    if (user) await admin.request.delete(`/api/users/${user.id}`);
    if (path)
      await admin.request.delete(`/api/pilot/learning-paths/${path.id}`);
    if (quiz) await admin.request.delete(`/api/admin/quizzes/${quiz.id}`);
    if (module)
      await admin.request.delete(`/api/admin/training-modules/${module.id}`);
    await learner.close();
    await admin.close();
  }
});

test("Outlook pane passes identifiers to authenticated review without sending a report", async ({
  page,
}) => {
  await page.route("https://appsforoffice.microsoft.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.Office={context:{mailbox:{item:{internetMessageId:'<browser-fixture@review.test>',subject:'Browser fixture'}}},onReady:fn=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn();}};`,
    }),
  );
  await page.goto("/outlook/report.html");
  const link = page.getByRole("link", {
    name: "Review report in PhishNet",
    exact: true,
  });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(new URL(href!).pathname).toBe("/employee/report");
  expect(new URL(href!).searchParams.get("messageKey")).toBe(
    "<browser-fixture@review.test>",
  );
  // Open only the review page; the report submission button remains untouched.
  await page.request.post("/api/login", {
    data: { email: review.accounts.employee.email, password: review.password },
  });
  await page.goto(href!);
  await expect(
    page.getByLabel("Internet Message-ID", { exact: true }),
  ).toHaveValue("<browser-fixture@review.test>");
  await expect(
    page.getByRole("button", { name: "Submit message report", exact: true }),
  ).toBeEnabled();
});

import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const review=JSON.parse(readFileSync('logs/role-review/accounts.json'));
const checks=JSON.parse(readFileSync('logs/role-review/results.json')).results;
const negative=JSON.parse(readFileSync('logs/role-review/negative-permissions.json')).results;
const inputs=existsSync('logs/role-review/browser-inputs.jsonl')?readFileSync('logs/role-review/browser-inputs.jsonl','utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
const clean=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
const origin={root:'Existing supplied account',admin:'Created by the original Admin using Users API',owner:'Public registration and email verification',beta:'Public registration and email verification',orgadmin:'Created by Alpha owner using Users API',manager:'Created by Alpha owner using Users API',employee:'Created by Alpha owner using Users API',betaemployee:'Created by Beta owner using Users API'};
const accountRows=Object.entries(review.accounts).map(([key,a])=>`| ${a.email} | ${a.id} | ${(a.role||[]).join(', ')} | ${a.organizationName} (${a.organizationId}) | ${origin[key]} |`).join('\n');
const extraUsers=inputs.filter(row=>row.name==='OrgAdmin creates User').map(row=>`| ${row.output.email} | ${row.output.id} | User | QA Review Alpha |`).join('\n');
const rows=[];
for(const actor of ['owner','beta']){
 const fixture=review.fixtures[actor],tenant=actor==='owner'?'QA Review Alpha':'QA Review Beta';
 for(const [kind,item]of Object.entries(fixture))rows.push(`| ${tenant} | ${kind} | ${item.id} | ${clean(item.name||item.title||item.questionText)} |`);
}
const defects=[
 ['Videos / MCQs','Replaced disabled placeholders with working training-video and quiz/question editors. Fixed request validation, quiz-detail response parsing and option-input focus.'],
 ['Sidebar','Dashboard is the first entry; existing scroll and expanded-section preservation remain. Managers have a usable organization dashboard.'],
 ['Notification bell and listing','Role-aware supported URLs open campaign details, flashcard cards/study, and article previews/detail. Legacy campaign and enrollment links are normalized. Added the bell to the employee dashboard.'],
 ['Notification visibility','Employees do not receive campaign-management or draft-content notifications. Published content is visible only in their own organization; managers do not receive content-management links they cannot access.'],
 ['Articles','Added draft/published previews in an isolated iframe. Fixed the missing edit route, editor loading, publication state and list invalidation.'],
 ['Role consistency','Admin role and legacy isAdmin flag now agree on login, session deserialization and authorization. Account creation/role updates are transactional.'],
 ['User management','OrgAdmin can manage tenant users and roles but cannot grant, modify or delete global Admins. Manager has read-only user access; employees have none. User-list changes appear immediately.'],
 ['Other navigation / forms','Fixed group Edit, landing-page refresh, employee flashcard/article layouts and duplicate flashcard study layouts.'],
 ['Key rotation','The old destructive placeholder is blocked with HTTP 409 and a disabled UI control; existing ciphertext remains decryptable. Full key rotation is still unavailable.'],
];
const md=`# PhishNet QA role and content review - 10 November 2026

The supplied \`admin.1@audit.test\` / \`PhishNetAuditOnly2026!\` account was tested
again through both the API and browser. The app is running at
http://localhost:5000 against the isolated local \`phishnet_audit\` database with
email delivery directed to a sink. Existing account passwords were not changed.

## Supported roles and test accounts

The application has **Admin, OrgAdmin, Manager and User** roles. It has no
separately named SuperAdmin role: **Admin is the current platform/super admin**.
Public registration creates an OrgAdmin for a new organization, never an Admin.
Only an existing platform Admin can grant Admin through user management.

All QA accounts below use **\`${review.password}\`**. This is synthetic local test
data. The original supplied account retains its original password above.

| Email | User ID | Role | Organization (ID) | Creation path tested |
| --- | --- | --- | --- | --- |
${accountRows}

Additional employees created using the actual OrgAdmin Users form, with the
same QA password, are retained for manual verification:

| Email | User ID | Role | Organization |
| --- | --- | --- | --- |
${extraUsers}

Registration/email verification, direct user creation, login and assignment of
each of the four supported roles were exercised. Invitation acceptance was also
checked in a disposable tenant. Temporary security-test accounts/tenants were
deleted; the named QA accounts and content below remain.

## Permission and data-visibility matrix

| Area | Admin (platform/super admin) | OrgAdmin | Manager | User / employee |
| --- | --- | --- | --- | --- |
| Landing page after login | / | /org-admin | /org-admin | /employee |
| Organization registry / operations | Yes | No | No | No |
| Campaigns, audiences, templates, landing pages | Manage in current organization | Manage own organization | Manage own organization | No |
| SMTP metadata | Yes | Own organization | Read to choose a campaign sender | No |
| SMTP/delivery configuration | Yes | Own organization | No | No |
| Reports | Current organization | Own organization | Own organization | No management reports |
| Users | Manage current-organization users and grant Admin | Manage tenant users; cannot grant/modify/delete Admin | Read-only own-organization list | No user directory |
| Learning content management | Current organization | Own organization | No | No |
| Training assignments | Yes | Own organization | No | Own-organization training catalog; personal progress and assigned due dates |
| Published employee learning content | Preview through management screens | Preview through management screens | No employee portal | Published content in own organization |
| Draft articles / unpublished decks and quizzes | Manage/preview | Manage/preview own organization | No | Hidden |
| Global badge catalog | Manage | No global badge management | No | Earn/view published global badges |
| Profile / notification preferences | Own account | Own account | Own account | Own account |
| Governance / secrets / platform operations | Yes; unsafe rotation blocked | No platform governance | No | No |

Resource screens retain the project's existing organization context: a
platform Admin can see the organization registry and system operations, but
campaign/content list and detail screens are scoped to that Admin's current
organization. No tenant-impersonation or tenant-switching feature was added.
The Admin account does not use employee-only endpoints; it previews content
through management screens instead.

Negative checks confirmed that a tenant admin cannot grant Admin, change a
platform Admin in the same tenant, or edit another tenant's users; a Manager
cannot create users or change delivery; and employees cannot access management
APIs, drafts or another tenant's content. Forged \`isAdmin\`/\`organizationId\`
fields do not elevate a user. Promotion/demotion applies to existing sessions
on their next request, and disabled Admin accounts lose their session and cannot
log in. Reload a browser after changing its role to refresh the visible menu.

## Fixes made

| Area | Result |
| --- | --- |
${defects.map(([area,result])=>['|',area,'|',result,'|'].join(' ')).join('\n')}

MCQs belong to quizzes. On Content > MCQs, create a quiz if needed, then click
**Add New MCQ**, choose that quiz, and add the question. Videos use the training
module editor with a video URL, duration, category and description.

## Persistent sample data

Use \`qa.owner@review.test\` or \`qa.orgadmin@review.test\` for Alpha management,
\`qa.employee@review.test\` for Alpha employee views, and the corresponding Beta
accounts to verify separation. The platform QA admin's data belongs to Audit
Alpha, which is a different organization from QA Review Alpha.

| Organization | Resource | ID | Name / question |
| --- | --- | --- | --- |
${rows.join('\n')}

Quick links after signing into the appropriate **QA Review Alpha** account:

- [Campaign details](http://localhost:5000/org-admin/campaigns?campaign=${review.fixtures.owner.campaign.id})
- [Published article admin preview](http://localhost:5000/admin/content/articles?preview=${review.fixtures.owner.article.id})
- [Private draft admin preview](http://localhost:5000/admin/content/articles?preview=${review.fixtures.owner.draft.id})
- [Flashcard deck management](http://localhost:5000/admin/content/flashcards?deck=${review.fixtures.owner.deck.id})
- [Employee article](http://localhost:5000/employee/articles/${review.fixtures.owner.article.id})
- [Employee flashcard study](http://localhost:5000/employee/flashcards?deck=${review.fixtures.owner.deck.id})

Additional browser-created videos, quizzes/questions, global Admin campaign/
article/deck fixtures and Users-form employees are logged with their inputs,
IDs, HTTP statuses and returned objects in
\`logs/role-review/browser-inputs.jsonl\`. They were deliberately retained.

## Manual recheck steps

1. Log in with the original Admin. Confirm Dashboard is first. Open Content >
   Videos and use Add New Video; create/edit a training video record. Open
   Content > MCQs, create a quiz, choose it with Add New MCQ, enter two options
   and a correct answer, then save. Options should retain keyboard focus.
2. Open Articles. Use Preview article on a draft and on a published article.
   Confirm actual body content appears; previewing a draft does not publish it.
   The pencil opens the article editor rather than a 404 page.
3. Sign into the separate QA Admin. Open the bell and click the retained
   \`QA admin campaign\`, \`QA admin article\` and \`QA admin flashcard\` notifications.
   Campaign details, the article preview and deck cards should open.
4. Sign into Alpha owner. Click campaign/article/deck notifications from both
   the bell and Notifications page. Published and draft previews are available
   to this management role. Create a tenant User and confirm it appears without
   reloading. Admin must not appear among assignable roles.
5. Sign into Alpha employee. Use its bell to open the published Alpha article
   and flashcard study. The private draft and Beta content must not appear.
   Direct management routes should redirect to the employee home, and their
   APIs should deny access. Assigned Alpha training and quiz results remain.
6. Sign into Manager. Confirm the organization dashboard, campaigns, groups,
   templates, reports and read-only Users work. Content management, user
   mutations, SMTP configuration and platform administration must be denied.
7. Sign into Beta owner/employee and confirm only Beta tenant content is shown.

## Verification and evidence

- TypeScript check and production build passed.
- Main browser suite: **68 passed**. This includes four-role login/menu checks,
  actual video and MCQ creation, role-specific notification clicks, article
  preview, OrgAdmin user creation, navigation regressions and page-load checks.
- **Three additional browser tests passed** for global Admin's own campaign,
  article and deck notifications (71 distinct browser checks across these runs).
- Foundation suite including shared role/destination regressions: **41 passed**.
- Role/account/data-visibility API checks: **${checks.filter(r=>r.status==='PASS').length} passed**, ${checks.filter(r=>r.status==='FAIL').length} failed.
- Additional adversarial permission/session checks: **${negative.filter(r=>r.status==='PASS').length} passed**, ${negative.filter(r=>r.status==='FAIL').length} failed.
- Governance checks: **5 passed**, including preservation of existing secrets
  when the disabled rotation endpoint is called.
- Final create/edit/use/delete feature cycle: **62 checks passed, 0 failed**.
  This includes setup/cleanup checks and is not a count of distinct features.
- Read-only API sweep: **186 requests**, no HTTP 5xx or connection failures.

Evidence:

- \`logs/role-review/accounts.json\`: persistent accounts and fixture snapshots.
- \`logs/role-review/results.json\`: account creation, payloads, responses and
  allowed/denied endpoint checks; passwords/tokens are redacted in request logs.
- \`logs/role-review/negative-permissions.json\`: adversarial permission results.
- \`logs/role-review/browser-inputs.jsonl\`: actual form input and server responses.
- \`logs/feature-cycle/governance.json\`: registration/recovery/SSO/rotation checks.
- \`logs/api-audit.json\`: read-only endpoint sweep.
- \`playwright-report/index.html\`: latest browser run. A filtered run replaces
  this report; the suite and additional Admin checks above are separate runs.

## Remaining limits

Full encryption-key rotation is intentionally unavailable until atomic
re-encryption is implemented. Actual SMTP/SendGrid delivery, public DNS
verification, a live identity-provider login, AI/contact-provider requests and
production capacity were not certified. Synthetic video URLs verify creation,
editing and assignment, not third-party media playback. MCQs are managed as
quiz questions, not a new independent question-bank subsystem. This audit
checks representative role boundaries and workflows, not every possible input
or concurrency pattern.

The 9 November audit report is a historical snapshot. Its fixed findings should
be read alongside this follow-up rather than treated as current failures.
`;
writeFileSync('docs/qa-role-review-2026-11-10.md',md);
console.log('Wrote docs/qa-role-review-2026-11-10.md');

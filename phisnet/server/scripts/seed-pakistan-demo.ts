import 'dotenv/config';
import { db } from '../db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  users,
  organizations,
  campaigns,
  campaignResults,
  emailTemplates,
  landingPages,
  smtpProfiles,
  groups,
  targets,
  trainingModules,
  trainingProgress,
  quizzes,
  quizAttempts,
  userBadges,
  badges,
  userPoints,
  reportSchedules,
  threatStatistics,
  riskScores,
  rolesSchema,
  userRolesSchema,
  articles,
  flashcardDecks,
  flashcards,
} from '../../shared/schema';
import { hashPassword } from '../auth';

// Lightweight Pakistani-style name/company/domain pools reused for all orgs
const PAKISTANI_NAMES = [
  'Ahmed Ali', 'Muhammad Abdullah', 'Ali Hassan', 'Usman Khan', 'Bilal Ahmed',
  'Hamza Malik', 'Zain Abbas', 'Faisal Mahmood', 'Talha Hussain', 'Arslan Shah',
  'Imran Siddiqui', 'Kamran Iqbal', 'Shahzad Akram', 'Adnan Rashid', 'Farhan Aslam',
  'Hassan Raza', 'Junaid Tariq', 'Kashif Saeed', 'Nasir Mehmood', 'Omar Farooq',
  'Qasim Nawaz', 'Rizwan Butt', 'Salman Haider', 'Tariq Aziz', 'Waqar Younas',
  'Yasir Chaudhry', 'Zahid Latif', 'Asad Ullah', 'Babar Azam', 'Danish Rauf',
  'Ehsan Qadir', 'Fahad Mustafa', 'Ghulam Abbas', 'Haris Sohail', 'Ibrahim Khan',
  'Jawad Alam', 'Kaleem Baig', 'Luqman Waheed', 'Moiz Ahmed', 'Nabeel Qureshi'
];

const PAKISTANI_DOMAINS = [
  'netsol.com', 'tps.com.pk', 'systemsltd.com', 'pknic.net.pk',
  'ptcl.net.pk', 'ubldigital.com', 'mcb.com.pk', 'hbl.com',
  'nayatel.com', 'comsats.edu.pk', 'lums.edu.pk', 'nust.edu.pk'
];

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // Clamp max date around 15 Nov 2025 if future
  const cap = new Date('2025-11-15T12:00:00Z');
  if (d > cap) return cap;
  return d;
}

function generateEmail(name: string, domain: string): string {
  const firstName = name.split(' ')[0].toLowerCase();
  const lastName = name.split(' ')[1]?.toLowerCase() || '';
  const r = Math.random();
  if (r < 0.5) return `${firstName}.${lastName}@${domain}`;
  if (r < 0.8) return `${firstName}${lastName}@${domain}`;
  return `${firstName.charAt(0)}${lastName}@${domain}`;
}

async function seedCorePhishingDataForOrg(orgId: number, adminId: number) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) return;

  console.log(`\n🇵🇰 Seeding Pakistani-style phishing data for org: ${org.name} (ID: ${orgId})`);

  // Avoid duplicate SMTP profile with same name
  const existingSmtp = await db
    .select()
    .from(smtpProfiles)
    .where(and(eq(smtpProfiles.organizationId, orgId), eq(smtpProfiles.name, 'Pakistan Office SMTP')));

  let smtpProfileId: number;
  if (existingSmtp.length === 0) {
    const [smtp] = await db.insert(smtpProfiles)
      .values({
        name: 'Pakistan Office SMTP',
        host: 'smtp.gmail.com',
        port: 587,
        username: 'alerts@pkcompany.com',
        password: 'encrypted_password_here',
        fromEmail: 'security@pkcompany.com',
        fromName: 'IT Security Team',
        organizationId: orgId,
      })
      .returning();
    smtpProfileId = smtp.id;
    console.log('  ✓ Created SMTP profile');
  } else {
    smtpProfileId = existingSmtp[0].id;
    console.log('  ↻ SMTP profile already exists, reusing');
  }

  // Email templates (idempotent based on name)
  const templateDefs = [
    {
      name: 'IT Helpdesk Password Reset (PK)',
      subject: 'Urgent: Password Expiry Notice',
      description: 'Password reset urgency template for Pakistani orgs',
    },
    {
      name: 'HR Document Review (PK)',
      subject: 'Action Required: Review Your Employee Documents',
      description: 'HR urgency template',
    },
    {
      name: 'Bank Security Alert (PK)',
      subject: 'Security Alert: Unusual Activity Detected',
      description: 'Banking security alert',
    },
  ];

  const existingTemplates = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.organization_id, orgId));
  const existingByName = new Set(existingTemplates.map(t => t.name));

  const createdTemplates: typeof emailTemplates.$inferSelect[] = [];
  for (const def of templateDefs) {
    if (existingByName.has(def.name)) continue;
    const [tpl] = await db.insert(emailTemplates)
      .values({
        name: def.name,
        subject: def.subject,
        html_content: '<html><body><h2>Phish Simulation</h2><p>{{.Content}}</p></body></html>',
        text_content: 'Phish simulation content',
        sender_name: 'Security Team',
        sender_email: 'security@' + (org.domain ?? 'company.local'),
        type: 'phishing',
        complexity: 'medium',
        description: def.description,
        category: 'phishing',
        organization_id: orgId,
        created_by_id: adminId,
      })
      .returning();
    createdTemplates.push(tpl);
  }
  console.log(`  ✓ Email templates seeded/ensured (${createdTemplates.length} new, ${existingTemplates.length} existing)`);

  // Landing pages (keyed by name)
  const landingDefs = [
    'Fake Password Reset Portal (PK)',
    'Fake HR Portal (PK)',
  ];

  const existingLanding = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.organizationId, orgId));
  const existingLandingByName = new Set(existingLanding.map(p => p.name));
  const createdLanding: typeof landingPages.$inferSelect[] = [];

  for (const name of landingDefs) {
    if (existingLandingByName.has(name)) continue;
    const html = `<!doctype html><html><body><h2>${name}</h2><form><input placeholder="Email"/><input type="password" placeholder="Password"/><button>Continue</button></form></body></html>`;
    const [page] = await db.insert(landingPages)
      .values({
        name,
        description: 'Pakistani-style phishing landing page',
        htmlContent: html,
        redirectUrl: 'https://www.google.com',
        pageType: 'phishing',
        thumbnail: null,
        captureData: true,
        capturePasswords: false,
        organizationId: orgId,
        createdById: adminId,
      })
      .returning();
    createdLanding.push(page);
  }
  console.log(`  ✓ Landing pages seeded/ensured (${createdLanding.length} new, ${existingLanding.length} existing)`);

  // Groups & targets: avoid recreating if org already has more than a minimal set
  const existingGroups = await db.select().from(groups).where(eq(groups.organizationId, orgId));
  const needsGroups = existingGroups.length === 0;

  const allGroups: typeof groups.$inferSelect[] = [...existingGroups];
  const allTargets: typeof targets.$inferSelect[] = [];

  if (needsGroups) {
    console.log('  ➕ Creating Pakistani department groups and employees');
    const deptDefs = [
      { name: 'IT Department (PK)', count: 12 },
      { name: 'Finance Team (PK)', count: 10 },
      { name: 'HR Department (PK)', count: 6 },
      { name: 'Sales & Marketing (PK)', count: 14 },
    ];

    let nameIndex = 0;
    for (const dept of deptDefs) {
      const [g] = await db.insert(groups)
        .values({
          name: dept.name,
          description: null,
          organizationId: orgId,
        })
        .returning();
      allGroups.push(g);

      for (let i = 0; i < dept.count; i++) {
        const fullName = PAKISTANI_NAMES[nameIndex % PAKISTANI_NAMES.length];
        nameIndex++;
        const domain = PAKISTANI_DOMAINS[Math.floor(Math.random() * PAKISTANI_DOMAINS.length)];
        const email = generateEmail(fullName, domain);
        const [firstName, lastName] = fullName.split(' ');
        const [t] = await db.insert(targets)
          .values({
            firstName,
            lastName,
            email,
            position: dept.name.includes('Management') ? 'Manager' : 'Employee',
            department: dept.name,
            groupId: g.id,
            organizationId: orgId,
          })
          .returning();
        allTargets.push(t);
      }
    }
  } else {
    console.log('  ↻ Groups already exist, reusing for campaign seeding');
    const existingTargets = await db
      .select()
      .from(targets)
      .where(inArray(targets.groupId, existingGroups.map(g => g.id)));
    allTargets.push(...existingTargets);
  }

  // Campaigns: don’t duplicate by name
  const existingCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.organizationId, orgId));
  const existingCampaignNames = new Set(existingCampaigns.map(c => c.name));

  if (allGroups.length === 0 || allTargets.length === 0) {
    console.log('  ⚠️ Skipping campaign seeding, no groups/targets available');
    return;
  }

  const templatePool = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.organization_id, orgId));
  const landingPool = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.organizationId, orgId));

  if (templatePool.length === 0 || landingPool.length === 0) {
    console.log('  ⚠️ Skipping campaigns, need at least one template and landing page');
    return;
  }

  const campaignConfigs = [
    { name: 'Q3 Security Awareness - Karachi Office', daysAgoStart: 70, duration: 7, targetPct: 0.7 },
    { name: 'HR Policy Update - Lahore Region', daysAgoStart: 45, duration: 5, targetPct: 0.6 },
    { name: 'Banking Fraud Drill - Islamabad', daysAgoStart: 25, duration: 4, targetPct: 0.5 },
    { name: 'All Staff Security Baseline - Pakistan', daysAgoStart: 10, duration: 7, targetPct: 0.9 },
  ];

  for (const cfg of campaignConfigs) {
    if (existingCampaignNames.has(cfg.name)) continue;

    const start = daysAgo(cfg.daysAgoStart);
    const end = daysAgo(cfg.daysAgoStart - cfg.duration);
    const group = allGroups[0];
    const template = templatePool[Math.floor(Math.random() * templatePool.length)];
    const page = landingPool[Math.floor(Math.random() * landingPool.length)];

    const [campaign] = await db.insert(campaigns)
      .values({
        name: cfg.name,
        organizationId: orgId,
        createdById: adminId,
        emailTemplateId: template.id,
        landingPageId: page.id,
        smtpProfileId,
        targetGroupId: group.id,
        status: 'completed',
        scheduledAt: start,
        endDate: end,
      })
      .returning();

    console.log(`  ✓ Campaign: ${campaign.name}`);

    // Seed simple results – 60% sent, 40% opened, 20% clicked
    const shuffledTargets = [...allTargets].sort(() => Math.random() - 0.5);
    const slice = shuffledTargets.slice(0, Math.floor(shuffledTargets.length * cfg.targetPct));
    const resultRows = slice.map(t => {
      const sentAt = start;
      const opened = Math.random() < 0.6;
      const clicked = opened && Math.random() < 0.4;
      const status = clicked ? 'clicked' : opened ? 'opened' : 'sent';
      return {
        campaignId: campaign.id,
        targetId: t.id,
        organizationId: orgId,
        status,
        sentAt,
        opened,
        openedAt: opened ? daysAgo(cfg.daysAgoStart - 1) : null,
        clicked,
        clickedAt: clicked ? daysAgo(cfg.daysAgoStart - 1) : null,
        submitted: false,
        submittedAt: null,
        submittedData: null,
      } as typeof campaignResults.$inferInsert;
    });

    if (resultRows.length > 0) {
      await db.insert(campaignResults).values(resultRows);
      console.log(`    → ${resultRows.length} results inserted`);
    }
  }
}

async function seedTrainingForAdmin(adminId: number, orgId: number) {
  // Avoid duplicate progress/attempts by clearing this admin's training data first
  await db.delete(trainingProgress).where(eq(trainingProgress.userId, adminId));
  await db.delete(quizAttempts).where(eq(quizAttempts.userId, adminId));
  await db.delete(userBadges).where(eq(userBadges.userId, adminId));
  await db.delete(userPoints).where(eq(userPoints.userId, adminId));

  // Ensure a small set of modules
  const existingModules = await db
    .select()
    .from(trainingModules)
    .where(eq(trainingModules.organizationId, orgId));
  const titles = new Set(existingModules.map(m => m.title));

  const baseModules = [
    { title: 'Phishing Basics (PK)', category: 'phishing' },
    { title: 'Password Hygiene (PK)', category: 'passwords' },
    { title: 'Social Engineering Red Flags (PK)', category: 'social_engineering' },
  ];

  const insertMods = baseModules
    .filter(m => !titles.has(m.title))
    .map(m => ({
      organizationId: orgId,
      title: m.title,
      description: m.title + ' training module',
      category: m.category,
      difficulty: 'beginner',
      durationMinutes: 15,
      videoUrl: null,
      thumbnailUrl: null,
      transcript: null,
      tags: [],
      isRequired: false,
      passingScore: 80,
      orderIndex: 0,
      createdBy: adminId,
    }));

  let insertedMods: typeof trainingModules.$inferSelect[] = [];
  if (insertMods.length > 0) {
    insertedMods = await db.insert(trainingModules).values(insertMods).returning();
  }
  const allModules = [...existingModules, ...insertedMods];

  // Basic progress over last ~30 days
  const progressRows = allModules.slice(0, 3).map((m, idx) => {
    const status = idx === 0 ? 'completed' : idx === 1 ? 'in_progress' : 'not_started';
    return {
      userId: adminId,
      moduleId: m.id,
      status,
      progressPercentage: status === 'completed' ? 100 : status === 'in_progress' ? 40 : 0,
      videoTimestamp: status === 'in_progress' ? 120 : 0,
      completedAt: status === 'completed' ? daysAgo(20 - idx * 3) : null,
      assignedAt: daysAgo(30),
      dueDate: daysAgo(-7),
      updatedAt: new Date(),
    } as typeof trainingProgress.$inferInsert;
  });
  if (progressRows.length) await db.insert(trainingProgress).values(progressRows);

  // Simple quizzes for first 2 modules
  const quizModules = allModules.slice(0, 2);
  const existingQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.organizationId, orgId));
  const byModule = new Set(existingQuizzes.filter(q => q.moduleId != null).map(q => q.moduleId));
  const quizInserts = quizModules
    .filter(m => !byModule.has(m.id))
    .map(m => ({
      organizationId: orgId,
      moduleId: m.id,
      title: `${m.title} Quiz`,
      description: `Assessment for ${m.title}`,
      passingScore: 80,
      timeLimit: 10,
      allowRetakes: true,
      maxAttempts: 5,
      randomizeQuestions: false,
      showCorrectAnswers: true,
      createdBy: adminId,
    }));
  let insertedQuizzes: typeof quizzes.$inferSelect[] = [];
  if (quizInserts.length) {
    insertedQuizzes = await db.insert(quizzes).values(quizInserts).returning();
  }
  const allQuizzes = [...existingQuizzes, ...insertedQuizzes].filter(q => q.moduleId && quizModules.some(m => m.id === q.moduleId));

  const attempts: typeof quizAttempts.$inferInsert[] = [];
  allQuizzes.forEach((q, idx) => {
    const completedAt = daysAgo(15 - idx * 3);
    const score = 75 + idx * 5;
    attempts.push({
      userId: adminId,
      quizId: q.id,
      attemptNumber: 1,
      score,
      totalQuestions: 10,
      correctAnswers: Math.round(score / 10),
      answers: {},
      passed: score >= 80,
      startedAt: completedAt,
      completedAt,
      timeSpent: 120,
    });
  });
  if (attempts.length) await db.insert(quizAttempts).values(attempts);

  // Badges & points – assign a couple of existing badges
  const someBadges = await db.select().from(badges).limit(3);
  if (someBadges.length) {
    const badgeRows = someBadges.map((b, i) => ({
      userId: adminId,
      badgeId: b.id,
      earnedAt: daysAgo(5 + i),
    }));
    await db.insert(userBadges).values(badgeRows).onConflictDoNothing();
  }

  await db.insert(userPoints)
    .values({
      userId: adminId,
      totalPoints: 900,
      currentStreak: 3,
      longestStreak: 10,
      lastActivityDate: daysAgo(1),
    })
    .onConflictDoUpdate({
      target: userPoints.userId,
      set: {
        totalPoints: sql`EXCLUDED.total_points`,
        currentStreak: sql`EXCLUDED.current_streak`,
        longestStreak: sql`EXCLUDED.longest_streak`,
        lastActivityDate: sql`EXCLUDED.last_activity_date`,
      },
    });
}

async function seedEmployeeUsersForOrg(orgId: number) {
  console.log('  👥 Seeding employee users...');

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) return;

  // Get User role ID
  const [userRole] = await db.select({ id: rolesSchema.id })
    .from(rolesSchema)
    .where(eq(rolesSchema.name, 'User'))
    .limit(1);

  if (!userRole) {
    console.log('    ⚠️ User role not found - skipping employee user seeding');
    return;
  }

  // Get a domain for this org (use org name to generate)
  const domain = PAKISTANI_DOMAINS[orgId % PAKISTANI_DOMAINS.length];
  
  // Create 5-10 employee users per org
  const numUsers = 5 + Math.floor(Math.random() * 6);
  const createdUsers: number[] = [];

  for (let i = 0; i < numUsers; i++) {
    const name = PAKISTANI_NAMES[(orgId * 13 + i) % PAKISTANI_NAMES.length];
    const [firstName, ...lastParts] = name.split(' ');
    const lastName = lastParts.join(' ') || 'Employee';
    const email = generateEmail(name, domain);

    // Check if user already exists
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`    ↻ User ${email} already exists`);
      createdUsers.push(existing[0].id);
      continue;
    }

    try {
      const [newUser] = await db.insert(users).values({
        email,
        password: await hashPassword('Employee@123'),
        firstName,
        lastName,
        isAdmin: false,
        isActive: true,
        organizationId: orgId,
        createdAt: daysAgo(Math.floor(Math.random() * 60)),
        updatedAt: new Date(),
      }).returning();

      // Assign User role
      await db.insert(userRolesSchema).values({
        userId: newUser.id,
        roleId: userRole.id,
      }).onConflictDoNothing();

      createdUsers.push(newUser.id);
      console.log(`    ✓ Created employee: ${firstName} ${lastName} (${email})`);
    } catch (e: any) {
      if (e?.code === '23505') {
        console.log(`    ↻ User ${email} already exists (race condition)`);
      } else {
        console.error(`    ✗ Failed to create ${email}:`, e.message);
      }
    }
  }

  console.log(`    ✅ Seeded ${createdUsers.length} employee users`);
  return createdUsers;
}

async function seedEmployeeContentForOrg(orgId: number, adminId: number, employeeUserIds: number[]) {
  console.log('  📚 Seeding employee content (training, quizzes, articles, flashcards, badges)...');

  // 1. Training Modules
  const trainingData = [
    { title: 'Phishing Awareness 101', category: 'phishing', difficulty: 'beginner', duration: 15 },
    { title: 'Password Security Best Practices', category: 'passwords', difficulty: 'beginner', duration: 20 },
    { title: 'Social Engineering Defense', category: 'social_engineering', difficulty: 'intermediate', duration: 30 },
    { title: 'Malware Prevention', category: 'malware', difficulty: 'intermediate', duration: 25 },
    { title: 'Secure Remote Work', category: 'remote_work', difficulty: 'beginner', duration: 20 },
    { title: 'Data Privacy Fundamentals', category: 'privacy', difficulty: 'intermediate', duration: 35 },
  ];

  const moduleIds: number[] = [];
  for (const mod of trainingData) {
    const existing = await db.select({ id: trainingModules.id })
      .from(trainingModules)
      .where(and(
        eq(trainingModules.organizationId, orgId),
        eq(trainingModules.title, mod.title)
      ))
      .limit(1);

    if (existing.length > 0) {
      moduleIds.push(existing[0].id);
    } else {
      const [newMod] = await db.insert(trainingModules).values({
        organizationId: orgId,
        createdBy: adminId,
        title: mod.title,
        description: `Learn about ${mod.title.toLowerCase()} and protect your organization.`,
        category: mod.category,
        difficulty: mod.difficulty,
        durationMinutes: mod.duration,
        content: `<h2>${mod.title}</h2><p>This is a comprehensive guide to ${mod.title.toLowerCase()}.</p>`,
        isActive: true,
      }).returning();
      moduleIds.push(newMod.id);
    }
  }
  console.log(`    ✓ ${moduleIds.length} training modules ensured`);

  // 2. Assign training progress to employees (mix of completed, in-progress, not started)
  for (const userId of employeeUserIds.slice(0, Math.min(10, employeeUserIds.length))) {
    for (let i = 0; i < moduleIds.length; i++) {
      const rand = Math.random();
      let status: 'not_started' | 'in_progress' | 'completed';
      let progress = 0;
      let completedAt = null;

      if (rand < 0.4) { // 40% completed
        status = 'completed';
        progress = 100;
        completedAt = daysAgo(Math.floor(Math.random() * 30));
      } else if (rand < 0.7) { // 30% in progress
        status = 'in_progress';
        progress = 20 + Math.floor(Math.random() * 60);
      } else { // 30% not started
        status = 'not_started';
      }

      await db.insert(trainingProgress).values({
        userId,
        moduleId: moduleIds[i],
        status,
        progressPercentage: progress,
        startedAt: status !== 'not_started' ? daysAgo(Math.floor(Math.random() * 45)) : null,
        completedAt,
      }).onConflictDoNothing();
    }
  }
  console.log(`    ✓ Training progress assigned to employees`);

  // 3. Quizzes
  const quizData = [
    { title: 'Phishing Identification Quiz', passingScore: 80, timeLimit: 10 },
    { title: 'Password Security Assessment', passingScore: 75, timeLimit: 15 },
    { title: 'Social Engineering Scenarios', passingScore: 80, timeLimit: 20 },
  ];

  const quizIds: number[] = [];
  for (const quiz of quizData) {
    const existing = await db.select({ id: quizzes.id })
      .from(quizzes)
      .where(and(
        eq(quizzes.organizationId, orgId),
        eq(quizzes.title, quiz.title)
      ))
      .limit(1);

    if (existing.length > 0) {
      quizIds.push(existing[0].id);
    } else {
      const [newQuiz] = await db.insert(quizzes).values({
        organizationId: orgId,
        createdBy: adminId,
        title: quiz.title,
        description: `Test your knowledge on ${quiz.title.toLowerCase()}.`,
        passingScore: quiz.passingScore,
        timeLimit: quiz.timeLimit,
        questions: [
          { id: 1, question: 'Sample question 1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 0 },
          { id: 2, question: 'Sample question 2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 1 },
        ],
        isActive: true,
      }).returning();
      quizIds.push(newQuiz.id);
    }
  }
  console.log(`    ✓ ${quizIds.length} quizzes ensured`);

  // Assign quiz attempts to some employees
  for (const userId of employeeUserIds.slice(0, Math.min(8, employeeUserIds.length))) {
    for (let i = 0; i < quizIds.length; i++) {
      const totalQuestions = 2;
      const correctAnswers = Math.floor(totalQuestions * (0.6 + Math.random() * 0.4)); // 60-100% correct
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      await db.insert(quizAttempts).values({
        userId,
        quizId: quizIds[i],
        attemptNumber: 1,
        score,
        totalQuestions,
        correctAnswers,
        answers: [{ questionId: 1, answer: 0 }, { questionId: 2, answer: 1 }],
        completedAt: daysAgo(Math.floor(Math.random() * 20)),
      }).onConflictDoNothing();
    }
  }
  console.log(`    ✓ Quiz attempts assigned to employees`);

  // 4. Articles
  const articleData = [
    { title: 'Top 10 Phishing Red Flags', category: 'phishing', readTime: 5 },
    { title: 'Creating Strong Passwords in 2025', category: 'passwords', readTime: 7 },
    { title: 'Spotting Social Engineering Attacks', category: 'social_engineering', readTime: 10 },
    { title: 'Ransomware: What You Need to Know', category: 'malware', readTime: 8 },
    { title: 'Secure Your Home Office', category: 'remote_work', readTime: 6 },
  ];

  for (const article of articleData) {
    const existing = await db.select({ id: articles.id })
      .from(articles)
      .where(and(
        eq(articles.organizationId, orgId),
        eq(articles.title, article.title)
      ))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(articles).values({
        organizationId: orgId,
        authorId: adminId,
        title: article.title,
        slug: article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        content: `<h1>${article.title}</h1><p>This article covers essential information about ${article.title.toLowerCase()}.</p>`,
        excerpt: `Learn about ${article.title.toLowerCase()}`,
        category: article.category,
        readTime: article.readTime,
        isPublished: true,
        publishedAt: daysAgo(Math.floor(Math.random() * 60)),
      });
    }
  }
  console.log(`    ✓ ${articleData.length} articles ensured`);

  // 5. Flashcard Decks
  const deckData = [
    { title: 'Phishing Terms', description: 'Master phishing terminology' },
    { title: 'Security Acronyms', description: 'Common security acronyms explained' },
    { title: 'Password Best Practices', description: 'Quick password security tips' },
  ];

  for (const deck of deckData) {
    const existing = await db.select({ id: flashcardDecks.id })
      .from(flashcardDecks)
      .where(and(
        eq(flashcardDecks.organizationId, orgId),
        eq(flashcardDecks.title, deck.title)
      ))
      .limit(1);

    if (existing.length === 0) {
      const [newDeck] = await db.insert(flashcardDecks).values({
        organizationId: orgId,
        createdBy: adminId,
        title: deck.title,
        description: deck.description,
        category: deck.title.includes('Phishing') ? 'phishing' : deck.title.includes('Password') ? 'passwords' : 'general',
        isActive: true,
      }).returning();

      // Add some flashcards to the deck
      const cardData = [
        { front: 'What is phishing?', back: 'A social engineering attack using fraudulent communications to steal data' },
        { front: 'What is 2FA?', back: 'Two-Factor Authentication - an extra layer of security' },
        { front: 'Password length?', back: 'Use at least 12-16 characters for strong passwords' },
      ];

      for (const card of cardData) {
        await db.insert(flashcards).values({
          deckId: newDeck.id,
          frontContent: card.front,
          backContent: card.back,
          order: 0,
        });
      }
    }
  }
  console.log(`    ✓ ${deckData.length} flashcard decks ensured`);

  // 6. Badges (using existing badges from system - skip if table doesn't exist or has issues)
  try {
    const existingBadges = await db.select({ id: badges.id })
      .from(badges)
      .where(eq(badges.organizationId, orgId))
      .limit(5);

    if (existingBadges.length > 0) {
      console.log(`    ✓ Using ${existingBadges.length} existing badges`);
      
      // Award some badges to employees
      for (const userId of employeeUserIds.slice(0, Math.min(6, employeeUserIds.length))) {
        const numBadges = 1 + Math.floor(Math.random() * Math.min(3, existingBadges.length)); // 1-3 badges
        for (let i = 0; i < numBadges; i++) {
          await db.insert(userBadges).values({
            userId,
            badgeId: existingBadges[i].id,
            earnedAt: daysAgo(Math.floor(Math.random() * 30)),
          }).onConflictDoNothing();
        }
      }
      console.log(`    ✓ Badges awarded to employees`);
    } else {
      console.log(`    ⚠️ No badges found - skipping badge awards`);
    }
  } catch (e: any) {
    console.log(`    ⚠️ Badge seeding skipped (table may need migration): ${e.message}`);
  }

  // 7. User Points (for leaderboard)
  for (const userId of employeeUserIds) {
    const totalPoints = 100 + Math.floor(Math.random() * 900); // 100-1000 points
    const currentStreak = Math.floor(Math.random() * 15);
    const longestStreak = currentStreak + Math.floor(Math.random() * 10);
    const lastActivityDate = daysAgo(Math.floor(Math.random() * 5));

    await db.insert(userPoints).values({
      userId,
      totalPoints,
      currentStreak,
      longestStreak,
      lastActivityDate,
    }).onConflictDoUpdate({
      target: [userPoints.userId],
      set: {
        totalPoints,
        currentStreak,
        longestStreak,
        lastActivityDate,
      },
    });
  }
  console.log(`    ✓ User points assigned for leaderboard`);

  console.log(`    ✅ Employee content seeded successfully`);
}

  async function seedReportingAndAnalyticsForOrg(orgId: number) {
    console.log('  📊 Seeding reporting & analytics data...');

    // Seed a few threat statistics points for the last 30 days
    const sources = ['urlhaus', 'openphish', 'threatfox', 'phishing-database'];
    const types = ['phishing', 'malware', 'spam'];

    const threatRows: typeof threatStatistics.$inferInsert[] = [];
    for (let d = 30; d >= 0; d -= 5) {
      const day = daysAgo(d);
      for (const source of sources) {
        for (const threatType of types) {
          const base = 10 + Math.floor(Math.random() * 20);
          threatRows.push({
            date: day,
            source,
            threatType,
            count: base + Math.floor((30 - d) / 5) * 3,
            organizationId: orgId,
          });
        }
      }
    }

    if (threatRows.length) {
      await db.insert(threatStatistics).values(threatRows);
      console.log(`  ✓ Inserted ${threatRows.length} threat statistics rows`);
    }

    // Seed risk scores for a sample of users in this org
    const orgUsers = await db.select().from(users).where(eq(users.organizationId, orgId));
    if (orgUsers.length) {
      const riskRows: typeof riskScores.$inferInsert[] = [];
      const sample = orgUsers.slice(0, Math.min(orgUsers.length, 20));
      for (const u of sample) {
        riskRows.push({
          organizationId: orgId,
          userId: u.id,
          score: 40 + Math.floor(Math.random() * 50),
          factors: [
            'campaign_results',
            'training_progress',
          ],
          calculatedAt: daysAgo(1 + Math.floor(Math.random() * 7)),
        });
      }
      try {
        await db.insert(riskScores).values(riskRows);
        console.log(`  ✓ Inserted ${riskRows.length} user risk scores`);
      } catch (e: any) {
        if (e?.code === '42P01') {
          console.log(`  ⚠️ risk_scores table does not exist - skipping risk score seeding`);
        } else {
          throw e;
        }
      }
    }

    // Seed a couple of report schedules so the scheduler UI looks alive
    const existingSchedules = await db
      .select()
      .from(reportSchedules)
      .where(eq(reportSchedules.organizationId, orgId));

    if (existingSchedules.length === 0) {
      const baseRecipients = orgUsers.slice(0, 3).map(u => u.email).join(',') || 'security@company.local';
      const now = new Date();
      await db.insert(reportSchedules).values([
        {
          organizationId: orgId,
          type: 'executive',
          cadence: 'weekly',
          timeOfDay: '09:00',
          timezone: 'Asia/Karachi',
          recipients: baseRecipients,
          enabled: true,
          lastRunAt: daysAgo(3),
          nextRunAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0),
        },
        {
          organizationId: orgId,
          type: 'detailed',
          cadence: 'monthly',
          timeOfDay: '10:00',
          timezone: 'Asia/Karachi',
          recipients: baseRecipients,
          enabled: true,
          lastRunAt: daysAgo(20),
          nextRunAt: daysAgo(-10),
        },
      ]);
      console.log('  ✓ Report schedules created');
    } else {
      console.log('  ↻ Report schedules already exist, skipping');
    }
  }

async function run() {
  try {
    // Find all admin users (isAdmin true) with organizations; skip org-admin specific filtering for now
    const adminUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.isAdmin, true), sql`${users.organizationId} IS NOT NULL`));

    if (adminUsers.length === 0) {
      console.log('⚠️ No admin users with organizations found – nothing to seed');
      process.exit(0);
    }

    console.log(`Found ${adminUsers.length} admin users; seeding per-organization Pakistani demo data...`);

    // Group by organization
    const byOrg = new Map<number, typeof users.$inferSelect[]>();
    for (const u of adminUsers) {
      const orgId = u.organizationId!;
      const arr = byOrg.get(orgId) ?? [];
      arr.push(u);
      byOrg.set(orgId, arr);
    }

    for (const [orgId, admins] of byOrg.entries()) {
      const primaryAdmin = admins[0];
      await seedCorePhishingDataForOrg(orgId, primaryAdmin.id);
      // Seed employee users with User role
      const employeeUserIds = await seedEmployeeUsersForOrg(orgId);
      // Seed employee-facing content (training, quizzes, articles, flashcards, badges, leaderboard)
      await seedEmployeeContentForOrg(orgId, primaryAdmin.id, employeeUserIds);
      // Also seed training/quizzes/badges/points for that admin so dashboards/quizzes look alive
      await seedTrainingForAdmin(primaryAdmin.id, orgId);
      // And seed reporting/threat statistics and risk scores so graphs and reports have data
      await seedReportingAndAnalyticsForOrg(orgId);
    }

    console.log('\n✅ Pakistani demo data seeded for all admin organizations');
    process.exit(0);
  } catch (err) {
    console.error('❌ seed-pakistan-demo failed:', err);
    process.exit(1);
  }
}

run();

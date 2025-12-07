import 'dotenv/config';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import {
  users,
  organizations,
  trainingModules,
  trainingProgress,
  quizzes,
  quizAttempts,
  userBadges,
  badges,
  userPoints
} from '../../shared/schema';
import { hashPassword } from '../auth';

// Email for the demo user
const DEMO_EMAIL = 'test0user@mail.com';

async function ensureDemoUser() {
  // Find any organization or create a Demo one
  const orgs = await db.select().from(organizations).limit(1);
  let orgId: number;
  if (orgs.length === 0) {
    const [org] = await db.insert(organizations).values({ name: 'DemoOrg' }).returning();
    orgId = org.id;
    console.log(`Created organization DemoOrg (id=${orgId})`);
  } else {
    orgId = orgs[0].id;
  }

  // Check user
  const existing = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing.length > 0) {
    console.log(`Demo user already exists (id=${existing[0].id})`);
    return existing[0];
  }

  const password = await hashPassword('Password123!');
  const [user] = await db.insert(users).values({
    email: DEMO_EMAIL,
    password,
    firstName: 'Test',
    lastName: 'User',
    position: 'Associate',
    bio: 'Seeded demo user for dashboard visualization',
    organizationId: orgId,
    organizationName: 'DemoOrg',
    isAdmin: false,
    emailVerified: true,
  }).returning();
  console.log(`Created demo user (id=${user.id})`);
  return user;
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function seedModulesAndProgress(userId: number, organizationId: number) {
  // Remove previous sample records for this user to keep idempotent
  await db.delete(trainingProgress).where(eq(trainingProgress.userId, userId));

  const categories = [
    { title: 'Phishing Basics', category: 'phishing', difficulty: 'beginner', duration: 15 },
    { title: 'Password Hygiene', category: 'passwords', difficulty: 'beginner', duration: 12 },
    { title: 'Social Engineering Red Flags', category: 'social_engineering', difficulty: 'intermediate', duration: 20 },
    { title: 'Data Protection Essentials', category: 'data_protection', difficulty: 'beginner', duration: 18 },
    { title: 'Advanced Phishing Techniques', category: 'phishing', difficulty: 'advanced', duration: 25 },
  ];

  // Fetch existing modules to avoid duplicates (match by title)
  const existingModules = await db.select().from(trainingModules).where(eq(trainingModules.organizationId, organizationId));
  const existingTitles = new Set(existingModules.map(m => m.title));

  const toInsert = categories.filter(c => !existingTitles.has(c.title)).map(c => ({
    organizationId,
    title: c.title,
    description: `${c.title} description`,
    category: c.category,
    difficulty: c.difficulty,
    durationMinutes: c.duration,
    videoUrl: null,
    thumbnailUrl: null,
    transcript: null,
    tags: [],
    isRequired: false,
    passingScore: 80,
    orderIndex: 0,
    createdBy: userId,
  }));

  let insertedModules = [] as typeof trainingModules.$inferSelect[];
  if (toInsert.length > 0) {
    insertedModules = await db.insert(trainingModules).values(toInsert).returning();
    console.log(`Inserted ${insertedModules.length} training modules`);
  }
  const allModules = [...existingModules, ...insertedModules];

  // Progress states sample
  const progressSamples = allModules.slice(0, 5).map((m, i) => {
    const status = i < 2 ? 'completed' : i === 2 ? 'in_progress' : 'not_started';
    return {
      userId,
      moduleId: m.id,
      status,
      progressPercentage: status === 'completed' ? 100 : status === 'in_progress' ? 40 : 0,
      videoTimestamp: status === 'in_progress' ? 120 : 0,
      completedAt: status === 'completed' ? daysAgo(10 - i) : null,
      assignedAt: daysAgo(20),
      dueDate: daysAgo(-7), // due in 7 days
      updatedAt: status === 'completed' ? daysAgo(10 - i) : new Date(),
    };
  });

  await db.insert(trainingProgress).values(progressSamples);
  console.log(`Inserted ${progressSamples.length} training progress rows`);
  return allModules;
}

async function seedQuizzesAndAttempts(userId: number, organizationId: number, modules: typeof trainingModules.$inferSelect[]) {
  await db.delete(quizAttempts).where(eq(quizAttempts.userId, userId));
  // Simple quizzes tied to first three modules
  const quizModules = modules.slice(0, 3);
  const existingQuizzes = await db.select().from(quizzes).where(eq(quizzes.organizationId, organizationId));

  const existingByModule = new Set(existingQuizzes.filter(q => q.moduleId != null).map(q => q.moduleId));
  const newQuizzesData = quizModules.filter(m => !existingByModule.has(m.id)).map(m => ({
    organizationId,
    moduleId: m.id,
    title: `${m.title} Quiz`,
    description: `Assessment for ${m.title}`,
    passingScore: 80,
    timeLimit: 10,
    allowRetakes: true,
    maxAttempts: 5,
    randomizeQuestions: false,
    showCorrectAnswers: true,
    createdBy: userId,
  }));
  let insertedQuizzes: typeof quizzes.$inferSelect[] = [];
  if (newQuizzesData.length > 0) {
    insertedQuizzes = await db.insert(quizzes).values(newQuizzesData).returning();
    console.log(`Inserted ${insertedQuizzes.length} quizzes`);
  }
  const allQuizzes = [...existingQuizzes, ...insertedQuizzes];
  const targetQuizzes = allQuizzes.filter(q => quizModules.some(m => m.id === q.moduleId));

  // Create attempts over last 25 days
  const attempts: typeof quizAttempts.$inferInsert[] = [];
  targetQuizzes.forEach((q, idx) => {
    for (let a = 0; a < 6; a++) {
      const dayOffset = 25 - (idx * 7 + a * 3); // spread out
      const completedAt = daysAgo(dayOffset);
      const score = 50 + ((idx * 10) + a * 5); // varying scores
      attempts.push({
        userId,
        quizId: q.id,
        attemptNumber: a + 1,
        score: Math.min(score, 95),
        totalQuestions: 10,
        correctAnswers: Math.round(Math.min(score, 95) / 10),
        answers: {},
        passed: score >= 80,
        startedAt: completedAt,
        completedAt,
        timeSpent: 60 + a * 15,
      });
    }
  });
  await db.insert(quizAttempts).values(attempts);
  console.log(`Inserted ${attempts.length} quiz attempts`);
}

async function seedBadges(userId: number) {
  // Get some existing badges and assign a couple
  const existingBadges = await db.select().from(badges).limit(5);
  if (existingBadges.length === 0) {
    console.log('No badges found to assign');
    return;
  }
  await db.delete(userBadges).where(eq(userBadges.userId, userId));
  const assignments = existingBadges.slice(0, 3).map((b, i) => ({
    userId,
    badgeId: b.id,
    earnedAt: daysAgo(5 + i),
  }));
  await db.insert(userBadges).values(assignments);
  console.log(`Assigned ${assignments.length} badges to user`);
}

async function seedUserPoints(userId: number) {
  await db.delete(userPoints).where(eq(userPoints.userId, userId));
  await db.insert(userPoints).values({
    userId,
    totalPoints: 1250,
    currentStreak: 4,
    longestStreak: 12,
    lastActivityDate: daysAgo(0),
  });
  console.log('Seeded userPoints record');
}

async function run() {
  try {
    const user = await ensureDemoUser();
    const modules = await seedModulesAndProgress(user.id, user.organizationId);
    await seedQuizzesAndAttempts(user.id, user.organizationId, modules);
    await seedBadges(user.id);
    await seedUserPoints(user.id);
    console.log('✅ Dashboard sample data seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('Seed script failed:', err);
    process.exit(1);
  }
}

run();
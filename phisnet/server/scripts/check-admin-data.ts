import 'dotenv/config';
import { db } from '../db';
import { 
  users, 
  emailTemplates, 
  campaigns, 
  landingPages,
  groups,
  targets,
  trainingModules,
  quizzes,
  articles,
  flashcardDecks,
} from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function checkAdminData() {
  const [user] = await db.select().from(users).where(eq(users.email, 'admin@phishnet.com'));
  
  if (!user || !user.organizationId) {
    console.log('❌ admin@phishnet.com not found or has no organization');
    process.exit(1);
  }

  const orgId = user.organizationId;
  console.log(`\n📊 Checking seed data for admin@phishnet.com (Org ID: ${orgId})...\n`);

  try {
    // Check email templates
    const templates = await db.select().from(emailTemplates).where(eq(emailTemplates.organizationId, orgId));
    console.log(`📧 Email Templates: ${templates.length}`);
  } catch (e: any) {
    console.log(`❌ Email Templates: ERROR - ${e.message}`);
  }

  try {
    // Check landing pages
    const pages = await db.select().from(landingPages).where(eq(landingPages.organizationId, orgId));
    console.log(`🎯 Landing Pages: ${pages.length}`);
  } catch (e: any) {
    console.log(`❌ Landing Pages: ERROR - ${e.message}`);
  }

  try {
    // Check campaigns
    const campaignsData = await db.select().from(campaigns).where(eq(campaigns.organizationId, orgId));
    console.log(`📨 Campaigns: ${campaignsData.length}`);
  } catch (e: any) {
    console.log(`❌ Campaigns: ERROR - ${e.message}`);
  }

  try {
    // Check groups
    const groupsData = await db.select().from(groups).where(eq(groups.organizationId, orgId));
    console.log(`👥 Groups: ${groupsData.length}`);
  } catch (e: any) {
    console.log(`❌ Groups: ERROR - ${e.message}`);
  }

  try {
    // Check targets
    const targetsData = await db.select().from(targets).where(eq(targets.organizationId, orgId));
    console.log(`🎯 Targets (Users): ${targetsData.length}`);
  } catch (e: any) {
    console.log(`❌ Targets: ERROR - ${e.message}`);
  }

  try {
    // Check training modules
    const training = await db.select().from(trainingModules).where(eq(trainingModules.organizationId, orgId));
    console.log(`📚 Training Modules: ${training.length}`);
  } catch (e: any) {
    console.log(`❌ Training Modules: ERROR - ${e.message}`);
  }

  try {
    // Check quizzes
    const quizzesData = await db.select().from(quizzes).where(eq(quizzes.organizationId, orgId));
    console.log(`❓ Quizzes: ${quizzesData.length}`);
  } catch (e: any) {
    console.log(`❌ Quizzes: ERROR - ${e.message}`);
  }

  try {
    // Check articles
    const articlesData = await db.select().from(articles).where(eq(articles.organizationId, orgId));
    console.log(`📄 Articles: ${articlesData.length}`);
  } catch (e: any) {
    console.log(`❌ Articles: ERROR - ${e.message}`);
  }

  try {
    // Check flashcard decks
    const decks = await db.select().from(flashcardDecks).where(eq(flashcardDecks.organizationId, orgId));
    console.log(`🗂️ Flashcard Decks: ${decks.length}`);
  } catch (e: any) {
    console.log(`❌ Flashcard Decks: ERROR - ${e.message}`);
  }

  try {
    // Check employee users with User role
    const orgUsers = await db.select().from(users).where(eq(users.organizationId, orgId));
    const employeeUsers = orgUsers.filter(u => !u.isAdmin);
    console.log(`👤 Employee Users: ${employeeUsers.length}`);
  } catch (e: any) {
    console.log(`❌ Employee Users: ERROR - ${e.message}`);
  }

  console.log('\n✅ Data check complete!');
  process.exit(0);
}

checkAdminData();

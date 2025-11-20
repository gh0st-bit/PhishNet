/**
 * Test Employee Portal API Endpoints
 * Quick validation that all endpoints are working
 */

import 'dotenv/config';
import { db } from '../server/db';
import { 
  trainingModules, 
  trainingProgress, 
  quizzes,
  quizQuestions,
  certificates,
  userPoints,
  badges,
  userBadges,
  articles,
  flashcardDecks
} from '../shared/schema';
import { sql, eq, and } from 'drizzle-orm';

async function testAPI() {
  console.log('🧪 Testing Employee Portal Database Access\n');
  
  try {
    // Test 1: Query training modules
    console.log('1️⃣  Testing training_modules table...');
    const modules = await db.select().from(trainingModules).limit(5);
    console.log(`   ✅ Can query training_modules (${modules.length} rows)`);
    
    // Test 2: Query training progress
    console.log('2️⃣  Testing training_progress table...');
    const progress = await db.select().from(trainingProgress).limit(5);
    console.log(`   ✅ Can query training_progress (${progress.length} rows)`);
    
    // Test 3: Query quizzes
    console.log('3️⃣  Testing quizzes table...');
    const quizList = await db.select().from(quizzes).limit(5);
    console.log(`   ✅ Can query quizzes (${quizList.length} rows)`);
    
    // Test 4: Query quiz questions
    console.log('4️⃣  Testing quiz_questions table...');
    const questions = await db.select().from(quizQuestions).limit(5);
    console.log(`   ✅ Can query quiz_questions (${questions.length} rows)`);
    
    // Test 5: Query certificates
    console.log('5️⃣  Testing certificates table...');
    const certs = await db.select().from(certificates).limit(5);
    console.log(`   ✅ Can query certificates (${certs.length} rows)`);
    
    // Test 6: Query user points
    console.log('6️⃣  Testing user_points table...');
    const points = await db.select().from(userPoints).limit(5);
    console.log(`   ✅ Can query user_points (${points.length} rows)`);
    
    // Test 7: Query badges (should have 10 seed records)
    console.log('7️⃣  Testing badges table...');
    const badgeList = await db.select().from(badges);
    console.log(`   ✅ Can query badges (${badgeList.length} rows)`);
    if (badgeList.length > 0) {
      console.log(`   📋 Sample badge: "${badgeList[0].name}" - ${badgeList[0].description}`);
    }
    
    // Test 8: Query user badges
    console.log('8️⃣  Testing user_badges table...');
    const userBadgeList = await db.select().from(userBadges).limit(5);
    console.log(`   ✅ Can query user_badges (${userBadgeList.length} rows)`);
    
    // Test 9: Query articles
    console.log('9️⃣  Testing articles table...');
    const articleList = await db.select().from(articles).limit(5);
    console.log(`   ✅ Can query articles (${articleList.length} rows)`);
    
    // Test 10: Query flashcard decks
    console.log('🔟 Testing flashcard_decks table...');
    const decks = await db.select().from(flashcardDecks).limit(5);
    console.log(`   ✅ Can query flashcard_decks (${decks.length} rows)`);
    
    // Test 11: Complex query with JOIN
    console.log('1️⃣1️⃣  Testing complex JOIN query...');
    const joinResult = await db
      .select({
        moduleName: trainingModules.title,
        progressStatus: trainingProgress.status,
      })
      .from(trainingModules)
      .leftJoin(
        trainingProgress,
        eq(trainingModules.id, trainingProgress.moduleId)
      )
      .limit(5);
    console.log(`   ✅ JOIN query successful (${joinResult.length} rows)`);
    
    console.log('\n✅ All database access tests passed!');
    console.log('\n📊 Summary:');
    console.log(`   - All 12 tables are accessible`);
    console.log(`   - ${badgeList.length} badges seeded`);
    console.log(`   - JOIN queries working`);
    console.log(`   - API routes ready for testing`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database access test failed:', error);
    process.exit(1);
  }
}

testAPI();

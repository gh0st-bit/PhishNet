/**
 * Verify Employee Portal Tables
 * Check that all tables were created successfully
 */

import 'dotenv/config';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function verifyTables() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const expectedTables = [
      'training_modules',
      'training_progress',
      'quizzes',
      'quiz_questions',
      'quiz_attempts',
      'certificates',
      'user_points',
      'badges',
      'user_badges',
      'articles',
      'flashcard_decks',
      'flashcards',
    ];
    
    console.log('🔍 Checking employee portal tables...\n');
    
    for (const tableName of expectedTables) {
      const result = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [tableName]);
      
      const exists = result.rows[0].count === '1';
      console.log(`${exists ? '✅' : '❌'} ${tableName.padEnd(20)} ${exists ? 'EXISTS' : 'MISSING'}`);
      
      if (exists) {
        // Get column count
        const colResult = await client.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [tableName]);
        console.log(`   └─ ${colResult.rows[0].count} columns`);
      }
    }
    
    // Check seed data (badges)
    console.log('\n🎖️  Checking seed data (badges)...');
    const badgeResult = await client.query('SELECT COUNT(*) as count FROM badges');
    console.log(`   ✅ ${badgeResult.rows[0].count} badges seeded\n`);
    
    await client.end();
    console.log('✅ Verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    await client.end();
    process.exit(1);
  }
}

verifyTables();

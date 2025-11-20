/**
 * Employee Portal Migration Script
 * Applies the employee portal tables to the database
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

// Get database connection from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');
    
    console.log('📦 Running employee portal migration...');
    
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'migrations', '04_add_employee_portal_tables.sql');
    const migrationSQL = await readFile(migrationPath, 'utf-8');
    
      // Split SQL into individual statements
      // pg library requires one statement per query
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => {
          // Remove empty statements and comment-only lines
          if (!s) return false;
          const withoutComments = s.split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .trim();
          return withoutComments.length > 0;
        });
    
      console.log(`Found ${statements.length} SQL statements to execute\n`);
    
      // Execute each statement
      let successCount = 0;
      let skipCount = 0;
    
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        const preview = statement.substring(0, 60).replace(/\n/g, ' ');
      
        try {
          await client.query(statement);
          successCount++;
          console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
        } catch (error: any) {
          // If the error is about objects already existing, that's okay
          if (error.message?.includes('already exists')) {
            skipCount++;
            console.log(`⚠️  [${i + 1}/${statements.length}] Already exists, skipping...`);
          } else {
            console.error(`❌ [${i + 1}/${statements.length}] Failed: ${preview}...`);
            console.error(`   Error: ${error.message}`);
            throw error;
          }
      }
    }
    
      console.log(`\n📊 Summary: ${successCount} executed, ${skipCount} skipped`);
    console.log('✅ Employee portal migration completed successfully!');
    console.log('\nNew tables created:');
    console.log('  - training_modules');
    console.log('  - training_progress');
    console.log('  - quizzes');
    console.log('  - quiz_questions');
    console.log('  - quiz_attempts');
    console.log('  - certificates');
    console.log('  - user_points');
    console.log('  - badges');
    console.log('  - user_badges');
    console.log('  - articles');
    console.log('  - flashcard_decks');
    console.log('  - flashcards');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

runMigration();

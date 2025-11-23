/**
 * Fix script to ensure all organizations have encryption keys
 * Run this with: npx tsx fix-encryption-keys.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { organizations } from './shared/schema';
import { randomBytes } from 'crypto';
import { eq, isNull } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const db = drizzle(pool);

function generateOrgKey() {
  const key = randomBytes(32);
  return key.toString('base64');
}

async function fixEncryptionKeys() {
  try {
    console.log('🔍 Checking for organizations without encryption keys...');
    
    // Find orgs without encryption keys
    const orgsWithoutKeys = await db
      .select()
      .from(organizations)
      .where(isNull(organizations.encryptionKey));
    
    if (orgsWithoutKeys.length === 0) {
      console.log('✅ All organizations already have encryption keys');
      return;
    }
    
    console.log(`📝 Found ${orgsWithoutKeys.length} organization(s) without encryption keys`);
    
    for (const org of orgsWithoutKeys) {
      const newKey = generateOrgKey();
      
      await db
        .update(organizations)
        .set({ 
          encryptionKey: newKey,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));
      
      console.log(`✅ Generated encryption key for organization: ${org.name} (ID: ${org.id})`);
    }
    
    console.log('🎉 All organizations now have encryption keys!');
  } catch (error) {
    console.error('❌ Error fixing encryption keys:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixEncryptionKeys();

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { threatIntelligence } from './shared/schema.js';
import { count, eq, and, desc } from 'drizzle-orm';

async function debugThreats() {
  // Connect to database
  const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/phishnet', { max: 1 });
  const db = drizzle(sql);

  try {
    console.log('=== THREAT ANALYSIS DEBUG ===\n');

    // 1. Check total threats by type and status
    console.log('1. Total threats by type and isActive status:');
    const threatStats = await db
      .select({
        threatType: threatIntelligence.threatType,
        isActive: threatIntelligence.isActive,
        count: count()
      })
      .from(threatIntelligence)
      .groupBy(threatIntelligence.threatType, threatIntelligence.isActive);
    
    threatStats.forEach(stat => {
      console.log(`   ${stat.threatType || 'NULL'} - isActive: ${stat.isActive} - Count: ${stat.count}`);
    });

    // 2. Check recent phishing threats (what our query returns)
    console.log('\n2. Recent phishing threats (first 5):');
    const recentPhishing = await db
      .select({
        id: threatIntelligence.id,
        domain: threatIntelligence.domain,
        threatType: threatIntelligence.threatType,
        isActive: threatIntelligence.isActive,
        source: threatIntelligence.source,
        firstSeen: threatIntelligence.firstSeen
      })
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.isActive, true),
          eq(threatIntelligence.threatType, 'phishing')
        )
      )
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(5);
    
    recentPhishing.forEach(threat => {
      console.log(`   ID: ${threat.id}, Domain: ${threat.domain}, Type: ${threat.threatType}, Active: ${threat.isActive}, Source: ${threat.source}, FirstSeen: ${threat.firstSeen}`);
    });

    // 3. Check recent malware threats (what our query returns)
    console.log('\n3. Recent malware threats (first 5):');
    const recentMalware = await db
      .select({
        id: threatIntelligence.id,
        domain: threatIntelligence.domain,
        threatType: threatIntelligence.threatType,
        isActive: threatIntelligence.isActive,
        source: threatIntelligence.source,
        firstSeen: threatIntelligence.firstSeen
      })
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.isActive, true),
          eq(threatIntelligence.threatType, 'malware')
        )
      )
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(5);
    
    if (recentMalware.length === 0) {
      console.log('   NO MALWARE THREATS FOUND WITH isActive=true AND threatType=malware');
    } else {
      recentMalware.forEach(threat => {
        console.log(`   ID: ${threat.id}, Domain: ${threat.domain}, Type: ${threat.threatType}, Active: ${threat.isActive}, Source: ${threat.source}, FirstSeen: ${threat.firstSeen}`);
      });
    }

    // 4. Check all malware threats regardless of isActive
    console.log('\n4. All malware threats (regardless of isActive):');
    const allMalware = await db
      .select({
        id: threatIntelligence.id,
        domain: threatIntelligence.domain,
        threatType: threatIntelligence.threatType,
        isActive: threatIntelligence.isActive,
        source: threatIntelligence.source,
        firstSeen: threatIntelligence.firstSeen
      })
      .from(threatIntelligence)
      .where(eq(threatIntelligence.threatType, 'malware'))
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(5);
    
    if (allMalware.length === 0) {
      console.log('   NO MALWARE THREATS FOUND AT ALL');
    } else {
      allMalware.forEach(threat => {
        console.log(`   ID: ${threat.id}, Domain: ${threat.domain}, Type: ${threat.threatType}, Active: ${threat.isActive}, Source: ${threat.source}, FirstSeen: ${threat.firstSeen}`);
      });
    }

    // 5. Check source = alienvault-otx threats
    console.log('\n5. All AlienVault OTX threats (first 5):');
    const otxThreats = await db
      .select({
        id: threatIntelligence.id,
        domain: threatIntelligence.domain,
        threatType: threatIntelligence.threatType,
        isActive: threatIntelligence.isActive,
        source: threatIntelligence.source,
        firstSeen: threatIntelligence.firstSeen
      })
      .from(threatIntelligence)
      .where(eq(threatIntelligence.source, 'alienvault-otx'))
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(5);
    
    if (otxThreats.length === 0) {
      console.log('   NO OTX THREATS FOUND');
    } else {
      otxThreats.forEach(threat => {
        console.log(`   ID: ${threat.id}, Domain: ${threat.domain}, Type: ${threat.threatType}, Active: ${threat.isActive}, Source: ${threat.source}, FirstSeen: ${threat.firstSeen}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

debugThreats();
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { threatIntelligence } from './dist/shared/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL || 
  'postgresql://postgres:mysecretpassword@localhost:5432/phishnet';
const queryClient = postgres(connectionString);
const db = drizzle(queryClient);

async function debugOTXThreats() {
  try {
    console.log('=== DEBUGGING OTX THREATS IN DETAIL ===\n');

    // 1. Count all OTX threats
    console.log('1. OTX Threats Count:');
    const otxCount = await db
      .select({ count: sql`count(*)` })
      .from(threatIntelligence)
      .where(eq(threatIntelligence.source, 'alienvault-otx'));
    
    console.log(`   Total OTX threats: ${otxCount[0]?.count || 0}`);

    // 2. Show first 10 OTX threats with all relevant fields
    console.log('\n2. First 10 OTX threats with full details:');
    const otxThreats = await db
      .select({
        id: threatIntelligence.id,
        url: threatIntelligence.url,
        domain: threatIntelligence.domain,
        indicator: threatIntelligence.indicator,
        indicatorType: threatIntelligence.indicatorType,
        threatType: threatIntelligence.threatType,
        malwareFamily: threatIntelligence.malwareFamily,
        source: threatIntelligence.source,
        confidence: threatIntelligence.confidence,
        isActive: threatIntelligence.isActive,
        firstSeen: threatIntelligence.firstSeen,
        tags: threatIntelligence.tags,
        description: threatIntelligence.description
      })
      .from(threatIntelligence)
      .where(eq(threatIntelligence.source, 'alienvault-otx'))
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(10);

    if (otxThreats.length === 0) {
      console.log('   NO OTX THREATS FOUND in database!');
    } else {
      otxThreats.forEach((threat, index) => {
        console.log(`   ${index + 1}. ID: ${threat.id}`);
        console.log(`      URL: ${threat.url || 'null'}`);
        console.log(`      Domain: ${threat.domain || 'null'}`);
        console.log(`      Indicator: ${threat.indicator || 'null'}`);
        console.log(`      IndicatorType: ${threat.indicatorType || 'null'}`);
        console.log(`      ThreatType: ${threat.threatType || 'null'}`);
        console.log(`      MalwareFamily: ${threat.malwareFamily || 'null'}`);
        console.log(`      IsActive: ${threat.isActive}`);
        console.log(`      Confidence: ${threat.confidence}`);
        console.log(`      FirstSeen: ${threat.firstSeen}`);
        console.log(`      Tags: ${JSON.stringify(threat.tags)}`);
        console.log(`      Description: ${threat.description?.substring(0, 100) || 'null'}...`);
        console.log('');
      });
    }

    // 3. Check active OTX threats specifically
    console.log('3. Active OTX threats count:');
    const activeOtxCount = await db
      .select({ count: sql`count(*)` })
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.source, 'alienvault-otx'),
          eq(threatIntelligence.isActive, true)
        )
      );
    
    console.log(`   Active OTX threats: ${activeOtxCount[0]?.count || 0}`);

    // 4. Check OTX threats by threat type
    console.log('\n4. OTX threats by threat type:');
    const otxByType = await db
      .select({
        threatType: threatIntelligence.threatType,
        count: sql`count(*)`
      })
      .from(threatIntelligence)
      .where(eq(threatIntelligence.source, 'alienvault-otx'))
      .groupBy(threatIntelligence.threatType);

    if (otxByType.length === 0) {
      console.log('   No OTX threats found to group by type');
    } else {
      otxByType.forEach(row => {
        console.log(`   ${row.threatType || 'null'}: ${row.count}`);
      });
    }

    // 5. Test the exact query used by getRecentThreats for malware
    console.log('\n5. Testing Recent Threats query for malware from OTX:');
    const limit = 20;
    const threatsPerType = Math.ceil(limit / 2);
    
    const malwareThreats = await db
      .select({
        id: threatIntelligence.id,
        url: threatIntelligence.url,
        domain: threatIntelligence.domain,
        indicator: threatIntelligence.indicator,
        indicatorType: threatIntelligence.indicatorType,
        threatType: threatIntelligence.threatType,
        malwareFamily: threatIntelligence.malwareFamily,
        source: threatIntelligence.source,
        confidence: threatIntelligence.confidence,
        isActive: threatIntelligence.isActive,
        firstSeen: threatIntelligence.firstSeen,
        tags: threatIntelligence.tags,
        description: threatIntelligence.description
      })
      .from(threatIntelligence)
      .where(
        and(
          eq(threatIntelligence.isActive, true),
          eq(threatIntelligence.threatType, 'malware')
        )
      )
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(threatsPerType);

    console.log(`   Query returned ${malwareThreats.length} malware threats`);
    if (malwareThreats.length > 0) {
      console.log('   First few malware threats:');
      malwareThreats.slice(0, 3).forEach((threat, index) => {
        console.log(`     ${index + 1}. Source: ${threat.source}, Domain: ${threat.domain}, Type: ${threat.threatType}, Active: ${threat.isActive}`);
      });
    }

  } catch (error) {
    console.error('Error debugging OTX threats:', error);
  } finally {
    await queryClient.end();
  }
}

debugOTXThreats();
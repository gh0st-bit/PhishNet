import { db } from './server/db.ts';
import { threatIntelligence } from './shared/schema.js';
import { sql, eq, desc } from 'drizzle-orm';

async function checkThreats() {
  try {
    // Get threat type counts
    const threatCounts = await db
      .select({
        threat_type: threatIntelligence.threatType,
        count: sql`count(*)`
      })
      .from(threatIntelligence)
      .groupBy(threatIntelligence.threatType);
    
    console.log('Threat Type Counts:');
    console.table(threatCounts);

    // Get some sample malware threats
    const malwareThreats = await db
      .select()
      .from(threatIntelligence)
      .where(eq(threatIntelligence.threatType, 'malware'))
      .limit(5);
    
    console.log('\nSample Malware Threats:');
    console.table(malwareThreats);

    // Get recent threats for comparison
    const recentThreats = await db
      .select()
      .from(threatIntelligence)
      .orderBy(desc(threatIntelligence.firstSeen))
      .limit(10);
    
    console.log('\nRecent Threats:');
    console.table(recentThreats.map(t => ({
      id: t.id,
      threat_type: t.threatType,
      source: t.source,
      indicator: t.indicator?.substring(0, 50) + '...'
    })));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkThreats();
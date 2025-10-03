import 'dotenv/config';
import { ThreatIntelligenceService } from '../server/services/threat-intelligence/threat-intelligence.service';

async function run() {
  console.log('=== MANUAL THREAT INGESTION TRIGGER ===');
  const service = new ThreatIntelligenceService();

  try {
    console.log('🔄 Starting manual threat intelligence ingestion...');
    await service.ingestAllFeeds();
    console.log('✅ Ingestion completed successfully!');

    const analysis = await service.getThreatAnalysis();
    console.log('\n📊 Updated Threat Analysis:');
    console.log(`  - Total Threats: ${analysis.totalThreats}`);
    console.log(`  - New Threats Today: ${analysis.newThreatsToday}`);
    console.log(`  - Active Sources: ${analysis.activeSources}`);

    if (analysis.topThreatTypes && analysis.topThreatTypes.length > 0) {
      console.log('\n🎯 Top Threat Types:');
      analysis.topThreatTypes.forEach((type) => {
        console.log(`  - ${type.type}: ${type.count}`);
      });
    }

    const recent = await service.getRecentThreats(10);
    console.log(`\n🔍 Sample Recent Threats (${recent.length} total):`);
    recent.slice(0, 5).forEach((threat, i) => {
      console.log(`  ${i + 1}. ${threat.domain || threat.url} (${threat.source})`);
      console.log(`     Type: ${threat.threatType}, Confidence: ${threat.confidence}%`);
    });
  } catch (err: any) {
    console.error('❌ Error during ingestion:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

run().then(() => process.exit(0));

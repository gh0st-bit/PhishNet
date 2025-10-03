import { ThreatIntelligenceService } from './server/services/threat-intelligence/threat-intelligence.service.js';

console.log('=== MANUAL THREAT INGESTION TRIGGER ===\n');

const service = new ThreatIntelligenceService();

try {
  console.log('🔄 Starting manual threat intelligence ingestion...');
  
  // Force a fresh ingestion
  await service.ingestThreats();
  
  console.log('✅ Ingestion completed successfully!');
  
  // Get updated statistics
  const analysis = await service.getThreatAnalysis();
  console.log('\n📊 Updated Threat Analysis:');
  console.log(`  - Total Threats: ${analysis.totalThreats}`);
  console.log(`  - New Threats Today: ${analysis.newThreatsToday}`);
  console.log(`  - Active Sources: ${analysis.activeSources}`);
  
  if (analysis.topThreatTypes && analysis.topThreatTypes.length > 0) {
    console.log('\n🎯 Top Threat Types:');
    analysis.topThreatTypes.forEach(type => {
      console.log(`  - ${type.type}: ${type.count}`);
    });
  }
  
  // Get recent threats to verify
  const recent = await service.getRecentThreats(10);
  console.log(`\n🔍 Sample Recent Threats (${recent.length} total):`);
  recent.slice(0, 5).forEach((threat, i) => {
    console.log(`  ${i + 1}. ${threat.domain || threat.url} (${threat.source})`);
    console.log(`     Type: ${threat.threatType}, Confidence: ${threat.confidence}%`);
  });
  
} catch (error) {
  console.error('❌ Error during ingestion:', error.message);
  console.error(error.stack);
}

process.exit(0);
import { ThreatIntelligenceService } from './server/services/threat-intelligence/threat-intelligence.service.js';
import { PhishingDatabaseProvider } from './server/services/threat-intelligence/phishing-database-provider.js';

console.log('=== TESTING PHISHING.DATABASE INGESTION ===\n');

// Test the PhishingDatabaseProvider directly first
console.log('1. Testing PhishingDatabaseProvider directly...');
const provider = new PhishingDatabaseProvider();

try {
  const threats = await provider.fetchThreats();
  console.log(`✅ PhishingDatabaseProvider fetched ${threats.length} threats`);
  
  if (threats.length > 0) {
    console.log('\nSample threats:');
    threats.slice(0, 5).forEach((threat, i) => {
      console.log(`  ${i + 1}. ${threat.indicatorType}: ${threat.indicator || threat.url || threat.domain}`);
      console.log(`     Type: ${threat.threatType}, Confidence: ${threat.confidence}%`);
      console.log(`     Description: ${threat.description}`);
      console.log('');
    });
  }
} catch (error) {
  console.error('❌ Error testing PhishingDatabaseProvider:', error.message);
}

// Test full ingestion service
console.log('\n2. Testing full ThreatIntelligenceService...');
const service = new ThreatIntelligenceService();

try {
  // Force ingestion
  console.log('Starting threat ingestion...');
  await service.ingestThreats();
  
  // Get recent threats to verify ingestion
  console.log('Getting recent threats...');
  const recentThreats = await service.getRecentThreats(50);
  
  console.log(`✅ Found ${recentThreats.length} recent threats after ingestion`);
  
  // Count by source
  const sourceCount = {};
  recentThreats.forEach(threat => {
    sourceCount[threat.source] = (sourceCount[threat.source] || 0) + 1;
  });
  
  console.log('\nThreats by source:');
  Object.entries(sourceCount).forEach(([source, count]) => {
    console.log(`  - ${source}: ${count}`);
  });
  
  // Show sample phishing-database threats
  const phishingDbThreats = recentThreats.filter(t => t.source === 'phishing-database');
  if (phishingDbThreats.length > 0) {
    console.log(`\nSample Phishing.Database threats (${phishingDbThreats.length} total):`);
    phishingDbThreats.slice(0, 3).forEach((threat, i) => {
      console.log(`  ${i + 1}. ${threat.domain || threat.url}`);
      console.log(`     Confidence: ${threat.confidence}%, Tags: ${JSON.stringify(threat.tags)}`);
      console.log(`     Description: ${threat.description}`);
      console.log('');
    });
  } else {
    console.log('\n⚠️  No phishing-database threats found in recent threats');
  }
  
} catch (error) {
  console.error('❌ Error testing ThreatIntelligenceService:', error.message);
  console.error(error.stack);
}

process.exit(0);
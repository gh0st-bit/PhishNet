import { ThreatIntelligenceService } from './dist/server/services/threat-intelligence/threat-intelligence.service.js';

console.log('=== FORCING THREAT INGESTION TEST ===');

const service = new ThreatIntelligenceService();

// Force ingestion from all providers
console.log('Starting threat ingestion...');
await service.ingestThreats();

console.log('Threat ingestion completed. Checking recent threats...');

// Get recent threats to see what we have
const recentThreats = await service.getRecentThreats(20);
console.log(`Found ${recentThreats.length} recent threats:`);

const phishingCount = recentThreats.filter(t => t.threatType === 'phishing').length;
const malwareCount = recentThreats.filter(t => t.threatType === 'malware').length;
const otherCount = recentThreats.filter(t => t.threatType !== 'phishing' && t.threatType !== 'malware').length;

console.log(`  - Phishing: ${phishingCount}`);
console.log(`  - Malware: ${malwareCount}`);
console.log(`  - Other: ${otherCount}`);

if (malwareCount > 0) {
  console.log('\nFirst few malware threats:');
  recentThreats.filter(t => t.threatType === 'malware').slice(0, 3).forEach((threat, i) => {
    console.log(`  ${i + 1}. Source: ${threat.source}, Domain: ${threat.domain}, Family: ${threat.malwareFamily}`);
  });
} else {
  console.log('\n❌ NO MALWARE THREATS FOUND IN RECENT THREATS!');
}

process.exit(0);
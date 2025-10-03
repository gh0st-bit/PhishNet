import { PhishingDatabaseProvider } from './server/services/threat-intelligence/phishing-database-provider.js';

async function testAllFilesIngestion() {
  console.log('=== Testing Enhanced PhishingDatabaseProvider with ALL files ===\n');
  
  const provider = new PhishingDatabaseProvider();
  
  try {
    const threats = await provider.fetchThreats();
    
    console.log(`\n=== INGESTION RESULTS ===`);
    console.log(`Total threats ingested: ${threats.length}`);
    
    // Analyze by status
    const statusCounts = {};
    const typeCounts = {};
    const confidenceLevels = {};
    
    threats.forEach(threat => {
      const status = threat.tags.find(tag => 
        ['new', 'active', 'inactive', 'invalid'].includes(tag)
      ) || 'unknown';
      
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      typeCounts[threat.indicatorType] = (typeCounts[threat.indicatorType] || 0) + 1;
      confidenceLevels[threat.confidence] = (confidenceLevels[threat.confidence] || 0) + 1;
    });
    
    console.log(`\nBreakdown by Status:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} threats`);
    });
    
    console.log(`\nBreakdown by Type:`);
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} threats`);
    });
    
    console.log(`\nBreakdown by Confidence:`);
    Object.entries(confidenceLevels).forEach(([confidence, count]) => {
      console.log(`  ${confidence}%: ${count} threats`);
    });
    
    // Show sample threats from each status
    console.log(`\n=== SAMPLE THREATS ===`);
    ['new', 'active', 'inactive', 'invalid'].forEach(status => {
      const sampleThreats = threats.filter(t => t.tags.includes(status)).slice(0, 3);
      if (sampleThreats.length > 0) {
        console.log(`\n${status.toUpperCase()} threats:`);
        sampleThreats.forEach((threat, i) => {
          console.log(`  ${i + 1}. ${threat.indicator} (${threat.indicatorType}) - ${threat.confidence}% confidence`);
          console.log(`     ${threat.description}`);
        });
      }
    });
    
  } catch (error) {
    console.error('Error testing ingestion:', error);
  }
}

testAllFilesIngestion();
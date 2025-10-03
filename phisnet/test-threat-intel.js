// Test script to trigger manual threat intelligence ingestion
const testThreatIntelligence = async () => {
  try {
    console.log('🧪 Testing Threat Intelligence Manual Trigger...');
    
    const response = await fetch('http://localhost:5000/api/threat-intelligence/ingest-now', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will require authentication in real use
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success:', result);
    } else {
      console.log('❌ Error:', response.status, response.statusText);
      const error = await response.text();
      console.log('Error details:', error);
    }
  } catch (error) {
    console.error('🚫 Request failed:', error);
  }
};

testThreatIntelligence();
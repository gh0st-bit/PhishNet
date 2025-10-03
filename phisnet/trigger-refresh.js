// Force trigger threat intelligence ingestion via API call
fetch('http://localhost:5000/api/threat-intelligence/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}).then(response => response.json())
  .then(data => {
    console.log('Ingestion triggered:', data);
  })
  .catch(error => {
    console.error('Error triggering ingestion:', error);
  });
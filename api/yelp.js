export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { location, term } = req.query;
  
  if (!location) {
    return res.status(400).json({ error: 'Location required' });
  }

  const YELP_API_KEY = process.env.YELP_API_KEY;
  
  if (!YELP_API_KEY) {
    return res.status(500).json({ error: 'Yelp API key not configured' });
  }

  try {
    const yelpUrl = `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(location)}&term=${encodeURIComponent(term || 'restaurants')}&limit=10&sort_by=best_match`;
    
    const response = await fetch(yelpUrl, {
      headers: {
        'Authorization': `Bearer ${YELP_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yelp API Error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `Yelp API error: ${response.statusText}` 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from Yelp',
      details: error.message 
    });
  }
}

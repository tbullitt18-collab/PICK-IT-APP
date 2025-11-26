const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/yelp/search', async (req, res) => {
  try {
    const { location, term } = req.query;
    const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
      params: { location, term, limit: 10 },
      headers: { Authorization: `Bearer ${process.env.YELP_API_KEY}` }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3001);

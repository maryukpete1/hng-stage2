// 1. Import libraries
const express = require('express');
require('dotenv').config(); // This loads our .env file
const axios = require('axios'); // <-- NEW: For making HTTP requests
const fs = require('fs'); // <-- NEW: For writing files
const path = require('path'); // <-- NEW: For managing file paths
const { createCanvas } = require('canvas');
// Import our database connection
const sequelize = require('./config/database');
const Country = require('./models/country')

// 2. Create the Express app
const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

// 3. Get the port from .env or default to 3000
const PORT = process.env.PORT || 3000;
function getRandomMultiplier() {
  return Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
}
// ... (getRandomMultiplier function is above this)


async function generateSummaryImage() {
  console.log('Generating summary image...');
  const canvasWidth = 600;
  const canvasHeight = 400;
  
  // 1. Create a canvas
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  try {
    // 2. === GET DATA FROM OUR DATABASE ===
    
    // Get total count
    const totalCountries = await Country.count();
    
    // Get Top 5 by GDP
    const topCountries = await Country.findAll({
      order: [['estimated_gdp', 'DESC']],
      limit: 5,
      attributes: ['name', 'estimated_gdp'] // Only get the data we need
    });

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });

    // 3. === DRAW THE IMAGE ===
    
    // Draw background
    ctx.fillStyle = '#1D2B53'; // Dark blue
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw Title
    ctx.fillStyle = '#FFFFFF'; // White
    ctx.font = 'bold 30px Sans-Serif';
    ctx.textAlign = 'center';
    ctx.fillText('Country GDP Summary', canvasWidth / 2, 50);

    // Draw Stats
    ctx.font = '20px Sans-Serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Total Countries: ${totalCountries}`, 30, 100);
    ctx.fillText(`Last Refresh (UTC): ${timestamp}`, 30, 130);

    // Draw Top 5
    ctx.font = 'bold 22px Sans-Serif';
    ctx.fillText('Top 5 Countries by Estimated GDP:', 30, 190);
    
    ctx.font = '18px Sans-Serif';
    let yPos = 230;
    topCountries.forEach((country, index) => {
      const gdp = country.estimated_gdp ? country.estimated_gdp.toFixed(0) : 'N/A';
      ctx.fillText(`${index + 1}. ${country.name} - $${gdp}`, 50, yPos);
      yPos += 30; // Move down for the next line
    });

    // 4. === SAVE THE IMAGE TO FILE ===
    const buffer = canvas.toBuffer('image/png');
    const imagePath = path.join(__dirname, 'cache', 'summary.png');
    
    // Ensure the 'cache' directory exists
    fs.mkdirSync(path.join(__dirname, 'cache'), { recursive: true });
    
    // Write the file
    fs.writeFileSync(imagePath, buffer);
    console.log(`✅ Summary image saved to ${imagePath}`);

  } catch (error) {
    console.error('❌ Failed to generate summary image:', error);
  }
}

// 4. A simple root route
// ... (rest of your file)
// 4. A simple root route
app.get('/', (req, res) => {
  res.send('Welcome to the Country Exchange API! 🌍');
});
// ... (app.get('/') route is above this)

// === API ENDPOINT 1: POST /countries/refresh ===
app.post('/countries/refresh', async (req, res) => {
  let countriesResponse;
  let ratesResponse;
  const countriesAPI = 'https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies';
  const ratesAPI = 'https://open.er-api.com/v6/latest/USD';

  // 1. === FETCH DATA FROM EXTERNAL APIS ===
  try {
    console.log('Fetching country data...');
    countriesResponse = await axios.get(countriesAPI);
  } catch (error) {
    console.error('Error fetching from restcountries:', error.message);
    return res.status(503).json({
      error: 'External data source unavailable',
      details: 'Could not fetch data from restcountries.com'
    });
  }

  try {
    console.log('Fetching exchange rates...');
    ratesResponse = await axios.get(ratesAPI);
  } catch (error) {
    console.error('Error fetching from open.er-api:', error.message);
    return res.status(503).json({
      error: 'External data source unavailable',
      details: 'Could not fetch data from open.er-api.com'
    });
  }

  // 2. === PROCESS AND SAVE DATA ===
  try {
    const countries = countriesResponse.data;
    const rates = ratesResponse.data.rates; // e.g., { "USD": 1, "NGN": 1600.23, ... }
    
    console.log(`Processing ${countries.length} countries...`);

    // We create an array of "promises"
    // Each promise is one database "upsert" operation
    const upsertPromises = countries.map(async (country) => {
      let currency_code = null;
      let exchange_rate = null;
      let estimated_gdp = null;

      // --- Handle Currency ---
      if (country.currencies && country.currencies.length > 0) {
        currency_code = country.currencies[0].code; // Get first currency code
      }

      // --- Handle Exchange Rate ---
      if (currency_code && rates[currency_code]) {
        exchange_rate = rates[currency_code];
      }

      // --- Handle GDP Calculation ---
      // Only calculate if we have all the data
      if (country.population && exchange_rate) {
        estimated_gdp = (country.population * getRandomMultiplier()) / exchange_rate;
      } else if (country.population && currency_code === null) {
        // Special case from instructions
        estimated_gdp = 0;
      }

      // --- Define the data to be saved ---
      const countryData = {
        name: country.name,
        capital: country.capital || null,
        region: country.region || null,
        population: country.population,
        flag_url: country.flag || null,
        currency_code: currency_code,
        exchange_rate: exchange_rate,
        estimated_gdp: estimated_gdp
        // 'last_refreshed_at' is updated automatically by Sequelize!
      };

      // --- Return the upsert promise ---
      // This will UPDATE if 'name' exists, or INSERT if it's new
      return Country.upsert(countryData);
    });

    // 3. === WAIT FOR ALL SAVES TO FINISH ===
    await Promise.all(upsertPromises);
    
    console.log('✅ Database refresh complete.');
try {
      await generateSummaryImage();
    } catch (imageError) {
      // Log the error, but don't fail the whole request
      // The DB refresh was still a success
      console.error('Image generation failed, but refresh was successful:', imageError);
    }
    // 4. === SEND SUCCESS RESPONSE ===
    // (We will add image generation here in the next module)
    return res.status(200).json({ 
      message: 'Countries refreshed successfully', 
      countries_processed: countries.length 
    });

  } catch (error) {
    console.error('Error processing or saving data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ... (POST /countries/refresh endpoint ends here)

// === API ENDPOINT 2: GET /countries/image ===
app.get('/countries/image', (req, res) => {
  try {
    const imagePath = path.join(__dirname, 'cache', 'summary.png');

    // Check if the file exists
    if (fs.existsSync(imagePath)) {
      // If it exists, send the file
      res.sendFile(imagePath);
    } else {
      // If not, send the 404 error
      return res.status(404).json({ error: "Summary image not found" });
    }
  } catch (error) {
    console.error('Error serving image:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ... (GET /countries/image endpoint ends here)

// === API ENDPOINT 3: GET /status ===
app.get('/status', async (req, res) => {
  try {
    // 1. Get the total count of countries
    const totalCountries = await Country.count();

    // 2. Find the most recently updated record
    const lastRefresh = await Country.findOne({
      order: [
        ['last_refreshed_at', 'DESC'] // Order by the refresh date, descending
      ],
      attributes: ['last_refreshed_at'] // We only need this one field
    });

    // 3. Build the response
    const responseBody = {
      total_countries: totalCountries,
      // Check if lastRefresh is null (in case DB is empty)
      last_refreshed_at: lastRefresh ? lastRefresh.last_refreshed_at : null
    };

    return res.status(200).json(responseBody);

  } catch (error) {
    console.error('Error fetching status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ... (GET /status endpoint ends here)

// === API ENDPOINT 4: GET /countries (with Filtering/Sorting) ===
app.get('/countries', async (req, res) => {
  try {
    // 1. Get query parameters
    const { region, currency, sort } = req.query;

    // 2. Build the query options dynamically
    const queryOptions = {
      where: {}, // This will hold our filters
      order: []  // This will hold our sorting rules
    };

    // 3. Add filters if they exist
    if (region) {
      queryOptions.where.region = region;
    }

    if (currency) {
      queryOptions.where.currency_code = currency;
    }

    // 4. Add sorting if it exists
    if (sort) {
      if (sort === 'gdp_desc') {
        // Add sorting by estimated_gdp in descending order
        queryOptions.order.push(['estimated_gdp', 'DESC']);
      }
      // You could add more sort options here else if (sort === 'gdp_asc') ...
    }

    // 5. Execute the query
    const countries = await Country.findAll(queryOptions);

    // 6. Send the response
    return res.status(200).json(countries);

  } catch (error) {
    console.error('Error fetching countries:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ... (GET /countries endpoint ends here)

// === API ENDPOINT 5: GET /countries/:name ===
app.get('/countries/:name', async (req, res) => {
  try {
    // 1. Get the name from the URL parameters
    const { name } = req.params;

    // 2. Find the country by its name
    // We use 'findOne' which is perfect for finding one specific item
    const country = await Country.findOne({
      where: {
        name: name // Find where the 'name' column matches the 'name' from the URL
      }
    });

    // 3. Check if the country was found
    if (country) {
      // 4. === SUCCESS ===
      // If 'country' is not null, send it back
      return res.status(200).json(country);
    } else {
      // 4. === NOT FOUND ===
      // If 'country' is null, it wasn't found
      return res.status(404).json({ error: "Country not found" });
    }

  } catch (error) {
    console.error('Error fetching country by name:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ... (GET /countries/:name endpoint ends here)

// === API ENDPOINT 6: DELETE /countries/:name ===
app.delete('/countries/:name', async (req, res) => {
  try {
    // 1. Get the name from the URL parameters
    const { name } = req.params;

    // 2. Find the country by its name first
    const country = await Country.findOne({
      where: {
        name: name
      }
    });

    // 3. Check if the country was found
    if (country) {
      // 4. === SUCCESS (It exists) ===
      
      // Delete the country
      await country.destroy(); 
      
      // Send the '204 No Content' response
      return res.status(204).send();
    } else {
      // 4. === NOT FOUND ===
      // If 'country' is null, it wasn't found
      return res.status(404).json({ error: "Country not found" });
    }

  } catch (error) {
    console.error('Error deleting country by name:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Start the server
async function startServer() {
  try {
    // Test the database connection
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');

    // Sync all models (this creates the tables if they don't exist)
    // We will add models later, but it's good to have this
    await sequelize.sync(); 
    console.log('✅ All models were synchronized successfully.');

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
}

startServer();
# Country Currency & Exchange API

A RESTful API built with Node.js, Express and Sequelize that fetches country and currency exchange data from public APIs, processes and caches it in a MySQL database. Provides CRUD operations for cached country data and serves a generated summary image.

Live API Base URL: [YOUR_DEPLOYED_API_URL_HERE]

## Features
- Data aggregation from restcountries.com and open.er-api.com
- Persistent caching in MySQL via Sequelize
- Computed fields (estimated_gdp based on population and exchange rates)
- Filtering and sorting on GET /countries
- Dynamic summary image generation (Node Canvas)
- Robust error handling

## Tech Stack
- Node.js, Express
- MySQL
- Sequelize (ORM)
- Axios (HTTP client)
- Node Canvas (image generation)
- dotenv (env vars)

## Prerequisites
- Node.js v16+
- MySQL database (local or cloud)

## Quick Start

1. Clone
```bash
git clone [YOUR_GITHUB_REPO_LINK]
cd hng-stage2
```

2. Install
```bash
npm install
```

3. Create environment file

Cross-platform: create a `.env` file in the project root.  
Windows PowerShell:
```powershell
New-Item -Path . -Name ".env" -ItemType "file" -Force
notepad .env
```

Example `.env` contents:
```env
DATABASE_URL="mysql://root:PASSWORD@host:3306/database"
PORT=3000
```

4. Run
```bash
node index.js
# or with nodemon (dev)
npx nodemon index.js
```

Server listens on http://localhost:<PORT> and syncs models on start.

## API Endpoints

- POST /countries/refresh  
  Refresh cached data from external APIs and regenerate summary image.  
  Success: 200
  ```json
  { "message": "Countries refreshed successfully", "countries_processed": 250 }
  ```

- GET /countries  
  Retrieve all countries. Supports query params:
  - region (e.g. ?region=Africa)
  - currency (e.g. ?currency=NGN)
  - sort (e.g. ?sort=gdp_desc)

  Success: 200 — array of country objects

- GET /countries/:name  
  Retrieve a single country by name (e.g. /countries/Nigeria)  
  Success: 200 — country object  
  Error: 404 if not found

- DELETE /countries/:name  
  Delete a country by name.  
  Success: 204 No Content  
  Error: 404 if not found

- GET /status  
  Returns total countries and last refresh timestamp.  
  Success: 200
  ```json
  { "total_countries": 250, "last_refreshed_at": "2025-10-26T15:20:10.000Z" }
  ```

- GET /countries/image  
  Returns the latest generated summary image (image/png).  
  Error: 404 if no image exists

## Notes
- Replace the placeholder DATABASE_URL with your MySQL connection string.
- Use a process manager or container for production deployments.
- See the source files for model, controller and route specifics.

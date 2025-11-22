# Bohemian Heat Map: Portland

A mobile-friendly web application that visualizes concentrations of vegan restaurants across Portland, Oregon neighborhoods using OpenStreetMap data.

## Features

- 🗺️ Interactive map showing vegan restaurant density by neighborhood
- 📍 Individual restaurant markers with details
- 🏘️ Neighborhood boundary overlays with heat map visualization
- 📊 Neighborhood rankings by restaurant density
- 📱 Mobile-first responsive design
- ♿ Accessibility features included

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Mapping**: Leaflet.js with OpenStreetMap tiles
- **Data Source**: OpenStreetMap Overpass API
- **Clustering**: Leaflet MarkerCluster for performance

## Getting Started

### First-Time Setup: Fetch Business Data

Before running the app, you need to fetch business data once:

```bash
node fetch-data.js
```

This creates `businesses-data.json` with all business data. The app loads from this file for fast performance.

**Note:** You'll need Node.js installed to run the fetch script. The app itself doesn't require Node.js.

### Running the App

#### Option 1: Direct File Access

Simply open `index.html` in a modern web browser. No build process required!

#### Option 2: Local Server (Recommended)

For best results, serve the files through a local web server:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Updating Data Periodically

To refresh the business data (recommended monthly):

```bash
node fetch-data.js
```

This updates `businesses-data.json` with fresh data from OpenStreetMap. See `DATA_UPDATE.md` for more details.

## Project Structure

```
cursor-bohemian-heat-map/
├── index.html      # Main HTML file
├── styles.css      # All styling
├── app.js          # Application logic
├── PRD.md          # Product Requirements Document
└── README.md       # This file
```

## How It Works

1. The app loads business data from `businesses-data.json` (pre-fetched from OpenStreetMap)
2. It generates a half-mile grid covering Portland
3. It calculates proximity scores for each grid cell based on distance to nearest businesses (any category)
4. Grid cells are colored on a heat gradient (blue/green = far, red = close)
5. Businesses are displayed as clustered markers with category-specific icons
6. Users can filter which categories to display on the map
7. The heat map and scores always reflect ALL categories (filters only affect marker visibility)

## Future Enhancements

- Additional business categories (gaming stores, art galleries, music venues, etc.)
- Category filters
- Composite "Bohemian Score" calculation
- Export/share functionality
- Offline caching

## License

This project uses open data from OpenStreetMap contributors and is available for educational and personal use.

## Credits

- OpenStreetMap contributors for map data
- Leaflet.js for mapping functionality
- Overpass API for data queries


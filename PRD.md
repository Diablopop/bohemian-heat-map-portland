# Product Requirements Document (PRD)

**Project:** Bohemian Heat Map: Portland (Frontend-Only Edition)

**Version:** Draft v1.1

**Author:** Andrew

**Date:** November 2025

---

## 1. Overview

Bohemian Heat Map: Portland is a mobile-friendly web application that visualizes concentrations of lifestyle-aligned businesses—beginning with vegan restaurants—across Portland, Oregon. The application uses only client-side technologies and free/open data sources (e.g., OpenStreetMap via Overpass API). Future releases will include additional categories such as gaming stores, vintage shops, art galleries, music venues, craft supply stores, and other locations associated with a "bohemian lifestyle."

This PRD includes forward-compatible requirements so the future expansion of categories does not require substantial redesign.

---

## 2. Goals & Non-Goals

### 2.1 Primary Goal (MVP)

- Allow users to easily explore which Portland neighborhoods have high concentrations of vegan restaurants.
- Use only free and open data sources (OpenStreetMap + Portland Open Data).
- Build a static web app with no server or backend.
- Provide a map visualization showing vegan restaurant density by neighborhood.
- Allow users to view individual vegan restaurant locations.
- Support a vegan-only toggle.

### 2.2 Secondary / Future Goals

- Add additional categories relevant to bohemian culture.
- Allow users to toggle which categories to visualize.
- Provide optional composite "bohemian scores" that represent a meta-score of all the categories combines
- Add additional categories that are detractors to the bohemian density score, including box stores and chain restaurants (especially fast-food)

### Non-Goals

- No dynamic server-side data fetching.
- No database or user accounts.
- No user-driven data updates.
- No API calls other than fetching static JSON files.
- No scheduled data refresh tasks.
- User authentication
- User-generated content
- Reviews or rating systems
- Backend storage
- Proprietary or paid map sources
- Routing/directions

---

## 3. Target Users

- People seeking communities with alternative, artistic, countercultural, or eco-minded lifestyles.
- Individuals visiting or moving to Portland and researching neighborhoods.
- Locals seeking new places aligned with their interests.
- Urban researchers and hobbyist data analysts.
- Entrepreneurs scouting for food-business opportunities
- Urban researchers or food-access advocates

---

## 4. Key Features

### 4.1 MVP Features (Vegan Restaurants Only)

#### 4.1.1 Map Visualization

- Interactive client-side map using Leaflet or MapLibre.
- Pulls vegan restaurant data from OSM's Overpass API.
- Displays restaurants as map pins.
- Generates a visual heat map representing density clusters.

#### 4.1.2 Neighborhood Boundary Overlay

- Overlay Portland neighborhood polygons (from OSM or Portland Maps open-data).
- Optional shading or border emphasis.

#### 4.1.3 Density Calculation (Client-Side)

For each neighborhood:

- Count number of vegan restaurants.
- Calculate concentration relative to neighborhood area.
- Normalize for visual clarity.
- Display results via:
  - Heat gradient, OR
  - Choropleth shading.

#### 4.1.4 Mobile-Friendly UI

- Simple, intuitive mobile-first layout.
- Map dominates top of screen.
- Bottom drawer for neighborhood list and density ranking.

#### 4.1.5 Information Drawer

Displays:

- Neighborhood name
- Density score
- Number of restaurants
- List of restaurants pulled from map pins

---

## 5. Future Features (Planned for Expansion)

### 5.1 Multi-Category Support

The system must be architected so adding new categories requires:

- Adding new Overpass queries (no backend).
- Adding new icon/pin types.
- Updating category filter UI.

Candidate future categories:

- Gaming stores
- Vintage / thrift shops
- Art galleries
- Music venues
- Theaters
- Maker spaces
- Indie bookstores
- Natural food markets
- Coffee shops with counterculture appeal

### 5.2 Category Filters (Upcoming)

UI should anticipate:

- A toggle panel for selecting categories.
- Ability to display one or many categories at once.
- Default MVP state: only vegan category is enabled.

### 5.3 Composite "Bohemian Score" (Later Release)

- Weighted scoring of multiple categories.
- User-adjustable weights via sliders.
- Dynamic recalculation done entirely in the browser.

### 5.4 "Bohemian Score" detractors

We may eventually penalize a neighborhood for having box stores or chain restaurants, especially fast food restaurants.

### 5.5 Save / Export

- Export heat map as PNG.
- Shareable link (client-side URL parameters).

---

## 6. Technical Requirements

### 6.1 No Backend

All functionality must be client-side:

- Data queries (Overpass API)
- Caching in browser storage (optional)
- Heat map rendering
- Neighborhood scoring

### 6.2 Data Sources

- OpenStreetMap via Overpass API (live data)
- Optional: Portland neighborhood boundaries from
  - OSM, or
  - Portland Open Data (GeoJSON)

### 6.3 Client-Side Technologies

- JavaScript, HTML, CSS
- Leaflet or MapLibre GL
- Web Workers for async data processing (recommended)
- IndexedDB or LocalStorage for caching (optional)

### 6.4 Performance Considerations

- All queries should be optimized to minimize Overpass load.
- Use bounding box queries limited to Portland region.
- Use clustering libraries for best mobile performance.

---

## 7. User Interface Requirements

### 7.1 Layout

- Mobile-first design
- Full-screen map with floating filter button.
- Bottom drawer with:
  - Neighborhood rankings
  - Expandable lists
- Pins color-coded by category (future-proofing).

### 7.2 Interaction

- Tap pin → restaurant/business detail popup.
- Tap neighborhood → show density and list of matches.
- Filter categories (future)—UI placeholder included in MVP design.

### 7.3 Accessibility

- High-contrast mode toggle.
- Icons labeled with ARIA tags.
- Large-tap hot zones for map UI.

---

## 8. Future-Proofing Decisions

To ensure no rewrite is needed when adding categories:

- Data model must store multiple business types in a single client-side structure.
- UI design includes a placeholder Filters menu (even if unused in MVP).
- Heatmap engine accepts multiple layers but activates only one at launch.
- Neighborhood scoring logic must be modular for adding weights later.

These changes are already incorporated into this PRD.

---

## 9. Release Plan

### 9.1 MVP Release

- Vegan restaurant layer
- Neighborhood heat map
- Simple UI with category filter placeholder
- No composite scoring

### 9.2 Release 1.1

- Add additional business categories
- Category toggles
- Multi-layer density visualization

### 9.3 Release 2.0

- Bohemian Index composite scoring
- Export/share map images
- Save lightweight settings in URL

---

## 10. Possible Future Enhancements

- Offline-friendly data caching
- Add additional cities (each with preprocessed data)
- Add neighborhood comparison charts (client-rendered)
- Establish a back-end and routinely update neighborhood data from APIs
- Add a "Find nearest bohemian area" button using device geolocation


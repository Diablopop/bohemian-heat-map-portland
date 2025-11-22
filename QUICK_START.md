# Quick Start Guide

## For Non-Engineers

This guide will help you get started with the Bohemian Heat Map application.

## Option 1: Simple Testing (Easiest)

1. **Open the file directly:**
   - Navigate to the project folder in Finder (macOS)
   - Double-click on `index.html`
   - It will open in your default web browser

   ⚠️ **Note:** Some browsers may block the API requests when opening files directly. If the map doesn't load, use Option 2 instead.

## Option 2: Using a Local Web Server (Recommended)

This is the recommended way to test the application because it properly handles API requests.

### Using Python (usually pre-installed on Mac)

1. **Open Terminal:**
   - Press `Cmd + Space` to open Spotlight
   - Type "Terminal" and press Enter

2. **Navigate to the project folder:**
   ```bash
   cd ~/Desktop/Projects/Coding/cursor-bohemian-heat-map
   ```

3. **Start a web server:**
   ```bash
   python3 -m http.server 8000
   ```

4. **Open in your browser:**
   - Open your web browser
   - Go to: `http://localhost:8000`
   - You should see the map!

5. **To stop the server:**
   - Go back to Terminal
   - Press `Ctrl + C`

### Alternative: Using Node.js (if you have it installed)

1. **Open Terminal** (same as above)

2. **Navigate to project folder:**
   ```bash
   cd ~/Desktop/Projects/Coding/cursor-bohemian-heat-map
   ```

3. **Start a web server:**
   ```bash
   npx http-server
   ```

4. **Follow the URL shown in Terminal** (usually `http://localhost:8080`)

## What You Should See

- A map of Portland, Oregon
- Neighborhood boundaries colored by vegan restaurant density
- Restaurant markers (clustered when zoomed out)
- A bottom drawer with neighborhood rankings
- A filter button (placeholder for future features)

## Troubleshooting

**Problem:** Map is blank or shows errors
- **Solution:** Make sure you're using Option 2 (local web server) instead of opening the file directly

**Problem:** No restaurants showing
- **Solution:** The Overpass API might be slow or rate-limited. Wait a moment or refresh the page

**Problem:** "CORS error" in browser console
- **Solution:** This shouldn't happen, but if it does, make sure you're using the local web server method

## Next Steps: Deploying to Netlify or Vercel

Once you're happy with the application, you can deploy it online. I can help you with that when you're ready!


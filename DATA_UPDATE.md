# Updating Business Data

The app now uses cached data from `businesses-data.json` for fast loading. To update this data periodically:

## Quick Update

Run the data fetch script:

```bash
node fetch-data.js
```

This will:
- Fetch fresh data from Overpass API for all 12 categories
- Filter out chain restaurants
- Save to `businesses-data.json`
- Display progress and summary

## Requirements

- Node.js (any recent version)
- Internet connection (to access Overpass API)

## How It Works

1. The script fetches data sequentially (one category at a time) to avoid rate limiting
2. Each category is processed and filtered
3. All data is combined and saved to `businesses-data.json`
4. The app automatically loads from this file on page load

## Update Frequency

Recommended update schedule:
- **Monthly** - For general accuracy
- **Weekly** - If you want more up-to-date data
- **As needed** - When you know businesses have changed

## After Updating

1. Run `node fetch-data.js`
2. Commit the updated `businesses-data.json` to your repository
3. Deploy to your hosting service (Netlify/Vercel/etc.)
4. Users will see the new data on next page load

## Fallback Behavior

If `businesses-data.json` doesn't exist or can't be loaded:
- The app will automatically fetch from Overpass API
- This is slower but ensures the app always works
- Good for development or testing

## File Location

The cached data file is:
- **Filename**: `businesses-data.json`
- **Location**: Same directory as `index.html`
- **Format**: JSON with metadata and businesses array
- **Size**: ~500KB - 2MB depending on data

## Troubleshooting

**Script fails with timeout errors:**
- Overpass API may be slow. Try again later
- Reduce timeout values if needed

**Data seems incomplete:**
- Check console for error messages
- Some categories may have fewer results if OSM data is sparse

**File not updating:**
- Make sure you have write permissions in the directory
- Check that `businesses-data.json` isn't read-only


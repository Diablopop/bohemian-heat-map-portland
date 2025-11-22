# Portland Neighborhood Boundaries Data Source

## Current Implementation

The application attempts to load Portland neighborhood boundaries from multiple sources in this order:

1. **OpenStreetMap Overpass API** (Area search within Portland)
2. **OpenStreetMap Overpass API** (Bounding box search)
3. **OpenStreetMap Overpass API** (Alternative geometry query)
4. **Portland Open Data** (if available)
5. **Local GeoJSON file** (`neighborhoods.geojson` if present)
6. **Grid fallback** (last resort)

## If Neighborhoods Aren't Loading

If you're seeing the grid system instead of actual neighborhoods, it means the OSM queries aren't finding Portland neighborhoods. This can happen if:

- Portland neighborhoods aren't tagged in OpenStreetMap
- The OSM tagging conventions are different than expected
- API rate limiting or timeouts

## Solution: Use a GeoJSON File

You can download Portland neighborhood boundaries as GeoJSON and save them locally:

### Option 1: Download from Portland Open Data Portal

1. Visit Portland's Open Data portal: https://www.portlandoregon.gov/civic/
2. Search for "neighborhood boundaries" or "neighborhoods"
3. Download the GeoJSON file
4. Save it as `neighborhoods.geojson` in the project folder
5. The app will automatically load it if APIs fail

### Option 2: Export from Overpass Turbo

1. Visit https://overpass-turbo.eu/
2. Enter this query:
   ```
   [out:json][timeout:60];
   area[name="Portland"][place="city"]->.portland;
   (
     relation["boundary"="administrative"]["admin_level"="10"](area.portland);
     relation["place"="neighbourhood"](area.portland);
     relation["place"="suburb"](area.portland);
   );
   out geom;
   (._;>;);
   out geom;
   ```
3. Run the query
4. Click "Export" → "GeoJSON"
5. Save as `neighborhoods.geojson` in the project folder

### Option 3: Use Known GeoJSON Endpoint

If Portland provides a public GeoJSON endpoint, you can update the `loadNeighborhoodsFromPortlandData()` function in `app.js` with the correct URL.

## GeoJSON File Format

The `neighborhoods.geojson` file should follow this format:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": 1,
      "properties": {
        "NAME": "Alberta Arts District"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-122.65, 45.55], ...]]
      }
    }
  ]
}
```

The app will try to read the neighborhood name from these property fields (in order):
- `NAME`
- `name`
- `NEIGHBORHOOD`
- `neighborhood`
- `LABEL`
- `label`

## Testing

Once you have a `neighborhoods.geojson` file:

1. Place it in the project folder (same directory as `index.html`)
2. Refresh the application
3. If the APIs fail to load neighborhoods, the app will automatically try the local file
4. You should see actual neighborhood boundaries instead of the grid

## Troubleshooting

**Still seeing grid?**
- Check browser console for errors
- Verify `neighborhoods.geojson` is in the correct location
- Verify the GeoJSON file is valid (use a JSON validator)
- Check that the GeoJSON has a `FeatureCollection` with `features` array

**Neighborhoods loading but names are wrong?**
- Update the property name in the GeoJSON to match one of the expected names
- Or modify `loadNeighborhoodsFromGeoJSON()` in `app.js` to read your specific property name


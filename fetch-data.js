#!/usr/bin/env node
/**
 * Data Fetch Script for Bohemian Heat Map
 * 
 * This script fetches business data from Overpass API once and saves it to a JSON file.
 * Run this periodically (e.g., monthly) to update the data.
 * 
 * Usage: node fetch-data.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Portland bounding box
const PORTLAND_BBOX = {
    south: 45.43,
    west: -122.84,
    north: 45.65,
    east: -122.47
};

// Chain restaurants and inappropriate businesses to exclude
const EXCLUDED_CHAINS = [
    // Fast food chains
    'subway', 'starbucks', 'mcdonald', 'dunkin', 'taco bell', 'domino',
    'burger king', 'pizza hut', 'wendy', 'dairy queen', 'little caesar',
    'kfc', 'sonic', 'chipotle', 'arby', 'papa john', 'popeyes',
    'chick-fil-a', 'chick fil a', 'panera', 'jack in the box',
    // Retail chains
    'autozone', 'bi-mart', 'bi mart', 'target', 'michael\'s', 'michaels', 'ross'
];

// Get category definitions (same as in app.js)
function getCategoryDefinitions() {
    const bbox = `${PORTLAND_BBOX.south},${PORTLAND_BBOX.west},${PORTLAND_BBOX.north},${PORTLAND_BBOX.east}`;
    
    return {
        'vegan-restaurants': {
            name: 'Vegan Restaurants',
            icon: '🌱',
            color: '#4CAF50',
            query: `
                [out:json][timeout:90];
                (
                  node["diet:vegan"~"^(yes|only)$"]["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|bistro|pub)$"]({{bbox}});
                  node["diet:vegan"~"^(yes|only)$"]["shop"="bakery"]({{bbox}});
                  node["cuisine"~"vegan",i]["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|bistro|pub)$"]({{bbox}});
                  way["diet:vegan"~"^(yes|only)$"]["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|bistro|pub)$"]({{bbox}});
                  way["diet:vegan"~"^(yes|only)$"]["shop"="bakery"]({{bbox}});
                  way["cuisine"~"vegan",i]["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|bistro|pub)$"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                const hasVeganDiet = tags['diet:vegan'] === 'yes' || tags['diet:vegan'] === 'only';
                const cuisine = tags.cuisine ? tags.cuisine.toLowerCase() : '';
                return hasVeganDiet || cuisine.includes('vegan');
            }
        },
        'vegan-friendly': {
            name: 'Vegan-Friendly Restaurants',
            icon: '🥗',
            color: '#8BC34A',
            query: `
                [out:json][timeout:90];
                (
                  node["diet:vegetarian"="yes"]["amenity"~"^(restaurant|cafe|fast_food|food_court)$"]({{bbox}});
                  node["diet:vegan:options"="yes"]["amenity"~"^(restaurant|cafe|fast_food|food_court)$"]({{bbox}});
                  way["diet:vegetarian"="yes"]["amenity"~"^(restaurant|cafe|fast_food|food_court)$"]({{bbox}});
                  way["diet:vegan:options"="yes"]["amenity"~"^(restaurant|cafe|fast_food|food_court)$"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                return (tags['diet:vegetarian'] === 'yes' || tags['diet:vegan:options'] === 'yes') &&
                       !tags['diet:vegan'] && !tags.cuisine?.toLowerCase().includes('vegan');
            }
        },
        'art-spaces': {
            name: 'Art Spaces',
            icon: '🎨',
            color: '#E91E63',
            query: `
                [out:json][timeout:90];
                (
                  node["amenity"="arts_centre"]({{bbox}});
                  node["tourism"="gallery"]({{bbox}});
                  node["craft"~"artist|painter|sculptor",i]({{bbox}});
                  node["studio"~"art",i]({{bbox}});
                  way["amenity"="arts_centre"]({{bbox}});
                  way["tourism"="gallery"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                return tags.amenity === 'arts_centre' || 
                       tags.tourism === 'gallery' ||
                       tags.craft?.toLowerCase().includes('artist') ||
                       tags.studio?.toLowerCase().includes('art');
            }
        },
        'creator-spaces': {
            name: 'Creator Spaces',
            icon: '🛠️',
            color: '#FF9800',
            query: `
                [out:json][timeout:90];
                (
                  node["craft"~"art|pottery|wood|metal",i]({{bbox}});
                  node["shop"~"art|craft",i]({{bbox}});
                  node["amenity"~"maker|workshop",i]({{bbox}});
                  way["craft"~"art|pottery|wood|metal",i]({{bbox}});
                  way["shop"~"art|craft",i]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                // Basic category filter
                const isCreatorSpace = tags.shop?.toLowerCase().includes('art') ||
                       tags.shop?.toLowerCase().includes('craft') ||
                       tags.craft ||
                       tags.amenity?.toLowerCase().includes('maker') ||
                       tags.amenity?.toLowerCase().includes('workshop');
                
                if (!isCreatorSpace) return false;
                
                // Exclude automotive-related shops and retail chains
                const name = (tags.name || '').toLowerCase();
                const automotiveKeywords = ['auto parts', 'truck parts', 'automotive', 'car parts'];
                const excludedRetailChains = ['autozone', 'bi-mart', 'bi mart', 'target', 'michael\'s', 'michaels', 'ross'];
                
                // Exclude if matches automotive keywords or retail chains
                if (automotiveKeywords.some(keyword => name.includes(keyword)) ||
                    excludedRetailChains.some(chain => name.includes(chain))) {
                    return false;
                }
                
                return true;
            }
        },
        'music-venues': {
            name: 'Music Venues',
            icon: '🎵',
            color: '#9C27B0',
            query: `
                [out:json][timeout:90];
                (
                  node["amenity"="music_venue"]({{bbox}});
                  node["amenity"~"nightclub|bar"]["music"~"live|yes",i]({{bbox}});
                  node["leisure"~"music",i]({{bbox}});
                  way["amenity"="music_venue"]({{bbox}});
                  way["amenity"~"nightclub|bar"]["music"~"live|yes",i]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                return tags.amenity === 'music_venue' ||
                       (tags.music?.toLowerCase().includes('live') && (tags.amenity === 'bar' || tags.amenity === 'nightclub'));
            }
        },
        'record-stores': {
            name: 'Independent Record Stores',
            icon: '💿',
            color: '#673AB7',
            query: `
                [out:json][timeout:90];
                (
                  node["shop"="music"]({{bbox}});
                  way["shop"="music"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                return tags.shop === 'music';
            }
        },
        'bookstores': {
            name: 'Independent Bookstores',
            icon: '📚',
            color: '#795548',
            query: `
                [out:json][timeout:90];
                (
                  node["shop"="books"]({{bbox}});
                  node["shop"="bookstore"]({{bbox}});
                  way["shop"="books"]({{bbox}});
                  way["shop"="bookstore"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                return tags.shop === 'books' || tags.shop === 'bookstore';
            }
        },
        'gaming-comics': {
            name: 'Gaming and Comics',
            icon: '🎲',
            color: '#3F51B5',
            query: `
                [out:json][timeout:90];
                (
                  node["shop"~"games|comics|video_games",i]({{bbox}});
                  node["leisure"~"games",i]({{bbox}});
                  way["shop"~"games|comics|video_games",i]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                return tags.shop?.toLowerCase().includes('game') ||
                       tags.shop?.toLowerCase().includes('comic') ||
                       tags.leisure?.toLowerCase().includes('game');
            }
        },
        'vintage-shops': {
            name: 'Vintage Shops',
            icon: '👜',
            color: '#FF5722',
            query: `
                [out:json][timeout:90];
                (
                  node["shop"~"second_hand|vintage|antiques",i]({{bbox}});
                  node["shop"="clothes"]["second_hand"="yes"]({{bbox}});
                  node["shop"="furniture"]["second_hand"="yes"]({{bbox}});
                  way["shop"~"second_hand|vintage|antiques",i]({{bbox}});
                  way["shop"="clothes"]["second_hand"="yes"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                return tags.shop?.toLowerCase().includes('second_hand') ||
                       tags.shop?.toLowerCase().includes('vintage') ||
                       tags.shop?.toLowerCase().includes('antique') ||
                       (tags['second_hand'] === 'yes' && (tags.shop === 'clothes' || tags.shop === 'furniture'));
            }
        },
        'indie-coffee': {
            name: 'Indie Coffee Shops',
            icon: '☕',
            color: '#8D6E63',
            query: `
                [out:json][timeout:90];
                (
                  node["amenity"="cafe"]({{bbox}});
                  way["amenity"="cafe"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                const name = (tags.name || '').toLowerCase();
                const chains = ['starbucks', 'dunkin', 'dunkin donuts', 'peets', 'tullys', 'coffee bean'];
                return tags.amenity === 'cafe' && !chains.some(chain => name.includes(chain));
            }
        },
        'food-coops': {
            name: 'Food Co-ops',
            icon: '🥬',
            color: '#689F38',
            query: `
                [out:json][timeout:90];
                (
                  node["shop"="supermarket"]["organic"="yes"]({{bbox}});
                  node["shop"="supermarket"]["cooperative"="yes"]({{bbox}});
                  node["shop"="health_food"]({{bbox}});
                  way["shop"="supermarket"]["organic"="yes"]({{bbox}});
                  way["shop"="health_food"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                return (tags.shop === 'supermarket' && (tags.organic === 'yes' || tags.cooperative === 'yes')) ||
                       tags.shop === 'health_food';
            }
        },
        'theaters': {
            name: 'Community Theaters',
            icon: '🎭',
            color: '#F44336',
            query: `
                [out:json][timeout:90];
                (
                  node["amenity"="theatre"]({{bbox}});
                  node["amenity"="cinema"]({{bbox}});
                  way["amenity"="theatre"]({{bbox}});
                  way["amenity"="cinema"]({{bbox}});
                );
                out center tags;
            `.replace(/\{\{bbox\}\}/g, bbox),
            filterFn: (tags) => {
                const name = (tags.name || '').toLowerCase();
                const chains = ['regal', 'cinemark', 'amc', 'century'];
                return (tags.amenity === 'theatre' || tags.amenity === 'cinema') && 
                       !chains.some(chain => name.includes(chain));
            }
        }
    };
}

// Check if a business should be excluded (is a chain restaurant or inappropriate business)
function isExcludedChain(business) {
    const name = (business.name || '').toLowerCase();
    
    // Check excluded chains list
    if (EXCLUDED_CHAINS.some(chain => name.includes(chain))) {
        return true;
    }
    
    // Exclude automotive-related businesses (especially from Creator Spaces)
    const automotiveKeywords = ['auto parts', 'truck parts', 'automotive', 'car parts'];
    if (automotiveKeywords.some(keyword => name.includes(keyword))) {
        return true;
    }
    
    return false;
}

// Make HTTP POST request
function makeRequest(url, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

// Load businesses for a specific category
async function loadBusinessesByCategory(categoryId, categoryDef) {
    console.log(`Fetching ${categoryId}...`);
    
    try {
        const data = await makeRequest('https://overpass-api.de/api/interpreter', categoryDef.query);
        const businessesMap = new Map();
        
        data.elements.forEach(el => {
            const tags = el.tags || {};
            
            // Apply category-specific filter
            if (!categoryDef.filterFn(tags)) {
                return;
            }
            
            // Get coordinates
            let lat, lon;
            if (el.type === 'node' && el.lat && el.lon) {
                lat = el.lat;
                lon = el.lon;
            } else if (el.type === 'way' && el.center) {
                lat = el.center.lat;
                lon = el.center.lon;
            } else {
                return;
            }
            
            const name = tags.name || tags['name:en'] || 'Unnamed Business';
            
            // Exclude chain restaurants by name
            if (isExcludedChain({ name: name })) {
                return;
            }
            
            const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
            
            // Avoid duplicates
            if (!businessesMap.has(key)) {
                businessesMap.set(key, {
                    id: el.id,
                    name: name,
                    lat: lat,
                    lon: lon,
                    tags: tags,
                    type: 'business'
                });
            }
        });
        
        const businesses = Array.from(businessesMap.values());
        console.log(`  ✓ Loaded ${businesses.length} businesses for ${categoryId}`);
        return businesses;
    } catch (error) {
        console.error(`  ✗ Error loading ${categoryId}:`, error.message);
        return [];
    }
}

// Main function
async function main() {
    console.log('Starting data fetch for Bohemian Heat Map...\n');
    
    const categories = getCategoryDefinitions();
    const allBusinesses = [];
    
    // Fetch businesses for each category sequentially to avoid rate limiting
    for (const [categoryId, categoryDef] of Object.entries(categories)) {
        const businesses = await loadBusinessesByCategory(categoryId, categoryDef);
        businesses.forEach(b => b.category = categoryId);
        allBusinesses.push(...businesses);
        
        // Small delay between requests to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final filter to ensure no excluded chains
    const filteredBusinesses = allBusinesses.filter(b => !isExcludedChain(b));
    const excludedCount = allBusinesses.length - filteredBusinesses.length;
    
    if (excludedCount > 0) {
        console.log(`\nExcluded ${excludedCount} chain restaurants`);
    }
    
    // Create output object with metadata
    const output = {
        metadata: {
            generatedAt: new Date().toISOString(),
            portlandBbox: PORTLAND_BBOX,
            totalBusinesses: filteredBusinesses.length,
            categories: Object.keys(categories).length,
            excludedChains: EXCLUDED_CHAINS.length
        },
        businesses: filteredBusinesses
    };
    
    // Save to JSON file
    const outputPath = path.join(__dirname, 'businesses-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`\n✓ Successfully saved ${filteredBusinesses.length} businesses to businesses-data.json`);
    console.log(`  Generated at: ${output.metadata.generatedAt}`);
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});


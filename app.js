// Bohemian Heat Map: Portland - Main Application
// Version: MVP 1.0

// Portland bounding box
const PORTLAND_BBOX = {
    south: 45.43,
    west: -122.84,
    north: 45.65,
    east: -122.47
};

// Map initialization
let map;
let gridLayer;
let businessMarkers;
let gridCells = [];
let allBusinesses = []; // All businesses across all categories
let activeCategoryFilters = new Set(); // Track which categories are visible
let categoryDefinitions = {}; // Category metadata

// Grid settings - half-mile squares
// Half mile ≈ 0.804 km
// At Portland's latitude (~45.5°): 
// - 1 degree lat ≈ 111 km, so 0.804/111 ≈ 0.00724 degrees
// - 1 degree lon ≈ 78 km, so 0.804/78 ≈ 0.0103 degrees
const GRID_SIZE_MILES = 0.5;
const GRID_SIZE_KM = 0.804;
const GRID_LAT_STEP = 0.00724;
const GRID_LON_STEP = 0.0103;

// Chain restaurants to exclude from bohemian heat map
const EXCLUDED_CHAINS = [
    'subway',
    'starbucks',
    'mcdonald',
    'dunkin',
    'taco bell',
    'domino',
    'burger king',
    'pizza hut',
    'wendy',
    'dairy queen',
    'little caesar',
    'kfc',
    'sonic',
    'chipotle',
    'arby',
    'papa john',
    'popeyes',
    'chick-fil-a',
    'chick fil a',
    'panera',
    'jack in the box'
];

// Check if a business should be excluded (is a chain restaurant)
function isExcludedChain(business) {
    const name = (business.name || '').toLowerCase();
    return EXCLUDED_CHAINS.some(chain => name.includes(chain));
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    initializeMap();
    initializeUI();
    showWelcomeModal();
    await loadData();
    // Initialize filter panel after categories are loaded
    initializeFilterPanel();
    renderMap();
});

// Initialize Leaflet map
function initializeMap() {
    map = L.map('map', {
        center: [45.515, -122.655],
        zoom: 12,
        zoomControl: true,
        attributionControl: true
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Initialize marker cluster group for businesses
    businessMarkers = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50
    });
}

// Define business categories and their OSM queries
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
                return tags.shop?.toLowerCase().includes('art') ||
                       tags.shop?.toLowerCase().includes('craft') ||
                       tags.craft ||
                       tags.amenity?.toLowerCase().includes('maker') ||
                       tags.amenity?.toLowerCase().includes('workshop');
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
                // Filter out chain coffee shops - this is approximate
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
                // Filter out major chain theaters - approximate
                const name = (tags.name || '').toLowerCase();
                const chains = ['regal', 'cinemark', 'amc', 'century'];
                return (tags.amenity === 'theatre' || tags.amenity === 'cinema') && 
                       !chains.some(chain => name.includes(chain));
            }
        }
    };
}

// Initialize UI elements
function initializeUI() {
    const drawer = document.getElementById('drawer');
    const drawerHandle = drawer.querySelector('.drawer-handle');
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    // Drawer drag functionality
    drawerHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startHeight = drawer.offsetHeight;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaY = startY - e.clientY;
        const newHeight = Math.min(Math.max(startHeight + deltaY, 60), window.innerHeight * 0.7);
        drawer.style.maxHeight = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch support for mobile
    drawerHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
        startHeight = drawer.offsetHeight;
        e.preventDefault();
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const deltaY = startY - e.touches[0].clientY;
        const newHeight = Math.min(Math.max(startHeight + deltaY, 60), window.innerHeight * 0.7);
        drawer.style.maxHeight = newHeight + 'px';
        e.preventDefault();
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });

    // Filter button - show/hide filter panel
    document.getElementById('filter-btn').addEventListener('click', () => {
        toggleFilterPanel();
    });
}

// Initialize filter panel UI
function initializeFilterPanel() {
    const filterPanel = document.getElementById('filter-panel');
    if (!filterPanel) return;
    
    // Create filter checkboxes for each category
    const categories = getCategoryDefinitions();
    const filterContent = Object.entries(categories).map(([categoryId, categoryDef]) => {
        return `
            <label class="filter-item">
                <input type="checkbox" class="category-checkbox" value="${categoryId}" checked>
                <span class="filter-icon-large">${categoryDef.icon}</span>
                <span class="filter-name">${categoryDef.name}</span>
            </label>
        `;
    }).join('');
    
    filterPanel.innerHTML = `
        <div class="filter-panel-header">
            <h3>Filter Categories</h3>
            <button class="filter-close-btn" aria-label="Close filters">×</button>
        </div>
        <div class="filter-panel-content">
            <p class="filter-note">Note: The heat map and Neighborhood Score always reflect all categories, regardless of filter selection.</p>
            <div class="select-all-container">
                <label class="filter-item select-all-item">
                    <input type="checkbox" class="select-all-checkbox" checked>
                    <span class="filter-icon-large">✓</span>
                    <span class="filter-name"><strong>Select All</strong></span>
                </label>
            </div>
            <div class="filter-divider"></div>
            ${filterContent}
        </div>
    `;
    
    // Add select all functionality
    const selectAllCheckbox = filterPanel.querySelector('.select-all-checkbox');
    const categoryCheckboxes = filterPanel.querySelectorAll('.category-checkbox');
    
    // Update select all when individual checkboxes change
    function updateSelectAll() {
        const allChecked = Array.from(categoryCheckboxes).every(cb => cb.checked);
        const someChecked = Array.from(categoryCheckboxes).some(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }
    
    // Select all checkbox handler
    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        categoryCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const categoryId = checkbox.value;
            if (isChecked) {
                activeCategoryFilters.add(categoryId);
            } else {
                activeCategoryFilters.delete(categoryId);
            }
        });
        refreshBusinessMarkers();
    });
    
    // Add event listeners for category checkboxes
    categoryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const categoryId = e.target.value;
            if (e.target.checked) {
                activeCategoryFilters.add(categoryId);
            } else {
                activeCategoryFilters.delete(categoryId);
            }
            // Update select all state
            updateSelectAll();
            // Refresh markers
            refreshBusinessMarkers();
        });
    });
    
    // Initialize select all state
    updateSelectAll();
    
    // Close button
    filterPanel.querySelector('.filter-close-btn')?.addEventListener('click', () => {
        toggleFilterPanel();
    });
}

// Toggle filter panel visibility
function toggleFilterPanel() {
    const filterPanel = document.getElementById('filter-panel');
    if (filterPanel) {
        const isActive = filterPanel.classList.toggle('active');
        
        // Add overlay when panel is open
        if (isActive) {
            // Create overlay if it doesn't exist
            let overlay = document.getElementById('filter-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'filter-overlay';
                overlay.className = 'filter-overlay';
                overlay.addEventListener('click', () => {
                    toggleFilterPanel();
                });
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'block';
        } else {
            // Hide overlay when panel is closed
            const overlay = document.getElementById('filter-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    }
}

// Add business markers based on active filters
function addBusinessMarkers() {
    // Clear existing markers
    businessMarkers.clearLayers();
    
    // Add markers for businesses in active categories
    allBusinesses.forEach(business => {
        if (activeCategoryFilters.has(business.category)) {
            const categoryDef = categoryDefinitions[business.category];
            if (!categoryDef) return;
            
            // Create colored marker based on category
            const marker = L.marker([business.lat, business.lon], {
                title: business.name,
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background-color: ${categoryDef.color}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${categoryDef.icon}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            });
            
            marker.bindPopup(createBusinessPopup(business));
            businessMarkers.addLayer(marker);
        }
    });
}

// Refresh business markers when filters change
function refreshBusinessMarkers() {
    addBusinessMarkers();
}

// Create popup content for business
function createBusinessPopup(business) {
    const tags = business.tags;
    const name = tags.name || 'Unnamed Business';
    const categoryDef = categoryDefinitions[business.category];
    const categoryName = categoryDef ? categoryDef.name : 'Unknown';
    const addr = tags['addr:street'] ? 
        `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}` : '';
    
    let html = `<div class="popup-title">${escapeHtml(name)}</div>`;
    html += `<div class="popup-info"><strong>Category:</strong> ${escapeHtml(categoryName)}</div>`;
    
    if (business.category === 'vegan-restaurants') {
        const hasVeganDiet = tags['diet:vegan'] === 'yes' || tags['diet:vegan'] === 'only';
        const veganType = hasVeganDiet ? 
            (tags['diet:vegan'] === 'only' ? 'Vegan Only' : 'Vegan Options') : 
            'Vegan-Friendly';
        html += `<div class="popup-info"><strong>${veganType}</strong></div>`;
    }
    
    if (tags.cuisine) {
        html += `<div class="popup-info">Cuisine: ${escapeHtml(tags.cuisine)}</div>`;
    }
    
    if (addr) {
        html += `<div class="popup-info">${escapeHtml(addr)}</div>`;
    }
    
    if (tags.website) {
        html += `<div class="popup-info"><a href="${tags.website}" target="_blank">Visit Website</a></div>`;
    }
    
    return html;
}

// Show welcome modal on page load
function showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    const closeButton = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    const content = modal.querySelector('.modal-content');
    
    // Show modal
    modal.classList.add('active');
    
    // Close on X button click
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        closeWelcomeModal();
    });
    
    // Close on overlay click (outside modal content)
    overlay.addEventListener('click', () => {
        closeWelcomeModal();
    });
    
    // Prevent clicks inside modal content from closing the modal
    content.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeWelcomeModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Close welcome modal
function closeWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    modal.classList.remove('active');
}

// Load all data from APIs or cached JSON
async function loadData() {
    const loadingOverlay = document.getElementById('loading-overlay');
    
    try {
        loadingOverlay.classList.remove('hidden');
        
        // Initialize category definitions
        categoryDefinitions = getCategoryDefinitions();
        
        // Initialize all categories as active
        Object.keys(categoryDefinitions).forEach(cat => activeCategoryFilters.add(cat));
        
        // Try to load from cached JSON file first
        try {
            const response = await fetch('businesses-data.json');
            if (response.ok) {
                const data = await response.json();
                allBusinesses = data.businesses || [];
                console.log(`Loaded ${allBusinesses.length} businesses from cached data (generated: ${data.metadata?.generatedAt || 'unknown'})`);
                
                // If we have cached data, use it and skip API calls
                if (allBusinesses.length > 0) {
                    gridCells = generateGridCells();
                    return; // Successfully loaded from cache
                }
            }
        } catch (e) {
            console.log('No cached data found, fetching from API...');
        }
        
        // Fallback to API if cached data not available
        console.log('Fetching fresh data from Overpass API...');
        allBusinesses = await loadAllBusinesses();
        
        // Generate grid cells covering Portland
        gridCells = generateGridCells();
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading map data. Please refresh the page.');
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// Load businesses from all categories
async function loadAllBusinesses() {
    const allBusinessesList = [];
    const categories = getCategoryDefinitions();
    
    // Load businesses in parallel for all categories
    const loadPromises = Object.entries(categories).map(async ([categoryId, categoryDef]) => {
        try {
            const businesses = await loadBusinessesByCategory(categoryId, categoryDef);
            // Add category to each business
            return businesses.map(b => ({ ...b, category: categoryId }));
        } catch (error) {
            console.error(`Error loading ${categoryId}:`, error);
            return [];
        }
    });
    
    const results = await Promise.all(loadPromises);
    const allBusinesses = results.flat();
    
    // Final filter to ensure no excluded chains made it through
    const filteredBusinesses = allBusinesses.filter(b => !isExcludedChain(b));
    
    const excludedCount = allBusinesses.length - filteredBusinesses.length;
    if (excludedCount > 0) {
        console.log(`Excluded ${excludedCount} chain restaurants from bohemian heat map`);
    }
    console.log(`Loaded ${filteredBusinesses.length} businesses across all categories`);
    
    return filteredBusinesses;
}

// Load businesses for a specific category
async function loadBusinessesByCategory(categoryId, categoryDef) {
    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: categoryDef.query
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch ${categoryId}`);
        }

        const data = await response.json();
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
                return; // Skip this business
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
        console.log(`Loaded ${businesses.length} businesses for ${categoryId}`);
        return businesses;
    } catch (error) {
        console.error(`Error loading businesses for ${categoryId}:`, error);
        return [];
    }
}

// Generate half-mile grid cells covering Portland
function generateGridCells() {
    const cells = [];
    
    // Calculate number of cells needed
    const latRange = PORTLAND_BBOX.north - PORTLAND_BBOX.south;
    const lonRange = PORTLAND_BBOX.east - PORTLAND_BBOX.west;
    const latCells = Math.ceil(latRange / GRID_LAT_STEP);
    const lonCells = Math.ceil(lonRange / GRID_LON_STEP);
    
    for (let i = 0; i < latCells; i++) {
        for (let j = 0; j < lonCells; j++) {
            const south = PORTLAND_BBOX.south + i * GRID_LAT_STEP;
            const north = south + GRID_LAT_STEP;
            const west = PORTLAND_BBOX.west + j * GRID_LON_STEP;
            const east = west + GRID_LON_STEP;
            
            // Calculate center point
            const centerLat = (south + north) / 2;
            const centerLon = (west + east) / 2;
            
            // Create polygon geometry
            const geometry = [
                { lat: south, lon: west },
                { lat: north, lon: west },
                { lat: north, lon: east },
                { lat: south, lon: east },
                { lat: south, lon: west }
            ];
            
            cells.push({
                id: i * lonCells + j,
                row: i,
                col: j,
                centerLat: centerLat,
                centerLon: centerLon,
                geometry: geometry,
                bounds: { minLat: south, maxLat: north, minLon: west, maxLon: east },
                area: GRID_SIZE_KM * GRID_SIZE_KM, // Fixed area for grid cells
                proximityScore: 0,
                nearestBusiness: null,
                businesses: [],
                businessesByCategory: {}
            });
        }
    }
    
    return cells;
}

// Calculate distance between two points in kilometers (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Load Portland neighborhoods from Overpass API
async function loadNeighborhoods() {
    // Try using area search first (more reliable than bounding box)
    // This searches within Portland city boundaries
    let overpassQuery = `
        [out:json][timeout:60];
        area[name="Portland"][place="city"]->.portland;
        (
          relation["boundary"="administrative"]["admin_level"="10"](area.portland);
          relation["place"="neighbourhood"](area.portland);
          relation["place"="suburb"](area.portland);
        );
        out body;
        >;
        out skel qt;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: overpassQuery
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch neighborhoods`);
        }

        const data = await response.json();
        
        // Process the response - group elements by type
        const relations = new Map();
        const ways = new Map();
        const nodes = new Map();
        
        data.elements.forEach(el => {
            if (el.type === 'relation') {
                relations.set(el.id, el);
            } else if (el.type === 'way') {
                ways.set(el.id, el);
            } else if (el.type === 'node') {
                nodes.set(el.id, el);
            }
        });
        
        // Build neighborhoods from relations
        let neighborhoods = Array.from(relations.values())
            .filter(rel => {
                // Filter for administrative boundaries or neighborhoods
                const tags = rel.tags || {};
                return (tags.boundary === 'administrative' && tags.admin_level === '10') ||
                       tags.place === 'neighbourhood' ||
                       tags.place === 'suburb' ||
                       tags.place === 'quarter';
            })
            .map(rel => {
                const geometry = buildGeometryFromRelationData(rel, ways, nodes);
                
                if (!geometry || geometry.length < 3) return null;
                
                return {
                    id: rel.id,
                    name: rel.tags?.name || rel.tags?.['name:en'] || 'Unnamed Neighborhood',
                    geometry: geometry,
                    bounds: calculateBounds(geometry),
                    area: calculateArea(geometry),
                    restaurants: []
                };
            })
            .filter(n => n !== null && n.area > 0.001); // Filter out invalid/tiny areas
        
        // If no neighborhoods found, try bounding box query
        if (neighborhoods.length === 0) {
            console.warn('Area search found no neighborhoods, trying bounding box query...');
            neighborhoods = await loadNeighborhoodsByBBox();
        }
        
        // If still no neighborhoods, try alternative query with geom output
        if (neighborhoods.length === 0) {
            console.warn('Bounding box query found no neighborhoods, trying geom query...');
            neighborhoods = await loadNeighborhoodsWithGeom();
        }
        
        // If still no neighborhoods found, try Portland Open Data
        if (neighborhoods.length === 0) {
            console.warn('OSM queries found no neighborhoods, trying Portland Open Data...');
            neighborhoods = await loadNeighborhoodsFromPortlandData();
        }
        
        // Try loading from local GeoJSON file if available
        if (neighborhoods.length === 0) {
            console.warn('No neighborhoods from APIs, trying local GeoJSON file...');
            neighborhoods = await loadNeighborhoodsFromGeoJSON('neighborhoods.geojson');
        }
        
        // Last resort: grid fallback
        if (neighborhoods.length === 0) {
            console.warn('No neighborhoods found from any source, using grid fallback');
            return createGridNeighborhoods();
        }
        
        console.log(`Loaded ${neighborhoods.length} neighborhoods`);
        return neighborhoods;
    } catch (error) {
        console.error('Error fetching neighborhoods:', error);
        
        // Try alternative query
        try {
            const altNeighborhoods = await loadNeighborhoodsWithGeom();
            if (altNeighborhoods.length > 0) {
                return altNeighborhoods;
            }
        } catch (e) {
            console.error('Alternative query also failed:', e);
        }
        
        // Try Portland Open Data as fallback
        try {
            const portlandData = await loadNeighborhoodsFromPortlandData();
            if (portlandData.length > 0) {
                return portlandData;
            }
        } catch (e) {
            console.error('Portland Open Data also failed:', e);
        }
        
        // Last resort: grid system
        return createGridNeighborhoods();
    }
}

// Alternative: Load neighborhoods using bounding box query
async function loadNeighborhoodsByBBox() {
    const overpassQuery = `
        [out:json][timeout:60];
        (
          relation["boundary"="administrative"]["admin_level"="10"]({{bbox}});
          relation["place"="neighbourhood"]({{bbox}});
          relation["place"="suburb"]({{bbox}});
          relation["place"="quarter"]({{bbox}});
        );
        out body;
        >;
        out skel qt;
    `.replace(/\{\{bbox\}\}/g, `${PORTLAND_BBOX.south},${PORTLAND_BBOX.west},${PORTLAND_BBOX.north},${PORTLAND_BBOX.east}`);

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: overpassQuery
        });

        if (!response.ok) return [];

        const data = await response.json();
        
        // Process the response - group elements by type
        const relations = new Map();
        const ways = new Map();
        const nodes = new Map();
        
        data.elements.forEach(el => {
            if (el.type === 'relation') {
                relations.set(el.id, el);
            } else if (el.type === 'way') {
                ways.set(el.id, el);
            } else if (el.type === 'node') {
                nodes.set(el.id, el);
            }
        });
        
        // Build neighborhoods from relations
        return Array.from(relations.values())
            .filter(rel => {
                const tags = rel.tags || {};
                return (tags.boundary === 'administrative' && tags.admin_level === '10') ||
                       tags.place === 'neighbourhood' ||
                       tags.place === 'suburb' ||
                       tags.place === 'quarter';
            })
            .map(rel => {
                const geometry = buildGeometryFromRelationData(rel, ways, nodes);
                
                if (!geometry || geometry.length < 3) return null;
                
                return {
                    id: rel.id,
                    name: rel.tags?.name || rel.tags?.['name:en'] || 'Unnamed Neighborhood',
                    geometry: geometry,
                    bounds: calculateBounds(geometry),
                    area: calculateArea(geometry),
                    restaurants: []
                };
            })
            .filter(n => n !== null && n.area > 0.001);
    } catch (error) {
        console.error('Bounding box query failed:', error);
        return [];
    }
}

// Alternative query using out geom (simpler but may work better in some cases)
async function loadNeighborhoodsWithGeom() {
    const overpassQuery = `
        [out:json][timeout:60];
        (
          relation["boundary"="administrative"]["admin_level"="10"]({{bbox}});
          relation["place"="neighbourhood"]({{bbox}});
          relation["place"="suburb"]({{bbox}});
        );
        (._;>;);
        out geom;
    `.replace(/\{\{bbox\}\}/g, `${PORTLAND_BBOX.south},${PORTLAND_BBOX.west},${PORTLAND_BBOX.north},${PORTLAND_BBOX.east}`);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: overpassQuery
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    // Group by relation
    const relations = new Map();
    const wayNodes = new Map(); // way_id -> [nodes]
    
    data.elements.forEach(el => {
        if (el.type === 'relation') {
            relations.set(el.id, el);
        } else if (el.type === 'way' && el.nodes && el.geometry) {
            // Store the geometry (coordinates) for this way
            wayNodes.set(el.id, el.geometry.map(p => ({ lat: p.lat, lon: p.lon })));
        }
    });
    
    return Array.from(relations.values())
        .filter(rel => {
            const tags = rel.tags || {};
            return (tags.boundary === 'administrative' && tags.admin_level === '10') ||
                   tags.place === 'neighbourhood' ||
                   tags.place === 'suburb';
        })
        .map(rel => {
            const geometry = buildGeometryFromRelationWithWays(rel, wayNodes);
            if (!geometry || geometry.length < 3) return null;
            
            return {
                id: rel.id,
                name: rel.tags?.name || rel.tags?.['name:en'] || 'Unnamed Neighborhood',
                geometry: geometry,
                bounds: calculateBounds(geometry),
                area: calculateArea(geometry),
                restaurants: []
            };
        })
        .filter(n => n !== null && n.area > 0.001);
}

// Build geometry from relation using way data
// This function properly chains ways together to form a continuous polygon
function buildGeometryFromRelationData(relation, waysMap, nodesMap) {
    if (!relation.members || relation.members.length === 0) return null;
    
    // Find outer ring members (ways with role "outer" or no role)
    const outerWayMembers = relation.members
        .filter(m => m.type === 'way' && (!m.role || m.role === 'outer'))
        .map(m => {
            const way = waysMap.get(m.ref);
            if (!way || !way.nodes || way.nodes.length === 0) return null;
            
            // Convert node IDs to coordinates
            const coords = way.nodes
                .map(nodeId => {
                    const node = nodesMap.get(nodeId);
                    if (node && node.lat !== undefined && node.lon !== undefined) {
                        return { lat: node.lat, lon: node.lon };
                    }
                    return null;
                })
                .filter(c => c !== null);
            
            if (coords.length === 0) return null;
            
            return {
                id: m.ref,
                coords: coords,
                startNode: coords[0],
                endNode: coords[coords.length - 1]
            };
        })
        .filter(w => w !== null);
    
    if (outerWayMembers.length === 0) return null;
    
    // Chain ways together to form a continuous polygon
    const chainedCoords = chainWays(outerWayMembers);
    
    if (!chainedCoords || chainedCoords.length < 3) return null;
    
    // Ensure polygon is closed
    const first = chainedCoords[0];
    const last = chainedCoords[chainedCoords.length - 1];
    const dist = Math.sqrt(
        Math.pow(first.lat - last.lat, 2) + 
        Math.pow(first.lon - last.lon, 2)
    );
    
    if (dist > 0.0001) { // If not already closed
        chainedCoords.push({ lat: first.lat, lon: first.lon });
    }
    
    return chainedCoords;
}

// Chain ways together by matching endpoints
function chainWays(waySegments) {
    if (waySegments.length === 0) return null;
    if (waySegments.length === 1) {
        // Return a closed polygon
        const coords = [...waySegments[0].coords];
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first.lat !== last.lat || first.lon !== last.lon) {
            coords.push({ lat: first.lat, lon: first.lon });
        }
        return coords;
    }
    
    // Helper to compare coordinates (with tolerance)
    const coordsMatch = (a, b) => {
        if (!a || !b) return false;
        const tolerance = 0.0001;
        return Math.abs(a.lat - b.lat) < tolerance && 
               Math.abs(a.lon - b.lon) < tolerance;
    };
    
    // Try each way as a starting point and find the best chain
    let bestChain = null;
    let bestUsed = 0;
    
    for (let startIdx = 0; startIdx < waySegments.length; startIdx++) {
        const result = [...waySegments[startIdx].coords];
        const used = new Set([waySegments[startIdx].id]);
        let currentEnd = result[result.length - 1];
        
        // Keep chaining until all ways are used or we can't find a match
        let progress = true;
        while (progress && used.size < waySegments.length) {
            progress = false;
            
            for (const way of waySegments) {
                if (used.has(way.id)) continue;
                
                // Check if this way can be chained
                if (coordsMatch(currentEnd, way.startNode)) {
                    // Add coordinates (skip first to avoid duplicate)
                    result.push(...way.coords.slice(1));
                    currentEnd = way.endNode;
                    used.add(way.id);
                    progress = true;
                    break;
                } else if (coordsMatch(currentEnd, way.endNode)) {
                    // Reverse the way and add
                    const reversed = [...way.coords].reverse();
                    result.push(...reversed.slice(1));
                    currentEnd = way.startNode;
                    used.add(way.id);
                    progress = true;
                    break;
                }
            }
        }
        
        // If we connected everything, this is our answer
        if (used.size === waySegments.length) {
            // Check if we can close the loop
            const first = result[0];
            if (coordsMatch(currentEnd, first)) {
                return result; // Already closed
            }
            // Try to find a connection back to start
            if (result.length > 0) {
                // Remove duplicates at the end
                while (result.length > 1 && coordsMatch(result[result.length - 1], result[result.length - 2])) {
                    result.pop();
                }
                // Close the polygon
                if (!coordsMatch(result[result.length - 1], result[0])) {
                    result.push({ lat: first.lat, lon: first.lon });
                }
                return result;
            }
        }
        
        // Track the best chain we've found so far
        if (used.size > bestUsed) {
            bestUsed = used.size;
            bestChain = result;
        }
    }
    
    // Use the best chain we found
    if (bestChain && bestChain.length >= 3) {
        // Remove consecutive duplicates
        const cleaned = [];
        for (let i = 0; i < bestChain.length; i++) {
            if (i === 0 || !coordsMatch(bestChain[i], bestChain[i - 1])) {
                cleaned.push(bestChain[i]);
            }
        }
        
        // Ensure it's closed
        if (cleaned.length > 0) {
            const first = cleaned[0];
            const last = cleaned[cleaned.length - 1];
            if (!coordsMatch(first, last)) {
                cleaned.push({ lat: first.lat, lon: first.lon });
            }
        }
        
        return cleaned.length >= 3 ? cleaned : null;
    }
    
    return null;
}

// Build geometry from relation when we have way coordinates directly
function buildGeometryFromRelationWithWays(relation, wayNodesMap) {
    if (!relation.members || relation.members.length === 0) return null;
    
    // Get outer ways
    const outerWayMembers = relation.members
        .filter(m => m.type === 'way' && (!m.role || m.role === 'outer'))
        .map(m => {
            const wayCoords = wayNodesMap.get(m.ref);
            if (!wayCoords || wayCoords.length === 0) return null;
            
            return {
                id: m.ref,
                coords: wayCoords,
                startNode: wayCoords[0],
                endNode: wayCoords[wayCoords.length - 1]
            };
        })
        .filter(w => w !== null);
    
    if (outerWayMembers.length === 0) return null;
    
    // Chain ways together
    const chainedCoords = chainWays(outerWayMembers);
    
    if (!chainedCoords || chainedCoords.length < 3) return null;
    
    // Ensure polygon is closed
    const first = chainedCoords[0];
    const last = chainedCoords[chainedCoords.length - 1];
    const dist = Math.sqrt(
        Math.pow(first.lat - last.lat, 2) + 
        Math.pow(first.lon - last.lon, 2)
    );
    
    if (dist > 0.0001) {
        chainedCoords.push({ lat: first.lat, lon: first.lon });
    }
    
    return chainedCoords;
}


// Try to load neighborhoods from Portland Open Data or alternative source
async function loadNeighborhoodsFromPortlandData() {
    // Try multiple potential sources for Portland neighborhood boundaries
    const possibleSources = [
        // Portland Open Data - neighborhoods GeoJSON (if available)
        {
            url: 'https://www.portlandoregon.gov/shared/cfm/gis/geoJSON.cfm?geojsonID=neighborhoods',
            nameProperty: 'NAME'
        },
        // Alternative source patterns - these are examples and may not work
        // Real URLs would need to be verified
    ];
    
    for (const source of possibleSources) {
        try {
            const response = await fetch(source.url);
            if (response.ok) {
                const geoJson = await response.json();
                
                if (geoJson.type === 'FeatureCollection' && geoJson.features) {
                    const neighborhoods = geoJson.features.map((feature, index) => {
                        const geometry = feature.geometry;
                        let coords = [];
                        
                        if (geometry.type === 'Polygon') {
                            // Extract outer ring of polygon
                            coords = geometry.coordinates[0].map(c => ({
                                lat: c[1],
                                lon: c[0]
                            }));
                        } else if (geometry.type === 'MultiPolygon') {
                            // Use first polygon's outer ring
                            coords = geometry.coordinates[0][0].map(c => ({
                                lat: c[1],
                                lon: c[0]
                            }));
                        }
                        
                        if (coords.length < 3) return null;
                        
                        // Try multiple property names for the neighborhood name
                        const props = feature.properties || {};
                        const name = props[source.nameProperty] || 
                                    props.NAME || 
                                    props.name || 
                                    props.NEIGHBORHOOD || 
                                    props.neighborhood ||
                                    props.LABEL ||
                                    'Unnamed Neighborhood';
                        
                        return {
                            id: feature.id || props.OBJECTID || props.ID || index,
                            name: name,
                            geometry: coords,
                            bounds: calculateBounds(coords),
                            area: calculateArea(coords),
                            restaurants: []
                        };
                    }).filter(n => n !== null && n.area > 0.001);
                    
                    if (neighborhoods.length > 0) {
                        console.log(`Loaded ${neighborhoods.length} neighborhoods from Portland Open Data`);
                        return neighborhoods;
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to load from ${source.url}:`, e.message);
            continue;
        }
    }
    
    return [];
}

// Load neighborhoods from a local GeoJSON file
async function loadNeighborhoodsFromGeoJSON(filename) {
    try {
        const response = await fetch(filename);
        if (!response.ok) {
            return [];
        }
        
        const geoJson = await response.json();
        
        if (geoJson.type === 'FeatureCollection' && geoJson.features) {
            const neighborhoods = geoJson.features.map((feature, index) => {
                const geometry = feature.geometry;
                let coords = [];
                
                if (geometry.type === 'Polygon') {
                    // Extract outer ring of polygon
                    coords = geometry.coordinates[0].map(c => ({
                        lat: c[1],
                        lon: c[0]
                    }));
                } else if (geometry.type === 'MultiPolygon') {
                    // Use first polygon's outer ring
                    coords = geometry.coordinates[0][0].map(c => ({
                        lat: c[1],
                        lon: c[0]
                    }));
                }
                
                if (coords.length < 3) return null;
                
                // Try multiple property names for the neighborhood name
                const props = feature.properties || {};
                const name = props.NAME || 
                            props.name || 
                            props.NEIGHBORHOOD || 
                            props.neighborhood ||
                            props.LABEL ||
                            props.label ||
                            `Neighborhood ${index + 1}`;
                
                return {
                    id: feature.id || props.OBJECTID || props.ID || props.FID || index,
                    name: name,
                    geometry: coords,
                    bounds: calculateBounds(coords),
                    area: calculateArea(coords),
                    restaurants: []
                };
            }).filter(n => n !== null && n.area > 0.001);
            
            if (neighborhoods.length > 0) {
                console.log(`Loaded ${neighborhoods.length} neighborhoods from GeoJSON file`);
                return neighborhoods;
            }
        }
    } catch (e) {
        console.warn(`Failed to load GeoJSON file ${filename}:`, e.message);
    }
    
    return [];
}

// Create a grid-based neighborhood system as fallback
function createGridNeighborhoods() {
    const gridSize = 4; // 4x4 grid
    const latStep = (PORTLAND_BBOX.north - PORTLAND_BBOX.south) / gridSize;
    const lonStep = (PORTLAND_BBOX.east - PORTLAND_BBOX.west) / gridSize;
    const neighborhoods = [];
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const south = PORTLAND_BBOX.south + i * latStep;
            const north = south + latStep;
            const west = PORTLAND_BBOX.west + j * lonStep;
            const east = west + lonStep;
            
            // Create polygon geometry
            const geometry = [
                { lat: south, lon: west },
                { lat: north, lon: west },
                { lat: north, lon: east },
                { lat: south, lon: east },
                { lat: south, lon: west } // Close polygon
            ];
            
            neighborhoods.push({
                id: -(i * gridSize + j + 1), // Negative IDs for grid neighborhoods
                name: `Grid ${i + 1}-${j + 1}`,
                geometry: geometry,
                bounds: { minLat: south, maxLat: north, minLon: west, maxLon: east },
                area: calculateArea(geometry),
                restaurants: []
            });
        }
    }
    
    return neighborhoods;
}

// Load vegan restaurants from Overpass API
async function loadVeganRestaurants() {
    // Strict query: Only get places with vegan tags
    // We'll do additional filtering in JavaScript to ensure they're actual food places
    const overpassQuery = `
        [out:json][timeout:90];
        (
          // Nodes with explicit vegan diet tags
          node["diet:vegan"~"^(yes|only)$"]({{bbox}});
          
          // Nodes with vegan cuisine
          node["cuisine"~"vegan",i]({{bbox}});
          
          // Ways (buildings/areas) with explicit vegan diet tags
          way["diet:vegan"~"^(yes|only)$"]({{bbox}});
          
          // Ways with vegan cuisine
          way["cuisine"~"vegan",i]({{bbox}});
        );
        out center tags;
    `.replace(/\{\{bbox\}\}/g, `${PORTLAND_BBOX.south},${PORTLAND_BBOX.west},${PORTLAND_BBOX.north},${PORTLAND_BBOX.east}`);

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: overpassQuery
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch vegan restaurants`);
        }

        const data = await response.json();
        
        const restaurantsMap = new Map();
        
        // Process elements with strict filtering
        data.elements.forEach(el => {
            const tags = el.tags || {};
            
            // Strict check: Must have explicit vegan marking
            const hasVeganDiet = tags['diet:vegan'] === 'yes' || tags['diet:vegan'] === 'only';
            
            // Check cuisine - can be single value or semicolon-separated list
            const cuisine = tags.cuisine ? tags.cuisine.toLowerCase() : '';
            const cuisineList = cuisine.split(';').map(c => c.trim());
            const hasVeganCuisine = cuisineList.some(c => c.includes('vegan')) || cuisine.includes('vegan');
            
            // Skip if not explicitly vegan
            if (!hasVeganDiet && !hasVeganCuisine) {
                return;
            }
            
            // Exclude places that explicitly don't serve vegan food
            if (tags['diet:vegan'] === 'no') {
                return;
            }
            
            // If they have vegan tags, they're good regardless of other cuisine types
            // (e.g., a restaurant can serve both vegan and non-vegan options)
            // So we don't need to exclude based on other cuisine types if they have vegan tags
            
            // Must be a food establishment or vegan-friendly store
            const amenity = tags.amenity || '';
            const shop = tags.shop || '';
            
            const isFoodPlace = (
                amenity === 'restaurant' ||
                amenity === 'cafe' ||
                amenity === 'fast_food' ||
                amenity === 'food_court' ||
                amenity === 'bar' ||
                amenity === 'bistro' ||
                amenity === 'pub' ||
                amenity === 'ice_cream' ||
                amenity === 'bakery'
            );
            
            // Allow vegan-friendly stores (supermarkets with vegan options)
            const isVeganStore = (
                shop === 'supermarket' ||
                shop === 'convenience' ||
                shop === 'health_food'
            ) && (hasVeganDiet || tags['diet:vegan:options'] === 'yes');
            
            // Skip if not a food place or vegan store
            if (!isFoodPlace && !isVeganStore) {
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
                return; // Skip if no valid location
            }
            
            const name = tags.name || tags['name:en'] || 'Unnamed Restaurant';
            
            // Use location + name as key to avoid duplicates
            const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
            
            // Only add if not already in map, or if this entry has more complete information
            if (!restaurantsMap.has(key) || 
                (tags && Object.keys(tags).length > Object.keys(restaurantsMap.get(key).tags || {}).length)) {
                restaurantsMap.set(key, {
                    id: el.id,
                    name: name,
                    lat: lat,
                    lon: lon,
                    tags: tags,
                    type: 'restaurant',
                    veganType: hasVeganDiet ? 'vegan-only' : (hasVeganCuisine ? 'vegan-cuisine' : 'unknown')
                });
            }
        });
        
        const restaurants = Array.from(restaurantsMap.values());
        
        // Log statistics
        const veganOnly = restaurants.filter(r => r.tags?.['diet:vegan'] === 'only').length;
        const veganOptions = restaurants.filter(r => r.tags?.['diet:vegan'] === 'yes').length;
        const veganCuisine = restaurants.filter(r => !r.tags?.['diet:vegan'] && r.tags?.cuisine?.toLowerCase().includes('vegan')).length;
        
        console.log(`Loaded ${restaurants.length} vegan restaurants:`);
        console.log(`  - Vegan-only: ${veganOnly}`);
        console.log(`  - Vegan options: ${veganOptions}`);
        console.log(`  - Vegan cuisine: ${veganCuisine}`);
        
        // Log any suspicious entries for debugging (if needed)
        const suspicious = restaurants.filter(r => {
            const tags = r.tags || {};
            const cuisine = (tags.cuisine || '').toLowerCase();
            const hasVegan = tags['diet:vegan'] || cuisine.includes('vegan');
            const hasMeatOnly = cuisine.includes('steak') || cuisine.includes('bbq') || 
                              cuisine.includes('seafood') && !cuisine.includes('vegan');
            return !hasVegan || (hasMeatOnly && !tags['diet:vegan']);
        });
        
        if (suspicious.length > 0) {
            console.warn(`Found ${suspicious.length} potentially non-vegan restaurants (may need review):`, 
                suspicious.map(r => r.name));
        }
        
        return restaurants;
    } catch (error) {
        console.error('Error fetching vegan restaurants:', error);
        // Return empty array on error - app will still work, just no restaurants
        return [];
    }
}

// Calculate bounding box for a geometry
function calculateBounds(geometry) {
    if (!geometry || geometry.length === 0) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    
    geometry.forEach(point => {
        if (point.lat && point.lon) {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
        }
    });
    
    return { minLat, maxLat, minLon, maxLon };
}

// Calculate approximate area of a polygon using shoelace formula
// Returns area in square kilometers
function calculateArea(geometry) {
    if (!geometry || geometry.length < 3) return 0.01; // Minimum area
    
    let area = 0;
    const n = geometry.length;
    
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const xi = geometry[i].lon;
        const yi = geometry[i].lat;
        const xj = geometry[j].lon;
        const yj = geometry[j].lat;
        
        if (xi !== undefined && yi !== undefined && xj !== undefined && yj !== undefined) {
            area += xi * yj;
            area -= xj * yi;
        }
    }
    
    // Shoelace formula gives area in square degrees
    const areaSqDegrees = Math.abs(area / 2);
    
    // Convert to square kilometers
    // At Portland's latitude (~45.5°), 1 degree of latitude ≈ 111 km
    // 1 degree of longitude ≈ 111 * cos(45.5°) ≈ 78 km
    const latKmPerDegree = 111;
    const lonKmPerDegree = 111 * Math.cos(PORTLAND_BBOX.north * Math.PI / 180);
    
    // Approximate conversion (assuming rectangular area)
    const areaSqKm = areaSqDegrees * latKmPerDegree * lonKmPerDegree;
    
    return Math.max(areaSqKm, 0.01); // Minimum area to avoid division by zero
}

// Calculate proximity scores for grid cells
// NOTE: This always uses ALL businesses regardless of filter selection
function calculateProximityScores() {
    gridCells.forEach(cell => {
        let minDistance = Infinity;
        let nearestBusiness = null;
        
        // Find nearest business (ANY category) to this grid cell center
        // This always considers ALL businesses for the bohemian score
        allBusinesses.forEach(business => {
            const distance = calculateDistance(
                cell.centerLat,
                cell.centerLon,
                business.lat,
                business.lon
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestBusiness = business;
            }
            
            // Also check if business is within this grid cell
            if (business.lat >= cell.bounds.minLat && 
                business.lat <= cell.bounds.maxLat &&
                business.lon >= cell.bounds.minLon && 
                business.lon <= cell.bounds.maxLon) {
                cell.businesses.push(business);
            }
        });
        
        // Proximity score: closer businesses = higher score
        // Use exponential decay for better visualization
        // Score = 100 * e^(-distance/0.5) where 0.5km is the decay rate
        cell.nearestBusiness = nearestBusiness;
        cell.minDistance = minDistance;
        if (minDistance < Infinity) {
            // Exponential decay: score decreases with distance
            // At 0km: score = 100, at 0.5km: score ≈ 37, at 1km: score ≈ 14
            cell.proximityScore = 100 * Math.exp(-minDistance / 0.5);
        } else {
            cell.proximityScore = 0;
        }
        
        // Count businesses by category in this cell
        cell.businessCount = cell.businesses.length;
        cell.businessesByCategory = {};
        cell.businesses.forEach(b => {
            const cat = b.category || 'unknown';
            if (!cell.businessesByCategory[cat]) {
                cell.businessesByCategory[cat] = [];
            }
            cell.businessesByCategory[cat].push(b);
        });
    });
    
    // Sort grid cells by proximity score (descending - highest proximity first)
    gridCells.sort((a, b) => b.proximityScore - a.proximityScore);
}

// Check if a point is inside a polygon (ray casting algorithm)
function isPointInPolygon(lat, lon, geometry) {
    if (!geometry || geometry.length === 0) return false;
    
    let inside = false;
    for (let i = 0, j = geometry.length - 1; i < geometry.length; j = i++) {
        const xi = geometry[i].lon, yi = geometry[i].lat;
        const xj = geometry[j].lon, yj = geometry[j].lat;
        
        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

// Render map with grid cells and restaurants
function renderMap() {
    calculateProximityScores();
    
    // Find max proximity score for normalization
    const maxProximity = Math.max(...gridCells.map(c => c.proximityScore));
    
    // Create grid cell styling based on proximity
    const gridCellStyle = (cell) => {
        if (!cell || cell.proximityScore === 0) {
            return { fillColor: '#f0f0f0', weight: 1, opacity: 0.2, fillOpacity: 0.1, color: '#ccc' };
        }
        
        const intensity = maxProximity > 0 ? cell.proximityScore / maxProximity : 0;
        
        // Color gradient from light blue/green (far) to dark red (close)
        // Higher proximity score (closer) = more intense red
        const r = Math.min(255, Math.floor(intensity * 255));
        const g = Math.min(255, Math.floor((1 - intensity) * 200));
        const b = Math.min(255, Math.floor((1 - intensity) * 100));
        
        // Make opacity proportional to intensity
        // Low scores = more translucent, high scores = more opaque
        const minOpacity = 0.2;
        const maxOpacity = 0.8;
        const minFillOpacity = 0.15;
        const maxFillOpacity = 0.7;
        
        const opacity = minOpacity + (maxOpacity - minOpacity) * intensity;
        const fillOpacity = minFillOpacity + (maxFillOpacity - minFillOpacity) * intensity;
        
        return {
            fillColor: `rgb(${r}, ${g}, ${b})`,
            weight: 1,
            opacity: opacity,
            fillOpacity: fillOpacity,
            color: '#666'
        };
    };
    
    // Convert grid cells to Leaflet polygons
    const gridFeatures = gridCells
        .filter(cell => cell.geometry && cell.geometry.length > 0)
        .map(cell => {
            const coords = cell.geometry.map(p => [p.lat, p.lon]);
            const style = gridCellStyle(cell);
            
            return L.polygon(coords, {
                ...style,
                gridCellId: cell.id
            }).on('click', () => highlightGridCell(cell.id));
        });
    
    // Create layer group for grid cells
    gridLayer = L.layerGroup(gridFeatures).addTo(map);
    
    // Add business markers (filtered by active categories)
    addBusinessMarkers();
    
    map.addLayer(businessMarkers);
    
    // Render grid cell list (top proximity areas)
    renderGridCellList();
}


// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render grid cell list in drawer (top proximity areas)
function renderGridCellList() {
    const listContainer = document.getElementById('neighborhood-list');
    
    // Only show top cells with proximity scores > 0
    const topCells = gridCells
        .filter(cell => cell.proximityScore > 0)
        .slice(0, 50); // Show top 50 areas
    
    if (topCells.length === 0) {
        listContainer.innerHTML = '<div class="loading">No vegan restaurants found in Portland.</div>';
        return;
    }
    
    listContainer.innerHTML = topCells.map((cell, index) => {
        const proximityScore = cell.proximityScore.toFixed(1);
        const distance = cell.minDistance < 1 ? 
            `${(cell.minDistance * 1000).toFixed(0)}m` : 
            `${cell.minDistance.toFixed(2)}km`;
        const restaurantCount = cell.restaurantCount;
        
        // Show nearby business if available
        const nearestName = cell.nearestBusiness ? 
            escapeHtml(cell.nearestBusiness.name) : 'No businesses';
        
        // Group businesses by category for display
        const categoryGroups = Object.entries(cell.businessesByCategory || {})
            .map(([catId, businesses]) => {
                const catDef = categoryDefinitions[catId];
                const catName = catDef ? catDef.name : catId;
                const icon = catDef ? catDef.icon : '📍';
                return {
                    categoryId: catId,
                    categoryName: catName,
                    icon: icon,
                    businesses: businesses
                };
            })
            .filter(group => group.businesses.length > 0);
        
        let businessListHtml = '';
        if (categoryGroups.length > 0) {
            categoryGroups.forEach(group => {
                const items = group.businesses
                    .slice(0, 3)
                    .map(b => `<div class="restaurant-item"><span class="restaurant-name">${escapeHtml(b.name)}</span></div>`)
                    .join('');
                const more = group.businesses.length > 3 ? ` +${group.businesses.length - 3} more` : '';
                businessListHtml += `
                    <div style="margin-top: 12px;">
                        <div style="font-weight: 600; margin-bottom: 4px;">
                            ${group.icon} ${group.categoryName} (${group.businesses.length})
                        </div>
                        ${items}
                        ${more ? `<div class="restaurant-item">${more}</div>` : ''}
                    </div>
                `;
            });
        }
        
        return `
            <div class="neighborhood-item" data-grid-cell-id="${cell.id}" data-index="${index}">
                <div class="neighborhood-header">
                    <span class="neighborhood-name">${index + 1}. Area ${index + 1}</span>
                    <div class="neighborhood-stats">
                        <span class="density-score">${proximityScore}</span>
                    </div>
                </div>
                <div class="neighborhood-restaurants">
                    <div class="restaurant-item"><strong>Nearest:</strong> ${nearestName} (${distance})</div>
                    ${cell.businessCount > 0 ? `
                        <div style="margin-top: 8px; font-weight: 600;">Businesses in area: ${cell.businessCount}</div>
                        ${businessListHtml}
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    listContainer.querySelectorAll('.neighborhood-item').forEach(item => {
        item.addEventListener('click', function() {
            const cellId = parseInt(this.dataset.gridCellId);
            const isExpanded = this.classList.contains('expanded');
            
            // Toggle expanded state
            listContainer.querySelectorAll('.neighborhood-item').forEach(i => {
                i.classList.remove('expanded', 'active');
            });
            
            if (!isExpanded) {
                this.classList.add('expanded', 'active');
                highlightGridCell(cellId);
            } else {
                map.fitBounds(gridLayer.getBounds());
            }
        });
    });
}

// Highlight a grid cell on the map
function highlightGridCell(cellId) {
    // Find and zoom to grid cell
    const cell = gridCells.find(c => c.id === cellId);
    if (!cell || !cell.geometry) return;
    
    // Zoom to grid cell bounds
    const coords = cell.geometry.map(p => [p.lat, p.lon]);
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    
    // Update active state in list
    document.querySelectorAll('.neighborhood-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.gridCellId) === cellId) {
            item.classList.add('active');
        }
    });
}


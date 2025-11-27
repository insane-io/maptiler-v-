// API Keys
export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
export const OPENWEATHER_KEY = import.meta.env.VITE_OPENWEATHER_KEY;
export const WAQI_TOKEN = import.meta.env.VITE_WAQI_TOKEN;

// Debug logging
console.log('🔑 API Keys Status:');
console.log('  MapTiler:', MAPTILER_KEY ? '✅ Loaded' : '❌ Missing');
console.log('  OpenWeather:', OPENWEATHER_KEY ? '✅ Loaded' : '❌ Missing');
console.log('  WAQI:', WAQI_TOKEN ? '✅ Loaded' : '❌ Missing');

// Map Configuration
export const MAP_CONFIG = {
  // Ocean-focused region (Indian Ocean per task)
  defaultCenter: [78.9629, 15.0],
  defaultZoom: 5,
  maxZoom: 18,
  minZoom: 2,
};

// AQI Color Scheme (Per Task Document - Standard)
export const AQI_COLORS = {
  GOOD: '#2ecc71',           // 0-50
  MODERATE: '#f1c40f',       // 51-100
  USG: '#e67e22',            // 101-150 (Unhealthy for Sensitive Groups)
  UNHEALTHY: '#e74c3c',      // 151-200
  VERY_UNHEALTHY: '#8e44ad', // 201-300
  HAZARDOUS: '#7d0505',      // 300+
};

// Wave Height Color Scheme (for heatmap)
export const WAVE_COLORS = {
  LOW: '#3498db',       // 0-1m
  MEDIUM: '#f39c12',    // 1-3m
  HIGH: '#e74c3c',      // 3-5m
  EXTREME: '#c0392b',   // 5m+
};

// Cyclone Categories
export const CYCLONE_CATEGORIES = {
  TD: { name: 'Tropical Depression', color: '#3498db' },
  TS: { name: 'Tropical Storm', color: '#f1c40f' },
  C1: { name: 'Category 1', color: '#e67e22' },
  C2: { name: 'Category 2', color: '#e74c3c' },
  C3: { name: 'Category 3', color: '#c0392b' },
  C4: { name: 'Category 4', color: '#8e44ad' },
  C5: { name: 'Category 5', color: '#7d0505' },
};

// Data refresh intervals (milliseconds)
export const REFRESH_INTERVALS = {
  VESSELS: 30000,    // 30 seconds (real-time)
  CYCLONES: 360000,  // 6 minutes
  WAVES: 600000,     // 10 minutes
  AQI: 1800000,      // 30 minutes
};
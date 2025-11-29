import React, { useEffect, useRef, useState, FC, useCallback } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { MAPTILER_KEY, AQI_COLORS } from '../utils/constants';
import Sidebar from './Sidebar';
import Timeline from './Timeline';
import InfoPanel from './InfoPanel';
import type {
  VesselData,
  CycloneData,
  CycloneTrackData,
  WaveData,
  AQIData,
  GeoJSONProperties,
  MapPosition,
  GeoJSONFeatureCollection,
} from '../types';

// Backend API base URL
const BACKEND_API_URL = 'http://localhost:8000';

// Import mock data
import mockVessels from '../data/mockVessels.json' with { type: 'json' };
import mockCyclones from '../data/mockCyclones.json' with { type: 'json' };
import mockCycloneTracks from '../data/mockCycloneTracks.json' with { type: 'json' };
import mockWaves from '../data/mockWaves.json' with { type: 'json' };
import mockAQI from '../data/mockAQI.json' with { type: 'json' };

/**
 * Fetch vessels from backend API for a given bounding box
 */
const fetchVesselsFromBackend = async (
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number
): Promise<GeoJSONFeatureCollection | null> => {
  try {
    const params = new URLSearchParams({
      min_lat: minLat.toString(),
      min_lon: minLon.toString(),
      max_lat: maxLat.toString(),
      max_lon: maxLon.toString(),
    });

    const url = `${BACKEND_API_URL}/api/vessels?${params}`;
    console.log(`🔍 Fetching vessels: ${url.substring(0, 80)}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== 'object' || !Array.isArray(data.features)) {
      console.warn('⚠️ Invalid vessels response format');
      return { type: 'FeatureCollection', features: [] };
    }
    
    console.log(`✅ Vessels: ${data.features.length} found`);
    return data;
  } catch (error: any) {
    console.error('❌ Vessels fetch error:', error.message || error);
    return { type: 'FeatureCollection', features: [] };
  }
};

/**
 * Fetch AQI data from backend API for a given bounding box
 */
const fetchAQIFromBackend = async (
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number
): Promise<GeoJSONFeatureCollection | null> => {
  try {
    const params = new URLSearchParams({
      min_lat: minLat.toString(),
      min_lon: minLon.toString(),
      max_lat: maxLat.toString(),
      max_lon: maxLon.toString(),
    });

    const url = `${BACKEND_API_URL}/api/aqi?${params}`;
    console.log(`🔍 Fetching AQI: ${url.substring(0, 80)}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== 'object' || !Array.isArray(data.features)) {
      console.warn('⚠️ Invalid AQI response format');
      return { type: 'FeatureCollection', features: [] };
    }
    
    console.log(`✅ AQI: ${data.features.length} stations found`);
    return data;
  } catch (error: any) {
    console.error('❌ AQI fetch error:', error.message || error);
    return { type: 'FeatureCollection', features: [] };
  }
};

/**
 * Fetch waves data from backend API for a given bounding box
 */
const fetchWavesFromBackend = async (
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number
): Promise<GeoJSONFeatureCollection | null> => {
  try {
    const params = new URLSearchParams({
      min_lat: minLat.toString(),
      min_lon: minLon.toString(),
      max_lat: maxLat.toString(),
      max_lon: maxLon.toString(),
    });

    const url = `${BACKEND_API_URL}/api/waves?${params}`;
    console.log(`🔍 Fetching waves: ${url.substring(0, 80)}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== 'object' || !Array.isArray(data.features)) {
      console.warn('⚠️ Invalid waves response format');
      return { type: 'FeatureCollection', features: [] };
    }
    
    console.log(`✅ Waves: ${data.features.length} points found`);
    return data;
  } catch (error: any) {
    console.error('❌ Waves fetch error:', error.message || error);
    return { type: 'FeatureCollection', features: [] };
  }
};

const Map: FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [activeLayers, setActiveLayers] = useState<string[]>(['satellite']);
  const activeLayersRef = useRef<string[]>(['satellite']);
  const [hoveredFeature, setHoveredFeature] = useState<GeoJSONProperties | null>(null);
  const [clickedFeature, setClickedFeature] = useState<GeoJSONProperties | null>(null);
  const initialized = useRef<boolean>(false);
  const popup = useRef<maptilersdk.Popup | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Update vessel, AQI, and waves data from backend based on current map bounds
   * Only fetches data for layers that are currently active
   */
  const updateDataFromBackend = useCallback(async (): Promise<void> => {
    if (!map.current) return;

    const bounds = map.current.getBounds();
    if (!bounds) return;

    const minLat = bounds.getSouth();
    const minLon = bounds.getWest();
    const maxLat = bounds.getNorth();
    const maxLon = bounds.getEast();

    // Use ref to get current active layers (avoids stale closure issues)
    const currentActiveLayers = activeLayersRef.current;

    console.log(`📍 Fetching data for bbox: [${minLat.toFixed(2)}, ${minLon.toFixed(2)}] to [${maxLat.toFixed(2)}, ${maxLon.toFixed(2)}]`);
    console.log(`📋 Active layers: ${currentActiveLayers.join(', ')}`);

    // Build array of fetch promises only for active layers
    const fetchPromises: Promise<GeoJSONFeatureCollection | null>[] = [];
    const fetchTypes: string[] = [];

    if (currentActiveLayers.includes('vessels')) {
      fetchPromises.push(fetchVesselsFromBackend(minLat, minLon, maxLat, maxLon));
      fetchTypes.push('vessels');
    }
    if (currentActiveLayers.includes('aqi')) {
      fetchPromises.push(fetchAQIFromBackend(minLat, minLon, maxLat, maxLon));
      fetchTypes.push('aqi');
    }
    if (currentActiveLayers.includes('waves')) {
      fetchPromises.push(fetchWavesFromBackend(minLat, minLon, maxLat, maxLon));
      fetchTypes.push('waves');
    }

    // Only fetch if there are active data layers
    if (fetchPromises.length === 0) {
      console.log('⚠️ No active data layers to fetch');
      return;
    }

    console.log(`🔄 Fetching ${fetchTypes.length} data types: ${fetchTypes.join(', ')}`);
    
    // Update each layer immediately as data arrives (progressive display)
    const updateLayer = (layerType: string, data: GeoJSONFeatureCollection | null) => {
      if (!map.current || !data) return;
      
      let source: maptilersdk.GeoJSONSource | undefined;
      let logPrefix = '';
      
      switch (layerType) {
        case 'vessels':
          source = map.current.getSource('vessels') as maptilersdk.GeoJSONSource | undefined;
          logPrefix = '🚢';
          break;
        case 'aqi':
          source = map.current.getSource('aqi') as maptilersdk.GeoJSONSource | undefined;
          logPrefix = '💨';
          break;
        case 'waves':
          source = map.current.getSource('waves') as maptilersdk.GeoJSONSource | undefined;
          logPrefix = '🌊';
          break;
      }
      
      if (source) {
        try {
          source.setData(data);
          console.log(`${logPrefix} ${layerType} updated: ${data.features?.length || 0} features`);
        } catch (error) {
          console.error(`Error updating ${layerType}:`, error);
        }
      }
    };

    // Process each request independently and update immediately when ready
    fetchPromises.forEach((promise, index) => {
      const layerType = fetchTypes[index];
      promise
        .then((data) => {
          if (data && data.features) {
            updateLayer(layerType, data);
          }
        })
        .catch((error) => {
          console.error(`❌ ${layerType} fetch failed:`, error);
        });
    });
  }, []); // No dependencies - uses refs to get current values

  useEffect(() => {
    if (initialized.current) return;
    if (map.current) return;

    initialized.current = true;
    maptilersdk.config.apiKey = MAPTILER_KEY;

    console.log('🗺️ Initializing Ocean Analysis Map...');

    map.current = new maptilersdk.Map({
      container: mapContainer.current!,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
      center: [30.0, 30.0], // More centered global view
      zoom: 3, // Zoomed out to see more regions
      attributionControl: false
    });

    map.current.addControl(new maptilersdk.ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.current.addControl(new maptilersdk.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      console.log('✅ Map loaded - Adding layers...');
      initializeLayers();
      setupInteractions();
      
      // Fetch data when map is moved/zoomed (debounced) - only for active layers
      const handleMapMove = () => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(() => {
          // Only fetch if relevant layers are active (use ref to get current value)
          const currentActiveLayers = activeLayersRef.current;
          if (currentActiveLayers.includes('vessels') || currentActiveLayers.includes('aqi') || currentActiveLayers.includes('waves')) {
            updateDataFromBackend();
          }
        }, 800); // Increased debounce to 800ms for slower connections
      };

      map.current!.on('moveend', handleMapMove);
      map.current!.on('zoomend', handleMapMove);

      setMapLoaded(true);
    });

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (map.current) map.current.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeLayers = (): void => {
    // 1. VESSELS LAYER (initially empty, will be populated from backend)
    map.current!.addSource('vessels', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    } as any);

    // Cluster circles
    map.current!.addLayer({
      id: 'vessels-clusters',
      type: 'circle',
      source: 'vessels',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6', 100,
          '#f1f075', 750,
          '#f28cb1'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          15, 100,
          20, 750,
          25
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.85
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // Cluster count labels
    map.current!.addLayer({
      id: 'vessels-cluster-count',
      type: 'symbol',
      source: 'vessels',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12,
        'visibility': 'none'
      },
      paint: {
        'text-color': '#111111'
      }
    } as any);

    // Unclustered points
    map.current!.addLayer({
      id: 'vessels-unclustered',
      type: 'circle',
      source: 'vessels',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'match',
          ['get', 'type'],
          'Container Ship', '#3498db',
          'Tanker', '#e74c3c',
          'Cargo Ship', '#f39c12',
          '#95a5a6'
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // Vessel labels
    map.current!.addLayer({
      id: 'vessels-labels',
      type: 'symbol',
      source: 'vessels',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'vessel_name'],
        'text-size': 11,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    } as any);

    // 2. CYCLONES LAYER
    map.current!.addSource('cyclones', {
      type: 'geojson',
      data: mockCyclones as unknown as CycloneData
    });

    map.current!.addLayer({
      id: 'cyclones-layer',
      type: 'circle',
      source: 'cyclones',
      paint: {
        'circle-radius': 12,
        'circle-color': [
          'match',
          ['get', 'category'],
          1, '#3498db',
          2, '#f39c12',
          3, '#e67e22',
          4, '#e74c3c',
          5, '#c0392b',
          '#95a5a6'
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.8
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // Cyclone labels
    map.current!.addLayer({
      id: 'cyclones-labels',
      type: 'symbol',
      source: 'cyclones',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-offset': [0, 2],
        'text-anchor': 'top',
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#e74c3c',
        'text-halo-width': 2
      }
    } as any);

    // Cyclone tracks
    map.current!.addSource('cyclone-tracks', {
      type: 'geojson',
      data: mockCycloneTracks as unknown as CycloneTrackData
    });

    map.current!.addLayer({
      id: 'cyclone-tracks-layer',
      type: 'line',
      source: 'cyclone-tracks',
      paint: {
        'line-color': [
          'match',
          ['get', 'track_type'],
          'historical', '#e74c3c',
          'forecast', '#f39c12',
          '#95a5a6'
        ],
        'line-width': 2,
        'line-dasharray': [
          'match',
          ['get', 'track_type'],
          'forecast', ['literal', [2, 2]],
          ['literal', [1, 0]]
        ]
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 3. WAVES HEATMAP
    map.current!.addSource('waves', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    map.current!.addLayer({
      id: 'waves-heatmap',
      type: 'heatmap',
      source: 'waves',
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'wave_height'],
          0, 0,
          6, 1
        ],
        'heatmap-intensity': 1,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33, 102, 172, 0)',
          0.2, 'rgb(103, 169, 207)',
          0.4, 'rgb(209, 229, 240)',
          0.6, 'rgb(253, 219, 199)',
          0.8, 'rgb(239, 138, 98)',
          1, 'rgb(178, 24, 43)'
        ],
        'heatmap-radius': 50,
        'heatmap-opacity': 0.7
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 4. AQI LAYER (improved styling to match reference)
    map.current!.addSource('aqi', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    // AQI Heatmap layer
    map.current!.addLayer({
      id: 'aqi-heatmap',
      type: 'heatmap',
      source: 'aqi',
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'aqi'],
          0, 0,
          50, 0.2,
          100, 0.5,
          150, 0.7,
          200, 0.9,
          300, 1
        ],
        'heatmap-intensity': 1.5,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(46, 204, 113, 0)',
          0.2, 'rgba(46, 204, 113, 0.6)',
          0.4, 'rgba(241, 196, 15, 0.7)',
          0.6, 'rgba(230, 126, 34, 0.8)',
          0.8, 'rgba(231, 76, 60, 0.9)',
          1, 'rgba(125, 5, 5, 1)'
        ],
        'heatmap-radius': 60,
        'heatmap-opacity': 0.8
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // AQI Circle layer - LARGER and more prominent like the reference image
    map.current!.addLayer({
      id: 'aqi-layer',
      type: 'circle',
      source: 'aqi',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'aqi'],
          0, 20,
          50, 28,
          100, 36,
          150, 44,
          200, 52,
          300, 60
        ],
        'circle-color': [
          'step',
          ['get', 'aqi'],
          AQI_COLORS.GOOD, 50,
          AQI_COLORS.MODERATE, 100,
          AQI_COLORS.USG, 150,
          AQI_COLORS.UNHEALTHY, 200,
          AQI_COLORS.VERY_UNHEALTHY, 300,
          AQI_COLORS.HAZARDOUS
        ],
        'circle-opacity': 0.9,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 1
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // AQI value labels - Larger, bold text like the reference
    map.current!.addLayer({
      id: 'aqi-labels',
      type: 'symbol',
      source: 'aqi',
      layout: {
        'text-field': ['to-string', ['get', 'aqi']],
        'text-size': 16,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'center',
        'visibility': 'none'
      },
      paint: {
        'text-color': '#000000',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    } as any);

    // 5. WIND LAYER
    const owmKey = (import.meta as any).env.VITE_OPENWEATHER_KEY || 'demo';
    map.current!.addSource('wind-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${owmKey}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'wind-layer',
      type: 'raster',
      source: 'wind-tiles',
      paint: {
        'raster-opacity': 0.6
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 6. PRECIPITATION LAYER
    map.current!.addSource('precipitation-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${owmKey}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'precipitation-layer',
      type: 'raster',
      source: 'precipitation-tiles',
      paint: {
        'raster-opacity': 0.7
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 7. TEMPERATURE LAYER
    map.current!.addSource('temperature-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${owmKey}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'temperature-layer',
      type: 'raster',
      source: 'temperature-tiles',
      paint: {
        'raster-opacity': 0.6
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 8. PRESSURE LAYER
    map.current!.addSource('pressure-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${owmKey}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'pressure-layer',
      type: 'raster',
      source: 'pressure-tiles',
      paint: {
        'raster-opacity': 0.5
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 9. CLOUDS LAYER
    map.current!.addSource('clouds-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${owmKey}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'humidity-layer', 
      type: 'raster',
      source: 'clouds-tiles',
      paint: {
        'raster-opacity': 0.6
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // 10. RADAR LAYER
    map.current!.addSource('radar-tiles', {
      type: 'raster',
      tiles: [
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${owmKey}`
      ],
      tileSize: 256
    });

    map.current!.addLayer({
      id: 'radar-layer',
      type: 'raster',
      source: 'radar-tiles',
      paint: {
        'raster-opacity': 0.8
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    console.log('✅ All layers initialized');
  };

  const setupInteractions = (): void => {
    // Hover effects for vessels
    map.current!.on('mouseenter', 'vessels-unclustered', (e: maptilersdk.MapLayerMouseEvent) => {
      map.current!.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features.length > 0) {
        setHoveredFeature(e.features[0].properties);
      }
    });

    map.current!.on('mouseleave', 'vessels-unclustered', () => {
      map.current!.getCanvas().style.cursor = '';
      setHoveredFeature(null);
    });

    // Click for detailed popup (unclustered vessels)
    map.current!.on('click', 'vessels-unclustered', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      popup.current = new maptilersdk.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #2c3e50;">
              🚢 Vessel MMSI: ${props.mmsi || 'Unknown'}
            </h3>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              <strong>Speed:</strong> ${props.speed || 0} knots<br/>
              <strong>Course:</strong> ${props.course || 0}°<br/>
              <strong>Latitude:</strong> ${props.lat?.toFixed(4) || 'N/A'}<br/>
              <strong>Longitude:</strong> ${props.lon?.toFixed(4) || 'N/A'}<br/>
              <strong>Last Updated:</strong> ${props.last_updated ? new Date(props.last_updated).toLocaleString() : 'N/A'}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });

    // Click on vessel clusters to zoom in
    map.current!.on('click', 'vessels-clusters', (e: maptilersdk.MapLayerMouseEvent) => {
      const features = e.features!;
      const clusterId = features[0].properties?.cluster_id;

      if (clusterId && map.current) {
        const source = map.current.getSource('vessels') as maptilersdk.GeoJSONSource;
        (source as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;

          map.current!.easeTo({
            center: (features[0].geometry as any).coordinates,
            zoom: zoom
          });
        });
      }
    });

    // Cyclones interactions
    map.current!.on('click', 'cyclones-layer', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      popup.current = new maptilersdk.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #e74c3c;">
              🌀 ${props.name}
            </h3>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              <strong>Category:</strong> ${props.category}<br/>
              <strong>Wind Speed:</strong> ${props.wind_speed} km/h<br/>
              <strong>Pressure:</strong> ${props.pressure} mb<br/>
              <strong>Movement:</strong> ${props.movement}<br/>
              <strong>Intensity:</strong> ${props.intensity}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });

    // AQI clicks
    map.current!.on('click', 'aqi-layer', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      const getAQIStatus = (aqi: number) => {
        if (aqi <= 50) return { text: 'Good', color: AQI_COLORS.GOOD };
        if (aqi <= 100) return { text: 'Moderate', color: AQI_COLORS.MODERATE };
        if (aqi <= 150) return { text: 'Unhealthy for Sensitive Groups', color: AQI_COLORS.USG };
        if (aqi <= 200) return { text: 'Unhealthy', color: AQI_COLORS.UNHEALTHY };
        if (aqi <= 300) return { text: 'Very Unhealthy', color: AQI_COLORS.VERY_UNHEALTHY };
        return { text: 'Hazardous', color: AQI_COLORS.HAZARDOUS };
      };

      const status = getAQIStatus(props.aqi);

      popup.current = new maptilersdk.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px; min-width: 180px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #2c3e50;">
              💨 ${props.name || 'AQI Station'}
            </h3>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              <strong>AQI:</strong> ${props.aqi}<br/>
              <strong>Status:</strong> <span style="color: ${status.color}">●</span> ${status.text}<br/>
              <strong>Last Updated:</strong> ${props.last_updated || 'N/A'}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });
  };

  const handleLayerToggle = (layerId: string): void => {
    if (!map.current) return;

    console.log('🔄 Toggle layer:', layerId);

    // Handle base map style changes
    if (layerId === 'satellite') {
      setActiveLayers(prev => {
        const isActive = prev.includes(layerId);
        const newActiveLayers = isActive ? prev : [...prev, layerId];
        activeLayersRef.current = newActiveLayers;
        return newActiveLayers;
      });
      return;
    }

    const layerMap: Record<string, string[]> = {
      'vessels': ['vessels-clusters', 'vessels-cluster-count', 'vessels-unclustered', 'vessels-labels'],
      'cyclones': ['cyclones-layer', 'cyclones-labels', 'cyclone-tracks-layer'],
      'waves': ['waves-heatmap'],
      'aqi': ['aqi-heatmap', 'aqi-layer', 'aqi-labels'],
      'wind': ['wind-layer'],
      'precipitation': ['precipitation-layer'],
      'temperature': ['temperature-layer'],
      'pressure': ['pressure-layer'],
      'humidity': ['humidity-layer'],
      'radar': ['radar-layer']
    };

    const layers = layerMap[layerId];
    if (!layers) {
      console.warn(`⚠️ No layer mapping for: ${layerId}`);
      return;
    }

    const currentlyActive = activeLayers.includes(layerId);

    setActiveLayers(prev => {
      const isActive = prev.includes(layerId);
      const newVisibility = isActive ? 'none' : 'visible';

      layers.forEach(layer => {
        try {
          if (map.current && map.current.getLayer(layer)) {
            map.current.setLayoutProperty(layer, 'visibility', newVisibility as 'visible' | 'none');
            console.log(`  ${isActive ? '❌' : '✅'} ${layer}: ${newVisibility}`);
          }
        } catch (error) {
          console.error(`Error toggling layer ${layer}:`, error);
        }
      });

      const newActiveLayers = isActive ? prev.filter(id => id !== layerId) : [...prev, layerId];
      activeLayersRef.current = newActiveLayers;
      return newActiveLayers;
    });

    // Fetch data when layer is enabled
    if (!currentlyActive && (layerId === 'vessels' || layerId === 'aqi' || layerId === 'waves')) {
      console.log(`🔄 Layer ${layerId} enabled - fetching data...`);
      setTimeout(() => {
        void updateDataFromBackend();
      }, 150);
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#0a1929' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {mapLoaded && (
        <>
          <Sidebar onLayerToggle={handleLayerToggle} activeLayers={activeLayers} />
          <Timeline onTimeChange={(time: any) => console.log('Time changed:', time)} />
          <InfoPanel
            data={hoveredFeature}
            position={map.current?.getCenter()}
          />
        </>
      )}
    </div>
  );
}

export default Map;
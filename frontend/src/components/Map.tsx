import { useEffect, useRef, useState, FC, useCallback } from 'react';
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

    const response = await fetch(`${BACKEND_API_URL}/api/vessels?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      console.warn(`Backend API error: ${response.status}`);
      // Fall back to mock data if backend unavailable
      return mockVessels as unknown as GeoJSONFeatureCollection;
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features.length} vessels from backend`);
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch vessels from backend:', error);
    // Fall back to mock data
    console.log('⚠️ Using mock vessel data');
    return mockVessels as unknown as GeoJSONFeatureCollection;
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

    const response = await fetch(`${BACKEND_API_URL}/api/aqi?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      console.warn(`Backend AQI API error: ${response.status}`);
      // Fall back to mock data if backend unavailable
      return mockAQI as unknown as GeoJSONFeatureCollection;
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features.length} AQI stations from backend`);
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch AQI from backend:', error);
    // Fall back to mock data
    console.log('⚠️ Using mock AQI data');
    return mockAQI as unknown as GeoJSONFeatureCollection;
  }
};

/**
 * Fetch cyclones from backend API for a given bounding box
 * (loaded on-demand when the user enables the Cyclones layer)
 */
const fetchCyclonesFromBackend = async (
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

    const response = await fetch(`${BACKEND_API_URL}/api/cyclones?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn(`Backend Cyclones API error: ${response.status}`);
      // fall back to mock data
      return mockCyclones as unknown as GeoJSONFeatureCollection;
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.features?.length ?? 0} cyclones from backend`);
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch cyclones from backend:', error);
    console.log('⚠️ Using mock cyclones data');
    return mockCyclones as unknown as GeoJSONFeatureCollection;
  }
};

const Map: FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [activeLayers, setActiveLayers] = useState<string[]>(['satellite']);
  const [hoveredFeature, setHoveredFeature] = useState<GeoJSONProperties | null>(null);
  const [clickedFeature, setClickedFeature] = useState<GeoJSONProperties | null>(null);
  const initialized = useRef<boolean>(false);
  const popup = useRef<maptilersdk.Popup | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Update vessel and AQI data from backend based on current map bounds
   */
  const updateDataFromBackend = useCallback(async (): Promise<void> => {
    if (!map.current) return;

    const bounds = map.current.getBounds();
    if (!bounds) return;

    const minLat = bounds.getSouth();
    const minLon = bounds.getWest();
    const maxLat = bounds.getNorth();
    const maxLon = bounds.getEast();

    console.log(`📍 Fetching data for bbox: [${minLat.toFixed(2)}, ${minLon.toFixed(2)}] to [${maxLat.toFixed(2)}, ${maxLon.toFixed(2)}]`);

    // Fetch both vessels and AQI data in parallel
    const [vesselData, aqiData] = await Promise.all([
      fetchVesselsFromBackend(minLat, minLon, maxLat, maxLon),
      fetchAQIFromBackend(minLat, minLon, maxLat, maxLon)
    ]);

    if (map.current) {
      // Update vessels
      if (vesselData) {
        const vesselSource = map.current.getSource('vessels') as maptilersdk.GeoJSONSource | undefined;
        if (vesselSource) {
          vesselSource.setData(vesselData);
          console.log(`🚢 Vessel layer updated with ${vesselData.features.length} vessels`);
        }
      }

      // Update AQI
      if (aqiData) {
        const aqiSource = map.current.getSource('aqi') as maptilersdk.GeoJSONSource | undefined;
        if (aqiSource) {
          aqiSource.setData(aqiData);
          console.log(`💨 AQI layer updated with ${aqiData.features.length} stations`);
        }
      }
    }
  }, []);

  // NOTE: 'Show All' controls removed — use the Sidebar layer toggles to show/hide layers.

  useEffect(() => {
    if (initialized.current) return;
    if (map.current) return;

    initialized.current = true;
    maptilersdk.config.apiKey = MAPTILER_KEY;

    console.log('🗺️ Initializing Ocean Analysis Map...');

    map.current = new maptilersdk.Map({
      container: mapContainer.current!,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
      center: [78.9629, 15.0], // Indian Ocean focus
      zoom: 5,
      attributionControl: false
    });

    // map.current.addControl(new maptilersdk.NavigationControl(), 'top-right');
    map.current.addControl(new maptilersdk.ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.current.addControl(new maptilersdk.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      console.log('✅ Map loaded - Adding layers...');
      initializeLayers();
      setupInteractions();
      
      // Fetch data immediately and on map movements
      updateDataFromBackend();
      
      // Fetch data when map is moved/zoomed (debounced)
      const handleMapMove = () => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(() => {
          updateDataFromBackend();
        }, 500); // Debounce 500ms
      };

      map.current!.on('moveend', handleMapMove);
      map.current!.on('zoomend', handleMapMove);

      setMapLoaded(true);
    });

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (map.current) map.current.remove();
    };
  }, [updateDataFromBackend]);

  const initializeLayers = (): void => {
    // 1. VESSELS LAYER (initially empty, will be populated from backend)
    // Use client-side clustering so many vessels render nicely
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

    // Cluster circles (aggregations)
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
        'text-size': 12
      },
      paint: {
        'text-color': '#111111'
      }
    } as any);

    // Unclustered points (individual vessels)
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
      }
    } as any);

    // Vessel labels (for single points)
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
    // Initialize source empty — DO NOT preload cyclones here (we load on-demand)
    map.current!.addSource('cyclones', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
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

    // Cyclone tracks (we keep mock tracks as-is)
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
      data: mockWaves as unknown as WaveData
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

    // 4. AQI LAYER (initially empty, will be populated from backend)
    map.current!.addSource('aqi', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    map.current!.addLayer({
      id: 'aqi-layer',
      type: 'circle',
      source: 'aqi',
      paint: {
        // radius grows with AQI severity
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'aqi'],
          0, 6,
          50, 10,
          100, 14,
          150, 18,
          200, 22
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
        'circle-opacity': 0.75,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#222222'
      },
      layout: {
        'visibility': 'none'
      }
    } as any);

    // AQI value labels
    map.current!.addLayer({
      id: 'aqi-labels',
      type: 'symbol',
      source: 'aqi',
      layout: {
        'text-field': ['to-string', ['get', 'aqi']],
        'text-size': 10,
        'text-anchor': 'center',
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    } as any);

    // 5. WIND LAYER (OpenWeatherMap)
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

    // 9. CLOUDS LAYER (Instead of humidity - more visual)
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

    // 10. RADAR LAYER (Precipitation intensity)
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
    map.current!.on('mouseenter', 'vessels-layer', (e: maptilersdk.MapLayerMouseEvent) => {
      map.current!.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features.length > 0) {
        setHoveredFeature(e.features[0].properties);
      }
    });

    map.current!.on('mouseleave', 'vessels-layer', () => {
      map.current!.getCanvas().style.cursor = '';
      setHoveredFeature(null);
    });

    // Click for detailed popup
    map.current!.on('click', 'vessels-layer', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      popup.current = new maptilersdk.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #2c3e50;">
              🚢 ${props.vessel_name}
            </h3>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              <strong>Type:</strong> ${props.type}<br/>
              <strong>Speed:</strong> ${props.speed} knots<br/>
              <strong>Course:</strong> ${props.course}°<br/>
              <strong>Destination:</strong> ${props.destination}<br/>
              <strong>ETA:</strong> ${new Date(props.eta).toLocaleString()}<br/>
              <strong>Flag:</strong> ${props.flag}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });

    // Similar interactions for cyclones
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

      popup.current = new maptilersdk.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px; min-width: 180px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #2c3e50;">
              💨 ${props.city}
            </h3>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              <strong>AQI:</strong> ${props.aqi}<br/>
              <strong>PM2.5:</strong> ${props.pm25} μg/m³<br/>
              <strong>Category:</strong> ${props.category}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });
  };

  const handleLayerToggle = (layerId: string): void => {
    if (!map.current) return;

    console.log('🔄 Toggle layer:', layerId);

    const layerMap: Record<string, string[]> = {
      'vessels': ['vessels-clusters', 'vessels-cluster-count', 'vessels-unclustered', 'vessels-labels'],
      'cyclones': ['cyclones-layer', 'cyclones-labels', 'cyclone-tracks-layer'],
      'waves': ['waves-heatmap'],
      'aqi': ['aqi-layer', 'aqi-labels'],
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
        if (map.current!.getLayer(layer)) {
          map.current!.setLayoutProperty(layer, 'visibility', newVisibility as 'visible' | 'none');
          console.log(`  ${isActive ? '❌' : '✅'} ${layer}: ${newVisibility}`);
        }
      });

      return isActive ? prev.filter(id => id !== layerId) : [...prev, layerId];
    });

    // When a data layer is turned on from the Sidebar, immediately fetch data for current bounds
    if (!currentlyActive && (layerId === 'vessels' || layerId === 'aqi')) {
      void updateDataFromBackend();
    }

    // NEW: Load cyclones on-demand when the user turns the cyclones layer ON
    if (!currentlyActive && layerId === 'cyclones') {
      const bounds = map.current.getBounds();
      if (!bounds) return;
      const minLat = bounds.getSouth();
      const minLon = bounds.getWest();
      const maxLat = bounds.getNorth();
      const maxLon = bounds.getEast();

      void (async () => {
        const cyclones = await fetchCyclonesFromBackend(minLat, minLon, maxLat, maxLon);
        if (cyclones && map.current) {
          const src = map.current.getSource('cyclones') as maptilersdk.GeoJSONSource | undefined;
          if (src && typeof src.setData === 'function') {
            src.setData(cyclones);
            console.log(`🌀 Cyclones source updated with ${cyclones.features.length} features`);
          }
        }
      })();
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#0a1929' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {mapLoaded && (
        <>
          {/* Sidebar controls handle layer visibility — extra quick buttons removed */}

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

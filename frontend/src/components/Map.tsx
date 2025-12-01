import React, { useEffect, useRef, useState, FC, useCallback } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { MAPTILER_KEY, AQI_COLORS } from '../utils/constants';
import Sidebar from './Sidebar';
import Timeline from './Timeline';
import InfoPanel from './InfoPanel';
import type {
  GeoJSONProperties,
  GeoJSONFeatureCollection,
} from '../types';

const BACKEND_API_URL = 'http://localhost:8000';

// Unified fetch function - same approach for all data types
const fetchDataFromBackend = async (
  endpoint: string,
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

    const response = await fetch(`${BACKEND_API_URL}${endpoint}?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (!data || !Array.isArray(data.features)) {
      return { type: 'FeatureCollection', features: [] };
    }

    const layerName = endpoint.split('/').pop()?.toUpperCase() || 'DATA';
    console.log(`[${layerName}] Fetched ${data.features.length} items`);
    return data;
  } catch (error: any) {
    const layerName = endpoint.split('/').pop()?.toUpperCase() || 'DATA';
    console.error(`[${layerName}] Fetch error:`, error.message);
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
  const initialized = useRef<boolean>(false);
  const popup = useRef<maptilersdk.Popup | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unified data update function - same approach for vessels, AQI, and waves
  const updateDataFromBackend = useCallback(async (): Promise<void> => {
    if (!map.current) return;

    const bounds = map.current.getBounds();
    if (!bounds) return;

    const minLat = bounds.getSouth();
    const minLon = bounds.getWest();
    const maxLat = bounds.getNorth();
    const maxLon = bounds.getEast();

    const currentActiveLayers = activeLayersRef.current;

    console.log(`[MAP] Updating data for bbox: [${minLat.toFixed(2)}, ${minLon.toFixed(2)}] to [${maxLat.toFixed(2)}, ${maxLon.toFixed(2)}]`);

    // Build fetch requests for all active data layers
    const dataRequests: Array<{ endpoint: string; sourceId: string }> = [];

    if (currentActiveLayers.includes('vessels')) {
      dataRequests.push({ endpoint: '/api/vessels', sourceId: 'vessels' });
    }
    if (currentActiveLayers.includes('aqi')) {
      dataRequests.push({ endpoint: '/api/aqi', sourceId: 'aqi' });
    }
    if (currentActiveLayers.includes('waves')) {
      dataRequests.push({ endpoint: '/api/waves', sourceId: 'waves' });
    }

    if (dataRequests.length === 0) {
      console.log('[MAP] No active data layers to fetch');
      return;
    }

    // Fetch and update all layers in parallel - unified approach
    dataRequests.forEach(({ endpoint, sourceId }) => {
      fetchDataFromBackend(endpoint, minLat, minLon, maxLat, maxLon)
        .then((data) => {
          if (!map.current || !data) return;

          const source = map.current.getSource(sourceId) as maptilersdk.GeoJSONSource | undefined;
          if (source) {
            try {
              source.setData(data);
              console.log(`[${sourceId.toUpperCase()}] Updated: ${data.features?.length || 0} features`);
            } catch (error) {
              console.error(`[${sourceId.toUpperCase()}] Update error:`, error);
            }
          }
        })
        .catch((error) => {
          console.error(`[${sourceId.toUpperCase()}] Fetch failed:`, error);
        });
    });
  }, []);

  useEffect(() => {
    if (initialized.current || map.current) return;

    initialized.current = true;
    maptilersdk.config.apiKey = MAPTILER_KEY;

    console.log('[MAP] Initializing...');

    map.current = new maptilersdk.Map({
      container: mapContainer.current!,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
      center: [30.0, 30.0],
      zoom: 3,
      attributionControl: false
    });

    map.current.addControl(new maptilersdk.ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.current.addControl(new maptilersdk.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      console.log('[MAP] Loaded, initializing layers...');
      initializeLayers();
      setupInteractions();

      // Initial data fetch after map loads
      setTimeout(() => {
        console.log('[MAP] Fetching initial data...');
        void updateDataFromBackend();
      }, 500);

      // Debounced updates on map movement
      const handleMapMove = () => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(() => {
          const currentActiveLayers = activeLayersRef.current;
          if (currentActiveLayers.includes('vessels') || 
              currentActiveLayers.includes('aqi') || 
              currentActiveLayers.includes('waves')) {
            console.log('[MAP] Map moved, refreshing data...');
            updateDataFromBackend();
          }
        }, 800);
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
    // 1. VESSELS LAYER - Enhanced with better clustering
    map.current!.addSource('vessels', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    } as any);

    // Cluster circles with gradient effect
    map.current!.addLayer({
      id: 'vessels-clusters',
      type: 'circle',
      source: 'vessels',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#3498db', 10,
          '#2ecc71', 50,
          '#f39c12', 100,
          '#e74c3c', 500,
          '#9b59b6'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18, 10,
          24, 50,
          30, 100,
          38, 500,
          46
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      },
      layout: { 'visibility': 'none' }
    } as any);

    // Cluster count with better styling
    map.current!.addLayer({
      id: 'vessels-cluster-count',
      type: 'symbol',
      source: 'vessels',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 14,
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 2
      }
    } as any);

    // Individual vessels with icons
    map.current!.addLayer({
      id: 'vessels-unclustered',
      type: 'circle',
      source: 'vessels',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 8,
        'circle-color': '#3498db',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.95
      },
      layout: { 'visibility': 'none' }
    } as any);

    // Vessel direction indicator (optional - add if you have bearing data)
    map.current!.addLayer({
      id: 'vessels-direction',
      type: 'symbol',
      source: 'vessels',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'marker-15',
        'icon-size': 0.8,
        'icon-rotate': ['get', 'course'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'visibility': 'none'
      }
    } as any);

    // 2. AQI LAYER - RECTANGULAR BADGES (like reference images)
    map.current!.addSource('aqi', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // AQI rectangular background
    map.current!.addLayer({
      id: 'aqi-rectangles',
      type: 'symbol',
      source: 'aqi',
      layout: {
        'icon-image': 'marker-15', // Will be replaced with rectangle
        'icon-size': 2.5,
        'icon-allow-overlap': true,
        'visibility': 'none'
      },
      paint: {
        'icon-opacity': 0.95
      }
    } as any);

    // AQI value text - BOLD and LARGE
    map.current!.addLayer({
      id: 'aqi-labels',
      type: 'symbol',
      source: 'aqi',
      layout: {
        'text-field': ['to-string', ['get', 'aqi']],
        'text-size': 18,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': [
          'step', ['get', 'aqi'],
          '#2ecc71', 50,
          '#f1c40f', 100,
          '#e67e22', 150,
          '#e74c3c', 200,
          '#8e44ad', 300,
          '#7d0505'
        ],
        'text-halo-width': 8,
        'text-halo-blur': 0
      }
    } as any);

    // AQI colored circles behind text
    map.current!.addLayer({
      id: 'aqi-circles',
      type: 'circle',
      source: 'aqi',
      paint: {
        'circle-radius': 22,
        'circle-color': [
          'step', ['get', 'aqi'],
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
      layout: { 'visibility': 'none' }
    } as any);

    // 3. WAVES LAYER - Pinpoint markers with wave height
    map.current!.addSource('waves', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // Wave heatmap background
    map.current!.addLayer({
      id: 'waves-heatmap',
      type: 'heatmap',
      source: 'waves',
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'wave_height'], 0, 0, 6, 1],
        'heatmap-intensity': 0.8,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(33, 102, 172, 0)',
          0.2, 'rgb(103, 169, 207)',
          0.4, 'rgb(209, 229, 240)',
          0.6, 'rgb(253, 219, 199)',
          0.8, 'rgb(239, 138, 98)',
          1, 'rgb(178, 24, 43)'
        ],
        'heatmap-radius': 40,
        'heatmap-opacity': 0.6
      },
      layout: { 'visibility': 'none' }
    } as any);

    // Wave pinpoint markers
    map.current!.addLayer({
      id: 'waves-points',
      type: 'circle',
      source: 'waves',
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'step', ['get', 'wave_height'],
          '#2ecc71', 1,
          '#3498db', 2,
          '#f1c40f', 3,
          '#e67e22', 4,
          '#e74c3c', 5,
          '#c0392b'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      },
      layout: { 'visibility': 'none' }
    } as any);

    // Wave height labels
    map.current!.addLayer({
      id: 'waves-labels',
      type: 'symbol',
      source: 'waves',
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'wave_height']], 'm'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'visibility': 'none'
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#0077be',
        'text-halo-width': 2
      }
    } as any);

    // 4. WEATHER LAYERS - OpenWeatherMap tiles
    const owmKey = (import.meta as any).env.VITE_OPENWEATHER_KEY || 'demo';
    const weatherLayers = [
      { id: 'wind-layer', url: 'wind_new', opacity: 0.6 },
      { id: 'precipitation-layer', url: 'precipitation_new', opacity: 0.7 },
      { id: 'temperature-layer', url: 'temp_new', opacity: 0.6 },
      { id: 'pressure-layer', url: 'pressure_new', opacity: 0.5 },
      { id: 'humidity-layer', url: 'clouds_new', opacity: 0.6 },
      { id: 'radar-layer', url: 'precipitation_new', opacity: 0.8 }
    ];

    weatherLayers.forEach(layer => {
      map.current!.addSource(`${layer.id}-tiles`, {
        type: 'raster',
        tiles: [`https://tile.openweathermap.org/map/${layer.url}/{z}/{x}/{y}.png?appid=${owmKey}`],
        tileSize: 256
      });

      map.current!.addLayer({
        id: layer.id,
        type: 'raster',
        source: `${layer.id}-tiles`,
        paint: { 'raster-opacity': layer.opacity },
        layout: { 'visibility': 'none' }
      } as any);
    });

    console.log('[MAP] All layers initialized');
  };

  const setupInteractions = (): void => {
    // Vessel hover
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

    // Vessel click - Enhanced elegant popup
    map.current!.on('click', 'vessels-unclustered', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      const speed = props.speed || 0;
      const getSpeedStatus = () => {
        if (speed === 0) return { text: 'Stationary', color: '#95a5a6', emoji: '⚓' };
        if (speed < 5) return { text: 'Slow', color: '#3498db', emoji: '🐌' };
        if (speed < 15) return { text: 'Moderate', color: '#2ecc71', emoji: '⛵' };
        if (speed < 25) return { text: 'Fast', color: '#f39c12', emoji: '🚤' };
        return { text: 'Very Fast', color: '#e74c3c', emoji: '🚀' };
      };

      const speedStatus = getSpeedStatus();

      popup.current = new maptilersdk.Popup({ offset: 25 })
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 16px; min-width: 280px; background: linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%); border-radius: 14px; border: 2px solid #3498db;">
            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">
              <div style="font-size: 36px;">${speedStatus.emoji}</div>
              <div>
                <h3 style="margin: 0; font-size: 17px; color: white; font-weight: bold;">
                  🚢 Vessel MMSI: ${props.mmsi || 'Unknown'}
                </h3>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Maritime vessel tracking</p>
              </div>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 22px; font-weight: bold; color: ${speedStatus.color};">${speed.toFixed(1)}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Speed (knots)</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 22px; font-weight: bold; color: #9b59b6;">${props.course || 0}°</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Course</div>
              </div>
            </div>

            <!-- Position Info -->
            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <div style="color: #cbd5e1; font-size: 12px; font-weight: 600; margin-bottom: 8px;">POSITION</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <div style="color: #94a3b8; font-size: 10px;">LATITUDE</div>
                  <div style="color: white; font-size: 14px; font-weight: 600; font-family: monospace;">${props.lat?.toFixed(4) || 'N/A'}°</div>
                </div>
                <div>
                  <div style="color: #94a3b8; font-size: 10px;">LONGITUDE</div>
                  <div style="color: white; font-size: 14px; font-weight: 600; font-family: monospace;">${props.lon?.toFixed(4) || 'N/A'}°</div>
                </div>
              </div>
            </div>

            <!-- Status Banner -->
            <div style="background: linear-gradient(90deg, ${speedStatus.color}20, ${speedStatus.color}40); border-left: 4px solid ${speedStatus.color}; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="color: #cbd5e1; font-size: 12px; font-weight: 600;">STATUS</span>
                <span style="color: ${speedStatus.color}; font-size: 14px; font-weight: bold;">${speedStatus.text}</span>
              </div>
            </div>

            <!-- Footer -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
              <span style="color: #64748b; font-size: 10px;">🕐 ${props.last_updated ? new Date(props.last_updated).toLocaleTimeString() : 'N/A'}</span>
              <span style="background: rgba(34,197,94,0.2); color: #22c55e; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">● AIS</span>
            </div>
          </div>
        `)
        .addTo(map.current!);
    });

    // Vessel cluster zoom
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

    // AQI click - Enhanced popup
    map.current!.on('click', 'aqi-circles', (e: maptilersdk.MapLayerMouseEvent) => {
      const feature = e.features![0];
      const coordinates = (feature.geometry as any).coordinates as [number, number];
      const props = feature.properties;

      if (popup.current) popup.current.remove();

      const getAQIStatus = (aqi: number) => {
        if (aqi <= 50) return { text: 'Good', color: AQI_COLORS.GOOD, emoji: '😊', description: 'Air quality is satisfactory' };
        if (aqi <= 100) return { text: 'Moderate', color: AQI_COLORS.MODERATE, emoji: '😐', description: 'Acceptable for most people' };
        if (aqi <= 150) return { text: 'Unhealthy for Sensitive Groups', color: AQI_COLORS.USG, emoji: '😷', description: 'May affect sensitive individuals' };
        if (aqi <= 200) return { text: 'Unhealthy', color: AQI_COLORS.UNHEALTHY, emoji: '😨', description: 'Everyone may experience health effects' };
        if (aqi <= 300) return { text: 'Very Unhealthy', color: AQI_COLORS.VERY_UNHEALTHY, emoji: '🤢', description: 'Health alert: everyone may be affected' };
        return { text: 'Hazardous', color: AQI_COLORS.HAZARDOUS, emoji: '☠️', description: 'Health warnings of emergency conditions' };
      };

      const status = getAQIStatus(props.aqi);

      popup.current = new maptilersdk.Popup({ offset: 25 })
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 14px; min-width: 260px; background: linear-gradient(135deg, #1e3a5f 0%, #0a1929 100%); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid ${status.color};">
              <div style="font-size: 32px;">${status.emoji}</div>
              <div>
                <h3 style="margin: 0; font-size: 16px; color: white; font-weight: bold;">
                  ${props.name || 'AQI Station'}
                </h3>
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">Air Quality Index</p>
              </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #94a3b8; font-size: 13px;">AQI Value</span>
                <span style="font-size: 28px; font-weight: bold; color: ${status.color};">${props.aqi}</span>
              </div>
              <div style="height: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min((props.aqi / 500) * 100, 100)}%; background: ${status.color}; transition: width 0.3s;"></div>
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <div style="width: 12px; height: 12px; background: ${status.color}; border-radius: 50%;"></div>
                <span style="color: ${status.color}; font-weight: bold; font-size: 14px;">${status.text}</span>
              </div>
              <p style="margin: 0; color: #cbd5e1; font-size: 12px; line-height: 1.5;">${status.description}</p>
            </div>

            <div style="color: #64748b; font-size: 11px; text-align: center;">
              📍 ${coordinates[1].toFixed(4)}°, ${coordinates[0].toFixed(4)}°<br/>
              🕐 ${props.last_updated || 'Real-time'}
            </div>
          </div>
        `)
        .addTo(map.current!);
    });

    // Ocean wave analysis - Enhanced with pinpoint visual
    map.current!.on('click', (e: maptilersdk.MapMouseEvent) => {
      const features = map.current!.queryRenderedFeatures(e.point);
      const clickedOnFeature = features.some(f => 
        ['vessels-unclustered', 'vessels-clusters', 'aqi-circles'].includes(f.layer.id)
      );

      if (clickedOnFeature) return;

      const { lng, lat } = e.lngLat;

      console.log(`[WAVE-POINT] Analyzing ocean at: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

      // Show loading popup
      if (popup.current) popup.current.remove();
      popup.current = new maptilersdk.Popup({ offset: 25, closeButton: false })
        .setLngLat([lng, lat])
        .setHTML(`
          <div style="padding: 20px; text-align: center; background: linear-gradient(135deg, #0077be 0%, #004d7a 100%); border-radius: 12px; min-width: 200px;">
            <div style="width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; margin: 0 auto 12px; animation: spin 1s linear infinite;"></div>
            <p style="margin: 0; color: white; font-size: 14px; font-weight: 600;">Analyzing Ocean...</p>
            <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.7); font-size: 11px;">Fetching wave data</p>
            <style>
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </div>
        `)
        .addTo(map.current!);

      fetch(`${BACKEND_API_URL}/api/wave-point?lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
          if (popup.current) popup.current.remove();

          const getConditionData = (condition: string) => {
            const data: Record<string, { color: string; emoji: string; advice: string }> = {
              'Calm': { color: '#2ecc71', emoji: '😌', advice: 'Perfect for all water activities' },
              'Smooth': { color: '#3498db', emoji: '🌊', advice: 'Good conditions for sailing' },
              'Slight': { color: '#f1c40f', emoji: '⚠️', advice: 'Suitable for experienced sailors' },
              'Moderate': { color: '#e67e22', emoji: '🚨', advice: 'Caution advised for small vessels' },
              'Rough': { color: '#e74c3c', emoji: '⛔', advice: 'Not recommended for small boats' },
              'Very Rough': { color: '#c0392b', emoji: '🔴', advice: 'Dangerous - avoid navigation' },
              'High': { color: '#8e44ad', emoji: '☠️', advice: 'Extreme danger - port closed' }
            };
            return data[condition] || { color: '#95a5a6', emoji: '❓', advice: 'Unknown conditions' };
          };

          const conditionData = getConditionData(data.condition);

          popup.current = new maptilersdk.Popup({ offset: 25 })
            .setLngLat([lng, lat])
            .setHTML(`
              <div style="padding: 16px; min-width: 280px; background: linear-gradient(135deg, #0a1929 0%, #0c2340 100%); border-radius: 14px; border: 2px solid ${conditionData.color};">
                <!-- Header -->
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid rgba(255,255,255,0.1);">
                  <div style="font-size: 36px;">${conditionData.emoji}</div>
                  <div>
                    <h3 style="margin: 0; font-size: 17px; color: white; font-weight: bold;">
                      🌊 Ocean Wave Analysis
                    </h3>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Real-time maritime data</p>
                  </div>
                </div>

                <!-- Main Stats Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                  <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 22px; font-weight: bold; color: ${conditionData.color};">${data.wave_height || 'N/A'}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Wave Height (m)</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 22px; font-weight: bold; color: #3498db;">${data.wave_direction || 'N/A'}°</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Direction</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 22px; font-weight: bold; color: #9b59b6;">${data.wave_period || 'N/A'}s</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Wave Period</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="font-size: 22px; font-weight: bold; color: #1abc9c;">${data.swell_wave_height || 'N/A'}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Swell (m)</div>
                  </div>
                </div>

                <!-- Sea State Banner -->
                <div style="background: linear-gradient(90deg, ${conditionData.color}20, ${conditionData.color}40); border-left: 4px solid ${conditionData.color}; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #cbd5e1; font-size: 12px; font-weight: 600;">SEA STATE</span>
                    <span style="color: ${conditionData.color}; font-size: 16px; font-weight: bold;">${data.condition || 'Unknown'}</span>
                  </div>
                  <p style="margin: 0; color: #e2e8f0; font-size: 11px; line-height: 1.5;">
                    ${conditionData.advice}
                  </p>
                </div>

                <!-- Footer -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                  <span style="color: #64748b; font-size: 10px;">📍 ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</span>
                  <span style="background: rgba(34,197,94,0.2); color: #22c55e; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">● LIVE</span>
                </div>
              </div>
            `)
            .addTo(map.current!);

          console.log(`[WAVE-POINT] ${data.condition} conditions (${data.wave_height}m wave height)`);
        })
        .catch(error => {
          console.error('[WAVE-POINT] Error:', error);
          if (popup.current) popup.current.remove();
          popup.current = new maptilersdk.Popup({ offset: 25 })
            .setLngLat([lng, lat])
            .setHTML(`
              <div style="padding: 16px; background: #e74c3c; border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
                <p style="margin: 0; font-weight: 600;">Unable to fetch wave data</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Please try again</p>
              </div>
            `)
            .addTo(map.current!);
        });
    });
  };

  const handleLayerToggle = (layerId: string): void => {
    if (!map.current) return;

    console.log(`[LAYER] Toggle: ${layerId}`);

    if (layerId === 'satellite') {
      setActiveLayers(prev => {
        const newActiveLayers = prev.includes(layerId) ? prev : [...prev, layerId];
        activeLayersRef.current = newActiveLayers;
        return newActiveLayers;
      });
      return;
    }

    const layerMap: Record<string, string[]> = {
      'vessels': ['vessels-clusters', 'vessels-cluster-count', 'vessels-unclustered', 'vessels-direction'],
      'aqi': ['aqi-circles', 'aqi-labels'],
      'waves': ['waves-heatmap', 'waves-points', 'waves-labels'],
      'wind': ['wind-layer'],
      'precipitation': ['precipitation-layer'],
      'temperature': ['temperature-layer'],
      'pressure': ['pressure-layer'],
      'humidity': ['humidity-layer'],
      'radar': ['radar-layer']
    };

    const layers = layerMap[layerId];
    if (!layers) return;

    const currentlyActive = activeLayers.includes(layerId);

    setActiveLayers(prev => {
      const isActive = prev.includes(layerId);
      const newVisibility = isActive ? 'none' : 'visible';

      layers.forEach(layer => {
        try {
          if (map.current && map.current.getLayer(layer)) {
            map.current.setLayoutProperty(layer, 'visibility', newVisibility as 'visible' | 'none');
            console.log(`[LAYER] ${layer}: ${newVisibility}`);
          }
        } catch (error) {
          console.error(`[LAYER] Toggle error (${layer}):`, error);
        }
      });

      const newActiveLayers = isActive ? prev.filter(id => id !== layerId) : [...prev, layerId];
      activeLayersRef.current = newActiveLayers;
      return newActiveLayers;
    });

    // Fetch data immediately when layer is enabled
    if (!currentlyActive && (layerId === 'vessels' || layerId === 'aqi' || layerId === 'waves')) {
      console.log(`[LAYER] ${layerId} enabled - fetching data...`);
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
          <Timeline onTimeChange={(time: any) => console.log('[TIMELINE] Time changed:', time)} />
          <InfoPanel data={hoveredFeature} position={map.current?.getCenter()} />
        </>
      )}
    </div>
  );
}

export default Map;
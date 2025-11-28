import type {
  VesselData,
  CycloneData,
  CycloneTrackData,
  WaveData,
  AQIData,
  VesselProperties,
  CycloneProperties,
  WaveProperties,
  AQIProperties,
} from '../types';

/**
 * Process and validate vessel data
 */
export function processVesselData(rawData: VesselData): VesselData {
  if (!rawData.features || !Array.isArray(rawData.features)) {
    console.warn('⚠️ Invalid vessel data structure');
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: rawData.features.filter(
      (feature) =>
        feature.geometry?.type === 'Point' &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length === 2
    ),
  };
}

/**
 * Process and validate cyclone data
 */
export function processCycloneData(rawData: CycloneData): CycloneData {
  if (!rawData.features || !Array.isArray(rawData.features)) {
    console.warn('⚠️ Invalid cyclone data structure');
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: rawData.features.filter(
      (feature) =>
        feature.geometry?.type === 'Point' &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length === 2
    ),
  };
}

/**
 * Process and validate cyclone track data
 */
export function processCycloneTrackData(rawData: CycloneTrackData): CycloneTrackData {
  if (!rawData.features || !Array.isArray(rawData.features)) {
    console.warn('⚠️ Invalid cyclone track data structure');
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: rawData.features.filter(
      (feature) =>
        feature.geometry?.type === 'LineString' &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length >= 2
    ),
  };
}

/**
 * Process and validate wave data
 */
export function processWaveData(rawData: WaveData): WaveData {
  if (!rawData.features || !Array.isArray(rawData.features)) {
    console.warn('⚠️ Invalid wave data structure');
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: rawData.features.filter(
      (feature) =>
        feature.geometry?.type === 'Point' &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length === 2 &&
        typeof (feature.properties?.wave_height as number) === 'number'
    ),
  };
}

/**
 * Process and validate AQI data
 */
export function processAQIData(rawData: AQIData): AQIData {
  if (!rawData.features || !Array.isArray(rawData.features)) {
    console.warn('⚠️ Invalid AQI data structure');
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: rawData.features.filter(
      (feature) =>
        feature.geometry?.type === 'Point' &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length === 2 &&
        typeof (feature.properties?.aqi as number) === 'number'
    ),
  };
}

/**
 * Enrich vessel properties with calculated fields
 */
export function enrichVesselProperties(props: VesselProperties): VesselProperties {
  return {
    ...props,
    speed: Math.round((props.speed as number) * 100) / 100,
  };
}

/**
 * Enrich cyclone properties with calculated fields
 */
export function enrichCycloneProperties(props: CycloneProperties): CycloneProperties {
  return {
    ...props,
    wind_speed: Math.round((props.wind_speed as number) * 10) / 10,
    pressure: Math.round((props.pressure as number) * 10) / 10,
  };
}

/**
 * Enrich wave properties with calculated fields
 */
export function enrichWaveProperties(props: WaveProperties): WaveProperties {
  return {
    ...props,
    wave_height: Math.round((props.wave_height as number) * 100) / 100,
  };
}

/**
 * Enrich AQI properties with calculated fields
 */
export function enrichAQIProperties(props: AQIProperties): AQIProperties {
  return {
    ...props,
    pm25: Math.round((props.pm25 as number) * 10) / 10,
  };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number]
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest vessels to a coordinate
 */
export function findNearestVessels(
  coordinate: [number, number],
  vessels: VesselData,
  maxDistance: number = 500 // km
): VesselData {
  const nearbyFeatures = vessels.features.filter((feature) => {
    const distance = calculateDistance(
      coordinate,
      feature.geometry.coordinates
    );
    return distance <= maxDistance;
  });

  return {
    type: 'FeatureCollection',
    features: nearbyFeatures,
  };
}

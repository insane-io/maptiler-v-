import axios, { AxiosResponse } from 'axios';

import type { AQIApiResponse, WeatherApiResponse } from '../types';
import { OPENWEATHER_KEY, WAQI_TOKEN } from '../utils/constants';

/**
 * Fetch current weather data from OpenWeatherMap API
 */
export async function fetchWeatherData(
  lat: number,
  lon: number
): Promise<WeatherApiResponse> {
  try {
    const response: AxiosResponse<WeatherApiResponse> = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          lat,
          lon,
          appid: OPENWEATHER_KEY,
          units: 'metric',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Weather API Error:', error);
    throw new Error('Failed to fetch weather data');
  }
}

/**
 * Fetch air quality index data from WAQI API
 */
export async function fetchAQIData(
  lat: number,
  lon: number
): Promise<AQIApiResponse> {
  try {
    const response: AxiosResponse<AQIApiResponse> = await axios.get(
      `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI_TOKEN}`
    );
    return response.data;
  } catch (error) {
    console.error('❌ AQI API Error:', error);
    throw new Error('Failed to fetch AQI data');
  }
}

/**
 * Batch fetch weather data for multiple locations
 */
export async function fetchWeatherBatch(
  locations: Array<{ lat: number; lon: number }>
): Promise<WeatherApiResponse[]> {
  try {
    const promises = locations.map((loc) => fetchWeatherData(loc.lat, loc.lon));
    return await Promise.all(promises);
  } catch (error) {
    console.error('❌ Batch Weather Fetch Error:', error);
    throw error;
  }
}

/**
 * Batch fetch AQI data for multiple locations
 */
export async function fetchAQIBatch(
  locations: Array<{ lat: number; lon: number }>
): Promise<AQIApiResponse[]> {
  try {
    const promises = locations.map((loc) => fetchAQIData(loc.lat, loc.lon));
    return await Promise.all(promises);
  } catch (error) {
    console.error('❌ Batch AQI Fetch Error:', error);
    throw error;
  }
}

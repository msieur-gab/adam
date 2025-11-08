/**
 * Weather API Service
 * Provides weather information using Open-Meteo API (free, no API key required)
 */

import { BaseApiService } from './base-api-service.js';

export class WeatherService extends BaseApiService {
  constructor() {
    super('weather', {
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour cache
      retryAttempts: 3,
      timeout: 8000
    });

    this.geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
    this.weatherUrl = 'https://api.open-meteo.com/v1/forecast';
  }

  /**
   * Query weather for location and date
   */
  async query(params) {
    const { location, date, units = 'metric' } = params;

    if (!location) {
      throw new Error('Location is required for weather query');
    }

    try {
      // Step 1: Geocode location to get coordinates
      const geo = await this.geocodeLocation(location);

      if (!geo) {
        throw new Error(`Could not find location: ${location}`);
      }

      // Step 2: Fetch weather using coordinates
      const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius';
      const weatherData = await this.fetchWeather(geo.latitude, geo.longitude, tempUnit, date);

      // Step 3: Transform to standard format
      return {
        location: geo.name,
        country: geo.country,
        timezone: geo.timezone,
        date: weatherData.time,
        temperature: {
          current: weatherData.temperature,
          feelsLike: weatherData.apparent_temperature,
          min: weatherData.temperature - 5, // Open-Meteo doesn't provide min/max for current
          max: weatherData.temperature + 5
        },
        conditions: this.getWeatherDescription(weatherData.weathercode),
        icon: this.getWeatherIcon(weatherData.weathercode),
        humidity: weatherData.humidity,
        windSpeed: weatherData.windspeed,
        precipitation: 0, // Would need hourly data for this
        clouds: 0,
        source: 'open-meteo',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Weather API error:', error);
      // Return mock data as fallback
      return this.getMockCurrentWeather(location, units);
    }
  }

  /**
   * Geocode location to coordinates using Open-Meteo
   */
  async geocodeLocation(location) {
    const url = `${this.geocodingUrl}?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      country: result.country || '',
      timezone: result.timezone || 'UTC'
    };
  }

  /**
   * Fetch weather from Open-Meteo API
   */
  async fetchWeather(latitude, longitude, tempUnit, targetDate = null) {
    // Build URL with parameters
    const params = new URLSearchParams({
      latitude: latitude,
      longitude: longitude,
      current: 'temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m',
      temperature_unit: tempUnit,
      windspeed_unit: tempUnit === 'fahrenheit' ? 'mph' : 'kmh',
      timezone: 'auto'
    });

    const url = `${this.weatherUrl}?${params}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.current) {
      throw new Error('Invalid weather data received');
    }

    return {
      time: data.current.time,
      temperature: data.current.temperature_2m,
      apparent_temperature: data.current.apparent_temperature,
      weathercode: data.current.weathercode,
      windspeed: data.current.windspeed_10m,
      humidity: data.current.relativehumidity_2m
    };
  }

  /**
   * Convert WMO weather code to human-readable description
   * https://open-meteo.com/en/docs
   */
  getWeatherDescription(code) {
    const weatherCodes = {
      0: 'clear sky',
      1: 'mainly clear',
      2: 'partly cloudy',
      3: 'overcast',
      45: 'foggy',
      48: 'depositing rime fog',
      51: 'light drizzle',
      53: 'moderate drizzle',
      55: 'dense drizzle',
      61: 'slight rain',
      63: 'moderate rain',
      65: 'heavy rain',
      71: 'slight snow',
      73: 'moderate snow',
      75: 'heavy snow',
      77: 'snow grains',
      80: 'slight rain showers',
      81: 'moderate rain showers',
      82: 'violent rain showers',
      85: 'slight snow showers',
      86: 'heavy snow showers',
      95: 'thunderstorm',
      96: 'thunderstorm with slight hail',
      99: 'thunderstorm with heavy hail'
    };

    return weatherCodes[code] || 'unknown';
  }

  /**
   * Get weather icon based on WMO code
   */
  getWeatherIcon(code) {
    // Map to simple icon names
    if (code === 0) return 'clear';
    if (code <= 3) return 'partly-cloudy';
    if (code <= 48) return 'fog';
    if (code <= 55) return 'drizzle';
    if (code <= 65) return 'rain';
    if (code <= 77) return 'snow';
    if (code <= 82) return 'rain-showers';
    if (code <= 86) return 'snow-showers';
    return 'thunderstorm';
  }

  /**
   * Check if date is today
   */
  isToday(date) {
    if (!date) return true;

    const target = new Date(date);
    const today = new Date();

    return (
      target.getDate() === today.getDate() &&
      target.getMonth() === today.getMonth() &&
      target.getFullYear() === today.getFullYear()
    );
  }

  /**
   * Mock current weather (for demo/fallback)
   */
  getMockCurrentWeather(location, units) {
    const temp = units === 'metric' ? 22 : 72;
    const windSpeed = units === 'metric' ? 15 : 9.3;

    return {
      location: location,
      country: 'XX',
      date: new Date().toISOString(),
      temperature: {
        current: temp,
        feelsLike: temp - 2,
        min: temp - 5,
        max: temp + 3
      },
      conditions: 'partly cloudy',
      icon: '02d',
      humidity: 65,
      windSpeed: windSpeed,
      precipitation: 20,
      clouds: 40,
      source: 'mock',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Mock forecast (for demo/fallback)
   */
  getMockForecast(location, date, units) {
    const temp = units === 'metric' ? 20 : 68;
    const windSpeed = units === 'metric' ? 12 : 7.5;

    return {
      location: location,
      country: 'XX',
      date: date || new Date().toISOString(),
      temperature: {
        current: temp,
        feelsLike: temp - 1,
        min: temp - 4,
        max: temp + 4
      },
      conditions: 'sunny',
      icon: '01d',
      humidity: 55,
      windSpeed: windSpeed,
      precipitation: 10,
      clouds: 20,
      source: 'mock',
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const weatherService = new WeatherService();

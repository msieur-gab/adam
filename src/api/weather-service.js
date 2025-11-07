/**
 * Weather API Service
 * Provides weather information using OpenWeatherMap API
 */

import { BaseApiService } from './base-api-service.js';

export class WeatherService extends BaseApiService {
  constructor(apiKey = null) {
    super('weather', {
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour cache
      retryAttempts: 3,
      timeout: 8000
    });

    this.apiKey = apiKey || this.getDefaultApiKey();
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  /**
   * Get default demo API key (limited calls)
   * Users should provide their own key for production
   */
  getDefaultApiKey() {
    // This is a demo key - users should get their own from openweathermap.org
    return 'DEMO_KEY_REPLACE_WITH_REAL_KEY';
  }

  /**
   * Query weather for location and date
   */
  async query(params) {
    const { location, date, units = 'metric' } = params;

    if (!location) {
      throw new Error('Location is required for weather query');
    }

    // Determine if we need current weather or forecast
    const isToday = this.isToday(date);

    if (isToday) {
      return await this.getCurrentWeather(location, units);
    } else {
      return await this.getForecast(location, date, units);
    }
  }

  /**
   * Get current weather
   */
  async getCurrentWeather(location, units = 'metric') {
    const endpoint = `${this.baseUrl}/weather`;
    const params = new URLSearchParams({
      q: location,
      units: units,
      appid: this.apiKey
    });

    try {
      const response = await this.request(`${endpoint}?${params}`, {
        params: { location, type: 'current' }
      });
      return response;
    } catch (error) {
      // Return mock data if API fails (for demo purposes)
      console.warn('Weather API failed, using mock data');
      return this.getMockCurrentWeather(location, units);
    }
  }

  /**
   * Get weather forecast
   */
  async getForecast(location, date, units = 'metric') {
    const endpoint = `${this.baseUrl}/forecast`;
    const params = new URLSearchParams({
      q: location,
      units: units,
      appid: this.apiKey
    });

    try {
      const response = await this.request(`${endpoint}?${params}`, {
        params: { location, type: 'forecast' }
      });

      // Find forecast for specific date
      const targetForecast = this.findForecastForDate(response, date);
      return targetForecast;

    } catch (error) {
      // Return mock data if API fails
      console.warn('Weather API failed, using mock data');
      return this.getMockForecast(location, date, units);
    }
  }

  /**
   * Transform API response to standard format
   */
  async transform(response) {
    // Check if it's current weather or forecast
    if (response.list) {
      // Forecast response - transform first item
      const forecast = response.list[0];
      return {
        location: response.city.name,
        country: response.city.country,
        date: new Date(forecast.dt * 1000).toISOString(),
        temperature: {
          current: forecast.main.temp,
          feelsLike: forecast.main.feels_like,
          min: forecast.main.temp_min,
          max: forecast.main.temp_max
        },
        conditions: forecast.weather[0].description,
        icon: forecast.weather[0].icon,
        humidity: forecast.main.humidity,
        windSpeed: forecast.wind.speed,
        precipitation: forecast.pop ? forecast.pop * 100 : 0,
        clouds: forecast.clouds.all,
        source: 'openweathermap',
        timestamp: new Date().toISOString()
      };
    } else {
      // Current weather response
      return {
        location: response.name,
        country: response.sys.country,
        date: new Date(response.dt * 1000).toISOString(),
        temperature: {
          current: response.main.temp,
          feelsLike: response.main.feels_like,
          min: response.main.temp_min,
          max: response.main.temp_max
        },
        conditions: response.weather[0].description,
        icon: response.weather[0].icon,
        humidity: response.main.humidity,
        windSpeed: response.wind.speed,
        precipitation: response.rain ? response.rain['1h'] || 0 : 0,
        clouds: response.clouds.all,
        source: 'openweathermap',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Find forecast for specific date
   */
  findForecastForDate(forecastResponse, targetDate) {
    if (!targetDate || !forecastResponse.list) {
      return forecastResponse.list[0]; // Return first forecast
    }

    const target = new Date(targetDate);
    target.setHours(12, 0, 0, 0); // Noon

    // Find closest forecast to target date
    let closest = forecastResponse.list[0];
    let closestDiff = Math.abs(new Date(closest.dt * 1000) - target);

    for (const forecast of forecastResponse.list) {
      const forecastDate = new Date(forecast.dt * 1000);
      const diff = Math.abs(forecastDate - target);

      if (diff < closestDiff) {
        closest = forecast;
        closestDiff = diff;
      }
    }

    return {
      ...forecastResponse,
      list: [closest]
    };
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

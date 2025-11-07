/**
 * Base API Service
 * Provides common functionality for all API services
 */

import { db } from '../services/db-service.js';

export class BaseApiService {
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? 3600000, // 1 hour default
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      timeout: config.timeout ?? 10000,
      ...config
    };
  }

  /**
   * Make API request with caching, retry logic, and error handling
   */
  async request(endpoint, options = {}) {
    const cacheKey = this.getCacheKey(endpoint, options);

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = await this.getCache(cacheKey);
      if (cached && !this.isCacheStale(cached)) {
        console.log(`[${this.name}] Cache hit: ${cacheKey}`);
        return cached.data;
      }
    }

    // Make API request with retry logic
    let lastError = null;
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await this.makeRequest(endpoint, options);
        const data = await this.transform(response);

        // Cache successful response
        if (this.config.cacheEnabled) {
          await this.setCache(cacheKey, data);
        }

        return data;

      } catch (error) {
        lastError = error;
        console.warn(`[${this.name}] Request failed (attempt ${attempt + 1}):`, error);

        // Wait before retry (exponential backoff)
        if (attempt < this.config.retryAttempts - 1) {
          await this.sleep(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // All retries failed - check cache for stale data as fallback
    if (this.config.cacheEnabled) {
      const staleCache = await this.getCache(cacheKey);
      if (staleCache) {
        console.warn(`[${this.name}] Using stale cache due to API failure`);
        return staleCache.data;
      }
    }

    throw new ApiError(`${this.name} request failed after ${this.config.retryAttempts} attempts`, lastError);
  }

  /**
   * Make the actual HTTP request
   */
  async makeRequest(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(endpoint, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Transform API response to standard format
   * Override in subclasses
   */
  async transform(response) {
    return response;
  }

  /**
   * Get cache key for request
   */
  getCacheKey(endpoint, options = {}) {
    const params = JSON.stringify(options.params || {});
    return `api:${this.name}:${endpoint}:${params}`;
  }

  /**
   * Get cached data
   */
  async getCache(key) {
    try {
      const cached = await db.apiCache.get(key);
      return cached || null;
    } catch (error) {
      console.warn(`[${this.name}] Cache read failed:`, error);
      return null;
    }
  }

  /**
   * Set cache data
   */
  async setCache(key, data) {
    try {
      await db.apiCache.put({
        key,
        data,
        timestamp: Date.now(),
        ttl: this.config.cacheTTL
      });
    } catch (error) {
      console.warn(`[${this.name}] Cache write failed:`, error);
    }
  }

  /**
   * Check if cache is stale
   */
  isCacheStale(cached) {
    const age = Date.now() - cached.timestamp;
    return age > cached.ttl;
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format error for user-friendly message
   */
  formatError(error) {
    if (error.name === 'AbortError') {
      return 'Request timed out. Please try again.';
    }
    if (error.message.includes('NetworkError')) {
      return 'Network error. Please check your connection.';
    }
    return 'Service temporarily unavailable. Please try again later.';
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'ApiError';
    this.originalError = originalError;
  }
}

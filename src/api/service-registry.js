/**
 * Service Registry
 * Central registry for all API services
 * Routes intent requests to appropriate services
 */

import { weatherService } from './weather-service.js';

export class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.intentServiceMap = new Map();
    this.initialize();
  }

  /**
   * Initialize services and intent mappings
   */
  initialize() {
    // Register services
    this.registerService('weather', weatherService);

    // Map intents to services
    this.mapIntentToService('weather_query', 'weather');

    console.log('[ServiceRegistry] Initialized with services:', Array.from(this.services.keys()));
  }

  /**
   * Register a service
   */
  registerService(name, service) {
    this.services.set(name, service);
  }

  /**
   * Map an intent to a service
   */
  mapIntentToService(intent, serviceName) {
    this.intentServiceMap.set(intent, serviceName);
  }

  /**
   * Get service by name
   */
  getService(name) {
    return this.services.get(name);
  }

  /**
   * Get service for intent
   */
  getServiceForIntent(intent) {
    const serviceName = this.intentServiceMap.get(intent);
    return serviceName ? this.services.get(serviceName) : null;
  }

  /**
   * Execute service query based on intent and slots
   */
  async executeIntent(intent, slots, userProfile = null) {
    const service = this.getServiceForIntent(intent);

    if (!service) {
      console.warn(`[ServiceRegistry] No service found for intent: ${intent}`);
      return null;
    }

    try {
      // Enrich slots with user profile data if needed
      const enrichedSlots = this.enrichSlots(slots, userProfile);

      // Execute service query
      const result = await service.query(enrichedSlots);

      return {
        success: true,
        data: result,
        service: service.name,
        intent: intent
      };

    } catch (error) {
      console.error(`[ServiceRegistry] Service execution failed:`, error);

      return {
        success: false,
        error: error.message,
        service: service.name,
        intent: intent
      };
    }
  }

  /**
   * Enrich slots with user profile data
   */
  enrichSlots(slots, userProfile) {
    if (!userProfile) return slots;

    const enriched = { ...slots };

    // Auto-fill location if not provided
    if (!enriched.location && userProfile.location?.city) {
      enriched.location = userProfile.location.city;
    }

    // Auto-fill timezone
    if (!enriched.timezone && userProfile.location?.timezone) {
      enriched.timezone = userProfile.location.timezone;
    }

    // Auto-fill units based on preferences
    if (!enriched.units && userProfile.preferences?.temperatureUnit) {
      enriched.units = userProfile.preferences.temperatureUnit === 'celsius' ? 'metric' : 'imperial';
    }

    return enriched;
  }

  /**
   * Check if service is available for intent
   */
  hasServiceForIntent(intent) {
    return this.intentServiceMap.has(intent) &&
           this.services.has(this.intentServiceMap.get(intent));
  }

  /**
   * List all registered services
   */
  listServices() {
    return Array.from(this.services.keys());
  }

  /**
   * List all intent mappings
   */
  listIntentMappings() {
    return Array.from(this.intentServiceMap.entries()).map(([intent, service]) => ({
      intent,
      service
    }));
  }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistry();

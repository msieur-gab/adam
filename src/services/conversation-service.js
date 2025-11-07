/**
 * Conversation Service for ADAM
 * Rule-based system with intent recognition, i18n support, and natural response generation
 */

import { getProfile, saveProfile } from './db-service.js';

/**
 * Intent definitions with synonyms and taxonomy
 */
const INTENTS = {
  // Medication-related queries
  medication: {
    patterns: [
      'medication', 'medicine', 'pill', 'pills', 'tablet', 'tablets',
      'drug', 'drugs', 'prescription', 'prescriptions',
      'meds', 'take', 'dose', 'dosage'
    ],
    triggers: ['what', 'when', 'time', 'next', 'my', 'should i', 'do i need', 'any', 'plan', 'schedule', 'upcoming']
  },

  // Family-related queries
  family: {
    patterns: [
      'family', 'daughter', 'son', 'child', 'children', 'grandchild',
      'grandson', 'granddaughter', 'husband', 'wife', 'spouse',
      'brother', 'sister', 'relative', 'relatives', 'kids'
    ],
    triggers: ['who', 'tell me about', 'my', 'about']
  },

  // Doctor/appointment queries
  doctor: {
    patterns: [
      'doctor', 'doctors', 'physician', 'appointment', 'appointments',
      'visit', 'checkup', 'check-up', 'medical', 'clinic', 'hospital'
    ],
    triggers: ['who', 'when', 'my', 'next', 'upcoming', 'scheduled']
  },

  // Hydration reminders
  hydration: {
    patterns: [
      'water', 'drink', 'thirst', 'thirsty', 'hydrate', 'hydration',
      'beverage', 'fluid', 'fluids'
    ],
    triggers: ['need', 'should i', 'remind', 'more']
  },

  // Activities and interests
  activities: {
    patterns: [
      'activity', 'activities', 'hobby', 'hobbies', 'interest', 'interests',
      'do', 'enjoy', 'like', 'love', 'fun', 'entertainment'
    ],
    triggers: ['what', 'tell me', 'my', 'remind me']
  },

  // Greetings
  greeting: {
    patterns: [
      'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
      'howdy', 'greetings', 'morning', 'afternoon', 'evening'
    ],
    triggers: null // Greetings don't need triggers
  },

  // Farewells
  farewell: {
    patterns: [
      'goodbye', 'bye', 'see you', 'talk later', 'goodnight', 'good night',
      'farewell', 'later', 'gotta go', 'have to go'
    ],
    triggers: null
  },

  // Gratitude
  gratitude: {
    patterns: [
      'thank', 'thanks', 'thank you', 'appreciate', 'grateful'
    ],
    triggers: null
  },

  // Well-being check
  wellbeing: {
    patterns: [
      'how are you', 'how do you do', 'how have you been',
      'are you okay', 'are you well', 'doing okay'
    ],
    triggers: null
  },

  // Time queries
  time: {
    patterns: [
      'time', 'clock', 'hour', "what's the time", 'what time'
    ],
    triggers: ['what', 'tell me', 'current']
  },

  // Date queries
  date: {
    patterns: [
      'date', 'day', 'today', 'tomorrow', 'yesterday',
      'calendar', "what's the date", 'what day'
    ],
    triggers: ['what', 'tell me', 'is it']
  },

  // Weather queries
  weather: {
    patterns: [
      'weather', 'temperature', 'temp', 'rain', 'raining', 'sunny',
      'cold', 'hot', 'warm', 'cool', 'forecast', 'outside', 'cloudy',
      'snow', 'snowing', 'storm', 'wind', 'windy'
    ],
    triggers: ['what', 'how', 'is it', 'will it', 'should i', 'do i need', 'current', 'today', 'tomorrow']
  }
};

/**
 * Response templates with variations for natural conversation
 * Organized by locale for i18n support
 */
const RESPONSES = {
  en: {
    medication: {
      none: [
        "You don't have any medications scheduled right now.",
        "I don't see any medications on your schedule at the moment.",
        "Your medication list is currently empty."
      ],
      list: [
        "Your medications are: {medications}",
        "Here are your medications: {medications}",
        "You're taking: {medications}"
      ],
      next: [
        "Your next medication is {medication} at {time}.",
        "Coming up: {medication} at {time}.",
        "You should take {medication} at {time}.",
        "Time for {medication} at {time}."
      ],
      already_taken: [
        "You've already taken today's medications. Your next dose is {medication} tomorrow at {time}.",
        "All done for today! Your next medication is {medication} tomorrow at {time}.",
        "Today's medications are complete. Tomorrow you'll take {medication} at {time}."
      ]
    },

    family: {
      none: [
        "I don't have family information stored yet.",
        "No family members are listed in your profile.",
        "Would you like to tell me about your family?"
      ],
      list: [
        "Your family includes: {family}.",
        "Let me tell you about your family: {family}.",
        "You have {family} in your family."
      ]
    },

    doctor: {
      none: [
        "I don't have doctor information stored yet.",
        "No doctors are listed in your profile.",
        "Would you like to add your doctor's information?"
      ],
      list: [
        "Your doctors are: {doctors}.",
        "Here are your healthcare providers: {doctors}.",
        "You see these doctors: {doctors}."
      ]
    },

    hydration: [
      "It's important to stay hydrated! Would you like me to remind you to drink water regularly?",
      "Drinking water is great for your health. Shall I set up reminders for you?",
      "Good thinking! Staying hydrated helps you feel your best. Want a reminder?"
    ],

    activities: {
      none: [
        "I don't have your interests recorded yet. What do you enjoy doing?",
        "Tell me about your hobbies and interests!",
        "What activities bring you joy?"
      ],
      list: [
        "You enjoy: {activities}.",
        "Your interests include: {activities}.",
        "You love to: {activities}."
      ]
    },

    greeting: [
      "Hello {name}! How can I help you today?",
      "Hi {name}! It's wonderful to talk with you.",
      "Good to see you, {name}! What would you like to chat about?",
      "Hello! How are you feeling today, {name}?"
    ],

    farewell: [
      "Goodbye {name}! Take care!",
      "See you soon, {name}! Stay well!",
      "Talk to you later, {name}! Be safe!",
      "Bye {name}! Looking forward to our next chat!"
    ],

    gratitude: [
      "You're very welcome, {name}!",
      "Happy to help, {name}!",
      "Anytime, {name}! That's what I'm here for.",
      "My pleasure, {name}!"
    ],

    wellbeing: [
      "I'm doing well, thank you! How are you feeling today?",
      "I'm great! More importantly, how are YOU doing?",
      "I'm here and ready to help! How are things with you?"
    ],

    time: [
      "It's {time} right now.",
      "The current time is {time}.",
      "It's {time}."
    ],

    date: [
      "Today is {date}.",
      "It's {date} today.",
      "The date is {date}."
    ],

    weather: {
      current: [
        "Right now it's {temp} and {condition} in {location}. {feels_like}",
        "The weather in {location} is {condition} with a temperature of {temp}. {feels_like}",
        "It's {temp} outside with {condition} conditions. {feels_like}"
      ],
      no_location: [
        "I don't have your location set up yet. Would you like to tell me where you live?",
        "To check the weather, I need to know your location. Can you tell me your city?",
        "I'd love to help with the weather! What's your city or zip code?"
      ],
      error: [
        "I'm having trouble checking the weather right now. Please try again in a moment.",
        "Sorry, I couldn't get the weather information. Let's try that again.",
        "The weather service isn't responding. Can you ask me again in a bit?"
      ]
    },

    fallback: [
      "I understand you said \"{input}\". Could you tell me more?",
      "That's interesting! Can you elaborate on that?",
      "I'm here to listen. Tell me more about that.",
      "I'd love to know more about what you're thinking."
    ],

    error: [
      "I'm sorry, I didn't quite catch that. Could you try again?",
      "Could you repeat that for me?",
      "I'm having trouble understanding. Can you say that differently?"
    ]
  }

  // Future locales can be added here:
  // fr: { ... },
  // es: { ... },
  // de: { ... }
};

class ConversationService {
  constructor() {
    this.locale = 'en';
    this.conversationHistory = [];
    this.lastIntent = null;
    this.weatherCache = null;
    this.weatherCacheTime = null;
    this.weatherCacheDuration = 10 * 60 * 1000; // 10 minutes

    // Conversation context for follow-up responses
    this.context = {
      waitingForLocation: false,
      lastQuestion: null,
      expectedData: null
    };
  }

  /**
   * Set the locale for responses
   */
  setLocale(locale) {
    if (RESPONSES[locale]) {
      this.locale = locale;
      return true;
    }
    console.warn(`Locale ${locale} not supported, using default (en)`);
    return false;
  }

  /**
   * Recognize intent from user input
   */
  recognizeIntent(input) {
    const normalized = input.toLowerCase().trim();

    // Check each intent
    for (const [intentName, intent] of Object.entries(INTENTS)) {
      // Check if any pattern matches
      const hasPattern = intent.patterns.some(pattern =>
        normalized.includes(pattern)
      );

      if (!hasPattern) continue;

      // If no triggers required (like greetings), return immediately
      if (intent.triggers === null) {
        return intentName;
      }

      // Check if any trigger word is present
      const hasTrigger = intent.triggers.some(trigger =>
        normalized.includes(trigger)
      );

      if (hasTrigger) {
        return intentName;
      }
    }

    return null;
  }

  /**
   * Get a random response from a template array
   */
  selectRandomResponse(templates) {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Format response with variables
   */
  formatResponse(template, variables) {
    let formatted = template;
    for (const [key, value] of Object.entries(variables)) {
      formatted = formatted.replace(`{${key}}`, value);
    }
    return formatted;
  }

  /**
   * Generate response for medication intent
   */
  generateMedicationResponse(profile) {
    const responses = RESPONSES[this.locale].medication;
    const medications = profile?.medications || [];

    if (medications.length === 0) {
      return this.selectRandomResponse(responses.none);
    }

    // Find next medication
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    let nextMedToday = null;
    let firstMedTomorrow = null;
    let minDiffToday = Infinity;
    let earliestTomorrow = Infinity;

    for (const med of medications) {
      const [hours, minutes] = med.time.split(':').map(Number);
      const medTime = hours * 60 + minutes;
      const diff = medTime - currentTime;

      // Check if medication is still upcoming today
      if (diff > 0 && diff < minDiffToday) {
        minDiffToday = diff;
        nextMedToday = med;
      }

      // Track earliest medication for tomorrow
      if (medTime < earliestTomorrow) {
        earliestTomorrow = medTime;
        firstMedTomorrow = med;
      }
    }

    // If found next medication today (upcoming)
    if (nextMedToday) {
      const template = this.selectRandomResponse(responses.next);
      return this.formatResponse(template, {
        medication: `${nextMedToday.name} (${nextMedToday.dosage})`,
        time: nextMedToday.time
      });
    }

    // All medications for today have passed - suggest tomorrow
    if (firstMedTomorrow) {
      const template = this.selectRandomResponse(responses.already_taken);
      return this.formatResponse(template, {
        medication: `${firstMedTomorrow.name} (${firstMedTomorrow.dosage})`,
        time: firstMedTomorrow.time
      });
    }

    // Fallback: list all medications
    const medList = medications
      .map(m => `${m.name} (${m.dosage} at ${m.time})`)
      .join(', ');

    const template = this.selectRandomResponse(responses.list);
    return this.formatResponse(template, { medications: medList });
  }

  /**
   * Generate response for family intent
   */
  generateFamilyResponse(profile) {
    const responses = RESPONSES[this.locale].family;
    const family = profile?.family || [];

    if (family.length === 0) {
      return this.selectRandomResponse(responses.none);
    }

    const familyList = family
      .map(f => `${f.name} (${f.relation})`)
      .join(', ');

    const template = this.selectRandomResponse(responses.list);
    return this.formatResponse(template, { family: familyList });
  }

  /**
   * Generate response for doctor intent
   */
  generateDoctorResponse(profile) {
    const responses = RESPONSES[this.locale].doctor;
    const doctors = profile?.doctors || [];

    if (doctors.length === 0) {
      return this.selectRandomResponse(responses.none);
    }

    const doctorList = doctors
      .map(d => `${d.name} (${d.specialty}, ${d.phone})`)
      .join('; ');

    const template = this.selectRandomResponse(responses.list);
    return this.formatResponse(template, { doctors: doctorList });
  }

  /**
   * Generate response for activities intent
   */
  generateActivitiesResponse(profile) {
    const responses = RESPONSES[this.locale].activities;
    const activities = profile?.activities || [];

    if (activities.length === 0) {
      return this.selectRandomResponse(responses.none);
    }

    const template = this.selectRandomResponse(responses.list);
    return this.formatResponse(template, {
      activities: activities.join(', ')
    });
  }

  /**
   * Generate response for time intent
   */
  generateTimeResponse(profile) {
    const now = new Date();
    const preferences = profile?.preferences || {};
    const timeFormat = preferences.timeFormat || '12h';
    const locale = preferences.locale || 'en-US';

    const timeString = now.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: timeFormat === '12h'
    });

    const template = this.selectRandomResponse(RESPONSES[this.locale].time);
    return this.formatResponse(template, { time: timeString });
  }

  /**
   * Generate response for date intent
   */
  generateDateResponse(profile) {
    const now = new Date();
    const preferences = profile?.preferences || {};
    const locale = preferences.locale || 'en-US';

    const dateString = now.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const template = this.selectRandomResponse(RESPONSES[this.locale].date);
    return this.formatResponse(template, { date: dateString });
  }

  /**
   * Get device location using browser Geolocation API
   */
  async getDeviceLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.log('📍 Geolocation not supported by browser');
        resolve(null);
        return;
      }

      console.log('📍 Requesting device location...');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            displayName: 'Your Location',
            fromDevice: true
          };
          console.log('✅ Got device location:', coords);
          resolve(coords);
        },
        (error) => {
          console.log('❌ Geolocation denied or failed:', error.message);
          resolve(null);
        },
        {
          timeout: 10000,
          maximumAge: 300000, // Cache for 5 minutes
          enableHighAccuracy: false
        }
      );
    });
  }

  /**
   * Geocode location to coordinates using Open-Meteo Geocoding API
   */
  async geocodeLocation(location) {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
      console.log('🌍 Geocoding location:', location);
      console.log('🌍 Geocoding URL:', url);

      const response = await fetch(url);

      if (!response.ok) {
        console.error('Geocoding API HTTP error:', response.status, response.statusText);
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('🌍 Geocoding response:', data);

      if (!data.results || data.results.length === 0) {
        console.error('Location not found in geocoding results');
        throw new Error(`Location not found: ${location}`);
      }

      const result = data.results[0];
      const geoData = {
        latitude: result.latitude,
        longitude: result.longitude,
        name: result.name,
        country: result.country,
        displayName: `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`
      };

      console.log('✅ Geocoding successful:', geoData);
      return geoData;
    } catch (error) {
      console.error('❌ Geocoding failed:', error.message, error);
      return null;
    }
  }

  /**
   * Fetch weather data from API
   * Uses Open-Meteo - a free, modern weather API that doesn't require an API key
   * @param {string|object} location - Either a location string or coordinates object {latitude, longitude, displayName}
   */
  async fetchWeather(location) {
    const cacheKey = typeof location === 'string' ? location : 'device';

    // Check cache first
    const now = Date.now();
    if (this.weatherCache &&
        this.weatherCacheTime &&
        (now - this.weatherCacheTime) < this.weatherCacheDuration &&
        this.weatherCache.searchLocation === cacheKey) {
      console.log('🌤️ Using cached weather data');
      return this.weatherCache;
    }

    try {
      let geo;

      // Check if location is already coordinates (from device)
      if (typeof location === 'object' && location.latitude && location.longitude) {
        console.log('🌤️ Using device coordinates');
        geo = location;
      } else {
        // Step 1: Geocode the location string to get coordinates
        console.log('🌤️ Starting weather fetch for location:', location);
        geo = await this.geocodeLocation(location);
        if (!geo) {
          console.error('❌ Geocoding returned null');
          throw new Error('Could not find location');
        }
      }

      console.log('📍 Using location:', geo.displayName || geo.name);

      // Step 2: Fetch weather using coordinates
      // Open-Meteo provides both Celsius and Fahrenheit in one call
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto`;

      console.log('🌤️ Weather API URL:', weatherUrl);
      const weatherResponse = await fetch(weatherUrl);

      if (!weatherResponse.ok) {
        console.error('Weather API HTTP error:', weatherResponse.status, weatherResponse.statusText);
        throw new Error(`Weather API error: ${weatherResponse.status}`);
      }

      const weatherData = await weatherResponse.json();
      console.log('🌤️ Weather API response:', weatherData);
      const current = weatherData.current;

      // Map WMO weather codes to descriptions
      const weatherCode = current.weathercode;
      const condition = this.getWeatherDescription(weatherCode);

      const data = {
        searchLocation: cacheKey,
        location: geo.displayName || geo.name || 'Your Location',
        temp_f: Math.round(current.temperature_2m),
        temp_c: Math.round((current.temperature_2m - 32) * 5/9), // Convert F to C
        feels_like_f: Math.round(current.apparent_temperature),
        feels_like_c: Math.round((current.apparent_temperature - 32) * 5/9),
        condition: condition,
        humidity: current.relativehumidity_2m,
        wind_mph: Math.round(current.windspeed_10m),
        weathercode: weatherCode
      };

      // Cache the result
      this.weatherCache = data;
      this.weatherCacheTime = now;

      console.log('✅ Fetched fresh weather data:', data);
      return data;

    } catch (error) {
      console.error('❌ Failed to fetch weather:', error.message, error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return null;
    }
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
      48: 'foggy',
      51: 'light drizzle',
      53: 'moderate drizzle',
      55: 'dense drizzle',
      56: 'light freezing drizzle',
      57: 'dense freezing drizzle',
      61: 'slight rain',
      63: 'moderate rain',
      65: 'heavy rain',
      66: 'light freezing rain',
      67: 'heavy freezing rain',
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

    return weatherCodes[code] || 'unknown conditions';
  }

  /**
   * Extract location from user input
   * Handles various formats like "Munich", "Munich Germany", "Munich in Germany", "Paris, France"
   */
  extractLocation(input) {
    console.log('📍 Extracting location from input:', input);

    // Remove common filler words
    let location = input
      .toLowerCase()
      .replace(/\b(in|at|from|the|my city is|i live in|i'm in|im in)\b/gi, ' ')
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/,/g, ' ') // Replace commas with spaces
      .trim();

    // Capitalize first letter of each word for proper city names
    location = location.split(' ')
      .filter(word => word.length > 0) // Remove empty strings
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    console.log('✅ Extracted location:', location);
    return location;
  }

  /**
   * Generate response for weather intent
   */
  /**
   * Format temperature based on user preferences
   */
  formatTemperature(weather, profile) {
    const preferences = profile?.preferences || {};
    const tempUnit = preferences.temperatureUnit || 'fahrenheit';
    const useFahrenheit = tempUnit === 'fahrenheit';

    const temp = useFahrenheit ? `${weather.temp_f}°F` : `${weather.temp_c}°C`;
    const feelsLike = useFahrenheit ? weather.feels_like_f : weather.feels_like_c;
    const currentTemp = useFahrenheit ? weather.temp_f : weather.temp_c;
    const tempDiff = Math.abs(parseInt(currentTemp) - parseInt(feelsLike));

    let feelsLikeText = '';
    if (tempDiff >= 5) {
      const feelsLikeTemp = useFahrenheit ? `${feelsLike}°F` : `${feelsLike}°C`;
      feelsLikeText = `It feels like ${feelsLikeTemp}.`;
    }

    return { temp, feelsLikeText };
  }

  async generateWeatherResponse(profile) {
    const responses = RESPONSES[this.locale].weather;
    const location = profile?.location || profile?.city;

    // Check if location is available in profile
    if (!location) {
      // Try to use device location as fallback
      console.log('📍 No location in profile, trying device location...');
      const deviceCoords = await this.getDeviceLocation();

      if (deviceCoords) {
        // Success! Use device location
        console.log('✅ Using device location for weather');
        const weather = await this.fetchWeather(deviceCoords);

        if (!weather) {
          return this.selectRandomResponse(responses.error);
        }

        // Format temperature based on user preferences
        const { temp, feelsLikeText } = this.formatTemperature(weather, profile);

        const template = this.selectRandomResponse(responses.current);
        return this.formatResponse(template, {
          temp,
          condition: weather.condition,
          location: weather.location,
          feels_like: feelsLikeText
        });
      }

      // Device location failed, ask for city
      this.context.waitingForLocation = true;
      this.context.expectedData = 'location';
      this.context.lastQuestion = 'location';
      console.log('🔔 Context set: waiting for location');

      return this.selectRandomResponse(responses.no_location);
    }

    // Clear context since we have location
    this.context.waitingForLocation = false;
    console.log('✅ Context cleared: location available');

    // Fetch weather data using stored location
    const weather = await this.fetchWeather(location);

    if (!weather) {
      return this.selectRandomResponse(responses.error);
    }

    // Format temperature based on user preferences
    const { temp, feelsLikeText } = this.formatTemperature(weather, profile);

    const template = this.selectRandomResponse(responses.current);
    return this.formatResponse(template, {
      temp,
      condition: weather.condition,
      location: weather.location,
      feels_like: feelsLikeText
    });
  }

  /**
   * Handle follow-up responses (e.g., answering "What's your city?")
   */
  async handleFollowUpContext(input, profile) {
    // Check if we're waiting for location
    if (this.context.waitingForLocation && this.context.expectedData === 'location') {
      console.log('🔄 Handling location follow-up');

      // Extract location from user input
      const location = this.extractLocation(input);

      if (!location || location.length < 2) {
        return "I didn't quite catch that location. Could you tell me your city name again?";
      }

      // Save location to profile
      const updatedProfile = { ...profile, location };
      await saveProfile(updatedProfile);

      console.log('📍 Saved location to profile:', location);

      // Clear context
      this.context.waitingForLocation = false;
      this.context.expectedData = null;

      // Now fetch weather for the saved location
      const weather = await this.fetchWeather(location);

      if (!weather) {
        return `Got it! I've saved ${location} as your location. However, I'm having trouble getting the weather right now. Please try asking again in a moment.`;
      }

      // Format temperature based on user preferences (using the updated profile)
      const { temp, feelsLikeText } = this.formatTemperature(weather, updatedProfile);

      return `Great! I've saved ${location} as your location. Right now it's ${temp} and ${weather.condition} there. ${feelsLikeText}`;
    }

    return null; // No follow-up context to handle
  }

  /**
   * Generate response based on intent and profile
   */
  async generateResponse(input, profile) {
    // FIRST: Check if we're in a follow-up context (e.g., waiting for location)
    const followUpResponse = await this.handleFollowUpContext(input, profile);
    if (followUpResponse) {
      console.log('🔄 Handled follow-up context');
      return followUpResponse;
    }

    // SECOND: Try to recognize a new intent
    const intent = this.recognizeIntent(input);
    this.lastIntent = intent;

    console.log('🎯 Recognized intent:', intent || 'none');

    const name = profile?.name || 'friend';
    const variables = { name, input };

    // Handle each intent
    switch (intent) {
      case 'medication':
        return this.generateMedicationResponse(profile);

      case 'family':
        return this.generateFamilyResponse(profile);

      case 'doctor':
        return this.generateDoctorResponse(profile);

      case 'hydration':
        return this.selectRandomResponse(RESPONSES[this.locale].hydration);

      case 'activities':
        return this.generateActivitiesResponse(profile);

      case 'greeting':
        const greetingTemplate = this.selectRandomResponse(RESPONSES[this.locale].greeting);
        return this.formatResponse(greetingTemplate, variables);

      case 'farewell':
        const farewellTemplate = this.selectRandomResponse(RESPONSES[this.locale].farewell);
        return this.formatResponse(farewellTemplate, variables);

      case 'gratitude':
        const gratitudeTemplate = this.selectRandomResponse(RESPONSES[this.locale].gratitude);
        return this.formatResponse(gratitudeTemplate, variables);

      case 'wellbeing':
        return this.selectRandomResponse(RESPONSES[this.locale].wellbeing);

      case 'time':
        return this.generateTimeResponse(profile);

      case 'date':
        return this.generateDateResponse(profile);

      case 'weather':
        return await this.generateWeatherResponse(profile);

      default:
        // Fallback for unrecognized input
        const fallbackTemplate = this.selectRandomResponse(RESPONSES[this.locale].fallback);
        return this.formatResponse(fallbackTemplate, variables);
    }
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.lastIntent = null;
  }
}

// Singleton instance
export const conversationService = new ConversationService();

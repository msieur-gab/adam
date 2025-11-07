/**
 * Conversation Service for ADAM
 * Rule-based system with intent recognition, i18n support, and natural response generation
 */

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
  generateTimeResponse() {
    const now = new Date();
    const timeString = now.toLocaleTimeString(this.locale === 'en' ? 'en-US' : this.locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const template = this.selectRandomResponse(RESPONSES[this.locale].time);
    return this.formatResponse(template, { time: timeString });
  }

  /**
   * Generate response for date intent
   */
  generateDateResponse() {
    const now = new Date();
    const dateString = now.toLocaleDateString(this.locale === 'en' ? 'en-US' : this.locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const template = this.selectRandomResponse(RESPONSES[this.locale].date);
    return this.formatResponse(template, { date: dateString });
  }

  /**
   * Generate response based on intent and profile
   */
  async generateResponse(input, profile) {
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
        return this.generateTimeResponse();

      case 'date':
        return this.generateDateResponse();

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

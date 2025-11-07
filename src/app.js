import { LitElement, html, css } from 'lit';
import './components/voice-input.js';
import './components/companion-chat.js';
import './components/medication-reminder.js';
import './services/db-service.js';
import { db } from './services/db-service.js';

class AdamApp extends LitElement {
  static properties = {
    initialized: { type: Boolean },
    profile: { type: Object },
    loading: { type: Boolean }
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      max-width: 100%;
    }

    header {
      background: var(--primary);
      color: white;
      padding: var(--spacing);
      text-align: center;
      box-shadow: var(--shadow);
    }

    h1 {
      font-size: 1.75rem;
      font-weight: 600;
    }

    .container {
      flex: 1;
      padding: var(--spacing);
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      gap: 1rem;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--primary-light);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .status {
      color: var(--text-light);
      font-size: 1rem;
    }
  `;

  constructor() {
    super();
    this.initialized = false;
    this.profile = null;
    this.loading = true;
  }

  async connectedCallback() {
    super.connectedCallback();
    await this.initialize();
    this.registerServiceWorker();
  }

  async initialize() {
    try {
      this.loading = true;

      // Check if companion profile exists in Dexie
      const storedProfile = await db.settings.get('profile');

      if (storedProfile) {
        this.profile = storedProfile.data;
        this.initialized = true;
      } else {
        // Load default/demo profile for now
        // Later this will be replaced with family-generated JSON
        await this.loadDemoProfile();
      }

      this.loading = false;
    } catch (error) {
      console.error('Failed to initialize:', error);
      this.loading = false;
    }
  }

  /**
   * Register service worker for offline support and model caching
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('✅ Service Worker registered:', registration.scope);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 Service Worker update found');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('✨ New version available! Refresh to update.');
            }
          });
        });

      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    }
  }

  async loadDemoProfile() {
    const demoProfile = {
      name: "Grandpa",
      family: [
        { name: "Maria", relation: "daughter", phone: "+1234567890" },
        { name: "Sofia", relation: "granddaughter" }
      ],
      medications: [
        {
          name: "Morning vitamins",
          dosage: "1 pill",
          time: "08:00",
          notes: "with breakfast"
        }
      ],
      doctors: [
        {
          name: "Dr. Smith",
          specialty: "General practice",
          phone: "+1234567890",
          address: "123 Main St"
        }
      ],
      diet: ["prefers light meals", "avoid heavy dinner"],
      activities: ["walking", "reading", "listening to music"],
      habits: {
        sleepTime: "22:00",
        wakeTime: "07:00",
        timezone: "Europe/Paris"
      }
    };

    await db.settings.put({ key: 'profile', data: demoProfile });
    this.profile = demoProfile;
    this.initialized = true;
  }

  render() {
    if (this.loading) {
      return html`
        <header>
          <h1>ADAM</h1>
        </header>
        <div class="container">
          <div class="loading">
            <div class="spinner"></div>
            <p class="status">Initializing your companion...</p>
          </div>
        </div>
      `;
    }

    if (!this.initialized || !this.profile) {
      return html`
        <header>
          <h1>ADAM</h1>
        </header>
        <div class="container">
          <p>Failed to load companion profile. Please check settings.</p>
        </div>
      `;
    }

    return html`
      <header>
        <h1>Hello, ${this.profile.name}</h1>
      </header>
      <div class="container">
        <medication-reminder .profile=${this.profile}></medication-reminder>
        <companion-chat .profile=${this.profile}></companion-chat>
        <voice-input></voice-input>
      </div>
    `;
  }
}

customElements.define('adam-app', AdamApp);

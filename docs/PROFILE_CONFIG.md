# ADAM Profile Configuration

This document describes the configuration options available in the ADAM companion profile.

## Profile Structure

The profile is stored in IndexedDB under the `settings` table with key `profile`. It contains all user-specific information and preferences.

## Configuration Options

### Preferences Object

The `preferences` object controls regional settings and display formats:

```json
{
  "preferences": {
    "locale": "en-US",
    "temperatureUnit": "celsius",
    "timeFormat": "24h",
    "measurementSystem": "metric",
    "timezone": "Europe/Paris"
  }
}
```

#### Available Options

##### `locale` (string)
Controls language and regional formatting for dates, times, and numbers.

**Examples:**
- `"en-US"` - English (United States)
- `"en-GB"` - English (United Kingdom)
- `"fr-FR"` - French (France)
- `"de-DE"` - German (Germany)
- `"es-ES"` - Spanish (Spain)
- `"it-IT"` - Italian (Italy)

**Default:** `"en-US"`

##### `temperatureUnit` (string)
Temperature display unit for weather information.

**Options:**
- `"celsius"` - Display temperatures in Celsius (°C)
- `"fahrenheit"` - Display temperatures in Fahrenheit (°F)

**Default:** `"fahrenheit"`

**Example output:**
- Celsius: "It's 20°C and partly cloudy"
- Fahrenheit: "It's 68°F and partly cloudy"

##### `timeFormat` (string)
Time display format for clock and time queries.

**Options:**
- `"12h"` - 12-hour format with AM/PM (e.g., "2:30 PM")
- `"24h"` - 24-hour format (e.g., "14:30")

**Default:** `"12h"`

**Example output:**
- 12h: "It's 2:30 PM right now"
- 24h: "It's 14:30 right now"

##### `measurementSystem` (string)
Measurement system for distances, weights, etc. (future use).

**Options:**
- `"metric"` - Kilometers, kilograms, etc.
- `"imperial"` - Miles, pounds, etc.

**Default:** `"imperial"`

##### `timezone` (string)
IANA timezone identifier for accurate time display.

**Examples:**
- `"America/New_York"`
- `"America/Los_Angeles"`
- `"Europe/London"`
- `"Europe/Paris"`
- `"Asia/Tokyo"`
- `"Australia/Sydney"`

**Default:** `"America/New_York"`

## Complete Profile Example

```json
{
  "name": "Grandpa",

  "preferences": {
    "locale": "fr-FR",
    "temperatureUnit": "celsius",
    "timeFormat": "24h",
    "measurementSystem": "metric",
    "timezone": "Europe/Paris"
  },

  "location": "Paris, France",

  "family": [
    {
      "name": "Marie",
      "relation": "daughter",
      "phone": "+33612345678"
    }
  ],

  "medications": [
    {
      "name": "Morning vitamins",
      "dosage": "1 pill",
      "time": "08:00",
      "notes": "with breakfast"
    }
  ],

  "doctors": [
    {
      "name": "Dr. Dupont",
      "specialty": "General practice",
      "phone": "+33612345678",
      "address": "123 Rue de la Paix"
    }
  ],

  "activities": [
    "walking",
    "reading",
    "gardening"
  ],

  "habits": {
    "sleepTime": "22:00",
    "wakeTime": "07:00",
    "timezone": "Europe/Paris"
  }
}
```

## Regional Preset Examples

### United States (Default)
```json
{
  "preferences": {
    "locale": "en-US",
    "temperatureUnit": "fahrenheit",
    "timeFormat": "12h",
    "measurementSystem": "imperial",
    "timezone": "America/New_York"
  }
}
```

### United Kingdom
```json
{
  "preferences": {
    "locale": "en-GB",
    "temperatureUnit": "celsius",
    "timeFormat": "24h",
    "measurementSystem": "metric",
    "timezone": "Europe/London"
  }
}
```

### France
```json
{
  "preferences": {
    "locale": "fr-FR",
    "temperatureUnit": "celsius",
    "timeFormat": "24h",
    "measurementSystem": "metric",
    "timezone": "Europe/Paris"
  }
}
```

### Germany
```json
{
  "preferences": {
    "locale": "de-DE",
    "temperatureUnit": "celsius",
    "timeFormat": "24h",
    "measurementSystem": "metric",
    "timezone": "Europe/Berlin"
  }
}
```

## Modifying the Profile

### Via Browser Console

To change preferences in the browser console:

```javascript
// Get current profile
const { getProfile, saveProfile } = await import('./src/services/db-service.js');
const profile = await getProfile();

// Modify preferences
profile.preferences = {
  locale: "fr-FR",
  temperatureUnit: "celsius",
  timeFormat: "24h",
  measurementSystem: "metric",
  timezone: "Europe/Paris"
};

// Save updated profile
await saveProfile(profile);

// Reload the page to see changes
location.reload();
```

### Via Family Configuration (Future)

In the future, the family will be able to configure these settings through a web interface when setting up the companion profile.

## Notes

- All preferences have sensible defaults and will fall back to US/English settings if not specified
- Temperature preferences apply to all weather-related responses
- Time format preferences apply to time queries and timestamps
- Locale affects date/time formatting but does NOT translate conversation responses (language translation is a future feature)
- The timezone setting ensures accurate time display based on the user's location

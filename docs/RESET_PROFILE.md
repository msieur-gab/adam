# Reset Profile to Latest Version

If you updated the profile structure and need to reload it, use this guide.

## Quick Reset via Browser Console

Open the browser console (F12) and run:

```javascript
// Import database service
const { db } = await import('./src/services/db-service.js');

// Delete the existing profile
await db.settings.delete('profile');

// Reload the page - it will create a new profile with latest structure
location.reload();
```

## Verify Profile Structure

To check your current profile:

```javascript
const { getProfile } = await import('./src/services/db-service.js');
const profile = await getProfile();
console.log('Current profile:', profile);
```

## Update Preferences Without Reset

To update just the preferences without losing your data:

```javascript
const { getProfile, saveProfile } = await import('./src/services/db-service.js');
const profile = await getProfile();

// Add/update preferences
profile.preferences = {
  locale: "en-US",
  temperatureUnit: "celsius",     // Change to "fahrenheit" if needed
  timeFormat: "24h",              // Change to "12h" if needed
  measurementSystem: "metric",
  timezone: "Europe/Paris"
};

await saveProfile(profile);
console.log('✅ Profile updated!');

// Reload to see changes
location.reload();
```

## Current Demo Profile Settings

After reset, the demo profile uses:
- **Temperature:** Celsius (°C)
- **Time:** 24-hour format
- **Locale:** en-US
- **Timezone:** Europe/Paris

These match European preferences. To use US settings instead:

```javascript
const { getProfile, saveProfile } = await import('./src/services/db-service.js');
const profile = await getProfile();

profile.preferences = {
  locale: "en-US",
  temperatureUnit: "fahrenheit",
  timeFormat: "12h",
  measurementSystem: "imperial",
  timezone: "America/New_York"
};

await saveProfile(profile);
location.reload();
```

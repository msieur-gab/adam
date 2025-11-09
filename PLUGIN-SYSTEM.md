# ADAM Plugin System

## Overview

ADAM now has an extensible plugin architecture that allows you to add new capabilities without modifying core code. The News Reader plugin is the first example.

## Architecture

```
┌─────────────────┐
│  Voice Input    │
└────────┬────────┘
         │
┌────────▼────────┐
│  Compromise NLU │  ← Registers plugin patterns
└────────┬────────┘
         │
┌────────▼────────┐
│ Plugin Manager  │  ← Routes to correct plugin
└────────┬────────┘
         │
┌────────▼────────┐
│  News Plugin    │  ← Handles news queries
└────────┬────────┘
         │
┌────────▼────────┐
│ Response Gen.   │  ← Formats response
└────────┬────────┘
         │
┌────────▼────────┐
│      TTS        │  ← Reads aloud
└─────────────────┘
```

## News Reader Plugin (Example)

### Features
- Fetches RSS feeds (BBC News by default)
- Shows top 5 headlines
- Reads articles aloud
- Caches for 30 minutes

### Voice Commands

**Get Headlines:**
- "what's the news"
- "show me the headlines"
- "tell me the latest news"
- "what's happening in the world"

**Read Specific Article:**
- "read article number 3"
- "read number 2"
- "tell me about article 4"

### How It Works

1. **User**: "what's the news today"

2. **NLU Analysis**:
   ```javascript
   {
     subject: "news",
     intent: "news_headlines",
     action: "query",
     confidence: 0.85
   }
   ```

3. **Plugin Manager**: Routes to news-reader-plugin

4. **News Plugin**:
   - Fetches BBC RSS feed
   - Parses XML
   - Returns top 5 articles

5. **Response**:
   ```
   Here are the top 5 headlines for you, Grandpa:

   1. Breaking: Major climate agreement reached
   2. Tech: New AI breakthrough announced
   3. Health: Vaccine trials show promise
   4. Economy: Markets reach new highs
   5. Sports: Championship finals tonight

   Which one would you like me to read? Just say "read number" followed by 1, 2, 3, 4, or 5.
   ```

6. **User**: "read number 2"

7. **System**: Opens article, reads full content

## Creating a New Plugin

### 1. Create Plugin Class

```javascript
// src/plugins/my-plugin.js
import { BasePlugin } from './plugin-base.js';

export class MyPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0',
      description: 'Does something cool',
      author: 'You'
    });
  }

  // Register NLU patterns
  getNLUPatterns() {
    return {
      mysubject: {
        nouns: ['thing', 'stuff'],
        adjectives: ['cool', 'awesome'],
        verbs: ['do', 'make'],
        priority: 9
      }
    };
  }

  // Register intents
  getIntents() {
    return ['my_intent'];
  }

  // Handle queries
  async handleQuery(intent, params) {
    return {
      success: true,
      data: { message: 'Hello from my plugin!' }
    };
  }
}

export const myPlugin = new MyPlugin();
```

### 2. Register Plugin

```javascript
// src/plugins/bootstrap.js
import { myPlugin } from './my-plugin.js';

async function initializePlugins() {
  await pluginManager.registerPlugin(myPlugin);
  // ... rest of init
}
```

### 3. Add Response Generator (if needed)

```javascript
// src/services/response-generator.js
generateServiceResponse(nluResult, data, userProfile) {
  if (intent === 'my_intent') {
    return data.message;
  }
  // ... rest
}
```

## Plugin API

### BasePlugin Methods

```javascript
class BasePlugin {
  // Required
  async handleQuery(intent, params) { }

  // Optional
  getNLUPatterns() { return {}; }
  getIntents() { return []; }
  async initialize() { }
  async cleanup() { }
}
```

### Plugin Manager Methods

```javascript
// Register plugin
await pluginManager.registerPlugin(plugin);

// Unregister plugin
await pluginManager.unregisterPlugin(pluginId);

// Get plugin
const plugin = pluginManager.getPlugin('news-reader');

// Check if intent is handled
const hasPlugin = pluginManager.hasPluginForIntent('news_headlines');

// Execute query
const result = await pluginManager.executePluginQuery(intent, params);

// Get stats
const stats = pluginManager.getStats();
```

## RSS Feeds

The news plugin supports multiple RSS feeds:

```javascript
// Default feeds
{
  bbc_world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  bbc_tech: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  bbc_health: 'https://feeds.bbci.co.uk/news/health/rss.xml'
}

// Add custom feed
newsReaderPlugin.addFeed('custom', 'https://example.com/feed.xml');

// Remove feed
newsReaderPlugin.removeFeed('bbc_tech');

// List feeds
const feeds = newsReaderPlugin.listFeeds();
```

## Debugging

### Browser Console

```javascript
// Import plugin manager
const { getPluginManager } = await import('./src/plugins/bootstrap.js');
const pm = getPluginManager();

// List plugins
pm.listPlugins();

// Get stats
pm.getStats();

// Test plugin query
const result = await pm.executePluginQuery('news_headlines', {});
console.log(result);
```

### Console Output

```
[PluginBootstrap] Initializing plugin system...
[PluginManager] Registered intent: news_headlines -> news-reader
[PluginManager] Registered intent: news_read -> news-reader
[PluginManager] Registered intent: news_select -> news-reader
[PluginManager] Registered plugin: News Reader (news-reader)
[NLU] Added plugin patterns: [ 'news' ]
[PluginBootstrap] Plugin system initialized: {
  totalPlugins: 1,
  enabledPlugins: 1,
  totalIntents: 3
}
```

## Future Plugin Ideas

1. **Calendar Plugin**
   - "what's on my calendar today"
   - "add appointment"
   - "remind me to call John tomorrow"

2. **Shopping List Plugin**
   - "add milk to shopping list"
   - "what's on my shopping list"
   - "remove bread from list"

3. **Photo Album Plugin**
   - "show me photos from last Christmas"
   - "who is this person"
   - "tell me about this photo"

4. **Music Player Plugin**
   - "play some jazz"
   - "what song is this"
   - "skip this song"

5. **Exercise Tracker Plugin**
   - "log 30 minute walk"
   - "how many steps today"
   - "show my exercise history"

## Plugin Best Practices

1. **Keep it focused**: One plugin = one capability
2. **Cache data**: Avoid hitting APIs on every request
3. **Handle errors gracefully**: Return helpful error messages
4. **Test voice commands**: Try various phrasings
5. **Add cleanup**: Release resources in `cleanup()`
6. **Version your plugin**: Use semantic versioning
7. **Document commands**: List all supported voice commands

## Testing

### Test News Plugin

**Refresh the page** to reload plugins, then try:

1. "what's the news today"
2. "read article number 3"
3. "show me headlines"
4. "tell me about article 1"

### Check Console

Look for:
- `[PluginBootstrap]` - Plugin initialization
- `[PluginManager]` - Intent registration
- `[NLU]` - Pattern registration
- `[NewsReader]` - Plugin execution
- `[ResponseGenerator]` - Response generation

## Troubleshooting

### Plugin not recognized
- Check if registered in `bootstrap.js`
- Verify `getIntents()` returns correct intents
- Check console for registration errors

### Intent not matching
- Verify NLU patterns in `getNLUPatterns()`
- Check intent mapping in `buildIntent()`
- Enable debug panel to see NLU analysis

### Response not generating
- Check `generateServiceResponse()` handles your intent
- Verify plugin returns correct data structure
- Check for errors in console

---

**Built:** 2025-11-07
**Status:** ✅ Working
**Example:** News Reader Plugin

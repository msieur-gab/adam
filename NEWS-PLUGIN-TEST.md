# News Reader Plugin - Ready for Testing

## What's Been Implemented

### 1. CORS Solution ✓
- Added RSS proxy endpoint in `vite.config.js`
- Endpoint: `http://localhost:3001/api/rss?url=...`
- Tested successfully with BBC RSS feed

### 2. Plugin System ✓
- `src/plugins/plugin-base.js` - Base class for all plugins
- `src/plugins/plugin-manager.js` - Plugin lifecycle management
- `src/plugins/news-reader-plugin.js` - News reader implementation
- `src/plugins/bootstrap.js` - Plugin initialization

### 3. NLU Integration ✓
- News patterns registered in compromise-nlu-service
- Intent recognition for news queries
- Number extraction from voice commands

### 4. Response Generation ✓
- Plugin routing in response-generator.js
- Voice-friendly text formatting
- TTS-ready responses

## Voice Commands to Test

### Get Headlines
Say any of these:
- "what's the news"
- "show me the headlines"
- "tell me the latest news"
- "what's happening in the world"

**Expected Response:**
Voice will read: "Here are the top 5 headlines. Number 1: [title]. Number 2: [title]..." and ask which one you'd like to read.

### Read Specific Article
After hearing the headlines, say:
- "read article number 3"
- "read number 2"
- "tell me about article 4"

**Expected Response:**
Voice will read the full article content.

## Testing Steps

1. **Open Browser**
   - Navigate to: http://localhost:3001/
   - Wait for "🎤 Loading Voice Model..." to complete

2. **Test Headlines**
   - Click the microphone button
   - Say: "what's the news today"
   - Listen to the 5 headlines being read aloud

3. **Test Article Reading**
   - Click microphone again
   - Say: "read article number 2"
   - Listen to the full article

4. **Check NLU Debug**
   - The NLU debug panel shows how the system interpreted your query
   - Should show: `Intent: news_headlines` or `Intent: news_read`

## Technical Details

### RSS Feed
- Default: BBC World News
- URL: https://feeds.bbci.co.uk/news/world/rss.xml
- Cached for 30 minutes
- Shows top 5 articles

### Architecture Flow
```
Voice Input
    ↓
Compromise NLU (detects "news" subject)
    ↓
Plugin Manager (routes to news-reader-plugin)
    ↓
News Plugin (fetches RSS via proxy)
    ↓
Response Generator (formats for TTS)
    ↓
TTS Service (reads aloud)
```

## Troubleshooting

### Issue: "Could not fetch news headlines"
- Check console for errors
- Verify RSS proxy is working: http://localhost:3001/api/rss?url=https://feeds.bbci.co.uk/news/world/rss.xml
- Check network tab for failed requests

### Issue: Intent not recognized
- Check NLU debug panel
- Should detect "news" as subject
- If not, check console for plugin registration logs

### Issue: Article number not recognized
- Plugin tries multiple extraction methods
- Say clearly: "read article number [1-5]"
- Check console for extracted number

## Console Logs to Look For

On page load:
```
[PluginBootstrap] Initializing plugin system...
[PluginManager] Registered intent: news_headlines -> news-reader
[PluginManager] Registered intent: news_read -> news-reader
[PluginManager] Registered intent: news_select -> news-reader
[NLU] Added plugin patterns: [ 'news' ]
[PluginBootstrap] Plugin system initialized
```

On news query:
```
[ResponseGenerator] Executing plugin for intent: news_headlines
[NewsReader] Fetching fresh articles from: bbc_world
[NewsReader] Using cached articles (if within 30 min)
```

## Next Steps After Testing

Once you confirm it works:
1. Test different phrasings
2. Validate article reading quality
3. Consider UI enhancements (optional)
4. Add more RSS feeds (optional)
5. Consider additional plugins (calendar, shopping list, etc.)

## Status

- ✅ RSS proxy working
- ✅ Plugin system integrated
- ✅ NLU patterns registered
- ✅ Response generation working
- ✅ Voice commands ready
- 🧪 **Ready for voice testing**

---

**Built:** 2025-11-07
**Server:** http://localhost:3001/
**Test:** Say "what's the news today"

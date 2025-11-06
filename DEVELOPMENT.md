# ADAM Development Guide

## Quick Start

```bash
# Install dependencies (already done)
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## What We've Built

### Core Features ✅

1. **Voice-First Interface**
   - Web Speech API for voice recognition
   - Real-time transcription display
   - Text-to-speech responses (slower rate for elderly)
   - Visual feedback with waveform animation

2. **Local LLM Integration**
   - Transformers.js with Phi-2 (2.7B quantized)
   - ~1.5GB model, cached locally after first download
   - Context-aware responses using companion profile
   - Conversation history for continuity
   - 1-5 second response time (device-dependent)

3. **Hybrid Intelligence**
   - **Rule-based**: Fast, reliable responses for:
     - Medication queries
     - Family information
     - Doctor contacts
     - Hydration reminders
   - **LLM-powered**: Natural conversation for everything else

4. **Medication Management**
   - Auto-generates reminders from profile
   - Visual + audio notifications
   - Time-until display
   - "Mark as taken" functionality

5. **Local-First Storage**
   - Dexie.js (IndexedDB) for all data
   - Profile, reminders, messages, photos, conversation logs
   - Works 100% offline after initial setup

6. **Progressive Web App**
   - Installable on mobile devices
   - Works offline
   - Responsive design

## Architecture

### Component Structure

```
adam-app (src/app.js)
├── medication-reminder (src/components/medication-reminder.js)
├── companion-chat (src/components/companion-chat.js)
└── voice-input (src/components/voice-input.js)
```

### Services

```
db-service.js - Dexie database layer
llm-service.js - Transformers.js LLM integration
```

### Data Flow

```
User speaks → Voice Input → Transcription
                                ↓
                    Companion Chat Component
                                ↓
                        Rule-based check?
                           ├─ Yes → Fast response
                           └─ No → LLM generation
                                ↓
                    TTS speaks response + Display
                                ↓
                    Log to Dexie conversation history
```

## Testing the App

### First Run

When you first run the app:
1. The LLM model will download (~1.5GB)
2. You'll see a progress bar
3. This happens ONCE, then it's cached
4. On subsequent runs, it loads instantly from cache

### Demo Profile

The app loads with a demo profile:
- Name: "Grandpa"
- Morning vitamins at 08:00
- Family: Maria (daughter), Sofia (granddaughter)
- Dr. Smith contact info

### What to Test

1. **Voice Interaction**
   - Click the microphone button
   - Say "What are my medications?"
   - Say "Who is my family?"
   - Say "Tell me a story"
   - Say "How are you today?"

2. **Rule-Based Responses** (instant)
   - "What medications do I take?"
   - "Who is my doctor?"
   - "Tell me about my family"
   - "I need water"

3. **LLM Responses** (1-5 seconds)
   - "How's the weather?"
   - "Tell me about yourself"
   - "I'm feeling lonely"
   - "What should I do today?"

4. **Conversation Context**
   - Have a multi-turn conversation
   - The LLM remembers the last 3 exchanges
   - Try: "My name is John" → then "What's my name?"

5. **Medication Reminders**
   - Reminders auto-generate at scheduled times
   - You'll see/hear notifications
   - Can mark as completed

## Model Options

Current: **Phi-2** (1.5GB, best quality)

To switch models, edit `src/services/llm-service.js`:

```javascript
// Line 17
this.modelName = 'Xenova/Phi-2'; // Current

// Faster alternatives:
// this.modelName = 'Xenova/TinyLlama-1.1B-Chat-v1.0'; // 600MB
// this.modelName = 'Xenova/gpt2'; // 500MB
```

## Browser Compatibility

**Best experience:**
- Chrome/Edge 90+
- Desktop or mobile

**Also works:**
- Safari 14+ (some Web Speech API limitations)
- Firefox 88+ (some TTS voice quality differences)

**Note:** Web Speech API quality varies by browser. Chrome recommended.

## Performance Tips

### For Faster LLM Responses

1. Use a smaller model (TinyLlama)
2. Reduce `max_new_tokens` in `llm-service.js` (line 90)
3. Test on a more powerful device first

### For Lower Memory Usage

1. Switch to TinyLlama or GPT-2
2. Clear conversation history more frequently
3. Limit photo storage

## Known Limitations

1. **First load**: 1.5GB download required (one-time)
2. **Mobile performance**: Slower inference on older phones
3. **Browser requirement**: Web Speech API not universal
4. **Memory**: Needs ~2GB RAM for smooth operation

## Next Steps

### Phase 2 Enhancements (TODO)

- [ ] JSON profile builder for families
- [ ] Photo upload and gallery
- [ ] Message composition interface
- [ ] Hydration tracking automation
- [ ] Doctor appointment reminders
- [ ] Emergency contacts quick-dial
- [ ] Multi-language support
- [ ] Better error recovery
- [ ] Whisper.js fallback for better voice recognition

### Phase 3 (Future)

- [ ] Family dashboard (optional cloud sync)
- [ ] Activity tracking
- [ ] Health metrics visualization
- [ ] Video call integration

## Troubleshooting

### LLM Not Loading

```
Error: Failed to initialize LLM
```

**Solutions:**
1. Check browser console for specific error
2. Clear browser cache and reload
3. Try a smaller model
4. Ensure stable internet for first load

### Voice Recognition Not Working

**Solutions:**
1. Check microphone permissions
2. Use Chrome/Edge (best support)
3. Ensure HTTPS (required for Web Speech API)
4. Test in incognito mode (extension conflicts)

### TTS Not Speaking

**Solutions:**
1. Check browser TTS support
2. Unmute device
3. Try different browser
4. Check console for voice loading errors

## Development Workflow

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Git workflow
git add .
git commit -m "Your message"
```

## File Structure

```
adam/
├── src/
│   ├── app.js                        # Main app component
│   ├── components/
│   │   ├── voice-input.js            # Microphone + transcription
│   │   ├── companion-chat.js         # Chat interface + LLM
│   │   └── medication-reminder.js    # Reminder system
│   └── services/
│       ├── db-service.js             # Dexie database layer
│       └── llm-service.js            # Transformers.js LLM
├── index.html                        # Entry point
├── manifest.json                     # PWA manifest
├── package.json                      # Dependencies
├── vite.config.js                    # Build config
├── README.md                         # Project overview
└── DEVELOPMENT.md                    # This file
```

## Contributing

This is a solo project with Claude as teammate. Key principles:

1. **Privacy First**: All processing local, no cloud dependencies
2. **Accessibility**: Large UI, voice-first, clear feedback
3. **Reliability**: Rule-based critical paths
4. **Simplicity**: Zero config for end users
5. **Offline-Capable**: Works without internet after setup

---

Built with ❤️ for better elderly care

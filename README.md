# ADAM - AI Companion for Elderly Care

A privacy-first, local-first voice companion for elderly care. ADAM helps with medication reminders, family connections, and daily support through natural voice interaction.

## Features

- **Voice-First Interface**: Natural conversation using Web Speech API
- **Medication Reminders**: Automatic scheduling and notifications
- **Family Connection**: Photo gallery and message composition
- **100% Local**: All data stored locally, works offline after setup
- **Accessible Design**: Large touch targets, high contrast, clear voice feedback

## Tech Stack

- **Framework**: Lit (Web Components)
- **Storage**: Dexie.js (IndexedDB)
- **LLM**: Transformers.js (in-browser inference)
- **Voice**: Web Speech API (Speech Recognition + TTS)
- **Build**: Vite
- **Styling**: CSS3 with semantic HTML5

## Architecture

### Hybrid Intelligence Model

ADAM uses a two-tier approach:

1. **Rule-Based Layer**: Fast, predictable responses for critical tasks (medication, family info, doctor contacts)
2. **LLM Layer**: Natural conversation and context-aware responses for open-ended interactions

### Data Model

```javascript
{
  profile: {
    name: string,
    family: [{ name, relation, phone, photo }],
    medications: [{ name, dosage, time, notes }],
    doctors: [{ name, specialty, phone, address }],
    diet: string[],
    activities: string[],
    habits: { sleepTime, wakeTime, timezone }
  },
  reminders: [{ type, scheduledFor, completed }],
  messages: [{ from, content, receivedAt }],
  photos: [{ familyMember, base64Data }],
  conversationLog: [{ timestamp, input, output, type }]
}
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
adam/
├── src/
│   ├── app.js                 # Main application component
│   ├── components/
│   │   ├── voice-input.js     # Voice recognition & TTS
│   │   ├── companion-chat.js  # Conversational interface
│   │   └── medication-reminder.js  # Reminder system
│   └── services/
│       └── db-service.js      # Dexie database layer
├── index.html                 # Entry point
├── manifest.json             # PWA manifest
└── vite.config.js            # Build configuration
```

## Roadmap

### Phase 1: Core Foundation ✅
- [x] Project skeleton with Lit + Web Components
- [x] Dexie.js schema and database layer
- [x] Voice input component with Web Speech API
- [x] Companion chat with hybrid rule/LLM logic
- [x] Medication reminder system

### Phase 2: LLM Integration (In Progress)
- [ ] Transformers.js setup with quantized model
- [ ] Context-aware response generation
- [ ] Conversation memory and personality
- [ ] Fallback to Whisper for better transcription

### Phase 3: Family Interface
- [ ] JSON configuration builder
- [ ] Photo upload and management
- [ ] Message composition interface
- [ ] Remote sync (optional, opt-in)

### Phase 4: Enhanced Features
- [ ] Activity tracking
- [ ] Doctor appointment reminders
- [ ] Hydration tracking
- [ ] Emergency contact quick-dial

## Design Principles

1. **Privacy First**: No cloud dependencies, all processing local
2. **Accessibility**: Designed for elderly users (large UI, voice-first, clear feedback)
3. **Reliability**: Rule-based critical paths, LLM for enhancement
4. **Simplicity**: Zero configuration for end users
5. **Offline-Capable**: Works without internet after initial setup

## Browser Support

- Chrome/Edge 90+ (recommended)
- Safari 14+
- Firefox 88+

**Note**: Web Speech API support varies. Chrome/Edge recommended for best experience.

## License

MIT

## Contributing

This is a solo project with Claude as teammate. Contributions welcome!

---

Built with ❤️ for better elderly care

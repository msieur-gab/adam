# Better Voice Quality Setup Guide

ADAM uses your browser's built-in text-to-speech voices. The quality depends on what voices are installed on your system. Here's how to get the best voices:

## 🎯 Quick Recommendations

**Best Experience:**
- **Chrome/Edge on Windows** - Microsoft Neural voices (online, high quality)
- **Chrome on Desktop** - Google voices (online, very natural)
- **Safari on macOS/iOS** - Apple Enhanced voices (offline, high quality)

---

## 🪟 Windows (Best Quality)

### Option 1: Microsoft Edge (Recommended - Free Neural TTS)
1. Use Microsoft Edge browser
2. Edge automatically uses Microsoft's online Neural voices
3. No installation needed - just use Edge!
4. Voices include: Aria, Jenny, Guy (very natural)

### Option 2: Install High-Quality Voices
1. Open **Settings** → **Time & Language** → **Speech**
2. Click "Add voices"
3. Install these recommended voices:
   - **Microsoft Aria Online (Natural)** ⭐ Best
   - **Microsoft Jenny Online (Natural)**
   - **Microsoft Guy Online (Natural)**
4. These require internet connection but are very high quality

---

## 🍎 macOS (Excellent Quality)

### Install Enhanced Voices (Recommended)
1. Open **System Settings** → **Accessibility** → **Spoken Content**
2. Click on "System Voice" dropdown
3. Click "Manage Voices..."
4. Download these **Enhanced** or **Premium** voices:
   - **Ava (Enhanced)** ⭐ Very natural female voice
   - **Samantha (Enhanced)** - Classic, clear
   - **Alex (Enhanced)** - Natural male voice
   - **Nicky** - Clear female voice

Enhanced voices are ~100-300MB each but sound much more human.

---

## 🐧 Linux (Limited Options)

### Chrome with Google Voices
1. Use Google Chrome browser
2. Chrome uses online Google voices automatically
3. No installation needed
4. Good quality but requires internet

### Install Better espeak Voices
```bash
# Ubuntu/Debian
sudo apt install espeak-ng espeak-ng-data

# Fedora
sudo dnf install espeak-ng

# Arch
sudo pacman -S espeak-ng
```

Note: Linux voices are generally lower quality. Use Chrome for best results.

---

## 📱 Mobile Devices

### iOS/iPadOS
- Uses Apple voices automatically
- Go to **Settings** → **Accessibility** → **Spoken Content** → **Voices**
- Download **Enhanced Quality** voices
- Recommended: Ava, Samantha, Nicky

### Android
- Chrome uses Google voices automatically (online)
- Or install voices via **Settings** → **Accessibility** → **Text-to-speech**
- Google TTS provides good quality

---

## 🧪 Testing Your Voice

1. Open ADAM at http://localhost:3000
2. Open browser console (F12)
3. Look for: `🔊 TTS initialized with voice: [Voice Name]`
4. This shows which voice ADAM selected

### Voice Priority Order
ADAM automatically selects the best available voice in this order:
1. ⭐ Google/Microsoft/Apple premium voices (online)
2. Enhanced/Natural voices (downloaded)
3. Standard system voices (fallback)

---

## 🔧 Troubleshooting

### Voice Sounds Robotic
**Problem:** Using basic system voice
**Solution:**
- Install Enhanced voices (see above)
- Try a different browser (Edge on Windows, Chrome on any platform)
- Check console to see which voice is selected

### No Sound
**Problem:** TTS not working
**Solution:**
- Check browser console for errors
- Ensure site permissions allow audio
- Try refreshing the page
- Check system volume isn't muted

### Wrong Language
**Problem:** Voice speaks in wrong language
**Solution:**
- ADAM uses English (en-US) voices
- Check your system language settings
- Install English voices if not present

---

## 🚀 Future Plans

We're working on adding:
- **Offline high-quality TTS** using Piper or Coqui TTS
- **Cloud TTS option** (ElevenLabs, Google Cloud) with your API key
- **Voice settings panel** to manually select voices
- **Custom voice profiles** per companion

---

## 💡 Pro Tips

1. **Chrome/Edge users**: The online voices (Google/Microsoft Neural) are the best quality but require internet
2. **macOS users**: Download the "Enhanced" voice versions - they're worth the disk space
3. **Privacy-conscious**: Download offline Enhanced voices instead of using online voices
4. **Testing**: Say "Hello, how are you?" to test voice quality
5. **Check console**: Always check what voice was selected (press F12)

---

## 📊 Voice Quality Comparison

| Voice Type | Quality | Size | Internet | Platform |
|------------|---------|------|----------|----------|
| Google voices | ⭐⭐⭐⭐⭐ | 0MB | Required | Chrome |
| MS Neural voices | ⭐⭐⭐⭐⭐ | 0MB | Required | Edge |
| Apple Enhanced | ⭐⭐⭐⭐ | 100-300MB | No | macOS/iOS |
| Apple Standard | ⭐⭐⭐ | 50MB | No | macOS/iOS |
| System voices | ⭐⭐ | Varies | No | All |

---

Need help? Check the console (F12) to see which voice ADAM selected!

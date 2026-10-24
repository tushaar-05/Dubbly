# Dubbly — AI Video Dubbing & Translation Studio

> A fast, secure desktop application built with Electron, React, and Vite that automates video transcription, multilingual translation, neural voiceover synthesis, timeline synchronization, subtitle export, and on-screen text OCR.

---

## 🌟 Key Features

1. **High-Fidelity Audio Extraction**
   - Automatically extracts audio from selected videos into 16 kHz 16-bit mono WAV format optimized for speech recognition using native FFmpeg.
2. **Local Speech Recognition (whisper.cpp)**
   - Transcribes spoken English speech with precise millisecond timestamps entirely on-device using `whisper.cpp` and GGML models.
3. **Multilingual Indian Language Translation**
   - Translates spoken transcripts into **6 Indian languages**: Hindi (हिंदी), Marathi (मराठी), Bengali (বাংলা), Gujarati (ગુજરાતી), Tamil (தமிழ்), and Telugu (తెలుగు).
4. **Interactive Script Editor & Cache**
   - Edit, refine, or rewrite translated sentences before generating speech. Preserves segment IDs and timestamps while reusing previously synthesized voice clips through deterministic SHA-256 caching.
5. **Neural Voiceover Synthesis (Edge TTS)**
   - Synthesizes natural, human-like voiceovers for each translated segment using Microsoft Edge Neural TTS with multiple male and female regional voices.
6. **Lossless Timeline Synchronization & Dubbed Video Export**
   - Places voice clips at their exact original timestamps, inserts silence, and intelligently adjusts pacing (up to 1.25x max speed limit) to match visual timing.
   - Combines the new audio track with the original video losslessly (`-c:v copy`), preserving 100% of original visual quality at near-instantaneous export speeds.
7. **Timed Subtitle Export (.SRT & .VTT)**
   - Exports synchronized subtitles using final user-edited translations in standard SubRip (`.srt`, comma delimiters) and WebVTT (`.vtt`, period delimiters) formats.
8. **On-Screen Text Detection (OCR)**
   - Samples video frames at sensible intervals (default: every 2 seconds) and extracts visible titles, lower thirds, and banner text with Tesseract OCR.
   - Translates detected text while strictly isolating visual text from the spoken voiceover and subtitle pipelines.
9. **Built-in System Environment Diagnostics**
   - An interactive, one-click preflight checklist that verifies all external tools, speech models, and network access before you begin.

---

## 📋 Prerequisites & External Tools

Dubbly leverages optimized native CLI binaries for performance, security, and offline speech recognition.

| Tool | Category | Requirement | Installation / Setup Command |
| :--- | :--- | :--- | :--- |
| **Node.js** | Runtime | **Required** (v18+) | [nodejs.org](https://nodejs.org/) or `brew install node` |
| **FFmpeg & ffprobe** | Video/Audio Processing | **Required** | macOS: `brew install ffmpeg`<br>Ubuntu/Debian: `sudo apt install ffmpeg` |
| **whisper.cpp** | Local Speech-to-Text | **Required** | macOS: `brew install whisper-cpp`<br>Or download from [whisper.cpp releases](https://github.com/ggerganov/whisper.cpp/releases) and place `whisper-cli` in your PATH |
| **Whisper GGML Model** | Speech Model | **Required** | Download `ggml-tiny.en.bin` or `ggml-base.en.bin` into `models/`: <br>`curl -L -o models/ggml-tiny.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin` |
| **Edge TTS (Python)** | Neural TTS Provider | **Required** | `pip3 install edge-tts` (requires Python 3.8+) |
| **Tesseract OCR** | On-Screen Text Detection | **Optional** | macOS: `brew install tesseract`<br>Ubuntu/Debian: `sudo apt install tesseract-ocr` |
| **Internet Access** | Cloud Services | **Required** | Active internet connection for Google Translate and Microsoft Edge Neural TTS |

---

## 🚀 Quick Start & Development Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/example/Dubbly.git
cd Dubbly
npm install
```

### 2. Download the Whisper GGML Model
Create the `models/` folder and download the lightweight English model (`ggml-tiny.en.bin`, ~77 MB):
```bash
mkdir -p models
curl -L -o models/ggml-tiny.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
```

### 3. Verify External CLI Tools
Check that FFmpeg, whisper.cpp, Edge TTS, and Tesseract are installed:
```bash
ffmpeg -version
whisper-cli --help
edge-tts --version
tesseract --version
```

### 4. Run in Development Mode
Launch the Electron development environment with Hot Module Replacement (HMR):
```bash
npm run dev
```

Click the **System Check** button in the top navigation bar to run an immediate diagnostic scan of your environment.

---

## 📦 Production Build & Packaging

Dubbly uses `electron-vite` and `electron-builder` for multi-platform production builds.

### 1. Build Production Bundles
Compiles the main process, preload script, and React renderer:
```bash
npm run build
```

### 2. Test Unpacked Application
Builds and unpacks the native `.app` bundle without creating disk images:
```bash
npm run build:unpack
```
Output artifact: `dist/mac-arm64/Dubbly.app`

### 3. Package macOS Distributables (.dmg and .zip)
Packages the complete macOS distribution:
```bash
npm run build:mac
```
Output artifacts in `dist/`:
- `Dubbly-1.0.0-arm64.dmg` — Native macOS installer disk image.
- `Dubbly-1.0.0-arm64-mac.zip` — Compressed standalone application archive.

### 4. Cross-Platform Packaging
```bash
npm run build:win    # Windows NSIS Installer (.exe)
npm run build:linux  # Linux AppImage / Debian package (.deb)
```

---

## 🌐 Supported Indian Languages & Voices

| Language | Code | Native Name | Available Neural Voices |
| :--- | :--- | :--- | :--- |
| **Hindi** | `hi` | हिंदी | Madhur (Male, Natural), Swara (Female, Expressive) |
| **Marathi** | `mr` | मराठी | Manohar (Male, Natural), Aarohi (Female, Expressive) |
| **Bengali** | `bn` | বাংলা | Bashkar (Male, Natural), Tanishaa (Female, Expressive) |
| **Gujarati** | `gu` | ગુજરાતી | Niranjan (Male, Natural), Dhwani (Female, Expressive) |
| **Tamil** | `ta` | தமிழ் | Valluvar (Male, Natural), Pallavi (Female, Expressive) |
| **Telugu** | `te` | తెలుగు | Mohan (Male, Natural), Shruti (Female, Expressive) |

---

## 🛠️ Environment Variables & Overrides

If your tools are installed in custom locations, set any of the following environment variables:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `FFMPEG_PATH` | Path to `ffmpeg` binary | `/custom/bin/ffmpeg` |
| `FFPROBE_PATH` | Path to `ffprobe` binary | `/custom/bin/ffprobe` |
| `WHISPER_PATH` | Path to `whisper-cli` or `whisper-cpp` | `/custom/bin/whisper-cli` |
| `WHISPER_MODEL_PATH` | Path to GGML speech model | `/path/to/ggml-base.en.bin` |
| `TESSERACT_PATH` | Path to `tesseract` binary | `/custom/bin/tesseract` |

---

## ❓ Troubleshooting Guide

### 1. "FFmpeg was not found on your system"
- **Cause**: FFmpeg is not installed or not in your system PATH.
- **Fix**: Run `brew install ffmpeg` on macOS, or specify `export FFMPEG_PATH=/path/to/ffmpeg`.

### 2. "whisper.cpp executable (whisper-cli) was not found"
- **Cause**: The `whisper-cli` binary is missing.
- **Fix**: Run `brew install whisper-cpp` on macOS, or download the binary from [whisper.cpp releases](https://github.com/ggerganov/whisper.cpp/releases) and place it in `./bin/whisper-cli`.

### 3. "Whisper speech model not found"
- **Cause**: No `.bin` model file exists in `models/` or app storage.
- **Fix**: Download the model using:
  ```bash
  curl -L -o models/ggml-tiny.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
  ```

### 4. "Edge TTS (Python) is not installed or not in PATH"
- **Cause**: The `edge-tts` package is not installed in your active Python environment.
- **Fix**: Run `pip3 install edge-tts` in your terminal. Ensure Python 3.8+ is installed.

### 5. "Network error: Unable to connect to Google Translate"
- **Cause**: The machine cannot reach translation or voiceover servers.
- **Fix**: Check your internet connection or proxy settings. Google Translate and Microsoft Edge TTS require outgoing HTTPS access.

### 6. Subtitles or OCR Path Permissions on macOS
- **Cause**: macOS sandboxing or symlinks in `/tmp` and `/var`.
- **Fix**: Dubbly uses canonical path resolution (`fs.realpathSync`) to bypass symlink issues and standard native Electron save dialogs (`dialog.showSaveDialog`) for safe exports.

---

## 🔒 Security Architecture

- **Context Isolation**: Enabled (`contextIsolation: true`) in Electron's `webPreferences`.
- **Node Integration Disabled**: Renderer runs in a secure browser sandbox (`nodeIntegration: false`).
- **Strict Content Security Policy (CSP)**: Prohibits arbitrary script injection and permits only local media and in-memory blobs (`media-src 'self' blob: data:`).
- **Strict IPC Validation**: All file paths, segment arrays, and options passed across IPC channels are type-checked and validated before disk or shell operations.

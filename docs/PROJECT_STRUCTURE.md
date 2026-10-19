# Dubbly — Project Architecture & Structure

Welcome to the **Dubbly** architecture guide. Dubbly is an Electron + React desktop application designed to take an English video, transcribe its speech, translate it into six Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati), generate natural neural voiceovers, synchronize timing, translate on-screen text via OCR, and export the dubbed video with optional subtitles.

---

## 1. High-Level Architecture: How Electron Works

Dubbly uses the standard three-tier architecture of Electron:

```
┌────────────────────────────────────────────────────────┐
│                   Renderer Process                     │
│                (React 19 + Plain CSS)                  │
│  - User Interface: Drag & drop video, controls, etc.   │
│  - Runs inside sandboxed Chromium browser              │
└───────────────────────────┬────────────────────────────┘
                            │ (Safe IPC calls)
┌───────────────────────────▼────────────────────────────┐
│                    Preload Script                      │
│       (contextBridge: window.electron, window.api)     │
│  - Securely exposes only specific bridge functions     │
│  - Prevents renderer from directly accessing OS/Node   │
└───────────────────────────┬────────────────────────────┘
                            │ (ipcRenderer <-> ipcMain)
┌───────────────────────────▼────────────────────────────┐
│                     Main Process                       │
│                   (Node.js Engine)                     │
│  - Manages BrowserWindow and app lifecycle             │
│  - Accesses OS file system and runs native binaries    │
│  - Orchestrates: FFmpeg, Whisper, Edge-TTS, OCR        │
└────────────────────────────────────────────────────────┘
```

### Why Heavy Tasks Run in the Main Process
The Chromium renderer is sandboxed for security and runs on a single UI thread. If heavy video processing (FFmpeg) or AI transcription (Whisper) ran directly in the renderer:
1. It would lack permission to run OS-level command-line tools.
2. The entire user interface would freeze and become unresponsive.

Therefore, the **Main Process** acts as the backend orchestrator, while the **Renderer Process** remains fast, responsive, and purely responsible for the user interface.

---

## 2. Directory & File Structure

```text
Dubbly/
├── docs/                                # Documentation for developers & university viva
│   └── PROJECT_STRUCTURE.md             # This architecture document
├── resources/                           # Application icons and app assets
│   └── icon.png
├── build/                               # Packaging assets (macOS plists, icons)
├── src/                                 # All application source code
│   ├── main/                            # Electron Main Process (Node.js Backend)
│   │   ├── index.js                     # Main entry: window creation, app lifecycle
│   │   ├── ipc/                         # IPC (Inter-Process Communication) Registry
│   │   │   └── index.js                 # Registers IPC handlers for video, TTS, etc.
│   │   └── services/                    # Core business logic modules
│   │       ├── video/                   # Video processing & FFmpeg operations
│   │       │   └── index.js             # Audio extraction, muxing, video export
│   │       ├── transcription/           # Speech-to-text engine
│   │       │   └── index.js             # Whisper.cpp integration & timestamping
│   │       ├── translation/             # Multilingual translation engine
│   │       │   └── index.js             # English -> 6 Indian languages
│   │       ├── tts/                     # Text-to-Speech synthesis
│   │       │   └── index.js             # Edge-TTS voice synthesis
│   │       ├── timing/                  # Audio-to-video timing synchronization
│   │       │   └── index.js             # Speed matching, padding, audio stitching
│   │       └── ocr/                     # On-screen optical character recognition
│   │           └── index.js             # Text frame detection and translation
│   │
│   ├── preload/                         # Secure bridge between Main and Renderer
│   │   └── index.js                     # contextBridge exposing window.electron & window.api
│   │
│   └── renderer/                        # React Frontend (Chromium UI)
│       ├── index.html                   # HTML entry point loaded by Electron
│       └── src/
│           ├── main.jsx                 # React root DOM initialization
│           ├── App.jsx                  # Main application component
│           ├── assets/                  # CSS stylesheets, icons, SVGs
│           │   ├── base.css             # Base reset CSS
│           │   └── main.css             # Component and layout styling
│           ├── components/              # Reusable React UI components
│           │   └── Versions.jsx         # Component displaying Electron/Node versions
│           ├── services/                # Frontend API bridge client
│           │   └── api.js               # Clean async calls to window.api
│           └── utils/                   # Frontend helper utilities
│               └── formatters.js        # Duration & file size formatting helpers
│
├── electron.vite.config.mjs             # Vite build configuration for main, preload & renderer
├── electron-builder.yml                 # Packaging configuration for Windows, macOS, Linux
├── package.json                         # Project dependencies and npm scripts
└── package-lock.json                    # Locked dependency versions
```

---

## 3. Explaining Key Modules

### `src/main/services/video/`
Handles video input/output operations using FFmpeg:
- Extracting raw audio from the input English video.
- Merging the newly dubbed Indian language voiceover with ducked/reduced background sound.
- Hardcoding or softcoding translated subtitles onto the video.
- Rendering and saving the final exported video file.

### `src/main/services/transcription/`
Speech-to-Text (STT) module:
- Takes extracted audio and processes it using **whisper.cpp**.
- Produces precise timecoded segments (start time, end time, spoken English text).
- Formats transcripts into standard SRT or JSON subtitle formats.

### `src/main/services/translation/`
Translates English text into the 6 supported Indian languages:
- **Hindi (`hi`)**
- **Bengali (`bn`)**
- **Tamil (`ta`)**
- **Telugu (`te`)**
- **Marathi (`mr`)**
- **Gujarati (`gu`)**
- Preserves timestamp boundaries so translated text maps directly to the original speaking intervals.

### `src/main/services/tts/`
Text-to-Speech synthesis:
- Takes translated sentences and sends them to **edge-tts** (or local TTS).
- Produces natural, fluent neural voice audio for each segment in the selected target language.

### `src/main/services/timing/`
Timing and speech rate adjustment:
- English sentences and Indian language translations often differ in syllable count and duration.
- This service calculates the exact duration difference and adjusts speech rate (time-stretching without pitch shift) or adds natural pauses to ensure the voiceover syncs with the speaker on screen.

### `src/main/services/ocr/`
On-screen text translation:
- Extracts video frames at key intervals.
- Uses Optical Character Recognition (OCR) to detect English words shown on screen (e.g., slides, signs, captions).
- Translates the detected text and creates translated overlays or notes.

### `src/main/ipc/`
Inter-Process Communication:
- Acts as the controller connecting the frontend to the backend services.
- Receives commands (e.g., `video:start-dubbing`, `video:extract-audio`) from React, delegates to the appropriate service, and sends live progress updates (percentage, stage) back to the UI.

---

## 4. Dubbly End-to-End Processing Pipeline

```
1. Video Input 
   └─ User selects an English video (.mp4, .mkv, .mov).
2. Audio Extraction
   └─ FFmpeg extracts a clean 16kHz WAV audio track.
3. Transcription
   └─ Whisper.cpp produces timecoded English segments [00:01 - 00:04: "Welcome to Dubbly"].
4. Translation
   └─ English segments are translated into the chosen Indian language (e.g., Hindi).
5. Voiceover Synthesis
   └─ Edge-TTS generates audio clips for each translated segment.
6. Timing Alignment
   └─ Audio clips are speed-matched to fit original segment durations.
7. OCR (Optional)
   └─ On-screen English text is detected and translated.
8. Video Muxing
   └─ FFmpeg combines original video + new dubbed audio + subtitles into the final export.
```

---

## 5. University Viva / Interview Preparation Notes

### Q1: Why use Electron + React instead of a pure web app?
> **Answer**: A pure web app running in a browser cannot execute local command-line tools like FFmpeg or local AI models like Whisper without uploading large video files to an expensive remote server. Electron provides a desktop environment with Node.js filesystem and child process access, allowing all video processing to happen locally and privately on the user's machine for free.

### Q2: What is the Preload script and why is Context Isolation important?
> **Answer**: Context Isolation separates the website/renderer context from the Electron internal context. The Preload script uses `contextBridge.exposeInMainWorld` to expose only safe, predefined IPC channels to the frontend. This prevents malicious scripts or dependencies from gaining unauthorized access to the operating system or Node.js APIs.

### Q3: Why separate the services into distinct folders under `src/main/services`?
> **Answer**: Modular Separation of Concerns (SoC). Each step in the dubbing pipeline (video editing, transcription, translation, TTS, timing, OCR) has distinct responsibilities and dependencies. Isolating them makes the codebase easier to test, debug, maintain, and upgrade independently.

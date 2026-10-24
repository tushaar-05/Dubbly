import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * Custom, secure API bridge for the Dubbly renderer.
 *
 * Exposes only safe, specific methods to the window.api global object.
 * Does NOT expose raw child_process, fs, or shell execution.
 */
const api = {
  // Application Information & Diagnostics (Phase 12)
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  checkEnvironment: () => ipcRenderer.invoke('system:check-environment'),

  /**
   * Safely retrieve the absolute filesystem path of a DOM File object in Electron.
   * Uses modern Electron webUtils.getPathForFile, falling back to file.path.
   *
   * @param {File} file
   * @returns {string|null}
   */
  getPathForFile: (file) => {
    if (!file) return null
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file)
      }
    } catch {
      // Fall through to file.path if webUtils throws
    }
    return file.path || null
  },

  /**
   * Request audio extraction from the selected video file
   * @param {string} videoPath - Absolute filesystem path of the video
   * @returns {Promise<{
   *   success: boolean,
   *   outputPath: string,
   *   filename: string,
   *   sizeBytes: number,
   *   format: string
   * }>}
   */
  extractAudio: (videoPath) => ipcRenderer.invoke('video:extract-audio', { videoPath }),

  /**
   * Read extracted WAV audio data for safe playback in the React UI
   * @param {string} audioPath - Absolute filesystem path of the extracted WAV
   * @returns {Promise<string>} Base64-encoded audio data
   */
  readAudioData: (audioPath) => ipcRenderer.invoke('video:read-audio-data', { audioPath }),

  /**
   * Request speech-to-text transcription via whisper.cpp (Phase 5)
   * @param {string} audioPath - Absolute filesystem path of extracted 16kHz WAV
   * @param {string} [modelPath] - Optional custom model path
   * @returns {Promise<{
   *   success: boolean,
   *   language: string,
   *   model: string,
   *   segmentCount: number,
   *   fullText: string,
   *   segments: Array<{
   *     id: number,
   *     startTime: string,
   *     endTime: string,
   *     startMs: number,
   *     endMs: number,
   *     durationSec: string,
   *     text: string
   *   }>
   * }>}
   */
  transcribeAudio: (audioPath, modelPath) =>
    ipcRenderer.invoke('transcription:transcribe-audio', { audioPath, modelPath }),

  /**
   * Request transcript translation into Indian languages via Google Translate (Phase 6)
   * @param {Array} segments - Array of Whisper transcript segments
   * @param {string} targetLanguage - Target Indian language code (hi, mr, bn, gu, ta, te)
   * @returns {Promise<object>}
   */
  translateTranscript: (segments, targetLanguage) =>
    ipcRenderer.invoke('translation:translate-transcript', { segments, targetLanguage }),

  /**
   * Request voiceover audio generation for translated segments via Edge TTS (Phase 7)
   * @param {Array} segments - Array of translated segments
   * @param {string} targetLanguage - Language code (hi, mr, bn, gu, ta, te)
   * @param {string} [voice] - Optional neural voice identifier
   * @returns {Promise<object>}
   */
  generateSpeech: (segments, targetLanguage, voice) =>
    ipcRenderer.invoke('tts:generate-speech', { segments, targetLanguage, voice }),

  /**
   * Read generated TTS MP3 audio clip for safe in-app playback
   * @param {string} clipPath - Absolute path to .mp3 clip inside temporary dubbly_tts directory
   * @returns {Promise<string>} Base64-encoded audio data
   */
  readTtsAudioClip: (clipPath) =>
    ipcRenderer.invoke('tts:read-audio-clip', { clipPath }),

  /**
   * Retrieve available Indian neural voices configuration
   * @param {string} [language]
   * @returns {Promise<object>}
   */
  getTtsVoices: (language) =>
    ipcRenderer.invoke('tts:get-voices', { language }),

  /**
   * Export dubbed video with synchronized audio track (Phase 8)
   * @param {string} videoPath - Absolute filesystem path of original video
   * @param {Array} clips - Synthesized voice clips with timestamps
   * @param {string} targetLanguage - Target language code (hi, mr, bn, gu, ta, te)
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  exportDubbedVideo: (videoPath, clips, targetLanguage, options) =>
    ipcRenderer.invoke('video:export-dubbed', { videoPath, clips, targetLanguage, options }),

  /**
   * Read exported dubbed video data for in-app HTML5 preview
   * @param {string} videoPath - Absolute path to exported .mp4 inside temporary dubbly_exports directory
   * @returns {Promise<string>} Base64-encoded video data
   */
  readExportedVideo: (videoPath) =>
    ipcRenderer.invoke('video:read-exported-video', { videoPath }),

  /**
   * Open exported file location in macOS Finder / system file explorer
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>}
   */
  showInFolder: (filePath) =>
    ipcRenderer.invoke('video:show-in-folder', { filePath }),

  /**
   * Subscribe to asynchronous pipeline progress updates (Phase 9)
   * @param {Function} callback - (progress: { operation, current, total, percent, message }) => void
   * @returns {Function} Unsubscribe function
   */
  onProgress: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_, data) => callback(data)
    ipcRenderer.on('pipeline:progress', listener)
    return () => {
      ipcRenderer.removeListener('pipeline:progress', listener)
    }
  },

  /**
   * Export translated script subtitles to SRT or WebVTT format (Phase 10)
   * @param {Array} segments - Translated transcript segments
   * @param {'srt'|'vtt'} [format='srt'] - Subtitle format
   * @param {object} [options] - Export options (videoName, targetLanguage, destinationPath)
   * @returns {Promise<{
   *   success: boolean,
   *   canceled?: boolean,
   *   format: string,
   *   filePath: string,
   *   filename: string,
   *   sizeBytes: number,
   *   segmentCount: number,
   *   content: string
   * }>}
   */
  exportSubtitles: (segments, format, options) =>
    ipcRenderer.invoke('subtitles:export', { segments, format, options }),

  /**
   * Generate subtitle text for in-app preview without writing to disk (Phase 10)
   * @param {Array} segments - Translated transcript segments
   * @param {'srt'|'vtt'} [format='srt'] - Subtitle format
   * @param {object} [options]
   * @returns {Promise<string>}
   */
  generateSubtitlesPreview: (segments, format, options) =>
    ipcRenderer.invoke('subtitles:generate-preview', { segments, format, options }),

  /**
   * Detect visible on-screen text inside video using Tesseract OCR (Phase 11)
   * @param {string} videoPath - Absolute video file path
   * @param {object} [options] - Options (intervalSec)
   * @returns {Promise<{
   *   success: boolean,
   *   count: number,
   *   items: Array<object>,
   *   intervalSec: number,
   *   sampledFrames: number,
   *   message?: string
   * }>}
   */
  detectVideoText: (videoPath, options) =>
    ipcRenderer.invoke('ocr:detect', { videoPath, ...options }),

  /**
   * Translate detected on-screen text into the target language (Phase 11)
   * @param {Array<object>} items - Detected OCR items
   * @param {string} targetLanguage - Target language code (hi, mr, bn, gu, ta, te)
   * @returns {Promise<{
   *   success: boolean,
   *   targetLanguage: string,
   *   targetLanguageName: string,
   *   count: number,
   *   items: Array<object>
   * }>}
   */
  translateOcrText: (items, targetLanguage) =>
    ipcRenderer.invoke('ocr:translate', { items, targetLanguage }),

  /**
   * Subscribe to OCR detection and translation progress updates (Phase 11)
   * @param {Function} callback - Progress listener
   * @returns {Function} Unsubscribe function
   */
  onOcrProgress: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_, data) => callback(data)
    ipcRenderer.on('ocr:progress', listener)
    ipcRenderer.on('ocr:translate-progress', listener)
    return () => {
      ipcRenderer.removeListener('ocr:progress', listener)
      ipcRenderer.removeListener('ocr:translate-progress', listener)
    }
  }
}

// Expose APIs to renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose APIs via contextBridge:', error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

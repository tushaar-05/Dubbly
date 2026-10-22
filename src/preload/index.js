import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * Custom, secure API bridge for the Dubbly renderer.
 *
 * Exposes only safe, specific methods to the window.api global object.
 * Does NOT expose raw child_process, fs, or shell execution.
 */
const api = {
  // Application Information
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),

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
    ipcRenderer.invoke('tts:get-voices', { language })
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

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
  readAudioData: (audioPath) => ipcRenderer.invoke('video:read-audio-data', { audioPath })
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

/**
 * Dubbly Renderer API Service
 *
 * Secure frontend wrapper around window.api (exposed by preload contextBridge).
 * Isolates React components from direct Electron dependencies.
 */

export const apiService = {
  /**
   * Get application version from main process via IPC
   * @returns {Promise<string>}
   */
  async getAppVersion() {
    try {
      if (window.api && typeof window.api.getAppVersion === 'function') {
        return await window.api.getAppVersion()
      }
      return '1.0.0'
    } catch (error) {
      console.error('Error invoking app:get-version:', error)
      return '1.0.0'
    }
  },

  /**
   * Get application metadata from main process via IPC
   * @returns {Promise<{ name: string, version: string }>}
   */
  async getAppInfo() {
    try {
      if (window.api && typeof window.api.getAppInfo === 'function') {
        return await window.api.getAppInfo()
      }
      return { name: 'Dubbly', version: '1.0.0' }
    } catch (error) {
      console.error('Error invoking app:get-info:', error)
      return { name: 'Dubbly', version: '1.0.0' }
    }
  },

  /**
   * Safely obtain the file path of a selected File object in Electron
   * @param {File} file
   * @returns {string|null}
   */
  getPathForFile(file) {
    if (!file) return null
    if (window.api && typeof window.api.getPathForFile === 'function') {
      return window.api.getPathForFile(file)
    }
    return file.path || null
  },

  /**
   * Request audio extraction from a video file path via FFmpeg in the main process
   * @param {string} videoPath
   * @returns {Promise<{
   *   success: boolean,
   *   outputPath: string,
   *   filename: string,
   *   sizeBytes: number,
   *   format: string
   * }>}
   */
  async extractAudio(videoPath) {
    if (!videoPath) {
      throw new Error('No video path provided.')
    }
    if (!window.api || typeof window.api.extractAudio !== 'function') {
      throw new Error('Electron audio extraction API is unavailable.')
    }
    return await window.api.extractAudio(videoPath)
  },

  /**
   * Retrieve extracted WAV audio as an in-memory browser Blob URL for playback
   * @param {string} audioPath
   * @returns {Promise<string>} Blob URL (e.g. blob:http://localhost:5173/...)
   */
  async getAudioBlobUrl(audioPath) {
    if (!window.api || typeof window.api.readAudioData !== 'function') {
      throw new Error('Audio reader API is unavailable.')
    }
    const base64Data = await window.api.readAudioData(audioPath)
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'audio/wav' })
    return URL.createObjectURL(blob)
  }
}

export default apiService

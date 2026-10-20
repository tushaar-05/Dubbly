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
  },

  /**
   * Request speech-to-text transcription via whisper.cpp in the main process (Phase 5)
   * @param {string} audioPath - Path to extracted WAV audio
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
  async transcribeAudio(audioPath, modelPath) {
    if (!audioPath) {
      throw new Error('No audio path provided for transcription.')
    }
    if (!window.api || typeof window.api.transcribeAudio !== 'function') {
      throw new Error('Electron transcription API is unavailable.')
    }
    return await window.api.transcribeAudio(audioPath, modelPath)
  },

  /**
   * Request transcript translation into Indian languages via main process (Phase 6)
   * @param {Array} segments - Array of Whisper transcript segments
   * @param {string} targetLanguage - Target language code (hi, mr, bn, gu, ta, te)
   * @returns {Promise<{
   *   success: boolean,
   *   sourceLanguage: string,
   *   targetLanguage: string,
   *   targetLanguageName: string,
   *   targetLanguageNative: string,
   *   segmentCount: number,
   *   fullTranslatedText: string,
   *   segments: Array<{
   *     id: number,
   *     startTime: string,
   *     endTime: string,
   *     startMs: number,
   *     endMs: number,
   *     durationSec: string,
   *     originalText: string,
   *     translatedText: string
   *   }>
   * }>}
   */
  async translateTranscript(segments, targetLanguage) {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error('Cannot translate: No transcript segments available.')
    }
    if (!targetLanguage) {
      throw new Error('No target language specified.')
    }
    if (!window.api || typeof window.api.translateTranscript !== 'function') {
      throw new Error('Electron translation API is unavailable.')
    }
    return await window.api.translateTranscript(segments, targetLanguage)
  }
}

export default apiService

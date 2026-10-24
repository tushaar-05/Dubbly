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
  },

  /**
   * Request voiceover audio generation for translated segments via Edge TTS (Phase 7)
   * @param {Array} segments - Translated transcript segments
   * @param {string} targetLanguage - Indian language code (hi, mr, bn, gu, ta, te)
   * @param {string} [voice] - Optional neural voice identifier
   * @returns {Promise<{
   *   success: boolean,
   *   provider: string,
   *   targetLanguage: string,
   *   voice: string,
   *   totalSegments: number,
   *   generatedCount: number,
   *   outputDirectory: string,
   *   clips: Array<object>
   * }>}
   */
  async generateSpeech(segments, targetLanguage, voice) {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error('Cannot generate speech: No transcript segments available.')
    }
    if (!targetLanguage) {
      throw new Error('No target language specified for voiceover generation.')
    }
    if (!window.api || typeof window.api.generateSpeech !== 'function') {
      throw new Error('Electron TTS generation API is unavailable.')
    }
    return await window.api.generateSpeech(segments, targetLanguage, voice)
  },

  /**
   * Read generated TTS MP3 audio clip as an in-memory browser Blob URL for playback
   * @param {string} clipPath - Absolute filesystem path of the .mp3 clip
   * @returns {Promise<string>} Blob URL (e.g. blob:http://localhost:5173/...)
   */
  async getTtsAudioBlobUrl(clipPath) {
    if (!clipPath) {
      throw new Error('No audio clip path provided.')
    }
    if (!window.api || typeof window.api.readTtsAudioClip !== 'function') {
      throw new Error('TTS audio reader API is unavailable.')
    }
    const base64Data = await window.api.readTtsAudioClip(clipPath)
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'audio/mpeg' })
    return URL.createObjectURL(blob)
  },

  /**
   * Retrieve available Indian neural voices
   * @param {string} [language]
   * @returns {Promise<object>}
   */
  async getTtsVoices(language) {
    if (window.api && typeof window.api.getTtsVoices === 'function') {
      return await window.api.getTtsVoices(language)
    }
    return null
  },

  /**
   * Request video dubbing and export (Phase 8)
   * @param {string} videoPath - Absolute path to original video
   * @param {Array} clips - Synthesized voice clips
   * @param {string} targetLanguage - Target language code
   * @param {object} [options]
   * @returns {Promise<{
   *   success: boolean,
   *   outputPath: string,
   *   filename: string,
   *   sizeBytes: number,
   *   format: string,
   *   durationSec: number,
   *   timedClipsCount: number,
   *   adjustedClipsCount: number
   * }>}
   */
  async exportDubbedVideo(videoPath, clips, targetLanguage, options = {}) {
    if (!videoPath) {
      throw new Error('No video path provided for export.')
    }
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      throw new Error('No voice clips available for video export.')
    }
    if (!window.api || typeof window.api.exportDubbedVideo !== 'function') {
      throw new Error('Electron video export API is unavailable.')
    }
    return await window.api.exportDubbedVideo(videoPath, clips, targetLanguage, options)
  },

  /**
   * Read exported dubbed video data and return an in-memory browser Blob URL for preview
   * @param {string} videoPath - Path to exported .mp4 file
   * @returns {Promise<string>} Blob URL (e.g. blob:http://localhost:5173/...)
   */
  async getExportedVideoBlobUrl(videoPath) {
    if (!videoPath) {
      throw new Error('No video path provided.')
    }
    if (!window.api || typeof window.api.readExportedVideo !== 'function') {
      throw new Error('Exported video reader API is unavailable.')
    }
    const base64Data = await window.api.readExportedVideo(videoPath)
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'video/mp4' })
    return URL.createObjectURL(blob)
  },

  /**
   * Open exported file in system file explorer (Finder on macOS)
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async showInFolder(filePath) {
    if (!filePath) return false
    if (window.api && typeof window.api.showInFolder === 'function') {
      return await window.api.showInFolder(filePath)
    }
    return false
  },

  /**
   * Listen for pipeline progress updates from the main process (Phase 9)
   * @param {Function} callback
   * @returns {Function} Unsubscribe cleanup function
   */
  onProgress(callback) {
    if (window.api && typeof window.api.onProgress === 'function') {
      return window.api.onProgress(callback)
    }
    return () => {}
  },

  /**
   * Export translated script subtitles to SRT or WebVTT format (Phase 10)
   * @param {Array} segments - Translated transcript segments
   * @param {'srt'|'vtt'} [format='srt'] - Subtitle format
   * @param {object} [options] - Export options
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
  async exportSubtitles(segments, format = 'srt', options = {}) {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error('Cannot export subtitles: No transcript segments available.')
    }
    if (!window.api || typeof window.api.exportSubtitles !== 'function') {
      throw new Error('Electron subtitle export API is unavailable.')
    }
    return await window.api.exportSubtitles(segments, format, options)
  },

  /**
   * Generate subtitle text for in-app preview without writing to disk (Phase 10)
   * @param {Array} segments
   * @param {'srt'|'vtt'} [format='srt']
   * @param {object} [options]
   * @returns {Promise<string>}
   */
  async generateSubtitlesPreview(segments, format = 'srt', options = {}) {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error('Cannot preview subtitles: No transcript segments provided.')
    }
    if (!window.api || typeof window.api.generateSubtitlesPreview !== 'function') {
      throw new Error('Electron subtitle preview API is unavailable.')
    }
    return await window.api.generateSubtitlesPreview(segments, format, options)
  },

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
  async detectVideoText(videoPath, options = {}) {
    if (!videoPath) {
      throw new Error('Cannot detect text: No video file path provided.')
    }
    if (!window.api || typeof window.api.detectVideoText !== 'function') {
      throw new Error('Electron OCR detection API is unavailable.')
    }
    return await window.api.detectVideoText(videoPath, options)
  },

  /**
   * Translate detected on-screen text items into target Indian language (Phase 11)
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
  async translateOcrText(items, targetLanguage) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No on-screen text items provided for translation.')
    }
    if (!targetLanguage) {
      throw new Error('No target language specified for on-screen text translation.')
    }
    if (!window.api || typeof window.api.translateOcrText !== 'function') {
      throw new Error('Electron OCR translation API is unavailable.')
    }
    return await window.api.translateOcrText(items, targetLanguage)
  },

  /**
   * Listen to OCR detection and translation progress events (Phase 11)
   * @param {Function} callback
   * @returns {Function} Unsubscribe
   */
  onOcrProgress(callback) {
    if (window.api && typeof window.api.onOcrProgress === 'function') {
      return window.api.onOcrProgress(callback)
    }
    return () => {}
  }
}

export default apiService

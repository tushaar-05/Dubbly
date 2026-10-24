/**
 * Text Translation Service
 *
 * Translates English transcript segments into 6 Indian languages:
 * Hindi (hi), Marathi (mr), Bengali (bn), Gujarati (gu), Tamil (ta), and Telugu (te).
 *
 * Utilizes Google Translate's free client translation endpoint with standard Node.js fetch,
 * preserving timing intervals, segment IDs, and original text without extra dependencies.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' }
]

/**
 * Translate a single string of text.
 *
 * @param {string} text - Input English text
 * @param {string} targetLang - Target language code (hi, mr, bn, gu, ta, te)
 * @param {string} [sourceLang='en'] - Source language code
 * @returns {Promise<string>} Translated text string
 */
export async function translateSingleText(text, targetLang, sourceLang = 'en') {
  if (!text || !text.trim()) {
    return ''
  }

  const cleanText = text.trim()
  const targetLangLower = targetLang.toLowerCase()

  // Verify target language is supported
  const isSupported = SUPPORTED_LANGUAGES.some((l) => l.code === targetLangLower)
  if (!isSupported) {
    throw new Error(
      `Unsupported target language "${targetLang}". Supported languages: ${SUPPORTED_LANGUAGES.map(
        (l) => l.name
      ).join(', ')}.`
    )
  }

  // Google Translate web client endpoint
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sourceLang}&tl=${targetLangLower}&q=${encodeURIComponent(
    cleanText
  )}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    })

    if (response.status === 429) {
      throw new Error(
        'Google Translate rate limit reached (HTTP 429). Please wait a few seconds before trying again.'
      )
    }

    if (!response.ok) {
      throw new Error(
        `Translation service responded with HTTP status ${response.status}: ${response.statusText}`
      )
    }

    const data = await response.json()

    // Google Translate returns array of string segments: [ "translated text" ] or nested arrays
    if (Array.isArray(data)) {
      if (typeof data[0] === 'string') {
        return data.join(' ').trim()
      }
      if (Array.isArray(data[0])) {
        return data[0].map((item) => (Array.isArray(item) ? item[0] : item)).join('').trim()
      }
    }

    return String(data).trim()
  } catch (error) {
    // Provide user-friendly diagnostics for network errors
    if (error.name === 'TimeoutError') {
      throw new Error('Translation timed out. Please check your internet connection.')
    }
    if (error.message.includes('fetch failed') || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(
        'Network error: Unable to connect to Google Translate. Please ensure your device is connected to the internet.'
      )
    }
    throw error
  }
}

/**
 * Translation Service
 */
export const translationService = {
  /**
   * Translate an array of transcript segments while preserving segment IDs and timing.
   *
   * @param {Array<{
   *   id: number,
   *   startTime: string,
   *   endTime: string,
   *   startMs: number,
   *   endMs: number,
   *   durationSec: string,
   *   text: string
   * }>} segments - Transcript segments from Whisper
   * @param {string} targetLang - Target language code (hi, mr, bn, gu, ta, te)
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
  async translateTranscript(segments, targetLang, options = {}) {
    // 1. Validate segments input
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error(
        'Empty transcript: Cannot translate because no speech segments were provided. Please transcribe audio first.'
      )
    }

    // 2. Validate target language
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === (targetLang || '').toLowerCase())
    if (!langObj) {
      throw new Error(
        `Invalid or unsupported target language "${targetLang}". Supported: ${SUPPORTED_LANGUAGES.map(
          (l) => l.name
        ).join(', ')}.`
      )
    }

    const translatedSegments = []

    // 3. Translate each segment preserving original IDs and timing
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const origText = (seg.text || seg.originalText || '').trim()

      if (typeof options.onProgress === 'function') {
        options.onProgress({
          operation: 'translation',
          current: i + 1,
          total: segments.length,
          percent: Math.round(((i + 1) / segments.length) * 100),
          message: `Translating segment ${i + 1} of ${segments.length} to ${langObj.name}...`
        })
      }

      let translated = ''
      if (origText.length > 0) {
        translated = await translateSingleText(origText, langObj.code, 'en')
        // Gentle delay between segment requests to avoid burst rate limits
        await new Promise((resolve) => setTimeout(resolve, 60))
      }

      translatedSegments.push({
        id: seg.id,
        startTime: seg.startTime,
        endTime: seg.endTime,
        startMs: seg.startMs,
        endMs: seg.endMs,
        durationSec: seg.durationSec,
        originalText: origText,
        translatedText: translated,
        originalTranslatedText: translated,
        isEdited: false
      })
    }

    const fullTranslatedText = translatedSegments
      .map((s) => s.translatedText)
      .filter((t) => t.length > 0)
      .join(' ')
      .trim()

    return {
      success: true,
      sourceLanguage: 'en',
      targetLanguage: langObj.code,
      targetLanguageName: langObj.name,
      targetLanguageNative: langObj.native,
      segmentCount: translatedSegments.length,
      fullTranslatedText,
      segments: translatedSegments
    }
  }
}

export default translationService

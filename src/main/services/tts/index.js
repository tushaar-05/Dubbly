import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import electron from 'electron'
const app = electron && electron.app ? electron.app : electron
import edgeTtsProvider from './providers/edgeTts.js'

/**
 * Compute deterministic cache filename based on text, language, and voice settings.
 * If text, language, voice, rate, or volume changes, a completely different hash is produced,
 * guaranteeing stale audio is never reused.
 *
 * @param {string} text
 * @param {string} langKey
 * @param {string} voice
 * @param {string} [rate='+0%']
 * @param {string} [volume='+0%']
 * @returns {string}
 */
export function computeClipCacheKey(text, langKey, voice, rate = '+0%', volume = '+0%') {
  const normText = (text || '').trim()
  const normLang = (langKey || '').toLowerCase()
  const normVoice = (voice || '').trim()
  const hash = crypto
    .createHash('sha256')
    .update(`${normLang}::${normVoice}::${rate}::${volume}::${normText}`)
    .digest('hex')
    .slice(0, 20)
  return `cached_${normLang}_${hash}.mp3`
}

/**
 * Supported Indian Languages & Default Neural Voices
 *
 * Configured with high-quality natural Indian neural voices from Edge TTS:
 * - Hindi (hi): hi-IN-MadhurNeural (Male), hi-IN-SwaraNeural (Female)
 * - Marathi (mr): mr-IN-AarohiNeural (Female), mr-IN-ManoharNeural (Male)
 * - Bengali (bn): bn-IN-BashkarNeural (Male), bn-IN-TanishaaNeural (Female)
 * - Gujarati (gu): gu-IN-DhwaniNeural (Female), gu-IN-NiranjanNeural (Male)
 * - Tamil (ta): ta-IN-ValluvarNeural (Male), ta-IN-PallaviNeural (Female)
 * - Telugu (te): te-IN-MohanNeural (Male), te-IN-ShrutiNeural (Female)
 */
export const INDIAN_VOICES = {
  hi: {
    language: 'Hindi',
    native: 'हिंदी',
    default: 'hi-IN-MadhurNeural',
    voices: [
      { id: 'hi-IN-MadhurNeural', name: 'Madhur (Male, Natural)', gender: 'Male' },
      { id: 'hi-IN-SwaraNeural', name: 'Swara (Female, Expressive)', gender: 'Female' }
    ]
  },
  mr: {
    language: 'Marathi',
    native: 'मराठी',
    default: 'mr-IN-AarohiNeural',
    voices: [
      { id: 'mr-IN-AarohiNeural', name: 'Aarohi (Female, Natural)', gender: 'Female' },
      { id: 'mr-IN-ManoharNeural', name: 'Manohar (Male, Warm)', gender: 'Male' }
    ]
  },
  bn: {
    language: 'Bengali',
    native: 'বাংলা',
    default: 'bn-IN-BashkarNeural',
    voices: [
      { id: 'bn-IN-BashkarNeural', name: 'Bashkar (Male, Natural)', gender: 'Male' },
      { id: 'bn-IN-TanishaaNeural', name: 'Tanishaa (Female, Soft)', gender: 'Female' }
    ]
  },
  gu: {
    language: 'Gujarati',
    native: 'ગુજરાતી',
    default: 'gu-IN-DhwaniNeural',
    voices: [
      { id: 'gu-IN-DhwaniNeural', name: 'Dhwani (Female, Clear)', gender: 'Female' },
      { id: 'gu-IN-NiranjanNeural', name: 'Niranjan (Male, Calm)', gender: 'Male' }
    ]
  },
  ta: {
    language: 'Tamil',
    native: 'தமிழ்',
    default: 'ta-IN-ValluvarNeural',
    voices: [
      { id: 'ta-IN-ValluvarNeural', name: 'Valluvar (Male, Deep)', gender: 'Male' },
      { id: 'ta-IN-PallaviNeural', name: 'Pallavi (Female, Clear)', gender: 'Female' }
    ]
  },
  te: {
    language: 'Telugu',
    native: 'తెలుగు',
    default: 'te-IN-MohanNeural',
    voices: [
      { id: 'te-IN-MohanNeural', name: 'Mohan (Male, Confident)', gender: 'Male' },
      { id: 'te-IN-ShrutiNeural', name: 'Shruti (Female, Warm)', gender: 'Female' }
    ]
  }
}

/**
 * Text-to-Speech (TTS) Service
 *
 * Pluggable architecture that supports generating synchronized voice clips
 * for transcript segments across six Indian languages.
 */
class TtsService {
  constructor() {
    // Default provider is Edge TTS, but can be swapped via setProvider()
    this.activeProvider = edgeTtsProvider
  }

  /**
   * Set a custom TTS provider (e.g., ElevenLabs, Coqui, Azure).
   * @param {object} provider
   */
  setProvider(provider) {
    if (!provider || typeof provider.synthesize !== 'function') {
      throw new Error('Invalid TTS provider: Provider must implement synthesize().')
    }
    this.activeProvider = provider
  }

  /**
   * Retrieve active provider information and health check.
   */
  getProviderStatus() {
    if (typeof this.activeProvider.checkAvailability === 'function') {
      return this.activeProvider.checkAvailability()
    }
    return { available: true, name: this.activeProvider.name || 'Custom Provider' }
  }

  /**
   * Get voice options for all or a specific language.
   * @param {string} [langCode]
   */
  getVoices(langCode) {
    if (langCode) {
      const code = langCode.toLowerCase()
      return INDIAN_VOICES[code] || null
    }
    return INDIAN_VOICES
  }

  /**
   * Resolve appropriate voice for the selected target language.
   *
   * @param {string} targetLang
   * @param {string} [requestedVoice]
   * @returns {string} Voice identifier
   */
  resolveVoice(targetLang, requestedVoice) {
    const langConfig = INDIAN_VOICES[targetLang.toLowerCase()]
    if (!langConfig) {
      throw new Error(
        `Unsupported language "${targetLang}". Supported: ${Object.keys(INDIAN_VOICES).join(', ')}.`
      )
    }

    if (requestedVoice) {
      const voiceExists = langConfig.voices.some((v) => v.id === requestedVoice)
      if (voiceExists) {
        return requestedVoice
      }
    }

    return langConfig.default
  }

  /**
   * Synthesize audio clips for an array of translated segments.
   *
   * @param {Array<{
   *   id: number,
   *   startTime: string,
   *   endTime: string,
   *   startMs: number,
   *   endMs: number,
   *   durationSec: string,
   *   originalText?: string,
   *   text?: string,
   *   translatedText: string
   * }>} segments - Translated transcript segments
   * @param {string} targetLang - Language code (hi, mr, bn, gu, ta, te)
   * @param {object} [options]
   * @param {string} [options.voice] - Custom neural voice ID
   * @param {string} [options.rate] - Playback rate (e.g. +0%)
   * @param {string} [options.volume] - Volume (e.g. +0%)
   * @returns {Promise<{
   *   success: boolean,
   *   provider: string,
   *   targetLanguage: string,
   *   voice: string,
   *   totalSegments: number,
   *   generatedCount: number,
   *   outputDirectory: string,
   *   clips: Array<{
   *     id: number,
   *     startTime: string,
   *     endTime: string,
   *     startMs: number,
   *     endMs: number,
   *     durationSec: string,
   *     originalText: string,
   *     translatedText: string,
   *     audioPath: string|null,
   *     audioFilename: string|null,
   *     sizeBytes: number,
   *     voice: string,
   *     hasAudio: boolean
   *   }>
   * }>}
   */
  async synthesizeSegments(segments, targetLang, options = {}) {
    // 1. Validate segments input
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error(
        'Empty segments: Cannot generate voiceover because no transcript segments were provided.'
      )
    }

    // 2. Validate target language
    const langKey = (targetLang || '').toLowerCase()
    if (!INDIAN_VOICES[langKey]) {
      const validLangs = Object.keys(INDIAN_VOICES).join(', ')
      throw new Error(
        `Unsupported target language "${targetLang}". Supported languages for TTS: ${validLangs}.`
      )
    }

    // 3. Resolve voice
    const voice = this.resolveVoice(langKey, options.voice)

    // 4. Prepare dedicated temporary output directory
    const baseTemp =
      app && typeof app.getPath === 'function' ? app.getPath('temp') : os.tmpdir()
    const outputDir = options.outputDir || path.join(baseTemp, 'dubbly_tts')
    await fs.promises.mkdir(outputDir, { recursive: true })

    const generatedClips = []
    let newlySynthesizedCount = 0
    let cachedCount = 0

    // 5. Synthesize or reuse cached audio for each segment
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const segId = seg.id !== undefined ? seg.id : generatedClips.length
      const originalText = seg.originalText || seg.text || ''
      const translatedText = (seg.translatedText || '').trim()

      // If segment has no translated text or is silence, skip synthesis
      if (!translatedText) {
        generatedClips.push({
          id: segId,
          startTime: seg.startTime || '00:00:00,000',
          endTime: seg.endTime || '00:00:00,000',
          startMs: seg.startMs || 0,
          endMs: seg.endMs || 0,
          durationSec: seg.durationSec || '0.00',
          originalText,
          translatedText: '',
          audioPath: null,
          audioFilename: null,
          sizeBytes: 0,
          voice,
          hasAudio: false,
          fromCache: false
        })
        continue
      }

      // Compute deterministic cache key for text + lang + voice + rate + volume
      const clipFilename = computeClipCacheKey(
        translatedText,
        langKey,
        voice,
        options.rate,
        options.volume
      )
      const clipPath = path.join(outputDir, clipFilename)

      try {
        let sizeBytes = 0
        let isFromCache = false

        // Check if cached audio file already exists on disk with non-zero size
        if (fs.existsSync(clipPath)) {
          const stats = await fs.promises.stat(clipPath)
          if (stats.size > 0) {
            sizeBytes = stats.size
            isFromCache = true
            cachedCount++
          }
        }

        // Cache miss: synthesize fresh audio clip via active provider
        if (!isFromCache) {
          if (typeof options.onProgress === 'function') {
            options.onProgress({
              operation: 'tts',
              current: i + 1,
              total: segments.length,
              percent: Math.round(((i + 1) / segments.length) * 100),
              message: `Synthesizing clip ${i + 1} of ${segments.length} (${voice.split('-')[2] || voice})...`,
              cached: false
            })
          }

          const result = await this.activeProvider.synthesize({
            text: translatedText,
            voice,
            outputPath: clipPath,
            rate: options.rate || '+0%',
            volume: options.volume || '+0%'
          })

          sizeBytes = result.sizeBytes
          newlySynthesizedCount++

          // Gentle delay between remote synthesis requests
          await new Promise((resolve) => setTimeout(resolve, 50))
        } else {
          // Cache hit: immediately report cache reuse
          if (typeof options.onProgress === 'function') {
            options.onProgress({
              operation: 'tts',
              current: i + 1,
              total: segments.length,
              percent: Math.round(((i + 1) / segments.length) * 100),
              message: `Reused clip ${i + 1} of ${segments.length} from cache`,
              cached: true
            })
          }
        }

        generatedClips.push({
          id: segId,
          startTime: seg.startTime,
          endTime: seg.endTime,
          startMs: seg.startMs,
          endMs: seg.endMs,
          durationSec: seg.durationSec,
          originalText,
          translatedText,
          audioPath: clipPath,
          audioFilename: clipFilename,
          sizeBytes,
          voice,
          hasAudio: true,
          fromCache: isFromCache
        })
      } catch (err) {
        throw new Error(`Failed to synthesize segment #${segId} ("${translatedText}"): ${err.message}`)
      }
    }

    return {
      success: true,
      provider: this.activeProvider.name || 'edge-tts',
      targetLanguage: langKey,
      voice,
      totalSegments: segments.length,
      generatedCount: newlySynthesizedCount + cachedCount,
      newlySynthesizedCount,
      cachedCount,
      outputDirectory: outputDir,
      clips: generatedClips
    }
  }
}

export const ttsService = new TtsService()
export default ttsService

import fs from 'fs'
import path from 'path'
import os from 'os'
import electron from 'electron'
const { app, dialog } = electron

/**
 * Format milliseconds into standard subtitle timestamp.
 *
 * SRT format: HH:MM:SS,mmm (comma separator before milliseconds)
 * WebVTT format: HH:MM:SS.mmm (dot separator before milliseconds)
 *
 * @param {number} ms - Milliseconds timestamp
 * @param {'srt'|'vtt'} [format='srt'] - Subtitle format
 * @returns {string} Formatted timestamp string
 */
export function formatSubtitleTimestamp(ms, format = 'srt') {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
    ms = 0
  }

  const totalSeconds = Math.floor(ms / 1000)
  const milliseconds = Math.floor(ms % 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  const mmm = String(milliseconds).padStart(3, '0')

  const separator = (format || 'srt').toLowerCase() === 'vtt' ? '.' : ','
  return `${hh}:${mm}:${ss}${separator}${mmm}`
}

/**
 * Parse timestamp string (HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm or numeric ms) into milliseconds.
 *
 * @param {string|number} timeInput
 * @returns {number} Milliseconds
 */
export function parseTimestampToMs(timeInput) {
  if (typeof timeInput === 'number' && !isNaN(timeInput)) {
    return Math.max(0, Math.floor(timeInput))
  }
  if (typeof timeInput !== 'string') return 0

  const cleaned = timeInput.trim()
  // Match HH:MM:SS[,.]mmm
  const matchFull = cleaned.match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/)
  if (matchFull) {
    const [, h, m, s, ms] = matchFull
    return (
      parseInt(h, 10) * 3600000 +
      parseInt(m, 10) * 60000 +
      parseInt(s, 10) * 1000 +
      parseInt(ms.padEnd(3, '0'), 10)
    )
  }

  // Match MM:SS[,.]mmm
  const matchShort = cleaned.match(/^(\d{1,2}):(\d{2})[,.](\d{1,3})$/)
  if (matchShort) {
    const [, m, s, ms] = matchShort
    return (
      parseInt(m, 10) * 60000 +
      parseInt(s, 10) * 1000 +
      parseInt(ms.padEnd(3, '0'), 10)
    )
  }

  // Raw numeric string
  const num = Number(cleaned)
  if (!isNaN(num)) {
    return Math.max(0, Math.floor(num))
  }

  return 0
}

/**
 * Generate SubRip (.srt) format subtitle string from translated segments.
 * Uses final edited text and exact timestamps.
 *
 * Format Specification:
 * 1
 * 00:00:01,000 --> 00:00:04,500
 * Subtitle text line
 *
 * @param {Array<object>} segments - Array of transcript/translation segments
 * @returns {string} Formatted SRT text
 */
export function generateSrt(segments) {
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    throw new Error('Cannot export subtitles: No transcript segments provided.')
  }

  const entries = []
  let entryIndex = 1

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    // Prioritize edited translated text, then raw translatedText, then text
    const text = (seg.translatedText !== undefined ? seg.translatedText : seg.text || '').trim()

    // Determine numeric timestamps in milliseconds
    let startMs = typeof seg.startMs === 'number' && !isNaN(seg.startMs)
      ? seg.startMs
      : parseTimestampToMs(seg.startTime)
    let endMs = typeof seg.endMs === 'number' && !isNaN(seg.endMs)
      ? seg.endMs
      : parseTimestampToMs(seg.endTime)

    // Validate timestamps
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      throw new Error(
        `Invalid timestamp range for segment #${seg.id || i + 1}: Start time (${seg.startTime || startMs + 'ms'}) must be earlier than end time (${seg.endTime || endMs + 'ms'}).`
      )
    }

    // Skip segments with empty text
    if (!text) continue

    const startFormatted = formatSubtitleTimestamp(startMs, 'srt')
    const endFormatted = formatSubtitleTimestamp(endMs, 'srt')

    entries.push(`${entryIndex}\n${startFormatted} --> ${endFormatted}\n${text}`)
    entryIndex++
  }

  if (entries.length === 0) {
    throw new Error('Cannot export subtitles: All segments have empty or blank text.')
  }

  return entries.join('\n\n') + '\n'
}

/**
 * Generate WebVTT (.vtt) format subtitle string from translated segments.
 * Uses final edited text and exact timestamps.
 *
 * Format Specification:
 * WEBVTT
 *
 * 1
 * 00:00:01.000 --> 00:00:04.500
 * Subtitle text line
 *
 * @param {Array<object>} segments - Array of transcript/translation segments
 * @param {object} [options]
 * @param {string} [options.title] - Optional title in WEBVTT header
 * @returns {string} Formatted WebVTT text
 */
export function generateVtt(segments, options = {}) {
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    throw new Error('Cannot export subtitles: No transcript segments provided.')
  }

  const entries = []
  let entryIndex = 1

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const text = (seg.translatedText !== undefined ? seg.translatedText : seg.text || '').trim()

    let startMs = typeof seg.startMs === 'number' && !isNaN(seg.startMs)
      ? seg.startMs
      : parseTimestampToMs(seg.startTime)
    let endMs = typeof seg.endMs === 'number' && !isNaN(seg.endMs)
      ? seg.endMs
      : parseTimestampToMs(seg.endTime)

    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      throw new Error(
        `Invalid timestamp range for segment #${seg.id || i + 1}: Start time (${seg.startTime || startMs + 'ms'}) must be earlier than end time (${seg.endTime || endMs + 'ms'}).`
      )
    }

    if (!text) continue

    const startFormatted = formatSubtitleTimestamp(startMs, 'vtt')
    const endFormatted = formatSubtitleTimestamp(endMs, 'vtt')

    entries.push(`${entryIndex}\n${startFormatted} --> ${endFormatted}\n${text}`)
    entryIndex++
  }

  if (entries.length === 0) {
    throw new Error('Cannot export subtitles: All segments have empty or blank text.')
  }

  const header = options.title ? `WEBVTT - ${options.title}` : 'WEBVTT'
  return `${header}\n\n` + entries.join('\n\n') + '\n'
}

/**
 * Build a sensible default subtitle filename based on the video name and target language.
 * E.g., "my_video_hi.srt" or "interview_mr.vtt"
 *
 * @param {string} [videoName]
 * @param {string} [targetLanguage='hi']
 * @param {'srt'|'vtt'} [format='srt']
 * @returns {string} Sensible filename
 */
export function buildDefaultSubtitleFilename(videoName, targetLanguage = 'hi', format = 'srt') {
  let baseName = 'dubbly_subtitles'
  if (videoName && typeof videoName === 'string') {
    const parsed = path.parse(videoName).name
    const sanitized = parsed.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_')
    if (sanitized) baseName = sanitized
  }
  const lang = (targetLanguage || 'hi').toLowerCase()
  const fmt = (format || 'srt').toLowerCase()
  return `${baseName}_${lang}.${fmt}`
}

/**
 * Subtitle Service
 */
export const subtitleService = {
  formatTimestamp: formatSubtitleTimestamp,
  parseTimestamp: parseTimestampToMs,
  generateSrt,
  generateVtt,
  buildFilename: buildDefaultSubtitleFilename,

  /**
   * Generate subtitle text in either 'srt' or 'vtt' format.
   *
   * @param {Array<object>} segments
   * @param {'srt'|'vtt'} [format='srt']
   * @param {object} [options]
   * @returns {string}
   */
  generate(segments, format = 'srt', options = {}) {
    const fmt = (format || 'srt').toLowerCase()
    if (fmt === 'vtt') {
      return generateVtt(segments, options)
    }
    return generateSrt(segments)
  },

  /**
   * Generate and export subtitles to disk.
   * Supports native Electron Save Dialog or direct file write.
   *
   * @param {Array<object>} segments
   * @param {'srt'|'vtt'} format
   * @param {object} [options]
   * @param {string} [options.videoName] - Name of video for sensible filename
   * @param {string} [options.targetLanguage='hi'] - Target language code
   * @param {string} [options.destinationPath] - Direct write target (skips dialog)
   * @param {boolean} [options.useDialog=true] - Show native save dialog if no destinationPath
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
    const fmt = (format || 'srt').toLowerCase()
    if (fmt !== 'srt' && fmt !== 'vtt') {
      throw new Error(`Unsupported subtitle format "${format}". Only "srt" and "vtt" are supported.`)
    }

    // 1. Generate subtitle text (validates segments and timestamps)
    const content = this.generate(segments, fmt, options)

    // 2. Compute sensible filename based on video name and target language
    const defaultFilename = buildDefaultSubtitleFilename(
      options.videoName,
      options.targetLanguage,
      fmt
    )

    let targetFilePath = options.destinationPath

    // 3. If no destination path, check if we should prompt with Electron's Save Dialog
    if (!targetFilePath && options.useDialog !== false && dialog && typeof dialog.showSaveDialog === 'function') {
      const defaultDir =
        (app && typeof app.getPath === 'function' ? app.getPath('downloads') : null) ||
        os.homedir()
      const defaultSavePath = path.join(defaultDir, defaultFilename)

      const dialogResult = await dialog.showSaveDialog({
        title: `Export ${fmt.toUpperCase()} Subtitles`,
        defaultPath: defaultSavePath,
        filters: [
          fmt === 'vtt'
            ? { name: 'WebVTT Subtitles (*.vtt)', extensions: ['vtt'] }
            : { name: 'SubRip Subtitles (*.srt)', extensions: ['srt'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ]
      })

      if (dialogResult.canceled || !dialogResult.filePath) {
        return {
          success: false,
          canceled: true,
          message: 'Subtitle export was canceled by user.'
        }
      }

      targetFilePath = dialogResult.filePath
    }

    // 4. Fallback if dialog is not used or unavailable: write to dedicated temporary subtitles folder
    if (!targetFilePath) {
      const baseTemp =
        (app && typeof app.getPath === 'function' ? app.getPath('temp') : null) || os.tmpdir()
      const subDir = path.join(baseTemp, 'dubbly_subtitles')
      await fs.promises.mkdir(subDir, { recursive: true })
      targetFilePath = path.join(subDir, defaultFilename)
    }

    // 5. Ensure parent directory exists and write file with UTF-8 encoding
    await fs.promises.mkdir(path.dirname(targetFilePath), { recursive: true })
    await fs.promises.writeFile(targetFilePath, content, 'utf-8')

    const stats = await fs.promises.stat(targetFilePath)

    return {
      success: true,
      canceled: false,
      format: fmt.toUpperCase(),
      filePath: targetFilePath,
      filename: path.basename(targetFilePath),
      sizeBytes: stats.size,
      segmentCount: segments.filter((s) => (s.translatedText || s.text || '').trim()).length,
      content
    }
  }
}

export default subtitleService

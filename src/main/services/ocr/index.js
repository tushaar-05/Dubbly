import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import electron from 'electron'
const app = electron && electron.app ? electron.app : electron
import { findFfmpegBinary } from '../video/index.js'
import { translateSingleText, SUPPORTED_LANGUAGES } from '../translation/index.js'

/**
 * Locate the Tesseract OCR executable on the system.
 * Checks environment variable, standard Homebrew and Linux locations, and system PATH.
 *
 * @returns {Promise<string>} Path to tesseract binary
 */
export async function findTesseractBinary() {
  if (process.env.TESSERACT_PATH && fs.existsSync(process.env.TESSERACT_PATH)) {
    return process.env.TESSERACT_PATH
  }

  const candidates = [
    '/opt/homebrew/bin/tesseract', // macOS Apple Silicon
    '/usr/local/bin/tesseract',    // macOS Intel / Linux
    '/usr/bin/tesseract',          // Linux distribution
    path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'tesseract.exe' : 'tesseract')
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  // Fallback: check system PATH via `which` or `where`
  const lookupCmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    const whichPath = await new Promise((resolve) => {
      const proc = spawn(lookupCmd, ['tesseract'])
      let stdout = ''
      proc.stdout.on('data', (d) => {
        stdout += d.toString()
      })
      proc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          const firstLine = stdout.trim().split('\n')[0].trim()
          if (fs.existsSync(firstLine)) {
            return resolve(firstLine)
          }
        }
        resolve(null)
      })
      proc.on('error', () => resolve(null))
    })

    if (whichPath) return whichPath
  } catch {
    // Ignore lookup errors
  }

  throw new Error(
    'Tesseract OCR executable was not found. Please ensure Tesseract is installed (e.g. "brew install tesseract" on macOS) or set the TESSERACT_PATH environment variable.'
  )
}

/**
 * Format seconds into HH:MM:SS or MM:SS format.
 *
 * @param {number} sec - Seconds
 * @returns {string} Formatted timestamp
 */
export function formatTimeCode(sec) {
  const s = Math.max(0, Math.floor(sec))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

/**
 * Run Tesseract OCR on a single image file.
 *
 * @param {string} imagePath - Absolute path to image
 * @param {string} tesseractBin - Path to tesseract executable
 * @returns {Promise<string>} Recognized text
 */
export async function runOcrOnFrame(imagePath, tesseractBin) {
  // Leptonica on macOS requires resolving symlinks (e.g. /tmp -> /private/tmp)
  const canonicalPath = fs.realpathSync(imagePath)

  return new Promise((resolve, reject) => {
    // Use --psm 6 (assume single uniform block of text) for titles/banners/lower thirds
    const proc = spawn(tesseractBin, [canonicalPath, 'stdout', '-l', 'eng', '--psm', '6'])
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        // Clean up recognized text: remove null bytes and extraneous spaces
        const cleaned = stdout
          .replace(/\f/g, '') // Remove form-feed characters
          .replace(/[\r\n]+/g, ' ') // Collapse newlines
          .replace(/\s+/g, ' ')
          .trim()
        resolve(cleaned)
      } else {
        // If code != 0, check if Leptonica failed or simply found no text
        if (stderr.includes('Error in') && !stdout) {
          reject(new Error(`Tesseract error on ${path.basename(imagePath)}: ${stderr.trim()}`))
        } else {
          resolve(stdout.trim())
        }
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn Tesseract OCR process: ${err.message}`))
    })
  })
}

/**
 * On-Screen Text & OCR Service
 */
export const ocrService = {
  findTesseract: findTesseractBinary,
  formatTime: formatTimeCode,

  /**
   * Detect visible on-screen text across sampled video frames.
   *
   * @param {string} videoPath - Absolute path to input video
   * @param {object} [options]
   * @param {number} [options.intervalSec=2] - Seconds between sampled frames (sensible interval)
   * @param {function} [options.onProgress] - Callback for progress reporting
   * @returns {Promise<{
   *   success: boolean,
   *   count: number,
   *   items: Array<{
   *     id: string,
   *     text: string,
   *     startTime: string,
   *     endTime: string,
   *     timestamp: string,
   *     startMs: number,
   *     endMs: number,
   *     frameCount: number
   *   }>,
   *   intervalSec: number,
   *   sampledFrames: number,
   *   message?: string
   * }>}
   */
  async detectVideoText(videoPath, options = {}) {
    // 1. Validate video input
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('A valid video file path must be provided for text detection.')
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Input video file does not exist: "${videoPath}"`)
    }

    const stat = await fs.promises.stat(videoPath)
    if (!stat.isFile() || stat.size === 0) {
      throw new Error(`The provided video file is empty or invalid: "${videoPath}"`)
    }

    const ffmpegBin = await findFfmpegBinary()
    const tesseractBin = await findTesseractBinary()

    const intervalSec = Math.max(1, Number(options.intervalSec) || 2)
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {}

    // 2. Prepare temporary directory for sampled frames
    const baseTemp =
      (app && typeof app.getPath === 'function' ? app.getPath('temp') : null) || os.tmpdir()
    const tempDir = path.join(baseTemp, `dubbly_ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
    await fs.promises.mkdir(tempDir, { recursive: true })

    try {
      onProgress({
        stage: 'sampling',
        percent: 10,
        message: `Sampling video frames every ${intervalSec}s with FFmpeg...`
      })

      // 3. Extract sampled frames using FFmpeg fps filter
      // fps=1/intervalSec samples 1 frame every intervalSec seconds
      const framePattern = path.join(tempDir, 'frame_%04d.png')
      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegBin, [
          '-y',
          '-i',
          videoPath,
          '-vf',
          `fps=1/${intervalSec}`,
          framePattern
        ])

        let stderr = ''
        proc.stderr.on('data', (d) => {
          stderr += d.toString()
        })

        proc.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`FFmpeg frame extraction failed (exit code ${code}): ${stderr.slice(-300)}`))
          }
        })

        proc.on('error', (err) => {
          reject(new Error(`Failed to spawn FFmpeg: ${err.message}`))
        })
      })

      // 4. List extracted frame files in numerical order
      const files = (await fs.promises.readdir(tempDir))
        .filter((f) => f.startsWith('frame_') && f.endsWith('.png'))
        .sort()

      if (files.length === 0) {
        return {
          success: true,
          count: 0,
          items: [],
          intervalSec,
          sampledFrames: 0,
          message: 'No video frames could be extracted for text detection.'
        }
      }

      onProgress({
        stage: 'detecting',
        current: 0,
        total: files.length,
        percent: 25,
        message: `Analyzing ${files.length} sampled frames for visible text...`
      })

      // 5. Run OCR on each frame
      const frameDetections = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const framePath = path.join(tempDir, file)
        const frameIndex = i + 1
        const frameTimeSec = i * intervalSec

        let rawText = ''
        try {
          rawText = await runOcrOnFrame(framePath, tesseractBin)
        } catch (err) {
          console.warn(`[OCR] Frame ${file} recognition warning:`, err.message)
        }

        // Filter out noisy single characters or pure symbols
        const cleanText = rawText.replace(/[^a-zA-Z0-9\s.,!?:'-]/g, '').trim()
        const hasMeaningfulText = cleanText.length >= 2 && /[a-zA-Z0-9]/.test(cleanText)

        if (hasMeaningfulText) {
          frameDetections.push({
            frameIndex,
            timeSec: frameTimeSec,
            text: cleanText
          })
        }

        const pct = Math.round(25 + ((i + 1) / files.length) * 65)
        onProgress({
          stage: 'detecting',
          current: i + 1,
          total: files.length,
          percent: pct,
          message: `Inspecting frame ${i + 1} of ${files.length}...`
        })
      }

      // 6. Deduplicate and group consecutive frames showing identical or near-identical text
      const groupedItems = []
      let currentGroup = null

      for (let i = 0; i < frameDetections.length; i++) {
        const det = frameDetections[i]
        const normalized = det.text.toLowerCase().replace(/[^a-z0-9]/g, '')

        if (
          currentGroup &&
          currentGroup.normalized === normalized &&
          det.timeSec - currentGroup.lastTimeSec <= intervalSec * 1.5
        ) {
          // Extend current group's time interval
          currentGroup.lastTimeSec = det.timeSec
          currentGroup.endMs = (det.timeSec + intervalSec) * 1000
          currentGroup.frameCount++
        } else {
          if (currentGroup) {
            groupedItems.push(currentGroup)
          }
          currentGroup = {
            id: `ocr-${groupedItems.length + 1}`,
            text: det.text,
            normalized,
            startMs: det.timeSec * 1000,
            endMs: (det.timeSec + intervalSec) * 1000,
            firstTimeSec: det.timeSec,
            lastTimeSec: det.timeSec,
            frameCount: 1
          }
        }
      }

      if (currentGroup) {
        groupedItems.push(currentGroup)
      }

      // Format clean user-facing items
      const items = groupedItems.map((item, idx) => {
        const startSec = item.firstTimeSec
        const endSec = item.lastTimeSec + intervalSec
        const startTimeStr = formatTimeCode(startSec)
        const endTimeStr = formatTimeCode(endSec)
        const timestamp =
          item.frameCount > 1 ? `${startTimeStr} - ${endTimeStr}` : startTimeStr

        return {
          id: `ocr-${idx + 1}`,
          text: item.text,
          startTime: startTimeStr,
          endTime: endTimeStr,
          timestamp,
          startMs: item.startMs,
          endMs: item.endMs,
          frameCount: item.frameCount,
          translatedText: '' // Left blank until user triggers translation
        }
      })

      onProgress({
        stage: 'complete',
        percent: 100,
        message: `OCR complete. Detected ${items.length} on-screen text segment(s).`
      })

      return {
        success: true,
        count: items.length,
        items,
        intervalSec,
        sampledFrames: files.length,
        message:
          items.length === 0
            ? 'No visible on-screen text was detected in the sampled video frames.'
            : undefined
      }
    } finally {
      // 7. Clean up temporary extracted frames
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  },

  /**
   * Translate detected on-screen text items into the selected target language.
   *
   * @param {Array<object>} items - Detected OCR items
   * @param {string} targetLang - Target language code (hi, mr, bn, gu, ta, te)
   * @param {object} [options]
   * @param {function} [options.onProgress]
   * @returns {Promise<{
   *   success: boolean,
   *   targetLanguage: string,
   *   targetLanguageName: string,
   *   count: number,
   *   items: Array<object>
   * }>}
   */
  async translateOcrItems(items, targetLang, options = {}) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No on-screen text items provided for translation.')
    }

    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === (targetLang || '').toLowerCase())
    if (!langObj) {
      throw new Error(
        `Invalid target language "${targetLang}". Supported: ${SUPPORTED_LANGUAGES.map((l) => l.name).join(', ')}.`
      )
    }

    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {}
    const translatedItems = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      let translatedText = ''
      try {
        translatedText = await translateSingleText(item.text, langObj.code)
      } catch (err) {
        console.warn(`[OCR Translation] Error translating "${item.text}":`, err.message)
        translatedText = item.text // Fallback to original text if translation fails
      }

      translatedItems.push({
        ...item,
        translatedText: translatedText || item.text
      })

      const pct = Math.round(((i + 1) / items.length) * 100)
      onProgress({
        current: i + 1,
        total: items.length,
        percent: pct,
        message: `Translating detected text ${i + 1} of ${items.length} into ${langObj.name}...`
      })
    }

    return {
      success: true,
      targetLanguage: langObj.code,
      targetLanguageName: langObj.name,
      targetLanguageNative: langObj.native,
      count: translatedItems.length,
      items: translatedItems
    }
  }
}

export default ocrService

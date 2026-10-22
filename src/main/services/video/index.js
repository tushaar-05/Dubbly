import { spawn } from 'child_process'
import electron from 'electron'
const app = electron && electron.app ? electron.app : electron
import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Locate the FFmpeg executable on the host system.
 * Checks common locations, environment variables, and system PATH.
 *
 * @returns {Promise<string>} Absolute path to ffmpeg binary
 */
export async function findFfmpegBinary() {
  // 1. Explicit environment variable
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH
  }

  // 2. Common OS installation paths
  const commonPaths = [
    '/opt/homebrew/bin/ffmpeg', // macOS Apple Silicon (Homebrew)
    '/usr/local/bin/ffmpeg',    // macOS Intel / Linux (Homebrew/manual)
    '/usr/bin/ffmpeg',          // Linux distribution default
    '/bin/ffmpeg',
    path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  ]

  for (const candidate of commonPaths) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  // 3. Fallback: check system PATH via `which` or `where`
  const lookupCmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    const whichPath = await new Promise((resolve) => {
      const proc = spawn(lookupCmd, ['ffmpeg'])
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
    // Ignore lookup errors and fall through
  }

  // If still not found, return 'ffmpeg' and let spawn attempt execution
  return 'ffmpeg'
}

/**
 * Video Processing Service
 * Provides FFmpeg operations for audio extraction, muxing, and video export.
 */
export const videoService = {
  /**
   * Extract audio from an input video formatted for Whisper transcription.
   * Format: 16-bit PCM, 16kHz, Mono WAV.
   *
   * @param {string} videoPath - Absolute path to input video file
   * @returns {Promise<{
   *   success: boolean,
   *   outputPath: string,
   *   filename: string,
   *   sizeBytes: number,
   *   format: string,
   *   sampleRate: number,
   *   channels: number
   * }>}
   */
  async extractAudio(videoPath) {
    // 1. Validate input path
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('A valid video file path must be provided.')
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Input video file does not exist: "${videoPath}"`)
    }

    const stat = await fs.promises.stat(videoPath)
    if (!stat.isFile()) {
      throw new Error(`The provided path is not a file: "${videoPath}"`)
    }

    if (stat.size === 0) {
      throw new Error(`The input video file is empty (0 bytes).`)
    }

    // 2. Locate FFmpeg
    const ffmpegPath = await findFfmpegBinary()

    // 3. Prepare working temporary directory
    const tempBase = app?.getPath ? app.getPath('temp') : os.tmpdir()
    const tempDir = path.join(tempBase, 'dubbly_audio')
    await fs.promises.mkdir(tempDir, { recursive: true })

    const baseName = path.basename(videoPath, path.extname(videoPath))
    const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const outputFilename = `${sanitizedBase}_${Date.now()}.wav`
    const outputPath = path.join(tempDir, outputFilename)

    // 4. Configure FFmpeg arguments for Whisper-ready audio
    // -vn: Disable video recording
    // -acodec pcm_s16le: 16-bit Little-Endian PCM WAV
    // -ar 16000: 16kHz sampling rate required by Whisper
    // -ac 1: Mono channel (single audio channel)
    const args = [
      '-y',                   // Overwrite output file without asking
      '-i', videoPath,        // Input video file
      '-vn',                  // Drop video stream
      '-acodec', 'pcm_s16le', // Output codec: 16-bit PCM
      '-ar', '16000',         // 16kHz audio sample rate
      '-ac', '1',             // Mono audio channel
      outputPath              // Output path
    ]

    return new Promise((resolve, reject) => {
      let stderrOutput = ''

      const ffmpegProcess = spawn(ffmpegPath, args)

      ffmpegProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString()
      })

      ffmpegProcess.on('error', (err) => {
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              `FFmpeg was not found at "${ffmpegPath}". Please install FFmpeg on your machine (e.g. "brew install ffmpeg" on macOS).`
            )
          )
        } else {
          reject(new Error(`Failed to start FFmpeg process: ${err.message}`))
        }
      })

      ffmpegProcess.on('close', async (code) => {
        if (code === 0) {
          try {
            const outStat = await fs.promises.stat(outputPath)
            if (outStat.size === 0) {
              return reject(new Error('FFmpeg completed but the output audio file is 0 bytes.'))
            }

            resolve({
              success: true,
              outputPath,
              filename: outputFilename,
              sizeBytes: outStat.size,
              format: '16kHz 16-bit mono WAV',
              sampleRate: 16000,
              channels: 1
            })
          } catch (statErr) {
            reject(new Error(`Failed to verify extracted audio file: ${statErr.message}`))
          }
        } else {
          // Extract the last meaningful lines from FFmpeg's stderr for a clear error message
          const errorLines = stderrOutput
            .trim()
            .split('\n')
            .filter((line) => line.trim().length > 0)
          const lastError = errorLines.slice(-3).join(' ') || `FFmpeg exited with error code ${code}.`

          reject(new Error(`Audio extraction failed: ${lastError}`))
        }
      })
    })
  },

  /**
   * Combine the original video with the synchronized dubbed audio track.
   *
   * PRESERVES VIDEO QUALITY:
   * Uses FFmpeg stream copy (-c:v copy) to transfer video packets losslessly without
   * re-encoding, preserving 100% original visual fidelity at near-instantaneous export speeds.
   * Encodes audio to high-quality AAC (-c:a aac -b:a 192k) for universal compatibility.
   *
   * @param {string} videoPath - Absolute path to original video file
   * @param {string} audioPath - Absolute path to master dubbed audio file
   * @param {object} [options]
   * @param {string} [options.outputDir] - Custom export directory
   * @param {string} [options.language] - Language tag for filename
   * @returns {Promise<{
   *   success: boolean,
   *   outputPath: string,
   *   filename: string,
   *   sizeBytes: number,
   *   format: string
   * }>}
   */
  async combineVideoAndAudio(videoPath, audioPath, options = {}) {
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('Invalid video path provided for export.')
    }
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file does not exist: "${videoPath}"`)
    }

    if (!audioPath || typeof audioPath !== 'string') {
      throw new Error('Invalid audio path provided for export.')
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Dubbed audio file does not exist: "${audioPath}"`)
    }

    const ffmpegPath = await findFfmpegBinary()

    // 1. Prepare dedicated output directory
    const baseTemp =
      app && typeof app.getPath === 'function' ? app.getPath('temp') : os.tmpdir()
    const exportDir = options.outputDir || path.join(baseTemp, 'dubbly_exports')
    await fs.promises.mkdir(exportDir, { recursive: true })

    const langSuffix = options.language ? `_${options.language}` : ''
    const baseName = path.basename(videoPath, path.extname(videoPath))
    const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const outputFilename = `${sanitizedBase}_dubbed${langSuffix}_${Date.now()}.mp4`
    const outputPath = path.join(exportDir, outputFilename)

    // 2. Configure FFmpeg arguments for lossless stream copy
    const args = [
      '-y',
      '-i', videoPath,         // Input 0: original video
      '-i', audioPath,         // Input 1: synchronized dubbed audio
      '-c:v', 'copy',          // Lossless video stream copy (preserves 100% visual quality)
      '-c:a', 'aac',           // Encode dubbed audio to high-compatibility AAC
      '-b:a', '192k',          // 192kbps audio bitrate
      '-map', '0:v:0',         // Take primary video stream from input 0
      '-map', '1:a:0',         // Take dubbed audio stream from input 1
      '-shortest',             // End output when shortest stream ends
      outputPath
    ]

    return new Promise((resolve, reject) => {
      let stderrOutput = ''
      const ffmpegProcess = spawn(ffmpegPath, args)

      ffmpegProcess.stderr.on('data', (d) => {
        stderrOutput += d.toString()
      })

      ffmpegProcess.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg export process: ${err.message}`))
      })

      ffmpegProcess.on('close', async (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          try {
            const outStat = await fs.promises.stat(outputPath)
            if (outStat.size === 0) {
              return reject(new Error('Exported video file is 0 bytes.'))
            }

            resolve({
              success: true,
              outputPath,
              filename: outputFilename,
              sizeBytes: outStat.size,
              format: 'MP4 (H.264 / AAC)'
            })
          } catch (statErr) {
            reject(new Error(`Failed to verify exported video file: ${statErr.message}`))
          }
        } else {
          const errorLines = stderrOutput
            .trim()
            .split('\n')
            .filter((l) => l.trim().length > 0)
          const lastError =
            errorLines.slice(-3).join(' ') || `FFmpeg export failed with code ${code}.`
          reject(new Error(`Video export failed: ${lastError}`))
        }
      })
    })
  }
}

export default videoService

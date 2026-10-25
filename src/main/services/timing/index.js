import { spawn } from 'child_process'
import electron from 'electron'
const app = electron && electron.app ? electron.app : electron
import fs from 'fs'
import path from 'path'
import os from 'os'
import { findFfmpegBinary } from '../video/index.js'

/**
 * Locate the ffprobe executable on the host system.
 *
 * @returns {Promise<string>}
 */
export async function findFfprobeBinary() {
  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
    return process.env.FFPROBE_PATH
  }

  const commonPaths = [
    '/opt/homebrew/bin/ffprobe',
    '/usr/local/bin/ffprobe',
    '/usr/bin/ffprobe',
    '/bin/ffprobe',
    path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
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
      const proc = spawn(lookupCmd, ['ffprobe'])
      let stdout = ''
      proc.stdout.on('data', (d) => {
        stdout += d.toString()
      })
      proc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          const firstLine = stdout.trim().split('\n')[0].trim()
          if (fs.existsSync(firstLine)) return resolve(firstLine)
        }
        resolve(null)
      })
      proc.on('error', () => resolve(null))
    })
    if (whichPath) return whichPath
  } catch {
    // Fall through
  }

  // 4. Test if 'ffprobe' is directly available in environment
  try {
    const testProc = spawn('ffprobe', ['-version'])
    const isWorking = await new Promise((resolve) => {
      testProc.on('close', (code) => resolve(code === 0))
      testProc.on('error', () => resolve(false))
    })
    if (isWorking) return 'ffprobe'
  } catch {
    // Ignore
  }

  throw new Error(
    'ffprobe was not found on your system. ffprobe is required for media timing inspection. Fix: Install FFmpeg (which includes ffprobe) via Homebrew with "brew install ffmpeg", or set the FFPROBE_PATH environment variable.'
  )
}

/**
 * Probe the exact duration of a media file in seconds using ffprobe.
 *
 * @param {string} filePath
 * @returns {Promise<number>}
 */
export async function probeMediaDuration(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for duration probe: "${filePath}"`)
  }

  const ffprobePath = await findFfprobeBinary()
  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath
  ]

  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const proc = spawn(ffprobePath, args)

    proc.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to invoke ffprobe: ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const dur = parseFloat(stdout.trim())
        if (!isNaN(dur) && dur >= 0) {
          return resolve(dur)
        }
      }
      reject(new Error(`ffprobe failed to determine duration: ${stderr.trim() || 'Invalid output'}`))
    })
  })
}

/**
 * Timing & Audio Synchronization Service
 *
 * Responsibilities:
 * - Place each synthesized voice clip at its original segment start time.
 * - Fill pauses between speech segments with silence.
 * - Compare generated clip length against the available time window before the next segment.
 * - Apply gentle time-stretching (atempo filter, clamped to <= 1.25x) if speech exceeds available gap,
 *   preserving intelligibility and avoiding chipmunk artifacts.
 * - Mix all timed clips onto a continuous master audio track matching total video duration.
 */
export const timingService = {
  /**
   * Probe media duration in seconds.
   */
  probeDuration: probeMediaDuration,

  /**
   * Create a single synchronized master audio track from voice clips.
   *
   * @param {Array<{
   *   id: number,
   *   startTime: string,
   *   endTime: string,
   *   startMs: number,
   *   endMs: number,
   *   durationSec: string,
   *   audioPath: string,
   *   hasAudio: boolean
   * }>} clips - Voice clips generated in Phase 7
   * @param {number} totalDurationSec - Total duration of the video in seconds
   * @param {object} [options]
   * @param {number} [options.maxSpeed=1.25] - Maximum speedup factor (default 1.25x)
   * @returns {Promise<{
   *   success: boolean,
   *   masterAudioPath: string,
   *   durationSec: number,
   *   totalClips: number,
   *   timedClips: number,
   *   adjustedClipsCount: number,
   *   timingDetails: Array<object>
   * }>}
   */
  async createSynchronizedAudioTrack(clips, totalDurationSec, options = {}) {
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      throw new Error('Synchronization failed: No voice clips provided.')
    }

    const maxSpeed = options.maxSpeed || 1.25
    const baseTemp =
      app && typeof app.getPath === 'function' ? app.getPath('temp') : os.tmpdir()
    const outputDir = path.join(baseTemp, 'dubbly_timing')
    await fs.promises.mkdir(outputDir, { recursive: true })

    // Filter valid clips that have generated audio on disk
    const validClips = clips.filter((c) => c.hasAudio && c.audioPath && fs.existsSync(c.audioPath))
    if (validClips.length === 0) {
      throw new Error(
        'Synchronization failed: None of the provided segments contain generated audio files.'
      )
    }

    // Normalize startMs and endMs defensively
    validClips.forEach((c) => {
      if (c.startMs === undefined && c.start !== undefined) c.startMs = Number(c.start)
      if (c.endMs === undefined && c.end !== undefined) c.endMs = Number(c.end)
      if (c.startMs === undefined || isNaN(c.startMs)) c.startMs = 0
      if (c.endMs === undefined || isNaN(c.endMs)) c.endMs = c.startMs + 2000
    })

    // Sort chronologically by startMs
    validClips.sort((a, b) => a.startMs - b.startMs)

    // Ensure total duration is at least as long as the last clip
    const lastClip = validClips[validClips.length - 1]
    const calculatedMinDuration = (lastClip.endMs || lastClip.startMs + 3000) / 1000 + 1.0
    const finalDuration = Math.max(Number(totalDurationSec) || 0, calculatedMinDuration)

    const timingDetails = []
    let adjustedCount = 0

    // 1. Analyze durations and compute speed adjustment for each clip
    for (let i = 0; i < validClips.length; i++) {
      const clip = validClips[i]
      const actualDuration = await probeMediaDuration(clip.audioPath)
      const startSec = Math.max(0, clip.startMs / 1000)
      const origDuration = Math.max(0.2, (clip.endMs - clip.startMs) / 1000)

      // Available gap before the next clip starts (leave 150ms breath pause if possible)
      const nextClip = validClips[i + 1]
      const nextStartSec = nextClip ? nextClip.startMs / 1000 : finalDuration
      const availableGap = Math.max(origDuration, nextStartSec - startSec - 0.15)

      let speedFactor = 1.0

      // If speech duration exceeds the available gap, gently compress with atempo
      if (actualDuration > availableGap && availableGap > 0.3) {
        const requiredSpeed = actualDuration / availableGap
        // Clamp speed to avoid chipmunk audio (keep natural and intelligible)
        speedFactor = Math.min(Math.max(requiredSpeed, 1.0), maxSpeed)
        adjustedCount++
      }

      const effectiveDuration = actualDuration / speedFactor
      const delayMs = Math.round(startSec * 1000)

      timingDetails.push({
        id: clip.id,
        audioPath: clip.audioPath,
        startSec,
        delayMs,
        actualDuration,
        availableGap,
        speedFactor,
        effectiveDuration
      })
    }

    // 2. Build FFmpeg command with adelay, atempo, and silence base track
    // Input 0: Silent base track matching full video duration
    const ffmpegPath = await findFfmpegBinary()
    const masterFilename = `master_dubbed_${Date.now()}.wav`
    const masterAudioPath = path.join(outputDir, masterFilename)

    const ffmpegArgs = [
      '-y',
      '-f',
      'lavfi',
      '-t',
      finalDuration.toFixed(3),
      '-i',
      'anullsrc=r=44100:cl=stereo'
    ]

    // Add each clip as an input
    timingDetails.forEach((td) => {
      ffmpegArgs.push('-i', td.audioPath)
    })

    // Build filter_complex
    let filterComplex = ''
    const mixInputs = ['[0:a]']

    timingDetails.forEach((td, idx) => {
      const inputIdx = idx + 1
      const padName = `a${inputIdx}`

      // Apply atempo (if needed) -> adelay -> stereo format
      const atempoFilter =
        td.speedFactor !== 1.0 ? `atempo=${td.speedFactor.toFixed(3)},` : ''
      const adelayFilter = `adelay=${td.delayMs}|${td.delayMs}`
      const aformatFilter = `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo`

      filterComplex += `[${inputIdx}:a]${atempoFilter}${adelayFilter},${aformatFilter}[${padName}];`
      mixInputs.push(`[${padName}]`)
    })

    // Mix all timed inputs onto the master track with normalize=0 to preserve natural voice volume
    filterComplex += `${mixInputs.join('')}amix=inputs=${mixInputs.length}:dropout_transition=0:normalize=0[out]`

    ffmpegArgs.push(
      '-filter_complex',
      filterComplex,
      '-map',
      '[out]',
      '-c:a',
      'pcm_s16le',
      '-ar',
      '44100',
      masterAudioPath
    )

    return new Promise((resolve, reject) => {
      let stderrOutput = ''
      const proc = spawn(ffmpegPath, ffmpegArgs)

      proc.stderr.on('data', (d) => {
        stderrOutput += d.toString()
      })

      proc.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg timing process: ${err.message}`))
      })

      proc.on('close', async (code) => {
        if (code === 0 && fs.existsSync(masterAudioPath)) {
          try {
            const stat = await fs.promises.stat(masterAudioPath)
            if (stat.size === 0) {
              return reject(new Error('FFmpeg generated an empty master audio track (0 bytes).'))
            }

            resolve({
              success: true,
              masterAudioPath,
              durationSec: finalDuration,
              totalClips: validClips.length,
              timedClips: timingDetails.length,
              adjustedClipsCount: adjustedCount,
              timingDetails
            })
          } catch (statErr) {
            reject(new Error(`Failed to verify master audio file: ${statErr.message}`))
          }
        } else {
          const errorLines = stderrOutput
            .trim()
            .split('\n')
            .filter((l) => l.trim().length > 0)
          const lastError =
            errorLines.slice(-3).join(' ') || `FFmpeg exited with error code ${code}.`
          reject(new Error(`Audio synchronization failed: ${lastError}`))
        }
      })
    })
  }
}

export default timingService

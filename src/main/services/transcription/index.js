import { spawn } from 'child_process'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Locate the whisper.cpp executable on the host system.
 * Checks common locations, environment variables, and system PATH.
 *
 * @returns {Promise<string>} Absolute path to whisper-cli binary
 */
export async function findWhisperBinary() {
  // 1. Explicit environment variable
  if (process.env.WHISPER_PATH && fs.existsSync(process.env.WHISPER_PATH)) {
    return process.env.WHISPER_PATH
  }

  // 2. Common OS installation paths for whisper.cpp / whisper-cli
  const commonPaths = [
    '/opt/homebrew/bin/whisper-cli', // macOS Apple Silicon Homebrew
    '/usr/local/bin/whisper-cli',    // macOS Intel / Linux Homebrew
    '/usr/bin/whisper-cli',          // Linux distribution binary
    '/opt/homebrew/bin/whisper-cpp',
    '/usr/local/bin/whisper-cpp',
    path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')
  ]

  for (const candidate of commonPaths) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  // 3. Fallback: check system PATH via `which` or `where`
  const lookupCmd = process.platform === 'win32' ? 'where' : 'which'
  for (const cmdName of ['whisper-cli', 'whisper-cpp', 'whisper']) {
    try {
      const foundPath = await new Promise((resolve) => {
        const proc = spawn(lookupCmd, [cmdName])
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

      if (foundPath) return foundPath
    } catch {
      // Ignore lookup errors and try next
    }
  }

  return 'whisper-cli'
}

/**
 * Locate a GGML Whisper model file.
 * Prioritizes lightweight models (ggml-tiny.en.bin, ggml-base.en.bin).
 *
 * @param {string} [customModelPath] - Optional override model path
 * @returns {string|null} Path to model file or null if not found
 */
export function findModelPath(customModelPath) {
  if (customModelPath) {
    return fs.existsSync(customModelPath) ? customModelPath : null
  }

  if (process.env.WHISPER_MODEL_PATH && fs.existsSync(process.env.WHISPER_MODEL_PATH)) {
    return process.env.WHISPER_MODEL_PATH
  }

  // Common candidate locations in project and app directories
  const userDataModels = app?.getPath ? path.join(app.getPath('userData'), 'models') : null
  const candidateDirs = [
    path.join(process.cwd(), 'models'),
    ...(userDataModels ? [userDataModels] : [])
  ]

  const modelNames = [
    'ggml-tiny.en.bin',
    'ggml-base.en.bin',
    'ggml-tiny.bin',
    'ggml-base.bin',
    'ggml-small.en.bin'
  ]

  for (const dir of candidateDirs) {
    for (const name of modelNames) {
      const fullPath = path.join(dir, name)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }
  }

  return null
}

/**
 * Speech-to-Text Transcription Service
 * Orchestrates whisper.cpp execution on 16kHz WAV audio.
 */
export const transcriptionService = {
  /**
   * Transcribe speech from an extracted WAV audio file.
   *
   * @param {string} audioPath - Path to the 16kHz mono WAV file
   * @param {object} [options] - Optional settings
   * @param {string} [options.modelPath] - Custom model file path
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
  async transcribeAudio(audioPath, options = {}) {
    // 1. Validate audio input
    if (!audioPath || typeof audioPath !== 'string') {
      throw new Error('A valid audio file path is required for transcription.')
    }

    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: "${audioPath}"`)
    }

    const stat = await fs.promises.stat(audioPath)
    if (!stat.isFile() || stat.size === 0) {
      throw new Error('The audio file is invalid or empty (0 bytes).')
    }

    // 2. Locate whisper.cpp executable
    const whisperBin = await findWhisperBinary()

    // 3. Locate Whisper model file
    const modelPath = findModelPath(options.modelPath)
    if (!modelPath) {
      throw new Error(
        `Whisper speech model not found. Expected model file at "${path.join(
          process.cwd(),
          'models',
          'ggml-tiny.en.bin'
        )}". Please ensure the model file is downloaded.`
      )
    }

    // 4. Setup temporary directory for JSON transcription output
    const tempBase = app?.getPath ? app.getPath('temp') : os.tmpdir()
    const tempDir = path.join(tempBase, 'dubbly_transcripts')
    await fs.promises.mkdir(tempDir, { recursive: true })

    const outputPrefix = path.join(tempDir, `transcript_${Date.now()}`)
    const expectedJsonFile = `${outputPrefix}.json`

    // 5. Configure whisper-cli arguments
    // -m: Model path
    // -f: Input audio file
    // -l: Source language (en)
    // -oj: Output JSON format with timestamps
    // -of: Output file prefix (whisper-cli appends .json)
    // -np: Suppress stdout progress spam
    const args = [
      '-m', modelPath,
      '-f', audioPath,
      '-l', 'en',
      '-oj',
      '-of', outputPrefix,
      '-np'
    ]

    return new Promise((resolve, reject) => {
      let stderrOutput = ''

      const whisperProc = spawn(whisperBin, args)

      whisperProc.stderr.on('data', (d) => {
        stderrOutput += d.toString()
      })

      whisperProc.on('error', (err) => {
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              `whisper.cpp executable ("${whisperBin}") was not found on your system. Please install it (e.g. "brew install whisper-cpp" on macOS).`
            )
          )
        } else {
          reject(new Error(`Failed to start whisper.cpp process: ${err.message}`))
        }
      })

      whisperProc.on('close', async (code) => {
        if (code === 0) {
          try {
            if (!fs.existsSync(expectedJsonFile)) {
              return reject(new Error('whisper.cpp completed but no transcript JSON file was generated.'))
            }

            const rawJson = await fs.promises.readFile(expectedJsonFile, 'utf-8')
            const parsed = JSON.parse(rawJson)

            // Normalize speech segments with formatted timestamps and clean text
            const rawSegments = parsed.transcription || []
            const segments = rawSegments.map((seg, idx) => {
              const startMs = seg.offsets?.from ?? 0
              const endMs = seg.offsets?.to ?? 0
              const durationSec = ((endMs - startMs) / 1000).toFixed(2)

              return {
                id: idx + 1,
                startTime: seg.timestamps?.from || '00:00:00,000',
                endTime: seg.timestamps?.to || '00:00:00,000',
                startMs,
                endMs,
                durationSec,
                text: (seg.text || '').trim()
              }
            })

            const fullText = segments.map((s) => s.text).join(' ').trim()

            // Clean up temporary JSON file
            await fs.promises.unlink(expectedJsonFile).catch(() => {})

            resolve({
              success: true,
              language: parsed.result?.language || 'en',
              model: path.basename(modelPath),
              segmentCount: segments.length,
              fullText,
              segments
            })
          } catch (parseErr) {
            reject(new Error(`Failed to parse whisper.cpp transcript output: ${parseErr.message}`))
          }
        } else {
          const errorLines = stderrOutput
            .trim()
            .split('\n')
            .filter((l) => l.trim().length > 0)
          const lastError = errorLines.slice(-3).join(' ') || `whisper.cpp exited with code ${code}.`

          reject(new Error(`Transcription failed: ${lastError}`))
        }
      })
    })
  }
}

export default transcriptionService

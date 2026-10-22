import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Locate the edge-tts executable or verify python3 -m edge_tts availability.
 * Checks system PATH and standard Python/Homebrew installation locations.
 *
 * @returns {{ type: 'cli' | 'python', executable: string, argsPrefix: string[] } | null}
 */
export function findEdgeTtsBinary() {
  // 1. Check if edge-tts is in PATH
  try {
    const testDirect = spawnSync('edge-tts', ['--version'], { encoding: 'utf8' })
    if (testDirect.status === 0) {
      return { type: 'cli', executable: 'edge-tts', argsPrefix: [] }
    }
  } catch {
    // Continue to path checks
  }

  // 2. Candidate paths on macOS and Linux
  const candidatePaths = [
    '/Library/Frameworks/Python.framework/Versions/3.13/bin/edge-tts',
    '/Library/Frameworks/Python.framework/Versions/Current/bin/edge-tts',
    '/opt/homebrew/bin/edge-tts',
    '/usr/local/bin/edge-tts',
    path.join(os.homedir(), '.local/bin/edge-tts'),
    path.join(os.homedir(), 'Library/Python/3.13/bin/edge-tts'),
    path.join(os.homedir(), 'Library/Python/3.12/bin/edge-tts'),
    path.join(os.homedir(), 'Library/Python/3.11/bin/edge-tts')
  ]

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const testRes = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
        if (testRes.status === 0) {
          return { type: 'cli', executable: candidate, argsPrefix: [] }
        }
      } catch {
        // Continue
      }
    }
  }

  // 3. Fallback: check if python3 can execute `python3 -m edge_tts`
  try {
    const testPython = spawnSync('python3', ['-m', 'edge_tts', '--version'], { encoding: 'utf8' })
    if (testPython.status === 0) {
      return { type: 'python', executable: 'python3', argsPrefix: ['-m', 'edge_tts'] }
    }
  } catch {
    // Not found
  }

  return null
}

/**
 * Edge TTS Provider Adapter
 *
 * Connects Dubbly's TTS architecture with Microsoft Edge's free Neural TTS service
 * via the edge-tts Python CLI interface.
 */
export const edgeTtsProvider = {
  id: 'edge-tts',
  name: 'Microsoft Edge Neural TTS',

  /**
   * Check if Edge TTS is configured and accessible.
   *
   * @returns {{ available: boolean, executable?: string, version?: string, error?: string }}
   */
  checkAvailability() {
    const binaryInfo = findEdgeTtsBinary()
    if (!binaryInfo) {
      return {
        available: false,
        error:
          'Edge TTS is not installed or not in PATH. Please run "pip3 install edge-tts" or ensure Python is installed.'
      }
    }

    try {
      const res = spawnSync(binaryInfo.executable, [...binaryInfo.argsPrefix, '--version'], {
        encoding: 'utf8'
      })
      const version = (res.stdout || '').trim() || '7.x'
      return {
        available: true,
        executable: binaryInfo.executable,
        version
      }
    } catch (err) {
      return {
        available: false,
        error: `Failed to invoke Edge TTS: ${err.message}`
      }
    }
  },

  /**
   * Synthesize speech for a text string and write to an MP3 file.
   *
   * @param {object} params
   * @param {string} params.text - The text to synthesize
   * @param {string} params.voice - The neural voice identifier (e.g. hi-IN-MadhurNeural)
   * @param {string} params.outputPath - Absolute filesystem path for the output .mp3
   * @param {string} [params.rate='+0%'] - Optional rate adjustment (e.g. +10%, -10%)
   * @param {string} [params.volume='+0%'] - Optional volume adjustment
   * @returns {Promise<{ success: boolean, outputPath: string, sizeBytes: number }>}
   */
  async synthesize({ text, voice, outputPath, rate = '+0%', volume = '+0%' }) {
    if (!text || !text.trim()) {
      throw new Error('TTS synthesis failed: Text content cannot be empty.')
    }

    if (!voice) {
      throw new Error('TTS synthesis failed: Voice must be specified.')
    }

    if (!outputPath) {
      throw new Error('TTS synthesis failed: Output path must be provided.')
    }

    const binaryInfo = findEdgeTtsBinary()
    if (!binaryInfo) {
      throw new Error(
        'Edge TTS tool not found. Please install it using "pip3 install edge-tts" and ensure it is available in your PATH.'
      )
    }

    // Ensure parent directory exists
    const dir = path.dirname(outputPath)
    await fs.promises.mkdir(dir, { recursive: true })

    const cleanText = text.trim()
    const args = [
      ...binaryInfo.argsPrefix,
      '--voice',
      voice,
      '--text',
      cleanText,
      '--write-media',
      outputPath,
      '--no-progress'
    ]

    if (rate && rate !== '+0%') {
      args.push('--rate', rate)
    }
    if (volume && volume !== '+0%') {
      args.push('--volume', volume)
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(binaryInfo.executable, args)

      let stderrOutput = ''

      proc.stderr.on('data', (data) => {
        stderrOutput += data.toString()
      })

      proc.on('error', (err) => {
        reject(
          new Error(
            `Failed to start Edge TTS process: ${err.message}. Please verify Edge TTS is correctly installed.`
          )
        )
      })

      proc.on('close', async (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          try {
            const stat = await fs.promises.stat(outputPath)
            if (stat.size === 0) {
              return reject(new Error('Edge TTS produced an empty audio file (0 bytes).'))
            }
            return resolve({
              success: true,
              outputPath,
              sizeBytes: stat.size
            })
          } catch (statErr) {
            return reject(new Error(`Failed to verify generated audio file: ${statErr.message}`))
          }
        }

        // Parse stderr to give friendly explanations
        const stderrLower = stderrOutput.toLowerCase()

        if (stderrLower.includes('invalid voice')) {
          return reject(
            new Error(
              `Invalid or unsupported Edge TTS voice "${voice}". Please select a valid neural voice.`
            )
          )
        }

        if (
          stderrLower.includes('clientconnecterror') ||
          stderrLower.includes('cannot connect') ||
          stderrLower.includes('timeout') ||
          stderrLower.includes('gaierror') ||
          stderrLower.includes('nodename nor servname provided')
        ) {
          return reject(
            new Error(
              'Edge TTS network connection failed: Microsoft speech service could not be reached. Please check your internet connection.'
            )
          )
        }

        if (stderrLower.includes('rate') || stderrLower.includes('429')) {
          return reject(
            new Error(
              'Edge TTS rate limit reached. Please wait a few moments before generating additional audio.'
            )
          )
        }

        reject(
          new Error(
            `Edge TTS exited with code ${code}. Error: ${stderrOutput.trim() || 'Unknown synthesis failure.'}`
          )
        )
      })
    })
  }
}

export default edgeTtsProvider

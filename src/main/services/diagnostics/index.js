import { spawnSync } from 'child_process'
import dns from 'dns'
import fs from 'fs'
import path from 'path'
import os from 'os'
import electron from 'electron'
const app = electron && electron.app ? electron.app : electron

import { findFfmpegBinary } from '../video/index.js'
import { findFfprobeBinary } from '../timing/index.js'
import { findWhisperBinary, findModelPath } from '../transcription/index.js'
import { edgeTtsProvider } from '../tts/providers/edgeTts.js'
import { findTesseractBinary } from '../ocr/index.js'

/**
 * Diagnostic Service
 * Checks host environment, binary paths, models, and network prerequisites.
 */
export const diagnosticService = {
  /**
   * Run full system diagnostic check.
   *
   * @returns {Promise<{
   *   allRequiredReady: boolean,
   *   summary: string,
   *   readyCount: number,
   *   totalCount: number,
   *   tools: Record<string, {
   *     name: string,
   *     category: string,
   *     available: boolean,
   *     required: boolean,
   *     version?: string,
   *     path?: string,
   *     instructions?: string,
   *     error?: string
   *   }>
   * }>}
   */
  async checkEnvironment() {
    const tools = {}

    // 1. FFmpeg
    try {
      const ffmpegPath = await findFfmpegBinary()
      const proc = spawnSync(ffmpegPath, ['-version'], { encoding: 'utf8' })
      if (proc.status === 0) {
        const firstLine = (proc.stdout || '').split('\n')[0].trim()
        tools.ffmpeg = {
          name: 'FFmpeg',
          category: 'Video & Audio Processing',
          available: true,
          required: true,
          path: ffmpegPath,
          version: firstLine.split(' ')[2] || '8.x'
        }
      } else {
        throw new Error('ffmpeg failed -version check')
      }
    } catch {
      tools.ffmpeg = {
        name: 'FFmpeg',
        category: 'Video & Audio Processing',
        available: false,
        required: true,
        instructions:
          'Install FFmpeg using Homebrew: "brew install ffmpeg", or download from ffmpeg.org and set FFMPEG_PATH.',
        error: 'FFmpeg executable not found or not functional.'
      }
    }

    // 2. ffprobe
    try {
      const ffprobePath = await findFfprobeBinary()
      const proc = spawnSync(ffprobePath, ['-version'], { encoding: 'utf8' })
      if (proc.status === 0) {
        const firstLine = (proc.stdout || '').split('\n')[0].trim()
        tools.ffprobe = {
          name: 'ffprobe',
          category: 'Media Inspection',
          available: true,
          required: true,
          path: ffprobePath,
          version: firstLine.split(' ')[2] || '8.x'
        }
      } else {
        throw new Error('ffprobe failed -version check')
      }
    } catch {
      tools.ffprobe = {
        name: 'ffprobe',
        category: 'Media Inspection',
        available: false,
        required: true,
        instructions:
          'ffprobe is included with FFmpeg. Run "brew install ffmpeg", or set FFPROBE_PATH.',
        error: 'ffprobe executable not found or not functional.'
      }
    }

    // 3. whisper.cpp (whisper-cli)
    try {
      const whisperPath = await findWhisperBinary()
      const proc = spawnSync(whisperPath, ['--help'], { encoding: 'utf8' })
      // whisper-cli outputs usage help to stdout or stderr with exit code 0 or 1
      const isWhisper = (proc.stdout + proc.stderr).toLowerCase().includes('usage') || proc.status === 0
      if (isWhisper) {
        tools.whisper = {
          name: 'whisper.cpp (whisper-cli)',
          category: 'Speech Transcription',
          available: true,
          required: true,
          path: whisperPath,
          version: 'whisper.cpp'
        }
      } else {
        throw new Error('whisper-cli not functional')
      }
    } catch {
      tools.whisper = {
        name: 'whisper.cpp (whisper-cli)',
        category: 'Speech Transcription',
        available: false,
        required: true,
        instructions:
          'Install whisper.cpp via Homebrew: "brew install whisper-cpp", download from github.com/ggerganov/whisper.cpp/releases, or place the binary in your PATH or ./bin/.',
        error: 'whisper-cli binary not found in PATH or standard directories.'
      }
    }

    // 4. Whisper GGML Speech Model
    const modelPath = findModelPath()
    if (modelPath && fs.existsSync(modelPath)) {
      const stat = fs.statSync(modelPath)
      tools.whisperModel = {
        name: 'Whisper GGML Model',
        category: 'Speech Transcription',
        available: true,
        required: true,
        path: modelPath,
        version: path.basename(modelPath),
        sizeBytes: stat.size
      }
    } else {
      tools.whisperModel = {
        name: 'Whisper GGML Model',
        category: 'Speech Transcription',
        available: false,
        required: true,
        instructions:
          'Download ggml-tiny.en.bin or ggml-base.en.bin into the models/ folder: "curl -L -o models/ggml-tiny.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin" (or set WHISPER_MODEL_PATH).',
        error: 'No GGML model (.bin) found in models/ or app userData directories.'
      }
    }

    // 5. Microsoft Edge TTS (Python)
    const ttsCheck = edgeTtsProvider.checkAvailability()
    if (ttsCheck.available) {
      tools.edgeTts = {
        name: 'Edge TTS (Python)',
        category: 'Voiceover Synthesis',
        available: true,
        required: true,
        path: ttsCheck.executable,
        version: ttsCheck.version
      }
    } else {
      tools.edgeTts = {
        name: 'Edge TTS (Python)',
        category: 'Voiceover Synthesis',
        available: false,
        required: true,
        instructions:
          'Install Python 3 and edge-tts: run "pip3 install edge-tts" in your terminal, or ensure edge-tts is in PATH.',
        error: ttsCheck.error || 'edge-tts CLI not found.'
      }
    }

    // 6. Tesseract OCR (Optional for On-Screen Text)
    try {
      const tesseractPath = await findTesseractBinary()
      const proc = spawnSync(tesseractPath, ['--version'], { encoding: 'utf8' })
      if (proc.status === 0) {
        const firstLine = (proc.stdout || '').split('\n')[0].trim()
        tools.tesseract = {
          name: 'Tesseract OCR',
          category: 'On-Screen Text Detection',
          available: true,
          required: false, // Optional: audio dubbing works without OCR
          path: tesseractPath,
          version: firstLine.replace('tesseract ', '') || '5.x'
        }
      } else {
        throw new Error('tesseract failed --version check')
      }
    } catch {
      tools.tesseract = {
        name: 'Tesseract OCR',
        category: 'On-Screen Text Detection',
        available: false,
        required: false,
        instructions:
          'Install Tesseract OCR via Homebrew: "brew install tesseract", or download from github.com/tesseract-ocr/tesseract.',
        error: 'Tesseract OCR binary not found in PATH or standard directories.'
      }
    }

    // 7. Internet Connectivity (Google Translate & Edge TTS)
    const hasInternet = await new Promise((resolve) => {
      dns.lookup('clients5.google.com', (err) => {
        resolve(!err)
      })
    })

    if (hasInternet) {
      tools.internet = {
        name: 'Internet Connection',
        category: 'Cloud Services',
        available: true,
        required: true,
        version: 'Connected'
      }
    } else {
      tools.internet = {
        name: 'Internet Connection',
        category: 'Cloud Services',
        available: false,
        required: true,
        instructions:
          'Verify your device is connected to the internet. Google Translate and Microsoft Edge Neural TTS require network access.',
        error: 'Cannot resolve online translation / TTS hosts.'
      }
    }

    // Evaluate overall readiness
    const toolList = Object.values(tools)
    const requiredTools = toolList.filter((t) => t.required)
    const allRequiredReady = requiredTools.every((t) => t.available)
    const readyCount = toolList.filter((t) => t.available).length
    const totalCount = toolList.length

    let summary = 'All required dependencies and tools are ready.'
    if (!allRequiredReady) {
      const missingRequired = requiredTools.filter((t) => !t.available).map((t) => t.name)
      summary = `Missing required setup: ${missingRequired.join(', ')}.`
    }

    return {
      allRequiredReady,
      summary,
      readyCount,
      totalCount,
      tools
    }
  }
}

export default diagnosticService

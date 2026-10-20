import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import videoService from '../services/video'
import transcriptionService from '../services/transcription'

/**
 * IPC Handler Registry
 *
 * Responsibilities:
 * - Register ipcMain.handle listeners for secure, bidirectional communication with renderer.
 * - Enforce strict input validation on all IPC channels.
 * - Restrict filesystem access exclusively to permitted temporary working directories.
 * - Never expose arbitrary filesystem access or arbitrary command execution.
 */
export function registerIpcHandlers() {
  /**
   * Application Information Channels
   */
  ipcMain.handle('app:get-version', async () => {
    return app.getVersion()
  })

  ipcMain.handle('app:get-info', async () => {
    return {
      name: app.getName(),
      version: app.getVersion()
    }
  })

  /**
   * Video Audio Extraction Channel
   * Channel: 'video:extract-audio'
   */
  ipcMain.handle('video:extract-audio', async (_, { videoPath } = {}) => {
    // 1. Validate argument presence and type
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('Invalid video path provided. Please select a valid video.')
    }

    // 2. Validate file existence
    if (!fs.existsSync(videoPath)) {
      throw new Error(`File not found at specified path: "${videoPath}"`)
    }

    // 3. Validate that path points to a regular file
    const stat = await fs.promises.stat(videoPath)
    if (!stat.isFile()) {
      throw new Error('Specified path is a directory, not a video file.')
    }

    // 4. Validate allowed video file extensions
    const ext = path.extname(videoPath).toLowerCase()
    const allowedExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.wmv']
    if (!allowedExtensions.includes(ext)) {
      throw new Error(
        `Unsupported video format "${ext}". Supported formats: ${allowedExtensions.join(', ')}`
      )
    }

    // 5. Execute audio extraction service
    return await videoService.extractAudio(videoPath)
  })

  /**
   * Read Extracted Audio Data for In-App Playback
   * Channel: 'video:read-audio-data'
   *
   * SECURITY ENFORCEMENT:
   * Only permits reading .wav files located strictly inside Dubbly's designated
   * temporary audio directory. Rejects directory traversal (../) and arbitrary file paths.
   */
  ipcMain.handle('video:read-audio-data', async (_, { audioPath } = {}) => {
    if (!audioPath || typeof audioPath !== 'string') {
      throw new Error('Invalid audio path provided.')
    }

    // Only allow reading files ending with .wav
    if (!audioPath.toLowerCase().endsWith('.wav')) {
      throw new Error('Access denied: Only audio files (.wav) can be read.')
    }

    // Security check: restrict path strictly to permitted temporary audio directory
    const permittedDir = path.resolve(path.join(app.getPath('temp'), 'dubbly_audio'))
    const resolvedAudioPath = path.resolve(audioPath)

    if (!resolvedAudioPath.startsWith(permittedDir + path.sep)) {
      throw new Error(
        'Access denied: Cannot read files outside Dubbly temporary working directory.'
      )
    }

    if (!fs.existsSync(resolvedAudioPath)) {
      throw new Error('Audio file does not exist or has been removed.')
    }

    const buffer = await fs.promises.readFile(resolvedAudioPath)
    return buffer.toString('base64')
  })

  /**
   * Audio Transcription Channel (Phase 5)
   * Channel: 'transcription:transcribe-audio'
   *
   * SECURITY ENFORCEMENT:
   * Validates that the audio file is a valid .wav file and resides strictly
   * within Dubbly's permitted temporary audio output directory.
   */
  ipcMain.handle('transcription:transcribe-audio', async (_, { audioPath, modelPath } = {}) => {
    if (!audioPath || typeof audioPath !== 'string') {
      throw new Error('Invalid audio path provided for transcription.')
    }

    if (!audioPath.toLowerCase().endsWith('.wav')) {
      throw new Error('Invalid audio format: Transcription requires a .wav file.')
    }

    // Security check: verify path is inside permitted directory
    const permittedDir = path.resolve(path.join(app.getPath('temp'), 'dubbly_audio'))
    const resolvedAudioPath = path.resolve(audioPath)

    if (!resolvedAudioPath.startsWith(permittedDir + path.sep)) {
      throw new Error(
        'Access denied: Audio file must reside within the Dubbly temporary working directory.'
      )
    }

    if (!fs.existsSync(resolvedAudioPath)) {
      throw new Error(`Audio file does not exist: "${audioPath}"`)
    }

    return await transcriptionService.transcribeAudio(resolvedAudioPath, { modelPath })
  })
}

export default registerIpcHandlers

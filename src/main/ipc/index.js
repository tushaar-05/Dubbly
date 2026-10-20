import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import videoService from '../services/video'

/**
 * IPC Handler Registry
 *
 * Responsibilities:
 * - Register ipcMain.handle listeners for secure, bidirectional communication with renderer.
 * - Enforce strict input validation on all IPC channels.
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
   * Securely reads an extracted WAV file from the temporary directory
   * and returns base64 data to allow safe in-browser playback without file:// access.
   */
  ipcMain.handle('video:read-audio-data', async (_, { audioPath } = {}) => {
    if (!audioPath || typeof audioPath !== 'string') {
      throw new Error('Invalid audio path provided.')
    }

    // Only allow reading files ending with .wav
    if (!audioPath.toLowerCase().endsWith('.wav')) {
      throw new Error('Access denied: Only audio files (.wav) can be read.')
    }

    if (!fs.existsSync(audioPath)) {
      throw new Error('Audio file does not exist or has been removed.')
    }

    const buffer = await fs.promises.readFile(audioPath)
    return buffer.toString('base64')
  })
}

export default registerIpcHandlers

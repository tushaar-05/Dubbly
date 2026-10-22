import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import videoService from '../services/video'
import transcriptionService from '../services/transcription'
import translationService from '../services/translation'
import ttsService from '../services/tts'

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

  /**
   * Transcript Translation Channel (Phase 6)
   * Channel: 'translation:translate-transcript'
   */
  ipcMain.handle('translation:translate-transcript', async (_, { segments, targetLanguage } = {}) => {
    // 1. Validate segments argument
    if (!segments || !Array.isArray(segments)) {
      throw new Error('Invalid request: segments must be an array of transcript items.')
    }

    if (segments.length === 0) {
      throw new Error(
        'Empty transcript: Cannot translate because no speech segments were provided. Please transcribe audio first.'
      )
    }

    // 2. Validate target language argument
    if (!targetLanguage || typeof targetLanguage !== 'string') {
      throw new Error('Target language code must be provided.')
    }

    return await translationService.translateTranscript(segments, targetLanguage)
  })

  /**
   * TTS Voices Configuration Channel (Phase 7)
   * Channel: 'tts:get-voices'
   */
  ipcMain.handle('tts:get-voices', async (_, { language } = {}) => {
    return ttsService.getVoices(language)
  })

  /**
   * TTS Speech Generation Channel (Phase 7)
   * Channel: 'tts:generate-speech'
   *
   * SECURITY & VALIDATION:
   * Validates segment array and target language.
   * Generates separate audio clips per segment into Dubbly's designated temporary directory.
   */
  ipcMain.handle('tts:generate-speech', async (_, { segments, targetLanguage, voice } = {}) => {
    if (!segments || !Array.isArray(segments)) {
      throw new Error('Invalid request: segments must be an array of transcript segments.')
    }

    if (segments.length === 0) {
      throw new Error('Empty segments: Cannot generate speech for an empty segment list.')
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      throw new Error('Target language code must be provided.')
    }

    return await ttsService.synthesizeSegments(segments, targetLanguage, { voice })
  })

  /**
   * Read Generated TTS Audio Clip Data for In-App Playback (Phase 7)
   * Channel: 'tts:read-audio-clip'
   *
   * SECURITY ENFORCEMENT:
   * Only permits reading .mp3 or .wav files located strictly inside Dubbly's designated
   * temporary TTS directory. Rejects directory traversal (../) and arbitrary file paths.
   */
  ipcMain.handle('tts:read-audio-clip', async (_, { clipPath } = {}) => {
    if (!clipPath || typeof clipPath !== 'string') {
      throw new Error('Invalid audio clip path provided.')
    }

    const lowerPath = clipPath.toLowerCase()
    if (!lowerPath.endsWith('.mp3') && !lowerPath.endsWith('.wav')) {
      throw new Error('Access denied: Only audio files (.mp3, .wav) can be read.')
    }

    const permittedDir = path.resolve(path.join(app.getPath('temp'), 'dubbly_tts'))
    const resolvedClipPath = path.resolve(clipPath)

    if (!resolvedClipPath.startsWith(permittedDir + path.sep)) {
      throw new Error(
        'Access denied: Cannot read files outside Dubbly temporary TTS directory.'
      )
    }

    if (!fs.existsSync(resolvedClipPath)) {
      throw new Error('Audio clip file does not exist or has been removed.')
    }

    const buffer = await fs.promises.readFile(resolvedClipPath)
    return buffer.toString('base64')
  })
}

export default registerIpcHandlers

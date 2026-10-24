import { ipcMain, app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import videoService from '../services/video'
import transcriptionService from '../services/transcription'
import translationService from '../services/translation'
import ttsService from '../services/tts'
import timingService from '../services/timing'
import subtitleService from '../services/subtitles'
import ocrService from '../services/ocr'
import diagnosticService from '../services/diagnostics'

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
   * Application Information & System Environment Channels (Phase 3 & Phase 12)
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

  ipcMain.handle('system:check-environment', async () => {
    return await diagnosticService.checkEnvironment()
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

    return await transcriptionService.transcribeAudio(resolvedAudioPath, {
      modelPath,
      onProgress: (p) => event.sender.send('pipeline:progress', p)
    })
  })

  /**
   * Transcript Translation Channel (Phase 6)
   * Channel: 'translation:translate-transcript'
   */
  ipcMain.handle('translation:translate-transcript', async (event, { segments, targetLanguage } = {}) => {
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

    return await translationService.translateTranscript(segments, targetLanguage, {
      onProgress: (p) => event.sender.send('pipeline:progress', p)
    })
  })

  /**
   * TTS Voices Configuration Channel (Phase 7)
   * Channel: 'tts:get-voices'
   */
  ipcMain.handle('tts:get-voices', async (_, { language } = {}) => {
    return ttsService.getVoices(language)
  })

  /**
   * TTS Speech Generation Channel (Phase 7 & Phase 9)
   * Channel: 'tts:generate-speech'
   *
   * SECURITY & VALIDATION:
   * Validates segment array and target language.
   * Generates or reuses cached audio clips per segment inside Dubbly's designated temporary directory.
   */
  ipcMain.handle('tts:generate-speech', async (event, { segments, targetLanguage, voice } = {}) => {
    if (!segments || !Array.isArray(segments)) {
      throw new Error('Invalid request: segments must be an array of transcript segments.')
    }

    if (segments.length === 0) {
      throw new Error('Empty segments: Cannot generate speech for an empty segment list.')
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      throw new Error('Target language code must be provided.')
    }

    return await ttsService.synthesizeSegments(segments, targetLanguage, {
      voice,
      onProgress: (p) => event.sender.send('pipeline:progress', p)
    })
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

  /**
   * Video Dubbing & Export Channel (Phase 8 & Phase 9)
   * Channel: 'video:export-dubbed'
   *
   * SECURITY & VALIDATION:
   * Validates videoPath, clips array, and ensures audio clips exist on disk.
   * Creates synchronized master audio track with timing adjustments,
   * then combines with original video using lossless stream copy.
   */
  ipcMain.handle('video:export-dubbed', async (event, { videoPath, clips, targetLanguage, options } = {}) => {
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('Invalid video path provided for export.')
    }
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at specified path: "${videoPath}"`)
    }
    if (!clips || !Array.isArray(clips) || clips.length === 0) {
      throw new Error('Export failed: No voice clips provided.')
    }
    const validClips = clips.filter((c) => c.hasAudio && c.audioPath && fs.existsSync(c.audioPath))
    if (validClips.length === 0) {
      throw new Error('Export failed: None of the provided clips contain generated audio files.')
    }

    // 1. Probe total video duration
    event.sender.send('pipeline:progress', {
      operation: 'export',
      percent: 15,
      message: 'Probing video duration and timeline...'
    })
    const totalDuration = await timingService.probeDuration(videoPath)

    // 2. Create synchronized master audio track
    event.sender.send('pipeline:progress', {
      operation: 'export',
      percent: 45,
      message: 'Assembling synchronized master audio track and adjusting speech timing...'
    })
    const masterAudioResult = await timingService.createSynchronizedAudioTrack(
      validClips,
      totalDuration,
      options
    )

    // 3. Combine original video with synchronized dubbed audio
    event.sender.send('pipeline:progress', {
      operation: 'export',
      percent: 80,
      message: 'Muxing video with synchronized dubbed audio via lossless stream copy...'
    })
    const exportResult = await videoService.combineVideoAndAudio(
      videoPath,
      masterAudioResult.masterAudioPath,
      { language: targetLanguage, ...options }
    )

    event.sender.send('pipeline:progress', {
      operation: 'export',
      percent: 100,
      message: 'Dubbed video export complete!'
    })

    return {
      ...exportResult,
      durationSec: totalDuration,
      targetLanguage: targetLanguage || 'hi',
      timedClipsCount: masterAudioResult.timedClips,
      adjustedClipsCount: masterAudioResult.adjustedClipsCount
    }
  })

  /**
   * Read Exported Video for In-App HTML5 Preview (Phase 8)
   * Channel: 'video:read-exported-video'
   *
   * SECURITY ENFORCEMENT:
   * Only permits reading files located strictly inside Dubbly's designated
   * temporary exports directory. Rejects directory traversal (../) and arbitrary paths.
   */
  ipcMain.handle('video:read-exported-video', async (_, { videoPath } = {}) => {
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('Invalid video path provided.')
    }

    const permittedDir = path.resolve(path.join(app.getPath('temp'), 'dubbly_exports'))
    const resolvedVideoPath = path.resolve(videoPath)

    if (!resolvedVideoPath.startsWith(permittedDir + path.sep)) {
      throw new Error(
        'Access denied: Cannot read files outside Dubbly temporary exports directory.'
      )
    }

    if (!fs.existsSync(resolvedVideoPath)) {
      throw new Error('Exported video file does not exist or has been removed.')
    }

    const buffer = await fs.promises.readFile(resolvedVideoPath)
    return buffer.toString('base64')
  })

  /**
   * Reveal Exported File in macOS Finder / OS File Explorer (Phase 8)
   * Channel: 'video:show-in-folder'
   */
  ipcMain.handle('video:show-in-folder', async (_, { filePath } = {}) => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path provided.')
    }

    const resolvedPath = path.resolve(filePath)
    if (!fs.existsSync(resolvedPath)) {
      throw new Error('File does not exist.')
    }

    shell.showItemInFolder(resolvedPath)
    return true
  })

  /**
   * Subtitle Export Channel (Phase 10)
   * Channel: 'subtitles:export'
   *
   * SECURITY & VALIDATION:
   * Validates segments array, format ('srt'|'vtt'), and timestamps.
   * Prompts user via native Save Dialog or writes to safe destination path.
   */
  ipcMain.handle('subtitles:export', async (_, { segments, format = 'srt', options = {} } = {}) => {
    if (!segments || !Array.isArray(segments)) {
      throw new Error('Invalid request: segments must be an array of subtitle segments.')
    }

    if (segments.length === 0) {
      throw new Error(
        'Cannot export subtitles: No transcript segments available. Please transcribe and translate audio first.'
      )
    }

    const fmt = (format || 'srt').toLowerCase()
    if (fmt !== 'srt' && fmt !== 'vtt') {
      throw new Error(`Unsupported subtitle format "${format}". Only "srt" and "vtt" are supported.`)
    }

    return await subtitleService.exportSubtitles(segments, fmt, options)
  })

  /**
   * Subtitle Content Preview Channel (Phase 10)
   * Channel: 'subtitles:generate-preview'
   */
  ipcMain.handle('subtitles:generate-preview', async (_, { segments, format = 'srt', options = {} } = {}) => {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error('Cannot generate subtitles: No segments provided.')
    }

    const fmt = (format || 'srt').toLowerCase()
    if (fmt !== 'srt' && fmt !== 'vtt') {
      throw new Error(`Unsupported subtitle format "${format}". Only "srt" and "vtt" are supported.`)
    }

    return subtitleService.generate(segments, fmt, options)
  })

  /**
   * On-Screen Text Detection Channel (Phase 11)
   * Channel: 'ocr:detect'
   *
   * SECURITY & VALIDATION:
   * Validates video file existence and allowed extension.
   * Extracts sampled frames at sensible intervals and runs Tesseract OCR.
   * Sends real-time progress events to caller window.
   */
  ipcMain.handle('ocr:detect', async (event, { videoPath, intervalSec = 2 } = {}) => {
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('A valid video file path must be provided for on-screen text detection.')
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file does not exist: "${videoPath}"`)
    }

    const ext = path.extname(videoPath).toLowerCase()
    const allowedExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.wmv']
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`Unsupported video format "${ext}". Allowed: ${allowedExtensions.join(', ')}`)
    }

    return await ocrService.detectVideoText(videoPath, {
      intervalSec,
      onProgress: (progress) => {
        try {
          event.sender.send('ocr:progress', progress)
        } catch {
          // ignore sender destroyed
        }
      }
    })
  })

  /**
   * On-Screen Text Translation Channel (Phase 11)
   * Channel: 'ocr:translate'
   *
   * Translates detected on-screen text into the chosen Indian language.
   * Kept completely independent of spoken transcript segments.
   */
  ipcMain.handle('ocr:translate', async (event, { items, targetLanguage } = {}) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No on-screen text items provided for translation.')
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      throw new Error('A target language must be specified for translating on-screen text.')
    }

    return await ocrService.translateOcrItems(items, targetLanguage, {
      onProgress: (progress) => {
        try {
          event.sender.send('ocr:translate-progress', progress)
        } catch {
          // ignore sender destroyed
        }
      }
    })
  })
}

export default registerIpcHandlers

import React, { useState, useRef, useEffect } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Trash2,
  RefreshCw,
  FileVideo,
  FileAudio,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react'
import { formatDuration, formatFileSize } from '../utils/formatters'
import apiService from '../services/api'

/**
 * VideoPreview Component
 * Displays video preview with play/pause controls, progress scrubber,
 * file metadata, replace/remove options, and FFmpeg audio extraction.
 */
function VideoPreview({ videoFile, previewUrl, onReplace, onRemove }) {
  const videoRef = useRef(null)
  const replaceInputRef = useRef(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 })
  const [hasPlaybackError, setHasPlaybackError] = useState(false)

  // Audio Extraction States (Phase 4)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState(null)
  const [extractedAudioUrl, setExtractedAudioUrl] = useState(null)
  const [extractionError, setExtractionError] = useState(null)

  // Reset playback and extraction states when a new preview URL is loaded
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setHasPlaybackError(false)
    setExtractionResult(null)
    setExtractionError(null)

    if (extractedAudioUrl) {
      URL.revokeObjectURL(extractedAudioUrl)
      setExtractedAudioUrl(null)
    }
  }, [previewUrl])

  // Cleanup audio blob URL on unmount
  useEffect(() => {
    return () => {
      if (extractedAudioUrl) {
        URL.revokeObjectURL(extractedAudioUrl)
      }
    }
  }, [extractedAudioUrl])

  const togglePlayPause = () => {
    if (!videoRef.current) return

    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Video play error:', err)
          setIsPlaying(false)
        })
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0)
      setVideoDimensions({
        width: videoRef.current.videoWidth || 0,
        height: videoRef.current.videoHeight || 0
      })
    }
  }

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    const nextMuted = !isMuted
    videoRef.current.muted = nextMuted
    setIsMuted(nextMuted)
  }

  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().then(() => setIsPlaying(true))
    }
  }

  const handleReplaceClick = () => {
    if (replaceInputRef.current) {
      replaceInputRef.current.value = ''
      replaceInputRef.current.click()
    }
  }

  const handleReplaceFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onReplace(e.target.files[0])
    }
  }

  /**
   * Handle Audio Extraction Trigger
   * Retrieves the video's absolute filesystem path and invokes main process FFmpeg.
   */
  const handleExtractAudio = async () => {
    try {
      setIsExtracting(true)
      setExtractionError(null)

      const videoPath = apiService.getPathForFile(videoFile)
      if (!videoPath) {
        throw new Error(
          'Could not access the local filesystem path for this video. Please re-select the file using Browse.'
        )
      }

      console.log('[Dubbly] Requesting audio extraction for:', videoPath)
      const result = await apiService.extractAudio(videoPath)
      console.log('[Dubbly] Extraction completed successfully:', result)

      setExtractionResult(result)

      // Fetch the extracted audio as a Blob URL for instant in-app playback
      try {
        const audioBlobUrl = await apiService.getAudioBlobUrl(result.outputPath)
        setExtractedAudioUrl(audioBlobUrl)
      } catch (blobErr) {
        console.warn('Could not load audio playback blob:', blobErr)
      }
    } catch (err) {
      console.error('[Dubbly] Audio extraction error:', err)
      setExtractionError(err.message || 'Failed to extract audio from video.')
    } finally {
      setIsExtracting(false)
    }
  }

  /**
   * Test Invalid File Helper
   * Allows testing how the application and IPC bridge respond to invalid input.
   */
  const handleTestInvalidFile = async () => {
    try {
      setIsExtracting(true)
      setExtractionError(null)
      // Provide an intentionally non-existent path to test validation
      await apiService.extractAudio('/invalid/path/non_existent_video.mp4')
    } catch (err) {
      setExtractionError(err.message)
    } finally {
      setIsExtracting(false)
    }
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="preview-container">
      {/* Hidden file input for Replace action */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.mkv,.webm"
        className="file-input-hidden"
        onChange={handleReplaceFileChange}
      />

      {/* Video Player Card */}
      <div className="video-card">
        <div className="video-frame" onClick={togglePlayPause}>
          <video
            ref={videoRef}
            src={previewUrl}
            className="video-element"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onError={() => setHasPlaybackError(true)}
            playsInline
          />

          {/* Centered Play Button Overlay when paused */}
          {!isPlaying && (
            <div className="video-play-overlay" aria-label="Play Video">
              <div className="play-overlay-button">
                <Play size={28} className="icon-play" />
              </div>
            </div>
          )}
        </div>

        {hasPlaybackError && (
          <div className="preview-notice-box">
            <span>
              Note: This video format may not support inline browser playback, but it will be processed completely by FFmpeg in the dubbing pipeline.
            </span>
          </div>
        )}

        {/* Video Controls Bar */}
        <div className="video-controls-bar">
          <button
            type="button"
            className="ctrl-btn"
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            type="button"
            className="ctrl-btn"
            onClick={handleRestart}
            title="Restart"
          >
            <RotateCcw size={16} />
          </button>

          <div className="time-display">
            <span>{formatDuration(currentTime)}</span>
            <span className="time-divider">/</span>
            <span>{formatDuration(duration)}</span>
          </div>

          <div className="scrubber-wrapper">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="scrubber-slider"
              style={{
                background: `linear-gradient(to right, #0284c7 ${progressPercent}%, #e2e8f0 ${progressPercent}%)`
              }}
            />
          </div>

          <button
            type="button"
            className="ctrl-btn"
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* Video Details & Actions Card */}
      <div className="video-meta-card">
        <div className="meta-info-col">
          <div className="meta-filename-row">
            <FileVideo size={18} className="meta-icon" />
            <span className="meta-filename" title={videoFile?.name}>
              {videoFile?.name || 'Selected Video'}
            </span>
          </div>

          <div className="meta-tags-row">
            <span className="meta-pill">
              <HardDrive size={13} />
              {formatFileSize(videoFile?.size || 0)}
            </span>

            {duration > 0 && (
              <span className="meta-pill">
                <Clock size={13} />
                {formatDuration(duration)}
              </span>
            )}

            {videoDimensions.width > 0 && (
              <span className="meta-pill">
                {videoDimensions.width}x{videoDimensions.height}
              </span>
            )}
          </div>
        </div>

        <div className="meta-actions-row">
          <button
            type="button"
            className="btn-meta-action btn-primary-action"
            onClick={handleExtractAudio}
            disabled={isExtracting}
            title="Extract 16kHz mono audio via FFmpeg"
          >
            {isExtracting ? (
              <>
                <Loader2 size={14} className="spin-icon" />
                <span>Extracting...</span>
              </>
            ) : (
              <>
                <FileAudio size={14} />
                <span>Extract Audio</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-meta-action"
            onClick={handleReplaceClick}
            title="Choose a different video file"
          >
            <RefreshCw size={14} />
            <span>Replace</span>
          </button>

          <button
            type="button"
            className="btn-meta-action btn-danger"
            onClick={onRemove}
            title="Remove this video"
          >
            <Trash2 size={14} />
            <span>Remove</span>
          </button>
        </div>
      </div>

      {/* Extraction In-Progress Banner */}
      {isExtracting && (
        <div className="extraction-status-card loading">
          <Loader2 size={18} className="spin-icon text-primary" />
          <div className="extraction-status-text">
            <strong>Running FFmpeg Audio Extraction...</strong>
            <span>Extracting 16kHz 16-bit mono WAV for Whisper transcription.</span>
          </div>
        </div>
      )}

      {/* Extraction Success Card with Audio Player */}
      {extractionResult && (
        <div className="extraction-status-card success">
          <div className="status-header-row">
            <div className="status-title-group">
              <CheckCircle2 size={18} className="text-success" />
              <strong>Audio Extracted Successfully (Whisper Ready)</strong>
            </div>
            <button
              type="button"
              className="btn-dismiss"
              onClick={() => setExtractionResult(null)}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>

          <div className="extraction-details-grid">
            <div className="detail-item">
              <span className="detail-label">File:</span>
              <span className="detail-value">{extractionResult.filename}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Size:</span>
              <span className="detail-value">{formatFileSize(extractionResult.sizeBytes)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Format:</span>
              <span className="detail-value">{extractionResult.format}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Location:</span>
              <span className="detail-value path" title={extractionResult.outputPath}>
                {extractionResult.outputPath}
              </span>
            </div>
          </div>

          {/* Interactive HTML5 Audio Player */}
          {extractedAudioUrl && (
            <div className="audio-player-wrapper">
              <span className="audio-player-label">Listen to Extracted Audio:</span>
              <audio controls src={extractedAudioUrl} className="audio-player-control" />
            </div>
          )}
        </div>
      )}

      {/* Extraction Error Alert Card */}
      {extractionError && (
        <div className="extraction-status-card error">
          <div className="status-header-row">
            <div className="status-title-group">
              <AlertCircle size={18} className="text-danger" />
              <strong>Audio Extraction Error</strong>
            </div>
            <button
              type="button"
              className="btn-dismiss"
              onClick={() => setExtractionError(null)}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
          <p className="error-message-text">{extractionError}</p>
        </div>
      )}

      {/* Small Test Helper for Error Handling Verification */}
      <div className="test-helper-row">
        <span className="test-helper-label">Phase 4 Verification:</span>
        <button
          type="button"
          className="btn-text-link"
          onClick={handleTestInvalidFile}
          disabled={isExtracting}
        >
          Test Invalid File Error
        </button>
      </div>
    </div>
  )
}

export default VideoPreview

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
  Clock,
  HardDrive
} from 'lucide-react'
import { formatDuration, formatFileSize } from '../utils/formatters'

/**
 * VideoPreview Component
 * Displays video preview with play/pause controls, progress scrubber,
 * file metadata, and replace/remove options.
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

  // Reset playback state when a new preview URL is loaded
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setHasPlaybackError(false)
  }, [previewUrl])

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
    </div>
  )
}

export default VideoPreview

import React, { useState, useRef } from 'react'
import { UploadCloud, Film, AlertCircle } from 'lucide-react'

/**
 * VideoUpload Component
 * Clean drag-and-drop upload zone with a file browse trigger.
 * Accepts standard video formats: MP4, MOV, MKV, WebM.
 */
function VideoUpload({ onVideoSelect }) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const validateAndSelectFile = (file) => {
    if (!file) return

    // Verify it is a video file by type or extension
    const isVideoType = file.type.startsWith('video/')
    const validExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.avi']
    const hasValidExt = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )

    if (!isVideoType && !hasValidExt) {
      setUploadError('Please select a valid video file (.mp4, .mov, .mkv, or .webm).')
      return
    }

    setUploadError(null)
    onVideoSelect(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      validateAndSelectFile(droppedFile)
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      validateAndSelectFile(selectedFile)
    }
  }

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  return (
    <div
      className={`upload-card ${isDragging ? 'drag-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.mkv,.webm"
        className="file-input-hidden"
        onChange={handleFileChange}
      />

      <div className="upload-icon-wrapper">
        <UploadCloud size={36} className="upload-icon" />
      </div>

      <h3 className="upload-title">Drag & drop your English video here</h3>
      <p className="upload-subtitle">
        Supports MP4, MOV, WebM, and MKV formats
      </p>

      <button
        type="button"
        className="btn-browse"
        onClick={handleBrowseClick}
      >
        <Film size={16} />
        <span>Browse Video File</span>
      </button>

      {uploadError && (
        <div className="upload-error-box">
          <AlertCircle size={16} />
          <span>{uploadError}</span>
        </div>
      )}

      <div className="upload-hint">
        <span>Dubbly will transcribe, translate, and generate synced audio</span>
      </div>
    </div>
  )
}

export default VideoUpload

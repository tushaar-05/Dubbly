import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import VideoUpload from './components/VideoUpload'
import VideoPreview from './components/VideoPreview'
import DubbingSettings from './components/DubbingSettings'

/**
 * Dubbly Main Application Component
 * Phase 2: Clean, minimal white interface with video selection, preview & dubbing settings.
 */
function App() {
  const [videoFile, setVideoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState('hi') // Default to Hindi

  // Handle user selecting or dropping a video file
  const handleVideoSelect = (file) => {
    if (!file) return

    // Clean up previous blob URL to prevent memory leaks
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setVideoFile(file)
    setPreviewUrl(objectUrl)
  }

  // Handle replacing current video with a new one
  const handleReplace = (newFile) => {
    handleVideoSelect(newFile)
  }

  // Handle removing current video and resetting state
  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setVideoFile(null)
    setPreviewUrl(null)
  }

  // Cleanup blob URL when the component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <div className="app-container">
      <Header />

      <main className="app-workspace">
        {/* Left Side: Video Upload & Preview Area */}
        <section className="workspace-main" aria-label="Video Workspace">
          {!videoFile ? (
            <VideoUpload onVideoSelect={handleVideoSelect} />
          ) : (
            <VideoPreview
              videoFile={videoFile}
              previewUrl={previewUrl}
              onReplace={handleReplace}
              onRemove={handleRemove}
            />
          )}
        </section>

        {/* Right Side: Dubbing Configuration Panel */}
        <aside className="workspace-sidebar" aria-label="Dubbing Settings">
          <DubbingSettings
            hasVideo={!!videoFile}
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
          />
        </aside>
      </main>
    </div>
  )
}

export default App

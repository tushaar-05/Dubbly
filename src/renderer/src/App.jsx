import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import VideoUpload from './components/VideoUpload'
import VideoPreview from './components/VideoPreview'
import DubbingSettings from './components/DubbingSettings'
import EnvironmentModal from './components/EnvironmentModal'
import apiService from './services/api'
import { AlertCircle, Wrench } from 'lucide-react'

/**
 * Dubbly Main Application Component
 * Phase 2 - 12: Complete AI Video Dubbing & Translation Studio with Environment Diagnostics.
 */
function App() {
  const [videoFile, setVideoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState('hi') // Default to Hindi

  // Environment & Dependency Check States (Phase 12)
  const [envStatus, setEnvStatus] = useState(null)
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)

  const refreshDiagnostics = useCallback(async () => {
    try {
      setIsDiagnosticsLoading(true)
      const diag = await apiService.checkEnvironment()
      setEnvStatus(diag)
    } catch (err) {
      console.warn('[Dubbly] Failed to run environment diagnostics:', err)
    } finally {
      setIsDiagnosticsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshDiagnostics()
  }, [refreshDiagnostics])

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
      <Header
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        envStatus={envStatus}
        isDiagnosticsLoading={isDiagnosticsLoading}
      />

      <main className="app-workspace">
        {/* Left Side: Video Upload & Preview Area */}
        <section className="workspace-main" aria-label="Video Workspace">
          {/* Missing Dependencies Notice Banner (Phase 12) */}
          {envStatus && !envStatus.allRequiredReady && (
            <div className="env-preflight-alert">
              <div className="env-alert-content">
                <AlertCircle size={16} className="text-warning" />
                <span>
                  <strong>Setup Needed:</strong> {envStatus.summary}
                </span>
              </div>
              <button
                type="button"
                className="btn-env-alert-action"
                onClick={() => setIsDiagnosticsOpen(true)}
                title="Inspect missing tools and fix commands"
              >
                <Wrench size={13} />
                <span>View Setup Guide</span>
              </button>
            </div>
          )}

          {!videoFile ? (
            <VideoUpload onVideoSelect={handleVideoSelect} />
          ) : (
            <VideoPreview
              videoFile={videoFile}
              previewUrl={previewUrl}
              targetLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
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

      {/* System Environment & Dependency Diagnostics Modal (Phase 12) */}
      <EnvironmentModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        diagnostics={envStatus}
        isLoading={isDiagnosticsLoading}
        onRefresh={refreshDiagnostics}
      />
    </div>
  )
}

export default App

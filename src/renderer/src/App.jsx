import React, { useState, useEffect, useCallback, useRef } from 'react'
import Header from './components/Header'
import VideoUpload from './components/VideoUpload'
import VideoPreview, { INDIAN_VOICE_CONFIG } from './components/VideoPreview'
import DubbingSettings from './components/DubbingSettings'
import EnvironmentModal from './components/EnvironmentModal'
import apiService from './services/api'
import { AlertCircle, Wrench } from 'lucide-react'

/**
 * Dubbly Main Application Component
 * Phase 2 - 13: Complete AI Video Dubbing & Translation Studio with Full Pipeline Execution.
 */
function App() {
  const [videoFile, setVideoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState('hi') // Default to Hindi
  const [selectedVoice, setSelectedVoice] = useState('hi-IN-MadhurNeural')

  // Pipeline Execution State (Phase 13)
  const [dubbingStatus, setDubbingStatus] = useState({
    isDubbing: false,
    step: null, // 'extracting' | 'transcribing' | 'translating' | 'tts' | 'exporting' | 'done' | 'error'
    progress: null,
    error: null,
    exportResult: null
  })

  const videoPreviewRef = useRef(null)

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

  // Automatically update selected neural voice when target language changes
  const handleLanguageChange = (newLang) => {
    setSelectedLanguage(newLang)
    const available = INDIAN_VOICE_CONFIG[newLang]
    if (available && available.length > 0) {
      setSelectedVoice(available[0].id)
    }
  }

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
    // Reset pipeline status for new video
    setDubbingStatus({
      isDubbing: false,
      step: null,
      progress: null,
      error: null,
      exportResult: null
    })
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
    setDubbingStatus({
      isDubbing: false,
      step: null,
      progress: null,
      error: null,
      exportResult: null
    })
  }

  // Cleanup blob URL when the component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Trigger full pipeline from Start Dubbing button
  const handleStartDubbing = () => {
    if (videoPreviewRef.current?.runFullDubbingPipeline) {
      videoPreviewRef.current.runFullDubbingPipeline()
    }
  }

  // Reveal exported video in system Finder / Explorer
  const handleOpenExportFolder = () => {
    if (videoPreviewRef.current?.openExportFolder) {
      videoPreviewRef.current.openExportFolder()
    }
  }

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
              ref={videoPreviewRef}
              videoFile={videoFile}
              previewUrl={previewUrl}
              targetLanguage={selectedLanguage}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              onLanguageChange={handleLanguageChange}
              onReplace={handleReplace}
              onRemove={handleRemove}
              onPipelineStatusChange={setDubbingStatus}
            />
          )}
        </section>

        {/* Right Side: Dubbing Configuration Panel */}
        <aside className="workspace-sidebar" aria-label="Dubbing Settings">
          <DubbingSettings
            hasVideo={!!videoFile}
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            availableVoices={INDIAN_VOICE_CONFIG[selectedLanguage] || []}
            onStartDubbing={handleStartDubbing}
            isDubbing={dubbingStatus.isDubbing}
            dubbingStep={dubbingStatus.step}
            pipelineProgress={dubbingStatus.progress}
            dubbingError={dubbingStatus.error}
            exportResult={dubbingStatus.exportResult}
            onOpenFolder={handleOpenExportFolder}
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

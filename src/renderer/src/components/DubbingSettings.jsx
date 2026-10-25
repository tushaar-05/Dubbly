import React, { useState } from 'react'
import {
  Sparkles,
  Sliders,
  Volume2,
  Subtitles,
  ScanText,
  Info,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  RotateCcw
} from 'lucide-react'

// The 6 supported Indian target languages
export const INDIAN_LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' }
]

/**
 * DubbingSettings Component
 * Polished, minimal settings panel.
 * Provides target language selection, neural voice choices, grouped advanced options
 * (Lip Sync, Subtitles, OCR), and the primary Start Dubbing action.
 */
function DubbingSettings({
  hasVideo,
  selectedLanguage = 'hi',
  onLanguageChange,
  selectedVoice,
  onVoiceChange,
  availableVoices = [],
  onStartDubbing,
  isDubbing = false,
  dubbingStep = null,
  pipelineProgress = null,
  dubbingError = null,
  exportResult = null,
  onOpenFolder
}) {
  const [smartEnhance, setSmartEnhance] = useState(true)
  const [lipSyncEnabled, setLipSyncEnabled] = useState(true)
  const [syncPercentage, setSyncPercentage] = useState(40)
  const [generateSubtitles, setGenerateSubtitles] = useState(true)
  const [ocrEnabled, setOcrEnabled] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const getStepLabel = (step) => {
    switch (step) {
      case 'extracting':
        return 'Step 1/5: Extracting Audio'
      case 'transcribing':
        return 'Step 2/5: Transcribing Speech'
      case 'translating':
        return 'Step 3/5: Translating Script'
      case 'tts':
        return 'Step 4/5: Generating Voiceover'
      case 'exporting':
        return 'Step 5/5: Exporting Video'
      default:
        return 'Processing Pipeline...'
    }
  }

  const getButtonText = () => {
    if (!isDubbing) {
      return (
        <>
          <Sparkles size={16} />
          <span>Start Dubbing</span>
        </>
      )
    }

    let text = 'Dubbing Video...'
    switch (dubbingStep) {
      case 'starting':
        text = 'Starting Dubbing...'
        break
      case 'extracting':
        text = 'Extracting Audio...'
        break
      case 'transcribing':
        text = 'Transcribing Speech...'
        break
      case 'translating':
        text = 'Translating Script...'
        break
      case 'tts':
        text = 'Synthesizing Speech...'
        break
      case 'exporting':
        text = 'Exporting Video...'
        break
      default:
        text = 'Dubbing Video...'
    }

    return (
      <>
        <Loader2 size={16} className="spin-icon" />
        <span>{text}</span>
      </>
    )
  }

  return (
    <div className="settings-panel">
      {/* Settings Header */}
      <div className="settings-header">
        <div className="settings-title-group">
          <Sliders size={16} className="text-primary" />
          <h2 className="settings-title">Dubbing Settings</h2>
        </div>
        <span className="settings-status-pill">
          {hasVideo ? 'Video Ready' : 'Awaiting Video'}
        </span>
      </div>

      <div className="settings-content">
        {/* Section 1: Target Language & Voice Selection (Primary & Easy to Find) */}
        <div className="setting-card-section">
          <div className="section-header-subtle">
            <span className="section-title-text">Language & Voice</span>
          </div>

          {/* Source Language (Fixed English) */}
          <div className="setting-field-row">
            <div className="field-label-group">
              <span className="field-label">Source Language</span>
              <Info size={13} className="info-icon" title="Original video audio language" />
            </div>
            <div className="language-badge locked">
              <span className="flag-circle">🇬🇧</span>
              <span className="lang-name">English</span>
            </div>
          </div>

          {/* Target Language Dropdown */}
          <div className="setting-field-row">
            <div className="field-label-group">
              <span className="field-label">Target Language</span>
              <Info
                size={13}
                className="info-icon"
                title="Dubbing will translate and synthesize speech in this language"
              />
            </div>

            <div className="select-wrapper">
              <span className="flag-circle">🇮🇳</span>
              <select
                className="language-select"
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                disabled={isDubbing}
              >
                {INDIAN_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} ({lang.native})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
          </div>

          {/* Neural Speaker Voice Dropdown */}
          <div className="setting-field-row">
            <div className="field-label-group">
              <span className="field-label">Neural Voice</span>
              <Info
                size={13}
                className="info-icon"
                title="Select natural neural speaker for voiceover synthesis"
              />
            </div>

            <div className="select-wrapper">
              <select
                className="language-select voice-select"
                value={selectedVoice}
                onChange={(e) => onVoiceChange && onVoiceChange(e.target.value)}
                disabled={isDubbing}
              >
                {availableVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
          </div>
        </div>

        {/* Section 2: Grouped Advanced Options (Lip-Sync, Subtitles, OCR, Smart Enhance) */}
        <div className="setting-card-section advanced-section">
          <button
            type="button"
            className="advanced-toggle-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="Toggle advanced options (Lip-Sync, Subtitles, OCR, Smart Enhancements)"
          >
            <div className="advanced-toggle-label">
              <Volume2 size={15} className="text-primary" />
              <span>Advanced Options</span>
            </div>
            <div className="advanced-toggle-status">
              <span className="advanced-summary-text">
                {showAdvanced ? 'Hide' : 'Lip-Sync, Subtitles, OCR'}
              </span>
              <ChevronDown
                size={14}
                className={`advanced-chevron ${showAdvanced ? 'rotated' : ''}`}
              />
            </div>
          </button>

          {showAdvanced && (
            <div className="advanced-content-body">
              {/* Lip Sync Adjustment */}
              <div className="advanced-subgroup">
                <div className="setting-row-card">
                  <div className="setting-info">
                    <span className="setting-label text-sm">Lip Sync Adjustment</span>
                    <span className="setting-desc">Pace speech rate to video intervals</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={lipSyncEnabled}
                      onChange={(e) => setLipSyncEnabled(e.target.checked)}
                    />
                    <span className="slider-pill"></span>
                  </label>
                </div>

                {lipSyncEnabled && (
                  <div className="sync-slider-card">
                    <div className="slider-labels">
                      <span>0%</span>
                      <span className="slider-badge">{syncPercentage}%</span>
                      <span>100%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={syncPercentage}
                      onChange={(e) => setSyncPercentage(parseInt(e.target.value, 10))}
                      className="range-input"
                    />
                  </div>
                )}
              </div>

              <div className="divider-subtle" />

              {/* Subtitle Generation */}
              <div className="setting-row-card">
                <div className="setting-info">
                  <span className="setting-label text-sm">Generate Subtitles</span>
                  <span className="setting-desc">Export translated SRT / WebVTT files</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={generateSubtitles}
                    onChange={(e) => setGenerateSubtitles(e.target.checked)}
                  />
                  <span className="slider-pill"></span>
                </label>
              </div>

              <div className="divider-subtle" />

              {/* On-Screen Text OCR */}
              <div className="setting-row-card">
                <div className="setting-info">
                  <span className="setting-label text-sm">On-Screen Text OCR</span>
                  <span className="setting-desc">Detect visible titles in video frames</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={ocrEnabled}
                    onChange={(e) => setOcrEnabled(e.target.checked)}
                  />
                  <span className="slider-pill"></span>
                </label>
              </div>

              <div className="divider-subtle" />

              {/* Smart Enhancements */}
              <div className="setting-row-card">
                <div className="setting-info">
                  <span className="setting-label text-sm">Smart Enhancements</span>
                  <span className="setting-desc">Automated timing & audio smoothing</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={smartEnhance}
                    onChange={(e) => setSmartEnhance(e.target.checked)}
                  />
                  <span className="slider-pill"></span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Bottom Action: Prominent Start Dubbing Button + Contextual Feedback */}
        <div className="settings-footer">
          {/* Live Progress Card - only rendered when dubbing is active */}
          {isDubbing && (
            <div className="dubbing-live-progress">
              <div className="dubbing-step-row">
                <span className="dubbing-step-chip">{getStepLabel(dubbingStep)}</span>
                {pipelineProgress?.percent !== undefined && (
                  <span className="dubbing-percent">{pipelineProgress.percent}%</span>
                )}
              </div>
              <p className="dubbing-message">
                {pipelineProgress?.message || 'Processing video dubbing pipeline...'}
              </p>
              <div className="pipeline-progress-track">
                <div
                  className="pipeline-progress-fill"
                  style={{ width: `${pipelineProgress?.percent || 20}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Banner - only rendered when video export succeeds */}
          {exportResult && !isDubbing && (
            <div className="dubbing-success-banner">
              <div className="dubbing-success-header">
                <CheckCircle2 size={16} className="text-success" />
                <strong>Dubbing Complete!</strong>
              </div>
              <p className="dubbing-success-meta">
                Language: {selectedLanguage.toUpperCase()} • Duration:{' '}
                {exportResult.duration ? `${Math.round(exportResult.duration)}s` : 'Full'}
              </p>
              <div className="dubbing-success-actions">
                <button
                  type="button"
                  className="btn-success-action"
                  onClick={onOpenFolder}
                  title="Reveal exported video in system Finder / Explorer"
                >
                  <FolderOpen size={13} />
                  <span>Show in Folder</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Banner - only rendered when dubbing fails */}
          {dubbingError && !isDubbing && (
            <div className="dubbing-error-banner">
              <div className="dubbing-error-header">
                <AlertCircle size={16} className="text-danger" />
                <strong>Dubbing Failed</strong>
              </div>
              <p className="dubbing-error-message">{dubbingError}</p>
              <button
                type="button"
                className="btn-retry-dubbing"
                onClick={onStartDubbing}
                title="Retry the dubbing pipeline"
              >
                <RotateCcw size={13} />
                <span>Retry Dubbing</span>
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="button"
            className={`btn-start-dubbing ${isDubbing ? 'running' : ''}`}
            disabled={!hasVideo || isDubbing}
            onClick={onStartDubbing}
            title={
              !hasVideo
                ? 'Please select or drop a video file first'
                : isDubbing
                  ? 'Dubbing pipeline is in progress...'
                  : 'Run complete pipeline: Extract → Transcribe → Translate → Synthesize → Export'
            }
          >
            {getButtonText()}
          </button>

          <p className="pipeline-notice">
            {!hasVideo
              ? 'Select or drop an English video to begin'
              : isDubbing
                ? 'Automated pipeline active — keep Dubbly open'
                : 'Runs Extract → Transcribe → Translate → Synthesize → Export'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default DubbingSettings

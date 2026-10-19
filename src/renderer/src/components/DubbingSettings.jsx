import React, { useState } from 'react'
import {
  Sparkles,
  Languages,
  Sliders,
  Volume2,
  Subtitles,
  ScanText,
  Info,
  Check,
  ChevronDown
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
 * Minimalist settings panel inspired by the reference screenshots.
 * Provides target language selection, timing/lip-sync controls, and dubbing trigger.
 */
function DubbingSettings({
  hasVideo,
  selectedLanguage,
  onLanguageChange
}) {
  const [smartEnhance, setSmartEnhance] = useState(true)
  const [lipSyncEnabled, setLipSyncEnabled] = useState(true)
  const [syncPercentage, setSyncPercentage] = useState(40)
  const [generateSubtitles, setGenerateSubtitles] = useState(true)
  const [ocrEnabled, setOcrEnabled] = useState(false)
  const [activeTab, setActiveTab] = useState('enhance')

  return (
    <div className="settings-panel">
      {/* Top Tab Bar from Reference Image 1 */}
      <div className="settings-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'enhance' ? 'active' : ''}`}
          onClick={() => setActiveTab('enhance')}
          title="Enhancements"
        >
          <Sparkles size={18} />
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveTab('audio')}
          title="Audio & Timing"
        >
          <Volume2 size={18} />
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'subtitles' ? 'active' : ''}`}
          onClick={() => setActiveTab('subtitles')}
          title="Subtitles & OCR"
        >
          <Subtitles size={18} />
        </button>
      </div>

      <div className="settings-content">
        {/* Section: Smart Enhancements */}
        <div className="setting-row-card">
          <div className="setting-info">
            <span className="setting-label">Smart Enhancements</span>
            <span className="setting-desc">Enable automated timing and audio smoothing</span>
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

        <div className="divider" />

        {/* Section: Language Configuration */}
        <div className="setting-section">
          <div className="setting-field-row">
            <div className="field-label-group">
              <span className="field-label">Source Language</span>
              <Info size={14} className="info-icon" title="Original video audio language" />
            </div>
            <div className="language-badge locked">
              <span className="flag-circle">🇬🇧</span>
              <span className="lang-name">English</span>
            </div>
          </div>

          <div className="setting-field-row mt-3">
            <div className="field-label-group">
              <span className="field-label">Target Language</span>
              <Info
                size={14}
                className="info-icon"
                title="Dubbing will translate and generate speech in this language"
              />
            </div>

            <div className="select-wrapper">
              <span className="flag-circle">🇮🇳</span>
              <select
                className="language-select"
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
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
        </div>

        <div className="divider" />

        {/* Section: Lip Sync / Timing Adjustment (Matching Reference Image 1) */}
        <div className="setting-section">
          <div className="setting-row-header">
            <div className="field-label-group">
              <span className="field-label">Lip Sync Adjustment</span>
              <Info
                size={14}
                className="info-icon"
                title="Time-stretching adjusts speech pace to fit video mouth movements"
              />
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
              <span className="slider-hint">
                Paces generated speech rate to match original speech intervals
              </span>
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Section: Subtitles & OCR options */}
        <div className="setting-section">
          <div className="setting-row-card py-1">
            <div className="setting-info">
              <span className="setting-label text-sm">Generate Subtitles</span>
              <span className="setting-desc">Produce translated SRT/VTT subtitles</span>
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

          <div className="setting-row-card py-1 mt-2">
            <div className="setting-info">
              <span className="setting-label text-sm">On-Screen Text OCR</span>
              <span className="setting-desc">Detect and translate video text banners</span>
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
        </div>

        {/* Bottom Action: Disabled Start Dubbing button */}
        <div className="settings-footer">
          <button
            type="button"
            className="btn-start-dubbing"
            disabled
            title={
              hasVideo
                ? 'Dubbing pipeline will be implemented in future phases'
                : 'Please select a video file first'
            }
          >
            <Sparkles size={16} />
            <span>Start Dubbing</span>
          </button>

          <p className="pipeline-notice">
            {hasVideo
              ? 'Ready for Phase 3 pipeline implementation'
              : 'Select or drop an English video to configure dubbing'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default DubbingSettings

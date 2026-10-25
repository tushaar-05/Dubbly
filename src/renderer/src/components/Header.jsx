import React, { useState, useEffect } from 'react'
import { Sparkles, SlidersHorizontal, Share2, Download, ShieldCheck } from 'lucide-react'
import apiService from '../services/api'

/**
 * Dubbly Top Navigation Header
 * Clean, minimal white bar with branding, app version, and system environment status.
 */
function Header({ onOpenDiagnostics, envStatus, isDiagnosticsLoading, canExport = false, onExport }) {
  const [appVersion, setAppVersion] = useState(null)

  useEffect(() => {
    let isMounted = true
    apiService.getAppVersion().then((version) => {
      if (isMounted) {
        setAppVersion(version)
        console.log('[Dubbly IPC] Connected to main process. App version:', version)
      }
    })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">
          <Sparkles size={18} className="brand-sparkle" />
        </div>
        <div className="brand-text">
          <span className="brand-title">Dubbly</span>
          <span className="brand-badge" title="Retrieved via secure IPC from main process">
            {appVersion ? `v${appVersion}` : 'Studio'}
          </span>
        </div>
      </div>

      <div className="header-center">
        <div className="header-pill active">
          <span>Project Workspace</span>
        </div>
      </div>

      <div className="header-actions">
        {/* System Environment & Dependencies Check Button (Phase 12) */}
        <button
          type="button"
          className={`btn-header-env ${envStatus ? (envStatus.allRequiredReady ? 'ready' : 'warning') : ''}`}
          onClick={onOpenDiagnostics}
          title="Inspect required system tools (FFmpeg, whisper.cpp, Edge TTS, Tesseract) and models"
        >
          <ShieldCheck size={14} />
          <span>
            {isDiagnosticsLoading
              ? 'Checking Tools...'
              : envStatus
                ? envStatus.allRequiredReady
                  ? 'All Tools Ready'
                  : `Setup Needed (${envStatus.totalCount - envStatus.readyCount})`
                : 'System Check'}
          </span>
          <span className={`status-dot ${envStatus?.allRequiredReady ? 'ready' : 'warning'}`} />
        </button>

        {canExport && (
          <button
            type="button"
            className="btn-header-export"
            onClick={onExport}
            title="Reveal exported dubbed video in Finder / Explorer"
          >
            <Download size={14} />
            <span>Exported Video</span>
          </button>
        )}
      </div>
    </header>
  )
}

export default Header

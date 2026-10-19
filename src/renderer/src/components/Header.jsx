import React, { useState, useEffect } from 'react'
import { Sparkles, SlidersHorizontal, Share2, Download } from 'lucide-react'
import apiService from '../services/api'

/**
 * Dubbly Top Navigation Header
 * Clean, minimal white bar with branding and actions inspired by Reference Image 1.
 * Fetches and displays the application version via secure IPC (Phase 3).
 */
function Header() {
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
        <button
          type="button"
          className="btn-header-secondary"
          title="Pipeline presets (coming in future phases)"
          disabled
        >
          <SlidersHorizontal size={14} />
          <span>Presets</span>
        </button>

        <button
          type="button"
          className="btn-header-secondary"
          title="Export option (available after dubbing)"
          disabled
        >
          <Download size={14} />
          <span>Export</span>
        </button>

        <button
          type="button"
          className="btn-header-primary"
          title="Share project (coming soon)"
          disabled
        >
          <Share2 size={14} />
          <span>Share</span>
        </button>
      </div>
    </header>
  )
}

export default Header

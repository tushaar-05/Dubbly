import React from 'react'
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wrench,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Terminal
} from 'lucide-react'

/**
 * Environment & Dependency Diagnostics Modal (Phase 12)
 *
 * Displays availability and paths for:
 * - FFmpeg & ffprobe
 * - whisper.cpp & GGML speech model
 * - Microsoft Edge TTS (Python)
 * - Tesseract OCR
 * - Internet connectivity
 */
export function EnvironmentModal({ isOpen, onClose, diagnostics, isLoading, onRefresh }) {
  if (!isOpen) return null

  const tools = diagnostics?.tools ? Object.entries(diagnostics.tools) : []

  return (
    <div className="env-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="env-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="env-modal-header">
          <div className="env-modal-title-group">
            <ShieldCheck size={22} className="text-primary" />
            <div>
              <h3 className="env-modal-title">System Environment Diagnostics</h3>
              <p className="env-modal-subtitle">
                Inspect local CLI tools, speech models, and network prerequisites for Dubbly.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-env-close"
            onClick={onClose}
            title="Close diagnostics"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Status Banner */}
        {diagnostics && (
          <div
            className={`env-summary-banner ${
              diagnostics.allRequiredReady ? 'success' : 'warning'
            }`}
          >
            {diagnostics.allRequiredReady ? (
              <CheckCircle2 size={18} className="text-success" />
            ) : (
              <AlertCircle size={18} className="text-warning" />
            )}
            <div className="env-summary-text">
              <strong>
                {diagnostics.allRequiredReady
                  ? 'All Required Tools Ready'
                  : 'Action Needed: Missing Tools'}
              </strong>
              <span>{diagnostics.summary}</span>
            </div>
            <span className="env-count-badge">
              {diagnostics.readyCount} / {diagnostics.totalCount} Ready
            </span>
          </div>
        )}

        {/* Tools List */}
        <div className="env-tools-list">
          {isLoading ? (
            <div className="env-loading-state">
              <Loader2 size={24} className="spin-icon text-primary" />
              <span>Scanning host system for CLI binaries and models...</span>
            </div>
          ) : tools.length === 0 ? (
            <div className="env-empty-state">
              <span>No diagnostic data available. Click Re-check below.</span>
            </div>
          ) : (
            tools.map(([key, tool]) => (
              <div
                key={key}
                className={`env-tool-row ${tool.available ? 'available' : 'unavailable'}`}
              >
                <div className="env-tool-main">
                  <div className="env-tool-header">
                    <span className="env-tool-name">{tool.name}</span>
                    <span className="env-tool-category">{tool.category}</span>
                    <span
                      className={`env-tool-req ${tool.required ? 'required' : 'optional'}`}
                    >
                      {tool.required ? 'Required' : 'Optional'}
                    </span>
                  </div>

                  {tool.available ? (
                    <div className="env-tool-details">
                      {tool.version && (
                        <span className="env-detail-chip">Version: {tool.version}</span>
                      )}
                      {tool.path && (
                        <span className="env-detail-path" title={tool.path}>
                          Path: {tool.path}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="env-tool-error-box">
                      <p className="env-error-msg">{tool.error || 'Tool not detected in PATH.'}</p>
                      {tool.instructions && (
                        <div className="env-fix-command">
                          <Terminal size={12} />
                          <code>{tool.instructions}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="env-tool-status">
                  {tool.available ? (
                    <span className="badge-status-ready">
                      <CheckCircle2 size={13} />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="badge-status-missing">
                      <AlertCircle size={13} />
                      <span>{tool.required ? 'Missing' : 'Not Installed'}</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Actions */}
        <div className="env-modal-footer">
          <button
            type="button"
            className="btn-env-refresh"
            onClick={onRefresh}
            disabled={isLoading}
            title="Re-run dependency check"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
            <span>{isLoading ? 'Checking...' : 'Re-check Environment'}</span>
          </button>
          <button type="button" className="btn-env-dismiss" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default EnvironmentModal

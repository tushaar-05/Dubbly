import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * Custom, secure API bridge for the Dubbly renderer.
 *
 * Exposes only safe, specific methods to the window.api global object.
 * Does NOT expose raw ipcRenderer, child_process, or Node.js filesystem modules.
 */
const api = {
  /**
   * Request application version from main process
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  /**
   * Request application metadata from main process
   * @returns {Promise<{ name: string, version: string }>}
   */
  getAppInfo: () => ipcRenderer.invoke('app:get-info')
}

// Expose APIs to renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose APIs via contextBridge:', error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

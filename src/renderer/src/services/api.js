/**
 * Dubbly Renderer API Service
 *
 * Secure frontend wrapper around window.api (exposed by preload contextBridge).
 * Isolates React components from direct Electron dependencies.
 */

export const apiService = {
  /**
   * Get application version from main process via IPC
   * @returns {Promise<string>}
   */
  async getAppVersion() {
    try {
      if (window.api && typeof window.api.getAppVersion === 'function') {
        return await window.api.getAppVersion()
      }
      return '1.0.0'
    } catch (error) {
      console.error('Error invoking app:get-version:', error)
      return '1.0.0'
    }
  },

  /**
   * Get application metadata from main process via IPC
   * @returns {Promise<{ name: string, version: string }>}
   */
  async getAppInfo() {
    try {
      if (window.api && typeof window.api.getAppInfo === 'function') {
        return await window.api.getAppInfo()
      }
      return { name: 'Dubbly', version: '1.0.0' }
    } catch (error) {
      console.error('Error invoking app:get-info:', error)
      return { name: 'Dubbly', version: '1.0.0' }
    }
  }
}

export default apiService

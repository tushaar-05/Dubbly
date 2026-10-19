import { ipcMain, app } from 'electron'

/**
 * IPC Handler Registry
 *
 * Responsibilities:
 * - Register ipcMain.handle listeners for secure, bidirectional communication with renderer.
 * - Delegate tasks to main process services without exposing Node.js APIs to Chromium.
 */
export function registerIpcHandlers() {
  /**
   * Testable IPC Operation: Return application version
   * Channel: 'app:get-version'
   */
  ipcMain.handle('app:get-version', async () => {
    return app.getVersion()
  })

  /**
   * Testable IPC Operation: Return application metadata
   * Channel: 'app:get-info'
   */
  ipcMain.handle('app:get-info', async () => {
    return {
      name: app.getName(),
      version: app.getVersion()
    }
  })

  // Future pipeline handlers (transcription, translation, TTS, timing, OCR)
  // will be registered here as separate channels.
}

export default registerIpcHandlers

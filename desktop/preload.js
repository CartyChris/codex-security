// Exposes the small desktop bridge the web app uses when it runs inside the macOS app.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('omniforgeDesktop', {
  platform: process.platform,
  getKey: () => ipcRenderer.invoke('key:get'),
  setKey: (key) => ipcRenderer.invoke('key:set', key),
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('command', listener)
    return () => ipcRenderer.removeListener('command', listener)
  },
})

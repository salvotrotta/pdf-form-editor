// Preload script - eseguito nel renderer con accesso limitato a Node
// Aggiungere qui eventuali bridge IPC se necessario in futuro
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
})

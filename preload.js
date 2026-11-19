const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('api', {
  invoke: (c, ...a) => ipcRenderer.invoke(c, ...a),
  send: (c, ...a) => ipcRenderer.send(c, ...a),
  on: (c, f) => ipcRenderer.on(c, (_, ...a) => f(...a)),
  pathOf: f => webUtils.getPathForFile(f)
});

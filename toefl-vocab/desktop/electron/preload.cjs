const { contextBridge, ipcRenderer } = require("electron");

const menuEvents = [
  ["toefl:menu-export-progress", "toefl-desktop-export-progress"],
  ["toefl:menu-import-progress", "toefl-desktop-import-progress"],
  ["toefl:menu-reset-progress", "toefl-desktop-reset-progress"]
];

contextBridge.exposeInMainWorld("toeflDesktop", {
  isDesktop: true,
  exportProgress: (payload) => ipcRenderer.invoke("toefl:export-progress", payload),
  importProgress: () => ipcRenderer.invoke("toefl:import-progress"),
  resetProgress: () => ipcRenderer.invoke("toefl:confirm-reset-progress"),
  readSeedJson: () => ipcRenderer.invoke("toefl:read-seed-json")
});

menuEvents.forEach(([ipcChannel, domEventName]) => {
  ipcRenderer.on(ipcChannel, () => {
    window.dispatchEvent(new CustomEvent(domEventName));
  });
});

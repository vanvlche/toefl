const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 820,
    minWidth: 390,
    minHeight: 640,
    title: "TOEFL Vocab",
    backgroundColor: "#f6f8f5",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "..", "web", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function sendMenuAction(channel) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel);
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Export Progress",
          click: () => sendMenuAction("toefl:menu-export-progress")
        },
        {
          label: "Import Progress",
          click: () => sendMenuAction("toefl:menu-import-progress")
        },
        {
          label: "Reset Progress",
          click: () => sendMenuAction("toefl:menu-reset-progress")
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
          click: () => app.quit()
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About TOEFL Vocab",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About TOEFL Vocab",
              message: "TOEFL Vocab",
              detail: "Offline TOEFL vocabulary review app.\nProgress is stored locally on this device."
            });
          }
        }
      ]
    }
  ]);
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

ipcMain.handle("toefl:read-seed-json", async () => {
  const seedPath = path.join(__dirname, "..", "..", "web", "data", "seed_words.json");
  const raw = await fs.readFile(seedPath, "utf8");
  return JSON.parse(raw);
});

ipcMain.handle("toefl:export-progress", async (event, payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Export payload is missing or invalid.");
  }

  const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showSaveDialog(owner, {
    title: "Export Progress",
    defaultPath: path.join(app.getPath("documents"), `toefl-vocab-progress-${todayString()}.json`),
    filters: [{ name: "JSON Files", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf8");
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("toefl:import-progress", async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showOpenDialog(owner, {
    title: "Import Progress",
    properties: ["openFile"],
    filters: [{ name: "JSON Files", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const raw = await fs.readFile(filePath, "utf8");
  return {
    canceled: false,
    filePath,
    payload: JSON.parse(raw)
  };
});

ipcMain.handle("toefl:confirm-reset-progress", async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showMessageBox(owner, {
    type: "warning",
    buttons: ["초기화", "취소"],
    defaultId: 1,
    cancelId: 1,
    title: "Reset Progress",
    message: "진행 상황을 초기화할까요?",
    detail: "현재 기기의 로컬 진행 상황이 seed 기준으로 다시 설정됩니다."
  });

  return { confirmed: result.response === 0 };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu());
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

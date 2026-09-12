const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let localServer;

async function createWindow() {
  const moduleUrl = pathToFileURL(path.join(__dirname, "..", "server.js")).href;
  const { startServer } = await import(moduleUrl);
  const running = await startServer({ port: 0, host: "127.0.0.1", open: false });
  localServer = running.server;
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 680,
    title: "原作角色卡整理器",
    backgroundColor: "#f4f7f6",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  await window.loadURL(running.url);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => localServer?.close());

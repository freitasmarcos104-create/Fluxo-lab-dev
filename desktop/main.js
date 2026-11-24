'use strict';

const { app, BrowserWindow, shell, session, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const FALLBACK_URL = 'https://app.markfree.com.br/';
const GLASS_NEON_CSS_PATH = path.join(__dirname, 'glass-neon-buttons.css');

function readGlassNeonStylesheet() {
  try {
    return fs.readFileSync(GLASS_NEON_CSS_PATH, 'utf8');
  } catch (error) {
    console.error('Não foi possível carregar o tema Glass Neon do Windows:', error);
    return '';
  }
}

const glassNeonStylesheet = readGlassNeonStylesheet();

function readConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const startUrl = new URL(parsed.startUrl || FALLBACK_URL);
    if (startUrl.protocol !== 'https:') throw new Error('A URL inicial precisa usar HTTPS.');
    return { ...parsed, startUrl: startUrl.href };
  } catch (error) {
    console.error('Configuração inválida do Fluxo Lab:', error);
    return {
      appName: 'Fluxo Lab',
      startUrl: FALLBACK_URL,
      allowedHosts: ['app.markfree.com.br'],
      accessHosts: []
    };
  }
}

const config = readConfig();

function isInternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return (config.allowedHosts || []).some(item => host === item.toLowerCase()) ||
      (config.accessHosts || []).some(item => host === item.toLowerCase() || host.endsWith('.' + item.toLowerCase()));
  } catch {
    return false;
  }
}

function showConnectionError(win) {
  const html = '<!doctype html><html lang="pt-br"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Fluxo Lab</title>' +
    '<body style="margin:0;background:#f4f7f8;color:#20323a;font:16px Arial,sans-serif;display:grid;min-height:100vh;place-items:center">' +
    '<main style="max-width:420px;padding:32px;text-align:center"><h1>Fluxo Lab</h1>' +
    '<p>Não foi possível conectar ao sistema.</p><p>Verifique a internet e tente novamente.</p>' +
    '<button onclick="location.reload()" style="padding:12px 20px;border:0;border-radius:8px;background:#159a9c;color:white;font-weight:bold">Tentar novamente</button>' +
    '</main></body></html>';
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    title: config.appName || 'Fluxo Lab',
    backgroundColor: '#f4f7f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true
    }
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) {
      setImmediate(() => win.loadURL(url).catch(() => showConnectionError(win)));
    } else {
      shell.openExternal(url).catch(error => console.error('Não foi possível abrir o link externo:', error));
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url).catch(error => console.error('Não foi possível abrir o link:', error));
    }
  });

  win.webContents.on('did-fail-load', (_event, errorCode, _description, _validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) showConnectionError(win);
  });

  // Tema do aplicativo Windows: não altera o Worker, o navegador ou o cliente Android.
  // Reaplica após navegações completas; o CSS permanece em navegações internas da SPA.
  win.webContents.on('did-finish-load', () => {
    if (!glassNeonStylesheet || !isInternalUrl(win.webContents.getURL())) return;
    win.webContents.insertCSS(glassNeonStylesheet)
      .catch(error => console.error('Falha ao aplicar o Glass Neon no Windows:', error));
  });

  win.webContents.on('page-title-updated', event => {
    event.preventDefault();
    win.setTitle('Fluxo Lab');
  });

  win.webContents.session.on('will-download', (_event, item) => {
    const safeName = path.basename(item.getFilename() || 'arquivo');
    const choice = dialog.showSaveDialogSync(win, {
      title: 'Salvar arquivo do Fluxo Lab',
      defaultPath: path.join(app.getPath('downloads'), safeName)
    });
    if (!choice) {
      item.cancel();
      return;
    }
    item.setSavePath(choice);
  });

  win.loadURL(config.startUrl).catch(() => showConnectionError(win));
  return win;
}

app.whenReady().then(() => {
  app.setAppUserModelId('br.com.markfree.fluxolab');
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'notifications');
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

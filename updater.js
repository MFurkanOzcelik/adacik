// Automatic updates from GitHub Releases (electron-updater). The library is only loaded when a check
// runs (a minute after start, then every 6 hours), so it costs nothing while it isn't needed.
// A new version downloads in the background and installs when the app quits, or right away when the
// user clicks "Kur" in the island / settings.
'use strict';
const { app } = require('electron');

let au = null, timer = null, emit = () => {};
const state = { status: 'idle', version: '', percent: 0, error: '', current: app.getVersion(), checkedAt: 0 };
const push = patch => { Object.assign(state, patch); emit('update', { ...state }); };

function updater() {
  if (au) return au;
  au = require('electron-updater').autoUpdater;
  au.logger = null; au.autoDownload = true; au.autoInstallOnAppQuit = true; au.allowPrerelease = false;
  // test builds can point at a local feed instead of GitHub
  if (process.env.KLON_UPDATE_URL) { au.setFeedURL({ provider: 'generic', url: process.env.KLON_UPDATE_URL }); au.forceDevUpdateConfig = true; }
  au.on('checking-for-update', () => push({ status: 'checking', error: '' }));
  au.on('update-not-available', () => push({ status: 'none', checkedAt: Date.now() }));
  au.on('update-available', i => push({ status: 'downloading', version: i.version, percent: 0, checkedAt: Date.now() }));
  au.on('download-progress', p => push({ status: 'downloading', percent: Math.round(p.percent) }));
  au.on('update-downloaded', i => push({ status: 'ready', version: i.version, percent: 100 }));
  au.on('error', e => push({ status: 'error', error: String((e && e.message) || e).split('\n')[0].slice(0, 160) }));
  return au;
}
function check() {
  if (!app.isPackaged && !process.env.KLON_UPDATE_URL) { push({ status: 'dev' }); return; }   // `npm start`: nothing to update
  if (['checking', 'downloading', 'ready'].includes(state.status)) return;
  try { updater().checkForUpdates().catch(e => push({ status: 'error', error: String(e.message || e).slice(0, 160) })); } catch (e) { push({ status: 'error', error: String(e.message || e).slice(0, 160) }); }
}
// on = settings.autoUpdate !== false
function schedule(on) {
  clearTimeout(timer); clearInterval(timer);
  if (!on) return;
  timer = setTimeout(() => { check(); timer = setInterval(check, 6 * 3600e3); }, 60e3);
}
function install() { if (state.status === 'ready' && au) { setImmediate(() => au.quitAndInstall(true, true)); return true; } return false; }

module.exports = { init: (send, on) => { emit = send; schedule(on); }, schedule, check, install, state: () => ({ ...state }) };

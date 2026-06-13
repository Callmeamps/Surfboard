const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    frame: false,
  });
  win.loadURL('data:text/html,<h1>Test</h1>');
  console.log('Window created');
});

app.on('window-all-closed', () => app.quit());

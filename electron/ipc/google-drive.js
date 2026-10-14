const { shell } = require('electron');
const http = require('node:http');
const { liveRequest } = require('./live');
const { API_ORIGIN } = require('../config');

function authorizeGoogleDrive(parent, token) {
  if (typeof token !== 'string' || !token) throw new Error('Sign in before connecting Google Drive.');
  return new Promise((resolve, reject) => {
    let state, settled = false;
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (req.method !== 'GET' || url.pathname !== '/google-drive/callback' || !state || url.searchParams.get('state') !== state) { res.writeHead(400); res.end('Invalid authorization callback.'); return; }
      const code = url.searchParams.get('code');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(code ? 'Authorization received. Return to Nisaab360 to finish connecting Google Drive.' : 'Authorization cancelled. Return to Nisaab360.');
      finish(code ? null : new Error('Google Drive authorization cancelled.'), {code,state});
    });
    const finish = (error, result) => {
      if (settled) return;
      settled = true; clearTimeout(timer); server.close(); parent?.removeListener('closed', closed);
      if (error) reject(error); else resolve(result);
    };
    const closed = () => finish(new Error('Authorization cancelled.'));
    parent?.once('closed', closed);
    const timer = setTimeout(() => finish(new Error('Authorization timed out. Try connecting again.')), 5 * 60 * 1000);
    server.on('error', error => finish(error));
    server.listen(0, '127.0.0.1', async () => {
      try {
        const result = await liveRequest({endpoint:'/api/institution/settings/google-drive/connect?desktopPort=' + server.address().port, headers:{authorization:'Bearer ' + token}});
        const data = JSON.parse(Buffer.from(result.bytes).toString('utf8'));
        if (result.status !== 200) throw new Error(data.error || 'Could not start Google authorization.');
        const url = new URL(data.authorizationUrl);
        const redirect = new URL(url.searchParams.get('redirect_uri'));
        state = url.searchParams.get('state');
        if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth' || redirect.origin !== API_ORIGIN || redirect.pathname !== '/api/institution/settings/google-drive/callback' || !state) throw new Error('Invalid Google authorization configuration.');
        if (!settled) await shell.openExternal(url.href);
      } catch (error) { finish(error); }
    });
  });
}
module.exports = { authorizeGoogleDrive };

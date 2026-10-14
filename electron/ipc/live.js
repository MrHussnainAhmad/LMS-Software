const { API_ORIGIN } = require('../config');

// The renderer may access only this installation's API, never arbitrary hosts
// with the user's bearer token. Do not follow redirects carrying credentials.
async function liveRequest({ endpoint, method = 'GET', headers = {}, body, form }) {
  const url = new URL(endpoint, API_ORIGIN);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/api/')) throw new Error('Invalid API endpoint');
  const allowed = {};
  for (const key of ['authorization', 'content-type', 'x-campus-view']) {
    const value = Object.entries(headers).find(([name]) => name.toLowerCase() === key)?.[1];
    if (typeof value === 'string') allowed[key] = value;
  }
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) throw new Error('Invalid request method');
  let payload = body;
  if (form) {
    payload = new FormData();
    for (const entry of form) {
      if (entry.bytes) payload.append(entry.name, new Blob([entry.bytes], { type: entry.type }), entry.filename);
      else payload.append(entry.name, entry.value);
    }
    delete allowed['content-type'];
  }
  const response = await fetch(url, { method, headers: allowed, body: payload, redirect: 'manual' });
  return { status: response.status, headers: Object.fromEntries(response.headers), bytes: new Uint8Array(await response.arrayBuffer()) };
}

module.exports = { liveRequest };

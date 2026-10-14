const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');

function load(file, mocks) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', fs.readFileSync(path.resolve(file), 'utf8'))(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

async function main() {
  const received = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received.push({url:req.url, headers:req.headers, body:Buffer.concat(chunks).toString()});
    if (req.url === '/api/redirect') { res.writeHead(302, { location: '/api/leaked' }); res.end(); return; }
    res.setHeader('Content-Type', 'application/octet-stream'); res.end(Buffer.from([0, 255, 42]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const { liveRequest } = load('electron/ipc/live.js', {'../config':{API_ORIGIN:origin}});
    const response = await liveRequest({endpoint:'/api/file', headers:{Authorization:'Bearer test', 'X-Campus-View':'signed', cookie:'excluded'}});
    assert.deepEqual([...response.bytes], [0,255,42]);
    assert.equal(received[0].headers.authorization, 'Bearer test');
    assert.equal(received[0].headers['x-campus-view'], 'signed');
    assert.equal(received[0].headers.cookie, undefined);
    await liveRequest({endpoint:'/api/upload', method:'POST', form:[{name:'password',value:'archive-password'},{name:'file',filename:'backup.zip',type:'application/zip',bytes:new Uint8Array([65,66,67])}]});
    assert.match(received[1].headers['content-type'], /multipart\/form-data; boundary=/);
    assert.match(received[1].body, /filename="backup.zip"/);
    assert.match(received[1].body, /ABC/);
    assert.match(received[1].body, /archive-password/);
    assert.equal((await liveRequest({endpoint:'/api/redirect'})).status,302);
    assert.equal(received.length,3, 'redirect does not forward credentials');
    for (const endpoint of ['https://other.test/api/steal', '/outside-api']) await assert.rejects(liveRequest({endpoint}), /Invalid API endpoint/);
    console.log('PASS native transport preserves binary/multipart data, scopes headers and refuses external URLs/redirects');
  } finally { server.close(); }

  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE api_cache(cache_key TEXT PRIMARY KEY,response_json TEXT); CREATE TABLE sync_queue(id INTEGER PRIMARY KEY,endpoint TEXT,method TEXT,payload_json TEXT,sync_status TEXT);');
  const setCache = (key,value) => db.prepare('INSERT OR REPLACE INTO api_cache VALUES (?,?)').run(key,JSON.stringify(value));
  const router = load('electron/data/router.js', {
    '../db':{getDb:()=>db}, '../sync/pull':{setCache}, '../sync/push':{applyLocalWrite:()=>{},enqueueWrite:({endpoint,method,payload})=>db.prepare('INSERT INTO sync_queue(endpoint,method,payload_json,sync_status) VALUES (?,?,?,?)').run(endpoint,method,JSON.stringify(payload),'pending')}, '../sync/device':{getDeviceId:()=> 'fixture'}, '../sync/engine':{schedulePushSoon:()=>{}}
  });
  const endpoint = '/institution/staff-attendance';
  const date = '2026-10-13';
  const records = [{staffId:7,status:'PRESENT'}];
  assert.equal(router.handleDataRequest('POST',endpoint,{date,records}).queued,true);
  setCache(`GET:${endpoint}?date=${date}`,{records:[]});
  assert.deepEqual(router.handleDataRequest('GET',`${endpoint}?date=${date}`).records,records,'pending attendance survives stale server pull and reopening');
  assert.deepEqual(router.handleDataRequest('GET',`${endpoint}?date=2026-10-12`).records,[],'dates remain isolated');
  db.exec("UPDATE sync_queue SET sync_status='failed'");
  const latest = [{staffId:7,status:'LATE'}];
  router.handleDataRequest('POST',endpoint,{date,records:latest});
  assert.deepEqual(router.handleDataRequest('GET',`${endpoint}?date=${date}`).records,latest);
  db.exec("UPDATE sync_queue SET sync_status='synced' WHERE id=2");
  assert.deepEqual(router.handleDataRequest('GET',`${endpoint}?date=${date}`).records,latest,'old failed write cannot shadow a later synced write');
  db.close(); console.log('PASS offline attendance survives navigation, stale pulls and older failed writes');

  let callbackPort;
  const oauth = load('electron/ipc/google-drive.js', {
    '../config':{API_ORIGIN:'https://server.test'},
    './live':{liveRequest:async ({endpoint,headers})=>{
      assert.equal(headers.authorization,'Bearer token');
      callbackPort = new URL(endpoint,'https://server.test').searchParams.get('desktopPort');
      return {status:200,bytes:Buffer.from(JSON.stringify({authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fserver.test%2Fapi%2Finstitution%2Fsettings%2Fgoogle-drive%2Fcallback&state=nonce'}))};
    }},
    electron:{shell:{openExternal:async url=>{
      assert.equal(new URL(url).origin,'https://accounts.google.com');
      assert.equal((await fetch(`http://127.0.0.1:${callbackPort}/google-drive/callback?state=wrong&code=bad`)).status,400);
      assert.equal((await fetch(`http://127.0.0.1:${callbackPort}/google-drive/callback?state=nonce&code=good`)).status,200);
    }}}
  });
  assert.deepEqual(await oauth.authorizeGoogleDrive(null,'token'),{code:'good',state:'nonce'});
  console.log('PASS system-browser OAuth binds callback to the initiating state and loopback listener');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

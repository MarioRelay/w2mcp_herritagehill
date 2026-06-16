const http = require('http');
const https = require('https');
const { URL } = require('url');

const TENANT_ID     = process.env.FABRIC_TENANT_ID     || '9c5ff121-707c-46c0-a4a1-79341c78f055';
const CLIENT_ID     = process.env.FABRIC_CLIENT_ID     || 'dd55d7a4-f2bc-453d-8dcc-f45a23af11b3';
const CLIENT_SECRET = process.env.FABRIC_CLIENT_SECRET || (() => { throw new Error('Set FABRIC_CLIENT_SECRET env var'); })();
const FABRIC_MCP    = 'https://api.fabric.microsoft.com/v1/mcp/core';
const PORT          = 3002;

let cachedToken = null;

async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope:         'https://api.fabric.microsoft.com/.default'
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'login.microsoftonline.com',
      path:     `/${TENANT_ID}/oauth2/v2.0/token`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.error) return reject(new Error(`[Azure AD] ${json.error}: ${json.error_description}`));
        cachedToken = {
          value:     json.access_token,
          expiresAt: Date.now() + json.expires_in * 1000
        };
        console.log(`[auth] Token OK — expira en ${json.expires_in}s (~${Math.round(json.expires_in/60)}min)`);
        resolve(cachedToken.value);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

http.createServer(async (req, res) => {
  try {
    const token  = await getToken();
    const target = new URL(FABRIC_MCP);

    const chunks = [];
    req.on('data', c => chunks.push(c));
    await new Promise(r => req.on('end', r));
    const body = Buffer.concat(chunks);

    const outHeaders = { ...req.headers };
    outHeaders['host']          = target.hostname;
    outHeaders['authorization'] = `Bearer ${token}`;
    delete outHeaders['connection'];

    const suffix = req.url === '/' ? '' : req.url;

    console.log(`[proxy] ${req.method} ${target.pathname}${suffix}`);

    const proxyReq = https.request({
      hostname: target.hostname,
      path:     target.pathname + suffix,
      method:   req.method,
      headers:  outHeaders
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', e => {
      console.error('[proxy error]', e.message);
      if (!res.headersSent) { res.writeHead(502); res.end(e.message); }
    });

    if (body.length) proxyReq.write(body);
    proxyReq.end();

  } catch (e) {
    console.error('[error]', e.message);
    if (!res.headersSent) { res.writeHead(500); res.end(e.message); }
  }
}).listen(PORT, () => {
  console.log(`\nFabric MCP Proxy corriendo en http://localhost:${PORT}`);
  console.log(`Enviando requests a: ${FABRIC_MCP}\n`);
});

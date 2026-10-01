import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('./', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html','styles.css','recognition.css','js/app.js','js/storage.js','js/auth.js','js/management-client.js','js/api.js','js/recognition-client.js','js/recognition-ui.js'].includes(relative)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const body = await readFile(path.join(root, relative));
    res.writeHead(200, {'Content-Type':types[path.extname(relative)], 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
    res.end(body);
  } catch { res.writeHead(400); res.end('Bad request'); }
}).listen(5173, '127.0.0.1', () => console.log('City Gym Management: http://127.0.0.1:5173'));

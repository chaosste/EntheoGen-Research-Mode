import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8080);
const defaultRoot = existsSync(join(__dirname, 'dist')) ? join(__dirname, 'dist') : __dirname;
const root = resolve(process.env.STATIC_DIR || defaultRoot);
const indexPath = join(root, 'index.html');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

function cacheControlFor(filePath) {
  const relativePath = filePath.slice(root.length).replaceAll(sep, '/');
  return relativePath.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

function sendFile(response, filePath) {
  const type = contentTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream';
  response.writeHead(200, {
    'Cache-Control': cacheControlFor(filePath),
    'Content-Type': type,
  });
  createReadStream(filePath).pipe(response);
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl || '/', 'http://localhost');
  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const requestedPath = normalize(join(root, decodedPath));
  if (requestedPath !== root && !requestedPath.startsWith(`${root}${sep}`)) {
    return null;
  }
  return requestedPath;
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const requestedPath = resolveRequestPath(request.url);
  if (!requestedPath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  const filePath = existsSync(requestedPath) && statSync(requestedPath).isFile() ? requestedPath : indexPath;
  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  if (request.method === 'HEAD') {
    response.writeHead(200, {
      'Cache-Control': cacheControlFor(filePath),
      'Content-Type': contentTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
    });
    response.end();
    return;
  }

  sendFile(response, filePath);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${root} on port ${port}`);
});

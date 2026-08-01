const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT) || 3000;
const root = __dirname;
const stateFile = process.env.STATE_FILE || path.join(root, '.data', 'checklist.json');
const emptyState = () => Array(60).fill(false);
let state = loadState();
const clients = new Set();
const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/script.js': ['script.js', 'text/javascript; charset=utf-8']
};

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!Array.isArray(saved) || saved.length !== 60 || saved.some((item) => typeof item !== 'boolean')) {
      throw new Error('Invalid saved state');
    }
    return saved;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Kunde inte läsa sparad status, startar med en tom lista.');
    return emptyState();
  }
}

function saveState() {
  const directory = path.dirname(stateFile);
  const temporaryFile = `${stateFile}.${process.pid}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryFile, JSON.stringify(state), 'utf8');
  fs.renameSync(temporaryFile, stateFile);
}

function broadcast() {
  const message = `event: state\ndata: ${JSON.stringify({ state, users: clients.size })}\n\n`;
  clients.forEach((response) => response.write(message));
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/api/events') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    clients.add(response);
    broadcast();
    request.on('close', () => {
      clients.delete(response);
      broadcast();
    });
    return;
  }

  if (request.method === 'PATCH' && request.url === '/api/checklist') {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000) request.destroy();
    });
    request.on('end', () => {
      try {
        const { index, checked } = JSON.parse(body);
        if (!Number.isInteger(index) || index < 0 || index >= state.length || typeof checked !== 'boolean') {
          throw new Error('Invalid checklist update');
        }
        state[index] = checked;
        saveState();
        broadcast();
        response.writeHead(204).end();
      } catch {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Ogiltig uppdatering' }));
      }
    });
    return;
  }

  const asset = assets[request.url];
  if (!asset || request.method !== 'GET') {
    response.writeHead(404).end('Not found');
    return;
  }
  fs.readFile(path.join(root, asset[0]), (error, content) => {
    if (error) response.writeHead(500).end('Server error');
    else response.writeHead(200, { 'Content-Type': asset[1] }).end(content);
  });
});

server.listen(port, () => console.log(`Städlistan körs på http://localhost:${port}`));

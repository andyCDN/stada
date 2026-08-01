const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function startServer(port, stateFile) {
  const child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: port, STATE_FILE: stateFile }
  });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.once('data', () => resolve(child));
  });
}

async function readUntil(response, condition) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  while (!condition(content)) {
    const chunk = await reader.read();
    if (chunk.done) break;
    content += decoder.decode(chunk.value);
  }
  return { content, reader };
}

test('synkar en ändring mellan två samtidiga anslutningar', async (t) => {
  const port = 3219;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stada-test-'));
  const stateFile = path.join(directory, 'checklist.json');
  const child = await startServer(port, stateFile);
  t.after(() => child.kill());
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const first = await fetch(`http://localhost:${port}/api/events`);
  const second = await fetch(`http://localhost:${port}/api/events`);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);

  const update = await fetch(`http://localhost:${port}/api/checklist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index: 4, checked: true })
  });
  assert.equal(update.status, 204);

  const { content, reader } = await readUntil(second, (value) => value.includes('true'));
  assert.match(content, /"users":2/);
  assert.equal(JSON.parse(content.match(/data: (.+)/g).at(-1).slice(6)).state[4], true);
  await reader.cancel();
  await first.body.cancel();
});

test('behåller checklistan efter att servern startats om', async (t) => {
  const port = 3220;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stada-restart-'));
  const stateFile = path.join(directory, 'checklist.json');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const firstServer = await startServer(port, stateFile);
  const update = await fetch(`http://localhost:${port}/api/checklist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index: 12, checked: true })
  });
  assert.equal(update.status, 204);
  firstServer.kill();
  await new Promise((resolve) => firstServer.once('exit', resolve));

  const secondServer = await startServer(port, stateFile);
  t.after(() => secondServer.kill());
  const events = await fetch(`http://localhost:${port}/api/events`);
  const { content, reader } = await readUntil(events, (value) => value.includes('data:'));
  const payload = JSON.parse(content.match(/data: (.+)/)[1]);
  assert.equal(payload.state[12], true);
  await reader.cancel();
});

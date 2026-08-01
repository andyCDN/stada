const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

test('synkar en ändring mellan två samtidiga anslutningar', async (t) => {
  const port = 3219;
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: port } });
  t.after(() => child.kill());
  await new Promise((resolve) => child.stdout.once('data', resolve));

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

  const reader = second.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  while (!content.includes('true')) content += decoder.decode((await reader.read()).value);
  assert.match(content, /"users":2/);
  assert.equal(JSON.parse(content.match(/data: (.+)/g).at(-1).slice(6)).state[4], true);
  await reader.cancel();
  await first.body.cancel();
});

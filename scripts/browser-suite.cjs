// Exercise the production artifact on an isolated port, never an inherited BASE_URL.
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const suites = ['uiux-smoke.cjs', 'state-interaction-smoke.cjs', 'map-chunk-smoke.cjs', 'page-recovery-smoke.cjs', 'nws-smoke.cjs', 'alert-separation-smoke.cjs', 'motion-smoke.cjs', 'startup-smoke.cjs', 'uiux-bounds-smoke.cjs'];
function run(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, script)], { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script} failed: ${code}`)));
  });
}
(async () => {
  const port = await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.on('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(error => error ? reject(error) : resolve(port));
    });
  });
  const base = `http://127.0.0.1:${port}/`;
  const server = spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'inherit' });
  let serverError;
  server.on('error', error => { serverError = error; });
  try {
    const deadline = Date.now() + 15000;
    let ready = false;
    while (Date.now() < deadline) {
      if (serverError) throw serverError;
      if (server.exitCode !== null) throw new Error('Preview exited before readiness');
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
        if (response.ok && (await response.text()).includes('DisasterLens')) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Production preview did not become ready');
    const env = { ...process.env, BASE_URL: base, PLAYWRIGHT_MODULE: require.resolve('playwright') };
    for (const suite of suites) await run(suite, env);
    console.log('PASS production browser suite');
  } finally {
    server.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const {setup} = require('./setup-bruno.cjs');
const build = require('./build-collection.cjs');
const cases = require('./cases.cjs');
const generateReport = require('./write-report.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function probeHealth(root) {
  try {
    const r = await fetch(root + '/health', {signal: AbortSignal.timeout(1500)});
    const body = await r.json();
    if (!r.ok || body.service !== 'olms-backend') return null;
    return {
      ok: true,
      fingerprint: r.headers.get('x-olms-target-fingerprint') || null
    };
  } catch {
    return null;
  }
}

async function main() {
  const ctx = await setup();
  await build();
  const reports = ctx.reportsDir || path.join(ctx.TESTS, 'reports', ctx.runId);
  fs.mkdirSync(reports, {recursive: true});
  let server;
  const serverLog = fs.openSync(path.join(reports, 'backend.log'), 'a');

  try {
    const root = ctx.values.OLMS_TEST_ROOT_URL;
    const preExisting = await probeHealth(root);

    if (preExisting) {
      if (preExisting.fingerprint !== ctx.targetFingerprint) {
        throw new Error(
          `Existing backend at ${root} has target fingerprint '${preExisting.fingerprint || 'none'}', expected '${ctx.targetFingerprint}' for ${ctx.testHost}. Refusing to run tests against unverified server.`
        );
      }
    } else {
      if (ctx.options.OLMS_TEST_AUTO_START === 'false') {
        throw new Error('Backend is not reachable; start it against the isolated test DB or enable OLMS_TEST_AUTO_START.');
      }
      const url = new URL(root);
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
        throw new Error('Auto-start requires a localhost BASE_URL.');
      }
      server = spawn(process.execPath, ['index.js'], {
        cwd: path.join(ctx.ROOT, 'backend'),
        env: {
          ...process.env,
          CORS_ORIGIN: ctx.options.OLMS_TEST_CORS_ORIGIN || ctx.backend.CORS_ORIGIN || 'http://localhost:5173',
          NODE_ENV: 'test',
          PORT: url.port || '3301',
          WORKER_ENABLED: 'false',
          SUPABASE_URL: ctx.options.OLMS_TEST_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: ctx.options.OLMS_TEST_SUPABASE_SERVICE_ROLE_KEY,
          JWT_ACCESS_SECRET: ctx.options.OLMS_TEST_JWT_ACCESS_SECRET,
          JWT_REFRESH_SECRET: ctx.options.OLMS_TEST_JWT_REFRESH_SECRET || ctx.options.OLMS_TEST_JWT_ACCESS_SECRET,
          OLMS_TEST_TARGET_FINGERPRINT: ctx.targetFingerprint
        },
        stdio: ['ignore', serverLog, serverLog],
        windowsHide: true
      });

      let health = null;
      for (let i = 0; i < 40; i++) {
        health = await probeHealth(root);
        if (health) break;
        await delay(500);
      }
      if (!health || health.fingerprint !== ctx.targetFingerprint) {
        throw new Error('Backend did not become healthy with verified isolated target fingerprint; inspect private reports backend.log.');
      }
    }

    const cli = path.join(ctx.TESTS, 'node_modules/@usebruno/cli/bin/bru.js');
    const output = path.join(reports, 'bruno.json');
    const selected = process.argv.slice(2);
    const requests = selected.length ? cases.filter(c => selected.some(v => c.name === v || c.file === v)) : cases;
    if (!requests.length) throw new Error('No matching scenario names.');
    const args = [
      cli,
      'run',
      ...requests.map(c => c.file),
      '--env', 'Local',
      '--sandbox', 'safe',
      '--noproxy',
      '--reporter-json', output,
      '--reporter-junit', path.join(reports, 'junit.xml'),
      '--reporter-skip-all-headers',
      '--reporter-skip-body'
    ];
    const started = new Date().toISOString();
    console.log(`Running real Bruno CLI 4.3.0: ${requests.length} requests against ${ctx.base} (${ctx.testHost}).`);
    const run = spawnSync(process.execPath, args, {
      cwd: ctx.COLLECTION,
      env: {...process.env, NO_COLOR: '1'},
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true
    });
    const log = (run.stdout || '') + (run.stderr || '');
    fs.writeFileSync(path.join(reports, 'cli.log'), log);
    const result = generateReport({...ctx, reports, output, started, finished: new Date().toISOString(), exitCode: run.status, selected: requests});
    console.log(log.slice(-4500));
    console.log(`Report written: docs/completed_api.md (${result.summary}).`);
    process.exitCode = run.status || 0;
  } finally {
    if (server) {
      server.kill();
      await new Promise(resolve => {
        if (server.exitCode !== null) return resolve();
        server.once('exit', resolve);
        setTimeout(resolve, 3000);
      });
    }
    fs.closeSync(serverLog);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

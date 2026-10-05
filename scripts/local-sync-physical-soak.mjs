import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const trackA = path.resolve(arg('track-a') ?? '');
const trackB = path.resolve(arg('track-b') ?? '');
const minutes = Number(arg('minutes', '10'));
const url = arg('url', 'http://127.0.0.1:5187/');
const outDir = path.resolve(arg('out', 'reports/local-debug/artifacts/sync-soak-v3-002'));
const port = new URL(url).port || '5187';

if (!existsSync(trackA) || !existsSync(trackB)) {
  throw new Error('Use --track-a and --track-b with existing local audio files.');
}
if (!Number.isFinite(minutes) || minutes < 10) {
  throw new Error('--minutes must be at least 10.');
}
mkdirSync(outDir, { recursive: true });

function sha256(file) {
  const h = createHash('sha256');
  h.update(readFileSync(file));
  return h.digest('hex').toUpperCase();
}

async function urlReady(target) {
  try {
    const r = await fetch(target);
    return r.ok;
  } catch {
    return false;
  }
}

async function waitForUrl(target, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await urlReady(target)) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Vite did not become ready at ' + target);
}

let vite = null;
if (!(await urlReady(url))) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  vite = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  vite.stdout?.on('data', d => process.stdout.write('[vite] ' + d));
  vite.stderr?.on('data', d => process.stderr.write('[vite] ' + d));
  await waitForUrl(url);
}

async function launchPhysicalBrowser() {
  const attempts = [
    { label: 'Google Chrome', opts: { channel: 'chrome' } },
    { label: 'Microsoft Edge', opts: { channel: 'msedge' } },
  ];
  const env = process.env;
  const executables = [
    ['Brave', path.join(env.PROGRAMFILES || '', 'BraveSoftware/Brave-Browser/Application/brave.exe')],
    ['Brave', path.join(env['PROGRAMFILES(X86)'] || '', 'BraveSoftware/Brave-Browser/Application/brave.exe')],
    ['Opera', path.join(env.LOCALAPPDATA || '', 'Programs/Opera/opera.exe')],
    ['Chrome', path.join(env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe')],
    ['Edge', path.join(env.PROGRAMFILES || '', 'Microsoft/Edge/Application/msedge.exe')],
  ].filter(([, exe]) => exe && existsSync(exe));

  for (const [label, executablePath] of executables) {
    attempts.push({ label, opts: { executablePath } });
  }

  const errors = [];
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch({
        headless: false,
        ...attempt.opts,
        args: [
          '--autoplay-policy=no-user-gesture-required',
          '--disable-features=AudioServiceOutOfProcess',
        ],
      });
      return { browser, browserLabel: attempt.label };
    } catch (error) {
      errors.push(attempt.label + ': ' + String(error));
    }
  }
  throw new Error('No supported installed physical browser could be launched. ' + errors.join(' | '));
}

const consoleErrors = [];
const pageErrors = [];
const telemetry = [];
let browser;
let browserLabel = 'unknown';
let result = null;

try {
  ({ browser, browserLabel } = await launchPhysicalBrowser());
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__libertasDualDeckTest && window.__libertasSyncTest));

  const capability = await page.evaluate(() => ({
    AudioContext: typeof AudioContext,
    AudioWorkletNode: typeof AudioWorkletNode,
    SharedArrayBuffer: typeof SharedArrayBuffer,
    crossOriginIsolated,
    userAgent: navigator.userAgent,
  }));
  if (capability.AudioContext === 'undefined' || capability.AudioWorkletNode === 'undefined') {
    throw new Error('Physical browser still lacks AudioContext/AudioWorkletNode: ' + JSON.stringify(capability));
  }

  await page.locator('#deck-a-file').setInputFiles(trackA);
  await page.locator('#deck-b-file').setInputFiles(trackB);
  await page.locator('#deck-a-load').click();
  await page.locator('#deck-b-load').click();

  await page.waitForFunction(async () => {
    const s = await window.__libertasDualDeckTest.status();
    return s.a.loaded && s.b.loaded;
  }, null, { timeout: 60_000 });

  for (const deck of ['a', 'b']) {
    await page.locator('#intelligence-' + deck + '-analyze').click();
    await page.waitForFunction((selector) => {
      const text = document.querySelector(selector)?.textContent || '';
      return text.includes('PROPOSAL_READY') || text.includes('"error"');
    }, '#intelligence-' + deck + '-status', { timeout: 90_000 });

    const text = await page.locator('#intelligence-' + deck + '-status').innerText();
    if (text.includes('"error"') || !text.includes('"recommended": true')) {
      throw new Error('Track Intelligence did not produce a recommended grid for Deck ' + deck.toUpperCase() + ': ' + text);
    }
    await page.locator('#intelligence-' + deck + '-apply').click();
    await page.waitForFunction((selector) => (document.querySelector(selector)?.textContent || '').includes('GRID_APPLIED_EXPLICITLY'), '#intelligence-' + deck + '-status');
  }

  const grids = await page.evaluate(() => ({
    A: window.__libertasIntelligenceTest.grid('A'),
    B: window.__libertasIntelligenceTest.grid('B'),
  }));

  await page.locator('#deck-a-play').click();
  await page.locator('#deck-b-play').click();
  await page.waitForTimeout(500);

  const recordingSupported = await page.evaluate(() => window.__libertasRecordingTest.supported());
  if (!recordingSupported) throw new Error('MediaRecorder is not supported in the physical browser.');

  await page.locator('#recording-start').click();
  await page.locator('#sync-a-to-b').click();
  await page.waitForTimeout(4_000);

  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());
  const baseline = {
    aSeek: before.a.transportSeekCount,
    bSeek: before.b.transportSeekCount,
    aDisc: before.a.frameDiscontinuities,
    bDisc: before.b.frameDiscontinuities,
    aPerf: before.a.performanceJumpCount,
    bPerf: before.b.performanceJumpCount,
  };

  const durationMs = minutes * 60_000;
  const start = Date.now();
  let changed103 = false;
  let jog1 = false;
  let changed097 = false;
  let loopOn = false;
  let loopOff = false;
  let changed105 = false;
  let jog2 = false;
  let reversed = false;
  let resetRate = false;

  while (Date.now() - start < durationMs) {
    const elapsed = Date.now() - start;

    if (!changed103 && elapsed >= 90_000) {
      await page.evaluate(() => window.__libertasDeckATest.setRate(1.03));
      changed103 = true;
    }
    if (!jog1 && elapsed >= 150_000) {
      await page.evaluate(() => window.__libertasPerformanceBTest.jogBySeconds(0.05));
      jog1 = true;
    }
    if (!changed097 && elapsed >= 210_000) {
      await page.evaluate(() => window.__libertasDeckATest.setRate(0.97));
      changed097 = true;
    }
    if (!loopOn && elapsed >= 270_000) {
      const snap = await page.evaluate(() => window.__libertasMusicalClockTest.snapshot('B'));
      const beat = Math.floor(snap.position.beatPosition);
      await page.evaluate((b) => window.__libertasPerformanceBTest.setBeatLoop(b, 4), beat);
      loopOn = true;
    }
    if (!loopOff && elapsed >= 300_000) {
      await page.evaluate(() => window.__libertasPerformanceBTest.clearLoop());
      loopOff = true;
    }
    if (!changed105 && elapsed >= 330_000) {
      await page.evaluate(() => window.__libertasDeckATest.setRate(1.05));
      changed105 = true;
    }
    if (!jog2 && elapsed >= 390_000) {
      await page.evaluate(() => window.__libertasPerformanceBTest.jogBySeconds(-0.05));
      jog2 = true;
    }
    if (!reversed && elapsed >= 450_000) {
      await page.locator('#sync-b-to-a').click();
      await page.waitForTimeout(4_000);
      reversed = true;
    }
    if (!resetRate && elapsed >= 510_000) {
      await page.evaluate(() => {
        window.__libertasDeckATest.setRate(1);
        window.__libertasDeckBTest.setRate(1);
      });
      resetRate = true;
    }

    const sample = await page.evaluate(async () => ({
      sync: await window.__libertasSyncTest.status(),
      decks: await window.__libertasDualDeckTest.status(),
    }));
    telemetry.push({ elapsedMs: elapsed, ...sample });

    if (sample.decks.a.transportSeekCount !== baseline.aSeek || sample.decks.b.transportSeekCount !== baseline.bSeek) {
      throw new Error('Hidden transport seek detected.');
    }
    if (sample.decks.a.frameDiscontinuities !== baseline.aDisc || sample.decks.b.frameDiscontinuities !== baseline.bDisc) {
      throw new Error('Frame discontinuity detected.');
    }

    await page.waitForTimeout(15_000);
  }

  const final = await page.evaluate(async () => ({
    sync: await window.__libertasSyncTest.status(),
    decks: await window.__libertasDualDeckTest.status(),
  }));

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#recording-stop').click();
  await page.waitForFunction(() => (document.querySelector('#recording-status')?.textContent || '').includes('"state": "ready"'), null, { timeout: 30_000 });
  await page.locator('#recording-download').click();
  const download = await downloadPromise;
  const recordingPath = path.join(outDir, 'SYNC-SOAK-V3-002-master-recording.webm');
  await download.saveAs(recordingPath);

  result = {
    task_id: 'SYNC-SOAK-V3-002',
    status: 'PASS',
    product_sha: '93d6c5b83549e598cc8718e830cb7effbf35eb0d',
    browser: browserLabel,
    capability,
    tracks: {
      A: { path: trackA, sha256: sha256(trackA) },
      B: { path: trackB, sha256: sha256(trackB) },
    },
    grids,
    durationMinutes: minutes,
    baseline,
    final,
    telemetry,
    consoleErrors,
    pageErrors,
    recording: {
      path: recordingPath,
      bytes: existsSync(recordingPath) ? readFileSync(recordingPath).byteLength : 0,
    },
    physical_audio_note: 'Real installed headed browser used. Subjective human listening remains NOT_EVALUATED unless separately confirmed.',
  };
} catch (error) {
  result = {
    task_id: 'SYNC-SOAK-V3-002',
    status: 'FAIL',
    product_sha: '93d6c5b83549e598cc8718e830cb7effbf35eb0d',
    browser: browserLabel,
    error: String(error),
    telemetry,
    consoleErrors,
    pageErrors,
  };
  process.exitCode = 1;
} finally {
  const out = path.join(outDir, 'SYNC-SOAK-V3-002-runtime.json');
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log('Wrote ' + out);
  await browser?.close().catch(() => {});
  if (vite) vite.kill();
}

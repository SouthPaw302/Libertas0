import { expect, test, type Page } from '@playwright/test';

async function openPhase10(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasLibraryTest &&
    window.__libertasMidiTest &&
    window.__libertasRecordingTest &&
    window.__libertasAutomationTest,
  ));
}

test('IndexedDB library deduplicates bytes and reloads stored PCM into a deck', async ({ page }) => {
  await openPhase10(page);
  await page.evaluate(() => window.__libertasLibraryTest.clear());
  const first = await page.evaluate(() => window.__libertasLibraryTest.importGenerated('same.wav', 4, 440));
  const second = await page.evaluate(() => window.__libertasLibraryTest.importGenerated('same-copy.wav', 4, 440));
  expect(second.id).toBe(first.id);

  const tracks = await page.evaluate(() => window.__libertasLibraryTest.list());
  expect(tracks).toHaveLength(1);
  expect(tracks[0]?.id).toBe(first.id);

  const loaded = await page.evaluate((id) => window.__libertasLibraryTest.load(id, 'A'), first.id);
  expect(loaded.loaded).toBe(true);
  expect(loaded.sourceFrames).toBeGreaterThan(100_000);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('MIDI learn and synthetic CC drive the real mixer crossfader deterministically', async ({ page }) => {
  await openPhase10(page);
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(5, 330, 550, 0.12));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    window.__libertasMidiTest.learn('mixer.crossfader', 'absolute', -1, 1);
    window.__libertasMidiTest.dispatch([0xb0, 10, 0]);
  });
  await page.waitForTimeout(80);
  const left = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(left.crossfaderGainA).toBeCloseTo(1, 2);
  expect(left.crossfaderGainB).toBeLessThan(0.03);

  await page.evaluate(() => window.__libertasMidiTest.dispatch([0xb0, 10, 127]));
  await page.waitForTimeout(80);
  const right = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(right.crossfaderGainA).toBeLessThan(0.03);
  expect(right.crossfaderGainB).toBeCloseTo(1, 2);

  const bindings = await page.evaluate(() => window.__libertasMidiTest.status().bindings);
  expect(bindings.some((binding) => binding.target === 'mixer.crossfader')).toBe(true);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('master recording captures post-mixer audio into a non-empty blob', async ({ page }) => {
  await openPhase10(page);
  const supported = await page.evaluate(() => window.__libertasRecordingTest.supported());
  test.skip(!supported, 'MediaRecorder unavailable in this Chrome runtime');

  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(5, 330, 550, 0.22));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.evaluate(() => window.__libertasRecordingTest.start());
  await page.waitForTimeout(900);
  const result = await page.evaluate(() => window.__libertasRecordingTest.stop());

  expect(result.status.state).toBe('ready');
  expect(result.size).toBeGreaterThan(1_000);
  expect(result.type).toContain('audio');

  const frozenDuration = result.status.durationSeconds;
  await page.waitForTimeout(500);
  const laterRecordingStatus = await page.evaluate(() => window.__libertasRecordingTest.status());
  expect(laterRecordingStatus.state).toBe('ready');
  expect(laterRecordingStatus.durationSeconds).toBeCloseTo(frozenDuration, 6);

  const status = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(status.a.frameDiscontinuities).toBe(0);
  expect(status.b.frameDiscontinuities).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('stopped master recording is exposed for in-app replay and download', async ({ page }) => {
  await openPhase10(page);
  const supported = await page.evaluate(() => window.__libertasRecordingTest.supported());
  test.skip(!supported, 'MediaRecorder unavailable in this Chrome runtime');

  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(5, 330, 550, 0.22));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());

  await page.locator('#recording-start').click();
  await page.waitForTimeout(900);
  await page.locator('#recording-stop').click();

  const status = page.locator('#recording-status');
  await expect(status).toContainText('"state": "ready"');

  const playback = page.locator('#recording-playback');
  const download = page.locator('#recording-download');
  await expect(playback).toBeVisible();
  await expect(download).toBeVisible();

  const playbackSrc = await playback.getAttribute('src');
  const downloadHref = await download.getAttribute('href');
  expect(playbackSrc).toMatch(/^blob:/);
  expect(downloadHref).toBe(playbackSrc);

  await playback.evaluate((element: HTMLAudioElement) => {
    if (element.readyState === 0) element.load();
  });

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('scheduled crossfader automation survives a 600 ms blocked main thread', async ({ page }) => {
  await openPhase10(page);
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(8, 330, 550, 0.2));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());

  await page.evaluate(() => window.__libertasAutomationTest.schedule({
    target: 'mixer.crossfader',
    points: [
      { offsetSeconds: 0, value: -1 },
      { offsetSeconds: 0.25, value: 0 },
      { offsetSeconds: 0.5, value: 1 },
    ],
  }, 0.05));
  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  await page.waitForTimeout(100);

  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(after.mixer.crossfaderGainA).toBeLessThan(0.05);
  expect(after.mixer.crossfaderGainB).toBeGreaterThan(0.95);
  expect(after.a.frameDiscontinuities - before.a.frameDiscontinuities).toBe(0);
  expect(after.b.frameDiscontinuities - before.b.frameDiscontinuities).toBe(0);
  expect(after.mixer.frameDiscontinuities - before.mixer.frameDiscontinuities).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

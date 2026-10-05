import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasDualDeckTest &&
    window.__libertasWaveformTest &&
    window.__libertasPerformanceATest &&
    window.__libertasMusicalClockTest,
  ));
});

test('waveform envelope is generated at track load and rendered read-only', async ({ page }) => {
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(20, 330, 550, 0.35));
  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());

  const result = await page.evaluate(async () => ({
    aEnvelope: window.__libertasWaveformTest.envelope('A'),
    bEnvelope: window.__libertasWaveformTest.envelope('B'),
    aView: await window.__libertasWaveformTest.refresh('A'),
    bView: await window.__libertasWaveformTest.refresh('B'),
  }));

  expect(result.aEnvelope?.buckets).toBe(2048);
  expect(result.bEnvelope?.buckets).toBe(2048);
  expect(result.aView.loaded).toBe(true);
  expect(result.bView.loaded).toBe(true);

  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(after.a.transportSeekCount).toBe(before.a.transportSeekCount);
  expect(after.b.transportSeekCount).toBe(before.b.transportSeekCount);
  expect(after.a.frameDiscontinuities).toBe(before.a.frameDiscontinuities);
  expect(after.b.frameDiscontinuities).toBe(before.b.frameDiscontinuities);
});

test('scrolling view follows the deck source frame while overview stays full-track', async ({ page }) => {
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(30, 330, 550, 0.35));
  await page.evaluate(() => window.__libertasDeckATest.seekFrame(480_000));
  const view = await page.evaluate(() => window.__libertasWaveformTest.refresh('A'));

  expect(view.loaded).toBe(true);
  expect(view.sourceFrame).toBeCloseTo(480_000, -2);
  expect(view.detailStartFrame).toBeGreaterThan(0);
  expect(view.detailEndFrame).toBeGreaterThan(view.sourceFrame);
  expect(view.overviewPlayheadX).toBeGreaterThan(0);
});

test('beat grid and performance markers are reflected without owning transport', async ({ page }) => {
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(30, 330, 550, 0.35));
  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', {
      bpm: 120,
      firstBeatFrame: 0,
      beatsPerBar: 4,
      beatUnit: 4,
    });
  });
  await page.evaluate(() => window.__libertasDeckATest.seekFrame(240_000));
  await page.evaluate(() => window.__libertasPerformanceATest.setCueFrame(240_000));
  await page.evaluate(() => window.__libertasPerformanceATest.setHotCue(1, 264_000));
  await page.evaluate(() => window.__libertasPerformanceATest.setLoopFrames(216_000, 312_000));

  const before = await page.evaluate(() => window.__libertasDeckATest.status());
  const view = await page.evaluate(() => window.__libertasWaveformTest.refresh('A'));
  const after = await page.evaluate(() => window.__libertasDeckATest.status());

  expect(view.beatLineCount).toBeGreaterThan(1);
  expect(view.cueVisible).toBe(true);
  expect(view.hotCueCount).toBeGreaterThanOrEqual(1);
  expect(view.loopVisible).toBe(true);
  expect(after.transportSeekCount).toBe(before.transportSeekCount);
  expect(after.frameDiscontinuities).toBe(before.frameDiscontinuities);
});

test('deck cards expose overview and detail canvases', async ({ page }) => {
  await expect(page.locator('#waveform-a-overview')).toBeVisible();
  await expect(page.locator('#waveform-a-detail')).toBeVisible();
  await expect(page.locator('#waveform-b-overview')).toBeVisible();
  await expect(page.locator('#waveform-b-detail')).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';

async function openFx(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasFxTest &&
    window.__libertasDualDeckTest &&
    window.__libertasMusicalClockTest &&
    window.__libertasRecordingTest,
  ));
}

test('deck and master FX buses default to transparent dry paths', async ({ page }) => {
  await openFx(page);
  const status = await page.evaluate(() => ({
    a: window.__libertasFxTest.status('A'),
    b: window.__libertasFxTest.status('B'),
    master: window.__libertasFxTest.status('master'),
  }));
  for (const unit of [status.a, status.b, status.master]) {
    expect(unit.wet).toBe(0);
    expect(unit.dryGain).toBeCloseTo(1, 6);
    expect(unit.wetGain).toBeCloseTo(0, 6);
  }
});

test('beat delay derives from Musical Clock tempo and actual playback rate', async ({ page }) => {
  await openFx(page);
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(12, 330, 550, 0.2));
  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 });
    window.__libertasDeckATest.setRate(1.04);
    window.__libertasFxTest.setBeatFraction('A', 0.5);
  });
  await page.waitForTimeout(100);
  const tempos = await page.evaluate(() => window.__libertasFxTest.refreshTempo());
  const status = await page.evaluate(() => window.__libertasFxTest.status('A'));

  expect(tempos.A).toBeCloseTo(124.8, 1);
  expect(status.tempoBpm).toBeCloseTo(124.8, 1);
  expect(status.delaySeconds).toBeCloseTo((60 / 124.8) * 0.5, 3);
});

test('active deck and master FX survive a blocked main thread without transport discontinuity', async ({ page }) => {
  await openFx(page);
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(12, 220, 880, 0.2));
  await page.evaluate(() => {
    window.__libertasFxTest.setWet('A', 0.65);
    window.__libertasFxTest.setFeedback('A', 0.5);
    window.__libertasFxTest.setTone('A', 0.55);
    window.__libertasFxTest.setWet('master', 0.35);
    window.__libertasFxTest.setFeedback('master', 0.4);
    window.__libertasMixerTest.setCrossfader(-1);
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(250);

  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());
  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());

  expect(after.a.sourceFrame - before.a.sourceFrame).toBeGreaterThan(after.a.sampleRate * 0.25);
  expect(after.a.frameDiscontinuities - before.a.frameDiscontinuities).toBe(0);
  expect(after.b.frameDiscontinuities - before.b.frameDiscontinuities).toBe(0);
  expect(after.mixer.frameDiscontinuities - before.mixer.frameDiscontinuities).toBe(0);
  expect((await page.evaluate(() => window.__libertasFxTest.status('master'))).outputRms).toBeGreaterThan(0.005);
});

test('master recorder captures the final FX output path', async ({ page }) => {
  await openFx(page);
  const supported = await page.evaluate(() => window.__libertasRecordingTest.supported());
  test.skip(!supported, 'MediaRecorder unavailable in this Chrome runtime');

  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(6, 330, 550, 0.22));
  await page.evaluate(() => {
    window.__libertasFxTest.setWet('master', 0.5);
    window.__libertasFxTest.setFeedback('master', 0.45);
    window.__libertasDualDeckTest.playBoth();
    window.__libertasRecordingTest.start();
  });
  await page.waitForTimeout(900);
  const result = await page.evaluate(() => window.__libertasRecordingTest.stop());

  expect(result.status.state).toBe('ready');
  expect(result.size).toBeGreaterThan(1_000);
  expect(result.type).toContain('audio');
});

test('FX controls are present in the operator console', async ({ page }) => {
  await openFx(page);
  await expect(page.locator('#fx-a-wet')).toBeVisible();
  await expect(page.locator('#fx-b-wet')).toBeVisible();
  await expect(page.locator('#fx-master-wet')).toBeVisible();
  await expect(page.locator('#fx-master-tempo-source')).toBeVisible();
});

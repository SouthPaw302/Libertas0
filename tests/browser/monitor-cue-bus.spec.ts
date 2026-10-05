import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasDualDeckTest &&
    window.__libertasMixerTest &&
    window.__libertasMonitorCueTest,
  ));
});

test('cue bus stays independent of master crossfader and master volume', async ({ page }) => {
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(20, 330, 550, 0.4));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());

  await page.evaluate(() => {
    window.__libertasMonitorCueTest.setLevel(1);
    window.__libertasMonitorCueTest.setBlend(0);
    window.__libertasMonitorCueTest.setCue('A', true);
    window.__libertasMonitorCueTest.setCue('B', false);
  });
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__libertasMonitorCueTest.status())).monitorRms).toBeGreaterThan(0.01);

  await page.evaluate(() => {
    window.__libertasMixerTest.setCrossfader(1);
    window.__libertasMixerTest.setMasterVolume(0);
  });
  await page.waitForTimeout(500);
  expect((await page.evaluate(() => window.__libertasMonitorCueTest.status())).monitorRms).toBeGreaterThan(0.01);

  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(after.a.transportSeekCount).toBe(before.a.transportSeekCount);
  expect(after.b.transportSeekCount).toBe(before.b.transportSeekCount);
  expect(after.a.frameDiscontinuities).toBe(before.a.frameDiscontinuities);
  expect(after.b.frameDiscontinuities).toBe(before.b.frameDiscontinuities);
  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('cue/master blend selects cue or post-master signal deterministically', async ({ page }) => {
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(20, 330, 550, 0.4));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    window.__libertasMixerTest.setMasterVolume(1);
    window.__libertasMixerTest.setCrossfader(-1);
    window.__libertasMonitorCueTest.setLevel(1);
    window.__libertasMonitorCueTest.setCue('A', false);
    window.__libertasMonitorCueTest.setCue('B', false);
    window.__libertasMonitorCueTest.setBlend(1);
  });
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.__libertasMonitorCueTest.status())).monitorRms).toBeGreaterThan(0.01);

  await page.evaluate(() => window.__libertasMonitorCueTest.setBlend(0));
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__libertasMonitorCueTest.status())).monitorRms).toBeLessThan(0.005);

  await page.evaluate(() => window.__libertasMonitorCueTest.setCue('A', true));
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__libertasMonitorCueTest.status())).monitorRms).toBeGreaterThan(0.01);
  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('monitor output exposes optional browser sink capability', async ({ page }) => {
  const result = await page.evaluate(async () => ({
    status: window.__libertasMonitorCueTest.status(),
    outputs: await window.__libertasMonitorCueTest.listOutputs(),
  }));
  expect(typeof result.status.outputSelectionSupported).toBe('boolean');
  expect(Array.isArray(result.outputs)).toBe(true);
  expect(result.status.outputEnabled).toBe(false);
});

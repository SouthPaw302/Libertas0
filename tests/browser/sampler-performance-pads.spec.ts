import { expect, test, type Page } from '@playwright/test';

async function openSampler(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasSamplerTest &&
    window.__libertasDualDeckTest &&
    window.__libertasMusicalClockTest &&
    window.__libertasMixerTest,
  ));
}

test('eight sampler pads are present and persisted bank restores a sample', async ({ page }) => {
  await openSampler(page);
  await page.evaluate(() => window.__libertasSamplerTest.clear());
  await page.evaluate(() => window.__libertasSamplerTest.loadGenerated(3, 1, 880, {
    mode: 'one-shot',
    gain: 0.65,
    quantizeBeats: 1,
    sourceDeck: 'B',
  }));

  const bank = await page.evaluate(() => window.__libertasSamplerTest.listBank());
  expect(bank).toHaveLength(1);
  expect(bank[0]?.slot).toBe(3);
  expect(bank[0]?.gain).toBeCloseTo(0.65, 6);
  expect(bank[0]?.sourceDeck).toBe('B');

  await page.evaluate(() => window.__libertasSamplerTest.unloadRuntime(3));
  expect((await page.evaluate(() => window.__libertasSamplerTest.status())).pads[2]?.loaded).toBe(false);

  await page.evaluate(() => window.__libertasSamplerTest.restore());
  const restored = await page.evaluate(() => window.__libertasSamplerTest.status());
  expect(restored.pads[2]?.loaded).toBe(true);
  expect(restored.pads[2]?.name).toContain('generated-pad-3');

  await expect(page.locator('.sampler-pad-card')).toHaveCount(8);
});

test('one-shot sampler routes through mixer input three and master volume', async ({ page }) => {
  await openSampler(page);
  await page.evaluate(() => window.__libertasSamplerTest.clear());
  await page.evaluate(() => window.__libertasSamplerTest.loadGenerated(1, 2, 660, {
    mode: 'one-shot',
    gain: 0.8,
    quantizeBeats: 0,
    sourceDeck: 'A',
  }));

  await page.evaluate(() => {
    window.__libertasMixerTest.setMasterVolume(1);
    return window.__libertasSamplerTest.trigger(1);
  });
  await page.waitForTimeout(180);
  const audible = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(audible.samplerInputPeak).toBeGreaterThan(0.05);
  expect(audible.outputPeak).toBeGreaterThan(0.03);

  await page.evaluate(() => window.__libertasMixerTest.setMasterVolume(0));
  await page.waitForTimeout(120);
  await page.evaluate(() => window.__libertasSamplerTest.trigger(1));
  await page.waitForTimeout(180);
  const muted = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(muted.samplerInputPeak).toBeGreaterThan(0.05);
  expect(muted.outputPeak).toBeLessThan(0.01);
});

test('quantized pad start survives a 600 ms blocked main thread and does not move deck transport', async ({ page }) => {
  await openSampler(page);
  await page.evaluate(() => window.__libertasSamplerTest.clear());
  await page.evaluate(() => window.__libertasSamplerTest.loadGenerated(2, 2, 990, {
    mode: 'one-shot',
    gain: 0.8,
    quantizeBeats: 1,
    sourceDeck: 'A',
  }));
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(12, 330, 550, 0.12));
  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', {
      bpm: 120,
      firstBeatFrame: 0,
      beatsPerBar: 4,
      beatUnit: 4,
    });
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(120);

  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());
  const trigger = await page.evaluate(() => window.__libertasSamplerTest.trigger(2));
  expect(trigger.quantizeBeats).toBe(1);
  expect(trigger.sourceDeck).toBe('A');
  expect(trigger.targetSourceFrame).not.toBeNull();
  expect(trigger.receipt.scheduledAt).toBeGreaterThan(0);

  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  const samplerStatus = await page.evaluate(() => window.__libertasSamplerTest.status());
  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());

  expect(samplerStatus.busRms).toBeGreaterThan(0.01);
  expect(after.a.transportSeekCount).toBe(before.a.transportSeekCount);
  expect(after.b.transportSeekCount).toBe(before.b.transportSeekCount);
  expect(after.a.frameDiscontinuities).toBe(before.a.frameDiscontinuities);
  expect(after.b.frameDiscontinuities).toBe(before.b.frameDiscontinuities);
  expect(after.mixer.frameDiscontinuities).toBe(before.mixer.frameDiscontinuities);
});

test('loop pad holds one active voice and stops explicitly', async ({ page }) => {
  await openSampler(page);
  await page.evaluate(() => window.__libertasSamplerTest.clear());
  await page.evaluate(() => window.__libertasSamplerTest.loadGenerated(4, 0.25, 440, {
    mode: 'loop',
    gain: 0.7,
    quantizeBeats: 0,
    sourceDeck: 'A',
  }));

  await page.evaluate(() => window.__libertasSamplerTest.trigger(4));
  await page.waitForTimeout(350);
  let status = await page.evaluate(() => window.__libertasSamplerTest.status());
  expect(status.pads[3]?.activeVoices).toBe(1);
  expect(status.busRms).toBeGreaterThan(0.01);

  await page.evaluate(() => window.__libertasSamplerTest.stop(4));
  await page.waitForTimeout(80);
  status = await page.evaluate(() => window.__libertasSamplerTest.status());
  expect(status.pads[3]?.activeVoices).toBe(0);
});

test('sampler pad controls expose mode, gain, quantize and source-deck selection', async ({ page }) => {
  await openSampler(page);
  await expect(page.locator('#sampler-1-trigger')).toBeVisible();
  await expect(page.locator('#sampler-1-mode')).toBeVisible();
  await expect(page.locator('#sampler-1-gain')).toBeVisible();
  await expect(page.locator('#sampler-1-quantize')).toBeVisible();
  await expect(page.locator('#sampler-1-source')).toBeVisible();
});

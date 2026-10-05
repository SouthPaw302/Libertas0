import { expect, test, type Page } from '@playwright/test';

async function openDeckA(page: Page): Promise<void> {
  await openDeckA(page);
  await page.waitForFunction(() => Boolean(window.__libertasDeckATest));
}

test('Deck A decode, transport, seek, rate, volume and mute share the AudioWorklet clock', async ({ page }) => {
  await openDeckA(page);

  const loaded = await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(10));
  expect(loaded.loaded).toBe(true);
  expect(loaded.decoderProvider).toBe('web-audio.decodeAudioData');
  expect(loaded.sourceChannels).toBe(2);
  expect(loaded.sourceFrames).toBeGreaterThan(loaded.sampleRate * 9);

  await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(250);
  const playing = await page.evaluate(() => window.__libertasDeckATest.status());
  expect(playing.playing).toBe(true);
  expect(playing.sourceFrame).toBeGreaterThan(playing.sampleRate * 0.1);

  await page.evaluate(() => window.__libertasDeckATest.pause());
  const pauseStart = await page.evaluate(() => window.__libertasDeckATest.status());
  await page.waitForTimeout(200);
  const pauseEnd = await page.evaluate(() => window.__libertasDeckATest.status());
  expect(Math.abs(pauseEnd.sourceFrame - pauseStart.sourceFrame)).toBeLessThan(1);

  const seekTarget = loaded.sampleRate * 1.5;
  const sought = await page.evaluate((frame) => window.__libertasDeckATest.seekFrame(frame), seekTarget);
  expect(sought.sourceFrame).toBeCloseTo(seekTarget, 3);

  await page.evaluate(() => window.__libertasDeckATest.setRate(1.5));
  const rateBefore = await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(300);
  const rateAfter = await page.evaluate(() => window.__libertasDeckATest.status());
  const outputDelta = rateAfter.outputCurrentFrame - rateBefore.outputCurrentFrame;
  const sourceDelta = rateAfter.sourceFrame - rateBefore.sourceFrame;
  const measuredRate = sourceDelta / outputDelta;
  expect(measuredRate).toBeGreaterThan(1.35);
  expect(measuredRate).toBeLessThan(1.65);

  await page.evaluate(() => {
    window.__libertasDeckATest.setRate(1);
    window.__libertasDeckATest.setVolume(1);
  });
  await page.waitForTimeout(250);
  const fullRms = await page.evaluate(() => window.__libertasDeckATest.rms());
  expect(fullRms).toBeGreaterThan(0.1);

  await page.evaluate(() => window.__libertasDeckATest.setVolume(0.25));
  await page.waitForTimeout(250);
  const quarterRms = await page.evaluate(() => window.__libertasDeckATest.rms());
  expect(quarterRms).toBeGreaterThan(fullRms * 0.12);
  expect(quarterRms).toBeLessThan(fullRms * 0.4);

  await page.evaluate(() => window.__libertasDeckATest.setMuted(true));
  await page.waitForTimeout(200);
  const mutedRms = await page.evaluate(() => window.__libertasDeckATest.rms());
  expect(mutedRms).toBeLessThan(fullRms * 0.02);

  await page.evaluate(() => window.__libertasDeckATest.close());
});

test('Deck A transport keeps advancing through a blocked main thread without new worklet discontinuities', async ({ page }) => {
  await openDeckA(page);
  await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(10));
  await page.evaluate(() => window.__libertasDeckATest.setVolume(0.1));
  await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(150);

  const before = await page.evaluate(() => window.__libertasDeckATest.status());
  await page.evaluate(() => window.__libertasDeckATest.blockMainThread(600));
  const after = await page.evaluate(() => window.__libertasDeckATest.status());

  const outputDelta = after.outputCurrentFrame - before.outputCurrentFrame;
  const sourceDelta = after.sourceFrame - before.sourceFrame;

  console.log('deck-a-before', before);
  console.log('deck-a-after', after);
  console.log('deck-a-stall-delta', {
    outputDelta,
    sourceDelta,
    newDiscontinuities: after.frameDiscontinuities - before.frameDiscontinuities,
  });

  expect(outputDelta).toBeGreaterThan(after.sampleRate * 0.25);
  expect(sourceDelta).toBeGreaterThan(after.sampleRate * 0.25);
  expect(after.frameDiscontinuities - before.frameDiscontinuities).toBe(0);

  await page.evaluate(() => window.__libertasDeckATest.close());
});

test('Deck A ends cleanly at the PCM boundary and clamps out-of-range seeks', async ({ page }) => {
  await openDeckA(page);
  const loaded = await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(1));

  const high = await page.evaluate((frame) => window.__libertasDeckATest.seekFrame(frame), loaded.sourceFrames * 2);
  expect(high.sourceFrame).toBe(loaded.sourceFrames);
  expect(high.ended).toBe(true);

  const low = await page.evaluate(() => window.__libertasDeckATest.seekFrame(-100));
  expect(low.sourceFrame).toBe(0);
  expect(low.ended).toBe(false);

  await page.evaluate((frame) => window.__libertasDeckATest.seekFrame(frame), loaded.sourceFrames - loaded.sampleRate * 0.05);
  await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(150);
  const ended = await page.evaluate(() => window.__libertasDeckATest.status());

  expect(ended.playing).toBe(false);
  expect(ended.ended).toBe(true);
  expect(ended.sourceFrame).toBe(loaded.sourceFrames);

  await page.evaluate(() => window.__libertasDeckATest.close());
});

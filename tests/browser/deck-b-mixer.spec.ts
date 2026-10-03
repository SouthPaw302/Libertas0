import { expect, test } from '@playwright/test';

test('Deck A and Deck B run independently through the two-input mixer', async ({ page }) => {
  await page.goto('/');
  const loaded = await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(10, 330, 550, 0.25));

  expect(loaded.a.deckId).toBe('A');
  expect(loaded.b.deckId).toBe('B');
  expect(loaded.a.loaded).toBe(true);
  expect(loaded.b.loaded).toBe(true);

  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(300);

  const both = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(both.a.playing).toBe(true);
  expect(both.b.playing).toBe(true);
  expect(both.a.sourceFrame).toBeGreaterThan(both.a.sampleRate * 0.1);
  expect(both.b.sourceFrame).toBeGreaterThan(both.b.sampleRate * 0.1);
  expect(both.mixer.inputAPeak).toBeGreaterThan(0);
  expect(both.mixer.inputBPeak).toBeGreaterThan(0);

  const bBeforePauseA = both.b.sourceFrame;
  await page.evaluate(() => window.__libertasDeckATest.pause());
  await page.waitForTimeout(250);
  const afterPauseA = await page.evaluate(() => window.__libertasDualDeckTest.status());

  expect(afterPauseA.a.playing).toBe(false);
  expect(afterPauseA.b.playing).toBe(true);
  expect(afterPauseA.b.sourceFrame).toBeGreaterThan(bBeforePauseA + afterPauseA.b.sampleRate * 0.1);

  const aFrozen = afterPauseA.a.sourceFrame;
  await page.evaluate(() => window.__libertasDeckBTest.seekFrame(48_000 * 2));
  const afterSeekB = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(afterSeekB.a.sourceFrame).toBeCloseTo(aFrozen, 3);
  expect(afterSeekB.b.sourceFrame).toBeGreaterThanOrEqual(afterSeekB.b.sampleRate * 2);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('Deck A and Deck B volumes are independent and master gain acts after summing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(10, 330, 550, 0.2));
  await page.evaluate(() => {
    window.__libertasDeckATest.setVolume(1);
    window.__libertasDeckBTest.setVolume(1);
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(300);

  const aFull = await page.evaluate(() => window.__libertasDeckATest.rms());
  const bFull = await page.evaluate(() => window.__libertasDeckBTest.rms());
  const mixFull = await page.evaluate(() => window.__libertasMixerTest.rms());
  expect(aFull).toBeGreaterThan(0.05);
  expect(bFull).toBeGreaterThan(0.05);
  expect(mixFull).toBeGreaterThan(0.05);

  await page.evaluate(() => window.__libertasDeckATest.setVolume(0));
  await page.waitForTimeout(250);
  const aZero = await page.evaluate(() => window.__libertasDeckATest.rms());
  const bStill = await page.evaluate(() => window.__libertasDeckBTest.rms());
  const statusAfterAZero = await page.evaluate(() => window.__libertasDualDeckTest.status());

  expect(aZero).toBeLessThan(aFull * 0.02);
  expect(bStill).toBeGreaterThan(bFull * 0.7);
  expect(statusAfterAZero.b.playing).toBe(true);

  await page.evaluate(() => {
    window.__libertasDeckATest.setVolume(1);
    window.__libertasMixerTest.setMasterVolume(1);
  });
  await page.waitForTimeout(250);
  const masterFull = await page.evaluate(() => window.__libertasMixerTest.rms());

  await page.evaluate(() => window.__libertasMixerTest.setMasterVolume(0.25));
  await page.waitForTimeout(250);
  const masterQuarter = await page.evaluate(() => window.__libertasMixerTest.rms());

  expect(masterQuarter).toBeGreaterThan(masterFull * 0.12);
  expect(masterQuarter).toBeLessThan(masterFull * 0.4);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('two decks and mixer keep advancing through main-thread stress with no new discontinuities', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(10, 330, 550, 0.2));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(150);

  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());
  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());

  const aDelta = after.a.sourceFrame - before.a.sourceFrame;
  const bDelta = after.b.sourceFrame - before.b.sourceFrame;
  const mixerDelta = after.mixer.outputCurrentFrame - before.mixer.outputCurrentFrame;

  console.log('dual-stress', {
    aDelta,
    bDelta,
    mixerDelta,
    aNewDiscontinuities: after.a.frameDiscontinuities - before.a.frameDiscontinuities,
    bNewDiscontinuities: after.b.frameDiscontinuities - before.b.frameDiscontinuities,
    mixerNewDiscontinuities: after.mixer.frameDiscontinuities - before.mixer.frameDiscontinuities,
  });

  expect(aDelta).toBeGreaterThan(after.a.sampleRate * 0.25);
  expect(bDelta).toBeGreaterThan(after.b.sampleRate * 0.25);
  expect(mixerDelta).toBeGreaterThan(after.mixer.sampleRate * 0.25);
  expect(after.a.frameDiscontinuities - before.a.frameDiscontinuities).toBe(0);
  expect(after.b.frameDiscontinuities - before.b.frameDiscontinuities).toBe(0);
  expect(after.mixer.frameDiscontinuities - before.mixer.frameDiscontinuities).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('mixer reports overload and clamps unsafe summed output', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(5, 440, 440, 0.75));
  await page.evaluate(() => {
    window.__libertasDeckATest.setVolume(1);
    window.__libertasDeckBTest.setVolume(1);
    window.__libertasMixerTest.setMasterVolume(1);
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(300);

  const status = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(status.summedPeakBeforeClamp).toBeGreaterThan(1);
  expect(status.outputPeak).toBeLessThanOrEqual(1);
  expect(status.clippedSamples).toBeGreaterThan(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

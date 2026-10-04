import { expect, test, type Page } from '@playwright/test';

async function openMixerDsp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__libertasMixerTest));
}

test('channel trim is independent and occurs before the mixer', async ({ page }) => {
  await openMixerDsp(page);
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(10, 440, 660, 0.18));
  await page.evaluate(() => {
    window.__libertasDeckATest.setVolume(1);
    window.__libertasDeckBTest.setVolume(0);
    window.__libertasMixerTest.setCrossfader(-1);
    window.__libertasMixerTest.setChannelTrim('A', 0);
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(300);

  const baseline = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));
  await page.evaluate(() => window.__libertasMixerTest.setChannelTrim('A', -12));
  await page.waitForTimeout(250);
  const attenuated = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));

  expect(baseline).toBeGreaterThan(0.05);
  expect(attenuated).toBeLessThan(baseline * 0.35);
  expect(attenuated).toBeGreaterThan(baseline * 0.18);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('three-band EQ shapes low, mid, and high test tones independently', async ({ page }) => {
  await openMixerDsp(page);

  const measureBand = async (
    frequency: number,
    band: 'low' | 'mid' | 'high',
  ): Promise<{ flat: number; cut: number; boost: number }> => {
    await page.evaluate(({ frequency }) =>
      window.__libertasDeckATest.loadGeneratedTone(5, frequency, 0.15),
    { frequency });
    await page.evaluate(() => {
      window.__libertasDeckATest.setVolume(1);
      window.__libertasMixerTest.setCrossfader(-1);
      window.__libertasMixerTest.setChannelEq('A', 'low', 0);
      window.__libertasMixerTest.setChannelEq('A', 'mid', 0);
      window.__libertasMixerTest.setChannelEq('A', 'high', 0);
    });
    await page.evaluate(() => window.__libertasDeckATest.play());
    await page.waitForTimeout(220);
    const flat = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));

    await page.evaluate(({ band }) => window.__libertasMixerTest.setChannelEq('A', band, -24), { band });
    await page.waitForTimeout(220);
    const cut = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));

    await page.evaluate(({ band }) => window.__libertasMixerTest.setChannelEq('A', band, 6), { band });
    await page.waitForTimeout(220);
    const boost = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));
    await page.evaluate(() => window.__libertasDeckATest.pause());

    return { flat, cut, boost };
  };

  const low = await measureBand(100, 'low');
  expect(low.cut).toBeLessThan(low.flat * 0.35);
  expect(low.boost).toBeGreaterThan(low.flat * 1.4);

  const mid = await measureBand(1_000, 'mid');
  expect(mid.cut).toBeLessThan(mid.flat * 0.35);
  expect(mid.boost).toBeGreaterThan(mid.flat * 1.4);

  const high = await measureBand(10_000, 'high');
  expect(high.cut).toBeLessThan(high.flat * 0.4);
  expect(high.boost).toBeGreaterThan(high.flat * 1.35);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('bipolar DJ filter attenuates highs on the low-pass side and lows on the high-pass side', async ({ page }) => {
  await openMixerDsp(page);

  await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(6, 8_000, 0.18));
  await page.evaluate(() => {
    window.__libertasMixerTest.setCrossfader(-1);
    window.__libertasMixerTest.setChannelFilter('A', 0);
  });
  await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(220);
  const highFlat = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));
  await page.evaluate(() => window.__libertasMixerTest.setChannelFilter('A', -1));
  await page.waitForTimeout(250);
  const highCut = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));
  expect(highCut).toBeLessThan(highFlat * 0.15);

  await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(6, 100, 0.18));
  await page.evaluate(() => {
    window.__libertasMixerTest.setChannelFilter('A', 0);
    window.__libertasDeckATest.play();
  });
  await page.waitForTimeout(220);
  const lowFlat = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));
  await page.evaluate(() => window.__libertasMixerTest.setChannelFilter('A', 1));
  await page.waitForTimeout(250);
  const lowCut = await page.evaluate(() => window.__libertasMixerTest.channelRms('A'));
  expect(lowCut).toBeLessThan(lowFlat * 0.15);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('crossfader follows equal-power law and isolates endpoints', async ({ page }) => {
  await openMixerDsp(page);
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(8, 330, 550, 0.2));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(200);

  await page.evaluate(() => window.__libertasMixerTest.setCrossfader(-1));
  await page.waitForTimeout(120);
  const left = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(left.crossfaderGainA).toBeCloseTo(1, 3);
  expect(left.crossfaderGainB).toBeLessThan(0.01);

  await page.evaluate(() => window.__libertasMixerTest.setCrossfader(0));
  await page.waitForTimeout(120);
  const center = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(center.crossfaderGainA).toBeCloseTo(Math.SQRT1_2, 2);
  expect(center.crossfaderGainB).toBeCloseTo(Math.SQRT1_2, 2);

  await page.evaluate(() => window.__libertasMixerTest.setCrossfader(1));
  await page.waitForTimeout(120);
  const right = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(right.crossfaderGainA).toBeLessThan(0.01);
  expect(right.crossfaderGainB).toBeCloseTo(1, 3);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('sample-peak limiter reduces overload before the final safety clamp', async ({ page }) => {
  await openMixerDsp(page);
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(6, 440, 440, 0.9));
  await page.evaluate(() => {
    window.__libertasDeckATest.setVolume(1);
    window.__libertasDeckBTest.setVolume(1);
    window.__libertasMixerTest.setChannelTrim('A', 0);
    window.__libertasMixerTest.setChannelTrim('B', 0);
    window.__libertasMixerTest.setCrossfader(0);
    window.__libertasMixerTest.setMasterVolume(1);
    window.__libertasMixerTest.setLimiterThreshold(0.95);
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(350);

  const status = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(status.summedPeakBeforeClamp).toBeGreaterThan(1);
  expect(status.limitedSamples).toBeGreaterThan(0);
  expect(status.maxLimiterGainReductionDb).toBeGreaterThan(0.5);
  expect(status.outputPeak).toBeLessThanOrEqual(0.97);
  expect(status.hardClippedSamplesAfterLimiter).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('active DSP remains realtime-safe through a 600 ms main-thread stall', async ({ page }) => {
  await openMixerDsp(page);
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(12, 220, 880, 0.2));
  await page.evaluate(() => {
    window.__libertasMixerTest.setChannelTrim('A', 3);
    window.__libertasMixerTest.setChannelEq('A', 'low', 4);
    window.__libertasMixerTest.setChannelEq('B', 'high', -12);
    window.__libertasMixerTest.setChannelFilter('A', -0.35);
    window.__libertasMixerTest.setChannelFilter('B', 0.25);
    window.__libertasMixerTest.setCrossfader(0.2);
    window.__libertasMixerTest.setMasterVolume(0.8);
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(180);

  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());
  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());

  console.log('mixer-dsp-stress', {
    aDelta: after.a.sourceFrame - before.a.sourceFrame,
    bDelta: after.b.sourceFrame - before.b.sourceFrame,
    mixerDelta: after.mixer.outputCurrentFrame - before.mixer.outputCurrentFrame,
    aDiscontinuities: after.a.frameDiscontinuities - before.a.frameDiscontinuities,
    bDiscontinuities: after.b.frameDiscontinuities - before.b.frameDiscontinuities,
    mixerDiscontinuities: after.mixer.frameDiscontinuities - before.mixer.frameDiscontinuities,
  });

  expect(after.a.sourceFrame - before.a.sourceFrame).toBeGreaterThan(after.a.sampleRate * 0.25);
  expect(after.b.sourceFrame - before.b.sourceFrame).toBeGreaterThan(after.b.sampleRate * 0.25);
  expect(after.mixer.outputCurrentFrame - before.mixer.outputCurrentFrame).toBeGreaterThan(after.mixer.sampleRate * 0.25);
  expect(after.a.frameDiscontinuities - before.a.frameDiscontinuities).toBe(0);
  expect(after.b.frameDiscontinuities - before.b.frameDiscontinuities).toBe(0);
  expect(after.mixer.frameDiscontinuities - before.mixer.frameDiscontinuities).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

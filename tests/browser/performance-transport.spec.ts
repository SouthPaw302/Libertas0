import { expect, test, type Page } from '@playwright/test';

async function openHarness(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__libertasPerformanceATest));
}

test('cue and hot cue are explicit deterministic transport jumps', async ({ page }) => {
  await openHarness(page);
  const loaded = await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(12, 440, 0.2));

  const cueFrame = loaded.sourceSampleRate * 1.25;
  await page.evaluate((frame) => window.__libertasDeckATest.seekFrame(frame), cueFrame);
  const cueSet = await page.evaluate(() => window.__libertasPerformanceATest.setCueHere());
  expect(cueSet.cueFrame).toBeCloseTo(cueFrame, 6);

  const hotFrame = loaded.sourceSampleRate * 2.5;
  await page.evaluate((frame) => window.__libertasPerformanceATest.setHotCue(1, frame), hotFrame);

  await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(120);
  const hot = await page.evaluate(() => window.__libertasPerformanceATest.triggerHotCue(1));
  expect(hot.playing).toBe(true);
  expect(hot.sourceFrame).toBeGreaterThanOrEqual(hotFrame);
  expect(hot.hotCueTriggerCount).toBe(1);

  const cue = await page.evaluate(() => window.__libertasPerformanceATest.triggerCue(true));
  expect(cue.playing).toBe(false);
  expect(cue.sourceFrame).toBeCloseTo(cueFrame, 6);
  expect(cue.cueTriggerCount).toBe(1);
  expect(cue.performanceJumpCount).toBe(2);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('sample-domain loop wraps with overshoot preserved and without worklet discontinuity', async ({ page }) => {
  await openHarness(page);
  const loaded = await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(12, 440, 0.2));
  const start = loaded.sourceSampleRate * 0.5;
  const end = start + loaded.sourceSampleRate * 0.05;

  await page.evaluate(
    ({ startFrame, endFrame }) =>
      window.__libertasPerformanceATest.setLoopFrames(startFrame, endFrame),
    { startFrame: start, endFrame: end },
  );
  await page.evaluate(() => window.__libertasDeckATest.play());
  const before = await page.evaluate(() => window.__libertasDeckATest.status());
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__libertasDeckATest.status());

  expect(after.loopEnabled).toBe(true);
  expect(after.sourceFrame).toBeGreaterThanOrEqual(start);
  expect(after.sourceFrame).toBeLessThan(end);
  expect(after.loopWrapCount).toBeGreaterThan(2);
  expect(after.frameDiscontinuities - before.frameDiscontinuities).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('beat loop uses the locked musical grid and stays stable through a 600 ms main-thread stall', async ({ page }) => {
  await openHarness(page);
  const loaded = await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(20, 440, 0.15));
  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', {
      bpm: 120,
      firstBeatFrame: 0,
      beatsPerBar: 4,
      beatUnit: 4,
    });
  });

  const set = await page.evaluate(() => window.__libertasPerformanceATest.setBeatLoop(2, 4));
  const fpb = (loaded.sourceSampleRate * 60) / 120;
  expect(set.loopStartFrame).toBeCloseTo(2 * fpb, 6);
  expect(set.loopEndFrame).toBeCloseTo(6 * fpb, 6);

  await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__libertasDeckATest.status());
  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  const after = await page.evaluate(() => window.__libertasDeckATest.status());

  console.log('performance-loop-stress', {
    wraps: after.loopWrapCount - before.loopWrapCount,
    sourceFrame: after.sourceFrame,
    newDiscontinuities: after.frameDiscontinuities - before.frameDiscontinuities,
  });

  expect(after.loopWrapCount).toBeGreaterThanOrEqual(before.loopWrapCount);
  expect(after.sourceFrame).toBeGreaterThanOrEqual(after.loopStartFrame ?? 0);
  expect(after.sourceFrame).toBeLessThan(after.loopEndFrame ?? Number.POSITIVE_INFINITY);
  expect(after.frameDiscontinuities - before.frameDiscontinuities).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('jog is a bounded explicit source-frame displacement and does not alter play state', async ({ page }) => {
  await openHarness(page);
  const loaded = await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(10));
  const center = loaded.sourceSampleRate * 2;

  await page.evaluate((frame) => window.__libertasDeckATest.seekFrame(frame), center);
  await page.evaluate(() => window.__libertasDeckATest.play());

  const forward = await page.evaluate((delta) => window.__libertasPerformanceATest.jogByFrames(delta), loaded.sourceSampleRate * 0.1);
  expect(forward.playing).toBe(true);
  expect(forward.sourceFrame).toBeGreaterThan(center + loaded.sourceSampleRate * 0.09);

  const back = await page.evaluate((delta) => window.__libertasPerformanceATest.jogByFrames(delta), -loaded.sourceSampleRate * 10);
  expect(back.sourceFrame).toBe(0);
  expect(back.playing).toBe(true);
  expect(back.jogCount).toBe(2);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('explicit follower hotcue remains distinguishable from hidden SYNC maintenance and controller re-locks', async ({ page }) => {
  await openHarness(page);
  const loaded = await page.evaluate(() => window.__libertasSyncTest.loadClickPair(20, 120, 128));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.evaluate(() => window.__libertasSyncTest.enable('A'));
  await page.waitForTimeout(2500);

  const before = await page.evaluate(() => window.__libertasSyncTest.status());
  const frame = loaded.b.sourceSampleRate * 1.5;
  await page.evaluate(
    ({ slot, target }) => window.__libertasPerformanceBTest.setHotCue(slot, target),
    { slot: 1, target: frame },
  );
  await page.evaluate(() => window.__libertasPerformanceBTest.triggerHotCue(1));
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => window.__libertasSyncTest.status());

  expect((after.followerDeck?.performanceJumpCount ?? 0) - (before.followerDeck?.performanceJumpCount ?? 0)).toBe(1);
  expect((after.followerDeck?.transportSeekCount ?? 0) - (before.followerDeck?.transportSeekCount ?? 0)).toBe(0);
  expect(after.followerDeck?.syncTracking).toBe(true);
  expect(Math.abs(after.followerDeck?.syncPhaseErrorBeats ?? 1)).toBeLessThan(0.05);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

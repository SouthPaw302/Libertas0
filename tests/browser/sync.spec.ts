import { expect, test, type Page } from '@playwright/test';

async function openSyncHarness(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__libertasSyncTest));
}

test('SYNC tempo-matches and phase-locks B to A without corrective seeks', async ({ page }) => {
  await openSyncHarness(page);
  const loaded = await page.evaluate(() => window.__libertasSyncTest.loadClickPair(20, 120, 128));

  const bFramesPerBeat = (loaded.b.sourceSampleRate * 60) / 128;
  await page.evaluate((frame) => window.__libertasDeckBTest.seekFrame(frame), bFramesPerBeat * 0.35);

  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());
  const baselineSeeks = before.b.transportSeekCount;

  await page.evaluate(() => window.__libertasSyncTest.enable('A'));
  await page.waitForTimeout(4_000);

  const sync = await page.evaluate(() => window.__libertasSyncTest.status());
  expect(sync.enabled).toBe(true);
  expect(sync.leader).toBe('A');
  expect(sync.follower).toBe('B');
  expect(sync.followerDeck?.syncTracking).toBe(true);
  expect(sync.followerDeck?.syncLocked).toBe(true);
  expect(Math.abs(sync.followerDeck?.syncPhaseErrorBeats ?? 1)).toBeLessThan(0.02);
  expect(sync.followerDeck?.playbackRate ?? 0).toBeCloseTo(120 / 128, 2);
  expect(sync.followerDeck?.transportSeekCount).toBe(baselineSeeks);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('SYNC follows a leader rate change and remains phase locked', async ({ page }) => {
  await openSyncHarness(page);
  await page.evaluate(() => window.__libertasSyncTest.loadClickPair(20, 120, 128));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.evaluate(() => window.__libertasSyncTest.enable('A'));
  await page.waitForTimeout(2_500);

  await page.evaluate(() => window.__libertasDeckATest.setRate(1.05));
  await page.waitForTimeout(2_500);

  const sync = await page.evaluate(() => window.__libertasSyncTest.status());
  const expected = 1.05 * 120 / 128;
  expect(sync.followerDeck?.syncTempoMatchedRate ?? 0).toBeCloseTo(expected, 2);
  expect(sync.followerDeck?.playbackRate ?? 0).toBeCloseTo(expected, 2);
  expect(Math.abs(sync.followerDeck?.syncPhaseErrorBeats ?? 1)).toBeLessThan(0.02);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('SYNC remains active through a 600 ms blocked main thread', async ({ page }) => {
  await openSyncHarness(page);
  const loaded = await page.evaluate(() => window.__libertasSyncTest.loadClickPair(20, 120, 128));
  const bFramesPerBeat = (loaded.b.sourceSampleRate * 60) / 128;
  await page.evaluate((frame) => window.__libertasDeckBTest.seekFrame(frame), bFramesPerBeat * 0.2);
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.evaluate(() => window.__libertasSyncTest.enable('A'));
  await page.waitForTimeout(3_000);

  const before = await page.evaluate(() => window.__libertasSyncTest.status());
  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  const after = await page.evaluate(() => window.__libertasSyncTest.status());

  console.log('sync-stress', {
    beforePhase: before.followerDeck?.syncPhaseErrorBeats,
    afterPhase: after.followerDeck?.syncPhaseErrorBeats,
    followerDelta:
      (after.followerDeck?.sourceFrame ?? 0) - (before.followerDeck?.sourceFrame ?? 0),
    newFollowerDiscontinuities:
      (after.followerDeck?.frameDiscontinuities ?? 0) -
      (before.followerDeck?.frameDiscontinuities ?? 0),
    snapshotAge: after.followerDeck?.syncSnapshotAgeFrames,
  });

  expect(after.followerDeck?.syncTracking).toBe(true);
  expect(Math.abs(after.followerDeck?.syncPhaseErrorBeats ?? 1)).toBeLessThan(0.02);
  expect(
    (after.followerDeck?.sourceFrame ?? 0) - (before.followerDeck?.sourceFrame ?? 0),
  ).toBeGreaterThan((after.followerDeck?.sourceSampleRate ?? 44_100) * 0.25);
  expect(
    (after.followerDeck?.frameDiscontinuities ?? 0) -
      (before.followerDeck?.frameDiscontinuities ?? 0),
  ).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('SYNC can reverse leadership and still converge', async ({ page }) => {
  await openSyncHarness(page);
  const loaded = await page.evaluate(() => window.__libertasSyncTest.loadClickPair(20, 120, 126));
  const aFramesPerBeat = (loaded.a.sourceSampleRate * 60) / 120;
  await page.evaluate((frame) => window.__libertasDeckATest.seekFrame(frame), aFramesPerBeat * 0.3);
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.evaluate(() => window.__libertasSyncTest.enable('B'));
  await page.waitForTimeout(4_000);

  const sync = await page.evaluate(() => window.__libertasSyncTest.status());
  expect(sync.leader).toBe('B');
  expect(sync.follower).toBe('A');
  expect(sync.followerDeck?.syncLocked).toBe(true);
  expect(Math.abs(sync.followerDeck?.syncPhaseErrorBeats ?? 1)).toBeLessThan(0.02);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

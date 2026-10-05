import { expect, test, type Page } from '@playwright/test';

async function openSyncHarness(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasSyncTest &&
    window.__libertasDualDeckTest &&
    window.__libertasPerformanceBTest,
  ));
}

test.describe.configure({ mode: 'serial' });

test('SYNC holds for 180 seconds through rate sweeps, UI stalls, and explicit follower jumps', async ({ page }) => {
  test.setTimeout(240_000);
  await openSyncHarness(page);

  const loaded = await page.evaluate(() => window.__libertasSyncTest.loadClickPair(220, 120, 128));
  const bFramesPerBeat = (loaded.b.sourceSampleRate * 60) / 128;
  await page.evaluate((frame) => window.__libertasDeckBTest.seekFrame(frame), bFramesPerBeat * 0.32);

  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(150);

  const baseline = await page.evaluate(() => window.__libertasDualDeckTest.status());
  const baselineSeek = baseline.b.transportSeekCount;
  const baselineDisc = baseline.b.frameDiscontinuities;
  const baselinePerf = baseline.b.performanceJumpCount;

  await page.evaluate(() => window.__libertasSyncTest.enable('A'));
  await page.waitForTimeout(3_500);

  const rates = [1.0, 1.03, 0.97, 1.05, 0.95, 1.0];
  const phaseSamples: number[] = [];

  for (let step = 0; step < 18; step += 1) {
    if (step % 3 === 0) {
      const rate = rates[(step / 3) % rates.length];
      await page.evaluate((value) => window.__libertasDeckATest.setRate(value), rate);
    }

    if (step === 4 || step === 9 || step === 14) {
      await page.evaluate(() => window.__libertasPerformanceBTest.jogBySeconds(0.05));
    }

    if (step === 6 || step === 12) {
      await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
    }

    await page.waitForTimeout(10_000);

    const sync = await page.evaluate(() => window.__libertasSyncTest.status());
    const phase = Math.abs(sync.followerDeck?.syncPhaseErrorBeats ?? 1);
    phaseSamples.push(phase);

    expect(sync.enabled).toBe(true);
    expect(sync.leader).toBe('A');
    expect(sync.follower).toBe('B');
    expect(sync.followerDeck?.syncTracking).toBe(true);
    expect(phase).toBeLessThan(0.05);
    expect(sync.followerDeck?.transportSeekCount).toBe(baselineSeek);
    expect(sync.followerDeck?.frameDiscontinuities).toBe(baselineDisc);
  }

  const final = await page.evaluate(() => window.__libertasSyncTest.status());
  expect(final.followerDeck?.syncLocked).toBe(true);
  expect((final.followerDeck?.performanceJumpCount ?? 0) - baselinePerf).toBe(3);
  expect(final.followerDeck?.transportSeekCount).toBe(baselineSeek);
  expect(final.followerDeck?.frameDiscontinuities).toBe(baselineDisc);

  console.log('sync-soak-180s', {
    phaseSamples,
    maxPhaseErrorBeats: Math.max(...phaseSamples),
    finalPhaseErrorBeats: final.followerDeck?.syncPhaseErrorBeats,
    hiddenSeekDelta: (final.followerDeck?.transportSeekCount ?? 0) - baselineSeek,
    discontinuityDelta: (final.followerDeck?.frameDiscontinuities ?? 0) - baselineDisc,
    performanceJumpDelta: (final.followerDeck?.performanceJumpCount ?? 0) - baselinePerf,
  });

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('SYNC survives repeated enable-disable cycles and leadership reversal without hidden seeks', async ({ page }) => {
  test.setTimeout(120_000);
  await openSyncHarness(page);

  await page.evaluate(() => window.__libertasSyncTest.loadClickPair(120, 120, 126));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(150);

  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());
  const aSeek = before.a.transportSeekCount;
  const bSeek = before.b.transportSeekCount;
  const aDisc = before.a.frameDiscontinuities;
  const bDisc = before.b.frameDiscontinuities;

  let successfulEnables = 0;

  for (let cycle = 0; cycle < 24; cycle += 1) {
    const leader = cycle % 2 === 0 ? 'A' : 'B';
    await page.evaluate((id) => window.__libertasSyncTest.enable(id), leader);
    await page.waitForTimeout(900);

    const status = await page.evaluate(() => window.__libertasSyncTest.status());
    expect(status.enabled).toBe(true);
    expect(status.leader).toBe(leader);
    expect(status.followerDeck?.syncTracking).toBe(true);
    expect(Math.abs(status.followerDeck?.syncPhaseErrorBeats ?? 1)).toBeLessThan(0.08);
    successfulEnables += 1;

    await page.evaluate(() => window.__libertasSyncTest.disable());
    await page.waitForTimeout(100);
    const disabled = await page.evaluate(() => window.__libertasSyncTest.status());
    expect(disabled.enabled).toBe(false);
  }

  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());

  expect(after.a.transportSeekCount).toBe(aSeek);
  expect(after.b.transportSeekCount).toBe(bSeek);
  expect(after.a.frameDiscontinuities).toBe(aDisc);
  expect(after.b.frameDiscontinuities).toBe(bDisc);

  console.log('sync-cycle-soak', {
    successfulEnables,
    aHiddenSeekDelta: after.a.transportSeekCount - aSeek,
    bHiddenSeekDelta: after.b.transportSeekCount - bSeek,
    aDiscontinuityDelta: after.a.frameDiscontinuities - aDisc,
    bDiscontinuityDelta: after.b.frameDiscontinuities - bDisc,
  });

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

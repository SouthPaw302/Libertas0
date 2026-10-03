import { expect, test } from '@playwright/test';

test('manual grids map independent Deck A/B source frames into deterministic musical positions', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(12, 330, 550, 0.2));

  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', {
      bpm: 120,
      firstBeatFrame: 0,
      beatsPerBar: 4,
      beatUnit: 4,
    });
    window.__libertasMusicalClockTest.setGrid('B', {
      bpm: 90,
      firstBeatFrame: 12_000,
      beatsPerBar: 3,
      beatUnit: 4,
    });
  });

  const targetA = loaded.a.sourceSampleRate * 2;
  const targetB =
    12_000 + 2.625 * ((loaded.b.sourceSampleRate * 60) / 90);

  await page.evaluate((frame) => window.__libertasDeckATest.seekFrame(frame), targetA);
  await page.evaluate((frame) => window.__libertasDeckBTest.seekFrame(frame), targetB);
  const snapshots = await page.evaluate(() => window.__libertasMusicalClockTest.snapshotBoth());

  expect(snapshots.a.position.beatPosition).toBeCloseTo(4, 10);
  expect(snapshots.a.position.barIndex).toBe(1);
  expect(snapshots.a.position.beatInBar).toBe(0);

  expect(snapshots.b.position.beatPosition).toBeCloseTo(2.625, 10);
  expect(snapshots.b.position.barIndex).toBe(0);
  expect(snapshots.b.position.beatInBar).toBe(2);
  expect(snapshots.b.position.beatPhase).toBeCloseTo(0.625, 10);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('musical position follows source-frame varispeed and freezes with paused transport', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(20, 330, 550, 0.15));
  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', {
      bpm: 120,
      firstBeatFrame: 0,
      beatsPerBar: 4,
      beatUnit: 4,
    });
    window.__libertasDeckATest.setRate(1.5);
  });

  await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(400);
  const first = await page.evaluate(() => window.__libertasMusicalClockTest.snapshot('A'));
  await page.waitForTimeout(400);
  const second = await page.evaluate(() => window.__libertasMusicalClockTest.snapshot('A'));

  expect(second.position.beatPosition).toBeGreaterThan(first.position.beatPosition + 0.7);

  await page.evaluate(() => window.__libertasDeckATest.pause());
  const pausedA = await page.evaluate(() => window.__libertasMusicalClockTest.snapshot('A'));
  await page.waitForTimeout(300);
  const pausedB = await page.evaluate(() => window.__libertasMusicalClockTest.snapshot('A'));
  expect(pausedB.position.beatPosition).toBeCloseTo(pausedA.position.beatPosition, 10);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('quantization is deterministic and does not move deck transport', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(10));
  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', {
      bpm: 120,
      firstBeatFrame: 24_000,
      beatsPerBar: 4,
      beatUnit: 4,
    });
  });
  await page.evaluate(() => window.__libertasMusicalClockTest.snapshot('A'));

  const before = await page.evaluate(() => window.__libertasDeckATest.status());
  const framesPerBeat = (before.sourceSampleRate * 60) / 120;
  const source = 24_000 + 2.4 * framesPerBeat;
  const expected = 24_000 + 2 * framesPerBeat;

  const quantized = await page.evaluate((frame) =>
    window.__libertasMusicalClockTest.quantize('A', frame, 1, 'nearest'),
  source);
  const after = await page.evaluate(() => window.__libertasDeckATest.status());

  expect(quantized).toBeCloseTo(expected, 8);
  expect(after.sourceFrame).toBeCloseTo(before.sourceFrame, 10);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('musical mapping stays coherent across the dual-deck 600 ms main-thread stress interval', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(10, 330, 550, 0.15));
  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 });
    window.__libertasMusicalClockTest.setGrid('B', { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 });
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(150);

  const before = await page.evaluate(() => window.__libertasMusicalClockTest.snapshotBoth());
  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  const after = await page.evaluate(() => window.__libertasMusicalClockTest.snapshotBoth());

  const aBeatDelta = after.a.position.beatPosition - before.a.position.beatPosition;
  const bBeatDelta = after.b.position.beatPosition - before.b.position.beatPosition;

  console.log('musical-clock-stress', { aBeatDelta, bBeatDelta });

  expect(aBeatDelta).toBeGreaterThan(0.5);
  expect(bBeatDelta).toBeGreaterThan(0.5);
  expect(Math.abs(aBeatDelta - bBeatDelta)).toBeLessThan(0.02);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

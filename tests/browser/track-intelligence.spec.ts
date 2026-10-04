import { expect, test, type Page } from '@playwright/test';

async function openIntelligence(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__libertasIntelligenceTest));
}

test('worker analysis recovers BPM and beat anchor from generated click audio', async ({ page }) => {
  await openIntelligence(page);
  const result = await page.evaluate(() =>
    window.__libertasIntelligenceTest.analyzeGenerated('A', 120, 24, 0.35),
  );

  expect(result.provider).toBe('libertas.reference-onset-autocorrelation.v1');
  expect(result.bpm).toBeCloseTo(120, 0);
  expect(Math.abs(result.beatAnchorFrame - result.sourceSampleRate * 0.35)).toBeLessThan(
    result.sourceSampleRate * 0.04,
  );
  expect(result.bpmConfidence).toBeGreaterThan(0.5);
  expect(result.gridProposal.status).toBe('proposal');

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('analysis never silently mutates the manual Musical Clock grid', async ({ page }) => {
  await openIntelligence(page);
  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', {
      bpm: 133,
      firstBeatFrame: 4321,
      beatsPerBar: 4,
      beatUnit: 4,
    });
  });

  const before = await page.evaluate(() => window.__libertasIntelligenceTest.grid('A'));
  const result = await page.evaluate(() =>
    window.__libertasIntelligenceTest.analyzeGenerated('A', 120, 20, 0.2),
  );
  const afterAnalysis = await page.evaluate(() => window.__libertasIntelligenceTest.grid('A'));

  expect(before).toEqual(afterAnalysis);
  expect(afterAnalysis.bpm).toBe(133);
  expect(result.bpm).toBeCloseTo(120, 0);

  const applied = await page.evaluate(() => window.__libertasIntelligenceTest.applyLatest('A'));
  expect(applied.bpm).toBeCloseTo(result.bpm, 8);
  expect(applied.firstBeatFrame).toBe(result.beatAnchorFrame);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('background analysis does not interrupt active audio rendering', async ({ page }) => {
  await openIntelligence(page);
  await page.evaluate(() => window.__libertasDeckATest.loadGeneratedTone(20, 440, 0.15));
  await page.evaluate(() => window.__libertasDeckATest.play());
  await page.waitForTimeout(120);
  const before = await page.evaluate(() => window.__libertasDeckATest.status());

  const result = await page.evaluate(() =>
    window.__libertasIntelligenceTest.analyzeGenerated('B', 128, 40, 0.18),
  );

  const after = await page.evaluate(() => window.__libertasDeckATest.status());
  expect(result.bpm).toBeCloseTo(128, 0);
  expect(after.sourceFrame).toBeGreaterThan(before.sourceFrame);
  expect(after.frameDiscontinuities - before.frameDiscontinuities).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('accepted intelligence proposals can drive proven SYNC on generated tracks', async ({ page }) => {
  await openIntelligence(page);
  await page.evaluate(() => window.__libertasSyncTest.loadClickPair(20, 120, 128));

  const [analysisA, analysisB] = await Promise.all([
    page.evaluate(() => window.__libertasIntelligenceTest.analyzeGenerated('A', 120, 20, 0)),
    page.evaluate(() => window.__libertasIntelligenceTest.analyzeGenerated('B', 128, 20, 0)),
  ]);
  expect(analysisA.bpm).toBeCloseTo(120, 0);
  expect(analysisB.bpm).toBeCloseTo(128, 0);

  await page.evaluate(() => {
    window.__libertasIntelligenceTest.applyLatest('A');
    window.__libertasIntelligenceTest.applyLatest('B');
  });
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.evaluate(() => window.__libertasSyncTest.enable('A'));
  await page.waitForTimeout(3500);

  const sync = await page.evaluate(() => window.__libertasSyncTest.status());
  expect(sync.followerDeck?.syncTracking).toBe(true);
  expect(Math.abs(sync.followerDeck?.syncPhaseErrorBeats ?? 1)).toBeLessThan(0.05);
  expect(sync.followerDeck?.transportSeekCount).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

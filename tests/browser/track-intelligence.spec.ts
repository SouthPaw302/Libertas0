import { expect, test, type Page } from '@playwright/test';

async function openIntelligence(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__libertasIntelligenceTest));
}

test('Track Intelligence runs in a worker and recovers BPM + beat anchor from an unknown click track', async ({ page }) => {
  await openIntelligence(page);
  expect(await page.evaluate(() => window.__libertasIntelligenceTest.workerAvailable())).toBe(true);

  const result = await page.evaluate(() =>
    window.__libertasIntelligenceTest.analyzeClick({
      durationSeconds: 24,
      bpm: 128,
      sampleRate: 48_000,
      firstBeatOffsetSeconds: 0.37,
    }),
  );

  expect(result.execution).toBe('web-worker');
  expect(result.provider).toBe('libertas.onset-autocorrelation.v1');
  expect(result.bpm).toBeCloseTo(128, 0);
  expect(result.tempoConfidence).toBeGreaterThan(0.35);
  expect(result.firstBeatFrame / result.sampleRate).toBeCloseTo(0.37, 1);
  expect(result.phaseConfidence).toBeGreaterThan(0.45);
  expect(result.gridConfidence).toBeGreaterThan(0.45);
  expect(result.recommended).toBe(true);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('analysis does not mutate the manual grid until explicitly applied', async ({ page }) => {
  await openIntelligence(page);
  const before = await page.evaluate(() => window.__libertasIntelligenceTest.grid('A'));
  const result = await page.evaluate(() =>
    window.__libertasIntelligenceTest.analyzeClick({
      durationSeconds: 20,
      bpm: 150,
      firstBeatOffsetSeconds: 0.25,
    }),
  );
  const afterAnalysis = await page.evaluate(() => window.__libertasIntelligenceTest.grid('A'));

  expect(afterAnalysis).toEqual(before);

  const applied = await page.evaluate((analysis) =>
    window.__libertasIntelligenceTest.apply('A', analysis),
  result);
  expect(applied.bpm).toBeCloseTo(150, 0);
  expect(applied.firstBeatFrame / result.sampleRate).toBeCloseTo(0.25, 1);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('analyzed grid proposals can drive the proven SYNC engine without manual BPM entry', async ({ page }) => {
  await openIntelligence(page);

  const [analysisA, analysisB] = await Promise.all([
    page.evaluate(() =>
      window.__libertasIntelligenceTest.analyzeClick({
        durationSeconds: 20,
        bpm: 120,
        firstBeatOffsetSeconds: 0.25,
      }),
    ),
    page.evaluate(() =>
      window.__libertasIntelligenceTest.analyzeClick({
        durationSeconds: 20,
        bpm: 128,
        firstBeatOffsetSeconds: 0.41,
      }),
    ),
  ]);

  await page.evaluate(({ a, b }) => {
    window.__libertasIntelligenceTest.apply('A', a);
    window.__libertasIntelligenceTest.apply('B', b);
  }, { a: analysisA, b: analysisB });

  await page.evaluate(() =>
    Promise.all([
      window.__libertasIntelligenceTest.loadClick('A', {
        durationSeconds: 20,
        bpm: 120,
        firstBeatOffsetSeconds: 0.25,
      }),
      window.__libertasIntelligenceTest.loadClick('B', {
        durationSeconds: 20,
        bpm: 128,
        firstBeatOffsetSeconds: 0.41,
      }),
    ]),
  );

  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.evaluate(() => window.__libertasSyncTest.enable('A'));
  await page.waitForTimeout(4_000);

  const sync = await page.evaluate(() => window.__libertasSyncTest.status());
  expect(sync.followerDeck?.syncTracking).toBe(true);
  expect(sync.followerDeck?.syncLocked).toBe(true);
  expect(Math.abs(sync.followerDeck?.syncPhaseErrorBeats ?? 1)).toBeLessThan(0.02);
  expect(sync.followerDeck?.transportSeekCount).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

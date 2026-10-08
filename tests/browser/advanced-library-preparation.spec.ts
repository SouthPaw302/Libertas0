import { expect, test, type Page } from '@playwright/test';

async function openLibrary(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasLibraryTest &&
    window.__libertasMusicalClockTest &&
    window.__libertasPerformanceATest &&
    window.__libertasDeckATest,
  ));
}

test('advanced library searches metadata and crate membership', async ({ page }) => {
  await openLibrary(page);
  await page.evaluate(() => window.__libertasLibraryTest.clear());

  const a = await page.evaluate(() => window.__libertasLibraryTest.importGenerated('tribal.wav', 6, 440));
  const b = await page.evaluate(() => window.__libertasLibraryTest.importGenerated('warmup.wav', 6, 550));

  await page.evaluate(({ id }) => window.__libertasLibraryTest.prepare(id, {
    rating: 5,
    tags: ['tribal', 'peak'],
    metadata: {
      title: 'Midnight Tribal',
      artist: 'Mountain Noir',
      album: 'Test Set',
      genre: 'House',
      key: '8A',
      comment: 'late set',
    },
    grid: { bpm: 126, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 },
  }), { id: a.id });

  const crate = await page.evaluate(() => window.__libertasLibraryTest.createCrate('Peak Time'));
  await page.evaluate(({ crateId, trackId }) => window.__libertasLibraryTest.addToCrate(crateId, trackId), {
    crateId: crate.id,
    trackId: a.id,
  });

  const crateAfter = (await page.evaluate(() => window.__libertasLibraryTest.listCrates()))[0]!;
  expect(crateAfter.trackIds).toEqual([a.id]);

  const search = await page.evaluate(({ ids }) => window.__libertasLibraryTest.search({
    text: 'mountain',
    crateTrackIds: ids,
    minimumRating: 4,
    tags: ['tribal'],
    preparedOnly: true,
    bpmMin: 124,
    bpmMax: 128,
  }), { ids: crateAfter.trackIds });
  expect(search.map((track) => track.id)).toEqual([a.id]);

  const all = await page.evaluate(() => window.__libertasLibraryTest.list());
  expect(all.map((track) => track.id).sort()).toEqual([a.id, b.id].sort());
});

test('prepared track load restores grid cue hotcue and loop', async ({ page }) => {
  await openLibrary(page);
  await page.evaluate(() => window.__libertasLibraryTest.clear());
  const track = await page.evaluate(() => window.__libertasLibraryTest.importGenerated('prepared.wav', 12, 440));

  await page.evaluate(({ id }) => window.__libertasLibraryTest.prepare(id, {
    grid: { bpm: 124, firstBeatFrame: 1200, beatsPerBar: 4, beatUnit: 4 },
    cueFrame: 48_000,
    hotCues: [96_000, null, 144_000],
    loop: { startFrame: 192_000, endFrame: 288_000, enabled: false },
    rating: 4,
    tags: ['prepared'],
  }), { id: track.id });

  const loaded = await page.evaluate(({ id }) => window.__libertasLibraryTest.load(id, 'A'), { id: track.id });
  expect(loaded.loaded).toBe(true);
  expect(loaded.cueFrame).toBe(48_000);
  expect(loaded.hotCues[0]).toBe(96_000);
  expect(loaded.hotCues[2]).toBe(144_000);
  expect(loaded.loopStartFrame).toBe(192_000);
  expect(loaded.loopEndFrame).toBe(288_000);
  expect(loaded.loopEnabled).toBe(false);

  const grid = await page.evaluate(() => window.__libertasIntelligenceTest.grid('A'));
  expect(grid.bpm).toBe(124);
  expect(grid.firstBeatFrame).toBe(1200);
});

test('capture from deck persists current preparation explicitly', async ({ page }) => {
  await openLibrary(page);
  await page.evaluate(() => window.__libertasLibraryTest.clear());
  const track = await page.evaluate(() => window.__libertasLibraryTest.importGenerated('capture.wav', 12, 440));
  await page.evaluate(({ id }) => window.__libertasLibraryTest.load(id, 'A'), { id: track.id });

  await page.evaluate(() => {
    window.__libertasMusicalClockTest.setGrid('A', {
      bpm: 128,
      firstBeatFrame: 2400,
      beatsPerBar: 4,
      beatUnit: 4,
    });
  });
  await page.evaluate(() => window.__libertasPerformanceATest.setCueFrame(48_000));
  await page.evaluate(() => window.__libertasPerformanceATest.setHotCue(1, 72_000));
  await page.evaluate(() => window.__libertasPerformanceATest.setLoopFrames(96_000, 192_000));

  const saved = await page.evaluate(({ id }) => window.__libertasLibraryTest.capture(id, 'A'), { id: track.id });
  expect(saved.preparation?.grid?.bpm).toBe(128);
  expect(saved.preparation?.cueFrame).toBe(48_000);
  expect(saved.preparation?.hotCues?.[0]).toBe(72_000);
  expect(saved.preparation?.loop?.startFrame).toBe(96_000);
  expect(saved.preparation?.loop?.endFrame).toBe(192_000);
});

test('removing a track also removes stale crate membership', async ({ page }) => {
  await openLibrary(page);
  await page.evaluate(() => window.__libertasLibraryTest.clear());
  const track = await page.evaluate(() => window.__libertasLibraryTest.importGenerated('crate.wav', 4, 440));
  const crate = await page.evaluate(() => window.__libertasLibraryTest.createCrate('Cleanup'));
  await page.evaluate(({ crateId, trackId }) => window.__libertasLibraryTest.addToCrate(crateId, trackId), {
    crateId: crate.id,
    trackId: track.id,
  });

  await page.evaluate(async ({ id }) => {
    const tracks = await window.__libertasLibraryTest.list();
    if (!tracks.some((track) => track.id === id)) throw new Error('test track missing');
  }, { id: track.id });

  await page.evaluate(({ id }) => window.__libertasLibraryTest.remove(id), { id: track.id });

  const remaining = await page.evaluate(() => window.__libertasLibraryTest.list());
  expect(remaining).toHaveLength(0);
  const crates = await page.evaluate(() => window.__libertasLibraryTest.listCrates());
  expect(crates[0]?.trackIds).toEqual([]);
});

test('library preparation controls are present', async ({ page }) => {
  await openLibrary(page);
  await expect(page.locator('#library-search')).toBeVisible();
  await expect(page.locator('#library-crate-filter')).toBeVisible();
  await expect(page.locator('#library-capture-a')).toBeVisible();
  await expect(page.locator('#library-capture-b')).toBeVisible();
  await expect(page.locator('#library-rating')).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';

async function openDistributed(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasDistributedTest &&
    window.__libertasDualDeckTest,
  ));
}

test('repeated WebRTC control sessions do not disturb continuous local audio', async ({ page }) => {
  await openDistributed(page);
  const available = await page.evaluate(() => window.__libertasDistributedTest.rtcAvailable());
  test.skip(!available, 'RTCPeerConnection unavailable in this Chromium runtime');

  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(20, 330, 550, 0.15));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());

  const results = [];
  for (let index = 0; index < 4; index += 1) {
    results.push(await page.evaluate(() => window.__libertasDistributedTest.runControlStress()));
  }

  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(after.a.outputCurrentFrame).toBeGreaterThan(before.a.outputCurrentFrame);
  expect(after.b.outputCurrentFrame).toBeGreaterThan(before.b.outputCurrentFrame);
  expect(after.mixer.outputCurrentFrame).toBeGreaterThan(before.mixer.outputCurrentFrame);
  expect(after.a.frameDiscontinuities - before.a.frameDiscontinuities).toBe(0);
  expect(after.b.frameDiscontinuities - before.b.frameDiscontinuities).toBe(0);
  expect(after.mixer.frameDiscontinuities - before.mixer.frameDiscontinuities).toBe(0);

  for (const result of results) {
    expect(result.ordered).toBe(true);
    expect(result.aDiscontinuityDelta).toBe(0);
    expect(result.bDiscontinuityDelta).toBe(0);
    expect(result.mixerDiscontinuityDelta).toBe(0);
    expect(result.hostRejectedMessages).toBe(0);
    expect(result.remoteRejectedMessages).toBe(0);
  }

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

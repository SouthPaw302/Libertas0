import { expect, test, type Page } from '@playwright/test';

async function openDistributed(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasDistributedTest &&
    window.__libertasDualDeckTest &&
    window.__libertasMixerTest,
  ));
}

test('WebRTC distributed control cannot become the realtime audio clock', async ({ page }) => {
  await openDistributed(page);
  const available = await page.evaluate(() => window.__libertasDistributedTest.rtcAvailable());
  test.skip(!available, 'RTCPeerConnection unavailable in this Chromium runtime');

  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(8, 330, 550, 0.18));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(100);

  const result = await page.evaluate(() => window.__libertasDistributedTest.runControlStress());

  expect(result.ordered).toBe(true);
  expect(result.peerNegotiated).toContain('control');
  expect(result.peerNegotiated).toContain('webrtc-datachannel');
  expect(result.aFrameDelta).toBeGreaterThan(0);
  expect(result.bFrameDelta).toBeGreaterThan(0);
  expect(result.mixerFrameDelta).toBeGreaterThan(0);
  expect(result.aDiscontinuityDelta).toBe(0);
  expect(result.bDiscontinuityDelta).toBe(0);
  expect(result.mixerDiscontinuityDelta).toBe(0);
  expect(result.crossfaderGainA).toBeLessThan(0.05);
  expect(result.crossfaderGainB).toBeGreaterThan(0.95);
  expect(result.hostRejectedMessages).toBe(0);
  expect(result.remoteRejectedMessages).toBe(0);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('WebRTC remote worker returns analysis artifact references without local realtime authority', async ({ page }) => {
  await openDistributed(page);
  const available = await page.evaluate(() => window.__libertasDistributedTest.rtcAvailable());
  test.skip(!available, 'RTCPeerConnection unavailable in this Chromium runtime');

  const result = await page.evaluate(() => window.__libertasDistributedTest.runAnalysisRoundTrip());
  expect(result.ok).toBe(true);
  expect(result.kind).toBe('analysis');
  expect(result.outputRefs).toEqual(['analysis:sha256:browser-fixture']);
  expect(result.metrics.provider).toBe('browser-remote-worker');
  expect(result.metrics.deterministic).toBe(true);
});

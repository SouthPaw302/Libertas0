import { expect, test, type Page } from '@playwright/test';

async function openKernel(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__libertasKernelTest));
}

test('AudioWorklet clock advances while the browser main thread is blocked', async ({ page }) => {
  await openKernel(page);

  const capabilities = await page.evaluate(() => window.__libertasKernelTest.capabilities());
  expect(capabilities.audioContext).toBe(true);
  expect(capabilities.audioWorklet).toBe(true);
  expect(capabilities.crossOriginIsolated).toBe(true);
  expect(capabilities.sharedArrayBuffer).toBe(true);

  await page.evaluate(() => window.__libertasKernelTest.start());

  const before = await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return window.__libertasKernelTest.status();
  });

  expect(before.contextState).toBe('running');
  expect(before.renderQuantum).toBeGreaterThan(0);
  expect(before.processCalls).toBeGreaterThan(0);

  await page.evaluate(() => window.__libertasKernelTest.blockMainThread(600));

  const after = await page.evaluate(() => window.__libertasKernelTest.status());
  const advancedFrames = after.currentFrame - before.currentFrame;
  const newDiscontinuities = after.frameDiscontinuities - before.frameDiscontinuities;

  console.log('audio-kernel-before', before);
  console.log('audio-kernel-after', after);
  console.log('audio-kernel-stall-delta', { advancedFrames, newDiscontinuities });

  expect(after.contextState).toBe('running');
  expect(after.currentFrame).toBeGreaterThan(before.currentFrame);
  expect(advancedFrames).toBeGreaterThan(after.sampleRate * 0.25);
  expect(newDiscontinuities).toBe(0);
  expect(after.renderQuantum).toBeGreaterThan(0);

  const stopped = await page.evaluate(() => window.__libertasKernelTest.stop());
  expect(stopped.signalRunning).toBe(false);

  await page.evaluate(() => window.__libertasKernelTest.close());
});

test('kernel reports actual runtime quantum instead of assuming 128 frames', async ({ page }) => {
  await openKernel(page);
  await page.evaluate(() => window.__libertasKernelTest.start());
  const status = await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return window.__libertasKernelTest.status();
  });

  expect(status.renderQuantum).toBeGreaterThan(0);
  expect(Number.isInteger(status.renderQuantum)).toBe(true);
  expect(status.sampleRate).toBeGreaterThan(0);

  await page.evaluate(() => window.__libertasKernelTest.close());
});

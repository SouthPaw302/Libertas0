import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__libertasAutoMixTest && window.__libertasSyncTest));
}

async function lockedPair(page: Page): Promise<void> {
  await page.evaluate(() => window.__libertasSyncTest.loadClickPair(80, 120, 120));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.evaluate(() => window.__libertasSyncTest.enable('A'));
  await expect.poll(() => page.evaluate(async () => {
    const status = await window.__libertasSyncTest.status();
    return Boolean(status.followerDeck?.syncTracking && status.followerDeck.syncLocked);
  }), { timeout: 10000 }).toBe(true);
  await page.evaluate(() => window.__libertasMixerTest.setCrossfader(-1));
  await expect.poll(() => page.evaluate(async () => (await window.__libertasMixerTest.status()).crossfader),
    { timeout: 5000 }).toBeLessThan(-0.92);
}

test('AutoMix plans, schedules and completes an AudioContext fade with no new seeks', async ({ page }) => {
  await ready(page);
  await lockedPair(page);
  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());
  const decision = await page.evaluate(() => window.__libertasAutoMixTest.plan('A', 1, 1));
  expect(decision.ok).toBe(true);
  if (!decision.ok) return;
  expect(decision.plan.crossfader[0]?.value).toBe(-1);
  const armed = await page.evaluate(() => window.__libertasAutoMixTest.arm());
  expect(armed.state).toBe('ARMED');
  expect(armed.endContextTime).toBeGreaterThan(armed.startContextTime!);
  await page.evaluate(() => window.__libertasDualDeckTest.blockMainThread(600));
  await expect.poll(() => page.evaluate(() => window.__libertasAutoMixTest.status().state), {
    timeout: 15000, intervals: [500],
  }).toBe('COMPLETED');
  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(after.a.transportSeekCount).toBe(before.a.transportSeekCount);
  expect(after.b.transportSeekCount).toBe(before.b.transportSeekCount);
  expect(after.a.frameDiscontinuities).toBe(before.a.frameDiscontinuities);
  expect(after.b.frameDiscontinuities).toBe(before.b.frameDiscontinuities);
  expect(after.mixer.frameDiscontinuities).toBe(before.mixer.frameDiscontinuities);
  expect(after.mixer.crossfaderGainB).toBeGreaterThan(0.95);
});

test('Manual crossfader input aborts an armed transition', async ({ page }) => {
  await ready(page);
  await lockedPair(page);
  const decision = await page.evaluate(() => window.__libertasAutoMixTest.plan('A', 1, 1));
  expect(decision.ok).toBe(true);
  const armed = await page.evaluate(() => window.__libertasAutoMixTest.arm());
  expect(armed.state).toBe('ARMED');
  await page.locator('#mixer-crossfader').evaluate((element) => {
    const slider = element as HTMLInputElement;
    slider.value = '-0.2';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.__libertasAutoMixTest.status().state)).toBe('ABORTED');
  expect(await page.evaluate(() => window.__libertasAutoMixTest.status().reason)).toBe('MANUAL_OVERRIDE');
});

test('AutoMix rejects stale plans and exposes real controls', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#automix-plan')).toBeVisible();
  await expect(page.locator('#automix-arm')).toBeVisible();
  await expect(page.locator('#automix-cancel')).toBeVisible();
  await page.locator('#automix-plan').click();
  await expect(page.locator('#automix-status')).toContainText('DECK_NOT_READY');
  await page.evaluate(() => window.__libertasSyncTest.loadClickPair(80, 120, 120));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  const decision = await page.evaluate(() => window.__libertasAutoMixTest.plan('A', 1, 1));
  expect(decision.ok).toBe(true);
  await page.evaluate(() => window.__libertasSyncTest.loadClickPair(80, 120, 120));
  expect(await page.evaluate(() => window.__libertasAutoMixTest.status().reason)).toBe('TRACK_REPLACED');
});

test('Manual control cancels a planned but unarmed mix', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.__libertasSyncTest.loadClickPair(80, 120, 120));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  const decision = await page.evaluate(() => window.__libertasAutoMixTest.plan('A', 1, 1));
  expect(decision.ok).toBe(true);
  const override = await page.evaluate(() => window.__libertasAutoMixTest.override(0.3));
  expect(override.state).toBe('ABORTED');
  expect(override.reason).toBe('MANUAL_OVERRIDE');
  await expect(page.evaluate(() => window.__libertasAutoMixTest.arm())).rejects.toThrow('AUTOMIX_NO_PLAN');
});

test('Arming refuses an unstaged crossfader and manual pause cancels automation', async ({ page }) => {
  await ready(page);
  await lockedPair(page);
  const left = await page.evaluate(() => window.__libertasAutoMixTest.plan('A', 1, 1));
  expect(left.ok).toBe(true);
  await page.evaluate(() => window.__libertasMixerTest.setCrossfader(0));
  await expect.poll(() => page.evaluate(async () => (await window.__libertasMixerTest.status()).crossfader),
    { timeout: 5000 }).toBeGreaterThan(-0.1);
  const refused = await page.evaluate(() => window.__libertasAutoMixTest.arm());
  expect(refused.state).toBe('REFUSED');
  expect(refused.reason).toBe('CROSSFADER_NOT_STAGED');

  await page.evaluate(() => window.__libertasMixerTest.setCrossfader(-1));
  await expect.poll(() => page.evaluate(async () => (await window.__libertasMixerTest.status()).crossfader),
    { timeout: 5000 }).toBeLessThan(-0.92);
  const plan = await page.evaluate(() => window.__libertasAutoMixTest.plan('A', 1, 1));
  expect(plan.ok).toBe(true);
  const armed = await page.evaluate(() => window.__libertasAutoMixTest.arm());
  expect(armed.state).toBe('ARMED');
  await page.locator('#deck-a-pause').click();
  const stopped = await page.evaluate(() => window.__libertasAutoMixTest.status());
  expect(stopped.state).toBe('ABORTED');
  expect(stopped.reason).toBe('MANUAL_PERFORMANCE');
});

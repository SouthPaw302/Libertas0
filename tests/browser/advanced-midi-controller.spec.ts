import { expect, test, type Page } from '@playwright/test';

async function openMidi(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(
    window.__libertasMidiTest &&
    window.__libertasMixerTest &&
    window.__libertasFxTest &&
    window.__libertasSamplerTest,
  ));
}

test.beforeEach(async ({ page }) => {
  await openMidi(page);
  await page.evaluate(() => {
    window.localStorage.removeItem('libertas0-midi-profiles-v1');
    window.__libertasMidiTest.clearBindings();
    window.__libertasMidiTest.replaceFeedback([]);
  });
});

test('device-specific bindings isolate identical controls from two controllers', async ({ page }) => {
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(5, 330, 550, 0.12));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(80);

  await page.evaluate(() => {
    window.__libertasMidiTest.addBinding({
      id: 'controller-a-xf',
      kind: 'cc',
      channel: 1,
      number: 10,
      target: 'mixer.crossfader',
      mode: 'absolute',
      min: -1,
      max: 1,
      inputId: 'controller-a',
    });
    window.__libertasMidiTest.addBinding({
      id: 'controller-b-fx',
      kind: 'cc',
      channel: 1,
      number: 10,
      target: 'fx.A.wet',
      mode: 'absolute',
      min: 0,
      max: 1,
      inputId: 'controller-b',
    });
  });

  await page.evaluate(() => window.__libertasMidiTest.dispatch([0xb0, 10, 127], 'controller-a'));
  await page.waitForTimeout(80);
  const mixer = await page.evaluate(() => window.__libertasMixerTest.status());
  expect(mixer.crossfaderGainA).toBeLessThan(0.03);
  expect(mixer.crossfaderGainB).toBeCloseTo(1, 2);
  expect((await page.evaluate(() => window.__libertasFxTest.status('A'))).wet).toBe(0);

  await page.evaluate(() => window.__libertasMidiTest.dispatch([0xb0, 10, 127], 'controller-b'));
  expect((await page.evaluate(() => window.__libertasFxTest.status('A'))).wet).toBeCloseTo(1, 6);

  await page.evaluate(() => window.__libertasDualDeckTest.close());
});

test('controller profile persists mappings and restores them after activation', async ({ page }) => {
  const profile = await page.evaluate(() => {
    window.__libertasMidiTest.addBinding({
      id: 'master-cc',
      kind: 'cc',
      channel: 1,
      number: 7,
      target: 'mixer.master',
      mode: 'absolute',
      min: 0,
      max: 1,
    });
    window.__libertasMidiTest.replaceFeedback([{
      id: 'master-ring',
      target: 'mixer.master',
      kind: 'cc',
      channel: 1,
      number: 7,
      mode: 'scaled',
      min: 0,
      max: 1,
    }]);
    return window.__libertasMidiTest.saveProfile('Main Controller');
  });

  await page.evaluate(() => {
    window.__libertasMidiTest.clearBindings();
    window.__libertasMidiTest.replaceFeedback([]);
  });
  expect((await page.evaluate(() => window.__libertasMidiTest.status())).bindings).toHaveLength(0);

  await page.evaluate((id) => window.__libertasMidiTest.activateProfile(id), profile.id);
  const restored = await page.evaluate(() => ({
    active: window.__libertasMidiTest.activeProfile(),
    status: window.__libertasMidiTest.status(),
    feedback: window.__libertasMidiTest.feedbackBindings(),
  }));
  expect(restored.active?.name).toBe('Main Controller');
  expect(restored.status.bindings).toHaveLength(1);
  expect(restored.feedback).toHaveLength(1);
});

test('richer MIDI targets drive FX and sampler without moving deck timing authority', async ({ page }) => {
  await page.evaluate(() => window.__libertasSamplerTest.clear());
  await page.evaluate(() => window.__libertasSamplerTest.loadGenerated(1, 1, 880, {
    mode: 'one-shot',
    gain: 0.8,
    quantizeBeats: 0,
    sourceDeck: 'A',
  }));
  await page.evaluate(() => window.__libertasDualDeckTest.loadGenerated(8, 330, 550, 0.12));
  await page.evaluate(() => window.__libertasDualDeckTest.playBoth());
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.__libertasDualDeckTest.status());

  await page.evaluate(() => {
    window.__libertasMidiTest.addBinding({
      id: 'fx-wet',
      kind: 'cc',
      channel: 1,
      number: 20,
      target: 'fx.master.wet',
      mode: 'absolute',
      min: 0,
      max: 1,
    });
    window.__libertasMidiTest.addBinding({
      id: 'pad-1',
      kind: 'note',
      channel: 1,
      number: 36,
      target: 'sampler.pad1.trigger',
      mode: 'trigger',
    });
    window.__libertasMidiTest.dispatch([0xb0, 20, 96]);
    window.__libertasMidiTest.dispatch([0x90, 36, 127]);
  });

  await page.waitForTimeout(180);
  expect((await page.evaluate(() => window.__libertasFxTest.status('master'))).wet).toBeGreaterThan(0.7);
  expect((await page.evaluate(() => window.__libertasSamplerTest.status())).pads[0]?.triggerCount).toBe(1);

  const after = await page.evaluate(() => window.__libertasDualDeckTest.status());
  expect(after.a.transportSeekCount).toBe(before.a.transportSeekCount);
  expect(after.b.transportSeekCount).toBe(before.b.transportSeekCount);
  expect(after.a.frameDiscontinuities).toBe(before.a.frameDiscontinuities);
  expect(after.b.frameDiscontinuities).toBe(before.b.frameDiscontinuities);
});

test('LED/output feedback produces scaled and pulse MIDI messages without physical hardware', async ({ page }) => {
  await page.evaluate(() => {
    window.__libertasMidiTest.replaceFeedback([
      {
        id: 'fx-ring',
        target: 'fx.A.wet',
        kind: 'cc',
        channel: 2,
        number: 20,
        mode: 'scaled',
        min: 0,
        max: 1,
      },
      {
        id: 'pad-led',
        target: 'sampler.pad1.trigger',
        kind: 'note',
        channel: 1,
        number: 36,
        mode: 'pulse',
      },
    ]);
  });

  const scaled = await page.evaluate(() => window.__libertasMidiTest.publishFeedback('fx.A.wet', 0.5));
  const pulse = await page.evaluate(() => window.__libertasMidiTest.pulseFeedback('sampler.pad1.trigger'));
  expect(scaled[0]?.data).toEqual([0xb1, 20, 64]);
  expect(pulse[0]?.data).toEqual([0x90, 36, 127]);
  expect(pulse[1]?.data).toEqual([0x90, 36, 0]);
  expect((await page.evaluate(() => window.__libertasMidiTest.feedbackLog())).length).toBeGreaterThanOrEqual(3);
});

test('advanced MIDI profile controls are visible in the operator console', async ({ page }) => {
  await expect(page.locator('#midi-target-select')).toBeVisible();
  await expect(page.locator('#midi-input-select')).toBeVisible();
  await expect(page.locator('#midi-profile-select')).toBeVisible();
  await expect(page.locator('#midi-output-select')).toBeVisible();
  await expect(page.locator('#midi-feedback-add')).toBeVisible();
});

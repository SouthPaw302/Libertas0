import { describe, expect, it } from 'vitest';
import { validateAutomationPoints } from './AutomationTypes';

describe('Automation validation', () => {
  it('accepts ordered in-range points', () => {
    expect(validateAutomationPoints([
      { offsetSeconds: 0, value: -1 },
      { offsetSeconds: 0.5, value: 0 },
      { offsetSeconds: 1, value: 1 },
    ], -1, 1)).toHaveLength(3);
  });

  it('rejects duplicate/backward times and out-of-range values', () => {
    expect(() => validateAutomationPoints([
      { offsetSeconds: 0.5, value: 0 },
      { offsetSeconds: 0.5, value: 1 },
    ], -1, 1)).toThrow();
    expect(() => validateAutomationPoints([
      { offsetSeconds: 0, value: 2 },
    ], -1, 1)).toThrow();
  });
});

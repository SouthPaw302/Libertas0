export interface AutomationPoint {
  offsetSeconds: number;
  value: number;
}

export interface AutomationLane {
  target: string;
  points: AutomationPoint[];
}

export interface ScheduledAutomation {
  target: string;
  startContextTime: number;
  endContextTime: number;
  eventCount: number;
}

export function validateAutomationPoints(
  points: AutomationPoint[],
  min: number,
  max: number,
): AutomationPoint[] {
  if (points.length === 0) throw new RangeError('automation lane requires at least one point');
  let previous = -1;
  return points.map((point) => {
    if (!Number.isFinite(point.offsetSeconds) || point.offsetSeconds < 0 || point.offsetSeconds <= previous) {
      throw new RangeError('automation offsets must be finite, non-negative and strictly increasing');
    }
    if (!Number.isFinite(point.value) || point.value < min || point.value > max) {
      throw new RangeError(`automation value must be between ${min} and ${max}`);
    }
    previous = point.offsetSeconds;
    return { ...point };
  });
}

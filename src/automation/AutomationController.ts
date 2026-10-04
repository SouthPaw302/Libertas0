import type {
  AutomationLane,
  AutomationPoint,
  ScheduledAutomation,
} from './AutomationTypes';
import { validateAutomationPoints } from './AutomationTypes';

export interface AutomationTargetAdapter {
  min: number;
  max: number;
  schedule(points: AutomationPoint[], startContextTime: number): void;
  cancel(fromContextTime: number): void;
}

export class AutomationController {
  private readonly targets = new Map<string, AutomationTargetAdapter>();

  constructor(private readonly context: AudioContext) {}

  register(target: string, adapter: AutomationTargetAdapter): void {
    if (!target) throw new Error('automation target id is required');
    this.targets.set(target, adapter);
  }

  schedule(lane: AutomationLane, leadSeconds = 0.05): ScheduledAutomation {
    const adapter = this.targets.get(lane.target);
    if (!adapter) throw new Error(`Unknown automation target: ${lane.target}`);
    if (!Number.isFinite(leadSeconds) || leadSeconds < 0) {
      throw new RangeError('automation leadSeconds must be non-negative');
    }

    const points = validateAutomationPoints(lane.points, adapter.min, adapter.max);
    const startContextTime = this.context.currentTime + leadSeconds;
    adapter.schedule(points, startContextTime);
    return {
      target: lane.target,
      startContextTime,
      endContextTime: startContextTime + points[points.length - 1]!.offsetSeconds,
      eventCount: points.length,
    };
  }

  cancel(target: string): void {
    const adapter = this.targets.get(target);
    if (!adapter) throw new Error(`Unknown automation target: ${target}`);
    adapter.cancel(this.context.currentTime);
  }

  targetsList(): string[] {
    return [...this.targets.keys()].sort();
  }
}

import type { Cell, JourneyPlan, JourneyStop } from './types.ts';

export const WALK_STEP_MS = 200;
export const ARRIVAL_PAUSE_MS = 650;
export const COMPLETION_CELEBRATION_MS = 1500;

export class CelebrationHold {
  private elapsed = 0;

  advance(milliseconds: number, visible = true): boolean {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Celebration time must move forward.');
    if (visible) this.elapsed = Math.min(COMPLETION_CELEBRATION_MS, this.elapsed + milliseconds);
    return this.elapsed >= COMPLETION_CELEBRATION_MS;
  }
}

export interface PlaybackFrame {
  position: Cell;
  facing: Cell;
  walking: boolean;
  arrivals: JourneyStop[];
  finished: boolean;
}

export class JourneyPlayer {
  private elapsed = 0;
  private emitted = 0;
  private readonly plan: JourneyPlan;
  private readonly reduced: boolean;
  private readonly arrivals: { stop: JourneyStop; at: number }[];
  readonly duration: number;

  constructor(plan: JourneyPlan, reduced = false) {
    if (!plan.solved) throw new Error('The traveler waits until the complete ordered road is ready.');
    if (!plan.path.length || !plan.stops.length) throw new Error('Journey playback needs a route and its stops.');
    if (plan.stops[0]?.pathIndex !== 0 || plan.stops.at(-1)?.pathIndex !== plan.path.length - 1 ||
        plan.stops.some((stop, index) => !Number.isInteger(stop.pathIndex) ||
          stop.pathIndex < 0 || stop.pathIndex >= plan.path.length ||
          (index > 0 && stop.pathIndex <= (plan.stops[index - 1]?.pathIndex ?? -1)))) {
      throw new Error('Journey checkpoints must follow the route in order.');
    }
    this.plan = plan;
    this.reduced = reduced;
    this.arrivals = plan.stops.slice(1).map((stop, index) => ({
      stop,
      at: stop.pathIndex * WALK_STEP_MS + index * ARRIVAL_PAUSE_MS,
    }));
    this.duration = reduced ? 0 : (this.arrivals.at(-1)?.at ?? 0) + (this.arrivals.length ? ARRIVAL_PAUSE_MS : 0);
  }

  advance(milliseconds: number): PlaybackFrame {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Playback time must move forward.');
    this.elapsed = this.reduced ? this.duration : Math.min(this.duration, this.elapsed + milliseconds);
    const arrivals: JourneyStop[] = [];
    while (this.emitted < this.arrivals.length) {
      const arrival = this.arrivals[this.emitted];
      if (!arrival || (!this.reduced && this.elapsed < arrival.at)) break;
      arrivals.push(arrival.stop);
      this.emitted++;
    }
    let position = this.plan.path[0];
    let facing: Cell = { row: 0, col: 0 };
    let walking = false;
    if (!position) throw new Error('The traveler has no starting square.');
    if (this.reduced) {
      position = this.plan.path.at(-1) ?? position;
    } else {
      let priorIndex = 0;
      let startsAt = 0;
      for (const arrival of this.arrivals) {
        if (this.elapsed >= arrival.at) {
          position = this.plan.path[arrival.stop.pathIndex] ?? position;
          priorIndex = arrival.stop.pathIndex;
          startsAt = arrival.at + ARRIVAL_PAUSE_MS;
          if (this.elapsed < startsAt) break;
          continue;
        }
        const progress = Math.max(0, (this.elapsed - startsAt) / WALK_STEP_MS);
        const index = Math.min(arrival.stop.pathIndex, priorIndex + Math.floor(progress));
        const from = this.plan.path[index];
        const to = this.plan.path[Math.min(index + 1, arrival.stop.pathIndex)];
        if (!from || !to) throw new Error('The traveler route has an invalid step.');
        const fraction = progress - Math.floor(progress);
        position = {
          row: from.row + (to.row - from.row) * fraction,
          col: from.col + (to.col - from.col) * fraction,
        };
        facing = { row: to.row - from.row, col: to.col - from.col };
        walking = progress > 0;
        break;
      }
    }
    return { position, facing, walking, arrivals, finished: this.elapsed >= this.duration };
  }
}

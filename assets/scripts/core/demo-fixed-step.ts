const STEP_SECONDS = 1 / 60;
const MAX_STEPS = 5;

/** Bounds catch-up work; the caller resets on pause, resume, and restart. */
export class FixedStepDriver {
  private accumulator = 0;
  private totalDroppedSeconds = 0;
  private droppedFrames = 0;

  get droppedSeconds(): number { return this.totalDroppedSeconds; }
  get dropCount(): number { return this.droppedFrames; }

  advance(frameDtSeconds: number, step: (dtSeconds: number) => void): { steps: number; droppedSeconds: number } {
    if (!Number.isFinite(frameDtSeconds) || frameDtSeconds < 0) {
      throw new RangeError('frame delta must be finite and non-negative');
    }
    this.accumulator += frameDtSeconds;
    let steps = 0;
    while (this.accumulator >= STEP_SECONDS && steps < MAX_STEPS) {
      this.accumulator -= STEP_SECONDS;
      steps++;
      step(STEP_SECONDS);
    }
    let droppedSeconds = 0;
    // Repeated subtraction can leave rounding dust after an exact five steps.
    if (this.accumulator < Number.EPSILON) this.accumulator = 0;
    if (steps === MAX_STEPS && this.accumulator > 0) {
      droppedSeconds = this.accumulator;
      this.accumulator = 0;
      this.totalDroppedSeconds += droppedSeconds;
      this.droppedFrames++;
    }
    return { steps, droppedSeconds };
  }

  reset(): void {
    this.accumulator = 0;
    this.totalDroppedSeconds = 0;
    this.droppedFrames = 0;
  }
}

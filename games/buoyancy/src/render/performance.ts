export function canvasPixelRatio(width: number, height: number, deviceRatio: number, lowDetail: boolean): number {
  const pixelBudget = 1_500_000;
  return Math.min(deviceRatio || 1, lowDetail ? 1 : 1.5, Math.sqrt(pixelBudget / Math.max(1, width * height)));
}

/** A brief hiccup should not change quality; sustained expensive frames should. */
export class FrameQuality {
  private expensiveFrames = 0;
  constructor(public lowDetail = false) {}

  record(milliseconds: number): boolean {
    if (this.lowDetail) return false;
    this.expensiveFrames = milliseconds > 18 ? this.expensiveFrames + 1 : Math.max(0, this.expensiveFrames - 1);
    if (this.expensiveFrames < 30) return false;
    this.lowDetail = true;
    return true;
  }
}

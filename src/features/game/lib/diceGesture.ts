/** A vertical pan belongs to the sheet; only a deliberate sideways flick rolls. */
export function classifyDiceGesture(
  dx: number,
  dy: number,
): "tap" | "roll" | "cancel" {
  if (Math.hypot(dx, dy) < 8) return "tap";
  return Math.abs(dx) >= 28 && Math.abs(dx) >= Math.abs(dy) * 1.15
    ? "roll"
    : "cancel";
}

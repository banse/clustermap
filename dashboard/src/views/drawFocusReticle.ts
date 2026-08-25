export function drawFocusReticle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  scale: number,
  color: string,
): void {
  const unit = 1 / Math.max(scale, 0.001);
  const outer = radius + 5 * unit;
  const arm = 5 * unit;

  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.5 * unit;
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(x - outer, y - outer + arm);
  context.lineTo(x - outer, y - outer);
  context.lineTo(x - outer + arm, y - outer);
  context.moveTo(x + outer - arm, y - outer);
  context.lineTo(x + outer, y - outer);
  context.lineTo(x + outer, y - outer + arm);
  context.moveTo(x + outer, y + outer - arm);
  context.lineTo(x + outer, y + outer);
  context.lineTo(x + outer - arm, y + outer);
  context.moveTo(x - outer + arm, y + outer);
  context.lineTo(x - outer, y + outer);
  context.lineTo(x - outer, y + outer - arm);
  context.stroke();
  context.font = `${7 * unit}px Fragment Mono`;
  context.textAlign = "left";
  context.textBaseline = "bottom";
  context.fillText("YOU", x + outer + 3 * unit, y - outer + unit);
  context.restore();
}

import { describe, expect, it, vi } from "vitest";

import { drawFocusReticle } from "./drawFocusReticle";

describe("drawFocusReticle", () => {
  it("labels the saved wallet as YOU", () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    drawFocusReticle(context, 100, 80, 10, 1, "#fff");

    expect(context.fillText).toHaveBeenCalledWith("YOU", expect.any(Number), expect.any(Number));
  });
});

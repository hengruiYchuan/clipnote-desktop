import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PetRenderer } from "./PetRenderer";
import type { PetDefinition, PetVisualState } from "./types";

const states: PetVisualState[] = ["idle", "paused", "captured", "dragging", "error"];
const pet: PetDefinition = {
  id: "mint-bot",
  name: "薄荷机器人",
  author: "ClipNote",
  description: "测试桌宠",
  spriteDataUrl: "data:image/webp;base64,AAAA",
  cellWidth: 128,
  cellHeight: 128,
  columns: 8,
  rows: 5,
  animations: Object.fromEntries(
    states.map((state, row) => [
      state,
      { row, frames: [0, 1, 2], frameDurationMs: 180, loop: true },
    ]),
  ) as PetDefinition["animations"],
};

describe("PetRenderer", () => {
  it("keeps the built-in SVG as the fallback", () => {
    render(<PetRenderer pet={null} state="paused" />);

    expect(screen.getByTestId("clip-pet")).toHaveAttribute("data-paused", "true");
  });

  it("renders a validated custom spritesheet state", () => {
    render(<PetRenderer pet={pet} state="captured" />);

    const sprite = screen.getByTestId("pet-sprite");
    expect(sprite).toHaveAttribute("data-pet-state", "captured");
    expect(sprite).toHaveStyle({
      backgroundImage: "url(data:image/webp;base64,AAAA)",
      backgroundSize: "800% 500%",
      backgroundPosition: "0% 50%",
    });
  });
});

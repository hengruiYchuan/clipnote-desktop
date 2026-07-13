import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("introduces the editorial workspace accessibly", () => {
    render(<App />);

    expect(
      screen.getByRole("button", { name: "打开 ClipNote 工作台" }),
    ).toBeVisible();
    expect(screen.getByText("你的工作碎片，随手归档。")).toBeVisible();
  });
});

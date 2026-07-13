import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Masthead } from "./masthead";

describe("Masthead", () => {
  it("renders the Chinese brand as the primary home link", () => {
    render(<Masthead issue="DRAFT 001" />);

    expect(screen.getByRole("link", { name: "未定稿，返回首页" })).toHaveAttribute("href", "/");
    expect(screen.getByText("DRAFT 001")).toBeVisible();
  });
});

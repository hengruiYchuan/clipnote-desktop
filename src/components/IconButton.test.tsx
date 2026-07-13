import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("exposes its action name without relying on the icon", () => {
    render(
      <IconButton label="搜索">
        <Search />
      </IconButton>,
    );

    expect(screen.getByRole("button", { name: "搜索" })).toBeVisible();
  });
});

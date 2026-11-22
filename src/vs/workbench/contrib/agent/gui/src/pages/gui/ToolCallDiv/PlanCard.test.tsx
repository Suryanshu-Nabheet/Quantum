import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanTodoList } from "./PlanCard";

describe("PlanTodoList", () => {
  it("starts completed plan todos collapsed and lets the user expand them", () => {
    render(
      <PlanTodoList
        todos={[{ id: "done", text: "Finished task", status: "done" }]}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: "Expand plan to-dos (1 of 1 complete)",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Finished task")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(
      screen.getByRole("button", {
        name: "Collapse plan to-dos (1 of 1 complete)",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Finished task")).toBeInTheDocument();
  });

  it("keeps unfinished plan todos visible", () => {
    render(
      <PlanTodoList
        todos={[
          { id: "active", text: "Current task", status: "in_progress" },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Collapse plan to-dos (0 of 1 complete)",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Current task")).toBeInTheDocument();
  });
});

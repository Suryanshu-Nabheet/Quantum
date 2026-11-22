import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskList, TodoStatusIcon } from "./task-list";

describe("TaskList", () => {
	it("shows a check-in-circle icon for completed tasks", () => {
		const { container } = render(<TodoStatusIcon status="done" />);

		expect(
			container.querySelector('.tdl-completed-icon path[d^="m7.75"]'),
		).toBeInTheDocument();
		expect(
			container.querySelector(
				'.tdl-completed-icon circle[fill="currentColor"]',
			),
		).not.toBeInTheDocument();
	});

	it("collapses completed chat todos into an expandable summary", async () => {
		render(
			<TaskList
				todos={[{ id: "done", text: "Finished task", status: "done" }]}
				scroll={false}
				collapseWhenComplete
			/>,
		);

		const expandButton = screen.getByRole("button", {
			name: "Expand to-dos (1 of 1 complete)",
		});
		expect(expandButton).toHaveAttribute("aria-expanded", "false");

		fireEvent.click(expandButton);

		await waitFor(() => {
			expect(
				screen.getByRole("button", {
					name: "Collapse to-dos (1 of 1 complete)",
				}),
			).toHaveAttribute("aria-expanded", "true");
		});
		expect(screen.getByText("Finished task")).toBeInTheDocument();
	});

	it("keeps unfinished todos expanded", () => {
		render(
			<TaskList
				todos={[{ id: "active", text: "Current task", status: "in_progress" }]}
				scroll={false}
				collapseWhenComplete
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: "Collapse to-dos (0 of 1 complete)",
			}),
		).toHaveAttribute("aria-expanded", "true");
	});
});

import { screen, waitFor } from "@testing-library/react";
import { ToolCallState } from "core";
import { renderWithProviders } from "../../util/test/render";
import { UnifiedTerminalCommand } from "./UnifiedTerminal";

const MOCK_COMMAND = "npm test";
const MOCK_OUTPUT = `Running tests...
✓ Test 1 passed
✓ Test 2 passed
✗ Test 3 failed
  Error: Expected true but got false

Test Results:
  2 passed, 1 failed
  Total: 3 tests`;

const LONG_OUTPUT = Array.from({ length: 25 }, (_, i) => `Line ${i + 1}`).join(
  "\n",
);
const MOCK_TOOL_CALL_ID = "terminal-call-123";

const MOCK_ANSI_OUTPUT = `\u001b[32m✓\u001b[0m Test passed
\u001b[31m✗\u001b[0m Test failed
\u001b[1mBold text\u001b[0m
\u001b[4mUnderlined text\u001b[0m`;

const MOCK_OUTPUT_WITH_LINKS = `Build successful!
Visit https://example.com for more info
Check www.github.com/user/repo
Error logs at file:///tmp/error.log
Available on: http://192.168.137.1:8081`;

// Mock the redux hooks
const mockDispatch = vi.fn();
const mockSelector = vi.fn();
vi.mock("../../redux/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => mockSelector,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UnifiedTerminalCommand", () => {
  test("does not describe a pending command as already run", async () => {
    const toolCallState: ToolCallState = {
      status: "generated",
      toolCallId: MOCK_TOOL_CALL_ID,
      toolCall: {
        id: MOCK_TOOL_CALL_ID,
        type: "function",
        function: { name: "run_terminal_command", arguments: "{}" },
      },
      parsedArgs: {},
    };
    await renderWithProviders(
      <UnifiedTerminalCommand command={MOCK_COMMAND} toolCallState={toolCallState} />,
    );
    expect(screen.getByRole("button", { name: "Run command · Awaiting approval" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ran command" })).not.toBeInTheDocument();
  });

  test("renders basic terminal command without output", async () => {
    const { user } = await renderWithProviders(
      <UnifiedTerminalCommand command={MOCK_COMMAND} status="completed" />,
    );

    // Should show the command
    expect(screen.getByText(MOCK_COMMAND)).toBeInTheDocument();

    // Should show terminal header
    expect(screen.getByRole("button", { name: "Ran command" })).toBeInTheDocument();

    // Should show completed status icon (green dot)
    const terminalContainer = screen.getByTestId("terminal-container");
    expect(terminalContainer).toBeInTheDocument();
  });

  test("renders terminal command with output", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_OUTPUT}
        status="completed"
      />,
    );

    // Should show the command and output
    expect(screen.getByText(MOCK_COMMAND)).toBeInTheDocument();

    // Check that the output content exists in the container
    expect(container.textContent).toMatch(/Test 1 passed/);
    expect(container.textContent).toMatch(/Test 3 failed/);
  });

  test("shows running state with blinking cursor", async () => {
    const mockToolCallState: ToolCallState = {
      status: "calling",
      toolCallId: MOCK_TOOL_CALL_ID,
      toolCall: {
        id: MOCK_TOOL_CALL_ID,
        type: "function",
        function: {
          name: "terminal",
          arguments: "{}",
        },
      },
      parsedArgs: {},
    };

    const { user } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="running"
        toolCallState={mockToolCallState}
        toolCallId={MOCK_TOOL_CALL_ID}
      />,
    );

    // Should show running status
    expect(screen.getByRole("button", { name: "Running command" })).toBeInTheDocument();
    expect(screen.getByTestId("terminal-container")).toHaveTextContent("Running");

    // Should show move to background link
    expect(screen.getByText("Move to background")).toBeInTheDocument();
  });

  test("can expand and collapse terminal", async () => {
    const { user, container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_OUTPUT}
        status="completed"
      />,
    );

    // Should initially be expanded and show output
    expect(container.textContent).toMatch(/Test 1 passed/);

    // Find and click the collapse chevron (SVG icon)
    const toggle = screen.getByRole("button", { name: "Ran command" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    {
      await user.click(toggle);

      // Keep the panel mounted so its height can animate, but hide it accessibly.
      await waitFor(() => {
        const panel = container.querySelector(".terminal-command-collapsible");
        expect(panel).toHaveClass("terminal-command-collapsed");
        expect(panel).toHaveAttribute("aria-hidden", "true");
        expect(panel).toHaveProperty("inert", true);
        expect(container.textContent).toMatch(/Test 1 passed/);
      });
    }
  });

  test("shows collapsible output for long content", async () => {
    const { user, container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={LONG_OUTPUT}
        status="completed"
        displayLines={15}
      />,
    );

    expect(screen.getByRole("button", { name: "Show 10 earlier lines" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Line 1\n/);
    expect(container.textContent).toMatch(/Line 25/);

    await user.click(screen.getByRole("button", { name: "Show 10 earlier lines" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show less output" })).toBeInTheDocument();
      expect(container.textContent).toMatch(/Line 1\n/);
    });
  });

  test("renders ANSI colors and formatting", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_ANSI_OUTPUT}
        status="completed"
      />,
    );

    // Should render ANSI content (check the container text since ANSI splits across elements)
    expect(container.textContent).toMatch(/Test passed/);
    expect(container.textContent).toMatch(/Test failed/);
    expect(container.textContent).toMatch(/Bold text/);
    expect(container.textContent).toMatch(/Underlined text/);

    // Output uses terminal formatting rather than the chat's inline-code style.
    const output = screen.getByRole("region", { name: "Command output" });
    expect(output.querySelector("code")).not.toBeInTheDocument();
    const spans = output.querySelectorAll("span");
    expect(spans?.length).toBeGreaterThan(0);
  });

  test("handles links in output", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_OUTPUT_WITH_LINKS}
        status="completed"
      />,
    );

    // Should contain the link text in the output
    expect(container.textContent).toMatch(/https:\/\/example\.com/);
    expect(container.textContent).toMatch(/www\.github\.com/);
    expect(container.textContent).toMatch(/http:\/\/192\.168\.137\.1:8081/);

    // Verify rendered links have correct hrefs including port
    const links = container.querySelectorAll("a");
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    expect(hrefs).toContainEqual("https://example.com");
    expect(hrefs).toContainEqual(expect.stringContaining("192.168.137.1:8081"));
  });

  test("shows copy and run in terminal buttons when not running", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={MOCK_OUTPUT}
        status="completed"
      />,
    );

    // Look for toolbar elements - they may be hidden by responsive classes but exist in DOM
    const toolbarArea = container.querySelector('[class*="gap-2"]');
    expect(toolbarArea).toBeInTheDocument();

    // Should contain SVG icons for copy/run operations
    const svgIcons = container.querySelectorAll("svg");
    expect(svgIcons.length).toBeGreaterThan(0);

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run in terminal" })).toBeInTheDocument();
  });

  test("handles move to background action", async () => {
    const mockToolCallState: ToolCallState = {
      status: "calling",
      toolCallId: MOCK_TOOL_CALL_ID,
      toolCall: {
        id: MOCK_TOOL_CALL_ID,
        type: "function",
        function: {
          name: "terminal",
          arguments: "{}",
        },
      },
      parsedArgs: {},
    };

    const { user } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="running"
        toolCallState={mockToolCallState}
        toolCallId={MOCK_TOOL_CALL_ID}
      />,
    );

    // Find and click move to background link
    const moveToBackgroundLink = screen.getByText("Move to background");
    await user.click(moveToBackgroundLink);

    // Should dispatch the move to background action
    expect(mockDispatch).toHaveBeenCalled();
  });

  test("shows different status types correctly", async () => {
    // Test completed status
    const { rerender, container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="completed"
        statusMessage="Command completed successfully"
      />,
    );

    expect(container.textContent).toMatch(/Command completed successfully/);

    // Test failed status
    rerender(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="failed"
        statusMessage="Command failed with exit code 1"
      />,
    );

    expect(container.textContent).toMatch(/Command failed with exit code 1/);

    // Test background status
    rerender(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        status="background"
        statusMessage="Command moved to background"
      />,
    );

    expect(container.textContent).toMatch(/Command moved to background/);
  });

  test("handles empty output gracefully", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output=""
        status="completed"
      />,
    );

    // Should show command but no output section
    expect(screen.getByText(MOCK_COMMAND)).toBeInTheDocument();

    // Should not show any output content
    expect(screen.queryByRole("region", { name: "Command output" })).not.toBeInTheDocument();
  });

  test("processes terminal content correctly for line limiting", async () => {
    const { container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={LONG_OUTPUT}
        status="completed"
        displayLines={10}
      />,
    );

    expect(screen.getByText("Show 15 earlier lines")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Line 1\n/);
    expect(container.textContent).toMatch(/Line 25/);
  });

  test("clicking on collapsible output toggles expansion", async () => {
    const { user, container } = await renderWithProviders(
      <UnifiedTerminalCommand
        command={MOCK_COMMAND}
        output={LONG_OUTPUT}
        status="completed"
        displayLines={10}
      />,
    );

    expect(container.textContent).not.toMatch(/Line 1\n/);

    await user.click(screen.getByText("Show 15 earlier lines"));

    await waitFor(() => {
      expect(screen.getByText("Show less output")).toBeInTheDocument();
    });

    expect(screen.getByRole("region", { name: "Command output" })).toHaveClass("max-h-64", "overflow-auto");
    await user.click(screen.getByText("Show less output"));

    await waitFor(() => {
      expect(container.textContent).not.toMatch(/Line 1\n/);
    });

    // Should show collapse option after expansion
    expect(screen.getByText("Show 15 earlier lines")).toBeInTheDocument();
  });
});

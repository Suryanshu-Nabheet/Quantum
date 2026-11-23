import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HostBridgeContext, type IHostBridge } from "../../context/HostBridge";
import MermaidBlock from "./MermaidBlock";
import mermaid from "mermaid";

const panzoom = vi.hoisted(() => ({
  destroy: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  reset: vi.fn(),
  zoomWithWheel: vi.fn(),
  zoomToPoint: vi.fn(),
  pan: vi.fn(),
  getScale: vi.fn(() => 1),
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn(async (source: string) => {
      if (source === "invalid") throw new Error("Invalid diagram");
    }),
    render: vi.fn(async () => ({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><span>Rendered diagram</span><script>bad()</script></div></foreignObject></svg>',
    })),
  },
}));

vi.mock("@panzoom/panzoom", () => ({
  default: () => panzoom,
}));

describe("MermaidBlock", () => {
  it("accepts quoted labels with unbalanced punctuation", async () => {
    const { default: mermaid } =
      await vi.importActual<typeof import("mermaid")>("mermaid");
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    await expect(
      mermaid.parse('graph TD\nA["valid (label"] --> B'),
    ).resolves.toBeTruthy();
  });

  it("recovers after invalid streaming input and opens the diagram in the workbench", async () => {
    const request = vi.fn().mockResolvedValue({ status: "success" });
    const bridge = { request } as unknown as IHostBridge;
    const wrap = (code: string) => (
      <HostBridgeContext.Provider value={bridge}>
        <MermaidBlock code={code} />
      </HostBridgeContext.Provider>
    );
    const { rerender } = render(wrap("invalid"));
    expect(
      await screen.findByText(/Unable to render diagram/),
    ).toBeInTheDocument();

    rerender(wrap('graph TD\nA["valid (label"] --> B'));
    await waitFor(() =>
      expect(screen.getByText("Rendered diagram")).toBeInTheDocument(),
    );
    expect(
      screen
        .getByText("Rendered diagram")
        .closest("foreignObject")
        ?.querySelector("script"),
    ).toBeNull();
    expect(
      screen.queryByText(/Unable to render diagram/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open diagram" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("openAgentDiagram", {
        source: 'graph TD\nA["valid (label"] --> B',
      }),
    );
  });

  it("closes the workbench diagram with its button and Escape", () => {
    const post = vi.fn();
    const bridge = { post } as unknown as IHostBridge;
    render(
      <HostBridgeContext.Provider value={bridge}>
        <MermaidBlock code="graph TD; A --> B" standalone />
      </HostBridgeContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close diagram" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(post.mock.calls.filter(([name]) => name === "closeAgentDiagram")).toHaveLength(2);
    expect(post).toHaveBeenCalledWith("closeAgentDiagram", undefined);
  });

  it("zooms with pinch gestures and pans with two-finger scrolling in the viewer", async () => {
    panzoom.zoomToPoint.mockClear();
    panzoom.pan.mockClear();
    const { container } = render(
      <MermaidBlock code="graph TD; A --> B" standalone />,
    );
    await waitFor(() =>
      expect(screen.getByText("Rendered diagram")).toBeInTheDocument(),
    );
    const canvas = container.querySelector(".agent-mermaid-canvas")!;
    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -20 });
    expect(panzoom.zoomToPoint).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(WheelEvent),
      { animate: false },
    );
    fireEvent.wheel(canvas, { deltaX: 10, deltaY: 20 });
    expect(panzoom.pan).toHaveBeenCalledWith(-10, -20, {
      relative: true,
      animate: false,
    });
  });

  it("leaves ordinary sidebar scrolling alone", async () => {
    panzoom.pan.mockClear();
    const { container } = render(<MermaidBlock code="graph TD; A --> B" />);
    await waitFor(() =>
      expect(screen.getByText("Rendered diagram")).toBeInTheDocument(),
    );
    expect(
      fireEvent.wheel(container.querySelector(".agent-mermaid-canvas")!, {
        deltaY: 20,
      }),
    ).toBe(true);
    expect(panzoom.pan).not.toHaveBeenCalled();
  });

  it("copies the diagram source through the host", async () => {
    const request = vi.fn().mockResolvedValue({ status: "success" });
    const bridge = { request } as unknown as IHostBridge;
    render(
      <HostBridgeContext.Provider value={bridge}>
        <MermaidBlock code="graph TD; A --> B" />
      </HostBridgeContext.Provider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy Mermaid source" }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("copyText", {
        text: "graph TD; A --> B",
      }),
    );
  });

  it("repairs a matching node and subgraph and removes Mermaid's temporary output", async () => {
    const renderDiagram = vi.mocked(mermaid.render);
    renderDiagram.mockImplementationOnce(async (_id, _source, scratch) => {
      scratch!.innerHTML =
        '<div id="temporary-mermaid-error">Syntax error</div>';
      throw new Error("Setting TOOLS as parent of TOOLS would create a cycle");
    });
    const source =
      'flowchart TD\nsubgraph TOOLS["Tools"]\nTOOLS["Tool crate"]\nend';
    render(<MermaidBlock code={source} />);
    await waitFor(() =>
      expect(screen.getByText("Rendered diagram")).toBeInTheDocument(),
    );
    expect(renderDiagram).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.stringContaining('subgraph quantum_group_TOOLS["Tools"]'),
      expect.any(HTMLElement),
    );
    expect(document.getElementById("temporary-mermaid-error")).toBeNull();
  });

  it("removes temporary Mermaid output when rendering fails", async () => {
    vi.mocked(mermaid.render).mockImplementationOnce(
      async (_id, _source, scratch) => {
        scratch!.innerHTML =
          '<div id="temporary-mermaid-error">Syntax error</div>';
        throw new Error("Bad diagram");
      },
    );
    render(<MermaidBlock code="graph TD; A --> B" />);
    expect(
      await screen.findByText(/Unable to render diagram/),
    ).toBeInTheDocument();
    expect(document.getElementById("temporary-mermaid-error")).toBeNull();
  });
});

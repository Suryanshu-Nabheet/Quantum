import { memo, useCallback, useMemo, useState } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * Measures how many history rows re-render when one streamed chunk updates
 * the tail item of a long thread. Models the Chat.tsx row path: a history
 * array mapped to inline rows, each row wrapped in a memoized child.
 */

type Item = { id: string; text: string };

let rowRenders = 0;

const Row = memo(function Row({ item }: { item: Item }) {
  rowRenders++;
  return <div data-testid={item.id}>{item.text}</div>;
});

function makeHistory(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `m${i}`, text: `msg ${i}` }));
}

describe("history row re-renders per streamed chunk", () => {
  it("renders only the changed tail row when history items keep identity", () => {
    rowRenders = 0;
    let pushChunk: (text: string) => void = () => {};

    function Thread({ n }: { n: number }) {
      const [history, setHistory] = useState<Item[]>(() => makeHistory(n));
      pushChunk = (text: string) =>
        setHistory((prev) => {
          const next = prev.slice();
          next[next.length - 1] = { ...next[next.length - 1], text };
          return next;
        });
      return (
        <div>
          {history.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </div>
      );
    }

    const { container } = render(<Thread n={200} />);
    expect(container.querySelectorAll("[data-testid]").length).toBe(200);
    rowRenders = 0;
    act(() => pushChunk("streamed token"));
    // Only the tail row's item identity changed; the 199 untouched rows must
    // be skipped by memo. Measured, not assumed.
    expect(rowRenders).toBe(1);
  });

  it("renders every row when a fresh closure is passed per row (unmemoized path)", () => {
    rowRenders = 0;
    let pushChunk: (text: string) => void = () => {};

    const UnmemoRow = ({ item, onClick }: { item: Item; onClick: () => void }) => {
      rowRenders++;
      return <div data-testid={item.id} onClick={onClick}>{item.text}</div>;
    };

    function Thread({ n }: { n: number }) {
      const [history, setHistory] = useState<Item[]>(() => makeHistory(n));
      const latest = useMemo(() => history.length, [history]);
      pushChunk = (text: string) =>
        setHistory((prev) => {
          const next = prev.slice();
          next[next.length - 1] = { ...next[next.length - 1], text };
          return next;
        });
      const handle = useCallback(() => latest, [latest]);
      return (
        <div>
          {history.map((item) => (
            <UnmemoRow key={item.id} item={item} onClick={() => handle()} />
          ))}
        </div>
      );
    }

    render(<Thread n={200} />);
    rowRenders = 0;
    act(() => pushChunk("streamed token"));
    // Inline closures defeat the memoization of the row: every row re-renders.
    expect(rowRenders).toBe(200);
  });
});

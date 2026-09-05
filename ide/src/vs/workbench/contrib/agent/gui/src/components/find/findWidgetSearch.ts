export interface Rectangle {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SearchMatch {
  index: number;
  textNode: Text;
  overlayRectangle: Rectangle;
}

interface SearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
  offsetHeight: number;
}

export const searchWithinContainer = (
  containerRef: React.RefObject<HTMLDivElement>,
  searchQuery: string,
  options: SearchOptions,
): {
  results: SearchMatch[];
  closestToMiddle: SearchMatch | null;
} => {
  const searchContainer = containerRef.current;

  if (!searchContainer || !searchQuery) {
    return {
      results: [],
      closestToMiddle: null,
    };
  }
  const query = options.caseSensitive ? searchQuery : searchQuery.toLowerCase();
  const regexFlags = options.caseSensitive ? "g" : "gi";
  if (options.useRegex) {
    try {
      new RegExp(searchQuery, regexFlags);
    } catch {
      return { results: [], closestToMiddle: null };
    }
  }

  // First grab all text nodes
  // Skips any elements with the "find-widget-skip" class
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    searchContainer,
    NodeFilter.SHOW_ALL,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if ((node as Element).classList.contains("find-widget-skip"))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        } else if (node.nodeType === Node.TEXT_NODE) {
          if (!node.nodeValue?.length) return NodeFilter.FILTER_REJECT;
          if (options.useRegex) {
            return new RegExp(searchQuery, regexFlags).test(node.nodeValue)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          }
          const nodeValue = options.caseSensitive
            ? node.nodeValue
            : node.nodeValue.toLowerCase();
          if (nodeValue.includes(query)) return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === Node.ELEMENT_NODE) continue;
    textNodes.push(walker.currentNode as Text);
  }

  // Now walk through each node match and extract search results
  // One node can have several matches
  const newMatches: SearchMatch[] = [];
  textNodes.forEach((textNode, idx) => {
    // Hacky way to detect code blocks that be wider than client and cause absolute positioning to fail
    const highlightFullLine =
      textNode.parentElement?.className.includes("hljs");

    const rawText = textNode.nodeValue || "";
    const matchSpans: Array<{ start: number; end: number }> = [];

    if (options.useRegex) {
      const nodeRegex = new RegExp(searchQuery, regexFlags);
      let match: RegExpExecArray | null;
      while ((match = nodeRegex.exec(rawText)) !== null) {
        if (!match[0].length) {
          nodeRegex.lastIndex++;
          continue;
        }
        matchSpans.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    } else {
      let nodeTextValue = options.caseSensitive
        ? rawText
        : rawText.toLowerCase();
      let startIndex = 0;
      while ((startIndex = nodeTextValue.indexOf(query, startIndex)) !== -1) {
        matchSpans.push({
          start: startIndex,
          end: startIndex + query.length,
        });
        startIndex += query.length;
      }
    }

    for (const span of matchSpans) {
      const range = document.createRange();
      range.setStart(textNode, span.start);
      const endIndex = span.end;
      range.setEnd(textNode, endIndex);
      const rect = range.getBoundingClientRect();
      range.detach();

      const top =
        rect.top +
        searchContainer.clientTop +
        searchContainer.scrollTop -
        options.offsetHeight;

      const left =
        rect.left + searchContainer.clientLeft + searchContainer.scrollLeft;

      // Build a match result and push to matches
      const newMatch: SearchMatch = {
        index: 0, // will set later
        textNode,
        overlayRectangle: {
          top,
          left: highlightFullLine ? 2 : left,
          width: highlightFullLine
            ? searchContainer.clientWidth - 4
            : rect.width, // equivalent of adding 2 px x padding
          height: rect.height,
        },
      };
      newMatches.push(newMatch);

      if (highlightFullLine) {
        break;
      }
    }
  });

  // There will still be duplicate full lines when multiple text nodes are in the same line (e.g. Code highlights)
  // Filter them out by using the overlay rectangle as a hash key
  const matchHash = Object.fromEntries(
    newMatches.map((match) => [JSON.stringify(match.overlayRectangle), match]),
  );
  const filteredMatches = Object.values(matchHash).map((match, index) => ({
    ...match,
    index,
  }));

  // Find the match closest to the vertical middle of the container
  const verticalMiddle =
    searchContainer.scrollTop + searchContainer.clientHeight / 2;
  let closestDist = Infinity;
  let closestMatchToMiddle: SearchMatch | null = null;
  filteredMatches.forEach((match) => {
    const dist = Math.abs(verticalMiddle - match.overlayRectangle.top);
    if (dist < closestDist) {
      closestDist = dist;
      closestMatchToMiddle = match;
    }
  });

  return {
    results: filteredMatches,
    closestToMiddle: closestMatchToMiddle,
  };
};

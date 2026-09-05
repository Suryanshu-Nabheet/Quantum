import { Tool } from "../..";
import { ToolPolicy } from "terminal-security";

export const BROWSER_TOOL_GROUP = "Browser";

function browserTool(
  name: string,
  displayTitle: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  defaultToolPolicy: ToolPolicy = "allowedWithPermission",
): Tool {
  return {
    type: "function",
    displayTitle,
    wouldLikeTo: `use ${displayTitle}:`,
    isCurrently: `using ${displayTitle}:`,
    hasAlready: `used ${displayTitle}:`,
    readonly: false,
    group: BROWSER_TOOL_GROUP,
    function: {
      name,
      description,
      parameters: {
        type: "object",
        required,
        properties,
      },
    },
    defaultToolPolicy,
  };
}

const pageIdParam = {
  type: "string",
  description:
    "Browser page ID from @browser context or from open_browser_page.",
};

export const openBrowserPageTool = browserTool(
  "open_browser_page",
  "Open Browser Page",
  `Open a URL in the integrated browser, or prompt to share an existing tab.
Returns a page ID for other browser tools. Prefer reusing shared tabs when possible.`,
  {
    url: {
      type: "string",
      description:
        "Absolute URL (http:, https:, or file:). Omit to share an existing open tab.",
    },
    forceNew: {
      type: "boolean",
      description:
        "Open a new tab even if a similar host is already open. Default false.",
    },
  },
  [],
  "allowedWithPermission",
);

export const listOpenBrowserPagesTool = browserTool(
  "list_open_pages",
  "List Open Browser Pages",
  "List integrated browser tabs with pageId, title, url, and sharing state. Call this before other browser tools when pageId is unknown.",
  {},
  [],
  "allowedWithoutPermission",
);

export const closeBrowserPageTool = browserTool(
  "close_browser_page",
  "Close Browser Page",
  "Close an integrated browser tab by pageId and stop agent tracking for that page.",
  { pageId: pageIdParam },
  ["pageId"],
  "allowedWithPermission",
);

export const readBrowserPageTool = browserTool(
  "read_page",
  "Read Browser Page",
  "Get an accessibility snapshot of a shared browser page (preferred over screenshot for actions).",
  { pageId: pageIdParam },
  ["pageId"],
  "allowedWithoutPermission",
);

export const screenshotBrowserPageTool = browserTool(
  "screenshot_page",
  "Screenshot Browser Page",
  "Capture a screenshot of a shared browser page or element.",
  {
    pageId: pageIdParam,
    ref: { type: "string", description: "Element reference from read_page." },
    selector: {
      type: "string",
      description: "Playwright selector when ref is unavailable.",
    },
    element: {
      type: "string",
      description: "Human-readable element description for element screenshots.",
    },
    scrollIntoViewIfNeeded: {
      type: "boolean",
      description: "Scroll element into view before capture.",
    },
  },
  ["pageId"],
);

export const navigateBrowserPageTool = browserTool(
  "navigate_page",
  "Navigate Browser Page",
  "Navigate, go back/forward, or reload a shared browser page.",
  {
    pageId: pageIdParam,
    type: {
      type: "string",
      enum: ["url", "back", "forward", "reload"],
      description: 'Navigation type. Default "url" (requires url param).',
    },
    url: { type: "string", description: "Target URL when type is url." },
  },
  ["pageId"],
);

export const clickBrowserElementTool = browserTool(
  "click_element",
  "Click Browser Element",
  "Click an element on a shared browser page.",
  {
    pageId: pageIdParam,
    ref: { type: "string", description: "Element reference from read_page." },
    selector: {
      type: "string",
      description: "Playwright selector when ref is unavailable.",
    },
    element: {
      type: "string",
      description: "Human-readable element description.",
    },
    dblClick: { type: "boolean", description: "Double click if true." },
    button: {
      type: "string",
      enum: ["left", "right", "middle"],
      description: 'Mouse button. Default "left".',
    },
  },
  ["pageId", "element"],
);

export const typeInBrowserPageTool = browserTool(
  "type_in_page",
  "Type in Browser Page",
  "Type text or press keys in a shared browser page.",
  {
    pageId: pageIdParam,
    ref: { type: "string", description: "Element reference to type into." },
    selector: { type: "string", description: "Playwright selector." },
    element: { type: "string", description: "Human-readable target element." },
    text: { type: "string", description: "Text to type." },
    submit: {
      type: "boolean",
      description: "Press Enter after typing.",
    },
    slowly: {
      type: "boolean",
      description: "Type one character at a time.",
    },
  },
  ["pageId", "text"],
);

export const hoverBrowserElementTool = browserTool(
  "hover_element",
  "Hover Browser Element",
  "Hover over an element on a shared browser page.",
  {
    pageId: pageIdParam,
    ref: { type: "string", description: "Element reference." },
    selector: { type: "string", description: "Playwright selector." },
    element: { type: "string", description: "Human-readable element." },
  },
  ["pageId", "element"],
);

export const dragBrowserElementTool = browserTool(
  "drag_element",
  "Drag Browser Element",
  "Drag from one element to another on a shared browser page.",
  {
    pageId: pageIdParam,
    startRef: { type: "string", description: "Start element reference." },
    startSelector: { type: "string", description: "Start Playwright selector." },
    startElement: { type: "string", description: "Start element description." },
    endRef: { type: "string", description: "End element reference." },
    endSelector: { type: "string", description: "End Playwright selector." },
    endElement: { type: "string", description: "End element description." },
  },
  ["pageId", "startElement", "endElement"],
);

export const runBrowserPlaywrightCodeTool = browserTool(
  "run_playwright_code",
  "Run Playwright Code",
  "Run a short Playwright snippet against a shared page when other browser tools are insufficient.",
  {
    pageId: pageIdParam,
    code: {
      type: "string",
      description:
        "Playwright code using the `page` object, e.g. return page.title().",
    },
    deferredResultId: {
      type: "string",
      description: "Resume a deferred execution from a prior call.",
    },
    timeoutMs: {
      type: "number",
      description: "Max wait in ms. Default 5000.",
    },
  },
  ["pageId"],
);

export const handleBrowserDialogTool = browserTool(
  "handle_dialog",
  "Handle Browser Dialog",
  "Accept or dismiss a JavaScript dialog on a shared browser page.",
  {
    pageId: pageIdParam,
    accept: {
      type: "boolean",
      description: "True to accept, false to dismiss.",
    },
    promptText: {
      type: "string",
      description: "Text for prompt dialogs.",
    },
  },
  ["pageId", "accept"],
);

export const browserToolDefinitions = [
  openBrowserPageTool,
  listOpenBrowserPagesTool,
  closeBrowserPageTool,
  readBrowserPageTool,
  screenshotBrowserPageTool,
  navigateBrowserPageTool,
  clickBrowserElementTool,
  typeInBrowserPageTool,
  hoverBrowserElementTool,
  dragBrowserElementTool,
  runBrowserPlaywrightCodeTool,
  handleBrowserDialogTool,
];

/**
 * Neutral hairline used for structural lines across the Agent UI.
 * Tracks the IDE sidebar border so nothing renders as accent-blue or
 * high-contrast white. Keep class strings literal for Tailwind JIT.
 */
export const HAIRLINE_BORDER_COLOR =
  "var(--vscode-sideBar-border, rgba(128, 128, 128, 0.22))";

export const HAIRLINE_BORDER =
  "border-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))]";

export const HAIRLINE_DIVIDE =
  "divide-y divide-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))]";

export const HAIRLINE_BORDER_B =
  "border-b-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))]";

export const HAIRLINE_BORDER_T =
  "border-t-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))]";

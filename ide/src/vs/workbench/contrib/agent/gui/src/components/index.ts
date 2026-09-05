import styled from "styled-components";
import { HAIRLINE_BORDER_COLOR } from "../styles/borders";
import { varWithFallback } from "../styles/theme";

export const defaultBorderRadius = "0.5rem";
export const lightGray = "#999998";

export const vscInputBackground = varWithFallback("input-background");
export const vscQuickInputBackground = varWithFallback("input-background");
export const vscBackground = varWithFallback("background");
export const vscForeground = varWithFallback("foreground");
export const vscButtonBackground = varWithFallback("primary-background");
export const vscButtonForeground = varWithFallback("primary-foreground");
export const vscEditorBackground = varWithFallback("editor-background");
export const vscListActiveBackground = varWithFallback("list-active");
export const vscListActiveForeground = varWithFallback(
  "list-active-foreground",
);
/** Soft hairline — never the harsh near-white --vscode-input-border. */
export const vscInputBorder = HAIRLINE_BORDER_COLOR;
export const vscInputBorderFocus = varWithFallback("border-focus");
export const vscBadgeBackground = varWithFallback("badge-background");
export const vscCommandCenterActiveBorder = varWithFallback(
  "command-border-focus",
);
export const vscCommandCenterInactiveBorder = varWithFallback("command-border");

export const Button = styled.button`
  padding: 6px 12px;
  margin: 8px 0;
  border-radius: ${defaultBorderRadius};

  border: none;
  color: ${vscButtonForeground};
  background-color: ${vscButtonBackground};
  transition:
    transform 150ms ease-out,
    filter 150ms ease-out,
    opacity 150ms ease-out;

  &:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  &:hover:enabled {
    cursor: pointer;
    filter: brightness(1.15);
  }

  &:active:enabled {
    transform: scale(0.98);
  }
`;

export const SecondaryButton = styled.button`
  padding: 6px 12px;
  margin: 8px;
  border-radius: ${defaultBorderRadius};

  border: 1px solid ${vscInputBorder};
  color: ${vscForeground};
  background-color: ${vscInputBackground};
  transition:
    transform 150ms ease-out,
    background-color 150ms ease-out,
    opacity 150ms ease-out;

  &:disabled {
    color: gray;
  }

  &:hover:enabled {
    cursor: pointer;
    background-color: ${vscBackground};
    opacity: 0.9;
  }

  &:active:enabled {
    transform: scale(0.98);
  }
`;

export const GhostButton = styled.button`
  padding: 6px 8px;
  border-radius: ${defaultBorderRadius};

  border: none;
  color: ${vscForeground};
  background-color: rgba(128, 128, 128, 0.4);
  &:disabled {
    color: gray;
    pointer-events: none;
  }

  &:hover:enabled {
    cursor: pointer;
    filter: brightness(125%);
  }
`;

export const CustomScrollbarDiv = styled.div`
  scrollbar-base-color: transparent;
  scrollbar-width: thin;
  background-color: ${vscBackground};

  & * {
    ::-webkit-scrollbar {
      width: 4px;
    }

    ::-webkit-scrollbar:horizontal {
      height: 4px;
    }

    ::-webkit-scrollbar-thumb {
      border-radius: 2px;
    }
  }
`;

export const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  box-sizing: border-box;
  margin: 4px 0px;
  border-radius: ${defaultBorderRadius};
  outline: none;
  border: 1px solid ${vscInputBorder};
  background-color: ${vscInputBackground};
  background-clip: padding-box;
  color: ${vscForeground};
  /* Clip glyphs/password bullets so they cannot paint over the hairline. */
  overflow: hidden;
  line-height: 1.4;

  &:focus {
    background: ${vscInputBackground};
    border-color: ${vscInputBorderFocus};
    outline: none;
  }

  &:invalid {
    border-color: red;
  }

  /* Chromium autofill paints a bright inset that reads as a border break. */
  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus {
    -webkit-text-fill-color: ${vscForeground};
    caret-color: ${vscForeground};
    box-shadow: 0 0 0 1000px ${vscInputBackground} inset;
    transition: background-color 99999s ease-out;
  }

  &::-ms-reveal,
  &::-ms-clear {
    display: none;
  }
`;

export const HeaderButton = styled.button<{
  inverted: boolean | undefined;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
}>`
  background-color: ${({ inverted, backgroundColor }) => {
    return backgroundColor ?? (inverted ? vscForeground : "transparent");
  }};
  color: ${({ inverted }) => (inverted ? vscBackground : vscForeground)};

  border: none;
  border-radius: ${defaultBorderRadius};
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};

  &:focus {
    outline: none;
    border: none;
  }

  &:hover {
    background-color: ${({ inverted, hoverBackgroundColor }) =>
      typeof inverted === "undefined" || inverted
        ? (hoverBackgroundColor ?? vscInputBackground)
        : "transparent"};
  }

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px;
`;

export const StyledActionButton = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background-color 200ms;
  border-radius: ${defaultBorderRadius};
  padding: 2px 12px;
  background-color: ${lightGray}33;
  background-opacity: 0.1;

  &:hover {
    background-color: ${lightGray}55;
  }
`;

export const CloseButton = styled.button`
  border: none;
  background-color: inherit;
  color: ${lightGray};
  position: absolute;
  top: 0.6rem;
  right: 1rem;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

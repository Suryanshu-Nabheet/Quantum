import React from "react";
import { HeaderButton } from "..";
import { ToolTip, TooltipPlacement } from "./Tooltip";

interface HeaderButtonWithToolTipProps {
  text: string | undefined;
  onClick?: (e: any) => void;
  children: React.ReactNode;
  disabled?: boolean;
  inverted?: boolean;
  active?: boolean;
  className?: string;
  onKeyDown?: (e: any) => void;
  tabIndex?: number;
  style?: React.CSSProperties;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  tooltipPlacement?: TooltipPlacement;
  testId?: string;
}

const HeaderButtonWithToolTip = React.forwardRef<
  HTMLButtonElement,
  HeaderButtonWithToolTipProps
>((props: HeaderButtonWithToolTipProps, ref) => {
  return (
    <ToolTip place={props.tooltipPlacement ?? "bottom"} content={props.text}>
      <HeaderButton
        hoverBackgroundColor={props.hoverBackgroundColor}
        backgroundColor={props.backgroundColor}
        data-testid={props.testId}
        inverted={props.inverted}
        disabled={props.disabled}
        onClick={props.onClick}
        onKeyDown={props.onKeyDown}
        className={props.className}
        style={props.style}
        ref={ref}
        tabIndex={props.tabIndex}
      >
        {props.children}
      </HeaderButton>
    </ToolTip>
  );
});

export default HeaderButtonWithToolTip;

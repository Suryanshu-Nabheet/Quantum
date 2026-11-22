import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import { SecureImageComponent } from "../StyledMarkdownPreview/SecureImageComponent";
import styled from "styled-components";
import {
  CloseButton,
  defaultBorderRadius,
  vscBackground,
  vscForeground,
} from "..";

interface TextDialogProps {
  showDialog: boolean;
  onEnter: () => void;
  onClose: () => void;
  message?: string | JSX.Element;
}

const ScreenCover = styled.div`
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(0.5px);
  z-index: 100000;

  &[hidden] {
    display: none;
  }
`;

const DialogContainer = styled.div`
  position: relative;
  flex: 0 1 auto;
  width: 100%;
  max-width: 600px;
  max-height: calc(100dvh - 2rem);
  min-width: 0;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-wrap: anywhere;
  overscroll-behavior: contain;
  color: ${vscForeground};
  background-color: ${vscBackground};
  border-radius: ${defaultBorderRadius};
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);

  &,
  & *,
  & *::before,
  & *::after {
    box-sizing: border-box;
  }

  & * {
    min-width: 0;
  }
`;

const TextDialog = (props: TextDialogProps) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      props.onClose();
    }
  };

  if (!isValidElement(props.message) && typeof props.message !== "string") {
    return null;
  }

  return (
    <ScreenCover
      onClick={props.onClose}
      hidden={!props.showDialog}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <DialogContainer
        className="no-scrollbar"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <CloseButton onClick={props.onClose}>
          <XMarkIcon className="z-50 h-5 w-5 hover:brightness-125" />
        </CloseButton>

        {typeof props.message === "string" ? (
          <ReactMarkdown components={{
            img: ({ src, alt }) => <SecureImageComponent src={src} alt={alt} />,
          }}>
            {props.message}
          </ReactMarkdown>
        ) : !React.isValidElement(props.message) ? null : (
          props.message
        )}
      </DialogContainer>
    </ScreenCover>
  );
};

export default TextDialog;

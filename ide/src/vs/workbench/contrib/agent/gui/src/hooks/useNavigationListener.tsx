import type { ToWebviewProtocol } from "core/protocol";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useWebviewListener } from "./useWebviewListener";

const openGUITypes: (keyof ToWebviewProtocol)[] = [
  "highlightedCode",
  "focusAgentInput",
  "focusAgentInputWithoutClear",
  "newSession",
];

export const useNavigationListener = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isChatRoute =
    location.pathname === "/" || location.pathname === "/index.html";

  for (const messageType of openGUITypes) {
    useWebviewListener(
      messageType,
      async (data) => {
        if (isChatRoute) {
          return;
        }
        navigate("/");
        setTimeout(() => {
          // The layout already handles `newSession` (including persistence).
          // Forward focus separately after navigation so that the layout
          // does not process the session-creation command a second time.
          const forwardedMessageType =
            messageType === "newSession" ? "focusAgentInput" : messageType;
          window.postMessage(
            {
              messageType: forwardedMessageType,
              data,
              messageId: uuidv4(),
            },
            "*",
          );
        }, 200);
      },
      [isChatRoute, navigate],
    );
  }
};

import { ChatHistoryItem } from "core";
import { renderChatMessage, stripImages } from "core/util/messageContent";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../redux/hooks";
import { selectUIConfig } from "../../redux/slices/configSlice";
import { deleteMessage } from "../../redux/slices/sessionSlice";
import ThinkingBlockPeek from "../mainInput/belowMainInput/ThinkingBlockPeek";
import StyledMarkdownPreview from "../StyledMarkdownPreview";
import { CHAT_ASSISTANT_BODY_CLASS } from "../../styles/chatLayout";
import ConversationSummary from "./ConversationSummary";
import ResponseActions from "./ResponseActions";
import ThinkingIndicator from "./ThinkingIndicator";

interface StepContainerProps {
  item: ChatHistoryItem;
  index: number;
  isLast: boolean;
  latestSummaryIndex?: number;
}

export default function StepContainer(props: StepContainerProps) {
  const dispatch = useDispatch();
  const [isTruncated, setIsTruncated] = useState(false);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const uiConfig = useAppSelector(selectUIConfig);
  const compactionLoading = useAppSelector(
    (state) => state.session.compactionLoading[props.index] || false,
  );

  // Calculate dimming and indicator state based on latest summary index
  const latestSummaryIndex = props.latestSummaryIndex ?? -1;
  const isBeforeLatestSummary =
    latestSummaryIndex !== -1 && props.index <= latestSummaryIndex;
  const isLatestSummary =
    latestSummaryIndex !== -1 && props.index === latestSummaryIndex;

  const historyItemAfterThis = useAppSelector(
    (state) => state.session.history[props.index + 1],
  );
  const showResponseActions =
    (props.isLast || historyItemAfterThis?.message.role === "user") &&
    !(props.isLast && (isStreaming || props.item.toolCallStates));

  const messageText = useMemo(
    () => renderChatMessage(props.item.message).trim(),
    [props.item.message],
  );
  const hasMessageBody = messageText.length > 0;
  const hasReasoning = !!props.item.reasoning?.text;
  // Only reserve body chrome when there is real content — never for tool-only turns.
  const showAssistantBody =
    hasMessageBody || hasReasoning || !!uiConfig?.displayRawMarkdown;

  useEffect(() => {
    if (!isStreaming) {
      const content = messageText;
      const endingPunctuation = [".", "?", "!", "```", ":"];

      // If not ending in punctuation or emoji, we assume the response got truncated
      if (
        content.trim() !== "" &&
        !(
          endingPunctuation.some((p) => content.endsWith(p)) ||
          /\p{Emoji}/u.test(content.slice(-2))
        )
      ) {
        setIsTruncated(true);
      } else {
        setIsTruncated(false);
      }
    }
  }, [messageText, isStreaming]);

  function onDelete() {
    dispatch(deleteMessage(props.index));
  }

  function onResumeGeneration() {
    window.postMessage(
      {
        messageType: "userInput",
        data: {
          input: "Resume your response exactly where you left off:",
        },
      },
      "*",
    );
  }

  if (
    !showAssistantBody &&
    !showResponseActions &&
    !isLatestSummary &&
    !props.item.conversationSummary &&
    !compactionLoading
  ) {
    return props.isLast ? <ThinkingIndicator historyItem={props.item} /> : null;
  }

  return (
    <div>
      {showAssistantBody ? (
        <div
          className={`${CHAT_ASSISTANT_BODY_CLASS} ${isBeforeLatestSummary ? "opacity-35" : ""}`}
        >
          {uiConfig?.displayRawMarkdown ? (
            <pre className="text-2xs max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4">
              {renderChatMessage(props.item.message)}
            </pre>
          ) : (
            <>
              {hasReasoning && (
                <ThinkingBlockPeek
                  content={props.item.reasoning!.text}
                  index={props.index}
                  prevItem={props.index > 0 ? props.item : null}
                  inProgress={!props.item.reasoning?.endAt}
                />
              )}

              {hasMessageBody && (
                <StyledMarkdownPreview
                  isRenderingInStepContainer
                  source={stripImages(props.item.message.content)}
                  itemIndex={props.index}
                  className="[&>*:last-child]:!mb-0 [&_p:last-child]:!mb-0"
                />
              )}
            </>
          )}
          {props.isLast && <ThinkingIndicator historyItem={props.item} />}
        </div>
      ) : (
        props.isLast && <ThinkingIndicator historyItem={props.item} />
      )}

      {showResponseActions && (
        <div
          className={`mt-1 h-7 transition-opacity duration-300 ease-in-out ${isBeforeLatestSummary || isStreaming ? "opacity-35" : ""} ${isStreaming && "pointer-events-none cursor-not-allowed"}`}
        >
          <ResponseActions
            isTruncated={isTruncated}
            onDelete={onDelete}
            onResumeGeneration={onResumeGeneration}
            index={props.index}
            item={props.item}
            isLast={props.isLast}
          />
        </div>
      )}

      {isLatestSummary && (
        <div className="mx-1.5 my-3">
          <div className="flex items-center">
            <div className="border-border flex-1 border-t border-solid"></div>
            <span className="text-description mx-3 text-xs">
              Previous Conversation Compacted
            </span>
            <div className="border-border flex-1 border-t border-solid"></div>
          </div>
        </div>
      )}

      <ConversationSummary item={props.item} index={props.index} />
    </div>
  );
}

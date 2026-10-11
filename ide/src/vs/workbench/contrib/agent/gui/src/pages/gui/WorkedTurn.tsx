import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { BuiltInToolNames } from "core/tools/builtIn";
import { renderChatMessage } from "core/util/messageContent";
import { useEffect, useRef, useState } from "react";
import StyledMarkdownPreview from "../../components/StyledMarkdownPreview";
import { ChatHistoryItemWithMessageId } from "../../redux/slices/sessionSlice";
import { turnIsWorking } from "./groupHistoryTurns";
import { ToolCallDiv } from "./ToolCallDiv";
import { PlanCard } from "./ToolCallDiv/PlanCard";

function ThoughtRow({
  text,
  inProgress,
  index,
}: {
  text: string;
  inProgress: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(inProgress);
  const wasWorking = useRef(inProgress);

  useEffect(() => {
    if (wasWorking.current && !inProgress) {
      setOpen(false);
    } else if (!wasWorking.current && inProgress) {
      setOpen(true);
    }
    wasWorking.current = inProgress;
  }, [inProgress]);

  if (!text) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-description m-0 flex h-5 w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-xs leading-4 hover:brightness-125"
      >
        <ChevronRightIcon
          className={`h-3 w-3 flex-shrink-0 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
            open ? "rotate-90" : ""
          }`}
        />
        {inProgress ? "Thinking" : "Thought"}
      </button>
      {open ? (
        <div className="min-w-0 pl-[18px]">
          <StyledMarkdownPreview
            isRenderingInStepContainer
            isThinking
            disableManualApply
            source={text}
            itemIndex={index}
            className="[&_p]:!mb-0"
          />
        </div>
      ) : null}
    </div>
  );
}

function WorkItem({
  item,
  index,
  thinking,
}: {
  item: ChatHistoryItemWithMessageId;
  index: number;
  thinking: boolean;
}) {
  const text =
    item.message.role === "thinking" && item.message.redactedThinking
      ? "Thinking content redacted."
      : renderChatMessage(item.message).trim();
  const tools = (item.toolCallStates ?? []).filter(
    (call) => call.toolCall.function?.name !== BuiltInToolNames.CreatePlan,
  );

  return (
    <>
      {item.message.role !== "thinking" && item.reasoning?.text ? (
        <ThoughtRow
          text={item.reasoning.text}
          inProgress={!!item.reasoning.active}
          index={index}
        />
      ) : null}
      {item.message.role === "thinking" ? (
        <ThoughtRow text={text} inProgress={thinking} index={index} />
      ) : text ? (
        <StyledMarkdownPreview
          isRenderingInStepContainer
          isThinking
          disableManualApply
          source={text}
          itemIndex={index}
          className="[&_p]:!mb-0"
        />
      ) : null}
      {tools.length > 0 && item.toolCallStates ? (
        <ToolCallDiv flat toolCallStates={item.toolCallStates} historyIndex={index} />
      ) : null}
    </>
  );
}

export function WorkedTurn({
  history,
  workIndexes,
  answerIndex,
  reasoningOnAnswer,
  isStreaming,
}: {
  history: ChatHistoryItemWithMessageId[];
  workIndexes: number[];
  answerIndex: number | null;
  reasoningOnAnswer: boolean;
  isStreaming: boolean;
}) {
  const working = turnIsWorking(history, workIndexes, answerIndex, isStreaming);
  const [open, setOpen] = useState(working);
  const wasWorking = useRef(working);

  useEffect(() => {
    if (wasWorking.current && !working) {
      setOpen(false);
    } else if (!wasWorking.current && working) {
      setOpen(true);
    }
    wasWorking.current = working;
  }, [working]);

  const planIndexes = answerIndex == null ? workIndexes : [...workIndexes, answerIndex];
  const planCalls = planIndexes.flatMap((index) =>
    (history[index]?.toolCallStates ?? [])
      .filter((call) => call.toolCall.function?.name === BuiltInToolNames.CreatePlan)
      .map((call) => ({ call, index })),
  );
  const answer = answerIndex == null ? undefined : history[answerIndex];
  const hasBody =
    (reasoningOnAnswer && !!answer?.reasoning?.text) ||
    workIndexes.some((index) => {
      const item = history[index];
      if (!item) {
        return false;
      }
      if (item.message.role === "thinking") {
        return true;
      }
      if (item.reasoning?.text) {
        return true;
      }
      if (renderChatMessage(item.message).trim()) {
        return true;
      }
      return (item.toolCallStates ?? []).some(
        (call) => call.toolCall.function?.name !== BuiltInToolNames.CreatePlan,
      );
    });

  if (!hasBody && planCalls.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {hasBody ? (
        <div className="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="text-description m-0 flex h-5 w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-xs leading-4 hover:brightness-125"
          >
            <ChevronRightIcon
              className={`h-3 w-3 flex-shrink-0 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                open ? "rotate-90" : ""
              }`}
            />
            {working ? "Working" : "Worked"}
          </button>
          {open ? (
            <div className="flex min-w-0 flex-col gap-1 pl-[18px]">
              {workIndexes.map((index) => {
                const item = history[index];
                if (!item) {
                  return null;
                }
                const thinking =
                  isStreaming && item.message.role === "thinking" && index === history.length - 1;
                return <WorkItem key={item.message.id} item={item} index={index} thinking={thinking} />;
              })}
              {reasoningOnAnswer && answer?.reasoning?.text ? (
                <ThoughtRow
                  text={answer.reasoning.text}
                  inProgress={!!answer.reasoning.active}
                  index={answerIndex ?? 0}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {planCalls.map(({ call, index }) => (
        <PlanCard
          key={call.toolCallId}
          toolCallState={call}
          historyIndex={index}
          alongsideResearch={false}
        />
      ))}
    </div>
  );
}

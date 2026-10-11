import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  AgentPlan,
  formatPlanBuildMessage,
  formatPlanDocument,
  formatStreamingPlan,
  historyHasResearch,
  normalizePlan,
  planFileName,
  planToTodos,
} from "core/tools/implementations/createPlan";
import { CSSProperties, useContext } from "react";
import StyledMarkdownPreview from "../../../components/StyledMarkdownPreview";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setMode, setPlanBrief, setTodos } from "../../../redux/slices/sessionSlice";
import { streamResponseThunk } from "../../../redux/thunks/streamResponse";

const planActionStyle: CSSProperties = {
  boxSizing: "border-box",
  width: 72,
  height: 28,
  margin: 0,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  lineHeight: "16px",
  fontWeight: 500,
  fontFamily: "system-ui, -apple-system, sans-serif",
  borderRadius: 6,
  borderWidth: 1,
  borderStyle: "solid",
};

function BuildButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...planActionStyle,
        width: "auto",
        padding: "0 12px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background: "var(--vscode-button-background, #2c5aa0)",
        color: "var(--vscode-button-foreground, #ffffff)",
        borderColor: "var(--vscode-button-background, #2c5aa0)",
      }}
    >
      Build
    </button>
  );
}

function readPlan(toolCallState: ToolCallState): AgentPlan | undefined {
  const fromParsed = toolCallState.parsedArgs;
  try {
    if (fromParsed && typeof fromParsed === "object") {
      return normalizePlan(fromParsed);
    }
  } catch {
    // Arguments are still streaming or invalid.
  }
  try {
    return normalizePlan(JSON.parse(toolCallState.toolCall.function.arguments || "{}"));
  } catch {
    return undefined;
  }
}

export function PlanCard({
  toolCallState,
  historyIndex,
  alongsideResearch,
}: {
  toolCallState: ToolCallState;
  historyIndex: number;
  alongsideResearch: boolean;
}) {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const researched = useAppSelector((state) =>
    historyHasResearch(
      state.session.history.flatMap((item) =>
        (item.toolCallStates ?? []).map((call) => ({
          name: call.toolCall.function?.name,
          status: call.status,
        })),
      ),
    ),
  );
  const isLastReadyPlan = useAppSelector((state) => {
    let lastId = "";
    for (const item of state.session.history) {
      for (const call of item.toolCallStates ?? []) {
        if (call.toolCall.function?.name !== BuiltInToolNames.CreatePlan) {
          continue;
        }
        if (call.status !== "done") {
          continue;
        }
        try {
          normalizePlan(call.parsedArgs ?? call.toolCall.function.arguments);
          lastId = call.toolCallId;
        } catch {
          // An earlier create_plan that never became a plan stays hidden.
        }
      }
    }
    return lastId === toolCallState.toolCallId;
  });
  const plan = readPlan(toolCallState);
  const ready = toolCallState.status === "done" && !!plan && isLastReadyPlan;
  const streaming =
    toolCallState.status === "generating" && !alongsideResearch && researched
      ? formatStreamingPlan(toolCallState.parsedArgs)
      : "";
  if (!ready && !streaming) {
    return null;
  }
  const title = plan?.title ?? "Plan";

  const view = () => {
    if (!plan) {
      return;
    }
    void ideMessenger.ide.showVirtualFile(
      planFileName(plan.title),
      formatPlanDocument(plan),
      true,
    );
  };

  const build = () => {
    if (!plan || isStreaming) {
      return;
    }
    dispatch(setMode("agent"));
    dispatch(
      setPlanBrief({
        title: plan.title,
        overview: plan.overview,
        approach: plan.approach,
      }),
    );
    dispatch(setTodos(planToTodos(plan)));
    void dispatch(
      streamResponseThunk({
        editorState: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: formatPlanBuildMessage(plan) }],
            },
          ],
        },
        modifiers: { noContext: true },
      }),
    );
  };

  if (!ready) {
    return (
      <div className="mt-2 min-w-0">
        <StyledMarkdownPreview
          isRenderingInStepContainer
          disableManualApply
          source={streaming}
          itemIndex={historyIndex}
        />
      </div>
    );
  }

  return (
    <div className="mt-2 flex min-w-0 flex-col gap-1.5">
      <div className="text-description text-xs">Prepared plan</div>
    <div className="border-command-border bg-input flex min-w-0 flex-col gap-2 rounded-default border border-solid px-3 py-2.5">
      <div className="text-description flex min-w-0 items-center gap-1.5 text-xs">
        <DocumentTextIcon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="min-w-0 truncate">
          {plan ? planFileName(plan.title) : "plan.md"}
        </span>
      </div>
      <div className="text-foreground text-sm font-medium leading-5">{title}</div>
      {plan && (
        <p className="text-description m-0 text-sm leading-relaxed">{plan.overview}</p>
      )}
      <button
        type="button"
        disabled={!ready}
        onClick={view}
        className="m-0 w-fit border-0 bg-transparent p-0 text-left text-xs"
        style={{
          color: ready ? "var(--vscode-textLink-foreground, #3794ff)" : "var(--vscode-disabledForeground, #666)",
          cursor: ready ? "pointer" : "default",
        }}
      >
        Read detailed plan
      </button>
      {plan && (
        <div className="border-command-border flex flex-col gap-1.5 rounded-md border border-solid px-2.5 py-2">
          <div className="text-description text-xs">
            {plan.todos.length} {plan.todos.length === 1 ? "todo" : "todos"}
          </div>
          {plan.todos.map((step, index) => (
            <div key={`${index}:${step}`} className="flex min-w-0 items-start gap-2">
              <span
                aria-hidden
                className="mt-0.5 inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full border border-solid"
                style={{ borderColor: "var(--vscode-descriptionForeground, #8a8a8a)" }}
              />
              <span className="text-foreground min-w-0 text-sm leading-5">{step}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <BuildButton disabled={!ready || isStreaming} onClick={build} />
      </div>
    </div>
    </div>
  );
}

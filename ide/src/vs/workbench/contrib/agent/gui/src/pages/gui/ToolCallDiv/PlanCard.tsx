import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentPlanViewData, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  formatPlanBuildMessage,
  formatPlanDocument,
  historyHasResearch,
  normalizePlan,
  planFileName,
  planToTodos,
} from "core/tools/implementations/createPlan";
import type { AgentPlan } from "core/tools/implementations/createPlan";
import { useContext, useEffect, useMemo, useState } from "react";
import { HostBridgeContext } from "../../../context/HostBridge";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../../util";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  setMode,
  setPlanBrief,
  setTodos,
} from "../../../redux/slices/sessionSlice";
import { streamResponseThunk } from "../../../redux/thunks/streamResponse";
import { ShinyLoading } from "../../../components/mainInput/ShinyLoading";
import { TodoStatusIcon } from "../../../components/ui/task-list";
import { Button } from "../../../components/ui/Button";

function BuildButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="primary"
      size="lg"
      disabled={disabled}
      onClick={onClick}
      aria-keyshortcuts={`${getMetaKeyLabel() === "⌘" ? "Meta" : "Control"}+Enter`}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          isMetaEquivalentKeyPressed(event) &&
          !event.altKey &&
          !event.shiftKey
        ) {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }
      }}
      className="my-0 inline-flex h-7 items-center gap-2 px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <span>Build</span>
      <span className="whitespace-nowrap text-[10px] font-normal opacity-80">
        {getMetaKeyLabel()}↵
      </span>
    </Button>
  );
}

function PlanMarkdown({
  source,
  compact = false,
}: {
  source: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`${compact ? "text-[13px] leading-5" : "text-foreground text-sm leading-relaxed"} min-w-0`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className={compact ? "m-0" : "my-2 first:mt-0 last:mb-0"}>
              {children}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="text-foreground mb-1 mt-2 text-base font-semibold leading-6">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-foreground mb-1 mt-2 text-sm font-semibold leading-5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-foreground mb-1 mt-2 text-sm font-medium leading-5">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-command-border pl-3">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre
              className="my-2 max-w-full overflow-x-auto rounded-md px-3 py-2"
              style={{
                backgroundColor: "var(--vscode-textCodeBlock-background)",
              }}
            >
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="rounded-sm px-1 font-mono text-[0.9em]">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

async function findAvailablePlanPath(
  root: string,
  fileName: string,
  fileExists: (path: string) => Promise<boolean>,
): Promise<{ path: string; fileName: string }> {
  const suffix = ".plan.md";
  const stem = fileName.endsWith(suffix)
    ? fileName.slice(0, -suffix.length)
    : fileName;
  const normalizedRoot = root.replace(/\/+$/, "");
  const separator = normalizedRoot.endsWith(":") ? "///" : "/";
  for (let index = 0; index < 1000; index++) {
    const candidateName =
      index === 0 ? fileName : `${stem}-${index + 1}${suffix}`;
    const path = `${normalizedRoot}${separator}${candidateName}`;
    if (!(await fileExists(path))) {
      return { path, fileName: candidateName };
    }
  }
  throw new Error(
    "Could not find an available plan filename in the workspace.",
  );
}

function PlanTask({
  text,
  status,
}: {
  text: string;
  status: AgentPlanViewData["todos"][number]["status"];
}) {
  const statusClass =
    status === "done"
      ? "tdl-done"
      : status === "in_progress"
        ? "tdl-active"
        : "";
  return (
    <li
      className={`tdl-item ${statusClass}`}
      style={{ color: "var(--vscode-foreground, #e6e6e6)" }}
    >
      <TodoStatusIcon status={status} />
      <div className="tdl-label min-w-0 flex-1">
        <PlanMarkdown source={text} compact />
      </div>
    </li>
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
    return normalizePlan(
      JSON.parse(toolCallState.toolCall.function.arguments || "{}"),
    );
  } catch {
    return undefined;
  }
}

export function PlanCard({
  toolCallState,
  alongsideResearch,
}: {
  toolCallState: ToolCallState;
  alongsideResearch: boolean;
}) {
  const dispatch = useAppDispatch();
  const hostBridge = useContext(HostBridgeContext);
  const [isDownloading, setIsDownloading] = useState(false);
  const sessionId = useAppSelector((state) => state.session.id);
  const planBrief = useAppSelector((state) => state.session.planBrief);
  const todos = useAppSelector((state) => state.session.todos);
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
  const plan = useMemo(() => readPlan(toolCallState), [toolCallState]);
  const ready = toolCallState.status === "done" && !!plan && isLastReadyPlan;
  const isPlanning =
    (toolCallState.status === "generating" ||
      toolCallState.status === "calling") &&
    !alongsideResearch &&
    researched;
  const planData = useMemo<AgentPlanViewData | undefined>(() => {
    if (!plan || !isLastReadyPlan) return undefined;
    const isCurrentPlan = planBrief?.sourceToolCallId
      ? planBrief.sourceToolCallId === toolCallState.toolCallId
      : planBrief?.title === plan.title;
    const sourceTodos =
      isCurrentPlan && todos.length
        ? todos
        : planToTodos(plan).map((todo) => ({
            ...todo,
            status: "pending" as const,
          }));
    return {
      sessionId,
      title: plan.title,
      overview: plan.overview,
      approach: plan.approach,
      todos: sourceTodos.map((todo) => ({
        id: todo.id,
        text: todo.text,
        status: todo.status,
      })),
      isBuilding: isCurrentPlan && isStreaming,
    };
  }, [
    isLastReadyPlan,
    isStreaming,
    plan,
    planBrief,
    sessionId,
    todos,
    toolCallState.toolCallId,
  ]);

  useEffect(() => {
    if (planData) {
      void hostBridge.ide.updateAgentPlan?.(planData);
    }
  }, [hostBridge.ide, planData]);

  if (!ready && !isPlanning) {
    return null;
  }

  const view = () => {
    if (!planData) {
      return;
    }
    void hostBridge.ide.openAgentPlan?.(planData);
  };

  const download = async () => {
    if (!plan || !planData || isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      const workspaceDirs = await hostBridge.ide.getWorkspaceDirs();
      const workspaceRoot = workspaceDirs[0];
      if (!workspaceRoot) {
        await hostBridge.ide.showToast(
          "warning",
          "Open a project folder before saving this plan.",
        );
        return;
      }
      const target = await findAvailablePlanPath(
        workspaceRoot,
        planFileName(plan.title),
        (path) => hostBridge.ide.fileExists(path),
      );
      await hostBridge.ide.writeFile(
        target.path,
        formatPlanDocument(plan, planData.todos),
      );
      await hostBridge.ide.showToast(
        "info",
        `Plan saved to ${target.fileName}`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await hostBridge.ide.showToast(
        "error",
        `Could not save the plan: ${detail}`,
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const build = () => {
    if (!plan || isStreaming) {
      return;
    }
    dispatch(setMode("agent"));
    dispatch(
      setPlanBrief({
        sourceToolCallId: toolCallState.toolCallId,
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
    return <ShinyLoading status="Creating plan..." />;
  }
  if (!plan || !planData) {
    return null;
  }
  return (
    <div
      className="border-command-border bg-input text-foreground mt-2 flex min-w-0 flex-col gap-2 rounded-default border border-solid px-3 py-3"
      style={{
        borderColor:
          "var(--vscode-widget-border, var(--vscode-panel-border, rgba(128, 128, 128, 0.24)))",
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="text-foreground min-w-0 break-words text-base font-semibold leading-6">
          {plan.title}
        </div>
        <button
          type="button"
          disabled={isDownloading}
          onClick={() => void download()}
          title={isDownloading ? "Saving plan…" : "Save plan to project"}
          aria-label={isDownloading ? "Saving plan" : "Save plan to project"}
          className="text-description hover:text-foreground -mr-1 -mt-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="min-w-0">
        <PlanMarkdown source={plan.overview} />
      </div>
      <button
        type="button"
        onClick={view}
        className="m-0 w-fit border-0 bg-transparent p-0 text-left text-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
        style={{
          color: "var(--vscode-textLink-foreground, #3794ff)",
          cursor: "pointer",
        }}
      >
        View full plan
      </button>
      <div
        className="mt-1 min-w-0 rounded-md border border-solid px-2 py-2"
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          borderColor:
            "var(--vscode-widget-border, var(--vscode-panel-border, rgba(128, 128, 128, 0.24)))",
        }}
      >
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <div className="text-foreground text-xs font-medium">
            {planData.todos.length}{" "}
            {planData.todos.length === 1 ? "To-do" : "To-dos"}
          </div>
          <div className="text-description text-xs">
            {planData.todos.filter((todo) => todo.status === "done").length}/
            {planData.todos.length}
          </div>
        </div>
        <ul className="m-0 list-none p-0">
          {planData.todos.map((todo) => (
            <PlanTask key={todo.id} text={todo.text} status={todo.status} />
          ))}
        </ul>
      </div>
      <div className="flex justify-end pt-1">
        <BuildButton disabled={!ready || isStreaming} onClick={build} />
      </div>
    </div>
  );
}

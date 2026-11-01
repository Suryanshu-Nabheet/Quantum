import { TodoItem } from "core";
import { useEffect, useRef, useState } from "react";

const styles = {
  todo: "tdl-root",
  todoHead: "tdl-head",
  todoHeadIcon: "tdl-head-icon",
  headCollapsed: "tdl-head-collapsed",
  headStatus: "tdl-head-status",
  todoHeadCheck: "tdl-head-check",
  todoHeadPie: "tdl-pie",
  todoHeadPieRing: "tdl-pie-ring",
  todoListIcon: "tdl-list-icon",
  todoChevron: "tdl-chevron",
  todoTitle: "tdl-title",
  todoCount: "tdl-count",
  rollCount: "tdl-roll-count",
  rollDigit: "tdl-roll-digit",
  rollInner: "tdl-roll-inner",
  on: "tdl-on",
  todoCollapsible: "tdl-collapsible",
  isCollapsed: "tdl-collapsed",
  todoInner: "tdl-inner",
  todoList: "tdl-list",
  todoListOpen: "tdl-list-open",
  todoItem: "tdl-item",
  done: "tdl-done",
  active: "tdl-active",
  todoIconWrap: "tdl-icon-wrap",
  todoIcon: "tdl-icon",
  strong: "tdl-strong",
  todoLabel: "tdl-label",
} as const;

const cls = (base: string, on?: boolean) => (on ? `${base} ${styles.on}` : base);

function CheckIcon({ on }: { on?: boolean }) {
  return (
    <svg className={cls(styles.todoIcon, on)} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon({ on }: { on?: boolean }) {
  return (
    <svg
      className={cls(`${styles.todoIcon} ${styles.strong}`, on)}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashedIcon({ on }: { on?: boolean }) {
  return (
    <svg className={cls(styles.todoIcon, on)} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="1.8 3.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TodoStatusIcon({ status }: { status: TodoItem["status"] }) {
  const done = status === "done";
  const active = status === "in_progress";
  return (
    <span className={styles.todoIconWrap} aria-hidden="true">
      <DashedIcon on={!done && !active} />
      <ArrowIcon on={active} />
      <CheckIcon on={done} />
    </span>
  );
}

function RollDigit({ char }: { char: string }) {
  const prev = useRef(char);
  const [roll, setRoll] = useState<{ from: string; to: string } | null>(null);
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (char === prev.current) {
      return;
    }
    const from = prev.current;
    prev.current = char;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setRoll({ from, to: char });
    setUp(false);
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setUp(true)),
    );
    const done = setTimeout(() => setRoll(null), 380);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [char]);

  if (!roll) {
    return <span className={styles.rollDigit}>{char}</span>;
  }
  return (
    <span className={styles.rollDigit}>
      <span className={cls(styles.rollInner, up)}>
        <span>{roll.from}</span>
        <span>{roll.to}</span>
      </span>
    </span>
  );
}

function RollingCount({ value }: { value: string }) {
  return (
    <span className={styles.rollCount} aria-label={value}>
      {value.split("").map((char, index) => (
        <RollDigit key={index} char={char} />
      ))}
    </span>
  );
}

function FilledCheckIcon() {
  return (
    <svg className={styles.todoHeadCheck} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TaskList({
  todos,
  scroll = true,
}: {
  todos: TodoItem[];
  scroll?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const total = todos.length;
  const doneCount = todos.filter((item) => item.status === "done").length;
  const hasProgress = todos.some((item) => item.status === "in_progress");
  const allDone = total > 0 && doneCount === total;
  const running = !allDone && (hasProgress || doneCount > 0);
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const activeId = todos.find((item) => item.status === "in_progress")?.id;

  useEffect(() => {
    const list = listRef.current;
    if (!scroll || !list || !activeId || collapsed) {
      return;
    }
    const row = list.querySelector(`[data-todo-id="${CSS.escape(activeId)}"]`);
    if (!(row instanceof HTMLElement)) {
      return;
    }
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [activeId, collapsed, scroll, todos]);

  if (total === 0) {
    return null;
  }

  return (
    <div
      className={
        scroll
          ? styles.todo
          : `${styles.todo} border-command-border bg-input mt-3 mb-1 rounded-default border border-solid`
      }
    >
      <button
        type="button"
        className={styles.todoHead}
        aria-expanded={!collapsed}
        aria-label="Toggle to-dos"
        onClick={() => setCollapsed((value) => !value)}
      >
        <span className={`${styles.todoHeadIcon}${collapsed ? ` ${styles.headCollapsed}` : ""}`}>
          <span className={styles.headStatus}>
            {allDone ? (
              <FilledCheckIcon />
            ) : running ? (
              <span
                className={styles.todoHeadPie}
                style={{ "--todo-pie": `${pct}%` } as Record<string, string>}
                aria-hidden="true"
              >
                <svg className={styles.todoHeadPieRing} viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeDasharray="2.2 4.4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            ) : (
              <svg className={styles.todoListIcon} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <svg className={styles.todoChevron} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.todoTitle}>To-dos</span>
        <span className={styles.todoCount}>
          <RollingCount value={`${doneCount}/${total}`} />
        </span>
      </button>

      <div className={`${styles.todoCollapsible}${collapsed ? ` ${styles.isCollapsed}` : ""}`}>
        <div className={styles.todoInner}>
          <ul
            ref={listRef}
            className={scroll ? styles.todoList : `${styles.todoList} ${styles.todoListOpen}`}
          >
            {todos.map((item) => {
              const done = item.status === "done";
              const active = item.status === "in_progress";
              return (
                <li
                  key={item.id}
                  data-todo-id={item.id}
                  className={
                    styles.todoItem +
                    (done ? ` ${styles.done}` : active ? ` ${styles.active}` : "")
                  }
                >
                  <TodoStatusIcon status={item.status} />
                  <span className={styles.todoLabel}>{item.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TaskList;

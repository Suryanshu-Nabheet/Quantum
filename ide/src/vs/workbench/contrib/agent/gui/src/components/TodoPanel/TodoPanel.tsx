import { TodoItem, TodoStatus } from "core";
import { useState } from "react";

const INK = "#f4f4f5";
const MUTED = "#8a8a8a";
const DIM = "#6b6b6b";
const HAIRLINE = "rgba(255,255,255,0.08)";

function StatusMark({ status }: { status: TodoStatus }) {
  if (status === "done") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <path
          d="M3.2 8.3 6.4 11.4 12.8 4.6"
          fill="none"
          stroke={MUTED}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <svg
        className="todo-spin"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        aria-hidden
      >
        <circle cx="8" cy="8" r="5.25" fill="none" stroke="#3f3f46" strokeWidth="1.5" />
        <path
          d="M8 2.75a5.25 5.25 0 0 1 5.25 5.25"
          fill="none"
          stroke={INK}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="5" fill="none" stroke={DIM} strokeWidth="1.4" />
    </svg>
  );
}

function textColor(status: TodoStatus): string {
  if (status === "in_progress") return INK;
  if (status === "done") return MUTED;
  return MUTED;
}

export function TodoBlock({ todos }: { todos: TodoItem[] }) {
  const [open, setOpen] = useState(true);
  if (!todos.length) return null;

  return (
    <div
      style={{
        margin: "10px 0",
        borderRadius: 10,
        border: `1px solid ${HAIRLINE}`,
        padding: "2px 2px 4px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          border: "none",
          background: "transparent",
          color: MUTED,
          font: "inherit",
          fontSize: 13,
          padding: "6px 8px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path
            d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7"
            fill="none"
            stroke={MUTED}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span style={{ flex: 1 }}>To-dos {todos.length}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          aria-hidden
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <path
            d="M4 6.5 8 10.5 12 6.5"
            fill="none"
            stroke={MUTED}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open &&
        todos.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 26,
              padding: "1px 8px 1px 8px",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                display: "flex",
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <StatusMark status={item.status} />
            </span>
            <span
              title={item.text}
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 13,
                fontWeight: item.status === "in_progress" ? 500 : 400,
                color: textColor(item.status),
              }}
            >
              {item.text}
            </span>
          </div>
        ))}
    </div>
  );
}

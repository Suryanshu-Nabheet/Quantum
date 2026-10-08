import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { TodoItem, TodoStatus } from "core";
import { useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { setTodos } from "../../redux/slices/sessionSlice";
import { AppDispatch } from "../../redux/store";
import { varWithFallback } from "../../styles/theme";

const borderVar = varWithFallback("border");
const foregroundVar = varWithFallback("foreground");
const mutedVar = varWithFallback("description");
const hoverVar = varWithFallback("list-hover");
const accentVar = varWithFallback("accent");

const Block = styled.div`
  border: 1px solid ${borderVar};
  border-radius: 0.5rem;
  margin: 8px 0;
  font-size: 13px;
  color: ${foregroundVar};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  color: ${mutedVar};
`;

const HeaderLabel = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-align: left;
`;

const IconButton = styled.button<{ active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: ${(p) => (p.active ? hoverVar : "transparent")};
  color: ${(p) => (p.active ? accentVar : "inherit")};
  cursor: pointer;
  opacity: 0.85;

  &:hover {
    opacity: 1;
    background: ${hoverVar};
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  min-height: 24px;

  &:hover {
    background: ${hoverVar};
  }
`;

const StatusIcon = styled.span`
  display: flex;
  flex-shrink: 0;
  width: 14px;
  justify-content: center;
  color: ${accentVar};
`;

const RowText = styled.span<{ status: TodoStatus }>`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${(p) => (p.status === "done" ? mutedVar : foregroundVar)};
`;

function nextStatus(status: TodoStatus): TodoStatus {
  return status === "done" ? "pending" : "done";
}

function StatusGlyph({ status }: { status: TodoStatus }) {
  if (status === "done") {
    return <CheckCircleIcon width={14} height={14} />;
  }
  if (status === "in_progress") {
    return <ArrowPathIcon width={14} height={14} />;
  }
  return (
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: `1.5px solid ${mutedVar}`,
        display: "inline-block",
      }}
    />
  );
}

interface TodoBlockProps {
  todos: TodoItem[];
  /** Only the live (latest) list is editable; past snapshots are read-only. */
  editable: boolean;
}

/**
 * Cursor-style task block rendered inside the chat thread. Read-only by
 * default; the pencil opens edit mode, the only mode with controls.
 */
export function TodoBlock({ todos, editable }: TodoBlockProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);

  if (!todos.length) return null;

  const done = todos.filter((t) => t.status === "done").length;

  const update = (next: TodoItem[]) => dispatch(setTodos(next));

  const toggle = (id: string) =>
    update(
      todos.map((t) =>
        t.id === id ? { ...t, status: nextStatus(t.status) } : t,
      ),
    );

  const remove = (id: string) => update(todos.filter((t) => t.id !== id));

  return (
    <Block>
      <Header>
        <HeaderLabel onClick={() => setOpen((o) => !o)}>
          <span>To-dos</span>
          <span>{done}/{todos.length}</span>
          {open ? (
            <ChevronUpIcon width={12} height={12} />
          ) : (
            <ChevronDownIcon width={12} height={12} />
          )}
        </HeaderLabel>
        {editable && (
          <IconButton
            active={editing}
            aria-label={editing ? "Done editing todos" : "Edit todos"}
            title={editing ? "Done editing" : "Edit"}
            onClick={() => setEditing((e) => !e)}
          >
            <PencilSquareIcon width={13} height={13} />
          </IconButton>
        )}
      </Header>
      {open &&
        todos.map((item) => (
          <Row key={item.id}>
            {editing && editable ? (
              <IconButton
                aria-label={
                  item.status === "done" ? "Mark not done" : "Mark done"
                }
                onClick={() => toggle(item.id)}
              >
                <StatusGlyph status={item.status} />
              </IconButton>
            ) : (
              <StatusIcon>
                <StatusGlyph status={item.status} />
              </StatusIcon>
            )}
            <RowText status={item.status} title={item.text}>
              {item.text}
            </RowText>
            {editing && editable && (
              <IconButton
                aria-label="Remove todo"
                onClick={() => remove(item.id)}
              >
                <TrashIcon width={12} height={12} />
              </IconButton>
            )}
          </Row>
        ))}
    </Block>
  );
}
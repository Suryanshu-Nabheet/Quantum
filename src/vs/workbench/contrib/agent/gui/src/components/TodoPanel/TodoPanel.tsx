import { useAppSelector } from "../../redux/hooks";
import { TaskList } from "../ui/task-list";

export function ComposerTodos() {
  const todos = useAppSelector((state) => state.session.todos);
  if (!todos.length) {
    return null;
  }
  return (
    <div className="border-command-border border-b border-solid">
      <TaskList todos={todos} />
    </div>
  );
}

import { Chat } from "./Chat";

export default function GUI() {
  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <Chat />
    </div>
  );
}

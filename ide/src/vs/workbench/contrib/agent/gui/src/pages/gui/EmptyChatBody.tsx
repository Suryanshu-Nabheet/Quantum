import { ConversationStarterCards } from "../../components/ConversationStarters";

export interface EmptyChatBodyProps {
}

export function EmptyChatBody({ }: EmptyChatBodyProps) {
  return (
    <div className="mt-2">
      <ConversationStarterCards />
    </div>
  );
}

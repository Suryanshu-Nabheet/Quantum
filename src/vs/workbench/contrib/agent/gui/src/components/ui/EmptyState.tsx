interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-3">
      <span className="text-description text-center text-xs leading-snug">
        {message}
      </span>
    </div>
  );
}

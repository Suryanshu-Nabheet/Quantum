interface ActivityLabelProps {
  text: string;
  className?: string;
  status?: "Failed" | "Canceled";
}

export function ActivityLabel({
  text,
  className = "",
  status,
}: ActivityLabelProps) {
  const [action, ...detailParts] = text.trim().split(/\s+/);
  const detail = detailParts.join(" ");

  if (!action) {
    return null;
  }

  return (
    <span className={`trr-label agent-activity-label ${className}`.trim()}>
      <span className="trr-verb">
        {action.charAt(0).toUpperCase() + action.slice(1)}
      </span>
      {detail && <span className="agent-activity-detail">{detail}</span>}
      {status && (
        <span
          className={`agent-activity-status agent-activity-status-${status.toLowerCase()}`}
        >
          {status}
        </span>
      )}
    </span>
  );
}

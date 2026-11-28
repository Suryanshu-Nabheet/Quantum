import { ChevronRightIcon } from "@heroicons/react/24/outline";

export function ActivityChevron({ open }: { open: boolean }) {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className={`agent-activity-chevron${open ? " agent-activity-chevron-open" : ""}`}
    />
  );
}

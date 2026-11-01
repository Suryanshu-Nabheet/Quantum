import { InformationCircleIcon } from "@heroicons/react/24/outline";

const DEFAULT_SIZE = "5";

const sizeMap = {
  "3": "h-3 w-3",
  "4": "h-4 w-4",
  "5": "h-5 w-5",
  "6": "h-6 w-6",
  "8": "h-8 w-8",
} as const;

const InfoHover = ({
  size,
}: {
  id: string;
  msg?: unknown;
  size?: string;
}) => {
  const sizeClasses =
    sizeMap[size as keyof typeof sizeMap] ||
    sizeMap[DEFAULT_SIZE as keyof typeof sizeMap];

  return (
    <InformationCircleIcon
      className={`${sizeClasses} text-gray-500`}
      aria-hidden="true"
    />
  );
};

export default InfoHover;

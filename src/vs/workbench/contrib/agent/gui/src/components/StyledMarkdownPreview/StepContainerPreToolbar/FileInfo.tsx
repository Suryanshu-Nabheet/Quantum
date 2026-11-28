import { getLastNPathParts } from "core/util/uri";
import { MouseEventHandler } from "react";
import { ToolTip } from "../../gui/Tooltip";

export interface FileInfoProps {
  filepath: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  range?: string;
}

export const FileInfo = ({ filepath, range, onClick }: FileInfoProps) => {
  const filename = getLastNPathParts(filepath, 1);

  return (
    <ToolTip
      content={filename}
      place="top-end"
    >
      <div
        className={`flex select-none flex-row items-center gap-0.5 ${onClick && "cursor-pointer hover:underline"}`}
        onClick={onClick}
      >
        <span className="line-clamp-1 break-all">
          {filename}
          {range && ` ${range}`}
        </span>
      </div>
    </ToolTip>
  );
};

import { useMemo } from "react";
import theme from "../../../../../../../../extensions/quantum-theme/file-icons/quantum-icon-theme.json";
import { staticAssetUrl } from "../util/mediaUrl";

export interface FileIconProps {
  height: `${number}px`;
  width: `${number}px`;
  filename: string;
  kind?: "file" | "folder";
}

type IconTheme = {
  iconDefinitions: Record<string, { iconPath?: string }>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  file: string;
  folder: string;
};

const iconTheme = theme as IconTheme;

function indexLower(map: Record<string, string>): Record<string, string> {
  const indexed: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    indexed[key.toLowerCase()] = value;
  }
  return indexed;
}

const fileNames = indexLower(iconTheme.fileNames);
const fileExtensions = indexLower(iconTheme.fileExtensions);
const folderNames = indexLower(iconTheme.folderNames);

function basename(filename: string): string {
  const trimmed = filename.trim();
  if (trimmed.includes(" (")) {
    const parts = trimmed.split(" ");
    parts.pop();
    return basename(parts.join(" "));
  }
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return (slash >= 0 ? trimmed.slice(slash + 1) : trimmed).toLowerCase();
}

function iconIdFor(filename: string, kind: "file" | "folder"): string {
  const name = basename(filename);
  if (kind === "folder") {
    return folderNames[name] ?? iconTheme.folder;
  }
  if (fileNames[name]) {
    return fileNames[name];
  }
  const segments = name.split(".");
  for (let index = 1; index < segments.length; index++) {
    const extension = segments.slice(index).join(".");
    if (fileExtensions[extension]) {
      return fileExtensions[extension];
    }
  }
  return iconTheme.file;
}

function iconUrl(filename: string, kind: "file" | "folder"): string | undefined {
  const iconPath = iconTheme.iconDefinitions[iconIdFor(filename, kind)]?.iconPath;
  if (!iconPath) {
    return undefined;
  }
  return staticAssetUrl(`quantum-file-icons/${iconPath.replace(/^\.\//, "")}`);
}

export default function FileIcon({
  filename,
  height,
  width,
  kind = "file",
}: FileIconProps) {
  const src = useMemo(() => iconUrl(filename, kind), [filename, kind]);
  if (!src) {
    return null;
  }

  return (
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      style={{ width, height, flexShrink: 0, display: "block" }}
    />
  );
}

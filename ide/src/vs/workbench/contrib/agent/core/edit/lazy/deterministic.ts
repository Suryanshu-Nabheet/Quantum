import { DiffLine } from "../..";
import { myersDiff } from "../../diff/myers";

const LAZY_COMMENT_REGEX = /\.{3}\s*(.+?)\s*\.{3}/;

export function isLazyText(text: string): boolean {
  return LAZY_COMMENT_REGEX.test(text);
}

const REMOVAL_PERCENTAGE_THRESHOLD = 0.3;

function shouldRejectDiff(diff: DiffLine[]): boolean {
  const numRemovals = diff.filter((line) => line.type === "old").length;
  return numRemovals / diff.length > REMOVAL_PERCENTAGE_THRESHOLD;
}

export async function deterministicApplyLazyEdit({
  oldFile,
  newLazyFile,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  onlyFullFileRewrite?: boolean;
}): Promise<DiffLine[] | undefined> {
  if (isLazyText(newLazyFile)) {
    return undefined;
  }

  const diff = myersDiff(oldFile, newLazyFile);
  if (shouldRejectDiff(diff)) {
    return undefined;
  }

  return diff;
}

import { DiffLine, ILLM } from "../..";
import { generateLines } from "../../diff/util";
import { deterministicApplyLazyEdit } from "./deterministic";
import { streamLazyApply } from "./streamLazyApply";
import { applyUnifiedDiff, isUnifiedDiffFormat } from "./unifiedDiffApply";

export async function applyCodeBlock(
  oldFile: string,
  newLazyFile: string,
  filename: string,
  llm: ILLM,
  abortController: AbortController,
): Promise<{
  isInstantApply: boolean;
  diffLinesGenerator: AsyncGenerator<DiffLine>;
}> {
  const fullRewriteDiffLines = await deterministicApplyLazyEdit({
    oldFile,
    newLazyFile,
    filename,
    onlyFullFileRewrite: true,
  });

  if (fullRewriteDiffLines !== undefined) {
    return {
      isInstantApply: true,
      diffLinesGenerator: generateLines(fullRewriteDiffLines),
    };
  }

  // If the code block is a diff
  if (isUnifiedDiffFormat(newLazyFile)) {
    try {
      const diffLines = applyUnifiedDiff(oldFile, newLazyFile);
      return {
        isInstantApply: true,
        diffLinesGenerator: generateLines(diffLines!),
      };
    } catch (e) {
      console.error("Failed to apply unified diff", e);
    }
  }

  return {
    isInstantApply: false,
    diffLinesGenerator: streamLazyApply(
      oldFile,
      filename,
      newLazyFile,
      llm,
      abortController,
    ),
  };
}

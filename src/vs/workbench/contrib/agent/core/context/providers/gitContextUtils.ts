const GIT_CONTEXT_ID_PREFIX = "quantum-git:";

export function makeGitContextId(
  kind: "branch" | "commit",
  dir: string,
  id: string,
): string {
  return `${GIT_CONTEXT_ID_PREFIX}${kind}:${encodeURIComponent(dir)}:${encodeURIComponent(id)}`;
}

export function parseGitContextId(
  value: string,
  kind: "branch" | "commit",
): { dir: string; id: string } | undefined {
  const prefix = `${GIT_CONTEXT_ID_PREFIX}${kind}:`;
  if (!value.startsWith(prefix)) {
    return undefined;
  }
  const separator = value.indexOf(":", prefix.length);
  if (separator < 0) {
    return undefined;
  }
  try {
    return {
      dir: decodeURIComponent(value.slice(prefix.length, separator)),
      id: decodeURIComponent(value.slice(separator + 1)),
    };
  } catch {
    return undefined;
  }
}

export function workspaceLabel(
  dir: string,
  workspaceDirs: string[] = [],
): string {
  try {
    const url = new URL(dir);
    const path = url.pathname.replace(/\/+$/, "");
    const name = decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
    const sameName = workspaceDirs.filter((candidate) => {
      try {
        const candidatePath = new URL(candidate).pathname.replace(/\/+$/, "");
        return (
          decodeURIComponent(candidatePath.slice(candidatePath.lastIndexOf("/") + 1)) ===
          name
        );
      } catch {
        return false;
      }
    });
    if (sameName.length > 1) {
      const parent = decodeURIComponent(path.slice(0, path.lastIndexOf("/")));
      const parentName = parent.slice(parent.lastIndexOf("/") + 1);
      const qualified = `${parentName}/${name}`;
      const sameQualifiedName = sameName.filter((candidate) => {
        const candidatePath = new URL(candidate).pathname.replace(/\/+$/, "");
        const candidateParent = decodeURIComponent(
          candidatePath.slice(0, candidatePath.lastIndexOf("/")),
        );
        return (
          `${candidateParent.slice(candidateParent.lastIndexOf("/") + 1)}/${decodeURIComponent(candidatePath.slice(candidatePath.lastIndexOf("/") + 1))}` ===
          qualified
        );
      });
      return sameQualifiedName.length === 1 ? qualified : dir;
    }
    return name || dir;
  } catch {
    const path = dir.replace(/[\\/]+$/, "");
    return path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1) || dir;
  }
}

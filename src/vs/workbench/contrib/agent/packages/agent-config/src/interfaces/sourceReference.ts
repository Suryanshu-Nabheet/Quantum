type ProcessWithEnv = {
  env?: Record<string, string | undefined>;
};

function getProcessEnv(): Record<string, string | undefined> | undefined {
  if (
    typeof process !== "undefined" &&
    process &&
    typeof process === "object"
  ) {
    return (process as ProcessWithEnv).env;
  }

  if (typeof globalThis !== "undefined") {
    const maybeProcess = (globalThis as { process?: ProcessWithEnv }).process;
    return maybeProcess?.env;
  }

  return undefined;
}

function getHomeDirectory(): string | undefined {
  const env = getProcessEnv();
  const fromHome = env?.HOME?.trim();
  if (fromHome) {
    return fromHome;
  }
  const fromUserProfile = env?.USERPROFILE?.trim();
  if (fromUserProfile) {
    return fromUserProfile;
  }
  return undefined;
}

function expandLeadingTilde(identifier: string): string {
  const homeDirectory = getHomeDirectory();
  if (!homeDirectory) {
    return identifier;
  }
  return homeDirectory + identifier.slice(1);
}

/** Identifies where a markdown rule originated (file path). */
export interface SourceReference {
  uriType: "file";
  fileUri: string;
  /** Pre-read content — bypasses fs.readFileSync for vscode-remote:// URIs in WSL */
  content?: string;
}

export function sourceReferenceToDisplayName(id: SourceReference): string {
  return id.fileUri;
}

export function encodeSourceReference(identifier: SourceReference): string {
  return identifier.fileUri;
}

export function decodeSourceReference(identifier: string): SourceReference {
  if (identifier.startsWith("file://")) {
    return {
      uriType: "file",
      fileUri: identifier.substring(7),
    };
  }
  if (identifier.startsWith("~")) {
    return {
      uriType: "file",
      fileUri: expandLeadingTilde(identifier),
    };
  }
  return {
    uriType: "file",
    fileUri: identifier,
  };
}

import ignore from "ignore";

import { fileURLToPath } from "url";
import { AgentError, AgentErrorReason } from "../util/errors";

// Security-focused ignore patterns - these should always be excluded for security reasons
export const DEFAULT_SECURITY_IGNORE_FILETYPES = [
  // Environment and configuration files with secrets
  "*.env",
  "*.env.*",
  ".env*",
  "appsettings.json",
  "appsettings.*.json",
  "credentials.json",
  "credentials.yaml",
  "credentials.yml",
  "secrets.json",
  "secrets.yaml",
  "secrets.yml",

  // Certificate and key files
  "*.key",
  "*.pem",
  "*.p12",
  "*.pfx",
  "*.crt",
  "*.cer",
  "*.jks",
  "*.keystore",
  "*.truststore",

  // Database files that may contain sensitive data
  "*.db",
  "*.sqlite",
  "*.sqlite3",
  "*.mdb",
  "*.accdb",

  // Credential and secret files
  "*.secret",
  "*.secrets",

  "*.token",

  // Backup files that might contain sensitive data
  "*.bak",
  "*.backup",
  "*.old",
  "*.orig",

  // Docker secrets
  "docker-compose.override.yml",
  "docker-compose.override.yaml",

  // SSH and GPG
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "*.ppk",
  "*.gpg",
];

export const DEFAULT_SECURITY_IGNORE_DIRS = [
  // Environment and configuration directories
  ".env/",
  "env/",
  ".agent/",

  // Cloud provider credential directories
  ".aws/",
  ".gcp/",
  ".azure/",
  ".kube/",
  ".docker/",

  // Secret directories
  "secrets/",
  ".secrets/",
  "private/",
  ".private/",
  "certs/",
  "certificates/",
  "keys/",
  ".ssh/",
  ".gnupg/",
  ".gpg/",

  // Temporary directories that might contain sensitive data
  "tmp/secrets/",
  "temp/secrets/",
  ".tmp/",
];

// Additional non-security patterns for general indexing exclusion.
// Media stays out of the code index, but @ Files attach can still find it.
export const INLINE_IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** Extensions that are never inlined as text — path reference only (except vision-safe images above). */
export const PATH_ONLY_ATTACH_EXTS = new Set([
  "svg",
  "ico",
  "bmp",
  "avif",
  "mp4",
  "mov",
  "avi",
  "mpg",
  "mpeg",
  "mkv",
  "webm",
  "mp3",
  "wav",
  "flac",
  "ogg",
  "m4a",
  "pdf",
  "zip",
  "gz",
  "tar",
  "tgz",
  "rar",
  "7z",
  "dmg",
  "exe",
  "dll",
  "obj",
  "o",
  "a",
  "lib",
  "so",
  "dylib",
  "bin",
  "wasm",
  "onnx",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "otf",
  "jar",
  "parquet",
  "pqt",
  "pdb",
  "uasset",
]);

export const MEDIA_ATTACHABLE_EXTS = [
  ...Object.keys(INLINE_IMAGE_MIME_BY_EXT),
  "svg",
  "ico",
  "bmp",
  "avif",
  "mp4",
  "mov",
  "avi",
  "mpg",
  "mpeg",
  "mkv",
  "webm",
  "mp3",
  "wav",
  "pdf",
] as const;

export const MEDIA_ATTACHABLE_FILETYPES = MEDIA_ATTACHABLE_EXTS.map(
  (ext) => `*.${ext}`,
);

/** Glob that forces media into the @ Files picker even when the repo is huge. */
export const MEDIA_ATTACH_FIND_GLOB = `**/*.{${MEDIA_ATTACHABLE_EXTS.join(",")}}`;

export const ADDITIONAL_INDEXING_IGNORE_FILETYPES = [
  // Keep generic project configuration out of automatic indexing. Explicit
  // file attachment and targeted searches remain available to the user.
  "config.json",
  "config.yaml",
  "config.yml",
  "settings.json",
  "*.DS_Store",
  "*-lock.json",
  "*.lock",
  "*.log",
  "*.ttf",
  ...MEDIA_ATTACHABLE_FILETYPES,
  "*.zip",
  "*.gz",
  "*.tar",
  "*.dmg",
  "*.tgz",
  "*.rar",
  "*.7z",
  "*.exe",
  "*.dll",
  "*.obj",
  "*.o",
  "*.o.d",
  "*.a",
  "*.lib",
  "*.so",
  "*.dylib",
  "*.ncb",
  "*.sdf",
  "*.woff",
  "*.woff2",
  "*.eot",
  "*.cur",
  "*.jar",
  "*.onnx",
  "*.parquet",
  "*.pqt",
  "*.wasm",
  "*.plist",
  "*.profraw",
  "*.gcda",
  "*.gcno",
  "go.sum",
  "*.gitignore",
  "*.gitkeep",
  "*.agentignore",
  "*.csv",
  "*.uasset",
  "*.pdb",
  "*.bin",
  "*.pag",
  "*.swp",
  "*.jsonl",
  // Application specific
  ".agent/",
];

export const ADDITIONAL_INDEXING_IGNORE_DIRS = [
  ".git/",
  ".svn/",
  "node_modules/",
  "dist/",
  "build/",
  "Build/",
  "target/",
  "out/",
  "bin/",
  ".pytest_cache/",
  ".vscode-test/",
  "__pycache__/",
  "site-packages/",
  ".gradle/",
  ".mvn/",
  ".cache/",
  "gems/",
  "vendor/",

  ".venv/",
  "venv/",

  ".vscode/",
  ".idea/",
  ".vs/",
];

// Combined patterns: security + additional
export const DEFAULT_IGNORE_FILETYPES = [
  ...DEFAULT_SECURITY_IGNORE_FILETYPES,
  ...ADDITIONAL_INDEXING_IGNORE_FILETYPES,
];

export const DEFAULT_IGNORE_DIRS = [
  ...DEFAULT_SECURITY_IGNORE_DIRS,
  ...ADDITIONAL_INDEXING_IGNORE_DIRS,
];

export const DEFAULT_IGNORES = [
  ...DEFAULT_IGNORE_FILETYPES,
  ...DEFAULT_IGNORE_DIRS,
];

/**
 * Ignore list for @ Files attach: secrets + heavy dirs + trivial noise only.
 * Unlike indexing, do NOT blanket-exclude media / csv / fonts / etc. — the
 * picker must surface any workspace file the user might want to attach.
 */
export const DEFAULT_FILE_ATTACH_IGNORES = [
  ...DEFAULT_SECURITY_IGNORE_FILETYPES,
  ...DEFAULT_IGNORE_DIRS,
  "*.DS_Store",
  "*-lock.json",
  "*.lock",
  "*.log",
  "go.sum",
];

export const defaultIgnoresGlob = `!{${DEFAULT_IGNORES.join(",")}}`;

// Create ignore instances
export const defaultSecurityIgnoreFile = ignore().add(
  DEFAULT_SECURITY_IGNORE_FILETYPES,
);
export const defaultSecurityIgnoreDir = ignore().add(
  DEFAULT_SECURITY_IGNORE_DIRS,
);
export const defaultIgnoreFile = ignore().add(DEFAULT_IGNORE_FILETYPES);
export const defaultIgnoreDir = ignore().add(DEFAULT_IGNORE_DIRS);

// Combined ignore instances
export const defaultFileAndFolderSecurityIgnores = ignore()
  .add(defaultSecurityIgnoreFile)
  .add(defaultSecurityIgnoreDir);

export const defaultIgnoreFileAndDir = ignore()
  .add(defaultIgnoreFile)
  .add(defaultIgnoreDir);

function getDecodedUriPath(uriString: string): string | undefined {
  const schemeSeparator = uriString.indexOf("://");
  if (schemeSeparator < 0) {
    return undefined;
  }

  const authorityStart = schemeSeparator + 3;
  const pathStart = uriString.indexOf("/", authorityStart);
  if (pathStart < 0) {
    return "";
  }

  const rawPath = uriString.slice(pathStart).split(/[?#]/, 1)[0];
  const decodedSegments: string[] = [];
  try {
    for (const rawSegment of rawPath.split(/[\\/]/)) {
      const decodedSegment = decodeURIComponent(rawSegment);
      // Encoded separators are separators after URI decoding and must not
      // conceal a parent traversal segment from the policy check.
      for (const segment of decodedSegment.split(/[\\/]/)) {
        if (segment === "..") {
          return "..";
        }
        if (segment && segment !== ".") {
          decodedSegments.push(segment);
        }
      }
    }
  } catch {
    // A malformed resource URI cannot be safely classified. Fail closed.
    return "..";
  }

  return `${rawPath.startsWith("/") ? "/" : ""}${decodedSegments.join("/")}${rawPath.endsWith("/") ? "/" : ""}`;
}

export function isSecurityConcern(filePathOrUri: string) {
  if (!filePathOrUri) {
    return false;
  }
  let filepath = filePathOrUri;
  const decodedUriPath = getDecodedUriPath(filePathOrUri);
  if (decodedUriPath !== undefined) {
    if (decodedUriPath === "..") {
      return true;
    }
    if (/^file:\/\//i.test(filePathOrUri)) {
      try {
        filepath = fileURLToPath(filePathOrUri);
      } catch {
        return true;
      }
    } else {
      filepath = decodedUriPath;
    }
  }

  // The ignore library expects a workspace-relative, slash-separated path.
  // Keep every path segment: reducing this to the filename and immediate
  // parent misses files nested below protected directories.
  filepath = filepath.replace(/\\/g, "/").replace(/^\/+/, "");
  filepath = filepath.replace(/^[A-Za-z]:\//, "");
  const isDirectory = filepath.endsWith("/");
  const rawSegments = filepath.split("/").filter(Boolean);
  if (rawSegments.includes("..")) {
    return true;
  }
  const segments = rawSegments.filter((segment) => segment !== ".");
  if (segments.length === 0) {
    return false;
  }

  const normalizedPath = segments.join("/");
  if (defaultFileAndFolderSecurityIgnores.ignores(normalizedPath)) {
    return true;
  }

  // Evaluate every parent as a directory so sensitive directory patterns
  // still match when the path is several levels below the protected folder.
  for (let end = 1; end < segments.length; end++) {
    const directory = `${segments.slice(0, end).join("/")}/`;
    if (defaultFileAndFolderSecurityIgnores.ignores(directory)) {
      return true;
    }
  }

  return (
    isDirectory &&
    defaultFileAndFolderSecurityIgnores.ignores(`${normalizedPath}/`)
  );
}

export function throwIfFileIsSecurityConcern(filepath: string) {
  if (isSecurityConcern(filepath)) {
    throw new AgentError(
      AgentErrorReason.FileIsSecurityConcern,
      "Reading or editing this path is not allowed because it may contain sensitive information. Do not attempt to access it again.",
    );
  }
}

export function gitIgArrayFromFile(file: string) {
  return file
    .split(/\r?\n/) // Split on new line
    .map((l) => l.trim()) // Remove whitespace
    .filter((l) => !/^#|^$/.test(l)); // Remove empty lines
}

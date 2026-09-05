import ignore from "ignore";

import path from "path";
import { fileURLToPath } from "url";
import { AgentError, AgentErrorReason } from "../util/errors";

// Security-focused ignore patterns - these should always be excluded for security reasons
export const DEFAULT_SECURITY_IGNORE_FILETYPES = [
  // Environment and configuration files with secrets
  "*.env",
  "*.env.*",
  ".env*",
  "config.json",
  "config.yaml",
  "config.yml",
  "settings.json",
  "appsettings.json",
  "appsettings.*.json",

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

// String representations
export const DEFAULT_SECURITY_IGNORE =
  DEFAULT_SECURITY_IGNORE_FILETYPES.join("\n") +
  "\n" +
  DEFAULT_SECURITY_IGNORE_DIRS.join("\n");

export const DEFAULT_IGNORE =
  DEFAULT_IGNORE_FILETYPES.join("\n") + "\n" + DEFAULT_IGNORE_DIRS.join("\n");

// Combined ignore instances
export const defaultFileAndFolderSecurityIgnores = ignore()
  .add(defaultSecurityIgnoreFile)
  .add(defaultSecurityIgnoreDir);

export const defaultIgnoreFileAndDir = ignore()
  .add(defaultIgnoreFile)
  .add(defaultIgnoreDir);

export function isSecurityConcern(filePathOrUri: string) {
  if (!filePathOrUri) {
    return false;
  }
  let filepath = filePathOrUri;
  try {
    filepath = fileURLToPath(filePathOrUri);
  } catch {}
  if (path.isAbsolute(filepath)) {
    const dir = path.dirname(filepath).split(/\/|\\/).at(-1) ?? "";
    const basename = path.basename(filepath);
    filepath = `${dir ? dir + "/" : ""}${basename}`;
  }
  if (!filepath) {
    return false;
  }
  return defaultFileAndFolderSecurityIgnores.ignores(filepath);
}

export function throwIfFileIsSecurityConcern(filepath: string) {
  if (isSecurityConcern(filepath)) {
    throw new AgentError(
      AgentErrorReason.FileIsSecurityConcern,
      `Reading or Editing ${filepath} is not allowed because it is a security concern. Do not attempt to read or edit this file in any way.`,
    );
  }
}

export function gitIgArrayFromFile(file: string) {
  return file
    .split(/\r?\n/) // Split on new line
    .map((l) => l.trim()) // Remove whitespace
    .filter((l) => !/^#|^$/.test(l)); // Remove empty lines
}

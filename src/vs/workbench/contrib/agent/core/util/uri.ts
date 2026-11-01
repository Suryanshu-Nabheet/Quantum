import * as URI from "uri-js";

/** Converts any OS path to cleaned up URI path segment format with no leading/trailing slashes
   e.g. \path\to\folder\ -> path/to/folder
        \this\is\afile.ts -> this/is/afile.ts
        is/already/clean -> is/already/clean
  **/
export function pathToUriPathSegment(path: string) {
  let clean = path.replace(/[\\]/g, "/"); // backslashes -> forward slashes
  clean = clean.replace(/^\//, ""); // remove start slash
  clean = clean.replace(/\/$/, ""); // remove end slash
  return clean
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function getCleanUriPath(uri: string) {
  const path = URI.parse(uri).path ?? "";
  let clean = path.replace(/^\//, ""); // remove start slash
  clean = clean.replace(/\/$/, ""); // remove end slash
  return clean;
}

export function findUriInDirs(
  uri: string,
  dirUriCandidates: string[],
): {
  uri: string;
  relativePathOrBasename: string;
  foundInDir: string | null;
} {
  const uriComps = URI.parse(uri);
  if (!uriComps.scheme) {
    throw new Error(`Invalid uri: ${uri}`);
  }
  const uriPathParts = getCleanUriPath(uri).split("/");
  let bestMatch: {
    dir: string;
    relativePath: string;
    segmentCount: number;
  } | undefined;

  for (const dir of dirUriCandidates) {
    const dirComps = URI.parse(dir);

    if (!dirComps.scheme) {
      throw new Error(`Invalid uri: ${dir}`);
    }

    if (
      uriComps.scheme !== dirComps.scheme ||
      uriComps.host !== dirComps.host ||
      uriComps.port !== dirComps.port ||
      uriComps.userinfo !== dirComps.userinfo
    ) {
      continue;
    }
    // Can't just use startsWith because e.g.
    // file:///folder/file is not within file:///fold

    // At this point we break the path up and check if each dir path part matches
    const dirPathParts = getCleanUriPath(dir).split("/");

    if (uriPathParts.length < dirPathParts.length) {
      continue;
    }
    let allDirPartsMatch = true;
    for (let i = 0; i < dirPathParts.length; i++) {
      if (dirPathParts[i] !== uriPathParts[i]) {
        allDirPartsMatch = false;
      }
    }
    if (allDirPartsMatch) {
      const relativePath = uriPathParts
        .slice(dirPathParts.length)
        .map(decodeURIComponent)
        .join("/");
      if (!bestMatch || dirPathParts.length > bestMatch.segmentCount) {
        bestMatch = {
          dir,
          relativePath,
          segmentCount: dirPathParts.length,
        };
      }
    }
  }
  if (bestMatch) {
    return {
      uri,
      relativePathOrBasename: bestMatch.relativePath,
      foundInDir: bestMatch.dir,
    };
  }
  // Not found
  return {
    uri,
    relativePathOrBasename: getUriPathBasename(uri),
    foundInDir: null,
  };
}

/*
  Returns just the file or folder name of a URI
*/
export function getUriPathBasename(uri: string): string {
  const path = getCleanUriPath(uri);
  const basename = path.split("/").pop() || "";
  return decodeURIComponent(basename);
}

export function getFileExtensionFromBasename(basename: string) {
  const parts = basename.split(".");
  if (parts.length < 2) {
    return "";
  }
  return (parts.slice(-1)[0] ?? "").toLowerCase();
}

/*
  Returns the file extension of a URI
*/
export function getUriFileExtension(uri: string) {
  const baseName = getUriPathBasename(uri);
  return getFileExtensionFromBasename(baseName);
}

export function getLastNUriRelativePathParts(
  dirUriCandidates: string[],
  uri: string,
  n: number,
): string {
  const { relativePathOrBasename } = findUriInDirs(uri, dirUriCandidates);
  return getLastNPathParts(relativePathOrBasename, n);
}

export function joinPathsToUri(uri: string, ...pathSegments: string[]) {
  let baseUri = uri;
  if (baseUri.at(-1) !== "/") {
    baseUri += "/";
  }
  const segments = pathSegments.map((segment) => pathToUriPathSegment(segment));
  return URI.resolve(baseUri, segments.join("/"));
}

export function joinEncodedUriPathSegmentToUri(
  uri: string,
  pathSegment: string,
) {
  let baseUri = uri;
  if (baseUri.at(-1) !== "/") {
    baseUri += "/";
  }
  return URI.resolve(baseUri, pathSegment);
}

export function getShortestUniqueRelativeUriPaths(
  uris: string[],
  dirUriCandidates: string[],
): {
  uri: string;
  uniquePath: string;
}[] {
  // Split all URIs into segments and count occurrences of each suffix combination
  const segmentCombinationsMap = new Map<string, number>();
  const relativePathCounts = new Map<string, number>();
  const segmentsInfo = uris.map((uri) => {
    const { relativePathOrBasename, foundInDir } = findUriInDirs(
      uri,
      dirUriCandidates,
    );
    relativePathCounts.set(
      relativePathOrBasename,
      (relativePathCounts.get(relativePathOrBasename) ?? 0) + 1,
    );
    const segments = relativePathOrBasename.split("/");
    const suffixes: string[] = [];

    // Generate all possible suffix combinations, starting from the shortest (basename)
    for (let i = segments.length - 1; i >= 0; i--) {
      const suffix = segments.slice(i).join("/");
      suffixes.push(suffix); // Now pushing in order from shortest to longest
      // Count occurrences of each suffix
      segmentCombinationsMap.set(
        suffix,
        (segmentCombinationsMap.get(suffix) || 0) + 1,
      );
    }

    return { uri, segments, suffixes, relativePathOrBasename, foundInDir };
  });
  const rootQualifiedCounts = new Map<string, number>();
  for (const { relativePathOrBasename, foundInDir } of segmentsInfo) {
    if (relativePathCounts.get(relativePathOrBasename)! > 1 && foundInDir) {
      const qualifiedPath = `${getUriPathBasename(foundInDir)}/${relativePathOrBasename}`;
      rootQualifiedCounts.set(
        qualifiedPath,
        (rootQualifiedCounts.get(qualifiedPath) ?? 0) + 1,
      );
    }
  }
  // Find shortest unique path for each URI
  return segmentsInfo.map(
    ({ uri, suffixes, relativePathOrBasename, foundInDir }) => {
      // Since suffixes are ordered from shortest to longest, the first
      // unique one is the shortest useful label.
      let uniquePath =
        suffixes.find((suffix) => segmentCombinationsMap.get(suffix) === 1) ??
        relativePathOrBasename;
      if (relativePathCounts.get(relativePathOrBasename)! > 1 && foundInDir) {
        const rootQualifiedPath = `${getUriPathBasename(foundInDir)}/${relativePathOrBasename}`;
        uniquePath = rootQualifiedCounts.get(rootQualifiedPath) === 1
          ? rootQualifiedPath
          : joinPathsToUri(foundInDir, relativePathOrBasename);
      }
      return { uri, uniquePath };
    },
  );
}

// Only used when working with system paths and relative paths
// Since doesn't account for URI segements before workspace
export function getLastNPathParts(filepath: string, n: number): string {
  if (n <= 0) {
    return "";
  }
  return filepath.split(/[\\/]/).slice(-n).join("/");
}

export function getUriDescription(uri: string, dirUriCandidates: string[]) {
  const { relativePathOrBasename, foundInDir } = findUriInDirs(
    uri,
    dirUriCandidates,
  );
  const baseName = getUriPathBasename(uri);
  const extension = getFileExtensionFromBasename(baseName);
  const last2Parts = getLastNUriRelativePathParts(dirUriCandidates, uri, 2);
  return {
    uri,
    relativePathOrBasename,
    foundInDir,
    last2Parts,
    baseName,
    extension,
  };
}

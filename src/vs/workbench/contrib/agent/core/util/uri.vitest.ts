import { describe, it, expect } from "vitest";
import {
  pathToUriPathSegment,
  findUriInDirs,
  getUriPathBasename,
  getUriFileExtension,
  getFileExtensionFromBasename,
  getLastNUriRelativePathParts,
  joinPathsToUri,
  getShortestUniqueRelativeUriPaths,
  getLastNPathParts,
} from "./uri";

describe("uri utils", () => {
  describe("pathToUriPathSegment", () => {
    it("should convert Windows paths to URI segments", () => {
      expect(pathToUriPathSegment("\\path\\to\\folder\\")).toBe(
        "path/to/folder",
      );
      expect(pathToUriPathSegment("\\this\\is\\afile.ts")).toBe(
        "this/is/afile.ts",
      );
    });

    it("should clean Unix paths", () => {
      expect(pathToUriPathSegment("/path/to/folder/")).toBe("path/to/folder");
      expect(pathToUriPathSegment("is/already/clean")).toBe("is/already/clean");
    });

    it("should encode URI special characters", () => {
      expect(pathToUriPathSegment("path/with spaces/file")).toBe(
        "path/with%20spaces/file",
      );
      expect(pathToUriPathSegment("special#chars?in&path")).toBe(
        "special%23chars%3Fin%26path",
      );
    });
  });

  describe("findUriInDirs", () => {
    const dirUris = [
      "file:///workspace/project1",
      "file:///workspace/project2",
    ];

    it("should find URI in directory", () => {
      const result = findUriInDirs(
        "file:///workspace/project1/src/file.ts",
        dirUris,
      );
      expect(result).toEqual({
        uri: "file:///workspace/project1/src/file.ts",
        relativePathOrBasename: "src/file.ts",
        foundInDir: "file:///workspace/project1",
      });
    });

    it("prefers the most specific root for nested workspace folders", () => {
      expect(
        findUriInDirs("file:///workspace/packages/app/src/index.ts", [
          "file:///workspace",
          "file:///workspace/packages/app",
        ]),
      ).toEqual({
        uri: "file:///workspace/packages/app/src/index.ts",
        relativePathOrBasename: "src/index.ts",
        foundInDir: "file:///workspace/packages/app",
      });
    });

    it("does not match remote folders from a different authority", () => {
      expect(
        findUriInDirs(
          "vscode-remote://ssh-remote+two/workspace/src/index.ts",
          ["vscode-remote://ssh-remote+one/workspace"],
        ),
      ).toEqual({
        uri: "vscode-remote://ssh-remote+two/workspace/src/index.ts",
        relativePathOrBasename: "index.ts",
        foundInDir: null,
      });
    });

    it("should return basename when URI not in directories", () => {
      const result = findUriInDirs("file:///other/location/file.ts", dirUris);
      expect(result).toEqual({
        uri: "file:///other/location/file.ts",
        relativePathOrBasename: "file.ts",
        foundInDir: null,
      });
    });

    it("should throw error for invalid URIs", () => {
      expect(() => findUriInDirs("invalid-uri", dirUris)).toThrow(
        "Invalid uri: invalid-uri",
      );
    });
  });

  describe("URI path operations", () => {
    it("should get URI path basename", () => {
      expect(getUriPathBasename("file:///path/to/file.txt")).toBe("file.txt");
      expect(getUriPathBasename("file:///path/to/folder/")).toBe("folder");
    });

    it("should get URI file extension", () => {
      expect(getUriFileExtension("file:///path/to/file.TXT")).toBe("txt");
      expect(getUriFileExtension("file:///path/to/file")).toBe("");
    });

    it("should get file extension from basename", () => {
      expect(getFileExtensionFromBasename("file.txt")).toBe("txt");
      expect(getFileExtensionFromBasename("file")).toBe("");
    });
  });

  describe("joinPathsToUri", () => {
    it("should join paths to base URI", () => {
      expect(joinPathsToUri("file:///base", "path", "to", "file.txt")).toBe(
        "file:///base/path/to/file.txt",
      );
    });

    it("should handle paths with special characters", () => {
      expect(
        joinPathsToUri("file:///base", "path with spaces", "file.txt"),
      ).toBe("file:///base/path%20with%20spaces/file.txt");
    });
  });

  describe("getShortestUniqueRelativeUriPaths", () => {
    it("should find shortest unique paths", () => {
      const uris = [
        "file:///workspace/project1/src/components/Button.tsx",
        "file:///workspace/project1/src/utils/Button.tsx",
      ];
      const dirUris = ["file:///workspace/project1"];

      const result = getShortestUniqueRelativeUriPaths(uris, dirUris);
      expect(result).toEqual([
        {
          uri: "file:///workspace/project1/src/components/Button.tsx",
          uniquePath: "components/Button.tsx",
        },
        {
          uri: "file:///workspace/project1/src/utils/Button.tsx",
          uniquePath: "utils/Button.tsx",
        },
      ]);
    });

    it("qualifies identical relative paths with their workspace roots", () => {
      const uris = [
        "file:///workspace/app/src/index.ts",
        "file:///workspace/shared/src/index.ts",
      ];

      expect(
        getShortestUniqueRelativeUriPaths(uris, [
          "file:///workspace/app",
          "file:///workspace/shared",
        ]),
      ).toEqual([
        { uri: uris[0], uniquePath: "app/src/index.ts" },
        { uri: uris[1], uniquePath: "shared/src/index.ts" },
      ]);
    });

    it("uses the full root URI when workspace folder names are identical", () => {
      const uris = [
        "file:///workspace/apps/web/src/index.ts",
        "file:///workspace/packages/web/src/index.ts",
      ];
      const results = getShortestUniqueRelativeUriPaths(uris, [
        "file:///workspace/apps/web",
        "file:///workspace/packages/web",
      ]);

      expect(results.map((result) => result.uniquePath)).toEqual([
        "file:///workspace/apps/web/src/index.ts",
        "file:///workspace/packages/web/src/index.ts",
      ]);
    });
  });

  describe("getLastNPathParts", () => {
    it("should get last N parts of path", () => {
      expect(getLastNPathParts("path/to/some/file.txt", 2)).toBe(
        "some/file.txt",
      );
      expect(getLastNPathParts("path/to/some/file.txt", 0)).toBe("");
    });

    it("should handle Windows paths", () => {
      expect(getLastNPathParts("path\\to\\some\\file.txt", 2)).toBe(
        "some/file.txt",
      );
    });
  });

  describe("getLastNUriRelativePathParts", () => {
    it("should get last N parts of URI relative path", () => {
      const dirUris = ["file:///workspace/project1"];
      const uri = "file:///workspace/project1/src/components/Button.tsx";

      expect(getLastNUriRelativePathParts(dirUris, uri, 2)).toBe(
        "components/Button.tsx",
      );
    });

    it("should handle URI not in directories", () => {
      const dirUris = ["file:///workspace/project1"];
      const uri = "file:///other/path/file.txt";

      expect(getLastNUriRelativePathParts(dirUris, uri, 2)).toBe("file.txt");
    });
  });
});

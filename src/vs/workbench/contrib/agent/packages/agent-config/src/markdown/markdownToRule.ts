import * as YAML from "yaml";
import {
  SourceReference,
  sourceReferenceToDisplayName,
} from "../browser.js";
import { RuleObject } from "../schemas/index.js";

export interface RuleFrontmatter {
  globs?: RuleObject["globs"];
  regex?: RuleObject["regex"];
  name?: RuleObject["name"];
  description?: RuleObject["description"];
  alwaysApply?: RuleObject["alwaysApply"];
  invokable?: RuleObject["invokable"];
}

/**
 * Parses markdown content with YAML frontmatter
 */
export function parseMarkdownRule(content: string): {
  frontmatter: RuleFrontmatter;
  markdown: string;
  parseError?: Error;
} {
  // Normalize line endings to \n
  const normalizedContent = content.replace(/\r\n/g, "\n");

  // More reliable frontmatter detection
  const parts = normalizedContent.split(/^---\s*$/m);

  // If we have at least 3 parts (before ---, frontmatter, after ---), we have frontmatter
  if (parts.length >= 3) {
    const frontmatterStr = parts[1];
    // Join the remaining parts back together (in case there are more --- in the markdown)
    const markdownContent = parts.slice(2).join("---");

    try {
      // Parse YAML frontmatter
      const frontmatter = YAML.parse(frontmatterStr) || {}; // Handle empty frontmatter
      return { frontmatter, markdown: markdownContent.trim() };
    } catch (e) {
      const parseError =
        e instanceof Error ? e : new Error("Invalid YAML frontmatter");
      return { frontmatter: {}, markdown: normalizedContent, parseError };
    }
  }

  // No frontmatter found
  return { frontmatter: {}, markdown: normalizedContent };
}

export function getRuleName(
  frontmatter: RuleFrontmatter,
  id: SourceReference,
): string {
  if (frontmatter.name) {
    return frontmatter.name;
  }

  const displayName = sourceReferenceToDisplayName(id);
  const segments = displayName.split(/[/\\]/);
  const lastTwoParts = segments.slice(-2);
  return lastTwoParts.filter(Boolean).join("/");
}

function getGlobPattern(globs: RuleFrontmatter["globs"], relativeDir?: string) {
  if (relativeDir === undefined) {
    return globs;
  }
  if (relativeDir.includes(".agent")) {
    return globs;
  }
  if (!relativeDir.endsWith("/")) {
    relativeDir = relativeDir.concat("/");
  }
  const prependDirAndApplyGlobstar = (glob: string) => {
    if (glob.startsWith("**")) {
      return relativeDir.concat(glob);
    }
    return relativeDir.concat("**/", glob);
  };
  if (!globs) {
    return relativeDir.concat("**/*");
  }
  if (Array.isArray(globs)) {
    return globs.map(prependDirAndApplyGlobstar);
  }
  return prependDirAndApplyGlobstar(globs);
}

export function markdownToRule(
  rule: string,
  id: SourceReference,
  relativePathForGlobs?: string,
): RuleObject {
  const { frontmatter, markdown } = parseMarkdownRule(rule);

  return {
    name: getRuleName(frontmatter, id),
    rule: markdown,
    globs: getGlobPattern(frontmatter.globs, relativePathForGlobs),
    regex: frontmatter.regex,
    description: frontmatter.description,
    alwaysApply: frontmatter.alwaysApply,
    invokable: frontmatter.invokable,
    sourceFile: id.uriType === "file" ? id.fileUri : undefined,
  };
}

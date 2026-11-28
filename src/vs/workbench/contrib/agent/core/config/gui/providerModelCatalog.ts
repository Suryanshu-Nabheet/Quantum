const AUTODETECT = "AUTODETECT";

/**
 * Normalize live model listings and exclude non-language model endpoints.
 */
export function filterListedModelNames(names: string[]): string[] {
  return Array.from(
    new Set(
      names
        .map((n) => n.trim())
        .filter(
          (n) =>
            n.length > 0 &&
            n.toUpperCase() !== AUTODETECT &&
            !n.toLowerCase().includes("embed") &&
            !n.toLowerCase().includes("whisper"),
        ),
    ),
  );
}

export { AUTODETECT };

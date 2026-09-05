import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { describe, expect, it } from "vitest";

import {
  acknowledgeQuantumStorageSnapshot,
  readQuantumStorageSnapshot,
  saveQuantumStorageSnapshot,
  QUANTUM_STORAGE_SNAPSHOT_MAX_BYTES,
  validateQuantumStorageSnapshot,
} from "./desktopStorageMigration";

const snapshot = (exportedAt = "2026-07-09T00:00:00.000Z") => ({
  version: 1 as const,
  exportedAt,
  entries: {
    "quantum:theme": "dark",
    "quantum.openUsage.enabled": "true",
  },
});

describe("desktopStorageMigration", () => {
  it("round-trips atomically and acknowledges the snapshot", async () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "quantum-storage-migration-"));
    const target = Path.join(directory, "snapshot.json");
    try {
      await expect(saveQuantumStorageSnapshot(target, snapshot())).resolves.toBe(true);
      expect(readQuantumStorageSnapshot(target)).toEqual(snapshot());
      expect(FS.readdirSync(directory)).toEqual(["snapshot.json"]);

      await acknowledgeQuantumStorageSnapshot(target);
      expect(readQuantumStorageSnapshot(target)).toBeNull();
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed, disallowed, and oversized snapshots", () => {
    expect(validateQuantumStorageSnapshot({ version: 1 })).toBeNull();
    expect(
      validateQuantumStorageSnapshot({
        ...snapshot(),
        entries: { "foreign:theme": "dark" },
      }),
    ).toBeNull();
    expect(
      validateQuantumStorageSnapshot({
        ...snapshot(),
        entries: { "quantum:large": "x".repeat(QUANTUM_STORAGE_SNAPSHOT_MAX_BYTES) },
      }),
    ).toBeNull();
  });

  it("accepts renderer snapshots containing large composer drafts", () => {
    const largeDraft = "x".repeat(2 * 1024 * 1024);

    expect(
      validateQuantumStorageSnapshot({
        ...snapshot(),
        entries: { "quantum:composer-drafts:v1": largeDraft },
      })?.entries["quantum:composer-drafts:v1"],
    ).toBe(largeDraft);
  });

  it("does not replace a newer snapshot with an older export", async () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "quantum-storage-migration-"));
    const target = Path.join(directory, "snapshot.json");
    try {
      await saveQuantumStorageSnapshot(target, snapshot("2026-07-09T01:00:00.000Z"));
      await expect(
        saveQuantumStorageSnapshot(target, snapshot("2026-07-09T00:00:00.000Z")),
      ).resolves.toBe(false);
      expect(readQuantumStorageSnapshot(target)?.exportedAt).toBe("2026-07-09T01:00:00.000Z");
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("treats missing and malformed files as absent", () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "quantum-storage-migration-"));
    const target = Path.join(directory, "snapshot.json");
    try {
      expect(readQuantumStorageSnapshot(target)).toBeNull();
      FS.writeFileSync(target, "not json");
      expect(readQuantumStorageSnapshot(target)).toBeNull();
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });
});

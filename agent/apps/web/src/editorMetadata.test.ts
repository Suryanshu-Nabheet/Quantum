import { describe, expect, it } from "vitest";
import { EDITOR_ICON_ROUTE_PATH } from "@quantum/shared/editorIcons";
import {
  resolveAvailableEditorOptions,
  resolveEditorIcon,
  resolveEditorLabel,
  resolveEditorNativeIconUrl,
} from "./editorMetadata";

describe("resolveEditorLabel", () => {
  it("uses platform-specific labels for the file manager option", () => {
    expect(resolveEditorLabel("file-manager", "MacIntel")).toBe("Finder");
    expect(resolveEditorLabel("file-manager", "Win32")).toBe("Explorer");
    expect(resolveEditorLabel("file-manager", "Linux x86_64")).toBe("Files");
  });
});

describe("resolveAvailableEditorOptions", () => {
  it("surfaces every supported available editor from the shared contracts catalog", () => {
    expect(
      resolveAvailableEditorOptions("MacIntel", ["quantum", "file-manager", "system-default"]).map(
        (option) => option.value,
      ),
    ).toEqual(["quantum", "file-manager", "system-default"]);
  });

  it("provides dedicated icons for supported editor rows", () => {
    expect(resolveEditorIcon("quantum").name).toBe("VisualStudioCode");
    expect(resolveEditorIcon("file-manager").name).toBe("FolderClosed");
  });

  it("builds authenticated editor icon route urls", () => {
    expect(resolveEditorNativeIconUrl("quantum")).toContain(`${EDITOR_ICON_ROUTE_PATH}?id=quantum`);
  });
});

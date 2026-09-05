import { setLocalStorage } from "./localStorage";

describe("localStorage Test", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should stringify and set value in localStorage", () => {
    const MOCK_IDE_VALUE = "vscode";
    setLocalStorage("ide", MOCK_IDE_VALUE);
    expect(JSON.parse(localStorage.getItem("ide") || "")).toEqual(
      MOCK_IDE_VALUE,
    );
  });
});

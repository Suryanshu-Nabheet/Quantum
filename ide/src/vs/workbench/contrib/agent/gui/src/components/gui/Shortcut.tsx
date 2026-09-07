import React from "react";
import {
  getAltKeyLabel,
  getMetaKeyLabel,
  getPlatform,
} from "../../util";
import "./Shortcut.css";

interface ShortcutProps {
  children: string;
}

const metaKeys = ["meta", "⌘", "ctrl", "cmd", "^"];
const altKeys = ["alt", "option", "opt", "⌥"];
const shiftKeys = ["shift", "⇧"];

/** Compact keycap labels — symbols over verbose words. */
const getSpecialKeyMap = (): Record<string, string> => ({
  uparrow: "↑",
  downarrow: "↓",
  leftarrow: "←",
  rightarrow: "→",
  enter: "⏎",
  return: "⏎",
  esc: "Esc",
  escape: "Esc",
  backspace: "⌫",
  delete: "⌫",
  "⌫": "⌫",
  space: "Space",
  tab: "Tab",
});

const parseShortcut = (shortcut: string) => {
  if (!shortcut || typeof shortcut !== "string") {
    console.warn("Invalid shortcut provided:", shortcut);
    return [];
  }

  const specialKeyMap = getSpecialKeyMap();
  return shortcut
    .split(",")
    .map((combo) =>
      combo
        .trim()
        .split(" ")
        .filter((key) => key)
        .map((key) => {
          const lowerKey = key.toLowerCase();
          if (metaKeys.includes(lowerKey)) {
            return getMetaKeyLabel();
          }
          if (altKeys.includes(lowerKey)) {
            return getAltKeyLabel();
          }
          if (shiftKeys.includes(lowerKey)) {
            return getPlatform() === "mac" ? "⇧" : "Shift";
          }
          return specialKeyMap[lowerKey] || capitalizeKey(key);
        }),
    )
    .filter((combo) => combo.length > 0);
};

const capitalizeKey = (key: string) =>
  key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();

const isSymbolOrSingleChar = (key: string) =>
  key.length === 1 || ["⌘", "⌥", "⇧", "⌃", "⏎", "⌫", "↑", "↓", "←", "→"].includes(key);

const Shortcut: React.FC<ShortcutProps> = ({ children }) => {
  if (!children || typeof children !== "string") {
    return <span className="text-description text-xs">Invalid shortcut</span>;
  }

  const shortcuts = parseShortcut(children);

  return (
    <span className="shortcut" aria-label={children}>
      {shortcuts.map((combo, comboIndex) => (
        <React.Fragment key={comboIndex}>
          {combo.map((key, keyIndex) => (
            <React.Fragment key={keyIndex}>
              <kbd
                className={`keyboard-key ${
                  isSymbolOrSingleChar(key)
                    ? "keyboard-key-normal"
                    : "keyboard-key-special"
                }`}
              >
                {key || "?"}
              </kbd>
              {keyIndex < combo.length - 1 && (
                <span className="separator" aria-hidden>
                  +
                </span>
              )}
            </React.Fragment>
          ))}
          {comboIndex < shortcuts.length - 1 && (
            <span className="separator separator-chord" aria-hidden>
              ·
            </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
};

export default Shortcut;

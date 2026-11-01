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
  comma: ",",
  ",": ",",
  period: ".",
  ".": ".",
  slash: "/",
  "/": "/",
  quote: "'",
  apostrophe: "'",
  "'": "'",
});

const MODIFIER_START =
  /^(cmd|ctrl|meta|alt|option|opt|shift|⌘|⌥|⇧)\b/i;

/**
 * Split chord sequences like "cmd K, cmd A" without treating a literal
 * comma key ("cmd ,") as a chord delimiter.
 */
export function splitShortcutCombos(shortcut: string): string[] {
  const parts = shortcut.split(",");
  if (parts.length === 1) {
    return [shortcut.trim()].filter(Boolean);
  }

  const combos: string[] = [];
  let buffer = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i];
    const nextTrim = next.trim();
    const nextIsNewCombo =
      nextTrim.length > 0 &&
      MODIFIER_START.test(nextTrim) &&
      MODIFIER_START.test(buffer.trim());
    if (nextIsNewCombo) {
      combos.push(buffer.trim());
      buffer = next;
    } else {
      // Comma was a key (e.g. "cmd ,") — put it back.
      buffer = `${buffer},${next}`;
    }
  }
  combos.push(buffer.trim());
  return combos.filter((c) => c.length > 0);
}

export const parseShortcut = (shortcut: string) => {
  if (!shortcut || typeof shortcut !== "string") {
    console.warn("Invalid shortcut provided:", shortcut);
    return [];
  }

  const specialKeyMap = getSpecialKeyMap();
  return splitShortcutCombos(shortcut)
    .map((combo) =>
      combo
        .trim()
        .split(/\s+/)
        .filter((key) => key.length > 0)
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
          if (specialKeyMap[lowerKey] !== undefined) {
            return specialKeyMap[lowerKey];
          }
          if (specialKeyMap[key] !== undefined) {
            return specialKeyMap[key];
          }
          return capitalizeKey(key);
        }),
    )
    .filter((combo) => combo.length > 0);
};

const capitalizeKey = (key: string) => {
  if (key.length <= 1) {
    return key;
  }
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
};

const isSymbolOrSingleChar = (key: string) =>
  key.length === 1 ||
  ["⌘", "⌥", "⇧", "⌃", "⏎", "⌫", "↑", "↓", "←", "→"].includes(key);

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

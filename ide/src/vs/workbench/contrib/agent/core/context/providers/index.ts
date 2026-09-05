import { BaseContextProvider } from "../";
import { ContextProviderName } from "../../";

import BranchContextProvider from "./BranchContextProvider";
import CommitContextProvider from "./CommitContextProvider";
import BrowserContextProvider from "./BrowserContextProvider";

import DiffContextProvider from "./DiffContextProvider";
import FileContextProvider from "./FileContextProvider";
import FolderContextProvider from "./FolderContextProvider";
import MCPContextProvider from "./MCPContextProvider";

import ProblemsContextProvider from "./ProblemsContextProvider";
import RulesContextProvider from "./RulesContextProvider";
import SearchContextProvider from "./SearchContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";

export const Providers: (typeof BaseContextProvider)[] = [
  FileContextProvider,
  DiffContextProvider,
  TerminalContextProvider,

  SearchContextProvider,
  ProblemsContextProvider,
  FolderContextProvider,

  MCPContextProvider,
  BranchContextProvider,
  CommitContextProvider,
  RulesContextProvider,
  BrowserContextProvider,
];

export function contextProviderClassFromName(
  name: ContextProviderName,
): typeof BaseContextProvider | undefined {
  const provider = Providers.find((cls) => cls.description.title === name);

  return provider;
}

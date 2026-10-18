import { IContextProvider } from "core";

import { WorkbenchExtension } from "../extension/WorkbenchExtension";

export class WorkbenchAgentApi {
  constructor(private readonly workbenchExtension: WorkbenchExtension) {}

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.workbenchExtension.registerCustomContextProvider(contextProvider);
  }
}

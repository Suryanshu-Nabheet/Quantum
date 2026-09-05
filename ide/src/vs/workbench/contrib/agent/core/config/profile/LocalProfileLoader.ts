import { ConfigResult } from "agent-config";

import { AgentConfig, IDE, ILLMLogger } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

import { getGlobalContextFilePath } from "../../util/paths.js";
import { localPathToUri } from "../../util/pathToUri.js";
import { getUriPathBasename } from "../../util/uri.js";
import doLoadConfig from "./doLoadConfig.js";
import { IProfileLoader } from "./IProfileLoader.js";

export default class LocalProfileLoader implements IProfileLoader {
  static ID = "local";

  constructor(
    private ide: IDE,
    private llmLogger: ILLMLogger,
    private overrideSettingsFile?:
      | { path: string; content: string }
      | undefined,
  ) {
    const description: ProfileDescription = {
      id: overrideSettingsFile?.path ?? LocalProfileLoader.ID,
      profileType: "local",
      iconUrl: "",
      title: overrideSettingsFile?.path
        ? getUriPathBasename(overrideSettingsFile.path)
        : "Quantum Settings",
      errors: undefined,
      uri:
        overrideSettingsFile?.path ??
        localPathToUri(getGlobalContextFilePath()),
    };
    this.description = description;
  }
  description: ProfileDescription;

  async doLoadConfig(): Promise<ConfigResult<AgentConfig>> {
    const result = await doLoadConfig({
      ide: this.ide,
      llmLogger: this.llmLogger,
      profileId: this.description.id,
    });

    this.description.errors = result.errors;

    return result;
  }

  setIsActive(_isActive: boolean): void {}
}

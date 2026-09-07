import {
  ArrowTopRightOnSquareIcon,
  CodeBracketSquareIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { AGENT_NAME, IDE_NAME } from "core/util/branding";
import { useContext } from "react";
import { Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getLocalStorage } from "../../../util/localStorage";
import { ConfigHeader } from "../components/ConfigHeader";
import { ConfigRow } from "../components/ConfigRow";
import { CONFIG_HAIRLINE_DIVIDE, CONFIG_PAGE_GAP } from "../configLayout";
import { DOCS_URL } from "../configNav";

const REPOSITORY_URL = DOCS_URL;
const ISSUES_URL = "https://github.com/Suryanshu-Nabheet/Quantum/issues";
const VSCODE_ATTRIBUTION_URL = "https://github.com/microsoft/vscode";
const DEVELOPER_URL = "https://github.com/Suryanshu-Nabheet";

const ABOUT_TAGLINE = "The AI-native code editor";

function readExtensionVersion(): string {
  return getLocalStorage("extensionVersion") ?? "0.0.1";
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-description m-0 text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground m-0 mt-1 text-sm font-medium leading-5">
        {value}
      </p>
    </div>
  );
}

export function AboutSection() {
  const ideMessenger = useContext(IdeMessengerContext);
  const version = readExtensionVersion();

  const openUrl = (url: string) => {
    ideMessenger.post("openUrl", url);
  };

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="About"
        subtext={ABOUT_TAGLINE}
        showAddButton={false}
      />

      <div className={CONFIG_PAGE_GAP}>
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-4">
            <p className="text-foreground m-0 text-base font-semibold tracking-tight">
              {IDE_NAME}
            </p>
            <p className="text-description m-0 mt-2 text-sm leading-relaxed">
              {IDE_NAME} is a fork of Visual Studio Code with {AGENT_NAME}{" "}
              built in — chat, inline edit, autocomplete, and autonomous tools in
              one editor.
            </p>

            <div className="mt-4 grid gap-4 border-0 border-t border-solid border-t-[color:var(--vscode-sideBar-border,rgba(128,128,128,0.22))] pt-4 sm:grid-cols-2">
              <MetaField label={AGENT_NAME} value={`v${version}`} />
              <MetaField label="Founder" value="Suryanshu Nabheet" />
            </div>

            <p className="text-description-muted m-0 mt-4 text-xs leading-relaxed">
              MIT licensed · Built on the VS Code platform
            </p>
          </div>
        </Card>

        <div>
          <ConfigHeader title="Links" variant="sm" showAddButton={false} />
          <Card className="!p-0 overflow-hidden">
            <div className={`flex flex-col ${CONFIG_HAIRLINE_DIVIDE}`}>
              <ConfigRow
                title="Repository"
                description={`${AGENT_NAME} source, releases, and docs.`}
                icon={CodeBracketSquareIcon}
                className="!rounded-none"
                onClick={() => openUrl(REPOSITORY_URL)}
              />
              <ConfigRow
                title="Report an issue"
                description="Bug reports and feature requests on GitHub."
                icon={ArrowTopRightOnSquareIcon}
                className="!rounded-none"
                onClick={() => openUrl(ISSUES_URL)}
              />
              <ConfigRow
                title="Visual Studio Code"
                description="Upstream editor this IDE is forked from."
                icon={ArrowTopRightOnSquareIcon}
                className="!rounded-none"
                onClick={() => openUrl(VSCODE_ATTRIBUTION_URL)}
              />
              <ConfigRow
                title="Developer"
                description="Suryanshu Nabheet on GitHub."
                icon={UserCircleIcon}
                className="!rounded-none"
                onClick={() => openUrl(DEVELOPER_URL)}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

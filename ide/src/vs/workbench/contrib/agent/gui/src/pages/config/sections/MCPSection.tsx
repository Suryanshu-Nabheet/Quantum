import { MCPServer } from "agent-config";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  CircleStackIcon,
  CommandLineIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlayCircleIcon,
  StopCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { MCPConnectionStatus, MCPServerStatus } from "core";
import { useContext, useMemo, useState } from "react";
import Alert from "../../../components/gui/Alert";
import { ToolTip } from "../../../components/gui/Tooltip";
import {
  Button,
  Card,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { AddMcpServerForm } from "../../../forms/AddMcpServerForm";
import ConfirmationDialog from "../../../components/dialogs/ConfirmationDialog";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { QUANTUM_SETTINGS_SCHEME } from "core/config/guiUris";
import { ConfigEmptyAction } from "../components/ConfigEmptyAction";
import { ConfigHeader } from "../components/ConfigHeader";
import { CONFIG_PAGE_GAP, CONFIG_HAIRLINE_DIVIDE } from "../configLayout";
import { ToolPoliciesGroup } from "../components/ToolPoliciesGroup";

function mcpStatusToEditableServer(server: MCPServerStatus): MCPServer {
  if ("command" in server) {
    return {
      name: server.name,
      command: server.command,
      args: server.args,
      env: server.env,
    };
  }

  if (server.type === "sse") {
    return {
      name: server.name,
      url: server.url,
      type: "sse",
      apiKey: server.apiKey,
    };
  }

  return {
    name: server.name,
    url: server.url,
    type: "streamable-http",
    apiKey: "apiKey" in server ? server.apiKey : undefined,
  };
}

interface MCPServerStatusProps {
  allToolsOff: boolean;
  server: MCPServerStatus;
  duplicateDetection: Record<string, boolean>;
  onEditServer: (server: MCPServerStatus) => void;
  onDeleteServer: (server: MCPServerStatus) => void;
}

const ServerStatusTooltip: Record<MCPConnectionStatus, string> = {
  connected: "Active",
  connecting: "Connecting",
  "not-connected": "Inactive",
  disabled: "Off",
  authenticating: "Authenticating",
  error: "Error",
};

const ServerStatusColor: Record<MCPConnectionStatus, string> = {
  connected: "bg-success",
  connecting: "bg-warning",
  "not-connected": "bg-description-muted",
  disabled: "bg-description-muted",
  authenticating: "bg-warning",
  error: "bg-error",
};

function MCPServerPreview({
  server,
  allToolsOff,
  duplicateDetection,
  onEditServer,
  onDeleteServer,
}: MCPServerStatusProps) {
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({});
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((store) => store.config.config);
  const dispatch = useAppDispatch();
  const updateMCPServerStatus = (status: MCPServerStatus["status"]) => {
    // optimistic config update
    dispatch(
      updateConfig({
        ...config,
        mcpServerStatuses: config.mcpServerStatuses.map((s) =>
          s.id === server.id
            ? {
                ...s,
                status,
              }
            : s,
        ),
      }),
    );
  };


  const onRefresh = async () => {
    updateMCPServerStatus("connecting");
    if (server.status === "disabled") {
      await ideMessenger.request("mcp/setServerEnabled", {
        id: server.id,
        enabled: true,
      });
    } else {
      await ideMessenger.request("mcp/reloadServer", {
        id: server.id,
      });
    }
  };

  const onDisconnect = async () => {
    updateMCPServerStatus("disabled");
    dispatch(
      updateConfig({
        ...config,
        tools: config.tools.filter((tool) => tool.group !== server.id),
      }),
    );
    await ideMessenger.request("mcp/setServerEnabled", {
      id: server.id,
      enabled: false,
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const ResourceRow = ({
    title,
    items,
    icon,
    sectionKey,
  }: {
    title: string;
    items:
      | MCPServerStatus["prompts"]
      | MCPServerStatus["resources"]
      | MCPServerStatus["resourceTemplates"];
    icon: React.ReactNode;
    sectionKey: string;
  }) => {
    const isExpanded = expandedSections[sectionKey];
    const hasItems = items.length > 0;

    return (
      <div>
        <div
          className="mx-2 flex cursor-pointer items-center justify-between rounded hover:bg-input hover:bg-opacity-5"
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="flex items-center gap-3">
            <ChevronDownIcon
              className={`text-description h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm">{title}</span>
              <div className="bg-input text-description flex h-5 min-w-5 items-center justify-center rounded px-1 text-2xs font-medium">
                {items.length}
              </div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mx-2 my-2 mb-3">
            {hasItems ? (
              <div className="space-y-1">
                {items.map((item, idx) => {
                  return (
                    <div
                      key={idx}
                      className="text-description rounded bg-input bg-opacity-5 px-2 py-1 text-xs"
                    >
                      <code>{item.name}</code>
                      {item.description && (
                        <div className="mt-1 text-xs text-description">
                          {item.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs italic text-description">
                No {title.toLowerCase()} available
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="">
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="my-0 text-sm font-medium">{server.name}</h3>
              <ToolTip content={ServerStatusTooltip[server.status] ?? "Error"}>
                <div
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${ServerStatusColor[server.status] ?? "bg-error"}`}
                />
              </ToolTip>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Listbox>
            <ToolTip content="Server actions">
              <ListboxButton>
                <EllipsisVerticalIcon className="h-4 w-4 flex-shrink-0" />
              </ListboxButton>
            </ToolTip>
            <ListboxOptions className="min-w-fit" anchor="bottom end">

              <ListboxOption
                value="edit mcp"
                className="justify-start gap-x-1.5"
                onClick={() => onEditServer(server)}
              >
                <PencilIcon
                  className={
                    "h-3.5 w-3.5 flex-shrink-0 cursor-pointer text-description text-inherit hover:brightness-125"
                  }
                />
                Edit
              </ListboxOption>

              {server.status === "connected" && (
                <ListboxOption
                  value="disconnect"
                  onClick={onDisconnect}
                  className="justify-start gap-x-1.5"
                >
                  <StopCircleIcon className="h-4 w-4 flex-shrink-0" />{" "}
                  Disconnect
                </ListboxOption>
              )}

              {server.status !== "connecting" && (
                <ListboxOption
                  value="reconnect"
                  onClick={onRefresh}
                  className="justify-start gap-x-1.5"
                >
                  {server.status === "disabled" ? (
                    <PlayCircleIcon className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 flex-shrink-0" />
                  )}
                  Reload
                </ListboxOption>
              )}

              {server.sourceFile?.startsWith(`${QUANTUM_SETTINGS_SCHEME}mcp/`) && (
                <ListboxOption
                  value="delete mcp"
                  onClick={() => onDeleteServer(server)}
                  className="justify-start gap-x-1.5"
                >
                  <TrashIcon className="h-4 w-4 flex-shrink-0" />
                  Delete
                </ListboxOption>
              )}
            </ListboxOptions>
          </Listbox>
        </div>
      </div>

      {/* Individual resource rows */}
      <div className="mt-1">
        <ToolPoliciesGroup
          showIcon={true}
          groupName={server.name}
          displayName={"Tools"}
          allToolsOff={allToolsOff}
          duplicateDetection={duplicateDetection}
        />
        {server.prompts.length > 0 && (
          <ResourceRow
            title="Prompts"
            items={server.prompts}
            icon={
              <CommandLineIcon className="text-description h-4 w-4 flex-shrink-0" />
            }
            sectionKey={`${server.id}-prompts`}
          />
        )}
        {(server.resources.length > 0 ||
          server.resourceTemplates.length > 0) && (
          <ResourceRow
            title="Resources"
            items={[...server.resources, ...server.resourceTemplates]}
            icon={
              <CircleStackIcon className="text-description h-4 w-4 flex-shrink-0" />
            }
            sectionKey={`${server.id}-resources`}
          />
        )}
      </div>

      {/* Error display below expandable section */}
      {server.errors && server.errors.length > 0 && (
        <div className="mt-3 space-y-2">
          {server.errors.map((error, errorIndex) => (
            <Alert
              key={errorIndex}
              type="error"
              size="sm"
              className="cursor-pointer transition-all hover:underline"
              onClick={() =>
                void ideMessenger.ide.showVirtualFile(server.name, error)
              }
            >
              <span className="text-xs">
                {error.length > 150 ? error.substring(0, 150) + "..." : error}
              </span>
            </Alert>
          ))}
        </div>
      )}

      {server.infos && server.infos.length > 0 && (
        <div className="mt-3 space-y-2">
          {server.infos.map((info, infoIndex) => (
            <Alert
              key={infoIndex}
              type="info"
              size="sm"
              className="transition-all"
              onClick={() =>
                void ideMessenger.ide.showVirtualFile(server.name, info)
              }
            >
              <span
                className="text-xs"
                dangerouslySetInnerHTML={{ __html: info }}
              />
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}

export function MCPSection() {
  const dispatch = useAppDispatch();
  const availableTools = useAppSelector((state) => state.config.config.tools);
  const mode = useAppSelector((store) => store.session.mode);
  const servers = useAppSelector(
    (store) => store.config.config.mcpServerStatuses,
  );
  const ideMessenger = useContext(IdeMessengerContext);
  const duplicateDetection = useMemo(() => {
    const counts: Record<string, number> = {};
    availableTools.forEach((tool) => {
      if (counts[tool.function.name]) {
        counts[tool.function.name] = counts[tool.function.name] + 1;
      } else {
        counts[tool.function.name] = 1;
      }
    });
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v > 1]),
    );
  }, [availableTools]);

  const handleAddMcpServer = () => {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddMcpServerForm
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  };

  const handleEditMcpServer = (server: MCPServerStatus) => {
    const existingServer = mcpStatusToEditableServer(server);
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddMcpServerForm
          existingServer={existingServer}
          originalName={server.name}
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  };

  const handleDeleteMcpServer = (server: MCPServerStatus) => {
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title="Delete MCP Server"
          text={`Remove "${server.name}" from Quantum Settings?`}
          confirmText="Delete"
          onConfirm={async () => {
            try {
              await ideMessenger.request("config/deleteMcpServer", {
                name: server.name,
              });
            } catch (error) {
              console.error("Failed to delete MCP server:", error);
            }
          }}
        />,
      ),
    );
    dispatch(setShowDialog(true));
  };

  const allToolsOff = useMemo(() => {
    return mode === "chat";
  }, [mode]);

  return (
    <div className={CONFIG_PAGE_GAP}>
      <ConfigHeader
        title="MCP Servers"
        subtext="Manage Model Context Protocol servers"
        onAddClick={handleAddMcpServer}
        addButtonTooltip="Add MCP server"
      />
      <div className={CONFIG_PAGE_GAP}>
        {mode === "chat" && (
          <Alert type="info" size="sm">
            <span className="text-sm italic">
              All MCPs are disabled in Chat, switch to Plan or Agent mode to
              use MCPs
            </span>
          </Alert>
        )}
        {(servers ?? []).length > 0 ? (
          <Card className="!p-0 overflow-hidden">
            <div className={CONFIG_HAIRLINE_DIVIDE}>
              {(servers ?? []).map((server) => (
                <div key={server.name} className="px-4 py-3">
                  <MCPServerPreview
                    server={server}
                    allToolsOff={allToolsOff}
                    duplicateDetection={duplicateDetection}
                    onEditServer={handleEditMcpServer}
                    onDeleteServer={handleDeleteMcpServer}
                  />
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <ConfigEmptyAction
            status="No MCP servers configured"
            actionLabel="Add server"
            onClick={handleAddMcpServer}
          />
        )}
      </div>
    </div>
  );
}

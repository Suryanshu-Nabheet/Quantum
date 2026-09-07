import { MCPServer } from "agent-config";
import { MCPServerStatus } from "core";
import { useContext, useState } from "react";
import { Button, Input } from "../components";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { HAIRLINE_BORDER } from "../styles/borders";
import { cn } from "../util/cn";
interface AddMcpServerFormProps {
  onDone: () => void;
  existingServer?: MCPServer | MCPServerStatus;
  originalName?: string;
}

type McpTransport = "stdio" | "sse" | "streamable-http";

function serverToFormState(
  server: MCPServer | MCPServerStatus,
): {
  transport: McpTransport;
  name: string;
  command: string;
  args: string;
  url: string;
  apiKey: string;
} {
  if ("command" in server && server.command) {
    return {
      transport: "stdio",
      name: server.name,
      command: server.command,
      args: (server.args ?? []).join(", "),
      url: "http://localhost:3000/mcp",
      apiKey: "",
    };
  }

  const transport: McpTransport =
    "type" in server && server.type === "sse" ? "sse" : "streamable-http";

  return {
    transport,
    name: server.name,
    command: "npx",
    args: "-y, @modelcontextprotocol/server-filesystem, .",
    url: "url" in server ? server.url : "http://localhost:3000/mcp",
    apiKey: "apiKey" in server ? (server.apiKey ?? "") : "",
  };
}

export function AddMcpServerForm({
  onDone,
  existingServer,
  originalName,
}: AddMcpServerFormProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const initial = existingServer
    ? serverToFormState(existingServer)
    : {
        transport: "stdio" as McpTransport,
        name: "New MCP server",
        command: "npx",
        args: "-y, @modelcontextprotocol/server-filesystem, .",
        url: "http://localhost:3000/mcp",
        apiKey: "",
      };

  const [transport, setTransport] = useState<McpTransport>(initial.transport);
  const [name, setName] = useState(initial.name);
  const [command, setCommand] = useState(initial.command);
  const [args, setArgs] = useState(initial.args);
  const [url, setUrl] = useState(initial.url);
  const [apiKey, setApiKey] = useState(initial.apiKey);

  const isEditing = Boolean(existingServer);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    let server: MCPServer;
    if (transport === "stdio") {
      server = {
        name: name.trim(),
        command: command.trim(),
        args: args
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
        env: {},
      };
    } else {
      server = {
        name: name.trim(),
        url: url.trim(),
        type: transport,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      };
    }

    if (isEditing && originalName) {
      ideMessenger.post("config/updateMcpServer", {
        originalName,
        server,
      });
    } else {
      ideMessenger.post("config/addMcpServer", server);
    }
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md p-6">
      <h1 className="mb-0 text-center text-2xl">
        {isEditing ? "Edit MCP server" : "Add MCP server"}
      </h1>
      <p className="text-description m-0 mt-2 text-center text-sm">
        Configure a server from settings — no manual file editing.
      </p>

      <div className="my-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Transport</span>
          <select
            className={cn(
              "bg-input text-foreground rounded border px-2 py-1.5 text-sm",
              HAIRLINE_BORDER,
            )}
            value={transport}
            onChange={(e) => setTransport(e.target.value as McpTransport)}
          >
            <option value="stdio">stdio (local command)</option>
            <option value="sse">SSE (remote URL)</option>
            <option value="streamable-http">Streamable HTTP</option>
          </select>
        </label>

        {transport === "stdio" ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Command</span>
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Args (comma-separated)</span>
              <Input value={args} onChange={(e) => setArgs(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">URL</span>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">API key (optional)</span>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      <Button type="submit" className="w-full">
        {isEditing ? "Save" : "Add server"}
      </Button>
    </form>
  );
}

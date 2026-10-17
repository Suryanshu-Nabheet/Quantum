# Model Context Protocol (MCP)

Both Quantum products integrate **MCP** so tools, resources, and prompts can come from external servers the user runs or installs.

## IDE (Workbench Agent)

- Configure servers in **Agent Settings → MCP**
- Persisted in `~/.agent/index/globalContext.json` (with the rest of agent config)
- Implementation: `contrib/agent/core/context/mcp/` (e.g. `MCPConnection`)

User starts or connects to MCP servers; the IDE agent invokes tools through the same policy layer as built-in tools (allow / ask / deny).

## Agent Manager

- MCP-native orchestration — tools and resources for provider sessions
- Wire details live in server + contracts; see [Agent Manager development](../products/agent-manager-development.md)

## Developer guidelines

1. **Schema-first** — prefer MCP standard shapes; document custom tools in product README or ADR when needed.
2. **No silent servers** — do not auto-start MCP endpoints that exfiltrate workspace data.
3. **Secrets** — MCP env vars and API keys belong in `.env` or OS keychain patterns, not in git.

## See also

- [Workbench Agent](../products/workbench-agent.md)
- [Privacy and data](privacy-and-data.md)
- [Model Context Protocol specification](https://modelcontextprotocol.io/)

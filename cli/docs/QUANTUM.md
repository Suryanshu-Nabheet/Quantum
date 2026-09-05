# Quantum Project Guidelines

Quantum is an autonomous AI coding agent. These guidelines help maintain code quality and project consistency.

## Development Commands
- `bun install`: Install dependencies.
- `bun run build`: Build the CLI and SDK.
- `bun run init`: Install and build in one go.
- `bun test`: Run the test suite.
- `./bin/quantum`: Launch the interactive CLI.

## Code Style
- Use **TypeScript** for all new code.
- Use **Vanilla CSS** for styling (no Tailwind unless requested).
- Follow the existing project structure (services in `src/services`, tools in `src/tools`, etc.).
- Maintain zero-telemetry by avoiding any tracking or "phone-home" logic.

## Architecture Highlights
- **QueryEngine**: The central loop for agentic turns.
- **Tools**: Modular units of execution in `src/tools`.
- **Providers**: Multi-model support in `src/services/api`.

## Rebranding Note
- The project is owned by **Suryanshu Nabheet** and licensed under **MIT**.
- Avoid references to "Anthropic" or "Claude" in user-facing documentation unless referring to the model itself.

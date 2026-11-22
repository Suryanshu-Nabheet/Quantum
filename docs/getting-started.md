# Getting started

## Install Quantum

Download the appropriate asset from [GitHub Releases](https://github.com/Suryanshu-Nabheet/Quantum/releases/latest). The release workflow builds macOS Apple Silicon, Windows x64, and Linux x64 packages. Check the release page for the assets available for a particular version.

For an unsigned macOS build, use **Open** from the app's context menu on the first launch.

## Open a project

Open a folder or workspace in Quantum. Use Explorer, Search, Source Control, Run and Debug, the terminal, and the integrated browser as you work. Open the Agent panel to start a conversation about the project.

Configure a model in Settings before sending a request. Quantum supports local and remote model providers. Remote providers require their own credentials and may charge for usage. See [Quantum Agent](agent.md) for context, tools, and permissions, and [Editor and workspace](editor.md) for the workbench.

## Run from source

Install the prerequisites in the [development guide](development.md), then run:

```bash
git clone https://github.com/Suryanshu-Nabheet/Quantum.git
cd Quantum
./scripts/setup.sh
```

On Windows, use `scripts\setup.bat`. Setup installs dependencies, builds Quantum, and launches the application. Use `./scripts/setup.sh --setup-only` to build without launching or `./scripts/setup.sh --launch-only` after a successful build. See the [script reference](../scripts/README.md) for the available options.

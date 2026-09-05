<div id="quantum-logo" align="center">
    <br />
    <img src="../assets/marketing/readme-banner.png" alt="Quantum — The AI Native Code Editor" width="100%"/>
</div>

<div id="badges" align="center">

[![license](https://img.shields.io/github/license/Suryanshu-Nabheet/Quantum.svg)](https://github.com/Suryanshu-Nabheet/Quantum/blob/main/LICENSE.txt)

</div>

**Quantum** is an AI-native, MIT-licensed code editor built from Microsoft's [Visual Studio Code](https://github.com/microsoft/vscode) source. This repository contains the scripts and patches used to produce **Quantum** binaries with community-driven defaults: no Microsoft telemetry, Open VSX for extensions, and branding under the Quantum project.

Repository: [https://github.com/Suryanshu-Nabheet/Quantum](https://github.com/Suryanshu-Nabheet/Quantum)

## Table of Contents

- [About](#about)
- [Build](#build)
- [Why Quantum](#why-quantum)
- [License](#license)

## About

Quantum is developed by **Suryanshu Nabheet** as an open source, AI-native code editor focused on assisted development workflows, fully open source under the MIT license.

This is **not** a long-lived fork of the VS Code git history in this repo. Instead, the build:

1. Clones a pinned VS Code release (see `upstream/stable.json`)
2. Applies Quantum overlays from `src/stable/`
3. Applies patches from `patches/`
4. Compiles with Microsoft's build tooling

After a one-time build, you can maintain your own `vscode/` tree without chasing upstream VSCodium releases.

## Build

Build instructions are in [docs/howto-build.md](docs/howto-build.md).

Quick start (macOS / Linux):

```bash
./dev/build.sh
```

With packaging:

```bash
./dev/build.sh -p
```

**Requirements:** Node.js (see [.nvmrc](.nvmrc)), Python 3.11, Rust, jq, git, and platform build deps from the how-to guide.

## Why Quantum

- **Open source** — MIT licensed build scripts and patches
- **AI-native positioning** — branded and configured as an AI-first editor
- **No Microsoft telemetry** — disabled by default via patches and `undo_telemetry.sh`
- **Open VSX** — extension marketplace not tied to the proprietary Visual Studio Marketplace
- **Your project** — releases and updates point to [Suryanshu-Nabheet/Quantum](https://github.com/Suryanshu-Nabheet/Quantum) (`quantum/`)

## License

[MIT](LICENSE) — Copyright (c) Suryanshu Nabheet and contributors. See LICENSE for upstream attributions (Microsoft VS Code, VSCodium contributors).

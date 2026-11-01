<div id="quantum-logo" align="center">
    <br />
    <img src="../../assets/marketing/readme-banner.png" alt="Quantum — The AI Native Code Editor" width="100%"/>
</div>

<div id="badges" align="center">

[![license](https://img.shields.io/github/license/Suryanshu-Nabheet/Quantum.svg)](https://github.com/Suryanshu-Nabheet/Quantum/blob/main/LICENSE.txt)

</div>

This directory contains Quantum IDE's optional upstream release builder. It downloads a pinned Microsoft [Visual Studio Code](https://github.com/microsoft/vscode) source release, applies Quantum overlays and patches, and packages binaries with Quantum's community defaults. The IDE source and its primary build tooling live at the repository root; this builder is maintained here as part of that same IDE project.

Project: [Quantum AI Native IDE](https://github.com/Suryanshu-Nabheet/Quantum)

## Table of Contents

- [Build flow](#build-flow)
- [Build](#build)
- [License](#license)

## Build flow

This helper:

1. Clones a pinned VS Code release (see `upstream/stable.json`)
2. Applies Quantum overlays from `src/stable/`
3. Applies patches from `patches/`
4. Compiles with Microsoft's build tooling

Built-in Quantum extensions for release builds live in [`extensions/`](../../extensions/) (including `quantum-*` built-ins).

## Build

Build instructions are in [docs/howto-build.md](docs/howto-build.md). Run the commands from this directory (`build/quantum-release/`):

Quick start (macOS / Linux):

```bash
cd build/quantum-release
./dev/build.sh
```

With packaging:

```bash
cd build/quantum-release
./dev/build.sh -p
```

**Requirements:** Node.js (see [`.nvmrc`](.nvmrc)), Python 3.11, Rust, jq, git, and platform build deps from the how-to guide.

## License

[MIT](LICENSE) — Copyright (c) Suryanshu Nabheet and contributors. See LICENSE for upstream attributions (Microsoft VS Code, VSCodium contributors).

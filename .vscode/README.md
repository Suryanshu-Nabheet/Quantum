# Root `.vscode/`

Monorepo-wide VS Code / Cursor settings for the **repository root** and `Quantum.code-workspace`.

| File | Role |
| --- | --- |
| `settings.json` | Search excludes, format defaults, ESLint working directories |
| `tasks.json` | `Quantum: Setup`, `Verify`, Agent dev, IDE watch / launch |
| `launch.json` | Shared attach configs |
| `extensions.json` | Recommended extensions for the whole monorepo |

**IDE debugging (F5):** use the **IDE** folder — full launch graph lives in [`ide/.vscode/`](../ide/.vscode/).

**Policy:** only the files above are committed; other `.vscode/*` stays local. See [docs/version-control.md](../docs/version-control.md).

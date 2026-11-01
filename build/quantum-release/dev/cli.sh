export CARGO_NET_GIT_FETCH_WITH_CLI="true"
export VSCODE_CLI_APP_NAME="quantum"
export VSCODE_CLI_BINARY_NAME="quantum-server-insiders"
export VSCODE_CLI_DOWNLOAD_URL="https://github.com/Suryanshu-Nabheet/Quantum/releases"
export VSCODE_CLI_QUALITY="insider"
export VSCODE_CLI_UPDATE_URL="https://raw.githubusercontent.com/Quantum/versions/refs/heads/master"

cargo build --release --target aarch64-apple-darwin --bin=code

cp target/aarch64-apple-darwin/release/code "../../VSCode-darwin-arm64/Quantum - Insiders.app/Contents/Resources/app/bin/quantum-tunnel-insiders"

"../../VSCode-darwin-arm64/Quantum - Insiders.app/Contents/Resources/app/bin/quantum-insiders" serve-web

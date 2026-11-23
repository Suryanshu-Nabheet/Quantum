# Quantum SSH

Quantum SSH connects the local Quantum workbench to development environments over SSH. It is built in, so no marketplace install is required.

## Connect

1. Make sure the remote machine runs a supported Quantum server build and allows SSH TCP forwarding (`AllowTcpForwarding yes`).
2. Add a host entry to your OpenSSH config (normally `~/.ssh/config`):

   ```sshconfig
   Host devbox
       HostName your-server-address
       User developer
       IdentityFile ~/.ssh/id_ed25519
       IdentitiesOnly yes
   ```

3. In Quantum, run **Quantum SSH: Connect to SSH Host...** from the Command Palette, or choose **Connect via SSH** from the remote indicator. Select `devbox`.
4. On first connection, inspect and confirm the host-key fingerprint. Quantum remembers accepted host keys in the user SSH known-hosts file.
5. Select a remote folder when prompted. Quantum installs or starts the matching remote server and opens the folder in the connected workbench.

The SSH Hosts view also reads hosts from your OpenSSH config. Use its add, refresh, and configure actions to manage saved host entries and recent remote folders.

## OpenSSH configuration

Quantum reads the standard OpenSSH config and supports aliases, included config files, identity files, jump hosts, proxy commands, forwarding, and common connection options. Use the **Quantum SSH: Open SSH Configuration File...** command to open the active config file. You can choose another config file with `remote.SSH.configFile` or a different SSH executable with `remote.SSH.path`.

The SSH implementation supports `ssh2` by default and can use the system OpenSSH executable with `remote.SSH.connectionBackend: native`. The native backend uses the SSH binary selected by `remote.SSH.path` or found on `PATH`.

## Security and connection settings

- `remote.SSH.verifyUnknownHosts` controls first-use host keys. The default is `ask`, so the fingerprint is shown before saving a new key.
- `remote.SSH.verifyKnownHosts` controls changed keys. The default is `reject`; verify a changed fingerprint out of band before changing this setting.
- `remote.SSH.connectTimeout` sets the connection timeout in seconds.
- `remote.SSH.remotePlatform` can declare a host's operating system when automatic detection is insufficient.
- `remote.SSH.serverInstallPath` sets a custom remote server installation directory per host or host pattern.
- `remote.SSH.localServerDownload` chooses whether Quantum downloads the matching server locally and transfers it, remotely, or automatically with fallback.
- `remote.SSH.enableDynamicForwarding` enables remote port forwarding support.
- `remote.SSH.enableAgentForwarding` enables remote environment support for SSH agent forwarding.
- `remote.SSH.defaultExtensions` lists extension IDs to install on each SSH host.

Settings live under **Settings → Extensions → Quantum SSH**. Review the OpenSSH `ProxyCommand`, `ProxyJump`, and agent-forwarding configuration you use: those settings can execute local commands or expose your local SSH agent to the remote host.

## Troubleshooting

- **Host is missing:** check that `remote.SSH.configFile` points to the intended file and that its `Host` pattern is a concrete alias.
- **Authentication fails:** verify the username, key path, key permissions, SSH agent, and host's `authorized_keys`; use **Quantum SSH: Show Log** for connection details.
- **Host-key warning appears:** compare the shown fingerprint with the server administrator's trusted fingerprint. Do not accept a changed key without verifying it.
- **Server install fails:** confirm the remote OS/architecture is supported, the host can reach the server download source (or enable local download), and the remote account can write to its install directory.
- **Connection times out:** verify network access, port 22 or the configured port, jump-host settings, and `AllowTcpForwarding yes` on the SSH server.
- **Remote extensions cannot start:** reconnect after updating Quantum so the local app and remote server builds match.

Use **Quantum SSH: Show Log** and the remote server log for diagnostics. Do not include private keys, passwords, or access tokens when sharing logs.

## License

Quantum SSH is distributed under the MIT License; see [LICENSE.txt](LICENSE.txt). Third-party MIT notices are retained with the extension. Quantum-specific changes are maintained in this repository.

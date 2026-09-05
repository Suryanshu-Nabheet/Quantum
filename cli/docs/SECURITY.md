# Security Policy

## Supported Versions

Currently, only the latest version of Quantum is supported with security updates.

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

We take the security of Quantum seriously. If you believe you have found a security vulnerability, please report it to us by emailing suryanshunab@gmail.com.

Please include:
- A description of the vulnerability.
- Steps to reproduce the issue.
- Potential impact.

We will acknowledge your report within 48 hours and provide a timeline for a fix if applicable. Please do not disclose the vulnerability publicly until we have had a chance to address it.

## Best Practices

As a coding agent with shell access, Quantum should be used with care:
- **Use in Trusted Environments**: Only run Quantum in directories you trust.
- **Review Tool Calls**: Always review and approve sensitive tool calls (like `Bash` or `FileWrite`) if you are not running in a sandboxed environment.
- **Credential Management**: Never share your API keys or `auth.json` file.

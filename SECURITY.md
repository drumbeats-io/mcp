# Security Policy

Drumbeats is a security and reliability product, and this MCP server sits in the
path between AI clients and your monitoring account. We take its security
seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through either channel:

- **GitHub private vulnerability reporting** — use the **"Report a vulnerability"**
  button under this repository's **Security** tab.
- **Email** — [security@drumbeats.io](mailto:security@drumbeats.io).

Please include a description of the issue, affected transport (hosted or stdio),
the server version, and reproduction steps where possible.

### What to expect

- **Acknowledgement** within **72 hours**.
- An initial assessment and severity triage shortly after.
- Coordinated disclosure: we will agree on a disclosure timeline with you and
  credit you (if you wish) once a fix is released.

## Supported versions

While the project is pre-1.0, only the latest released version receives security
fixes. A formal supported-versions table will be published with the 1.0 release.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| < 1.0   | best effort |

## Credential and trust model

This server proxies the Drumbeats REST API; the API's own security is governed
separately. The intended credential models are:

- **Hosted transport (OAuth 2.1):** the server is an OAuth resource server. Users
  authorize in the browser and the server validates short-lived bearer tokens. The
  hosted instance is designed to hold **no long-lived customer credentials**.
- **Local stdio transport:** authenticates with a Drumbeats **account API key**
  (`dk_…`) that you provision and store in your own client configuration (ideally
  the OS keychain). The key stays in your local environment.

Account API keys are account-scoped with per-key permissions; grant the least
privilege the task requires. The hosted OAuth path is pre-GA — see the README for
current status.

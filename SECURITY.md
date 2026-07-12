# Security Policy

## Supported versions

Only the latest commit on the `main` branch is actively supported with security updates. Older branches and releases are not monitored.

## Reporting a vulnerability

If you discover a security vulnerability in CivicFeed, please report it privately rather than opening a public issue or pull request.

- Email: [security@example.com](mailto:security@example.com) (replace with the project maintainer's contact)
- GitHub: Use the repository's private vulnerability reporting feature if enabled.

Please include:

- A clear description of the vulnerability
- Steps to reproduce, if applicable
- The impact or data at risk
- Any suggested remediation

We aim to acknowledge reports within 5 business days and will coordinate disclosure once a fix is available.

## Security practices

- Do not commit secrets, API keys, tokens, or credentials to the repository.
- All RSS fetching is performed by the backend; the frontend does not use public CORS proxies.
- External HTTP calls use timeouts, retries with jitter, and input validation at trust boundaries.
- Dependencies are pinned and audited via `npm audit` and Socket Security in CI.

## Responsible disclosure

We ask that reporters provide reasonable time for us to address an issue before publicly disclosing it. We will credit reporters in release notes unless they prefer to remain anonymous.

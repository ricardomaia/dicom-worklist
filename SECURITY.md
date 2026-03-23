# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public issue.** Instead, send an email to the maintainer or use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information/privately-reporting-a-security-vulnerability).

We will acknowledge your report within 48 hours and aim to release a fix within 7 days for critical issues.

## Privacy Considerations

This library handles DICOM patient data, which may include Protected Health Information (PHI) subject to regulations such as HIPAA, LGPD, and GDPR.

- `queryWorklist()` returns **full patient names** in DICOM format (`LAST^FIRST^MIDDLE`). Use the exported `getInitials()` helper to minimize PII exposure in logs and user interfaces.
- Avoid logging raw worklist results in production environments.
- Ensure your PACS connection is secured at the network level (e.g., VPN, TLS, or private network).

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

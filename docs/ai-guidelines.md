# AI development guidelines

AI is a helpful junior pair-programmer, not the decision maker for safety, money, privacy, compliance, or route eligibility.

## Rules

1. Give AI the product rule and acceptance test, not only a feature name.
2. Ask it to inspect the relevant files and propose a short plan **before** edits.
3. Require TypeScript, input validation, error states, accessibility, and tests where appropriate.
4. Make AI change the smallest possible surface area. Review every diff.
5. Never paste API keys, production data, phone numbers, identity documents, exact live locations, payment credentials, or customer conversations into a prompt.
6. Never let AI invent legal compliance, safety approval, payment success, distance/fare, or benchmark data. Mark assumptions clearly.
7. Do not let AI auto-merge, deploy, issue refunds, message users, or modify production data.

## Prompt templates

**Plan first**
```text
Read docs/product/brief.md and docs/architecture.md. Inspect only files relevant to [ticket].
Explain the smallest implementation plan, affected files, security/privacy risks, and acceptance tests. Do not edit yet.
```

**Implement**
```text
Implement approved ticket [ticket]. Preserve the existing structure. Validate every external input on the API. Do not add dependencies unless necessary; explain any you add. Add or update tests and report commands run.
```

**Review**
```text
Review this diff for authorization bugs, leaked location/PII, unsafe trip-state transitions, payment-webhook trust, missing rate limits, and incorrect forward-route assumptions. List findings by severity; do not edit.
```

## Definition of done for AI-assisted work

- The product rule and success/failure behavior are written down.
- No secrets or PII enter source control.
- Server validates authorization and input; client validation is only for user experience.
- A user-friendly error state exists.
- Tests/typecheck/lint relevant to the change pass.
- The change is small enough that you can explain it yourself.


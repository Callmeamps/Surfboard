# ADR-003: Miniapps Sandboxing

## Status

Accepted

## Context

Miniapps are third-party panels that need to render UI and communicate with the host. Same-origin risks exist if miniapps run in the main renderer context.

## Decision

Sandbox iframe isolation with postMessage bridge:

- Miniapps register with `sandbox: true` attribute
- Host creates `<iframe sandbox="allow-scripts">` with strict CSP srcdoc (`default-src 'none'`)
- `MiniappSDK` provides postMessage bridge for structured communication
- `sendTo()` API for miniapp-to-host messaging

## Consequences

**Positive:**
- XSS prevention — miniapps cannot access host DOM
- CSP enforcement — no inline scripts, no remote resources
- Structured API via postMessage — no arbitrary access
- Sandbox attribute blocks top-level navigation, popups, plugins

**Negative:**
- Limited API surface — miniapps must use provided SDK methods
- No direct DOM access — miniapps render inside iframe
- Communication overhead via postMessage serialization

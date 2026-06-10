# ADR-002: Profile Isolation Strategy

## Status

Accepted

## Context

Multiple users or contexts need isolated browsing data. Bookmarks, history, settings, extensions, and cookies should not leak between profiles.

## Decision

Per-profile file isolation with Electron session partitions:

- Each profile stores data in `profile-{id}.json` under userData
- Electron session partitions (`persist:{id}`) isolate cookies, cache, and service workers
- `storage.js` delegates all data operations to `profiles.js` — zero breaking changes for existing code
- Profile switch broadcasts `profiles:changed` to all windows, triggers reload
- Legacy `storage.json` auto-migrates to `profile-default.json` on first init

## Consequences

**Positive:**
- Full isolation without separate Electron instances
- Backward compatible — existing code calls storage.js unchanged
- Auto-migration from old format
- Session partition provides cookie/cache isolation for free

**Negative:**
- Extensions are currently global (not per-profile) — tradeoff for simplicity
- Profile switch requires full page reload
- Each profile adds a file under userData (bounded by user count)

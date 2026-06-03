# Domain Documentation Layout

This repo uses **single-context** domain docs:

- `CONTEXT.md` at repository root — domain glossary, key concepts, terminology
- `docs/adr/` — Architectural Decision Records (numbered, markdown)

Skills that read these files will look in these locations. If you split into multiple contexts (e.g., monorepo), replace this file with a `CONTEXT-MAP.md` at root mapping contexts to their `CONTEXT.md` and `docs/adr/`.
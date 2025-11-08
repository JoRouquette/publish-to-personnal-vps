# Copilot Instructions for publish-to-personal-vps

## Project Overview

- **Purpose:** Publish selected folders from an Obsidian vault to a self-hosted VPS, similar to Obsidian Publish, but fully under user control.
- **Architecture:**
  - `core-publishing/`: Domain logic, use cases, and data models. Pure TypeScript, no Obsidian dependencies. Follows Clean Architecture principles.
  - `obsidian-plugin/`: Obsidian plugin implementation (UI, settings, HTTP, vault access). Adapters connect plugin to core logic.
- **No path aliases or Nx workspace features** are used in imports—**always use relative imports**.

## Key Patterns & Conventions

- **Domain logic** (folder config, frontmatter rules, publishable notes, etc.) is in `core-publishing/src/lib/domain/`.
- **Ports and adapters**:
  - Ports (interfaces) in `core-publishing/src/lib/ports/` define boundaries for vault access, uploading, and settings export.
  - Adapters in `obsidian-plugin/src/lib/` implement these ports for Obsidian and HTTP.
- **Use cases** (e.g., publishing, settings export) are in `core-publishing/src/lib/usecases/`.
- **Settings and rules**:
  - Folder-level config and publish rules are extensible via TypeScript classes in `domain/`.
  - Filtering is based on YAML frontmatter and custom rules (see `SanitizationRules.ts`, `IgnoreRule.ts`).

## Developer Workflows

- **Build core library:**
  - `cd core-publishing && npm install && npm run build`
- **Build plugin:**
  - `cd obsidian-plugin && npm install && npm run build`
- **Test (Vitest):**
  - `cd core-publishing && npm test`
  - `cd obsidian-plugin && npm test`
- **Bundle plugin for Obsidian:**
  - Use `tools/build-plugin.js` or `scripts/package-plugin.sh` to bundle and package for manual install.

## Integration Points

- **VPS upload:** HTTP API, configured via plugin settings (`obsidian-plugin/src/lib/http-uploader.adapter.ts`).
- **Obsidian vault access:** Implemented in `obsidian-plugin/src/lib/obsidian-vault.adapter.ts`.
- **Settings UI:** `obsidian-plugin/src/lib/setting-tab.ts`.

## Examples

- To add a new publish rule, extend `IgnoreRule` or `SanitizationRules` in `core-publishing/src/lib/domain/`.
- To support a new upload backend, implement `UploaderPort` in `core-publishing/src/lib/ports/` and create a new adapter in the plugin.

## Additional Notes

- **Do not introduce path aliases or absolute imports.**
- **Keep domain logic decoupled from Obsidian APIs.**
- **All cross-component communication is via ports/adapters.**
- See each package's `README.md` for more details on build/test commands.

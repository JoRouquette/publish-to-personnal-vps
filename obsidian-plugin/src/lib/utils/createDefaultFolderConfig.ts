import type { FolderConfig } from 'core-publishing/src';

// helper
export function createDefaultFolderConfig(
  vpsId: string,
  overrideDefaults: Partial<FolderConfig> = {}
): FolderConfig {
  const defaults: FolderConfig = {
    id: `folder-${Date.now()}`,
    vaultFolder: '',
    routeBase: '',
    vpsId,
    sanitization: { removeFencedCodeBlocks: true },
  };
  return {
    ...defaults,
    ...overrideDefaults,
  };
}

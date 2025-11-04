export interface IgnoreRule {
  property: string;
  ignoreIf?: boolean;
  ignoreValues?: (string | number | boolean)[];
}

export interface VpsConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
}

export interface FolderConfig {
  id: string;
  vaultFolder: string;
  routeBase: string;
  vpsId: string;
  ignoreRules: IgnoreRule[];
}

type PluginLocale = 'en' | 'fr' | 'system';

export interface PublishPluginSettings {
  vpsConfigs: VpsConfig[];
  folders: FolderConfig[];
  locale?: PluginLocale;
}

export interface Frontmatter {
  [key: string]: any;
}

export interface PublishableNote {
  vaultPath: string;
  relativePath: string;
  content: string;
  frontmatter: Frontmatter;
  folderConfig: FolderConfig;
  vpsConfig: VpsConfig;
}

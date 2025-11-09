import { FolderConfig } from '../domain/FolderConfig.js';
import { PublishableNote } from '../domain/PublishableNote';
import { PublishPluginSettings } from '../domain/PublishPluginSettings';
import {
  ContentSanitizer,
  DefaultContentSanitizer,
} from '../domain/services/content-sanitizer';
import { UploaderPort } from '../ports/uploader-port';
import { VaultPort } from '../ports/vault-port';
import type { ProgressPort } from '../ports/progress-port';

type IgnoreRule = {
  property: string;
  ignoreIf?: boolean;
  ignoreValues?: (string | number | boolean)[];
};

export type PublishAllResult =
  | { type: 'success'; publishedCount: number }
  | { type: 'noConfig' }
  | { type: 'missingVpsConfig'; foldersWithoutVps: string[] }
  | { type: 'error'; error: unknown };

export class PublishAllUseCase {
  constructor(
    private readonly vaultPort: VaultPort,
    private readonly uploaderPort: UploaderPort,
    private readonly contentSanitizer: ContentSanitizer = new DefaultContentSanitizer()
  ) {}

  async execute(
    settings: PublishPluginSettings,
    progress?: ProgressPort
  ): Promise<PublishAllResult> {
    if (!settings?.vpsConfigs?.length || !settings?.folders?.length) {
      return { type: 'noConfig' };
    }

    const missingVps: string[] = [];
    const allRaw: Array<{
      vaultPath: string;
      relativePath: string;
      content: string;
      frontmatter: Record<string, any>;
      folder: FolderConfig;
    }> = [];

    for (const folder of settings.folders) {
      const vpsConfig = settings.vpsConfigs.find((v) => v.id === folder.vpsId);
      if (!vpsConfig) {
        missingVps.push(folder.id);
        continue;
      }
      const { notes } = await this.vaultPort.collectNotesFromFolder(folder); // doit être récursif côté adapter
      for (const raw of notes) {
        allRaw.push({ ...raw, folder });
      }
    }

    if (missingVps.length > 0) {
      return { type: 'missingVpsConfig', foldersWithoutVps: missingVps };
    }

    const filtered = allRaw.filter((raw) =>
      this.shouldKeep(raw.frontmatter, settings.ignoreRules ?? null)
    );

    progress?.start(filtered.length);

    let published = 0;
    try {
      for (const raw of filtered) {
        const vpsConfig = settings.vpsConfigs.find(
          (v) => v.id === raw.folder.vpsId
        )!;

        const note: PublishableNote = {
          vaultPath: raw.vaultPath,
          relativePath: raw.relativePath,
          content: raw.content,
          frontmatter: raw.frontmatter,
          folderConfig: raw.folder,
          vpsConfig,
        };

        const sanitized = this.contentSanitizer.sanitizeNote(
          note,
          raw.folder.sanitization
        );

        await this.uploaderPort.uploadNote(sanitized);
        published++;
        progress?.advance(1);
      }

      progress?.finish();
      return { type: 'success', publishedCount: published };
    } catch (error) {
      progress?.finish();
      return { type: 'error', error };
    }
  }

  private shouldKeep(
    frontmatter: Record<string, any>,
    rules: IgnoreRule[] | null
  ): boolean {
    if (!rules || rules.length === 0) return true;

    for (const rule of rules) {
      const value = frontmatter?.[rule.property];

      if (typeof rule.ignoreIf === 'boolean') {
        if (value === rule.ignoreIf) return false;
      }

      if (rule.ignoreValues && rule.ignoreValues.length > 0) {
        if (rule.ignoreValues.some((v) => v === value)) return false;
      }
    }
    return true;
  }
}

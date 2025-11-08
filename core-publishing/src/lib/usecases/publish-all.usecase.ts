import { IgnoreRule } from '../domain/IgnoreRule.js';
import { PublishableNote } from '../domain/PublishableNote';
import { PublishPluginSettings } from '../domain/PublishPluginSettings';
import {
  ContentSanitizer,
  DefaultContentSanitizer,
} from '../domain/services/content-sanitizer';
import { UploaderPort } from '../ports/uploader-port';
import { VaultPort } from '../ports/vault-port';

export type PublishAllResult =
  | { type: 'success'; publishedCount: number }
  | { type: 'noConfig' }
  | {
      type: 'missingVpsConfig';
      foldersWithoutVps: string[];
    }
  | {
      type: 'error';
      error: unknown;
    };

export class PublishAllUseCase {
  constructor(
    private readonly vaultPort: VaultPort,
    private readonly uploaderPort: UploaderPort,
    private readonly contentSanitizer: ContentSanitizer = new DefaultContentSanitizer()
  ) {}

  async execute(settings: PublishPluginSettings): Promise<PublishAllResult> {
    if (!settings.vpsConfigs.length || !settings.folders.length) {
      return { type: 'noConfig' };
    }

    let published = 0;
    const missingVps: string[] = [];
    const ignoreRules: IgnoreRule[] = settings.ignoreRules ?? [];

    try {
      for (const folder of settings.folders) {
        const vpsConfig = settings.vpsConfigs.find(
          (v) => v.id === folder.vpsId
        );
        if (!vpsConfig) {
          missingVps.push(folder.id);
          continue;
        }

        const { notes } = await this.vaultPort.collectNotesFromFolder(folder);

        for (const raw of notes) {
          if (this.shouldIgnore(raw.frontmatter, ignoreRules)) {
            continue;
          }

          const note: PublishableNote = {
            vaultPath: raw.vaultPath,
            relativePath: raw.relativePath,
            content: raw.content,
            frontmatter: raw.frontmatter,
            folderConfig: folder,
            vpsConfig,
          };

          const sanitized = this.contentSanitizer.sanitizeNote(
            note,
            folder.sanitization
          );

          await this.uploaderPort.uploadNote(sanitized);
          published++;
        }
      }

      if (missingVps.length > 0) {
        return {
          type: 'missingVpsConfig',
          foldersWithoutVps: missingVps,
        };
      }

      return { type: 'success', publishedCount: published };
    } catch (error) {
      return { type: 'error', error };
    }
  }

  private shouldIgnore(
    frontmatter: Record<string, any>,
    rules: IgnoreRule[]
  ): boolean {
    if (!rules || rules.length === 0) {
      return false;
    }

    for (const rule of rules) {
      const value = frontmatter?.[rule.property];

      if (typeof rule.ignoreIf === 'boolean' && value === rule.ignoreIf) {
        return true;
      }

      if (rule.ignoreValues && rule.ignoreValues.length > 0) {
        if (rule.ignoreValues.some((v) => v === value)) {
          return true;
        }
      }
    }

    return false;
  }
}

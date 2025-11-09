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
    const collected: Array<{
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
      const { notes } = await this.vaultPort.collectNotesFromFolder(folder);
      for (const n of notes) {
        collected.push({ ...n, folder });
      }
    }

    if (missingVps.length > 0) {
      return { type: 'missingVpsConfig', foldersWithoutVps: missingVps };
    }

    const filtered = collected.filter((raw) =>
      this.shouldKeep(raw.frontmatter, settings.ignoreRules ?? null)
    );

    if (filtered.length === 0) {
      progress?.start(0);
      progress?.finish();
      return { type: 'success', publishedCount: 0 };
    }

    progress?.start(filtered.length);

    const byVps = new Map<
      string,
      { vpsId: string; notes: PublishableNote[] }
    >();

    for (const raw of filtered) {
      const vpsConfig = settings.vpsConfigs.find(
        (v) => v.id === raw.folder.vpsId
      )!;

      const note: PublishableNote = {
        vaultPath: raw.vaultPath,
        relativePath: this.slugify(raw.relativePath),
        content: raw.content,
        frontmatter: raw.frontmatter,
        folderConfig: raw.folder,
        vpsConfig,
      };

      const sanitized = this.contentSanitizer.sanitizeNote(
        note,
        raw.folder.sanitization
      );

      const key = vpsConfig.id;
      let bucket = byVps.get(key);
      if (!bucket) {
        bucket = { vpsId: key, notes: [] };
        byVps.set(key, bucket);
      }
      bucket.notes.push(sanitized);
    }

    let published = 0;
    try {
      for (const { notes } of byVps.values()) {
        await this.uploaderPort.uploadNotes(notes);
        published += notes.length;
        progress?.advance(notes.length);
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

      if (typeof rule.ignoreIf === 'boolean' && value === rule.ignoreIf) {
        return false;
      }

      if (rule.ignoreValues?.length) {
        if (rule.ignoreValues.some((v) => v === value)) return false;
      }
    }
    return true;
  }

  private slugify(value: string): string {
    if (!value) return '';

    value = value.trim().split('/').slice(0, -1).join('/');

    value = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9\s/]/g, '') // Remove special characters except slashes and spaces
      .replace(/\s{2,}/g, ' ')
      .toLowerCase()
      .replace(/\s/g, '-'); // Replace single spaces with hyphens

    return value;
  }
}

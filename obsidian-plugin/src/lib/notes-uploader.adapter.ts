import { requestUrl } from 'obsidian';
import type { PublishableNote } from '../../../core-publishing/src/lib/domain/PublishableNote';
import type { UploaderPort } from '../../../core-publishing/src/lib/ports/uploader-port';
import type { VpsConfig } from '../../../core-publishing/src/lib/domain/VpsConfig';
import { DomainFrontmatter, FolderConfig } from 'core-publishing/src';
import { LoggerPort } from '../../../core-publishing/src/lib/ports/logger-port';

type ApiNote = {
  id: string;
  slug: string;
  route: string;
  relativePath?: string;
  vaultPath: string;
  markdown: string;
  frontmatter: DomainFrontmatter;
  publishedAt: string;
  updatedAt: string;
};

export class NotesUploaderAdapter implements UploaderPort {
  constructor(
    private readonly vpsConfig: VpsConfig,
    private readonly logger: LoggerPort
  ) {}

  async upload(notes: PublishableNote[]): Promise<void> {
    if (!Array.isArray(notes) || notes.length === 0) {
      this.logger.info('No notes to upload.');
      return;
    }

    const vps = (notes[0] as any).vpsConfig ?? this.vpsConfig;
    const apiKeyPlain = vps.apiKey;

    const apiNotes: ApiNote[] = notes.map((note) => this.buildApiNote(note));

    const body = { notes: apiNotes };

    this.logger.info(`Uploading ${apiNotes.length} notes to VPS at ${vps.url}`);

    try {
      const response = await requestUrl({
        url: vps.url.replace(/\/$/, '') + '/api/upload',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKeyPlain,
        },
        body: JSON.stringify(body),
      });

      this.logger.debug(
        'Upload response status: %d, body: %s',
        response.status,
        response.text
      );

      if (response.status < 200 || response.status >= 300) {
        this.logger.error(
          'Upload failed with status %d: %s',
          response.status,
          response.text
        );
        throw new Error(
          `Upload failed with status ${response.status}: ${response.text}`
        );
      }

      const json = response.json;
      if (!json || json.api !== 'ok') {
        this.logger.error(
          'Upload API returned an error: %s',
          JSON.stringify(json)
        );
        throw new Error(
          `Upload API returned an error: ${JSON.stringify(json)}`
        );
      }

      this.logger.info('Notes uploaded successfully.');
    } catch (error) {
      this.logger.error('Exception during upload: %s', String(error));
      throw error;
    }
  }

  // #region: private helpers

  private buildApiNote(note: PublishableNote): ApiNote {
    const fm: DomainFrontmatter = note.frontmatter ?? {};

    const rawSlug = this.extractFileNameWithoutExt(note.vaultPath);

    const slug = this.slugify(rawSlug);

    const route = this.buildFileRoute(note.folderConfig, note, slug);

    const nowIso = new Date().toISOString();

    this.logger.debug(
      'Building ApiNote for noteId=%s, slug=%s, route=%s',
      note.noteId,
      slug,
      route
    );

    return {
      id: note.noteId,
      slug: slug,
      route: route,
      relativePath: note.relativePath,
      vaultPath: note.vaultPath,
      markdown: note.content,
      frontmatter: note.frontmatter,
      publishedAt: nowIso,
    } as ApiNote;
  }

  private extractFileNameWithoutExt(path: string): string {
    const last = path.split('/').pop() ?? path;
    const result = last.replace(/\.[^/.]+$/, '');
    this.logger.debug('Extracted file name without extension: %s', result);
    return result;
    // "Arakišib — .../Angle mort.md" -> "Angle mort"
  }

  private slugify(value: string): string {
    const slug = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
    this.logger.debug('Slugified value: "%s" -> "%s"', value, slug);
    return slug;
  }

  private buildFileRoute(
    folderConfig: FolderConfig,
    note: PublishableNote,
    slug: string
  ): string {
    const baseRouteClean = folderConfig.routeBase?.replace(/\/$/, '') ?? '';

    const cleanVaultFolder = folderConfig.vaultFolder
      .replace(/^\//, '')
      .replace(/\/$/, '');

    // Remove leading slash and filename
    const cleanVaultRoute = note.vaultPath
      .replace(/^\//, '')
      .split('/')
      .splice(0, -1)
      .join('/');

    const route = `/${cleanVaultRoute.replace(
      cleanVaultFolder,
      baseRouteClean
    )}/${slug}`;

    this.logger.debug(
      'Built file route: baseRoute=%s, vaultFolder=%s, vaultPath=%s, route=%s',
      baseRouteClean,
      cleanVaultFolder,
      note.vaultPath,
      route
    );

    return route;
  }
}

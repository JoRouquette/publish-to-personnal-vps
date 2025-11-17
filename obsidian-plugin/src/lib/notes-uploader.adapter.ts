import { requestUrl } from 'obsidian';
import type { PublishableNote } from '../../../core-publishing/src/lib/domain/PublishableNote';
import type { UploaderPort } from '../../../core-publishing/src/lib/ports/uploader-port';
import type { VpsConfig } from '../../../core-publishing/src/lib/domain/VpsConfig';
import { DomainFrontmatter, FolderConfig } from 'core-publishing/src';
import { LoggerPort } from '../../../core-publishing/src/lib/ports/logger-port';

type ApiNote = {
  id: string;
  title: string;
  slug: string;
  route: string;
  relativePath?: string;
  vaultPath: string;
  markdown: string;
  frontmatter: {
    tags: string[];
  } & DomainFrontmatter;
  publishedAt: string;
};

export class NotesUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;

  constructor(private readonly vpsConfig: VpsConfig, logger: LoggerPort) {
    this._logger = logger;
  }

  async upload(notes: PublishableNote[]): Promise<void> {
    if (!Array.isArray(notes) || notes.length === 0) {
      this._logger.info('No notes to upload.');
      return;
    }

    const vps = (notes[0] as any).vpsConfig ?? this.vpsConfig;
    const apiKeyPlain = vps.apiKey;

    const apiNotes: ApiNote[] = notes.map((note) =>
      this.buildApiNote(
        note,
        this._logger.child({ method: 'upload', noteId: note.noteId })
      )
    );

    const body = { notes: apiNotes };

    this._logger.info(
      `Uploading ${apiNotes.length} notes to VPS at ${vps.url}`
    );

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

      this._logger.debug(
        `Upload response status: ${response.status}, body: `,
        response.text
      );

      // Handle HTTP status codes
      if (response.status === 401) {
        this._logger.error('Unauthorized (401): Invalid API key.');
        return;
      }
      if (response.status === 403) {
        this._logger.error('Forbidden (403): Access denied.');
        return;
      }
      if (response.status === 400) {
        this._logger.error('Bad Request (400):', response.text);
        return;
      }
      if (response.status >= 500) {
        this._logger.error(`Server error (${response.status}):`, response.text);
        return;
      }
      if (response.status < 200 || response.status >= 300) {
        this._logger.error(
          `Unexpected HTTP status (${response.status}):`,
          response.text
        );
        return;
      }

      // Success (2xx)
      const json = response.json;
      const publishedCount = json?.publishedCount ?? 0;
      this._logger.info(
        `Successfully uploaded ${publishedCount} notes to VPS.`
      );
      return;
    } catch (error: any) {
      this._logger.error(`Exception during upload: `, error);
      return;
    }
  }

  // #region: private helpers

  private buildApiNote(note: PublishableNote, logger: LoggerPort): ApiNote {
    const title = this.extractFileNameWithoutExt(note.vaultPath);

    const slug = this.slugify(title);

    const route = this.buildFileRoute(
      note.folderConfig,
      note,
      slug,
      logger.child({ method: 'buildApiNote', noteId: note.noteId })
    );

    const nowIso = new Date().toISOString();

    logger.debug(
      `Building ApiNote for noteId=${note.noteId}, slug=${slug}, route=${route}`
    );

    const built: ApiNote = {
      id: note.noteId,
      title: title,
      slug: slug,
      route: route,
      relativePath: note.relativePath,
      vaultPath: note.vaultPath,
      markdown: note.content,
      frontmatter: {
        ...note.frontmatter,
        tags: (note.frontmatter.flat.tags || []) as string[],
      },
      publishedAt: nowIso,
    };
    logger.debug('Built ApiNote:', built);

    return built;
  }

  private extractFileNameWithoutExt(path: string): string {
    const last = path.split('/').pop() ?? path;
    const result = last.replace(/\.[^/.]+$/, '');
    this._logger.debug('Extracted file name without extension:', result);
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
    this._logger.debug(`Slugified value: ${value} -> ${slug}`);
    return slug;
  }

  private buildFileRoute(
    folderConfig: FolderConfig,
    note: PublishableNote,
    slug: string,
    logger: LoggerPort
  ): string {
    const baseRouteClean = folderConfig.routeBase?.replace(/\/$/, '') ?? '';
    logger.debug(
      `Base route clean: ${baseRouteClean} from ${folderConfig.routeBase}`
    );

    const cleanVaultFolder = folderConfig.vaultFolder
      .replace(/^\//, '')
      .replace(/\/$/, '');
    logger.debug(
      `Clean vault folder: ${cleanVaultFolder} from ${folderConfig.vaultFolder}`
    );

    const cleanVaultRoute = note.vaultPath
      .replace(/^\//, '')
      .split('/')
      .splice(0, -1)
      .join('/');
    logger.debug(
      `Clean vault route: ${cleanVaultRoute} from ${note.vaultPath}`
    );

    const relativePathFromFolder = cleanVaultFolder
      ? cleanVaultRoute.replace(new RegExp(`^${cleanVaultFolder}`), '')
      : cleanVaultRoute;
    logger.debug(
      `Relative path from folder: ${relativePathFromFolder} (cleanVaultFolder=${cleanVaultFolder}, cleanVaultRoute=${cleanVaultRoute})`
    );

    const route = `${baseRouteClean}/${relativePathFromFolder}/${slug}`.replace(
      /\/+/g,
      '/'
    );

    logger.debug(`Built file route: ${route}`);

    return route;
  }
}

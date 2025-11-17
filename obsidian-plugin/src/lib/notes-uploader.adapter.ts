import { requestUrl } from 'obsidian';
import type { PublishableNote } from '../../../core-publishing/src/lib/domain/PublishableNote';
import type { UploaderPort } from '../../../core-publishing/src/lib/ports/uploader-port';
import type { VpsConfig } from '../../../core-publishing/src/lib/domain/VpsConfig';
import { DomainFrontmatter, FolderConfig } from 'core-publishing/src';

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
  constructor(private readonly vpsConfig: VpsConfig) {}

  async upload(notes: PublishableNote[]): Promise<void> {
    if (!Array.isArray(notes) || notes.length === 0) return;

    const vps = (notes[0] as any).vpsConfig ?? this.vpsConfig;
    const apiKeyPlain = vps.apiKey;

    const apiNotes: ApiNote[] = notes.map((note) => this.buildApiNote(note));

    const body = { notes: apiNotes };

    const response = await requestUrl({
      url: vps.url.replace(/\/$/, '') + '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKeyPlain,
      },
      body: JSON.stringify(body),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Upload failed with status ${response.status}: ${response.text}`
      );
    }

    const json = response.json;
    if (!json || json.api !== 'ok') {
      throw new Error(`Upload API returned an error: ${JSON.stringify(json)}`);
    }
  }

  // #region: private helpers

  private buildApiNote(note: PublishableNote): ApiNote {
    const fm: DomainFrontmatter = note.frontmatter ?? {};

    const rawSlug = this.extractFileNameWithoutExt(note.vaultPath);

    const slug = this.slugify(rawSlug);

    const route = this.buildFileRoute(note.folderConfig, note, slug);

    const nowIso = new Date().toISOString();

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
    return last.replace(/\.[^/.]+$/, '');
    // "Arakišib — .../Angle mort.md" -> "Angle mort"
  }

  private slugify(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
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

    return `/${cleanVaultRoute.replace(
      cleanVaultFolder,
      baseRouteClean
    )}/${slug}`;
  }
}

import { requestUrl } from 'obsidian';
import type { PublishableNote } from '../../../core-publishing/src/lib/domain/PublishableNote';
import type { UploaderPort } from '../../../core-publishing/src/lib/ports/uploader-port';
import type { VpsConfig } from '../../../core-publishing/src/lib/domain/VpsConfig';

type ApiNote = {
  id: string;
  slug: string;
  route: string;
  relativePath?: string;
  vaultPath: string;
  markdown: string;
  frontmatter: {
    title: string;
    description: string;
    date: string;
    tags: string[];
  };
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
    const fm: any = note.frontmatter ?? {};

    const rawSlug =
      fm.slug ?? fm.title ?? this.extractFileNameWithoutExt(note.vaultPath);

    const slug = this.slugify(rawSlug);

    const routeBase = (note.folderConfig?.routeBase ?? '').replace(/\/+$/, '');

    let route = `${routeBase ? routeBase : ''}/${
      note.relativePath
    }/${slug}`.replace(/\/{2,}/g, '/');

    if (!route.startsWith('/')) route = `/${route}`;

    const nowIso = new Date().toISOString();
    const publishedAt =
      this.toIsoString(fm.publishedAt) ?? this.toIsoString(fm.date) ?? nowIso;

    const updatedAt = this.toIsoString(fm.updatedAt) ?? publishedAt;

    return {
      id: note.relativePath ?? note.vaultPath ?? route,
      slug,
      route: route,
      relativePath: note.relativePath,
      vaultPath: note.vaultPath,
      markdown: note.content,
      frontmatter: {
        title: fm.title ?? rawSlug,
        description: fm.description ?? '',
        date: this.toIsoString(fm.date) ?? publishedAt,
        tags: this.toStringArray(fm.tags),
      },
      publishedAt,
      updatedAt,
    };
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

  private toIsoString(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof (value as any).toISOString === 'function') {
      try {
        const iso = (value as any).toISOString();
        const d = new Date(iso);
        return isNaN(d.getTime()) ? null : d.toISOString();
      } catch {
        return null;
      }
    }
    return null;
  }

  private toStringArray(tags: unknown): string[] {
    if (!tags) return [];
    if (Array.isArray(tags)) {
      return tags
        .map((t) => (typeof t === 'string' ? t : String(t)))
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (typeof tags === 'string') {
      return tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  }
}

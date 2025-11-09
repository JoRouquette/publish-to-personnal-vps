import { requestUrl } from 'obsidian';
import type { PublishableNote } from '../../../core-publishing/src/lib/domain/PublishableNote';
import type { UploaderPort } from '../../../core-publishing/src/lib/ports/uploader-port';
import type { VpsConfig } from '../../../core-publishing/src/lib/domain/VpsConfig';

export class HttpUploaderAdapter implements UploaderPort {
  constructor(private readonly vpsConfig: VpsConfig) {}

  async uploadNote(note: PublishableNote): Promise<void> {
    const { folderConfig, frontmatter = {} as any } = note;

    const rawSlug =
      frontmatter.slug ??
      frontmatter.title ??
      this.extractFileNameWithoutExt(note.relativePath ?? note.vaultPath);

    const slug = this.slugify(rawSlug);

    const routeBase = (folderConfig?.routeBase ?? '').replace(/\/+$/, '') || '';
    const route = `${routeBase}/${slug}` || `/${slug}`;

    const nowIso = new Date().toISOString();

    const publishedAt =
      this.toIsoString(frontmatter.publishedAt) ??
      this.toIsoString(frontmatter.date) ??
      nowIso;

    const updatedAt = this.toIsoString(frontmatter.updatedAt) ?? publishedAt;

    const apiFrontmatter = {
      title: frontmatter.title ?? rawSlug,
      description: frontmatter.description ?? '',
      date: this.toIsoString(frontmatter.date) ?? publishedAt,
      tags: this.toStringArray(frontmatter.tags),
    };

    const id = note.relativePath ?? note.vaultPath ?? route;

    const body = {
      notes: [
        {
          id,
          slug,
          route,
          markdown: note.content,
          frontmatter: apiFrontmatter,
          publishedAt,
          updatedAt,
        },
      ],
    };

    const response = await requestUrl({
      url: this.vpsConfig.url.replace(/\/$/, '') + '/api/upload',
      method: 'POST',
      headers: {
        Origin: 'app://obsidian.md',
        'Content-Type': 'application/json',
        'x-api-key': this.vpsConfig.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Upload failed with status ${response.status}: ${response.text}`
      );
    }

    const json = response.json;
    if (!json || json.ok !== true) {
      throw new Error(`Upload API returned an error: ${JSON.stringify(json)}`);
    }
  }

  // #region: Helpers privés

  private extractFileNameWithoutExt(path: string): string {
    const lastSegment = path.split('/').pop() ?? path;
    return lastSegment.replace(/\.[^/.]+$/, '');
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
      const t = value.getTime();
      return isNaN(t) ? null : value.toISOString();
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
        .filter((t) => t.length > 0);
    }

    if (typeof tags === 'string') {
      return tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    return [];
  }
}

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

    const vps = (note as any).vpsConfig ?? this.vpsConfig;

    const requestOptions = {
      url: vps.url.replace(/\/$/, '') + '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vps.apiKey,
      },
      body: JSON.stringify(body),
    };

    try {
      const response = await requestUrl(requestOptions);

      if (response.status < 200 || response.status >= 300) {
        console.error(
          `[HttpUploaderAdapter] Upload failed with status ${response.status}: ${response.text}`
        );
        throw new Error(
          `Upload failed with status ${response.status}: ${response.text}`
        );
      }

      const json = response.json;

      if (!json || json.ok !== true) {
        console.error(
          `[HttpUploaderAdapter] Upload API returned an error: ${JSON.stringify(
            json
          )}`
        );
        throw new Error(
          `Upload API returned an error: ${JSON.stringify(json)}`
        );
      }
    } catch (err) {
      console.error('[HttpUploaderAdapter] Exception during upload:', err);
      throw err;
    }
  }

  // #region: Helpers privés

  private extractFileNameWithoutExt(path: string): string {
    const lastSegment = path.split('/').pop() ?? path;
    const result = lastSegment.replace(/\.[^/.]+$/, '');
    return result;
  }

  private slugify(value: string): string {
    const result = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
    return result;
  }

  private toIsoString(value: unknown): string | null {
    if (!value) return null;

    if (value instanceof Date) {
      const t = value.getTime();
      const result = isNaN(t) ? null : value.toISOString();
      return result;
    }

    if (typeof value === 'string') {
      const d = new Date(value);
      const result = isNaN(d.getTime()) ? null : d.toISOString();
      return result;
    }

    if (typeof (value as any).toISOString === 'function') {
      try {
        const iso = (value as any).toISOString();
        const d = new Date(iso);
        const result = isNaN(d.getTime()) ? null : d.toISOString();
        return result;
      } catch (err) {
        console.error('[HttpUploaderAdapter] toIsoString (custom) error:', err);
        return null;
      }
    }

    return null;
  }

  private toStringArray(tags: unknown): string[] {
    if (!tags) return [];

    if (Array.isArray(tags)) {
      const result = tags
        .map((t) => (typeof t === 'string' ? t : String(t)))
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      return result;
    }

    if (typeof tags === 'string') {
      const result = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      return result;
    }

    return [];
  }
}

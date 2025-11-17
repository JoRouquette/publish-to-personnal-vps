// core-publishing/src/lib/usecases/compute-routing.usecase.ts
import type { PublishableNote } from '../domain/PublishableNote.js';
import type { NoteRoutingInfo } from '../domain/NoteRoutingInfo.js';

function slugifySegment(segment: string): string {
  return segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s/g, '-');
}

function normalizeRouteBase(routeBase: string): string {
  if (!routeBase) return '';
  let r = routeBase.trim();
  if (!r.startsWith('/')) r = '/' + r;
  if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
  return r;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export class ComputeRoutingUseCase {
  execute(note: PublishableNote): PublishableNote {
    const routeBase = normalizeRouteBase(note.folderConfig.routeBase || '');
    const normalizedRel = normalizePath(note.relativePath);

    const segments = normalizedRel.split('/').filter(Boolean);

    let routing: NoteRoutingInfo;

    if (segments.length === 0) {
      const slug = 'note';
      routing = {
        id: slug,
        slug,
        path: '',
        routeBase,
        fullPath: routeBase ? `${routeBase}/${slug}` : `/${slug}`,
      };
    } else {
      const fileSegment = segments[segments.length - 1];
      const dirSegments = segments.slice(0, -1);

      const fileBase = fileSegment.replace(/\.[^/.]+$/, '');
      const slug = slugifySegment(fileBase);

      const sluggedDirs = dirSegments.map(slugifySegment).filter(Boolean);
      const path = sluggedDirs.join('/');

      const id = path ? `${path}/${slug}` : slug;

      const parts = [routeBase || ''];
      if (path) parts.push(path);
      parts.push(slug);

      const fullPath = parts
        .filter(Boolean)
        .join('/')
        .replace(/\/{2,}/g, '/');

      routing = {
        id,
        slug,
        path,
        routeBase,
        fullPath,
      };
    }

    return {
      ...note,
      routing,
    };
  }
}

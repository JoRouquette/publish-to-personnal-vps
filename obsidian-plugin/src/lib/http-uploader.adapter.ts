import { UploaderPort } from '../../../core-publishing/src/lib/ports/uploader-port';
import { PublishableNote } from '../../../core-publishing/src/lib/domain/PublishableNote';

export class HttpUploaderAdapter implements UploaderPort {
  async uploadNote(note: PublishableNote): Promise<void> {
    const baseUrl = note.vpsConfig.url.replace(/\/+$/, '');
    const url = `${baseUrl}/api/upload`;

    const body = {
      routeBase: note.folderConfig.routeBase,
      relativePath: note.relativePath,
      content: note.content,
      frontmatter: note.frontmatter,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': note.vpsConfig.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
  }
}

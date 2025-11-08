import type { VpsConfig } from '../../../../core-publishing/src/lib/domain/VpsConfig';

export type HttpConnectionResult =
  | 'success'
  | 'failure'
  | 'invalid-url'
  | 'missing-api-key'
  | 'unexpected-response'
  | 'invalid-json';

export async function testVpsConnection(
  vps: VpsConfig
): Promise<HttpConnectionResult> {
  const baseUrl = (vps.url ?? '').trim();

  if (!baseUrl) {
    return 'invalid-url';
  }
  if (!vps.apiKey) {
    return 'missing-api-key';
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/ping`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': vps.apiKey,
    },
  });

  if (!res.ok) {
    return `HTTP ${res.status}` as HttpConnectionResult;
  }

  // On vérifie le payload, par sécurité
  let body: any = null;
  try {
    body = (await res.json()) as HttpConnectionResult;
  } catch {
    return 'invalid-json';
  }

  if (!body || body.ok !== true) {
    return 'unexpected-response';
  }

  return 'success';
}

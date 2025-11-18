import { HttpResponse } from 'core-publishing/src/lib/domain/HttpResponse';
import type { VpsConfig } from 'core-publishing/src/lib/domain/VpsConfig';
import { type LoggerPort } from 'core-publishing/src/lib/ports/logger-port';
import { HandleHttpResponseUseCase } from 'core-publishing/src/lib/usecases/handle-http-response.usecase';
import { requestUrl } from 'obsidian';

function normalizeBaseUrl(url: string): string {
  let u = url.trim();
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

export async function testVpsConnection(
  vps: VpsConfig,
  handleHttpResponse: HandleHttpResponseUseCase,
  logger: LoggerPort
): Promise<HttpResponse> {
  logger.debug('Testing VPS connection', { vps });

  if (!vps.apiKey)
    return { isError: true, error: new Error('Missing API key') };
  if (!vps.url) return { isError: true, error: new Error('Invalid URL') };

  const baseUrl = normalizeBaseUrl(vps.url);
  const url = `${baseUrl}/api/ping`;

  logger.debug(`Pinging VPS at ${url}`);

  try {
    const res = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'x-api-key': vps.apiKey,
      },
    });

    return await handleHttpResponse.handleResponse(res);
  } catch (e) {
    logger.error('Error during VPS connection test', e);
    return {
      isError: true,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

import type { VpsConfig } from 'core-publishing/src/lib/domain/VpsConfig';
import { type LoggerPort } from 'core-publishing/src/lib/ports/logger-port';
import { requestUrl } from 'obsidian';

export enum TestConnectionStatus {
  success = 'success',
  failure = 'failure',
  unexpectedResponse = 'unexpected-response',
  invalidJson = 'invalid-json',
  missingApiKey = 'missing-api-key',
  invalidUrl = 'invalid-url',
}

export type TestConnectionResult = {
  status: TestConnectionStatus;
  message?: string;
};

function normalizeBaseUrl(url: string): string {
  let u = url.trim();
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

export async function testVpsConnection(
  vps: VpsConfig,
  logger: LoggerPort
): Promise<TestConnectionResult> {
  logger.debug('Testing VPS connection', { vps });

  if (!vps.apiKey) return { status: TestConnectionStatus.missingApiKey };
  if (!vps.url) return { status: TestConnectionStatus.invalidUrl };

  const baseUrl = normalizeBaseUrl(vps.url);
  const url = `${baseUrl}/api/ping`;

  logger.debug('Pinging VPS at', url);

  try {
    const res = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'x-api-key': vps.apiKey,
      },
    });

    if (res.status !== 200) {
      logger.warn('Unexpected response status for ping:', res.status);
      return {
        status: TestConnectionStatus.unexpectedResponse,
        message: `HTTP ${res.status}, expected 200`,
      };
    }

    try {
      const data = JSON.parse(res.text);
      logger.debug('Ping response data:', data);

      if (res.status === 200 && data?.api === 'ok') {
        logger.info('VPS connection test successful', res);
        return { status: TestConnectionStatus.success };
      }

      return {
        status: TestConnectionStatus.unexpectedResponse,
        message: res.text,
      };
    } catch (e) {
      logger.warn('Invalid JSON in ping response', e, res.text);
      return {
        status: TestConnectionStatus.invalidJson,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  } catch (e) {
    logger.error('Connection test failed', e);
    return {
      status: TestConnectionStatus.failure,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

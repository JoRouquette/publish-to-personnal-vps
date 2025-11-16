import type { VpsConfig } from 'core-publishing/src/lib/domain/VpsConfig';
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
  vps: VpsConfig
): Promise<TestConnectionResult> {
  if (!vps.apiKey) return { status: TestConnectionStatus.missingApiKey };
  if (!vps.url) return { status: TestConnectionStatus.invalidUrl };

  const baseUrl = normalizeBaseUrl(vps.url);
  const url = `${baseUrl}/api/ping`;

  try {
    const res = await requestUrl({
      url,
      method: 'GET',
      headers: {
        'x-api-key': vps.apiKey,
      },
    });

    if (res.status !== 200) {
      console.warn(
        '[PublishToPersonalVps] Unexpected response status for ping:',
        res.status
      );
      return {
        status: TestConnectionStatus.unexpectedResponse,
        message: `HTTP ${res.status}, expected 200`,
      };
    }

    try {
      const data = JSON.parse(res.text);

      if (data?.status === 200 || data?.pong === true) {
        return { status: TestConnectionStatus.success };
      }

      return {
        status: TestConnectionStatus.unexpectedResponse,
        message: res.text,
      };
    } catch (e) {
      console.warn(
        '[PublishToPersonalVps] Invalid JSON in ping response',
        e,
        res.text
      );
      return {
        status: TestConnectionStatus.invalidJson,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  } catch (e) {
    console.error('[PublishToPersonalVps] Connection test failed', e);
    return {
      status: TestConnectionStatus.failure,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

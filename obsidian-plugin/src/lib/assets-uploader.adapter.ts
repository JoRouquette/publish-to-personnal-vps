import { requestUrl } from 'obsidian';
import type { UploaderPort } from '../../../core-publishing/src/lib/ports/uploader-port';
import type { VpsConfig } from '../../../core-publishing/src/lib/domain/VpsConfig';
import type { ResolvedAssetFile } from '../../../core-publishing/src/lib/domain/ResolvedAssetFile';

type ApiAsset = {
  relativePath: string;
  vaultPath: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export class AssetsUploaderAdapter implements UploaderPort {
  constructor(private readonly vpsConfig: VpsConfig) {}

  async upload(assets: ResolvedAssetFile[]): Promise<void> {
    if (!Array.isArray(assets) || assets.length === 0) return;

    const vps = (assets[0] as any).vpsConfig ?? this.vpsConfig;
    const apiKeyPlain = vps.apiKey;

    const apiAssets: ApiAsset[] = await Promise.all(
      assets.map(async (asset) => await this.buildApiAsset(asset))
    );

    const body = { assets: apiAssets };

    const response = await requestUrl({
      url: vps.url.replace(/\/$/, '') + '/api/upload-assets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKeyPlain,
      },
      body: JSON.stringify(body),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Asset upload failed with status ${response.status}: ${response.text}`
      );
    }

    const json = response.json;
    if (!json || json.ok !== true) {
      throw new Error(`Upload API returned an error: ${JSON.stringify(json)}`);
    }
  }

  private async buildApiAsset(asset: ResolvedAssetFile): Promise<ApiAsset> {
    return {
      relativePath: asset.relativeAssetPath,
      vaultPath: asset.vaultPath,
      fileName: asset.fileName,
      mimeType: (asset as any).mimeType ?? this.guessMimeType(asset.fileName),
      contentBase64: await this.toBase64((asset as any).content),
    };
  }

  private async toBase64(content: ArrayBuffer | Uint8Array): Promise<string> {
    if (content instanceof ArrayBuffer) {
      return Buffer.from(content).toString('base64');
    }
    if (content instanceof Uint8Array) {
      return Buffer.from(
        content.buffer,
        content.byteOffset,
        content.byteLength
      ).toString('base64');
    }
    throw new Error('Unsupported asset content type');
  }

  private guessMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'svg':
        return 'image/svg+xml';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }
}

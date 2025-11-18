import { UploaderPort } from 'core-publishing/src/lib/domain/uploader-port';
import { HandleHttpResponseUseCase } from 'core-publishing/src/lib/usecases/handle-http-response.usecase';
import { requestUrl, RequestUrlResponse } from 'obsidian';
import type { ResolvedAssetFile } from '../../../core-publishing/src/lib/domain/ResolvedAssetFile';
import type { VpsConfig } from '../../../core-publishing/src/lib/domain/VpsConfig';
import type { LoggerPort } from '../../../core-publishing/src/lib/ports/logger-port';

type ApiAsset = {
  relativePath: string;
  vaultPath: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export class AssetsUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;
  private readonly _handleResponse: HandleHttpResponseUseCase<RequestUrlResponse>;

  constructor(
    private readonly vpsConfig: VpsConfig,
    handleResponse: HandleHttpResponseUseCase<RequestUrlResponse>,
    logger: LoggerPort
  ) {
    this._logger = logger;
    this._handleResponse = handleResponse;
    this._logger.debug('AssetsUploaderAdapter initialized');
  }

  async upload(assets: ResolvedAssetFile[]): Promise<boolean> {
    if (!Array.isArray(assets) || assets.length === 0) {
      this._logger.info('No assets to upload.');
      return false;
    }

    const vps = (assets[0] as any).vpsConfig ?? this.vpsConfig;
    const apiKeyPlain = vps.apiKey;

    this._logger.debug('Preparing to upload assets', {
      assetCount: assets.length,
    });

    let apiAssets: ApiAsset[];
    try {
      apiAssets = await Promise.all(
        assets.map(async (asset) => await this.buildApiAsset(asset))
      );
    } catch (err) {
      this._logger.error('Failed to build API assets', err);
      throw err;
    }

    const body = { assets: apiAssets };

    this._logger.info('Uploading assets to VPS', {
      url: vps.url,
      assetCount: apiAssets.length,
    });

    try {
      const response = await requestUrl({
        url: vps.url.replace(/\/$/, '') + '/api/upload-assets',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKeyPlain,
        },
        body: JSON.stringify(body),
        throw: false,
      });

      const result = await this._handleResponse.handleResponse(response);

      this._logger.info('Assets upload completed');

      if (result.isError) {
        this._logger.error('Assets upload failed', {
          error: result.error,
          httpStatus: result.httpStatus,
          text: result.text,
        });

        throw result.error;
      }

      this._logger.debug('Assets upload response', {
        httpStatus: result.httpStatus,
        text: result.text,
      });

      return true;
    } catch (err) {
      this._logger.error('HTTP request to upload assets failed', err);
      throw err;
    }
  }

  private async buildApiAsset(asset: ResolvedAssetFile): Promise<ApiAsset> {
    this._logger.debug('Building API asset', { fileName: asset.fileName });
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
    this._logger.error('Unsupported asset content type');
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

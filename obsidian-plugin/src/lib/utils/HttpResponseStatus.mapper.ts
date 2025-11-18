import { LoggerPort } from 'core-publishing/src/lib/ports/logger-port';
import { RequestUrlResponse } from 'obsidian';

export class HttpResponseStatusMapper {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ module: 'HttpResponseStatusMapper' });
    this._logger.debug('HttpResponseStatusMapper initialized');
  }

  mapOdsidianResponseToHttpResponse(response: RequestUrlResponse): Response {
    this._logger.debug('Mapping Obsidian response to Fetch Response', {
      response,
    });

    const options: ResponseInit = {
      status: response.status,
      statusText: this.getStatusText(response.status),
      headers: response.headers,
    };

    const responseObj = new Response(response.text, options);

    this._logger.debug('Mapped Response object', { responseObj });
    return responseObj;
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return statusTexts[status] || 'Unknown Status';
  }
}

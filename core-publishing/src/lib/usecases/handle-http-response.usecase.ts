import { HttpResponse, HttpStatus } from '../domain/HttpResponse';
import type { LoggerPort } from '../ports/logger-port';

export type Mapper<T> = (response: T) => Response | Promise<Response>;

export class HandleHttpResponseUseCase<T> {
  private readonly _logger: LoggerPort;
  private readonly _defaultResponseMapper: Mapper<T>;

  constructor(mapper: Mapper<T>, logger: LoggerPort) {
    this._defaultResponseMapper = mapper;
    this._logger = logger.child({ usecase: 'HandleHttpResponseUseCase' });
    this._logger.debug('HandleHttpResponseUseCase initialized');
  }

  async handleResponse(res: T): Promise<HttpResponse> {
    try {
      this._logger.debug('Handling HTTP response', { res });
      const response = await this._defaultResponseMapper(res);

      if (
        !response ||
        typeof response !== 'object' ||
        typeof response.text !== 'function'
      ) {
        this._logger.error('Mapper did not return a valid Response object', {
          response,
        });
        return {
          isError: true,
          error: new Error('Mapper did not return a valid Response object'),
        };
      }

      const text = await response.text();
      if (response.ok) {
        this._logger.debug(`HTTP request successful: ${response.status}`);

        return {
          isError: false,
          httpStatus: new HttpStatus(
            response.status,
            response.statusText
          ).toString(),
          text,
        };
      } else {
        this._logger.error(
          `HTTP request failed ${response.status}`,
          text,
          response
        );

        return {
          isError: true,
          error: new Error(
            `HTTP Error ${response.status} ${response.statusText}`
          ),
          httpStatus: new HttpStatus(
            response.status,
            response.statusText
          ).toString(),
          text,
        };
      }
    } catch (error) {
      this._logger.error('Error handling HTTP response ', error);
      return {
        isError: true,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

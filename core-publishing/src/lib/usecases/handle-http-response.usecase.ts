import { HttpResponse } from '../domain/HttpResponse';
import { LoggerPort } from '../ports/logger-port';

export type Mapper = (response: any) => Response;

export class HandleHttpResponseUseCase {
  private readonly _logger: LoggerPort;
  private readonly _defautMapper: Mapper;

  constructor(mapper: Mapper, logger: LoggerPort) {
    this._defautMapper = mapper;
    this._logger = logger;
  }

  async handleResponse(res: unknown): Promise<HttpResponse> {
    const response = this._defautMapper(res);
    this._logger.debug('Handling HTTP response', { response });

    try {
      const text = await response.text();
      if (response.ok) {
        this._logger.debug(`HTTP request successful: ${response.status}`);

        return {
          isError: false,
          httpStatus: { code: response.status, text: response.statusText },
          text,
        };
      } else {
        this._logger.error(
          `HTTP request failed: ${response.status}`,
          text,
          response
        );

        return {
          isError: true,
          error: new Error(
            `HTTP Error: ${response.status} ${response.statusText}`
          ),
          httpStatus: { code: response.status, text: response.statusText },
          text,
        };
      }
    } catch (error) {
      this._logger.error('Error handling HTTP response:', error, response);
      return {
        isError: true,
        error,
      };
    }
  }
}

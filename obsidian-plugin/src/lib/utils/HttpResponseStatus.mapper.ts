import { RequestUrlResponse } from 'obsidian';

export class HttpResponseStatusMapper {
  static mapOdsidianResponseToHttpResponse(
    response: RequestUrlResponse
  ): Response {
    const options: ResponseInit = {
      status: response.status,
      statusText: this.getStatusText(response.status),
      headers: response.headers,
    };

    return new Response(response.text, options);
  }

  static getStatusText(status: number): string {
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

type HttpStatus = { code: number; text: string };

export type HttpResponse =
  | { isError: false; httpStatus: HttpStatus; text: string }
  | { isError: true; error: unknown; httpStatus?: HttpStatus; text?: string };

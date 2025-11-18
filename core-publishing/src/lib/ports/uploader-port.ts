import { HttpResponse } from '../domain/HttpResponse.js';
import { PublishableNote } from '../domain/PublishableNote.js';

export interface UploaderPort {
  upload(toUpload: unknown[]): Promise<boolean>;
}

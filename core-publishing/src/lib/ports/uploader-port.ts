import { PublishableNote } from '../domain/PublishableNote.js';

export interface UploaderPort {
  upload(toUpload: unknown[]): Promise<unknown>;
}

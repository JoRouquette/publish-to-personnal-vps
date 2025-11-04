import { PublishableNote } from '../domain/models.js';

export interface UploaderPort {
  uploadNote(note: PublishableNote): Promise<void>;
}

import { PublishableNote } from '../domain/PublishableNote.js';

export interface UploaderPort {
  uploadNote(note: PublishableNote): Promise<void>;
}

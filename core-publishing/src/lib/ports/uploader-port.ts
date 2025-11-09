import { PublishableNote } from '../domain/PublishableNote.js';

export interface UploaderPort {
  uploadNotes(notes: PublishableNote[]): Promise<void>;
}

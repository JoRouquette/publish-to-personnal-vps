import { NoteRoutingInfo } from './NoteRoutingInfo';
import { PublishableNote } from './PublishableNote';

/**
 * Capacité : "has routing"
 */

export type NoteWithRouting = PublishableNote & {
  routing: NoteRoutingInfo;
};

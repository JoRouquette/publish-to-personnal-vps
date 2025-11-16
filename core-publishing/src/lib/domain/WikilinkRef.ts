export type WikilinkKind = 'note' | 'embed' | 'image';

export interface WikilinkRef {
  raw: string;
  target: string;
  kind: WikilinkKind;
}

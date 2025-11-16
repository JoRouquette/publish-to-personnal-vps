export type ImageAlignment = 'left' | 'right' | 'center';

export interface ImageAssetRef {
  vaultPath: string;
  logicalName: string;
  alignment?: ImageAlignment;
  widthPx?: number;
}

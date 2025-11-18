import { FolderConfig } from '../domain/FolderConfig.js';

export interface VaultPort<T> {
  collectFromFolder(folder: FolderConfig): Promise<T>;
}

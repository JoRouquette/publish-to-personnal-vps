import { FolderConfig } from './FolderConfig';
import { Frontmatter } from './Frontmatter';
import { VpsConfig } from './VpsConfig';

export interface PublishableNote {
  vaultPath: string;
  relativePath: string;
  content: string;
  frontmatter: Frontmatter;
  folderConfig: FolderConfig;
  vpsConfig: VpsConfig;
}

import { DomainFrontmatter } from './DomainFrontmatter';
import { FolderConfig } from './FolderConfig';
import { VpsConfig } from './VpsConfig';

export interface PublishableNote {
  vaultPath: string;
  relativePath: string;
  content: string;
  frontmatter: DomainFrontmatter;
  folderConfig: FolderConfig;
  vpsConfig: VpsConfig;
}

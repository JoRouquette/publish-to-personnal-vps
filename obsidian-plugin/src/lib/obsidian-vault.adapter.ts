import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { FolderConfig } from '../../../core-publishing/src/lib/domain/models';
import { VaultPort } from '../../../core-publishing/src/lib/ports/vault-port';

export class ObsidianVaultAdapter implements VaultPort {
  constructor(private readonly app: App) {}

  async collectNotesForFolder(folder: FolderConfig) {
    const vault = this.app.vault;
    const folderPath = normalizePath(folder.vaultFolder);
    const root = vault.getAbstractFileByPath(folderPath);

    if (!(root instanceof TFolder)) {
      return { notes: [] };
    }

    const notes: Array<{
      vaultPath: string;
      relativePath: string;
      content: string;
      frontmatter: Record<string, any>;
    }> = [];

    const stack: (TFolder | TFile)[] = [root];

    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;

      if (current instanceof TFolder) {
        for (const child of current.children) {
          if (child instanceof TFolder || child instanceof TFile) {
            stack.push(child);
          }
        }
      } else if (current instanceof TFile && current.extension === 'md') {
        const content = await vault.read(current);
        const cache = this.app.metadataCache.getFileCache(current);
        const frontmatter = cache?.frontmatter || {};

        const relativePath = current.path
          .substring(root.path.length)
          .replace(/^\/+/, '');

        notes.push({
          vaultPath: current.path,
          relativePath,
          content,
          frontmatter,
        });
      }
    }

    return { notes };
  }
}

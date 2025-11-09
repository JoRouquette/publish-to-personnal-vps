// obsidian-plugin/src/lib/obsidian-vault.adapter.ts
import { App, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { VaultPort } from '../../../core-publishing/src/lib/ports/vault-port';
import type { FolderConfig } from '../../../core-publishing/src/lib/domain/FolderConfig';

export class ObsidianVaultAdapter implements VaultPort {
  constructor(private readonly app: App) {}

  async collectNotesFromFolder(folderCfg: FolderConfig): Promise<{
    notes: Array<{
      vaultPath: string;
      relativePath: string;
      content: string;
      frontmatter: Record<string, any>;
    }>;
  }> {
    const result: Array<{
      vaultPath: string;
      relativePath: string;
      content: string;
      frontmatter: Record<string, any>;
    }> = [];

    const rootPath = folderCfg.vaultFolder?.trim();
    if (!rootPath) return { notes: result };

    const root = this.app.vault.getAbstractFileByPath(rootPath);
    if (!root) return { notes: result };

    const walk = async (node: TAbstractFile) => {
      if (node instanceof TFolder) {
        for (const child of node.children) {
          await walk(child);
        }
      } else if (node instanceof TFile) {
        if ((node.extension || '').toLowerCase() !== 'md') return;

        const content = await this.app.vault.read(node);
        const cache = this.app.metadataCache.getFileCache(node);
        const frontmatter: Record<string, any> =
          (cache?.frontmatter as any) ?? {};

        result.push({
          vaultPath: node.path,
          relativePath: this.computeRelative(node.path, rootPath),
          content,
          frontmatter,
        });
      }
    };

    await walk(root);
    return { notes: result };
  }

  private computeRelative(filePath: string, folderPath: string): string {
    // Toujours renvoyer une string :
    // - direct sous le dossier -> "Fichier.md"
    // - sous-dossier -> "Sous/Path/Fichier.md"
    // - si incohérent, fallback: filePath entier
    if (!folderPath) return filePath;
    if (filePath.startsWith(folderPath)) {
      let rel = filePath.slice(folderPath.length);
      rel = rel.replace(/^\/+/, '');
      return rel.length > 0 ? rel : '';
    }
    return filePath;
  }
}

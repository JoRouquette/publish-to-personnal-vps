// obsidian-plugin/src/lib/obsidian-vault.adapter.ts
import { App, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { VaultPort } from '../../../core-publishing/src/lib/ports/vault-port';
import type { FolderConfig } from '../../../core-publishing/src/lib/domain/FolderConfig';
import type { LoggerPort } from '../../../core-publishing/src/lib/ports/logger-port';

export class ObsidianVaultAdapter implements VaultPort {
  private readonly _logger: LoggerPort;

  constructor(private readonly app: App, logger: LoggerPort) {
    this._logger = logger;
    this._logger.debug('ObsidianVaultAdapter initialized');
  }

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
    if (!rootPath) {
      this._logger.warn('No rootPath specified in FolderConfig', { folderCfg });
      return { notes: result };
    }

    const root = this.app.vault.getAbstractFileByPath(rootPath);
    if (!root) {
      this._logger.warn('Root folder not found in vault', { rootPath });
      return { notes: result };
    }

    const walk = async (node: TAbstractFile) => {
      if (node instanceof TFolder) {
        this._logger.debug('Walking folder', { path: node.path });
        for (const child of node.children) {
          await walk(child);
        }
      } else if (node instanceof TFile) {
        if ((node.extension || '').toLowerCase() !== 'md') {
          this._logger.debug('Skipping non-markdown file', { path: node.path });
          return;
        }

        this._logger.debug('Reading file', { path: node.path });
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
        this._logger.info('Collected note', { path: node.path });
      }
    };

    this._logger.info('Starting note collection', { rootPath });
    await walk(root);
    this._logger.info('Finished note collection', {
      count: result.length,
      rootPath,
    });
    return { notes: result };
  }

  private computeRelative(filePath: string, folderPath: string): string {
    if (!folderPath) return filePath;
    if (filePath.startsWith(folderPath)) {
      let rel = filePath.slice(folderPath.length);
      rel = rel.replace(/^\/+/, '');
      return rel.length > 0 ? rel : '';
    }
    return filePath;
  }
}

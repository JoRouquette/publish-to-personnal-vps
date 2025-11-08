import { FolderConfig } from '../domain/FolderConfig.js';

export interface VaultPort {
  /**
   * Retourne les notes candidates à la publication pour un dossier configuré.
   * Le port ne doit PAS appliquer la logique de filtrage métier : il collecte,
   * lit les contenus et renvoie toutes les notes avec leurs frontmatters.
   */
  collectNotesFromFolder(folder: FolderConfig): Promise<{
    notes: Array<{
      vaultPath: string;
      relativePath: string;
      content: string;
      frontmatter: Record<string, any>;
    }>;
  }>;
}

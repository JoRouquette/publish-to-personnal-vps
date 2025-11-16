/**
 * Port d'accès aux fichiers d'assets dans le vault.
 *
 * L'implémentation Obsidian se servira de `app.vault` pour:
 * - lister les fichiers d'un dossier,
 * - chercher un fichier par nom/chemin,
 * - lire le contenu binaire.
 */
export interface AssetsVaultPort {
  /**
   * Liste tous les fichiers (chemins relatifs au vault) sous un dossier donné.
   * ex: "assets", "_Assets", etc.
   */
  listFilesInFolder(folderPath: string): Promise<string[]>;

  /**
   * Liste tous les fichiers du vault (chemins relatifs).
   * Utilisé uniquement en fallback si on ne trouve pas dans le dossier d'assets.
   */
  listAllFiles(): Promise<string[]>;

  /**
   * Lit le contenu binaire d'un fichier.
   * @param vaultPath chemin relatif au vault, ex: "assets/divinites/Tenebra1.jpg"
   */
  readBinary(vaultPath: string): Promise<Uint8Array>;
}

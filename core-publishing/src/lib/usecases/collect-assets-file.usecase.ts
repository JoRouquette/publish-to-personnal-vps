import { AssetRef } from '../domain/AssetRef';
import type { AssetsUploaderPort } from '../ports/assets-uploader-port';
import type { AssetsVaultPort } from '../ports/assets-vault-port';

export interface CollectAssetsFileInput {
  /**
   * Tous les assets détectés dans les notes à publier.
   * On dédupliquera par `target`.
   */
  assets: AssetRef[];

  /**
   * Dossier d'assets dans le vault.
   * ex: "assets", "_Assets", "content/assets", etc.
   * Utilisé en priorité pour trouver les fichiers.
   */
  assetsFolder: string;

  /**
   * Si true, on active la recherche de fallback dans tout le vault
   * quand l'asset n'est pas trouvé dans `assetsFolder`.
   *
   * Tu peux le passer à false pour être strict.
   */
  enableVaultFallback: boolean;
}

export class CollectAssetsFileUseCase {
  constructor(
    private readonly assetsVaultPort: AssetsVaultPort,
    private readonly assetsUploaderPort: AssetsUploaderPort
  ) {}

  async execute(input: CollectAssetsFileInput): Promise<void> {
    const { assets, assetsFolder, enableVaultFallback } = input;

    if (!assets || assets.length === 0) {
      return;
    }

    // Déduplication par target (insensible à la casse pour éviter les surprises)
    const uniqueTargets = new Map<string, AssetRef>();
    for (const asset of assets) {
      const key = asset.target.toLowerCase();
      if (!uniqueTargets.has(key)) {
        uniqueTargets.set(key, asset);
      }
    }

    // Pré-charger les listes de fichiers
    const filesInAssetsFolder = await this.assetsVaultPort.listFilesInFolder(
      assetsFolder
    );
    const allFiles = enableVaultFallback
      ? await this.assetsVaultPort.listAllFiles()
      : [];

    // Normalisation simple des chemins
    const normalizedAssetsFolder = normalizeFolderPath(assetsFolder);

    for (const asset of uniqueTargets.values()) {
      const target = normalizeRelativePath(asset.target);

      // 1) Essayer dans le dossier d'assets
      const vaultPathFromAssets = findInAssetsFolder(
        filesInAssetsFolder,
        normalizedAssetsFolder,
        target
      );

      let vaultPath: string | undefined = vaultPathFromAssets;

      // 2) Fallback (optionnel) : chercher dans tout le vault
      if (!vaultPath && enableVaultFallback) {
        vaultPath = findInVault(allFiles, target);
      }

      if (!vaultPath) {
        // Ici tu peux logger via une future LoggingPort si tu veux.
        // Pour l'instant : on ignore l'asset introuvable.
        continue;
      }

      const content = await this.assetsVaultPort.readBinary(vaultPath);

      // Route côté backend = chemin utilisé dans l'embed (H1)
      const routePath = target;

      await this.assetsUploaderPort.uploadAsset({
        routePath,
        content,
      });
    }
  }
}

/**
 * Normalise un chemin de dossier :
 * - enlève les slashs de début/fin
 */
function normalizeFolderPath(path: string): string {
  return path.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
}

/**
 * Normalise un chemin relatif :
 * - enlève les slashs de début
 */
function normalizeRelativePath(path: string): string {
  return path.replace(/^[/\\]+/, '');
}

/**
 * Trouve un fichier dans le dossier d'assets configuré.
 *
 * filesInAssetsFolder contient des chemins relatifs au vault, par ex:
 *  - "assets/divinites/Tenebra1.jpg"
 *  - "assets/icons/icon.png"
 *
 * assetsFolder = "assets"
 * target = "divinites/Tenebra1.jpg"
 * => on cherche "assets/divinites/Tenebra1.jpg"
 */
function findInAssetsFolder(
  filesInAssetsFolder: string[],
  assetsFolder: string,
  target: string
): string | undefined {
  const prefix = assetsFolder === '' ? '' : assetsFolder + '/';
  const expected = (prefix + target).toLowerCase();

  for (const file of filesInAssetsFolder) {
    if (file.toLowerCase() === expected) {
      return file;
    }
  }

  return undefined;
}

/**
 * Fallback : chercher dans tout le vault un fichier dont le chemin
 * se termine par `target` (approximation raisonnable).
 *
 * ex:
 *  - target: "Tenebra1.jpg"
 *  - fichiers: "assets/divinites/Tenebra1.jpg", "old/Tenebra1.jpg"
 *
 * Si plusieurs matchent, on prend le premier trouvé (comportement à documenter).
 */
function findInVault(allFiles: string[], target: string): string | undefined {
  const lowerTarget = target.toLowerCase();

  // 1) Match exact
  for (const file of allFiles) {
    if (file.toLowerCase() === lowerTarget) {
      return file;
    }
  }

  // 2) Match par suffixe (plus permissif)
  for (const file of allFiles) {
    if (file.toLowerCase().endsWith('/' + lowerTarget)) {
      return file;
    }
  }

  return undefined;
}

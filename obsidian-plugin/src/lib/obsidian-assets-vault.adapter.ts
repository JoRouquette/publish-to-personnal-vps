import { AssetRef } from 'core-publishing/src/lib/domain/AssetRef';
import { NoteWithAssets } from 'core-publishing/src/lib/domain/NoteWithAssets';
import { ResolvedAssetFile } from 'core-publishing/src/lib/domain/ResolvedAssetFile';
import { AssetsVaultPort } from 'core-publishing/src/lib/ports/assets-vault-port';
import type { LoggerPort } from 'core-publishing/src/lib/ports/logger-port';
import { App, TFile } from 'obsidian';

export class ObsidianAssetsVaultAdapter implements AssetsVaultPort {
  private readonly logger: LoggerPort;

  constructor(private readonly app: App, logger: LoggerPort) {
    // Use a child logger with context for this adapter
    this.logger = logger.child({ adapter: 'ObsidianAssetsVaultAdapter' });
    this.logger.debug('ObsidianAssetsVaultAdapter initialized');
  }

  async resolveAssetForNote(
    note: NoteWithAssets,
    asset: AssetRef,
    assetsFolder: string,
    enableVaultFallback: boolean
  ): Promise<ResolvedAssetFile | null> {
    const normalizedAssetsFolder = normalizeFolder(assetsFolder);

    this.logger.debug('Resolving asset for note', {
      noteVaultPath: note.vaultPath,
      asset,
      assetsFolder: normalizedAssetsFolder,
      enableVaultFallback,
    });

    // 1. On récupère la "cible" du wikilink d'asset
    const target = this.extractLinkTarget(asset);
    if (!target) {
      this.logger.warn('Unable to extract link target from asset', asset);
      return null;
    }

    const allFiles = this.app.vault.getFiles();
    this.logger.debug('Searching for asset target', {
      target,
      assetsFolder: normalizedAssetsFolder,
      enableVaultFallback,
      note: note.vaultPath,
    });

    // target peut être "Tenebra1.jpg" ou "divinites/Tenebra1.jpg"
    const baseName = target.split('/').pop() ?? target;

    // 2. Recherche prioritaire dans le dossier d'assets
    let file: TFile | undefined = undefined;

    if (normalizedAssetsFolder) {
      file = allFiles.find((f) => {
        if (!isUnderFolder(f.path, normalizedAssetsFolder)) return false;

        // cas 1 : chemin complet se termine par target (ex: "assets/divinites/Tenebra1.jpg")
        if (f.path.endsWith('/' + target) || f.path === target) return true;

        // cas 2 : fallback sur le nom seul
        return f.name === baseName;
      });
      if (file) {
        this.logger.info('Asset found in assets folder', {
          filePath: file.path,
          assetsFolder: normalizedAssetsFolder,
        });
      } else {
        this.logger.debug(
          'Asset not found in assets folder, will try fallback if enabled',
          { target, assetsFolder: normalizedAssetsFolder }
        );
      }
    }

    // 3. Fallback : tout le vault si autorisé
    if (!file && enableVaultFallback) {
      file = allFiles.find((f) => {
        // même logique de matching, mais sans restriction de dossier
        if (f.path.endsWith('/' + target) || f.path === target) return true;
        return f.name === baseName;
      });
      if (file) {
        this.logger.info('Asset found in vault (fallback)', {
          filePath: file.path,
        });
      } else {
        this.logger.debug('Asset not found in vault during fallback', {
          target,
        });
      }
    }

    if (!file) {
      this.logger.warn('Asset not found in vault', {
        target,
        note: note.vaultPath,
      });
      return null;
    }

    const relativeAssetPath = computeRelativeAssetPath(
      file.path,
      normalizedAssetsFolder
    );

    const resolved: ResolvedAssetFile = {
      // chemin réel dans le vault
      vaultPath: file.path,
      // nom de fichier
      fileName: file.name,
      // chemin logique qu’on enverra au backend
      relativeAssetPath,
    } as ResolvedAssetFile;

    this.logger.debug('Resolved asset file', {
      resolved,
    });

    return resolved;
  }

  /**
   * Essaie d’extraire la "link target" depuis AssetRef
   * sans faire d’hypothèse agressive sur sa forme.
   *
   * Priorités :
   *  - asset.fileName / asset.target / asset.linkText si dispo
   *  - sinon parse asset.raw de la forme "![[Tenebra1.jpg|right|300]]"
   */
  private extractLinkTarget(asset: AssetRef): string | null {
    this.logger.debug('Extracting link target from asset', { asset });
    const anyAsset = asset as any;

    if (typeof anyAsset.fileName === 'string' && anyAsset.fileName.trim()) {
      this.logger.debug('Link target found via fileName', {
        fileName: anyAsset.fileName,
      });
      return anyAsset.fileName.trim();
    }

    if (typeof anyAsset.target === 'string' && anyAsset.target.trim()) {
      this.logger.debug('Link target found via target', {
        target: anyAsset.target,
      });
      return anyAsset.target.trim();
    }

    if (typeof anyAsset.linkText === 'string' && anyAsset.linkText.trim()) {
      this.logger.debug('Link target found via linkText', {
        linkText: anyAsset.linkText,
      });
      return anyAsset.linkText.trim();
    }

    if (typeof anyAsset.raw === 'string') {
      const raw: string = anyAsset.raw;
      // On essaie de récupérer l’intérieur du ![[...]]
      const match = raw.match(/!\[\[([^\]]+)\]\]/);
      const inner = (match ? match[1] : raw).trim();

      if (!inner) {
        this.logger.warn('No inner content found in raw asset', { raw });
        return null;
      }

      // inner peut contenir des modificateurs ITS: "Tenebra1.jpg|right|300"
      const firstPart = inner.split('|')[0].trim();
      this.logger.debug('Extracted link target from raw', { firstPart });
      return firstPart || null;
    }

    this.logger.warn('Unable to extract link target from asset', { asset });
    return null;
  }
}

/**
 * Normalise un chemin de dossier Obsidian:
 *  - remplace les "\" par "/"
 *  - retire les "/" en début/fin
 */
function normalizeFolder(folder: string | null | undefined): string {
  if (!folder) return '';
  let f = folder.trim().replace(/\\/g, '/');
  if (f.startsWith('/')) f = f.slice(1);
  if (f.endsWith('/')) f = f.slice(0, -1);
  return f;
}

/**
 * Indique si path est dans (ou égal à) folder.
 */
function isUnderFolder(path: string, folder: string): boolean {
  if (!folder) return false;
  const p = path.replace(/\\/g, '/');
  return p === folder || p.startsWith(folder + '/');
}

/**
 * Chemin logique de l’asset côté backend.
 *
 * - Si le fichier est dans le dossier d’assets : chemin relatif à ce dossier.
 *   ex: file.path = "assets/divinites/Tenebra1.jpg"
 *       assetsFolder = "assets"
 *       => "divinites/Tenebra1.jpg"
 *
 * - Sinon : on renvoie le path complet (ex: "images/Tenebra1.jpg").
 *   Ça respecte le principe "même route que dans le vault".
 */
function computeRelativeAssetPath(
  filePath: string,
  normalizedAssetsFolder: string
): string {
  const p = filePath.replace(/\\/g, '/');
  if (!normalizedAssetsFolder) return p;

  if (p === normalizedAssetsFolder) return '';
  if (p.startsWith(normalizedAssetsFolder + '/')) {
    return p.slice(normalizedAssetsFolder.length + 1);
  }

  return p;
}

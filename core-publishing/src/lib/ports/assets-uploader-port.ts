export interface UploadAssetParams {
  /**
   * Chemin logique de l'asset côté site, relatif à la racine des assets.
   * ex: "divinites/Tenebra1.jpg"
   */
  routePath: string;

  /**
   * Contenu binaire du fichier.
   */
  content: Uint8Array;
}

/**
 * Port pour uploader les assets vers le backend.
 *
 * L'adapter HTTP s'occupera de construire la bonne URL
 * (route d'assets venant des settings VPS) et du protocole (POST, PUT...).
 */
export interface AssetsUploaderPort {
  uploadAsset(params: UploadAssetParams): Promise<void>;
}

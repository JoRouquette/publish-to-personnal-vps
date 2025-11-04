import {
  PublishPluginSettings,
  PublishableNote,
  FolderConfig,
} from '../domain/models.js';
import { VaultPort } from '../ports/vault-port.js';
import { UploaderPort } from '../ports/uploader-port.js';

export class PublishAllUseCase {
  constructor(
    private readonly vaultPort: VaultPort,
    private readonly uploaderPort: UploaderPort
  ) {}

  async execute(settings: PublishPluginSettings): Promise<void> {
    for (const folder of settings.folders) {
      const vps = settings.vpsConfigs.find((v) => v.id === folder.vpsId);
      if (!vps) {
        // un vrai log, pas un console.log planqué dans le domaine → à remonter via un logger port si tu veux aller plus loin
        continue;
      }

      const { notes } = await this.vaultPort.collectNotesForFolder(folder);

      const publishables: PublishableNote[] = [];

      for (const n of notes) {
        if (this.shouldIgnore(n.frontmatter, folder)) {
          continue;
        }

        publishables.push({
          vaultPath: n.vaultPath,
          relativePath: n.relativePath,
          content: n.content,
          frontmatter: n.frontmatter,
          folderConfig: folder,
          vpsConfig: vps,
        });
      }

      for (const note of publishables) {
        await this.uploaderPort.uploadNote(note);
      }
    }
  }

  private shouldIgnore(
    frontmatter: Record<string, any>,
    folder: FolderConfig
  ): boolean {
    for (const rule of folder.ignoreRules) {
      const value = frontmatter?.[rule.property];

      if (rule.ignoreIf && value === rule.ignoreIf) {
        return true;
      }

      if (rule.ignoreValues && rule.ignoreValues.length > 0) {
        if (rule.ignoreValues.some((v) => v === value)) {
          return true;
        }
      }
    }

    return false;
  }
}

import type { App } from 'obsidian';
import type { PublishPluginSettings } from '../../../core-publishing/src/lib/domain/PublishPluginSettings';
import type { SettingsExportPort } from '../../../core-publishing/src/lib/ports/settings-export-port';

/**
 * Export des settings dans un fichier settings.json
 * situé dans le dossier du plugin :
 *   .obsidian/plugins/<pluginId>/settings.json
 *
 * On passe par vault.adapter pour rester compatible
 * et ne pas utiliser fs/promises directement.
 */
export class PluginSettingsFileExportAdapter implements SettingsExportPort {
  constructor(private readonly app: App, private readonly pluginId: string) {}

  async exportSettings(settings: PublishPluginSettings): Promise<void> {
    const adapter: any = this.app.vault.adapter;

    const pluginDir = `.obsidian/plugins/${this.pluginId}`;
    const filePath = `${pluginDir}/settings.json`;

    if (!(await adapter.exists(pluginDir))) {
      await adapter.mkdir(pluginDir);
    }

    const json = JSON.stringify(settings, null, 2);
    await adapter.write(filePath, json);
  }
}

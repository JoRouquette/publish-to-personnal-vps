import type { PublishPluginSettings } from '../domain/PublishPluginSettings';
import type { SettingsExportPort } from '../ports/settings-export-port';

export class ExportSettingsUseCase {
  constructor(private readonly exportPort: SettingsExportPort) {}

  async execute(settings: PublishPluginSettings): Promise<void> {
    // Ici tu peux ajouter des règles métier si un jour il y en a :
    // validation, enrichissement, versioning, etc.
    await this.exportPort.exportSettings(settings);
  }
}

import { ExportSettingsUseCase } from 'core-publishing/src/lib/usecases/export-settings.usecase';
import * as fs from 'fs';
import { Notice, Plugin } from 'obsidian';
import { promisify } from 'util';
import type { PublishPluginSettings } from '../../core-publishing/src/lib/domain/PublishPluginSettings';
import { PublishAllUseCase } from '../../core-publishing/src/lib/usecases/publish-all.usecase';
import type { I18nSettings } from './i18n';
import { getTranslations } from './i18n';
import { decryptApiKey, encryptApiKey } from './lib/api-key-crypto';
import { HttpUploaderAdapter } from './lib/http-uploader.adapter';
import { ObsidianVaultAdapter } from './lib/obsidian-vault.adapter';
import { PluginSettingsFileExportAdapter } from './lib/plugin-settings-file.adapter';
import { PublishToPersonalVpsSettingTab } from './lib/setting-tab';
import { testVpsConnection } from './lib/services/http-connection.service';

const readFile = promisify(fs.readFile);

type PluginLocale = 'en' | 'fr' | 'system';

type PluginSettings = PublishPluginSettings &
  I18nSettings & {
    locale?: PluginLocale;
  };

const DEFAULT_SETTINGS: PluginSettings = {
  vpsConfigs: [],
  folders: [],
  locale: 'system',
};

// Clone profond simple pour des objets de settings "value objects"
function cloneSettings(settings: PluginSettings): PluginSettings {
  return JSON.parse(JSON.stringify(settings));
}

function withEncryptedApiKeys(settings: PluginSettings): PluginSettings {
  const cloned = cloneSettings(settings);

  if (Array.isArray(cloned.vpsConfigs)) {
    cloned.vpsConfigs = cloned.vpsConfigs.map((vps) => ({
      ...vps,
      apiKey: encryptApiKey(vps.apiKey),
    }));
  }

  return cloned;
}

function withDecryptedApiKeys(settings: PluginSettings): PluginSettings {
  const cloned = cloneSettings(settings);

  if (Array.isArray(cloned.vpsConfigs)) {
    cloned.vpsConfigs = cloned.vpsConfigs.map((vps) => ({
      ...vps,
      apiKey: decryptApiKey(vps.apiKey),
    }));
  }

  return cloned;
}

export default class PublishToPersonalVpsPlugin extends Plugin {
  settings!: PluginSettings;

  async onload() {
    await this.loadSettings();

    const { t } = getTranslations(this.app, this.settings);

    this.addSettingTab(new PublishToPersonalVpsSettingTab(this.app, this));

    this.addCommand({
      id: 'publish-to-personal-vps',
      name: t.plugin.commandPublish,
      callback: () => this.publishAll(),
    });

    this.addRibbonIcon('rocket', t.plugin.commandPublish, async () => {
      try {
        await this.publishAll();
      } catch (e) {
        console.error('[PublishToPersonalVps] Publish failed from ribbon', e);
        new Notice(t.plugin.publishError);
      }
    });
  }

  async loadSettings() {
    const internalRaw = (await this.loadData()) ?? {};

    let snapshotRaw: any = null;
    try {
      const adapter: any = this.app.vault.adapter;
      const pluginDir = `.obsidian/plugins/${this.manifest.id}`;
      const filePath = `${pluginDir}/settings.json`;

      if (await adapter.exists(filePath)) {
        const content = await adapter.read(filePath);
        snapshotRaw = JSON.parse(content);
      }
    } catch (e) {
      console.warn(
        '[PublishToPersonalVps] Failed to read settings.json snapshot',
        e
      );
    }

    const merged: PluginSettings = {
      ...DEFAULT_SETTINGS,
      ...(internalRaw as Partial<PluginSettings>),
      ...(snapshotRaw as Partial<PluginSettings>),
    };

    this.settings = withDecryptedApiKeys(merged);
  }

  async saveSettings() {
    const { t } = getTranslations(this.app, this.settings);
    const toPersist = withEncryptedApiKeys(this.settings);

    await this.saveData(toPersist);

    try {
      const exportPort = new PluginSettingsFileExportAdapter(
        this.app,
        this.manifest.id
      );
      const useCase = new ExportSettingsUseCase(exportPort);

      await useCase.execute(toPersist);
    } catch (e) {
      console.error(
        '[PublishToPersonalVps] Failed to export plugin settings',
        e
      );
      new Notice(t.plugin.error.failureToExportSettings);
    }
  }

  async publishAll() {
    const { t } = getTranslations(this.app, this.settings);

    const vaultPort = new ObsidianVaultAdapter(this.app);
    const uploaderPort = new HttpUploaderAdapter(this.settings.vpsConfigs[0]);
    const useCase = new PublishAllUseCase(vaultPort, uploaderPort);

    const result = await useCase.execute(this.settings);

    switch (result.type) {
      case 'success':
        new Notice(t.plugin.publishSuccess);
        break;
      case 'noConfig':
        new Notice(t.plugin.noConfig);
        break;
      case 'missingVpsConfig':
        new Notice(
          t.settings.errors.missingVpsConfig +
            result.foldersWithoutVps.join(', ')
        );
        console.warn('Missing VPS for folders: ', result.foldersWithoutVps);
        break;
      case 'error':
        console.error(result.error);
        new Notice(t.plugin.publishError);
        break;
    }
  }

  async testConnection(): Promise<void> {
    const { t } = getTranslations(this.app, this.settings);
    const settings = this.settings;

    if (!settings?.vpsConfigs || settings.vpsConfigs.length === 0) {
      console.error('No VPS config defined');
      new Notice(t.settings.errors.missingVpsConfig);
      return;
    }

    const vps = settings.vpsConfigs[0];

    const res = await testVpsConnection(vps);

    switch (res) {
      case 'success':
        new Notice(t.settings.testConnection.success);
        break;
      case 'failure':
        new Notice(t.settings.testConnection.failed);
        break;
      case 'unexpected-response':
        new Notice(t.settings.testConnection.unexpectedResponsePrefix + res);
        break;
      case 'invalid-json':
        new Notice(t.settings.testConnection.invalidJson);
        break;
      case 'missing-api-key':
        new Notice(t.settings.testConnection.missingApiKey);
        break;
      case 'invalid-url':
        new Notice(t.settings.testConnection.invalidUrl);
        break;
      default:
        new Notice(t.settings.testConnection.resultPrefix + res);
        break;
    }
  }
}

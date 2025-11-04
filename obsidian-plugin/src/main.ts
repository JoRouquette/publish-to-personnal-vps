// obsidian-plugin/src/main.ts
import { App, Notice, Plugin } from 'obsidian';
import { getTranslations } from './i18n';
import type { I18nSettings } from './i18n';

import { PublishAllUseCase } from '../../core-publishing/src/lib/usecases/publish-all.usecase';
import type { PublishPluginSettings } from '../../core-publishing/src/lib/domain/models';
import { ObsidianVaultAdapter } from './lib/obsidian-vault.adapter';
import { HttpUploaderAdapter } from './lib/http-uploader.adapter';
import { PublishToPersonnalVpsSettingTab } from './lib/setting-tab';

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

export default class PublishToPersonnalVpsPlugin extends Plugin {
  settings!: PluginSettings;

  async onload() {
    await this.loadSettings();

    const { t } = getTranslations(this.app, this.settings);

    this.addSettingTab(new PublishToPersonnalVpsSettingTab(this.app, this));

    this.addCommand({
      id: 'publish-to-personnal-vps',
      name: t.plugin.commandPublish,
      callback: () => this.publishAll(),
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async publishAll() {
    const { t } = getTranslations(this.app, this.settings);

    if (!this.settings.vpsConfigs.length || !this.settings.folders.length) {
      new Notice(t.plugin.noConfig);
      return;
    }

    const vaultPort = new ObsidianVaultAdapter(this.app);
    const uploaderPort = new HttpUploaderAdapter();
    const useCase = new PublishAllUseCase(vaultPort, uploaderPort);

    try {
      await useCase.execute(this.settings);
      new Notice(t.plugin.publishSuccess);
    } catch (e) {
      console.error(e);
      new Notice(t.plugin.publishError);
    }
  }
}

import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import PublishToPersonnalVpsPlugin from '../main';
import { getTranslations } from '../i18n';

import type {
  VpsConfig,
  FolderConfig,
} from '../../../core-publishing/src/lib/domain/models';

export class PublishToPersonnalVpsSettingTab extends PluginSettingTab {
  plugin: PublishToPersonnalVpsPlugin;

  constructor(app: App, plugin: PublishToPersonnalVpsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const { t } = getTranslations(this.app, this.plugin.settings);

    // Racine avec le style principal
    const root = containerEl.createDiv({
      cls: 'publish-to-personnal-vps-settings',
    });

    root.createEl('h2', { text: t.settings.tabTitle });

    // --- Language selection ---
    const langBlock = root.createDiv({ cls: 'ptpv-block' });
    langBlock.createDiv({
      cls: 'ptpv-block-title',
      text: 'Language / Langue',
    });

    new Setting(langBlock)
      .setName('Language')
      .setDesc('Choose plugin language.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('system', 'System / Système')
          .addOption('en', 'English')
          .addOption('fr', 'Français')
          .setValue(this.plugin.settings.locale ?? 'system')
          .onChange(async (value) => {
            this.plugin.settings.locale = value as any;
            await this.plugin.saveSettings();
            this.display(); // reload UI with new language
          });
      });

    // --- VPS config ---
    let vps = this.plugin.settings.vpsConfigs[0];
    if (!vps) {
      vps = {
        id: 'default',
        name: 'VPS',
        url: '',
        apiKey: '',
      } as VpsConfig;
      this.plugin.settings.vpsConfigs = [vps];
    }

    const vpsBlock = root.createDiv({ cls: 'ptpv-block' });
    vpsBlock.createDiv({
      cls: 'ptpv-block-title',
      text: t.settings.sectionVpsTitle,
    });

    new Setting(vpsBlock)
      .setName(t.settings.vpsNameLabel)
      .setDesc(t.settings.vpsNameDesc)
      .addText((text) =>
        text
          .setPlaceholder('VPS')
          .setValue(vps.name)
          .onChange(async (value) => {
            vps.name = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(vpsBlock)
      .setName(t.settings.vpsUrlLabel)
      .setDesc(t.settings.vpsUrlDesc)
      .addText((text) =>
        text
          .setPlaceholder('https://...')
          .setValue(vps.url)
          .onChange(async (value) => {
            vps.url = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(vpsBlock)
      .setName(t.settings.vpsApiKeyLabel)
      .setDesc(t.settings.vpsApiKeyDesc)
      .addText((text) =>
        text
          .setPlaceholder('********')
          .setValue(vps.apiKey)
          .onChange(async (value) => {
            vps.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    vpsBlock.createDiv({
      cls: 'ptpv-help',
      text: t.settings.vpsHelp,
    });

    // --- Folder config ---
    const folderBlock = root.createDiv({ cls: 'ptpv-block' });
    folderBlock.createDiv({
      cls: 'ptpv-block-title',
      text: t.settings.sectionFolderTitle,
    });

    let folderCfg = this.plugin.settings.folders[0];
    if (!folderCfg) {
      folderCfg = {
        id: 'default-folder',
        vaultFolder: '',
        routeBase: '',
        vpsId: vps.id,
        ignoreRules: [
          { property: 'publish', ignoreIfTrue: true },
          { property: 'type', ignoreValues: ['tableau de bord'] },
        ],
      } as FolderConfig;
      this.plugin.settings.folders = [folderCfg];
    }

    new Setting(folderBlock)
      .setName(t.settings.folderVaultLabel)
      .setDesc(t.settings.folderVaultDesc)
      .addText((text) =>
        text
          .setPlaceholder('Blog')
          .setValue(folderCfg.vaultFolder)
          .onChange(async (value) => {
            folderCfg.vaultFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(folderBlock)
      .setName(t.settings.folderRouteLabel)
      .setDesc(t.settings.folderRouteDesc)
      .addText((text) =>
        text
          .setPlaceholder('/blog')
          .setValue(folderCfg.routeBase)
          .onChange(async (value) => {
            folderCfg.routeBase = value.trim();
            await this.plugin.saveSettings();
          })
      );

    folderBlock.createDiv({
      cls: 'ptpv-help',
      text: t.settings.folderRulesHelp,
    });

    // Button row stylé
    const buttonRow = folderBlock.createDiv({ cls: 'ptpv-button-row' });
    const testBtn = buttonRow.createEl('button', {
      text: t.settings.testConnection,
    });
    testBtn.addClass('mod-cta');
    testBtn.onclick = async () => {
      new Notice(t.settings.testConnectionNotImplemented);
    };
  }
}

import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type { VpsConfig } from '../../../core-publishing/src/lib/domain/VpsConfig';
import { getTranslations } from '../i18n';
import PublishToPersonalVpsPlugin from '../main';
import { createDefaultFolderConfig } from './utils/createDefaultFolderConfig';
import { FolderSuggest } from './FolderSuggest';

export class PublishToPersonalVpsSettingTab extends PluginSettingTab {
  plugin: PublishToPersonalVpsPlugin;

  constructor(app: App, plugin: PublishToPersonalVpsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const { t } = getTranslations(this.app, this.plugin.settings);

    const settings = this.plugin.settings;

    // Racine avec le style principal
    const root = containerEl.createDiv({
      cls: 'publish-to-personal-vps-settings',
    });

    root.createEl('h1', { text: t.settings.tabTitle });

    // #region: Langue
    const langBlock = root.createDiv({ cls: 'ptpv-block' });
    const langBlockDiv = langBlock.createDiv({
      cls: 'ptpv-block-title',
    });
    langBlockDiv.createEl('h6', { text: t.settings.language.title });

    new Setting(langBlockDiv)
      .setName(t.settings.language.label)
      .setDesc(t.settings.language.description)
      .addDropdown((dropdown) => {
        dropdown
          .addOption('system', 'System / Système')
          .addOption('en', 'English')
          .addOption('fr', 'Français')
          .setValue(settings.locale ?? 'system')
          .onChange(async (value) => {
            settings.locale = value as any;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // #region: VPS config
    let vps = settings.vpsConfigs?.[0];
    if (!vps) {
      vps = {
        id: 'default',
        name: 'VPS',
        url: '',
        apiKey: '',
      } as VpsConfig;
      settings.vpsConfigs = [vps];
    }

    const vpsBlock = root.createDiv({ cls: 'ptpv-block' });
    const vpsBlockDiv = vpsBlock.createDiv({
      cls: 'ptpv-block-title',
    });
    vpsBlockDiv.createEl('h6', { text: t.settings.vps.title });

    new Setting(vpsBlockDiv)
      .setName(t.settings.vps.nameLabel)
      .setDesc(t.settings.vps.nameDescription)
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
      .setName(t.settings.vps.urlLabel)
      .setDesc(t.settings.vps.urlDescription)
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
      .setName(t.settings.vps.apiKeyLabel)
      .setDesc(t.settings.vps.apiKeyDescription)
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
      text: t.settings.vps.help,
    });

    // #region: Global ignore rules for frontmatter
    const ignoreBlock = root.createDiv({ cls: 'ptpv-block' });
    const ignoreBlockDiv = ignoreBlock.createDiv({
      cls: 'ptpv-block-title',
    });
    ignoreBlockDiv.createEl('h6', { text: t.settings.ignoreRules.title });

    let ignoreRules = settings.ignoreRules ?? [];
    ignoreRules.forEach((rule, index) => {
      const ruleSetting = new Setting(ignoreBlock).setName(
        `${t.settings.ignoreRules.valueLabel ?? 'Ignore rule'} #${index + 1}`
      );

      ruleSetting.addText((text) =>
        text
          .setPlaceholder('frontmatter property')
          .setValue(rule.property ?? '')
          .onChange(async (value) => {
            rule.property = value.trim();
            await this.plugin.saveSettings();
          })
      );

      const mode =
        rule.ignoreValues && rule.ignoreValues.length > 0
          ? 'values'
          : 'boolean';

      ruleSetting.addDropdown((dropdown) =>
        dropdown
          .addOption(
            'boolean',
            t.settings.ignoreRules.modeBoolean ?? 'Ignore if equals'
          )
          .addOption(
            'values',
            t.settings.ignoreRules.modeValues ?? 'Ignore specific values'
          )
          .setValue(mode)
          .onChange(async (value) => {
            if (value === 'boolean') {
              rule.ignoreValues = undefined;
              if (typeof rule.ignoreIf !== 'boolean') {
                rule.ignoreIf = true; // default
              }
            } else {
              rule.ignoreIf = undefined;
              if (!rule.ignoreValues) {
                rule.ignoreValues = ['draft'];
              }
            }
            await this.plugin.saveSettings();
            this.display();
          })
      );

      if (mode === 'boolean') {
        ruleSetting.addDropdown((dropdown) =>
          dropdown
            .addOption('true', 'true')
            .addOption('false', 'false')
            .setValue(rule.ignoreIf === false ? 'false' : 'true')
            .onChange(async (value) => {
              rule.ignoreIf = value === 'true';
              await this.plugin.saveSettings();
            })
        );
      } else {
        ruleSetting.addText((text) =>
          text
            .setPlaceholder('val1, val2, val3')
            .setValue((rule.ignoreValues ?? []).join(', '))
            .onChange(async (value) => {
              rule.ignoreValues = value
                .split(',')
                .map((v) => v.trim())
                .filter((v) => v.length > 0);
              await this.plugin.saveSettings();
            })
        );
      }

      ruleSetting.addExtraButton((btn) =>
        btn
          .setIcon('trash')
          .setTooltip(
            t.settings.ignoreRules.deleteButton ?? 'Delete ignore rule'
          )
          .onClick(async () => {
            settings.ignoreRules?.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          })
      );
    });

    const rowAddIgnoreRule = root.createDiv({
      cls: 'ptpv-button-row',
    });
    const btnAddIgnoreRule = rowAddIgnoreRule.createEl('button', {
      text: t.settings.ignoreRules.addButton ?? 'Add ignore rule',
    });
    btnAddIgnoreRule.addClass('mod-cta');
    btnAddIgnoreRule.onclick = async () => {
      const rules = settings.ignoreRules ?? [];
      rules.push({
        property: 'publish',
        ignoreIf: false,
      });
      settings.ignoreRules = rules;
      await this.plugin.saveSettings();
      this.display();
    };

    // #region: Folder configs
    const folderBlock = root.createDiv({ cls: 'ptpv-block' });
    const folderBlockDiv = folderBlock.createDiv({
      cls: 'ptpv-block-title',
    });
    folderBlockDiv.createEl('h6', { text: t.settings.folders.title });

    if (!Array.isArray(settings.folders)) {
      settings.folders = [];
    }

    // Si aucun dossier, on en crée un par défaut
    if (settings.folders.length === 0) {
      settings.folders.push(createDefaultFolderConfig(vps.id));
    }

    settings.folders.forEach((folderCfg, index) => {
      const singleFolderFieldset = folderBlockDiv.createEl('fieldset', {
        cls: 'ptpv-folder',
      });

      singleFolderFieldset.createEl('legend', {
        text:
          folderCfg.vaultFolder && folderCfg.vaultFolder.length > 0
            ? folderCfg.vaultFolder
            : `${t.settings.folders.vaultLabel} #${index + 1}`,
      });

      const folderSetting = new Setting(singleFolderFieldset).setName(
        t.settings.folders.deleteButton ?? 'Delete folder'
      );

      folderSetting.addButton((btn) => {
        btn.setIcon('trash').onClick(async () => {
          if (this.plugin.settings.folders.length <= 1) {
            new Notice(
              t.settings.folders.deleteLastForbidden ??
                'At least one folder is required.'
            );
            return;
          }
          this.plugin.settings.folders.splice(index, 1);
          await this.plugin.saveSettings();
          this.display();
        });
      });

      const vaultSetting = new Setting(singleFolderFieldset)
        .setName(t.settings.folders.vaultLabel)
        .setDesc(t.settings.folders.vaultDescription);

      vaultSetting.addText((text) => {
        text
          .setPlaceholder('Blog')
          .setValue(folderCfg.vaultFolder)
          .onChange(async (value) => {
            folderCfg.vaultFolder = value.trim();
            await this.plugin.saveSettings();
          });

        new FolderSuggest(this.app, text.inputEl);
      });

      const routeSetting = new Setting(singleFolderFieldset)
        .setName(t.settings.folders.routeLabel)
        .setDesc(t.settings.folders.routeDescription);

      routeSetting.addText((text) =>
        text
          .setPlaceholder('/blog')
          .setValue(folderCfg.routeBase)
          .onChange(async (value) => {
            folderCfg.routeBase = value.trim();
            await this.plugin.saveSettings();
          })
      );

      const sanitizeSetting = new Setting(singleFolderFieldset)
        .setName(t.settings.folders.sanitizeRemoveCodeBlocksLabel)
        .setDesc(t.settings.folders.sanitizeRemoveCodeBlocksDescription);

      sanitizeSetting.addToggle((toggle) =>
        toggle
          .setValue(folderCfg.sanitization?.removeFencedCodeBlocks ?? true)
          .onChange(async (value) => {
            if (!folderCfg.sanitization) {
              folderCfg.sanitization = { removeFencedCodeBlocks: value };
            } else {
              folderCfg.sanitization.removeFencedCodeBlocks = value;
            }
            await this.plugin.saveSettings();
          })
      );
    });

    const rowAddFolder = root.createDiv({
      cls: 'ptpv-button-row',
    });
    const btnAddFolder = rowAddFolder.createEl('button', {
      text: t.settings.folders.addButton ?? 'Add folder',
    });
    btnAddFolder.addClass('mod-cta');
    btnAddFolder.onclick = async () => {
      const vpsId = settings.vpsConfigs?.[0]?.id ?? 'default';
      this.plugin.settings.folders.push(createDefaultFolderConfig(vpsId));
      await this.plugin.saveSettings();
      this.display();
    };

    const rowTestConnection = root.createDiv({
      cls: 'ptpv-button-row',
    });
    const testBtn = rowTestConnection.createEl('button', {
      text: t.settings.testConnection.label ?? 'Test connection',
    });
    testBtn.addClass('mod-cta');
    testBtn.onclick = async () => {
      try {
        await this.plugin.testConnection();
      } catch (e) {
        console.error('[PublishToPersonalVps] Connection test failed', e);
      }
    };
  }
}

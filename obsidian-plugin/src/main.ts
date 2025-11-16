import { Notice, Plugin } from 'obsidian';

import type { PublishPluginSettings } from '../../core-publishing/src/lib/domain/PublishPluginSettings';
import type { I18nSettings } from './i18n';
import { getTranslations } from './i18n';

import { decryptApiKey, encryptApiKey } from './lib/api-key-crypto';
import { GuidGeneratorAdapter } from './lib/guid-generator.adapter';
import { NoticeProgressAdapter } from './lib/notice-progress.adapter';
import { ObsidianVaultAdapter } from './lib/obsidian-vault.adapter';
import {
  TestConnectionResult,
  testVpsConnection,
} from './lib/services/http-connection.service';
import { PublishToPersonalVpsSettingTab } from './lib/setting-tab';

import { PublishToSiteUseCase } from 'core-publishing/src';
import {
  extractNotesWithAssets,
  type NoteWithAssets,
} from 'core-publishing/src/lib/domain/NoteWithAssets';
import type { PublishableNote } from 'core-publishing/src/lib/domain/PublishableNote';
import { PublishAssetsToSiteUseCase } from 'core-publishing/src/lib/usecases/publish-assets-to-site.usecase';
import { ObsidianAssetsVaultAdapter } from './lib/obsidian-assets-vault.adapter';

import { AssetsUploaderAdapter } from './lib/assets-uploader.adapter';
import { NotesUploaderAdapter } from './lib/notes-uploader.adapter';

type PluginLocale = 'en' | 'fr' | 'system';

/**
 * Settings internes du plugin Obsidian.
 *
 * - PublishPluginSettings = configuration "core" (consommée par la lib).
 * - I18nSettings = langue d'interface.
 * - Ajouts plugin-only :
 *   - locale : comportement de langue (system / fr / en)
 *   - assetsFolder : dossier global d'assets dans le vault
 *   - enableAssetsVaultFallback : fallback de recherche des assets dans tout le vault
 *   - assetsRoute : route HTTP (backend) pour la publication / exposition des assets
 */
type PluginSettings = PublishPluginSettings &
  I18nSettings & {
    locale?: PluginLocale;

    // --- Vault global settings ---
    assetsFolder: string;
    enableAssetsVaultFallback: boolean;
    assetsRoute: string;
  };

/**
 * Defaults pour un vault fraîchement configuré.
 */
const DEFAULT_SETTINGS: PluginSettings = {
  // core-publishing
  vpsConfigs: [],
  folders: [],
  ignoreRules: [],

  // i18n
  locale: 'system',

  // vault / assets
  assetsFolder: 'assets',
  assetsRoute: '/assets/',
  enableAssetsVaultFallback: true,
};

// Clone profond simple pour des objets de settings "value objects"
function cloneSettings(settings: PluginSettings): PluginSettings {
  return JSON.parse(JSON.stringify(settings));
}

/**
 * Applique le chiffrement faible sur les API keys
 * avant persistence sur disque.
 */
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

/**
 * Applique le déchiffrement faible sur les API keys
 * après chargement depuis le disque.
 */
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

/**
 * Construit la vue "core" des settings, consommée par la lib.
 * On isole volontairement ce qui est pertinent pour PublishToSiteUseCase.
 */
function buildCoreSettings(settings: PluginSettings): PublishPluginSettings {
  const { vpsConfigs, folders, ignoreRules } = settings;

  return {
    vpsConfigs,
    folders,
    ignoreRules,
  };
}

export default class PublishToPersonalVpsPlugin extends Plugin {
  settings!: PluginSettings;

  // ---------------------------------------------------------------------------
  // Cycle de vie du plugin
  // ---------------------------------------------------------------------------
  async onload() {
    await this.loadSettings();

    const { t } = getTranslations(this.app, this.settings);

    // Settings UI
    this.addSettingTab(new PublishToPersonalVpsSettingTab(this.app, this));

    // Commande principale de publication
    this.addCommand({
      id: 'publish-to-personal-vps',
      name: t.plugin.commandPublish,
      callback: () => this.publishToSite(),
    });

    // Test de connexion au VPS
    this.addCommand({
      id: 'test-vps-connection',
      name: t.plugin.commandTestConnection,
      callback: () => this.testConnection(),
    });

    // Raccourci pour ouvrir les settings du plugin
    this.addCommand({
      id: 'open-vps-settings',
      name: t.plugin.commandOpenSettings,
      callback: () => {
        // @ts-ignore
        this.app.setting.open();
        // @ts-ignore
        this.app.setting.openTabById(`${this.manifest.id}`);
      },
    });

    // Icône de ribbon
    this.addRibbonIcon('rocket', t.plugin.commandPublish, async () => {
      try {
        await this.publishToSite();
      } catch (e) {
        console.error('[PublishToPersonalVps] Publish failed from ribbon', e);
        new Notice(t.plugin.publishError);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Chargement / sauvegarde des settings
  // ---------------------------------------------------------------------------
  async loadSettings() {
    // Settings Obsidian (stockés via saveData)
    const internalRaw = (await this.loadData()) ?? {};

    // Snapshot JSON "settings.json" dans le dossier du plugin
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

      // ordre de merge : defaults < internal < snapshot
      ...(internalRaw as Partial<PluginSettings>),
      ...(snapshotRaw as Partial<PluginSettings>),
    };

    this.settings = withDecryptedApiKeys(merged);
  }

  async saveSettings() {
    const toPersist = withEncryptedApiKeys(this.settings);
    await this.saveData(toPersist);
  }

  // ---------------------------------------------------------------------------
  // Publication : notes + assets
  // ---------------------------------------------------------------------------
  async publishToSite() {
    const settings = this.settings;
    const { t } = getTranslations(this.app, this.settings);

    // 1. Validation basique : au moins un VPS et un dossier
    if (!settings.vpsConfigs || settings.vpsConfigs.length === 0) {
      console.error('[PublishToPersonalVps] No VPS config defined');
      new Notice(t.settings.errors?.missingVpsConfig ?? 'No VPS configured');
      return;
    }

    if (!settings.folders || settings.folders.length === 0) {
      console.warn('[PublishToPersonalVps] No folders configured');
      new Notice('⚠️ No folders configured for publishing.');
      return;
    }

    // 2. Adaptateurs core (notes)
    const vault = new ObsidianVaultAdapter(this.app);
    const guidGenerator = new GuidGeneratorAdapter();

    // Même si aujourd’hui tu n’utilises qu’un seul VPS,
    // PublishToSiteUseCase sait déjà gérer plusieurs vpsConfigs.
    // HttpUploaderAdapter, lui, se base sur vpsConfig à la construction.
    const vps = settings.vpsConfigs[0];
    const notesUploader = new NotesUploaderAdapter(vps);

    const publishNotesUsecase = new PublishToSiteUseCase(
      vault,
      notesUploader,
      guidGenerator
    );

    // 3. Progress pour les notes
    const notesProgress = new NoticeProgressAdapter();

    // 4. Settings "core" pour la partie notes
    const coreSettings = buildCoreSettings(settings);

    const result = await publishNotesUsecase.execute(
      coreSettings,
      notesProgress
    );

    // 5. Gestion des cas d'erreur / config
    if (result.type === 'noConfig') {
      new Notice('⚠️ No folders or VPS configured.');
      return;
    }

    if (result.type === 'missingVpsConfig') {
      console.warn(
        '[PublishToPersonalVps] Missing VPS for folders:',
        result.foldersWithoutVps
      );
      new Notice('⚠️ Some folder(s) have no VPS configured (see console).');
      return;
    }

    if (result.type === 'error') {
      console.error(result.error);
      new Notice('❌ Error during publishing (see console).');
      return;
    }

    // À partir d’ici : succès côté notes
    const publishedNotesCount = result.publishedCount;
    const notes: PublishableNote[] = result.notes ?? [];

    if (publishedNotesCount === 0) {
      new Notice('✅ Nothing to publish (0 note).');
      return;
    }

    // 6. Extraction des notes qui ont effectivement des assets
    const notesWithAssets: NoteWithAssets[] = extractNotesWithAssets(notes);

    if (notesWithAssets.length === 0) {
      // Aucun asset à traiter, on notifie juste le succès des notes
      new Notice(
        `✅ Published ${publishedNotesCount} note(s). No assets to publish.`
      );
      return;
    }

    // 7. Publication des assets
    const assetsVault = new ObsidianAssetsVaultAdapter(this.app);

    // Adapter HTTP pour AssetsUploaderPort : à implémenter
    const assetsUploader = new AssetsUploaderAdapter(vps);

    const publishAssetsUsecase = new PublishAssetsToSiteUseCase(
      assetsVault,
      assetsUploader
    );

    const assetsProgress = new NoticeProgressAdapter();

    const assetsResult = await publishAssetsUsecase.execute({
      notes: notesWithAssets,
      assetsFolder: settings.assetsFolder,
      enableAssetsVaultFallback: settings.enableAssetsVaultFallback,
      progress: assetsProgress,
    });

    // 8. Synthèse finale (notes + assets)
    switch (assetsResult.type) {
      case 'noAssets': {
        // Normalement déjà filtré, mais on garde le cas pour être robuste.
        new Notice(
          `✅ Published ${publishedNotesCount} note(s). No assets to publish.`
        );
        break;
      }
      case 'error': {
        console.error(
          '[PublishToPersonalVps] Error while publishing assets:',
          assetsResult.error
        );
        new Notice(
          `✅ Published ${publishedNotesCount} note(s), but assets publication failed (see console).`
        );
        break;
      }
      case 'success': {
        const { publishedAssetsCount, failures } = assetsResult;

        if (failures.length > 0) {
          console.warn(
            '[PublishToPersonalVps] Some assets failed to publish:',
            failures
          );
          new Notice(
            `✅ Published ${publishedNotesCount} note(s) and ${publishedAssetsCount} asset(s), with ${failures.length} asset failure(s) (see console).`
          );
        } else {
          new Notice(
            `✅ Published ${publishedNotesCount} note(s) and ${publishedAssetsCount} asset(s).`
          );
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Test de connexion VPS
  // ---------------------------------------------------------------------------
  async testConnection(): Promise<void> {
    const { t } = getTranslations(this.app, this.settings);
    const settings = this.settings;

    if (!settings?.vpsConfigs || settings.vpsConfigs.length === 0) {
      console.error('[PublishToPersonalVps] No VPS config defined');
      new Notice(t.settings.errors.missingVpsConfig);
      return;
    }

    const vps = settings.vpsConfigs[0];

    const res: TestConnectionResult = await testVpsConnection(vps);

    if (res.message) {
      console.log(
        '[PublishToPersonalVps] Test connection message:',
        res.message
      );
    }

    switch (res.status) {
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

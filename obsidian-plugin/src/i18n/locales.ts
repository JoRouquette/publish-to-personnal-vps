export type Locale = 'en' | 'fr';

export type Translations = {
  plugin: {
    name: string;
    commandPublish: string;
    publishSuccess: string;
    publishError: string;
    noConfig: string;
  };
  settings: {
    tabTitle: string;
    sectionVpsTitle: string;
    sectionFolderTitle: string;

    vpsNameLabel: string;
    vpsNameDesc: string;

    vpsUrlLabel: string;
    vpsUrlDesc: string;

    vpsApiKeyLabel: string;
    vpsApiKeyDesc: string;

    folderVaultLabel: string;
    folderVaultDesc: string;

    folderRouteLabel: string;
    folderRouteDesc: string;

    folderRulesHelp: string;
    vpsHelp: string;
    testConnection: string;
    testConnectionNotImplemented: string;
  };
};

export const en: Translations = {
  plugin: {
    name: 'Publish To Personal VPS',
    commandPublish: 'Publish to personal VPS',
    publishSuccess: 'Publishing completed.',
    publishError: 'Error during publishing (see console).',
    noConfig: 'No VPS or folder configuration defined.',
  },
  settings: {
    tabTitle: 'Publish To Personal VPS',
    sectionVpsTitle: 'VPS configuration',
    sectionFolderTitle: 'Folder to publish',

    vpsNameLabel: 'Name',
    vpsNameDesc: 'Internal name for this VPS.',

    vpsUrlLabel: 'URL',
    vpsUrlDesc: 'Example: https://notes.mydomain.com',

    vpsApiKeyLabel: 'API key',
    vpsApiKeyDesc: 'Key used to authenticate uploads.',

    folderVaultLabel: 'Vault folder',
    folderVaultDesc: 'Example: Blog, Notes/Docs, etc.',

    folderRouteLabel: 'Site route',
    folderRouteDesc: 'Example: /blog, /docs, etc.',

    folderRulesHelp:
      'By default, files with publish=true or type="tableau de bord" are ignored.',
    vpsHelp: 'HTTP requests to /api/upload will use this URL and API key.',
    testConnection: 'Test connection',
    testConnectionNotImplemented: 'Connection test not implemented yet.',
  },
};

export const fr: Translations = {
  plugin: {
    name: 'Publish To Personnal VPS',
    commandPublish: 'Publier vers mon VPS personnel',
    publishSuccess: 'Publication terminée.',
    publishError: 'Erreur lors de la publication (voir la console).',
    noConfig: 'Aucune configuration VPS ou dossier définie.',
  },
  settings: {
    tabTitle: 'Publish To Personnal VPS',
    sectionVpsTitle: 'Configuration du VPS',
    sectionFolderTitle: 'Dossier à publier',

    vpsNameLabel: 'Nom',
    vpsNameDesc: 'Nom interne pour ce VPS.',

    vpsUrlLabel: 'URL',
    vpsUrlDesc: 'Ex : https://notes.mondomaine.fr',

    vpsApiKeyLabel: 'Clé API',
    vpsApiKeyDesc: 'Clé utilisée pour authentifier les uploads.',

    folderVaultLabel: 'Dossier du vault',
    folderVaultDesc: 'Ex : Blog, Notes/Docs, etc.',

    folderRouteLabel: 'Route du site',
    folderRouteDesc: 'Ex : /blog, /docs, etc.',

    folderRulesHelp:
      'Par défaut, les fichiers avec publish=true ou type="tableau de bord" sont ignorés.',
    vpsHelp:
      'Les requêtes HTTP vers /api/upload utiliseront cette URL et cette clé.',
    testConnection: 'Tester la connexion',
    testConnectionNotImplemented:
      'Test de connexion non implémenté pour l’instant.',
  },
};

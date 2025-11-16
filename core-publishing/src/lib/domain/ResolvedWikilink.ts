export interface ResolvedWikilink {
  raw: string;
  targetId?: string; // id de note publishée (si résolue)
  href?: string; // URL finale à injecter dans le HTML/markdown transformé
  isResolved: boolean;
}

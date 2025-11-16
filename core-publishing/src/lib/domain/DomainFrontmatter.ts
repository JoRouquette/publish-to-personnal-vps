import type { RawFrontmatter } from './RawFrontmatter';

export interface DomainFrontmatter {
  /**
   * Frontmatter tel que renvoyé par le parser YAML
   * (similaire à ce que fournit Obsidian).
   */
  flat: RawFrontmatter;

  /**
   * Représentation imbriquée, avec les clés en dot-notation
   * transformées en objets.
   *
   * ex:
   *  "relation.parents": []
   *  "relation.fratrie": ["[[Géomir]]"]
   *
   * devient:
   *  {
   *    relation: {
   *      parents: [],
   *      fratrie: ["[[Géomir]]"]
   *    }
   *  }
   */
  nested: Record<string, unknown>;
}

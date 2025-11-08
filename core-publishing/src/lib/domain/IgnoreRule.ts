export interface IgnoreRule {
  property: string;
  ignoreIf?: boolean;
  ignoreValues?: (string | number | boolean)[];
}

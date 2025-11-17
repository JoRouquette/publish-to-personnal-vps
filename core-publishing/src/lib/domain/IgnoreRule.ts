import { IgnorePrimitive } from './IgnorePrimitive';

export interface IgnoreRule {
  property: string;
  ignoreIf?: boolean;
  ignoreValues?: IgnorePrimitive[];
}

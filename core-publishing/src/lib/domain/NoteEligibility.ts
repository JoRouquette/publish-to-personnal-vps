export interface NoteEligibility {
  isPublishable: boolean;
  ignoredByRule?: {
    property: string;
    reason: 'ignoreIf' | 'ignoreValues';
    value: unknown;
  };
}

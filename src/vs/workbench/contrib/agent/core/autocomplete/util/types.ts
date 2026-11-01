import { Position, Range, TabAutocompleteOptions } from "../..";

export interface AutocompleteInput {
  isUntitledFile: boolean;
  completionId: string;
  filepath: string;
  pos: Position;
  // Used for notebook files
  manuallyPassFileContents?: string;
  // Used for VS Code git commit input box
  manuallyPassPrefix?: string;
  manuallyPassSuffix?: string;
  selectedCompletionInfo?: {
    text: string;
    range: Range;
  };
  injectDetails?: string;
}

export interface AutocompleteOutcome extends TabAutocompleteOptions {
  accepted?: boolean;
  time: number;
  prefix: string;
  suffix: string;
  prompt: string;
  completion: string;
  modelProvider: string;
  modelName: string;
  completionOptions: any;
  cacheHit: boolean;
  numLines: number;
  filepath: string;
  gitRepo?: string;
  completionId: string;
  uniqueId: string;
  timestamp: string;
  profileType?: "local";
}

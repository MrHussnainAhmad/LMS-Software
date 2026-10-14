export type RestorePreview = {
  generatedAt: string;
  tables: { table: string; current: number; replacement: number }[];
  preservedTables: string[];
  mediaReferences: number;
  warnings: string[];
  fingerprint: string;
};
export type WorkspaceView = "prompts" | "stacks" | "lessons" | "markdown" | "tauri";

export type PromptCategory =
  | "System & Agent"
  | "Architecture"
  | "Refactoring"
  | "Debugging"
  | "UI & Design"
  | "Testing & QA";

export type TargetAgent = "Argon" | "Universal" | "Claude" | "Cursor" | "Windsurf";

export type CopyFormat = "raw" | "xml" | "markdown" | "json";

export interface PromptVariable {
  name: string;
  defaultValue: string;
  description?: string;
}

export interface PromptVersionSnapshot {
  id: string;
  savedAt: string;
  content: string;
  note: string;
}

export interface PromptItem {
  id: string;
  title: string;
  category: PromptCategory;
  targetAgent: TargetAgent;
  tags: string[];
  description: string;
  content: string;
  variables: PromptVariable[];
  versions?: PromptVersionSnapshot[];
  isFavorite: boolean;
  copyCount: number;
  updatedAt: string;
}

export type StackLayer = "Full-Stack" | "Desktop & Tauri" | "Frontend" | "Backend & Systems";

export interface StackDependency {
  name: string;
  version: string;
  role: string;
}

export interface TechStackItem {
  id: string;
  name: string;
  tagline: string;
  layer: StackLayer;
  tags: string[];
  dependencies: StackDependency[];
  architectureRules: string[];
  setupCommands: string;
  agentContextBlock: string;
  isFavorite: boolean;
  copyCount: number;
  updatedAt: string;
}

export type MonacoLanguage =
  | "typescript"
  | "javascript"
  | "rust"
  | "json"
  | "markdown"
  | "css"
  | "html"
  | "sql"
  | "python"
  | "shell";

export interface LessonFile {
  id: string;
  filename: string;
  language: MonacoLanguage;
  content: string;
}

export interface CodeLessonItem {
  id: string;
  title: string;
  topic: string;
  difficulty: "Foundational" | "Intermediate" | "Advanced";
  tags: string[];
  summary: string;
  markdownNotes: string;
  files: LessonFile[];
  activeFileId: string;
  isFavorite: boolean;
  updatedAt: string;
}

export interface MarkdownDocItem {
  id: string;
  filename: string;
  title: string;
  category: "Agent Rules" | "Architecture Note" | "Cheat Sheet" | "Scratchpad";
  content: string;
  isFavorite: boolean;
  updatedAt: string;
}

export type SurfaceContrast = "crisp" | "tinted" | "high-contrast";

export interface ThemePreferences {
  mode: "light" | "dark";
  accentName: string;
  accentHex: string;
  surfaceContrast: SurfaceContrast;
  editorFontSize: number;
  editorMinimap: boolean;
  editorWordWrap: boolean;
  editorLineNumbers: boolean;
  defaultCopyFormat: CopyFormat;
  lessonSplitRatio: "35-65" | "50-50" | "60-40";
}

export interface ClipboardHistoryEntry {
  id: string;
  label: string;
  sourceKind: "prompt" | "stack" | "lesson" | "markdown" | "config";
  payload: string;
  tokens: number;
  copiedAt: string;
}

export interface VaultBackupBundle {
  version: string;
  exportedAt: string;
  prompts: PromptItem[];
  stacks: TechStackItem[];
  lessons: CodeLessonItem[];
  markdownDocs: MarkdownDocItem[];
  preferences: ThemePreferences;
}

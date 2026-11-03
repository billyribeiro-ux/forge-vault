import {
  CodeLessonItem,
  MarkdownDocItem,
  PromptItem,
  TechStackItem,
  ThemePreferences,
} from "../types/vault";

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: "dark",
  accentName: "Google Blue (M3)",
  accentHex: "#4285F4",
  surfaceContrast: "crisp",
  editorFontSize: 13,
  editorMinimap: false,
  editorWordWrap: true,
  editorLineNumbers: true,
  defaultCopyFormat: "raw",
  lessonSplitRatio: "50-50",
};

export const ACCENT_PRESETS = [
  { name: "Google Blue (M3)", hex: "#4285F4" },
  { name: "Iris Indigo (M3)", hex: "#6366f1" },
  { name: "Emerald Mint (M3)", hex: "#10b981" },
  { name: "Solar Amber (M3)", hex: "#f59e0b" },
  { name: "Cyan Tonality (M3)", hex: "#06b6d4" },
  { name: "Coral Rose (M3)", hex: "#f43f5e" },
];

export const SEED_PROMPTS: PromptItem[] = [];

export const SEED_STACKS: TechStackItem[] = [];

export const SEED_LESSONS: CodeLessonItem[] = [];

export const SEED_MARKDOWN_DOCS: MarkdownDocItem[] = [];

/**
 * Single icon seam for the app: IBM Carbon icons (@carbon/icons-react).
 * Components import from here so the icon set can be swapped in one place.
 * Sizing is done by callers via Tailwind `w-*`/`h-*` classes (they override
 * Carbon's default 16px width/height attributes).
 */
import {
  AiGenerate,
  Add,
  ArrowLeft,
  Asleep,
  AsleepFilled,
  Book,
  Branch,
  Checkbox,
  CheckboxCheckedFilled,
  Checkmark,
  Close,
  Code,
  ColorPalette,
  Compare,
  Copy,
  DataBase,
  DataVolume,
  Document,
  DocumentAdd,
  Download,
  Edit,
  History,
  Json,
  Keyboard,
  Laptop,
  Launch,
  Layers,
  Light,
  LightFilled,
  Merge,
  Paste,
  PlayFilledAlt,
  Reset,
  Script,
  Search,
  SettingsAdjust,
  SplitScreen,
  Star as StarOutline,
  StarFilled,
  Tag,
  Terminal,
  TrashCan,
  Upload,
  View,
  WarningAlt,
} from "@carbon/icons-react";
import type { CarbonIconProps } from "@carbon/icons-react";

type FillableProps = CarbonIconProps & { filled?: boolean };

export function Star({ filled = false, ...props }: FillableProps) {
  const Icon = filled ? StarFilled : StarOutline;
  return <Icon {...props} />;
}

export function Sun({ filled = false, ...props }: FillableProps) {
  const Icon = filled ? LightFilled : Light;
  return <Icon {...props} />;
}

export function Moon({ filled = false, ...props }: FillableProps) {
  const Icon = filled ? AsleepFilled : Asleep;
  return <Icon {...props} />;
}

export {
  Add as Plus,
  ArrowLeft as ArrowLineLeft,
  Book as BookOpen,
  Checkbox as Square,
  CheckboxCheckedFilled as CheckSquare,
  Checkmark as Check,
  Close as X,
  Code,
  ColorPalette as Palette,
  Compare as GitDiff,
  Copy,
  DataBase as Database,
  Document as FileText,
  DocumentAdd as FilePlus,
  DataVolume as HardDrive,
  Download as DownloadSimple,
  Edit as PencilSimple,
  History as ClockCounterClockwise,
  Json as BracketsCurly,
  Keyboard as Command,
  Laptop,
  Launch as ArrowSquareOut,
  Layers as Stack,
  Merge as GitMerge,
  Branch as GitBranch,
  Paste as ClipboardText,
  PlayFilledAlt as Play,
  Reset as ArrowCounterClockwise,
  Script as FileCode,
  Search as MagnifyingGlass,
  SettingsAdjust as Sliders,
  SettingsAdjust as SlidersHorizontal,
  SplitScreen as Columns,
  AiGenerate as Sparkle,
  Tag,
  Terminal as TerminalWindow,
  TrashCan as Trash,
  Upload as UploadSimple,
  View as Eye,
  WarningAlt as Warning,
};

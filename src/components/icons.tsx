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
  Folder,
  FolderAdd,
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
  Folder,
  FolderAdd,
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

/* =============================================================================
 * ChatGPT macOS Desktop Identical SVGs (Pixel-perfect parity from 2026-11-07 screenshot)
 * ============================================================================= */

export function SidebarLeftIcon({
  className = "w-4 h-4",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

export function SidebarRightIcon({
  className = "w-4 h-4",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
}

export function HomeRailIcon({ className = "w-5 h-5", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path d="M12 3.1 3 10.3v9.4c0 .7.6 1.3 1.3 1.3h5.4c.4 0 .8-.4.8-.8v-5.7c0-.4.4-.8.8-.8h1.4c.4 0 .8.4.8.8v5.7c0 .4.4.8.8.8h5.4c.7 0 1.3-.6 1.3-1.3v-9.4L12 3.1Z" />
    </svg>
  );
}

export function SpacesRailIcon({ className = "w-5 h-5", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="7" width="13" height="14" rx="2.5" />
      <path d="M7 3.5h11A2.5 2.5 0 0 1 20.5 6v11" />
    </svg>
  );
}

export function ClockRailIcon({ className = "w-5 h-5", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

export function AutomationsRailIcon({
  className = "w-5 h-5",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </svg>
  );
}

export function MoreHorizontalRailIcon({
  className = "w-5 h-5",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

export function GridAppsRailIcon({
  className = "w-5 h-5",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function TargetDotRailIcon({
  className = "w-5 h-5",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.75" fill="currentColor" />
    </svg>
  );
}

export function WaveformVoiceIcon({
  className = "w-4 h-4",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <rect x="4" y="9" width="2.2" height="6" rx="1.1" />
      <rect x="8.5" y="5.5" width="2.2" height="13" rx="1.1" />
      <rect x="13" y="3" width="2.2" height="18" rx="1.1" />
      <rect x="17.5" y="7.5" width="2.2" height="9" rx="1.1" />
    </svg>
  );
}

export function MicIcon({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function ResetArrowIcon({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M3 12a9 9 0 1 0 2.5-6.2L3 8" />
      <polyline points="3 3 3 8 8 8" />
    </svg>
  );
}

export function ChevronDownIcon({
  className = "w-3.5 h-3.5",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function GlobeIcon({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="3.6" y1="9" x2="20.4" y2="9" />
      <line x1="3.6" y1="15" x2="20.4" y2="15" />
      <path d="M11.5 3a14 14 0 0 0 0 18" />
      <path d="M12.5 3a14 14 0 0 1 0 18" />
    </svg>
  );
}

export function DownloadTrayIcon({
  className = "w-4 h-4",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function ComposePenIcon({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function NavArrowLeft({
  className = "w-3.5 h-3.5",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function NavArrowRight({
  className = "w-3.5 h-3.5",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

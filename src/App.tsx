/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  AutomationsRailIcon,
  BookOpen,
  ClipboardText,
  ClockRailIcon,
  Command,
  Database,
  FileText,
  GlobeIcon,
  GridAppsRailIcon,
  HomeRailIcon,
  MagnifyingGlass,
  MicIcon,
  Moon,
  MoreHorizontalRailIcon,
  NavArrowLeft,
  NavArrowRight,
  Palette,
  Plus,
  ResetArrowIcon,
  SidebarLeftIcon,
  SidebarRightIcon,
  SpacesRailIcon,
  Sparkle,
  Stack,
  Star,
  Sun,
  TargetDotRailIcon,
  WaveformVoiceIcon,
  X,
} from "./components/icons";
import { DEFAULT_THEME_PREFERENCES } from "./data/seedVault";
import {
  ClipboardHistoryEntry,
  CodeLessonItem,
  MarkdownDocItem,
  PromptFolder,
  PromptItem,
  TechStackItem,
  ThemePreferences,
  WorkspaceView,
} from "./types/vault";
import {
  PersistenceStatus,
  VaultState,
  estimateTokenCount,
  loadInitialVaultState,
  saveClipboardHistoryToDB,
  saveLessonsToDB,
  saveMarkdownDocsToDB,
  savePromptFoldersToDB,
  savePromptsToDB,
  saveStacksToDB,
  saveThemePreferencesToDB,
  subscribePersistenceStatus,
} from "./services/vaultStorage";
import { ParsedBackup } from "./services/backupBundle";
import { installDesktopLifecycle, isMacDesktopShell } from "./services/desktopShell";
import { newId } from "./services/ids";
import { PromptsView } from "./components/PromptsView";
import { CommandPaletteModal } from "./components/CommandPaletteModal";
import { ThemeCustomizerModal } from "./components/ThemeCustomizerModal";
import { ClipboardHistoryDrawer } from "./components/ClipboardHistoryDrawer";

const StacksView = lazy(() =>
  import("./components/StacksView").then((m) => ({ default: m.StacksView })),
);
const LessonsSplitStudio = lazy(() =>
  import("./components/LessonsSplitStudio").then((m) => ({
    default: m.LessonsSplitStudio,
  })),
);
const MarkdownVaultView = lazy(() =>
  import("./components/MarkdownVaultView").then((m) => ({
    default: m.MarkdownVaultView,
  })),
);
const DataBackupView = lazy(() =>
  import("./components/DataBackupView").then((m) => ({
    default: m.DataBackupView,
  })),
);

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>("prompts");
  const [promptFolders, setPromptFolders] = useState<PromptFolder[]>([]);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  // Prompt to open in the reader when the Prompts view mounts (e.g. chosen in the ⌘K palette).
  const [promptToOpen, setPromptToOpen] = useState<string | null>(null);
  const [stacks, setStacks] = useState<TechStackItem[]>([]);
  const [lessons, setLessons] = useState<CodeLessonItem[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string>("");
  const [markdownDocs, setMarkdownDocs] = useState<MarkdownDocItem[]>([]);
  const [preferences, setPreferences] = useState<ThemePreferences>(DEFAULT_THEME_PREFERENCES);
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardHistoryEntry[]>([]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isClipboardDrawerOpen, setIsClipboardDrawerOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [canvasMode, setCanvasMode] = useState<"chat" | "work">("chat");
  const [composerText, setComposerText] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("High");
  const [isCompanionOpen, setIsCompanionOpen] = useState(false);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [toast, setToast] = useState<{ id: number; message: string; undo?: () => void } | null>(
    null,
  );

  const [hydration, setHydration] = useState<
    { state: "loading" } | { state: "ready" } | { state: "error"; message: string }
  >({ state: "loading" });
  const [saveStatus, setSaveStatus] = useState<PersistenceStatus>({ state: "idle" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  // The exact arrays read from storage. Persistence effects skip them so a load is not echoed
  // back as a write.
  const loadedRef = useRef<VaultState | null>(null);

  // Hydrate from IndexedDB. Nothing is written until this succeeds, so a failed read can never
  // overwrite the stored vault with an empty one.
  useEffect(() => {
    let mounted = true;
    setHydration({ state: "loading" });
    loadInitialVaultState()
      .then((initial) => {
        if (!mounted) return;
        loadedRef.current = initial;
        setPromptFolders(initial.promptFolders);
        setPrompts(initial.prompts);
        setStacks(initial.stacks);
        setLessons(initial.lessons);
        setActiveLessonId(initial.lessons[0]?.id ?? "");
        setMarkdownDocs(initial.markdownDocs);
        setPreferences(initial.preferences);
        setClipboardHistory(initial.clipboardHistory);
        setHydration({ state: "ready" });
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        console.error("[ForgeVault] failed to load vault", err);
        setHydration({
          state: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      mounted = false;
    };
  }, [loadAttempt]);

  const isReady = hydration.state === "ready";

  // Single persistence path: each collection is written whenever its state changes after load.
  useEffect(() => {
    if (isReady && promptFolders !== loadedRef.current?.promptFolders) {
      savePromptFoldersToDB(promptFolders);
    }
  }, [isReady, promptFolders]);
  useEffect(() => {
    if (isReady && prompts !== loadedRef.current?.prompts) savePromptsToDB(prompts);
  }, [isReady, prompts]);
  useEffect(() => {
    if (isReady && stacks !== loadedRef.current?.stacks) saveStacksToDB(stacks);
  }, [isReady, stacks]);
  useEffect(() => {
    if (isReady && lessons !== loadedRef.current?.lessons) saveLessonsToDB(lessons);
  }, [isReady, lessons]);
  useEffect(() => {
    if (isReady && markdownDocs !== loadedRef.current?.markdownDocs) {
      saveMarkdownDocsToDB(markdownDocs);
    }
  }, [isReady, markdownDocs]);
  useEffect(() => {
    if (isReady && preferences !== loadedRef.current?.preferences) {
      saveThemePreferencesToDB(preferences);
    }
  }, [isReady, preferences]);
  useEffect(() => {
    if (isReady && clipboardHistory !== loadedRef.current?.clipboardHistory) {
      saveClipboardHistoryToDB(clipboardHistory);
    }
  }, [isReady, clipboardHistory]);

  useEffect(() => subscribePersistenceStatus(setSaveStatus), []);

  // Flush debounced writes when the window is hidden, closed, or the app quits.
  useEffect(() => installDesktopLifecycle(), []);

  // Sync Light/Dark mode, surface contrast, and custom accent CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.setAttribute("data-contrast", preferences.surfaceContrast || "crisp");
    root.style.setProperty("--accent-color", preferences.accentHex);
    root.style.setProperty("--editor-font-size", `${preferences.editorFontSize}px`);
  }, [preferences]);

  // Global Cmd+K / Ctrl+K keyboard listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const showNotification = (message: string, undo?: () => void) => {
    setToast({ id: Date.now(), message, undo });
  };

  const handleRecordClipboard = (
    label: string,
    payload: string,
    sourceKind: ClipboardHistoryEntry["sourceKind"],
  ) => {
    const newEntry: ClipboardHistoryEntry = {
      id: newId("clip"),
      label,
      sourceKind,
      payload,
      tokens: estimateTokenCount(payload),
      copiedAt: new Date().toISOString(),
    };
    setClipboardHistory((prev) => [newEntry, ...prev.slice(0, 19)]);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undo ? 6000 : 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const isMacShell = isMacDesktopShell();

  // Prompt handlers
  const handleSavePrompt = (prompt: PromptItem) => {
    setPrompts((prev) => {
      const exists = prev.some((p) => p.id === prompt.id);
      const next = exists ? prev.map((p) => (p.id === prompt.id ? prompt : p)) : [prompt, ...prev];
      return next;
    });
  };

  const handleDeletePrompt = (id: string) => {
    const index = prompts.findIndex((p) => p.id === id);
    if (index === -1) return;
    const removed = prompts[index];
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    showNotification(`Deleted prompt "${removed.title}"`, () => {
      setPrompts((prev) => {
        if (prev.some((p) => p.id === removed.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
    });
  };

  // Folder handlers
  const sortFolders = (list: PromptFolder[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const handleCreateFolder = (name: string): PromptFolder => {
    const folder: PromptFolder = { id: newId("folder"), name, createdAt: new Date().toISOString() };
    setPromptFolders((prev) => sortFolders([...prev, folder]));
    return folder;
  };

  const handleRenameFolder = (id: string, name: string) => {
    setPromptFolders((prev) => sortFolders(prev.map((f) => (f.id === id ? { ...f, name } : f))));
  };

  /** Deletes the folder only. Its prompts move to Unfiled; Undo restores both. */
  const handleDeleteFolder = (id: string) => {
    const folder = promptFolders.find((f) => f.id === id);
    if (!folder) return;
    const movedIds = new Set(prompts.filter((p) => p.folderId === id).map((p) => p.id));
    setPromptFolders((prev) => prev.filter((f) => f.id !== id));
    setPrompts((prev) => prev.map((p) => (p.folderId === id ? { ...p, folderId: null } : p)));
    const movedNote = movedIds.size
      ? ` · ${movedIds.size} prompt${movedIds.size === 1 ? "" : "s"} moved to Unfiled`
      : "";
    showNotification(`Deleted folder "${folder.name}"${movedNote}`, () => {
      setPromptFolders((prev) =>
        prev.some((f) => f.id === folder.id) ? prev : sortFolders([...prev, folder]),
      );
      setPrompts((prev) =>
        prev.map((p) => (movedIds.has(p.id) && !p.folderId ? { ...p, folderId: folder.id } : p)),
      );
    });
  };

  const handleMovePrompt = (promptId: string, folderId: string | null) => {
    setPrompts((prev) =>
      prev.map((p) =>
        p.id === promptId ? { ...p, folderId, updatedAt: new Date().toISOString() } : p,
      ),
    );
  };

  const handleToggleFavoritePrompt = (id: string) => {
    setPrompts((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
      return next;
    });
  };

  const handleIncrementPromptCopy = (id: string) => {
    setPrompts((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, copyCount: p.copyCount + 1 } : p));
      return next;
    });
  };

  // Stack handlers
  const handleSaveStack = (stack: TechStackItem) => {
    setStacks((prev) => {
      const exists = prev.some((s) => s.id === stack.id);
      const next = exists ? prev.map((s) => (s.id === stack.id ? stack : s)) : [stack, ...prev];
      return next;
    });
  };

  const handleDeleteStack = (id: string) => {
    setStacks((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next;
    });
  };

  const handleToggleFavoriteStack = (id: string) => {
    setStacks((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s));
      return next;
    });
  };

  const handleIncrementStackCopy = (id: string) => {
    setStacks((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, copyCount: s.copyCount + 1 } : s));
      return next;
    });
  };

  // Lesson handlers
  const handleSaveLesson = (lesson: CodeLessonItem) => {
    setLessons((prev) => {
      const exists = prev.some((l) => l.id === lesson.id);
      const next = exists ? prev.map((l) => (l.id === lesson.id ? lesson : l)) : [lesson, ...prev];
      return next;
    });
    if (!activeLessonId) {
      setActiveLessonId(lesson.id);
    }
  };

  const handleDeleteLesson = (id: string) => {
    const remaining = lessons.filter((l) => l.id !== id);
    setLessons(remaining);
    if (activeLessonId === id) {
      setActiveLessonId(remaining[0]?.id ?? "");
    }
  };

  // Markdown doc handlers
  const handleSaveMarkdownDoc = (doc: MarkdownDocItem) => {
    setMarkdownDocs((prev) => {
      const exists = prev.some((d) => d.id === doc.id);
      const next = exists ? prev.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...prev];
      return next;
    });
  };

  const handleDeleteMarkdownDoc = (id: string) => {
    setMarkdownDocs((prev) => {
      const next = prev.filter((d) => d.id !== id);
      return next;
    });
  };

  // Theme & Preference handler
  const handleUpdatePreferences = (partial: Partial<ThemePreferences>) => {
    setPreferences((prev) => ({ ...prev, ...partial }));
  };

  // Restore replaces only the collections present in the validated backup.
  const handleImportBundle = (backup: ParsedBackup) => {
    if (backup.promptFolders) setPromptFolders(backup.promptFolders);
    const validFolderIds = new Set((backup.promptFolders ?? promptFolders).map((f) => f.id));
    const reconcile = (list: PromptItem[]) =>
      list.map((p) =>
        p.folderId && !validFolderIds.has(p.folderId) ? { ...p, folderId: null } : p,
      );
    if (backup.prompts) setPrompts(reconcile(backup.prompts));
    else if (backup.promptFolders) setPrompts((prev) => reconcile(prev));
    if (backup.stacks) setStacks(backup.stacks);
    if (backup.lessons) {
      setLessons(backup.lessons);
      setActiveLessonId(backup.lessons[0]?.id ?? "");
    }
    if (backup.markdownDocs) setMarkdownDocs(backup.markdownDocs);
    if (backup.preferences) setPreferences(backup.preferences);
  };

  const handleClearVault = () => {
    setPromptFolders([]);
    setPrompts([]);
    setStacks([]);
    setLessons([]);
    setActiveLessonId("");
    setMarkdownDocs([]);
    setClipboardHistory([]);
    showNotification("Cleared all vault collections");
  };

  const handlePaletteNavigate = (view: WorkspaceView, itemId?: string) => {
    setCanvasMode("work");
    setActiveView(view);
    if (view === "prompts" && itemId) {
      setPromptToOpen(itemId);
    }
    if (view === "lessons" && itemId) {
      setActiveLessonId(itemId);
    }
  };

  const starredPrompts = prompts.filter((p) => p.isFavorite);
  const starredStacks = stacks.filter((s) => s.isFavorite);
  const starredLessons = lessons.filter((l) => l.isFavorite);

  const navDestinations: Array<{
    id: WorkspaceView;
    label: string;
    shortLabel: string;
    count?: number | string;
    icon: React.ElementType;
  }> = [
    {
      id: "prompts",
      label: "Prompt Library",
      shortLabel: "Prompts",
      count: prompts.length,
      icon: Sparkle,
    },
    {
      id: "stacks",
      label: "Tech Stack Vault",
      shortLabel: "Tech Stacks",
      count: stacks.length,
      icon: Stack,
    },
    {
      id: "lessons",
      label: "Code Lessons (Monaco)",
      shortLabel: "Code Lessons",
      count: lessons.length,
      icon: BookOpen,
    },
    {
      id: "markdown",
      label: "Markdown (.md) Docs",
      shortLabel: "Markdown Vault",
      count: markdownDocs.length,
      icon: FileText,
    },
    {
      id: "data",
      label: "Backup & Data",
      shortLabel: "Backup",
      icon: Database,
    },
  ];

  return (
    <div className="h-screen w-screen bg-slate-100 dark:bg-[#171717] text-slate-900 dark:text-[#ECECEC] flex flex-col overflow-hidden font-sans select-none transition-colors">
      {/* macOS Window Titlebar: 40px on #171717 */}
      <header
        data-tauri-drag-region
        className="h-10 bg-slate-100 dark:bg-[#171717] px-3 flex items-center justify-between shrink-0 select-none z-30"
      >
        {/* Left: Navigation Controls (<, >, [|]) */}
        <div className={`flex items-center gap-1.5 ${isMacShell ? "pl-[76px]" : "pl-1"}`}>
          {!isMacShell && (
            <div className="flex items-center gap-2 pl-1 pr-1.5" data-tauri-drag-region>
              <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] inline-block shadow-2xs" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] inline-block shadow-2xs" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] inline-block shadow-2xs" />
            </div>
          )}

          {/* Back < */}
          <button
            type="button"
            onClick={() => {
              if (canvasMode === "work") setCanvasMode("chat");
            }}
            title="Back to Chat Home"
            className="p-1 text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] rounded hover:bg-slate-200 dark:hover:bg-[#222222] transition-colors cursor-pointer"
          >
            <NavArrowLeft className="w-4 h-4" />
          </button>

          {/* Forward > */}
          <button
            type="button"
            onClick={() => {
              setCanvasMode("work");
            }}
            title="Forward to Workspace"
            className="p-1 text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] rounded hover:bg-slate-200 dark:hover:bg-[#222222] transition-colors cursor-pointer"
          >
            <NavArrowRight className="w-4 h-4" />
          </button>

          {/* Sidebar Left Toggle [▤] positioned above canvas left edge */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            title="Toggle Navigation Sidebar"
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isDrawerOpen
                ? "text-slate-900 dark:text-[#ECECEC] bg-slate-200 dark:bg-[#222222]"
                : "text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222]"
            }`}
          >
            <SidebarLeftIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Draggable titlebar region */}
        <div className="flex-1 h-full" data-tauri-drag-region />

        {/* Right: Actions (Theme, Customizer, Clipboard, Search ⌘K, Split Companion) */}
        <div className="flex items-center gap-2">
          <SaveStatusIndicator status={saveStatus} />

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={() =>
              handleUpdatePreferences({
                mode: preferences.mode === "dark" ? "light" : "dark",
              })
            }
            title={preferences.mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="p-1.5 rounded-md text-slate-600 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222] transition-colors cursor-pointer"
          >
            {preferences.mode === "dark" ? (
              <Sun filled className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon filled className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Clipboard Inspector */}
          <button
            type="button"
            onClick={() => setIsClipboardDrawerOpen(true)}
            title="Clipboard History"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200/70 dark:bg-[#2A2A2A] text-slate-700 dark:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <ClipboardText className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-mono text-[10px] tabular-nums">{clipboardHistory.length}</span>
          </button>

          {/* Search ⌘K */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Command Palette (⌘K)"
            className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200/70 dark:bg-[#2A2A2A] text-slate-700 dark:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <Command className="w-3 h-3" />
            <span>⌘K</span>
          </button>

          {/* Split Companion Toggle [⊞] */}
          <button
            type="button"
            onClick={() => setIsCompanionOpen((prev) => !prev)}
            title="Toggle Companion Studio"
            className={`p-1.5 rounded-md transition-colors cursor-pointer relative ${
              isCompanionOpen
                ? "text-slate-900 dark:text-[#ECECEC] bg-slate-200 dark:bg-[#222222]"
                : "text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222]"
            }`}
          >
            <SidebarRightIcon className="w-4 h-4" />
            {isCompanionOpen && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#589BF7]" />
            )}
          </button>
        </div>
      </header>

      {/* Multi-Pane Workspace: Left Rail (52px) + Drawer (260px) + Inset Canvas + Companion (360px) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Left 52px Icon Rail */}
        <aside className="w-[52px] shrink-0 bg-slate-100 dark:bg-[#171717] flex flex-col items-center justify-between py-2.5 z-20 select-none">
          {/* Top icon stack */}
          <div className="flex flex-col items-center gap-2 w-full">
            {/* Home / Chat Studio */}
            <button
              type="button"
              onClick={() => {
                setCanvasMode("chat");
                setPromptToOpen(null);
              }}
              title="Home (Chat Studio)"
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center relative cursor-pointer transition-all ${
                canvasMode === "chat"
                  ? "bg-white dark:bg-[#2F2F2F] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222]"
              }`}
            >
              <HomeRailIcon className="w-5 h-5" />
              {canvasMode === "chat" && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#589BF7] ring-2 ring-slate-100 dark:ring-[#171717]" />
              )}
            </button>

            {/* Tech Stacks */}
            <button
              type="button"
              onClick={() => {
                setCanvasMode("work");
                setActiveView("stacks");
              }}
              title="Tech Stack Vault"
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center relative cursor-pointer transition-all ${
                canvasMode === "work" && activeView === "stacks"
                  ? "bg-white dark:bg-[#2F2F2F] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222]"
              }`}
            >
              <SpacesRailIcon className="w-5 h-5" />
              {canvasMode === "work" && activeView === "stacks" && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#589BF7] ring-2 ring-slate-100 dark:ring-[#171717]" />
              )}
            </button>

            {/* Code Lessons */}
            <button
              type="button"
              onClick={() => {
                setCanvasMode("work");
                setActiveView("lessons");
              }}
              title="Code Lessons (Monaco)"
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center relative cursor-pointer transition-all ${
                canvasMode === "work" && activeView === "lessons"
                  ? "bg-white dark:bg-[#2F2F2F] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222]"
              }`}
            >
              <ClockRailIcon className="w-5 h-5" />
              {canvasMode === "work" && activeView === "lessons" && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#589BF7] ring-2 ring-slate-100 dark:ring-[#171717]" />
              )}
            </button>

            {/* Markdown Docs */}
            <button
              type="button"
              onClick={() => {
                setCanvasMode("work");
                setActiveView("markdown");
              }}
              title="Markdown Vault"
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center relative cursor-pointer transition-all ${
                canvasMode === "work" && activeView === "markdown"
                  ? "bg-white dark:bg-[#2F2F2F] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222]"
              }`}
            >
              <AutomationsRailIcon className="w-5 h-5" />
              {canvasMode === "work" && activeView === "markdown" && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#589BF7] ring-2 ring-slate-100 dark:ring-[#171717]" />
              )}
            </button>

            {/* Backup & Data */}
            <button
              type="button"
              onClick={() => {
                setCanvasMode("work");
                setActiveView("data");
              }}
              title="Backup & Data"
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center relative cursor-pointer transition-all ${
                canvasMode === "work" && activeView === "data"
                  ? "bg-white dark:bg-[#2F2F2F] text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222]"
              }`}
            >
              <MoreHorizontalRailIcon className="w-5 h-5" />
              {canvasMode === "work" && activeView === "data" && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#589BF7] ring-2 ring-slate-100 dark:ring-[#171717]" />
              )}
            </button>

            {/* Clipboard History Drawer */}
            <button
              type="button"
              onClick={() => setIsClipboardDrawerOpen(true)}
              title="Clipboard History"
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222] cursor-pointer transition-all relative"
            >
              <GridAppsRailIcon className="w-5 h-5" />
              {clipboardHistory.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-100 dark:ring-[#171717]" />
              )}
            </button>
          </div>

          {/* Bottom icon stack */}
          <div className="flex flex-col items-center gap-2.5 w-full">
            {/* Target / Dot (⌘K Command Palette) */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Command Palette (⌘K)"
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#222222] cursor-pointer transition-all"
            >
              <TargetDotRailIcon className="w-5 h-5" />
            </button>

            {/* Theme & Preferences Avatar ("FV", #6B705C) */}
            <button
              type="button"
              onClick={() => setIsThemeModalOpen(true)}
              title="Theme Customizer & Preferences"
              className="w-7 h-7 rounded-full bg-[#6B705C] text-white text-[11px] font-semibold flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-white/20 transition-all shadow-xs"
            >
              FV
            </button>
          </div>
        </aside>

        {/* Column 2: 260px Collapsible Secondary Navigation Drawer */}
        <aside
          className={`shrink-0 bg-slate-50/80 dark:bg-[#171717] flex flex-col overflow-hidden select-none transition-[width] duration-200 ease-out ${
            isDrawerOpen ? "w-[260px]" : "w-0 pointer-events-none"
          }`}
        >
          <div className="w-[260px] h-full flex flex-col shrink-0">
            {/* Drawer Header */}
            <div className="h-12 flex items-center justify-between px-3.5 border-b border-slate-200/80 dark:border-white/4">
              <span className="text-xs font-semibold text-slate-800 dark:text-[#ECECEC] flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px]"
                  style={{ backgroundColor: preferences.accentHex }}
                >
                  <Sparkle className="w-3 h-3" />
                </span>
                <span>Workspace Vault</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsCommandPaletteOpen(true)}
                  title="Search Vault (⌘K)"
                  className="p-1.5 text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] rounded hover:bg-slate-200 dark:hover:bg-[#222222] transition-colors cursor-pointer"
                >
                  <MagnifyingGlass className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-4 text-xs">
              {/* Core Workspace Collections */}
              <div>
                <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#8E8E8E]">
                  Workspace Collections
                </div>
                <div className="space-y-0.5">
                  {navDestinations.map((dest) => {
                    const IconComponent = dest.icon;
                    const isActive = activeView === dest.id;
                    return (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => {
                          setActiveView(dest.id);
                          setPromptToOpen(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                          isActive
                            ? "bg-slate-200 dark:bg-[#2A2A2A] text-slate-900 dark:text-[#ECECEC] font-medium"
                            : "text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200/50 dark:hover:bg-[#222222]"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <IconComponent className="w-4 h-4 shrink-0" />
                          <span className="truncate">{dest.label}</span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {dest.count !== undefined && (
                            <span className="font-mono text-[11px] tabular-nums opacity-70">
                              {dest.count}
                            </span>
                          )}
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#589BF7] shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt Folders / Projects */}
              <div>
                <div className="flex items-center justify-between px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#8E8E8E]">
                  <button
                    type="button"
                    onClick={() => setFoldersExpanded((prev) => !prev)}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-[#ECECEC] cursor-pointer"
                  >
                    <span>Prompt Folders</span>
                    <span className="text-[10px]">{foldersExpanded ? "▾" : "▸"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt("New folder name:");
                      if (name && name.trim()) handleCreateFolder(name.trim());
                    }}
                    title="New Folder"
                    className="hover:text-slate-700 dark:hover:text-[#ECECEC] p-0.5 rounded cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {foldersExpanded && (
                  <div className="space-y-0.5 pl-1">
                    {promptFolders.length === 0 ? (
                      <div className="px-3 py-1 text-[11px] text-slate-400 dark:text-[#737373]">
                        No folders yet
                      </div>
                    ) : (
                      promptFolders.map((f) => {
                        const count = prompts.filter((p) => p.folderId === f.id).length;
                        return (
                          <div
                            key={f.id}
                            onClick={() => {
                              setActiveView("prompts");
                            }}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200/50 dark:hover:bg-[#222222] cursor-pointer"
                          >
                            <span className="truncate">{f.name}</span>
                            <span className="font-mono text-[10px] opacity-70 tabular-nums">
                              {count}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Starred Shortcuts */}
              {(starredPrompts.length > 0 ||
                starredStacks.length > 0 ||
                starredLessons.length > 0) && (
                <div>
                  <div className="flex items-center gap-1 px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#8E8E8E]">
                    <Star filled className="w-3 h-3 text-amber-400" />
                    <span>Starred Shortcuts</span>
                  </div>
                  <div className="space-y-0.5">
                    {starredPrompts.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPromptToOpen(p.id);
                          setActiveView("prompts");
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200/50 dark:hover:bg-[#222222] truncate cursor-pointer"
                      >
                        {p.title}
                      </button>
                    ))}
                    {starredStacks.slice(0, 2).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveView("stacks")}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200/50 dark:hover:bg-[#222222] truncate cursor-pointer"
                      >
                        {s.name}
                      </button>
                    ))}
                    {starredLessons.slice(0, 2).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setActiveLessonId(l.id);
                          setActiveView("lessons");
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200/50 dark:hover:bg-[#222222] truncate cursor-pointer"
                      >
                        {l.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recents */}
              {prompts.length > 0 && (
                <div>
                  <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#8E8E8E]">
                    Recent Prompts
                  </div>
                  <div className="space-y-0.5">
                    {prompts.slice(0, 10).map((prompt) => {
                      const isSelected = activeView === "prompts" && promptToOpen === prompt.id;
                      return (
                        <button
                          key={prompt.id}
                          type="button"
                          onClick={() => {
                            setPromptToOpen(prompt.id);
                            setActiveView("prompts");
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group text-left ${
                            isSelected
                              ? "bg-slate-200 dark:bg-[#2A2A2A] text-slate-900 dark:text-[#ECECEC] font-medium"
                              : "text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200/50 dark:hover:bg-[#222222]"
                          }`}
                        >
                          <span className="truncate pr-2">{prompt.title}</span>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#589BF7] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Appearance Bar */}
            <div className="p-3 border-t border-slate-200 dark:border-white/4 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdatePreferences({
                      mode: preferences.mode === "dark" ? "light" : "dark",
                    })
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200/70 dark:bg-[#222222] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] text-slate-800 dark:text-[#ECECEC] transition-colors cursor-pointer"
                >
                  {preferences.mode === "dark" ? (
                    <>
                      <Sun filled className="w-3.5 h-3.5 text-amber-400" />
                      <span>Light</span>
                    </>
                  ) : (
                    <>
                      <Moon filled className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Dark</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsThemeModalOpen(true)}
                  className="flex items-center justify-center p-2 rounded-lg text-xs font-medium bg-slate-200/70 dark:bg-[#222222] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] text-slate-800 dark:text-[#ECECEC] transition-colors cursor-pointer"
                  title="Theme Customizer"
                >
                  <Palette className="w-3.5 h-3.5" style={{ color: preferences.accentHex }} />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Column 3: Floating Inset Canvas (#212121 in dark, #FFFFFF in light, radius: 12px) */}
        <main className="flex-1 min-w-0 mr-2 mb-2 bg-white dark:bg-[#212121] rounded-[12px] border border-slate-200/80 dark:border-[rgba(48,50,58,0.75)] backdrop-blur-xl overflow-hidden flex flex-col relative shadow-sm dark:shadow-[0_0_0_1px_rgba(48,50,58,0.35),0_8px_32px_rgba(0,0,0,0.36)]">
          {/* Hydration / Error alerts */}
          {hydration.state === "loading" && (
            <div
              role="status"
              className="flex-1 flex items-center justify-center text-xs text-slate-500 dark:text-[#8E8E8E]"
            >
              Opening your vault…
            </div>
          )}

          {hydration.state === "error" && (
            <div
              role="alert"
              className="p-8 m-auto bg-slate-50 dark:bg-[#1A1A1A] rounded-xl border border-rose-500/50 space-y-3 max-w-xl text-center"
            >
              <h1 className="text-base font-semibold text-slate-900 dark:text-[#ECECEC]">
                Your vault could not be opened
              </h1>
              <p className="text-xs text-slate-600 dark:text-[#9B9B9B]">{hydration.message}</p>
              <button
                type="button"
                onClick={() => setLoadAttempt((n) => n + 1)}
                className="px-4 py-1.5 text-xs font-semibold rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#171717] cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {/* Top Bar inside Inset Canvas: [ Chat | Work ] Segmented Pill & Reset Action */}
          <div className="h-14 px-4 pt-3 flex items-center justify-between shrink-0 relative z-10">
            <div className="w-10" />

            {/* Centered Segmented Capsule [ Chat | Work ] */}
            <div className="w-[248px] h-9 p-0.5 rounded-full bg-slate-200/80 dark:bg-[#2A2A2A] flex items-center shadow-inner">
              <button
                type="button"
                onClick={() => setCanvasMode("chat")}
                className={`flex-1 h-8 rounded-full text-xs font-medium transition-all flex items-center justify-center cursor-pointer ${
                  canvasMode === "chat"
                    ? "bg-white dark:bg-[#3A3A3A] text-slate-900 dark:text-[#ECECEC] border border-black/5 dark:border-white/8 shadow-xs"
                    : "text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC]"
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setCanvasMode("work")}
                className={`flex-1 h-8 rounded-full text-xs font-medium transition-all flex items-center justify-center cursor-pointer ${
                  canvasMode === "work"
                    ? "bg-white dark:bg-[#3A3A3A] text-slate-900 dark:text-[#ECECEC] border border-black/5 dark:border-white/8 shadow-xs"
                    : "text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC]"
                }`}
              >
                Work
              </button>
            </div>

            {/* Top Right Action: Reset / New Chat Icon */}
            <button
              type="button"
              onClick={() => {
                setComposerText("");
                setCanvasMode("chat");
              }}
              title="New chat / Reset"
              className="p-1.5 rounded-full text-slate-500 dark:text-[#8E8E8E] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer"
            >
              <ResetArrowIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas Mode 1: Chat (Matching the Screenshot 1:1) */}
          {canvasMode === "chat" && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 relative max-w-3xl mx-auto w-full">
              {/* Hero Heading: "Ready when you are." */}
              <h1 className="text-[28px] font-medium tracking-tight text-slate-800 dark:text-[#ECECEC] mb-8 select-none">
                Ready when you are.
              </h1>

              {/* Centered Composer Pill */}
              <div className="w-full max-w-[720px] h-[54px] rounded-full bg-slate-100 dark:bg-[#2F2F2F] border border-slate-200 dark:border-white/7 flex items-center px-3.5 gap-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all focus-within:ring-1 focus-within:ring-white/20">
                <button
                  type="button"
                  onClick={() => setIsCommandPaletteOpen(true)}
                  title="Add content or command (⌘K)"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#3A3A3A] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && composerText.trim()) {
                      setCanvasMode("work");
                      setActiveView("prompts");
                    }
                  }}
                  placeholder="Ask ChatGPT"
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-[#ECECEC] placeholder:text-slate-400 dark:placeholder:text-[#9B9B9B] outline-none"
                />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setReasoningEffort((prev) => (prev === "High" ? "Standard" : "High"))
                    }
                    title="Reasoning effort"
                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] px-2 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    <span>{reasoningEffort}</span>
                    <span className="text-[10px] opacity-60">▾</span>
                  </button>

                  <button
                    type="button"
                    title="Voice input"
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC] hover:bg-slate-200 dark:hover:bg-[#3A3A3A] transition-colors cursor-pointer"
                  >
                    <MicIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    title="Start Voice Session"
                    className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-[#171717] hover:opacity-90 transition-opacity shadow-xs cursor-pointer shrink-0"
                  >
                    <WaveformVoiceIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Suggested Action Chips (Screenshot 1:1 Parity) */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setCanvasMode("work");
                    setActiveView("prompts");
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-[#ECECEC] bg-slate-200/60 dark:bg-[#2A2A2A] hover:bg-slate-200 dark:hover:bg-[#333333] border border-black/5 dark:border-white/5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span className="w-2.5 h-2.5 grid grid-cols-2 gap-0.5">
                    <span className="w-1 h-1 rounded-[0.5px] bg-[#589BF7]" />
                    <span className="w-1 h-1 rounded-[0.5px] bg-[#589BF7]" />
                    <span className="w-1 h-1 rounded-[0.5px] bg-[#589BF7]" />
                    <span className="w-1 h-1 rounded-[0.5px] bg-[#589BF7]" />
                  </span>
                  <span>Build a Svelte Enterprise Standards Site</span>
                </button>
                {starredPrompts[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      setCanvasMode("work");
                      setActiveView("prompts");
                      setPromptToOpen(starredPrompts[0].id);
                    }}
                    className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-[#ECECEC] bg-slate-200/60 dark:bg-[#2A2A2A] hover:bg-slate-200 dark:hover:bg-[#333333] border border-black/5 dark:border-white/5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Sparkle className="w-3 h-3 text-[#DEA123]" />
                    <span className="truncate max-w-[200px]">{starredPrompts[0].title}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Canvas Mode 2: Work (Full ForgeVault Workspace Views) */}
          {canvasMode === "work" && isReady && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Work Sub-Navigation Pills */}
              <div className="px-4 py-2 flex items-center justify-between border-b border-slate-200/60 dark:border-white/4 shrink-0 bg-slate-50/50 dark:bg-[#1E1E1E]/50">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {navDestinations.map((dest) => {
                    const IconComponent = dest.icon;
                    const isActive = activeView === dest.id;
                    return (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => {
                          setActiveView(dest.id);
                          setPromptToOpen(null);
                        }}
                        className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? "bg-slate-200 dark:bg-[#2E2E2E] text-slate-900 dark:text-[#ECECEC]"
                            : "text-slate-600 dark:text-[#9B9B9B] hover:text-slate-900 dark:hover:text-[#ECECEC]"
                        }`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                        <span>{dest.shortLabel}</span>
                        {dest.count !== undefined && (
                          <span className="font-mono text-[10px] opacity-75 tabular-nums">
                            {dest.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* View Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <Suspense
                  fallback={
                    <div className="p-12 text-center text-xs text-slate-500 dark:text-[#8E8E8E]">
                      Loading workspace...
                    </div>
                  }
                >
                  {activeView === "prompts" && (
                    <PromptsView
                      prompts={prompts}
                      folders={promptFolders}
                      onCreateFolder={handleCreateFolder}
                      onRenameFolder={handleRenameFolder}
                      onDeleteFolder={handleDeleteFolder}
                      onMovePrompt={handleMovePrompt}
                      promptToOpen={promptToOpen}
                      onPromptOpened={() => setPromptToOpen(null)}
                      editorPreferences={preferences}
                      defaultCopyFormat={preferences.defaultCopyFormat}
                      accentHex={preferences.accentHex}
                      onSavePrompt={handleSavePrompt}
                      onDeletePrompt={handleDeletePrompt}
                      onToggleFavorite={handleToggleFavoritePrompt}
                      onIncrementCopy={handleIncrementPromptCopy}
                      onRecordClipboard={handleRecordClipboard}
                      onNotify={showNotification}
                    />
                  )}

                  {activeView === "stacks" && (
                    <StacksView
                      stacks={stacks}
                      accentHex={preferences.accentHex}
                      onSaveStack={handleSaveStack}
                      onDeleteStack={handleDeleteStack}
                      onToggleFavorite={handleToggleFavoriteStack}
                      onIncrementCopy={handleIncrementStackCopy}
                      onRecordClipboard={handleRecordClipboard}
                      onNotify={showNotification}
                    />
                  )}

                  {activeView === "lessons" && (
                    <LessonsSplitStudio
                      lessons={lessons}
                      activeLessonId={activeLessonId}
                      preferences={preferences}
                      onSelectLesson={setActiveLessonId}
                      onSaveLesson={handleSaveLesson}
                      onDeleteLesson={handleDeleteLesson}
                      onUpdatePreferences={handleUpdatePreferences}
                      onRecordClipboard={handleRecordClipboard}
                      onNotify={showNotification}
                    />
                  )}

                  {activeView === "markdown" && (
                    <MarkdownVaultView
                      docs={markdownDocs}
                      preferences={preferences}
                      onSaveDoc={handleSaveMarkdownDoc}
                      onDeleteDoc={handleDeleteMarkdownDoc}
                      onRecordClipboard={handleRecordClipboard}
                      onNotify={showNotification}
                    />
                  )}

                  {activeView === "data" && (
                    <DataBackupView
                      promptFolders={promptFolders}
                      prompts={prompts}
                      stacks={stacks}
                      lessons={lessons}
                      markdownDocs={markdownDocs}
                      preferences={preferences}
                      onImportBundle={handleImportBundle}
                      onClearVault={handleClearVault}
                      onNotify={showNotification}
                    />
                  )}
                </Suspense>
              </div>
            </div>
          )}
        </main>

        {/* Column 4: Right Companion Studio Panel (Screenshot 3 Parity) */}
        {isCompanionOpen && (
          <aside className="w-[360px] shrink-0 mr-2 mb-2 bg-slate-50 dark:bg-[#212121] rounded-[12px] border border-slate-200/80 dark:border-[rgba(48,50,58,0.75)] backdrop-blur-xl shadow-sm dark:shadow-[0_0_0_1px_rgba(48,50,58,0.35),0_8px_32px_rgba(0,0,0,0.36)] flex flex-col overflow-hidden text-xs select-none">
            {/* Tab Header Strip */}
            <div className="h-10 bg-slate-100 dark:bg-[#1A1A1A] border-b border-slate-200/80 dark:border-[rgba(48,50,58,0.45)] flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-[#2A2A2A] text-slate-900 dark:text-[#ECECEC] font-medium shadow-2xs border border-slate-200 dark:border-white/5">
                  <GlobeIcon className="w-3.5 h-3.5 text-[#589BF7]" />
                  <span>Studio Tools</span>
                  <button
                    type="button"
                    onClick={() => setIsCompanionOpen(false)}
                    className="ml-1 text-slate-400 hover:text-slate-700 dark:text-[#8E8E8E] dark:hover:text-[#ECECEC] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Browser / Tool Navigation Bar */}
            <div className="h-10 border-b border-slate-200 dark:border-white/6 flex items-center px-3 gap-2 text-slate-500 dark:text-[#8E8E8E]">
              <button
                type="button"
                onClick={() => setActiveView("prompts")}
                className="hover:text-slate-900 dark:hover:text-[#ECECEC] cursor-pointer"
              >
                <NavArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveView("lessons")}
                className="hover:text-slate-900 dark:hover:text-[#ECECEC] cursor-pointer"
              >
                <NavArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => showNotification("Workspace refreshed")}
                className="hover:text-slate-900 dark:hover:text-[#ECECEC] cursor-pointer"
              >
                <ResetArrowIcon className="w-3.5 h-3.5" />
              </button>

              {/* Omnibox / Search URL */}
              <div className="flex-1 h-7 rounded-full bg-white dark:bg-[#171717] border border-slate-200 dark:border-white/6 px-2.5 flex items-center gap-2 text-slate-400 dark:text-[#8E8E8E]">
                <MagnifyingGlass className="w-3 h-3 text-slate-400 dark:text-[#737373]" />
                <span className="text-[11px] text-slate-400 dark:text-[#737373] truncate">
                  Search or command…
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="hover:text-slate-900 dark:hover:text-[#ECECEC] cursor-pointer"
              >
                <Command className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 p-4 space-y-6 overflow-y-auto">
              {/* Quick Actions */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 dark:text-[#8E8E8E] uppercase tracking-wider mb-2">
                  Quick Actions
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView("markdown");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white dark:bg-[#2A2A2A] hover:bg-slate-100 dark:hover:bg-[#333333] border border-slate-200 dark:border-white/6 text-slate-800 dark:text-[#ECECEC] transition-colors cursor-pointer shadow-2xs"
                  >
                    <FileText className="w-4 h-4 text-slate-400 dark:text-[#8E8E8E]" />
                    <span>New Markdown Doc</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsClipboardDrawerOpen(true)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-[#2A2A2A] hover:bg-slate-100 dark:hover:bg-[#333333] border border-slate-200 dark:border-white/6 text-slate-800 dark:text-[#ECECEC] transition-colors cursor-pointer shadow-2xs"
                  >
                    <span className="flex items-center gap-2.5">
                      <ClipboardText className="w-4 h-4 text-emerald-500" />
                      <span>Clipboard History</span>
                    </span>
                    <span className="font-mono text-[10px] opacity-70">
                      {clipboardHistory.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Suggested Tools Section (Screenshot 3 Parity) */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 dark:text-[#8E8E8E] uppercase tracking-wider mb-3">
                  Studio Workspaces
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {/* Code Lessons Card */}
                  <button
                    type="button"
                    onClick={() => setActiveView("lessons")}
                    className="p-3 rounded-xl bg-white dark:bg-[#282828] hover:bg-slate-50 dark:hover:bg-[#303030] border border-slate-200 dark:border-white/6 flex flex-col items-center gap-2 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#0066FF] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[11px] text-slate-800 dark:text-[#ECECEC] truncate w-full font-medium">
                      Monaco Code
                    </span>
                    <div className="w-full h-0.5 bg-[#589BF7] rounded-full mt-1" />
                  </button>

                  {/* Architecture Stacks Card */}
                  <button
                    type="button"
                    onClick={() => setActiveView("stacks")}
                    className="p-3 rounded-xl bg-white dark:bg-[#282828] hover:bg-slate-50 dark:hover:bg-[#303030] border border-slate-200 dark:border-white/6 flex flex-col items-center gap-2 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1F2328] dark:bg-[#14171E] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform border border-slate-700/20 dark:border-white/10">
                      <Stack className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[11px] text-slate-800 dark:text-[#ECECEC] truncate w-full font-medium">
                      Tech Stacks
                    </span>
                  </button>

                  {/* Build & Toolchain Card */}
                  <button
                    type="button"
                    onClick={() => {
                      showNotification("Vite+ toolchain active: v1.4.0 (strictPort 3000)");
                    }}
                    className="p-3 rounded-xl bg-white dark:bg-[#282828] hover:bg-slate-50 dark:hover:bg-[#303030] border border-slate-200 dark:border-white/6 flex flex-col items-center gap-2 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#A855F7] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                      <Sparkle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[11px] text-slate-800 dark:text-[#ECECEC] truncate w-full font-medium">
                      Vite+ Tools
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Global Command Palette (Cmd+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        prompts={prompts}
        stacks={stacks}
        lessons={lessons}
        markdownDocs={markdownDocs}
        onNavigate={handlePaletteNavigate}
        onRecordClipboard={handleRecordClipboard}
        onIncrementPromptCopy={handleIncrementPromptCopy}
        onIncrementStackCopy={handleIncrementStackCopy}
        onNotify={showNotification}
      />

      {/* Interactive Theme & Monaco Customizer Modal */}
      <ThemeCustomizerModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
      />

      {/* Agent Clipboard History & Multi-Copy Inspector Drawer */}
      <ClipboardHistoryDrawer
        isOpen={isClipboardDrawerOpen}
        onClose={() => setIsClipboardDrawerOpen(false)}
        entries={clipboardHistory}
        accentHex={preferences.accentHex}
        onClearHistory={() => setClipboardHistory([])}
        onNotify={showNotification}
      />

      {/* Feedback toast. The live region stays mounted so screen readers announce updates. */}
      <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-50">
        {toast && (
          <div
            key={toast.id}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg border border-slate-700 dark:border-slate-300 max-w-md"
          >
            <span className="break-words">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="shrink-0 font-semibold underline underline-offset-2 cursor-pointer"
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: PersistenceStatus }) {
  if (status.state === "error") {
    return (
      <span
        role="alert"
        title={status.message}
        className="hidden md:inline text-[11px] font-medium text-rose-600 dark:text-rose-400 truncate max-w-64"
      >
        Not saved: {status.message}
      </span>
    );
  }
  return (
    <span
      aria-live="polite"
      className="hidden md:inline text-[11px] text-slate-500 dark:text-slate-400 font-mono"
    >
      {status.state === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}

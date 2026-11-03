/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ClipboardText,
  Command,
  Database,
  FileText,
  Moon,
  Palette,
  Sparkle,
  Stack,
  Star,
  Sun,
} from "./components/icons";
import { DEFAULT_THEME_PREFERENCES } from "./data/seedVault";
import {
  ClipboardHistoryEntry,
  CodeLessonItem,
  MarkdownDocItem,
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
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [stacks, setStacks] = useState<TechStackItem[]>([]);
  const [lessons, setLessons] = useState<CodeLessonItem[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string>("");
  const [markdownDocs, setMarkdownDocs] = useState<MarkdownDocItem[]>([]);
  const [preferences, setPreferences] = useState<ThemePreferences>(DEFAULT_THEME_PREFERENCES);
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardHistoryEntry[]>([]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isClipboardDrawerOpen, setIsClipboardDrawerOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string; undo?: () => void } | null>(
    null,
  );
  const [triggerNewPrompt, setTriggerNewPrompt] = useState(false);

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
    if (backup.prompts) setPrompts(backup.prompts);
    if (backup.stacks) setStacks(backup.stacks);
    if (backup.lessons) {
      setLessons(backup.lessons);
      setActiveLessonId(backup.lessons[0]?.id ?? "");
    }
    if (backup.markdownDocs) setMarkdownDocs(backup.markdownDocs);
    if (backup.preferences) setPreferences(backup.preferences);
  };

  const handleClearVault = () => {
    setPrompts([]);
    setStacks([]);
    setLessons([]);
    setActiveLessonId("");
    setMarkdownDocs([]);
    setClipboardHistory([]);
    showNotification("Cleared all vault collections");
  };

  const handlePaletteNavigate = (view: WorkspaceView, itemId?: string) => {
    setActiveView(view);
    if (view === "lessons" && itemId) {
      setActiveLessonId(itemId);
    }
  };

  const canvasBgClass =
    preferences.surfaceContrast === "high-contrast" ? "bg-white dark:bg-[#050608]" : "m3-surface";

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
    <div
      className={`min-h-screen flex flex-col ${canvasBgClass} text-slate-900 dark:text-slate-100 transition-colors duration-200`}
    >
      {/* Google Material 3 (M3) Top App Bar */}
      <header
        data-tauri-drag-region
        className={`flex items-center justify-between gap-4 pr-5 py-3 bg-(--md-sys-color-surface)/92 backdrop-blur-md border-b border-(--md-sys-color-outline-variant) sticky top-0 z-30 ${
          isMacShell ? "pl-[84px]" : "pl-5"
        }`}
      >
        {/* Zone 1: Material 3 Brand Emblem */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView("prompts");
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 font-display flex items-center gap-2.5 group"
        >
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105"
            style={{ backgroundColor: preferences.accentHex }}
          >
            <Sparkle className="w-4 h-4" />
          </span>
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <span>ForgeVault</span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold m3-primary-container">
              M3 Studio
            </span>
          </div>
        </a>

        <SaveStatusIndicator status={saveStatus} />

        {/* Zone 2: Material 3 Pill Navigation Destinations */}
        <nav className="hidden xl:flex items-center gap-1.5 p-1 rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant)">
          {navDestinations.map((dest) => {
            const IconComponent = dest.icon;
            const isActive = activeView === dest.id;
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => setActiveView(dest.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? "m3-tonal-pill font-semibold shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{dest.shortLabel}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Material 3 Action Chips (Theme Toggle, Customizer, Clipboard, Search Pill) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Light / Dark Mode M3 Tonal Chip */}
          <button
            type="button"
            onClick={() =>
              handleUpdatePreferences({
                mode: preferences.mode === "dark" ? "light" : "dark",
              })
            }
            title={
              preferences.mode === "dark"
                ? "Switch to Daylight Paper (Material 3 Light)"
                : "Switch to Carbon Tonality (Material 3 Dark)"
            }
            aria-label="Toggle Light or Dark Theme"
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-high) hover:bg-(--md-sys-color-surface-container-highest) border border-(--md-sys-color-outline-variant) text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            {preferences.mode === "dark" ? (
              <>
                <Sun filled className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon filled className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Material 3 Dynamic Theme Customizer Trigger */}
          <button
            type="button"
            onClick={() => setIsThemeModalOpen(true)}
            title="Customize Material 3 Dynamic Color Seed, Contrast & Monaco Editor"
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-high) hover:bg-(--md-sys-color-surface-container-highest) border border-(--md-sys-color-outline-variant) text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Palette className="w-4 h-4" style={{ color: preferences.accentHex }} />
            <span className="hidden sm:inline">Theme</span>
          </button>

          {/* Clipboard Inspector Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsClipboardDrawerOpen(true)}
            title="Open Agent Clipboard History & Multi-Copy Inspector"
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-high) hover:bg-(--md-sys-color-surface-container-highest) border border-(--md-sys-color-outline-variant) text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <ClipboardText className="w-4 h-4 text-emerald-500" />
            <span className="hidden lg:inline">Clipboard</span>
            <span className="font-mono text-[11px] tabular-nums px-1.5 py-0.2 bg-slate-200/70 dark:bg-slate-800 rounded-full">
              {clipboardHistory.length}
            </span>
          </button>

          {/* Material 3 Primary Filled Pill Button: Global Command Palette */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            style={{ backgroundColor: preferences.accentHex }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-full shadow-xs hover:opacity-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Command className="w-3.5 h-3.5" />
            <span>Search</span>
            <kbd className="font-mono text-[10px] opacity-85">⌘K</kbd>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout: Material 3 Navigation Drawer (272px) + Main Content Surface */}
      <div className="flex-1 flex items-start">
        {/* Material 3 Navigation Drawer */}
        <aside className="w-68 shrink-0 hidden md:flex flex-col justify-between p-4 bg-(--md-sys-color-surface-container-low) border-r border-(--md-sys-color-outline-variant) sticky top-[61px] h-[calc(100vh-61px)] overflow-y-auto">
          <div className="space-y-6">
            {/* M3 Search & Clipboard Quick Action Pills */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-full bg-(--md-sys-color-surface-container-high) hover:bg-(--md-sys-color-surface-container-highest) border border-(--md-sys-color-outline-variant) text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Command className="w-4 h-4" style={{ color: preferences.accentHex }} />
                  <span className="font-medium">Search Vault</span>
                </span>
                <kbd className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-(--md-sys-color-surface) border border-(--md-sys-color-outline-variant) text-slate-600 dark:text-slate-300">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* M3 Navigation Drawer Destinations */}
            <div>
              <div className="px-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Workspace Collections
              </div>
              <div className="space-y-1">
                {navDestinations.map((dest) => {
                  const IconComponent = dest.icon;
                  const isActive = activeView === dest.id;
                  return (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => setActiveView(dest.id)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? "m3-tonal-pill font-semibold shadow-2xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <IconComponent className="w-4 h-4" />
                        <span>{dest.label}</span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums opacity-80">
                        {dest.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Starred Quick Jump */}
            <div>
              <div className="px-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Star filled className="w-3.5 h-3.5 text-amber-400" />
                <span>Starred Shortcuts</span>
              </div>
              {starredLessons.length === 0 &&
              starredPrompts.length === 0 &&
              starredStacks.length === 0 ? (
                <p className="px-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Star any prompt, stack, or lesson for 1-click access.
                </p>
              ) : (
                <div className="space-y-1">
                  {starredLessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => {
                        setActiveLessonId(lesson.id);
                        setActiveView("lessons");
                      }}
                      className="w-full text-left px-4 py-2 rounded-full text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 truncate cursor-pointer"
                    >
                      {lesson.title}
                    </button>
                  ))}
                  {starredPrompts.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() => setActiveView("prompts")}
                      className="w-full text-left px-4 py-2 rounded-full text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 truncate cursor-pointer"
                    >
                      {prompt.title}
                    </button>
                  ))}
                  {starredStacks.slice(0, 3).map((stack) => (
                    <button
                      key={stack.id}
                      type="button"
                      onClick={() => setActiveView("stacks")}
                      className="w-full text-left px-4 py-2 rounded-full text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 truncate cursor-pointer"
                    >
                      {stack.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Material 3 Surface Container Card for Appearance */}
          <div className="p-3 rounded-2xl bg-(--md-sys-color-surface-container) border border-(--md-sys-color-outline-variant) space-y-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleUpdatePreferences({
                    mode: preferences.mode === "dark" ? "light" : "dark",
                  })
                }
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-medium bg-(--md-sys-color-surface-container-high) hover:bg-(--md-sys-color-surface-container-highest) text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
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
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium m3-tonal-pill hover:opacity-90 transition-opacity cursor-pointer"
                title="Customize Material 3 Dynamic Color & Monaco Editor"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>M3 Theme</span>
              </button>
            </div>

            <div className="px-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-mono">
              <span className="truncate">{preferences.accentName}</span>
              <span>M3 HCT</span>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
          {/* Mobile Material 3 Pill Bar (visible under md breakpoint) */}
          <div className="flex md:hidden items-center gap-1.5 mb-5 pb-3 border-b border-(--md-sys-color-outline-variant) overflow-x-auto">
            {navDestinations.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  activeView === tab.id
                    ? "m3-tonal-pill font-semibold"
                    : "bg-(--md-sys-color-surface-container-low) text-slate-600 dark:text-slate-400 border border-(--md-sys-color-outline-variant)"
                }`}
              >
                {tab.shortLabel}
              </button>
            ))}
          </div>

          {hydration.state === "loading" && (
            <div
              role="status"
              className="p-12 text-center m3-card text-xs text-slate-500 dark:text-slate-400"
            >
              Opening your vault…
            </div>
          )}

          {hydration.state === "error" && (
            <div role="alert" className="p-8 m3-card border border-rose-500/50 space-y-3 max-w-2xl">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Your vault could not be opened
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                ForgeVault could not read its local database, so nothing is shown and nothing will
                be saved until it loads. Your existing data has not been changed.
              </p>
              <p className="text-xs font-mono text-rose-600 dark:text-rose-400 break-all">
                {hydration.message}
              </p>
              <button
                type="button"
                onClick={() => setLoadAttempt((n) => n + 1)}
                style={{ backgroundColor: preferences.accentHex }}
                className="px-4 py-2 text-xs font-semibold rounded-full text-white cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {isReady && (
            <Suspense
              fallback={
                <div className="p-12 text-center m3-card text-xs font-mono text-slate-500 dark:text-slate-400">
                  Loading Material 3 Studio workspace...
                </div>
              }
            >
              {activeView === "prompts" && (
                <PromptsView
                  prompts={prompts}
                  defaultCopyFormat={preferences.defaultCopyFormat}
                  accentHex={preferences.accentHex}
                  onSavePrompt={handleSavePrompt}
                  onDeletePrompt={handleDeletePrompt}
                  onToggleFavorite={handleToggleFavoritePrompt}
                  onIncrementCopy={handleIncrementPromptCopy}
                  onRecordClipboard={handleRecordClipboard}
                  onNotify={showNotification}
                  externalCreateTrigger={triggerNewPrompt}
                  onClearExternalCreate={() => setTriggerNewPrompt(false)}
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
          )}
        </main>
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

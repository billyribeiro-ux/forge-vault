import React from "react";
import { Check, Moon, Palette, Sparkle, Sun, X } from "./icons";
import { ACCENT_PRESETS } from "../data/seedVault";
import { CopyFormat, SurfaceContrast, ThemePreferences } from "../types/vault";

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: ThemePreferences;
  onUpdatePreferences: (partial: Partial<ThemePreferences>) => void;
}

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Material Design 3 Theme Customizer"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl m3-dialog overflow-hidden"
      >
        {/* M3 Dialog Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-(--md-sys-color-outline-variant)">
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: preferences.accentHex }}
            >
              <Palette className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Material Design 3 — Dynamic Color & Studio Theme
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                HCT perceptual color tokens, tonal surface hierarchy & Monaco IDE controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* 1. M3 Light / Dark Tonal Posture */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              1. Material 3 Tonal Scheme (Light & Dark)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdatePreferences({ mode: "light" })}
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                  preferences.mode === "light"
                    ? "m3-tonal-pill border-transparent shadow-xs"
                    : "bg-(--md-sys-color-surface-container-low) border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container)"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Sun filled={preferences.mode === "light"} className="w-4 h-4 text-amber-500" />
                  <span className="text-left">
                    <span className="block">Daylight Paper (M3 Light)</span>
                    <span className="block text-[10px] font-mono opacity-75">
                      Tone 98 #F8F9FC · APCA Lc 96
                    </span>
                  </span>
                </span>
                {preferences.mode === "light" && <Check className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => onUpdatePreferences({ mode: "dark" })}
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                  preferences.mode === "dark"
                    ? "m3-tonal-pill border-transparent shadow-xs"
                    : "bg-(--md-sys-color-surface-container-low) border-(--md-sys-color-outline-variant) text-slate-700 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container)"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Moon filled={preferences.mode === "dark"} className="w-4 h-4 text-indigo-400" />
                  <span className="text-left">
                    <span className="block">Carbon Tonality (M3 Dark)</span>
                    <span className="block text-[10px] font-mono opacity-75">
                      Tone 6 #111318 · Zero Halation
                    </span>
                  </span>
                </span>
                {preferences.mode === "dark" && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2. Material You Dynamic Seed Color */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Material You Dynamic Color Seed
              </label>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full m3-primary-container">
                {preferences.accentName} · {preferences.accentHex}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = preferences.accentHex.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({
                        accentName: preset.name,
                        accentHex: preset.hex,
                      })
                    }
                    className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "m3-tonal-pill border-transparent font-semibold shadow-2xs"
                        : "border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-low) text-slate-600 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container)"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span className="truncate">{preset.name}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant)">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Sparkle className="w-4 h-4" style={{ color: preferences.accentHex }} />
                <span>Custom Seed Hex (auto-generates M3 containers):</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={preferences.accentHex}
                  onChange={(e) =>
                    onUpdatePreferences({
                      accentName: "Custom M3 Seed",
                      accentHex: e.target.value,
                    })
                  }
                  className="w-8 h-7 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={preferences.accentHex}
                  onChange={(e) =>
                    onUpdatePreferences({
                      accentName: "Custom M3 Seed",
                      accentHex: e.target.value,
                    })
                  }
                  className="px-3 py-1 text-xs font-mono rounded-full bg-(--md-sys-color-surface) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100 w-28"
                />
              </div>
            </div>
          </div>

          {/* 3. M3 Surface Container Contrast Level */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              3. M3 Surface Container Contrast & Tonal Tint
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { id: "crisp", label: "Standard M3", sub: "Neutral HCT" },
                  { id: "tinted", label: "Dynamic Tinted", sub: "Seed Chroma" },
                  { id: "high-contrast", label: "High Contrast", sub: "APCA Lc 95+" },
                ] as Array<{ id: SurfaceContrast; label: string; sub: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ surfaceContrast: opt.id })}
                  className={`px-3 py-2.5 rounded-2xl border text-xs transition-all cursor-pointer ${
                    preferences.surfaceContrast === opt.id
                      ? "m3-tonal-pill border-transparent font-semibold shadow-2xs"
                      : "border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-low) text-slate-600 dark:text-slate-400 hover:bg-(--md-sys-color-surface-container)"
                  }`}
                >
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-[10px] font-mono opacity-75 mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>

            {/* Live M3 Surface Container Token Swatch Bar */}
            <div className="mt-3 grid grid-cols-5 gap-1.5 text-[10px] font-mono text-center">
              <div className="p-2 rounded-xl bg-(--md-sys-color-surface) border border-(--md-sys-color-outline-variant)">
                Surface
              </div>
              <div className="p-2 rounded-xl bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant)">
                Cont. Low
              </div>
              <div className="p-2 rounded-xl bg-(--md-sys-color-surface-container-high) border border-(--md-sys-color-outline-variant)">
                Cont. High
              </div>
              <div className="p-2 rounded-xl m3-tonal-pill">Secondary</div>
              <div
                className="p-2 rounded-xl text-white font-semibold"
                style={{ backgroundColor: preferences.accentHex }}
              >
                Primary
              </div>
            </div>
          </div>

          {/* 4. Monaco Editor Preferences */}
          <div className="space-y-3 pt-3 border-t border-(--md-sys-color-outline-variant)">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Monaco Editor Font Size (
                <span className="font-mono tabular-nums">{preferences.editorFontSize}px</span>)
              </label>
              <input
                type="range"
                min={12}
                max={18}
                step={1}
                value={preferences.editorFontSize}
                onChange={(e) => onUpdatePreferences({ editorFontSize: Number(e.target.value) })}
                style={{ accentColor: preferences.accentHex }}
                className="w-36 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Default Prompt Copy Format
              </span>
              <select
                value={preferences.defaultCopyFormat}
                onChange={(e) =>
                  onUpdatePreferences({
                    defaultCopyFormat: e.target.value as CopyFormat,
                  })
                }
                className="px-3.5 py-1.5 text-xs rounded-full bg-(--md-sys-color-surface-container-low) border border-(--md-sys-color-outline-variant) text-slate-800 dark:text-slate-200"
              >
                <option value="raw">Raw Prompt Text</option>
                <option value="xml">Agent XML Block (&lt;prompt&gt;)</option>
                <option value="markdown">Markdown Section</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-(--md-sys-color-surface-container-low) border-t border-(--md-sys-color-outline-variant)">
          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: preferences.accentHex }}
            className="px-6 py-2 rounded-full text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

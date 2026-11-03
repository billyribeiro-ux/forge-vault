import type { Monaco } from "@monaco-editor/react";

let themesRegistered = false;

/**
 * Registers custom Google Material Design 3 (M3) HCT-calibrated themes for Monaco Editor:
 * - forgevault-m3-dark: Carbon Tonality (#0C0E13 surface-container-lowest, #181B21 gutter/line highlight)
 * - forgevault-m3-light: Daylight Paper (#FFFFFF surface-container-lowest, #F2F4F9 gutter/line highlight)
 */
export function registerMaterial3MonacoThemes(monaco: Monaco): void {
  if (themesRegistered) return;
  themesRegistered = true;

  monaco.editor.defineTheme("forgevault-m3-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "757986", fontStyle: "italic" },
      { token: "keyword", foreground: "A8C7FA" },
      { token: "string", foreground: "81C995" },
      { token: "number", foreground: "FDE293" },
      { token: "type", foreground: "C58AF9" },
    ],
    colors: {
      "editor.background": "#0C0E13",
      "editor.foreground": "#E2E2E9",
      "editor.lineHighlightBackground": "#181B21",
      "editorLineNumber.foreground": "#5E6168",
      "editorLineNumber.activeForeground": "#C4C6D0",
      "editor.selectionBackground": "#28427280",
      "editor.inactiveSelectionBackground": "#22252D80",
      "editorGutter.background": "#0C0E13",
      "editorWidget.background": "#181B21",
      "editorWidget.border": "#282C37",
    },
  });

  monaco.editor.defineTheme("forgevault-m3-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "686F7E", fontStyle: "italic" },
      { token: "keyword", foreground: "0B57D0" },
      { token: "string", foreground: "137333" },
      { token: "number", foreground: "B06000" },
      { token: "type", foreground: "681DA8" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#191C20",
      "editor.lineHighlightBackground": "#F2F4F9",
      "editorLineNumber.foreground": "#8E9199",
      "editorLineNumber.activeForeground": "#191C20",
      "editor.selectionBackground": "#D3E3FD",
      "editorGutter.background": "#FFFFFF",
      "editorWidget.background": "#F8F9FC",
      "editorWidget.border": "#DDE1EB",
    },
  });
}

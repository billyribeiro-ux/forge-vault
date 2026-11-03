import React, { useState } from "react";
import { Folder, FolderAdd, PencilSimple, Trash } from "./icons";
import { PromptFolder } from "../types/vault";

/**
 * `"all"` = every prompt, `"unfiled"` = prompts without a folder, otherwise a folder id.
 * Folder ids always start with `folder-`, so they never collide with the two keywords.
 */
export type FolderSelection = string;

interface PromptFolderRailProps {
  folders: PromptFolder[];
  counts: { all: number; unfiled: number; byFolder: Map<string, number> };
  selected: FolderSelection;
  accentHex: string;
  onSelect: (selection: FolderSelection) => void;
  onCreate: (name: string) => PromptFolder;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const MAX_FOLDER_NAME = 60;

export const PromptFolderRail: React.FC<PromptFolderRailProps> = ({
  folders,
  counts,
  selected,
  accentHex,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validate = (raw: string, exceptId?: string): string | null => {
    const name = raw.trim();
    if (!name) return "Enter a folder name";
    if (name.length > MAX_FOLDER_NAME) return `Use ${MAX_FOLDER_NAME} characters or fewer`;
    const clash = folders.some(
      (f) =>
        f.id !== exceptId && f.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0,
    );
    return clash ? `A folder named "${name}" already exists` : null;
  };

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate(draftName);
    if (problem) {
      setError(problem);
      return;
    }
    const folder = onCreate(draftName.trim());
    setDraftName("");
    setIsCreating(false);
    setError(null);
    onSelect(folder.id);
  };

  const submitRename = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const problem = validate(renameValue, id);
    if (problem) {
      setError(problem);
      return;
    }
    onRename(id, renameValue.trim());
    setRenamingId(null);
    setError(null);
  };

  const cancelEditing = () => {
    setIsCreating(false);
    setRenamingId(null);
    setDraftName("");
    setError(null);
  };

  const itemClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
      active
        ? "m3-tonal-pill font-semibold"
        : "text-slate-700 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container-high)"
    }`;

  const inputClass =
    "w-full px-3 py-1.5 text-xs rounded-lg bg-(--md-sys-color-surface) border border-(--md-sys-color-outline-variant) text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500";

  return (
    <nav aria-label="Prompt folders" className="w-full lg:w-56 shrink-0 space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Folders
        </h2>
        <button
          type="button"
          onClick={() => {
            cancelEditing();
            setIsCreating(true);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-(--md-sys-color-surface-container-high) cursor-pointer"
        >
          <FolderAdd className="w-3.5 h-3.5" />
          <span>New folder</span>
        </button>
      </div>

      {isCreating && (
        <form onSubmit={submitCreate} className="space-y-1.5 px-1">
          <label htmlFor="new-folder-name" className="sr-only">
            New folder name
          </label>
          <input
            id="new-folder-name"
            autoFocus
            value={draftName}
            maxLength={MAX_FOLDER_NAME}
            onChange={(e) => {
              setDraftName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                cancelEditing();
              }
            }}
            placeholder="e.g. Frontend"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "folder-error" : undefined}
            className={inputClass}
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              style={{ backgroundColor: accentHex }}
              className="px-3 py-1 rounded-full text-[11px] font-semibold text-white cursor-pointer"
            >
              Create
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="px-3 py-1 rounded-full text-[11px] text-slate-600 dark:text-slate-300 border border-(--md-sys-color-outline-variant) cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p
          id="folder-error"
          role="alert"
          className="px-1 text-[11px] text-rose-600 dark:text-rose-400"
        >
          {error}
        </p>
      )}

      <ul className="space-y-0.5">
        <li>
          <button
            type="button"
            aria-current={selected === "all" ? "true" : undefined}
            onClick={() => onSelect("all")}
            className={itemClass(selected === "all")}
          >
            <span>All prompts</span>
            <span className="font-mono tabular-nums opacity-70">{counts.all}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            aria-current={selected === "unfiled" ? "true" : undefined}
            onClick={() => onSelect("unfiled")}
            className={itemClass(selected === "unfiled")}
          >
            <span>Unfiled</span>
            <span className="font-mono tabular-nums opacity-70">{counts.unfiled}</span>
          </button>
        </li>

        {folders.map((folder) =>
          renamingId === folder.id ? (
            <li key={folder.id} className="px-1 py-1">
              <form onSubmit={(e) => submitRename(e, folder.id)}>
                <label htmlFor={`rename-${folder.id}`} className="sr-only">
                  Rename folder {folder.name}
                </label>
                <input
                  id={`rename-${folder.id}`}
                  autoFocus
                  value={renameValue}
                  maxLength={MAX_FOLDER_NAME}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    setError(null);
                  }}
                  onBlur={() => {
                    // Clicking away keeps a valid new name, like Finder; invalid edits are dropped.
                    if (!validate(renameValue, folder.id)) onRename(folder.id, renameValue.trim());
                    setRenamingId(null);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      cancelEditing();
                    }
                  }}
                  className={inputClass}
                />
              </form>
            </li>
          ) : (
            <li key={folder.id} className="group relative">
              <button
                type="button"
                aria-current={selected === folder.id ? "true" : undefined}
                onClick={() => onSelect(folder.id)}
                className={`${itemClass(selected === folder.id)} pr-16`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Folder className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </span>
                <span className="font-mono tabular-nums opacity-70 group-hover:opacity-0 group-focus-within:opacity-0">
                  {counts.byFolder.get(folder.id) ?? 0}
                </span>
              </button>
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    cancelEditing();
                    setRenamingId(folder.id);
                    setRenameValue(folder.name);
                  }}
                  aria-label={`Rename folder ${folder.name}`}
                  title="Rename"
                  className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-(--md-sys-color-surface-container-highest) cursor-pointer"
                >
                  <PencilSimple className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selected === folder.id) onSelect("all");
                    onDelete(folder.id);
                  }}
                  aria-label={`Delete folder ${folder.name} (its prompts move to Unfiled)`}
                  title="Delete folder (prompts move to Unfiled)"
                  className="p-1 rounded-md text-slate-500 hover:text-rose-500 hover:bg-(--md-sys-color-surface-container-highest) cursor-pointer"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>

      {folders.length === 0 && !isCreating && (
        <p className="px-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Group prompts by area, for example Frontend, Backend, or Reviews.
        </p>
      )}
    </nav>
  );
};

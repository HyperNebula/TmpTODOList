import { useSettingsStore } from "../store/settingsStore";
import { useTaskStore } from "../store/taskStore";
import { useState } from "react";
import { PromptDialog } from "./PromptDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { getTodayRange, getTomorrowRange, getWeekRange } from "../lib/dateUtils";
import type { FilterState } from "../types/task";
import "./FilterPresetPanel.css";

interface Props {
  position: "left" | "right" | "top";
}

type QuickFilter = "today" | "tomorrow" | "week" | null;

function getActiveQuickFilter(filter: FilterState): QuickFilter {
  const today = getTodayRange();
  const tomorrow = getTomorrowRange();
  const week = getWeekRange();

  if (filter.dueAfter === today.dueAfter && filter.dueBefore === today.dueBefore) {
    return "today";
  }
  if (filter.dueAfter === tomorrow.dueAfter && filter.dueBefore === tomorrow.dueBefore) {
    return "tomorrow";
  }
  if (filter.dueAfter === week.dueAfter && filter.dueBefore === week.dueBefore) {
    return "week";
  }
  return null;
}

const QUICK_FILTERS = [
  { kind: "today" as const, label: "Due Today", title: "Show only tasks due today" },
  { kind: "tomorrow" as const, label: "Today & Tomorrow", title: "Show tasks due today and tomorrow" },
  { kind: "week" as const, label: "Due This Week", title: "Show tasks due within the next 7 days" },
] as const;

export function FilterPresetPanel({ position }: Props) {
  const {
    filterPresets,
    filterPresetPanelPosition,
    filterPresetPanelOpen,
    setFilterPresetPanelOpen,
    deleteFilterPreset,
    renameFilterPreset,
    saveFilterPreset,
  } = useSettingsStore();

  const store = useTaskStore();

  const [promptState, setPromptState] = useState<{
    id: string;
    initialValue: string;
  } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    id: string;
    name: string;
    action: "delete" | "update";
  } | null>(null);

  if (filterPresetPanelPosition !== position) return null;

  const activeQuick = getActiveQuickFilter(store.filter);

  const applyQuickFilter = (kind: "today" | "tomorrow" | "week") => {
    if (activeQuick === kind) {
      store.setFilter({ dueAfter: null, dueBefore: null });
      store.setSort(null);
      return;
    }
    const ranges = { today: getTodayRange, tomorrow: getTomorrowRange, week: getWeekRange };
    const range = ranges[kind]();
    store.setFilter({ dueAfter: range.dueAfter, dueBefore: range.dueBefore });
    store.setSort({ column: "dueDate", direction: "asc" });
    store.expandAllTasks();
  };

  const applyPreset = (preset: typeof filterPresets[0]) => {
    store.setFilter(preset.filter);
    if (preset.sort !== undefined) {
      store.setSort(preset.sort);
    }
    if (preset.focusTaskId !== undefined) {
      store.setFocusTask(preset.focusTaskId);
    }
  };

  const hasPresets = filterPresets.length > 0;

  if (position === "top") {
    return (
      <div className="filter-preset-panel top-panel">
        <div className="quick-filters">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.kind}
              type="button"
              className={`btn${activeQuick === qf.kind ? " btn-primary" : ""}`}
              onClick={() => applyQuickFilter(qf.kind)}
              title={qf.title}
            >
              {qf.label}
            </button>
          ))}
        </div>
        <span className="panel-label">Presets:</span>
        {hasPresets ? (
          <div className="preset-list horizontal">
            {filterPresets.map((preset) => (
              <div key={preset.id} className="preset-chip-wrapper">
                <button
                  className="preset-chip"
                  onClick={() => applyPreset(preset)}
                  title="Apply preset"
                >
                  {preset.name}
                </button>
                <button
                  className="preset-action update"
                  title="Update preset with current filters"
                  onClick={() =>
                    setConfirmState({
                      id: preset.id,
                      name: preset.name,
                      action: "update",
                    })
                  }
                >
                  ↻
                </button>
                <button
                  className="preset-action rename"
                  title="Rename preset"
                  onClick={() =>
                    setPromptState({ id: preset.id, initialValue: preset.name })
                  }
                >
                  ✎
                </button>
                <button
                  className="preset-action delete"
                  title="Delete preset"
                  onClick={() =>
                    setConfirmState({
                      id: preset.id,
                      name: preset.name,
                      action: "delete",
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <span className="empty-message">None saved.</span>
        )}

        {promptState && (
          <PromptDialog
            title="Rename Preset"
            message="Enter new name:"
            initialValue={promptState.initialValue}
            onConfirm={(val) => {
              if (val.trim()) renameFilterPreset(promptState.id, val.trim());
              setPromptState(null);
            }}
            onCancel={() => setPromptState(null)}
          />
        )}
        {confirmState && (
          <ConfirmDialog
            title={confirmState.action === "delete" ? "Delete Preset" : "Update Preset"}
            message={
              confirmState.action === "delete"
                ? `Delete preset "${confirmState.name}"?`
                : `Overwrite preset "${confirmState.name}" with current filters?`
            }
            confirmLabel={confirmState.action === "delete" ? "Delete" : "Update"}
            confirmVariant={confirmState.action === "delete" ? "danger" : "primary"}
            onConfirm={() => {
              if (confirmState.action === "delete") {
                deleteFilterPreset(confirmState.id);
              } else {
                const preset = filterPresets.find((p) => p.id === confirmState.id);
                if (preset) {
                  saveFilterPreset({ 
                    ...preset, 
                    filter: store.filter,
                    sort: store.sort,
                    focusTaskId: store.focusTaskId
                  });
                }
              }
              setConfirmState(null);
            }}
            onCancel={() => setConfirmState(null)}
          />
        )}
      </div>
    );
  }

  // Left or Right sidebar
  return (
    <>
      <div className={`filter-preset-panel sidebar ${position} ${filterPresetPanelOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <h3>Filter Presets</h3>
          <button
            className="toggle-btn inside"
            onClick={() => setFilterPresetPanelOpen(false)}
            title="Close panel"
          >
            {position === "left" ? "◀" : "▶"}
          </button>
        </div>
        <div className="sidebar-content">
          <div className="quick-filters vertical">
            {QUICK_FILTERS.map((qf) => (
              <button
                key={qf.kind}
                type="button"
                className={`btn${activeQuick === qf.kind ? " btn-primary" : ""}`}
                onClick={() => applyQuickFilter(qf.kind)}
                title={qf.title}
              >
                {qf.label}
              </button>
            ))}
          </div>
          {hasPresets ? (
            <div className="preset-list vertical">
              {filterPresets.map((preset) => (
                <div key={preset.id} className="preset-row">
                  <button
                    className="preset-btn"
                    onClick={() => applyPreset(preset)}
                    title="Apply preset"
                  >
                    {preset.name}
                  </button>
                  <div className="preset-actions">
                    <button
                      title="Update preset with current filters"
                      onClick={() =>
                        setConfirmState({
                          id: preset.id,
                          name: preset.name,
                          action: "update",
                        })
                      }
                    >
                      ↻
                    </button>
                    <button
                      title="Rename preset"
                      onClick={() =>
                        setPromptState({ id: preset.id, initialValue: preset.name })
                      }
                    >
                      ✎
                    </button>
                    <button
                      title="Delete preset"
                      onClick={() =>
                        setConfirmState({
                          id: preset.id,
                          name: preset.name,
                          action: "delete",
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-message-box">
              No presets. Use the "Save Preset" button in the filter bar.
            </div>
          )}
        </div>

        {promptState && (
          <PromptDialog
            title="Rename Preset"
            message="Enter new name:"
            initialValue={promptState.initialValue}
            onConfirm={(val) => {
              if (val.trim()) renameFilterPreset(promptState.id, val.trim());
              setPromptState(null);
            }}
            onCancel={() => setPromptState(null)}
          />
        )}
        {confirmState && (
          <ConfirmDialog
            title={confirmState.action === "delete" ? "Delete Preset" : "Update Preset"}
            message={
              confirmState.action === "delete"
                ? `Delete preset "${confirmState.name}"?`
                : `Overwrite preset "${confirmState.name}" with current filters?`
            }
            confirmLabel={confirmState.action === "delete" ? "Delete" : "Update"}
            confirmVariant={confirmState.action === "delete" ? "danger" : "primary"}
            onConfirm={() => {
              if (confirmState.action === "delete") {
                deleteFilterPreset(confirmState.id);
              } else {
                const preset = filterPresets.find((p) => p.id === confirmState.id);
                if (preset) {
                  saveFilterPreset({
                    ...preset,
                    filter: store.filter,
                    sort: store.sort,
                    focusTaskId: store.focusTaskId
                  });
                }
              }
              setConfirmState(null);
            }}
            onCancel={() => setConfirmState(null)}
          />
        )}
      </div>

      {!filterPresetPanelOpen && (
        <button
          className={`toggle-btn outside ${position}`}
          onClick={() => setFilterPresetPanelOpen(true)}
          title="Open filter presets"
        >
          {position === "left" ? "▶" : "◀"}
        </button>
      )}
    </>
  );
}

import { getTodayRange, getTomorrowRange, getWeekRange } from "../lib/dateUtils";
import type { FilterState, SortState } from "../types/task";

interface FilterBarProps {
  filter: FilterState;
  sort: SortState | null;
  onChange: (partial: Partial<FilterState>) => void;
  onSortChange: (sort: SortState | null) => void;
  onClear: () => void;
  onSavePreset: () => void;
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

export function FilterBar({ filter, sort, onChange, onSortChange, onClear, onSavePreset }: FilterBarProps) {
  const activeQuick = getActiveQuickFilter(filter);

  const applyQuickFilter = (kind: "today" | "tomorrow" | "week") => {
    if (activeQuick === kind) {
      // Toggle off: clear date bounds and sort
      onChange({ dueAfter: null, dueBefore: null });
      onSortChange(null);
      return;
    }
    const ranges = { today: getTodayRange, tomorrow: getTomorrowRange, week: getWeekRange };
    const range = ranges[kind]();
    onChange({ dueAfter: range.dueAfter, dueBefore: range.dueBefore });
    onSortChange({ column: "dueDate", direction: "asc" });
  };

  return (
    <div className="filter-bar">
      <div className="quick-filters">
        <button
          type="button"
          className={`btn${activeQuick === "today" ? " btn-primary" : ""}`}
          onClick={() => applyQuickFilter("today")}
          title="Show only tasks due today"
        >
          Due Today
        </button>
        <button
          type="button"
          className={`btn${activeQuick === "tomorrow" ? " btn-primary" : ""}`}
          onClick={() => applyQuickFilter("tomorrow")}
          title="Show tasks due today and tomorrow"
        >
          Today &amp; Tomorrow
        </button>
        <button
          type="button"
          className={`btn${activeQuick === "week" ? " btn-primary" : ""}`}
          onClick={() => applyQuickFilter("week")}
          title="Show tasks due within the next 7 days"
        >
          Due This Week
        </button>
      </div>

      <label>
        Priority ≥
        <select
          value={filter.priorityMin ?? ""}
          onChange={(e) =>
            onChange({
              priorityMin: e.target.value ? parseInt(e.target.value, 10) : null,
            })
          }
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label>
        Priority ≤
        <select
          value={filter.priorityMax ?? ""}
          onChange={(e) =>
            onChange({
              priorityMax: e.target.value ? parseInt(e.target.value, 10) : null,
            })
          }
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label>
        Category
        <input
          type="text"
          value={filter.category}
          placeholder="contains…"
          onChange={(e) => onChange({ category: e.target.value })}
        />
      </label>

      <label>
        Done
        <select
          value={filter.done}
          onChange={(e) =>
            onChange({ done: e.target.value as FilterState["done"] })
          }
        >
          <option value="all">All</option>
          <option value="not_done">Not done</option>
          <option value="done">Done</option>
        </select>
      </label>

      <label>
        Type
        <select
          value={filter.projectFilter}
          onChange={(e) =>
            onChange({ projectFilter: e.target.value as FilterState["projectFilter"] })
          }
        >
          <option value="all">All</option>
          <option value="projects">Projects</option>
          <option value="non-projects">Non-Projects</option>
        </select>
      </label>

      <label>
        Title / Notes
        <input
          id="title-filter-input"
          type="text"
          value={filter.titleContains}
          placeholder="Search title or notes..."
          onChange={(e) => onChange({ titleContains: e.target.value })}
        />
      </label>

      <label>
        Due after
        <input
          type="date"
          value={filter.dueAfter ?? ""}
          onChange={(e) =>
            onChange({ dueAfter: e.target.value || null })
          }
        />
      </label>

      <label>
        Due before
        <input
          type="date"
          value={filter.dueBefore ?? ""}
          onChange={(e) =>
            onChange({ dueBefore: e.target.value || null })
          }
        />
      </label>

      <label>
        Created after
        <input
          type="date"
          value={filter.createdAfter ?? ""}
          onChange={(e) =>
            onChange({ createdAfter: e.target.value || null })
          }
        />
      </label>

      <label>
        Created before
        <input
          type="date"
          value={filter.createdBefore ?? ""}
          onChange={(e) =>
            onChange({ createdBefore: e.target.value || null })
          }
        />
      </label>

      <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={onSavePreset}
          title="Save current filters as a preset"
        >
          Save Preset
        </button>
        <button type="button" className="btn-secondary" onClick={onClear}>
          Clear filters
        </button>
      </div>
    </div>
  );
}

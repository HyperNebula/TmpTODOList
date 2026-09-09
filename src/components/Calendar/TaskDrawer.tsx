import { useState, useEffect, useMemo } from "react";
import type { Task } from "../../types/task";
import { getPriorityColor } from "./colors";

interface TaskDrawerProps {
  tasks: Task[];
  width?: number;
  onWidthChange?: (width: number) => void;
  onClose: () => void;
}

type FilterMode = "all" | "today" | "next_week" | "priority";

interface TreeNode {
  task: Task;
  children: TreeNode[];
}

function comparePriority(a: Task, b: Task, dir: "asc" | "desc"): number {
  if (a.priority === null && b.priority === null) return a.order - b.order;
  if (a.priority === null) return 1;
  if (b.priority === null) return -1;
  if (dir === "asc") {
    if (a.priority !== b.priority) return a.priority - b.priority;
  } else {
    if (a.priority !== b.priority) return b.priority - a.priority;
  }
  return a.order - b.order;
}

/**
 * A slide-in sidebar showing all non-archived tasks.
 * Tasks are draggable onto the calendar time grid to create timeblocks.
 */
export function TaskDrawer({ tasks, width = 240, onWidthChange, onClose }: TaskDrawerProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [prioritySortDir, setPrioritySortDir] = useState<"asc" | "desc">("asc");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [localWidth, setLocalWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setLocalWidth(width);
  }, [width]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = localWidth;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(600, Math.max(160, startWidth + delta));
      setLocalWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      setIsResizing(false);
      const delta = upEvent.clientX - startX;
      const finalWidth = Math.min(600, Math.max(160, startWidth + delta));
      setLocalWidth(finalWidth);
      onWidthChange?.(finalWidth);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Date utilities for filtering
  const toIsoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  
  const todayIso = toIsoDate(new Date());
  
  const getNextWeekIso = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toIsoDate(d);
  };
  const nextWeekIso = getNextWeekIso();

  // Basic filtering first
  const baseFiltered = tasks.filter((t) => {
    if (t.archived) return false;
    
    // Text search
    if (search !== "" && !t.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }

    // Date filtering
    if (filterMode === "today") {
      if (!t.dueDate || t.dueDate !== todayIso) return false;
    } else if (filterMode === "next_week") {
      if (!t.dueDate || t.dueDate < todayIso || t.dueDate > nextWeekIso) return false;
    }

    return true;
  });

  const isPriorityMode = filterMode === "priority";

  const prioritySortedTasks = useMemo(() => {
    if (!isPriorityMode) return [];
    return [...baseFiltered].sort((a, b) => comparePriority(a, b, prioritySortDir));
  }, [baseFiltered, isPriorityMode, prioritySortDir]);

  // Build tree only when not in priority mode
  const rootNodes: TreeNode[] = [];
  if (!isPriorityMode) {
    const includedIds = new Set(baseFiltered.map(t => t.id));
    
    // Make sure parents of included items are also included
    let addedNew = true;
    while (addedNew) {
      addedNew = false;
      for (const id of Array.from(includedIds)) {
        const task = tasks.find(t => t.id === id);
        if (task && task.parentId && !includedIds.has(task.parentId)) {
          includedIds.add(task.parentId);
          addedNew = true;
        }
      }
    }

    // Build tree
    const treeNodes = new Map<string, TreeNode>();

    // Initialize nodes for all included tasks
    for (const t of tasks) {
      if (includedIds.has(t.id)) {
        treeNodes.set(t.id, { task: t, children: [] });
      }
    }

    // Assign children to parents
    for (const node of Array.from(treeNodes.values())) {
      const parentId = node.task.parentId;
      if (parentId && treeNodes.has(parentId)) {
        treeNodes.get(parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // Sort nodes
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.task.order - b.task.order);
      for (const n of nodes) {
        sortNodes(n.children);
      }
    };
    sortNodes(rootNodes);
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "copy";
  }

  function toggleCollapse(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderTree(nodes: TreeNode[], depth = 0) {
    return nodes.map(node => {
      const t = node.task;
      const isCollapsed = collapsedIds.has(t.id);
      const hasChildren = node.children.length > 0;

      return (
        <li key={t.id} className="task-drawer-item-container" style={{ marginLeft: depth > 0 ? "16px" : "0", listStyle: "none" }}>
          <div
            className={`task-drawer-item${t.done ? " task-drawer-item--done" : ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, t.id)}
            title={t.title}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {hasChildren ? (
              <button 
                type="button"
                className="fold-btn" 
                onClick={(e) => toggleCollapse(e, t.id)}
                style={{ cursor: "pointer", marginRight: "4px" }}
              >
                {isCollapsed ? "▶" : "▼"}
              </button>
            ) : (
              <span style={{ marginRight: "4px", width: "16px", display: "inline-block" }}></span>
            )}
            
            <span 
              className="task-drawer-item-indicator" 
              style={t.done ? undefined : (t.priority !== null ? { backgroundColor: getPriorityColor(t.priority) } : undefined)}
            />
            <span className="task-drawer-item-title">{t.title || "(untitled)"}</span>
            {t.timeEstimateMinutes != null && (
              <span className="task-drawer-item-est">
                {t.timeEstimateMinutes}m
              </span>
            )}
          </div>
          {!isCollapsed && hasChildren && (
            <ul className="task-drawer-list" style={{ marginTop: "4px", marginBottom: "4px", paddingLeft: 0 }}>
              {renderTree(node.children, depth + 1)}
            </ul>
          )}
        </li>
      );
    });
  }

  return (
    <div className="task-drawer" style={{ width: localWidth }}>
      <div
        className={`task-drawer-resizer${isResizing ? " is-resizing" : ""}`}
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize sidebar"
      />
      <div className="task-drawer-header">
        <span className="task-drawer-title">📋 Tasks</span>
        <button className="task-drawer-close" onClick={onClose} title="Close panel">
          ✕
        </button>
      </div>

      <div className="task-drawer-search">
        <input
          type="text"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="task-drawer-search-input"
        />
        <div className="task-drawer-filters" style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
          <button 
            className={`btn ${filterMode === "all" ? "active" : ""}`} 
            onClick={() => setFilterMode("all")}
            style={{ flex: "1 1 calc(50% - 4px)", fontSize: "0.75rem", padding: "4px" }}
          >
            All
          </button>
          <button 
            className={`btn ${filterMode === "today" ? "active" : ""}`} 
            onClick={() => setFilterMode("today")}
            style={{ flex: "1 1 calc(50% - 4px)", fontSize: "0.75rem", padding: "4px" }}
          >
            Today
          </button>
          <button 
            className={`btn ${filterMode === "next_week" ? "active" : ""}`} 
            onClick={() => setFilterMode("next_week")}
            style={{ flex: "1 1 calc(50% - 4px)", fontSize: "0.75rem", padding: "4px" }}
          >
            Next 7 Days
          </button>
          <button 
            className={`btn ${filterMode === "priority" ? "active" : ""}`} 
            onClick={() => {
              if (filterMode === "priority") {
                setPrioritySortDir((prev) => (prev === "asc" ? "desc" : "asc"));
              } else {
                setFilterMode("priority");
              }
            }}
            style={{ flex: "1 1 calc(50% - 4px)", fontSize: "0.75rem", padding: "4px" }}
            title="Sort tasks by priority (1 = most urgent). Click again to toggle order."
          >
            Priority{filterMode === "priority" ? (prioritySortDir === "asc" ? " ↑" : " ↓") : ""}
          </button>
        </div>
      </div>

      <ul className="task-drawer-list" style={{ paddingLeft: 0 }}>
        {isPriorityMode ? (
          prioritySortedTasks.length === 0 ? (
            <li className="task-drawer-empty" style={{ listStyle: "none" }}>No tasks found.</li>
          ) : (
            prioritySortedTasks.map((t) => (
              <li key={t.id} className="task-drawer-item-container" style={{ listStyle: "none" }}>
                <div
                  className={`task-drawer-item${t.done ? " task-drawer-item--done" : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, t.id)}
                  title={`${t.title} ${t.priority !== null ? `(Priority ${t.priority})` : "(No priority)"}`}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <span 
                    className="task-drawer-item-indicator" 
                    style={t.done ? undefined : (t.priority !== null ? { backgroundColor: getPriorityColor(t.priority) } : undefined)}
                  />
                  <span className="task-drawer-item-title">{t.title || "(untitled)"}</span>
                  {t.priority !== null && (
                    <span 
                      className="task-drawer-item-prio" 
                      style={{ 
                        fontSize: "0.72rem", 
                        padding: "1px 4px", 
                        borderRadius: "3px", 
                        background: "rgba(128,128,128,0.15)", 
                        color: "var(--text-muted)", 
                        marginRight: "4px",
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                    >
                      P{t.priority}
                    </span>
                  )}
                  {t.timeEstimateMinutes != null && (
                    <span className="task-drawer-item-est">
                      {t.timeEstimateMinutes}m
                    </span>
                  )}
                </div>
              </li>
            ))
          )
        ) : (
          <>
            {rootNodes.length === 0 && (
              <li className="task-drawer-empty" style={{ listStyle: "none" }}>No tasks found.</li>
            )}
            {renderTree(rootNodes)}
          </>
        )}
      </ul>
    </div>
  );
}

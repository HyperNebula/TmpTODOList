import { useRef, useState } from "react";
import type { Task, Timeblock } from "../../types/task";
import { useSettingsStore } from "../../store/settingsStore";

function toLocalIsoString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

interface TimeblockBlockProps {
  block: Timeblock;
  tasks: Task[];
  /** px per minute ratio used by the grid */
  pxPerMin: number;
  /** offset in minutes from midnight for the grid's start hour */
  gridStartMin: number;
  styleWidth?: number;
  styleLeft?: number;
  onUpdate: (id: string, updates: Partial<Omit<Timeblock, "id">>) => void;
  onEditTimeblock: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
}

/**
 * A single timeblock rendered as an absolute-positioned card on the time grid.
 * Supports:
 *  - Drag to reschedule (move the whole block)
 *  - Resize via bottom handle (changes endTime)
 *  - Click on ✕ to delete the block
 *  - Click on task chip ✕ to unassign that task
 */
export function TimeblockBlock({
  block,
  tasks,
  pxPerMin,
  gridStartMin,
  styleWidth,
  styleLeft,
  onUpdate,
  onEditTimeblock,
  onToggleComplete,
}: TimeblockBlockProps) {
  const { compactTimeblockDisplay, timeblockEditMode, showTimeblockTimes } = useSettingsStore();

  // ── Drag & Resize Local State ───────────────────────────────────────────────
  const dragStateRef = useRef<{ startStr?: string; endStr?: string; deltaX?: number } | null>(null);
  const [, setDragTick] = useState(0);

  const effectiveStart = dragStateRef.current?.startStr ?? block.startTime;
  const effectiveEnd = dragStateRef.current?.endStr ?? block.endTime;

  const startMin =
    (new Date(effectiveStart).getHours() * 60 +
      new Date(effectiveStart).getMinutes()) -
    gridStartMin;
  const endMin =
    (new Date(effectiveEnd).getHours() * 60 +
      new Date(effectiveEnd).getMinutes()) -
    gridStartMin;
  const durationMin = Math.max(endMin - startMin, 15);

  const top = startMin * pxPerMin + 2;
  const height = Math.max(durationMin * pxPerMin - 4, 22);

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const startTimeDisplay = timeFormatter.format(new Date(effectiveStart));
  const endTimeDisplay = timeFormatter.format(new Date(effectiveEnd));

  // ── Resize state ────────────────────────────────────────────────────────────
  const resizeRef = useRef<{ startY: number; origEndTime: string } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startY: e.clientY, origEndTime: block.endTime };
    setIsResizing(true);

    const onMove = (me: MouseEvent) => {
      if (!resizeRef.current) return;
      const deltaY = me.clientY - resizeRef.current.startY;
      const deltaMin = Math.round(deltaY / pxPerMin / 15) * 15; // snap to 15 min
      const origEnd = new Date(resizeRef.current.origEndTime);
      const newEnd = new Date(origEnd.getTime() + deltaMin * 60_000);
      // Don't let the block get shorter than 15 min
      const startMs = new Date(block.startTime).getTime();
      if (newEnd.getTime() - startMs >= 15 * 60_000) {
        dragStateRef.current = { endStr: toLocalIsoString(newEnd) };
        setDragTick(t => t + 1);
      }
    };

    const onUp = () => {
      if (dragStateRef.current?.endStr) {
        onUpdate(block.id, { endTime: dragStateRef.current.endStr });
      }
      dragStateRef.current = null;
      resizeRef.current = null;
      setIsResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── Drag-to-move state ──────────────────────────────────────────────────────
  const dragRef = useRef<{ startY: number; origStart: string; origEnd: string } | null>(null);

  function onBlockMouseDown(e: React.MouseEvent) {
    // Don't initiate move if clicking on a button or the resize handle
    if ((e.target as HTMLElement).closest(".tb-edit, .tb-complete-toggle, .tb-chip-remove, .tb-resize-handle")) return;
    e.preventDefault();
    const duration = new Date(block.endTime).getTime() - new Date(block.startTime).getTime();
    dragRef.current = { startY: e.clientY, origStart: block.startTime, origEnd: block.endTime };

    const origColEl = (e.target as HTMLElement).closest(".time-grid-col-body") as HTMLElement | null;

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaY = me.clientY - dragRef.current.startY;
      const deltaMin = Math.round(deltaY / pxPerMin / 5) * 5; // snap to 5 min
      const newStart = new Date(new Date(dragRef.current.origStart).getTime() + deltaMin * 60_000);

      let startStr = toLocalIsoString(newStart);
      let deltaX = 0;

      const elements = document.elementsFromPoint(me.clientX, me.clientY);
      const colEl = elements.find(el => el.classList.contains("time-grid-col-body")) as HTMLElement | undefined;
      if (colEl && colEl.dataset.date) {
        startStr = `${colEl.dataset.date}T${startStr.split("T")[1]}`;
        if (origColEl) {
          const origRect = origColEl.getBoundingClientRect();
          const newRect = colEl.getBoundingClientRect();
          deltaX = newRect.left - origRect.left;
        }
      }

      const parsedStart = new Date(startStr);
      const endStr = toLocalIsoString(new Date(parsedStart.getTime() + duration));

      dragStateRef.current = { startStr, endStr, deltaX };
      setDragTick(t => t + 1);
    };

    const onUp = () => {
      let didMove = false;
      if (dragStateRef.current) {
        didMove = true;
        const updates: Partial<Omit<Timeblock, "id">> = {};
        if (dragStateRef.current.startStr) updates.startTime = dragStateRef.current.startStr;
        if (dragStateRef.current.endStr) updates.endTime = dragStateRef.current.endStr;
        if (Object.keys(updates).length > 0) {
          onUpdate(block.id, updates);
        }
      }
      dragStateRef.current = null;
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      
      if (!didMove && timeblockEditMode === "singleClick") {
        onEditTimeblock(block.id);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const assignedTasks = block.taskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const hasCheckbox = assignedTasks.length > 0;
  const isShort = height <= 44;
  const isCompact = (styleWidth ?? 100) < 100;

  return (
    <div
      className={`timeblock-block${isResizing ? " timeblock-block--resizing" : ""}${block.completed ? " timeblock-block--completed" : ""}${hasCheckbox ? " timeblock-block--has-checkbox" : ""}${isShort ? " timeblock-block--short" : ""}${isCompact ? ` timeblock-block--compact timeblock-block--compact-${compactTimeblockDisplay}` : ""}${dragStateRef.current != null ? " timeblock-block--dragging" : ""}`}
      style={{
        top,
        height,
        minHeight: 22,
        left: styleLeft !== undefined ? `calc(${styleLeft}% + 4px)` : undefined,
        width: styleWidth !== undefined ? `calc(${styleWidth}% - 8px)` : undefined,
        transform: dragStateRef.current?.deltaX ? `translateX(${dragStateRef.current.deltaX}px)` : undefined,
        ...(block.color ? { backgroundColor: block.color } : {}),
        ...(block.completed ? { opacity: 0.6, filter: 'grayscale(0.8)' } : {})
      }}
      onMouseDown={onBlockMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => {
        if (timeblockEditMode === "doubleClick") onEditTimeblock(block.id);
      }}
    >
      {timeblockEditMode === "button" && (
        <button
          className="tb-edit"
          onClick={() => onEditTimeblock(block.id)}
          title="Edit timeblock"
          style={{ opacity: isHovered ? 0.7 : 0 }}
        >
          ✎
        </button>
      )}
      {assignedTasks.length > 0 && (
        <button
          className="tb-complete-toggle"
          onClick={(e) => { e.stopPropagation(); onToggleComplete(block.id, !block.completed); }}
          title={block.completed ? "Mark Incomplete" : "Mark Complete"}
        >
          {block.completed ? "☑" : "☐"}
        </button>
      )}

      {block.title && <div className="tb-title">{block.title}</div>}

      {showTimeblockTimes && (
        <div className="tb-time" style={{ fontSize: '0.7rem', opacity: 0.8, paddingRight: '20px' }}>
          {startTimeDisplay} - {endTimeDisplay}
        </div>
      )}

      {block.notes && (
        <div className="tb-notes" style={{ fontSize: '0.8rem', opacity: 0.8, margin: '2px 8px', whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: 0, flexShrink: 1 }}>
          {block.notes}
        </div>
      )}

      <div className="tb-tasks" style={{ justifyContent: 'flex-end', paddingBottom: '8px' }}>
        {assignedTasks.map((task) => (
          <div key={task.id} className={`tb-chip${task.done ? " tb-chip--done" : ""}`}>
            <span
              className="tb-chip-label"
              style={task.done ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
            >
              {task.title || "(untitled)"}
            </span>
          </div>
        ))}
      </div>

      <div
        className="tb-resize-handle"
        onMouseDown={onResizeMouseDown}
        title="Drag to resize"
      />
    </div>
  );
}

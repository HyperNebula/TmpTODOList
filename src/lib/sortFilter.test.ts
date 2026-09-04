import { describe, expect, it } from "vitest";
import { filterTasksTreeAware, sortTasksWithinTree } from "./sortFilter";
import { buildTree, flattenVisible } from "./treeUtils";
import { createTask, DEFAULT_FILTER } from "../types/task";

describe("sortFilter", () => {
  const tasks = [
    createTask({
      id: "p",
      title: "Parent",
      parentId: null,
      order: 0,
      priority: 3,
    }),
    createTask({
      id: "h",
      title: "High child",
      parentId: "p",
      order: 0,
      priority: 9,
    }),
    createTask({
      id: "l",
      title: "Low child",
      parentId: "p",
      order: 1,
      priority: 2,
    }),
  ];

  it("sorts siblings by priority descending", () => {
    const sorted = sortTasksWithinTree(tasks, {
      column: "priority",
      direction: "desc",
    });
    const tree = buildTree(sorted);
    const rows = flattenVisible(tree);
    const childRows = rows.filter((r) => r.depth === 1);
    expect(childRows[0].task.id).toBe("h");
    expect(childRows[1].task.id).toBe("l");
  });

  it("filters by priority min and keeps parent context", () => {
    const filtered = filterTasksTreeAware(tasks, {
      ...DEFAULT_FILTER,
      priorityMin: 5,
    });
    const ids = filtered.map((t) => t.id);
    expect(ids).toContain("p");
    expect(ids).toContain("h");
    expect(ids).not.toContain("l");
  });

  it("hides archived tasks by default", () => {
    const archived = tasks.map((t) =>
      t.id === "l" ? { ...t, archived: true } : t,
    );
    const filtered = filterTasksTreeAware(archived, DEFAULT_FILTER);
    expect(filtered.find((t) => t.id === "l")).toBeUndefined();
  });

  it("filters to tasks due today using dueAfter and dueBefore", () => {
    const today = "2026-09-04";
    const dated = [
      createTask({ id: "a", title: "Due today", dueDate: "2026-09-04", parentId: null, order: 0 }),
      createTask({ id: "b", title: "Due tomorrow", dueDate: "2026-09-05", parentId: null, order: 1 }),
      createTask({ id: "c", title: "No due date", dueDate: null, parentId: null, order: 2 }),
    ];
    const filtered = filterTasksTreeAware(dated, {
      ...DEFAULT_FILTER,
      dueAfter: today,
      dueBefore: today,
    });
    const ids = filtered.map((t) => t.id);
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
    // Tasks with no due date are excluded when a date filter is active
    expect(ids).not.toContain("c");
  });

  it("filters to tasks due within a 7-day window", () => {
    const dated = [
      createTask({ id: "a", title: "Due today", dueDate: "2026-09-04", parentId: null, order: 0 }),
      createTask({ id: "b", title: "Due in 3 days", dueDate: "2026-09-07", parentId: null, order: 1 }),
      createTask({ id: "c", title: "Due in 6 days", dueDate: "2026-09-10", parentId: null, order: 2 }),
      createTask({ id: "d", title: "Due in 10 days", dueDate: "2026-09-14", parentId: null, order: 3 }),
    ];
    const filtered = filterTasksTreeAware(dated, {
      ...DEFAULT_FILTER,
      dueAfter: "2026-09-04",
      dueBefore: "2026-09-10",
    });
    const ids = filtered.map((t) => t.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
    expect(ids).not.toContain("d");
  });
});

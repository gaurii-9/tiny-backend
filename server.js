const express = require("express");
const db = require("./database");

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Home endpoint (from original server.js)
app.get("/", (req, res) => {
  res.json({
    message: "Hello, World!"
  });
});

// About endpoint (from original server.js)
app.get("/about", (req, res) => {
  res.json({
    name: "Gauri",
    course: "Backend Basics"
  });
});

/**
 * GET /stats
 * Returns statistics about tasks using SQL aggregate queries.
 */
app.get("/stats", (req, res) => {
  try {
    const totalRow = db.prepare("SELECT COUNT(*) as total FROM tasks").get();
    const completedRow = db.prepare("SELECT COUNT(*) as completed FROM tasks WHERE done = 1").get();
    
    const total = totalRow.total;
    const completed = completedRow.completed;
    const pending = total - completed;

    res.json({
      total,
      completed,
      pending
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /tasks
 * Returns a list of tasks. Supports:
 * - ?search=xxx (filters by title using SQL LIKE)
 * - ?done=true|false (filters by done status)
 * - ?sort=title (sorts alphabetically by title)
 */
app.get("/tasks", (req, res) => {
  try {
    const { search, done, sort } = req.query;
    
    let query = "SELECT * FROM tasks";
    const params = [];
    const conditions = [];

    if (search !== undefined && search !== null) {
      conditions.push("title LIKE ?");
      params.push(`%${search}%`);
    }

    if (done !== undefined) {
      conditions.push("done = ?");
      params.push(done === "true" ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    if (sort === "title") {
      query += " ORDER BY title ASC";
    } else {
      query += " ORDER BY id ASC";
    }

    const rows = db.prepare(query).all(...params);
    
    // Map database 0/1 integers back to true/false booleans for the API response
    const tasks = rows.map(row => ({
      ...row,
      done: row.done === 1
    }));

    res.json(tasks);
  } catch (error) {
    console.error("Error retrieving tasks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /tasks/:id
 * Returns a single task by ID.
 */
app.get("/tasks/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!row) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({
      ...row,
      done: row.done === 1
    });
  } catch (error) {
    console.error("Error retrieving task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /tasks
 * Creates a new task.
 */
app.post("/tasks", (req, res) => {
  try {
    const { title, done } = req.body;

    // Validation: Missing or invalid title
    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }

    const isDone = done === true;
    const now = new Date().toISOString();

    const insertStmt = db.prepare(
      "INSERT INTO tasks (title, done, created_at, updated_at) VALUES (?, ?, ?, ?)"
    );
    const result = insertStmt.run(title, isDone ? 1 : 0, now, now);

    // Fetch the inserted task to return it
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
    
    res.status(201).json({
      ...row,
      done: row.done === 1
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /tasks/:id
 * Updates an existing task.
 */
app.put("/tasks/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    // Check if task exists
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: "Task not found" });
    }

    const { title, done } = req.body;

    // Validation: If title is present but invalid
    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
      return res.status(400).json({ error: "Title must be a non-empty string" });
    }

    // Validation: If done is present but not boolean
    if (done !== undefined && typeof done !== "boolean") {
      return res.status(400).json({ error: "Done must be a boolean" });
    }

    // Fall back to existing values if not provided in request body
    const finalTitle = title !== undefined ? title : existing.title;
    const finalDone = done !== undefined ? done : (existing.done === 1);
    const now = new Date().toISOString();

    const updateStmt = db.prepare(
      "UPDATE tasks SET title = ?, done = ?, updated_at = ? WHERE id = ?"
    );
    updateStmt.run(finalTitle, finalDone ? 1 : 0, now, id);

    const updatedRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);

    res.json({
      ...updatedRow,
      done: updatedRow.done === 1
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /tasks/:id
 * Deletes a task by ID.
 */
app.delete("/tasks/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    // Check if task exists
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: "Task not found" });
    }

    const deleteStmt = db.prepare("DELETE FROM tasks WHERE id = ?");
    deleteStmt.run(id);

    res.json({
      message: "Task deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
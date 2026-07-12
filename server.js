const express = require("express");

const app = express();
const PORT = 3000;

// Home endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Hello, World!"
  });
});

// About endpoint
app.get("/about", (req, res) => {
  res.json({
    name: "Gauri",
    course: "Backend Basics"
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
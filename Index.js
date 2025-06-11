import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AdminDashboard from "./AdminDashboard"; // Fixed import (no space, PascalCase)
import "./firebase-config"; // Renamed for clarity (adjust to your actual file name)

// Safely get the root element
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AdminDashboard />
    </BrowserRouter>
  </React.StrictMode>
);

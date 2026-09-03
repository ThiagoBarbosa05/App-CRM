import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeClientMonitoring } from "./lib/sentry";
import "./index.css";
import "./components/rich-text-editor/editor.css";

initializeClientMonitoring();

// Force refresh
console.log("App starting at:", new Date().toISOString());

createRoot(document.getElementById("root")!).render(<App />);

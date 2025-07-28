import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Force refresh
console.log("App starting at:", new Date().toISOString());

createRoot(document.getElementById("root")!).render(<App />);

/**
 * Application entry point.
 * Mounts the root React component into the DOM and imports global styles.
 */
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyStaticTheme, readStaticTheme } from "./staticPreferences";
import { registerStaticServiceWorker } from "./pwa";

applyStaticTheme(readStaticTheme(window.localStorage), document.documentElement);
registerStaticServiceWorker();
createRoot(document.getElementById("root")!).render(<App />);

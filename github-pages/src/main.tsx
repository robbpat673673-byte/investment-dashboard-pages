import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applyStaticTheme, readStaticTheme } from "./staticPreferences";

applyStaticTheme(readStaticTheme(window.localStorage), document.documentElement);
createRoot(document.getElementById("root")!).render(<App />);

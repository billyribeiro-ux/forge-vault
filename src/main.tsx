import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/roboto-flex";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

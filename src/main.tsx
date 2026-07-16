import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fontsource-variable/newsreader/index.css";
import "@fontsource-variable/instrument-sans/index.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/shell.css";
import "./styles/components.css";
import { App } from "./app/App";
import { StickyNoteWindow } from "./features/notes/StickyNoteWindow";
import { resolveStickyNoteId } from "./features/notes/stickyWindowRoute";

const windowLabel = "__TAURI_INTERNALS__" in window ? getCurrentWindow().label : "";
const stickyNoteId = resolveStickyNoteId(window.location.search, windowLabel);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {Number.isInteger(stickyNoteId) && stickyNoteId > 0
      ? <StickyNoteWindow id={stickyNoteId} />
      : <App />}
  </StrictMode>,
);

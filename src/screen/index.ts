// Screen: everything a person sees and does. Realizes design/surfaces/screen.html.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App, Fault } from "./app.tsx";
import "./screen.css";

export function mount(root: HTMLElement): void {
  createRoot(root).render(createElement(Fault, null, createElement(App)));
}

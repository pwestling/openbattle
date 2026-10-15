// Screen: everything a person sees and does. Realizes design/surfaces/screen.html.
// Scaffold only: the start page heading. The Screen build replaces this.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

export function mount(root: HTMLElement): void {
  createRoot(root).render(createElement("h1", null, "OpenBattle"));
}

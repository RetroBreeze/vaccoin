/** Stable native elements: frame updates never replace a focused button or input. */
export class MenuSurface {
  readonly root = document.createElement("section");
  readonly content = document.createElement("div");
  private nodes = new Map<string, HTMLElement>();
  private used = new Set<string>();
  private positions = new Map<HTMLElement, HTMLElement>();
  constructor(id: string, className = "") {
    this.root.id = id;
    this.root.className = `casino-ui menu-screen ${className}`;
    this.root.hidden = true;
    this.content.className = "menu-content";
    this.root.append(this.content);
    document.body.append(this.root);
  }
  begin() {
    this.root.hidden = false;
    this.used.clear();
    this.positions.clear();
  }
  hide() {
    this.root.hidden = true;
  }
  end() {
    for (const [key, node] of this.nodes) node.hidden = !this.used.has(key);
  }
  private place(node: HTMLElement, parent: HTMLElement) {
    const previous = this.positions.get(parent);
    const next = previous ? previous.nextSibling : parent.firstChild;
    if (next !== node) parent.insertBefore(node, next);
    this.positions.set(parent, node);
  }
  node<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    key: string,
    value = "",
    className = "",
    parent: HTMLElement = this.content,
  ): HTMLElementTagNameMap[K] {
    let node = this.nodes.get(key);
    if (!node) {
      node = document.createElement(tag);
      this.nodes.set(key, node);
    }
    this.place(node, parent);
    node.className = className;
    node.hidden = false;
    if (["p", "h1", "h2", "span"].includes(tag) && node.textContent !== value)
      node.textContent = value;
    this.used.add(key);
    return node as HTMLElementTagNameMap[K];
  }
  group(key: string, className = "menu-actions", parent?: HTMLElement) {
    return this.node("div", key, "", className, parent);
  }
  text(
    key: string,
    value: string,
    className = "menu-note",
    parent?: HTMLElement,
  ) {
    return this.node("p", key, value, className, parent);
  }
  heading(value: string, parent?: HTMLElement) {
    return this.node("h1", "heading", value, "", parent);
  }
  sound(parent?: HTMLElement) {
    const sound = document.getElementById("sound") as HTMLButtonElement;
    this.button("sound", sound, sound.textContent || "Sound on", parent);
    sound.setAttribute(
      "aria-label",
      sound.dataset.muted === "true" ? "Unmute sound" : "Mute sound",
    );
  }
  button(
    key: string,
    button: HTMLButtonElement,
    label: string,
    parent?: HTMLElement,
    primary = false,
  ) {
    if (!this.nodes.has(key)) {
      button.removeAttribute("style");
      this.nodes.set(key, button);
    }
    this.place(button, parent ?? this.content);
    button.className = primary ? "casino-button primary" : "casino-button";
    button.hidden = false;
    button.style.display = "";
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute("aria-label", label);
    this.used.add(key);
    return button;
  }
}

export function updateStandings(
  root: HTMLElement,
  entries: { rank: number; name: string; score: number; isPlayer?: boolean }[],
  empty: string,
) {
  // Only rebuild changed data, never on the animation clock. All remote text is textContent.
  const signature = JSON.stringify([entries, empty]);
  if (root.dataset.rows === signature) return;
  root.dataset.rows = signature;
  root.replaceChildren();
  if (!entries.length) {
    const message = document.createElement("p");
    message.className = "board-empty";
    message.textContent = empty;
    root.append(message);
    return;
  }
  for (const entry of entries) {
    const row = document.createElement("li");
    row.className = `standing${entry.isPlayer ? " is-player" : ""}${entry.rank === 1 ? " champion" : ""}`;
    for (const [className, text] of [
      ["standing-rank", String(entry.rank).padStart(2, "0")],
      ["standing-name", entry.name + (entry.isPlayer ? " [YOU]" : "")],
      ["standing-score", entry.score.toLocaleString("en-US")],
    ]) {
      const span = document.createElement("span");
      span.className = className;
      span.textContent = text;
      row.append(span);
    }
    root.append(row);
  }
}

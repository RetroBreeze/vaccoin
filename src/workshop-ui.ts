import { VacuumPreview } from "./vacuum-preview";
import { MenuSurface } from "./menu-surface";
import { COSMETICS } from "./workshop-state";
import type { Workshop } from "./workshop";
import type { UI } from "./ui";
/** Responsive shop; its 3D preview is an asset inside the native layout. */
export class WorkshopUI {
  open = false;
  selected = 0;
  private preview = new VacuumPreview();
  private panel = new MenuSurface("shop-menu");
  private canvas = document.createElement("canvas");
  private buttons = new Map<string, HTMLButtonElement>();
  constructor(
    private ui: UI,
    private workshop: Workshop,
    private toggle: (open: boolean) => void,
  ) {
    this.canvas.width = 620;
    this.canvas.height = 260;
    this.canvas.className = "shop-preview";
    this.canvas.setAttribute("aria-label", "Selected vacuum colour preview");
    for (const id of [
      "open",
      "back",
      "previous",
      "next",
      "buy",
      "sync",
      "cloud",
      "export",
    ]) {
      const button = document.createElement("button");
      button.id = `workshop-${id}`;
      button.className = "leaderboard-control";
      button.style.display = "none";
      document.body.append(button);
      this.buttons.set(id, button);
    }
    this.buttons.get("open")!.onclick = () => this.setOpen(true);
    this.buttons.get("back")!.onclick = () => this.setOpen(false);
    this.buttons.get("previous")!.onclick = () => {
      this.selected = (this.selected + COSMETICS.length - 1) % COSMETICS.length;
    };
    this.buttons.get("next")!.onclick = () => {
      this.selected = (this.selected + 1) % COSMETICS.length;
    };
    this.buttons.get("buy")!.onclick = () => {
      const c = COSMETICS[this.selected];
      void (this.workshop.progress.owned.includes(c.id)
        ? this.workshop.equip(c.id)
        : this.workshop.purchase(c.id));
    };
    this.buttons.get("sync")!.onclick = () => void this.workshop.sync();
    this.buttons.get("cloud")!.onclick = () => void this.workshop.useCloud();
    this.buttons.get("export")!.onclick = () =>
      void this.workshop.exportRecovery().then((data) => {
        const url = URL.createObjectURL(
          new Blob([data], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "vaccoin-shop-recovery.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
  }
  setOpen(open: boolean) {
    this.open = open;
    this.toggle(open);
    if (open) {
      this.selected = Math.max(
        0,
        COSMETICS.findIndex((c) => c.id === this.workshop.progress.equipped),
      );
      requestAnimationFrame(() => this.buttons.get("back")!.focus());
    } else requestAnimationFrame(() => this.buttons.get("open")!.focus());
  }
  draw(_visible: boolean, _results = false) {
    const p = this.panel;
    if (!this.open) {
      p.hide();
      return;
    }
    p.begin();
    const header = p.group("header", "shop-header");
    p.heading("Shop", header);
    p.text(
      "wallet",
      `${this.workshop.progress.wallet.toLocaleString("en-US")} COINS`,
      "wallet-badge",
      header,
    );
    const body = p.group("body", "shop-body");
    const display = p.group("display", "shop-display", body);
    const stage = p.group("stage", "shop-stage", display);
    const item = COSMETICS[this.selected];
    const owned = this.workshop.progress.owned.includes(item.id);
    const equipped = this.workshop.progress.equipped === item.id;
    p.button("previous", this.buttons.get("previous")!, "<", stage);
    const preview = p.group("preview", "shop-preview-frame", stage);
    if (this.canvas.parentElement !== preview) preview.append(this.canvas);
    const context = this.canvas.getContext("2d")!;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const ready = this.preview.draw(
      context,
      item,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    if (!ready)
      p.text(
        "preview-state",
        this.preview.state === "error"
          ? "3D preview unavailable"
          : "Loading 3D preview…",
        "menu-note",
        preview,
      );
    p.button("next", this.buttons.get("next")!, ">", stage);
    p.text(
      "index",
      `${this.selected + 1} / ${COSMETICS.length}`,
      "eyebrow",
      display,
    );
    const details = p.group("details", "shop-details", body);
    p.node("h2", "item", item.name, "shop-item", details);
    p.text(
      "cost",
      equipped
        ? "EQUIPPED"
        : owned
          ? "OWNED"
          : `${item.cost.toLocaleString("en-US")} COINS`,
      "wallet-badge",
      details,
    );
    const buy = p.button(
      "buy",
      this.buttons.get("buy")!,
      equipped
        ? "EQUIPPED"
        : owned
          ? "EQUIP COLOUR"
          : this.workshop.progress.wallet >= item.cost
            ? "BUY + EQUIP"
            : "NOT ENOUGH COINS",
      details,
      true,
    );
    buy.disabled =
      !this.workshop.ready ||
      equipped ||
      (!owned && this.workshop.progress.wallet < item.cost);
    p.text("status", this.workshop.status, "menu-note", details);
    const actions = p.group("actions", "menu-actions", details);
    if (this.workshop.conflict) {
      p.text(
        "conflict",
        "Local copy kept. Export before choosing cloud.",
        "menu-error",
        display,
      );
      p.button(
        "export",
        this.buttons.get("export")!,
        "EXPORT LOCAL COPY",
        actions,
      );
      p.button(
        "cloud",
        this.buttons.get("cloud")!,
        "USE CLOUD / ARCHIVE LOCAL",
        actions,
      );
    } else p.button("sync", this.buttons.get("sync")!, "SYNC NOW", actions);
    p.button("back", this.buttons.get("back")!, "BACK", actions);
    p.sound(actions);
    p.end();
  }
}

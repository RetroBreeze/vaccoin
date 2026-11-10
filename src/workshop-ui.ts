import { pixelText } from "./pixel-font";
import { COSMETICS } from "./workshop-state";
import type { Workshop } from "./workshop";
import type { UI } from "./ui";
import { titleLayout } from "./title-screen";
/** Canvas pixels with matching native controls for keyboard, touch and screen readers. */
export class WorkshopUI {
  open = false;
  selected = 0;
  private buttons = new Map<string, HTMLButtonElement>();
  constructor(
    private ui: UI,
    private workshop: Workshop,
    private toggle: (open: boolean) => void,
  ) {
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
        a.download = "vaccoin-workshop-recovery.json";
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
      this.buttons.get("back")!.focus();
    } else this.buttons.get("open")!.focus();
  }
  draw(visible: boolean, results = false) {
    for (const b of this.buttons.values()) b.style.display = "none";
    const { ctx: c, w } = this.ui,
      cx = w / 2,
      rect = (x: number, y: number, a: number, b: number, color: string) => {
        c.fillStyle = color;
        c.fillRect(Math.round(x), Math.round(y), Math.round(a), Math.round(b));
      };
    const text = (
      t: string,
      x: number,
      y: number,
      size = 2,
      color = "#fff2d2",
      align: "left" | "center" | "right" = "left",
    ) => pixelText(c, t, x, y, size, color, align);
    const button = (
      id: string,
      label: string,
      x: number,
      y: number,
      bw: number,
      bh = 36,
      enabled = true,
    ) => {
      const b = this.buttons.get(id)!;
      b.textContent = label;
      b.setAttribute("aria-label", label);
      b.disabled = !enabled;
      Object.assign(b.style, {
        display: "block",
        left: `${(x / w) * 100}%`,
        top: `${(y / 540) * 100}%`,
        width: `${(bw / w) * 100}%`,
        height: `${(bh / 540) * 100}%`,
      });
      rect(x + 3, y + 3, bw, bh, "#061924");
      rect(x, y, bw, bh, enabled ? "#28505d" : "#182f3d");
      rect(x, y, bw, 2, enabled ? "#8cf0d1" : "#55717c");
      text(
        label,
        x + bw / 2,
        y + (bh - 7) / 2,
        1,
        enabled ? "#fff2d2" : "#96b6c2",
        "center",
      );
    };
    if (!this.open) {
      if (results) {
        button("open", "VACUUM WORKSHOP", cx - 128, 480, 256, 30);
        text(this.workshop.status, cx, 519, 1, "#96b6c2", "center");
      }
      if (visible) {
        const g = titleLayout(w);
        button("open", "VACUUM WORKSHOP", g.left - 128, g.menuY + 98, 256, 32);
        text(
          this.workshop.status,
          g.left,
          g.menuY + 139,
          1,
          "#96b6c2",
          "center",
        );
      }
      return;
    }
    rect(0, 0, w, 540, "#0b2030");
    for (let y = 0; y < 540; y += 16) rect(0, y, w, 1, "#102a3a");
    text("VACUUM WORKSHOP", cx, 24, 3, "#ffcf58", "center");
    text(
      `${this.workshop.progress.wallet.toLocaleString("en-US")} COINS`,
      cx,
      64,
      3,
      "#ffcf58",
      "center",
    );
    text(
      "COSMETIC DESIGNS / SAME POWER. SAME GAME.",
      cx,
      96,
      1,
      "#96b6c2",
      "center",
    );
    const item = COSMETICS[this.selected],
      hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
    const owned = this.workshop.progress.owned.includes(item.id),
      equipped = this.workshop.progress.equipped === item.id;
    rect(cx - 155, 121, 310, 154, "#173849");
    rect(cx - 155, 271, 310, 4, "#295367");
    // Pixel preview shares the actual viewmodel palette and low-poly silhouette.
    rect(cx - 85, 231, 180, 16, "#0a202e");
    rect(cx - 39, 160, 112, 65, hex(item.dark));
    rect(cx - 45, 151, 112, 65, hex(item.body));
    rect(cx - 45, 144, 112, 14, hex(item.trim));
    rect(cx + 58, 176, 20, 43, hex(item.accent));
    rect(cx - 12, 130, 18, 14, hex(item.accent));
    rect(cx - 100, 167, 65, 44, hex(item.dark));
    rect(cx - 110, 162, 18, 54, hex(item.trim));
    rect(cx - 105, 174, 8, 30, hex(item.dark));
    for (let i = 0; i < 3; i++)
      rect(cx - 25 + i * 22, 168, 7, 29, hex(item.trim));
    text(
      `${this.selected + 1} / ${COSMETICS.length}`,
      cx,
      251,
      1,
      "#96b6c2",
      "center",
    );
    button("previous", "<", cx - 225, 177, 46, 46);
    button("next", ">", cx + 179, 177, 46, 46);
    text(item.name, cx, 291, 3, "#fff2d2", "center");
    text(
      equipped
        ? "EQUIPPED"
        : owned
          ? "OWNED"
          : `${item.cost.toLocaleString("en-US")} COINS`,
      cx,
      324,
      2,
      owned ? "#8cf0d1" : "#ffcf58",
      "center",
    );
    button(
      "buy",
      equipped
        ? "EQUIPPED"
        : owned
          ? "EQUIP DESIGN"
          : this.workshop.progress.wallet >= item.cost
            ? "BUY + EQUIP"
            : "NOT ENOUGH COINS",
      cx - 145,
      357,
      290,
      42,
      this.workshop.ready &&
        !equipped &&
        (owned || this.workshop.progress.wallet >= item.cost),
    );
    text(this.workshop.status.slice(0, 64), cx, 414, 1, "#96b6c2", "center");
    if (this.workshop.conflict) {
      text(
        "LOCAL COPY KEPT. EXPORT BEFORE CHOOSING CLOUD.",
        cx,
        437,
        1,
        "#ffcf58",
        "center",
      );
      button("export", "EXPORT LOCAL COPY", cx - 220, 460, 200, 34);
      button("cloud", "USE CLOUD / ARCHIVE LOCAL", cx + 20, 460, 200, 34);
      button("back", "BACK", cx - 90, 502, 180, 30);
    } else {
      button("sync", "SYNC NOW", cx - 200, 463, 180, 38);
      button("back", "BACK", cx + 20, 463, 180, 38);
    }
  }
}

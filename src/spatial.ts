// Static coins stay in their original buckets. State flags discard activated IDs.
export class SpatialHash {
  private cells = new Map<number, number[]>();
  constructor(readonly size = 4) {}
  private key(x: number, y: number, z: number) {
    return x + 128 + (y + 128) * 256 + (z + 128) * 65536;
  }
  clear() {
    this.cells.clear();
  }
  add(id: number, x: number, y: number, z: number) {
    const k = this.key(
      Math.floor(x / this.size),
      Math.floor(y / this.size),
      Math.floor(z / this.size),
    );
    let cell = this.cells.get(k);
    if (!cell) {
      cell = [];
      this.cells.set(k, cell);
    }
    cell.push(id);
  }
  query(x: number, y: number, z: number, r: number, out: number[]) {
    out.length = 0;
    const s = this.size;
    for (let a = Math.floor((x - r) / s); a <= Math.floor((x + r) / s); a++)
      for (let b = Math.floor((y - r) / s); b <= Math.floor((y + r) / s); b++)
        for (
          let c = Math.floor((z - r) / s);
          c <= Math.floor((z + r) / s);
          c++
        ) {
          const cell = this.cells.get(this.key(a, b, c));
          if (cell) for (let i = 0; i < cell.length; i++) out.push(cell[i]);
        }
  }
}

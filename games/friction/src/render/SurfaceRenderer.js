// Cached floor: uploads a texture only when the brush changes tiles.
export class SurfaceRenderer {
  constructor(scene) { this.scene = scene; this.key = 'lab-floor'; this.redraws = 0; }
  reset(field) {
    this.image?.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
    this.texture = this.scene.textures.createCanvas(this.key, Math.ceil(field.width), Math.ceil(field.height));
    this.context = this.texture.context;
    this.image = this.scene.add.image(0, 0, this.key).setOrigin(0).setDepth(-1);
    this.context.fillStyle = '#14232e'; this.context.fillRect(0, 0, field.width, field.height);
    for (let row = 0; row < field.rows; row++) for (let col = 0; col < field.cols; col++) this.drawTile(field, row, col);
    this.texture.refresh(); field.dirty.clear(); this.lastRefresh = 0; this.redraws++;
  }
  drawTile(field, row, col) {
    const x = col * 32, y = row * 32, mu = field.at(x + 16, y + 16), zone = field.zoneAt(x + 16, y + 16);
    const roughness = Math.log1p(mu * 3) / Math.log(10), ctx = this.context;
    const mix = (a, b) => Math.round(a + (b - a) * roughness);
    ctx.clearRect(x, y, 32, 32); ctx.fillStyle = '#14232e'; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = `rgb(${mix(42,28)},${mix(145,40)},${mix(129,52)})`; ctx.fillRect(x + 1, y + 1, 30, 30);
    ctx.fillStyle = `rgba(115,147,153,${.1 + roughness * .5})`;
    for (let n = 0; n < Math.floor(roughness * 25); n++) ctx.fillRect(x + 3 + (n * 13 + col * 7 + row * 3) % 26, y + 3 + (n * 7 + row * 11) % 26, 1.5, 1.5);
    if (mu < .2) { ctx.strokeStyle = '#72c9b62e'; ctx.beginPath(); ctx.moveTo(x + 6, y + 24); ctx.lineTo(x + 23, y + 7); ctx.stroke(); }
    if (zone) {
      const hex = zone.color.toString(16).padStart(6, '0'); ctx.fillStyle = `#${hex}33`; ctx.fillRect(x + 1, y + 1, 30, 30);
      if (zone.mode === 'fixed') { ctx.strokeStyle = `#${hex}a6`; ctx.beginPath(); ctx.moveTo(x + 3, y + 29); ctx.lineTo(x + 29, y + 3); ctx.stroke(); }
    }
  }
  update(field, time) {
    if (!field.dirty.size || time - this.lastRefresh < 50) return;
    for (const index of field.dirty) this.drawTile(field, Math.floor(index / field.cols), index % field.cols);
    field.dirty.clear(); this.texture.refresh(); this.lastRefresh = time; this.redraws++;
  }
}

import type { Game } from '../game/game';

export class Controls {
  private pointers = new Map<number, number>();
  private keys = new Set<string>();
  private enterDirection = 0;
  private buttons: HTMLButtonElement[] = [];

  constructor(private game: Game) {
    window.addEventListener('pointerup', this.releasePointer);
    window.addEventListener('pointercancel', this.releasePointer);
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    window.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if (['w', 's', 'arrowleft', 'arrowright', ' '].includes(key)) {
        event.preventDefault();
        if (key === ' ') { if (!event.repeat) { this.clear(); this.game.togglePause(); } return; }
        this.keys.add(key);
        this.sync();
      }
    });
    window.addEventListener('keyup', event => {
      this.keys.delete(event.key.toLowerCase());
      if (event.key === 'Enter') this.enterDirection = 0;
      this.sync();
    });
  }

  bind(button: HTMLButtonElement, direction: number): void {
    this.buttons.push(button);
    button.dataset.direction = String(direction);
    button.addEventListener('pointerdown', event => {
      if (this.game.status !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, direction);
      this.sync();
    });
    button.addEventListener('lostpointercapture', event => this.releasePointer(event));
    // A focused touch button can also be held with Enter for keyboard accessibility.
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.enterDirection = direction;
        this.sync();
      }
    });
    button.addEventListener('keyup', event => {
      if (event.key === 'Enter') {
        this.enterDirection = 0;
        this.sync();
      }
    });
  }

  private releasePointer = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.sync();
  };

  clear(): void {
    this.pointers.clear();
    this.keys.clear();
    this.enterDirection = 0;
    this.sync();
  }

  private sync(): void {
    const values = [...this.pointers.values()];
    const fill = values.includes(1) || this.keys.has('s') || this.enterDirection > 0;
    const drain = values.includes(-1) || this.keys.has('w') || this.enterDirection < 0;
    this.game.tankDirection = this.game.status === 'playing' ? Number(fill) - Number(drain) : 0;
    this.game.keyboardTilt = this.game.status === 'playing' ? Number(this.keys.has('arrowright')) - Number(this.keys.has('arrowleft')) : 0;
    for (const button of this.buttons) {
      const active = Number(button.dataset.direction) > 0 ? fill : drain;
      button.classList.toggle('held', active && this.game.status === 'playing');
      button.setAttribute('aria-pressed', String(active && this.game.status === 'playing'));
    }
  }
}

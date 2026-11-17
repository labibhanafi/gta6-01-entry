// Keyboard + mouse input. WASD drive/walk, mouse orbit (pointer lock on click,
// drag fallback), Shift run, Space jump/handbrake, F steal, E interact, R reload,
// 1-4 weapons, C camera, M mute, Esc/P pause, Enter start.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.dragging = false;
    this.firing = false;
    this.pressed = new Set(); // edge-triggered keys, consumed by the sim
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      } else if (this.dragging) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.firing = true;
        if (!this.locked && this.canvas) this.dragging = true;
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) {
        this.firing = false;
        this.dragging = false;
      }
    };
    this._onLock = () => {
      this.locked = document.pointerLockElement === this.canvas;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.firing = false;
      this.dragging = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('pointerlockchange', this._onLock);
    if (canvas) {
      canvas.addEventListener('click', () => {
        if (!this.locked && document.pointerLockElement !== canvas) {
          try { canvas.requestPointerLock(); } catch { /* drag fallback */ }
        }
      });
    }
  }

  // True once for the frame the key went down; callers consume via wasPressed.
  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  has(code) {
    return this.keys.has(code);
  }

  // Mouse deltas since last read, in pixels.
  takeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() {
    this.pressed.clear();
  }
}

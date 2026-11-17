// SOLMAR — keyboard + mouse input. WASD drive/move, mouse orbit camera
// (pointer lock on click, drag fallback), edge-triggered action keys.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();   // edge-triggered: consumed by takeActions
  let jumpEdge = false;        // Space edge, consumed by takeJump (survives takeActions)
  let mouseDX = 0, mouseDY = 0;
  let dragging = false;
  let firing = false;

  const KEYMAP = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'handbrake', // jump on foot, handbrake in car
  };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!keys.has(e.code)) pressed.add(e.code);
    if (e.code === 'Space') jumpEdge = true;
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) firing = true;
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch { /* fallback: drag */ }
    }
    dragging = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { mouseDX += e.movementX; mouseDY += e.movementY; }
    else if (dragging) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function has(code) { return keys.has(code); }

  return {
    get forward() { return has('KeyW') || has('ArrowUp'); },
    get back() { return has('KeyS') || has('ArrowDown'); },
    get left() { return has('KeyA') || has('ArrowLeft'); },
    get right() { return has('KeyD') || has('ArrowRight'); },
    get run() { return has('ShiftLeft') || has('ShiftRight'); },
    get handbrake() { return has('Space'); },
    get jumpPressed() { return jumpEdge; },
    takeJump() { const j = jumpEdge; jumpEdge = false; return j; },
    get firing() { return firing; },
    takeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    // one-shot actions, consumed once per frame
    takeActions() {
      const a = {
        steal: pressed.has('KeyF'),
        interact: pressed.has('KeyE'),
        reload: pressed.has('KeyR'),
        camera: pressed.has('KeyC'),
        mute: pressed.has('KeyM'),
        pause: pressed.has('Escape') || pressed.has('KeyP'),
        confirm: pressed.has('Enter') || pressed.has('Space'),
        weapon1: pressed.has('Digit1'),
        weapon2: pressed.has('Digit2'),
        weapon3: pressed.has('Digit3'),
        weapon4: pressed.has('Digit4'),
      };
      pressed.clear();
      return a;
    },
    clearPressed() { pressed.clear(); },
  };
}

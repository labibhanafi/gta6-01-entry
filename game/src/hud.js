// HUD: DOM bars/text/prompts plus a live canvas minimap (roads, beach,
// player arrow, traffic dots, cops, mission beacon). All updates are cheap
// DOM writes guarded by change checks where it matters.
import { WEAPONS, PLACES, SUN_COINS } from './config.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.minimap = this.el('minimap');
    this.mm = this.minimap ? this.minimap.getContext('2d') : null;
    this.feedEl = this.el('feed');
    this.feedItems = [];
    this.last = {};
  }

  setText(id, value) {
    if (this.last[id] === value) return;
    this.last[id] = value;
    const e = this.el(id);
    if (e) e.textContent = value;
  }

  setBar(id, pct, color) {
    const e = this.el(id);
    if (!e) return;
    const key = `${id}:${pct}:${color}`;
    if (this.last[key]) return;
    this.last[key] = true;
    e.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (color) e.style.background = color;
  }

  feed(text) {
    this.feedItems.unshift(text);
    if (this.feedItems.length > 4) this.feedItems.pop();
    if (this.feedEl) {
      this.feedEl.innerHTML = this.feedItems.map((t) => `<div>${t}</div>`).join('');
    }
  }

  showBanner(title, sub) {
    const b = this.el('banner');
    if (!b) return;
    this.setText('banner-title', title);
    this.setText('banner-sub', sub || '');
    b.hidden = false;
  }

  hideBanner() {
    const b = this.el('banner');
    if (b) b.hidden = true;
  }

  prompt(text) {
    this.setText('prompt', text || '');
  }

  update(dt, W) {
    const { state, player, missions, combat } = W;
    // vitals
    this.setText('hp-text', `${Math.max(0, Math.ceil(state.hp))}`);
    this.setBar('hp-bar', state.hp, state.hp > 50 ? '#7ec850' : state.hp > 25 ? '#e8a33c' : '#e5484d');
    this.setText('armor-text', state.armor > 0 ? `ARMOR ${Math.ceil(state.armor)}` : '');
    this.setBar('armor-bar', state.armor, '#35c4b5');
    this.setText('cash-text', `$${Math.floor(state.cash).toLocaleString('en-US')}`);
    // wanted stars
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    this.setText('stars', stars);
    const starsEl = this.el('stars');
    if (starsEl) starsEl.style.color = state.wanted > 0 ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    // weapon + ammo
    const def = WEAPONS[state.weapon];
    this.setText('gun-name', def.name.toUpperCase());
    if (def.mag === Infinity) {
      this.setText('ammo-mag', '—');
      this.setText('ammo-reserve', '');
    } else {
      this.setText('ammo-mag', `${state.mag[state.weapon]}`);
      this.setText('ammo-reserve', `/ ${state.ammo[state.weapon]}${combat && combat.reloading > 0 ? ' · RELOADING' : ''}`);
    }
    // speedometer
    const kmh = player.vehicle ? Math.abs(player.vehicle.speed) * 3.6 : 0;
    this.setText('speed', player.vehicle ? `${Math.round(kmh)} km/h` : '');
    this.setText('car-name', player.vehicle ? player.vehicle.def.name.toUpperCase() : '');
    // mission tracker
    this.setText('mission-text', state.missionText || 'Free roam — follow the gold beacon.');
    this.setText('coins-text', `☀ ${state.coins}/${SUN_COINS}`);
    // banner from the mission system
    if (missions && missions.bannerT > 0) {
      this.showBanner(missions.bannerText, '');
    } else {
      this.hideBanner();
    }
    // context prompt
    let prompt = '';
    if (!player.vehicle && W.nearCar) {
      prompt = W.nearCar.driver === 'traffic' ? 'F — STEAL CAR (jack the driver)' : 'F — GET IN CAR';
    } else if (!player.vehicle) {
      const nearGun = Math.hypot(player.pos.x - PLACES.gunshop.x, player.pos.z - PLACES.gunshop.z) < 12;
      const nearTaxi = Math.hypot(player.pos.x - PLACES.taxiStand.x, player.pos.z - PLACES.taxiStand.z) < 12;
      const nearPlaza = Math.hypot(player.pos.x - PLACES.plaza.x, player.pos.z - PLACES.plaza.z) < 16;
      const nearDocks = Math.hypot(player.pos.x - PLACES.docks.x, player.pos.z - PLACES.docks.z) < 14;
      if (nearGun) prompt = "E — MARLOW'S GUN LOCKER (buy weapon / ammo)";
      else if (nearTaxi) prompt = 'E — START TAXI JOB';
      else if (nearDocks) prompt = 'E — START COURIER JOB';
      else if (nearPlaza) prompt = 'E — START RAMPAGE';
    } else {
      prompt = 'F — EXIT CAR · SPACE — HANDBRAKE · C — CAMERA';
    }
    this.prompt(prompt);
    // damage vignette
    const vig = this.el('damage-vignette');
    if (vig) vig.style.opacity = state.hp < 100 ? String((100 - state.hp) / 130) : '0';
    // hitmarker
    const hm = this.el('hitmarker');
    if (hm) hm.style.opacity = combat && combat.hitmarkT > 0 ? '1' : '0';
    // minimap
    this.drawMinimap(W);
  }

  drawMinimap(W) {
    if (!this.mm) return;
    const g = this.mm;
    const w = this.minimap.width;
    const h = this.minimap.height;
    const S = w / 620; // world -310..310 -> canvas
    const X = (x) => (x + 310) * S;
    const Z = (z) => (z + 310) * S;
    g.clearRect(0, 0, w, h);
    // land + ocean + beach
    g.fillStyle = '#2a2f2a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d6f8f';
    g.fillRect(0, Z(282), w, h - Z(282));
    g.fillStyle = '#c9a86a';
    g.fillRect(0, Z(238), w, Z(282) - Z(238));
    // roads
    g.strokeStyle = 'rgba(200,200,200,0.5)';
    g.lineWidth = 2;
    const lines = [-262.5, -187.5, -112.5, -37.5, 37.5, 112.5, 187.5, 262.5];
    for (const l of lines) {
      g.beginPath(); g.moveTo(X(l), 0); g.lineTo(X(l), h); g.stroke();
      g.beginPath(); g.moveTo(0, Z(l)); g.lineTo(w, Z(l)); g.stroke();
    }
    // park + plaza
    g.fillStyle = '#3f6b35';
    g.fillRect(X(-179), Z(121), 58 * S, 58 * S);
    g.fillStyle = '#8a7a5a';
    g.beginPath(); g.arc(X(0), Z(0), 26 * S, 0, Math.PI * 2); g.fill();
    // mission beacon
    if (W.beaconPos) {
      g.fillStyle = '#ffd23e';
      g.beginPath(); g.arc(X(W.beaconPos.x), Z(W.beaconPos.z), 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd23e';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(X(W.beaconPos.x), Z(W.beaconPos.z), 10, 0, Math.PI * 2); g.stroke();
    }
    // traffic dots
    g.fillStyle = '#ffffff';
    for (const v of W.vehicles) {
      if (v.dead || v === W.player.vehicle) continue;
      g.fillRect(X(v.x) - 1.5, Z(v.z) - 1.5, 3, 3);
    }
    // cops: red/blue
    for (const v of W.police.cruisers) {
      g.fillStyle = '#4a90ff';
      g.beginPath(); g.arc(X(v.x), Z(v.z), 3.5, 0, Math.PI * 2); g.fill();
    }
    for (const c of W.police.cops) {
      if (!c.alive) continue;
      g.fillStyle = '#ff4444';
      g.fillRect(X(c.x) - 2, Z(c.z) - 2, 4, 4);
    }
    // player arrow
    const px = X(W.player.pos.x);
    const pz = Z(W.player.pos.z);
    g.save();
    g.translate(px, pz);
    g.rotate(Math.atan2(Math.sin(W.player.yaw), Math.cos(W.player.yaw)) * 0 + W.player.camYaw * 0);
    g.rotate(-W.player.yaw + Math.PI);
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.restore();
  }
}

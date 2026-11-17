// SOLMAR — HUD: health/armor bars, cash, wanted stars, weapon + ammo,
// speedometer, mission tracker, prompts, killfeed, banner, toasts, and the
// live canvas minimap (roads, player arrow, traffic, cops, mission marker).
import { WEAPONS, MISSIONS, PLACES } from './config.js';

export function createHud(state) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), cash: $('cash'), health: $('health-fill'), armor: $('armor-fill'),
    stars: $('stars'), missionTitle: $('mission-title'), missionText: $('mission-text'),
    missionSub: $('mission-sub'), weapon: $('weapon'), ammo: $('ammo'), speed: $('speed'),
    prompt: $('prompt'), crosshair: $('crosshair'), hitmark: $('hitmark'),
    killfeed: $('killfeed'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    banner: $('banner'), toast: $('toast'), vignette: $('vignette'),
    minimap: $('minimap'), status: $('status'),
  };
  const mm = el.minimap.getContext('2d');
  const feedLines = [];
  let toastTimer = 0, bannerTimer = 0, hitTimer = 0, lastFeed = '';
  let lastMissionKey = '';

  function starHtml(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < n ? '' : 'off'}">★</span>`;
    return s;
  }

  function drawMinimap(G) {
    const W = 190, C = W / 2, S = W / 620; // world 620 m -> 190 px
    mm.clearRect(0, 0, W, W);
    mm.fillStyle = '#0c1a2c'; mm.beginPath(); mm.arc(C, C, C, 0, Math.PI * 2); mm.fill();
    mm.save();
    mm.beginPath(); mm.arc(C, C, C, 0, Math.PI * 2); mm.clip();
    // sand + ocean
    mm.fillStyle = '#e8c98a'; mm.fillRect(0, C + 268 * S, W, 40);
    mm.fillStyle = '#1e6f8e'; mm.fillRect(0, C + 298 * S, W, 40);
    // roads
    mm.strokeStyle = '#5a6068'; mm.lineWidth = 5;
    const roads = [-262.5, -187.5, -112.5, -37.5, 37.5, 112.5, 187.5, 262.5];
    for (const r of roads) {
      mm.beginPath(); mm.moveTo(0, C + r * S); mm.lineTo(W, C + r * S); mm.stroke();
      mm.beginPath(); mm.moveTo(C + r * S, 0); mm.lineTo(C + r * S, W); mm.stroke();
    }
    const px = (x) => C + x * S, pz = (z) => C + z * S;
    const dot = (x, z, color, r = 3) => { mm.fillStyle = color; mm.beginPath(); mm.arc(px(x), pz(z), r, 0, Math.PI * 2); mm.fill(); };
    // mission marker
    const m = G.missions.currentTarget(G);
    if (m) {
      const pulse = 4 + Math.sin(G.state.time * 5) * 1.5;
      mm.fillStyle = '#ffd75e'; mm.beginPath(); mm.arc(px(m.x), pz(m.z), pulse + 2, 0, Math.PI * 2); mm.fill();
      mm.fillStyle = '#7a4d00'; mm.beginPath(); mm.arc(px(m.x), pz(m.z), 3, 0, Math.PI * 2); mm.fill();
    }
    // sun-coins
    mm.fillStyle = '#ffd75e';
    for (const c of G.city.coins) if (!c.taken) { mm.beginPath(); mm.arc(px(c.x), pz(c.z), 1.6, 0, Math.PI * 2); mm.fill(); }
    // traffic (white) and cops (red/blue)
    for (const car of G.vehicles.cars) {
      if (car.dead) continue;
      dot(car.x, car.z, car.police ? '#ff2244' : '#e8e8e8', car.police ? 4 : 2.5);
    }
    for (const cop of G.police.cops) if (cop.alive) dot(cop.x, cop.z, '#2244ff', 3);
    // player arrow
    const p = G.state.player;
    mm.save();
    mm.translate(px(p.x), pz(p.z));
    mm.rotate(Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)) * -1 + Math.PI);
    mm.fillStyle = '#ffffff';
    mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
    mm.restore();
    mm.restore();
    // ring
    mm.strokeStyle = 'rgba(255,255,255,0.4)'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(C, C, C - 1, 0, Math.PI * 2); mm.stroke();
  }

  return {
    show() { el.hud.classList.add('on'); },
    hide() { el.hud.classList.remove('on'); },
    announce(msg) { el.status.textContent = msg; },
    toast(msg) {
      el.toast.textContent = msg; el.toast.style.display = 'block';
      toastTimer = 3.2;
    },
    banner(title, sub) {
      el.bannerTitle.textContent = title; el.bannerSub.textContent = sub || '';
      el.banner.style.display = 'block'; bannerTimer = 3.6;
    },
    feed(msg) {
      feedLines.unshift(msg);
      if (feedLines.length > 5) feedLines.pop();
      el.killfeed.innerHTML = feedLines.map((l) => `<div>› ${l}</div>`).join('');
      lastFeed = msg;
    },
    hitmarker() { el.hitmark.style.display = 'block'; hitTimer = 0.12; },
    flashVignette() {
      el.vignette.style.opacity = '0.9';
      setTimeout(() => { el.vignette.style.opacity = '0'; }, 180);
    },
    setPrompt(text) {
      if (text) { el.prompt.textContent = text; el.prompt.style.display = 'block'; }
      else el.prompt.style.display = 'none';
    },
    update(dt, G) {
      const s = G.state;
      el.cash.textContent = `$${s.cash.toLocaleString('en-US')}`;
      el.health.style.width = `${Math.max(0, s.health)}%`;
      el.armor.style.width = `${Math.max(0, s.armor)}%`;
      el.stars.innerHTML = starHtml(s.wanted);
      const def = WEAPONS[s.weapon];
      el.weapon.textContent = def.name.toUpperCase();
      el.ammo.textContent = s.weapon === 'fists' ? '—' : (s.reloading > 0 ? 'RELOADING…' : `${s.mag[s.weapon]} / ${s.ammo[s.weapon]}`);
      const car = s.player.inCar ? G.vehicles.byId(s.player.carId) : null;
      const mph = car ? Math.round(Math.abs(car.speed) * 2.237) : 0;
      el.speed.innerHTML = s.player.inCar ? `${mph} <small>MPH</small>` : `${Math.round(s.player.speed * 2.237)} <small>MPH</small>`;
      el.crosshair.style.display = (!s.player.inCar && s.weapon !== 'fists') ? 'block' : 'none';
      // mission tracker
      const mi = s.missionIndex;
      if (s.storyComplete) {
        el.missionTitle.textContent = 'STORY COMPLETE';
        el.missionText.textContent = 'The Big One is done. Solmar Bay is yours — free roam, side jobs, sun-coins.';
        el.missionSub.textContent = `Earned $${s.stats.earned.toLocaleString()} · ${s.coins}/24 sun-coins`;
      } else if (mi < MISSIONS.length) {
        const m = MISSIONS[mi];
        el.missionTitle.textContent = `MISSION ${mi + 1}/6 — ${m.name}  ($${m.reward})`;
        const stepText = m.steps[Math.min(s.missionStage, m.steps.length - 1)];
        el.missionText.textContent = stepText;
        el.missionSub.textContent = s.sideJob ? `Side job: ${s.sideJob.name} — ${s.sideJob.timer.toFixed(0)}s left` : '';
      }
      if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) el.toast.style.display = 'none'; }
      if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) el.banner.style.display = 'none'; }
      if (hitTimer > 0) { hitTimer -= dt; if (hitTimer <= 0) el.hitmark.style.display = 'none'; }
      drawMinimap(G);
    },
  };
}

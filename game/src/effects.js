// SOLMAR — particles (skid, smoke, muzzle, explosion, sparks), screen shake.
import * as THREE from 'three';

export function createEffects(scene, camera) {
  const particles = [];
  const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const mats = {};
  function matFor(color) {
    if (!mats[color]) mats[color] = new THREE.MeshBasicMaterial({ color, transparent: true });
    return mats[color];
  }
  let shakeAmt = 0;
  let muzzleLight = null;

  function spawn(x, y, z, color, n, speed, life, up = 0.5, size = 1) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, matFor(color));
      m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      m.position.set(x, y, z);
      scene.add(m);
      particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed * up + 0.5,
        vz: (Math.random() - 0.5) * speed,
        life: life * (0.6 + Math.random() * 0.8), maxLife: life,
      });
    }
  }

  return {
    spawnSkid(x, z, heading) {
      spawn(x - Math.sin(heading) * 1.5, 0.25, z - Math.cos(heading) * 1.5, 0x666666, 2, 1.5, 0.5, 0.2, 0.9);
    },
    spawnSmoke(x, z, n = 6) {
      spawn(x, 1.2, z, 0x555555, n, 2.5, 1.4, 1.4, 1.6);
    },
    spawnSparks(x, z) {
      spawn(x, 1.2, z, 0xffc84a, 6, 6, 0.35, 0.8, 0.7);
    },
    spawnExplosion(x, z) {
      spawn(x, 1.2, z, 0xff7a2a, 22, 12, 0.9, 1.2, 1.8);
      spawn(x, 1.6, z, 0x444444, 14, 5, 1.8, 1.6, 2.2);
      spawn(x, 1.0, z, 0xffe27a, 10, 8, 0.5, 1.0, 1.4);
      if (!muzzleLight) {
        muzzleLight = new THREE.PointLight(0xff8a2a, 60, 40);
        scene.add(muzzleLight);
      }
      muzzleLight.position.set(x, 3, z);
      muzzleLight.intensity = 60;
    },
    spawnMuzzle(G) {
      const p = G.state.player;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      spawn(p.x + fx * 1.2, 1.5, p.z + fz * 1.2, 0xffe27a, 8, 4, 0.14, 0.4, 1.7);
      if (!muzzleLight) {
        muzzleLight = new THREE.PointLight(0xffe27a, 30, 18);
        scene.add(muzzleLight);
      }
      muzzleLight.position.set(p.x + fx * 1.4, 1.6, p.z + fz * 1.4);
      muzzleLight.intensity = 30;
    },
    spawnMuzzleAt(x, z, heading) {
      spawn(x + Math.sin(heading) * 1.0, 1.5, z + Math.cos(heading) * 1.0, 0xffe27a, 4, 4, 0.12, 0.4, 0.9);
    },
    shake(amount) { shakeAmt = Math.max(shakeAmt, amount); },
    step(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 2 * dt;
        p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
        p.mesh.rotation.x += dt * 3; p.mesh.rotation.y += dt * 2;
      }
      if (muzzleLight && muzzleLight.intensity > 0) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 260);
      if (shakeAmt > 0) {
        shakeAmt = Math.max(0, shakeAmt - dt * 1.8);
        camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.5;
        camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.4;
      }
    },
  };
}

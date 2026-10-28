/* Animated dynamic background for Bloxorz Ha Long Bay Edition.
 * Features living emerald water ripples, shimmering sunlight caustics,
 * drifting mountain mist layers, gently rocking red-sailed junk boats, and gliding sea birds. */
(() => {
  'use strict';

  function initDynamicBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0, height = 0;
    let animId = null;
    let startTime = performance.now();
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Load the base Ha Long Bay scenic image
    const bgImg = new Image();
    bgImg.src = '/static/v2/halong_bg.jpg';
    let imgLoaded = false;
    bgImg.onload = () => {
      imgLoaded = true;
    };

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Mist particle layers drifting at different depths
    const mistClouds = [
      { x: 0.15, y: 0.28, w: 0.45, h: 0.16, speed: 0.000028, alpha: 0.24 },
      { x: 0.55, y: 0.35, w: 0.55, h: 0.20, speed: 0.000035, alpha: 0.28 },
      { x: 0.05, y: 0.42, w: 0.65, h: 0.22, speed: 0.000042, alpha: 0.22 },
      { x: 0.60, y: 0.22, w: 0.40, h: 0.14, speed: 0.000020, alpha: 0.18 }
    ];

    // Flying sea birds gliding across the sky
    const birds = [
      { x: 0.20, y: 0.18, scale: 0.9, speedX: 0.000075, speedY: -0.000015, flapSpeed: 0.007, phase: 0 },
      { x: 0.24, y: 0.19, scale: 0.75, speedX: 0.000072, speedY: -0.000014, flapSpeed: 0.0075, phase: 0.8 },
      { x: 0.27, y: 0.21, scale: 0.65, speedX: 0.000070, speedY: -0.000013, flapSpeed: 0.008, phase: 1.6 },
      { x: 0.75, y: 0.14, scale: 0.55, speedX: -0.000055, speedY: 0.000008, flapSpeed: 0.006, phase: 2.2 },
      { x: 0.79, y: 0.15, scale: 0.45, speedX: -0.000052, speedY: 0.000009, flapSpeed: 0.0065, phase: 3.0 }
    ];

    // Traditional red-sailed junk boats on the water
    const boats = [
      {
        baseX: 0.71, baseY: 0.66,
        size: 58,
        driftAmpX: 0.012, driftSpeedX: 0.00035,
        bobAmp: 3.5, bobSpeed: 0.0016,
        rollAmp: 0.045, rollSpeed: 0.0019
      },
      {
        baseX: 0.63, baseY: 0.61,
        size: 38,
        driftAmpX: 0.008, driftSpeedX: 0.00028,
        bobAmp: 2.2, bobSpeed: 0.0018,
        rollAmp: 0.038, rollSpeed: 0.0022
      }
    ];

    function drawSunRays(t) {
      // Golden god-rays emanating from the morning sun near top-center
      const sunX = width * 0.42;
      const sunY = height * 0.11;
      const breath = 0.5 + Math.sin(t * 0.0008) * 0.18;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const rayCount = 7;
      for (let i = 0; i < rayCount; i++) {
        const angle = 0.82 + (i / (rayCount - 1)) * 0.95 + Math.sin(t * 0.0003 + i) * 0.03;
        const length = height * 0.85;
        const rayWidth = 0.09 + Math.sin(t * 0.0005 + i * 1.5) * 0.02;

        const grad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, length);
        grad.addColorStop(0, `rgba(255, 235, 175, ${0.16 * breath})`);
        grad.addColorStop(0.35, `rgba(255, 215, 140, ${0.08 * breath})`);
        grad.addColorStop(1, 'rgba(255, 200, 110, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.arc(sunX, sunY, length, angle - rayWidth, angle + rayWidth);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawWaterShimmer(t) {
      // Water covers roughly y = 0.42 * height downwards
      const waterTop = height * 0.42;
      const waterHeight = height - waterTop;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // 1. Shimmering sunlight trail on the water (column from sun to bottom)
      const sunColX = width * 0.43;
      const trailGrad = ctx.createLinearGradient(sunColX - 120, waterTop, sunColX + 120, height);
      trailGrad.addColorStop(0, 'rgba(255, 245, 210, 0.12)');
      trailGrad.addColorStop(0.5, 'rgba(255, 230, 160, 0.08)');
      trailGrad.addColorStop(1, 'rgba(255, 215, 140, 0.02)');
      ctx.fillStyle = trailGrad;
      ctx.beginPath();
      ctx.moveTo(sunColX - 25, waterTop);
      ctx.lineTo(sunColX + 25, waterTop);
      ctx.lineTo(sunColX + 220, height);
      ctx.lineTo(sunColX - 220, height);
      ctx.closePath();
      ctx.fill();

      // 2. Animated horizontal wavelets & caustics sparkles
      const numLines = 28;
      for (let i = 0; i < numLines; i++) {
        const rowProg = i / numLines;
        // Perspective compression: waves further away are tighter and thinner
        const y = waterTop + Math.pow(rowProg, 1.45) * waterHeight;
        const speed = (0.8 + rowProg * 0.6) * 0.0014;
        const waveLen = 90 + (1 - rowProg) * 110;
        const lineAlpha = (0.04 + rowProg * 0.10) * (0.7 + Math.sin(t * 0.0012 + i * 0.8) * 0.3);

        ctx.strokeStyle = `rgba(168, 245, 218, ${lineAlpha})`;
        ctx.lineWidth = 1.2 + rowProg * 1.6;

        ctx.beginPath();
        let first = true;
        for (let x = 0; x <= width; x += 35) {
          const wavePhase = (x / waveLen) + t * speed + Math.sin(x * 0.012 + i) * 0.5;
          const dy = Math.sin(wavePhase) * (1.2 + rowProg * 3.5);
          if (first) {
            ctx.moveTo(x, y + dy);
            first = false;
          } else {
            ctx.lineTo(x, y + dy);
          }
        }
        ctx.stroke();

        // Extra golden sparkles on the sunlight path
        const sparkleX = sunColX + Math.sin(t * 0.0015 + i * 2.3) * (60 + rowProg * 140);
        if (sparkleX > 0 && sparkleX < width) {
          const sSize = (1.5 + rowProg * 3.2) * (0.6 + Math.sin(t * 0.003 + i * 1.7) * 0.4);
          ctx.fillStyle = `rgba(255, 250, 220, ${0.28 + rowProg * 0.35})`;
          ctx.beginPath();
          ctx.arc(sparkleX, y, sSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawMist(t) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      mistClouds.forEach((cloud, idx) => {
        const drift = (t * cloud.speed + idx * 0.25) % 1.25 - 0.15;
        const cx = (cloud.x + drift) * width;
        const cy = cloud.y * height;
        const rw = cloud.w * width;
        const rh = cloud.h * height;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rw * 0.5);
        grad.addColorStop(0, `rgba(224, 240, 235, ${cloud.alpha})`);
        grad.addColorStop(0.5, `rgba(200, 225, 218, ${cloud.alpha * 0.45})`);
        grad.addColorStop(1, 'rgba(180, 215, 205, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw * 0.5, rh * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    function drawJunkBoat(boat, t) {
      // Boat rocking on waves & slow drift
      const driftX = Math.sin(t * boat.driftSpeedX) * (boat.driftAmpX * width);
      const bobY = Math.sin(t * boat.bobSpeed) * boat.bobAmp;
      const roll = Math.sin(t * boat.rollSpeed) * boat.rollAmp;

      const x = boat.baseX * width + driftX;
      const y = boat.baseY * height + bobY;
      const s = boat.size;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(roll);

      // Water ripple wake under hull
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const wakeAlpha = 0.22 + Math.sin(t * 0.002) * 0.08;
      ctx.strokeStyle = `rgba(185, 245, 225, ${wakeAlpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.14, s * 0.72, s * 0.10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Wooden hull shadow
      ctx.fillStyle = 'rgba(12, 28, 22, 0.42)';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.12, s * 0.52, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dark wooden hull
      ctx.fillStyle = '#2b1b11';
      ctx.beginPath();
      ctx.moveTo(-s * 0.46, s * 0.04);
      ctx.quadraticCurveTo(0, s * 0.16, s * 0.46, s * 0.04);
      ctx.lineTo(s * 0.38, -s * 0.03);
      ctx.quadraticCurveTo(0, s * 0.05, -s * 0.38, -s * 0.03);
      ctx.closePath();
      ctx.fill();

      // Main mast
      ctx.strokeStyle = '#1b120a';
      ctx.lineWidth = Math.max(1.5, s * 0.035);
      ctx.beginPath();
      ctx.moveTo(-s * 0.04, 0);
      ctx.lineTo(-s * 0.04, -s * 0.76);
      ctx.stroke();

      // Fore mast
      ctx.beginPath();
      ctx.moveTo(s * 0.22, 0);
      ctx.lineTo(s * 0.22, -s * 0.60);
      ctx.stroke();

      // Pleated terracotta batten sails (traditional Ha Long junk sail)
      const sailColor = '#b84628';
      const sailRib = '#782612';

      // Main sail
      ctx.fillStyle = sailColor;
      ctx.beginPath();
      ctx.moveTo(-s * 0.04, -s * 0.74);
      ctx.quadraticCurveTo(-s * 0.28, -s * 0.48, -s * 0.30, -s * 0.14);
      ctx.lineTo(-s * 0.04, -s * 0.08);
      ctx.closePath();
      ctx.fill();

      // Sail bamboo battens
      ctx.strokeStyle = sailRib;
      ctx.lineWidth = 1;
      for (let r = 1; r <= 3; r++) {
        const yProp = r / 4;
        ctx.beginPath();
        ctx.moveTo(-s * 0.04, -s * (0.74 - yProp * 0.66));
        ctx.lineTo(-s * (0.04 + yProp * 0.26), -s * (0.74 - yProp * 0.66 + 0.04));
        ctx.stroke();
      }

      // Fore sail
      ctx.fillStyle = '#a63c22';
      ctx.beginPath();
      ctx.moveTo(s * 0.22, -s * 0.58);
      ctx.quadraticCurveTo(s * 0.05, -s * 0.38, s * 0.03, -s * 0.12);
      ctx.lineTo(s * 0.22, -s * 0.06);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawBirds(t) {
      ctx.save();
      birds.forEach(bird => {
        // Move bird
        let bx = ((bird.x + t * bird.speedX) % 1.25);
        if (bx < -0.15) bx += 1.4;
        let by = bird.y + Math.sin(t * 0.001 + bird.phase) * 0.015;

        const screenX = bx * width;
        const screenY = by * height;
        const wingWing = Math.sin(t * bird.flapSpeed + bird.phase);

        ctx.strokeStyle = 'rgba(28, 38, 34, 0.75)';
        ctx.lineWidth = Math.max(1.2, 1.8 * bird.scale);
        ctx.lineCap = 'round';

        ctx.beginPath();
        // Left wing
        ctx.moveTo(screenX - 12 * bird.scale, screenY + wingWing * 4 * bird.scale);
        ctx.quadraticCurveTo(
          screenX - 6 * bird.scale, screenY - wingWing * 3 * bird.scale,
          screenX, screenY
        );
        // Right wing
        ctx.quadraticCurveTo(
          screenX + 6 * bird.scale, screenY - wingWing * 3 * bird.scale,
          screenX + 12 * bird.scale, screenY + wingWing * 4 * bird.scale
        );
        ctx.stroke();
      });
      ctx.restore();
    }

    function animate(now) {
      const t = now - startTime;

      ctx.clearRect(0, 0, width, height);

      // Draw base photo background scaled with cover aspect ratio
      if (imgLoaded) {
        const imgRatio = bgImg.naturalWidth / bgImg.naturalHeight;
        const screenRatio = width / height;
        let dw, dh, dx, dy;
        if (screenRatio > imgRatio) {
          dw = width;
          dh = width / imgRatio;
          dx = 0;
          dy = (height - dh) / 2;
        } else {
          dh = height;
          dw = height * imgRatio;
          dx = (width - dw) / 2;
          dy = 0;
        }
        ctx.drawImage(bgImg, dx, dy, dw, dh);
      }

      if (!reducedMotion) {
        drawSunRays(t);
        drawMist(t);
        drawWaterShimmer(t);
        drawBirds(t);
      }

      animId = requestAnimationFrame(animate);
    }

    // Start loop
    animId = requestAnimationFrame(animate);

    // Pause animation when tab is inactive to preserve CPU/GPU battery
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (animId) cancelAnimationFrame(animId);
        animId = null;
      } else if (!animId) {
        startTime = performance.now();
        animId = requestAnimationFrame(animate);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDynamicBackground);
  } else {
    initDynamicBackground();
  }
})();

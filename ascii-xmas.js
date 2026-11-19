/* KMnO4-zx — ASCII Christmas scene
   A few rotating 3D Christmas trees rendered as characters on a starry night:
   green→gold foliage, twinkling coloured lights, orbiting gift boxes, a pulsing
   star on each tree top, drifting snow. Companion to ascii-whale.js (daily mode).
   Plain canvas 2D, no dependencies. Exposes window.AsciiXmas.create(canvas, opts). */
(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  function hash3(x, y, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /* ---------- palettes & glyphs ---------- */

  // foliage glyph ramp, dark → bright (index 0..8); trunk glyphs at 9..11
  const GLYPHS = ".:;+x*%8@#H|";
  // 12 foliage colours (deep green → gold) + 3 trunk browns.
  // Alphas stay background-quiet (like the whale scene) so page text reads cleanly.
  const PALETTE = (() => {
    const stops = [[20, 64, 40], [36, 104, 58], [70, 156, 84], [128, 196, 98], [212, 206, 110], [244, 214, 120]];
    const out = [];
    for (let i = 0; i < 12; i++) {
      const u = (i / 11) * (stops.length - 1);
      const a = Math.floor(u), b = Math.min(a + 1, stops.length - 1), f = u - a;
      const r = Math.round(stops[a][0] + (stops[b][0] - stops[a][0]) * f);
      const g = Math.round(stops[a][1] + (stops[b][1] - stops[a][1]) * f);
      const bl = Math.round(stops[a][2] + (stops[b][2] - stops[a][2]) * f);
      out.push(`rgba(${r},${g},${bl},${((0.42 + 0.55 * (i / 11)) * 0.48).toFixed(3)})`);
    }
    out.push("rgba(122,92,64,0.32)", "rgba(146,110,78,0.42)", "rgba(96,72,50,0.28)");
    return out;
  })();
  const FOLIAGE_BUCKETS = 12;

  const LIGHT_RGB = [[255, 96, 80], [255, 209, 102], [120, 220, 255], [140, 255, 150], [255, 240, 220]];
  const LIGHT_GLYPHS = ["o", "*", "+"];
  const GIFT_STYLES = [
    { box: [214, 74, 64], ribbon: [255, 209, 102] },
    { box: [72, 116, 200], ribbon: [240, 244, 250] },
    { box: [58, 150, 96], ribbon: [255, 120, 100] }
  ];
  // light direction (from upper-left-front), normalised once
  const L = (() => {
    const x = -0.45, y = 0.78, z = -0.5, n = Math.hypot(x, y, z);
    return { x: x / n, y: y / n, z: z / n };
  })();

  /* ---------- geometry ---------- */

  // Unit cube surface points with a ribbon cross on every face.
  // Each point: x, y, z, nx, ny, nz, ribbon(0/1)
  const CUBE = (() => {
    const pts = [];
    const faces = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ];
    const grid = [-1, -0.5, 0, 0.5, 1];
    for (const [nx, ny, nz] of faces) {
      // two tangent axes for this face
      const tx = ny !== 0 || nz !== 0 ? 1 : 0;
      const ty = nx !== 0 || nz !== 0 ? 1 : 0;
      const tz = nx !== 0 || ny !== 0 ? 1 : 0;
      for (const u of grid) {
        for (const v of grid) {
          const ribbon = Math.abs(u) < 0.3 || Math.abs(v) < 0.3 ? 1 : 0;
          pts.push(nx + tx * u, ny + ty * v, nz + tz * (tx ? v : u), nx, ny, nz, ribbon);
        }
      }
    }
    return new Float32Array(pts);
  })();

  /**
   * Build one tree's foliage + trunk point cloud in local coordinates
   * (y up from the ground, base centre at origin). Interleaved stride 8:
   * x, y, z, nx, ny, nz, seed, kind(0 foliage / 1 trunk)
   */
  function buildTreePoints(Hf, R, trunkH, cw) {
    const pts = [];
    const tiers = [
      { base: trunkH, h: Hf * 0.46, r: R },
      { base: trunkH + Hf * 0.27, h: Hf * 0.46, r: R * 0.74 },
      { base: trunkH + Hf * 0.54, h: Hf * 0.46, r: R * 0.5 }
    ];
    const rings = 24;
    let seed = 1;
    for (const tier of tiers) {
      const slope = (tier.r / tier.h) * 0.75;
      const nl = Math.hypot(1, slope);
      for (let j = 0; j <= rings; j++) {
        const t = j / rings;
        const y = tier.base + t * tier.h;
        const r = tier.r * Math.pow(1 - t, 0.92);
        const n = Math.max(8, Math.round((TAU * r) / (cw * 0.5)));
        for (let k = 0; k < n; k++) {
          const h1 = hash3(k, j, seed++);
          const h2 = hash3(k + 7, j + 3, seed);
          const th = (k / n) * TAU + (h1 - 0.5) * 0.22;
          const rr = r * (1 + (h2 - 0.5) * 0.09);
          const ct = Math.cos(th), st = Math.sin(th);
          pts.push(
            ct * rr, y + (h1 - 0.5) * 2.6, st * rr,
            ct / nl, slope / nl, st / nl,
            h2, 0
          );
        }
      }
    }
    // trunk: a short cylinder
    const trunkR = Math.max(6, R * 0.07);
    const tn = Math.max(10, Math.round((TAU * trunkR) / (cw * 0.6)));
    for (let j = 0; j <= 5; j++) {
      const y = (j / 5) * trunkH;
      for (let k = 0; k < tn; k++) {
        const th = (k / tn) * TAU;
        const ct = Math.cos(th), st = Math.sin(th);
        pts.push(ct * trunkR, y, st * trunkR, ct, 0, st, hash3(k, j, 99), 1);
      }
    }
    return { data: new Float32Array(pts), tiers };
  }

  // Outermost foliage radius at a given height (tiers overlap).
  function radiusAt(tiers, y) {
    let best = 0;
    for (const tier of tiers) {
      if (y < tier.base || y > tier.base + tier.h) continue;
      const t = (y - tier.base) / tier.h;
      best = Math.max(best, tier.r * Math.pow(1 - t, 0.92));
    }
    return best;
  }

  // Lights spiralling up the outermost foliage surface.
  function buildLights(tiers, Hf, trunkH, count) {
    const lights = [];
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) / count;
      const y = trunkH + u * Hf * 0.96;
      const th = k * 2.39996323; // golden angle spiral
      const r = radiusAt(tiers, y) + 4;
      lights.push({
        x: Math.cos(th) * r, y, z: Math.sin(th) * r,
        color: k % LIGHT_RGB.length,
        glyph: LIGHT_GLYPHS[k % LIGHT_GLYPHS.length],
        phase: rand(0, TAU), freq: rand(0.7, 2.1), u
      });
    }
    return lights;
  }

  /* ---------- engine ---------- */

  class XmasEngine {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.statsEl = opts.statsEl || null;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.dpr = 1;
      this.width = 0; this.height = 0;
      this.cw = 12; this.ch = 18; this.cols = 0; this.rows = 0;
      this.fontFamily = "ui-monospace, Menlo, monospace";
      this.trees = [];
      this.gifts = [];
      this.snow = [];
      this.sparkles = [];
      this.meteors = [];
      this.meteorTimer = rand(0.8, 2);
      this.starKind = new Uint8Array(0);   // 0 none, 1 dot, 2 glyph star
      this.starPhase = new Float32Array(0);
      this.starFreq = new Float32Array(0);
      this.starGlyph = new Uint8Array(0);
      this.zbuf = new Float32Array(0);
      this.cellGlyph = new Uint8Array(0);
      this.cellColor = new Uint8Array(0);
      this.buckets = Array.from({ length: PALETTE.length }, () => []);
      this.time = 6.5;
      this.wind = 0;
      this.burst = 0;
      this.lightTotal = 0;
      this.raf = 0;
      this.last = 0;
      this.frameCount = 0;
      this.visible = true;
      this.disposed = false;
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

      this.frame = (now) => {
        const dt = clamp((now - this.last) / 1000, 0, 0.05);
        this.last = now;
        this.step(dt);
        this.render();
        this.raf = requestAnimationFrame(this.frame);
      };
      this.onMotion = () => {
        if (this.reducedMotion.matches) { cancelAnimationFrame(this.raf); this.render(); }
        else this.schedule();
      };
      this.onVisibility = () => this.schedule();
      this.onPointerMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x >= 0 && x <= rect.width) this.wind = ((x / rect.width) - 0.5) * 16;
      };
      this.onPointerDown = (e) => {
        if (this.reducedMotion.matches) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        this.burst = 1;
        for (let i = 0; i < 32; i++) {
          const roll = Math.random();
          this.sparkles.push({
            x, y,
            vx: rand(-110, 110), vy: rand(-170, -30),
            age: 0, life: rand(1.1, 2.0),
            glyph: roll < 0.55 ? "*" : roll < 0.8 ? "+" : roll < 0.92 ? "." : "o",
            color: LIGHT_RGB[i % LIGHT_RGB.length],
            g: 80
          });
        }
      };

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.schedule();
      });
      this.intersectionObserver.observe(canvas);
      this.reducedMotion.addEventListener("change", this.onMotion);
      document.addEventListener("visibilitychange", this.onVisibility);
      window.addEventListener("pointermove", this.onPointerMove, { passive: true });
      window.addEventListener("pointerdown", this.onPointerDown, { passive: true });

      const fam = getComputedStyle(canvas).fontFamily;
      if (fam) this.fontFamily = fam;
      this.resize();
      document.fonts?.load(`600 16px ${this.fontFamily}`).then(() => {
        if (!this.disposed && this.reducedMotion.matches) this.render();
      });
      this.schedule();
    }

    destroy() {
      this.disposed = true;
      cancelAnimationFrame(this.raf);
      this.resizeObserver.disconnect();
      this.intersectionObserver.disconnect();
      this.reducedMotion.removeEventListener("change", this.onMotion);
      document.removeEventListener("visibilitychange", this.onVisibility);
      window.removeEventListener("pointermove", this.onPointerMove);
      window.removeEventListener("pointerdown", this.onPointerDown);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const W = rect.width, H = rect.height;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = W; this.height = H;
      this.cw = clamp(Math.round(W / 124), 8, 13);
      this.ch = Math.round(this.cw * 1.45);
      this.cols = Math.ceil(W / this.cw);
      this.rows = Math.ceil(H / this.ch);
      this.canvas.width = Math.round(W * this.dpr);
      this.canvas.height = Math.round(H * this.dpr);

      const n = this.cols * this.rows;
      this.zbuf = new Float32Array(n);
      this.cellGlyph = new Uint8Array(n);
      this.cellColor = new Uint8Array(n);
      this.starKind = new Uint8Array(n);
      this.starPhase = new Float32Array(n);
      this.starFreq = new Float32Array(n);
      this.starGlyph = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const c = i % this.cols, r = (i / this.cols) | 0;
        const h = hash3(c, r, 7);
        this.starKind[i] = h < 0.008 ? 2 : h < 0.055 ? 1 : 0;
        this.starPhase[i] = hash3(c, r, 23) * TAU;
        this.starFreq[i] = 0.3 + hash3(c, r, 37) * 1.2;
        this.starGlyph[i] = hash3(c, r, 51) < 0.5 ? 0 : 1; // "+" or "*"
      }
      this.buildScene();
      if (this.reducedMotion.matches) this.render();
    }

    /** Lay out trees, gifts and snow for the current viewport. */
    buildScene() {
      const W = this.width, H = this.height;
      const base = clamp(Math.min(H * 0.52, W * 0.3), 200, 470);
      // [offsetX fraction, depth z, size, rotation speed]
      // Trees frame the page from the edges — the middle stays clear for text.
      let specs;
      if (W >= 920) {
        specs = [
          [-0.36, 130, 1.15, 0.22],
          [0.44, 210, 0.95, -0.18]
        ];
      } else if (W >= 640) {
        specs = [[-0.32, 120, 0.95, 0.24], [0.34, 60, 0.75, -0.2]];
      } else {
        specs = [[0, 0, 1.0, 0.26]];
      }
      this.trees = [];
      this.gifts = [];
      this.lightTotal = 0;
      specs.forEach(([fx, oz, m, speed], ti) => {
        const Hf = base * m;
        const R = Hf * 0.42;
        const trunkH = Hf * 0.08;
        const { data, tiers } = buildTreePoints(Hf, R, trunkH, this.cw);
        const lightCount = Math.round(50 * m) + 8;
        const lights = buildLights(tiers, Hf, trunkH, lightCount);
        this.lightTotal += lightCount;
        const tree = {
          ox: W * fx, oz, m, speed,
          angle: rand(0, TAU),
          Hf, R, trunkH, data, lights,
          starPhase: rand(0, TAU)
        };
        // red apples hanging on the branches (own spiral, offset from lights)
        tree.apples = [];
        const appleCount = Math.round(10 * m) + 4;
        for (let k = 0; k < appleCount; k++) {
          const u = 0.08 + 0.84 * ((k + 0.3) / appleCount);
          const y = trunkH + u * Hf;
          const th = k * 2.39996323 + 1.3;
          const r = radiusAt(tiers, y) + 5;
          tree.apples.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
        }
        // colourful wreath crowning the tree top, just below the star
        tree.wreath = [];
        const wy = trunkH + Hf * 0.86;
        const wr = radiusAt(tiers, wy) * 1.05 + 6;
        const wtilt = 0.4, WN = 18;
        for (let k = 0; k < WN; k++) {
          const phi = (k / WN) * TAU;
          tree.wreath.push({
            x: Math.cos(phi) * wr,
            y: wy + Math.sin(phi) * wr * Math.sin(wtilt) * 0.5,
            z: Math.sin(phi) * wr * Math.cos(wtilt),
            color: k % LIGHT_RGB.length,
            glyph: LIGHT_GLYPHS[k % LIGHT_GLYPHS.length],
            phase: rand(0, TAU)
          });
        }
        this.trees.push(tree);
        // two mini gifts hanging on the branches (rotate with the tree)
        for (let g = 0; g < 2; g++) {
          const u = 0.3 + 0.34 * g;
          const y = trunkH + u * Hf;
          const th = rand(0, TAU);
          const r = radiusAt(tiers, y) + 7;
          this.gifts.push({
            tree: ti, orbit: false, local: true,
            lx: Math.cos(th) * r, ly: y, lz: Math.sin(th) * r,
            s: clamp(10 * m, 7, 11),
            spin: rand(0, TAU), spinSpeed: rand(0.2, 0.45),
            style: (ti + g + 1) % GIFT_STYLES.length
          });
        }
        // three gifts orbiting each tree + one resting at its base
        const orbiters = 3;
        for (let g = 0; g < orbiters; g++) {
          this.gifts.push({
            tree: ti, orbit: true,
            orbitR: R * (1.25 + 0.18 * g) + 12,
            orbitA: rand(0, TAU),
            orbitSpeed: (g % 2 === 0 ? 1 : -1) * rand(0.3, 0.6),
            height: trunkH + Hf * (0.2 + 0.6 * ((g + 0.5) / orbiters)),
            s: clamp(16 * m, 10, 18),
            spin: rand(0, TAU), spinSpeed: rand(0.6, 1.1),
            style: (ti + g) % GIFT_STYLES.length
          });
        }
        // one gift circling the trunk at ground level
        this.gifts.push({
          tree: ti, orbit: true,
          orbitR: R * 0.95,
          orbitA: rand(0, TAU),
          orbitSpeed: (ti % 2 === 0 ? 1 : -1) * rand(0.25, 0.4),
          height: 0,
          s: clamp(14 * m, 9, 16),
          spin: rand(0, TAU), spinSpeed: rand(0.4, 0.7),
          style: (ti + 2) % GIFT_STYLES.length
        });
      });
      // snow
      const count = clamp(Math.round((W * H) / 9000), 70, 260);
      this.snow = [];
      for (let i = 0; i < count; i++) {
        const z = rand(0.35, 1);
        const roll = Math.random();
        this.snow.push({
          x: rand(0, W), y: rand(0, H), z,
          speed: rand(16, 40) * z,
          drift: rand(5, 16), phase: rand(0, TAU),
          glyph: roll < 0.6 ? "." : roll < 0.8 ? "*" : roll < 0.92 ? "+" : "o",
          alpha: 0.2 + 0.55 * z
        });
      }
      this.sparkles = [];
      this.meteors = [];
    }

    schedule() {
      cancelAnimationFrame(this.raf);
      if (this.disposed || !this.visible || document.hidden || this.reducedMotion.matches) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }

    step(dt) {
      this.time += dt;
      this.burst = Math.max(0, this.burst - dt * 1.1);
      for (const tree of this.trees) tree.angle += tree.speed * dt;
      for (const g of this.gifts) {
        if (g.orbit) g.orbitA += g.orbitSpeed * dt;
        g.spin += g.spinSpeed * dt;
      }
      const H = this.height, W = this.width;
      for (const f of this.snow) {
        f.y += f.speed * dt;
        f.x += (Math.sin(this.time * 0.6 + f.phase) * f.drift + this.wind * f.z) * dt;
        if (f.y > H + 8) { f.y = -8; f.x = rand(0, W); }
        if (f.x > W + 8) f.x = -8;
        else if (f.x < -8) f.x = W + 8;
      }
      for (let i = this.sparkles.length - 1; i >= 0; i--) {
        const s = this.sparkles[i];
        s.age += dt;
        if (s.age >= s.life) { this.sparkles.splice(i, 1); continue; }
        s.vy += s.g * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      // shooting stars: a few streaks across the night sky now and then
      this.meteorTimer -= dt;
      if (this.meteorTimer <= 0) {
        const n = Math.random() < 0.3 ? 2 : 1;
        for (let i = 0; i < n; i++) this.spawnMeteor();
        this.meteorTimer = rand(2, 4.5);
      }
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.age += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        // shed a few sparkle particles along the path, click-burst style
        m.emit -= dt;
        if (m.emit <= 0 && m.age < m.life * 0.9 && this.sparkles.length < 600) {
          m.emit += 0.018;
          const v = Math.hypot(m.vx, m.vy) || 1;
          const ux = m.vx / v, uy = m.vy / v;
          const roll = Math.random();
          const warm = Math.random() < 0.5;
          this.sparkles.push({
            x: m.x + rand(-3, 3), y: m.y + rand(-3, 3),
            vx: -ux * rand(10, 40) + rand(-22, 22),
            vy: -uy * rand(10, 40) + rand(-18, 18),
            age: 0, life: rand(1.2, 2.0), g: 25,
            glyph: roll < 0.55 ? "*" : roll < 0.8 ? "+" : roll < 0.92 ? "." : "o",
            color: warm ? [255, 214, 130] : LIGHT_RGB[(Math.random() * LIGHT_RGB.length) | 0]
          });
        }
        if (m.age >= m.life || m.x < -200 || m.x > W + 200 || m.y > H + 200) {
          this.meteors.splice(i, 1);
        }
      }
    }

    spawnMeteor() {
      const W = this.width, H = this.height;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const ang = rand(0.3, 0.6); // shallow downward angle
      const speed = rand(300, 480); // slow enough to admire
      this.meteors.push({
        x: dir > 0 ? rand(-0.05 * W, 0.5 * W) : rand(0.5 * W, 1.05 * W),
        y: rand(0.03 * H, 0.32 * H),
        vx: Math.cos(ang) * speed * dir,
        vy: Math.sin(ang) * speed,
        age: 0, life: rand(1.5, 2.4),
        emit: 0
      });
    }

    /* ---------- rendering ---------- */

    render() {
      const { ctx, dpr, cols, rows, cw, ch, width: W, height: H } = this;
      if (!cols) return;
      const t = this.time;
      const GY = H * 0.9;                 // ground line (screen px)
      const D = 1400, F = 1250;           // camera distance / focal length
      const cx = W / 2;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      this.drawStars(t);
      this.drawMeteors();
      this.drawGround(t, GY);

      // rasterise trees into the character z-buffer
      this.zbuf.fill(Infinity);
      const fontPx = Math.round(ch * 0.74);
      for (const tree of this.trees) this.splatTree(tree, GY, D, F, cx);
      ctx.font = `600 ${fontPx}px ${this.fontFamily}`;
      this.drawTreeCells();

      this.drawGifts(t, GY, D, F, cx);
      this.drawLights(t, GY, D, F, cx, fontPx);
      this.drawApples(t, GY, D, F, cx, fontPx);
      this.drawWreaths(t, GY, D, F, cx, fontPx);
      this.drawTreeStars(t, GY, D, F, cx, fontPx);
      this.drawSnow();
      this.drawSparkles();

      if (this.statsEl && ++this.frameCount % 6 === 0) {
        const main = this.trees.reduce((a, b) => (b.m > a.m ? b : a), this.trees[0]);
        const deg = (((main.angle * 180 / Math.PI) % 360) + 360) % 360;
        this.statsEl.textContent = `rotation ${deg.toFixed(2)}° + lights: ${this.lightTotal}`;
      }
    }

    drawStars(t) {
      const { ctx, cols, rows, cw, ch, starKind, starPhase, starFreq, starGlyph } = this;
      const n = cols * rows;
      ctx.font = `600 ${Math.round(ch * 0.6)}px ${this.fontFamily}`;
      for (let i = 0; i < n; i++) {
        const kind = starKind[i];
        if (!kind) continue;
        const tw = 0.5 + 0.5 * Math.sin(t * starFreq[i] + starPhase[i]);
        const c = i % cols, r = (i / cols) | 0;
        const x = c * cw + cw / 2, y = r * ch + ch / 2;
        if (kind === 1) {
          ctx.fillStyle = `rgba(196,218,246,${(0.14 + 0.4 * tw).toFixed(3)})`;
          const s = tw > 0.75 ? 2 : 1;
          ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
        } else {
          ctx.fillStyle = `rgba(222,236,252,${(0.2 + 0.55 * tw).toFixed(3)})`;
          ctx.fillText(starGlyph[i] ? "*" : "+", x, y);
        }
      }
    }

    drawMeteors() {
      const { ctx, ch } = this;
      if (!this.meteors.length) return;
      for (const m of this.meteors) {
        const a = Math.sin(Math.PI * clamp(m.age / m.life, 0, 1));
        // bright yellow head with a shining halo; the tail is sparkle
        // particles shed along the path (drawn with the click burst)
        const halo = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 13);
        halo.addColorStop(0, `rgba(255,220,130,${(a * 0.4).toFixed(3)})`);
        halo.addColorStop(1, "rgba(255,220,130,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(m.x - 13, m.y - 13, 26, 26);
        ctx.font = `700 ${Math.round(ch * 0.95)}px ${this.fontFamily}`;
        ctx.fillStyle = `rgba(255,236,170,${a.toFixed(3)})`;
        ctx.fillText("*", m.x, m.y);
      }
    }

    drawGround(t, GY) {
      const { ctx, cols, rows, cw, ch, width: W } = this;
      // soft glow under each tree
      for (const tree of this.trees) {
        const s = 1250 / (1400 + tree.oz);
        const x = W / 2 + tree.ox * s;
        const rad = tree.R * s * 1.7;
        const grad = ctx.createRadialGradient(x, GY, 0, x, GY, rad);
        grad.addColorStop(0, "rgba(120,200,130,0.07)");
        grad.addColorStop(1, "rgba(120,200,130,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - rad, GY - rad * 0.4, rad * 2, rad * 0.9);
      }
      // dim snowy ground: sparse blue-grey / green characters
      ctx.font = `600 ${Math.round(ch * 0.66)}px ${this.fontFamily}`;
      const r0 = Math.max(0, Math.floor(GY / ch));
      const glyphs = ".-~:";
      for (let r = r0; r < rows; r++) {
        const depth = (r - r0) / Math.max(1, rows - r0);
        for (let c = 0; c < cols; c++) {
          const h = hash3(c, r, 131);
          if (h > 0.3) continue;
          const shimmer = 0.03 * Math.sin(t * 0.8 + c * 0.3 + r);
          const a = 0.045 + 0.1 * depth + shimmer;
          const green = hash3(c, r, 137) < 0.4;
          ctx.fillStyle = green
            ? `rgba(96,158,116,${a.toFixed(3)})`
            : `rgba(122,152,190,${a.toFixed(3)})`;
          ctx.fillText(glyphs[(h * 40 | 0) % 4], c * cw + cw / 2, r * ch + ch / 2);
        }
      }
    }

    splatTree(tree, GY, D, F, cx) {
      const { cw, ch, cols, rows, zbuf, cellGlyph, cellColor } = this;
      const data = tree.data;
      const ca = Math.cos(tree.angle), sa = Math.sin(tree.angle);
      const dim = 0.72 + 0.28 * tree.m;
      for (let i = 0; i < data.length; i += 8) {
        const x = data[i], y = data[i + 1], z = data[i + 2];
        const xr = x * ca - z * sa;
        const zr = x * sa + z * ca;
        const depth = D + tree.oz + zr;
        if (depth < 80) continue;
        const s = F / depth;
        const sx = cx + (tree.ox + xr) * s;
        const sy = GY - y * s;
        const c = Math.floor(sx / cw), r = Math.floor(sy / ch);
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const ci = r * cols + c;
        if (depth >= zbuf[ci]) continue;
        // rotating normal → moving light across the foliage
        const nx = data[i + 3] * ca - data[i + 5] * sa;
        const nz = data[i + 3] * sa + data[i + 5] * ca;
        const ny = data[i + 4];
        const lum = clamp(0.2 + 0.8 * Math.max(0, nx * L.x + ny * L.y + nz * L.z), 0, 1);
        const seed = data[i + 6];
        const kind = data[i + 7];
        zbuf[ci] = depth;
        if (kind === 1) {
          cellGlyph[ci] = 9 + ((seed * 3) | 0);
          cellColor[ci] = FOLIAGE_BUCKETS + ((seed * 3) | 0);
        } else {
          const jitter = ((seed * 3) | 0) - 1;
          cellGlyph[ci] = clamp(Math.floor(lum * 8.99) + jitter, 0, 8);
          cellColor[ci] = clamp(Math.floor(lum * dim * 11.99), 0, 11);
        }
      }
    }

    drawTreeCells() {
      const { ctx, cols, cw, ch, cellGlyph, cellColor, buckets } = this;
      for (const b of buckets) b.length = 0;
      const n = cols * this.rows;
      for (let i = 0; i < n; i++) {
        if (this.zbuf[i] === Infinity) continue;
        buckets[cellColor[i]].push(i);
      }
      for (let b = 0; b < buckets.length; b++) {
        const bucket = buckets[b];
        if (!bucket.length) continue;
        ctx.fillStyle = PALETTE[b];
        for (const i of bucket) {
          ctx.fillText(GLYPHS[cellGlyph[i]], (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2 + 1);
        }
      }
    }

    drawGifts(t, GY, D, F, cx) {
      const { ctx, cw, ch, cols, rows, zbuf } = this;
      ctx.font = `600 ${Math.round(ch * 0.7)}px ${this.fontFamily}`;
      const tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
      for (const g of this.gifts) {
        const tree = this.trees[g.tree];
        let wx, wz, wy;
        if (g.local) {
          // hanging on a branch: rides the tree's rotation
          const ca = Math.cos(tree.angle), sa = Math.sin(tree.angle);
          wx = tree.ox + g.lx * ca - g.lz * sa;
          wz = tree.oz + g.lx * sa + g.lz * ca;
          wy = g.ly;
        } else {
          // orbiting the tree (high flyers + the ground-level trunk circler)
          wx = tree.ox + Math.cos(g.orbitA) * g.orbitR;
          wz = tree.oz + Math.sin(g.orbitA) * g.orbitR;
          wy = g.height + g.s;
        }
        const cs = Math.cos(g.spin), ss = Math.sin(g.spin);
        const style = GIFT_STYLES[g.style];
        const boxStyles = [0.34, 0.52, 0.7].map(a => `rgba(${style.box[0]},${style.box[1]},${style.box[2]},${a})`);
        const ribStyles = [0.45, 0.64, 0.8].map(a => `rgba(${style.ribbon[0]},${style.ribbon[1]},${style.ribbon[2]},${a})`);
        for (let i = 0; i < CUBE.length; i += 7) {
          const px = CUBE[i] * g.s, py = CUBE[i + 1] * g.s, pz = CUBE[i + 2] * g.s;
          // spin around Y, then a fixed tilt around X
          const x1 = px * cs - pz * ss;
          const z1 = px * ss + pz * cs;
          const y1 = py * ct - z1 * st;
          const z2 = py * st + z1 * ct;
          const depth = D + wz + z2;
          if (depth < 80) continue;
          const s = F / depth;
          const sx = cx + (wx + x1) * s;
          const sy = GY - (wy + y1) * s;
          const c = Math.floor(sx / cw), r = Math.floor(sy / ch);
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          const ci = r * cols + c;
          if (depth >= zbuf[ci] + 2) continue; // hidden behind the tree
          const nx = CUBE[i + 3] * cs - CUBE[i + 5] * ss;
          const nz0 = CUBE[i + 3] * ss + CUBE[i + 5] * cs;
          const ny = CUBE[i + 4] * ct - nz0 * st;
          const nz = CUBE[i + 4] * st + nz0 * ct;
          const lum = clamp(0.25 + 0.75 * Math.max(0, nx * L.x + ny * L.y + nz * L.z), 0, 1);
          const lv = Math.min(2, Math.floor(lum * 3));
          const ribbon = CUBE[i + 6] === 1;
          ctx.fillStyle = ribbon ? ribStyles[lv] : boxStyles[lv];
          ctx.fillText(ribbon ? "+" : lv === 2 ? "8" : lv === 1 ? "%" : "#", sx, sy);
        }
      }
    }

    drawLights(t, GY, D, F, cx, fontPx) {
      const { ctx, cw, ch, cols, rows, zbuf } = this;
      ctx.font = `600 ${Math.round(fontPx * 0.85)}px ${this.fontFamily}`;
      for (const tree of this.trees) {
        const ca = Math.cos(tree.angle), sa = Math.sin(tree.angle);
        for (const lt of tree.lights) {
          const xr = lt.x * ca - lt.z * sa;
          const zr = lt.x * sa + lt.z * ca;
          const depth = D + tree.oz + zr;
          if (depth < 80) continue;
          const s = F / depth;
          const sx = cx + (tree.ox + xr) * s;
          const sy = GY - lt.y * s;
          const c = Math.floor(sx / cw), r = Math.floor(sy / ch);
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          if (depth >= zbuf[r * cols + c] + 8) continue; // back side of the tree
          const twinkle = 0.5 + 0.5 * Math.sin(t * lt.freq + lt.phase);
          const chase = 0.5 + 0.5 * Math.sin(t * 2.2 - lt.u * 10);
          const b = clamp(0.22 + 0.62 * twinkle + 0.24 * chase + this.burst * 0.9, 0, 1);
          if (b < 0.2) continue;
          const [rr, gg, bb] = LIGHT_RGB[lt.color];
          ctx.fillStyle = `rgba(${rr},${gg},${bb},${(b * 0.22).toFixed(3)})`;
          ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
          ctx.fillStyle = `rgba(${rr},${gg},${bb},${b.toFixed(3)})`;
          ctx.fillText(lt.glyph, sx, sy);
        }
      }
    }

    drawApples(t, GY, D, F, cx, fontPx) {
      const { ctx, cw, ch, cols, rows, zbuf } = this;
      ctx.font = `700 ${Math.round(fontPx * 0.82)}px ${this.fontFamily}`;
      for (const tree of this.trees) {
        const ca = Math.cos(tree.angle), sa = Math.sin(tree.angle);
        for (const ap of tree.apples) {
          const xr = ap.x * ca - ap.z * sa;
          const zr = ap.x * sa + ap.z * ca;
          const depth = D + tree.oz + zr;
          if (depth < 80) continue;
          const s = F / depth;
          const sx = cx + (tree.ox + xr) * s;
          const sy = GY - ap.y * s;
          const c = Math.floor(sx / cw), r = Math.floor(sy / ch);
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          if (depth >= zbuf[r * cols + c] + 8) continue; // back side of the tree
          // little leaf, red body, specular dot
          ctx.fillStyle = "rgba(126,204,128,0.85)";
          ctx.fillText("'", sx + 1.5, sy - fontPx * 0.42);
          ctx.fillStyle = "rgba(228,72,60,0.92)";
          ctx.fillText("o", sx, sy);
          ctx.fillStyle = "rgba(255,196,180,0.85)";
          ctx.fillRect(sx - 2.5, sy - 2.5, 1.5, 1.5);
        }
      }
    }

    drawWreaths(t, GY, D, F, cx, fontPx) {
      const { ctx, cw, ch, cols, rows, zbuf } = this;
      ctx.font = `600 ${Math.round(fontPx * 0.75)}px ${this.fontFamily}`;
      for (const tree of this.trees) {
        const ca = Math.cos(tree.angle), sa = Math.sin(tree.angle);
        for (const w of tree.wreath) {
          const xr = w.x * ca - w.z * sa;
          const zr = w.x * sa + w.z * ca;
          const depth = D + tree.oz + zr;
          if (depth < 80) continue;
          const s = F / depth;
          const sx = cx + (tree.ox + xr) * s;
          const sy = GY - w.y * s;
          const c = Math.floor(sx / cw), r = Math.floor(sy / ch);
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          if (depth >= zbuf[r * cols + c] + 8) continue;
          const b = 0.6 + 0.4 * Math.sin(t * 1.5 + w.phase);
          const [rr, gg, bb] = LIGHT_RGB[w.color];
          ctx.fillStyle = `rgba(${rr},${gg},${bb},${(b * 0.2).toFixed(3)})`;
          ctx.fillRect(sx - 2, sy - 2, 4, 4);
          ctx.fillStyle = `rgba(${rr},${gg},${bb},${b.toFixed(3)})`;
          ctx.fillText(w.glyph, sx, sy);
        }
      }
    }

    drawTreeStars(t, GY, D, F, cx, fontPx) {
      const { ctx } = this;
      for (const tree of this.trees) {
        const depth = D + tree.oz;
        const s = F / depth;
        const sx = cx + tree.ox * s;
        const sy = GY - (tree.trunkH + tree.Hf + 20 * tree.m) * s;
        const pulse = 0.6 + 0.4 * Math.sin(t * 1.6 + tree.starPhase);
        const size = Math.round(fontPx * (1.4 + 0.25 * pulse));
        ctx.font = `700 ${size}px ${this.fontFamily}`;
        const glow = Math.round(size * 0.45);
        ctx.fillStyle = `rgba(255,214,120,${(0.3 * pulse).toFixed(3)})`;
        ctx.fillRect(sx - glow / 2, sy - glow / 2, glow, glow);
        ctx.fillStyle = `rgba(255,224,150,${(0.6 + 0.4 * pulse).toFixed(3)})`;
        ctx.fillText("*", sx, sy);
        // cross rays, longer when bright
        ctx.font = `600 ${Math.round(fontPx * 0.8)}px ${this.fontFamily}`;
        ctx.fillStyle = `rgba(255,224,150,${(0.2 + 0.5 * pulse).toFixed(3)})`;
        const ray = fontPx * (1.0 + 0.35 * pulse);
        ctx.fillText("-", sx - ray, sy);
        ctx.fillText("-", sx + ray, sy);
        ctx.fillText("|", sx, sy - ray * 0.8);
        ctx.fillText("|", sx, sy + ray * 0.8);
      }
    }

    drawSnow() {
      const { ctx, ch } = this;
      ctx.font = `600 ${Math.round(ch * 0.66)}px ${this.fontFamily}`;
      for (const f of this.snow) {
        ctx.fillStyle = `rgba(216,232,250,${f.alpha.toFixed(3)})`;
        ctx.fillText(f.glyph, f.x, f.y);
      }
    }

    drawSparkles() {
      const { ctx, ch } = this;
      ctx.font = `600 ${Math.round(ch * 0.8)}px ${this.fontFamily}`;
      for (const s of this.sparkles) {
        const fade = clamp((1 - s.age / s.life) * 1.6, 0, 1);
        const [r, g, b] = s.color;
        ctx.fillStyle = `rgba(${r},${g},${b},${fade.toFixed(3)})`;
        ctx.fillText(s.glyph, s.x, s.y);
      }
    }
  }

  window.AsciiXmas = {
    create(canvas, opts) { return new XmasEngine(canvas, opts); }
  };
})();
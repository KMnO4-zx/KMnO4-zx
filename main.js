/* KMnO4-zx — homepage interactions
   0. EN/中文 i18n toggle     1. mouse spotlight   2. scroll reveal
   3. nav scroll-spy          4. draggable notes   5. GitHub stars */

(() => {
  "use strict";

  // 刷新一律回顶部：接管浏览器的滚动位置恢复，避免恢复位置逐次累积偏移
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("load", () => {
    if (location.hash) {
      const t = document.querySelector(location.hash);
      if (t) { t.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  });

  /* ---------- 0. i18n ---------- */

  // 文案字典：改文案就改这里（en = 默认，zh = 中文）
  const I18N = {
    en: {
      "doc.title": "KMnO4-zx — Open-source Developer & Researcher",
      "alias": "aka 不要葱姜蒜",
      "motto": "靡不有初，鲜克有终。",
      "role": `Open-source Developer <span class="amp">&</span> Researcher`,
      "tagline": `I study how LLM agents learn to act — Agent RL, post-training, and agentic systems. Along the way I build open-source things that people actually use.`,
      "nav.about": "About", "nav.experience": "Experience", "nav.projects": "Projects", "nav.notes": "Notes",
      "about.p1": `I'm an open-source developer and researcher focused on <strong>Agent RL</strong>, <strong>LLM post-training</strong>, and <strong>AI agents</strong>. Projects I build and maintain have earned <strong>100,000+ GitHub stars</strong> in total — including <a href="https://github.com/datawhalechina/happy-llm" target="_blank" rel="noopener">Happy-LLM</a>, <a href="https://github.com/datawhalechina/self-llm" target="_blank" rel="noopener">self-llm</a>, and <a href="https://github.com/KMnO4-zx/agentic-rl-lab" target="_blank" rel="noopener">agentic-rl-lab</a>.`,
      "about.p2": `Currently I'm a PhD student at <strong>Xidian University</strong> and a researcher at <strong>Emotion Machine Lab</strong>, where I also work across developer growth and the open-source community. Previously I was a research assistant at <strong>Westlake University, AGI Lab</strong> — where my first-author paper <a href="https://aclanthology.org/2026.findings-acl.983/" target="_blank" rel="noopener"><em>Hard to Read, Easy to Jailbreak</em></a> was published at <strong>Findings of ACL 2026</strong> — and at <strong>Yunqi Academy of Engineering</strong>.`,
      "chip.1": "Agent RL", "chip.2": "LLM Post-training", "chip.3": "AI Agents", "chip.4": "Multimodal Safety",
      "xp1.period": "Present",
      "xp1.title": `Researcher &amp; Growth Operations · <span class="xp-org">Emotion Machine Lab</span>`,
      "xp1.li1": "Research on Agent RL, LLM post-training, and agentic systems.",
      "xp1.li2": "Developer growth, community operations, and the open-source ecosystem.",
      "xp2.period": "Research Assistant",
      "xp2.title": `<span class="xp-org">Westlake University</span> · AGI Lab`,
      "xp2.li1": "Multimodal model behavior and safety, with Prof. Chi Zhang.",
      "xp2.li2": `First-authored <a href="https://aclanthology.org/2026.findings-acl.983/" target="_blank" rel="noopener"><em>Hard to Read, Easy to Jailbreak</em></a>, Findings of ACL 2026.`,
      "xp3.period": "2024.06 — 2024.08",
      "xp3.title": `Research Assistant · <span class="xp-org">Yunqi Academy of Engineering</span>`,
      "xp3.li1": "LLM applications in urban governance.",
      "xp3.li2": `Co-authored <a href="https://arxiv.org/abs/2411.16791" target="_blank" rel="noopener"><em>What can LLM tell us about cities?</em></a>`,
      "pubs.title": "Selected Publications",
      "pub1.venue": "Findings of ACL 2026 · First author",
      "pub2.venue": "arXiv · 2024",
      "pub3.venue": "Geomatics and Information Science of Wuhan University · 2024",
      "proj.1": "A from-scratch guide to LLM fundamentals and implementation.",
      "proj.2": "A practical guide to deploying and fine-tuning open-source LLMs.",
      "proj.3": "Hands-on implementations of RAG, agents, evaluation, and other LLM systems.",
      "proj.4": "Reproductions and studies of RL algorithms for LLM agents.",
      "proj.5": "An AI-powered platform for paper analysis and research workflows.",
      "proj.6": "A ChatGLM-based character chatbot fine-tuned on dialogue from <em>Empresses in the Palace</em>.",
      "proj.more": "view full archive →",
      "notes.hint": `A wall of sticky notes — what I'm up to and random thoughts. On desktop you can <strong>drag them around</strong>; the arrangement is saved in your browser.`,
      "footer": "Designed &amp; built by KMnO4-zx · plain HTML/CSS/JS, no frameworks",
    },
    zh: {
      "doc.title": "KMnO4-zx — 开源开发者与研究者",
      "alias": "不要葱姜蒜",
      "motto": "靡不有初，鲜克有终。",
      "role": `开源开发者 <span class="amp">&</span> 研究者`,
      "tagline": `我研究 LLM Agent 如何学会「做事」——Agent RL、后训练与智能体系统。平时也写一些真正有人用的开源项目。`,
      "nav.about": "关于", "nav.experience": "经历", "nav.projects": "项目", "nav.notes": "便签",
      "about.p1": `我是一名开源开发者与研究者，专注于 <strong>Agent RL</strong>、<strong>LLM 后训练</strong>与 <strong>AI 智能体</strong>。我创建和维护的开源项目累计获得 <strong>100,000+ GitHub stars</strong>，包括 <a href="https://github.com/datawhalechina/happy-llm" target="_blank" rel="noopener">Happy-LLM</a>、<a href="https://github.com/datawhalechina/self-llm" target="_blank" rel="noopener">self-llm</a> 与 <a href="https://github.com/KMnO4-zx/agentic-rl-lab" target="_blank" rel="noopener">agentic-rl-lab</a>。`,
      "about.p2": `目前我在 <strong>西安电子科技大学</strong> 攻读博士学位，同时在 <strong>Emotion Machine Lab</strong> 做研究，负责开发者增长与开源社区运营。此前我曾在 <strong>西湖大学 AGI Lab</strong> 担任研究助理——一作论文 <a href="https://aclanthology.org/2026.findings-acl.983/" target="_blank" rel="noopener"><em>Hard to Read, Easy to Jailbreak</em></a> 发表于 <strong>Findings of ACL 2026</strong>——也曾在 <strong>云栖工程研究院</strong> 工作。`,
      "chip.1": "Agent RL", "chip.2": "LLM 后训练", "chip.3": "AI 智能体", "chip.4": "多模态安全",
      "xp1.period": "至今",
      "xp1.title": `研究员 &amp; 增长运营 · <span class="xp-org">Emotion Machine Lab</span>`,
      "xp1.li1": "Agent RL、LLM 后训练与智能体系统研究。",
      "xp1.li2": "开发者增长、社区运营与开源生态建设。",
      "xp2.period": "研究助理",
      "xp2.title": `<span class="xp-org">西湖大学</span> · AGI Lab`,
      "xp2.li1": "与张驰教授研究多模态模型行为与安全。",
      "xp2.li2": `一作论文 <a href="https://aclanthology.org/2026.findings-acl.983/" target="_blank" rel="noopener"><em>Hard to Read, Easy to Jailbreak</em></a>，Findings of ACL 2026。`,
      "xp3.period": "2024.06 — 2024.08",
      "xp3.title": `研究助理 · <span class="xp-org">云栖工程研究院</span>`,
      "xp3.li1": "LLM 在城市治理中的应用研究。",
      "xp3.li2": `合著 <a href="https://arxiv.org/abs/2411.16791" target="_blank" rel="noopener"><em>What can LLM tell us about cities?</em></a>`,
      "pubs.title": "论文发表",
      "pub1.venue": "Findings of ACL 2026 · 第一作者",
      "pub2.venue": "arXiv · 2024",
      "pub3.venue": "武汉大学学报（信息科学版） · 2024",
      "proj.1": "从零开始的 LLM 原理与实现教程。",
      "proj.2": "开源大模型部署与微调实践指南。",
      "proj.3": "动手实现 RAG、Agent、评测等 LLM 系统。",
      "proj.4": "LLM Agent 强化学习算法复现与研究。",
      "proj.5": "AI 驱动的论文分析与科研工作流平台。",
      "proj.6": "基于 ChatGLM 的《甄嬛传》角色聊天机器人。",
      "proj.more": "查看完整项目 →",
      "notes.hint": `一面便签墙，写点近况和碎碎念。桌面端可以<strong>随手拖动</strong>，摆成你喜欢的样子 —— 位置会记在你的浏览器里。`,
      "footer": "由 KMnO4-zx 设计与构建 · 纯 HTML/CSS/JS，无框架",
    },
  };

  // 便签内容：改这里就能增删/修改便签（便签不随语言切换，固定显示）
  const NOTE_BASE = [
    { id: "motto",    rot: -2.0, tape: -1.5, text: "「靡不有初，鲜克有终。」", tag: "#座右铭" },
    { id: "research", rot: 1.8,  tape: 2.0,  text: "最近在折腾 Agent RL：让模型学会“做事”，而不只是“说话”。", tag: "#research" },
    { id: "oss",      rot: -1.2, tape: -2.5, text: "Happy-LLM / self-llm / tiny-universe 持续维护中，欢迎 issue & PR！", tag: "#open-source" },
    { id: "paper",    rot: 2.6,  tape: 1.0,  text: "一作论文 Hard to Read, Easy to Jailbreak → Findings of ACL 2026 🎉", tag: "#paper" },
    { id: "stars",    rot: -2.4, tape: -1.0, text: "开源累计 100,000+ stars，感谢每一位点过 star 的你 ⭐", tag: "#thanks" },
    { id: "daily",    rot: 1.5,  tape: 2.5,  text: "在 Emotion Machine Lab 做研究，也做开发者社区——白天 RL，晚上回 issue。", tag: "#daily" },
  ];

  const LANG_KEY = "kmno4.lang";
  const noteEls = [];
  let currentLang = "en";

  const applyLang = (lang) => {
    if (!I18N[lang]) lang = "en";
    currentLang = lang;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = I18N[lang]["doc.title"];
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = I18N[lang][el.dataset.i18n];
      if (v !== undefined) el.innerHTML = v;
    });
    document.querySelectorAll(".lang-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.lang === lang)
    );
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) { /* ignore */ }
  };

  const savedLang = (() => {
    try { return localStorage.getItem(LANG_KEY); } catch (_) { return null; }
  })();

  document.querySelectorAll(".lang-btn").forEach((b) =>
    b.addEventListener("click", () => applyLang(b.dataset.lang))
  );

  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. spotlight follows the mouse ---------- */
  if (finePointer && !reducedMotion) {
    const spot = document.querySelector(".spotlight");
    let raf = null;
    window.addEventListener("mousemove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        spot.style.setProperty("--mx", e.clientX + "px");
        spot.style.setProperty("--my", e.clientY + "px");
        raf = null;
      });
    }, { passive: true });
  }

  /* ---------- 2. scroll reveal ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("visible");
        revealIO.unobserve(en.target);
      }
    }
  }, { threshold: 0.06 });
  document.querySelectorAll(".reveal").forEach((el) => revealIO.observe(el));

  /* ---------- 3. nav scroll-spy ---------- */
  const navLinks = [...document.querySelectorAll(".nav-link")];
  navLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const t = id && document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", id);
    });
  });
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if (sections.length) {
    const spy = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        navLinks.forEach((a) =>
          a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id)
        );
      }
    }, { rootMargin: "-35% 0px -55% 0px" });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- 4. draggable notes wall ---------- */
  const wall = document.getElementById("notesWall");
  const STORE_KEY = "kmno4.notes.v1";
  const NOTE_W = 205;
  const NOTE_H = 178; // estimated, used only for default layout slots
  let topZ = 10;

  if (wall) {
    const isMobileWall = () => window.matchMedia("(max-width: 640px)").matches;

    // render notes
    for (const n of NOTE_BASE) {
      const el = document.createElement("article");
      el.className = "note";
      el.dataset.id = n.id;
      el.style.setProperty("--rot", n.rot + "deg");
      el.style.setProperty("--tape-rot", n.tape + "deg");
      el.innerHTML = `<p></p><span class="note-tag mono"></span>`;
      el.querySelector("p").textContent = n.text;
      el.querySelector(".note-tag").textContent = n.tag;
      wall.appendChild(el);
      noteEls.push(el);
    }

    const defaultPositions = () => {
      const w = wall.clientWidth, h = wall.clientHeight;
      const cols = Math.max(1, Math.floor(w / (NOTE_W + 28)));
      const rows = Math.ceil(NOTE_BASE.length / cols);
      const cellW = w / cols, cellH = h / rows;
      return NOTE_BASE.map((n, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const jx = ((i * 37) % 25) - 12;   // deterministic jitter
        const jy = ((i * 53) % 21) - 10;
        const x = Math.min(Math.max(c * cellW + (cellW - NOTE_W) / 2 + jx, 6), w - NOTE_W - 6);
        const y = Math.min(Math.max(r * cellH + (cellH - NOTE_H) / 2 + jy + 10, 12), h - NOTE_H - 8);
        return { id: n.id, x: Math.round(x), y: Math.round(y) };
      });
    };

    const loadSaved = () => {
      try {
        const s = JSON.parse(localStorage.getItem(STORE_KEY));
        if (s && s.pos && Math.abs(s.w - wall.clientWidth) <= 90) return s.pos;
      } catch (_) { /* ignore */ }
      return null;
    };

    const applyPositions = (posMap) => {
      for (const el of noteEls) {
        const p = posMap[el.dataset.id];
        if (p) { el.style.left = p.x + "px"; el.style.top = p.y + "px"; }
      }
    };

    const layout = () => {
      if (isMobileWall()) return; // static flow via CSS
      const saved = loadSaved();
      if (saved) {
        applyPositions(saved);
      } else {
        const map = {};
        for (const p of defaultPositions()) map[p.id] = { x: p.x, y: p.y };
        applyPositions(map);
      }
    };

    const savePositions = () => {
      const pos = {};
      for (const el of noteEls) pos[el.dataset.id] = { x: el.offsetLeft, y: el.offsetTop };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ w: wall.clientWidth, pos }));
      } catch (_) { /* ignore */ }
    };

    // pointer-drag (desktop only)
    const initDrag = () => {
      for (const el of noteEls) {
        el.addEventListener("pointerdown", (e) => {
          if (isMobileWall() || e.button !== 0) return;
          e.preventDefault();
          el.setPointerCapture(e.pointerId);
          el.classList.add("dragging");
          el.style.zIndex = ++topZ;
          const startX = e.clientX, startY = e.clientY;
          const baseX = el.offsetLeft, baseY = el.offsetTop;

          const onMove = (ev) => {
            const maxX = wall.clientWidth - el.offsetWidth;
            const maxY = wall.clientHeight - el.offsetHeight;
            const nx = Math.min(Math.max(baseX + ev.clientX - startX, 0), maxX);
            const ny = Math.min(Math.max(baseY + ev.clientY - startY, 0), maxY);
            el.style.left = nx + "px";
            el.style.top = ny + "px";
          };
          const onUp = () => {
            el.classList.remove("dragging");
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerup", onUp);
            el.removeEventListener("pointercancel", onUp);
            savePositions();
          };
          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerup", onUp);
          el.addEventListener("pointercancel", onUp);
        });
      }
    };

    layout();
    initDrag();

    let resizeT = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if (isMobileWall()) {
          noteEls.forEach((el) => { el.style.left = ""; el.style.top = ""; });
        } else {
          layout();
        }
      }, 200);
    });
  }

  // apply initial language (default EN, or the visitor's previous choice)
  applyLang(savedLang || "en");

  /* ---------- 5. live GitHub star counts ---------- */
  const repoEls = [...document.querySelectorAll("[data-repo]")];
  if (repoEls.length) {
    const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));
    repoEls.forEach(async (card) => {
      const slot = card.querySelector(".proj-stars");
      try {
        const res = await fetch("https://api.github.com/repos/" + card.dataset.repo);
        if (!res.ok) return;
        const data = await res.json();
        if (slot && typeof data.stargazers_count === "number") {
          slot.textContent = fmt(data.stargazers_count);
        }
      } catch (_) { /* offline or rate-limited: leave blank */ }
    });
  }
})();

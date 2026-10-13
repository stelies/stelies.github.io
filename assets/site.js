(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ——— text splitting: letters (big words) and words (headings) rise out of masks ——— */
  const mk = (cls, txt) => { const e = document.createElement("span"); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  $$("[data-letters]").forEach((el) => {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.replaceChildren();
    let k = 0;
    for (const ch of text) {
      if (ch === " ") { el.append(document.createTextNode(" ")); continue; }
      const l = mk("l"), c = mk("c", ch);
      l.setAttribute("aria-hidden", "true");
      c.style.setProperty("--k", k++);
      l.append(c);
      el.append(l);
    }
    el.classList.add("letters");
  });

  function splitWords(node, state) {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(" ")); return; }
          const w = mk("w"), inner = mk("", part);
          inner.style.setProperty("--k", state.k++);
          w.append(inner);
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) splitWords(n, state);
    });
  }
  $$("[data-words]").forEach((el) => {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    splitWords(el, { k: 0 });
    $$(".w", el).forEach((w) => w.setAttribute("aria-hidden", "true"));
    el.classList.add("words");
  });

  /* ——— fit big words to their container ——— */
  const fits = $$("[data-fit]");
  const fit = () => {
    fits.forEach((el) => {
      const box = el.parentElement;
      el.style.fontSize = "100px";
      const w = el.getBoundingClientRect().width;
      // data-fit="0.62" = share of the container width on wide screens; full width on narrow ones
      const share = innerWidth > 900 ? parseFloat(el.dataset.fit) || 1 : 1;
      if (w > 0) el.style.fontSize = (100 * box.clientWidth * share) / w + "px";
    });
  };
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ——— modifier key label ——— */
  const mac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  const kMod = $("#kMod");
  if (!mac && kMod) kMod.textContent = "Ctrl";
  const hintKey = $("#hintKey");
  if (hintKey) hintKey.textContent = mac ? "⌘ K" : "Ctrl K";

  /* ——— reveal on scroll ——— */
  const countEls = $$("[data-count]");
  countEls.forEach((el) => { el.textContent = "0" + (el.dataset.suffix || ""); });
  function countUp(el) {
    const to = parseFloat(el.dataset.count), suf = el.dataset.suffix || "";
    if (reduce) { el.textContent = to + suf; return; }
    const t0 = performance.now(), dur = 1400;
    const step = (now) => {
      const t = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3))) + suf;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const reveal = $$(".rv, .letters, .words, [data-count]");
  const reveal1 = (el) => { el.classList.add("on"); if (el.hasAttribute("data-count")) countUp(el); };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { reveal1(e.target); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    reveal.forEach((el) => io.observe(el));
  } else {
    reveal.forEach(reveal1);
  }

  /* ——— scroll engine ———
     Wheel input moves a target; the page chases it with exponential easing, so scrolling trails
     your hand by a beat. Touch and keyboard stay native. Off for reduced motion. */
  const SMOOTH = 7.5; // higher = tighter
  let cur = scrollY, tgt = scrollY, raf = 0, last = 0;
  const maxY = () => Math.max(0, root.scrollHeight - innerHeight);
  const locked = () => document.body.classList.contains("locked");

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    cur += (tgt - cur) * (1 - Math.exp(-dt * SMOOTH));
    const done = Math.abs(tgt - cur) < 0.4;
    if (done) cur = tgt;
    window.scrollTo(0, cur);
    raf = done ? 0 : requestAnimationFrame(tick);
  }
  function kick() {
    if (raf) return;
    cur = scrollY;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function scrollToY(y) {
    tgt = clamp(y, 0, maxY());
    if (reduce) { window.scrollTo(0, tgt); cur = tgt; } else kick();
  }
  function goto(sel) {
    if (sel === "#top") return scrollToY(0);
    const el = $(sel);
    if (!el) return;
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    scrollToY(el.getBoundingClientRect().top + scrollY + pad - 28);
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute("href");
    if (id === "#" || (id !== "#top" && !$(id))) return;
    e.preventDefault();
    goto(id);
    history.replaceState(null, "", id === "#top" ? location.pathname + location.search : id);
  });

  /* ——— topbar: pulled down by upward scrolling, even where the page can't move ———
     p = how far the bar is revealed (0 parked above the viewport, 1 fully down). */
  const bar = $("#topbar");
  const hint = $("#hint");
  let p = 0, snapT = 0;
  const H = () => (bar ? bar.offsetHeight || 84 : 84);

  function setP(v, animate) {
    if (!bar) return;
    p = clamp(v, 0, 1);
    bar.classList.toggle("snap", !!animate);
    bar.style.transform = "translate3d(0," + (p - 1) * 101 + "%,0)";
    if (p > 0.98 && hint) hint.classList.add("seen");
  }
  function snapSoon() {
    clearTimeout(snapT);
    snapT = setTimeout(() => { if (p > 0 && p < 1) setP(p >= 0.5 ? 1 : 0, true); }, 150);
  }
  function pull(delta) { setP(p + delta / H()); snapSoon(); }

  if (bar) {
    bar.addEventListener("focusin", () => setP(1, true));
    let lastTouch = null;
    addEventListener("touchstart", () => { lastTouch = null; }, { passive: true });
    addEventListener("touchmove", (e) => {
      const y = e.touches[0].clientY;
      const d = lastTouch === null ? 0 : y - lastTouch;
      lastTouch = y;
      if (scrollY <= 0 && (d > 0 || p > 0)) pull(d);
    }, { passive: true });
    addEventListener("touchend", () => { lastTouch = null; snapSoon(); }, { passive: true });
  }

  addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey || e.defaultPrevented || locked()) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.target.closest && e.target.closest(".pal-list")) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);

    // at the top of the page the wheel works the bar, not the page
    if (bar && scrollY <= 0 && tgt <= 0 && (dy < 0 || (dy > 0 && p > 0))) {
      e.preventDefault();
      pull(-dy);
      return;
    }
    if (reduce) return;
    e.preventDefault();
    tgt = clamp((raf ? tgt : scrollY) + dy, 0, maxY());
    kick();
  }, { passive: false });

  /* ——— progress line (the native scrollbar is hidden) ——— */
  const prog = $("#prog");
  function progress() {
    if (!prog) return;
    const m = maxY();
    prog.style.transform = "scaleY(" + (m > 0 ? clamp(scrollY / m, 0, 1) : 0).toFixed(4) + ")";
  }
  progress();

  let prevY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    if (Math.abs(y - cur) > 2) { // moved natively (keyboard, anchor jump): resync
      cancelAnimationFrame(raf);
      raf = 0;
      cur = tgt = y;
    }
    const dy = y - prevY;
    prevY = y;
    if (bar && dy) { setP(p - dy / H()); snapSoon(); }
    progress();
  }, { passive: true });

  addEventListener("resize", () => { fit(); progress(); });

  /* ——— work list: the project's plate floats beside the cursor ——— */
  const peek = $("#peek");
  const rowEls = $$("#rows .row[data-peek]");
  if (peek && rowEls.length && matchMedia("(hover: hover)").matches) {
    const imgs = new Map();
    rowEls.forEach((row) => {
      const src = row.dataset.peek;
      if (imgs.has(src)) return;
      const im = document.createElement("img");
      im.src = src; im.alt = ""; im.decoding = "async";
      peek.append(im);
      imgs.set(src, im);
    });
    let px = 0, py = 0, tx = 0, ty = 0, running = false, shown = false;
    const place = () => {
      const w = peek.offsetWidth, h = peek.offsetHeight;
      tx = clamp(tx, 12, innerWidth - w - 12);
      ty = clamp(ty, 12, innerHeight - h - 12);
    };
    const loop = () => {
      px += (tx - px) * 0.16; py += (ty - py) * 0.16;
      peek.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0)";
      if (running) requestAnimationFrame(loop);
    };
    const move = (e) => { tx = e.clientX + 36; ty = e.clientY - peek.offsetHeight / 2; place(); if (!shown) { px = tx; py = ty; shown = true; } };
    rowEls.forEach((row) => {
      row.addEventListener("mouseenter", (e) => {
        imgs.forEach((im, src) => im.classList.toggle("on", src === row.dataset.peek));
        move(e);
        peek.classList.add("show");
        if (!running) { running = true; requestAnimationFrame(loop); }
      });
      row.addEventListener("mousemove", move);
      row.addEventListener("mouseleave", () => { peek.classList.remove("show"); running = false; shown = false; });
    });
  }

  /* ——— command palette ——— */
  const pal = $("#pal");
  if (!pal) return;
  const palIn = $("#palIn"), palList = $("#palList"), palMsg = $("#palMsg"), palOpen = $("#palOpen");
  const say = (m) => { palMsg.textContent = m; clearTimeout(say.t); say.t = setTimeout(() => { palMsg.textContent = ""; }, 2400); };
  const out = (url) => () => window.open(url, "_blank", "noopener");

  const commands = [
    { g: "Go", label: "Work", run: () => goto("#work") },
    { g: "Go", label: "About", run: () => goto("#about") },
    { g: "Go", label: "Contact", run: () => goto("#contact") },
    { g: "Go", label: "Top of page", run: () => goto("#top") },
    { g: "Open", label: "Artex", run: out("https://fast-artex.vercel.app") },
    { g: "Open", label: "Solace Discord", run: out("https://discord.gg/X3KPAnFdCd") },
    { g: "Open", label: "IsraelGPT", run: out("https://stelies.github.io/israelgpt/") },
    { g: "Open", label: "GitHub", run: out("https://github.com/stelies") },
    { g: "Do", label: "Copy link to this page", keep: true, run: copyLink },
  ];

  let shown = commands, sel = 0, lastFocus = null;

  function render() {
    const q = palIn.value.trim().toLowerCase();
    shown = q ? commands.filter((c) => (c.g + " " + c.label).toLowerCase().includes(q)) : commands;
    sel = Math.min(sel, Math.max(shown.length - 1, 0));
    palList.replaceChildren();
    if (!shown.length) {
      const d = document.createElement("div");
      d.className = "pal-empty mono";
      d.textContent = "No match";
      palList.append(d);
      palIn.removeAttribute("aria-activedescendant");
      return;
    }
    shown.forEach((c, i) => {
      const li = document.createElement("div");
      li.className = "pal-item";
      li.id = "pi" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === sel));
      const name = document.createElement("span");
      const grp = document.createElement("span");
      grp.className = "g";
      name.textContent = c.label;
      grp.textContent = c.g;
      li.append(name, grp);
      li.addEventListener("mousemove", () => { if (sel !== i) { sel = i; mark(); } });
      li.addEventListener("click", () => run(i));
      palList.append(li);
    });
    palIn.setAttribute("aria-activedescendant", "pi" + sel);
  }

  function mark() {
    $$(".pal-item", palList).forEach((el, i) => el.setAttribute("aria-selected", String(i === sel)));
    palIn.setAttribute("aria-activedescendant", "pi" + sel);
    const c = $("#pi" + sel);
    if (c) c.scrollIntoView({ block: "nearest" });
  }

  function open() {
    if (pal.classList.contains("open")) return;
    lastFocus = document.activeElement;
    pal.classList.add("open");
    document.body.classList.add("locked");
    palIn.value = ""; sel = 0; palMsg.textContent = "";
    render();
    palIn.focus();
  }
  function close() {
    if (!pal.classList.contains("open")) return;
    pal.classList.remove("open");
    document.body.classList.remove("locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function run(i) {
    const c = shown[i];
    if (!c) return;
    if (!c.keep) close();
    c.run();
  }
  function copyLink() {
    const url = location.href.split("#")[0];
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => say("Link copied"), () => say("Copy failed"));
    else say("Copy failed");
  }

  palOpen.addEventListener("click", open);
  $("#palBg").addEventListener("click", close);
  palIn.addEventListener("input", () => { sel = 0; render(); });
  palIn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (shown.length) { sel = (sel + 1) % shown.length; mark(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { sel = (sel - 1 + shown.length) % shown.length; mark(); } }
    else if (e.key === "Enter") { e.preventDefault(); run(sel); }
    else if (e.key === "Tab") { e.preventDefault(); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      pal.classList.contains("open") ? close() : open();
    } else if (e.key === "Escape") close();
  });
})();

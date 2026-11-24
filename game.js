(() => {
  "use strict";

  // ---------- Setup ----------
  const W = 480;
  const H = 720;
  const GROUND_H = 112;
  const PIPE_W = 78;
  const CAP_W = 92;
  const CAP_H = 28;
  const BIRD_X = 142;
  const BIRD_R = 15;
  const GRAVITY = 1550;
  const FLAP_V = -430;
  const TERMINAL_V = 620;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const shell = document.getElementById("gameShell");
  const overlay = document.getElementById("overlay");
  const startCard = document.getElementById("startCard");
  const overCard = document.getElementById("gameOverCard");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const finalScoreEl = document.getElementById("finalScore");
  const bestScoreEl = document.getElementById("bestScore");
  const newBestEl = document.getElementById("newBest");
  const medalEl = document.getElementById("medal");
  const soundBtn = document.getElementById("soundBtn");
  const leaderboardBtn = document.getElementById("leaderboardBtn");
  const leaderboardBtn2 = document.getElementById("leaderboardBtn2");
  const leaderboardOverlay = document.getElementById("leaderboardOverlay");
  const boardList = document.getElementById("boardList");
  const closeBoardBtn = document.getElementById("closeBoardBtn");
  const clearBoardBtn = document.getElementById("clearBoardBtn");
  const playerNameInput = document.getElementById("playerName");
  const rankNote = document.getElementById("rankNote");
  const inputHint = document.getElementById("inputHint");
  const playHint = document.getElementById("playHint");
  const controlsHint = document.getElementById("controlsHint");

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resizeCanvas);

  // Touch-first wording on phones and tablets.
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
    inputHint.textContent = "Tap anywhere to flap";
    playHint.textContent = "Tap to flap";
    controlsHint.innerHTML = "Tap 🔊 for sound";
  }

  // Pointer Events cover modern browsers; fall back for older iOS/Android WebViews.
  function onPress(element, handler) {
    if (window.PointerEvent) {
      element.addEventListener("pointerdown", handler);
      return;
    }
    element.addEventListener("touchstart", (e) => {
      if (e.target.closest && e.target.closest("button, input, a")) return;
      e.preventDefault();
      handler({ target: e.target });
    }, { passive: false });
    element.addEventListener("mousedown", handler);
  }

  // ---------- Audio ----------
  let audioCtx = null;
  let muted = false;

  function ensureAudio() {
    if (muted) return;
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();

    // iOS/Safari needs a silent buffer played inside a user gesture to unlock audio.
    if (!audioCtx.__unlocked) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(0);
      osc.stop(audioCtx.currentTime + 0.01);
      audioCtx.__unlocked = true;
    }
  }

  function tone(freq, duration, type = "sine", volume = 0.06, slideTo = null, delay = 0) {
    if (muted || !audioCtx) return;
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const sfx = {
    flap: () => tone(620, 0.09, "triangle", 0.05, 900),
    score: () => { tone(880, 0.09, "sine", 0.07); tone(1320, 0.12, "sine", 0.06, null, 0.09); },
    hit: () => tone(180, 0.16, "sawtooth", 0.07, 90),
    die: () => { tone(400, 0.22, "triangle", 0.06, 180); tone(260, 0.3, "sine", 0.05, 90, 0.12); },
    start: () => { tone(520, 0.08, "square", 0.04); tone(780, 0.1, "square", 0.04, null, 0.08); }
  };

  soundBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.currentTarget.blur();
    muted = !muted;
    soundBtn.textContent = muted ? "🔇" : "🔊";
    if (!muted) { ensureAudio(); sfx.start(); }
  });

  // ---------- Persistent best ----------
  let best = 0;
  try { best = parseInt(localStorage.getItem("flappy-best") || "0", 10) || 0; } catch (_) {}
  bestScoreEl.textContent = best;

  // ---------- Leaderboard ----------
  const LB_KEY = "flappy-leaderboard";
  const NAME_KEY = "flappy-pilot-name";
  const MAX_ENTRIES = 10;
  let latestEntryId = null;

  try { playerNameInput.value = localStorage.getItem(NAME_KEY) || ""; } catch (_) {}

  function getPilotName() {
    let saved = "";
    try { saved = localStorage.getItem(NAME_KEY) || ""; } catch (_) {}
    const typed = playerNameInput.value.trim().toUpperCase();
    return (typed || saved || "PILOT").slice(0, 12);
  }

  function readEntries() {
    try {
      const data = JSON.parse(localStorage.getItem(LB_KEY) || "[]");
      if (!Array.isArray(data)) return [];
      return data
        .filter((e) => e && Number.isFinite(e.score))
        .map((e) => ({
          id: String(e.id || Date.now()) + "-" + Math.floor(Math.random() * 10000),
          name: String(e.name || "PILOT").trim().toUpperCase().slice(0, 12) || "PILOT",
          score: Math.max(0, Math.floor(e.score)),
          date: Number(e.date) || Date.now()
        }));
    } catch (_) {
      return [];
    }
  }

  // One row per pilot, keeping only that pilot's best score.
  function dedupeEntries(entries) {
    const byName = new Map();
    for (const entry of entries) {
      const current = byName.get(entry.name);
      if (!current || entry.score > current.score ||
          (entry.score === current.score && entry.date < current.date)) {
        byName.set(entry.name, entry);
      }
    }
    return Array.from(byName.values())
      .sort((a, b) => b.score - a.score || a.date - b.date)
      .slice(0, MAX_ENTRIES);
  }

  function loadBoard() {
    return dedupeEntries(readEntries());
  }

  function saveBoard(entries) {
    try { localStorage.setItem(LB_KEY, JSON.stringify(dedupeEntries(entries))); } catch (_) {}
  }

  function addScore(value) {
    const name = getPilotName();
    const entries = readEntries();
    const existing = entries.find((e) => e.name === name);
    let id;
    let improved = true;

    if (existing) {
      id = existing.id;
      improved = value > existing.score;
      if (improved) {
        existing.score = value;
        existing.date = Date.now();
      }
    } else {
      id = String(Date.now()) + "-" + Math.floor(Math.random() * 10000);
      entries.push({ id, name, score: value, date: Date.now() });
    }

    const board = dedupeEntries(entries);
    saveBoard(board);
    latestEntryId = id;
    const rank = board.findIndex((e) => e.id === id) + 1;
    return { rank, improved, madeBoard: rank > 0 && rank <= MAX_ENTRIES };
  }

  function renderBoard() {
    const entries = loadBoard();
    boardList.replaceChildren();

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "board-empty";
      empty.textContent = "No scores yet — be the first pilot!";
      boardList.appendChild(empty);
      return;
    }

    entries.forEach((entry, i) => {
      const row = document.createElement("div");
      row.className = "board-row" + (entry.id === latestEntryId ? " is-latest" : "");

      const rank = document.createElement("span");
      rank.className = "board-rank";
      rank.textContent = String(i + 1);

      const name = document.createElement("span");
      name.className = "board-name";
      name.textContent = entry.name;

      const scoreEl = document.createElement("span");
      scoreEl.className = "board-score";
      scoreEl.textContent = String(entry.score);

      const date = document.createElement("span");
      date.className = "board-date";
      date.textContent = new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

      row.append(rank, name, scoreEl, date);
      boardList.appendChild(row);
    });
  }

  function openBoard() {
    renderBoard();
    leaderboardOverlay.classList.remove("hidden");
  }

  function closeBoard() {
    leaderboardOverlay.classList.add("hidden");
  }

  // ---------- State ----------
  let state = "ready"; // ready | playing | dying | over | paused
  let prevState = "playing";
  let score = 0;
  let groundOffset = 0;
  let time = 0;
  let lastTs = 0;
  let spawnTimer = 0;

  const bird = { x: BIRD_X, y: 300, vy: 0, rot: 0, wing: 0 };
  let pipes = [];
  let particles = [];

  const clouds = [
    { x: 60, y: 110, s: 1.0, v: 12 },
    { x: 300, y: 70, s: 0.7, v: 9 },
    { x: 420, y: 180, s: 1.25, v: 15 },
    { x: 160, y: 230, s: 0.55, v: 7 }
  ];

  // ---------- Helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const groundY = () => H - GROUND_H;
  const pipeSpeed = () => 150 + Math.min(score * 3.2, 62);
  const gapSize = () => 194 - Math.min(score * 2.6, 46);
  const pipeSpacing = () => 228;

  function reset() {
    score = 0;
    pipes = [];
    particles = [];
    bird.y = 300;
    bird.vy = 0;
    bird.rot = 0;
    bird.wing = 0;
    spawnTimer = 1.1;
    deathTimer = 0;
    groundOffset = 0;
    for (const c of clouds) c.x = rand(-100, W + 100);
  }

  function addPipe() {
    const gap = gapSize();
    const minTop = 62;
    const maxTop = groundY() - gap - 62;
    const top = rand(minTop, Math.max(minTop + 10, maxTop));
    pipes.push({ x: W + 40, top, gap, passed: false });
  }

  function spawnParticles(x, y, count, color, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 190) * power;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: rand(0.25, 0.6),
        maxLife: 0.6,
        r: rand(2, 5),
        color
      });
    }
  }

  // ---------- Transitions ----------
  function showStart() {
    state = "ready";
    overlay.classList.remove("hidden");
    startCard.classList.remove("hidden");
    overCard.classList.add("hidden");
  }

  function startGame() {
    ensureAudio();
    reset();
    state = "playing";
    overlay.classList.add("hidden");
    sfx.start();
    flap();
  }

  function gameOver() {
    state = "dying";
    sfx.hit();
    spawnParticles(bird.x, bird.y, 16, "#fff3c4", 1.2);

    const isBest = score > best;
    if (isBest) {
      best = score;
      try { localStorage.setItem("flappy-best", String(best)); } catch (_) {}
    }
    finalScoreEl.textContent = score;
    bestScoreEl.textContent = best;
    newBestEl.hidden = !isBest || score === 0;

    let rank = "none", icon = "★";
    if (score >= 40) { rank = "platinum"; icon = "♛"; }
    else if (score >= 25) { rank = "gold"; icon = "★"; }
    else if (score >= 12) { rank = "silver"; icon = "★"; }
    else if (score >= 5) { rank = "bronze"; icon = "★"; }
    medalEl.dataset.rank = rank;
    medalEl.textContent = icon;

    if (score > 0) {
      const result = addScore(score);
      if (result.improved && result.madeBoard) {
        rankNote.textContent = `🏆 Leaderboard rank #${result.rank}`;
        rankNote.hidden = false;
      } else {
        rankNote.hidden = true;
      }
    } else {
      rankNote.hidden = true;
    }
  }

  let deathTimer = 0;
  function finishDeath() {
    state = "over";
    sfx.die();
    overlay.classList.remove("hidden");
    overCard.classList.remove("hidden");
    startCard.classList.add("hidden");
  }

  function flap() {
    if (state !== "playing") return;
    bird.vy = FLAP_V;
    bird.wing = 1;
    spawnParticles(bird.x - 12, bird.y + 8, 5, "#ffffff", 0.45);
    sfx.flap();
  }

  function togglePause() {
    if (state === "paused") {
      state = prevState;
    } else if (state === "playing" || state === "dying") {
      prevState = state;
      state = "paused";
    }
  }

  // ---------- Input ----------
  function handleFlapInput(e) {
    if (e && e.target && e.target.closest("button, input")) return;
    if (!leaderboardOverlay.classList.contains("hidden")) return;
    if (state === "ready" || state === "over") startGame();
    else if (state === "playing") flap();
    else if (state === "paused") togglePause();
  }

  startBtn.addEventListener("click", (e) => { e.stopPropagation(); e.currentTarget.blur(); startGame(); });
  restartBtn.addEventListener("click", (e) => { e.stopPropagation(); e.currentTarget.blur(); startGame(); });
  for (const btn of [leaderboardBtn, leaderboardBtn2]) {
    btn.addEventListener("click", (e) => { e.stopPropagation(); e.currentTarget.blur(); openBoard(); });
  }
  closeBoardBtn.addEventListener("click", (e) => { e.stopPropagation(); e.currentTarget.blur(); closeBoard(); });
  clearBoardBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.currentTarget.blur();
    if (!window.confirm("Clear all leaderboard scores?")) return;
    saveBoard([]);
    latestEntryId = null;
    renderBoard();
  });
  onPress(leaderboardOverlay, (e) => {
    if (e.target === leaderboardOverlay) closeBoard();
  });

  function persistPilotName() {
    const name = playerNameInput.value.trim().toUpperCase().slice(0, 12);
    playerNameInput.value = name;
    try {
      if (name) localStorage.setItem(NAME_KEY, name);
      else localStorage.removeItem(NAME_KEY);
    } catch (_) {}

    // Rename the last run's score, merging if that pilot already exists.
    if (!latestEntryId) return;
    const entries = readEntries();
    const target = entries.find((e) => e.id === latestEntryId);
    if (!target) return;

    const newName = name || "PILOT";
    const duplicate = entries.find((e) => e.id !== target.id && e.name === newName);
    if (duplicate) {
      if (target.score > duplicate.score ||
          (target.score === duplicate.score && target.date < duplicate.date)) {
        duplicate.score = target.score;
        duplicate.date = target.date;
        duplicate.name = newName;
        latestEntryId = duplicate.id;
      }
      const index = entries.indexOf(target);
      if (index !== -1) entries.splice(index, 1);
    } else {
      target.name = newName;
    }
    saveBoard(entries);
  }
  playerNameInput.addEventListener("change", persistPilotName);
  playerNameInput.addEventListener("blur", persistPilotName);

  onPress(overlay, handleFlapInput);
  onPress(canvas, (e) => { if (e.preventDefault) e.preventDefault(); handleFlapInput(e); });
  shell.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => {
    if (e.target === canvas || shell.contains(e.target)) e.preventDefault();
  });

  // Some browsers resume audio only after any interaction, not just game start.
  const unlockOnce = () => { ensureAudio(); window.removeEventListener("keydown", unlockOnce); };
  window.addEventListener("keydown", unlockOnce, { once: true });

  window.addEventListener("keydown", (e) => {
    if (document.activeElement === playerNameInput) return;

    if (!leaderboardOverlay.classList.contains("hidden")) {
      if (["Escape", "Enter", "Space"].includes(e.code)) {
        e.preventDefault();
        closeBoard();
      }
      return;
    }

    if (["Space", "ArrowUp", "KeyW", "Enter"].includes(e.code)) {
      e.preventDefault();
      if (e.repeat) return;
      handleFlapInput();
    } else if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      togglePause();
    }
  });

  function pauseWhenAway() {
    if (state === "playing" || state === "dying") {
      prevState = state;
      state = "paused";
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseWhenAway();
  });
  window.addEventListener("pagehide", pauseWhenAway);

  // ---------- Update ----------
  function update(dt) {
    time += dt;
    groundOffset = (groundOffset + pipeSpeed() * dt) % 48;

    for (const c of clouds) {
      c.x -= c.v * dt;
      if (c.x < -140) { c.x = W + rand(20, 160); c.y = rand(55, 250); }
    }

    if (state === "playing") {
      bird.vy = Math.min(bird.vy + GRAVITY * dt, TERMINAL_V);
      bird.y += bird.vy * dt;
      bird.wing = Math.max(0, bird.wing - dt * 5);
      const target = Math.max(-0.45, Math.min(1.35, bird.vy / 520));
      bird.rot += (target - bird.rot) * Math.min(1, dt * 10);

      if (bird.y - BIRD_R < 0) { bird.y = BIRD_R; bird.vy = 0; }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        addPipe();
        spawnTimer = pipeSpacing() / pipeSpeed();
      }

      const speed = pipeSpeed();
      for (const p of pipes) {
        p.x -= speed * dt;
        if (!p.passed && p.x + PIPE_W < bird.x - BIRD_R) {
          p.passed = true;
          score++;
          sfx.score();
        }
      }
      pipes = pipes.filter((p) => p.x > -CAP_W - 10);

      // Collision — pipe bodies and their wider caps are checked separately.
      if (bird.y + BIRD_R >= groundY()) {
        bird.y = groundY() - BIRD_R;
        gameOver();
      } else {
        const capOverhang = (CAP_W - PIPE_W) / 2;
        for (const p of pipes) {
          const bodyX = bird.x + BIRD_R > p.x && bird.x - BIRD_R < p.x + PIPE_W;
          const capX = bird.x + BIRD_R > p.x - capOverhang &&
                       bird.x - BIRD_R < p.x + PIPE_W + capOverhang;
          const gapBottom = p.top + p.gap;

          const topBody = bodyX && bird.y - BIRD_R < p.top - CAP_H;
          const topCap = capX && bird.y - BIRD_R < p.top &&
                         bird.y + BIRD_R > p.top - CAP_H;
          const bottomCap = capX && bird.y + BIRD_R > gapBottom &&
                            bird.y - BIRD_R < gapBottom + CAP_H;
          const bottomBody = bodyX && bird.y + BIRD_R > gapBottom + CAP_H;

          if (topBody || topCap || bottomCap || bottomBody) {
            gameOver();
            break;
          }
        }
      }
    } else if (state === "dying") {
      deathTimer += dt;
      bird.vy = Math.min(bird.vy + GRAVITY * dt, TERMINAL_V);
      bird.y = Math.min(bird.y + bird.vy * dt, groundY() - BIRD_R);
      bird.rot = Math.min(1.55, bird.rot + dt * 6);
      if (bird.y >= groundY() - BIRD_R && deathTimer > 0.55) finishDeath();
      if (deathTimer > 1.2) finishDeath();
    }

    for (const p of particles) {
      p.life -= dt;
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  // ---------- Rendering ----------
  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, groundY());
    sky.addColorStop(0, "#4ec0ca");
    sky.addColorStop(0.65, "#8fe0d4");
    sky.addColorStop(1, "#d8f0c0");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY());

    // Sun glow
    const sun = ctx.createRadialGradient(400, 90, 5, 400, 90, 90);
    sun.addColorStop(0, "rgba(255,248,200,0.8)");
    sun.addColorStop(1, "rgba(255,248,200,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(300, -10, 200, 200);

    for (const c of clouds) drawCloud(c);
    drawHills();
  }

  function drawCloud(c) {
    const s = c.s;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#ffffff";
    ctx.translate(c.x, c.y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(0, 0, 22, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(24, -8, 28, Math.PI, Math.PI * 2);
    ctx.arc(56, 0, 20, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHills() {
    const layers = [
      { color: "#a8d98a", y: groundY() - 46, amp: 26, len: 210, off: 0.12 },
      { color: "#7fc46b", y: groundY() - 24, amp: 20, len: 160, off: 0.28 }
    ];
    for (const l of layers) {
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(0, groundY());
      const shift = (groundOffset * l.off * 3) % l.len;
      for (let x = -l.len; x <= W + l.len; x += l.len) {
        const cx = x + shift;
        ctx.quadraticCurveTo(cx + l.len * 0.25, l.y - l.amp * 2, cx + l.len * 0.5, l.y);
        ctx.quadraticCurveTo(cx + l.len * 0.75, l.y - l.amp * 1.5, cx + l.len, l.y);
      }
      ctx.lineTo(W, groundY());
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPipe(p) {
    const topH = p.top;
    const bottomY = p.top + p.gap;
    const bodyGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
    bodyGrad.addColorStop(0, "#3e8e25");
    bodyGrad.addColorStop(0.18, "#7fd34a");
    bodyGrad.addColorStop(0.5, "#a7e85e");
    bodyGrad.addColorStop(0.82, "#5fae32");
    bodyGrad.addColorStop(1, "#2f7a1c");
    const capGrad = ctx.createLinearGradient(0, 0, 0, CAP_H);
    capGrad.addColorStop(0, "#a7e85e");
    capGrad.addColorStop(0.5, "#7fd34a");
    capGrad.addColorStop(1, "#3e8e25");

    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#255616";

    // Top pipe body + cap
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(p.x, 0, PIPE_W, topH);
    ctx.strokeRect(p.x, -4, PIPE_W, topH + 4);
    ctx.fillStyle = capGrad;
    ctx.fillRect(p.x - (CAP_W - PIPE_W) / 2, topH - CAP_H, CAP_W, CAP_H);
    ctx.strokeRect(p.x - (CAP_W - PIPE_W) / 2, topH - CAP_H, CAP_W, CAP_H);

    // Bottom pipe body + cap
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(p.x, bottomY, PIPE_W, groundY() - bottomY);
    ctx.strokeRect(p.x, bottomY, PIPE_W, groundY() - bottomY);
    ctx.fillStyle = capGrad;
    ctx.fillRect(p.x - (CAP_W - PIPE_W) / 2, bottomY, CAP_W, CAP_H);
    ctx.strokeRect(p.x - (CAP_W - PIPE_W) / 2, bottomY, CAP_W, CAP_H);

    // Highlights
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(p.x + 12, 0, 8, topH - CAP_H);
    ctx.fillRect(p.x + 12, bottomY + CAP_H, 8, groundY() - bottomY - CAP_H);
    ctx.restore();
  }

  function drawGround() {
    const y = groundY();
    ctx.fillStyle = "#ded895";
    ctx.fillRect(0, y, W, GROUND_H);
    ctx.fillStyle = "#c9c27c";
    for (let x = -groundOffset; x < W + 48; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, y + 30);
      ctx.lineTo(x + 24, y + 30);
      ctx.lineTo(x + 10, y + 44);
      ctx.lineTo(x - 14, y + 44);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#7ac04b";
    ctx.fillRect(0, y, W, 12);
    ctx.fillStyle = "#5a9d36";
    for (let x = -groundOffset; x < W + 32; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y + 12);
      ctx.lineTo(x + 8, y + 4);
      ctx.lineTo(x + 16, y + 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#4b832c";
    ctx.fillRect(0, y + 12, W, 4);
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);
    const flapLift = bird.wing > 0 ? -10 * bird.wing : Math.sin(time * 12) * 2;

    // Tail
    ctx.fillStyle = "#f1a91f";
    ctx.strokeStyle = "#3d2b1f";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-26, -9);
    ctx.lineTo(-23, 3);
    ctx.lineTo(-27, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body
    const bodyGrad = ctx.createLinearGradient(0, -16, 0, 16);
    bodyGrad.addColorStop(0, "#ffe875");
    bodyGrad.addColorStop(1, "#ffbf28");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Belly
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.ellipse(-1, 7, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = "#fff9e8";
    ctx.beginPath();
    ctx.ellipse(-4, 2 + flapLift, 11, 7, -0.25 + flapLift * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eye white
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(9, -7, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Pupil
    ctx.fillStyle = "#2b1d14";
    ctx.beginPath();
    ctx.arc(11, -7, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = "#ff7b32";
    ctx.beginPath();
    ctx.moveTo(16, -1);
    ctx.lineTo(29, 2);
    ctx.lineTo(16, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawScore() {
    if (state === "ready" || state === "over") return;
    ctx.save();
    ctx.font = "900 54px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(61,43,31,0.75)";
    ctx.strokeText(String(score), W / 2, 92);
    ctx.fillStyle = "#fff8dc";
    ctx.fillText(String(score), W / 2, 92);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff8dc";
    ctx.font = "900 46px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", W / 2, H / 2);
    ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
    ctx.fillText("Press P to resume", W / 2, H / 2 + 38);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    for (const p of pipes) drawPipe(p);
    drawGround();
    if (state !== "ready") drawBird();
    drawParticles();
    drawScore();
    if (state === "paused") drawPaused();
  }

  // ---------- Loop ----------
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;
    if (state !== "paused") update(dt);
    render();
    requestAnimationFrame(frame);
  }

  reset();
  showStart();
  requestAnimationFrame(frame);
})();

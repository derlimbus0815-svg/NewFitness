// ---- App-Zustand ----
let state = loadState();

// ---- Navigation ----
const screens = document.querySelectorAll('.screen');
const navBtns = document.querySelectorAll('.nav-btn');

function showScreen(id) {
  screens.forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.screen === id));
  if (id === 'home') renderHome();
  if (id === 'training') renderTraining();
  if (id === 'progress') renderProgress();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

// ---- Toast ----
let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

// ---- Modal ----
function showModal(title, body, onConfirm, confirmLabel = 'Fortfahren', confirmClass = 'btn-danger') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  const confirmBtn = document.getElementById('modal-confirm');
  confirmBtn.className = 'btn ' + confirmClass;
  confirmBtn.textContent = confirmLabel;
  document.getElementById('modal').classList.add('open');
  confirmBtn.onclick = () => { closeModal(); onConfirm(); };
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === document.getElementById('modal')) closeModal();
});

// ---- Hilfsfunktionen ----

// Aktuellen Block (Phase) aus state.phases holen
function getPhase() {
  const blockNum = state.progress.currentBlock;
  return state.phases.find(p => p.blockNumber === blockNum) || state.phases[0];
}

// Übung aus aktuellem oder allen Phasen suchen (für Logs über Blockgrenzen)
function getExerciseGlobal(exerciseId) {
  for (const phase of state.phases) {
    for (const day of phase.days) {
      for (const ex of day.exercises) {
        if (ex.id === exerciseId) return ex;
      }
    }
  }
  return null;
}

// Tagesname für einen Log-Eintrag (phase kann sich geändert haben)
function getDayNameForLog(log) {
  const phase = state.phases.find(p => p.id === log.phaseId) || getPhase();
  const day = phase.days.find(d => d.dayNumber === log.dayNumber);
  return day ? day.name : 'Tag ' + log.dayNumber;
}

function getAnchors() {
  const phase = getPhase();
  const anchors = [];
  for (const day of phase.days) {
    for (const ex of day.exercises) {
      if (ex.isAnchor) anchors.push(ex);
    }
  }
  return anchors;
}

function save() { saveState(state); }

// Wochen im aktuellen Block (aus Einheitenzähler abgeleitet)
function weeksInCurrentBlock() {
  const sessionsInBlock = state.progress.totalSessions - state.progress.blockStartSession;
  return sessionsInBlock / 4;
}

// ---- Block- und Makrozyklus-Wechsel ----

function switchBlock() {
  const p = state.progress;
  const nextBlock = p.currentBlock + 1;

  if (nextBlock > 3) {
    // Makrozyklus abgeschlossen → zurück zu Block 1, Zähler hoch
    p.currentMacrocycle += 1;
    p.currentBlock = 1;
    showToast(`Makrozyklus ${p.currentMacrocycle} beginnt — Anker-Lasten werden übernommen.`, 'success');
  } else {
    p.currentBlock = nextBlock;
  }

  p.blockStartSession = p.totalSessions;
  p.deloadActive = false;
  save();
  sessionStorage.clear();
  renderHome();
  renderTraining();
  showScreen('home');
}

function startDeload() {
  state.progress.deloadActive = true;
  save();
  renderHome();
  showToast('Deload-Woche aktiv — 40 % weniger Volumen, leichtere Lasten.', '');
}

function checkBlockCompletion() {
  const weeks = weeksInCurrentBlock();
  if (weeks >= 6 && !state.progress.deloadActive) {
    // Block abgeschlossen — Deload anbieten
    setTimeout(() => renderHome(), 900);
  }
}

// ---- Sparkline zeichnen ----
function drawSparkline(canvas, data) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth || canvas.parentElement.offsetWidth;
  const h = 30;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  if (!data || data.length < 2) {
    ctx.strokeStyle = '#2A2D31';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    return;
  }

  const vals = data.map(d => d.value);
  const min = Math.min(...vals) * 0.98;
  const max = Math.max(...vals) * 1.02;
  const range = max - min || 1;

  const px = (i) => (i / (data.length - 1)) * w;
  const py = (v) => h - ((v - min) / range) * (h - 4) - 2;

  ctx.strokeStyle = '#B8924A';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  data.forEach((d, i) => {
    i === 0 ? ctx.moveTo(px(i), py(d.value)) : ctx.lineTo(px(i), py(d.value));
  });
  ctx.stroke();

  const lx = px(data.length - 1);
  const ly = py(vals[vals.length - 1]);
  ctx.fillStyle = '#B8924A';
  ctx.beginPath();
  ctx.arc(lx, ly, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Startbildschirm ----
function renderHome() {
  const p = state.progress;
  const phase = getPhase();
  const weeks = weeksInCurrentBlock();
  const blockDone = weeks >= 6;

  document.getElementById('home-subtitle').textContent =
    `Makrozyklus ${p.currentMacrocycle} · Block ${p.currentBlock} · ${phase.name}`;

  document.getElementById('stat-sessions').textContent = p.totalSessions;

  const weekNum = Math.floor(weeks) + 1;
  document.getElementById('stat-week').textContent =
    p.deloadActive ? 'Deload' : (blockDone ? 'Woche 7+' : `Woche ${weekNum}`);

  document.getElementById('block-label').textContent =
    `Block ${p.currentBlock} · ${phase.name} · ${phase.repRangeLabel}`;
  const pct = Math.min((weeks / phase.durationWeeks) * 100, 100);
  document.getElementById('block-weeks').textContent =
    `${Math.floor(weeks)} / ${phase.durationWeeks} Wochen`;
  document.getElementById('block-progress-fill').style.width = pct + '%';

  // Export-Erinnerung
  const sinceExport = sessionsSinceExport(state);
  const reminder = document.getElementById('export-reminder');
  if (sinceExport >= 5) {
    reminder.style.display = 'flex';
    document.getElementById('export-reminder-text').textContent =
      `Letzter Export vor ${sinceExport} Einheiten — Daten sichern!`;
  } else {
    reminder.style.display = 'none';
  }

  // Zusatz-Beintag (Woche 3 im Block)
  const extraLeg = document.getElementById('extra-leg-banner');
  extraLeg.style.display = (!blockDone && !p.deloadActive && Math.floor(weeks) === 2) ? 'flex' : 'none';

  // Deload-Banner
  const deloadBanner = document.getElementById('deload-banner');
  const deloadRunning = document.getElementById('deload-running');
  if (blockDone && !p.deloadActive) {
    deloadBanner.style.display = 'flex';
    deloadRunning.style.display = 'none';
  } else if (p.deloadActive) {
    deloadBanner.style.display = 'none';
    deloadRunning.style.display = 'flex';
    const nextBlockNum = p.currentBlock < 3 ? p.currentBlock + 1 : 1;
    const nextName = p.currentBlock < 3 ? phase.name : 'Grundlage';
    const nextPhase = state.phases.find(ph => ph.blockNumber === nextBlockNum);
    document.getElementById('deload-next-label').textContent =
      `Bereit für Block ${nextBlockNum}${p.currentBlock >= 3 ? ' · Makrozyklus ' + (p.currentMacrocycle + 1) : ''} · ${nextPhase ? nextPhase.name : ''}`;
  } else {
    deloadBanner.style.display = 'none';
    deloadRunning.style.display = 'none';
  }

  // Sparklines
  const anchors = getAnchors();
  const row = document.getElementById('sparkline-row');
  row.innerHTML = '';
  anchors.forEach(ex => {
    const history = oneRMHistory(state.logs, ex.id);
    const current = history.length ? history[history.length - 1].value : 0;

    const card = document.createElement('div');
    card.className = 'sparkline-card';
    card.innerHTML = `
      <div class="ex-name">${ex.name.replace('Langhantel-', '').replace('Langhantel ', '').replace(' mit Zusatzgewicht', '')}</div>
      <div class="ex-value">${current ? current.toFixed(1) + ' <span style="font-size:12px;color:var(--muted)">kg</span>' : '—'}</div>
      <canvas></canvas>
    `;
    row.appendChild(card);

    requestAnimationFrame(() => { drawSparkline(card.querySelector('canvas'), history); });
  });
}

// ---- Training-Bildschirm ----
function renderTraining() {
  const phase = getPhase();
  const container = document.getElementById('training-days');
  container.innerHTML = '';

  // Hinweis bei aktivem Deload
  if (state.progress.deloadActive) {
    const note = document.createElement('div');
    note.className = 'info-banner';
    note.style.marginBottom = '14px';
    note.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span><strong>Deload-Woche</strong> — ca. 40 % weniger Volumen, ca. 60 % der Normallast. Regeneration steht im Vordergrund.</span>
    `;
    container.appendChild(note);
  }

  // 7-Tage-Woche aus WEEK_STRUCTURE
  WEEK_STRUCTURE.forEach(slot => {
    if (slot.type === 'rest') {
      // Pausentag
      const el = document.createElement('div');
      el.className = 'day-block rest-day';
      el.innerHTML = `
        <div class="day-header rest-header">
          <div>
            <div class="day-number">${slot.label}</div>
            <div class="day-name rest-label">Pause</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18" style="color:var(--muted)">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
          </svg>
        </div>
        <div class="rest-hint">10–15 min leichte Mobilität & Dehnung + Spaziergang. Kein Widerstandstraining, nichts bis zur Grenze. Bewegung als Erholung.</div>
      `;
      container.appendChild(el);
      return;
    }

    // Trainingstag
    const day = phase.days.find(d => d.dayNumber === slot.dayNumber);
    if (!day) return;

    const block = document.createElement('div');
    block.className = 'day-block';
    block.dataset.day = day.dayNumber;

    block.innerHTML = `
      <div class="day-header">
        <div>
          <div class="day-number">${slot.label}</div>
          <div class="day-name">${day.name}</div>
        </div>
        <svg class="day-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="day-content" id="day-content-${day.dayNumber}"></div>
    `;

    block.querySelector('.day-header').addEventListener('click', () => {
      const isOpen = block.classList.contains('open');
      document.querySelectorAll('.day-block:not(.rest-day)').forEach(b => b.classList.remove('open'));
      if (!isOpen) {
        block.classList.add('open');
        renderDayContent(day, document.getElementById('day-content-' + day.dayNumber));
      }
    });

    container.appendChild(block);
  });
}

function renderDayContent(day, container) {
  container.innerHTML = '';

  // Warm-up-Block (aufklappbar)
  if (day.warmup && day.warmup.length > 0) {
    const warmupSection = document.createElement('div');
    warmupSection.className = 'warmup-section';
    warmupSection.innerHTML = `
      <button class="warmup-toggle" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14v-4H7l5-8v4h4l-5 8z"/></svg>
        <span>Aufwärmen</span>
        <svg class="warmup-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <ul class="warmup-list" hidden>
        ${day.warmup.map(item => `<li>${item}</li>`).join('')}
      </ul>
    `;
    warmupSection.querySelector('.warmup-toggle').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const list = warmupSection.querySelector('.warmup-list');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      list.hidden = expanded;
      warmupSection.classList.toggle('open', !expanded);
    });
    container.appendChild(warmupSection);
  }

  // Übungen nach Priorität sortieren (1=Anker, 2=Sekundär, 3=Isolation/Core)
  const sortedExercises = [...day.exercises].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));

  sortedExercises.forEach(ex => {
    const item = document.createElement('div');
    item.className = 'exercise-item';
    item.id = 'exercise-' + ex.id;

    const pb = personalBest(state.logs, ex.id);
    const last = lastSessionForExercise(state.logs, ex.id);
    const isLoad = ex.progressionType === 'load';
    const shouldIncrease = isLoad && shouldIncreaseLoad(state.logs, ex.id, ex.repRange[1], ex.targetSets);

    const badgeClass = ex.isAnchor ? '' : 'kb';
    const badgeLabel = ex.isAnchor ? 'Anker'
      : ex.category === 'calisthenics' ? 'Hebel'
      : ex.category === 'kettlebell'   ? 'Kettlebell'
      : ex.category === 'core'         ? 'Core'
      : '';

    let lastTimeHtml = '';
    if (last) {
      const summary = isLoad
        ? last.sets.map(s => `${s.reps}×${s.weight}kg`).join('  ')
        : last.sets.map(s => `${s.reps} Wdh (Stufe ${s.level ?? 1})`).join('  ');
      lastTimeHtml = `<div class="last-time">Letztes Mal: <span class="highlight">${summary}</span></div>`;
    }

    const suggestionHtml = shouldIncrease
      ? `<div class="suggestion">→ +2,5 kg fällig — alle Sätze oben im Fenster</div>` : '';

    item.innerHTML = `
      <div class="exercise-header">
        <div class="exercise-meta">
          <div class="exercise-name ${ex.isAnchor ? 'is-anchor' : ''}">${ex.name}</div>
          <div class="exercise-sub">${ex.targetSets} Sätze · ${ex.repRange[0]}–${ex.repRange[1]} Wdh${ex.notes ? ' · ' + ex.notes : ''}</div>
        </div>
        ${badgeLabel ? `<span class="badge ${badgeClass}">${badgeLabel}</span>` : ''}
      </div>
      ${lastTimeHtml}
      ${suggestionHtml}
      <div class="sets-area" id="sets-${ex.id}"></div>
    `;

    container.appendChild(item);
    renderSetsArea(ex, day, pb);
  });

  const footer = document.createElement('div');
  footer.style.cssText = 'padding: 14px 16px;';
  const bw = state.settings && state.settings.bodyweightKg;
  footer.innerHTML = `
    ${bw ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <label style="font-size:13px;color:var(--muted);flex:1">Dauer (grobe Schätzung)</label>
      <input type="number" id="duration-input-${day.dayNumber}" inputmode="decimal" min="1" max="300" placeholder="60"
        style="width:64px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:7px 8px;color:var(--text);font-family:inherit;font-size:15px;font-variant-numeric:tabular-nums;text-align:center" />
      <span style="font-size:13px;color:var(--muted)">min</span>
    </div>` : ''}
    <button class="btn btn-primary btn-full" id="finish-day-${day.dayNumber}">Einheit abschließen</button>
  `;
  container.appendChild(footer);

  footer.querySelector('button').addEventListener('click', () => {
    const durInput = document.getElementById('duration-input-' + day.dayNumber);
    const dur = durInput ? parseFloat(durInput.value) || null : null;
    finishDay(day, dur);
  });
}

// ---- Satz-Eingabe ----
function renderSetsArea(ex, day, pb) {
  const area = document.getElementById('sets-' + ex.id);
  if (!area) return;

  let activeSets = getActiveSets(ex.id, day.dayNumber);
  if (activeSets.length === 0) {
    const last = lastSessionForExercise(state.logs, ex.id);
    // Bei Deload: Standardsätze halbieren (abgerundet, mind. 2)
    const isDeload = state.progress.deloadActive;
    const count = isDeload ? Math.max(2, Math.floor(ex.targetSets / 2)) : ex.targetSets;
    for (let i = 0; i < count; i++) {
      const prev = last && last.sets[i];
      // Bei Deload: Gewicht auf 60 % vorausfüllen
      const prevWeight = prev ? prev.weight : '';
      const deloadWeight = isDeload && prevWeight ? Math.round(prevWeight * 0.6 / 2.5) * 2.5 : prevWeight;
      activeSets.push({
        exerciseId: ex.id,
        setNumber: i + 1,
        reps: prev ? (isDeload ? Math.max(1, Math.floor(prev.reps * 0.6)) : prev.reps) : '',
        weight: deloadWeight,
        level: prev ? prev.level : 1,
      });
    }
    setActiveSets(ex.id, day.dayNumber, activeSets);
  }

  const isLoad = ex.progressionType === 'load';
  const ladder = LEVERAGE_LADDERS[ex.id] || [{ level: 1, name: 'Standard' }];

  area.innerHTML = `
    <div class="set-row header-row">
      <span></span>
      <span>Wdh</span>
      <span>${isLoad ? 'kg' : 'Stufe'}</span>
      <span>1RM</span>
      <span></span>
    </div>
  `;

  activeSets.forEach((set, idx) => {
    const row = document.createElement('div');
    row.className = 'set-row';
    row.dataset.setIdx = idx;

    const rm = isLoad && set.weight && set.reps
      ? estimatedOneRM(parseFloat(set.weight), parseInt(set.reps)).toFixed(1)
      : '—';

    const isPB = isLoad && pb && set.weight && parseFloat(set.weight) > pb.weight;

    if (isLoad) {
      row.innerHTML = `
        <span class="set-num">${idx + 1}</span>
        <input class="set-input ${isPB ? 'pb' : ''}" type="number" inputmode="decimal"
          placeholder="${ex.repRange[0]}" value="${set.reps !== '' ? set.reps : ''}"
          data-field="reps" step="1" min="0" />
        <input class="set-input ${isPB ? 'pb' : ''}" type="number" inputmode="decimal"
          placeholder="kg" value="${set.weight !== '' ? set.weight : ''}"
          data-field="weight" step="2.5" min="0" />
        <span class="set-rm">${rm}</span>
        <button class="set-delete" data-idx="${idx}" title="Satz löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
    } else {
      const opts = ladder.map(l =>
        `<option value="${l.level}" ${(set.level ?? 1) == l.level ? 'selected' : ''}>${l.name}</option>`
      ).join('');
      row.innerHTML = `
        <span class="set-num">${idx + 1}</span>
        <input class="set-input" type="number" inputmode="decimal"
          placeholder="${ex.repRange[0]}" value="${set.reps !== '' ? set.reps : ''}"
          data-field="reps" step="1" min="0" />
        <select class="set-select" data-field="level">${opts}</select>
        <span class="set-rm">—</span>
        <button class="set-delete" data-idx="${idx}" title="Satz löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
    }

    // Live-Aktualisierung: 1RM + PB-Markierung beim Tippen
    row.querySelectorAll('.set-input, .set-select').forEach(input => {
      const update = () => {
        const val = input.type === 'number' ? parseFloat(input.value) || '' : parseInt(input.value);
        activeSets[idx][input.dataset.field] = val;
        setActiveSets(ex.id, day.dayNumber, activeSets);

        if (isLoad) {
          const r = parseFloat(activeSets[idx].reps);
          const w = parseFloat(activeSets[idx].weight);
          // 1RM live
          const rmSpan = row.querySelector('.set-rm');
          if (r && w) rmSpan.textContent = estimatedOneRM(w, r).toFixed(1);

          // PB live: Eingabe-Gewicht > bisheriger Bestwert?
          const weightInput = row.querySelector('[data-field="weight"]');
          const repsInput = row.querySelector('[data-field="reps"]');
          const newPB = pb && w && w > pb.weight;
          weightInput.classList.toggle('pb', !!newPB);
          repsInput.classList.toggle('pb', !!newPB);

          // PB-Label direkt nach dem Eingabefeld zeigen
          let pbLabel = row.querySelector('.pb-inline');
          if (newPB) {
            if (!pbLabel) {
              pbLabel = document.createElement('span');
              pbLabel.className = 'pb-inline';
              pbLabel.textContent = 'PR';
              rmSpan.after(pbLabel);
            }
          } else {
            pbLabel && pbLabel.remove();
          }
        }
      };
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    });

    // Satz löschen
    row.querySelector('.set-delete').addEventListener('click', () => {
      activeSets.splice(idx, 1);
      setActiveSets(ex.id, day.dayNumber, activeSets);
      renderSetsArea(ex, day, pb);
    });

    area.appendChild(row);
  });

  // Satz hinzufügen
  const addBtn = document.createElement('button');
  addBtn.className = 'add-set-btn';
  addBtn.textContent = '+ Satz hinzufügen';
  addBtn.addEventListener('click', () => {
    const lastSet = activeSets[activeSets.length - 1];
    activeSets.push({
      exerciseId: ex.id,
      setNumber: activeSets.length + 1,
      reps: lastSet ? lastSet.reps : '',
      weight: lastSet ? lastSet.weight : '',
      level: lastSet ? lastSet.level : 1,
    });
    setActiveSets(ex.id, day.dayNumber, activeSets);
    renderSetsArea(ex, day, pb);
  });
  area.appendChild(addBtn);
}

// ---- Aktive Sätze (sessionStorage) ----
function activeKey(exerciseId, dayNumber) { return `active-${dayNumber}-${exerciseId}`; }
function getActiveSets(exerciseId, dayNumber) {
  try { return JSON.parse(sessionStorage.getItem(activeKey(exerciseId, dayNumber))) || []; }
  catch { return []; }
}
function setActiveSets(exerciseId, dayNumber, sets) {
  sessionStorage.setItem(activeKey(exerciseId, dayNumber), JSON.stringify(sets));
}
function clearActiveSets(dayNumber) {
  getPhase().days.forEach(day => {
    day.exercises.forEach(ex => sessionStorage.removeItem(activeKey(ex.id, dayNumber)));
  });
}

// ---- Einheit abschließen ----
function finishDay(day, durationMin = null) {
  const phase = getPhase();
  const allSets = [];

  day.exercises.forEach(ex => {
    getActiveSets(ex.id, day.dayNumber).forEach((s, i) => {
      if ((s.reps && s.weight) || (s.reps && s.level)) {
        allSets.push({
          exerciseId: ex.id,
          setNumber: i + 1,
          reps: s.reps || 0,
          weight: s.weight || null,
          level: s.level || null,
        });
      }
    });
  });

  if (allSets.length === 0) {
    showToast('Keine Daten eingetragen.', 'error');
    return;
  }

  state.logs.push({
    id: 'log-' + Date.now(),
    date: new Date().toISOString().slice(0, 10),
    phaseId: phase.id,
    dayNumber: day.dayNumber,
    sets: allSets,
    durationMin: durationMin || null,
  });

  state.progress.totalSessions = state.logs.length;
  save();
  clearActiveSets(day.dayNumber);

  showToast('Einheit gespeichert!', 'success');
  checkBlockCompletion();

  setTimeout(() => {
    renderTraining();
    showScreen('home');
  }, 800);
}

// ---- Fortschritt-Bildschirm ----
function renderProgress() {
  const anchors = getAnchors();
  const list = document.getElementById('anchor-list');
  list.innerHTML = '';

  anchors.forEach(ex => {
    const history = oneRMHistory(state.logs, ex.id);
    const current = history.length ? history[history.length - 1].value : null;
    const first = history.length ? history[0].value : null;
    const delta = current && first && current !== first ? (current - first).toFixed(1) : null;

    const row = document.createElement('div');
    row.className = 'anchor-progress';
    row.innerHTML = `
      <div class="anchor-row">
        <span class="name">${ex.name}</span>
        <span class="rm">${current ? current.toFixed(1) : '—'}<span class="unit">kg</span>
          ${delta && parseFloat(delta) > 0
            ? `<span style="font-size:12px;color:var(--positive);margin-left:6px">+${delta}</span>`
            : ''}
        </span>
      </div>
    `;
    list.appendChild(row);
  });

  // Block-Fortschritt
  const p = state.progress;
  document.getElementById('progress-subtitle').textContent =
    `${p.totalSessions} Einheiten · Makrozyklus ${p.currentMacrocycle} Block ${p.currentBlock}`;

  // Letzte Logs
  const recentEl = document.getElementById('recent-logs');
  recentEl.innerHTML = '';
  const recent = [...state.logs].reverse().slice(0, 10);
  if (recent.length === 0) {
    recentEl.innerHTML = '<div style="color:var(--muted);font-size:13px">Noch keine Einheiten protokolliert.</div>';
    return;
  }
  const bw = state.settings && state.settings.bodyweightKg;
  recent.forEach(log => {
    const dayName = getDayNameForLog(log);
    const tonnage = sessionTonnage(log);
    const kcal = estimatedKcal(bw, log.durationMin);
    const div = document.createElement('div');
    div.style.cssText = 'padding: 8px 0; border-bottom: 1px solid var(--border);';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-size:14px">${dayName}</span>
        <span style="font-size:12px;color:var(--muted)">${log.date}</span>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px">
        ${log.sets.length} Sätze${tonnage > 0 ? ' · ' + tonnage.toFixed(0) + ' kg Tonnage' : ''}${kcal ? ' · <span style="color:var(--muted)">~' + kcal + ' kcal ±</span>' : ''}
      </div>
    `;
    recentEl.appendChild(div);
  });
}

// ---- Körpergewicht ----
function initBodyweightInput() {
  const input = document.getElementById('input-bodyweight');
  if (!input) return;
  if (state.settings && state.settings.bodyweightKg) {
    input.value = state.settings.bodyweightKg;
  }
  input.addEventListener('change', () => {
    const val = parseFloat(input.value);
    if (val >= 30 && val <= 250) {
      if (!state.settings) state.settings = {};
      state.settings.bodyweightKg = val;
      save();
      showToast('Körpergewicht gespeichert.', 'success');
    }
  });
}

// ---- Export ----
document.getElementById('btn-export').addEventListener('click', () => {
  exportState(state);
  state.progress.lastExportAtSession = state.progress.totalSessions;
  save();
  showToast('Export gespeichert.', 'success');
  renderHome();
});

// ---- Import ----
document.getElementById('btn-import-trigger').addEventListener('click', () => {
  document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  showModal(
    'Daten importieren',
    'Das überschreibt deinen aktuellen Stand vollständig. Fortfahren?',
    async () => {
      try {
        state = await importState(file);
        save();
        renderHome();
        renderTraining();
        showToast('Import erfolgreich.', 'success');
      } catch (err) {
        showToast('Fehler: ' + err.message, 'error');
      }
    },
    'Importieren',
    'btn-primary'
  );
});

// ---- Reset ----
document.getElementById('btn-reset').addEventListener('click', () => {
  showModal(
    'Alle Daten löschen',
    'Setzt die App vollständig zurück. Alle Logs und Fortschritte gehen verloren.',
    () => {
      state = createInitialState();
      save();
      sessionStorage.clear();
      renderHome();
      renderTraining();
      showToast('Daten gelöscht.', '');
    }
  );
});

// ---- Deload-Buttons ----
document.getElementById('btn-start-deload').addEventListener('click', startDeload);
document.querySelectorAll('.js-next-block').forEach(btn => btn.addEventListener('click', () => {
  const p = state.progress;
  const nextBlock = p.currentBlock < 3 ? p.currentBlock + 1 : 1;
  const isCycleEnd = p.currentBlock >= 3;
  const title = isCycleEnd
    ? `Makrozyklus ${p.currentMacrocycle + 1} beginnen`
    : `Block ${nextBlock} beginnen`;
  const body = isCycleEnd
    ? `Block 3 ist abgeschlossen. Der nächste Makrozyklus startet mit Block 1 — Grundlage. Die Anker-Gewichte werden aus deinen Logs übernommen.`
    : `Block ${nextBlock} beginnen. Die Anker-Gewichte werden aus deinen Logs übernommen. Das Zubehör wechselt.`;

  showModal(title, body, switchBlock, title, 'btn-primary');
}));

// ---- Service Worker ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---- Init ----
renderHome();
renderTraining();
initBodyweightInput();

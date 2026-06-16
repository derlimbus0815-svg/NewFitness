// Datenschicht — localStorage-Schlüssel
const STORAGE_KEY = 'limbus-training-v1';

// Initiales Zustandsobjekt
function createInitialState() {
  return {
    version: 2,
    progress: {
      totalSessions: 0,
      currentMacrocycle: 1,
      currentBlock: 1,
      blockStartSession: 0,
      deloadActive: false,
      lastExportAtSession: 0,
    },
    settings: {
      bodyweightKg: null,
    },
    phases: buildPhases(),
    logs: [],
  };
}

// Zustand laden + migrieren
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.logs) return createInitialState();
    return migrateState(parsed);
  } catch {
    return createInitialState();
  }
}

// Migration: fehlende Felder ergänzen, Phasen 2+3 nachrüsten
function migrateState(s) {
  // v1 → v2: neue Progress-Felder
  if (!s.progress.blockStartSession) s.progress.blockStartSession = 0;
  if (s.progress.deloadActive === undefined) s.progress.deloadActive = false;
  // settings
  if (!s.settings) s.settings = { bodyweightKg: null };

  // Sicherstellen dass alle 3 Phasen vorhanden sind
  const fresh = buildPhases();
  const existingIds = new Set((s.phases || []).map(p => p.id));
  fresh.forEach(p => { if (!existingIds.has(p.id)) s.phases.push(p); });

  s.version = 2;
  return s;
}

// Speichern in localStorage
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('Fehler beim Speichern: ' + e.message);
  }
}

// Export als .json-Datei
function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `limbus-training-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import aus .json-Datei — gibt Promise<state> zurück
function importState(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || !parsed.logs) {
          reject(new Error('Ungültiges Dateiformat'));
          return;
        }
        resolve(migrateState(parsed));
      } catch {
        reject(new Error('Datei konnte nicht gelesen werden'));
      }
    };
    reader.onerror = () => reject(new Error('Lesefehler'));
    reader.readAsText(file);
  });
}

// ---- Phasendaten §3 + §4 ----

function buildPhases() {
  return [

    // ============================================================
    // BLOCK 1 — Grundlage  (6 Wochen, 6–8 Wdh Anker)
    // ============================================================
    {
      id: 'block-1',
      name: 'Grundlage',
      blockNumber: 1,
      durationWeeks: 6,
      repRangeLabel: '6–8 · Grundkraft',
      days: [
        {
          dayNumber: 1,
          name: 'Beine (schwer)',
          exercises: [
            { id: 'squat',        name: 'Langhantel-Kniebeuge',               category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 4, repRange: [6, 8],   notes: 'Anker. Kontrolliert exzentrisch.' },
            { id: 'bss',          name: 'Bulgarische Split Squats',            category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [8, 12],  notes: 'Kettlebell. Pro Seite.' },
            { id: 'heel-squat',   name: 'Fersenerhöhte Kniebeuge',             category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [8, 12],  notes: 'Fersen auf Scheibe.' },
            { id: 'calf-raise',   name: 'Wadenheben',                          category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [12, 15], notes: '' },
          ],
        },
        {
          dayNumber: 2,
          name: 'Druck (Brust / Schulter / Trizeps)',
          exercises: [
            { id: 'bench',        name: 'Langhantel-Bankdrücken',              category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 4, repRange: [6, 8],   notes: 'Anker.' },
            { id: 'pushup',       name: 'Liegestütze an Parallettes',          category: 'calisthenics',isAnchor: false, progressionType: 'leverage', targetSets: 6, repRange: [6, 12],  notes: 'Nahe Grenze. Hebel-Progression.' },
            { id: 'dip',          name: 'Trizeps-Stütz / Dips an Parallettes', category: 'calisthenics',isAnchor: false, progressionType: 'leverage', targetSets: 4, repRange: [6, 12],  notes: 'Hebel-Progression.' },
            { id: 'goblet',       name: 'Goblet Squat (Kettlebell)',            category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: 'Leicht, kontrolliert. Kniegesundheit.' },
          ],
        },
        {
          dayNumber: 3,
          name: 'Zug / hintere Kette (schwer)',
          exercises: [
            { id: 'deadlift',     name: 'Langhantel-Kreuzheben',               category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 4, repRange: [6, 8],   notes: 'Anker.' },
            { id: 'row',          name: 'Langhantelrudern vorgebeugt',          category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [6, 10],  notes: '' },
            { id: 'rear-delt',    name: 'Vorgebeugtes Seitheben (Kettlebell)', category: 'kettlebell',   isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [12, 15], notes: 'Hintere Schulter.' },
            { id: 'kb-swing',     name: 'Kettlebell-Swings',                   category: 'kettlebell',   isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [10, 15], notes: '' },
            { id: 'biceps-curl',  name: 'Bizeps-Curls (Langhantel)',            category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [8, 12],  notes: '1× pro Woche.' },
          ],
        },
        {
          dayNumber: 4,
          name: 'Oberkörper gemischt',
          exercises: [
            { id: 'pullup',       name: 'Klimmzüge mit Zusatzgewicht',         category: 'calisthenics',isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [4, 8],   notes: 'Anker-artig. Last-Progression.' },
            { id: 'ohp',          name: 'Langhantel Overhead Press',            category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 4, repRange: [6, 8],   notes: 'Anker.' },
            { id: 'lunges',       name: 'Gehende Ausfallschritte',              category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: 'Leicht, kontrolliert.' },
            { id: 'plank',        name: 'Plank-Variationen',                   category: 'core',         isAnchor: false, progressionType: 'leverage', targetSets: 3, repRange: [30, 60], notes: 'Sekunden je Satz.' },
          ],
        },
      ],
    },

    // ============================================================
    // BLOCK 2 — Aufbau  (6 Wochen, Hypertrophie, 5 Übungen/Tag)
    // ============================================================
    {
      id: 'block-2',
      name: 'Aufbau',
      blockNumber: 2,
      durationWeeks: 6,
      repRangeLabel: '8–12 · Hypertrophie',
      days: [
        {
          dayNumber: 1,
          name: 'Beine + Hüfte (schwer)',
          exercises: [
            { id: 'squat',        name: 'Langhantel-Kniebeuge',               category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 4, repRange: [6, 8],   notes: 'Anker. Last von Block 1 fortführen.' },
            { id: 'bss',          name: 'Bulgarische Split Squats',            category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [8, 12],  notes: 'Kettlebell. Mehr Volumen.' },
            { id: 'heel-squat',   name: 'Fersenerhöhte Kniebeuge',             category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: '' },
            { id: 'calf-raise',   name: 'Wadenheben',                          category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [12, 20], notes: '' },
            { id: 'clean-press',  name: 'Clean and Press (Kettlebell)',        category: 'kettlebell',   isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [5, 8],   notes: 'Neu aus Rotationspool. Pro Seite.' },
          ],
        },
        {
          dayNumber: 2,
          name: 'Druck (Brust / Schulter / Trizeps)',
          exercises: [
            { id: 'bench',        name: 'Langhantel-Bankdrücken',              category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 4, repRange: [6, 8],   notes: 'Anker.' },
            { id: 'pushup',       name: 'Liegestütze an Parallettes',          category: 'calisthenics',isAnchor: false, progressionType: 'leverage', targetSets: 6, repRange: [6, 12],  notes: 'Eine Stufe schwerer als Block 1.' },
            { id: 'dip',          name: 'Trizeps-Stütz / Dips an Parallettes', category: 'calisthenics',isAnchor: false, progressionType: 'leverage', targetSets: 4, repRange: [6, 12],  notes: 'Eine Stufe schwerer als Block 1.' },
            { id: 'goblet',       name: 'Goblet Squat (Kettlebell)',            category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: 'Kniegesundheit.' },
            { id: 'incline-press',name: 'Schrägdrücken Kettlebell',            category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: 'Obere Brust. Auf Bank oder Boden.' },
          ],
        },
        {
          dayNumber: 3,
          name: 'Zug / hintere Kette (schwer)',
          exercises: [
            { id: 'deadlift',     name: 'Langhantel-Kreuzheben',               category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 4, repRange: [6, 8],   notes: 'Anker.' },
            { id: 'row',          name: 'Langhantelrudern vorgebeugt',          category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [8, 12],  notes: 'Mehr Wdh als Block 1.' },
            { id: 'rear-delt',    name: 'Vorgebeugtes Seitheben (Kettlebell)', category: 'kettlebell',   isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [12, 15], notes: 'Hintere Schulter.' },
            { id: 'turkish-gu',   name: 'Turkish Get-Up (Kettlebell)',          category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [3, 5],   notes: 'Neu aus Rotationspool. Pro Seite, langsam und kontrolliert.' },
            { id: 'biceps-curl',  name: 'Bizeps-Curls (Langhantel)',            category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: '' },
          ],
        },
        {
          dayNumber: 4,
          name: 'Oberkörper gemischt',
          exercises: [
            { id: 'pullup',       name: 'Klimmzüge mit Zusatzgewicht',         category: 'calisthenics',isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [4, 8],   notes: 'Last von Block 1 fortführen.' },
            { id: 'ohp',          name: 'Langhantel Overhead Press',            category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 4, repRange: [6, 8],   notes: 'Anker.' },
            { id: 'lunges',       name: 'Gehende Ausfallschritte',              category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: 'Kontrolliert.' },
            { id: 'lateral-raise',name: 'Seitheben (Kettlebell)',               category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [12, 15], notes: 'Mittlere Schulter. Leicht.' },
            { id: 'plank',        name: 'Plank-Variationen',                   category: 'core',         isAnchor: false, progressionType: 'leverage', targetSets: 3, repRange: [30, 60], notes: 'Eine Stufe schwerer als Block 1.' },
          ],
        },
      ],
    },

    // ============================================================
    // BLOCK 3 — Kraft  (6 Wochen, 3–5 Wdh, nahe Maximum)
    // ============================================================
    {
      id: 'block-3',
      name: 'Kraft',
      blockNumber: 3,
      durationWeeks: 6,
      repRangeLabel: '3–5 · Intensität',
      days: [
        {
          dayNumber: 1,
          name: 'Beine (Intensität)',
          exercises: [
            { id: 'squat',        name: 'Langhantel-Kniebeuge',               category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 5, repRange: [3, 5],   notes: 'Anker. Nahe Maximum.' },
            { id: 'bss',          name: 'Bulgarische Split Squats',            category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [5, 8],   notes: 'Schwerer als Block 2.' },
            { id: 'clean-press',  name: 'Clean and Press (Kettlebell)',        category: 'kettlebell',   isAnchor: false, progressionType: 'load',     targetSets: 4, repRange: [3, 6],   notes: 'Intensität steigern.' },
            { id: 'heel-squat',   name: 'Fersenerhöhte Kniebeuge',             category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [5, 8],   notes: '' },
            { id: 'calf-raise',   name: 'Wadenheben',                          category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [8, 12],  notes: '' },
          ],
        },
        {
          dayNumber: 2,
          name: 'Druck (Intensität)',
          exercises: [
            { id: 'bench',        name: 'Langhantel-Bankdrücken',              category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 5, repRange: [3, 5],   notes: 'Anker. Nahe Maximum.' },
            { id: 'pushup',       name: 'Liegestütze an Parallettes',          category: 'calisthenics',isAnchor: false, progressionType: 'leverage', targetSets: 5, repRange: [3, 8],   notes: 'Schwerste Stufe des Zyklus.' },
            { id: 'dip',          name: 'Trizeps-Stütz / Dips an Parallettes', category: 'calisthenics',isAnchor: false, progressionType: 'leverage', targetSets: 4, repRange: [3, 8],   notes: 'Schwerste Stufe.' },
            { id: 'goblet',       name: 'Goblet Squat (Kettlebell)',            category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [8, 12],  notes: 'Kniegesundheit, bleibt moderat.' },
            { id: 'incline-press',name: 'Schrägdrücken Kettlebell',            category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [8, 12],  notes: '' },
          ],
        },
        {
          dayNumber: 3,
          name: 'Zug / hintere Kette (Intensität)',
          exercises: [
            { id: 'deadlift',     name: 'Langhantel-Kreuzheben',               category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 5, repRange: [3, 5],   notes: 'Anker. Nahe Maximum.' },
            { id: 'row',          name: 'Langhantelrudern vorgebeugt',          category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 5, repRange: [4, 6],   notes: 'Schwerer und weniger Wdh.' },
            { id: 'turkish-gu',   name: 'Turkish Get-Up (Kettlebell)',          category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [3, 5],   notes: 'Gewicht steigern.' },
            { id: 'rear-delt',    name: 'Vorgebeugtes Seitheben (Kettlebell)', category: 'kettlebell',   isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: 'Bleibt moderat.' },
            { id: 'biceps-curl',  name: 'Bizeps-Curls (Langhantel)',            category: 'barbell',     isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [6, 10],  notes: '' },
          ],
        },
        {
          dayNumber: 4,
          name: 'Oberkörper (Intensität)',
          exercises: [
            { id: 'pullup',       name: 'Klimmzüge mit Zusatzgewicht',         category: 'calisthenics',isAnchor: false, progressionType: 'load',     targetSets: 5, repRange: [3, 6],   notes: 'Nahe Maximum.' },
            { id: 'ohp',          name: 'Langhantel Overhead Press',            category: 'barbell',     isAnchor: true,  progressionType: 'load',     targetSets: 5, repRange: [3, 5],   notes: 'Anker. Nahe Maximum.' },
            { id: 'lunges',       name: 'Gehende Ausfallschritte',              category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [8, 12],  notes: 'Moderat.' },
            { id: 'lateral-raise',name: 'Seitheben (Kettlebell)',               category: 'kettlebell',  isAnchor: false, progressionType: 'load',     targetSets: 3, repRange: [10, 15], notes: '' },
            { id: 'plank',        name: 'Plank-Variationen',                   category: 'core',         isAnchor: false, progressionType: 'leverage', targetSets: 3, repRange: [30, 60], notes: 'Schwerste Stufe.' },
          ],
        },
      ],
    },

  ];
}

// Schwierigkeitsleitern für Hebel-Übungen
const LEVERAGE_LADDERS = {
  'pushup': [
    { level: 1, name: 'Parallettes flach' },
    { level: 2, name: 'Füße erhöht' },
    { level: 3, name: 'Archer Liegestütz' },
    { level: 4, name: 'Einarmige Vorstufen' },
    { level: 5, name: 'Mit Zusatzgewicht' },
  ],
  'dip': [
    { level: 1, name: 'Körpergewicht' },
    { level: 2, name: 'Kettlebell zwischen den Füßen' },
  ],
  'plank': [
    { level: 1, name: 'Standard Plank' },
    { level: 2, name: 'Einarmiger Plank' },
    { level: 3, name: 'RKC Plank' },
  ],
};

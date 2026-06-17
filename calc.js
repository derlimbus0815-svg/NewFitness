// Berechnungen — alle abgeleitet aus logs, nichts gespeichert

// Epley-Formel: Gewicht × (1 + Wdh ÷ 30)
function estimatedOneRM(weight, reps) {
  if (reps === 1) return weight;
  return Math.round((weight * (1 + reps / 30)) * 10) / 10;
}

// Bestes geschätztes 1RM je Übung über alle Logs
function bestOneRM(logs, exerciseId) {
  let best = 0;
  for (const log of logs) {
    for (const set of log.sets) {
      if (set.exerciseId === exerciseId && set.weight && set.reps) {
        const rm = estimatedOneRM(set.weight, set.reps);
        if (rm > best) best = rm;
      }
    }
  }
  return best;
}

// 1RM-Verlauf je Anker (eine Zahl pro Einheit)
function oneRMHistory(logs, exerciseId) {
  return logs
    .map((log) => {
      let best = 0;
      for (const set of log.sets) {
        if (set.exerciseId === exerciseId && set.weight && set.reps) {
          const rm = estimatedOneRM(set.weight, set.reps);
          if (rm > best) best = rm;
        }
      }
      return best > 0 ? { date: log.date, value: best } : null;
    })
    .filter(Boolean);
}

// Tonnage einer Einheit
function sessionTonnage(log) {
  return log.sets.reduce((sum, s) => {
    if (s.weight && s.reps) return sum + s.weight * s.reps;
    return sum;
  }, 0);
}

// Bestleistung je Übung: höchstes Gewicht × bester Einzel-Satz
function personalBest(logs, exerciseId) {
  let best = { weight: 0, reps: 0, date: null };
  for (const log of logs) {
    for (const set of log.sets) {
      if (set.exerciseId === exerciseId && set.weight) {
        if (set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) {
          best = { weight: set.weight, reps: set.reps, date: log.date };
        }
      }
    }
  }
  return best.date ? best : null;
}

// Letzter Log für eine bestimmte Übung
function lastSessionForExercise(logs, exerciseId) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const sets = logs[i].sets.filter((s) => s.exerciseId === exerciseId);
    if (sets.length > 0) return { date: logs[i].date, sets };
  }
  return null;
}

// Doppelte Progression: Vorschlag ob +2,5 kg fällig
// Gibt true zurück wenn alle Sätze im letzten Log das obere Ende des Fensters erreichten
function shouldIncreaseLoad(logs, exerciseId, repRangeMax, targetSets) {
  const last = lastSessionForExercise(logs, exerciseId);
  if (!last || last.sets.length < targetSets) return false;
  return last.sets.every((s) => s.reps >= repRangeMax);
}

// Detaillierte Lastempfehlung für doppelte Progression
// returns { type: 'increase'|'hold'|'mixed', workingWeight, nextWeight?, increment?, reason? }
function loadRecommendation(logs, ex) {
  const last = lastSessionForExercise(logs, ex.id);
  if (!last || last.sets.length === 0) return null;

  const [, repMax] = ex.repRange;
  const weights = last.sets.map(s => s.weight).filter(w => w > 0);
  if (weights.length === 0) return null;

  const allSameWeight = weights.every(w => w === weights[0]);
  if (!allSameWeight) {
    return { type: 'mixed', workingWeight: Math.max(...weights) };
  }

  const workingWeight = weights[0];
  const allAtTop = last.sets.every(s => s.reps >= repMax);

  // Oberkörper: 2,5 kg, Unterkörper: 5 kg
  const upperBodyIds = ['bench', 'ohp', 'dip', 'pushup', 'row', 'curl', 'fly', 'press'];
  const isUpper = upperBodyIds.some(k => ex.id.includes(k)) || ex.category === 'calisthenics';
  const increment = isUpper ? 2.5 : 5;

  if (allAtTop) {
    return { type: 'increase', workingWeight, nextWeight: workingWeight + increment, increment };
  }
  return { type: 'hold', workingWeight, repMax, targetSets: ex.targetSets };
}

// Aufwärmrampe: Stufen vom Leergewicht bis ~80% des Arbeitsgewichts
function warmupRamp(workingWeight) {
  if (!workingWeight || workingWeight <= 20) return [];
  const round25 = w => Math.round(w / 2.5) * 2.5;
  const candidates = [
    { weight: 20,                         reps: 8,  label: 'Leere Stange (20 kg)' },
    { weight: round25(workingWeight * 0.4), reps: 5 },
    { weight: round25(workingWeight * 0.6), reps: 3 },
    { weight: round25(workingWeight * 0.8), reps: 2 },
  ];
  const seen = new Set();
  return candidates.filter(s => {
    if (s.weight >= workingWeight) return false;
    if (s.weight < 20) return false;
    if (seen.has(s.weight)) return false;
    seen.add(s.weight);
    return true;
  });
}

// Calisthenics-Empfehlung: nächste Stufe wenn Ziel-Wdh auf aktueller Stufe erreicht
function leverageRecommendation(logs, ex) {
  const last = lastSessionForExercise(logs, ex.id);
  if (!last || last.sets.length === 0) return null;
  const ladder = LEVERAGE_LADDERS && LEVERAGE_LADDERS[ex.id];
  if (!ladder) return null;
  const [, repMax] = ex.repRange;
  const currentLevel = last.sets[0]?.level ?? 1;
  const allAtTop = last.sets.every(s => s.reps >= repMax && (s.level ?? 1) === currentLevel);
  if (!allAtTop) return null;
  const nextEntry = ladder.find(l => l.level === currentLevel + 1);
  if (!nextEntry) return { type: 'mastered' };
  return { type: 'advance', nextLevel: nextEntry.name, nextLevelNum: currentLevel + 1 };
}

// Grobe Kalorienabschätzung — MET × 3,5 × kg / 200 × min
// MET 5.0 = moderate Krafttraining (ACSM-Referenz)
function estimatedKcal(bodyweightKg, durationMin) {
  if (!bodyweightKg || !durationMin) return null;
  return Math.round(5.0 * 3.5 * bodyweightKg / 200 * durationMin);
}

// Einheiten seit letztem Export
function sessionsSinceExport(state) {
  return state.progress.totalSessions - state.progress.lastExportAtSession;
}

// Woche im aktuellen Block (0-basiert → angezeigt 1-basiert)
function currentWeekInBlock(logs, blockStartSession) {
  // Grobe Näherung: 4 Einheiten = 1 Woche
  const sessionsInBlock = logs.length - blockStartSession;
  return Math.floor(sessionsInBlock / 4);
}

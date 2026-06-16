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

// worker.js — runs the ported DanOverlay engine in a module Web Worker, off the overlay's
// main thread. The page (shared/tm-engine.js) plays the part of DanOverlay's
// tosu_source + AnalysisCoordinator and sends one job at a time:
//
//   → { type: 'analyze', id, path, md5, bytes, mod, rate, engine, difficulty, srOfficial, modLabel,
//       sevenK, lnModel, rc, classic }
//   ← { type: 'ready' } | { type: 'fatal', error }
//   ← { type: 'result', id, ok: true, payload, ms } | { type: 'result', id, ok: false, error }
//
// rc "average" / "mma" (total_maniaset's "4K 계산 엔진"): 4K rice charts also go through
// ManiaMapAnalyser (mma_bridge.js), which rewrites the payload's Reform fields; "legacy" = DanOverlay only.
//
// total_maniaset's dan per section (the top folder's page, shared/tm-sections.js) sends
//   → { type: 'sections', id, text, mod, rate, engine, difficulty, modLabel, sevenK, lnModel, rc, classic }
// and gets the payload { keys, sections } of sections.js, each section rated as an 'analyze' job is.
import { setupEngine } from './setup.js';

// The engine modules read config/*.json when they are imported (as in Python), so they are
// imported only after setupEngine() has put the resources into the virtual file system.
const ready = (async () => {
  await setupEngine({ baseUrl: new URL('./', import.meta.url) });
  return import('./job.js');
})();
ready.then(
  () => self.postMessage({ type: 'ready' }),
  (err) => self.postMessage({ type: 'fatal', error: String((err && err.message) || err) }),
);

/**
 * one chart's payload: the engine, then ManiaMapAnalyser for 4K rice under rc "average" / "mma"; a 7K chart of
 * total_maniaset's 7K model gets its Regular and LN dans apart (hybrid_7k.js)
 */
async function analyse(runAnalysisJob, job, rawText) {
  const payload = runAnalysisJob(job);
  if (payload && payload.type === 'analysis' && payload.mode === '7k' && !payload.error && job.sevenK === 'total_maniaset') {
    try {
      const { kindsOf, apply7k } = await import('./hybrid_7k.js');
      apply7k(payload, kindsOf(job));
    } catch (err) {
      console.error('[total_maniaset 7K kinds]', err);
      payload.tm_7k = { error: String((err && err.message) || err) }; // the engine's mixed dan stays
    }
  }
  if (rawText && payload && payload.type === 'analysis' && payload.mode !== '7k' && !payload.error && Number(payload.dp) > 0) {
    try {
      const bridge = await import('./mma_bridge.js');
      const mma = await bridge.runMma(rawText, job.rate, job.classic);
      if (mma.columnCount === 4) bridge.applyRc(payload, mma, job.rc);
    } catch (err) {
      console.error('[total_maniaset ManiaMapAnalyser]', err);
      payload.tm_rc = { rc: job.rc, error: String((err && err.message) || err) }; // DanOverlay 2.3.5 stays
    }
  }
  return payload;
}

self.onmessage = async (event) => {
  const job = event.data || {};
  if (job.type !== 'analyze' && job.type !== 'sections') return;
  let runAnalysisJob;
  try {
    ({ runAnalysisJob } = await ready);
  } catch {
    return; // already reported as fatal
  }
  const t0 = performance.now();
  try {
    const mma = job.rc === 'average' || job.rc === 'mma';
    let payload;
    if (job.type === 'sections') {
      const { runSectionsJob } = await import('./sections.js');
      payload = await runSectionsJob(job, (sub, text) =>
        analyse(runAnalysisJob, Object.assign(sub, { bytes: new TextEncoder().encode(text) }), mma ? text : ''),
      );
    } else {
      const bytes = job.bytes instanceof Uint8Array ? job.bytes : new Uint8Array(job.bytes);
      payload = await analyse(runAnalysisJob, job, mma ? new TextDecoder('utf-8').decode(bytes) : '');
    }
    self.postMessage({ type: 'result', id: job.id, ok: true, payload, ms: performance.now() - t0 });
  } catch (err) {
    console.error('[total_maniaset engine]', err);
    self.postMessage({ type: 'result', id: job.id, ok: false, error: String((err && err.message) || err) });
  }
};

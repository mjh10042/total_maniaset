// mma_bridge.js — total_maniaset addition (not part of DanOverlay): ManiaMapAnalyser 2.1.0
// (Leo_Black, MIT; shared/mma, see its NOTICE.md) next to the DanOverlay 2.3.5 engine (pipeline engine
// "legacy") for 4K charts. worker.js calls it after runAnalysisJob(); the payload of the ported engine
// itself stays bit-exact (tests), this only rewrites its Reform (or LN Course) fields for display.
//
//   rc "mma"      ManiaMapAnalyser's Mixed estimate (+ its Companella fusion, as its overlay does)
//   rc "average"  the mean of DanOverlay 2.3.5 and ManiaMapAnalyser — the best of the three on the
//                 official Reform / TR1PLE / Shoegazer courses (README, "4K 계산 엔진") — turning into
//                 2.3.5 alone over ManiaMapAnalyser's last dan (MMA_TOP_FADE)
//   ManiaMapAnalyser's numeric puts a dan's mid on the integer (Alpha mid = 11.0), so dp = numeric + 0.5.
//   Hybrids (LN 30-70 %) get a second label: the LN dan next to the rice dan, or the rice dan next to
//   the LN Course dan once DanOverlay routes the map to LN Course (LN > 45 %) — payload.tm_second,
//   which tm-dan.js draws as big as the first, in that dan's own colours.
import { dp_to_label, dp_to_sublevel } from './rank_engine.js';
import { fields_from_dp as lnFieldsFromDp, _confidence_from_dp_frac as lnConfidence } from './ln_course_estimator.js';

// ManiaMapAnalyser's defaults (its config.js) for what the estimate depends on
const MMA_OPTIONS = {
  withGraph: false, extendedEstimationRange: false, enableAlwaysShowLNDifficulty: false,
  forceSunnyReferenceHo: true, forceSunnyWindow: true, enableAnalyzeLN: false, display6kLevel: true,
  withPattern: false, withEtterna: true, withInterlude: true, withPpMetrics: false,
  etternaVersion: '0.72.3', companellaEtternaVersion: '0.74.0',
};
const HYBRID_LN = [0.3, 0.7]; // LN ratio band shown as rice + LN
// rc "average" at the top: ManiaMapAnalyser's estimate flattens over its last dan (its Azusa calibration
// ends near "Iota low" — the FINAL (Ext.) IOTA and KAPPA courses read 19.06 / 19.01), while DanOverlay
// 2.3.5 keeps Theta < Iota < Kappa apart (18.58 / 19.79 / 20.83). So between ManiaMapAnalyser dp 18.5 and
// 19.0 its weight fades from 1/2 to 0. On 39 dan-labelled Reform charts (2nd Pack 6th-Epsilon, FINAL,
// Finalmaps, Zeta Map Pack, FINAL (Ext.) and its map pack) the right dan goes 32 → 37 (Kappa 0/5 → 5/5);
// charts under 18.5 are unchanged, and 18.4-18.6 / 18.9-19.2 give the same.
const MMA_TOP_FADE = [18.5, 19.0];
// rc "average" on speedjack: DanOverlay 2.3.5 reads jacks at moderate density low (the user, 2026-10-31:
// "speedjack … 코드잭과 달리 상대적으로 밀도가 많이 낮은 대신, bpm이 빠른 애들", "상대적으로 저평가된 파트들"). On
// the Alpha / Gamma speedjack packs (95 labelled charts) the average read −0.49 dans, 2.3.5 −0.86, ManiaMapAnalyser
// −0.12; across 649 labelled practice charts 2.3.5's shortfall sits where a row shares a column with the row before
// for 20-45 % of the notes at 1.8-2.4 notes a row (−0.56 … −1.11; ManiaMapAnalyser −0.02 … −0.17), not on
// chordjack (2.4+ notes a row: +0.04). So ManiaMapAnalyser's share rises from 1/2 to SJ_MMA as the jack share
// goes SJ_JACK[0] → [1], falling back as rows grow from SJ_CHORD[0] to [1] notes (both rate-free). Mean error:
// speedjack 0.53 → 0.33, the 554 practice charts 0.39 → 0.38 (named "jack" 0.45 → 0.38), the 21 official
// Reform courses 0.22 → 0.23 (20/21 in their dan either way); the same within ±0.03 for nearby thresholds.
// Bias by rate stayed flat before and after (speedjack −0.42 … −0.53 → −0.14 … −0.26 at 0.8-1.6x).
const SJ_JACK = [0.15, 0.25];
const SJ_CHORD = [2.3, 2.7];
const SJ_MMA = 0.9;
const TIER = { low: 'Low', 'mid/low': 'Mid-Low', mid: 'Mid', 'mid/high': 'Mid-High', high: 'High' };
const TIER_OFFSET = { low: -0.4, 'mid/low': -0.2, mid: 0, 'mid/high': 0.2, high: 0.4 };

// tosu serves .wasm as "application/wasm; charset=utf-8", which WebAssembly's streaming compile
// rejects: ManiaMapAnalyser's MinaCalc builds and ONNX Runtime would log an error and download the
// file again. Hand such responses over with the plain type instead (as setup.js does for ours).
for (const name of ['instantiateStreaming', 'compileStreaming']) {
  const original = WebAssembly[name];
  if (typeof original !== 'function') continue;
  WebAssembly[name] = async (source, ...rest) => {
    let res = await source;
    const type = res instanceof Response ? String(res.headers.get('content-type') || '') : '';
    if (/^application\/wasm\s*;/i.test(type)) {
      res = new Response(await res.arrayBuffer(), { status: res.status, headers: { 'content-type': 'application/wasm' } });
    }
    return original.call(WebAssembly, res, ...rest);
  };
}

/**
 * a 4K chart's jack shape from its .osu: { jack, chord } — the share of notes in a column that the row
 * before also used, and notes a row (notes within 2 ms are one row); rate-free; null without notes
 */
export function jackShape(rawText) {
  const lines = String(rawText || '').split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === '[HitObjects]');
  if (at < 0) return null;
  const notes = [];
  for (let i = at + 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    if (p.length < 5) continue;
    const t = Number(p[2]);
    const x = Number(p[0]);
    if (!Number.isFinite(t) || !Number.isFinite(x)) continue;
    notes.push([t, Math.min(3, Math.max(0, Math.floor((x * 4) / 512)))]);
  }
  if (!notes.length) return null;
  notes.sort((a, b) => a[0] - b[0]);
  let rows = 0;
  let shared = 0;
  let prev = 0; // the last row's columns (bits)
  let cur = 0;
  let rowAt = -Infinity;
  for (const [t, c] of notes) {
    if (t - rowAt > 2) {
      prev = cur;
      cur = 0;
      rows += 1;
      rowAt = t;
    }
    if (prev & (1 << c)) shared += 1;
    cur |= 1 << c;
  }
  return { jack: shared / notes.length, chord: notes.length / rows };
}
const ramp = (x, [a, b]) => Math.min(1, Math.max(0, (x - a) / (b - a)));
/** how speedjack-like a jack shape is, 0-1 (SJ_JACK, SJ_CHORD) */
const speedjackOf = (shape) => (shape ? ramp(shape.jack, SJ_JACK) * (1 - ramp(shape.chord, SJ_CHORD)) : 0);

let modules = null;
const load = () =>
  (modules ??= Promise.all([
    import('../mma/js/pipeline/runAnalysisPipeline.js'),
    import('../mma/js/estimator/companellaEstimator.js'),
    import('../mma/js/estimator/mixedEstimator.js'),
    import('../mma/js/estimator/rcDifficultyFormat.js'),
  ]));

/**
 * ManiaMapAnalyser on one chart: { numeric, estDiff, algo, lnRatio, columnCount } (numeric on its own
 * scale, null when it gives none). rate = clock rate (DT 1.5 …); classic = stable without ScoreV2.
 */
export async function runMma(rawText, rate, classic) {
  const [{ runAnalysisPipeline }, { classifyCompanellaDifficulty }, { applyCompanellaToMixedResult }, { rcLabelToNumeric }] = await load();
  const options = { ...MMA_OPTIONS, speedRate: Number(rate) > 0 ? Number(rate) : 1, classicMod: classic === true };
  const res = await runAnalysisPipeline({ rawText, estimatorAlgorithm: 'Mixed', options });
  const r = res.rework || {};
  let numeric = r.numericDifficulty;
  let estDiff = r.estDiff;
  let algo = res.actualEstimatorAlgorithm;
  if (r.mixedCompanellaPlan) {
    try {
      const comp = await classifyCompanellaDifficulty({
        msdValues: (res.companellaEttResult || res.ettResult || {}).values,
        interludeStar: res.interludeStar,
        sunnyStar: Number(r.star),
      });
      const after = applyCompanellaToMixedResult(
        { estDiff, numericDifficulty: numeric, numericDifficultyHint: r.numericDifficultyHint, mixedCompanellaPlan: r.mixedCompanellaPlan },
        comp,
      );
      numeric = after.numericDifficulty;
      estDiff = after.estDiff;
      if (after.companellaCapsule) algo = after.companellaCapsule;
    } catch (err) {
      // Companella failed: keep the estimate from before the fusion, as ManiaMapAnalyser does
    }
  }
  // null stays null: ManiaMapAnalyser has no number for a chart off its table ("> CloverWisp Theta High",
  // "< … Low"), and Number(null) is 0 — which averaged a DT Rite of Ascendancy's Kappa (20.99) down to 10th
  // Mid-High (the user, 2026-11-12: "아직 수정해야 할 부분이 남아있는 거 같아"); then DanOverlay 2.3.5 alone
  const finite = (x) => x != null && Number.isFinite(Number(x));
  if (!finite(numeric)) numeric = rcLabelToNumeric(estDiff); // null for "<" / ">" too
  const summary = res.parsedSummary || {};
  return {
    numeric: finite(numeric) ? Number(numeric) : null,
    estDiff: String(estDiff || ''),
    algo,
    lnRatio: Number(summary.lnRatio),
    columnCount: Number(summary.columnCount),
    shape: jackShape(rawText),
  };
}

/**
 * ManiaMapAnalyser's LN level — the LN half of "RC || LN", or the whole label for LN charts (LN ≥ 90 %):
 * "LN 7 mid/high" → { level: 7, name: "7", sub: "Mid-High", dp: 7.7 }, "< LN 5 mid" → { level: null,
 * name: "< 5", sub: "", dp: null }, "> Lnlism LN 17 high" → { level: 17, name: "> 17", sub: "", dp: 17.9 }.
 * dp is on the LN Course scale (a stage's mid on .5, as DanOverlay's dp_ln); its levels follow the same
 * LN Dan Course v2 numbering (11 = Yoake … 16 = Yokaze).
 */
function lnPart(estDiff) {
  const label = String(estDiff || '');
  const part = (label.includes('||') ? label.split('||')[1] : label).trim();
  const m = part.match(/LN\s+(\d+)\s*(low|mid\/low|mid\/high|mid|high)?/i);
  if (!m) return null;
  const level = Number(m[1]);
  const tier = (m[2] || 'mid').toLowerCase();
  const dp = level + 0.5 + TIER_OFFSET[tier];
  if (part.startsWith('<')) return { level: null, name: `< ${level}`, sub: '', dp: null };
  if (part.startsWith('>')) return { level, name: `> ${level}`, sub: '', dp };
  return { level, name: String(level), sub: TIER[tier], dp };
}

/**
 * Rewrite a 4K payload's Reform fields — or its LN Course fields when DanOverlay routed the map there —
 * for rc "average" / "mma", and add the hybrid's second label.
 */
export function applyRc(payload, mma, rc) {
  const legacy = Number(payload.dp);
  const mmaDp = mma && mma.numeric !== null ? mma.numeric + 0.5 : null;
  const sj = mma ? speedjackOf(mma.shape) : 0;
  let dp = legacy;
  if (mmaDp !== null) {
    if (rc === 'mma' || !(legacy > 0)) dp = mmaDp;
    else {
      const t = ramp(mmaDp, MMA_TOP_FADE);
      const wMma = (0.5 + (SJ_MMA - 0.5) * sj) * (1 - t); // 1/2 = the plain average
      dp = (1 - wMma) * legacy + wMma * mmaDp;
    }
  }
  dp = Math.round(Math.min(20.99, Math.max(0.5, dp)) * 100) / 100; // DanOverlay's DP range
  const [label, short] = dp_to_label(dp);
  const sub = dp_to_sublevel(dp);
  // the panel shows the LN Course dan when DanOverlay routed the map there and has one, else Reform
  const lnCourse = String(payload.ln_route || 'rice') === 'ln' && payload.ln_course != null;
  payload.tm_rc = { rc, dp, legacy, mma: mmaDp, mmaLabel: mma ? mma.estDiff : '', algo: mma ? mma.algo : '', lnRatio: mma ? mma.lnRatio : null, speedjack: Math.round(sj * 100) / 100 };
  if (!lnCourse) {
    payload.dp = dp;
    payload.dan_label = label;
    payload.dan_short = short;
    payload.sublevel = sub;
    payload.beyond = dp > 20.5; // as rank_engine
  }
  const part = mma ? lnPart(mma.estDiff) : null;
  if (lnCourse) {
    // the same rule on the LN Course scale: the engine's dp_ln — total_maniaset's LN model (tm_ln4k.js,
    // job lnModel) — with ManiaMapAnalyser's LN level, which starts at LN 5 (below it the model's alone).
    // Model + ManiaMapAnalyser beats both and DanOverlay on the 4K LN Dan Courses (leave-one-out) and on
    // independent packs (Hylotl's LN Packs, *Luna): README "4K 판정".
    const model = Number(payload.ln_course.dp_ln);
    const mmaLn = part ? part.dp : null;
    if (mmaLn !== null && model > 0) {
      const lnDp = rc === 'mma' ? mmaLn : (model + mmaLn) / 2;
      Object.assign(payload.ln_course, lnFieldsFromDp(lnDp), { confidence: lnConfidence(lnDp) });
    }
    const danoverlay = payload.ln_course.dp_ln_danoverlay;
    payload.tm_ln = { rc, dp: Number(payload.ln_course.dp_ln), model, danoverlay: danoverlay == null ? model : Number(danoverlay), mma: mmaLn };
  }
  // tm_second: { kind, name, sub, text } + the dan whose colours the panel gives it — rc: dan (Reform
  // display name, e.g. "4th Dan"); ln: level (LN stage 1-16 — 11 = Yoake — then 17, 18, … numbered, or
  // ManiaMapAnalyser's LN level, null below its table)
  const ln = mma ? mma.lnRatio : NaN;
  if (ln > HYBRID_LN[0] && ln < HYBRID_LN[1]) {
    const lnModel = !lnCourse && payload.ln_course ? Number(payload.ln_course.dp_ln) : NaN;
    if (lnCourse) {
      payload.tm_second = { kind: 'rc', dan: label, name: label, sub, text: `RC ${label} ${sub}` };
    } else if (lnModel > 0) {
      // DanOverlay's "hybrid" route (LN 30-45 %): the LN side by the LN Course rule — the LN model
      // (which the engine also runs for these maps) with ManiaMapAnalyser's LN level, the model alone
      // below LN 5 (where ManiaMapAnalyser only says "< LN 5")
      const mmaLn = part ? part.dp : null;
      const lnDp = mmaLn === null ? lnModel : rc === 'mma' ? mmaLn : (lnModel + mmaLn) / 2;
      const f = lnFieldsFromDp(lnDp);
      const lnSub = f.beyond ? 'Beyond' : dp_to_sublevel(Math.max(1, lnDp));
      const level = Math.trunc(Math.max(1, lnDp)); // 17+: the numbered stages past Yokaze (their own grey)
      payload.tm_second = { kind: 'ln', level, name: f.label, sub: lnSub, text: `LN ${f.label} ${lnSub}` };
      payload.tm_ln = { rc, dp: f.dp_ln, model: lnModel, mma: mmaLn, hybrid: true };
    } else if (part) {
      payload.tm_second = { kind: 'ln', level: part.level, name: part.name, sub: part.sub, text: `LN ${part.name} ${part.sub}`.trim() };
    }
  }
  return payload;
}

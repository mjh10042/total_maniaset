// live_model.js — total_maniaset's live dan from Sunny SR's parts, moment by moment (2026-10-28). Used for how a
// 4K LN row moves inside its section (sections.js timelineOf); the sections' dans stay the dan panel's engine.
//
// Asked for: the section dans were the dan panel's engine, made for whole maps, run over each part looped to a
// minute. Looped, a 12-15 s burst is a minute of it without a rest and reads high (Break ~ Gamma ~: Delta Mid on
// a Gamma Mid-High map); pinned to the map's dan, a map's hardest parts read as the map (Sakazuki [Kyomu]'s last
// part: Gamma Mid-Low, "미드로우면 너무 내려치기"). The user: "모델을 따로 써야 하는 거 같은데 이건 / 그러니까
// 제대로 표현을 못한다 이거", then "밀도 + 직전 부담" (the density of the moment and the load just before it),
// for all of 4K, LN labels for reference only, on "4키는 2000개 정도 … 7키는 1000개 정도".
// On those 3000 maps Sunny's graph alone missed the maps' dans by 0.61 (rice; the engine 0.39 on labels), 0.47
// (LN), 0.75 (7K); the load just before (an exponential mean over the last 20-40 s) took off 0.01-0.03; and as
// the live display it flickered and read hard parts low. With Sunny's parts as pattern terms ("Sunny 모델을 더
// 다듬기"): rice 0.55, LN 0.36, 7K 0.59. Then "LN만 Sunny 성분으로" — what is used here.
//
// The moment: Sunny SR's strength graph from ManiaMapAnalyser's port (long notes' bodies and releases in, which
// the dan engine's sr_core leaves out), step by step on the map's clock.
import { calculate as sunnyCalculate } from '../mma/js/rework/sunnyAlgorithm.js';

/**
 * values given at corner times (the real clock), as each step's time-weighted mean on the map's clock (a value
 * holds from its corner to the next; pieces cut at the steps)
 */
function binned(times, values, rate, step, n) {
  const out = new Float64Array(n);
  const span = new Float64Array(n);
  for (let i = 0; i + 1 < times.length; i++) {
    let a = times[i] * rate;
    const b = times[i + 1] * rate;
    const val = Number(values[i]) || 0;
    while (a < b) {
      const s = Math.floor(a / step);
      const edge = Math.min(b, (s + 1) * step);
      if (s >= 0 && s < n) {
        out[s] += val * (edge - a);
        span[s] += edge - a;
      }
      a = edge;
    }
  }
  for (let s = 0; s < n; s++) out[s] = span[s] > 0 ? out[s] / span[s] : 0;
  return out;
}

/**
 * a chart's signals step by step (map time, steps of `step` ms from 0): m, Sunny SR's graph (its D smoothed over
 * 0.8 s, nothing near no note) as each step's time-weighted mean; with parts, Sunny's own D before that smoothing
 * (d) and what it is made of (J same-column pressure, X cross-column, P pressing intensity with long notes' bodies,
 * A unevenness, R releases, C its note density) the same way; heads, rows (chords count once), jacks (heads whose
 * column was hit in the row before), tails (long notes' releases) and lnHeads a step; held, the long notes held in
 * a step (their mean count); and star, Sunny SR itself.
 * chart: sections.js readChart's (notes { t, end, col, ln, jack } by time); rate: the clock rate (DT 1.5);
 * classic: stable without ScoreV2.
 */
export function signalsOf(chart, text, rate = 1, step = 250, classic = false, parts = false) {
  const k = rate > 0 ? rate : 1; // Sunny runs on the real clock: back to the map's
  const r = sunnyCalculate(text, k, null, null, { withGraph: true, withParts: parts === true, classicMod: classic === true });
  const { notes } = chart;
  const last = notes.reduce((mx, o) => Math.max(mx, o.end), 0);
  const n = Math.floor(last / step) + 2;
  const graphed = r && r.graph && r.graph.times && r.graph.times.length > 1;
  const m = graphed ? binned(r.graph.times, r.graph.values, k, step, n) : new Float64Array(n);
  const sub = {};
  if (graphed && r.parts) for (const [key, vals] of Object.entries(r.parts)) sub[key === 'D' ? 'd' : key] = binned(r.graph.times, vals, k, step, n);
  const heads = new Float32Array(n);
  const rows = new Float32Array(n);
  const jacks = new Float32Array(n);
  const tails = new Float32Array(n);
  const lnHeads = new Float32Array(n);
  const held = new Float32Array(n);
  let rowT = NaN;
  for (const o of notes) {
    const a = Math.floor(o.t / step);
    if (a >= 0 && a < n) {
      heads[a] += 1;
      if (o.t !== rowT) rows[a] += 1;
      if (o.jack) jacks[a] += 1;
    }
    rowT = o.t;
    if (!o.ln) continue;
    if (a >= 0 && a < n) lnHeads[a] += 1;
    const b = Math.floor(o.end / step);
    if (b >= 0 && b < n) tails[b] += 1;
    for (let s = Math.max(0, a); s <= Math.min(n - 1, b); s++) {
      const cover = Math.min(o.end, (s + 1) * step) - Math.max(o.t, s * step);
      if (cover > 0) held[s] += cover / step;
    }
  }
  const star = Array.isArray(r) ? Number(r[0]) : r && typeof r === 'object' ? Number(r.star) : NaN;
  return { step, m, ...sub, heads, rows, jacks, tails, lnHeads, held, star, rate: k };
}

// The LN Course dp of a moment from Sunny's parts (2026-10-28, the user: "LN만 Sunny 성분으로"): a ridge fit
// over 335 4K LN maps of the dan panel's LN Course dans on a map's strong part (the 90 % point of m as x = ln m,
// and the means of the parts over its strongest 20 % of busy time), the features standardized: x, ln(J+1),
// ln(X+1), ln(P+1), A, ln(R+1), ln(C+1), x². Cross-validated 0.36 LN dans off against 0.48 for m alone (and for
// rice only 0.61 → 0.55, so rice keeps the sections' strain moves). Releases add nothing past P (its LN bodies).
const LN_FIT = {
  mu: [1.96707, 3.02965, 2.00391, 3.26011, 0.9479, 1.55833, 2.97151, 3.90555],
  sd: [0.19022, 0.43543, 0.38858, 0.15773, 0.04264, 0.12375, 0.29447, 0.73457],
  beta: [0.23229, 0.75522, -0.40514, 0.63933, -0.10113, 0.00143, 0.33834, 1.92207],
  b0: 11.02626,
};
// the same for the Reform dp of 4K rice (1469 maps: 552 practice-pack labels, the rest the dan panel's dans)
const RICE_FIT = {
  mu: [2.03724, 3.46597, 2.38784, 3.22483, 0.87971, 0.17763, 3.26683, 4.20331],
  sd: [0.23016, 0.33709, 0.29797, 0.21977, 0.06162, 0.19693, 0.22506, 0.82143],
  beta: [-0.96557, 0.75984, 0.28973, -0.21046, -0.14156, 0.06521, -0.49322, 3.55757],
  b0: 12.19299,
};

/** a's mean over `h` steps either side */
function around(a, h) {
  const n = a.length;
  const c = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) c[i + 1] = c[i] + a[i];
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - h);
    const hi = Math.min(n, i + h + 1);
    out[i] = (c[hi] - c[lo]) / (hi - lo);
  }
  return out;
}

/** a fit's dp step by step from signalsOf(…, parts) (its parts each averaged over `span` ms either side) */
function dpsOf(sig, fit, span) {
  if (!sig || !sig.J) return null;
  const h = Math.max(0, Math.round(span / sig.step));
  const lg = (v) => Math.log(Math.max(v, 1e-3));
  const parts = ['J', 'X', 'P', 'A', 'R', 'C'].map((k) => around(sig[k], h));
  const [J, X, P, A, R, C] = parts;
  const n = sig.m.length;
  const out = new Float64Array(n);
  const { mu, sd, beta, b0 } = fit;
  for (let i = 0; i < n; i++) {
    const x = lg(sig.m[i]);
    const f = [x, lg(J[i] + 1), lg(X[i] + 1), lg(P[i] + 1), A[i], lg(R[i] + 1), lg(C[i] + 1), x * x];
    let v = b0;
    // each feature within 3 spreads of the fit's maps (out there the fit only guesses: long notes held alone in
    // a rice map gave dans in the thirties)
    for (let k = 0; k < f.length; k++) v += Math.max(-3, Math.min(3, (f[k] - mu[k]) / sd[k])) * beta[k];
    out[i] = v;
  }
  return out;
}

/** the LN Course dp step by step (its parts averaged over `span` ms either side), or null without the parts */
export const lnDpsOf = (sig, span = 1500) => dpsOf(sig, LN_FIT, span);

/** the Reform dp of 4K rice step by step (its parts averaged over `span` ms either side), or null */
export const riceDpsOf = (sig, span = 3000) => dpsOf(sig, RICE_FIT, span);

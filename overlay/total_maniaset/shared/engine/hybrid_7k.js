// hybrid_7k.js — total_maniaset addition (not part of DanOverlay): a 7K hybrid shown as two dans, the way 4K
// hybrids are (mma_bridge.js). The official 7K Regular and LN dans are passed on lines of their own (Regular
// 96 %, LN 95 %; the user, 2026-11-11: "둘 다 클리어 기준이 다르거든? 단놋 96퍼 롱놋 95퍼 … 4키처럼 단놋 롱놋
// (메인 패턴 밑 서브패턴) 양식 동일하게"), so the one dan estimate_7k mixes of the two (by the LN ratio between
// its blend.lo and .hi, shown as "HY …") was neither. Each kind is rated by its own model alone (tm_7k.js
// kinds_7k), and the panel and the sections show
//   main    the LN dan over LN 45 %, else the Regular one (4K's LN Course route: validator.js)
//   second  the other dan for LN 30-70 % (4K's hybrid band: mma_bridge.js HYBRID_LN)
// worker.js calls it after runAnalysisJob() for the 7K payloads of total_maniaset's 7K model; the engine's own
// payload (dp_7k mixed as before) stays as the tests have it.
import * as py from './py.js';
import { putFile, removeFile } from './vfs.js';
import { mtimeFromMd5 } from './job.js';
import { _load_parsed_chart } from './pipeline.js';
import { extract_features } from './feature_extractor.js';
import { analyze_primary_sr } from './primary_sr_bridge.js';
import { kinds_7k } from './tm_7k.js';

const HYBRID_LN = [0.3, 0.7]; // shown as both dans (mma_bridge.js)
const LN_MAIN = 0.45; // the LN dan leads over it (validator.js _LN_ROUTE_LN_FLOOR)
const RICE_ONLY = 0.3; // a Regular chart up to it (validator.js _LN_ROUTE_HYBRID_FLOOR)
const TIERS = ['0th', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', 'Gamma', 'Azimuth', 'Zenith', 'Stellium'];

/** a 7K dp's { tier, sub, dp } as _finish_7k (pipeline.js) names it: tier and Beyond by the dp, sublevel by it rounded */
export function tierOf(dp) {
  const raw = py.max2(0.0, dp);
  const i = py.min2(py.int(raw), TIERS.length - 1);
  const v = py.round(raw, 2);
  const frac = py.round(v - py.int(v), 2);
  let sub = frac <= 0.2 ? 'Low' : frac <= 0.4 ? 'Mid-Low' : frac <= 0.6 ? 'Mid' : frac <= 0.8 ? 'Mid-High' : 'High';
  let tier = i <= 10 ? `${TIERS[i]} Dan` : TIERS[i];
  if (raw >= TIERS.length) {
    tier = 'Beyond Stellium';
    sub = 'Beyond';
  }
  return { tier, sub, dp: v };
}

/**
 * the kinds of the chart the engine has just rated (runAnalysisJob took it out of the file system again; its
 * SR comes from primary_sr_bridge's cache), as the engine's 7K branch rates it — or null
 */
export function kindsOf(job) {
  const bytes = job.bytes instanceof Uint8Array ? job.bytes : new Uint8Array(job.bytes);
  putFile(job.path, bytes, mtimeFromMd5(job.md5));
  try {
    const parsed = _load_parsed_chart(job.path, job.difficulty);
    if (py.truthy(py.get(parsed, 'rejected'))) return null;
    const algo = analyze_primary_sr(job.path, job.mod, job.rate);
    if (!py.truthy(py.get(algo, 'success', false))) return null;
    const v = py.get(algo, 'sr', 0.0);
    const sr = py.float(py.truthy(v) ? v : 0.0);
    const rate = job.rate != null ? job.rate : py.get({ HT: 0.75, DT: 1.5, NC: 1.5 }, job.mod, 1.0);
    return kinds_7k(sr, { ...extract_features(parsed), note_count: py.get(parsed, 'note_count') }, rate);
  } finally {
    removeFile(job.path);
  }
}

/**
 * a 7K payload's dan fields set to its main kind's dan, its kinds in tm_7k and a hybrid's other dan in tm_second
 * ({ kind: 'rc' | 'ln', k7: true, tier, name, sub, dp, text }, as mma_bridge.js gives 4K's). Left as the engine
 * gave it when the kinds do not mix back to its dan (tm_7k.error)
 */
export function apply7k(payload, kinds) {
  if (!kinds) return payload;
  const mixed = py.round(kinds.mixed, 2);
  if (Math.abs(mixed - Number(payload.dp_7k)) > 1e-9) {
    payload.tm_7k = { error: `kinds mix to ${mixed}, not ${payload.dp_7k}` };
    return payload;
  }
  const ln = kinds.ln_ratio;
  const rice = tierOf(kinds.rice);
  const lnDan = tierOf(kinds.ln);
  const main = ln > LN_MAIN ? 'ln' : 'rice';
  const lead = main === 'ln' ? lnDan : rice;
  payload.tier_7k = lead.tier;
  payload.sublevel_7k = lead.sub;
  payload.dp_7k = lead.dp;
  payload.ln_route = main === 'ln' ? 'ln' : ln > RICE_ONLY ? 'hybrid' : 'rice';
  payload.tm_7k = { main, ln_ratio: ln, rice, ln: lnDan, mixed };
  if (ln > HYBRID_LN[0] && ln < HYBRID_LN[1]) {
    const other = main === 'ln' ? rice : lnDan;
    const kind = main === 'ln' ? 'rc' : 'ln';
    payload.tm_second = { kind, k7: true, tier: other.tier, name: other.tier, sub: other.sub, dp: other.dp, text: `${kind === 'rc' ? 'RC' : 'LN'} ${other.tier} ${other.sub}` };
  }
  return payload;
}

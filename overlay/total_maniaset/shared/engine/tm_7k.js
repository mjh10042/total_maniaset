// tm_7k.js — total_maniaset's 7K dan model (not part of DanOverlay 3.1.0).
//
// JavaScript port of engine/dan_engine/tm_7k.py (same operations, same results). Per kind
// (rice / LN): score = ridge regression of the tier on a few chart features, placed on the tier
// scale by the tiers' anchor scores (official course chart and practice-chart median, half each);
// the two are mixed by LN ratio. Calibrated on the official osu!mania 7K dan courses by
// tools/dan7k_calibrate.py (config/tm_7k_calibration.json).
// pipeline.js uses it for 7K charts when SEVEN_K_MODEL is "total_maniaset"; `features` is
// extract_features() plus the chart's note_count.
import * as py from './py.js';
import * as vfs from './vfs.js';

let _CAL = null;

function _calibration() {
  if (_CAL === null) {
    _CAL = JSON.parse(vfs.readText(vfs.path.join(vfs.sys._MEIPASS, 'config', 'tm_7k_calibration.json')));
  }
  return _CAL;
}

// Python's float(x or 0.0)
const num = (features, key) => {
  const v = py.get(features, key, 0.0);
  return py.float(py.truthy(v) ? v : 0.0);
};

// densities scale with the rate, durations inversely, the note count not at all
// (features come from the unscaled chart)
export function _feature(name, sr, features, rate) {
  if (name === 'sr') return sr;
  if (name === 'log_nps90') return py.math.log(py.max2(num(features, 'nps_p90') * rate, 0.5));
  if (name === 'log_nps_sustained') return py.math.log(py.max2(num(features, 'nps_sustained_top30') * rate, 0.5));
  if (name === 'log_duration') return py.math.log(py.max2(py.div(num(features, 'duration_s'), rate), 1.0));
  if (name === 'log_notes') return py.math.log(py.max2(num(features, 'note_count'), 1.0));
  if (name === 'density_cv') return num(features, 'density_cv');
  if (name === 'ln_ratio') return num(features, 'ln_ratio');
  if (name === 'simultaneous_hold') return num(features, 'simultaneous_hold');
  throw new py.KeyError(py.reprStr(String(name)));
}

export function _score(values, model) {
  let s = model.intercept;
  const n = Math.min(model.weights.length, values.length, model.mean.length, model.sd.length); // zip()
  for (let i = 0; i < n; i++) s += (model.weights[i] * (values[i] - model.mean[i])) / model.sd[i];
  return s;
}

export function _dp_from_anchors(x, a) {
  if (x <= a[0]) return py.max2(0.0, 0.5 + (x - a[0]) / (a[1] - a[0]));
  for (let i = 0; i < a.length - 1; i++) {
    if (x < a[i + 1]) return i + 0.5 + (x - a[i]) / (a[i + 1] - a[i]);
  }
  return a.length - 0.5 + (x - py.at(a, -1)) / (py.at(a, -1) - py.at(a, -2));
}

function _dp(kind, sr, features, rate) {
  const model = _calibration()[kind];
  const values = model.features.map((n) => _feature(n, sr, features, rate));
  return _dp_from_anchors(_score(values, model), model.anchors);
}

/**
 * [dp, route] for a 7K chart: dp on the 0th..Stellium scale (tier = floor(dp), >= 15 is beyond
 * Stellium), route "rice" / "hybrid" / "ln" by the LN mix.
 */
export function estimate_7k(sr, features, rate = 1.0) {
  if (typeof rate !== 'number') throw new py.TypeError_(`can't multiply sequence by non-int of type 'float'`);
  const cal = _calibration();
  const ln_ratio = num(features, 'ln_ratio');
  const lo = cal.blend.lo;
  const hi = cal.blend.hi;
  const w = py.min2(1.0, py.max2(0.0, (ln_ratio - lo) / (hi - lo)));
  let dp = 0.0;
  if (w < 1.0) dp += (1.0 - w) * _dp('rice', sr, features, rate);
  if (w > 0.0) dp += w * _dp('ln', sr, features, rate);
  const route = w <= 0.0 ? 'rice' : w >= 1.0 ? 'ln' : 'hybrid';
  return [py.max2(0.0, dp), route];
}

/**
 * total_maniaset addition (not in tm_7k.py; for the overlay's display, hybrid_7k.js): each kind's dp of a 7K
 * chart by its own model, unmixed — { rice, ln, ln_ratio, mixed }, where mixed is estimate_7k's dp from them
 */
export function kinds_7k(sr, features, rate = 1.0) {
  const cal = _calibration();
  const ln_ratio = num(features, 'ln_ratio');
  const w = py.min2(1.0, py.max2(0.0, (ln_ratio - cal.blend.lo) / (cal.blend.hi - cal.blend.lo)));
  const rice = _dp('rice', sr, features, rate);
  const ln = _dp('ln', sr, features, rate);
  let mixed = 0.0;
  if (w < 1.0) mixed += (1.0 - w) * rice;
  if (w > 0.0) mixed += w * ln;
  return { rice: py.max2(0.0, rice), ln: py.max2(0.0, ln), ln_ratio, mixed: py.max2(0.0, mixed) };
}

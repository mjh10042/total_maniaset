// tm_ln4k.js — total_maniaset's 4K LN Course model (not part of DanOverlay 3.1.0).
//
// JavaScript port of engine/dan_engine/tm_ln4k.py (same operations, same results). A ridge score of
// a few chart features (Sunny SR and its component shares, LN ratio, simultaneous holds, hold
// occupancy, release and note density, note count) placed on the LN Course stage scale by the
// stages' anchor scores (course marathon and the median of its four Stage-pack songs, half each).
// Calibrated on the 4K LN Dan Courses by tools/ln4k_calibrate.py (config/tm_ln4k_calibration.json).
// pipeline.js uses it for charts routed to LN Course when LN_MODEL is "total_maniaset"; `sr_result`
// is analyze_primary_sr() at the analysed rate, `features` extract_features() plus the note_count.
import * as py from './py.js';
import * as vfs from './vfs.js';

let _CAL = null;

function _calibration() {
  if (_CAL === null) {
    _CAL = JSON.parse(vfs.readText(vfs.path.join(vfs.sys._MEIPASS, 'config', 'tm_ln4k_calibration.json')));
  }
  return _CAL;
}

// Python's float(d.get(key, 0.0) or 0.0)
const num = (d, key) => {
  const v = py.get(d, key, 0.0);
  return py.float(py.truthy(v) ? v : 0.0);
};

// Sunny SR and its shares come at the analysed rate; densities of the unscaled chart scale with
// the rate; ratios and the note count do not
export function _feature(name, sr_result, features, rate) {
  if (name === 'sr') return num(sr_result, 'sr');
  if (name === 'jbar_share' || name === 'xbar_share' || name === 'pbar_share') return num(sr_result, name);
  if (name === 'log_nps90') return py.math.log(py.max2(num(features, 'nps_p90') * rate, 0.5));
  if (name === 'log_release') return py.math.log(py.max2(num(features, 'release_density') * rate, 0.05));
  if (name === 'log_notes') return py.math.log(py.max2(num(features, 'note_count'), 1.0));
  if (name === 'ln_ratio' || name === 'simultaneous_hold' || name === 'hold_occupancy') return num(features, name);
  throw new py.KeyError(py.reprStr(String(name)));
}

export function _score(values, model) {
  let s = model.intercept;
  const n = Math.min(model.weights.length, values.length, model.mean.length, model.sd.length); // zip()
  for (let i = 0; i < n; i++) s += (model.weights[i] * (values[i] - model.mean[i])) / model.sd[i];
  return s;
}

// anchor i is stage i + 1 (1st = 1), at dp_ln i + 1.5
export function _dp_from_anchors(x, a) {
  if (x <= a[0]) return py.max2(1.0, 1.5 + (x - a[0]) / (a[1] - a[0]));
  for (let i = 0; i < a.length - 1; i++) {
    if (x < a[i + 1]) return i + 1.5 + (x - a[i]) / (a[i + 1] - a[i]);
  }
  return a.length + 0.5 + (x - py.at(a, -1)) / (py.at(a, -1) - py.at(a, -2));
}

/**
 * dp_ln of a chart routed to LN Course, on DanOverlay's stage scale (1st = 1.x … Yokaze = 16.x;
 * then 17th = 17.x, 18th = 18.x, … numbered: ln_course_estimator.js, 2026-11-11).
 */
export function estimate_ln(sr_result, features, rate = 1.0) {
  if (typeof rate !== 'number') throw new py.TypeError_(`can't multiply sequence by non-int of type 'float'`);
  const model = _calibration();
  const values = model.features.map((n) => _feature(n, sr_result, features, rate));
  return _dp_from_anchors(_score(values, model), model.anchors);
}

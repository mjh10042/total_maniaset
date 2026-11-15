// sections.js — total_maniaset's dan per section of a 4K or 7K chart (not in DanOverlay).
//
// Asked for on 2026-10-27 (a player, through the user): how many dans each part of a map is, for rice,
// hybrid and LN alike. They had a 1-minute basis in mind, but songs change where they change (easy up to
// 1:40 and hard after, density up and down), so the sections are found from the chart itself. The first
// version cut only where Sunny SR's strain stepped; the user then: it "just splits", without telling the
// highlights from the rest ("하이라이트 부분과 아닌 부분이 아니라 그냥 단순히 구간만 나눈 느낌"), kiai and
// non-kiai and more, flexibly, as many things overlap ("유연하게 … 여러가지 상황이 겹쳐서"), and parts are
// stressed by their patterns without kiai too ("키아이 없는 특정 구간이 강조된 패턴들도"). So now the
// evidence is weighed together:
// - where to cut: the bar lines (from the red lines' beat and meter; sections start on a bar), the rests,
//   the kiai edges and the BPM changes. Each candidate scores how much the chart changes there: the 8 s
//   before against the 8 s after, in Sunny SR's strain (the dan engine's own curve) and in the patterns
//   (notes a second, notes a row, jacks, long notes), each in units of how much it varies over the map;
//   a kiai edge, a rest, a BPM change and a phrase start (every 4th bar) add to it. The best cut first,
//   sections 10 s or longer, 24 at most; inside a kiai part a cut needs three times the score, so a kiai
//   part mostly stays whole. Then each cut moves, within 4 s, to the candidate where the chart changes most
//   over 3 s (where the change starts), the weaker of two cuts left too close going.
// - what a section is: "kiai" when kiai covers most of it (the mapper's highlight; 16 % of the 4K / 7K maps
//   here have kiai, and their kiai parts are 1.43 times as dense as the rest), else "peak" (an inferred
//   highlight) when its strain is among the strongest 35 % of the map's time and over the map's median, or
//   its patterns stand far out from the map's at no less than usual strength (stressed parts without kiai,
//   the user: "키아이 없는 특정 구간이 강조된 패턴들도").
// - each section is rated by the dan panel's engine over one minute of it (its notes repeated; a longer
//   section as it is), the "1분 기준" first asked for, so that sections compare alike. The engine counts
//   length (MinaCalc's stamina): the hardest 13.5 s of Shiawase ni Nareru Kakushi Command [Challenge]
//   rates Alpha Low as it is, Beta 30 s, Gamma Low 60 s, Gamma Mid-High over the map's 3:46, while the map
//   is Alpha Mid-High. Repeating every section over the whole map's length (the first way here) made such
//   bursts read two dans over the map ("측정이 많이 엇나가는거 같은데?", the user).
// - then the sections are set against the map's own dan (the dan panel's: the whole map rated the same way):
//   on each dan scale all of them move by one step, so that the dan at a point of the map's time (time-
//   weighted, from the easiest; 80 % for 4K rice and 7K, 75 % LN, 70 % hybrid: ANCHOR_Q) is the map's. The
//   map's dan followed that point of its 1-minute section dans most steadily (first on 40 4K rice maps, 85 %,
//   gap spread 0.56 dans against 0.86 at 70 % and 1.80 for the mean; again on 500 maps of all kinds with the
//   sections as now): a map's dan stands for its harder parts. An even map gives every section the map's dan.
//   A quarter of how far the engine's own 1-minute dan at that point is from the map's dan shows too (SHOW;
//   2026-10-28): the hard parts of a map whose hard parts are short read a little over the map.
// - testers, through the user (2026-10-27). Vaenus - Lazorbeamz (Evening) [I'M A' FIRIN' MAH LAZER!!] at 1.1x
//   is a stamina map where almost nothing changes ("사실 달라질게 거의 없어서 / 스테이블 하게 안 나오면
//   비상"): 23-24 notes a second all through at 1.0x, but its opening (a chordjack part, 20.9) and its end
//   (22.0) read Beta High among Gamma ("여기는 또 왜 베타하이래", "끝부분도 근데 비슷하지않나"), and the
//   sections were few ("구간을 디테일하게 못 잡는게 흠"). On Shiawase ni Nareru Kakushi Command [Challenge]
//   (kimlachal) a calmer part read too low ("이런 부분이 더 높아야하지 않나 싶긴 한데"). The engine's
//   1-minute ratings of equal parts scatter by about a third of a dan, and with the strain they spread
//   Lazorbeamz's even body over 1.5 dans that players do not feel, so:
//   - on each scale the section dans are pooled towards a line through them along the strain (fitted over
//     the map, weighted by time): 30 % of a section's own rating stays (POOL), sections of one strength read
//     alike;
//   - a section within half a dan of the map's dan shows the map's dan, a farther one comes half a dan
//     nearer (GATE): a map's hardest parts read as the map, its calmer ones lower;
//   - a section longer than 24 s is split again at its best candidate inside (bars first), and equal
//     neighbours are no longer joined, so an even map shows its even dans section by section.
//   Lazorbeamz 1.1x went from Beta High / Gamma / Beta High to Gamma Low, then Gamma Mid-Low to the end
//   (the map's); Shiawase's verses from 9th to 10th, its hardest parts Alpha Mid-High (the map's). Cutting
//   every distance from the map's dan to 70 % as well lifted the verses a third of a dan more, but a 2nd-dan
//   breakdown of a Delta map (Dion Timmer - Shiawase (VIP) [1.05x], 1:01) to 5th High; left out.
//
//   runSectionsJob({ text, rate, mod, modLabel, difficulty, sevenK, lnModel, rc, classic }, analyse)
//     analyse(job, text) → the payload of one chart, as the worker makes it (engine + ManiaMapAnalyser)
//   → { keys, sections: [{ start, end, from, to, kind, dan, raw }], timeline: [{ from, to, dan, kind }],
//     offset, whole } (from / to: the cuts, for telling where a play is; kind: 'kiai' | 'peak' | 'spike' | '',
//     a timeline's also 'rest'; raw: each scale's own 1-minute dp; timeline: the dan second by second, for
//     the play; offset and whole, the map's dans: for tests)
//   job.cutOptions (tests): { window, min, max, cut, peakZ, oddD, noKiai } over the defaults below;
//   job.dry (tests): sections without their dans; job.spikes === false (tests): no momentary peaks;
//   job.step (tests): the timeline's step, a multiple of 100 ms (STEP by default); job.hold (tests): a move
//   of the shown dan smaller than this many dans is not shown (HOLD by default); job.lnMoves 'actions' (tests):
//   4K LN rows move by presses and releases as before, not by Sunny's parts; job.lnShrink (tests): how much of
//   Sunny's LN move shows (LN_SHRINK by default); job.riceLevel 'off' (tests): 4K rice rows without Sunny's
//   level; job.riceMix (tests): how much of it (RICE_MIX by default).
import { analyze_primary_sr, _sr_cache, _mono_registry } from './primary_sr_bridge.js';
import { signalsOf, lnDpsOf, riceDpsOf } from './live_model.js';
import { _cache as _minaCache } from './minacalc_bridge.js';
import { putFile, removeFile } from './vfs.js';
import { dp_to_label, dp_to_sublevel, _DAN_ORDER } from './rank_engine.js';
import { fields_from_dp as lnFields } from './ln_course_estimator.js';
import { fields_from_dp as celestialFields } from './celestial_estimator.js';
import { fields_from_dp as signicialFields } from './signicial_estimator.js';
import { fields_from_dp as shoegazerFields } from './shoegazer_estimator.js';

// Tuned on 200 maps with kiai, the kiai hidden (scratch kiai_validate.mjs, 2026-10-27): the peaks found 63 %
// of the kiai time and 64 % of their time was kiai (the first settings: 20 % and 70 %); a kiai edge lies a
// median 2.7 s from a cut, 53 % within 3 s (5.3 s and 40 % before the cuts moved to where a change starts;
// cuts at 0.6 and 8 s came closer, 1.5 s and 69 %, but cut FREEDOM DiVE [4K Another] into 21 sections, its
// second kiai in four). 9 sections a map at the median.
const DEFAULTS = {
  window: 6000, // what a candidate cut compares: this long before against this long after
  min: 10000, // the shortest section
  edge: 6000, // … but the last (an outro: Sakazuki [Kyomu]'s 7 s tail after its densest stretch, 1:38-1:50,
  //            stayed in that section and pulled it down, "미드로우면 너무 내려치기"; allowed for the first too,
  //            Lazorbeamz 1.1x's intro took in its opening, which fell from Gamma Low to Alpha High)
  maxLen: 24000, // a longer section is split again (at its best candidate inside)
  max: 40, // the most sections
  cut: 0.8, // the smallest score that cuts
  kiaiInside: 3, // inside a kiai part a cut needs this many times that (a kiai part stays whole unless it
  //               changes a lot: the user, "키아이 우선", with flexibility)
  refine: 3000, // a cut then moves, within `near`, to the candidate where the chart changes most over this
  near: 4000,
  top: 0.35, // a peak: its strain among the strongest 35 % of the map's time (kiai covers a median 35 %) …
  peakZ: 0.1, // … and this many spreads over the map's median
  oddD: 2.2, // or patterns this far from the map's (in spreads), at the median strain or more
  noKiai: false, // tests: as if the map had no kiai
  calm: true, // the calm stretches are sections of their own, as the quiet ones (false for tests: quiet only)
};
const REST_MS = 3000; // a rest this long is a candidate cut
// a quiet stretch: no more than QUIET_HEADS notes struck within a second either side, REST_MS or longer, long notes
// held through it or not; it is a section of its own (Dan ~ REFORM ~ Zeta Map Pack [Angel Dust ~ Zeta ~
// (Marathon)], 1:10-1:19 between its songs: a few long notes held, in one section with the first song's last
// 2 s, read Delta Mid-High while held and Kappa over the dense 2 s; the user: "이건 좀 이상하다고 생각하긴 해")
const QUIET_HEADS = 2;
// … and so is a calm stretch: notes struck and released within a second either side no more than CALM_SHARE of
// the map's busy count of them (its CALM_Q point over the chart), REST_MS or longer (LOVEHOLIC [Endless
// Blessings 0.95x]: its intro of 3 notes a second, 4 s in one section with the chordstream of 30 after it,
// showed 7th Mid, its moves held to MOVE_DOWN, and diluted that section to Gamma High where the map is Delta
// Mid; testers, 2026-10-30: "어려운 파트 이전 쉬는 파트에서 예상보다 높게 측정", "초반에 예상보다 높은 난이도를
// 측정을 제대로 못하는", "초반도 델로우나 감마가 뜰 그런 건 아니긴 하거든요"). job.cutOptions { calm: false } for
// tests: quiet only
const CALM_SHARE = 0.25;
const CALM_Q = 0.8;
const MERGE_MS = 3000; // stretches closer than this are one
// what each change weighs in a cut's score (in spreads) and what the marks add
const WEIGHT = { strain: 1, density: 0.6, chord: 0.5, jack: 0.5, ln: 0.7 };
const FLOOR = { strain: 0.3, density: 1, chord: 0.15, jack: 0.05, ln: 0.05 }; // the least spread of each
const BONUS = { kiai: 2.5, rest: 3, bpm: 1, phrase: 0.3 };
const PATTERN = ['density', 'chord', 'jack', 'ln'];
const REF_MS = 60000; // a section is rated over this much of it (repeated), or as it is when longer
// the map's own dan sits at this time-weighted point of its sections' dans (from the easiest), by the
// chart: where on 500 maps (2026-10-28, the user: "한 500개 정도 돌리면 될 거 같아") the map's dan followed
// its 1-minute section dans most steadily. 4K rice 0.8 (gap spread 0.46 dans, as 0.85; 0.7: 0.60), hybrid
// (15-50 % long notes) 0.7 (0.54; 0.85: 0.62), LN (50 % or more) 0.75 (Reform 0.53, LN Course 0.63; 0.85:
// 0.58, 0.68), 7K 0.8 (0.50; 0.85: 0.65). The 0.85 of before (40 rice maps, longer sections) had put the
// hybrid, LN and 7K sections 0.3-0.5 dans low (the user: "하브,롱놋 등이 과소평가가 될 수도").
const ANCHOR_Q = { rice: 0.8, hybrid: 0.7, ln: 0.75, k7: 0.8 };
const anchorQ = (chart) => {
  if (chart.keys === 7) return ANCHOR_Q.k7;
  const ln = chart.notes.filter((o) => o.ln).length / Math.max(1, chart.notes.length);
  return ln >= 0.5 ? ANCHOR_Q.ln : ln >= 0.15 ? ANCHOR_Q.hybrid : ANCHOR_Q.rice;
};
const POOL = 0.3; // how much of a section's own rating stays against the map's dan-to-strain line …
const NOISE = 0.5; // … of the first half dan off it (the ratings' noise); beyond that all of it stays (patterns)
const GATE = 0.5; // a section this near the map's dan (in dans) shows the map's dan; a farther one comes this much nearer
const gated = (d) => Math.sign(d) * Math.max(0, Math.abs(d) - GATE);
const SHOW = 0.25; // how much of the engine's own 1-minute dan over (or under) the map's dan shows (see anchor)
const SPIKE = 1.0; // a momentary peak shows when it stands this many dans over both sides of it and over the rest of its section
const SCRAP = 2000; // a piece of a section's rest shorter than this beside a peak is shown with the peak
// a peak lasting BRIEF s or less (on the real clock) rises at most BRIEF_RISE dans over its rest; all of its rise
// from BRIEF + BRIEF_RAMP s (the user, 2026-10-28: "순간(↑) 값 의 경우 저게 1초 이상 지속되지 않는 이상은 난이도가
// 너무 급격하게 변하지 않는 게 맞는 거 같아 (물론 조금 오를 수는 있어도)")
const BRIEF = 1.0;
const BRIEF_RAMP = 0.5;
const BRIEF_RISE = 0.5;
// a peak reads no higher than a section that keeps its strain up (SUSTAINED of it, SUSTAIN_S s on end): see
// withSpikes sustainedAt
const SUSTAINED = 0.98;
const SUSTAIN_S = 4;
// the live timeline's step (the user, 2026-10-28: "1초 간격보다 간격을 더 좁히고 싶은데", then 0.5 s; "어디까지
// 좁게 할 수 있는지", then the floor: tosu sends the song's time every 0.1 s and Sunny SR's graph is on a 0.1 s
// grid. At 0.1 s rice flipped no more than at 0.5 s (up and back within a second: Lazorbeamz 0, Break 1.4 a
// minute), its ramps showing sublevel by sublevel; LN rows a little more, 6.4 against 4.1 on AureoLe [EXCEED 0.9x])
const STEP = 100;
const HOLD = 0.15; // a move of what shows smaller than this (dans) is not shown (a value on a sublevel's edge)
// how much of the LN Course dp of Sunny's parts (live_model.js) moves a 4K LN row: all of it, the songs of an LN
// dan course marathon (one stage each) read further apart than with presses and releases (the six of 8th-15th
// spread 9.6 stages in all against 7.7); 0.6: 8.0, and the rows flipped up and back 0-1.1 times a minute where
// presses and releases did 4-10 (ch3rry 10.3 → 0, AureoLe [EXCEED 0.9x] 6.9 → 0)
const LN_SHRINK = 0.6;
// a 4K rice row's level from Sunny's parts: their median over this much either side, its RICE_Q point over the
// map put on the map's own dan, and RICE_MIX of it with the rest the sections' way (the user, 2026-10-28: "반반
// 섞으면서 sunny 쪽과 적당히 반영해볼까"; all of it put Break ~ Gamma ~'s second hard part at Delta Low, "이건 사실
// 나도 어려워하긴 해", and Sakazuki [Kyomu]'s last part at Gamma High, but Lazorbeamz 1.1x's opening at Beta
// Mid-Low and Shiawase [Challenge]'s verses at 10th)
const RICE_SLOW = 4000;
const RICE_Q = 0.8;
const RICE_MIX = 0.5;
// no step moves further than this up from its row, or MOVE_DOWN down (dans): a row is one part; Angel Dust ~
// Zeta ~ 1:08 read Kappa Beyond (+15) where a section held the first song's dense last 2 s and the quiet between
// the songs. Down it goes further: capped at 2 too, the calm 14-18 notes a second inside Mario Paint ~ Epsilon ~
// (Marathon)'s 31-a-second stream stayed at Gamma Low (testers, 2026-10-30: rest parts read high)
const MOVE_CAP = 2;
const MOVE_DOWN = 6;
const DENSE_ROOM = 0.15; // a rice step moves fully down only with this share fewer notes than its section's usual (see timelineOf)
const STEADY = 1500; // a step's density is taken with this much either side (their median): a change shows when it lasts 2 s
const TIERS_7K = ['0th', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', 'Gamma', 'Azimuth', 'Zenith', 'Stellium'];

let seq = 0;

/** sublevel of a dp, as the dan panel names it (sublevelOf in tm-dan.js) */
function sublevelOf(dp) {
  const f = dp - Math.floor(dp);
  return f <= 0.2 ? 'Low' : f <= 0.4 ? 'Mid-Low' : f <= 0.6 ? 'Mid' : f <= 0.8 ? 'Mid-High' : 'High';
}

/** what the page needs to name a payload's dan the way the dan panel would, for each of its dan scales */
export function danOf(p) {
  const scale = (o, key) => (o && o.label ? { name: String(o.label), sub: o.beyond ? 'Beyond' : sublevelOf(Number(o[key]) || 0), dp: Number(o[key]) || 0 } : null);
  if (p.mode === '7k' && p.tier_7k) {
    // 7K as 4K: k7 the Regular dan (as reform), k7ln the LN one where the LN dan leads (as ln), a hybrid's other
    // dan its second (hybrid_7k.js); without its kinds (DanOverlay's 7K model, an error) the engine's one dan
    const route = String(p.ln_route || 'rice');
    const t = p.tm_7k && p.tm_7k.rice ? p.tm_7k : null;
    const of = (k) => ({ name: String(k.tier), sub: String(k.sub || ''), dp: Number(k.dp) || 0 });
    if (!t) {
      const k7 = { name: String(p.tier_7k), sub: String(p.sublevel_7k || ''), dp: Number(p.dp_7k) || 0 };
      return { route, k7, k7ln: route === 'ln' ? k7 : null };
    }
    const s = p.tm_second;
    return {
      route,
      k7: of(t.rice),
      k7ln: route === 'ln' ? of(t.ln) : null,
      second: s && s.name ? { kind: String(s.kind), k7: true, name: String(s.name), sub: String(s.sub || ''), dp: Number(s.dp) } : null,
    };
  }
  const route = String(p.ln_route || 'rice');
  const s = p.tm_second;
  return {
    route,
    ln: route === 'ln' ? scale(p.ln_course, 'dp_ln') : null,
    reform: { name: String(p.dan_label || ''), sub: p.beyond ? 'Beyond' : String(p.sublevel || ''), dp: Number(p.dp) || 0 },
    celestial: scale(p.celestial, 'dp_celestial'),
    signicial: scale(p.signicial, 'dp_signicial'),
    shoegazer: scale(p.shoegazer, 'dp_shoegazer'),
    // a hybrid's second dan, with its dp when known (rc: the map's Reform dp; ln: tm_ln's) to move it with
    // the first
    second: s && s.name
      ? { kind: String(s.kind), name: String(s.name), sub: String(s.sub || ''), dp: s.kind === 'rc' ? Number(p.dp) || null : p.tm_ln && p.tm_ln.dp != null ? Number(p.tm_ln.dp) : null }
      : null,
  };
}

/** each dan scale's name and sublevel for a dp, as the engine gives them (7K: _finish_7k's tiers) */
const RELABEL = {
  reform: (dp) => {
    const v = Math.max(0, dp);
    const beyond = v >= _DAN_ORDER.length + 1;
    return { name: dp_to_label(v)[0], sub: beyond ? 'Beyond' : dp_to_sublevel(Math.max(1, v)), dp: v };
  },
  ln: (dp) => {
    const f = lnFields(dp);
    return f.label ? { name: String(f.label), sub: f.beyond ? 'Beyond' : sublevelOf(f.dp_ln), dp: f.dp_ln } : null;
  },
  celestial: (dp) => {
    const f = celestialFields(dp);
    return f.label ? { name: String(f.label), sub: f.beyond ? 'Beyond' : sublevelOf(f.dp_celestial), dp: f.dp_celestial } : null;
  },
  signicial: (dp) => {
    const f = signicialFields(dp);
    return f.label ? { name: String(f.label), sub: f.beyond ? 'Beyond' : sublevelOf(f.dp_signicial), dp: f.dp_signicial } : null;
  },
  shoegazer: (dp) => {
    const f = shoegazerFields(dp);
    return f.label ? { name: String(f.label), sub: f.beyond ? 'Beyond' : sublevelOf(f.dp_shoegazer), dp: f.dp_shoegazer } : null;
  },
  k7: (dp) => {
    const v = Math.max(0, dp);
    if (v >= 15) return { name: 'Beyond Stellium', sub: 'Beyond', dp: v };
    const i = Math.min(14, Math.floor(v));
    return { name: i <= 10 ? `${TIERS_7K[i]} Dan` : TIERS_7K[i], sub: sublevelOf(v), dp: v };
  },
  k7ln: (dp) => RELABEL.k7(dp), // 7K LN dans: the same tiers
};
/** the scale a hybrid's second moves with: 4K's Reform / LN Course, 7K's Regular / LN */
const secondScale = (second) => (second.k7 ? (second.kind === 'rc' ? 'k7' : 'k7ln') : second.kind === 'rc' ? 'reform' : 'ln');

/** the dp a share q of the time is at or under, over [{ w, dp }] (time-weighted) */
function quantile(parts, q) {
  const s = [...parts].sort((a, b) => a.dp - b.dp);
  const total = s.reduce((t, p) => t + p.w, 0);
  let acc = 0;
  for (const p of s) {
    acc += p.w;
    if (acc >= q * total) return p.dp;
  }
  return s[s.length - 1].dp;
}

/**
 * the line through a scale's section dans along their strain (time-weighted least squares; never falling
 * with the strain): { lined, slope (dans a unit of strain), mm, md (the means) }; with fewer than 4
 * sections it is not trusted
 */
function lineOf(parts) {
  const W = parts.reduce((t, p) => t + p.w, 0);
  const mm = parts.reduce((t, p) => t + p.w * p.x, 0) / W;
  const md = parts.reduce((t, p) => t + p.w * p.dp, 0) / W;
  if (parts.length < 4) return { lined: false, slope: 0, mm, md };
  const sxx = parts.reduce((t, p) => t + p.w * (p.x - mm) ** 2, 0);
  const sxd = parts.reduce((t, p) => t + p.w * (p.x - mm) * (p.dp - md), 0);
  return { lined: true, slope: sxx > 0 ? Math.max(0, sxd / sxx) : 0, mm, md };
}
/** the line's dp at a strain */
const onLine = (m, strain) => m.md + m.slope * (strain - m.mm);
/**
 * a part's own 1-minute dp pooled towards the line at its strain: of its first NOISE off the line POOL stays,
 * the rest of it all (a section far off the line is so by its patterns, not by noise: long notes and jacks
 * weigh otherwise in Sunny SR's strain than in the dan engine; in a hybrid map, full pooling moved its LN parts'
 * Reform dans up to 2.2 dans and its hardest rice part down 0.7)
 */
const pooledOf = (m, dp, strain) => (m.lined ? dp - (1 - POOL) * Math.max(-NOISE, Math.min(NOISE, dp - onLine(m, strain))) : dp);

/**
 * a part's dans as the rows show them: on each scale its own 1-minute dan pooled towards the line at its
 * strain and set against the map's dan (within GATE of it: the map's); a hybrid's second takes the same step
 * as its scale's own (no line through seconds)
 */
function placed(dan, strain, map) {
  const out = Object.assign({}, dan);
  for (const [scale, m] of Object.entries(map)) {
    if (!dan[scale] || m.target == null) continue;
    const moved = RELABEL[scale](m.target + gated(pooledOf(m, dan[scale].dp, strain) - m.q));
    if (moved) out[scale] = moved;
  }
  const second = dan.second;
  const scale = second && secondScale(second);
  const m = scale && map[scale];
  if (second && second.dp != null && m && m.target != null) {
    const moved = RELABEL[scale](m.target + gated(second.dp - m.q));
    if (moved) out.second = Object.assign({}, second, moved);
  }
  return out;
}

/**
 * set the sections against the map's dan, on each scale: their dans pooled towards the scale's line along the
 * strain (POOL), and a section within GATE of the map's usual strong level (the dan at the point `at` of its
 * time, ANCHOR_Q) showing that level, put at the map's own dan (the dan panel's) and a quarter of the way on to
 * the engine's own 1-minute dan there (SHOW) → each scale's { lined, slope, mm, md, q, target }.
 * 2026-10-28: right on the map's dan, a map's hardest parts read as the map: Sakazuki [Kyomu]'s last part
 * Gamma Mid-Low (testers: "미드로우면 너무 내려치기"; the user: "실시간으로 보여주려고 하는건 종합적인 결과 가
 * 아니라 실시간으로 예측하는거란다"). On the engine's own 1-minute dans instead, Break ~ Gamma ~ read Delta Mid
 * where the map is Gamma Mid-High ("오히려 개악되었어"): a minute of a 12-15 s burst is a minute of it without
 * a rest, and on 198 4K rice maps (of the 500 above) the map's dan sat a mean 0.34 dans under that point (sd
 * 0.43), the more the less of the map is near it (0.74 under a quarter of its time, about none on an even
 * map); Break 0.77, Sakazuki 0.72. A quarter keeps Break at Gamma High (the user: "감마보다 조금 어려운 정도")
 * and lifts Sakazuki's last part to Gamma Mid (a half: Delta Low, Gamma Mid-High); over the 198 maps it puts the
 * hard parts a mean 0.09 dans over the map's dan, 0.21 at the 90th percentile. The engine rates Break's jacks
 * 0.4 dans over Sakazuki's last part either way.
 */
function anchor(sections, whole, at) {
  const map = {};
  for (const scale of Object.keys(RELABEL)) {
    const parts = sections.filter((s) => s.dan && s.dan[scale]).map((s) => ({ w: s.to - s.from, x: s.strain || 0, dp: s.dan[scale].dp }));
    if (!parts.length) continue;
    const m = lineOf(parts);
    m.q = quantile(parts.map((p) => ({ w: p.w, dp: pooledOf(m, p.dp, p.x) })), at);
    m.target = whole[scale] ? whole[scale].dp + SHOW * (m.q - whole[scale].dp) : null;
    map[scale] = m;
  }
  // the scales without a dan of the map's own (an LN scale in a rice map) move as Reform (7K: as its Regular dan)
  const r = map.reform || map.k7;
  for (const m of Object.values(map)) if (m.target == null && r && r.target != null) m.target = m.q + r.target - r.q;
  for (const s of sections) {
    s.raw = {}; // each scale's own 1-minute dp, before all this (for tests and the log)
    for (const [scale, m] of Object.entries(map)) if (s.dan[scale] && m.target != null) s.raw[scale] = s.dan[scale].dp;
    s.dan = placed(s.dan, s.strain || 0, map);
  }
  return map;
}

/**
 * the chart: what comes before [HitObjects], its notes { line, t, end, col, ln, jack } by time (jack: its
 * column also had a note in the row before), its red lines { t, beat, meter }, kiai spans and breaks
 */
export function readChart(text) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === '[HitObjects]');
  if (at < 0) return null;
  const keys = Math.round(Number((String(text).match(/^CircleSize\s*:\s*([\d.]+)/m) || [])[1]));
  const reds = [];
  const points = []; // every timing point, for kiai: { t, kiai }
  const breaks = [];
  let section = '';
  for (let i = 0; i < at; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    const head = line.match(/^\[(.+)\]$/);
    if (head) {
      section = head[1];
      continue;
    }
    const p = line.split(',');
    if (section === 'TimingPoints') {
      const t = Number(p[0]);
      const beat = Number(p[1]);
      if (!Number.isFinite(t) || !Number.isFinite(beat)) continue;
      const uninherited = p.length > 6 ? p[6].trim() === '1' : beat > 0;
      if (uninherited && beat > 0) reds.push({ t, beat, meter: Number(p[2]) > 0 ? Number(p[2]) : 4 });
      points.push({ t, kiai: ((Number(p[7]) || 0) & 1) === 1 });
    } else if (section === 'Events' && /^(2|Break),/.test(line)) {
      breaks.push([Number(p[1]), Number(p[2])]);
    }
  }
  const notes = [];
  for (const line of lines.slice(at + 1)) {
    const p = line.split(',');
    const t = Number(p[2]);
    if (p.length < 4 || !Number.isFinite(t)) continue;
    const ln = (Number(p[3]) & 128) !== 0;
    const end = ln ? Number(String(p[5]).split(':')[0]) : t;
    const col = Math.min(keys - 1, Math.max(0, Math.floor((Number(p[0]) * keys) / 512)));
    notes.push({ line: line.trim(), t, end: Number.isFinite(end) ? Math.max(t, end) : t, col, ln, jack: false });
  }
  if (!notes.length) return null;
  notes.sort((a, b) => a.t - b.t);
  // jacks: a note whose column was also hit in the row just before it
  let prevCols = new Set();
  let rowCols = new Set();
  let rowT = NaN;
  for (const o of notes) {
    if (o.t !== rowT) {
      prevCols = rowCols;
      rowCols = new Set();
      rowT = o.t;
    }
    o.jack = prevCols.has(o.col);
    rowCols.add(o.col);
  }
  reds.sort((a, b) => a.t - b.t);
  // kiai spans: the state of the last timing point at or before each moment (a green line after a red one
  // at the same time decides)
  const kiai = [];
  let on = null;
  for (const pt of points.map((x, i) => ({ ...x, i })).sort((a, b) => a.t - b.t || a.i - b.i)) {
    if (pt.kiai && on === null) on = pt.t;
    else if (!pt.kiai && on !== null) {
      if (pt.t > on) kiai.push([on, pt.t]);
      on = null;
    }
  }
  if (on !== null) kiai.push([on, Infinity]);
  return { head: lines.slice(0, at + 1), notes, keys, reds, kiai, breaks };
}

/**
 * a section's notes [a, b) repeated from a over `length` ms (shifted by the section's span each time);
 * without the notes touching the spans in `skip` ([from, to] pairs), the later ones moved up to close
 * each gap
 */
function repeated(chart, a, b, length, skip = []) {
  const gaps = skip.filter(([x, y]) => y > a && x < b).map(([x, y]) => [Math.max(x, a), Math.min(y, b)]);
  const picked = [];
  for (const o of chart.notes) {
    if (o.t < a || o.t >= b || gaps.some(([x, y]) => o.t < y && o.end >= x)) continue;
    picked.push({ o, cut: gaps.reduce((t, [x, y]) => t + (y <= o.t ? y - x : 0), 0) });
  }
  if (!picked.length) return null;
  const span = b - a - gaps.reduce((t, [x, y]) => t + y - x, 0);
  const out = [];
  for (let k = 0; k * span < length; k++) {
    const shift = k * span;
    for (const { o, cut } of picked) {
      if (o.t - cut + shift - a >= length) break;
      const p = o.line.split(',');
      p[2] = String(o.t - cut + shift);
      if (Number(p[3]) & 128) {
        const q = String(p[5]).split(':');
        q[0] = String(Number(q[0]) - cut + shift);
        p[5] = q.join(':');
      }
      out.push(p.join(','));
    }
  }
  return chart.head.concat(out).join('\n');
}

/** the first note index at or after time t (notes by time) */
function lowerBound(notes, t) {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** what the chart is like in [a, b): strain (Sunny SR's mean), notes a second, notes a row, jacks, long notes */
function features(chart, strain, a, b) {
  const { notes } = chart;
  let n = 0;
  let rows = 0;
  let jacks = 0;
  let lns = 0;
  let rowT = NaN;
  for (let i = lowerBound(notes, a); i < notes.length && notes[i].t < b; i++) {
    const o = notes[i];
    n += 1;
    if (o.t !== rowT) {
      rows += 1;
      rowT = o.t;
    }
    if (o.jack) jacks += 1;
    if (o.ln) lns += 1;
  }
  let s = 0;
  let k = 0;
  const T = strain ? strain.times : [];
  for (let j = 0; j < T.length; j++) {
    if (T[j] >= a && T[j] < b) {
      s += strain.values[j];
      k += 1;
    }
  }
  const secs = Math.max(1e-3, (b - a) / 1000);
  return { strain: k ? s / k : 0, density: n / secs, chord: rows ? n / rows : 0, jack: n ? jacks / n : 0, ln: n ? lns / n : 0, n };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const stdev = (xs) => {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

/** how the chart varies over itself: each feature's median and spread over windows of the given length */
function spreadOf(chart, strain, first, last, window) {
  const wins = [];
  for (let t = first; t + window <= last; t += window / 2) {
    const f = features(chart, strain, t, t + window);
    if (f.n) wins.push(f);
  }
  const out = { median: {}, spread: {} };
  for (const key of Object.keys(WEIGHT)) {
    const xs = wins.map((w) => w[key]);
    out.median[key] = median(xs);
    out.spread[key] = Math.max(FLOOR[key], stdev(xs));
  }
  return out;
}

/**
 * where the sections change and what each one is: [{ from, to, kind }] covering the chart (kind 'kiai' |
 * 'peak' | ''). opts over DEFAULTS (tests).
 */
/**
 * the quiet stretches [[a, b]]: where no more than QUIET_HEADS notes are struck within a second either side for
 * REST_MS or longer (long notes may be held), a and b at the last struck note before and the first after (a
 * quarter second off them); with `calm`, the calm stretches too (CALM_SHARE)
 */
function quietStretches(notes, first, last, calm = true) {
  const STEP_Q = 100;
  const n = Math.floor((last - first) / STEP_Q) + 1;
  const heads = new Uint16Array(n + 1);
  const acts = new Uint16Array(n + 1); // struck and released
  for (const o of notes) {
    const k = Math.floor((o.t - first) / STEP_Q);
    if (k >= 0 && k <= n) {
      heads[k] += 1;
      acts[k] += 1;
    }
    const r = Math.floor((o.end - first) / STEP_Q);
    if (o.ln && r >= 0 && r <= n) acts[r] += 1;
  }
  const c = new Uint32Array(n + 2);
  const ca = new Uint32Array(n + 2);
  for (let k = 0; k <= n; k++) {
    c[k + 1] = c[k] + heads[k];
    ca[k + 1] = ca[k] + acts[k];
  }
  const near = (k) => c[Math.min(n + 1, k + 11)] - c[Math.max(0, k - 10)]; // struck within a second either side
  const nearActs = (k) => ca[Math.min(n + 1, k + 11)] - ca[Math.max(0, k - 10)];
  let calmMax = -1;
  if (calm) {
    const all = [];
    for (let k = 0; k <= n; k++) all.push(nearActs(k));
    all.sort((x, y) => x - y);
    calmMax = CALM_SHARE * all[Math.min(all.length - 1, Math.floor(CALM_Q * all.length))];
  }
  const runs = [];
  let start = -1;
  for (let k = 0; k <= n + 1; k++) {
    const quietHere = k <= n && (near(k) <= QUIET_HEADS || nearActs(k) <= calmMax);
    if (quietHere && start < 0) start = k;
    if (!quietHere && start >= 0) {
      // the stretch's steps lie a second inside the struck notes on both sides: back out to those notes
      const a = first + start * STEP_Q - 750;
      const b = first + k * STEP_Q + 750;
      // less than MERGE_MS of notes between two stretches joins them (no sections of a second or two between
      // them: Samba Land [Hard] went from 8 sections to 19 with the calm ones apart)
      const prev = runs[runs.length - 1];
      if (prev && a - prev[1] < MERGE_MS) prev[1] = b;
      else runs.push([a, b]);
      start = -1;
    }
  }
  return runs.filter(([a, b]) => b - a >= REST_MS);
}

export function findSections(chart, strain, opts = {}) {
  const o = Object.assign({}, DEFAULTS, opts);
  const { notes } = chart;
  const first = notes[0].t;
  const last = notes.reduce((m, x) => Math.max(m, x.end), first);
  const kiai = o.noKiai ? [] : chart.kiai.map(([s, e]) => [Math.max(s, first), Math.min(e, last)]).filter(([s, e]) => e - s >= 1000);
  const stats = spreadOf(chart, strain, first, last, o.window);

  // the candidates and their marks: bar lines (phrase every 4th), rests, kiai edges, BPM changes
  const marks = new Map(); // rounded time → { t, bonus }
  const mark = (t, bonus) => {
    if (!(t > first && t < last)) return;
    const key = Math.round(t / 100);
    const m = marks.get(key) || { t, bonus: 0 };
    m.bonus = Math.max(m.bonus, bonus);
    marks.set(key, m);
  };
  chart.reds.forEach((r, i) => {
    const until = i + 1 < chart.reds.length ? chart.reds[i + 1].t : last;
    const bar = r.beat * r.meter;
    if (!(bar >= 200) || (until - r.t) / bar > 4000) return; // a line for effect, not a bar
    for (let k = 0; r.t + k * bar < until; k++) mark(r.t + k * bar, k % 4 === 0 ? BONUS.phrase : 0);
    const prev = chart.reds[i - 1];
    if (prev && Math.abs(prev.beat - r.beat) / prev.beat > 0.01) mark(r.t, BONUS.bpm);
  });
  let runEnd = notes[0].end;
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].t - runEnd >= REST_MS) mark((runEnd + notes[i].t) / 2, BONUS.rest);
    runEnd = Math.max(runEnd, notes[i].end);
  }
  for (const [s, e] of kiai) {
    mark(s, BONUS.kiai);
    mark(e, BONUS.kiai);
  }

  // each candidate's score: how much the chart changes there, in spreads, and its marks (a cut inside a kiai
  // part, not at its edge, counts for less)
  const insideKiai = (t) => kiai.some(([s, e]) => t > s + 500 && t < e - 500);
  const scored = [];
  for (const m of marks.values()) {
    const before = features(chart, strain, Math.max(first, m.t - o.window), m.t);
    const after = features(chart, strain, m.t, Math.min(last, m.t + o.window));
    let step = 0;
    if (before.n && after.n) {
      for (const key of Object.keys(WEIGHT)) step += WEIGHT[key] * ((after[key] - before[key]) / stats.spread[key]) ** 2;
    }
    const score = Math.sqrt(step) + m.bonus;
    scored.push({ t: m.t, score: insideKiai(m.t) ? score / o.kiaiInside : score });
  }
  scored.sort((x, y) => y.score - x.score);
  let cuts = [];
  for (const c of scored) {
    if (cuts.length >= o.max - 1 || c.score < o.cut) break;
    if (c.t - first < o.min || last - c.t < o.edge) continue;
    if (cuts.some((x) => Math.abs(x.t - c.t) < o.min)) continue;
    cuts.push({ t: c.t, score: c.score });
  }
  // each cut to the candidate nearby where the chart changes most over a short window (where a change starts)
  if (o.refine) {
    const near = [...marks.values()];
    for (const cut of cuts) {
      let best = cut.t;
      let bestScore = -1;
      for (const m of near) {
        if (Math.abs(m.t - cut.t) > o.near) continue;
        const before = features(chart, strain, Math.max(first, m.t - o.refine), m.t);
        const after = features(chart, strain, m.t, Math.min(last, m.t + o.refine));
        let step = 0;
        if (before.n && after.n) {
          for (const key of Object.keys(WEIGHT)) step += WEIGHT[key] * ((after[key] - before[key]) / stats.spread[key]) ** 2;
        }
        const score = Math.sqrt(step) + m.bonus;
        if (score > bestScore) {
          bestScore = score;
          best = m.t;
        }
      }
      cut.t = best;
    }
  }
  // still o.min apart (o.edge from the end) after moving: the weaker of two cuts too close goes
  const kept = [];
  for (const c of [...cuts].sort((x, y) => y.score - x.score)) {
    if (c.t - first < o.min || last - c.t < o.edge || kept.some((x) => Math.abs(x.t - c.t) < o.min)) continue;
    kept.push(c);
  }
  cuts = kept.map((c) => c.t).sort((a, b) => a - b);
  // the quiet stretches, each a section: cut at their edges (where the struck notes stop and start again), no
  // other cut inside or within 2 s of an edge
  const quiet = quietStretches(notes, first, last, o.calm);
  if (quiet.length) {
    const edges = [];
    for (const [a, b] of quiet) {
      if (a - first >= REST_MS) edges.push(a);
      if (last - b >= REST_MS) edges.push(b);
    }
    cuts = cuts.filter((t) => !quiet.some(([a, b]) => t > a - 2000 && t < b + 2000)).concat(edges).sort((a, b) => a - b);
  }
  // a section longer than maxLen splits again at its best candidate inside, the parts still min or longer
  for (let guard = 0; guard < 200 && cuts.length < o.max - 1; guard++) {
    const bounds = [first, ...cuts, last];
    let worst = -1;
    for (let i = 0; i + 1 < bounds.length; i++) {
      if (bounds[i + 1] - bounds[i] > o.maxLen && (worst < 0 || bounds[i + 1] - bounds[i] > bounds[worst + 1] - bounds[worst])) worst = i;
    }
    if (worst < 0) break;
    const a = bounds[worst];
    const b = bounds[worst + 1];
    const inside = scored.filter((c) => c.t - a >= o.min && b - c.t >= o.min);
    if (!inside.length) break;
    // the best score, nearer the middle on a tie (scored is by score, best first)
    const top = inside[0].score;
    const pick = inside.filter((c) => c.score >= top - 0.05).sort((x, y) => Math.abs(x.t - (a + b) / 2) - Math.abs(y.t - (a + b) / 2))[0];
    cuts.push(pick.t);
    cuts.sort((x, y) => x - y);
  }

  // what each section is: kiai (mostly under kiai), a peak (much stronger than usual, or patterns far from
  // the map's at no less than usual strength), or neither
  const bounds = [first, ...cuts.map(Math.round), last + 1];
  const sections = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    const under = kiai.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0);
    const f = features(chart, strain, from, to);
    const z = (f.strain - stats.median.strain) / stats.spread.strain;
    const odd = Math.sqrt(PATTERN.reduce((s, key) => s + WEIGHT[key] * ((f[key] - stats.median[key]) / stats.spread[key]) ** 2, 0));
    sections.push({ from, to, under, z, odd, strain: f.strain, kind: '' });
  }
  // the strongest sections, up to `top` of the map's time (when set)
  let topLine = -Infinity;
  if (o.top > 0) {
    const total = last - first;
    let acc = 0;
    for (const s of [...sections].sort((x, y) => y.strain - x.strain)) {
      acc += s.to - s.from;
      topLine = s.strain;
      if (acc >= o.top * total) break;
    }
  }
  for (const s of sections) {
    if (s.under >= 0.5 * (s.to - s.from)) s.kind = 'kiai';
    else if ((s.z >= o.peakZ && s.strain >= topLine) || (s.odd >= o.oddD && s.z >= 0)) s.kind = 'peak';
    delete s.under;
  }
  return sections;
}

/**
 * the momentary peaks: [{ from, to, g }] for the seconds (runs of them) whose strain, a second's mean of
 * Sunny SR's graph, is a local top standing SPIKE dans (along the map's line) over the median of the 2nd-4th
 * seconds before it and over that of the 2nd-4th after, whichever is higher (a build-up, or the change from
 * one part to the next, is not a peak: one side of it is as strong); outside the chart counts as silence
 */
function findSpikes(curve, slope) {
  const out = [];
  if (!curve || !(slope > 0)) return out;
  const at = (i) => (i >= 0 && i < curve.length ? curve[i] : 0);
  for (let s = 0; s < curve.length; s++) {
    const g = curve[s];
    if (!(g > 0) || g < at(s - 1) || g < at(s + 1)) continue;
    const side = Math.max(median([at(s - 4), at(s - 3), at(s - 2)]), median([at(s + 2), at(s + 3), at(s + 4)]));
    if (slope * (g - side) < SPIKE) continue;
    const prev = out[out.length - 1];
    if (prev && prev.to === s * 1000) {
      prev.to += 1000;
      if (g - side > prev.g - prev.side) Object.assign(prev, { g, side });
    } else out.push({ from: s * 1000, to: (s + 1) * 1000, g, side });
  }
  return out;
}

/**
 * the sections with their momentary peaks as rows of their own (kind 'spike'). The rest of a peak's section is
 * rated again without it (rateWithout(section, skip) → payload); the peak's dans are that rest's and its rise
 * over the seconds on both sides of it (along the line), but no more than the map's line at its strain set
 * against the map's dan (no gate: a moment, not a part; on Sakazuki [Kyomu] the line alone put its peaks 2.1
 * dans over the rest, the rise 1.1-1.3: the line runs high at the strong end of a map). A peak stays when it
 * stands SPIKE dans over the rest, the rest of the section showing its own dans around it; one lasting BRIEF s
 * or less then shows BRIEF_RISE of that at most (raw: Sunny's D before smoothing, for how long it lasts). Nor
 * above a section that keeps its strain up for a while (sustainedAt).
 */
async function withSpikes(chart, sections, map, graph, curve, rateWithout, raw = null, rate = 1, sustained = true) {
  const main = chart.keys === 7 ? 'k7' : 'reform';
  const line = map[main];
  if (!line || !line.lined || line.target == null) return sections;
  const spikes = findSpikes(curve, line.slope);
  if (!spikes.length) return sections;
  // how long a peak lasts (s, real clock): the time Sunny's D before the graph's smoothing (raw: { d, step } on
  // the map's clock; its parts are taken over a second, so anything shorter reads about a second) stays over
  // halfway from its sides (the 2nd-4th seconds either side, the higher) to its top; null without it
  const lastingOf = (p) => {
    if (!raw || !raw.d) return null;
    const { d, step } = raw;
    const at = (k) => (k >= 0 && k < d.length ? d[k] : 0);
    const lo = Math.floor((p.from - 1500) / step);
    const hi = Math.ceil((p.to + 1500) / step);
    let top = lo;
    for (let k = lo; k <= hi; k++) if (at(k) > at(top)) top = k;
    const w = Math.max(1, Math.round(1000 / step));
    const sideOf = (a, b) => {
      const xs = [];
      for (let k = a; k <= b; k++) xs.push(at(k));
      return median(xs);
    };
    const half = (Math.max(sideOf(top - 4 * w, top - 2 * w), sideOf(top + 2 * w, top + 4 * w)) + at(top)) / 2;
    let a = top;
    let b = top;
    while (a - 1 >= lo && at(a - 1) >= half) a--;
    while (b + 1 <= hi && at(b + 1) >= half) b++;
    return ((b - a + 1) * step) / 1000 / (rate > 0 ? rate : 1);
  };
  const { notes } = chart;
  // a row over [a, b) of a section, or none when no note starts in it
  const part = (s, a, b, dan, raw, kind) => {
    const i0 = lowerBound(notes, a);
    if (i0 >= notes.length || notes[i0].t >= b) return null;
    let end = 0;
    for (let i = i0; i < notes.length && notes[i].t < b; i++) end = Math.max(end, notes[i].end);
    return { from: a, to: b, start: notes[i0].t, end, kind, z: s.z, odd: s.odd, strain: s.strain, dan, raw, sec: s.from };
  };
  // the rest of a section without its peaks [[from, to]]: its own dans and raw dps, as the rows show them
  const restOf = async (s, peaks) => {
    const payload = await rateWithout(s, peaks.map((p) => [p.from, p.to]));
    if (!payload) return null;
    const own = danOf(payload);
    let at = s.from;
    let sum = 0;
    let span = 0;
    for (const p of [...peaks, { from: s.to, to: s.to }]) {
      if (p.from > at) {
        sum += features(chart, graph, at, p.from).strain * (p.from - at);
        span += p.from - at;
      }
      at = p.to;
    }
    const raw = {};
    for (const [scale, m] of Object.entries(map)) if (own[scale] && m.target != null) raw[scale] = own[scale].dp;
    return { dan: placed(own, span ? sum / span : s.strain || 0, map), raw };
  };
  // what a sustained part shows at a peak's strain g on a scale: the most among the sections holding SUSTAIN_S
  // seconds on end at SUSTAINED × g or over (the peaks' own seconds left out), or null when none does. A
  // moment the map keeps up elsewhere reads as that part does (Mario Paint ~ Epsilon ~ (Marathon): its stream
  // of 31 notes a second comes back for a second or two inside calmer sections at 0:17, 0:42 and 1:10, read
  // ↑ Zeta-Eta Mid-Low where the stream itself shows Epsilon High; testers, 2026-10-30: "패턴 자체는 크게
  // 달라진게없는데"). Cake by the Ocean's column jacks stand as high over its chorus (2-6 % in the strain),
  // but no stretch of the chorus stays there over 2 s. Held to sections whose mean strain is about as high,
  // the two could not be told apart
  const inPeak = new Set();
  for (const p of spikes) for (let s = p.from / 1000; s < p.to / 1000; s++) inPeak.add(s);
  const sustainedAt = (scale, g) => {
    let top = null;
    let run = 0;
    for (let s = 0; s <= curve.length; s++) {
      if (s < curve.length && !inPeak.has(s) && curve[s] >= SUSTAINED * g) {
        run++;
        continue;
      }
      if (run >= SUSTAIN_S) {
        const mid = (s - run / 2) * 1000;
        const t = sections.find((x) => mid >= x.from && mid < x.to);
        if (t && t.dan && t.dan[scale]) top = Math.max(top ?? -Infinity, t.dan[scale].dp);
      }
      run = 0;
    }
    return top;
  };
  // a peak's dans over a rest, or null when it does not stand SPIKE over it on the scale it was found on
  // (Reform, 7K's own; not a hybrid's LN Course dan)
  const peakDan = (s, p, rest) => {
    const dan = { route: s.dan.route, second: null };
    for (const [scale, m] of Object.entries(map)) {
      if (!rest.dan[scale] || m.target == null || !m.lined) continue;
      let up = Math.min(rest.dan[scale].dp + m.slope * (p.g - p.side), m.target + onLine(m, p.g) - m.q);
      const cap = sustained ? sustainedAt(scale, p.g) : null;
      if (cap != null) up = Math.min(up, cap);
      if (!Number.isFinite(up)) continue;
      const moved = RELABEL[scale](Math.max(rest.dan[scale].dp, up));
      if (moved) dan[scale] = moved;
    }
    if (!(dan[main] && rest.dan[main] && dan[main].dp - rest.dan[main].dp >= SPIKE)) return null;
    // a brief one shows a little of its rise (BRIEF)
    const lasting = lastingOf(p);
    if (lasting != null) {
      const k = Math.max(0, Math.min(1, (lasting - BRIEF) / BRIEF_RAMP));
      for (const scale of Object.keys(map)) {
        if (!dan[scale] || !rest.dan[scale]) continue;
        const rise = dan[scale].dp - rest.dan[scale].dp;
        const shown = Math.min(rise, BRIEF_RISE) + k * Math.max(0, rise - BRIEF_RISE);
        dan[scale] = RELABEL[scale](rest.dan[scale].dp + shown) || dan[scale];
      }
      dan.lasting = Math.round(lasting * 10) / 10;
    }
    return dan;
  };
  const out = [];
  for (const s of sections) {
    // not in an LN section: the strain sees note heads only (this Sunny SR leaves out long notes' bodies and
    // releases), and there a burst of heads made peaks of two or three LN Course dans on Hatatagami Software
    let peaks = (s.dan.route === 'ln' ? [] : spikes)
      .filter((p) => (p.from + p.to) / 2 >= s.from && (p.from + p.to) / 2 < s.to)
      .map((p) => ({ from: Math.max(p.from, s.from), to: Math.min(p.to, s.to), g: p.g, side: p.side }));
    // two peaks or more in one section are how it goes, not moments: it stays whole, rated with them (testers,
    // 2026-10-28, on Sakazuki [Kyomu]'s last part, whose peaks at 1:41 and 1:47 topped a dense stretch: "순간밀도
    // 델타 뜨는거 … 너무 순간인데", and with them taken out the rest read Gamma Mid-Low, "미드로우면 너무 내려치기")
    if (peaks.length >= 2) peaks = [];
    let rest = peaks.length ? await restOf(s, peaks) : null;
    if (rest) {
      // the peaks that stand over the rest; the rest rated again without only those when some fell
      let kept = peaks.filter((p) => (p.dan = peakDan(s, p, rest)));
      if (kept.length && kept.length < peaks.length) {
        rest = await restOf(s, kept);
        kept = rest ? kept.filter((p) => (p.dan = peakDan(s, p, rest))) : [];
      }
      peaks = kept;
    }
    if (!rest || !peaks.length) {
      out.push(s);
      continue;
    }
    // the rows: the rest around the peaks; a scrap of rest under 2 s goes to the peak beside it
    const rows = [];
    let at = s.from;
    for (const p of peaks) {
      if (p.from - at >= SCRAP) rows.push({ a: at, b: p.from, peak: null });
      else if (rows.length && rows[rows.length - 1].peak) rows[rows.length - 1].b = p.from;
      else p.from = at;
      rows.push({ a: p.from, b: p.to, peak: p });
      at = p.to;
    }
    if (s.to - at >= SCRAP) rows.push({ a: at, b: s.to, peak: null });
    else rows[rows.length - 1].b = s.to;
    for (const r of rows) out.push(r.peak ? part(s, r.a, r.b, r.peak.dan, {}, 'spike') : part(s, r.a, r.b, rest.dan, rest.raw, s.kind));
  }
  return out.filter(Boolean);
}

/**
 * a long-note part's density step by step, as a rate a second: presses and releases together (an LN's head
 * and its tail each count; the strain sees heads only, and in LN rows the steps move by this instead), counted
 * over the second around each step's middle (counted in each step alone, steps of 0.1 s held 0 to 5 and an LN
 * row flipped up and down 13 times a minute on AureoLe [EXCEED 0.9x])
 */
function actionsOf(chart, bins, step) {
  const times = [];
  for (const o of chart.notes) {
    times.push(o.t);
    if (o.ln) times.push(o.end);
  }
  times.sort((x, y) => x - y);
  const out = new Float64Array(bins + 2);
  let lo = 0;
  let hi = 0;
  for (let s = 0; s < out.length; s++) {
    const mid = s * step + step / 2;
    while (lo < times.length && times[lo] < mid - 500) lo++;
    while (hi < times.length && times[hi] < mid + 500) hi++;
    out[s] = hi - lo; // a second's worth
  }
  return out;
}

/**
 * each scale's line through its LN sections' own 1-minute dans along their presses and releases a second
 * (the LN rows' counterpart of the strain line: on 3 LN maps the LN Course dans of the sections followed
 * it at r 0.83-0.94); not trusted under 4 LN sections
 */
function lnLinesOf(sections, acts, step) {
  const lines = {};
  const ln = sections.filter((s) => s.dan && s.dan.route === 'ln' && s.raw);
  for (const scale of Object.keys(RELABEL)) {
    const parts = ln.filter((s) => s.raw[scale] != null).map((s) => {
      let sum = 0;
      let n = 0;
      for (let x = Math.floor(s.from / step); x * step < s.to; x++, n++) sum += acts[x] || 0;
      return { w: s.to - s.from, x: n ? sum / n : 0, dp: s.raw[scale] };
    });
    if (parts.length) lines[scale] = lineOf(parts);
  }
  return lines;
}

/** two dans showing alike on every scale (null for a rest) */
const sameDan = (a, b) => (!a || !b ? a === b : Object.keys(RELABEL).every((k) => (a[k] ? `${a[k].name} ${a[k].sub}` : null) === (b[k] ? `${b[k].name} ${b[k].sub}` : null)));

/**
 * the predicted dan second by second, for the play (the user, 2026-10-28: "1초로 하고 가사 대신에 양쪽에
 * -3초, +3초 … (가운데는 실시간 난이도 예측)"; and "밀도가 일정하다고 느끼는 경우 매끄럽게"). A second has
 * its row's dans, moved by how much denser or sparser it is than its section is where it is rated (its
 * strain, a second's mean of Sunny SR's graph, against the section's at its 80 % point, as the map's dan sits
 * at its sections': a part's dan stands for its harder seconds), along each scale's line, beyond GATE, so a
 * part of even density keeps one dan. An LN row moves the same way: in a 4K map by the LN Course dp of Sunny's
 * parts (lnCurve, live_model.js lnDpsOf; LN_SHRINK of it; the user, 2026-10-28: "LN만 Sunny 성분으로"), else by
 * its presses and releases a second along the LN sections' line of them (lnLines, acts: the strain sees heads
 * only; the user, 2026-10-28: "롱놋은 제대로 반영이 안되는 거 같은 기분탓인가", when LN rows kept one dan); a
 * momentary peak and a hybrid row keep their own; a second without a note held in it is a rest. Set against a row's own median instead,
 * the seconds of a row half chorus, half break read Kappa (Cake by the Ocean, 1:55).
 * Stepped by `step` ms (STEP: 0.1 s, first half a second; the user, 2026-10-28: "1초 간격보다 간격을 더 좁히고
 * 싶은데", "어디까지 좁게 할 수 있는지"), each step's strain (Sunny SR's graph over the step) and presses and
 * releases (over the second around it) taken with the steps 1.5 s either side; a move under `hold` dans from
 * what shows is not shown.
 * → runs [{ from, to, dan, kind }] (steps in a row that show the same; dan null and kind 'rest' for a rest)
 */
function timelineOf(chart, rows, map, curve, lnLines = {}, acts = null, step = STEP, hold = 0, lnCurve = null, lnShrink = 1, rice = null) {
  if (!rows.length) return [];
  const { notes } = chart;
  const first = Math.max(0, Math.floor(notes[0].t / step));
  const last = Math.floor(notes.reduce((m, o) => Math.max(m, o.end), 0) / step);
  const held = new Uint8Array(last + 2); // the steps a note is struck or held in
  for (const o of notes) for (let k = Math.max(0, Math.floor(o.t / step)); k <= Math.min(last, Math.floor(o.end / step)); k++) held[k] = 1;
  const sec = Math.max(1, Math.round(1000 / step)); // the steps in a second
  // a rest: no note struck or held within a second of the step (a sparse part is not a rest every other step)
  const busy = (k) => {
    for (let j = Math.max(0, k - sec); j <= Math.min(last, k + sec); j++) if (held[j]) return true;
    return false;
  };
  const w = Math.max(1, Math.round(STEADY / step));
  const near = (f, k) => {
    const xs = [];
    for (let j = k - w; j <= k + w; j++) xs.push(f(j));
    return median(xs);
  };
  const g1 = (k) => (curve && k >= 0 && k < curve.length ? curve[k] : 0);
  // a step's strain with STEADY either side (their median): a change lasting 2 s or more shows to the step, a
  // shorter one up or down does not (on Lazorbeamz 1.1x, an even map, lone seconds flipped Gamma Mid-Low to
  // Beta High and back; with half a second either side, 60 changes against 34 in steps of a second; merging
  // the short runs into the one before instead swallowed the ramps, Cake by the Ocean's chorus showing up 4 s
  // late; a peak a dan over both sides has its own row)
  const g = (k) => near(g1, k);
  // the same for an LN row's presses and releases a second
  const a1 = (k) => (acts && k >= 0 && k < acts.length ? acts[k] : 0);
  const a = (k) => near(a1, k);
  // and for an LN row's LN Course dp from Sunny's parts (live_model.js lnDpsOf), when there is one
  const l1 = (k) => (lnCurve ? lnCurve[Math.min(lnCurve.length - 1, Math.max(0, k))] : 0);
  const l = (k) => near(l1, k);
  // notes struck within a second either side of each step (a step with long notes only held strikes none)
  const struck = new Uint32Array(last + 3);
  for (const o of notes) {
    const k = Math.floor(o.t / step);
    if (k >= 0 && k <= last) struck[k + 1] += 1;
  }
  for (let k = 1; k < struck.length; k++) struck[k] += struck[k - 1];
  const struckNear = (s) => struck[Math.min(last + 1, s + sec + 1)] - struck[Math.max(0, s - sec)];
  const nd = (k) => near(struckNear, k); // steadied as the strain is
  // each section's strain (and presses and releases, its LN dp, notes struck) where it is rated: the 80 % point
  // of its busy steps (its peaks left out)
  const bySec = new Map();
  for (const r of rows) {
    const key = r.sec ?? r.from;
    if (!bySec.has(key)) bySec.set(key, { g: [], a: [], l: [], n: [] });
    if (r.kind === 'spike') continue;
    const ln = lnCurve && r.dan && r.dan.route === 'ln';
    for (let k = Math.floor(r.from / step); k * step < r.to; k++) {
      if (!held[k]) continue;
      bySec.get(key).g.push({ w: 1, dp: g(k) });
      bySec.get(key).a.push({ w: 1, dp: a(k) });
      bySec.get(key).n.push({ w: 1, dp: nd(k) });
      if (ln) bySec.get(key).l.push({ w: 1, dp: l(k) });
    }
  }
  const usual = rows.map((r) => {
    const xs = bySec.get(r.sec ?? r.from);
    const at = (list) => (list.length ? quantile(list, 0.8) : 0);
    return { g: at(xs.g), a: at(xs.a), l: at(xs.l), n: at(xs.n) };
  });
  // a 4K rice row's level from Sunny's parts (rice: { curve, whole, shift, mix }): their median over RICE_SLOW
  // either side among the busy steps of rice rows, its RICE_Q point over the map set on the map's dan; a rice row
  // shows `mix` of it and the rest its own way
  let riceAt = null;
  if (rice && rice.curve) {
    const W = Math.max(1, Math.round(RICE_SLOW / step));
    const ok = new Uint8Array(last + 2); // busy rice steps with notes struck (long notes only held are not rice)
    let j = 0;
    for (let s = first; s <= last; s++) {
      while (j + 1 < rows.length && s * step + step / 2 >= rows[j].to) j++;
      const r = rows[j];
      ok[s] = busy(s) && struckNear(s) > QUIET_HEADS && r.kind !== 'spike' && r.dan && (r.dan.route || 'rice') === 'rice' && s < rice.curve.length ? 1 : 0;
    }
    const slow = new Float64Array(last + 2).fill(NaN);
    const vals = [];
    for (let s = first; s <= last; s++) {
      if (!ok[s]) continue;
      const xs = [];
      for (let k = Math.max(first, s - W); k <= Math.min(last, s + W); k++) if (ok[k]) xs.push(rice.curve[k]);
      slow[s] = median(xs);
      vals.push({ w: 1, dp: slow[s] });
    }
    if (vals.length) {
      const off = rice.whole - quantile(vals, RICE_Q);
      riceAt = (s) => (Number.isFinite(slow[s]) ? slow[s] + off : null);
    }
  }
  const runs = [];
  const shown = {}; // each scale's dan shown at the step before
  let i = 0;
  for (let s = first; s <= last; s++) {
    while (i + 1 < rows.length && s * step + step / 2 >= rows[i].to) i++;
    const r = rows[i];
    let dan = null;
    let kind = 'rest';
    if (busy(s)) {
      kind = r.kind || '';
      dan = r.dan;
      // a rice row by its strain, an LN row by its presses and releases; a hybrid row keeps its dans (a second
      // with long notes held looks sparse to the strain, and moved by it a hybrid of Alpha Mid-Low read 7th Low
      // under its LN Yoake: Hatatagami, 1:02)
      const route = r.dan.route || 'rice';
      if (r.kind !== 'spike' && (route === 'rice' || route === 'ln')) {
        dan = Object.assign({}, r.dan);
        // an LN row of a 4K map by the LN Course dp of Sunny's parts, in dans already (every scale of the row
        // the same way); else by its presses and releases along the map's LN line
        const sunnyLn = route === 'ln' && lnCurve;
        const level = route === 'rice' && riceAt ? riceAt(s) : null; // a rice row's level from Sunny's parts
        for (const [scale, m] of Object.entries(map)) {
          const line = route === 'ln' ? lnLines[scale] : m;
          if (!r.dan[scale] || m.target == null) continue;
          let d = null;
          if (sunnyLn) d = gated(lnShrink * (l(s) - usual[i].l));
          else if (line && line.lined && line.slope > 0) d = gated(line.slope * (route === 'ln' ? a(s) - usual[i].a : g(s) - usual[i].g));
          if (level != null && rice.shift[scale] != null) {
            // mixed with Sunny's level: rice.mix of it
            const own = r.dan[scale].dp + (d || 0);
            d = rice.mix * (level + rice.shift[scale]) + (1 - rice.mix) * own - r.dan[scale].dp;
          }
          if (d == null) continue;
          d = Math.max(-MOVE_DOWN, Math.min(MOVE_CAP, d));
          // a rice step struck no less densely than its section is where it is rated goes no lower than the row,
          // and all the way down only from DENSE_ROOM fewer notes: the strain weighs patterns otherwise than notes
          // a second (volcanic [Challenge]'s 2 s jumptrill at 1:52, 36-38 notes a second at the head of a
          // 26-a-second stream, read Beta in a Delta map; testers, 2026-10-30: "볼카닉 (델타) 트릴 부분 왜
          // 베타쪽이지"). Stopped outright instead, the rows flipped where the notes hover at the section's level.
          if (route === 'rice' && d < 0 && usual[i].n > 0) d *= Math.max(0, Math.min(1, (usual[i].n - nd(s)) / (DENSE_ROOM * usual[i].n)));
          if (d) dan[scale] = RELABEL[scale](r.dan[scale].dp + d) || r.dan[scale];
          // a move smaller than `hold` from what shows keeps what shows (a value on a sublevel's edge flips it
          // back and forth at fine steps)
          const before = shown[scale];
          if (hold > 0 && before && dan[scale] && Math.abs(dan[scale].dp - before.dp) < hold) dan[scale] = before;
        }
      }
    }
    for (const scale of Object.keys(map)) shown[scale] = dan && dan[scale] ? dan[scale] : null;
    const prev = runs[runs.length - 1];
    if (prev && prev.kind === kind && sameDan(prev.dan, dan)) prev.to = (s + 1) * step;
    else runs.push({ from: s * step, to: (s + 1) * step, dan, kind });
  }
  return runs;
}

/** Sunny SR's graph a step at a time: its half-second bins, or its 0.1 s ones put together for another step */
function curveAt(sr, step) {
  if (step === 500 && sr.strain_05) return sr.strain_05;
  const fine = sr.strain_01;
  if (!fine) return sr.strain_05;
  const k = step / 100;
  const out = [];
  for (let i = 0; i < fine.length; i += k) {
    let sum = 0;
    let n = 0;
    for (let j = i; j < Math.min(fine.length, i + k); j++, n++) sum += fine[j];
    out.push(n ? sum / n : 0);
  }
  return out;
}

/** drop the per-chart caches the sections filled (they have no bound; the dan panel's worker keeps its own) */
function forget() {
  _sr_cache.clear();
  _mono_registry.clear();
  _minaCache.clear();
}

export async function runSectionsJob(job, analyse) {
  const chart = readChart(job.text);
  if (!chart || (chart.keys !== 4 && chart.keys !== 7)) return { keys: chart ? chart.keys : 0, sections: [] };
  const { notes } = chart;
  const first = notes[0].t;
  const last = notes.reduce((m, o) => Math.max(m, o.end), first);
  const tag = (++seq).toString(16).padStart(12, '0');
  const step = job.step > 0 && job.step % 100 === 0 ? job.step : STEP; // tests: another live step (100 ms steps)
  try {
    // the strain at 1.0x: where the chart changes does not depend on the speed
    const path = `sections_${tag}.osu`;
    putFile(path, new TextEncoder().encode(job.text), seq);
    let sr;
    try {
      sr = analyze_primary_sr(path, 'NM', 1.0);
    } finally {
      removeFile(path);
    }
    const found = findSections(chart, sr && sr.strain_graph, job.cutOptions || {});
    // the whole map, as the dan panel rates it: what the sections are set against
    const whole = job.dry ? null : await analyse(Object.assign({}, job, { path: `sections_whole_${tag}.osu`, md5: tag }), job.text);
    const sections = [];
    for (const [i, s] of found.entries()) {
      const inside = notes.filter((o) => o.t >= s.from && o.t < s.to);
      if (!inside.length) continue;
      const section = { from: s.from, to: s.to, start: inside[0].t, end: inside.reduce((m, o) => Math.max(m, o.end), 0), kind: s.kind, z: s.z, odd: s.odd, strain: s.strain };
      if (!job.dry) {
        const id = `${tag}${i.toString(16).padStart(2, '0')}`;
        const payload = await analyse(Object.assign({}, job, { path: `section_${id}.osu`, md5: id.padEnd(12, '0').slice(-12) }), repeated(chart, s.from, s.to, Math.max(REF_MS, s.to - s.from)));
        if (!payload || payload.type !== 'analysis' || payload.error) continue;
        section.dan = danOf(payload);
      }
      sections.push(section);
    }
    let rows = sections;
    let offset = null;
    let timeline = [];
    if (!job.dry && whole && whole.type === 'analysis' && !whole.error) {
      const map = anchor(sections, danOf(whole), anchorQ(chart));
      offset = Object.fromEntries(Object.entries(map).map(([k, m]) => [k, m.target == null ? null : m.target - m.q]));
      // a section rated again without some spans of it (its momentary peaks)
      let n = 0;
      const rateWithout = async (s, skip) => {
        const text = repeated(chart, s.from, s.to, Math.max(REF_MS, s.to - s.from), skip);
        if (!text) return null;
        const id = `${tag.slice(-9)}r${(++n).toString(16).padStart(2, '0')}`;
        const payload = await analyse(Object.assign({}, job, { path: `section_${id}.osu`, md5: id }), text);
        return payload && payload.type === 'analysis' && !payload.error ? payload : null;
      };
      // Sunny SR's parts step by step at the play's speed (ManiaMapAnalyser's port, live_model.js): how long a
      // momentary peak lasts; a 4K map's LN rows move by them (job.lnMoves 'actions' for tests: as before); its
      // rice rows take half their level from them (job.riceLevel 'off' / job.riceMix for tests). job.sustained
      // false (tests): peaks not held to the sustained parts
      const rate = Number(job.rate) || 1;
      let sig = null;
      try {
        sig = signalsOf(chart, job.text, rate, step, job.classic === true, true);
      } catch (err) {
        sig = null; // peaks as they rise, LN rows by presses and releases
      }
      if (job.spikes !== false) rows = await withSpikes(chart, sections, map, sr && sr.strain_graph, sr && sr.strain_1s, rateWithout, sig && sig.d ? { d: sig.d, step } : null, rate, job.sustained !== false);
      const acts = actionsOf(chart, Math.floor(last / step), step);
      const wantLn = chart.keys === 4 && job.lnMoves !== 'actions' && rows.some((r) => r.dan && r.dan.route === 'ln');
      const wantRice = chart.keys === 4 && job.riceLevel !== 'off' && rows.some((r) => r.dan && (r.dan.route || 'rice') === 'rice');
      const lnCurve = sig && wantLn ? lnDpsOf(sig) : null;
      let rice = null;
      const wd = danOf(whole);
      if (sig && wantRice && wd.reform && wd.reform.dp > 0) {
        const shift = {};
        for (const scale of ['reform', 'celestial', 'signicial', 'shoegazer']) if (wd[scale] && wd[scale].dp != null) shift[scale] = wd[scale].dp - wd.reform.dp;
        const mix = job.riceMix >= 0 && job.riceMix <= 1 ? Number(job.riceMix) : RICE_MIX;
        rice = { curve: riceDpsOf(sig), whole: wd.reform.dp, shift, mix };
      }
      timeline = timelineOf(chart, rows, map, sr && curveAt(sr, step), lnLinesOf(sections, acts, step), acts, step, job.hold != null ? Number(job.hold) || 0 : HOLD, lnCurve, job.lnShrink > 0 ? Number(job.lnShrink) : LN_SHRINK, rice);
    }
    // a long note held over a cut stays in the row it starts in; a row shows up to the next one
    for (let i = 0; i + 1 < rows.length; i++) rows[i].end = Math.min(rows[i].end, rows[i + 1].start);
    const wholeDan = whole && whole.type === 'analysis' && !whole.error ? danOf(whole) : null;
    return { keys: chart.keys, sections: rows, timeline, step, kiai: chart.kiai.length > 0, offset, whole: wholeDan };
  } finally {
    forget();
  }
}

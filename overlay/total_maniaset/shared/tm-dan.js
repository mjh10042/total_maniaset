/* total_maniaset — dan panel (DanOverlay "Modern" skin)
 *
 * Renders the analysis results of the built-in engine (tm-engine.js: the
 * DanOverlay 3.1.0 engine by 8doul, ported to JavaScript) with DanOverlay's
 * Modern skin rules: palettes, scoring modes (Reform / Celestial / Signicial /
 * Shoegazer), automatic LN Course routing, 7K tiers, drain bar, pause and clear
 * results. Map header / progress come straight from tosu so they work even
 * while the engine is still starting.
 */
(function () {
  'use strict';

  const TM = window.TM;

  TM.DAN_DEFAULTS = {
    danEngine: '2.3.5+MMA 평균', // "4K 계산 엔진" (tm-engine.js setEngine)
    dan7kModel: 'total_maniaset',
    danStyle: 'Minimal',
    danNameSize: 56,
    danDensityGraph: true,
    danDensityOpacity: 0.5,
    danBpmResponse: 'Every beat',
    danScoringMode: 'Reform',
    danLayout: 'Full',
    danShowWhen: 'Always',
    danShowBackground: true,
    danBgBrightness: 0.85,
    danBlur: 12,
    danShowResult: true,
    danPerf: true, // live performance dan (4K, LN <= 45 %)
    danShowPp: true, // pp after SR · BPM · OD (live in play, final on results, SS otherwise)
    danPerfMinNotes: 300,
    danShowPause: true, // PAUSE ×N in LIVE's place once the pause menu was opened (the dan goes on beside it) — on any chart
  };

  TM.DAN_V2_FILTERS = [
    { field: 'state', keys: ['name'] },
    { field: 'play', keys: ['accuracy', 'failed', { field: 'mods', keys: ['name', 'rate'] }, { field: 'hits', keys: ['0', '50', '100', '300', 'geki', 'katu'] }, { field: 'pp', keys: ['current'] }] },
    {
      field: 'beatmap',
      keys: [
        'checksum', 'artist', 'title', 'version', 'mapper',
        { field: 'mode', keys: ['name'] },
        { field: 'time', keys: ['live', 'lastObject', 'mp3Length'] },
        {
          field: 'stats',
          keys: [
            { field: 'stars', keys: ['total', 'live'] }, // live: the play's own pp past 32,767 judgements (PP_PAST)
            { field: 'od', keys: ['converted'] },
            { field: 'bpm', keys: ['common', 'min', 'max'] },
            { field: 'objects', keys: ['total', 'holds'] },
          ],
        },
      ],
    },
    {
      field: 'resultsScreen',
      keys: ['accuracy', 'score', { field: 'pp', keys: ['current'] }, { field: 'hits', keys: ['0', '50', '100', '300', 'geki', 'katu'] }, { field: 'mods', keys: ['name', 'number'] }],
    },
    { field: 'performance', keys: [{ field: 'accuracy', keys: ['100'] }] }, // SS pp (song select)
    { field: 'files', keys: ['background'] },
    { field: 'game', keys: ['paused'] }, // pause menu open (live performance dan: pause count)
  ];

  // ── palettes (verbatim from DanOverlay overlay.js) ──────────────────
  const DAN_PALETTES = {
    '1st Dan': ['rgb(118,199,255)', 'rgb(231,244,255)'],
    '2nd Dan': ['rgb(113,180,255)', 'rgb(196,236,255)'],
    '3rd Dan': ['rgb(115,166,255)', 'rgb(180,224,255)'],
    '4th Dan': ['rgb(120,155,255)', 'rgb(168,205,255)'],
    '5th Dan': ['rgb(139,152,255)', 'rgb(211,224,255)'],
    '6th Dan': ['rgb(166,146,255)', 'rgb(238,221,255)'],
    '7th Dan': ['rgb(196,143,255)', 'rgb(255,226,239)'],
    '8th Dan': ['rgb(235,160,114)', 'rgb(255,224,163)'],
    '9th Dan': ['rgb(255,175,99)', 'rgb(255,235,170)'],
    '10th Dan': ['rgb(255,199,108)', 'rgb(255,248,200)'],
    Alpha: ['rgb(70,60,180)', 'rgb(220,65,80)', 'rgb(245,225,45)'],
    Beta: ['rgb(255,245,180)', 'rgb(255,165,0)'],
    Gamma: ['rgb(255,0,0)', 'rgb(0,60,255)', 'rgb(0,255,90)'],
    Delta: ['rgb(95,60,125)', 'rgb(215,130,50)'],
    Epsilon: ['rgb(215,45,95)', 'rgb(30,80,150)', 'rgb(245,240,215)'],
    Zeta: ['rgb(240,130,105)', 'rgb(130,190,225)'],
    Eta: ['rgb(145,0,0)', 'rgb(200,80,70)'],
    Theta: ['rgb(105,5,5)', 'rgb(170,65,55)'],
    Iota: ['rgb(75,10,10)', 'rgb(145,50,50)'],
    Kappa: ['rgb(125,125,125)', 'rgb(190,190,200)'],
  };
  const PALETTES_7K = {
    '0th Dan': ['rgb(180,185,210)', 'rgb(130,135,185)', 'rgb(200,210,240)'],
    '1st Dan': ['rgb(0,75,100)', 'rgb(0,180,180)', 'rgb(100,245,185)'],
    '2nd Dan': ['rgb(160,40,240)', 'rgb(255,20,147)', 'rgb(40,10,80)'],
    '3rd Dan': ['rgb(100,10,30)', 'rgb(220,80,20)', 'rgb(255,160,50)'],
    '4th Dan': ['rgb(5,60,45)', 'rgb(0,255,120)', 'rgb(180,255,50)'],
    '5th Dan': ['rgb(15,15,110)', 'rgb(115,20,180)', 'rgb(255,40,150)'],
    '6th Dan': ['rgb(140,40,10)', 'rgb(255,190,0)', 'rgb(255,250,220)'],
    '7th Dan': ['rgb(15,15,20)', 'rgb(180,185,200)', 'rgb(120,40,255)'],
    '8th Dan': ['rgb(60,5,30)', 'rgb(220,10,70)', 'rgb(0,240,255)'],
    '9th Dan': ['rgb(10,5,5)', 'rgb(255,60,0)', 'rgb(255,210,0)'],
    '10th Dan': ['rgb(100,0,220)', 'rgb(0,255,150)', 'rgb(240,245,255)'],
    Gamma: ['rgb(0,255,170)', 'rgb(10,50,120)', 'rgb(180,0,255)'],
    Azimuth: ['rgb(255,90,0)', 'rgb(200,20,60)', 'rgb(255,230,150)'],
    Zenith: ['rgb(240,245,255)', 'rgb(100,110,130)', 'rgb(0,100,255)'],
    Stellium: ['rgb(255,0,128)', 'rgb(140,50,255)', 'rgb(0,255,255)'],
    'Beyond Stellium': ['rgb(255,0,128)', 'rgb(140,50,255)', 'rgb(0,255,255)'],
  };
  const CELESTIAL_PALETTES = {
    Beginner: ['rgb(138,130,255)', 'rgb(200,197,255)'],
    Intermediate: ['rgb(76,175,80)', 'rgb(178,223,180)'],
    Expert: ['rgb(255,193,7)', 'rgb(255,235,150)'],
    Mastery: ['rgb(255,112,67)', 'rgb(255,200,175)'],
    Ascension: ['rgb(229,57,53)', 'rgb(255,160,158)'],
    Transcendence: ['rgb(171,71,188)', 'rgb(230,180,238)'],
    Singularity: ['rgb(220,220,220)', 'rgb(255,255,255)'],
  };

  function parseRGB(colorStr) {
    const m = String(colorStr).match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [120, 155, 255];
  }

  function saturateColor(colorStr, deltaPct) {
    const [r, g, b] = parseRGB(colorStr);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (d > 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === rn) h = (((gn - bn) / d) % 6) * 60;
      else if (max === gn) h = ((bn - rn) / d + 2) * 60;
      else h = ((rn - gn) / d + 4) * 60;
      if (h < 0) h += 360;
    }
    s = Math.min(1, s + deltaPct / 100);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    const sec = Math.floor(h / 60) % 6;
    if (sec === 0) { r1 = c; g1 = x; }
    else if (sec === 1) { r1 = x; g1 = c; }
    else if (sec === 2) { g1 = c; b1 = x; }
    else if (sec === 3) { g1 = x; b1 = c; }
    else if (sec === 4) { r1 = x; b1 = c; }
    else { r1 = c; b1 = x; }
    return `rgb(${Math.round((r1 + m) * 255)},${Math.round((g1 + m) * 255)},${Math.round((b1 + m) * 255)})`;
  }

  const SIGNICIAL_PALETTES = {
    I: ['rgb(232,232,232)', 'rgb(154,154,154)'],
    II: ['rgb(165,242,211)', 'rgb(0,128,128)'],
    III: ['rgb(220,232,245)', 'rgb(49,97,139)'],
    IV: ['rgb(217,191,255)', 'rgb(74,0,130)'],
    V: ['rgb(255,248,178)', 'rgb(214,123,30)'],
    VI: ['rgb(186,205,255)', 'rgb(56,41,122)'],
    VII: ['rgb(255,69,0)', 'rgb(255,215,0)', 'rgb(50,205,50)', 'rgb(0,255,255)'],
    VIII: ['rgb(92,147,255)', 'rgb(20,0,64)'],
    IX: ['rgb(255,255,255)', 'rgb(92,92,92)'],
    X: ['rgb(255,102,178)', 'rgb(139,0,42)'],
    XI: DAN_PALETTES.Alpha.map((c) => saturateColor(c, 5)),
    XII: DAN_PALETTES.Beta.map((c) => saturateColor(c, 5)),
    XIII: DAN_PALETTES.Gamma.map((c) => saturateColor(c, 5)),
    XIV: DAN_PALETTES.Delta.map((c) => saturateColor(c, 5)),
    LastStage: DAN_PALETTES.Epsilon.map((c) => saturateColor(c, 5)),
    ExtraStageI: DAN_PALETTES.Zeta.map((c) => saturateColor(c, 5)),
    ExtraStageII: ['rgb(0,41,134)', 'rgb(255,0,0)'],
    ExtraStageIII: ['rgb(168,0,15)', 'rgb(0,3,117)'],
  };
  const SHOEGAZER_PALETTES = {
    '1st': ['rgb(255,183,197)', 'rgb(135,206,235)'],
    '2nd': ['rgb(144,238,144)', 'rgb(34,139,34)'],
    '3rd': ['rgb(180,160,220)', 'rgb(75,0,130)'],
    '4th': ['rgb(255,223,128)', 'rgb(204,102,0)'],
    '5th': ['rgb(135,206,250)', 'rgb(0,51,102)'],
    '6th': ['rgb(255,120,120)', 'rgb(139,0,0)'],
    '7th': ['rgb(0,230,230)', 'rgb(0,80,80)'],
    '8th': ['rgb(180,130,255)', 'rgb(60,0,100)'],
    '9th': ['rgb(210,210,210)', 'rgb(60,60,60)'],
    '10th': ['rgb(200,50,80)', 'rgb(60,0,20)'],
    Luminal: ['rgb(220,240,255)', 'rgb(100,180,255)', 'rgb(200,200,200)'],
    Tachyon: ['rgb(100,120,255)', 'rgb(40,0,80)', 'rgb(0,0,0)'],
  };
  const LN_COURSE_PALETTES = {
    '1st': ['rgb(200,230,255)', 'rgb(120,175,230)'],
    '2nd': ['rgb(180,230,180)', 'rgb(60,160,60)'],
    '3rd': ['rgb(230,200,255)', 'rgb(130,80,200)'],
    '4th': ['rgb(255,220,160)', 'rgb(200,130,40)'],
    '5th': ['rgb(160,220,255)', 'rgb(30,100,180)'],
    '6th': ['rgb(255,175,175)', 'rgb(180,40,40)'],
    '7th': ['rgb(120,240,220)', 'rgb(0,120,100)'],
    '8th': ['rgb(200,160,255)', 'rgb(80,20,140)'],
    '9th': ['rgb(220,220,220)', 'rgb(90,90,100)'],
    '10th': ['rgb(255,160,200)', 'rgb(140,20,80)'],
    Yoake: ['rgb(255,200,120)', 'rgb(200,100,0)'],
    Yuugure: ['rgb(255,140,100)', 'rgb(160,40,80)'],
    Yoru: ['rgb(100,100,200)', 'rgb(20,20,80)'],
    Yami: ['rgb(80,60,120)', 'rgb(15,5,40)'],
    Yume: ['rgb(200,150,255)', 'rgb(100,0,180)', 'rgb(255,200,220)'],
    Yokaze: ['rgb(160,200,240)', 'rgb(40,60,100)', 'rgb(200,220,255)'],
  };
  // past Yokaze the LN stages go on by number (17th, 18th, …: ln_course_estimator.js), all in one grey near
  // black (2026-11-11, the user: "여기는 올 검정색에 가까운 회색으로 통일하는 게 맞을듯")
  const LN_NUMBERED_PALETTE = ['rgb(88,88,94)', 'rgb(18,18,22)'];
  /** the palette of an LN Course stage key: the table's 16, then the numbered grey */
  const lnStagePalette = (key) => LN_COURSE_PALETTES[key] || (/^\d+(st|nd|rd|th)$/.test(String(key)) ? LN_NUMBERED_PALETTE : null);

  const SKILLSET_LABELS = { stream: 'STREAM', jumpstream: 'JS', handstream: 'HS', stamina: 'STAM', jackspeed: 'JACK', chordjack: 'CJ', technical: 'TECH' };
  const SKILLSET_FAMILY = { stream: 'STREAM', jumpstream: 'STREAM', handstream: 'STAMINA', stamina: 'STAMINA', jackspeed: 'JACK', chordjack: 'JACK', technical: 'TECH' };
  const LAYOUT_HEIGHTS = { Full: 320, Simplified: 220, Compact: 76 };
  const PAUSE_STALL_MS = 700;

  // ── live performance dan (total_maniaset addition) ──────────────────
  // While a 4K chart (LN ≤ 45 %) is played: the dan the play shows so far, from its osu!stable accuracy.
  // A Reform dan is cleared at 96 % (intro 1st-3rd: passing only), so 96 % on this chart = the chart's
  // dan. Away from 96 %, lost accuracy (100 − acc) is multiplied by a fixed factor per dan — ln(lost)
  // moves by a fixed step — read from what players at 96 % on one dan get on the next (osu!stable):
  // Alpha → Beta 93-95 %, Beta → Gamma 90-93 %, Gamma → Delta 88-90 % (the user's observation, range
  // midpoints), Delta → Epsilon 76.5 %. The user's 85-90 % there counts only players who survived Epsilon
  // (a failed play leaves no accuracy), so that step is fitted to the records below instead (72-79.5 %
  // with any one player left out); fitting Gamma → Delta the same way keeps 89 %. The steps are
  // interpolated between Beta and Epsilon and held outside them (no data there), and the same steps hold
  // above 96 %.
  // Records of one player on several charts, which should all give the same dan: a Delta player's
  // Gamma 98.5x %, Delta 99 % ↔ Epsilon 92-94 %, wonder5193's Delta 99.43 % / Epsilon 94.19 %, and three
  // players on kimlachal's Dan Nightmare (Haruna_444, siroocake, specialcall). With ln and 76.5 % they
  // agree within 0.41 dan (before: √ 1.08, lost^0.2 0.72); leaving any one player out still picks ln.
  // The result screens agree: from Nightmare Stage 2 to 4, misses / 100s / 200s grew about ×3-4 for
  // both a Gamma and an Epsilon player. Tools: tools/live_perf_fit.py.
  // A play shows at most PERF_MAX_UP dans above the chart (no data so far up).
  // Above Epsilon (2026-10-25): Epsilon → Zeta keeps the Epsilon entry (no data); Zeta → Eta 90 % from the
  // only two players who have cleared Eta (myuka, Saragi: 98-99 % on Zeta courses, ~96 % on Eta-level
  // charts — the Epsilon entry held there made them Eta Low); Eta → Theta and up wide again, as the
  // Epsilon entry (the user: "에타부터는 간격이 좀 넓거든"; nobody plays Theta at 1.0x). Fitted with all
  // records together: loss 0.419 → 0.325, the earlier records' share unchanged (0.199).
  const perfT = (lost) => Math.log(Math.max(lost, 0.05) / 4);
  const PERF_STEPS = [[12, 94], [13, 91.5], [14, 89], [15, 76.5], [16, 76.5], [17, 90], [18, 76.5]]
    .map(([dan, acc]) => [dan, perfT(100 - acc)]);
  const PERF_MAX_UP = 3;
  // Above the Eta course the LIVE label is read against the official courses (the user, 2026-10-25: "에타부터는
  // 간격이 좀 넓거든", Eta / Theta and above should not be handed out). Only two players have cleared Eta
  // (96.27 / 96.13 %) and they play FINAL-THETA only at 0.9x, yet they get 95-97 % on rate-ups and courses
  // the engine puts at 18.0-18.6, next to FINAL-THETA itself — LIVE called 4 of their 10 records Theta.
  // So LIVE still climbs in the chart's dp, then above FINAL ETA a course's 96 % clear is the start of its
  // dan: ETA 17.74 stays, THETA 18.59 → 18.0, IOTA 19.79 → 19.0, KAPPA 20.83 → 20.0, linear in between
  // (the default engine's course dps). Theta from the Eta course now takes 99.1 % (was 97.5 %); all 10
  // records read Eta. Only LIVE: the chart's own dan stays the engine's (the user's choice).
  const PERF_TOP = [[17.74, 17.74], [18.59, 18.0], [19.79, 19.0], [20.83, 20.0]];
  // Shown instead of a dan:
  // - Legend: 100.0000 % (no 200 / 100 / 50 / miss, not 99.995 % rounded). Only MAX vs 300 is left, which
  //   osu!stable accuracy does not count.
  // - Unqualified: below PERF_MIN_ACC as shown (2 decimals). Far below the ladder (96 % → 89-94 % one dan
  //   up) the estimate would be stretched too far.
  const PERF_MIN_ACC = 90;
  // - Pause: the pause menu was opened during this play (tosu game.paused) — first the count replaced the
  //   dan for the rest of the play (a play that needed pauses did not show its level, the user's call);
  //   since 2026-10-29 the count takes LIVE's tag ("PAUSE ×N") and the dan goes on beside it (a player's wish,
  //   relayed: "단 트래킹 (live) 는 계속 측정해줬으면 좋겠대"); this badge only without a dan to show.
  //   tosu's game.paused only means "the song time did not move since the last read" (previousPlayTime ===
  //   playTime), so it is also on while a play (or replay) loads — 0.1-0.2 s on a short map, longer on a
  //   marathon — and blinks on other screens. A pause counts once it stays on for PERF_PAUSE_MIN_MS (real
  //   pauses measured 0.9-12 s) after the song has started playing: its time seen moving forward like
  //   playback (PERF_PLAY_STEPS steps of under a second), so an intro pause counts from the start (the
  //   user, 2026-10-25: "퍼즈는 시작하자마자 감지") while the load before it does not. A stop that ends with
  //   the time jumping ahead (an intro skip's seek) is taken back; the time jumping back is a retry.
  //   Replays play through without pausing, so a play's pauses cannot be seen in its replay.
  const PERF_PAUSE_MIN_MS = 400;
  const PERF_PLAY_STEPS = 2;
  const PERF_SPECIAL = {
    Legend: ['rgb(255,190,0)', 'rgb(255,250,220)', 'rgb(255,140,0)'],
    Unqualified: ['rgb(150,150,160)', 'rgb(215,215,225)'],
    Pause: ['rgb(255,150,70)', 'rgb(255,215,170)'],
  };
  const REFORM_ORDER = ['1st Dan', '2nd Dan', '3rd Dan', '4th Dan', '5th Dan', '6th Dan', '7th Dan', '8th Dan', '9th Dan',
    '10th Dan', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];

  // ── pp past 32,767 judgements ───────────────────────────────────────
  // tosu works its pp out from the counts it reads signed: once a count passes 32,767 it is nonsense (−894.41pp at
  // 23:42 into a 3 h 39 min 4K map, 2026-11-01; the counts themselves come mended from shared/tm-core.js). From there the panel
  // works it out: rosu-pp's mania formula on those counts, which gave tosu's /api/calculate/pp to the last decimal
  // (pp = 8 · max(SR − 0.15, 0.05)^2.2 · max(0, 5a − 4) · (1 + 0.1 · min(1, n / 1500)), a = (32 MAX + 30·300 +
  // 20·200 + 10·100 + 5·50) / 32n, NF ×0.75, EZ ×0.5). Its star rating so far: tosu gives it with two decimals
  // (±0.13 % of pp), so the exact one comes from tosu's own pp while that is right, then from the moments the
  // two-decimal rating steps (the true one is halfway then), carried on at the rate between them, within the
  // two-decimal value and not below the last exact one (a rating so far only grows); after a jump of more than
  // one step, the middle of what is left. On simulated 45-minute plays (tools/js_tests/overflow_check.mjs) that
  // puts the pp within 0.0005-0.009 % at the median (the two-decimal rating alone: 0.064-0.088 %), 0.13-0.17 % at
  // worst, right after a jump. A results screen asks tosu for the chart's whole rating at its mods, once: 0.15-0.3 s of
  // tosu's time on a 300,000-judgement chart, too long to ask during a play.
  const PP_PAST = 32768;
  const PP_RATE_MS = 10000; // song time between the ratings a rate is taken from
  const PP_GRADES = ['geki', '300', 'katu', '100', '50', '0'];
  const ppCounts = (hits) => (hits ? PP_GRADES.map((k) => Number(hits[k]) || 0) : null);

  /** rosu-pp's mania pp without its star rating part: pp = max(SR − 0.15, 0.05)^2.2 × this (mods: tosu's name, "NFDT") */
  function ppFactor(c, mods) {
    const n = c.reduce((s, v) => s + v, 0);
    if (n <= 0) return 0;
    const a = (32 * c[0] + 30 * c[1] + 20 * c[2] + 10 * c[3] + 5 * c[4]) / (32 * n);
    const m = String(mods || '').toUpperCase().match(/../g) || [];
    return 8 * (m.includes('NF') ? 0.75 : 1) * (m.includes('EZ') ? 0.5 : 1) * Math.max(0, 5 * a - 4) * (1 + 0.1 * Math.min(1, n / 1500));
  }
  const maniaPp = (sr, c, mods) => Math.round(Math.max(sr - 0.15, 0.05) ** 2.2 * ppFactor(c, mods) * 100) / 100;

  /** ln(lost accuracy) per dan around level `l` (dp scale) */
  function perfStep(l) {
    const first = PERF_STEPS[0];
    const last = PERF_STEPS[PERF_STEPS.length - 1];
    if (l <= first[0]) return first[1];
    if (l >= last[0]) return last[1];
    let i = 0;
    while (l > PERF_STEPS[i + 1][0]) i++;
    const [a, ga] = PERF_STEPS[i];
    const [b, gb] = PERF_STEPS[i + 1];
    return ga + ((gb - ga) * (l - a)) / (b - a);
  }

  /** a LIVE level (chart dp scale) → the dan it is shown as (PERF_TOP above the Eta course) */
  function perfShown(level) {
    if (level <= PERF_TOP[0][0]) return level;
    for (let i = 1; i < PERF_TOP.length; i++) {
      const [a, A] = PERF_TOP[i - 1];
      const [b, B] = PERF_TOP[i];
      if (level <= b) return A + ((B - A) * (level - a)) / (b - a);
    }
    const [k, K] = PERF_TOP[PERF_TOP.length - 1];
    return Math.min(20.99, K + level - k);
  }

  /**
   * the dan (dp scale) that osu!stable accuracy `acc` (%) on a chart of dan `dp` shows. Above 96 % the play
   * climbs in the chart's dp and is shown through PERF_TOP, so above the Eta course Theta still takes
   * Theta-course-level accuracy. Below 96 % it falls from where the chart is shown: falling in the chart's
   * dp too left the band squeezed between the Eta and Theta courses nearly flat — a replay on CloverWisp's
   * Theta Stamina (18.36) read Eta High from 96.25 % all the way down to 91.64 % (now Eta Mid).
   */
  function perfLevel(acc, dp) {
    let budget = perfT(100 - acc); // > 0: below the 96 % criterion
    const dir = budget > 0 ? -1 : 1;
    budget = Math.abs(budget);
    const top = Math.min(20.99, dp + PERF_MAX_UP);
    const step = 0.01;
    let l = dir < 0 ? perfShown(dp) : dp;
    while (budget > 0 && l > 0.5 && l < top) {
      const cost = perfStep(l + (dir * step) / 2) * step;
      if (budget < cost) {
        l += (dir * step * budget) / cost;
        break;
      }
      budget -= cost;
      l += dir * step;
    }
    l = TM.clamp(l, 0.5, top);
    return dir < 0 ? l : perfShown(l);
  }


  function relativeLuminance(rgb) {
    const [r, g, b] = rgb.map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // ── hybrids' second dan (total_maniaset addition), drawn like the first in its own colours ──
  // rc: the Reform palette of that dan · ln: ManiaMapAnalyser's LN level on the LN Course palettes
  // (same numbering up to 10th, then Yoake … Yokaze in order) · 7K (k7): that 7K dan's palette · below its
  // table: neutral grey
  const LN_STAGE_KEYS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', 'Yoake', 'Yuugure', 'Yoru', 'Yami', 'Yume', 'Yokaze'];
  const SECOND_NEUTRAL = ['rgb(225,228,238)', 'rgb(150,155,170)'];

  /** A hybrid's dan names, next to their RC / LN tags: "4th Dan" → "4th", "夜明け Yoake" → "Yoake". */
  function hybridName(name) {
    const s = String(name || '');
    const jp = s.match(/^[^\x00-\x7f]+\s+(\S+)$/);
    return jp ? jp[1] : s.replace(/\s+Dan$/i, '');
  }

  function secondPalette(second) {
    if (second.k7) return PALETTES_7K[second.tier] || SECOND_NEUTRAL;
    if (second.kind === 'rc') return DAN_PALETTES[second.dan] || SECOND_NEUTRAL;
    const level = Math.trunc(Number(second.level));
    if (!(level >= 1)) return SECOND_NEUTRAL;
    if (level > LN_STAGE_KEYS.length) return LN_NUMBERED_PALETTE; // 17+: the numbered stages past Yokaze
    return LN_COURSE_PALETTES[LN_STAGE_KEYS[level - 1]] || SECOND_NEUTRAL;
  }

  /** The CSS custom properties of a dan palette — the panel's own, or a hybrid's second dan group. */
  function paletteVars(palette) {
    const primary = parseRGB(palette[0]);
    const secondary = parseRGB(palette[palette.length - 1]);
    return [
      ['--dan-gradient', `linear-gradient(90deg, ${palette.join(', ')})`],
      ['--dan-gradient-anim', `linear-gradient(90deg, ${[...palette, ...palette, palette[0]].join(', ')})`],
      ['--dan-primary', `rgb(${primary.join(',')})`],
      ['--dan-secondary', `rgb(${secondary.join(',')})`],
      ['--dan-glow', `rgba(${primary.join(',')}, 0.45)`],
      ['--dan-border', `rgba(${primary.join(',')}, 0.35)`],
      ['--dan-bg-tint', `rgba(${primary.join(',')}, 0.08)`],
      // sublevel chips: the end colour, lifted where it is too dark to read on the dark chip
      // (e.g. LN Course 7th / 8th / Yami, Theta, Iota)
      ['--dl-sub-color', `rgb(${liftColor(secondary, 0.3).join(',')})`],
    ];
  }

  /** [r, g, b] mixed towards white until its relative luminance reaches minLum (dark palettes on a dark chip). */
  function liftColor(rgb, minLum) {
    if (relativeLuminance(rgb) >= minLum) return rgb;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const t = (lo + hi) / 2;
      if (relativeLuminance(rgb.map((c) => c + (255 - c) * t)) >= minLum) hi = t;
      else lo = t;
    }
    return rgb.map((c) => Math.round(c + (255 - c) * hi));
  }

  function sublevelOf(dp) {
    const f = dp - Math.floor(dp);
    return f <= 0.2 ? 'Low' : f <= 0.4 ? 'Mid-Low' : f <= 0.6 ? 'Mid' : f <= 0.8 ? 'Mid-High' : 'High';
  }

  function msToClock(ms) {
    const v = Number(ms || 0);
    if (!v || Number.isNaN(v)) return '--:--';
    const total = Math.floor(v / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function bpmToString(b) {
    if (typeof b === 'number') return `${Math.round(b)}`;
    if (!b || typeof b !== 'object') return '--';
    const min = Math.round(Number(b.min || 0));
    const max = Math.round(Number(b.max || 0));
    const common = Math.round(Number(b.common || min || 0));
    if (!min && !max && !common) return '--';
    if (min && max && min !== max) return `${min}-${max} (${common})`;
    return `${common || min || max}`;
  }

  // ── BPM line (total_maniaset addition): the tempo from the map's BPM sections ──
  // danBpmResponse — how the live BPM follows the timing points:
  //  Every beat (default, the user's choice): each timing point as it is — a beat-by-beat timed
  //    live recording (e.g. betcover!! - bosen) changes with every beat, half / double-time beats
  //    included.
  //  Fast / Smooth: time-weighted median of the sections in a window centred on the current time,
  //    changed only when it moves by the deadband. A median has no in-between values at a BPM
  //    change (160 → 180 never shows 170) and ignores half / double-time beats; Fast follows such a
  //    live recording about once a second.
  const BPM_RESPONSE = { Fast: { window: 2000, deadband: 1 }, Smooth: { window: 5000, deadband: 3 } };
  const BPM_STEP_MS = 100;

  /** BPM sections [[from, to, bpm], ...] → [[from, bpm], ...]: the BPM to show from each time on. */
  function bpmTimeline(sections, mode) {
    const out = [];
    if (!Array.isArray(sections) || !sections.length) return out;
    const push = (t, bpm, deadband) => {
      if (!out.length || Math.abs(bpm - out[out.length - 1][1]) >= deadband) out.push([t, bpm]);
    };
    const cfg = BPM_RESPONSE[mode];
    if (!cfg) {
      for (const [from, , bpm] of sections) push(from, bpm, 0.005); // every timing point (equal BPMs merged)
      return out;
    }
    const start = sections[0][0];
    const end = sections[sections.length - 1][1];
    let first = 0;
    for (let t = start; t <= end; t += BPM_STEP_MS) {
      const lo = Math.max(start, t - cfg.window / 2);
      const hi = Math.min(end, t + cfg.window / 2);
      while (first < sections.length - 1 && sections[first][1] <= lo) first++;
      const parts = [];
      let total = 0;
      for (let k = first; k < sections.length && sections[k][0] < hi; k++) {
        const w = Math.min(sections[k][1], hi) - Math.max(sections[k][0], lo);
        if (w > 0) {
          parts.push([sections[k][2], w]);
          total += w;
        }
      }
      if (!parts.length) continue;
      parts.sort((a, b) => a[0] - b[0]);
      let acc = 0;
      let median = parts[parts.length - 1][0];
      for (const [bpm, w] of parts) {
        acc += w;
        if (acc >= total / 2) {
          median = bpm;
          break;
        }
      }
      push(t, median, cfg.deadband);
    }
    return out;
  }
  TM.bpmTimeline = bpmTimeline; // for the devtools console / tests

  /** { min, max, main } of a timeline up to `end`: main = the BPM shown longest (as osu!'s main BPM). */
  function bpmSummary(timeline, end) {
    const lasting = new Map(); // rounded BPM → [ms, a BPM value of that group]
    timeline.forEach(([from, bpm], i) => {
      const to = i + 1 < timeline.length ? timeline[i + 1][0] : end;
      const key = Math.round(bpm);
      const g = lasting.get(key) || [0, bpm];
      g[0] += Math.max(0, to - from);
      lasting.set(key, g);
    });
    let main = timeline[0][1];
    let longest = -1;
    for (const [ms, bpm] of lasting.values()) {
      if (ms > longest) [longest, main] = [ms, bpm];
    }
    const bpms = timeline.map((x) => x[1]);
    return { min: Math.min(...bpms), max: Math.max(...bpms), main };
  }
  TM.bpmSummary = bpmSummary;

  const HTML = `
    <div class="dan-bg"></div>
    <div class="dan-scrim"></div>
    <div class="top-drain-bar"></div>
    <div class="dan-line"></div>
    <div class="loading-wrap">
      <span class="loading-text">Waiting for engine</span>
      <span class="loading-bar"></span>
      <span class="loading-hint"></span>
    </div>
    <div class="map-transition-screen"></div>
    <div class="paused-overlay"><span class="paused-overlay-text">PAUSED</span></div>
    <div class="map-progress-wrap"><div class="map-progress-result"></div></div>
    <div class="premium-border"></div>
    <div class="overlay-content">
      <header class="map-header">
        <div class="map-info">
          <div class="map-title-wrap"><div class="map-title-track">
            <span class="map-title">Waiting for beatmap...</span>
            <span class="map-title map-title-ghost" aria-hidden="true">Waiting for beatmap...</span>
          </div></div>
          <span class="map-artist">—</span>
        </div>
        <div class="map-meta">
          <div class="badges-row">
            <span class="mod-badge"></span>
            <span class="scoring-mode-badge" data-mode="reform">◇ Mode: Reform</span>
            <span class="dan-perf" style="display:none"><span class="dp-tag">LIVE</span><span class="dp-name"></span><span class="dp-acc"></span></span>
          </div>
          <div class="map-duration-row"><span class="map-duration">--:--</span></div>
        </div>
      </header>
      <div class="dan-core">
        <div class="dan-main-stats">
          <span class="chart-family"></span>
          <div class="dan-identity">
            <span class="dan-kind"></span>
            <span class="dan-name">—</span>
            <span class="dan-sub">Sublevel</span>
            <span class="dan-second" style="display:none"><span class="dan-kind"></span><span class="dan-name"></span><span class="dan-sub"></span></span>
          </div>
          <div class="dan-dp-row"><span class="dan-dp-label">DP</span><span class="dan-dp-value">--</span></div>
          <div class="intensity-bar">
            <span class="intensity-label">LOW</span>
            <div class="intensity-slot">
              <div class="intensity-track"><div class="intensity-fill"></div></div>
              <div class="intensity-thumb"></div>
            </div>
            <span class="intensity-label">HIGH</span>
          </div>
        </div>
        <div class="dan-metrics-box">
          <span class="dan-metrics">--.-</span>
          <span class="msd-unit">MSD</span>
          <div class="map-stats-row">
            <span class="map-stat-item map-sr">--★</span><span class="map-stat-sep">·</span>
            <span class="map-stat-item map-bpm">-- BPM</span><span class="map-stat-sep">·</span>
            <span class="map-stat-item map-od">OD --</span><span class="map-stat-sep map-pp-sep" style="display:none">·</span><span class="map-stat-item map-pp" style="display:none"></span>
          </div>
        </div>
      </div>
    </div>`;

  // "Minimal" look: only family, dan + sublevel, DP + intensity, MSD, SR · BPM · OD and the
  // play time, as outlined text without a card. Elements the Card look needs but this one
  // doesn't show stay in a hidden holder, so the rendering code is shared by both looks.
  const HTML_MINIMAL = `
    <div class="dl-hidden" aria-hidden="true">
      <div class="dan-bg"></div><div class="top-drain-bar"></div>
      <div class="paused-overlay"><span class="paused-overlay-text">PAUSED</span></div>
      <div class="map-progress-wrap"><div class="map-progress-result"></div></div>
      <span class="map-artist"></span><span class="mod-badge"></span><span class="scoring-mode-badge"></span>
    </div>
    <div class="loading-wrap">
      <span class="loading-text">Waiting for engine</span>
      <span class="loading-bar"></span>
      <span class="loading-hint"></span>
    </div>
    <svg class="dl-density is-empty" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="tmDlDensityFill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style="stop-color: var(--dan-primary)"></stop>
          <stop offset="1" style="stop-color: var(--dan-secondary)"></stop>
        </linearGradient>
        <clipPath id="tmDlDensityPlayed"><rect class="dl-density-clip" x="0" y="0" width="0" height="100"></rect></clipPath>
      </defs>
      <path class="dl-density-area" d="" fill="url(#tmDlDensityFill)"></path>
      <path class="dl-density-played" d="" fill="url(#tmDlDensityFill)" clip-path="url(#tmDlDensityPlayed)"></path>
      <path class="dl-density-line" d="" stroke="url(#tmDlDensityFill)"></path>
    </svg>
    <div class="dl">
      <div class="dl-row dl-top">
        <span class="chart-family"></span>
        <span class="dan-perf" style="display:none"><span class="dp-tag">LIVE</span><span class="dp-name"></span><span class="dp-acc"></span></span>
        <span class="map-duration">--:--</span>
      </div>
      <div class="dl-row dl-mid">
        <div class="dan-identity">
          <span class="dan-kind"></span>
          <span class="dan-name">—</span>
          <span class="dan-sub">-</span>
          <span class="dan-second" style="display:none"><span class="dan-kind"></span><span class="dan-name"></span><span class="dan-sub"></span></span>
        </div>
        <div class="dl-msd"><span class="dan-metrics">--.-</span><span class="msd-unit">MSD</span></div>
      </div>
      <div class="dl-row dl-bot">
        <div class="dl-left">
          <div class="dl-dp">
            <div class="dan-dp-row"><span class="dan-dp-label">DP</span><span class="dan-dp-value">--</span></div>
            <div class="intensity-bar">
              <span class="intensity-label">LOW</span>
              <div class="intensity-slot">
                <div class="intensity-track"><div class="intensity-fill"></div></div>
                <div class="intensity-thumb"></div>
              </div>
              <span class="intensity-label">HIGH</span>
            </div>
          </div>
          <div class="map-title-wrap"><div class="map-title-track"><span class="map-title"></span><span class="map-title map-title-ghost" aria-hidden="true"></span></div></div>
        </div>
        <div class="map-stats-row">
          <div class="map-stats-line"><span class="map-stat-item map-sr">--★</span><span class="map-stat-sep">·</span><span class="map-stat-item map-od">OD --</span><span class="map-stat-sep">·</span><span class="map-stat-item map-bpm">-- BPM</span></div>
          <div class="map-stats-line"><span class="map-stat-item map-pp" style="display:none"></span></div>
        </div>
      </div>
    </div>`;

  class DanPanel {
    constructor(mount, { assetBase = 'shared/' } = {}) {
      this.assetBase = assetBase;
      this.s = Object.assign({}, TM.DAN_DEFAULTS);
      this.panel = document.createElement('section');
      mount.appendChild(this.panel);
      this.style = null;
      this.engineOnline = false;
      this.engineState = null;
      this.lastAnalysis = null;
      this.lastDanRaw = '';
      this.lnOverride = false;
      this.mapKey = '';
      this.bgGen = 0;
      this.bgKey = '';
      this.transitionTimer = null;
      this.isTransitioning = false;
      this.stateName = '';
      this.totalMs = 0;
      this.playbackMs = 0;
      // progress / result bookkeeping (DanOverlay applyProgressData)
      this.wasPlaying = false;
      this.lastAcc = 0;
      this.isPaused = false;
      this.lastSeenMs = -1;
      this.playingAt = 0;
      this.finishTimer = null;
      this.loadingArgs = ['Waiting for engine', ''];
      this.chart = null; // { md5, start, end, points, bpm } from the engine: density graph, BPM line
      this.curMd5 = '';
      this.rate = 1; // mod rate (tosu play.mods)
      this.tosuBpm = null; // tosu's beatmap.stats.bpm, until the chart info is in
      this.tempoCache = null; // _tempo()
      this.perf = { total: 0, shown: false, pauses: 0, pausedAt: 0, pauseCounted: false, live: null, steps: 0 }; // live performance dan (_perfTick)
      this.ppStars = { key: '', t: NaN, prev: NaN, sa: null, sk: null, lost: false, mods: '', modsNumber: NaN }; // the play's exact star rating (_seeStars)
      this.resultStars = new Map(); // `${md5}|${mods}` → { s, at, busy }: a chart's whole star rating (_resultsPp)
      this.applySettings(this.s);
      this._loading('Waiting for engine');
      // the name is measured for _fitName: again once the web fonts are in / the page resizes
      if (document.fonts) document.fonts.addEventListener('loadingdone', () => this._fitName());
      window.addEventListener('resize', () => this._fitName());
    }

    // ── DOM (Minimal or Card look) ────────────────────────────────────
    _build(style) {
      const rebuild = this.style !== null;
      this.style = style;
      const card = style === 'Card';
      this.panel.className = card ? 'tm-dan dan-panel is-loading' : 'tm-danl is-loading';
      this.panel.innerHTML = card ? HTML : HTML_MINIMAL;
      this.panel.style.height = '';
      const q = (sel) => this.panel.querySelector(sel);
      this.ui = {
        bg: q('.dan-bg'), drainBar: q('.top-drain-bar'), loadingText: q('.loading-text'), loadingHint: q('.loading-hint'),
        paused: q('.paused-overlay'), progressWrap: q('.map-progress-wrap'), progressResult: q('.map-progress-result'),
        mapTitleWrap: q('.map-title-wrap'), mapTitleTrack: q('.map-title-track'),
        mapTitle: q('.map-title'), mapTitleGhost: q('.map-title-ghost'), mapArtist: q('.map-artist'),
        modBadge: q('.mod-badge'), modeBadge: q('.scoring-mode-badge'), mapDuration: q('.map-duration'),
        chartFamily: q('.chart-family'), danName: q('.dan-name'), danSub: q('.dan-sub'),
        // hybrid maps: both dans, each with its kind (RC / LN) — the second group under its own palette
        perf: q('.dan-perf'), perfTag: q('.dp-tag'), perfName: q('.dp-name'), perfAcc: q('.dp-acc'), // live performance dan
        danIdentity: q('.dan-identity'), danKind: q('.dan-kind'), danSecond: q('.dan-second'),
        danSecondKind: q('.dan-second .dan-kind'), danSecondName: q('.dan-second .dan-name'), danSecondSub: q('.dan-second .dan-sub'),
        dpRow: q('.dan-dp-row'), dpValue: q('.dan-dp-value'), intensityBar: q('.intensity-bar'),
        intensityFill: q('.intensity-fill'), intensityThumb: q('.intensity-thumb'), metrics: q('.dan-metrics'), metricsUnit: q('.msd-unit'),
        mapSr: q('.map-sr'), mapBpm: q('.map-bpm'), mapOd: q('.map-od'), mapPp: q('.map-pp'), mapPpSep: q('.map-pp-sep'),
        // note-density background (Minimal look only)
        density: q('.dl-density'), densityArea: q('.dl-density-area'), densityPlayed: q('.dl-density-played'),
        densityLine: q('.dl-density-line'), densityClip: q('.dl-density-clip'),
      };
      this.bgKey = ''; // the Card background is fetched again on the next tosu update
      this.isTransitioning = false;
      // the title's room changes without the title changing (the panel leaves "Waiting for engine", the
      // stats beside it widen): check again whether it has to scroll whenever its box resizes
      if (this.titleObserver) this.titleObserver.disconnect();
      this.titleObserver = window.ResizeObserver ? new ResizeObserver(() => this._fitMapTitle()) : null;
      if (this.titleObserver && this.ui.mapTitleWrap) this.titleObserver.observe(this.ui.mapTitleWrap);
      if (!rebuild) return;
      // switched look at runtime: put the current state into the new elements
      if (this.lastAnalysis) {
        this.lnOverride = String(this.lastAnalysis.ln_route || 'rice') === 'ln' && this.lastAnalysis.ln_course != null;
        this._render(this.lastAnalysis);
        this._applyPayloadStats(this.lastAnalysis);
      } else {
        this._loading(...this.loadingArgs);
      }
    }

    // ── settings ──────────────────────────────────────────────────────
    applySettings(settings) {
      const prevMode = this.s.danScoringMode;
      for (const key of Object.keys(TM.DAN_DEFAULTS)) {
        if (key in settings) this.s[key] = settings[key];
      }
      const s = this.s;
      const style = s.danStyle === 'Card' ? 'Card' : 'Minimal';
      if (style !== this.style) this._build(style);
      if (style === 'Card') {
        const layout = LAYOUT_HEIGHTS[s.danLayout] ? s.danLayout : 'Full';
        this.panel.classList.toggle('layout-simplified', layout === 'Simplified');
        this.panel.classList.toggle('layout-compact', layout === 'Compact');
        this.panel.style.height = `${LAYOUT_HEIGHTS[layout]}px`;
        this.panel.style.setProperty('--cfg-brightness', String(TM.num(s.danBgBrightness, 0.85)));
        this.panel.style.setProperty('--cfg-blur', `${TM.num(s.danBlur, 12)}px`);
        this.panel.classList.toggle('no-bg', !s.danShowBackground);
      } else {
        const nameSize = TM.clamp(TM.num(s.danNameSize, 56), 16, 120);
        this.panel.style.setProperty('--dl-name-size', `${nameSize}px`);
        // the sublevel / hybrid chips keep their proportion to the name (16px at the default 56px)
        this.panel.style.setProperty('--dl-chip-size', `${TM.clamp((nameSize * 16) / 56, 12, 22).toFixed(1)}px`);
        this.panel.style.setProperty('--dl-density-opacity', String(TM.clamp(TM.num(s.danDensityOpacity, 0.5), 0, 1)));
        this._drawDensity();
      }
      this._fitName();
      this._updateModeBadge();
      this._applyVisibility();
      this._renderBpm(); // danBpmResponse
      if (prevMode !== s.danScoringMode && this.lastAnalysis) this._render(this.lastAnalysis);
    }

    get scoringMode() {
      return String(this.s.danScoringMode || 'Reform').toLowerCase();
    }

    _applyVisibility() {
      const when = this.s.danShowWhen;
      const playing = this.stateName === 'play';
      let visible = true;
      if (when === 'Song select only') visible = !playing;
      else if (when === 'Gameplay only') visible = playing;
      this.panel.classList.toggle('is-concealed', !visible);
    }

    _updateModeBadge() {
      const b = this.ui.modeBadge;
      const m = this.scoringMode;
      if (this.lnOverride) { b.textContent = '♬ Mode: LN Course'; b.dataset.mode = 'ln_course'; }
      else if (m === 'celestial') { b.textContent = '✦ Mode: Celestial'; b.dataset.mode = 'celestial'; }
      else if (m === 'signicial') { b.textContent = '◆ Mode: Signicial'; b.dataset.mode = 'signicial'; }
      else if (m === 'shoegazer') { b.textContent = '♫ Mode: Shoegazer'; b.dataset.mode = 'shoegazer'; }
      else { b.textContent = '◇ Mode: Reform'; b.dataset.mode = 'reform'; }
    }

    // ── engine link ───────────────────────────────────────────────────
    onEngineStatus(online, reason) {
      this.engineOnline = online;
      if (!online) {
        this.lastAnalysis = null;
        this.lastDanRaw = '';
        this._finishTransition();
        this._loading('Engine error', reason || '');
      } else if (!this.lastAnalysis) {
        this._loading('Computing');
      }
    }

    onEngine(p) {
      if (!p || typeof p !== 'object') return;
      if (p.type === 'state') {
        this.engineState = p.state;
        const msg = p.message || '';
        if (p.state === 'analyzing') {
          if (this.isTransitioning) this._setText(this.ui.loadingText, msg || 'Computing');
          else if (this.lastDanRaw) this.ui.modBadge.classList.add('recalculating');
          else this._loading(msg || 'Computing');
        } else if (p.state === 'idle') {
          if (!this.lastDanRaw && !this.isTransitioning) this._loading(msg || 'Waiting for a map');
        } else if (p.state === 'waiting_tosu') {
          this._finishTransition();
          this._loading(msg || 'Waiting for tosu...');
        } else if (p.state === 'error') {
          this._finishTransition();
          this._loading(msg || 'Error');
        } else if (p.state === 'disabled') {
          // total_maniaset: only 4K and 7K are measured
          this._finishTransition();
          this._loading('Disabled', msg || '4K / 7K only', true);
        }
      } else if (p.type === 'map_info') {
        const key = `${p.md5 || ''}|${p.mod_label || ''}`;
        if (key !== this.mapKey) {
          this.mapKey = key;
          this.lastDanRaw = '';
          this._startTransition();
        }
      } else if (p.type === 'analysis') {
        const lnRoute = String(p.ln_route || 'rice');
        const was = this.lnOverride;
        this.lnOverride = lnRoute === 'ln' && p.ln_course != null;
        if (was !== this.lnOverride) this._updateModeBadge();
        this.lastAnalysis = p;
        this._render(p);
        this._applyPayloadStats(p);
      } else if (p.type === 'chart') {
        this.chart = p;
        this._drawDensity();
        this._renderBpm();
      }
    }

    /**
     * SR · BPM · OD line from an analysis payload (DanOverlay shows the engine's values once known).
     * BPM excepted: DanOverlay's is the BPM with the most timing points, so it comes from the
     * chart info instead (_renderBpm).
     */
    _applyPayloadStats(p) {
      if (p.osu_sr > 0) this.ui.mapSr.textContent = `${Number(p.osu_sr).toFixed(2)}★`;
      this._renderBpm();
      this.ui.mapOd.textContent = p.od > 0 ? `OD ${Number(p.od).toFixed(1)}` : 'OD --';
    }

    /**
     * BPM line (total_maniaset): from the map's own BPM sections once the chart info is in, times
     * the mod rate — while playing, the live tempo (bpmTimeline, danBpmResponse); otherwise
     * min-max (main), the main BPM being the one shown longest, as in osu!. tosu's values until then.
     */
    _renderBpm() {
      const t = this._tempo();
      let text;
      if (t && this.stateName === 'play') {
        let cur = t.timeline[0][1];
        for (const [from, bpm] of t.timeline) {
          if (from > this.playbackMs) break;
          cur = bpm;
        }
        text = bpmToString(cur * this.rate);
      } else if (t) {
        text = bpmToString({ min: t.min * this.rate, max: t.max * this.rate, common: t.main * this.rate });
      } else {
        text = bpmToString(this.tosuBpm);
      }
      const value = text && text !== '--' ? `${text} BPM` : '-- BPM';
      if (this.ui.mapBpm.textContent !== value) this.ui.mapBpm.textContent = value;
    }

    /** The current map's tempo timeline + summary, rebuilt when the map or danBpmResponse changes. */
    _tempo() {
      const c = this.chart && this.chart.md5 === this.curMd5 && Array.isArray(this.chart.bpm) ? this.chart : null;
      if (!c) return null;
      const mode = this.s.danBpmResponse;
      const cached = this.tempoCache;
      if (!cached || cached.chart !== c || cached.mode !== mode) {
        const timeline = bpmTimeline(c.bpm, mode);
        const end = c.bpm[c.bpm.length - 1][1];
        this.tempoCache = Object.assign({ chart: c, mode, timeline }, timeline.length ? bpmSummary(timeline, end) : {});
      }
      return this.tempoCache.timeline.length ? this.tempoCache : null;
    }

    // ── tosu v2 (header, background, progress, results) ───────────────
    onV2(d) {
      const stateName = (d.state && d.state.name) || '';
      if (stateName !== this.stateName) {
        this.stateName = stateName;
        this._applyVisibility();
      }
      const bm = d.beatmap || {};
      if (bm.checksum !== undefined) {
        if (bm.checksum !== this.curMd5) {
          this.curMd5 = bm.checksum;
          this._drawDensity(); // hides the previous map's graph until this map's arrives
          this._perfReset();
        }
        // Card: "artist — title [version]"; Minimal (bottom left, under DP): "artist - title [version]", as asked
        const title = [bm.artist, bm.title].filter(Boolean).join(this.style === 'Card' ? ' — ' : ' - ') || 'Waiting for beatmap...';
        const version = String(bm.version || '').trim();
        const line = version ? `${title} ${version.startsWith('[') && version.endsWith(']') ? version : `[${version}]`}` : title;
        this._setMapTitle(line);
        this.ui.mapArtist.textContent = bm.mapper ? `Mapped by ${bm.mapper}` : '';
        const mods = (d.play && d.play.mods && d.play.mods.name) || '';
        const modLabel = /NC/.test(mods) ? 'NC' : /DT/.test(mods) ? 'DT' : /HT/.test(mods) ? 'HT' : '';
        this.ui.modBadge.textContent = modLabel;
        this.ui.modBadge.dataset.mod = modLabel;
        const rate = Number(d.play && d.play.mods && d.play.mods.rate);
        this.rate = rate > 0 ? rate : modLabel === 'HT' ? 0.75 : modLabel ? 1.5 : 1;
        this.tosuBpm = (bm.stats && bm.stats.bpm) || null;
        if (!this.lastAnalysis) {
          const sr = Number(bm.stats && bm.stats.stars && bm.stats.stars.total) || 0;
          this.ui.mapSr.textContent = sr > 0 ? `${sr.toFixed(2)}★` : '--★';
          const od = Number(bm.stats && bm.stats.od && bm.stats.od.converted) || 0;
          this.ui.mapOd.textContent = od ? `OD ${od.toFixed(1)}` : 'OD --';
        }
        // background straight from tosu, re-fetched when the map changes
        const bgName = d.files && d.files.background;
        const bgKey = `${bm.checksum}|${bgName || ''}`;
        if (bgKey !== this.bgKey && this.style === 'Card') {
          this.bgKey = bgKey;
          this._crossfadeBackground(bgName ? `${TM.tosuHttp}/files/beatmap/background?cs=${encodeURIComponent(bm.checksum)}` : '');
        }
        const t = bm.time || {};
        const total = Number(t.mp3Length || t.lastObject || 0);
        const live = Number(t.live || 0);
        this._progress({
          ms: live,
          total,
          state: stateName,
          playing: stateName === 'play',
          acc: d.play ? Number(d.play.accuracy) : null,
          resultsAcc: d.resultsScreen ? Number(d.resultsScreen.accuracy) : null,
          failed: !!(d.play && d.play.failed),
        });
        this._densityProgress();
        this._renderBpm(); // live BPM while playing
      }
      this._perfTick(d);
      this._renderPp(d, stateName);
    }

    /** pp after SR · BPM · OD: live during a play, the final value on the results screen, the map's SS value otherwise */
    _renderPp(d, st) {
      const ui = this.ui;
      if (!ui.mapPp) return;
      let pp = NaN;
      if (st === 'play') pp = this._playPp(d);
      else if (st === 'resultScreen') pp = this._resultsPp(d);
      else pp = Number(d.performance && d.performance.accuracy && d.performance.accuracy['100']);
      const text = this.s.danShowPp && Number.isFinite(pp) && (st === 'play' || pp > 0) ? `${pp.toFixed(2)}pp` : '';
      if (ui.mapPp.textContent !== text) ui.mapPp.textContent = text;
      const display = text ? '' : 'none';
      if (ui.mapPp.style.display !== display) {
        ui.mapPp.style.display = display;
        if (ui.mapPpSep) ui.mapPpSep.style.display = display; // Card: "· pp" on the same line
      }
    }

    /**
     * a play's pp: tosu's own (its exact star rating learned from it); the panel's once a count passes 32,767
     * (PP_PAST), or once tosu's star rating falls, which a rating so far never does (tosu restarted mid-play and lost
     * the mods: 52.54 → 35.12 in the 7K test replay, 2026-11-02): the last exact rating then, carried on at its rate.
     * NF / EZ as at the play's start.
     */
    _playPp(d) {
      const p = d.play || {};
      const pp = Number(p.pp && p.pp.current);
      const c = ppCounts(p.hits);
      if (!c) return pp;
      const bm = d.beatmap || {};
      const sr = Number(bm.stats && bm.stats.stars && bm.stats.stars.live);
      const live = Number(bm.time && bm.time.live);
      const past = c.some((v) => v >= PP_PAST);
      const st = this.ppStars;
      this._seeStars(String(bm.checksum || ''), sr, live, past ? NaN : pp, c, p.mods || {});
      const a = st.sa;
      if (st.lost) {
        if (!a || !Number.isFinite(live)) return NaN;
        // never past the whole chart's rating (tosu's, before it lost the mods)
        const s = a.s + a.rate * Math.max(0, live - a.t);
        return maniaPp(Number.isFinite(st.total) ? Math.min(s, st.total + 0.005) : s, c, st.mods);
      }
      const total = Number(bm.stats && bm.stats.stars && bm.stats.stars.total);
      if (Number.isFinite(total) && total > 0) st.total = total;
      if (!past) return pp;
      if (!Number.isFinite(sr)) return NaN;
      // within tosu's two-decimal value, and not below the last exact one: a chart's rating so far only grows
      // (each new section's strain joins the sorted, 0.9-weighted sum, which no addition lowers)
      const hi = sr + 0.005;
      const lo = a && a.s > sr - 0.005 && a.s <= hi ? a.s : sr - 0.005;
      let s = (lo + hi) / 2;
      if (a && a.rate > 0 && Number.isFinite(live)) s = Math.min(hi, Math.max(lo, a.s + a.rate * Math.max(0, live - a.t)));
      return maniaPp(s, c, st.mods);
    }

    /** the play's star rating beyond two decimals: from tosu's pp (pp given, counts below 32,768), else where tosu's two-decimal rating steps */
    _seeStars(key, sr, live, pp, c, mods) {
      const st = this.ppStars;
      // another chart, or a retry (the song time going back): learned again, with this play's mods
      if (st.key !== key || live < st.t - 1000) {
        Object.assign(st, { key, prev: NaN, sa: null, sk: null, lost: false, total: NaN, mods: String(mods.name || ''), modsNumber: Number(mods.number) });
      }
      if (Number.isFinite(live)) st.t = live;
      const prev = st.prev;
      st.prev = sr;
      if (!Number.isFinite(sr) || !Number.isFinite(live) || st.lost) return;
      // fallen below the last exact rating, or by more than a step: tosu's rating is off from here
      if ((st.sa && sr < st.sa.s - 0.0051) || sr < prev - 0.0101) {
        st.lost = true;
        TM.log(`dan pp: tosu's star rating fell ${prev} → ${sr}; the last exact one (${st.sa ? st.sa.s.toFixed(4) : '?'}) from here`);
        return;
      }
      let s = NaN;
      if (Number.isFinite(pp)) {
        const f = ppFactor(c, st.mods);
        if (pp > 0 && f > 0) s = 0.15 + (pp / f) ** (1 / 2.2);
        // not tosu's formula there (a ScoreV2 play's counts), or a pp of another moment: not taken
        if (!(s > 0.2 && Math.abs(s - sr) <= 0.0051)) s = NaN;
      } else if (Math.abs(Math.abs(sr - prev) - 0.01) < 1e-6) {
        s = (sr + prev) / 2;
      } else if (Math.abs(sr - prev) > 0.0101) {
        st.sa = st.sk = null; // a jump (a hard part starting): no exact value there, and no rate across it
        return;
      }
      if (!Number.isFinite(s)) return;
      let rate = st.sa ? st.sa.rate : 0;
      if (!st.sk) st.sk = { t: live, s };
      else if (live - st.sk.t >= PP_RATE_MS) {
        rate = (s - st.sk.s) / (live - st.sk.t);
        st.sk = { t: live, s };
      }
      st.sa = { t: live, s, rate };
    }

    /** a results screen's pp: tosu's own; past 32,767 judgements the panel's, with the chart's whole star rating at the score's mods */
    _resultsPp(d) {
      const r = d.resultsScreen || {};
      const pp = Number(r.pp && r.pp.current);
      const c = ppCounts(r.hits);
      if (!c || !c.some((v) => v >= PP_PAST)) return pp;
      if (r.hitsGuessed) return NaN; // a score opened from the ranking whose MAX / 300 split is a guess (TM.unwrapCounts)
      const bm = d.beatmap || {};
      const o = bm.stats && bm.stats.objects;
      // the play just followed lost its mods in tosu (restarted mid-play): its mods as it started
      const st = this.ppStars;
      const own = st.lost && st.key === bm.checksum && Number.isFinite(st.modsNumber);
      const number = own ? st.modsNumber : Number(r.mods && r.mods.number);
      const modsName = own ? st.mods : (r.mods && r.mods.name) || '';
      if (!bm.checksum || !o || !Number.isFinite(number)) return NaN;
      const key = `${bm.checksum}|${number}`;
      let e = this.resultStars.get(key);
      if (!e || (!Number.isFinite(e.s) && !e.busy && Date.now() - e.at > 10000)) {
        e = { s: NaN, at: Date.now(), busy: true };
        this.resultStars.set(key, e);
        const all = (Number(o.total) || 0) + (Number(o.holds) || 0); // an SS there counts these: the chart it rated
        fetch(`${TM.tosuHttp}/api/calculate/pp?mode=3&mods=${number}`, { cache: 'no-store' })
          .then((res) => (res.ok ? res.json() : null))
          .then((j) => {
            const s = Number(j && j.difficulty && j.difficulty.stars);
            if (Number.isFinite(s) && Number(j.state && j.state.nGeki) === all) e.s = s;
          })
          .catch(() => {})
          .finally(() => {
            e.busy = false;
            e.at = Date.now();
          });
      }
      return Number.isFinite(e.s) ? maniaPp(e.s, c, modsName) : NaN;
    }

    // ── live performance dan (total_maniaset addition; see PERF_STEPS) ─────────
    /**
     * A new play (or none). live / steps: the last song time seen and how many playback-like steps it has
     * made (PERF_PLAY_STEPS of them = the song is playing).
     */
    _perfReset() {
      this.perf = { total: 0, shown: false, pauses: 0, pausedAt: 0, pauseCounted: false, live: null, steps: 0 };
      if (this.ui && this.ui.perf) this.ui.perf.style.display = 'none';
    }

    /**
     * Every tosu update while playing a 4K chart (LN ≤ 45 %), from the danPerfMinNotes-th judgement on:
     * the dan the play's accuracy so far shows on this chart. Kept on the results screen.
     * Once the pause menu has been opened (tosu game.paused turning on), "PAUSE ×N" takes LIVE's place before
     * the dan, which is still measured; on a chart without LIVE (LN, 7K, unanalysed, before danPerfMinNotes)
     * the count alone — on every chart, whether LIVE runs there or not (danShowPause; the user: "퍼즈감지는
     * 라이브 상관없이 되는게 맞다").
     */
    _perfTick(d) {
      const st = this.stateName;
      const paused = !!(d.game && d.game.paused);
      if (st !== 'play') {
        if (st !== 'resultScreen' && (this.perf.total || this.perf.shown || this.perf.pauses || this.perf.live !== null)) this._perfReset();
        return;
      }
      const h = d.play && d.play.hits;
      if (!h) return;
      const n = (k) => Number(h[k]) || 0;
      const total = n('geki') + n('300') + n('katu') + n('100') + n('50') + n('0');
      const pf = this.perf;
      const live = Number(d.beatmap && d.beatmap.time && d.beatmap.time.live);
      const dl = Number.isFinite(live) && pf.live !== null ? live - pf.live : 0;
      // retry: fewer judgements, or the song time going back (stable never rewinds a play; a retry early in the
      // intro only goes back a little)
      if (total < pf.total || dl < -300) this._perfReset();
      const p = this.perf;
      if (Number.isFinite(live)) {
        if (!paused && dl > 0 && dl < 1000) p.steps += 1; // playing; the jump into the map or a skip is not a step
        p.live = live;
      }
      if (!paused || p.steps < PERF_PLAY_STEPS) { // not stopped, or still loading before the song plays
        if (p.pauseCounted && dl > 1500) { // the stop ended with a jump ahead: an intro skip, not a pause
          p.pauses -= 1;
          if (!p.pauses && this.ui && this.ui.perf) {
            this.ui.perf.style.display = 'none'; // LIVE comes back below if this chart has it
            p.shown = false;
          }
        }
        p.pausedAt = 0;
        p.pauseCounted = false;
      } else if (!p.pausedAt) {
        p.pausedAt = performance.now();
      } else if (!p.pauseCounted && performance.now() - p.pausedAt >= PERF_PAUSE_MIN_MS) {
        p.pauses += 1;
        p.pauseCounted = true;
      }
      p.total = total;
      // osu!stable accuracy (MAX counts as 300), the Reform criterion
      const acc = total > 0 ? (300 * (n('geki') + n('300')) + 200 * n('katu') + 100 * n('100') + 50 * n('50')) / (3 * total) : null;
      // paused: the count in LIVE's place, the dan still measured beside it (the user, 2026-10-29, for a player:
      // "단 트래킹 (live) 는 계속 측정해줬으면 좋겠대", "퍼즈를 몇번 했을 때는 live 가 아니라 pause 횟수 단 트래킹
      // 정확도 이런식으로"); without a dan to show (LN, 7K, before danPerfMinNotes) the count alone
      const pausedShow = this.perf.pauses > 0 && this.s.danShowPause;
      const a = this.lastAnalysis;
      const on = this.s.danPerf && a && a.mode !== '7k' && String(a.ln_route || 'rice') !== 'ln' && Number(a.dp) > 0;
      if (!on || total < Math.max(1, Number(this.s.danPerfMinNotes) || 0)) {
        if (pausedShow) this._perfShow('Pause', acc);
        return;
      }
      let level;
      if (n('katu') + n('100') + n('50') + n('0') === 0) level = 'Legend'; // exactly 100 %
      else if (Number(acc.toFixed(2)) < PERF_MIN_ACC) level = 'Unqualified';
      else level = perfLevel(acc, Number(a.dp));
      this._perfShow(level, acc);
    }

    /** level: the dan the play shows (dp scale), or a PERF_SPECIAL name (Legend / Unqualified / Pause) */
    _perfShow(level, acc) {
      const ui = this.ui;
      if (!ui.perf) return;
      const special = typeof level === 'string';
      const name = special ? level : REFORM_ORDER[TM.clamp(Math.trunc(level) - 1, 0, REFORM_ORDER.length - 1)];
      const paused = name !== 'Pause' && this.perf.pauses > 0 && this.s.danShowPause; // PAUSE ×N, then the dan
      ui.perfTag.textContent = name === 'Pause' ? 'PAUSE' : paused ? `PAUSE ×${this.perf.pauses}` : 'LIVE';
      ui.perf.classList.toggle('is-paused', paused);
      if (name === 'Pause') ui.perfName.textContent = `×${this.perf.pauses}`;
      else ui.perfName.textContent = special ? name : level < 1 ? `< ${name}` : `${name} ${sublevelOf(level)}`;
      ui.perfAcc.textContent = acc != null ? `${acc.toFixed(2)}%` : '';
      if (ui.perf.dataset.dan !== name) {
        ui.perf.dataset.dan = name;
        const palette = special ? PERF_SPECIAL[name] : DAN_PALETTES[name] || DAN_PALETTES['4th Dan'];
        for (const [key, value] of paletteVars(palette)) ui.perf.style.setProperty(key, value);
        ui.perf.classList.toggle('is-legend', name === 'Legend');
      }
      ui.perf.style.display = '';
      this.perf.shown = true;
    }

    _progress({ ms, total, state, playing, acc, resultsAcc, failed }) {
      if (total > 0) this.totalMs = total;
      const full = this.totalMs;
      if (ms >= 0) {
        const delta = ms - this.playbackMs;
        if (delta >= 0 || delta < -2000 || this.playbackMs <= 0) this.playbackMs = ms;
      }
      if (full > 0) {
        const pct = TM.clamp((TM.clamp(this.playbackMs, 0, full) / full) * 100, 0, 100);
        this.ui.drainBar.style.width = `${pct.toFixed(2)}%`;
        this.ui.mapDuration.textContent = `${this.playbackMs > 0 ? msToClock(this.playbackMs) : '0:00'} / ${msToClock(full)}`;
      } else {
        this.ui.drainBar.style.width = '0%';
        this.ui.mapDuration.textContent = '--:--';
        return;
      }
      if (!this.s.danShowResult) return;
      if (state === 'play' && acc != null && Number.isFinite(acc) && acc !== 100 && acc !== 1) this.lastAcc = acc;
      else if (state === 'resultScreen' && resultsAcc > 0) this.lastAcc = resultsAcc;

      if (ms !== this.lastSeenMs) {
        this.lastSeenMs = ms;
        this.playingAt = performance.now();
      }
      const stalled = state === 'play' && this.wasPlaying && ms > 0 && performance.now() - this.playingAt > PAUSE_STALL_MS && !failed;
      const isPlaying = playing && !stalled && !failed;
      const pw = this.ui.progressWrap;
      if (isPlaying) {
        clearTimeout(this.finishTimer);
        if (!this.wasPlaying) {
          this.wasPlaying = true;
          this.lastAcc = 0;
        }
        if (this.isPaused) {
          this.isPaused = false;
          this.ui.paused.classList.remove('is-visible');
        }
        if (!pw.classList.contains('finished')) pw.classList.remove('showing');
      } else if (stalled) {
        this.isPaused = true;
        this.ui.paused.classList.add('is-visible');
        pw.classList.remove('showing', 'finished');
        this.ui.progressResult.classList.remove('failed');
      } else if (this.wasPlaying || state === 'resultScreen') {
        this.wasPlaying = false;
        const remaining = Math.max(0, full - ms);
        const finished = state === 'resultScreen' || (state === 'play' && remaining <= 1000);
        if (finished || failed) {
          this.isPaused = false;
          this.ui.paused.classList.remove('is-visible');
          let text = 'Pass!';
          let color = '#b7c8e6';
          this.ui.progressResult.classList.remove('failed');
          if (failed) {
            text = 'FAILED!';
            color = '#ff3333';
            this.ui.progressResult.classList.add('failed');
          } else {
            let a = this.lastAcc;
            if (a > 0 && a <= 1) a *= 100;
            else if (!(a > 1 && a <= 100)) a = 0;
            if (a >= 100) { text = 'Perfect!'; color = '#ffeb3b'; }
            else if (a >= 98) { text = 'Hard Clear!'; color = '#ff9800'; }
            else if (a >= 97) { text = 'Over Clear!'; color = '#4caf50'; }
            else if (a >= 96) { text = 'Clear!'; color = '#8bc34a'; }
          }
          this.ui.progressResult.innerText = text;
          this.ui.progressResult.style.color = color;
          pw.classList.add('finished', 'showing');
          this.finishTimer = setTimeout(() => {
            pw.classList.remove('showing', 'finished');
            setTimeout(() => this.ui.progressResult.classList.remove('failed'), 1000);
          }, failed ? 3000 : 4000);
        } else {
          this.isPaused = false;
          this.ui.paused.classList.remove('is-visible');
        }
      } else if (this.isPaused && state !== 'play') {
        this.isPaused = false;
        this.ui.paused.classList.remove('is-visible');
      } else if (!pw.classList.contains('finished')) {
        pw.classList.remove('showing');
      }
    }

    // ── rendering (DanOverlay _renderAnalysisPayload + applyDanResult) ──
    _render(payload) {
      const skillsets = payload.skillsets || {};
      const topTwo = Object.entries(skillsets).filter(([, v]) => Number(v) > 0).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 2);
      const [top1, top2] = topTwo;
      const lbl1 = top1 ? SKILLSET_LABELS[top1[0]] || top1[0].toUpperCase() : '';
      const lbl2 = top2 ? SKILLSET_LABELS[top2[0]] || top2[0].toUpperCase() : '';
      const showBoth = top2 && Number(top2[1]) / Number(top1[1]) > 0.55;
      const familyText = showBoth ? `${lbl1} · ${lbl2}` : lbl1 || 'PATTERN';
      const primaryFamily = top1 ? SKILLSET_FAMILY[top1[0]] || 'HYBRID' : 'HYBRID';
      const msd = Number(payload.overall_msd || 0);
      const metrics = msd > 0 ? msd.toFixed(2) : '--.-';

      this.ui.modBadge.classList.remove('recalculating');

      // LN Course auto-override
      const ln = payload.ln_course;
      if (this.lnOverride && ln && ln.label) {
        const beyond = Boolean(ln.beyond);
        const dp = Number(ln.dp_ln || 0);
        this.lastDanRaw = `LN Course: ${ln.label}`;
        return this._apply({
          danName: String(ln.label), danShort: beyond ? '∞' : String(ln.short || ''), dp,
          danSuffix: beyond ? 'Beyond' : sublevelOf(dp), metrics, chart: familyText, chartColor: primaryFamily,
          lnCourseMode: true, lnCourseStage: String(ln.stage_key || '1st'), second: payload.tm_second,
        });
      }

      const mode = this.scoringMode;
      // ISOR engine only supports Reform and Celestial
      const effMode = payload.engine === 'isor' && mode !== 'celestial' ? 'reform' : mode;

      if (payload.mode === '7k' && payload.tier_7k) {
        this.lastDanRaw = `7K Tier: ${payload.tier_7k}`;
        return this._apply({
          danName: payload.tier_7k, danShort: payload.tier_7k.substring(0, 3).toUpperCase(), dp: Number(payload.dp_7k || 0),
          danSuffix: payload.sublevel_7k || '-', metrics: payload.sr > 0 ? Number(payload.sr).toFixed(2) : '--.-',
          // the number is Sunny SR (MinaCalc's MSD is 4K only), so it says so (the user, 2026-11-09: "7키일 때는
          // MSD 가 아니라 Sunny 로 표기")
          unit: 'Sunny',
          // total_maniaset's 7K model reports how the chart was judged (rice / hybrid / ln)
          chart: payload.ln_route === 'ln' ? '7K · LN' : payload.ln_route === 'hybrid' ? '7K · HYBRID' : '7K',
          chartColor: 'HYBRID', mode7k: true, tier7k: payload.tier_7k,
          // a hybrid's Regular and LN dans apart, as 4K's (engine/hybrid_7k.js): the main one's kind, the other
          kind7k: payload.tm_7k && payload.tm_7k.main, second: payload.tm_second,
        });
      }

      const cel = payload.celestial;
      const sig = payload.signicial;
      const sho = payload.shoegazer;
      const missing = (effMode === 'celestial' && !(cel && cel.label)) || (effMode === 'signicial' && !(sig && sig.label)) || (effMode === 'shoegazer' && !(sho && sho.label));
      if (missing) {
        const r = {
          danName: String(payload.dan_label || '–'), danShort: String(payload.dan_short || ''), dp: Number(payload.dp || 0),
          danSuffix: 'MSD error', metrics: '--.-', chart: familyText, chartColor: primaryFamily,
        };
        if (effMode === 'celestial') Object.assign(r, { celestialMode: true, celestialTier: 'Beginner' });
        if (effMode === 'signicial') Object.assign(r, { signicialMode: true, signicialStage: 'I' });
        if (effMode === 'shoegazer') Object.assign(r, { shoegazerMode: true, shoegazerStage: '1st' });
        this.lastDanRaw = `Est. Dan: ${r.danName}`;
        return this._apply(r);
      }
      if (effMode === 'celestial') {
        const beyond = Boolean(cel.beyond);
        const dp = Number(cel.dp_celestial || 0);
        this.lastDanRaw = `Celestial: ${cel.label}`;
        return this._apply({
          danName: String(cel.label), danShort: beyond ? '∞' : String(cel.short), dp, danSuffix: beyond ? 'Beyond' : sublevelOf(dp),
          metrics, chart: familyText, chartColor: primaryFamily, celestialMode: true, celestialTier: String(cel.tier || ''),
        });
      }
      if (effMode === 'signicial') {
        const beyond = Boolean(sig.beyond);
        const dp = Number(sig.dp_signicial || 0);
        this.lastDanRaw = `Signicial: ${sig.label}`;
        return this._apply({
          danName: String(sig.label), danShort: beyond ? '∞' : String(sig.short || ''), dp, danSuffix: beyond ? 'Beyond' : sublevelOf(dp),
          metrics, chart: familyText, chartColor: primaryFamily, signicialMode: true, signicialStage: String(sig.stage_key || ''),
        });
      }
      if (effMode === 'shoegazer') {
        const beyond = Boolean(sho.beyond);
        const dp = Number(sho.dp_shoegazer || 0);
        this.lastDanRaw = `Shoegazer: ${sho.label}`;
        return this._apply({
          danName: String(sho.label), danShort: beyond ? '∞' : String(sho.short || ''), dp, danSuffix: beyond ? 'Beyond' : sublevelOf(dp),
          metrics, chart: familyText, chartColor: primaryFamily, shoegazerMode: true, shoegazerStage: String(sho.stage_key || ''),
        });
      }
      const beyond = Boolean(payload.beyond);
      this.lastDanRaw = `Est. Dan: ${payload.dan_label}`;
      return this._apply({
        danName: String(payload.dan_label || 'Unknown'), danShort: String(payload.dan_short || ''), dp: Number(payload.dp || 0),
        danSuffix: beyond ? 'Beyond' : String(payload.sublevel || '') || '-', metrics, chart: familyText, chartColor: primaryFamily,
        second: payload.tm_second,
      });
    }

    _apply(r) {
      this._finishTransition();
      let palette;
      if (r.lnCourseMode) palette = lnStagePalette(r.lnCourseStage) || LN_COURSE_PALETTES['1st'];
      else if (r.celestialMode) palette = CELESTIAL_PALETTES[r.celestialTier] || CELESTIAL_PALETTES.Beginner;
      else if (r.signicialMode) palette = SIGNICIAL_PALETTES[r.signicialStage] || SIGNICIAL_PALETTES.I;
      else if (r.shoegazerMode) palette = SHOEGAZER_PALETTES[r.shoegazerStage] || SHOEGAZER_PALETTES['1st'];
      else if (r.mode7k) palette = PALETTES_7K[r.tier7k] || PALETTES_7K.Gamma;
      else palette = DAN_PALETTES[r.danName] || DAN_PALETTES['4th Dan'];

      const primary = parseRGB(palette[0]);
      const secondary = parseRGB(palette[palette.length - 1]);
      const st = this.panel.style;
      for (const [key, value] of paletteVars(palette)) st.setProperty(key, value);
      st.setProperty('--line-color', palette[Math.floor(palette.length / 2)]);
      const avgLum = (relativeLuminance(primary) + relativeLuminance(secondary)) / 2;
      this.panel.classList.toggle('dan-dark', avgLum < 0.18);
      this.panel.classList.remove('is-loading', 'is-disabled');

      // hybrids (tm_second from mma_bridge.js: { kind: 'ln' | 'rc', name, sub, dan | level }): both dans
      // as big names, each with its kind (RC / LN) and sublevel — the second group in its own colours
      const second = r.second && r.second.name ? r.second : null;
      const stageMap = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
      // Signicial's numbered stages by their numeral alone ("V"), not their pictures as before (the user, 2026-11-16:
      // "로마자만 표시되게 할 수 있을까? 그러면 사진 대신 로마자가 나오니까 최적화도 더 잘 될 거 같아", "dan 에도 적용하게")
      this.ui.danName.style.display = '';
      const numeral = r.signicialMode && stageMap[r.signicialStage] ? r.signicialStage : '';
      this._setText(this.ui.danName, numeral || (second ? hybridName(r.danName) : r.danName));
      this._setText(this.ui.danSub, r.danSuffix || '-');
      this.ui.danSub.classList.toggle('is-beyond', r.danSuffix === 'Beyond');
      this.ui.danSub.classList.toggle('is-redundant', r.danSuffix === 'Beyond' && /beyond/i.test(String(r.danName || '')));
      this.ui.danIdentity.classList.toggle('is-hybrid', !!second);
      this.ui.danSecond.style.display = second ? '' : 'none';
      if (second) {
        this._setText(this.ui.danKind, r.lnCourseMode || r.kind7k === 'ln' ? 'LN' : 'RC');
        this._setText(this.ui.danSecondKind, second.kind === 'rc' ? 'RC' : 'LN');
        this._setText(this.ui.danSecondName, hybridName(second.name));
        this._setText(this.ui.danSecondSub, String(second.sub || ''));
        this.ui.danSecondSub.style.display = second.sub ? '' : 'none';
        for (const [key, value] of paletteVars(secondPalette(second))) this.ui.danSecond.style.setProperty(key, value);
      }
      // Signicial and Shoegazer name their dans as Reform does (Signicial XI+ "Alpha" … "Theta", Shoegazer "1st Dan"
      // …), so the scale's name stands small where a hybrid's "RC" does (the user, 2026-11-14: "Signicial 과 reform
      // 과의 구분이 필요할 거 같아" → "Signicial 을 작게 넣자 (RC 대신)", "슈게이저도 Shoegazer 로 작게 표시")
      const scaleTag = second ? '' : r.signicialMode ? 'Signicial' : r.shoegazerMode ? 'Shoegazer' : '';
      this.ui.danIdentity.classList.toggle('has-scale', !!scaleTag);
      if (scaleTag) this._setText(this.ui.danKind, scaleTag);
      this.ui.chartFamily.textContent = r.chart || '';
      this.ui.chartFamily.setAttribute('data-family', (r.chartColor || r.chart || '').toUpperCase());
      this._setText(this.ui.metrics, r.metrics);
      if (this.ui.metricsUnit) this._setText(this.ui.metricsUnit, r.unit || 'MSD');

      // (the Card look's watermark pictures — Reform Greek letters, Celestial / Signicial icons — were removed with
      // their files on 2026-11-16: the user, "이거는 지금 안 쓴다 핀포인트로 지워버리자")
      this.ui.danName.classList.toggle('is-celestial', !!r.celestialMode);

      const hideDp = !!r.shoegazerMode;
      this.ui.dpRow.style.display = hideDp ? 'none' : '';
      this.ui.intensityBar.style.display = hideDp ? 'none' : '';
      if (!hideDp) {
        const dp = typeof r.dp === 'number' ? r.dp : 0;
        this.ui.dpValue.textContent = dp > 0 ? dp.toFixed(2) : '--';
        const frac = dp > 0 ? TM.clamp(dp - Math.floor(dp), 0, 1) : 0;
        this.ui.intensityThumb.style.left = `${frac * 100}%`;
        this.ui.intensityFill.style.width = `${frac * 100}%`;
      }
      this._fitName();
    }

    // ── note-density background (Minimal look; total_maniaset addition) ──
    // The map's notes per second as a faint area graph behind the text; while playing, the
    // part already played is drawn darker.
    _drawDensity() {
      const svg = this.ui && this.ui.density;
      if (!svg) return;
      const d = this.chart;
      const pts = d && d.md5 === this.curMd5 && Array.isArray(d.points) ? d.points : [];
      const show = !!this.s.danDensityGraph && pts.length > 1;
      svg.classList.toggle('is-empty', !show);
      if (!show) return;
      const max = Math.max(...pts) || 1;
      const last = pts.length - 1;
      // the densest moment reaches 70% of the panel height (85% put the line right under the top
      // row; in game only the line shows on a bright background, so it looked lifted off the panel)
      const line = pts.map((v, i) => `${i ? 'L' : 'M'}${((i / last) * 1000).toFixed(1)},${(100 - (v / max) * 70).toFixed(1)}`).join('');
      const area = `M0,100L${line.slice(1)}L1000,100Z`;
      this.ui.densityArea.setAttribute('d', area);
      this.ui.densityPlayed.setAttribute('d', area);
      this.ui.densityLine.setAttribute('d', line);
      this._densityProgress();
    }

    _densityProgress() {
      const clip = this.ui && this.ui.densityClip;
      if (!clip) return;
      const d = this.chart;
      let frac = 0;
      if (this.stateName === 'play' && d && d.md5 === this.curMd5 && d.end > d.start) {
        frac = TM.clamp((this.playbackMs - d.start) / (d.end - d.start), 0, 1);
      }
      clip.setAttribute('width', (frac * 1000).toFixed(1));
    }

    // ── helpers ───────────────────────────────────────────────────────
    // Minimal look: a long dan name (e.g. "Beyond Stellium") must not run into the MSD / SR
    // number on the right, so only the name is shrunk until the row fits.
    /**
     * Keeps the dan line (kind · name · sublevel, a hybrid's second group) clear of the MSD on the
     * right: first everything on it shrinks together so it keeps its proportions (--dl-fit; down to
     * 75 %, 55 % for a hybrid's two names, which also take some room from the MSD number, down to
     * 80 %; chips stop at their minimum size), then the names alone (--dl-name-fit, both of a
     * hybrid's names alike) down to 20px.
     */
    _fitName() {
      if (!this.ui) return;
      const name = this.ui.danName;
      const identity = this.ui.danIdentity;
      const card = this.style === 'Card';
      const row = card ? this.panel.querySelector('.dan-core') : name.closest('.dl-row');
      const right = row && row.querySelector(card ? '.dan-metrics-box' : '.dl-msd');
      identity.style.removeProperty('--dl-fit');
      identity.style.removeProperty('--dl-name-fit');
      if (row) row.style.removeProperty('--dl-msd-fit');
      if (!right || !row.clientWidth || name.style.display === 'none') return;
      const hybrid = identity.classList.contains('is-hybrid');
      const gap = card ? 24 : parseFloat(getComputedStyle(row).columnGap) || 0;
      const fits = () => {
        const shown = [...identity.children].filter((el) => getComputedStyle(el).display !== 'none');
        const need = shown.reduce((w, el) => w + el.offsetWidth, 0)
          + (parseFloat(getComputedStyle(identity).columnGap) || 0) * Math.max(0, shown.length - 1);
        return need <= row.clientWidth - right.offsetWidth - gap;
      };
      const scale = (prop, value) => {
        identity.style.setProperty(prop, value.toFixed(4));
        if (hybrid && prop === '--dl-fit') row.style.setProperty('--dl-msd-fit', Math.max(0.8, value).toFixed(4));
      };
      // the largest value of a scale property in [lo, 1] that fits (lo when even that does not)
      const largest = (prop, lo) => {
        scale(prop, lo);
        if (!fits()) return false;
        let hi = 1;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          scale(prop, mid);
          if (fits()) lo = mid;
          else hi = mid;
        }
        scale(prop, lo);
        return true;
      };
      if (fits()) return;
      if (largest('--dl-fit', hybrid ? 0.55 : 0.75)) return;
      const size = parseFloat(getComputedStyle(name).fontSize);
      if (size > 20) largest('--dl-name-fit', 20 / size);
    }

    _setText(el, text) {
      const value = String(text || '').replace(/\s+/g, ' ').trim() || '—';
      if (el.dataset.lastText === value) return;
      el.dataset.lastText = value;
      el.textContent = value;
      el.classList.remove('entering');
      void el.offsetWidth;
      el.classList.add('entering');
    }

    /** disabled: a key mode that is not measured (no loading animation) */
    _loading(message, hint, disabled = false) {
      this.loadingArgs = [message, hint, disabled];
      if (!this.isTransitioning) this.panel.classList.add('is-loading');
      this.panel.classList.toggle('is-disabled', disabled);
      this.ui.chartFamily.textContent = '';
      this.ui.chartFamily.removeAttribute('data-family');
      this.ui.modBadge.classList.remove('recalculating');
      this._setText(this.ui.loadingText, String(message || 'Computing').replace(/\.+$/, ''));
      this.ui.loadingHint.textContent = hint || '';
    }

    _startTransition() {
      clearTimeout(this.finishTimer);
      clearTimeout(this.transitionTimer);
      this.wasPlaying = false;
      this.lastAcc = 0;
      this.isPaused = false;
      this.lastSeenMs = -1;
      this.ui.paused.classList.remove('is-visible');
      this.ui.progressWrap.classList.remove('showing', 'finished');
      if (!this.panel.classList.contains('is-loading') && this.lastAnalysis) {
        this.isTransitioning = true;
        this.panel.classList.add('is-map-transition');
        this.transitionTimer = setTimeout(() => {
          if (this.isTransitioning) {
            this._finishTransition();
            this._loading('Computing');
          }
        }, 10000);
      }
      this.lastAnalysis = null;
    }

    _finishTransition() {
      clearTimeout(this.transitionTimer);
      this.isTransitioning = false;
      this.panel.classList.remove('is-map-transition');
    }

    _setMapTitle(text) {
      const value = String(text || 'Waiting for beatmap...').replace(/\s+/g, ' ').trim();
      if (this.ui.mapTitle.textContent === value) return;
      this.ui.mapTitle.textContent = value;
      this.ui.mapTitleGhost.textContent = value;
      this._fitMapTitle(); // now, not on the next frame: a page that is not drawn (OBS hidden, a background tab) has none
    }

    /** a title wider than its box scrolls (marquee), otherwise it sits still */
    _fitMapTitle() {
      const wrap = this.ui && this.ui.mapTitleWrap;
      const track = this.ui && this.ui.mapTitleTrack;
      if (!wrap || !track) return;
      const wrapWidth = wrap.clientWidth;
      if (!wrapWidth) return; // hidden (loading): measured again once it shows
      const titleWidth = this.ui.mapTitle.scrollWidth;
      const shift = titleWidth + 40;
      const scrolls = titleWidth > wrapWidth + 6;
      if (scrolls === track.classList.contains('is-marquee') && (!scrolls || track.style.getPropertyValue('--title-shift') === `${shift}px`)) return;
      track.classList.remove('is-marquee');
      track.style.removeProperty('--title-shift');
      track.style.removeProperty('--title-duration');
      if (!scrolls) return;
      track.style.setProperty('--title-shift', `${shift}px`);
      track.style.setProperty('--title-duration', `${Math.max(10, shift / 38).toFixed(2)}s`);
      track.classList.add('is-marquee');
    }

    _crossfadeBackground(url) {
      const gen = ++this.bgGen;
      const bg = this.ui.bg;
      const alreadyHidden = !bg.style.opacity || bg.style.opacity === '0';
      bg.style.opacity = '0';
      if (!url) {
        bg.style.backgroundImage = '';
        return;
      }
      const img = new Promise((resolve) => {
        const im = new Image();
        im.onload = im.onerror = () => resolve();
        im.src = url;
      });
      const fade = alreadyHidden ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, 520));
      Promise.all([img, fade]).then(() => {
        if (gen !== this.bgGen) return;
        bg.style.backgroundImage = `url("${url}")`;
        requestAnimationFrame(() => {
          if (gen === this.bgGen) bg.style.opacity = '1';
        });
      });
    }
  }

  TM.DanPanel = DanPanel;
})();

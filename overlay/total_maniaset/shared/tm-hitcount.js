/* total_maniaset — hitcount (판정 현황)
 *
 * Two looks, picked with the hcStyle setting:
 *   Column — a borderless stats column: grade, accuracy, MA:PR / MA:GR / PR:GR ratios
 *            and every judgement as a small coloured label over a big number; beside the PR / GR /
 *            GD / BD numbers small fast (left) / late (right) counts (hcShowFastLate) from tosu's hit
 *            errors, split with the hit error bar's timing windows (TM.timingWindows, tm-hiterror.js).
 *   Box    — the "hitcount" overlay by 2ky (@s2skky): same box, fonts, colours,
 *            odometer digits and ratio bar, moved from tosu's legacy /ws API to v2.
 */
(function () {
  'use strict';

  const TM = window.TM;

  TM.HITCOUNT_DEFAULTS = {
    hcStyle: 'Column',
    hcLabels: 'MA,PR,GR,GD,BD,MS,UR',
    hcShowDelay: 1000,
    hcShowGrade: true,
    hcAccDecimals: 4,
    hcRatios: 'MA:PR · MA:GR · PR:GR',
    hcShowUr: true,
    hcShowFastLate: true,
    hcFastLateSize: 18,
    hcShowBar: true,
    hcBgColor: '#262626',
    hcValueColor: '#ffffff',
    hcColor300g: '#bfeaff',
    hcColor300: '#ffd54a',
    hcColor200: '#4ee07a',
    hcColor100: '#4f8dff',
    hcColor50: '#c77dff',
    hcColor0: '#ff4d5e',
    hcColorUr: '#ffffff',
  };

  TM.HITCOUNT_V2_FILTERS = [
    'client',
    { field: 'state', keys: ['name'] },
    {
      field: 'play',
      keys: [
        { field: 'hits', keys: ['0', '50', '100', '300', 'geki', 'katu'] },
        { field: 'rank', keys: ['current'] },
        { field: 'mods', keys: ['name', 'array', 'rate'] },
        { field: 'mode', keys: ['name'] },
        'unstableRate', 'score', 'hitErrorArray',
      ],
    },
    // timing windows, the map (its notes) and the song time for the fast / late split
    {
      field: 'beatmap',
      keys: ['checksum', { field: 'mode', keys: ['name'] }, { field: 'stats', keys: [{ field: 'od', keys: ['original'] }] }, { field: 'time', keys: ['live'] }],
    },
  ];
  /** tosu precise fields: every hit's error (ms, < 0 = early) for the fast / late split */
  TM.HITCOUNT_PRECISE_FILTERS = ['hitErrors', 'currentTime'];

  // judgements that get fast / late counts: all but MAX (the user's call). For misses, fast = pressed
  // before the window (its error is listed); late = the rest (pressed after it, or not at all).
  const FL_ROWS = ['300', '200', '100', '50', '0'];
  // tosu lists one error per press and one per long-note release, without saying which note it was.
  // Splitting the errors by the timing windows does not work on long-note maps: ScoreV2 / lazer judge a
  // release with wider windows, ScoreV1 judges a long note once (at its release), and a release often
  // falls on another note's time. So every tosu v2 update — judgement counts and hit errors from the same
  // moment — pairs the new errors with the new judgements (_fastLate): fast + late always equals the count.
  // Under ScoreV1 the presses of long notes still to be judged are dropped; which errors those are comes
  // from onPrecise: the song time each error arrived at (tosu precise has no song time here, so v2's
  // beatmap.time.live advanced by the time since) minus the error, matched to the closest note within
  // FL_MATCH_MS before / FL_MATCH_AFTER after.
  const FL_MATCH_MS = 80;
  const FL_MATCH_AFTER = 20;
  // a row made smaller to fit the column (_fitFastLate): px kept free at the column's edges (the text's shadow),
  // and the share of their size fast / late may lose before the count gets smaller too
  const FL_EDGE = 3;
  const FL_MIN = 2 / 3;
  // [judgement, tosu v2 play.hits field], best first
  const V2_GRADES = [['300g', 'geki'], ['300', '300'], ['200', 'katu'], ['100', '100'], ['50', '50'], ['0', '0']];
  /** all of a play's judgements so far */
  const hitsTotal = (play) => V2_GRADES.reduce((sum, [, src]) => sum + TM.num(play.hits[src], 0), 0);

  /** single-note times and long-note head / release times of a mania .osu (each sorted) */
  function parseNotes(text) {
    const singles = [];
    const heads = [];
    const tails = [];
    let inObjects = false;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith('[')) {
        inObjects = line === '[HitObjects]';
        continue;
      }
      if (!inObjects || !line) continue;
      const parts = line.split(',');
      const time = Number(parts[2]);
      if (!Number.isFinite(time)) continue;
      if (Number(parts[3]) & 128) {
        heads.push(time);
        const end = Number(String(parts[5] || '').split(':')[0]);
        if (Number.isFinite(end)) tails.push(end);
      } else singles.push(time);
    }
    const asc = (a, b) => a - b;
    return { singles: singles.sort(asc), heads: heads.sort(asc), tails: tails.sort(asc) };
  }

  /** distance from `t` to the closest time in the sorted list within [t - FL_MATCH_MS, t + FL_MATCH_AFTER], or null */
  function closest(list, t) {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid] < t - FL_MATCH_MS) lo = mid + 1;
      else hi = mid;
    }
    let best = null;
    for (let i = lo; i < list.length && list[i] <= t + FL_MATCH_AFTER; i++) {
      const d = Math.abs(list[i] - t);
      if (best === null || d < best) best = d;
    }
    return best;
  }

  /** 'single' | 'head' | 'tail' | null (no note close enough) for a note at about time `t` */
  function noteKind(chart, t) {
    const d = { single: closest(chart.singles, t), head: closest(chart.heads, t), tail: closest(chart.tails, t) };
    let kind = null;
    for (const k of ['tail', 'head', 'single']) if (d[k] !== null && (kind === null || d[k] < d[kind])) kind = k;
    return kind; // ties go to the long note (checked first)
  }

  // judgement key → tosu v2 play.hits field
  const ROWS = [
    ['300g', 'geki'],
    ['300', '300'],
    ['200', 'katu'],
    ['100', '100'],
    ['50', '50'],
    ['0', '0'],
    ['ur', null],
  ];

  // ratio lines of the Column look: [id, numerator, denominator]
  const RATIOS = [
    ['mapr', '300g', '300'],
    ['magr', '300g', '200'],
    ['prgr', '300', '200'],
  ];

  // osu! grade letters as tosu reports them (X = SS, H = hidden/flashlight silver)
  const GRADES = { XH: 'SS', X: 'SS', SSH: 'SS', SH: 'S' };

  function ratioText(num, den) {
    if (den > 0) return (num / den).toFixed(2);
    return num > 0 ? '∞' : '0.00';
  }

  /**
   * osu!mania accuracy (%) from the judgement counts, so every shown decimal is exact and
   * matches the counts on screen (the client's own value only has a couple of good digits).
   * ScoreV1 (stable): MAX and 300 are both worth 300. ScoreV2 / lazer: MAX is worth 305.
   */
  function maniaAccuracy(c, scoreV2) {
    const total = c.geki + c.h300 + c.katu + c.h100 + c.h50 + c.h0;
    if (total <= 0) return 100;
    const top = scoreV2 ? 305 : 300;
    return ((top * c.geki + 300 * c.h300 + 200 * c.katu + 100 * c.h100 + 50 * c.h50) / (top * total)) * 100;
  }

  const usesScoreV2 = TM.usesScoreV2; // tm-core.js, shared with the dan course page

  class HitCount {
    constructor(mount) {
      this.s = Object.assign({}, TM.HITCOUNT_DEFAULTS);
      this.root = document.createElement('div');
      mount.appendChild(this.root);
      this.style = null;
      this.state = undefined;
      this.showTimer = null;
      this.atResults = false; // on the results screen of the play just ended (shown until it is left)
      this.objectsTotal = 0; // the chart's objects (tosu beatmap.stats.objects.total): a play's judgements once through
      this.lastPlay = null;
      this.applySettings(this.s);
      if (document.fonts) document.fonts.addEventListener('loadingdone', () => this._refitFastLate());
    }

    // ── DOM ─────────────────────────────────────────────────────────────
    _build(style) {
      this.style = style;
      this.values = {};
      this.total = 0;
      this.score = 0;
      if (style === 'Box') {
        this.root.className = 'tm-hc';
        this.root.innerHTML =
          '<div class="hc-section"><div class="hc-box">' +
          '<div class="hc-textbox">' + ROWS.map(([k]) => `<div class="hc-t hc-t${k}"></div>`).join('') + '</div>' +
          '<div class="hc-countbox">' + ROWS.map(([k]) => `<div class="hc-v hc-v${k}"></div>`).join('') + '</div>' +
          '<div class="hc-barbox"><div class="hc-bar hc-b300g"></div><div class="hc-bar hc-b300"></div>' +
          '<div class="hc-bar hc-b200"></div><div class="hc-bar hc-bbad"></div></div>' +
          '</div></div>';
        for (const [k] of ROWS) {
          const el = this.root.querySelector(`.hc-v${k}`);
          const od = window.Odometer ? new window.Odometer({ el, value: 0 }) : null;
          this.values[k] = { el, od, last: undefined };
        }
        this.bars = {
          '300g': this.root.querySelector('.hc-b300g'),
          '300': this.root.querySelector('.hc-b300'),
          '200': this.root.querySelector('.hc-b200'),
          bad: this.root.querySelector('.hc-bbad'),
        };
      } else {
        this.root.className = 'tm-hcc';
        this.root.innerHTML =
          '<div class="hc-section hcc-col">' +
          '<div class="hcc-grade"></div>' +
          '<div class="hcc-acc"></div>' +
          '<div class="hcc-ratios">' +
          RATIOS.map(([id, a, b]) => `<div class="hcc-ratio hcc-r-${id}"><span class="hcc-rv hcc-c${a}"></span><span class="hcc-r1 hcc-c${b}">:1</span></div>`).join('') +
          '</div>' +
          ROWS.map(([k]) => `<div class="hcc-j hcc-j${k}"><div class="hcc-l hcc-c${k}"></div>${FL_ROWS.includes(k)
            ? '<div class="hcc-vrow"><span class="hcc-fast"></span><div class="hcc-v"></div><span class="hcc-late"></span></div>'
            : '<div class="hcc-v"></div>'}</div>`).join('') +
          '</div>';
        for (const [k] of ROWS) this.values[k] = { el: this.root.querySelector(`.hcc-j${k} .hcc-v`), od: null, last: undefined };
        this.flEls = {};
        for (const k of FL_ROWS) this.flEls[k] = { f: this.root.querySelector(`.hcc-j${k} .hcc-fast`), l: this.root.querySelector(`.hcc-j${k} .hcc-late`) };
        this._resetFastLate();
        this.values.grade = { el: this.root.querySelector('.hcc-grade'), od: null, last: undefined };
        this.values.acc = { el: this.root.querySelector('.hcc-acc'), od: null, last: undefined };
        for (const [id] of RATIOS) this.values[id] = { el: this.root.querySelector(`.hcc-r-${id} .hcc-rv`), od: null, last: undefined };
        this.bars = null;
      }
      this.section = this.root.querySelector('.hc-section');
      if (this.state === 'play') this.section.style.opacity = 1;
    }

    applySettings(settings) {
      for (const key of Object.keys(TM.HITCOUNT_DEFAULTS)) {
        if (key in settings) this.s[key] = settings[key];
      }
      const s = this.s;
      const style = s.hcStyle === 'Box' ? 'Box' : 'Column';
      if (style !== this.style) this._build(style);

      const st = this.root.style;
      st.setProperty('--hc-bg', s.hcBgColor);
      st.setProperty('--hc-value', s.hcValueColor);
      for (const k of ['300g', '300', '200', '100', '50', '0']) st.setProperty(`--hc-c${k}`, s[`hcColor${k}`]);
      st.setProperty('--hc-cur', s.hcColorUr);
      st.setProperty('--hc-fl-size', `${TM.clamp(TM.num(s.hcFastLateSize, 18), 8, 31)}px`);
      const labels = String(s.hcLabels || '').split(',');
      ROWS.forEach(([k], i) => {
        const label = (labels[i] || '').trim();
        const el = this.root.querySelector(style === 'Box' ? `.hc-t${k}` : `.hcc-j${k} .hcc-l`);
        if (el) el.textContent = label;
      });
      this.root.classList.toggle('no-ur', !s.hcShowUr);
      this.root.classList.toggle('no-fl', !s.hcShowFastLate);
      this.root.classList.toggle('no-bar', !s.hcShowBar);
      this.root.classList.toggle('no-grade', !s.hcShowGrade);
      const ratios = String(s.hcRatios || '');
      this.root.classList.toggle('no-ratios', ratios === 'Off');
      this.root.classList.toggle('ratio-mapr-only', ratios === 'MA:PR');
      if (this.lastPlay) {
        for (const v of Object.values(this.values)) v.last = undefined;
        this._update(this.lastPlay);
      }
      this._refitFastLate();
    }

    _set(key, value) {
      const v = this.values[key];
      if (!v || v.last === value) return;
      v.last = value;
      if (v.od) v.od.update(value);
      else v.el.textContent = value;
    }

    _resetBars() {
      if (this.bars) for (const bar of Object.values(this.bars)) bar.style.width = '0px';
    }

    onV2(data) {
      const stateName = data.state && data.state.name;
      if (stateName !== undefined && stateName !== this.state) {
        const from = this.state;
        this.state = stateName;
        clearTimeout(this.showTimer);
        this.atResults = false;
        if (stateName === 'play') {
          this._resetFastLate();
          this.showTimer = setTimeout(() => {
            this.section.style.opacity = 1;
          }, TM.num(this.s.hcShowDelay, 1000));
        } else if (stateName === 'resultScreen' && from === 'play') {
          // the results screen of a play or a replay played through: its counts stay up until it is left (the user,
          // 2026-11-16: "hitcount 가 결과창에서 나가기 전까지만 띄우게", "다른 사람 기록도 한번 쭉 완주하고 나면 뜨게");
          // not a result opened from the rankings, nor a replay left halfway (_resultsShown)
          this.atResults = true;
        } else {
          this._resetBars();
          this.section.style.opacity = 0;
        }
      }
      if (data.client !== undefined) this.client = data.client;
      const play = data.play;
      const md5 = data.beatmap && data.beatmap.checksum;
      if (md5 && md5 !== this.chartMd5) {
        this.chartMd5 = md5;
        this._loadChart(md5);
      }
      if (play && play.mods) this.scoreV2 = usesScoreV2(this.client, play.mods);
      const live = Number(data.beatmap && data.beatmap.time && data.beatmap.time.live);
      if (Number.isFinite(live)) {
        this.liveTime = live; // song time, advanced to the moment a hit error arrives (_songTime)
        this.liveAt = performance.now();
      }
      if (this.state === 'play' && typeof TM.timingWindows === 'function') {
        const bm = data.beatmap || {};
        const mode = (bm.mode && bm.mode.name) || (play && play.mode && play.mode.name) || '';
        const od = TM.num(bm.stats && bm.stats.od && bm.stats.od.original, 0);
        const mods = (play && play.mods && play.mods.name) || '';
        const rate = TM.num(play && play.mods && play.mods.rate, 1) || 1;
        this.rate = rate;
        const key = `${mode}|${od}|${mods}|${rate}`;
        if (key !== this.windowsKey) {
          this.windowsKey = key;
          this.windows = TM.timingWindows(mode, od, mods, rate);
        }
      }
      const objects = data.beatmap && data.beatmap.stats && data.beatmap.stats.objects;
      if (objects && Number(objects.total) > 0) this.objectsTotal = Number(objects.total);
      // on the play's results screen the counts are the play's last ones: should tosu clear them there, they stay
      if (!play || !play.hits || (this.atResults && this.lastPlay && hitsTotal(play) < hitsTotal(this.lastPlay))) {
        if (this.atResults) this._resultsShown();
        return;
      }
      this.lastPlay = play;
      this._update(play);
      if (this.state === 'play') this._fastLate(play);
      this._renderFastLate(); // the miss row also follows the miss count
      if (this.atResults) this._resultsShown();
    }

    /**
     * on a results screen after a play: shown when the play went through the whole chart — as many judgements as it
     * has objects (tosu beatmap.stats.objects.total, a long note once: ScoreV1 judges it once, ScoreV2 / lazer twice)
     */
    _resultsShown() {
      const done = !(this.objectsTotal > 0) || (this.lastPlay && hitsTotal(this.lastPlay) >= this.objectsTotal);
      this.section.style.opacity = done ? 1 : 0;
    }

    // ── fast / late (Column) ────────────────────────────────────────────
    /** the current map's notes, from tosu's current beatmap file (for the ScoreV1 single-note filter) */
    async _loadChart(md5) {
      this.chart = null;
      try {
        const res = await fetch(`${TM.tosuHttp}/files/beatmap/file`, { cache: 'no-store' });
        if (!res.ok || this.chartMd5 !== md5) return;
        const text = await res.text();
        if (this.chartMd5 === md5) this.chart = parseNotes(text);
      } catch (err) {
        // no map file: every error is counted
      }
    }

    /** keepKinds: a retry seen first on v2 — onPrecise restarts its own list when it sees the retry */
    _resetFastLate(keepKinds = false) {
      this.fl = {};
      for (const k of FL_ROWS) this.fl[k] = { f: 0, l: 0 };
      this.flProcessed = 0; // hit errors taken from tosu v2 (_fastLate)
      if (!keepKinds || !this.kinds) this.kinds = []; // note kind per hit error, from tosu precise (onPrecise)
      const zero = Object.fromEntries(V2_GRADES.map(([g]) => [g, 0]));
      this.batch = { prev: zero, total: 0, errs: [], owed: [] };
      this.flText = {};
      if (this.flEls) {
        for (const k of FL_ROWS) {
          const el = this.flEls[k];
          if (el && el.f) el.f.textContent = '';
          if (el && el.l) el.l.textContent = '';
        }
      }
    }

    /** the song time now: tosu precise's own if it has one, else v2's live time advanced since it came */
    _songTime(data) {
      const t = Number(data.currentTime);
      if (Number.isFinite(t)) return t;
      if (!Number.isFinite(this.liveTime)) return NaN;
      return this.liveTime + (performance.now() - this.liveAt) * (this.rate || 1);
    }

    /**
     * tosu precise (every 10 ms): which note each new hit error belongs to — single / long-note head /
     * release — from the song time it arrived at minus the error. Only needed on maps with long notes.
     */
    onPrecise(data) {
      const errors = Array.isArray(data.hitErrors) ? data.hitErrors : null;
      if (!errors || !this.kinds) return;
      if (errors.length < this.kinds.length) this.kinds = []; // retry
      const now = this._songTime(data);
      const chart = this.chart && this.chart.heads.length > 0 && Number.isFinite(now) ? this.chart : null;
      for (let i = this.kinds.length; i < errors.length; i++) {
        const e = Number(errors[i]);
        this.kinds.push(chart && Number.isFinite(e) ? noteKind(chart, now - e) : null);
      }
    }

    /**
     * tosu v2 (every 100 ms) sends the judgement counts and the hit error list from the same moment, so
     * the errors that came in are paired with the judgements that came in:
     * - a new miss takes the largest error outside the 50 window (pressed too early / late), if any;
     *   a miss without one was never pressed (shown as late);
     * - ScoreV1 judges a long note once, at its release, but tosu lists an error for the press too: the
     *   errors beyond the new judgements are long-note presses still to be judged, and are dropped (those
     *   matched to a head first, then the largest);
     * - the rest go to the new judgements, the smallest |error| to MAX, then 300 … 50 — so fast + late
     *   always equals the count. A long note's fast / late (ScoreV1) is its release's.
     * Errors or judgements without a partner wait for the next update, once; a judgement still without
     * one is a long note held past its window (no release error) and counts as late.
     */
    _fastLate(play) {
      if (this.style !== 'Column' || !this.s.hcShowFastLate || !this.fl) return;
      const errors = Array.isArray(play.hitErrorArray) ? play.hitErrorArray : null;
      if (!errors) return;
      const cnt = {};
      for (const [g, src] of V2_GRADES) cnt[g] = TM.num(play.hits[src], 0);
      const total = V2_GRADES.reduce((sum, [g]) => sum + cnt[g], 0);
      if (errors.length < this.flProcessed || total < this.batch.total) this._resetFastLate(true); // retry
      const b = this.batch;
      for (let i = this.flProcessed; i < errors.length; i++) {
        const e = Number(errors[i]);
        if (Number.isFinite(e)) b.errs.push({ e, kind: this.kinds[i] || null, age: 0 });
      }
      this.flProcessed = errors.length;
      for (const [g] of V2_GRADES) for (let k = b.prev[g]; k < cnt[g]; k++) b.owed.push({ g, age: 0 });
      b.prev = cnt;
      b.total = total;

      const w50 = this.windows && this.windows.get('50');
      const byAbs = (x, y) => Math.abs(x.e) - Math.abs(y.e);
      b.errs.sort(byAbs);
      // misses: a press outside the window
      const timed = [];
      for (const o of b.owed) {
        if (o.g !== '0') {
          timed.push(o);
          continue;
        }
        const last = b.errs[b.errs.length - 1];
        if (last && w50 && Math.abs(last.e) > w50) {
          b.errs.pop();
          this.fl['0'][last.e < 0 ? 'f' : 'l'] += 1;
        }
      }
      // ScoreV1: drop the presses of long notes judged later (maps without long notes have none)
      if (!this.scoreV2 && this.chart && this.chart.heads.length > 0 && b.errs.length > timed.length) {
        let extra = b.errs.length - timed.length;
        const rest = [];
        for (const x of b.errs) {
          if (extra > 0 && x.kind === 'head') extra -= 1;
          else rest.push(x);
        }
        while (extra-- > 0) rest.pop();
        b.errs = rest;
      }
      // the rest, best judgement first
      const rank = Object.fromEntries(V2_GRADES.map(([g], i) => [g, i]));
      timed.sort((x, y) => rank[x.g] - rank[y.g]);
      let i = 0;
      const waiting = [];
      for (const o of timed) {
        if (i >= b.errs.length) {
          waiting.push(o);
          continue;
        }
        const { e } = b.errs[i++];
        const c = this.fl[o.g]; // MAX has no fast / late row
        if (c) c[e < 0 ? 'f' : 'l'] += 1;
      }
      b.errs = b.errs.slice(i).filter((x) => x.age++ < 1);
      // a judgement that still has no error after waiting had none: a long note held past its window
      // (judged at the window's end) — late
      b.owed = waiting.filter((o) => {
        if (o.age++ < 1) return true;
        if (this.fl[o.g]) this.fl[o.g].l += 1;
        return false;
      });
    }

    /** left of each number: fast, right: late — empty until the judgement has a timed hit */
    _renderFastLate() {
      if (!this.fl || !this.flEls) return;
      const misses = this.lastPlay && this.lastPlay.hits ? TM.num(this.lastPlay.hits['0'], 0) : 0;
      for (const k of FL_ROWS) {
        let { f, l } = this.fl[k];
        if (k === '0') {
          f = Math.min(f, misses); // pressed before the window
          l = misses - f; // pressed after it, or never
        }
        const text = f + l > 0 ? `${f}|${l}` : '';
        const el = this.flEls[k];
        if (text !== this.flText[k] && el && el.f && el.l) {
          this.flText[k] = text;
          el.f.textContent = text ? String(f) : '';
          el.l.textContent = text ? String(l) : '';
        }
        this._fitFastLate(k);
      }
    }

    /**
     * The row (fast, count, late) is centred in the 200 px column, the default box. On marathon maps it got
     * wider than that and ran past both edges: 5-digit fast and late beside a 5-digit count by 7 px each
     * side, 6-digit ones beside a 6-digit count by 36. A row that does not fit gets its fast / late just
     * small enough, down to FL_MIN of their size, then its count smaller too (in the same line height, so
     * the rows below stay put), FL_EDGE to spare (2026-11-02, the user: "이거까지만 수정하자"). Measured as
     * the numbers are (this font's 0 is far wider than its 1), and while their digit counts stay the same the
     * sizes only ever get smaller, so they never go back and forth as the numbers change.
     */
    _fitFastLate(k) {
      const el = this.flEls && this.flEls[k];
      const mid = this.values[k] && this.values[k].el;
      if (!el || !el.f || !el.l || !mid || !this.section) return;
      const f = el.f.textContent;
      const l = el.l.textContent;
      const v = mid.textContent;
      const texts = `${f}|${v}|${l}`;
      if (texts === el.texts) return;
      el.texts = texts;
      const key = `${f.length}|${v.length}|${l.length}`;
      if (key !== el.fitKey) {
        el.fitKey = key;
        for (const e of [el.f, el.l, mid]) {
          e.style.fontSize = '';
          e.style.lineHeight = '';
        }
        el.side = parseFloat(getComputedStyle(el.f).fontSize) || 18; // the sizes as set
        el.count = parseFloat(getComputedStyle(mid).fontSize) || 31;
      }
      if (!f && !l) return;
      // in page px (the page may be drawn smaller: TM.zoomPage), as the column's width and the sizes
      const wf = el.f.getBoundingClientRect().width / TM.pageZoom;
      const wl = el.l.getBoundingClientRect().width / TM.pageZoom;
      const wide = Math.max(wf, wl);
      const midW = mid.getBoundingClientRect().width / TM.pageZoom;
      // from the middle: half the count, the gap, then fast or late, inside half the column
      const half = this.section.clientWidth / 2 - (parseFloat(getComputedStyle(mid.parentElement).columnGap) || 0) - FL_EDGE;
      if (wide + midW / 2 <= half || !midW) return;
      const cs = getComputedStyle(el.f);
      const s0 = parseFloat(cs.fontSize) || el.side;
      const c0 = parseFloat(getComputedStyle(mid).fontSize) || el.count;
      // letter-spacing is a fixed px per character: only the glyphs get smaller with the size
      const spacing = (parseFloat(cs.letterSpacing) || 0) * (wf >= wl ? f : l).length;
      const glyphs = Math.max(1, wide - spacing);
      let s = ((half - midW / 2 - spacing) * s0) / glyphs;
      let c = c0;
      if (s < el.side * FL_MIN) {
        s = Math.min(s0, el.side * FL_MIN);
        c = Math.max(10, ((half - (glyphs * s) / s0 - spacing) * 2 * c0) / midW);
      }
      el.f.style.fontSize = el.l.style.fontSize = `${Math.floor(s * 10) / 10}px`;
      if (c < c0) {
        mid.style.fontSize = `${Math.floor(c * 10) / 10}px`;
        mid.style.lineHeight = `${el.count}px`;
      }
    }

    /** fit every row again (its size setting changed, or the font came in after the first fit) */
    _refitFastLate() {
      if (!this.flEls) return;
      for (const k of FL_ROWS) {
        if (this.flEls[k]) this.flEls[k].fitKey = this.flEls[k].texts = null;
        this._fitFastLate(k);
      }
    }

    _update(play) {
      const h = play.hits;
      const n = (k) => TM.num(h[k], 0);
      for (const [k, src] of ROWS) {
        if (src) this._set(k, n(src));
      }
      const ur = TM.num(play.unstableRate, 0);
      if (this.style === 'Box') {
        this._set('ur', ur);
        this._updateBars(n);
        return;
      }
      this._set('ur', ur.toFixed(2));
      const rank = play.rank && play.rank.current;
      this._set('grade', rank ? GRADES[rank] || String(rank) : '');
      const acc = maniaAccuracy(
        { geki: n('geki'), h300: n('300'), katu: n('katu'), h100: n('100'), h50: n('50'), h0: n('0') },
        usesScoreV2(this.client, play.mods),
      );
      // up to 4 decimals (the user, 2026-11-11: "소수점 자리는 최대 4자리만"; the setting offers 0-4)
      const digits = TM.clamp(Math.round(TM.num(this.s.hcAccDecimals, 4)), 0, 4);
      this._set('acc', `${acc.toFixed(digits)}%`);
      const count = { '300g': n('geki'), '300': n('300'), '200': n('katu') };
      for (const [id, a, b] of RATIOS) this._set(id, ratioText(count[a], count[b]));
    }

    _updateBars(n) {
      const total = n('geki') + n('300') + n('katu') + n('100') + n('50') + n('0');
      if (total !== this.total) {
        this.total = total;
        if (total > 0) {
          const w = (x) => `${Math.floor((x / total) * 200)}px`;
          this.bars['300g'].style.width = w(n('geki'));
          this.bars['300'].style.width = w(n('300'));
          this.bars['200'].style.width = w(n('katu'));
          this.bars.bad.style.width = w(n('100') + n('50') + n('0'));
        }
      }
      const score = TM.num(this.lastPlay && this.lastPlay.score, 0);
      if (score !== this.score) {
        this.score = score;
        if (score === 0) this._resetBars();
      }
    }
  }

  TM.HitCount = HitCount;
})();

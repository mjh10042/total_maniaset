/* total_maniaset — shared core
 *
 * tosu connections (v2 / precise / commands), per-counter settings and
 * layout helpers. Every page of the set loads this first, then the modules
 * it needs (the dan engine itself lives in tm-engine.js + shared/engine/).
 */
(function () {
  'use strict';

  const TM = (window.TM = window.TM || {});

  // Served by tosu → same host. Opened as a file → default tosu address.
  TM.tosuHost = /^[\w.\-]+:\d+$/.test(window.location.host) ? window.location.host : '127.0.0.1:24050';
  TM.tosuHttp = `http://${TM.tosuHost}`;

  // Opened directly in a browser tab (not OBS, not an iframe of tosu's dashboard/in-game overlay).
  TM.isStandalonePreview = window.self === window.top && !window.obsstudio;

  TM.log = (...args) => console.log('[total_maniaset]', ...args);

  /** Auto-reconnecting JSON WebSocket to tosu. */
  class TosuSocket {
    constructor(path, onMessage, filters, onStatus) {
      this.path = path;
      this.onMessage = onMessage;
      this.filters = filters;
      this.onStatus = onStatus || (() => {});
      this.open = false;
      this._connect();
    }

    _connect() {
      const counterPath = window.COUNTER_PATH || '';
      let ws;
      try {
        ws = new WebSocket(`ws://${TM.tosuHost}${this.path}?l=${encodeURI(counterPath)}`);
      } catch (err) {
        setTimeout(() => this._connect(), 1000);
        return;
      }
      this.ws = ws;
      ws.onopen = () => {
        if (this.filters) ws.send(`applyFilters:${JSON.stringify(this.filters)}`);
        this.open = true;
        this.onStatus(true);
      };
      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          return;
        }
        if (!data || typeof data !== 'object' || 'error' in data) return;
        try {
          this.onMessage(data);
        } catch (err) {
          console.error('[total_maniaset]', this.path, err);
        }
      };
      ws.onclose = () => {
        if (this.open) {
          this.open = false;
          this.onStatus(false);
        }
        setTimeout(() => this._connect(), 1000);
      };
      ws.onerror = () => {};
    }
  }

  // osu!stable keeps each judgement count in 16 bits and tosu reads it signed (readShort): past 32767 a count
  // shows as negative, and at 65536 osu! itself starts it again from 0. Within a play a count only grows, and
  // by far less than STEP_MAX between two updates (100 ms), so a count that comes back smaller (taken mod
  // 65536) went once more around — the same arithmetic as TCP sequence numbers. A new play (the song time
  // going back on a retry, or a count going back) starts the count again. tosu may still show the last play's
  // counts for an update or two after a retry: those never grow, so until the counts grow, a count going down
  // is them cleared, not one more time around. Updates outside a play never move the count.
  // Updates missed (tosu restarted mid-play, the socket dropped): a count may have gone further than STEP_MAX,
  // as far as the song time since allows (2026-11-02, the 7K overflow test replay: tosu quit 8 minutes in and
  // came back 21.6 s later with MAX 5,545 further on, and the count had started again from there; had MAX
  // been past 65536 by then, it would have lost 65536).
  // Once the counts differ from tosu's, its accuracy and grade (worked out from them) are worked out again.
  // A score opened from the ranking (no play to follow): what it lacks of the chart's judgements (the page's
  // beatmap.stats.objects, when it asks for them) in 65536s, on the counts its ScoreV1 score says
  // (TM.unwrapCounts: a miss, 50, 100 or 200 past 65535 as much as MAX); under ScoreV2 on MAX. The Popomo test
  // replay's score opened that way had shown 69.1% (tosu, from the wrapped counts) for its true 97.00%.
  // A page opened in the middle of a play already past 65536, or updates missed longer than a count's room: on a
  // chart of 65536 judgements or more the chart's judgements up to the song time (its file, fetched once) say how
  // many 65536s the counts lack, and the play's ScoreV1 score so far which counts (HitUnwrap._anchor). Left as is:
  // tosu's pp (the dan panel works its own out, tm-dan.js).
  const HIT_KEYS = ['geki', '300', 'katu', '100', '50', '0'];
  const WRAP = 65536;
  const STEP_MAX = 4096; // more of one judgement than this between two updates: not the same play
  const JUDGE_RATE = 1; // the most one count grows per ms of song time (the dense 7K test chart: 0.2)
  const u16 = (v) => Number(v) & 0xffff; // -1 → 65535, a missing count → 0
  const ahead = (now, before) => (now - before + WRAP) % WRAP; // how far a 16-bit count went forward

  /** osu!mania accuracy (%) of [MAX, 300, 200, 100, 50, miss]: MAX is worth 300 (osu!stable) or 305 (ScoreV2) */
  const maniaAcc = (c, v2) => {
    const top = v2 ? 305 : 300;
    const total = c.reduce((s, v) => s + v, 0);
    return total > 0 ? ((top * c[0] + 300 * c[1] + 200 * c[2] + 100 * c[3] + 50 * c[4]) / (top * total)) * 100 : null;
  };
  // ScoreV1, as osu!stable scores mania (fitted on the user's replays, tools/rejudge_check.py): a judgement adds
  // unit × (value + bonus value × √bonus) / 320,
  // unit = 500000 (halved by NF, EZ, HT each) / judgements; the bonus moves +2 on a MAX, +1 300, −8 200,
  // −24 100, −44 50, to 0 on a miss (within 0-100), and is back at 100 every 384 combo
  const V1_VALUE = [320, 300, 200, 100, 50, 0];
  const V1_BONUS = [32, 32, 16, 8, 4, 0];
  const V1_MOVE = [2, 1, -8, -24, -44, -1000];
  const unwrapCache = new Map();

  /** a ScoreV1 bonus part, in value points (× unit / 320 for the score), of counts c judged in a random order */
  function v1Bonus(c) {
    const n = c.reduce((s, v) => s + v, 0);
    if (n <= 0) return 0;
    const steps = Math.min(n, 50000);
    let seed = 2463534242;
    let bonus = 100;
    let combo = 0;
    let sum = 0;
    for (let i = 0; i < steps; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      let x = ((seed >>> 0) / 4294967296) * n;
      let g = 0;
      while (g < 5 && x >= c[g]) x -= c[g++];
      combo += 1;
      bonus = Math.max(0, Math.min(100, bonus + V1_MOVE[g]));
      if (combo > 1 && (combo - 1) % 384 === 0) bonus = 100;
      sum += V1_BONUS[g] * Math.sqrt(bonus);
      if (g === 5) combo = 0;
    }
    return (sum / steps) * n;
  }

  /** every way to put w wraps on `slots` counts, the most on the first ones first */
  function* spread(w, slots) {
    if (slots === 1) {
      yield [w];
      return;
    }
    for (let i = w; i >= 0; i--) for (const rest of spread(w - i, slots - 1)) yield [i, ...rest];
  }

  /**
   * A whole play's counts [MAX, 300, 200, 100, 50, miss] as osu! keeps them, in 16 bits (a results screen opened from
   * the ranking), on a chart of n judgements in their scoring: what they lack of n, in
   * 65536s, back on the counts that wrapped — a miss, 50, 100 or 200 as much as MAX. Which ones, from its ScoreV1
   * score (o.score, o.mods): the spread of wraps whose score fits (a wrap on a miss instead of MAX moves it by a
   * whole judgement's worth for each of 65536 judgements) and lies closest to the score the bonus would give (its
   * judgements in a random order). MAX and 300 the score cannot tell apart: they differ by 20 of 320 value points a
   * judgement, about 7,000 points for 65536 of them on a 290,000-judgement chart, while the bonus swings by about
   * that much with how the misses cluster (the Popomo test replay, 3 + 1 wraps). A wrap there goes on MAX, which
   * osu!stable's accuracy counts the same as 300; with two or more of them (a chart of over 131072 judgements)
   * o.info.guessed is set: the MAX / 300 split is a guess. Without a score, or under ScoreV2: MAX. Counts that do not
   * add up to n that way are another chart's: only not negative. Below 32768 judgements nothing changes.
   * A play still going (HitUnwrap, a page opened mid-play): n = its judgements so far, o.of = the chart's (ScoreV1's
   * unit), o.known = the 65536s already known per count, kept (only the rest are spread).
   */
  TM.unwrapCounts = function (counts, n, o = {}) {
    const u = counts.map(u16);
    const short = n - u.reduce((s, v) => s + v, 0);
    if (!(short > 0) || short % WRAP) return u;
    const known = Array.isArray(o.known) && o.known.reduce((s, v) => s + v, 0) <= short / WRAP ? o.known : [0, 0, 0, 0, 0, 0];
    const kept = u.map((v, g) => v + WRAP * known[g]);
    const w = short / WRAP - known.reduce((s, v) => s + v, 0);
    let best = { c: kept.slice(), guessed: w > 1 };
    best.c[0] += WRAP * w;
    const score = Number(o.score);
    const mods = Number(o.mods) || 0;
    const key = `${u.join()}|${n}|${score}|${mods}|${known.join()}|${o.of}`;
    if (w > 0 && score > 0 && !o.v2 && !(mods & (1 << 29)) && w <= 8) {
      if (!unwrapCache.has(key)) {
        const unit = (500000 * 0.5 ** ((mods & 1 ? 1 : 0) + (mods & 2 ? 1 : 0) + (mods & 256 ? 1 : 0))) / (Number(o.of) || n);
        const tol = 2 + score * 0.001; // osu!'s rounding
        let bestCost = Infinity;
        for (const k of spread(w, 5)) { // MAX (or 300), 200, 100, 50, miss
          const c = kept.slice();
          c[0] += WRAP * k[0];
          for (let g = 1; g < 5; g++) c[g + 1] += WRAP * k[g];
          const base = (unit * c.reduce((s, v, g) => s + v * V1_VALUE[g], 0)) / 320;
          const top = base + (unit * c.reduce((s, v, g) => s + v * V1_BONUS[g] * 10, 0)) / 320;
          if (score < base - tol || score > top + tol) continue; // no bonus makes that score
          const cost = Math.abs(score - base - (unit * v1Bonus(c)) / 320);
          if (cost < bestCost) {
            bestCost = cost;
            best = { c, guessed: k[0] > 1 };
          }
        }
        unwrapCache.set(key, best);
        if (unwrapCache.size > 64) unwrapCache.delete(unwrapCache.keys().next().value);
      }
      best = unwrapCache.get(key);
    }
    if (o.info) o.info.guessed = best.guessed;
    return best.c.slice();
  };

  /** the grade tosu gives an accuracy (%): SS at 100, S above 95, A 90, B 80, C 70, else D; silver with HD / FL */
  const maniaGrade = (acc, mods) => {
    const silver = /HD|FL/.test(String((mods && mods.name) || ''));
    if (acc >= 100) return silver ? 'XH' : 'X';
    if (acc > 95) return silver ? 'SH' : 'S';
    return acc > 90 ? 'A' : acc > 80 ? 'B' : acc > 70 ? 'C' : 'D';
  };

  /** a mania chart's judgement times, sorted: ScoreV1 (a long note once, at its release) and ScoreV2 (head and release) */
  function judgementTimes(text) {
    const v1 = [];
    const v2 = [];
    let on = false;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith('[')) {
        on = line === '[HitObjects]';
        continue;
      }
      if (!on || !line) continue;
      const p = line.split(',');
      const t = Number(p[2]);
      if (!Number.isFinite(t)) continue;
      const end = Number(p[3]) & 128 ? Number(String(p[5] || '').split(':')[0]) : NaN;
      if (Number.isFinite(end)) {
        v1.push(end);
        v2.push(t, end);
      } else {
        v1.push(t);
        v2.push(t);
      }
    }
    return { v1: Float64Array.from(v1).sort(), v2: Float64Array.from(v2).sort() };
  }

  /** how many of the sorted times are at or before t */
  function upTo(times, t) {
    let lo = 0;
    let hi = times.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  class HitUnwrap {
    constructor() {
      this.state = undefined;
      this.from = ''; // the state a play was entered from ('edit': a test play, started anywhere in the chart)
      this.track = null; // this play: { raw, wraps, live, start, stale, editor }
      this.ended = null; // the play just ended, for its results screen: { raw, real }
      this.md5 = '';
      this.objects = null; // the chart's { total, holds } (beatmap.stats.objects)
      this.chart = null; // its judgement times, for a chart of 65536 judgements or more: { md5, v1, v2 }
      this.loading = '';
      this.loadAt = 0;
    }

    /** the real counts into d.play.hits and d.resultsScreen.hits (and their accuracy once past 32767), in place */
    fix(d) {
      const st = d.state ? d.state.name : undefined;
      if (st !== undefined && st !== this.state) {
        const t = this.track;
        this.ended = this.state === 'play' && st === 'resultScreen' && t ? { raw: t.raw.slice(), real: this._real(t) } : null;
        if (st === 'play') this.from = this.state || '';
      }
      const bm = d.beatmap || {};
      if (bm.checksum && bm.checksum !== this.md5) {
        this.md5 = bm.checksum;
        this.objects = null;
      }
      const o = bm.stats && bm.stats.objects;
      if (o) this.objects = { total: Number(o.total) || 0, holds: Number(o.holds) || 0 };
      if (this.objects && this.objects.total + this.objects.holds >= WRAP) this._loadChart();
      const mode = (bm.mode && bm.mode.name) || (d.play && d.play.mode && d.play.mode.name) || '';
      const mania = !mode || mode === 'mania';
      if (d.play && d.play.hits) {
        const raw = HIT_KEYS.map((k) => u16(d.play.hits[k]));
        const live = Number(bm.time && bm.time.live);
        let t = this.track;
        let real;
        if ((st !== undefined ? st : this.state) === 'play') {
          // how far a count may have gone since the last update: STEP_MAX, or as far as the song time since lets it
          // (updates missed while tosu restarted)
          const dl = t && Number.isFinite(live) && Number.isFinite(t.live) ? live - t.live : 0;
          const room = Math.min(WRAP / 2, Math.max(STEP_MAX, dl * JUDGE_RATE));
          const fresh =
            !t ||
            dl < -300 || // the song time going back: a retry
            raw.some((v, i) => ahead(v, t.raw[i]) > room) || // a count went back: a new play
            (t.stale && raw.some((v, i) => v < t.raw[i])); // the last play's counts, cleared now
          if (fresh) {
            if (t && t.wraps.some((w) => w > 0)) TM.log('hits: a new play, the counts past 65536 start again');
            // a play starts from 0: counts past STEP_MAX right at its start are still the last play's
            const stale = !!t && raw.some((v) => v > STEP_MAX);
            t = this.track = { raw, wraps: raw.map(() => 0), live: NaN, start: live, stale, editor: this.from === 'edit' };
          } else {
            if (raw.some((v, i) => v > t.raw[i])) t.stale = false; // growing: this play's own
            raw.forEach((v, i) => {
              if (v >= t.raw[i]) return;
              t.wraps[i] += 1;
              TM.log(`hits: ${HIT_KEYS[i]} went past ${t.wraps[i] * WRAP} (osu! shows ${v})`);
            });
            t.raw = raw;
          }
          if (Number.isFinite(live)) t.live = live;
          this._anchor(t, live, d);
          real = this._real(t);
        } else {
          // outside a play (tosu shows the last play's counts, or zeros): the play's own as it ended, else as they are
          real = t && raw.every((v, i) => ahead(v, t.raw[i]) <= STEP_MAX) ? raw.map((v, i) => t.raw[i] + WRAP * t.wraps[i] + ahead(v, t.raw[i])) : raw;
        }
        this._write(d.play, real, mania, TM.usesScoreV2(d.client, d.play.mods), d.play.mods);
      }
      const r = d.resultsScreen;
      if (r && r.hits) {
        // the play just ended: its last counts plus what came after them; a score opened from the ranking: what
        // it lacks of the chart's judgements, in 65536s, on the counts its score says (TM.unwrapCounts)
        const raw = HIT_KEYS.map((k) => u16(r.hits[k]));
        const v2 = TM.usesScoreV2(d.client, r.mods);
        const e = this.ended;
        let real = e && raw.every((v, i) => ahead(v, e.raw[i]) <= STEP_MAX) ? raw.map((v, i) => e.real[i] + ahead(v, e.raw[i])) : null;
        if (!real) {
          const n = this.objects ? this.objects.total + (v2 ? this.objects.holds : 0) : 0;
          const info = {};
          real = TM.unwrapCounts(raw, n, { score: r.score, mods: r.mods && r.mods.number, v2, info });
          if (info.guessed) r.hitsGuessed = true; // MAX / 300 split guessed: pp (it weighs them apart) is not shown
        }
        this._write(r, real, mania, v2, r.mods);
      } else if (r && this.ended && mania && 'accuracy' in r && this.ended.real.some((v) => v >= WRAP / 2)) { // past 32767
        const acc = maniaAcc(this.ended.real, TM.usesScoreV2(d.client, d.play && d.play.mods)); // no counts asked for
        if (acc !== null) r.accuracy = Number(acc.toFixed(2));
      }
      if (st !== undefined) this.state = st;
      return d;
    }

    _real(t) {
      return t.raw.map((v, i) => v + WRAP * t.wraps[i]);
    }

    /** the chart's judgement times, fetched once for a chart of 65536 judgements or more (tosu's current map file) */
    _loadChart() {
      const md5 = this.md5;
      if (!md5 || (this.chart && this.chart.md5 === md5) || this.loading === md5 || typeof fetch !== 'function') return;
      if (Date.now() - this.loadAt < 5000) return; // tried a moment ago
      this.loading = md5;
      this.loadAt = Date.now();
      fetch(`${TM.tosuHttp}/files/beatmap/file`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.text() : null))
        .then((text) => {
          const ch = text ? judgementTimes(text) : null;
          // tosu's map by now: the one asked for when it has the notes tosu counts
          if (ch && md5 === this.md5 && this.objects && ch.v1.length === this.objects.total) this.chart = Object.assign(ch, { md5 });
        })
        .catch(() => {})
        .finally(() => {
          if (this.loading === md5) this.loading = '';
        });
    }

    /**
     * The chart against the counts: its judgements up to the song time say how many 65536s the counts lack in all
     * (tosu's counts trail the song time by a few judgements). Off by one or more — a page opened in the middle of a
     * play past 65536, updates missed longer than a count's room — the missing ones go where the play's score so far
     * says (TM.unwrapCounts, the wraps already followed kept); too many come off. Not on a play just started from 0
     * (tosu clears the counts before the song time goes back on a retry), the last play's counts (stale), nor a
     * test play from the editor (it starts anywhere in the chart).
     */
    _anchor(t, live, d) {
      const ch = this.chart;
      if (!ch || ch.md5 !== this.md5 || t.editor || t.stale || !Number.isFinite(live) || !this.objects) return;
      const v2 = TM.usesScoreV2(d.client, d.play.mods);
      const n = this.objects.total + (v2 ? this.objects.holds : 0);
      if (n < WRAP) return;
      const real = this._real(t);
      const sum = real.reduce((s, v) => s + v, 0);
      const off = Math.round((upTo(v2 ? ch.v2 : ch.v1, live) - sum) / WRAP);
      if (off === 0) return;
      if (off > 0) {
        const started = t.raw.reduce((s, v) => s + v, 0) <= STEP_MAX && !(live - t.start >= 2000);
        if (started) return;
        const c = TM.unwrapCounts(t.raw, sum + off * WRAP, { score: d.play.score, mods: d.play.mods && d.play.mods.number, v2, of: n, known: t.wraps });
        t.wraps = c.map((v, i) => Math.round((v - t.raw[i]) / WRAP));
      } else {
        for (let k = -off; k > 0; k--) {
          const g = t.wraps.indexOf(Math.max(...t.wraps));
          if (t.wraps[g] <= 0) break;
          t.wraps[g] -= 1;
        }
      }
      TM.log(`hits: the chart's judgements by now say ${off > 0 ? '+' : ''}${off} × 65536: ${this._real(t).join(' ')}`);
    }

    /** counts into `obj.hits`; once they differ from tosu's, its accuracy and grade (from them) too, as tosu */
    _write(obj, real, mania, v2, mods) {
      let changed = false;
      HIT_KEYS.forEach((k, i) => {
        if (!(k in obj.hits)) return;
        if (Number(obj.hits[k]) !== real[i]) changed = true;
        obj.hits[k] = real[i];
      });
      const acc = changed && mania ? maniaAcc(real, v2) : null;
      if (acc === null) return;
      if ('accuracy' in obj) obj.accuracy = Number(acc.toFixed(2));
      if (obj.rank && 'current' in obj.rank) obj.rank.current = maniaGrade(acc, mods);
    }
  }
  TM.HitUnwrap = HitUnwrap;

  /** whether a tosu applyFilters list asks for the field at `path` (no list: everything) */
  function asks(list, path) {
    if (!Array.isArray(list)) return true;
    const [head, ...rest] = path;
    return list.some((item) => item === head || (item && item.field === head && (!rest.length || asks(item.keys, rest))));
  }

  /** a page's filters, plus what HitUnwrap reads when the page asks for judgement counts */
  function withHitFields(list) {
    if (!Array.isArray(list)) return list;
    const play = asks(list, ['play', 'hits']);
    const results = asks(list, ['resultsScreen', 'hits']);
    if (!play && !results) return list;
    const mods = { field: 'mods', keys: ['name', 'number', 'array'] };
    const extra = [
      'client',
      { field: 'state', keys: ['name'] },
      { field: 'beatmap', keys: ['checksum', { field: 'time', keys: ['live'] }, { field: 'stats', keys: [{ field: 'objects', keys: ['total', 'holds'] }] }] },
    ];
    if (play) extra.push({ field: 'play', keys: ['score', mods] });
    if (results) extra.push({ field: 'resultsScreen', keys: ['score', mods] });
    return TM.mergeFilters(list, extra);
  }

  /** onStatus(connected) is called when the socket to tosu opens / drops. play / resultsScreen hits come unwrapped. */
  TM.v2 = (onMessage, filters, onStatus) => {
    const hits = new HitUnwrap();
    const fixed = (d) => {
      try {
        hits.fix(d);
      } catch (err) {
        console.error('[total_maniaset] hits', err); // the page still gets the update, as tosu sent it
      }
      onMessage(d);
    };
    return new TosuSocket('/websocket/v2', fixed, withHitFields(filters), onStatus);
  };

  // tosu's precise socket sends the play's whole hit error list with every update (PRECISE_DATA_POLL_RATE, 10 ms):
  // on a long play that is hundreds of KB a hundred times a second to each page. The 7K overflow test replay
  // (2026-11-02, 100,000+ errors, four pages taking the list) took tosu to 3 GB, and tosu quit once. From
  // PRECISE_ERRORS_SLOW on the list is asked for once every PRECISE_SLOW_MS (the filters swapped in for one update),
  // the updates between carrying the last list (a page takes a list that came without one for a retry); a shorter
  // list (a new play) brings the full rate back.
  // 65535 (the user's pick, 2026-11-02; first 16000): about 250 KB a message, four times the 16000 load — the
  // judgement bar stays live through most of a marathon (a 30-minute dense play), with less room left for tosu.
  const PRECISE_ERRORS_SLOW = 65535;
  const PRECISE_SLOW_MS = 250;

  TM.precise = (onMessage, filters, onStatus) => {
    if (!Array.isArray(filters) || !filters.includes('hitErrors')) return new TosuSocket('/websocket/v2/precise', onMessage, filters, onStatus);
    const without = filters.filter((f) => f !== 'hitErrors');
    let last = null;
    let slow = false;
    let timer = null;
    let sock = null;
    const use = (list) => {
      sock.filters = list; // sent again by the socket itself when it reconnects
      if (sock.open && sock.ws) sock.ws.send(`applyFilters:${JSON.stringify(list)}`);
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(() => use(filters), PRECISE_SLOW_MS);
    };
    const relay = (d) => {
      if (Array.isArray(d.hitErrors)) {
        last = d.hitErrors;
        const long = last.length >= PRECISE_ERRORS_SLOW;
        if (long) {
          if (!slow) TM.log(`precise: ${last.length} hit errors, the list now every ${PRECISE_SLOW_MS} ms`);
          slow = true;
          use(without);
          later();
        } else if (slow) {
          slow = false;
          clearTimeout(timer);
          use(filters);
        }
      } else if (slow && last) {
        d.hitErrors = last;
      }
      onMessage(d);
    };
    const status = (connected) => {
      if (connected && slow) {
        slow = false; // asked in full again on the new connection
        clearTimeout(timer);
        use(filters);
      }
      if (onStatus) onStatus(connected);
    };
    sock = new TosuSocket('/websocket/v2/precise', relay, filters, status);
    return sock;
  };

  /**
   * Counter settings from tosu's dashboard. `defaults` holds every uniqueID the page understands;
   * tosu's values override them and are pushed again whenever the user saves settings.
   *
   * The judgement / hitcount / dan pages in the sub-folders all use the settings of the top
   * folder (total_maniaset/settings.json, which holds all modules' settings; the top folder's
   * index.html is the dan course page, its dashboard entry is there for the Settings). tosu can't store settings of nested
   * counters unless settings\total_maniaset\ already exists (it doesn't create the folder:
   * ENOENT), so the sub-folders have no settings of their own.
   */
  TM.settings = function (defaults, onChange) {
    const settings = Object.assign({}, defaults);
    const counterPath = String(window.COUNTER_PATH || '').split('/')[0];
    const apply = (message) => {
      for (const [key, value] of Object.entries(message || {})) {
        if (key in defaults) settings[key] = value;
      }
      onChange(settings);
    };
    const connect = () => {
      let ws;
      try {
        ws = new WebSocket(`ws://${TM.tosuHost}/websocket/commands?l=${encodeURI(counterPath)}`);
      } catch (err) {
        setTimeout(connect, 2000);
        return;
      }
      ws.onopen = () => {
        if (counterPath) ws.send(`getSettings:${encodeURI(counterPath)}`);
      };
      ws.onmessage = (event) => {
        try {
          const { command, message } = JSON.parse(event.data);
          if (command === 'getSettings' && message && typeof message === 'object') apply(message);
        } catch (err) {
          /* ignore */
        }
      };
      ws.onclose = () => setTimeout(connect, 2000);
      ws.onerror = () => {};
    };
    onChange(settings);
    connect();
    return settings;
  };

  /** Merge several tosu applyFilters specs into one (a plain string = whole field). */
  TM.mergeFilters = function (...lists) {
    const out = [];
    const byField = new Map();
    for (const item of lists.flat()) {
      if (typeof item === 'string') {
        const prev = byField.get(item);
        if (prev === undefined) {
          byField.set(item, item);
          out.push(item);
        } else if (typeof prev !== 'string') {
          out[out.indexOf(prev)] = item;
          byField.set(item, item);
        }
      } else {
        const prev = byField.get(item.field);
        if (prev === undefined) {
          const copy = { field: item.field, keys: TM.mergeFilters(item.keys) };
          byField.set(item.field, copy);
          out.push(copy);
        } else if (typeof prev !== 'string') {
          prev.keys = TM.mergeFilters(prev.keys, item.keys);
        }
      }
    }
    return out;
  };

  /** ScoreV2 scoring (MAX worth 305; lazer always scores that way), from tosu's client and play.mods */
  TM.usesScoreV2 = function (client, mods) {
    if (String(client || '').toLowerCase() === 'lazer') return true;
    if (!mods) return false;
    if (Array.isArray(mods.array) && mods.array.some((m) => m && String(m.acronym || '').toUpperCase() === 'SV2')) return true;
    return /V2/i.test(String(mods.name || ''));
  };

  TM.num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  TM.clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

  /**
   * A page drawn at its own scale (CSS zoom on the root), so an overlay added in tosu's in-game manager (always
   * at scale 1, its box the metadata Resolution) is already the right size (2026-11-11, the user: "사람들이 높이
   * 및 크기를 조절할 필요가 없게 초반에 세팅을 해놓자"): dan (0.9) and total_maniaset (1). The judgement pages
   * and hitcount had it for a moment and are back at their own size, scaled in the manager (the user: "scale 만
   * 조절하게 하면 바로 사용 가능하게 하려는 목적이었는데", "judgement+, hitcount만 돌려줘"). A page asks for its
   * setting with TM.settings and passes it to TM.zoomPage. Sizes measured on screen (getBoundingClientRect) are
   * divided by TM.pageZoom to be in page px; viewport units are not zoomed, so pages size against 100% of the
   * body, never 100vw.
   */
  TM.PAGE_SCALE_DEFAULTS = { uiScaleDan: 0.9, uiScaleTotal: 1 };
  TM.pageZoom = 1;
  TM.zoomPage = function (value) {
    const z = TM.clamp(TM.num(value, 1), 0.2, 3);
    if (z === TM.pageZoom) return;
    TM.pageZoom = z;
    document.documentElement.style.zoom = z === 1 ? '' : String(z);
    window.dispatchEvent(new Event('resize')); // the pages fit their contents to the room they now have
  };

  /**
   * A line of text that moves when it is too long for its box, as the dan panel's song line (tm-dan.js
   * _fitMapTitle): the text and a copy of it MARQUEE_GAP apart run left at MARQUEE_SPEED, round and round; one
   * that fits sits still, one only a hair too long (≤ MARQUEE_SHRINK) is made that much smaller instead (the user,
   * 2026-11-06: "너무 노래 이름이나 그런게 길면 단 측정기에 있는 그런식으로 움직이게"). box: the element the text
   * goes in (its overflow is cut, CSS .tm-marquee). opts.minScale: how small the text may get before it moves
   * instead (a dan name in a narrow live cell: 0.55; the user, 2026-11-11, a Celestial dan cut there).
   * Returns { set(text), fit() }; fit() again when the box's width may have changed without a resize being
   * seen (a page that is not drawn runs no ResizeObserver).
   */
  const MARQUEE_GAP = 40; // px
  const MARQUEE_SPEED = 38; // px a second, a round at least 10 s
  const MARQUEE_SHRINK = 0.06;
  TM.marquee = function (box, opts = {}) {
    const minScale = TM.num(opts.minScale, 1 / (1 + MARQUEE_SHRINK));
    box.classList.add('tm-marquee');
    box.textContent = '';
    const track = document.createElement('span');
    track.className = 'tm-marquee-track';
    const text = document.createElement('span');
    text.className = 'tm-marquee-text';
    const ghost = document.createElement('span');
    ghost.className = 'tm-marquee-text tm-marquee-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    track.append(text, ghost);
    box.appendChild(track);
    const fit = () => {
      text.style.fontSize = '';
      const room = box.clientWidth;
      if (!room) return; // not shown: fitted once it is
      const width = text.getBoundingClientRect().width / TM.pageZoom; // in page px, as the room
      let scrolls = width > room + 0.5;
      if (scrolls && width * minScale <= room) {
        const cs = getComputedStyle(text);
        const spacing = (parseFloat(cs.letterSpacing) || 0) * text.textContent.length; // a fixed px per character
        const px = ((room - spacing) * parseFloat(cs.fontSize)) / Math.max(1, width - spacing);
        text.style.fontSize = `${Math.floor(px * 10) / 10}px`;
        scrolls = false;
      }
      const shift = `${Math.ceil(width) + MARQUEE_GAP}px`;
      if (scrolls === track.classList.contains('is-marquee') && (!scrolls || track.style.getPropertyValue('--marquee-shift') === shift)) return;
      track.classList.toggle('is-marquee', scrolls);
      if (!scrolls) return;
      track.style.setProperty('--marquee-shift', shift);
      track.style.setProperty('--marquee-duration', `${Math.max(10, (width + MARQUEE_GAP) / MARQUEE_SPEED).toFixed(2)}s`);
    };
    const set = (value) => {
      const v = String(value == null ? '' : value);
      if (text.textContent === v) return;
      text.textContent = v;
      ghost.textContent = v;
      fit(); // now, not on the next frame (a page that is not drawn has none)
    };
    if (window.ResizeObserver) new ResizeObserver(() => fit()).observe(box);
    if (document.fonts) document.fonts.addEventListener('loadingdone', () => fit());
    return { set, fit };
  };
})();

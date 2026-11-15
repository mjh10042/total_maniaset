/* total_maniaset — judgement+ (hiterror-plus/): the judgement bar with an Etterna-like row on top
 *
 * The user's idea (2026-10-26, after Etterna's gameplay screen), on the bar:
 * - above it, centred over the line ("가운데로 맞춰줘", 2026-10-27; it was at the line's left end): this play's
 *   accuracy and score ("98.52% 512,345"; the user: "내 정확도, 점수만 표시 — judgement+ 가 이 기능만");
 * - in the arrow's row, at the right end: a short, see-through bar of the time, from the first note to the last
 *   (tosu v2's song time, about every 100 ms: the precise socket sends no time; the bar moves well under 1 px per
 *   update).
 * Accuracy as the hitcount's: osu!stable counts MAX as 300, ScoreV2 as 305; the counts come mended past 32,767
 * (shared/tm-core.js).
 *
 * judgement+vs (hiterror-vs/: this play against the best local record's replay or the online ranking's #1, and
 * how far apart) was removed on 2026-11-02, with setup/ and data/ (the user: "나는 잘 되지만 다른 사람도 tosu
 * 경로에 깔기만 해도 실행되게 하려는 시도에서 막혀서"): it needed osu!'s scores.db and its replays' progress linked
 * into the overlay, which a copy into tosu's static folder alone cannot do. The last build with it is
 * total_maniaset_261101.zip.
 */
(function () {
  'use strict';

  const TM = window.TM;
  const GRADES = ['geki', '300', 'katu', '100', '50', '0']; // MA PR GR GD BD MS

  // sizes in page px; the in-game overlay shows them at its scale (0.5 → 34px text ≈ 17px on screen)
  TM.JPLUS_DEFAULTS = {
    jpShowTime: true,
    jpTimeFill: 'Elapsed',
    jpTimeWidth: 240,
    jpTimeHeight: 12,
    jpTextSize: 34,
  };

  TM.JPLUS_V2_FILTERS = [
    'client',
    { field: 'state', keys: ['name'] },
    { field: 'beatmap', keys: [{ field: 'time', keys: ['live', 'firstObject', 'lastObject'] }] },
    { field: 'play', keys: ['score', { field: 'hits', keys: GRADES }, { field: 'mods', keys: ['name', 'array'] }] },
  ];

  const countsOf = (hits) => (hits ? GRADES.map((k) => Number(hits[k]) || 0) : null);
  const sum = (c) => c.reduce((s, v) => s + v, 0);
  /** judgement points, as the hitcount's accuracy: osu!stable counts MAX as 300, ScoreV2 as 305 */
  const pointsOf = (c, v2) => (v2 ? 305 : 300) * c[0] + 300 * c[1] + 200 * c[2] + 100 * c[3] + 50 * c[4];
  const accuracy = (c, v2) => pointsOf(c, v2) / ((v2 ? 305 : 300) * sum(c));
  const percent = (x) => `${(x * 100).toFixed(2)}%`;
  const grouped = (x) => Math.round(x).toLocaleString('en-US');
  /** text into an element only when it changed (every tosu update, about 10 a second) */
  const put = (el, text) => {
    if (el.textContent !== text) el.textContent = text;
  };

  class JudgementPlus {
    /**
     * bar: the page's TM.HitErrorBar, so both share its width and fading. The two sit at the line's two ends
     * ("판정선 끝과 끝"): the row on top; the time bar in the arrow's row, at the right end, kept clear of the
     * arrow in the middle. Side by side they did not fit the line at the sizes asked for (34px text ≈ 390px with
     * a score, a 240px bar, a line about 500px wide).
     */
    constructor(bar) {
      this.s = Object.assign({}, TM.JPLUS_DEFAULTS);
      this.row = document.createElement('div');
      this.row.className = 'hp-row';
      this.row.innerHTML = '<div class="hp-mine"><span class="hp-acc"></span><span class="hp-myscore"></span></div>';
      bar.root.insertBefore(this.row, bar.root.firstChild);
      const time = document.createElement('div');
      time.className = 'hp-time';
      time.innerHTML = '<div class="hp-time-fill"></div>';
      bar.root.querySelector('.he-arrow-container').append(time);
      this.root = bar.root;
      this.ui = {
        acc: this.row.querySelector('.hp-acc'),
        myScore: this.row.querySelector('.hp-myscore'),
        time,
        fill: time.querySelector('.hp-time-fill'),
      };
      this.client = '';
      this.state = '';
      this.first = 0;
      this.last = 0;
      this.v2 = false;
      this.progress = -1;
      this.applySettings(this.s);
    }

    applySettings(settings) {
      for (const key of Object.keys(TM.JPLUS_DEFAULTS)) if (key in settings) this.s[key] = settings[key];
      const st = this.root.style; // the row and the time bar both read these
      st.setProperty('--hp-text', `${TM.clamp(TM.num(this.s.jpTextSize, 34), 8, 80)}px`);
      st.setProperty('--hp-time-width', `${TM.clamp(TM.num(this.s.jpTimeWidth, 240), 20, 800)}px`);
      st.setProperty('--hp-time-height', `${TM.clamp(TM.num(this.s.jpTimeHeight, 12), 2, 40)}px`);
      this.ui.time.classList.toggle('is-off', !this.s.jpShowTime);
      this.ui.time.classList.toggle('is-remaining', this.s.jpTimeFill === 'Remaining');
      this.progress = -1;
    }

    onV2(d) {
      const st = (d.state && d.state.name) || this.state;
      if (d.client !== undefined) this.client = d.client;
      const bm = d.beatmap || {};
      if (bm.time) {
        this.first = TM.num(bm.time.firstObject, this.first);
        this.last = TM.num(bm.time.lastObject, this.last);
        if (st === 'play') this._showTime(Number(bm.time.live));
      }
      if (st === 'play') {
        const mods = d.play && d.play.mods;
        if (mods) this.v2 = TM.usesScoreV2(this.client, mods);
        this._showPlay(countsOf(d.play && d.play.hits), Number(d.play && d.play.score) || 0);
      }
      this.state = st;
    }

    _showTime(live) {
      if (!Number.isFinite(live) || this.last <= this.first) return;
      const p = TM.clamp((live - this.first) / (this.last - this.first), 0, 1);
      if (Math.abs(p - this.progress) < 0.0005) return;
      this.progress = p;
      const shown = this.ui.time.classList.contains('is-remaining') ? 1 - p : p;
      this.ui.fill.style.transform = `scaleX(${shown})`;
    }

    /** every tosu update in a play: its accuracy and score */
    _showPlay(c, score) {
      if (!c) return;
      put(this.ui.acc, percent(sum(c) ? accuracy(c, this.v2) : 1));
      put(this.ui.myScore, grouped(score));
    }
  }

  TM.JudgementPlus = JudgementPlus;
})();

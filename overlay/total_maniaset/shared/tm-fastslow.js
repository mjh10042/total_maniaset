/* total_maniaset — fastslow: each note's timing as it is hit, in ms (the user, 2026-11-15: "실시간 패슬 기능이
 * 있었으면 좋겠대", "노트 실시간마다 어느정도 ms 단위로 처리했는지 보고 싶대", "느리면 + 빠르면 - 로 하려고 해",
 * "fastslow 로 이름 정하려고 해 (total_maniaset 귀속)").
 *
 * tosu precise sends the play's hit errors (ms, < 0 = early: one for every press and one for every long-note
 * release) every 10 ms; TM.precise thins that out on very long plays. The newest error is shown signed, + late and
 * − early, in the fast / slow colours (fast red, slow blue, as hitcount's fast / late), and fades fsHold s after the
 * last hit. Errors within fsHideWithin ms of the note are left out (0: every one), and a hit within it clears the last
 * number. The value is tosu's as it comes,
 * the one the judgement bar draws (on the map's clock: under DT, 1.5 times the real time off).
 *
 * Decimals (fsDecimals, up to 2; the user: "사실 소수 둘째점 ms까지 보고 싶긴 한대"): on lazer only. tosu reads
 * stable's errors as whole ms (readInt; lazer's TimeOffset is a double, passed on unrounded), so on stable they
 * would always be ".00". The decimals are as big as the whole ms (first smaller; the user: "소수점도 그냥 동일한
 * 글씨크기로").
 *
 * fsShow: "FAST" / "SLOW" above the ms, the word alone (the default), or the ms alone (as at first).
 *
 * Misses (the user: "그리고 MISS는 패슬 안 뜨는거 같은데"): a miss pressed outside the 50 window has its error
 * listed and shows as any hit (FAST, mostly). A note never pressed has none, so nothing showed for it; it now
 * shows SLOW, as hitcount counts such a miss late ("late = … not at all"). Which misses were not pressed: those of
 * a tosu v2 update's new misses (play.hits '0', every 100 ms) beyond the presses outside the 50 window
 * (TM.timingWindows, tm-hiterror.js) that came in on precise shortly before. Without a ms there is the word alone:
 * "SLOW" with "둘 다", nothing with "수치만".
 */
(function () {
  'use strict';

  const TM = window.TM;

  TM.FASTSLOW_DEFAULTS = {
    fsColorFast: '#ff7a7a',
    fsColorSlow: '#6cb6ff',
    fsHold: 1, // s the number stays after the last hit (0: until the next one)
    // ms: errors no farther off than this are not shown (0: every one); 16.5 the user's pick (2026-11-15, with
    // "FAST/SLOW만": "이제 이걸 기본 세팅으로 하면 될 듯")
    fsHideWithin: 16.5,
    fsDecimals: '2', // decimals on lazer (stable's errors are whole ms)
    // what is shown (the user, 2026-11-15: "둘다 띄우거나 그냥 단순히 fast / slow 만 띄우던가 수치만 띄우게"):
    // FAST / SLOW above the ms, the word alone (as big as the ms; the default, the user's pick), or the ms alone
    fsShow: 'FAST/SLOW만',
  };
  const SHOW_MODES = { '둘 다': 'both', 'FAST/SLOW만': 'word', 수치만: 'ms' };
  // a press outside the 50 window waits this long (ms) for the miss it made to reach the v2 counts (v2: 100 ms)
  const PRESSED_MISS_MS = 1000;
  TM.FASTSLOW_V2_FILTERS = [
    'client',
    { field: 'state', keys: ['name'] },
    // the miss count, and what the timing windows depend on (as hitcount)
    { field: 'play', keys: [{ field: 'hits', keys: ['0', '50', '100', '300', 'geki', 'katu'] }, { field: 'mods', keys: ['name', 'rate'] }, { field: 'mode', keys: ['name'] }] },
    { field: 'beatmap', keys: [{ field: 'mode', keys: ['name'] }, { field: 'stats', keys: [{ field: 'od', keys: ['original'] }] }] },
  ];
  TM.FASTSLOW_PRECISE_FILTERS = ['hitErrors'];

  class FastSlow {
    constructor(mount) {
      this.s = Object.assign({}, TM.FASTSLOW_DEFAULTS);
      this.root = document.createElement('div');
      this.root.className = 'tm-fastslow';
      this.root.innerHTML = `<span class="fs-stack"><span class="fs-word"></span>
        <span class="fs-line"><span class="fs-val"></span><span class="fs-frac"></span><span class="fs-unit">ms</span></span></span>`;
      mount.appendChild(this.root);
      this.word = this.root.querySelector('.fs-word');
      this.val = this.root.querySelector('.fs-val');
      this.frac = this.root.querySelector('.fs-frac');
      this.seen = 0; // the play's hit errors taken so far
      this.state = ''; // tosu's state name: errors are shown in a play only
      this.client = ''; // 'stable' / 'lazer': decimals on lazer only
      this.timer = null;
      this.windows = null; // the play's timing windows (TM.timingWindows): a press outside '50' is a miss
      this.windowsKey = '';
      this.misses = null; // the play's miss count at the last v2 update (null: none yet, the next one only counts)
      this.pressed = []; // when presses outside the 50 window came in, not yet matched to a new miss
      this._style();
      if (TM.isStandalonePreview) this._show(-24, true); // the dashboard's preview: a sample (outside fsHideWithin)
    }

    applySettings(settings) {
      for (const key of Object.keys(TM.FASTSLOW_DEFAULTS)) if (key in settings) this.s[key] = settings[key];
      this._style();
    }

    /** 'both' | 'word' | 'ms', as set (fsShow) */
    _mode() {
      return SHOW_MODES[this.s.fsShow] || SHOW_MODES[TM.FASTSLOW_DEFAULTS.fsShow];
    }

    /** the colours and the parts shown (fsShow) */
    _style() {
      this.root.style.setProperty('--fs-fast', String(this.s.fsColorFast || TM.FASTSLOW_DEFAULTS.fsColorFast));
      this.root.style.setProperty('--fs-slow', String(this.s.fsColorSlow || TM.FASTSLOW_DEFAULTS.fsColorSlow));
      for (const mode of Object.values(SHOW_MODES)) this.root.classList.toggle(`fs-mode-${mode}`, mode === this._mode());
    }

    onV2(data) {
      if (data.client) this.client = String(data.client).toLowerCase();
      const state = String((data.state && data.state.name) || '');
      if (state !== this.state) {
        this.state = state;
        this.misses = null; // counted again from the next update
        this.pressed = [];
        if (state !== 'play') this._hide(); // song select, results: nothing
      }
      if (state !== 'play') return;
      this._windowsOf(data);
      this._newMisses(data.play);
    }

    /** the timing windows of the play (as hitcount): mode, OD, mods and speed */
    _windowsOf(data) {
      if (typeof TM.timingWindows !== 'function') return;
      const bm = data.beatmap || {};
      const play = data.play || {};
      const mode = (bm.mode && bm.mode.name) || (play.mode && play.mode.name) || '';
      const od = TM.num(bm.stats && bm.stats.od && bm.stats.od.original, 0);
      const mods = (play.mods && play.mods.name) || '';
      const rate = TM.num(play.mods && play.mods.rate, 1) || 1;
      const key = `${mode}|${od}|${mods}|${rate}`;
      if (key === this.windowsKey) return;
      this.windowsKey = key;
      this.windows = TM.timingWindows(mode, od, mods, rate);
    }

    /** the v2 update's new misses: those beyond the presses outside the 50 window were never pressed — SLOW */
    _newMisses(play) {
      const count = play && play.hits ? TM.num(play.hits['0'], NaN) : NaN;
      if (!Number.isFinite(count)) return;
      const before = this.misses;
      this.misses = count;
      if (before === null || count <= before) {
        if (before !== null && count < before) this.pressed = []; // a retry
        return;
      }
      const now = performance.now();
      this.pressed = this.pressed.filter((t) => now - t <= PRESSED_MISS_MS);
      const added = count - before;
      const matched = Math.min(added, this.pressed.length);
      this.pressed.splice(0, matched);
      if (added > matched) this._showUnpressed();
    }

    /** tosu precise (every 10 ms): the newest of the errors that came in, if any is shown */
    onPrecise(data) {
      const errors = Array.isArray(data.hitErrors) ? data.hitErrors : null;
      if (!errors) return;
      if (errors.length < this.seen) {
        this.seen = 0; // a retry: a new play
        this.pressed = [];
        this._hide();
      }
      if (errors.length === this.seen) return;
      const within = Math.max(0, TM.num(this.s.fsHideWithin, 0));
      const w50 = this.windows && this.windows.get('50');
      const now = performance.now();
      let newest = null;
      let any = false; // a new error at all: when all of them are within fsHideWithin, the last one shown goes
      for (let i = this.seen; i < errors.length; i++) {
        const e = Number(errors[i]);
        if (!Number.isFinite(e)) continue;
        any = true;
        if (w50 > 0 && Math.abs(e) > w50 && this.state === 'play') this.pressed.push(now); // a miss, pressed
        if (!(within > 0 && Math.abs(e) <= within)) newest = e;
      }
      this.seen = errors.length; // a list from before the page knew it is in a play is only taken, not shown
      if (this.state !== 'play') return;
      if (newest !== null) this._show(newest);
      else if (any) this._hide(); // an older note's number would read as this one's
    }

    /** decimals shown: fsDecimals (0-2) on lazer, none on stable */
    _decimals() {
      if (this.client !== 'lazer') return 0;
      const d = Math.trunc(TM.num(this.s.fsDecimals, 2));
      return Math.max(0, Math.min(2, d));
    }

    _show(error, keep = false) {
      const dec = this._decimals();
      const unit = 10 ** dec;
      const ms = Math.round(error * unit) / unit;
      // on time to the ms shown: no word, so with the word alone there is nothing to show
      if (ms === 0 && this._mode() === 'word') {
        this._hide();
        return;
      }
      const [whole, frac = ''] = Math.abs(ms).toFixed(dec).split('.');
      this.word.textContent = ms < 0 ? 'FAST' : ms > 0 ? 'SLOW' : '';
      this.val.textContent = `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${whole}`;
      this.frac.textContent = frac ? `.${frac}` : '';
      this.root.classList.remove('no-ms');
      this.root.classList.toggle('is-fast', ms < 0);
      this.root.classList.toggle('is-slow', ms > 0);
      this._shown(keep);
    }

    /** a miss never pressed: late, without a ms (nothing with "수치만") */
    _showUnpressed() {
      if (this._mode() === 'ms') return;
      this.word.textContent = 'SLOW';
      this.val.textContent = '';
      this.frac.textContent = '';
      this.root.classList.add('no-ms', 'is-slow');
      this.root.classList.remove('is-fast');
      this._shown(false);
    }

    _shown(keep) {
      this.root.classList.add('is-shown');
      clearTimeout(this.timer);
      const hold = Math.max(0, TM.num(this.s.fsHold, TM.FASTSLOW_DEFAULTS.fsHold)) * 1000;
      if (!keep && hold > 0) this.timer = setTimeout(() => this._hide(), hold);
    }

    _hide() {
      clearTimeout(this.timer);
      this.root.classList.remove('is-shown');
    }
  }

  TM.FastSlow = FastSlow;
})();

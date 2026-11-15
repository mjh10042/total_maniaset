/* total_maniaset — hit error bar ("노트 판정선")
 *
 * Re-implementation of "Custom Hit Error Bar" v3.7.2 by breadles
 * (https://github.com/breadles5/customHitErrorBar) inside total_maniaset:
 * same settings, same geometry (1 ms = 2 px; smaller only when the line would be wider than its page, _fit),
 * same median arrow, same tick fading.
 */
(function () {
  'use strict';

  const TM = window.TM;

  // Same uniqueIDs/defaults as the user's breadles settings.json.
  TM.HITERROR_DEFAULTS = {
    color300g: '#ffffff',
    color300: '#ffff00',
    color200: '#00ff40',
    color100: '#0080c0',
    color50: '#8000ff',
    color0: '#ff0000',
    TimingWindowOpacity: 0,
    timingWindowHeight: 40,
    colorArrowEarly: '#0080ff',
    colorArrowLate: '#ff0000',
    colorArrowPerfect: '#ffffff',
    arrowSize: 25,
    perfectArrowThreshold: 5,
    colorBar: '#bf0000',
    barWidth: 8,
    barHeight: 60,
    tickWidth: 8,
    tickHeight: 40,
    tickOpacity: 0.75,
    tickDuration: 500,
    fadeOutDuration: 800,
    isRounded: 100,
    useCustomTimingWindows: false,
    customTimingWindows: '16.5,64,97,127,151',
  };

  // tosu v2 fields the bar needs.
  TM.HITERROR_V2_FILTERS = [
    { field: 'state', keys: ['name'] },
    { field: 'play', keys: [{ field: 'mode', keys: ['name'] }, { field: 'mods', keys: ['name', 'rate'] }] },
    {
      field: 'beatmap',
      keys: [{ field: 'mode', keys: ['name'] }, { field: 'stats', keys: [{ field: 'od', keys: ['original'] }] }, { field: 'time', keys: ['firstObject'] }],
    },
  ];

  const POOL_SIZE = 100;

  // ── timing windows (identical formulas to breadles) ──────────────────
  function osuWindows(od, mods) {
    const w = new Map();
    if (mods.includes('EZ')) {
      const m = od / 2;
      w.set('300', 50 - 3 * m); w.set('100', 140 - 8 * m); w.set('50', 200 - 10 * m);
    } else if (mods.includes('HR')) {
      const m = Math.min(od * 1.4, 10);
      w.set('300', 50 - 3 * m); w.set('100', 140 - 8 * m); w.set('50', 200 - 10 * m);
    } else {
      w.set('300', 80 - 6 * od); w.set('100', 140 - 8 * od); w.set('50', 200 - 10 * od);
    }
    return w;
  }

  function taikoWindows(od, mods) {
    const w = new Map();
    let m = od;
    if (mods.includes('EZ')) m = od / 2;
    else if (mods.includes('HR')) m = Math.min(od * 1.4, 10);
    w.set('300', 50 - 3 * m);
    // breadles: EZ and NM test the raw OD, HR tests the modified OD
    const hi = !mods.includes('EZ') && mods.includes('HR') ? m >= 5 : od >= 5;
    if (hi) {
      w.set('100', 119.5 - 8 * m); w.set('50', 135 - 8 * m);
    } else {
      w.set('100', 110 - 6 * m); w.set('50', 120 - 5 * m);
    }
    return w;
  }

  function maniaWindows(od, mods, rate) {
    const w = new Map();
    if (mods.includes('EZ')) {
      const m = od * 0.5;
      w.set('300g', 22.5 * rate);
      w.set('300', (64 - 3 * m) * rate);
      w.set('200', (97 - 3 * m) * rate);
      w.set('100', (127 - 3 * m) * rate);
      w.set('50', (151 - 3 * m) * rate);
    } else if (mods.includes('HR')) {
      const k = 5 / 7;
      w.set('300g', 11.43 * rate);
      w.set('300', (64 - 3 * od) * k * rate);
      w.set('200', (97 - 3 * od) * k * rate);
      w.set('100', (127 - 3 * od) * k * rate);
      w.set('50', (151 - 3 * od) * k * rate);
    } else {
      w.set('300g', 16.5 * rate);
      w.set('300', (64 - 3 * od) * rate);
      w.set('200', (97 - 3 * od) * rate);
      w.set('100', (127 - 3 * od) * rate);
      w.set('50', (151 - 3 * od) * rate);
    }
    return w;
  }

  function timingWindows(mode, od, mods, rate, custom) {
    if (custom) {
      const values = custom.split(',').map((v) => Number.parseFloat(v.trim()));
      const grades = mode === 'mania' ? ['300g', '300', '200', '100', '50'] : ['300', '100', '50'];
      const w = new Map();
      grades.forEach((g, i) => {
        if (i < values.length) w.set(g, values[i]);
      });
      return w;
    }
    if (mode === 'osu') return osuWindows(od, mods);
    if (mode === 'taiko') return taikoWindows(od, mods);
    if (mode === 'mania') return maniaWindows(od, mods, rate);
    return new Map();
  }
  // hitcount's fast / late split uses the same windows as the bar's tick colours
  TM.timingWindows = timingWindows;

  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  }

  class HitErrorBar {
    constructor(mount) {
      this.s = Object.assign({}, TM.HITERROR_DEFAULTS);
      this.root = document.createElement('div');
      this.root.className = 'tm-he is-hidden';
      this.root.innerHTML =
        '<div class="he-arrow-container"><div class="he-arrow"></div></div>' +
        '<div class="he-main"><div class="he-colors"></div><div class="he-ticks"></div><div class="he-bar"></div></div>';
      mount.appendChild(this.root);
      this.arrow = this.root.querySelector('.he-arrow');
      this.colors = this.root.querySelector('.he-colors');
      const ticks = this.root.querySelector('.he-ticks');
      this.pool = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'he-tick inactive';
        ticks.appendChild(el);
        this.pool.push({ el, pos: 0, ts: 0, anim: null });
      }
      this.state = '';
      this.mode = '';
      this.od = 0;
      this.mods = '';
      this.rate = 1;
      this.firstObject = 0;
      this.windows = new Map();
      this.maxWindow = 0; // ms: the line is 4 px for each, unless that is wider than the page (_fit)
      this.fit = 1;
      this.processed = 0;
      this.isReset = true;
      this.arrowPos = 0;
      this.hideTimer = null;
      this.applySettings(this.s);
      window.addEventListener('resize', () => this._fit()); // the in-game box or OBS source resized
    }

    applySettings(settings) {
      for (const key of Object.keys(TM.HITERROR_DEFAULTS)) {
        if (key in settings) this.s[key] = settings[key];
      }
      const s = this.s;
      const st = this.root.style;
      const rounded = TM.clamp(TM.num(s.isRounded, 100), 0, 100) / 100;
      const barW = TM.num(s.barWidth, 8);
      const barH = TM.num(s.barHeight, 60);
      const tickW = TM.num(s.tickWidth, 8);
      const twh = TM.num(s.timingWindowHeight, 40);
      st.setProperty('--bar-width', `${barW}px`);
      st.setProperty('--bar-height', `${barH}px`);
      st.setProperty('--tick-width', `${tickW}px`);
      st.setProperty('--tick-height', `${TM.num(s.tickHeight, 40)}px`);
      st.setProperty('--timing-window-height', `${twh}%`);
      st.setProperty('--bar-radius', `${(barW / 2) * rounded}px`);
      st.setProperty('--tick-radius', `${(tickW / 2) * rounded}px`);
      st.setProperty('--timing-window-radius', `${((barH * twh) / 100 / 2) * rounded}px`);
      st.setProperty('--arrow-size', `${TM.num(s.arrowSize, 25)}px`);
      st.setProperty('--bar-color', s.colorBar);
      for (const g of ['300g', '300', '200', '100', '50', '0']) st.setProperty(`--color-${g}`, s[`color${g}`]);
      st.setProperty('--arrow-early', s.colorArrowEarly);
      st.setProperty('--arrow-late', s.colorArrowLate);
      st.setProperty('--arrow-perfect', s.colorArrowPerfect);
      st.setProperty('--tick-opacity', String(TM.num(s.tickOpacity, 0.75)));
      st.setProperty('--timing-windows-opacity', String(TM.num(s.TimingWindowOpacity, 0)));
      if (this.state === 'play') this._computeWindows();
    }

    onV2(data) {
      const stateName = data.state && data.state.name;
      if (stateName === undefined || stateName === this.state) return;
      this.state = stateName;
      this.rate = TM.num(data.play && data.play.mods && data.play.mods.rate, 1) || 1;
      if (stateName === 'play') {
        this.mode = (data.beatmap && data.beatmap.mode && data.beatmap.mode.name) || (data.play && data.play.mode && data.play.mode.name) || '';
        this.od = TM.num(data.beatmap && data.beatmap.stats && data.beatmap.stats.od && data.beatmap.stats.od.original, 0);
        this.mods = (data.play && data.play.mods && data.play.mods.name) || '';
        this.firstObject = TM.num(data.beatmap && data.beatmap.time && data.beatmap.time.firstObject, 0);
        clearTimeout(this.hideTimer);
        this._computeWindows();
        this.root.classList.remove('is-hidden');
        this.isReset = false;
      } else {
        this.root.classList.add('is-hidden');
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => {
          this.reset();
          this.isReset = true;
        }, TM.num(this.s.fadeOutDuration, 800));
      }
    }

    onPrecise(data) {
      const errors = Array.isArray(data.hitErrors) ? data.hitErrors : [];
      const t = data.currentTime;
      if ((typeof t === 'number' && t < this.firstObject) || errors.length < this.processed) {
        if (!this.isReset) {
          this.reset();
          this.isReset = true;
        }
        if (errors.length < this.processed) this.processed = 0;
        if (typeof t === 'number' && t < this.firstObject) return;
      }
      this._update(errors);
      this.isReset = false;
    }

    _computeWindows() {
      const custom = this.s.useCustomTimingWindows ? String(this.s.customTimingWindows || '') : undefined;
      this.windows = timingWindows(this.mode, this.od, this.mods, this.rate, custom);
      let maxWindow = 0;
      this.windows.forEach((w) => {
        if (w > maxWindow) maxWindow = w;
      });
      this.maxWindow = Math.abs(maxWindow);
      const frag = document.createDocumentFragment();
      this.windows.forEach((w, grade) => {
        const div = document.createElement('div');
        div.className = `he-window he-window-${grade}`;
        div.dataset.ms = String(Math.abs(w));
        frag.appendChild(div);
      });
      this.colors.replaceChildren(frag);
      this._fit();
    }

    /**
     * breadles draws 1 ms as 2 px, so the line is 4 px for each ms of its widest window. DT / NC (windows
     * × 1.5) or custom windows can make that wider than the page (judgement+'s 623 px box: OD 8 + DT is
     * 762 px), and both ends were cut. Then the windows, ticks and arrow are all drawn smaller by one factor,
     * to fit the page with a tick's width to spare (2026-11-02, the user: "양 끝이 안나가게"); a line that
     * fits is drawn as before.
     */
    _fit() {
      if (!this.maxWindow) return;
      const natural = this.maxWindow * 4;
      // the page's width in page px (it may be drawn smaller: TM.zoomPage)
      const room = (document.documentElement.clientWidth || 0) / TM.pageZoom - TM.num(this.s.tickWidth, 8);
      this.fit = room > 0 && natural > room ? room / natural : 1;
      this.root.style.setProperty('--container-width', `${natural * this.fit}px`);
      for (const div of this.colors.children) div.style.width = `${Number(div.dataset.ms) * 4 * this.fit}px`;
      for (const tick of this.pool) {
        if (tick.ts) tick.el.style.transform = `translate3d(${tick.pos * this.fit}px, 0px, 0px)`;
      }
      this.arrow.style.transform = `translate3d(${this.arrowPos * 2 * this.fit}px, 0px, 0px)`;
    }

    _grade(error) {
      const e = Math.abs(error);
      for (const [grade, range] of this.windows) {
        if (e <= range) return grade;
      }
      return '0';
    }

    _update(errors) {
      const now = Date.now();
      const tickDuration = TM.num(this.s.tickDuration, 500);
      const fade = TM.num(this.s.fadeOutDuration, 800);
      const opacity = TM.num(this.s.tickOpacity, 0.75);
      for (let i = this.processed; i < errors.length; i++) {
        const error = errors[i];
        const tick = this.pool[i % POOL_SIZE];
        if (tick.anim) tick.anim.cancel();
        tick.pos = error * 2;
        tick.ts = now;
        tick.el.className = `he-tick _${this._grade(error)}`;
        tick.el.style.transform = `translate3d(${tick.pos * this.fit}px, 0px, 0px)`;
        tick.el.style.visibility = 'visible';
        tick.el.style.opacity = String(opacity);
        tick.anim = tick.el.animate([{ opacity }, { opacity: 0 }], {
          duration: fade,
          delay: tickDuration,
          easing: 'linear',
          fill: 'forwards',
        });
      }
      this.processed = errors.length;
      // retire finished ticks
      for (const tick of this.pool) {
        if (tick.ts && now - tick.ts > tickDuration + fade) {
          tick.ts = 0;
          tick.el.className = 'he-tick inactive';
        }
      }
      // arrow = median of the ticks that are not fading yet (same int math as breadles)
      const recent = [];
      for (const tick of this.pool) {
        if (tick.ts && now - tick.ts <= tickDuration) recent.push(tick.pos >> 1);
      }
      this._setArrow(median(recent));
    }

    _setArrow(pos) {
      if (pos === this.arrowPos) return;
      this.arrowPos = pos;
      const thr = TM.num(this.s.perfectArrowThreshold, 5);
      const color = Math.abs(pos) <= thr ? 'var(--arrow-perfect)' : pos < 0 ? 'var(--arrow-early)' : 'var(--arrow-late)';
      this.arrow.style.borderTopColor = color;
      this.arrow.style.transform = `translate3d(${pos * 2 * this.fit}px, 0px, 0px)`;
    }

    reset() {
      for (const tick of this.pool) {
        if (tick.anim) tick.anim.cancel();
        tick.anim = null;
        tick.ts = 0;
        tick.pos = 0;
        tick.el.style.opacity = '0';
        tick.el.className = 'he-tick inactive';
        tick.el.style.transform = 'translate3d(0px, 0px, 0px)';
      }
      this.processed = 0;
      this.arrowPos = 0;
      this.arrow.style.borderTopColor = 'var(--arrow-perfect)';
      this.arrow.style.transform = 'translate3d(0px, 0px, 0px)';
    }
  }

  TM.HitErrorBar = HitErrorBar;
})();

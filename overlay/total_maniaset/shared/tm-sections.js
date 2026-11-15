/* total_maniaset — dan per section (the top folder's own page, index.html, beside tm-course.js).
 *
 * Asked for on 2026-10-27 (a player, through the user): how many dans each part of a map is, for rice,
 * hybrid and LN alike; 4K and 7K only, as the rest of this page ("4키, 7키일 경우에만 각 구간별로 몇단
 * 정도인지"). Songs change where they change (easy up to 1:40 and hard after, density up and down), so the
 * sections are found from the chart: shared/engine/sections.js, run by the dan panel's engine in this page's
 * own worker. That cuts the map where its strain and patterns change (bars, kiai, rests; 10-24 s parts), rates
 * each part over a minute of it and sets them against the map's own dan, with the dan panel's settings (4K
 * 계산 엔진, 7K 판정 모델; the dan scale 단 기준 for rice) and the speed of the mods chosen. A momentary peak (a
 * second a dan or more over both sides of it) is a row of its own, in its colour (it had "↑" before its dan
 * until 2026-11-11, the user: "빨간색 화살표 없애기").
 *
 * A recognised dan course shows its songs' accuracy instead (tm-course.js). The header of every other map is
 * its "artist - title [version]" (2026-11-06, the user: "그 외에는 제작자 - 노래 이름이 나오게", then "난이도
 * 이름까지 나오는게 맞다"; it was the difficulty's name alone, which a course panel's header keeps: there it is
 * the course's), alone on maps other than 4K / 7K; too long for the header, it moves (TM.marquee).
 * A highlight's row is coloured: kiai (the mapper's), inferred from the chart, or a momentary peak, in their
 * own colours (secColorKiai, secColorPeak, secColorSpike).
 * Shown: the predicted dan 3 s ago, now and 3 s ahead, once a second, following the song (in a play, and
 * the preview in song select; the user, 2026-10-28: "1초로 하고 가사 대신에 양쪽에 -3초, +3초 … 가운데는
 * 실시간 난이도 예측"; sections.js timelineOf). A hybrid's other dan is under its main one, smaller.
 * Only without a timeline the list of 2026-10-27, scrolling as lyrics do, 5 sections at most: the first
 * section and the 2 after it; from the 3rd on, 2 before, the one being played, 2 after.
 */
(function () {
  'use strict';

  const TM = window.TM;
  const SCRIPT_URL = (document.currentScript && document.currentScript.src) || window.location.href;
  // the dan panel analyses the same map at the same moment; this waits a little so that one comes first
  const DEBOUNCE_MS = 600;
  const BEFORE = 2; // sections shown before the one being played
  const AFTER = 2; // and after it
  // the live cells lag the song by secLiveDelay seconds on the real clock (see _tick), within these
  // the smallest a live cell's line gets (of its size) before it moves instead (TM.marquee)
  const CELL_MIN_SCALE = 0.55;
  // (down to −3 s: the cells as far ahead as the "+3초" one; the user, 2026-11-06: "-0.5는 에바야 -3까지")
  const LIVE_DELAY_MIN = -3;
  const LIVE_DELAY_MAX = 5;
  // the side cells' distance from now, as set (secCellSpan), within these (s)
  const SPAN_MIN = 1;
  const SPAN_MAX = 10;

  // the dan panel's settings that the sections follow (the dashboard's total_maniaset entry holds them)
  TM.SECTION_DEFAULTS = {
    danEngine: '2.3.5+MMA 평균',
    dan7kModel: 'total_maniaset',
    danScoringMode: 'Reform',
    // a highlight section's row colour: under kiai (the mapper's), or inferred from the chart (the user:
    // "하이라이트 줄 색만", "추정은 다르게 표시")
    secColorKiai: '#ffb067',
    secColorPeak: '#b9a6ff',
    // a momentary peak's row (the testers: "순간적으로 밀도가 높아지는 부분", 2026-10-28)
    secColorSpike: '#ff7a8c',
    // how late the live cells follow the song (s). Measured on a replay with its video (2026-10-31, Alpha
    // Stamina Practice Pack [Die Winnipeg Die 1.15 ~ AlexDest (MidHigh)]): the timeline itself is on the notes
    // being hit (best fit to the density −0.1 s, to the player's timing errors 0.0-0.1 s; errors grow within
    // 0.2 s of a dense part's start) and tosu's data reaches the overlay about 0.1 s after the screen; so 0 is
    // the hands' "now". The testers had felt that very display "1-2초 빠른", hence 1.75 at first; the user then
    // found it 2 s late (2026-11-06: "우리가 2초 느려 그러니까 2초 빨라야 할듯"), so −0.25: a change starts
    // 0.5 s before the notes change and is half done 0.1 s after. A setting, as the user chose ("설정으로
    // 고르게"), since that feel differs from one player to the next
    secLiveDelay: -0.25,
    // the live cells' names (the user, 2026-11-11: "-3초 지금 +3초를 -3sec. now +3sec. 로 바꾸고 싶긴 해 (얘는
    // 설정으로)"; CELL_LABELS)
    secCellLabels: 'English',
    // how far the side cells look back and ahead (s), and the "now" cell alone (the user, 2026-11-12: "3초 뿐만
    // 아니라 +-n초 도 원하는 사람도 있고, now (지금)만 원하는 경우도 있음")
    secCellSpan: 3,
    secNowOnly: false,
  };
  /** the live cells' names for side cells n s off now */
  const CELL_LABELS = {
    English: (n) => ({ before: `−${n}sec.`, now: 'now', after: `+${n}sec.` }),
    한국어: (n) => ({ before: `−${n}초`, now: '지금', after: `+${n}초` }),
  };

  TM.SECTION_V2_FILTERS = [
    'client',
    { field: 'state', keys: ['name'] },
    {
      field: 'beatmap',
      keys: ['checksum', 'version', 'artist', 'title', { field: 'mode', keys: ['name'] }, { field: 'time', keys: ['live'] }],
    },
    { field: 'play', keys: [{ field: 'mods', keys: ['number', 'array'] }] },
  ];

  const clock = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  /** a dan name made short for a row, as the dan panel names a hybrid's: "4th Dan" → "4th", "夜明け Yoake" → "Yoake" */
  const shortName = (name) => {
    const s = String(name || '');
    const jp = s.match(/^[^\x00-\x7f]+\s+(\S+)$/);
    return jp ? jp[1] : s.replace(/\s+Dan$/i, '');
  };

  /** the speed and engine label of the mods chosen (stable's bits; lazer's array), as shared/tm-engine.js reads them */
  function modsOf(client, mods) {
    const m = mods || {};
    if (String(client || '').toLowerCase() === 'lazer' && Array.isArray(m.array)) {
      for (const o of m.array) {
        const a = String((o && o.acronym) || '').toUpperCase();
        if (!['NC', 'DT', 'HT', 'DC'].includes(a)) continue;
        const label = a === 'DC' ? 'HT' : a;
        const raw = Number(o.settings && o.settings.speed_change);
        const speed = Number.isFinite(raw) && raw > 0 ? raw : label === 'HT' ? 0.75 : 1.5;
        return { rate: speed, label, classic: m.array.some((x) => String((x && x.acronym) || '').toUpperCase() === 'CL') };
      }
      return { rate: 1, label: '', classic: m.array.some((x) => String((x && x.acronym) || '').toUpperCase() === 'CL') };
    }
    const n = Number(m.number) || 0;
    const classic = !(n & 536870912); // ScoreV2 off
    if (n & 512) return { rate: 1.5, label: 'NC', classic };
    if (n & 64) return { rate: 1.5, label: 'DT', classic };
    if (n & 256) return { rate: 0.75, label: 'HT', classic };
    return { rate: 1, label: '', classic };
  }

  /** "4K 계산 엔진" → the worker's rc, as shared/tm-engine.js setEngine() */
  function rcOf(name) {
    const s = String(name || '').toLowerCase();
    const mma = s.includes('mma');
    const legacy = s.includes('2.3.5') || s.includes('legacy');
    return mma && !legacy ? 'mma' : legacy && !mma ? 'legacy' : 'average';
  }

  class SectionPanel {
    constructor(mount) {
      this.s = Object.assign({}, TM.SECTION_DEFAULTS);
      this.root = document.createElement('section');
      this.root.className = 'tm-course tm-sections is-empty';
      const cellHtml = (which, at) =>
        `<div class="tc-cell is-${which}"><span class="tc-at">${at}</span><span class="tc-val"></span><span class="tc-sub"></span><span class="tc-second"></span></div>`;
      this.root.innerHTML = `
        <div class="tc-main">
          <div class="tc-head"><span class="tc-name"></span><span class="tc-scale"></span><span class="tc-where"></span></div>
          <div class="tc-list"></div>
          <div class="tc-live">${cellHtml('before', '')}${cellHtml('now', '')}${cellHtml('after', '')}</div>
        </div>`;
      mount.appendChild(this.root);
      // a live cell: the dan's name, its sublevel under it (the cells are narrow), a hybrid's other dan under that.
      // A line too long for the cell gets smaller, down to CELL_MIN_SCALE, then moves (a Celestial "Transcendence
      // III" was cut there; the user, 2026-11-11: "단 이름이 길면 잘리는 게 확인됐어")
      const line = (el) => TM.marquee(el, { minScale: CELL_MIN_SCALE });
      const cell = (which) => {
        const root = this.root.querySelector(`.tc-cell.is-${which}`);
        return { root, at: root.querySelector('.tc-at'), val: line(root.querySelector('.tc-val')), sub: line(root.querySelector('.tc-sub')), second: line(root.querySelector('.tc-second')) };
      };
      this.ui = {
        name: this.root.querySelector('.tc-name'),
        scale: this.root.querySelector('.tc-scale'),
        where: this.root.querySelector('.tc-where'),
        list: this.root.querySelector('.tc-list'),
        live: { before: cell('before'), now: cell('now'), after: cell('after') },
      };
      this.nameLine = TM.marquee(this.ui.name); // the song's name: moves when too long for the header
      this.liveSec = null; // the second the live cells show
      this.onShown = null; // (shown) → the page hides the course panel's idle notice under the sections
      this.md5 = '';
      this.version = '';
      this.song = ''; // "artist - title [version]", the header
      this.isCourse = false; // a recognised dan course: tm-course.js shows it, this panel nothing
      this.client = '';
      this.mods = { rate: 1, label: '', classic: true };
      this.state = '';
      this.live = 0;
      this.text = null; // the map's .osu, when it is a 4K / 7K mania map that is not a dan course
      this.keys = 0;
      this.result = null; // { key, sections } for the map, mods and settings asked
      this.analysing = false;
      this.rows = [];
      this.timer = null;
      this.worker = null;
      this.workerReady = null;
      this.jobs = new Map();
      this.jobId = 0;
      this.busy = false;
      this.again = false;
      this._cellLabels();
      this._scaleTag();
    }

    applySettings(settings) {
      const before = this._key();
      const scale = this.s.danScoringMode;
      for (const key of Object.keys(TM.SECTION_DEFAULTS)) if (key in settings) this.s[key] = settings[key];
      this.root.style.setProperty('--sec-kiai', String(this.s.secColorKiai || TM.SECTION_DEFAULTS.secColorKiai));
      this.root.style.setProperty('--sec-peak', String(this.s.secColorPeak || TM.SECTION_DEFAULTS.secColorPeak));
      this.root.style.setProperty('--sec-spike', String(this.s.secColorSpike || TM.SECTION_DEFAULTS.secColorSpike));
      this._cellLabels();
      this._scaleTag();
      this.liveSec = null; // the cells again at the next update, with the side cells' distance as set now
      if (this._key() !== before) this._schedule();
      else if (scale !== this.s.danScoringMode) this._build();
    }

    /**
     * the dan scale's name, small in the header, for Signicial and Shoegazer: they name their dans as Reform does
     * (the user, 2026-11-14: "Signicial 과 reform 과의 구분이 필요할 거 같아"; the dan panel puts it where a hybrid's
     * "RC" goes). 4K maps only: 7K ones are rated on the 7K dans
     */
    _scaleTag() {
      const scale = String(this.s.danScoringMode || 'Reform').toLowerCase();
      const tag = this.keys !== 4 ? '' : scale === 'signicial' ? 'Signicial' : scale === 'shoegazer' ? 'Shoegazer' : '';
      this.ui.scale.textContent = tag;
      this.ui.scale.style.display = tag ? '' : 'none';
    }

    /** the live cells' names, as set (secCellLabels, secCellSpan), and the "now" cell alone (secNowOnly) */
    _cellLabels() {
      const labelsOf = CELL_LABELS[this.s.secCellLabels] || CELL_LABELS[TM.SECTION_DEFAULTS.secCellLabels];
      const labels = labelsOf(this._span());
      for (const which of ['before', 'now', 'after']) this.ui.live[which].at.textContent = labels[which];
      this.root.classList.toggle('is-now-only', this._nowOnly());
    }

    /** the side cells' distance from now (s), as set: SPAN_MIN-SPAN_MAX, to 0.1 s */
    _span() {
      const n = Number(this.s.secCellSpan);
      return Number.isFinite(n) ? Math.round(TM.clamp(n, SPAN_MIN, SPAN_MAX) * 10) / 10 : TM.SECTION_DEFAULTS.secCellSpan;
    }

    _nowOnly() {
      return this.s.secNowOnly === true || this.s.secNowOnly === 'true';
    }

    onV2(d) {
      const bm = d.beatmap || {};
      if (d.client !== undefined) this.client = d.client;
      if (bm.checksum && bm.checksum !== this.md5) {
        this.md5 = bm.checksum;
        this.version = String(bm.version || '');
        // "artist - title [version]", as the dan panel's song line (the user, 2026-11-06: "난이도 이름까지 나오는게 맞다")
        const song = [bm.artist, bm.title].filter(Boolean).join(' - ');
        const version = this.version.trim();
        const tag = version.startsWith('[') && version.endsWith(']') ? version : `[${version}]`;
        this.song = version ? `${song} ${tag}`.trim() : song;
        this.isCourse = false;
        this.text = null;
        this.result = null;
        this._build();
        if (!bm.mode || bm.mode.name === 'mania') this._load(this.md5);
      }
      if (d.play && d.play.mods) {
        const mods = modsOf(this.client, d.play.mods);
        if (mods.rate !== this.mods.rate || mods.label !== this.mods.label || mods.classic !== this.mods.classic) {
          this.mods = mods;
          this._schedule();
        }
      }
      if (d.state && d.state.name) this.state = d.state.name;
      const live = Number(bm.time && bm.time.live);
      if (Number.isFinite(live)) this.live = live;
      this._mark();
    }

    /** the map's .osu (tosu's copy): kept only for a 4K / 7K mania map that is not a recognised dan course */
    async _load(md5) {
      try {
        const res = await fetch(`${TM.tosuHttp}/files/beatmap/file`, { cache: 'no-store' });
        if (!res.ok || this.md5 !== md5) return;
        const text = await res.text();
        if (this.md5 !== md5) return;
        const keys = Math.round(Number((text.match(/^CircleSize\s*:\s*([\d.]+)/m) || [])[1]));
        const mania = /^Mode\s*:\s*3\s*$/m.test(text);
        if (!mania || (keys !== 4 && keys !== 7)) return;
        if (TM.loadCourse && TM.loadCourse(text)) {
          this.isCourse = true;
          this._build();
          return;
        }
        this.text = text;
        this.keys = keys;
        this._schedule();
      } catch (err) {
        // no map file: nothing to show
      }
    }

    /** what the sections depend on: the map, the speed, the engine settings */
    _key() {
      return `${this.md5}|${this.mods.rate}|${this.mods.label}|${this.mods.classic}|${rcOf(this.s.danEngine)}|${this.s.dan7kModel}`;
    }

    _schedule() {
      clearTimeout(this.timer);
      if (!this.text) return;
      if (this.result && this.result.key === this._key()) return;
      this.analysing = true;
      this._build();
      this.timer = setTimeout(() => this._run(), DEBOUNCE_MS);
    }

    /** one job at a time; a map chosen meanwhile is analysed next (only the latest) */
    async _run() {
      if (this.busy) {
        this.again = true;
        return;
      }
      if (!this.text) return;
      const key = this._key();
      if (this.result && this.result.key === key) return;
      this.busy = true;
      try {
        const sevenK = String(this.s.dan7kModel || '').toLowerCase().includes('danoverlay') ? 'danoverlay' : 'total_maniaset';
        const rc = rcOf(this.s.danEngine);
        const r = await this._job({
          type: 'sections', text: this.text, mod: this.mods.label || 'NM', rate: this.mods.rate, engine: 'legacy',
          difficulty: this.version, srOfficial: 0, modLabel: this.mods.label, sevenK,
          lnModel: rc === 'legacy' ? 'danoverlay' : 'total_maniaset', rc, classic: this.mods.classic,
        });
        if (key === this._key()) {
          const ok = Boolean(r && r.ok && r.payload);
          this.result = { key, sections: ok ? r.payload.sections || [] : [], timeline: ok ? r.payload.timeline || [] : [], step: ok ? r.payload.step || 1000 : 1000 };
          this.analysing = false;
          this._build();
          if (r && r.ok) TM.log(`sections: ${this.result.sections.length} in ${Math.round(r.ms)} ms`);
          else if (r) TM.log(`sections failed: ${r.error}`);
        }
      } finally {
        this.busy = false;
        if (this.again) {
          this.again = false;
          this._run();
        }
      }
    }

    /** the engine worker of this page (shared/engine/worker.js), started on first use */
    _job(job) {
      if (!this.worker) {
        this.workerReady = new Promise((resolve) => {
          try {
            this.worker = new Worker(new URL('engine/worker.js', SCRIPT_URL), { type: 'module' });
            this.worker.onmessage = (event) => {
              const m = event.data || {};
              if (m.type === 'ready') resolve(true);
              else if (m.type === 'fatal') resolve(false);
              else if (m.type === 'result' && this.jobs.has(m.id)) {
                this.jobs.get(m.id)(m);
                this.jobs.delete(m.id);
              }
            };
            this.worker.onerror = () => resolve(false);
          } catch (err) {
            resolve(false); // no module workers here: no sections
          }
        });
      }
      return this.workerReady.then(
        (ok) =>
          ok
            ? new Promise((resolve) => {
                job.id = ++this.jobId;
                this.jobs.set(job.id, resolve);
                this.worker.postMessage(job);
              })
            : null,
      );
    }

    /** a section's dan as the dan panel would name it: 7K, LN Course, else the dan scale chosen; a hybrid's second */
    _danText(dan) {
      const [name, sub] = this._danParts(dan);
      const second = this._secondText(dan);
      return `${name} ${sub}`.trim() + (second ? ` · ${second}` : '');
    }

    /**
     * a hybrid's dan of its other notes, shown smaller under or beside its main one ("RC 5th" with an LN dan,
     * "LN Yoake" with a rice one; the user, 2026-10-28: "롱놋은 롱놋, 단놋 (선택), 단놋은 단놋, 롱놋 (선택) … 주
     * 노트는 글자가 크게, 서브 노트는 밑에 두고 글자를 상대적으로 작게"; no setting for it)
     */
    _secondText(dan) {
      const s = dan && dan.second;
      return s ? `${s.kind === 'rc' ? 'RC' : 'LN'} ${shortName(s.name)}` : '';
    }

    /**
     * [name, sublevel] of a dan on the scale shown (without a hybrid's second). 7K as 4K: the LN dan where it
     * leads ("LN 3rd"), else the Regular one; no more "HY 5th", a dan mixed of the two (engine/hybrid_7k.js)
     */
    _danParts(dan) {
      if (dan.k7) {
        const main = dan.k7ln || dan.k7;
        return [`${dan.k7ln ? 'LN ' : ''}${shortName(main.name)}`, String(main.sub || '')];
      }
      const scale = String(this.s.danScoringMode || 'Reform').toLowerCase();
      const main = dan.ln ? Object.assign({}, dan.ln, { tag: 'LN ' }) : dan[scale] || dan.reform;
      return [`${main.tag || ''}${shortName(main.name)}`, String(main.sub || '')];
    }

    _build() {
      const list = this.ui.list;
      list.textContent = '';
      this._scaleTag(); // the map's keys may have changed
      this.rows = [];
      this.root.classList.remove('is-live'); // the cells come back with the map's timeline (_mark)
      this.liveSec = null;
      const sections = this.result && this.result.key === this._key() ? this.result.sections : null;
      // any map but a dan course: its song in the header, a 4K / 7K one's sections under it
      const shown = Boolean(this.song) && !this.isCourse;
      this.root.classList.toggle('is-empty', !shown);
      if (this.onShown) this.onShown(shown);
      if (!shown) return;
      this.ui.where.textContent = !this.text ? '' : !sections || this.analysing ? 'analysing' : '';
      this.nameLine.set(this.song);
      this.nameLine.fit(); // the same name, shown again or beside another right side
      if (!this.text || !sections || this.analysing) return;
      // the rows roll up inside the list (lyrics): the list shows a few of them, see _mark()
      const roll = document.createElement('div');
      roll.className = 'tc-roll';
      list.appendChild(roll);
      sections.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = s.kind ? `tc-song is-${s.kind}` : 'tc-song'; // is-kiai / is-peak: a highlight; is-spike: a moment
        const line = document.createElement('div');
        line.className = 'tc-line';
        const num = document.createElement('span');
        num.className = 'tc-num';
        num.textContent = String(i + 1);
        const time = document.createElement('span');
        time.className = 'tc-title tc-time';
        // a momentary peak's row is a second or so: its start alone
        time.textContent = clock(s.start) === clock(s.end) ? clock(s.start) : `${clock(s.start)} – ${clock(s.end)}`;
        // the main notes' dan, a hybrid's other one beside it smaller
        const dan = document.createElement('span');
        dan.className = 'tc-dan';
        dan.textContent = this._danParts(s.dan).join(' ').trim(); // a momentary peak: its colour alone (no "↑")
        const second = this._secondText(s.dan);
        if (second) {
          const small = document.createElement('small');
          small.className = 'tc-second';
          small.textContent = second;
          dan.appendChild(small);
        }
        line.append(num, time, dan);
        row.appendChild(line);
        roll.appendChild(row);
        this.rows.push({ row, from: s.from, to: s.to });
      });
      this.current = -2;
      this.liveSec = null;
      this._mark();
    }

    /**
     * the live cells (below) wherever the song is: in a play, and in song select at the preview's time (the
     * user: "가사 대신에"; the list came back in song select and was taken for the lyrics again). The list only
     * when there is no timeline: in a play the section being played lit, up to BEFORE sections before it and
     * AFTER after it in view; otherwise its first rows
     */
    _mark() {
      const timeline = this.result && this.result.key === this._key() ? this.result.timeline : null;
      if (timeline && timeline.length) {
        this.root.classList.add('is-live');
        this.current = -2; // the list is set again when it is shown
        this._tick(timeline);
        return;
      }
      this.root.classList.remove('is-live');
      this.liveSec = null;
      if (!this.rows.length) return;
      const playing = this.state === 'play';
      const at = playing ? this.rows.findIndex((r, i) => this.live < r.to || i === this.rows.length - 1) : -1;
      if (at === this.current) return;
      this.current = at;
      this.rows.forEach((r, i) => {
        r.row.classList.toggle('is-current', i === at);
        r.row.classList.toggle('is-past', at >= 0 && i < at);
        r.row.classList.toggle('is-upcoming', at >= 0 && i > at);
      });
      const c = Math.max(at, 0);
      const top = Math.max(0, c - BEFORE);
      const bottom = Math.min(this.rows.length - 1, c + AFTER);
      this.ui.list.style.setProperty('--tc-top', String(top));
      this.ui.list.style.setProperty('--tc-rows', String(bottom - top + 1));
      this._where(at >= 0 ? `${at + 1} / ${this.rows.length}` : `${this.keys}K · ${this.rows.length} sections`);
    }

    /** the header's right side (the song's name gives way to it) */
    _where(text) {
      const el = this.ui.where;
      if (el.textContent === text) return;
      const wider = el.textContent.length !== text.length;
      el.textContent = text;
      if (wider) this.nameLine.fit();
    }

    /**
     * the predicted dan n s ago, now and n s ahead (secCellSpan, 3 by default; on the map's clock), or now alone
     * (secNowOnly) — sections.js timelineOf: step by step, 0.1 s, as often as tosu sends the time (the user: "1초
     * 간격보다 간격을 더 좁히고 싶은데"), set once a step; a rest or outside the notes "—"
     */
    _tick(timeline) {
      const step = (this.result && this.result.step) || 1000;
      // the cells run secLiveDelay behind the song (on the real clock: × the speed on the map's), as players
      // feel a part once they are in it (testers, 2026-10-30: "싱크가 한 1-2초 빠른 느낌", "1초랑 2초 사이",
      // "1초중반보단 많은듯"; a step's value takes in the 1.5 s on both sides of it)
      const set = Number(this.s.secLiveDelay);
      const delay = Number.isFinite(set) ? Math.max(LIVE_DELAY_MIN, Math.min(LIVE_DELAY_MAX, set)) : TM.SECTION_DEFAULTS.secLiveDelay;
      const lag = delay * 1000 * (Number(this.mods && this.mods.rate) > 0 ? Number(this.mods.rate) : 1);
      const at = Math.floor((this.live - lag) / step);
      if (at === this.liveSec) return;
      this.liveSec = at;
      this._where(clock(this.live));
      const runAt = (t) => {
        let lo = 0;
        let hi = timeline.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (t < timeline[mid].from) hi = mid - 1;
          else if (t >= timeline[mid].to) lo = mid + 1;
          else return timeline[mid];
        }
        return null;
      };
      const span = this._span() * 1000;
      const cells = this._nowOnly() ? [['now', 0]] : [['before', -span], ['now', 0], ['after', span]];
      for (const [which, shift] of cells) {
        const run = runAt(at * step + step / 2 + shift);
        const kind = run && run.dan ? run.kind : 'rest';
        const { root, val, sub, second } = this.ui.live[which];
        root.className = `tc-cell is-${which}${kind ? ` is-${kind}` : ''}`;
        const [name, level] = kind === 'rest' ? ['—', ''] : this._danParts(run.dan);
        val.set(name); // a momentary peak: the cell's colour alone (no "↑")
        sub.set(level);
        second.set(kind === 'rest' ? '' : this._secondText(run.dan));
      }
    }
  }

  TM.SectionPanel = SectionPanel;
})();

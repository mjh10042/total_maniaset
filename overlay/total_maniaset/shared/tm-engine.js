/* total_maniaset — built-in dan engine (no Python, no launcher)
 *
 * JavaScript port of DanOverlay 3.1.0's tosu_source + AnalysisCoordinator +
 * OverlayBridge (by 8doul). Map / mod changes come from the page's tosu v2
 * socket, the .osu is fetched from tosu (/Songs/<folder>/<file>) and analysed
 * by the ported engine in a Web Worker (shared/engine/worker.js). The dan panel
 * receives the payloads DanOverlay's Python side sent to its UI:
 * { type: 'state' | 'map_info' | 'analysis', ... }, plus total_maniaset's
 * { type: 'chart', md5, start, end, points, bpm } (note-density background, BPM line).
 */
(function () {
  'use strict';

  const TM = window.TM;
  const SCRIPT_URL = (document.currentScript && document.currentScript.src) || window.location.href;

  // contracts.STATE_*
  const STATE_WAITING_TOSU = 'waiting_tosu';
  const STATE_IDLE = 'idle';
  const STATE_ANALYZING = 'analyzing';
  const STATE_ERROR = 'error';
  // total_maniaset: key modes other than 4K / 7K are not analysed (no dan scale for them)
  const STATE_DISABLED = 'disabled';

  const DEBOUNCE_MS = 80; // AnalysisCoordinator._DEBOUNCE_S
  const CACHE_LIMIT = 200; // AnalysisCoordinator(cache_size=200)

  /** tosu v2 fields the engine reads (merged into the page's v2 socket filters). */
  TM.ENGINE_V2_FILTERS = [
    'client',
    { field: 'state', keys: ['number'] },
    { field: 'folders', keys: ['songs', 'beatmap'] },
    { field: 'files', keys: ['beatmap', 'background'] },
    {
      field: 'beatmap',
      keys: [
        'checksum', 'artist', 'title', 'version', 'mapper',
        { field: 'time', keys: ['live', 'mp3Length'] },
        { field: 'stats', keys: [{ field: 'stars', keys: ['total'] }, { field: 'cs', keys: ['original'] }] },
      ],
    },
    { field: 'play', keys: [{ field: 'mods', keys: ['number', 'array'] }] },
    { field: 'resultsScreen', keys: [{ field: 'mods', keys: ['array'] }] },
  ];

  // Python round(x, 4) (half-even ties only differ for exact binary ties, which mod speeds never are)
  const round4 = (x) => Number(Number(x).toFixed(4));
  const pyTruthy = (v) => !(v === undefined || v === null || v === false || v === 0 || v === '' || (Array.isArray(v) && !v.length));
  const pyOr = (...xs) => xs.find(pyTruthy) ?? xs[xs.length - 1];

  // MD5 (RFC 1321) of a byte array as lowercase hex — checks that a fetched .osu is the map tosu reports.
  const MD5_K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

  function md5Hex(bytes) {
    const n = bytes.length;
    const blocks = ((n + 8) >>> 6) + 1;
    const buf = new Uint8Array(blocks * 64);
    buf.set(bytes);
    buf[n] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(buf.length - 8, (n << 3) >>> 0, true);
    dv.setUint32(buf.length - 4, Math.floor(n / 0x20000000), true);
    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const M = new Int32Array(16);
    for (let off = 0; off < buf.length; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = dv.getInt32(off + i * 4, true);
      let A = a0;
      let B = b0;
      let C = c0;
      let D = d0;
      for (let i = 0; i < 64; i++) {
        let F;
        let g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
        else { F = C ^ (B | ~D); g = (7 * i) & 15; }
        F = (F + A + MD5_K[i] + M[g]) | 0;
        const s = MD5_S[(i >> 4) * 4 + (i & 3)];
        A = D;
        D = C;
        C = B;
        B = (B + ((F << s) | (F >>> (32 - s)))) | 0;
      }
      a0 = (a0 + A) | 0;
      b0 = (b0 + B) | 0;
      c0 = (c0 + C) | 0;
      d0 = (d0 + D) | 0;
    }
    const out = new DataView(new ArrayBuffer(16));
    [a0, b0, c0, d0].forEach((v, i) => out.setInt32(i * 4, v, true));
    return Array.from(new Uint8Array(out.buffer), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  TM.md5Hex = md5Hex;

  /** ntpath.join as used for full_path / bg_path. */
  function winJoin(...parts) {
    let out = '';
    for (const p of parts) {
      if (!out) out = p;
      else if (/^([\\/]|[A-Za-z]:)/.test(p)) out = p;
      else out += (/[\\/]$/.test(out) ? '' : '\\') + p;
    }
    return out;
  }

  // total_maniaset addition (not in DanOverlay): what the dan panel takes from the .osu itself.
  //  - points: note density for its background graph — notes per second in a window of at least
  //    1 s, sampled at DENSITY_POINTS points from the first to the last note
  //  - bpm: the BPM sections while there are notes (bpmSections)
  // Map time and rate 1 (the panel applies the rate). null for other modes or < 2 notes.
  const DENSITY_POINTS = 160;
  function chartInfo(bytes) {
    let section = '';
    let mode = 0;
    const times = [];
    const timing = []; // [time, bpm] of the uninherited timing points
    for (const text of new TextDecoder('utf-8').decode(bytes).split(/\r?\n/)) {
      const line = text.trim();
      if (line.startsWith('[') && line.endsWith(']')) section = line;
      else if (section === '[General]' && /^Mode\s*:/.test(line)) mode = Number(line.split(':')[1]);
      else if (section === '[TimingPoints]' && line) {
        const p = line.split(',');
        const t = Number(p[0]);
        const beatLength = Number(p[1]);
        const uninherited = p.length > 6 ? p[6].trim() === '1' : true; // old format: all uninherited
        if (uninherited && beatLength > 0 && Number.isFinite(t)) timing.push([t, 60000 / beatLength]);
      } else if (section === '[HitObjects]' && line) {
        const t = Number(line.split(',')[2]);
        if (Number.isFinite(t)) times.push(t);
      }
    }
    if (mode !== 3 || times.length < 2) return null;
    times.sort((a, b) => a - b);
    const start = times[0];
    const end = times[times.length - 1];
    if (!(end > start)) return null;
    const win = Math.max(1000, (end - start) / (DENSITY_POINTS - 1));
    const nps = [];
    let lo = 0;
    let hi = 0;
    for (let k = 0; k < DENSITY_POINTS; k++) {
      const t = start + ((end - start) * k) / (DENSITY_POINTS - 1);
      while (lo < times.length && times[lo] < t - win / 2) lo++;
      while (hi < times.length && times[hi] < t + win / 2) hi++;
      nps.push(((hi - lo) * 1000) / win);
    }
    const last = nps.length - 1;
    const points = nps.map((v, k) => (nps[Math.max(0, k - 1)] + 2 * v + nps[Math.min(last, k + 1)]) / 4); // [1 2 1] smoothing
    return { start, end, points, bpm: bpmSections(timing, start, end) };
  }

  /**
   * The BPM sections while there are notes: each uninherited timing point governs until the next
   * one (the first also before itself), clipped to [first note, last note] → [[from, to, bpm], ...]
   * or null. BPMs to 0.01 (a beat length of 363.6363 is 165, not 164.9999). How they are shown —
   * live tempo, min-max (main) — is the dan panel's business (TM.bpmTimeline in tm-dan.js).
   */
  function bpmSections(timing, start, end) {
    if (!timing.length) return null;
    timing.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (let i = 0; i < timing.length; i++) {
      const from = i === 0 ? start : Math.max(timing[i][0], start);
      const to = i + 1 < timing.length ? Math.min(timing[i + 1][0], end) : end;
      if (to > from) out.push([from, to, Math.round(timing[i][1] * 100) / 100]);
    }
    return out.length ? out : null;
  }
  TM.chartInfo = chartInfo; // for the devtools console / tests

  /** tosu_source._parse_lazer_mods → [mod_speed, mod_label] */
  function parseLazerMods(modsArray) {
    if (!Array.isArray(modsArray)) return [1.0, ''];
    const RATE_MODS = new Set(['NC', 'DT', 'HT', 'DC']);
    for (const modObj of modsArray) {
      if (!modObj || typeof modObj !== 'object' || Array.isArray(modObj)) continue;
      const acronym = String(modObj.acronym ?? '').toUpperCase();
      if (!RATE_MODS.has(acronym)) continue;
      const label = acronym === 'DC' ? 'HT' : acronym;
      const settings = modObj.settings || {};
      const rawSpeed = settings.speed_change;
      if (rawSpeed !== undefined && rawSpeed !== null) {
        // float(raw_speed); TypeError / ValueError → the mod's default rate
        const n = typeof rawSpeed === 'string' && !rawSpeed.trim() ? NaN : Number(rawSpeed);
        let speed = Number.isFinite(n) ? round4(n) : label !== 'HT' ? 1.5 : 0.75;
        speed = label === 'HT' ? Math.max(0.5, Math.min(0.99, speed)) : Math.max(1.01, Math.min(2.0, speed));
        return [speed, label];
      }
      if (label === 'NC') return [1.5, 'NC'];
      if (label === 'DT') return [1.5, 'DT'];
      return [0.75, 'HT'];
    }
    return [1.0, ''];
  }

  /**
   * Built-in engine: TM.localEngine({ onPayload, onStatus }) → { onV2(data), onTosuStatus(up), setEngine(name),
   * set7kModel(name) }
   *   onPayload(p)          DanOverlay bridge payloads (state / map_info / analysis) + chart
   *   onStatus(ok, reason)  engine worker ready (true) or unusable (false, reason)
   */
  TM.localEngine = function ({ onPayload, onStatus }) {
    const emit = (p) => {
      try {
        onPayload(p);
      } catch (err) {
        console.error('[total_maniaset] engine payload', err);
      }
    };

    // ── relay (DanOverlay OverlayBridge) ────────────────────────────────
    let lastState = { type: 'state', state: STATE_WAITING_TOSU, message: 'Waiting for tosu...' };
    let lastMap = null;
    let lastAnalysis = null;
    const setState = (state, message) => {
      lastState = { type: 'state', state, message };
      emit(lastState);
    };

    // ── worker ──────────────────────────────────────────────────────────
    let worker = null;
    let workerReady = false;
    let failure = null; // why the worker can't run (it is not restarted)
    let jobSeq = 0;
    const waiting = new Map(); // job id → resolve
    const fail = (reason) => {
      workerReady = false;
      failure = reason;
      console.error('[total_maniaset] engine unavailable:', reason);
      for (const resolve of waiting.values()) resolve({ ok: false, error: reason });
      waiting.clear();
      onStatus(false, reason);
    };
    try {
      worker = new Worker(new URL('engine/worker.js', SCRIPT_URL), { type: 'module' });
      worker.onmessage = (event) => {
        const m = event.data || {};
        if (m.type === 'ready') {
          workerReady = true;
          onStatus(true);
          // like the Python relay's replay on connect
          for (const p of [lastState, lastMap, lastAnalysis]) if (p) emit(p);
          kick();
        } else if (m.type === 'fatal') {
          fail(m.error || 'engine failed to start');
        } else if (m.type === 'result') {
          const resolve = waiting.get(m.id);
          waiting.delete(m.id);
          if (resolve) resolve(m);
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        fail(event.message || 'engine files could not be loaded');
      };
    } catch (err) {
      setTimeout(() => fail(String((err && err.message) || err)), 0);
    }
    const runJob = (job, bytes) =>
      new Promise((resolve) => {
        if (!worker) {
          resolve({ ok: false, error: 'engine unavailable' });
          return;
        }
        job.id = ++jobSeq;
        waiting.set(job.id, resolve);
        worker.postMessage(Object.assign({ type: 'analyze', bytes }, job), [bytes]);
      });

    // ── coordinator (DanOverlay AnalysisCoordinator) ────────────────────
    // total_maniaset: always DanOverlay's "legacy" engine (= DanOverlay 2.3.5) — 3.1.0's default ISOR
    // engine is left out (too far off on the official courses); 7K / LN Course give the same either way.
    let activeEngine = 'legacy';
    // "4K 계산 엔진": "average" of DanOverlay 2.3.5 and ManiaMapAnalyser (default), "legacy" or "mma"
    // (shared/engine/mma_bridge.js)
    let rcMode = 'average';
    // total_maniaset addition: 7K dan model ("total_maniaset" = calibrated on the official 7K dan
    // courses, "danoverlay" = DanOverlay 3.1.0's mapping) — see shared/engine/tm_7k.js
    let sevenK = 'total_maniaset';
    const cache = new Map(); // insertion order = age (oldest evicted first)
    let seq = 0;
    let currentToken = null;
    let pendingMap = null;
    let pendingToken = '';
    let dispatched = false;
    let debounceTimer = null;
    let busy = false;

    // cache / file identity: the .osu path (stable), or the MD5 when tosu gives no usable path (lazer)
    const mapKey = (mi) => mi.path || `md5:${mi.md5}`;
    const cacheKey = (mi, engine) => JSON.stringify([mapKey(mi), mi.version || '', mi.mod_label, round4(mi.mod_speed), engine, sevenK, rcMode, !!mi.classic]);

    /**
     * The map's .osu bytes: tosu's /Songs/<folder>/<file> (the file DanOverlay reads); if that
     * doesn't work (e.g. osu!lazer's hashed file store), tosu's current beatmap file, accepted
     * only when its MD5 is this map's checksum.
     */
    async function loadOsu(mi) {
      const get = async (url) => {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
        } catch (err) {
          return null;
        }
      };
      if (mi.folder && mi.file) {
        const bytes = await get(`${TM.tosuHttp}/Songs/${encodeURIComponent(mi.folder)}/${encodeURIComponent(mi.file)}`);
        if (bytes) return bytes;
      }
      const bytes = await get(`${TM.tosuHttp}/files/beatmap/file`);
      return bytes && md5Hex(bytes) === String(mi.md5).toLowerCase() ? bytes : null;
    }

    function onMapChanged(mi) {
      const engine = activeEngine;
      const diffVer = mi.version || '';
      const key = cacheKey(mi, engine);
      seq += 1;
      const token = `${mi.md5}|${diffVer}|${seq}`;
      currentToken = token;

      if (mi.keycount !== 4 && mi.keycount !== 7) {
        clearTimeout(debounceTimer);
        pendingMap = null;
        setState(STATE_DISABLED, '4K / 7K only');
        return;
      }
      if (cache.has(key)) {
        lastAnalysis = cache.get(key);
        emit(lastAnalysis);
        return;
      }
      pendingMap = mi;
      pendingToken = token;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(dispatchToWorker, DEBOUNCE_MS);
    }

    function dispatchToWorker() {
      if (pendingMap === null) return;
      if (failure !== null) {
        setState(STATE_ERROR, `Engine error: ${failure}`);
        return;
      }
      setState(STATE_ANALYZING, 'Computing...');
      dispatched = true;
      kick();
    }

    async function kick() {
      if (busy || !dispatched || !workerReady) return;
      dispatched = false;
      const mi = pendingMap;
      const token = pendingToken;
      if (mi === null) return;
      const engine = activeEngine;
      const model7k = sevenK;
      const rc = rcMode;
      const key = cacheKey(mi, engine);
      busy = true;
      try {
        const bytes = await loadOsu(mi);
        if (!bytes) {
          if (currentToken === token) {
            setState(STATE_ERROR, `File not found: ${mi.path}`);
            setState(STATE_ERROR, 'Map file not found');
          }
          return;
        }
        if (currentToken !== token) return; // a newer map is already waiting
        const mod = mi.mod_label || 'NM';
        // the engine tells .osu from other chart files by the extension
        const path = /\.osu$/i.test(mi.path) ? mi.path : `${mapKey(mi).replace(/[:\\/]/g, '_')}.osu`;
        // LN Course: total_maniaset's model (averaged with ManiaMapAnalyser by the worker) unless
        // "4K 계산 엔진" is DanOverlay 2.3.5 alone
        const lnModel = rc === 'legacy' ? 'danoverlay' : 'total_maniaset';
        const r = await runJob({
          path, md5: mi.md5, mod, rate: mi.mod_speed, engine, difficulty: mi.version || '',
          srOfficial: mi.sr_official, modLabel: mi.mod_label, sevenK: model7k, lnModel, rc, classic: !!mi.classic,
        }, bytes.buffer);
        if (currentToken !== token) return; // stale result: dropped, not cached
        if (r.ok) {
          cache.delete(key);
          cache.set(key, r.payload);
          while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
          lastAnalysis = r.payload;
          emit(r.payload);
          TM.log(`analysis ${r.payload.dan_label} ${r.payload.sublevel || ''} (dp ${Number(r.payload.dp || 0).toFixed(2)}, engine ${r.payload.engine}) in ${Math.round(r.ms)} ms`);
        } else {
          setState(STATE_ERROR, r.error || 'Unknown error');
          setState(STATE_ERROR, `Analysis error: ${r.error}`);
        }
      } finally {
        busy = false;
        if (dispatched) kick();
      }
    }

    // ── chart info (total_maniaset addition): per map file, independent of mods / engine ──
    const chartCache = new Map();
    let chartTimer = null;
    function requestChart(mi) {
      clearTimeout(chartTimer);
      const key = mapKey(mi);
      if (chartCache.has(key)) {
        emit(chartCache.get(key));
        return;
      }
      chartTimer = setTimeout(async () => {
        const bytes = await loadOsu(mi);
        if (src.lastMd5 !== mi.md5) return; // another map was selected meanwhile
        const info = bytes ? chartInfo(bytes) : null;
        const p = Object.assign({ type: 'chart', md5: mi.md5 }, info || { start: 0, end: 0, points: [], bpm: null });
        if (info) {
          chartCache.set(key, p);
          while (chartCache.size > CACHE_LIMIT) chartCache.delete(chartCache.keys().next().value);
        }
        emit(p);
      }, DEBOUNCE_MS);
    }

    // ── tosu source (DanOverlay tosu_source._extract_and_emit, on the v2 API) ──
    const src = { lastMd5: '', lastModSpeed: 1.0, lastModLabel: '', lastClassic: null, lazerSpeed: null, lazerLabel: null, lazerClassic: false };

    function onV2(d) {
      const bm = d && d.beatmap;
      if (!bm || !bm.checksum) return;
      const folders = d.folders || {};
      const files = d.files || {};
      const md5 = bm.checksum;
      const songsDir = folders.songs || '';
      const folder = folders.beatmap || '';
      const osuFile = files.beatmap || '';
      const bgFile = files.background || '';
      const fullPath = songsDir ? winJoin(songsDir, folder, osuFile) : '';
      const bgPath = songsDir && folder && bgFile ? winJoin(songsDir, folder, bgFile) : '';

      const isLazer = String(d.client || '').toLowerCase() === 'lazer';
      const play = d.play || {};
      const results = d.resultsScreen || {};
      let modSpeed;
      let modLabel;
      const lazerArray = isLazer ? pyOr((play.mods || {}).array, (results.mods || {}).array) : undefined;
      if (Array.isArray(lazerArray)) {
        [modSpeed, modLabel] = parseLazerMods(lazerArray);
        src.lazerSpeed = modSpeed;
        src.lazerLabel = modLabel;
      } else if (isLazer && src.lazerSpeed !== null) {
        modSpeed = src.lazerSpeed;
        modLabel = src.lazerLabel;
      } else {
        const num = Number((play.mods || {}).number) || 0;
        if (num & 512) [modSpeed, modLabel] = [1.5, 'NC'];
        else if (num & 64) [modSpeed, modLabel] = [1.5, 'DT'];
        else if (num & 256) [modSpeed, modLabel] = [0.75, 'HT'];
        else [modSpeed, modLabel] = [1.0, ''];
      }

      // classic scoring (ManiaMapAnalyser's star density): stable without ScoreV2, lazer with Classic
      // (lazer: the last known mods while tosu sends none, as for the speed above)
      let classic;
      if (!isLazer) classic = !((Number((play.mods || {}).number) || 0) & 536870912);
      else if (Array.isArray(lazerArray)) {
        classic = lazerArray.some((m) => String((m && m.acronym) || '').toUpperCase() === 'CL');
        src.lazerClassic = classic;
      } else classic = src.lazerClassic;

      const stats = bm.stats || {};
      const kc = (stats.cs && stats.cs.original) ?? 4;
      const gameState = (d.state && d.state.number) || 0;
      const time = bm.time || {};
      const currentMs = time.live || 0;
      const rawTotalMs = time.mp3Length || 0;
      const totalMs = modSpeed > 0 ? Math.trunc(rawTotalMs / modSpeed) : rawTotalMs;

      if (md5 !== src.lastMd5 || modSpeed !== src.lastModSpeed || modLabel !== src.lastModLabel || classic !== src.lastClassic) {
        const newMap = md5 !== src.lastMd5;
        const mi = {
          md5,
          path: fullPath,
          folder,
          file: osuFile,
          artist: bm.artist || '',
          title: bm.title || '',
          version: bm.version || '',
          mapper: bm.mapper || '',
          sr_official: Number((stats.stars && stats.stars.total) || 0),
          keycount: Math.trunc(Number(kc)),
          mod_speed: modSpeed,
          mod_label: modLabel,
          bg_path: bgPath,
          music_time_ms: currentMs,
          music_playing: gameState === 2,
          total_time_ms: totalMs,
          game_state: gameState,
          classic,
        };
        src.lastMd5 = md5;
        src.lastModSpeed = modSpeed;
        src.lastModLabel = modLabel;
        src.lastClassic = classic;
        // relay first (map_info), then the coordinator — same subscription order as the Python host
        lastMap = {
          type: 'map_info', artist: mi.artist, title: mi.title, version: mi.version, mapper: mi.mapper,
          sr_official: mi.sr_official, current_ms: mi.music_time_ms, total_ms: mi.total_time_ms,
          game_state: mi.game_state, md5: mi.md5, mod_label: mi.mod_label, bg_data: '', has_bg: !!mi.bg_path, game: 'osu',
        };
        lastAnalysis = null;
        emit(lastMap);
        onMapChanged(mi);
        if (newMap) requestChart(mi);
      }
    }

    function onTosuStatus(connected) {
      if (connected) setState(STATE_IDLE, 'Connected to tosu');
      else setState(STATE_WAITING_TOSU, 'Waiting for tosu...');
    }

    /**
     * "4K 계산 엔진" → rc mode, re-analysing the current map on change: "2.3.5+MMA 평균" → average
     * (also for anything unknown, e.g. an old "ISOR" value), "2.3.5" / "Legacy" → legacy, "MMA" → mma.
     * The DanOverlay engine itself is always "legacy" (= DanOverlay 2.3.5).
     */
    function setEngine(name) {
      const s = String(name || '').toLowerCase();
      const hasMma = s.includes('mma');
      const hasLegacy = s.includes('2.3.5') || s.includes('legacy');
      const rc = hasMma && !hasLegacy ? 'mma' : hasLegacy && !hasMma ? 'legacy' : 'average';
      const changed = rc !== rcMode;
      rcMode = rc;
      if (changed && pendingMap !== null) onMapChanged(pendingMap);
    }

    /** 7K dan model: "total_maniaset" (default) or "DanOverlay"; re-analyses the current map on change. */
    function set7kModel(name) {
      const model = String(name || '').toLowerCase().trim() === 'danoverlay' ? 'danoverlay' : 'total_maniaset';
      const changed = model !== sevenK;
      sevenK = model;
      if (changed && pendingMap !== null) onMapChanged(pendingMap);
    }

    emit(lastState);
    return {
      onV2,
      onTosuStatus,
      setEngine,
      set7kModel,
      /** for the devtools console: TM.instances.engine.status */
      get status() {
        return { ready: workerReady, failure, engine: activeEngine, rc: rcMode, sevenK, busy, cached: cache.size, lastMap, lastAnalysis };
      },
    };
  };
})();

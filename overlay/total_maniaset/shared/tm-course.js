/* total_maniaset — dan course accuracy per song (the top folder's own page, index.html).
 *
 * Only the dan courses mamesosu recognises are measured (the user's list, 2026-10-25), and the official
 * 7K ones (Regular and LN, 2026-10-27; COURSES below); every other map shows nothing. The 4K LN courses
 * are passed with ScoreV2, so they are measured only while ScoreV2 is on; the 7K ones (Regular and LN
 * alike) without it (the user: "단놋 롱놋 둘 다 v2 안쓰고 클리어하는거라"), so in either mode.
 *
 * A dan course is one marathon .osu. Its songs are told apart by the rests between them, since every
 * song brings its own timing: a rest of 2 s or more where a red (uninherited) timing point changes the
 * BPM or moves the beat grid (up to 2 s after the next note, as some makers place it late), with an
 * osu! break over it, or 3.5 s or more without the break. Rests inside a song keep the timing, so they
 * never split it: Joker III's 1.6-3.3 s rests, the 11 s breaks in FINAL ETA's last song and FINAL
 * ZETA's first. A red point that only restates the timing on its grid is no change: TR1PLE DELTA does
 * that around the 12.8 s break in Give It To Dem. Rate-changed courses shrink the rests, hence the low
 * floors: EXTRA-GAMMA 1.2x leaves 3.8 s. A course listed below with more songs than timing changes
 * (Malody Extra-4/5 v3 keep one BPM and timing over their first two songs) takes its longest osu!
 * breaks as the song changes missing.
 * Parts shorter than 30 s are an intro or outro, joined to the neighbouring part across the shorter
 * rest, and a course needs 3 songs or more.
 * Song names: the lists below for the courses without them in their tags, else the map's Tags when they
 * list exactly that many, comma-separated (Joker, Reform); otherwise "Song N".
 *
 * Judgements per song: tosu v2 sends the play's cumulative counts about every 100 ms. They are cut when
 * the song time passes the middle of a rest between two songs, where nothing is judged, so each song's
 * counts and its accuracy (osu!stable, or ScoreV2's with MAX worth 305) are exact. The dashboard
 * preview shows the recommended scales instead.
 */
(function () {
  'use strict';

  const TM = window.TM;
  const MIN_REST_MS = 2000; // shorter pauses belong to the song
  const LONG_REST_MS = 3500; // with a new BPM, a song change even without an osu! break
  const RED_SLACK_MS = 2000; // the next song's red point may sit a little after its first note
  const GRID_MS = 2; // a red point this close to the old beat grid, at the old BPM, restates the timing
  const MIN_SONG_MS = 30000; // shorter parts are a neighbour's intro or outro
  const MIN_SONGS = 3;

  // Song names of the courses whose tags lack them, by difficulty name; their count is the course's
  // song count. The LN courses' come from their Stage 1-4 map packs (in song order: most songs match the
  // split's note counts exactly, the rest differ by chart edits); TR1PLE DAN's and Malody's from the
  // user's lists; the Shoegazer ones from their backgrounds. Rates other than 1.0x and BPM edits are named.
  const LN_SONGS = [
    [/^1st Dan\b/, ['Hitorigoto', 'Dango Daikazoku', 'Nerevar Rising', 'Trickl4sh 220']],
    [/^2nd Dan\b/, ['Doki Doki Literature Club!', 'SPF 420', 'Heartbeats', 'Rockhill']],
    [/^3rd Dan\b/, ['aura', 'silver temple', 'i use raw expectation to unlock placebo.', 'OVERDRIVERS']],
    [/^4th Dan\b/, ['Otenba Koimusume', 'Gee', 'future gazer', '#FairyJoke #SDVX_Edit']],
    [/^5th Dan\b/, ['Pink Gold', 'MilK', 'Promise', 'Blacksphere']],
    [/^6th Dan\b/, ['Koborezu no Negaigoto', 'Power To Progress', 'Mousou Express [Remix]', 'Berry Go!!']],
    [/^7th Dan\b/, ['Rock It', 'On the FM', '<3', 'Tsumibito']],
    [/^8th Dan\b/, ['Missing Banquet', 'Shotgun Senorita [Zardonic Remix]', 'Sakase natsuzora, koi no hana.', 'Owari to Hajimari no Oto']],
    [/^9th Dan\b/, ["Dodger's Gadget", 'Raijin no Hidariude', 'cold planet', 'Ordinary world']],
    [/^10th Dan\b/, ['towa no maigo 1.1x', 'Dopamine', 'Sakura Trip 1.15x', 'Element of SPADA 1.1x']],
    [/\bYoake\b/, ['Enigma 1.1x', 'Avalon no oka', 'Love is War', 'asphyxia 1.05x']],
    [/\bYuugure\b/, ['Carnation [ck remix] 1.05x', 'No. 6', 'ENDYMION', 'infinite synthesis']],
    [/\bYoru\b/, ['Kyouki Ranmai', 'Intersect Thunderbolt -Remix', 'Literal Crystal In The Cyphisonia 1.15x', 'NEURO-CLOUD-9']],
    [/\bYami\b/, ['Mare Nectaris', 'Nhelv 1.05x', 'Indomitable Spirit [Hommarju Remix] 1.5x', 'The lost']],
    [/\bYume\b/, ['Kodoku no Kakurenbo 1.15x', 'Inaiinai isonshou 1.25x', 'White Hair Little Swords Girl 1.025x', 'NUCLEAR-STAR']],
    [/\bYokaze\b/, ['Protoflicker 1.25x', 'Cinderella Cage -Trancecore Mix- 1.6x', 'Lancelot -Flame of the Rebellion- 1.35x', 'R U Still xxxx? 1.15x']],
  ];
  const TRIPLE_SONGS = [
    [/\bALPHA\b/, ['Too Late Snow 1.25x', 'Messier 333', 'Blue Army 1.3x']],
    [/\bBETA\b/, ['KEEP IT UP', 'My Sweet Maiden 1.4x', 'Yura-Yura Sweet Genocide']],
    [/\bGAMMA\b/, ['Dark Avatara Beam 1.3x', 'Samba Land', 'Unorthodox Red 1.3x']],
    [/\bDELTA\b/, ['Bad Elixir 1.15x', 'Candy Crisis!! 1.05x', 'Give It To Dem']],
  ];
  // the Shoegazer courses' background images list their songs left to right; each song's BPM in the
  // course matches its own map (155 / 147 / 260 / 153; 160x1.2 / 191x1.4 / 174x1.2 / 170)
  const SHOEGAZER_SONGS = [
    [/\bLuminal\b/, ['Mario Paint', 'Blue Planet', 'Image Material -VERSION 0-', 'Gengaozo']],
    [/\bTachyon\b/, ['Chambarising 1.2x', 'Cyber Induction 1.4x', 'shadows of cats 1.2x', 'Angel Dust']],
  ];
  // Malody v3 from the user's list: Jack, Tech, Speed, Stream in that order (the course BPMs match the
  // listed rates and BPM edits, e.g. Extra-7 186 / 170x1.25 / 200x1.4)
  const MALODY_SONGS = [
    [/^Regular-0\b/, ['Ikitoshi Ikerumono', 'Rambling Pleat', 'Yi Meng Qian Xiao', 'White Eternity']],
    [/^Regular-1\b/, ['Rex Incognito', 'Koiseyo Otome!', 'Break', 'KING']],
    [/^Regular-2\b/, ['Stargazer', 'Seyana', 'Love Emotion!', 'Mermaid Girl']],
    [/^Regular-3\b/, ['Koi Kou Enishi', 'Onegai! Kon Kon Oinari-sama', 'The Last Page', 'Hoshi ga Furanai Machi']],
    [/^Regular-4\b/, ['Umiyuri Kaiteitan', 'Fire in the sky', 'Icyxis', 'The Crimson Empire 1.1x']],
    [/^Regular-5\b/, ['Platinum Disco', 'Cute na Kanojo', 'Reimei Sketchbook', 'Joker']],
    [/^Regular-6\b/, ['Chocolate Disco', 'Call Me Beep Me (If You Wanna Reap Me)', 'DIE IN THE SEA', 'unhappy century']],
    [/^Regular-7\b/, ["Don't Stop The Music", 'Six Acid Strings', 'Arkadia 1.05x', 'Valkyrie Revolutia']],
    [/^Regular-8\b/, ["Don't let you down", 'Yoru ni Kakeru 1.05x', 'Snow Veil - Shoujo to Kemono no Mori -', 'Positive Dance Time']],
    [/^Regular-9\b/, ['Kikai Shoujo Gensou', 'Cold Planet', 'Stray Star', 'Unleashed World']],
    [/^Regular-10\b/, ['Hiensou', 'Rocky Buinne', 'Yue Ai Yue Ye', 'Spin Eternally']],
    [/^Extra-1\b/, ['Scorpion Dance', 'Tailin no Soul 1.2x', 'Eiya no Parade 1.05x', 'Onsoku Uchuu Ryokou']],
    [/^Extra-2\b/, ['Moments 1.05x', 'Towards the Horizon', 'Torikago 159BPM', 'Frontier Explorer 1.15x']],
    [/^Extra-3\b/, ['Edison 1.15x', 'INTERNET OVERDOSE 1.05x', 'Euthanasia 1.05x', 'Fin.ArcDeaR 243BPM']],
    [/^Extra-4\b/, ['ZENITHALIZE', 'Asymmetrical Grooves 1.05x', 'Pure Ruby', 'EVERLASTING HAPPiNESS 247BPM']],
    [/^Extra-5\b/, ['Bring Our Ignition Back 1.1x', 'Unsan-musho', 'Electric Angel 1.2x', 'Kegare Naki Bara Juuji']],
    [/^Extra-6\b/, ['Defeat awaken battle ship 163BPM', 'Extraction 176BPM', 'Pastel Subliminal', 'Synthesized Fortress']],
    [/^Extra-7\b/, ['LiFE Garden 1.05x', 'Alpha 186BPM', 'Stay Alive (Zekk Remix) 1.25x', "Heaven's Fall 1.4x"]],
    [/^Extra-8\b/, ['Hayabusa', 'Shuu no Hazama 187BPM', 'Amatsukami 1.15x', 'CRIMSON FIGHTER 1.15x']],
    [/^Extra-9\b/, ['crazy_tek (DJ Noriken Remix) 175BPM', 'Nhelv 195BPM', 'Shuuten', 'Deadly force - Put an end 305BPM']],
    [/^Ex-Final\b/, ['Infinity Heaven 180BPM', 'NEURO-CLOUD-9 200BPM', 'Kizuato 1.3x', 'Runengon']],
  ];
  // the official 7K courses (Jinjin): their backgrounds list the songs left to right, in the order of
  // the 7K practice packs (Regular: Jack, Tech, Speed, Stream; LN: General, Tech, Inverse, Release), whose
  // note counts match the split: 116 of 119 exactly, three within 15 notes (no pack has Zenith's Der
  // Wald). The two edits named are the ones the packs label that other maps in Songs confirm
  // (Nibelungen 222 BPM, Lancelot 206 BPM).
  const REGULAR_7K_SONGS = [
    [/^0th Dan\b/, ['anemone', 'Who You Evidently Thought Was Me', 'End Time', 'Yuki wa Doko ni? Kimi no Mune ni!']],
    [/^1st Dan\b/, ['dir', '.357 Magnum', 'Aragami', 'Tsuki -Yue-']],
    [/^2nd Dan\b/, ['East West Wobble', "Schur's Theorem", 'Hesperides', 'Gyspy Tronic']],
    [/^3rd Dan\b/, ['Haryu', 'Electro Peaceful', 'Altale', 'CHEVRON']],
    [/^4th Dan\b/, ['MEGALOVANIA', 'My Son, the Leopard', 'ETERNAL DRAIN', 'electro peaceful (8bit)']],
    [/^5th Dan\b/, ['AciculignosA', 'Passage D', 'Speed of Link', 'Blue Planet']],
    [/^6th Dan\b/, ['Gabberse Town', 'Isometry', '44river', 'Imperishable Night 2006 (2016 Refine)']],
    [/^7th Dan\b/, ['Sudden Romance', 'Rengoku -Purgatorium-', 'Witches Brew', 'Out Of The Blue']],
    [/^8th Dan\b/, ['Overworld', "Bangin' Burst", 'Yozakura', 'Tiny Tales Continue']],
    [/^9th Dan\b/, ['gazer', 'Ubiquity', 'Mario Paint (Time Regression Mix for BMS)', 'The Solace of Oblivion']],
    [/^10th Dan\b/, ['SAMBA LAND', 'Toki (maidable remix)', 'Blue-White Crazystars', 'Fox4-Raize-']],
    [/^Gamma Dan\b/, ['Identity Part 4', 'EGOISM 440', 'Vertex GAMMA', 'Paraclete']],
    [/^Azimuth Dan\b/, ['TENSHI (True Final Boss)', 'najimi breakers', 'Nijuu', 'Finixe']],
    [/^Zenith Dan\b/, ['Icicle Stinger', 'Rinjuu', 'Der Wald', 'We Want To Run']],
    [/^Stellium Dan \(Regular\)/, ['EXILE', 'Wanderflux', 'P8107', 'Triumphal Return']],
  ];
  // Emik's "Dan ~ REFORM ~ SAMPLE Pack 4": the two marathons the user showed (2026-10-28: "샘플중에서 얘내들만
  // 추가해줄 수 있을까?"), with the songs and rates they gave, but Nhelv's by the course's BPM (199.03 = Songs'
  // 174.59 x 1.14; the user: "1.14배가 맞다면 1.2말고 1.14로 해줘"). Three charts there share the version
  // "~ EXTRA-EPSILON ~ (Marathon)" (their file names differ by leading spaces), so a chart is told by its Tags,
  // which name its songs in order before the maker's credit; the other two (Break, …; Rose Quartz, …) are not
  // measured.
  const SAMPLE4_SONGS = [
    [/^Vertex Beta,/, ['Vertex Beta', 'Weird Autumn 1.4x', 'Finixe 1.1x', 'Angel Dust']],
    [/^Log-IN,/, ['Log-IN 1.3x', 'Nhelv 1.14x', 'Cyber Inductance 1.1x', 'Speed of Link 1.25x']],
  ];
  // [Crz]Player's Haku dan from the user's list (2026-10-30; stages Jack, Stamina, Speed, Technical). The
  // course BPMs match the rates against the maps in Songs: Senkou o furea 258 x 1.25, Credens justitiam
  // 136 x 1.1, northern_limit 270 x 1.1 (Double Universe's map is not there: 216 BPM in the course). Its
  // x0.9 and x0.95 copies show the same names (their version says the rate)
  const HAKU_SONGS = [[/^New World\b/, ['Double Universe 1.2x', 'Senkou o furea 1.25x', 'Credens Justitiam 1.1x', 'northern_limit 1.1x']]];
  const LN_7K_SONGS = [
    [/^0th Dan\b/, ['Crayon Tulip', 'lit(var)', 'Reimu-instrumental-', 'if -Hitori Omou-']],
    [/^1st Dan\b/, ['Mawaru Sora Usagi', 'The First Layer', 'Portamento', 'Dango Daikazoku Mix Piano']],
    [/^2nd Dan\b/, ['Mr. Darling', 'Take It to the Limit', 'Yumeoi', 'HARAJUKU IYAHOI']],
    [/^3rd Dan\b/, ['athletic meet of sound toy', 'Panic Holic', 'XROSS INFECTION', '12:30']],
    [/^4th Dan\b/, ['Doku Ryuu no Kobura', 'The Limbo', 'Be Happy', 'Main Theme']],
    [/^5th Dan\b/, ['Chocolate Disco', 'Oath Nova Apocalypse', 'SAVIOR OF SONG', 'inside']],
    [/^6th Dan\b/, ['Lune', "'Trockne Blumen' Variation 5", 'Chiisana Boukensha', 'in flight (zygani Remix)']],
    [/^7th Dan\b/, ['YES or YES', 'Towards the Horizon', 'brave heart', 'Rockhill']],
    [/^8th Dan\b/, ['Imprinting', 'Sailing Force', 'Heart', 'Romancing Layer']],
    [/^9th Dan\b/, ['New Gravity', 'Enigma', 'Hustle Beat!!', 'Onigami']],
    [/^10th Dan\b/, ['SpaceLand*TOYBOX', 'CODE -CRiMSON-', 'attack in the minor key', 'Internet bitch P*light Remix']],
    [/^Gamma Dan\b/, ['quaver', 'Hellfire', 'Pure Ruby', 'Schrodinger no neko']],
    [/^Azimuth Dan\b/, ['JOMANDA', 'Big Brother', 'licca', 'Zettai Reido']],
    [/^Zenith Dan\b/, ['Redshift', 'Dement ~After Legend~', 'Black Lotus', 'Alexandrite']],
    [/^Stellium Dan \(LN\)/, ['Decoy', 'Unleashed World', 'Nibelungen 240BPM', 'Lancelot ~Flame of the Rebellion~ 1.05x']],
  ];

  // The dan courses mamesosu recognises (the user's list, 2026-10-25), told by mapper and mapset title,
  // so rate-changed copies of them count too. Pass lines there: LN 97% with ScoreV2, TR1PLE DAN and
  // the two Shoegazer courses (the only ones of that set in use) 96%, Malody (v3 only) Regular 95% and
  // Extra 96%. Then the official 7K courses: Regular / LN Dan Phase I-III and Dan Phase IV (Stellium,
  // both kinds in one mapset). Then the user's own picks: of the REFORM samples, SAMPLE Pack 4's EXTRA-EPSILON
  // (one of its three) and EXTRA-ZETA (an entry's `version` limits it to some of a mapset's difficulties;
  // `byTags` picks the song list by the Tags; `listedOnly` measures only the charts with a list); and
  // [Crz]Player's Haku dan.
  const COURSES = [
    { creator: /^\[Crz\]Rachel&(Ice V|Jhown)$/, title: /^Chordjack Joker Dan$/ },
    { creator: /^DDMythical$/, title: /^Dan ~ REFORM ~ (1st Pack v2|2nd Pack)$/ },
    { creator: /^\[GB\]Thaumiel$/, title: /^Dan ~ REFORM ~ FINAL$/ },
    { creator: /^_underjoy$/, title: /^4K LN Dan Courses v2 - (Level [123]|Extra Level|FINAL) -$/, scoreV2: true, songs: LN_SONGS },
    { creator: /^hypersovae$/, title: /^4K LN Dan Courses v3 - Extra Level -$/, scoreV2: true, songs: LN_SONGS },
    { creator: /^wonder5193$/, title: /^TR1PLE DAN$/, songs: TRIPLE_SONGS },
    { creator: /^Pikapikapikapi$/, title: /^4K Luminal v2$/, songs: SHOEGAZER_SONGS },
    { creator: /^chicken Little$/, title: /^4K Tachyon v3$/, songs: SHOEGAZER_SONGS },
    { creator: /^Muses$/, title: /^Malody 4K Regular Dans v3 \(Part\.[12]\)$/, songs: MALODY_SONGS },
    { creator: /^\[GS\]hina$/, title: /^Malody 4K Extra Dan v3 \(Pack [12]\)$/, songs: MALODY_SONGS },
    { creator: /^Jinjin$/, title: /^Regular Dan Phase (I|II|III)$/, songs: REGULAR_7K_SONGS },
    { creator: /^Jinjin$/, title: /^LN Dan Phase (I|II|III)$/, songs: LN_7K_SONGS },
    { creator: /^Jinjin$/, title: /^Dan Phase IV$/, songs: REGULAR_7K_SONGS.concat(LN_7K_SONGS) },
    // only its EXTRA-EPSILON (Log-IN, …) and EXTRA-ZETA marathons, told by their Tags (SAMPLE4_SONGS)
    { creator: /^Emik(03)?$/, title: /^Dan ~ REFORM ~ SAMPLE Pack 4$/, version: /EXTRA-(EPSILON|ZETA)/, songs: SAMPLE4_SONGS, byTags: true, listedOnly: true },
    { creator: /^\[Crz\]Player$/, title: /^Haku dan$/, songs: HAKU_SONGS },
  ];
  const GRADES = ['geki', '300', 'katu', '100', '50', '0']; // MA PR GR GD BD MS
  const COLOR_KEYS = ['hcColor300g', 'hcColor300', 'hcColor200', 'hcColor100', 'hcColor50', 'hcColor0'];

  // the hitcount's labels and colours (the same settings), so both read alike
  TM.COURSE_DEFAULTS = {
    hcLabels: 'MA,PR,GR,GD,BD,MS,UR',
    hcColor300g: '#bfeaff',
    hcColor300: '#ffd54a',
    hcColor200: '#4ee07a',
    hcColor100: '#4f8dff',
    hcColor50: '#c77dff',
    hcColor0: '#ff4d5e',
  };

  const HITS = { field: 'hits', keys: GRADES };
  TM.COURSE_V2_FILTERS = [
    'client',
    { field: 'state', keys: ['name'] },
    { field: 'play', keys: [HITS, { field: 'mods', keys: ['name', 'array'] }] },
    { field: 'beatmap', keys: ['checksum', 'version', { field: 'mode', keys: ['name'] }, { field: 'time', keys: ['live'] }] },
    { field: 'resultsScreen', keys: [HITS] },
  ];

  /** What the split needs from a .osu: { notes, reds, breaks, meta: { title, creator, version, tags } }, or null without notes */
  function readChart(text) {
    const lines = String(text || '').split(/\r?\n/);
    let section = '';
    const notes = [];
    const reds = []; // [time, beat length]
    const breaks = [];
    const meta = { title: '', creator: '', version: '', tags: '' };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      const head = line.match(/^\[(.+)\]$/);
      if (head) {
        section = head[1];
        continue;
      }
      if (section === 'Metadata') {
        const m = line.match(/^(Title|Creator|Version|Tags):(.*)$/);
        if (m) meta[m[1].toLowerCase()] = m[2].trim();
      } else if (section === 'Events' && /^(2|Break),/.test(line)) {
        const p = line.split(',');
        breaks.push([Number(p[1]), Number(p[2])]);
      } else if (section === 'TimingPoints') {
        const p = line.split(',');
        const beat = Number(p[1]);
        const uninherited = p.length > 6 ? p[6].trim() === '1' : beat > 0;
        if (uninherited && beat > 0) reds.push([Number(p[0]), beat]);
      } else if (section === 'HitObjects') {
        const p = line.split(',');
        const t = Number(p[2]);
        if (!Number.isFinite(t)) continue;
        const end = Number(p[3]) & 128 ? Number(String(p[5]).split(':')[0]) : t;
        notes.push([t, Number.isFinite(end) ? Math.max(t, end) : t]);
      }
    }
    if (!notes.length) return null;
    notes.sort((a, b) => a[0] - b[0]);
    reds.sort((a, b) => a[0] - b[0]);
    return { notes, reds, breaks, meta };
  }

  /**
   * A chart's songs: { songs: [{ start, end, notes }], mids: song-change times, names, meta }, or null when
   * it is not a course. want: the number of songs the course is known to have (0: unknown); some makers
   * keep one BPM and timing over two songs (Malody Extra-4/5 v3), and the longest osu! breaks without a
   * timing change then make up the song changes missing.
   */
  function splitSongs(chart, want) {
    const { notes, reds, breaks, meta } = chart;
    const timingAt = (x) => {
      // the red point in force at time x (some maps have one on every beat)
      let lo = 0;
      let hi = reds.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (reds[mid][0] <= x) lo = mid + 1;
        else hi = mid;
      }
      return lo ? reds[lo - 1] : null;
    };
    /** a new timing between a rest's start and its next note: another BPM, or the beat grid moved */
    const newTiming = (from, to) => {
      const after = timingAt(to + RED_SLACK_MS);
      if (!after || after[0] <= from) return false;
      const before = timingAt(from);
      if (!before || Math.abs(after[1] - before[1]) > 1e-6) return true;
      const dt = after[0] - before[0];
      return Math.abs(dt - Math.round(dt / before[1]) * before[1]) > GRID_MS;
    };

    // the rests: { i: the note after it, gap, red: a new timing in it, brk: an osu! break over it }
    const rests = [];
    const runEnd = []; // the latest note end up to each note
    let lastEnd = notes[0][1];
    notes.forEach(([t, end], i) => {
      const gap = t - lastEnd;
      if (i && gap >= MIN_REST_MS) {
        const brk = breaks.some(([a, b]) => a < t && b > lastEnd);
        rests.push({ i, gap, red: newTiming(lastEnd, t), brk });
      }
      lastEnd = Math.max(lastEnd, end);
      runEnd[i] = lastEnd;
    });
    let cuts = rests.filter((r) => r.red && (r.brk || r.gap >= LONG_REST_MS));
    if (want > cuts.length + 1) {
      const spare = rests.filter((r) => r.brk && !cuts.includes(r)).sort((a, b) => b.gap - a.gap);
      cuts = cuts.concat(spare.slice(0, want - 1 - cuts.length)).sort((a, b) => a.i - b.i);
    }

    // the songs between the cuts, as [first note, last note]; a part under 30 s joins its neighbour
    const partsOf = (list) => list.map((c, k) => [k ? list[k - 1].i : 0, c.i - 1]).concat([[list.length ? list[list.length - 1].i : 0, notes.length - 1]]);
    let parts = partsOf(cuts);
    for (;;) {
      const k = parts.findIndex(([a, b]) => runEnd[b] - notes[a][0] < MIN_SONG_MS);
      if (k < 0 || !cuts.length) break;
      const before = cuts[k - 1];
      const after = cuts[k];
      const drop = !before ? after : !after ? before : before.gap <= after.gap ? before : after;
      cuts = cuts.filter((c) => c !== drop);
      parts = partsOf(cuts);
    }
    if (parts.length < MIN_SONGS) return null;

    const songs = parts.map(([a, b]) => ({ start: notes[a][0], end: runEnd[b], notes: b - a + 1 }));
    const mids = songs.slice(1).map((s, i) => (songs[i].end + s.start) / 2);
    const tagNames = meta.tags.includes(',') ? meta.tags.split(',').map((x) => x.trim()).filter(Boolean) : [];
    const names = tagNames.length === songs.length ? tagNames : songs.map((_, i) => `Song ${i + 1}`);
    return { songs, mids, names, meta };
  }

  /** A .osu of a recognised course → its songs with their names and whether it needs ScoreV2, or null */
  function loadCourse(text) {
    const chart = readChart(text);
    if (!chart) return null;
    const { creator, title, version, tags } = chart.meta;
    const entry = COURSES.find((c) => c.creator.test(creator) && c.title.test(title) && (!c.version || c.version.test(version)));
    if (!entry) return null;
    const listed = entry.songs && entry.songs.find(([re]) => re.test(entry.byTags ? tags : version));
    if (entry.listedOnly && !listed) return null;
    const course = splitSongs(chart, listed ? listed[1].length : 0);
    if (!course) return null;
    const names = listed && listed[1].length === course.songs.length ? listed[1] : course.names;
    return Object.assign(course, { names, scoreV2: Boolean(entry.scoreV2) });
  }
  TM.loadCourse = loadCourse;
  /** any marathon .osu, recognised or not (devtools / tests) */
  TM.parseCourse = (text) => {
    const chart = readChart(text);
    return chart && splitSongs(chart, 0);
  };

  const songAt = (course, live) => course.mids.filter((m) => live >= m).length;
  const countsOf = (hits) => (hits ? GRADES.map((k) => Number(hits[k]) || 0) : null);
  const minus = (a, b) => a.map((v, i) => v - b[i]);
  const sum = (c) => c.reduce((s, v) => s + v, 0);
  /** accuracy (%) as the hitcount: osu!stable counts MAX as 300, ScoreV2 as 305 */
  const accuracy = (c, scoreV2) => {
    const top = scoreV2 ? 305 : 300;
    return ((top * c[0] + 300 * c[1] + 200 * c[2] + 100 * c[3] + 50 * c[4]) / (top * sum(c))) * 100;
  };

  class CoursePanel {
    constructor(mount) {
      this.s = Object.assign({}, TM.COURSE_DEFAULTS);
      let inDashboard = false;
      try {
        inDashboard = window.self !== window.top && window.top.location.pathname === '/';
      } catch (err) {
        inDashboard = false; // in-game overlay / another origin
      }
      this.root = document.createElement('section');
      this.root.className = 'tm-course is-empty';
      this.root.classList.toggle('show-idle', inDashboard || TM.isStandalonePreview);
      this.root.innerHTML = `
        <div class="tc-idle">
          <span class="tc-idle-name">judgement</span><span>scale 0.5 추천</span>
          <span class="tc-idle-name">hitcount</span><span>scale 0.7 추천</span>
          <span class="tc-idle-name">dan</span><span>0.9 크기로 들어감 (설정의 크기 배율)</span>
        </div>
        <div class="tc-main">
          <div class="tc-head"><span class="tc-name"></span><span class="tc-where"></span></div>
          <div class="tc-list"></div>
        </div>`;
      mount.appendChild(this.root);
      this.ui = { name: this.root.querySelector('.tc-name'), where: this.root.querySelector('.tc-where'), list: this.root.querySelector('.tc-list') };
      this.nameLine = TM.marquee(this.ui.name); // the course's name and its songs' move when too long (TM.marquee)
      this.md5 = null;
      this.course = null;
      this.rows = [];
      this.track = null; // the play being split: { md5, snaps, idx, last, total, live, final, scoreV2 }
      this.state = '';
      this.client = '';
      this.scoreV2 = false; // the play in progress scores with ScoreV2
    }

    applySettings(settings) {
      for (const key of Object.keys(TM.COURSE_DEFAULTS)) if (key in settings) this.s[key] = settings[key];
      if (this.course) this._build();
    }

    onV2(d) {
      const st = (d.state && d.state.name) || '';
      const bm = d.beatmap || {};
      if (bm.checksum && bm.checksum !== this.md5) {
        this.md5 = bm.checksum;
        this.version = String(bm.version || '');
        this.course = null;
        this._build();
        if (!bm.mode || bm.mode.name === 'mania') this._load(this.md5);
      }
      if (d.client !== undefined) this.client = d.client;
      if (st === 'play') {
        this.scoreV2 = TM.usesScoreV2(this.client, d.play && d.play.mods);
        this._tick(d);
      } else if (st === 'resultScreen' && this.state === 'play' && this.track && this.track.md5 === this.md5) {
        const c = countsOf(d.resultsScreen && d.resultsScreen.hits);
        if (c && sum(c) >= this.track.total) this.track.last = c; // the play's final counts
        this.track.final = true;
      }
      this.state = st;
      this._render();
    }

    async _load(md5) {
      try {
        const res = await fetch(`${TM.tosuHttp}/files/beatmap/file`, { cache: 'no-store' });
        if (!res.ok || this.md5 !== md5) return;
        const course = loadCourse(await res.text());
        if (this.md5 !== md5) return;
        this.course = course;
        this._build();
        this._render();
      } catch (err) {
        // no map file: nothing to show
      }
    }

    /** every tosu update during play: cut the cumulative counts when the song time passes a song change */
    _tick(d) {
      if (this.course && this.course.scoreV2 && !this.scoreV2) {
        this.track = null; // a course passed with ScoreV2: not measured without it
        return;
      }
      const c = countsOf(d.play && d.play.hits);
      if (!c) return;
      const total = sum(c);
      const live = Number(d.beatmap && d.beatmap.time && d.beatmap.time.live);
      let t = this.track;
      const back = t && Number.isFinite(live) && t.live !== null && live < t.live - 300;
      if (!t || t.md5 !== this.md5 || t.final || total < t.total || back) {
        t = this.track = { md5: this.md5, snaps: [], idx: -1, last: null, total: 0, live: null, final: false, scoreV2: this.scoreV2 };
      }
      if (this.course && Number.isFinite(live)) {
        const idx = songAt(this.course, live);
        if (t.idx < 0) {
          // the play from its start; a page opened mid-play cannot split the songs played so far
          for (let k = 0; k <= idx; k++) t.snaps[k] = total === 0 ? c : null;
          t.idx = idx;
        }
        while (t.idx < idx) {
          t.idx += 1;
          t.snaps[t.idx] = c;
        }
      }
      t.last = c;
      t.total = total;
      if (Number.isFinite(live)) t.live = live;
    }

    /** the song list for the current course */
    _build() {
      const list = this.ui.list;
      list.textContent = '';
      this.rows = [];
      this.root.classList.toggle('is-empty', !this.course);
      if (!this.course) return;
      this.nameLine.set(this.version);
      const labels = String(this.s.hcLabels || '').split(',').map((x) => x.trim());
      this.course.names.forEach((name, i) => {
        const row = document.createElement('div');
        row.className = 'tc-song is-upcoming';
        const line = document.createElement('div');
        line.className = 'tc-line';
        const num = document.createElement('span');
        num.className = 'tc-num';
        num.textContent = String(i + 1);
        const title = document.createElement('span');
        title.className = 'tc-title';
        const titleLine = TM.marquee(title);
        titleLine.set(name);
        const acc = document.createElement('span');
        acc.className = 'tc-acc';
        line.append(num, title, acc);
        const hits = document.createElement('div');
        hits.className = 'tc-hits';
        const values = GRADES.map((_, g) => {
          const cell = document.createElement('span');
          const label = document.createElement('b');
          label.textContent = labels[g] || ['MA', 'PR', 'GR', 'GD', 'BD', 'MS'][g];
          label.style.color = this.s[COLOR_KEYS[g]] || '';
          const value = document.createElement('i');
          cell.append(label, value);
          hits.appendChild(cell);
          return value;
        });
        row.append(line, hits);
        list.appendChild(row);
        this.rows.push({ row, acc, values, key: '', titleLine });
      });
      this._fitNames();
    }

    /** the names moved or not for the room they have now (in the page, the accuracy beside each title) */
    _fitNames() {
      this.nameLine.fit();
      for (const r of this.rows) r.titleLine.fit();
    }

    _render() {
      const course = this.course;
      if (!course) return;
      const t = this.track && this.track.md5 === this.md5 ? this.track : null;
      const playing = this.state === 'play' && t && t.idx >= 0;
      const n = course.songs.length;
      let where;
      if (course.scoreV2 && this.state === 'play' && !this.scoreV2) where = 'V2 only';
      else if (playing && !t.final) where = `${Math.min(t.idx, n - 1) + 1} / ${n}`;
      else where = course.scoreV2 ? `${n} songs · V2` : `${n} songs`;
      if (where !== this.ui.where.textContent) {
        const wider = where.length !== this.ui.where.textContent.length;
        this.ui.where.textContent = where;
        if (wider) this.nameLine.fit(); // the course's name has that much less or more room
      }
      this.rows.forEach((r, i) => {
        let status = 'is-upcoming';
        let c = null;
        if (t && t.idx >= 0 && i <= t.idx) {
          const a = t.snaps[i];
          const b = i < t.idx ? t.snaps[i + 1] : t.last;
          status = i < t.idx || t.final ? 'is-done' : 'is-current';
          if (a && b) c = minus(b, a);
          else status += ' is-unknown';
        }
        const key = `${status}|${c ? c.join(',') : ''}`;
        if (key === r.key) return;
        r.key = key;
        r.row.className = `tc-song ${status}`;
        const judged = c ? sum(c) : 0;
        const accText = c && judged ? `${accuracy(c, t.scoreV2).toFixed(2)}%` : status.includes('is-unknown') ? '?' : '';
        const wider = accText.length !== r.acc.textContent.length;
        r.acc.textContent = accText;
        if (wider) r.titleLine.fit(); // the title has that much less or more room beside it
        r.values.forEach((v, g) => {
          v.textContent = c ? String(c[g]) : '';
        });
      });
    }
  }

  TM.CoursePanel = CoursePanel;
})();

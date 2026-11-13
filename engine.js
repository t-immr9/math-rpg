/* ============================================================
 * engine.js — 数学RPG ゲーム本体(コースに依存しない部分)
 *   1. 乱数            2. 答えの値と判定     3. 数式の表示(マークアップ → HTML)
 *   4. ダンジョン生成   5. 強さ・レベルの計算 6. 記録のことば
 *   7. ドット絵データ   8. ブラウザ部(描画・入力・戦闘・セーブ・音)
 * コース(courses/*.js)は MathRPG.registerCourse({...}) で登録する。
 * 1〜7 は Node でも動き、tests/check.js から検査する。
 * ============================================================ */
(function (root) {
'use strict';
const M = { version: 1, courses: {} };
M.registerCourse = function (c) { M.courses[c.id] = c; return c; };

/* ===== 1. 乱数(種から同じ並びを作れる) ===== */
function makeRng(seed) {
  let a = seed >>> 0;
  function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next: next,
    int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
    chance: function (p) { return next() < p; },
    shuffle: function (arr) {
      const b = arr.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
      return b;
    }
  };
}

/* ===== 2. 答えの値と判定 =====
 * 答えは「-2√3/3」「5π/6」「7」「<」のような文字列で表す。
 *   分子・分母それぞれ  [-][整数][√整数][π]  の形。分母は / のあとに書く。 */
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
const SYMS = { '+': '+', '-': '-', '<': '<', '>': '>' };
function squareFree(n) { for (let f = 2; f * f <= n; f++) if (n % (f * f) === 0) return false; return true; }
function parsePart(s, signOk) {
  const m = /^(-?)(\d*)(?:√(\d+))?(π?)$/.exec(s);
  if (!m || s === '' || s === '-') return null;
  if (m[1] && !signOk) return null;
  if (m[2] === '' && m[3] === undefined && m[4] === '') return null;
  return { neg: !!m[1], digits: m[2], coef: m[2] === '' ? 1 : parseInt(m[2], 10), hasRad: m[3] !== undefined,
    radDigits: m[3] || '', rad: m[3] === undefined ? 1 : parseInt(m[3], 10), pi: m[4] ? 1 : 0 };
}
function partSimple(p) {
  if (p.digits.length > 1 && p.digits[0] === '0') return false;
  if ((p.hasRad || p.pi) && (p.digits === '1' || p.digits === '0')) return false;
  if (p.hasRad && (p.rad < 2 || p.radDigits[0] === '0' || !squareFree(p.rad))) return false;
  return true;
}
/* 文字列 → { key: 値を表す正規形, simple: 最も簡単な形か, num: 小数値 }。書き方が不正なら null */
function parseValue(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  if (SYMS[raw]) return { sym: raw, key: 'sym' + raw, simple: true, num: NaN };
  const parts = raw.split('/');
  if (parts.length > 2) return null;
  const a = parsePart(parts[0], true), b = parts.length === 2 ? parsePart(parts[1], false) : null;
  if (!a || (parts.length === 2 && !b)) return null;
  let n = (a.neg ? -1 : 1) * a.coef, d = 1, rad = a.rad, pi = a.pi;
  if (b) { if (b.coef === 0 || b.rad === 0) return null; d = b.coef * b.rad; rad *= b.rad; pi -= b.pi; }
  if (rad === 0) n = 0;
  let simple = partSimple(a);
  if (b && (b.hasRad || b.pi || b.coef < 2 || !partSimple(b) || gcd(a.coef, b.coef) !== 1)) simple = false;
  if (n === 0) return { key: '0', simple: raw === '0', num: 0 };
  for (let f = 2; f * f <= rad; f++) while (rad % (f * f) === 0) { rad /= f * f; n *= f; }
  const g = gcd(n, d); n /= g; d /= g;
  return { key: n + '/' + d + 'r' + rad + 'p' + pi, simple: simple, num: n / d * Math.sqrt(rad) * Math.pow(Math.PI, pi) };
}
/* 順不同グループを考えた、空欄の並べかえ一覧 */
function indexPerms(n, groups) {
  let perms = [Array.from({ length: n }, function (_, i) { return i; })];
  (groups || []).forEach(function (g) {
    const orders = []; (function rec(rest, acc) {
      if (!rest.length) { orders.push(acc); return; }
      rest.forEach(function (x, i) { rec(rest.slice(0, i).concat(rest.slice(i + 1)), acc.concat([x])); });
    })(g, []);
    const out = [];
    perms.forEach(function (p) { orders.forEach(function (o) { const q = p.slice(); g.forEach(function (pos, i) { q[pos] = p[o[i]]; }); out.push(q); }); });
    perms = out;
  });
  return perms;
}
function matchKeys(keys, targetKeys, groups) {
  if (keys.length !== targetKeys.length) return false;
  return indexPerms(keys.length, groups).some(function (p) {
    return targetKeys.every(function (t, i) { return t === '*' || t === keys[p[i]]; });
  });
}
function keysOf(strs) { return strs.map(function (s) { if (s === '*') return '*'; const v = parseValue(s); return v ? v.key : null; }); }
/* 判定: correct / unsimplified(値は合っているが約分・有理化がまだ) / wrong(+ mistake) / invalid */
function judge(q, raws) {
  const vals = raws.map(parseValue);
  for (let i = 0; i < vals.length; i++) if (!vals[i]) return { result: 'invalid', index: i };
  const keys = vals.map(function (v) { return v.key; });
  if (matchKeys(keys, keysOf(q.answers), q.unordered)) {
    return { result: vals.every(function (v) { return v.simple; }) ? 'correct' : 'unsimplified' };
  }
  const ms = q.mistakes || [];
  for (let i = 0; i < ms.length; i++) {
    if (matchKeys(keys, keysOf(ms[i].answers), ms[i].unordered || q.unordered)) return { result: 'wrong', mistake: ms[i] };
  }
  return { result: 'wrong' };
}
/* よくある誤答の一覧から、正解と同じ値になるもの・重複・書けないものを取りのぞく */
function cleanMistakes(answers, list, unordered) {
  const ck = keysOf(answers), seen = {}, out = [];
  (list || []).forEach(function (m) {
    if (!m || !m.answers || m.answers.length !== answers.length) return;
    const ks = keysOf(m.answers);
    if (ks.indexOf(null) >= 0) return;
    const full = ks.map(function (k, i) { return k === '*' ? ck[i] : k; });
    if (matchKeys(full, ck, m.unordered || unordered)) return;
    const id = ks.join('|'); if (seen[id]) return; seen[id] = 1;
    out.push(m);
  });
  return out;
}
function fracStr(n, d) {
  if (d === undefined) d = 1;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1; n /= g; d /= g;
  return d === 1 ? String(n) : n + '/' + d;
}
function piStr(n, d) {
  if (d === undefined) d = 1;
  if (d < 0) { n = -n; d = -d; }
  if (n === 0) return '0';
  const g = gcd(n, d); n /= g; d /= g;
  return (n < 0 ? '-' : '') + (Math.abs(n) === 1 ? '' : Math.abs(n)) + 'π' + (d === 1 ? '' : '/' + d);
}

/* ===== 3. 数式の表示 =====
 * マークアップ:  {a/b} 分数   ^2 ^{…} 上付き   _2 _{…} 下付き   √3 √{…} 根号   [3]√8 累乗根
 *               □ 空欄      改行は \n          - は自動で − になる */
function parseMarkup(src) {
  const s = String(src); let i = 0;
  function pushText(out, ch) { const last = out[out.length - 1]; if (last && last.t === 'text') last.v += ch; else out.push({ t: 'text', v: ch }); }
  function group() {
    const a = seq(true); let b = null;
    if (s[i] === '/') { i++; b = seq(true); if (s[i] === '/') throw new Error('分数の / が多すぎます: ' + s); }
    if (s[i] !== '}') throw new Error('} が足りません: ' + s);
    i++;
    return b ? { t: 'frac', n: a, d: b } : { t: 'grp', c: a };
  }
  function atom() {
    if (i >= s.length) throw new Error('^ や _ のあとに何もありません: ' + s);
    if (s[i] === '{') { i++; return [group()]; }
    return [{ t: 'text', v: s[i++] }];
  }
  function rootArg() {
    if (s[i] === '{') { i++; return [group()]; }
    if (s[i] === '□') { i++; return [{ t: 'blank' }]; }
    const m = /^(\d+|[a-zA-Zα-ωπ])/.exec(s.slice(i));
    if (!m) return null;                       // 文章の中の「√ は…」は ただの文字として出す
    i += m[0].length; return [{ t: 'text', v: m[0] }];
  }
  function root(out, idx) { const a = rootArg(); if (a) out.push({ t: 'root', idx: idx, c: a }); else pushText(out, '√'); }
  function seq(inBrace) {
    const out = [];
    while (i < s.length) {
      const c = s[i];
      if (c === '}') { if (inBrace) break; throw new Error('} が多すぎます: ' + s); }
      if (c === '/' && inBrace) break;
      if (c === '{') { i++; out.push(group()); continue; }
      if (c === '^' || c === '_') { i++; out.push({ t: c === '^' ? 'sup' : 'sub', c: atom() }); continue; }
      if (c === '√') { i++; root(out, null); continue; }
      if (c === '[') {
        const m = /^\[([^\]\[{}]{1,3})\]√/.exec(s.slice(i));
        if (m) { i += m[0].length; root(out, m[1]); continue; }
      }
      if (c === '□') { i++; out.push({ t: 'blank' }); continue; }
      if (c === '\n') { i++; out.push({ t: 'br' }); continue; }
      pushText(out, c); i++;
    }
    return out;
  }
  return seq(false);
}
function escH(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escM(t) { return escH(t).replace(/-/g, '−'); }
const ROOT_SVG = '<svg class="ms" viewBox="0 0 10 20" preserveAspectRatio="none"><path d="M0.5 12 L2.5 11 L5.5 19 L9.5 1 L10 1"/></svg>';
function nodesHTML(nodes, ctx) {
  return nodes.map(function (n) {
    switch (n.t) {
      case 'text': return escM(n.v);
      case 'grp': return nodesHTML(n.c, ctx);
      case 'frac': return '<span class="mf"><span class="mn">' + nodesHTML(n.n, ctx) + '</span><span class="md">' + nodesHTML(n.d, ctx) + '</span></span>';
      case 'sup': return '<sup>' + nodesHTML(n.c, ctx) + '</sup>';
      case 'sub': return '<sub>' + nodesHTML(n.c, ctx) + '</sub>';
      case 'root': return '<span class="mr">' + (n.idx ? '<span class="mi">' + escM(n.idx) + '</span>' : '') + ROOT_SVG + '<span class="mb">' + nodesHTML(n.c, ctx) + '</span></span>';
      case 'blank': return '<span class="blank" data-i="' + (ctx.n++) + '"></span>';
      case 'br': return '<br>';
    }
    return '';
  }).join('');
}
function mathHTML(src) { return nodesHTML(parseMarkup(src), { n: 0 }); }
function countBlanks(src) { return (String(src).match(/□/g) || []).length; }
/* 答えの文字列 → マークアップ("-√3/2" → "-{√3/2}") */
function answerMarkup(raw) {
  if (SYMS[raw]) return raw;
  const p = String(raw).split('/');
  if (p.length === 2) { const neg = p[0][0] === '-'; return (neg ? '-' : '') + '{' + (neg ? p[0].slice(1) : p[0]) + '/' + p[1] + '}'; }
  return String(raw);
}
function fillForm(form, answers) { let k = 0; return String(form).replace(/□/g, function () { return answerMarkup(answers[k++]); }); }

/* ===== 4. ダンジョン生成 ===== */
const T = { WALL: 0, FLOOR: 1, NEXT: 2, BACK: 3, CHEST: 4, BOSS: 5, SEAL: 6, HIDDEN: 7, WARP: 8 };
function isSolid(t) { return t === T.WALL || t === T.BOSS || t === T.SEAL; }
function bfs(grid, from) {
  const h = grid.length, w = grid[0].length, dist = grid.map(function (r) { return r.map(function () { return -1; }); });
  const q = [[from.x, from.y]]; dist[from.y][from.x] = 0;
  for (let k = 0; k < q.length; k++) {
    const x = q[k][0], y = q[k][1];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dv) {
      const nx = x + dv[0], ny = y + dv[1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist[ny][nx] >= 0 || isSolid(grid[ny][nx])) return;
      dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]);
    });
  }
  return dist;
}
function tryGenFloor(seed, W, H) {
  const R = makeRng(seed), g = [];
  for (let y = 0; y < H; y++) { g.push([]); for (let x = 0; x < W; x++) g[y].push(T.WALL); }
  const cw = Math.floor(W / 3), ch = Math.floor(H / 3), rooms = [];
  let skipped = 0;
  for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) {
    if (skipped < 3 && R.chance(0.2)) { skipped++; continue; }
    const rw = R.int(4, cw - 2), rh = R.int(3, ch - 2);
    const rx = cx * cw + R.int(1, cw - rw - 1), ry = cy * ch + R.int(1, ch - rh - 1);
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) g[y][x] = T.FLOOR;
    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
  }
  if (rooms.length < 4) return null;
  function corridor(a, b) {
    let x = a.cx, y = a.cy;
    const hFirst = R.chance(0.5);
    function horiz() { while (x !== b.cx) { x += x < b.cx ? 1 : -1; if (g[y][x] === T.WALL) g[y][x] = T.FLOOR; } }
    function vert() { while (y !== b.cy) { y += y < b.cy ? 1 : -1; if (g[y][x] === T.WALL) g[y][x] = T.FLOOR; } }
    if (hFirst) { horiz(); vert(); } else { vert(); horiz(); }
  }
  const order = R.shuffle(rooms), linked = [order[0]];
  for (let i = 1; i < order.length; i++) {
    let best = linked[0], bd = 1e9;
    linked.forEach(function (r) { const d = Math.abs(r.cx - order[i].cx) + Math.abs(r.cy - order[i].cy); if (d < bd) { bd = d; best = r; } });
    corridor(order[i], best); linked.push(order[i]);
  }
  for (let k = R.int(1, 2); k > 0; k--) { const a = R.pick(rooms), b = R.pick(rooms); if (a !== b) corridor(a, b); }
  const startRoom = order[0], start = { x: startRoom.cx, y: startRoom.cy };
  const dist = bfs(g, start);
  let exitRoom = null, far = -1;
  rooms.forEach(function (r) { if (r !== startRoom && dist[r.cy][r.cx] > far) { far = dist[r.cy][r.cx]; exitRoom = r; } });
  if (!exitRoom || far < 0) return null;
  const exit = { x: exitRoom.cx, y: exitRoom.cy };
  g[start.y][start.x] = T.BACK; g[exit.y][exit.x] = T.NEXT;
  const chests = [], others = rooms.filter(function (r) { return r !== startRoom && r !== exitRoom; });
  const nChest = R.int(1, 2), pool = R.shuffle(others.length ? others : rooms);
  for (let k = 0; k < nChest && k < pool.length; k++) {
    const r = pool[k];
    for (let t = 0; t < 20; t++) {
      const x = r.x + R.int(0, r.w - 1), y = r.y + R.int(0, r.h - 1);
      if (g[y][x] === T.FLOOR) { g[y][x] = T.CHEST; chests.push({ x: x, y: y }); break; }
    }
  }
  if (!chests.length) return null;
  const d2 = bfs(g, start);
  if (d2[exit.y][exit.x] < 0 || chests.some(function (c) { return d2[c.y][c.x] < 0; })) return null;
  return { w: W, h: H, grid: g, start: start, exit: exit, chests: chests, steps: d2[exit.y][exit.x] };
}
function genFloor(seed, opt) {
  opt = opt || {};
  for (let k = 0; k < 60; k++) { const f = tryGenFloor((seed + k * 7919) >>> 0, opt.w || 27, opt.h || 21); if (f) return f; }
  throw new Error('ダンジョンを作れませんでした seed=' + seed);
}
function floorSeed(entrySeed, floor) { return (Math.imul(entrySeed | 0, 31) + floor * 1013904223 + 12345) >>> 0; }
/* ボス部屋(毎回同じ形)。H=隠し通路 B=ボス O=帰りの魔法陣 S=もどる階段 */
const BOSS_ROOM = [
  '#############', '######H######', '#####...#####', '###.......###', '###...B...###', '###.......###',
  '###.......###', '###...O...###', '####.....####', '######S######', '#############'];
function bossRoom(o) {
  o = o || {};
  const f = { w: 13, h: 11, grid: [], chests: [], boss: null, hidden: null };
  BOSS_ROOM.forEach(function (row, y) {
    f.grid.push(row.split('').map(function (c, x) {
      if (c === '.') return T.FLOOR;
      if (c === 'S') { f.start = { x: x, y: y }; return T.BACK; }
      if (c === 'B') { f.boss = { x: x, y: y }; return o.bossAlive ? T.BOSS : T.FLOOR; }
      if (c === 'O') { f.warp = { x: x, y: y }; return o.bossAlive ? T.FLOOR : T.WARP; }
      if (c === 'H') { f.hidden = { x: x, y: y }; return o.hasHidden ? (o.hiddenOpen ? T.HIDDEN : T.SEAL) : T.WALL; }
      return T.WALL;
    }));
  });
  f.exit = f.start;
  return f;
}

/* タップ移動の道探し(幅優先探索)。
 *   solid(x,y): 通れないマス   avoid(x,y): 階段など「通り道にはしたくない」マス(行き先としては可)
 *   もどり値 { path: 1歩ずつのマスの列(今いるマスは含まない), goal: 着くマス, adjacent: goal がタップしたマスのとなりか }
 *   タップしたマスに行けないときは、いちばん近い(同じ近さなら歩数が少ない)行けるマスを goal にする。 */
function findPath(w, h, solid, from, to, avoid) {
  const tx = Math.max(0, Math.min(w - 1, to.x)), ty = Math.max(0, Math.min(h - 1, to.y));
  function search(av) {
    const dist = new Int32Array(w * h).fill(-1), prev = new Int32Array(w * h).fill(-1), q = [from.y * w + from.x];
    dist[q[0]] = 0;
    for (let k = 0; k < q.length; k++) {
      const c = q[k], x = c % w, y = (c - x) / w;
      if (k > 0 && av && av(x, y)) continue;                 // さけたいマスには入れるが、そこから先へは進まない
      for (let d = 0; d < 4; d++) {
        const nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || solid(nx, ny)) continue;
        const n = ny * w + nx;
        if (dist[n] < 0) { dist[n] = dist[c] + 1; prev[n] = c; q.push(n); }
      }
    }
    return { dist: dist, prev: prev };
  }
  let r = search(avoid), goal = -1;
  const t = ty * w + tx;
  if (!solid(tx, ty)) {
    if (r.dist[t] >= 0) goal = t;
    else if (avoid) { const r2 = search(null); if (r2.dist[t] >= 0) { r = r2; goal = t; } }
  }
  if (goal < 0) {
    let bm = 1e9, bd = 1e9;
    for (let c = 0; c < w * h; c++) {
      if (r.dist[c] < 0) continue;
      const x = c % w, y = (c - x) / w;
      if (c !== from.y * w + from.x && avoid && avoid(x, y)) continue;
      const m = Math.abs(x - tx) + Math.abs(y - ty);
      if (m < bm || (m === bm && r.dist[c] < bd)) { bm = m; bd = r.dist[c]; goal = c; }
    }
  }
  const path = [];
  for (let c = goal; c !== from.y * w + from.x; c = r.prev[c]) path.unshift({ x: c % w, y: Math.floor(c / w) });
  const gx = goal % w, gy = Math.floor(goal / w);
  return { path: path, goal: { x: gx, y: gy }, adjacent: Math.abs(gx - tx) + Math.abs(gy - ty) === 1 };
}

/* ===== 5. 強さ・レベルの計算 ===== */
const MOVE_MS = 280;   // ★移動の速さ: 1マス歩くのにかかる時間(ミリ秒)。小さくすると速くなる
const JOBS = [
  { id: 'hero', name: '勇者', desc: 'バランスがよい。経験値が すこし多い(+5%)', xp: 1.05 },
  { id: 'warrior', name: '戦士', desc: 'HPが 高い', hp: 1.2 },
  { id: 'priest', name: '僧侶', desc: '戦闘のあとに HPが すこし回復する', regen: 0.1 },
  { id: 'mage', name: '魔法使い', desc: '「ひらめき」を 1回多く使える', hint: 1 },
  { id: 'monk', name: '武闘家', desc: '連続正解(コンボ)の ダメージ上乗せが大きい', combo: 0.15 },
  { id: 'jester', name: '遊び人', desc: 'ゴールドが 多くもらえる。ときどき ふざける', gold: 1.3, jest: true }
];
function jobOf(id) { return JOBS.find(function (j) { return j.id === id; }) || JOBS[0]; }
const rules = {
  needXp: function (lv) { return Math.round(6 + 4 * lv + lv * lv / 2); },            // Lv → Lv+1 に必要な経験値
  baseHp: function (lv) { return 20 + 6 * (lv - 1); },
  maxHp: function (lv, job) { return Math.floor(rules.baseHp(lv) * (jobOf(job).hp || 1)); },
  atk: function (lv) { return 5 + 2 * lv; },
  playerDamage: function (lv, combo, job) { return Math.round(rules.atk(lv) * (1 + Math.min(Math.max(combo - 1, 0), 10) * (jobOf(job).combo || 0.1))); },
  enemyMaxHp: function (E) { return Math.ceil(rules.atk(E.level) * (E.hp || 1)); },
  /* 目安レベルちょうどで不正解3〜4回、5低いと1〜2回で倒れる強さ */
  enemyDamage: function (E, lv) {
    const f = Math.max(0.4, Math.min(3, 1 + 0.12 * (E.level - lv)));
    return Math.max(1, Math.round(rules.baseHp(E.level) / 3.5 * (E.atk || 1) * f));
  },
  xpOf: function (E) { return E.xp || Math.round((4 + 3 * E.level) * (E.hp || 1)); },
  goldOf: function (E) { return E.gold || Math.max(1, Math.round((3 + E.level) * (E.hp || 1))); },
  levelCap: function (course, flags) { const c = course.levelCap || { base: 30 }; return (c.extendFlag && flags[c.extendFlag]) ? c.extended : c.base; }
};
function typeId(ref) { return typeof ref === 'string' ? ref : ref.type; }
/* 問題を1問つくる。ref は 'type-id' または { type:'type-id', opt:{…} } */
function buildQuestion(course, ref, R) {
  const id = typeId(ref), t = course.types[id];
  if (!t) throw new Error('問題の型がありません: ' + id);
  const q = t.gen(R, (typeof ref === 'object' && ref.opt) || {});
  q.type = id;
  q.text = q.text || 'つぎの値を求めよ。';
  q.keys = q.keys || []; q.mistakes = q.mistakes || []; q.explain = q.explain || [];
  return q;
}
function bossIds(course) { return Object.keys(course.enemies).filter(function (id) { return course.enemies[id].boss; }); }

/* ===== 6. 記録のことば(ひらがなの復活用パスワード) ===== */
const PW = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわがぎぐげござじずぜぞだぢづでどばびぶべぼ';
function hashStr(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 4093; return h; }
function pwEncode(course, st) {
  const bits = [], sp = course.titles.special, bosses = bossIds(course);
  function put(v, n) { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); }
  const nm = Array.from(st.name).slice(0, 6);
  put(1, 3); put(nm.length, 3);
  for (let i = 0; i < 6; i++) put(i < nm.length ? Math.max(0, Math.min(255, nm[i].charCodeAt(0) - 0x3040)) : 0, 8);
  put(st.gender ? 1 : 0, 1); put(Math.max(0, JOBS.findIndex(function (j) { return j.id === st.job; })), 3);
  put(st.lv, 6); put(Math.min(st.xp, 16383), 14); put(Math.min(st.gold, 16383), 14);
  put(Math.min(st.items.herb, 63), 6); put(Math.min(st.items.bell, 15), 4);
  let bm = 0; bosses.forEach(function (id, i) { if (st.flags['boss:' + id]) bm |= 1 << i; }); put(bm, 12);
  let tm = 0; sp.forEach(function (t, i) { if (st.titles.indexOf(t.id) >= 0) tm |= 1 << i; }); put(tm, 16);
  put(st.title ? sp.findIndex(function (t) { return t.id === st.title; }) + 1 : 0, 5);
  put(Math.min(st.days.streak, 7), 3); put(Math.min(st.stats.maxCombo, 127), 7);
  while (bits.length % 6) bits.push(0);
  const vals = [];
  for (let i = 0; i < bits.length; i += 6) vals.push(bits.slice(i, i + 6).reduce(function (a, b) { return a * 2 + b; }, 0));
  let sum = hashStr(course.id);
  vals.forEach(function (v, i) { sum = (sum * 31 + v + i) % 4096; });
  vals.push(sum >> 6, sum & 63);
  return vals.map(function (v) { return PW[v]; }).join('');
}
function pwDecode(course, text) {
  const vals = Array.from(String(text)).map(function (c) { return PW.indexOf(c); }).filter(function (v) { return v >= 0; });
  if (vals.length !== 27) return null;
  const body = vals.slice(0, -2);
  let sum = hashStr(course.id);
  body.forEach(function (v, i) { sum = (sum * 31 + v + i) % 4096; });
  if ((sum >> 6) !== vals[25] || (sum & 63) !== vals[26]) return null;
  const bits = []; body.forEach(function (v) { for (let i = 5; i >= 0; i--) bits.push((v >> i) & 1); });
  let p = 0; function get(n) { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + bits[p++]; return v; }
  if (get(3) !== 1) return null;
  const len = get(3); let name = '';
  for (let i = 0; i < 6; i++) { const c = get(8); if (i < len) name += String.fromCharCode(c + 0x3040); }
  const sp = course.titles.special, bosses = bossIds(course), o = { name: name };
  o.gender = get(1); o.job = (JOBS[get(3)] || JOBS[0]).id; o.lv = Math.max(1, get(6)); o.xp = get(14); o.gold = get(14);
  o.herb = get(6); o.bell = get(4);
  const bm = get(12); o.bosses = bosses.filter(function (_, i) { return bm & (1 << i); });
  const tm = get(16); o.titles = sp.filter(function (_, i) { return tm & (1 << i); }).map(function (t) { return t.id; });
  const ti = get(5); o.title = ti && sp[ti - 1] ? sp[ti - 1].id : null;
  o.streak = get(3); o.maxCombo = get(7);
  return o;
}

/* ===== 7. ドット絵データ =====
 * 1文字 = 1ドット。'.' は透明。mirror:true は左半分だけ書いて左右対称にする。 */
const PAL = {
  K: '#0f0f1b', W: '#fcfcfc', G: '#bcbcbc', g: '#7c7c7c', R: '#d82800', r: '#881400', O: '#fc9838', Y: '#f8d820', y: '#ac7c00',
  L: '#58d854', l: '#00a800', d: '#005800', C: '#3cbcfc', B: '#0078f8', b: '#0000bc', P: '#f878f8', p: '#9878f8', V: '#6844fc',
  v: '#44009c', S: '#fcc8a0', s: '#e09050', N: '#a85c10', n: '#503000', T: '#00e8d8', t: '#008888', M: '#e40058', E: '#e8c888', e: '#b89858'
};
function expandSprite(def) {
  const rows = def.rows || def;
  return def.mirror ? rows.map(function (r) { return r + r.split('').reverse().join(''); }) : rows.slice();
}
const TILES = {
  grass: { rows: ['llllllll', 'lLllllll', 'llllldll', 'llllllll', 'llldllll', 'llllllLl', 'ldllllll', 'llllllll'] },
  grass2: { rows: ['LLLLLLLL', 'LLLlLLLL', 'LYLLLLLL', 'LLLLLlLL', 'LLLLLLLL', 'LLlLLLYL', 'LLLLLLLL', 'LlLLLLLL'] },
  road: { rows: ['EEEEEEEE', 'EEEeEEEE', 'EEEEEEEE', 'EeEEEEEE', 'EEEEEEeE', 'EEEEEEEE', 'EEeEEEEE', 'EEEEEEEE'] },
  water: { rows: ['BBBBBBBB', 'BCCBBBBB', 'BBBBBCCB', 'BBBBBBBB', 'BBBCCBBB', 'BBBBBBBB', 'CBBBBBBC', 'BBBBBBBB'] },
  wood: { rows: ['NNNNNNNn', 'NNNNNNNn', 'NNNNNNNn', 'nnnnnnnn', 'NNNnNNNN', 'NNNnNNNN', 'NNNnNNNN', 'nnnnnnnn'] },
  wall_cave: { rows: ['yNNNnNNN', 'NNNNnNNy', 'NNnNNNNn', 'nnNNyNnN', 'NNNnNNNN', 'NyNNnNNN', 'nNNNNNnN', 'NNnnNNNN'] },
  floor_cave: { rows: ['nnnnnnnn', 'nnnnnNnn', 'nnnnnnnn', 'nNnnnnnn', 'nnnnnnnn', 'nnnnNnnn', 'nnnnnnnn', 'nnnnnnnN'] },
  wall_tower: { rows: ['GGGgGGGg', 'GGGgGGGg', 'GGGgGGGg', 'gggggggg', 'GgGGGgGG', 'GgGGGgGG', 'GgGGGgGG', 'gggggggg'] },
  floor_tower: { rows: ['bbbbbbbv', 'bbbbbbbv', 'bbbbbbbv', 'bbbbbbbv', 'bbbbbbbv', 'bbbbbbbv', 'bbbbbbbv', 'vvvvvvvv'] },
  floor_forest: { rows: ['dddddddd', 'ddlddddd', 'dddddddd', 'dddddldd', 'dddddddd', 'dldddddd', 'dddddddd', 'ddddlddd'] },
  wall_castle: { rows: ['VVVvVVVv', 'VVVvVVVv', 'VVVvVVVv', 'vvvvvvvv', 'VvVVVvVV', 'VvVVVvVV', 'VvVVVvVV', 'vvvvvvvv'] },
  floor_castle: { rows: ['rrrrrrrK', 'rrrrrrrK', 'rrrRrrrK', 'rrrrrrrK', 'rrrrrrrK', 'rRrrrrrK', 'rrrrrrrK', 'KKKKKKKK'] },
  tree: { under: 'grass', mirror: true, rows: ['....dddd', '..ddllll', '.dllLlll', 'dllLllll', 'dlllllll', 'dllllLll', 'dlllllll', '.dllllll', '.ddlllll', '...dddll', '......nN', '......nN', '......nN', '.....nnN', '........', '........'] },
  tree_dark: { under: 'floor_forest', mirror: true, rows: ['....KKKK', '..KKdddd', '.KddlddD'.replace('D', 'd'), 'KddldddD'.replace('D', 'd'), 'Kddddddd', 'Kddddldd', 'Kddddddd', '.Kdddddd', '.KKddddd', '...KKKdd', '......nN', '......nN', '......nN', '.....nnN', '........', '........'] },
  mountain: { under: 'grass', mirror: true, rows: ['........', '.......g', '......gW', '......WW', '.....gGW', '....gGGW', '....GGgG', '...gGGGG', '...GGgGG', '..gGGGGg', '..GGGGGG', '.gGGgGGG', '.GGGGGGg', 'gGGGGGGG', 'GGGgGGGG', 'GGGGGGGG'] },
  house: { under: 'grass', mirror: true, rows: ['........', '.......R', '.....RRR', '...RRRRr', '.RRRRrRR', 'RRRrRRRR', 'rrrrrrrr', 'KEEEEEEE', 'KEECCEEE', 'KEECCEEE', 'KEEEEEEE', 'KEEEEEEE', 'KEEEEEEE', 'KEEEEEEE', 'KEEEEEEE', 'KKKKKKKK'] },
  stairs_down: { under: 'floor', mirror: true, rows: ['KKKKKKKK', 'KGGGGGGG', 'Kggggggg', 'KgKKKKKK', 'KgKGGGGG', 'KgKggggg', 'KgKgKKKK', 'KgKgKggg', 'KgKgKgKK', 'KgKgKgKK', 'KgKgKggg', 'KgKgKKKK', 'KgKggggg', 'KgKKKKKK', 'Kggggggg', 'KKKKKKKK'] },
  stairs_up: { under: 'floor', mirror: true, rows: ['........', '......KK', '......KW', '......KG', '....KKKK', '....KWWW', '....KGGG', '..KKKKKK', '..KWWWWW', '..KGGGGG', 'KKKKKKKK', 'KWWWWWWW', 'KGGGGGGG', 'KKKKKKKK', '........', '........'] },
  chest: { under: 'floor', mirror: true, rows: ['........', '........', '........', '..KKKKKK', '.KNNNNNN', 'KNNyyNNN', 'KNNNNNNN', 'KKKKKKKK', 'KNNNNNYY', 'KNNNNNYK', 'KNNNNNYY', 'KNNNNNNN', 'KNNNNNNN', 'KKKKKKKK', '........', '........'] },
  chest_open: { under: 'floor', mirror: true, rows: ['........', '..KKKKKK', '.Knnnnnn', '.Knnnnnn', '.KKKKKKK', 'KKKKKKKK', 'KYYYYYYY', 'KKKKKKKK', 'KNNNNNYY', 'KNNNNNYK', 'KNNNNNYY', 'KNNNNNNN', 'KNNNNNNN', 'KKKKKKKK', '........', '........'] },
  sign: { under: 'grass', mirror: true, rows: ['........', '........', '.KKKKKKK', '.KEEEEEE', '.KEnnnEn', '.KEEEEEE', '.KEnnEnn', '.KEEEEEE', '.KKKKKKK', '......Kn', '......Kn', '......Kn', '......Kn', '.....KKn', '........', '........'] },
  warp: { under: 'floor', mirror: true, rows: ['........', '........', '........', '....CCCC', '..CCTTTT', '.CTTWWWW', '.CTWWTTT', 'CTWWTTCC', 'CTWTTCCW', 'CTWWTTCC', '.CTWWTTT', '.CTTWWWW', '..CCTTTT', '....CCCC', '........', '........'] },
  seal: { mirror: true, rows: ['KKKKKKKK', 'KGGGGGGG', 'KGggggRg', 'KGgggRgg', 'KGggRggg', 'KGgRgggg', 'KGRggggR', 'KGggggRR', 'KGggggRR', 'KGRggggR', 'KGgRgggg', 'KGggRggg', 'KGgggRgg', 'KGggggRg', 'KGGGGGGG', 'KKKKKKKK'] },
  hidden: { mirror: true, rows: ['KKKKKKKK', 'KGGGGGGG', 'KGKKKKKK', 'KGKvvvvv', 'KGKvVVVV', 'KGKvVppp', 'KGKvVppp', 'KGKvVppW', 'KGKvVppW', 'KGKvVppp', 'KGKvVppp', 'KGKvVVVV', 'KGKvvvvv', 'KGKvvvvv', 'KGKvvvvv', 'KGKvvvvv'] },
  i_town: { under: 'grass', mirror: true, rows: ['........', '......RR', '....RRRR', '..RRRRrR', '.RRrRRRR', '.rrrrrrr', '.KEEEEEE', '.KECCEEn', '.KECCEEn', '.KEEEEEn', '.KEEEEnn', '.KEEEEnn', '.KKKKKKK', '........', '........', '........'] },
  i_cave: { under: 'grass', mirror: true, rows: ['........', '........', '.....ggg', '...ggGGG', '..gGGGGG', '.gGGGKKK', '.gGGKKKK', 'gGGKKKKK', 'gGGKKKKK', 'gGKKKKKK', 'gGKKKKKK', 'gGKKKKKK', 'gGKKKKKK', 'gggKKKKK', '........', '........'] },
  i_tower: { under: 'grass', mirror: true, rows: ['.....K.K', '.....KGK', '.....KGG', '.....KGG', '......KG', '......KG', '......KC', '......KC', '......KG', '......KG', '......KG', '.....KGG', '.....KGK', '.....KGK', '....KKKK', '........'] },
  i_forest: { under: 'grass', mirror: true, rows: ['....dddd', '..ddllll', '.dllLlll', 'dllLllll', 'dlllllll', 'dllllLll', 'dlllllll', 'dlllllKK', '.dlllKKK', '.ddllKKK', '...ddKKK', '....nKKK', '....nKKK', '...nnKKK', '........', '........'] },
  i_castle: { under: 'grass', mirror: true, rows: ['........', '.K.K..K.', '.KvK..Kv', '.KvKKKKv', '.KvvvvvV', '.KvVVVVV', '.KvVYVVV', '.KvVVVVV', '.KvVVVKK', '.KvVVKKK', '.KvVVKRR', '.KvVVKRR', '.KvVVKRR', '.KKKKKKK', '........', '........'] }
};
/* 主人公(職業ごと)。h=髪 s=肌 e=目 k=くつ 1,2,3=服の色 w,x=武器 */
const HEROES = {
  hero: { pal: { 1: 'B', 2: 'R', 3: 'Y', w: 'W', x: 'y' }, rows: [
    '................', '.....hhhhhh.....', '....hhhhhhhh....', '....hhsssshh..w.', '....hsessesh..w.', '....hssssssh..w.', '.....ssssss...w.', '...2211111122.w.',
    '..221111111122w.', '..22s111111sxxx.', '..22.111111..x..', '..22.133331.....', '..2..11..11.....', '.....11..11.....', '....kkk..kkk....', '................'] },
  warrior: { pal: { 1: 'g', 2: 'G', 3: 'R', w: 'W', x: 'N' }, rows: [
    '..............w.', '.....222222...w.', '....22222222..w.', '....22ssss22..w.', '....2sesses2..w.', '....hssssssh..w.', '.....ssssss...w.', '...1122222211.w.',
    '..11122222211xxx', '..11s222222s.x..', '.....222222.....', '.....133331.....', '.....11..11.....', '.....11..11.....', '....kkk..kkk....', '................'] },
  priest: { pal: { 1: 'C', 3: 'Y', w: 'W', x: 'N' }, rows: [
    '......1111...3..', '.....111111.3w3.', '....11133111.3..', '....hhsssshh.x..', '....hsessesh.x..', '....hssssssh.x..', '.....ssssss..x..', '....11111111.x..',
    '...1111331111x..', '...1s113311s1x..', '...1111331111x..', '....11133111.x..', '....11111111.x..', '....11111111....', '....kkk..kkk....', '................'] },
  mage: { pal: { 1: 'V', 3: 'Y', w: 'T', x: 'N' }, rows: [
    '.......11.......', '......1111...3..', '.....111111.3w3.', '...1111111111x..', '....hsessesh.x..', '....hssssssh.x..', '.....ssssss..x..', '....11111111.x..',
    '...1111111111x..', '...1s111111s1x..', '...1111111111x..', '....11333311.x..', '....11111111.x..', '....11111111....', '....kkk..kkk....', '................'] },
  monk: { pal: { 1: 'O', 2: 'W', 3: 'R' }, rows: [
    '................', '.....hhhhhh.....', '....hhhhhhhh....', '....33333333333.', '....hsessesh....', '....hssssssh....', '.....ssssss.....', '....11111111....',
    '..s1111221111s..', '..ss11122111ss..', '.....333333.....', '.....111111.....', '.....11..11.....', '.....11..11.....', '....sss..sss....', '................'] },
  jester: { pal: { 1: 'M', 2: 'L', 3: 'Y' }, rows: [
    '...3........3...', '...11......22...', '....111..222....', '....11112222....', '....hsessesh....', '....hssssssh....', '.....ssssss.....', '....11112222....',
    '...1111122222...', '...s11112222s...', '....11112222....', '....22221111....', '.....22..11.....', '.....22..11.....', '....333..333....', '................'] }
};
/* 性別による違い(髪の長さと色) */
function heroRows(job, gender) {
  const rows = (HEROES[job] || HEROES.hero).rows.map(function (r) { return r.split(''); });
  if (gender) for (let y = 4; y <= 9; y++) { [3, 12].forEach(function (x) { if (rows[y][x] === '.') rows[y][x] = 'h'; }); }
  return rows.map(function (r) { return r.join(''); });
}
function heroPal(job, gender) {
  return Object.assign({ h: gender ? 'r' : 'n', s: 'S', e: 'K', k: 'n' }, (HEROES[job] || HEROES.hero).pal);
}
const NPC = { mirror: true, rows: ['........', '.....hhh', '....hhhh', '....hsss', '....hses', '....ssss', '.....sss', '....1111', '...11111', '...s1111', '....1111', '....2222', '.....22.', '.....22.', '....kkk.', '........'] };

M.util = { makeRng: makeRng, gcd: gcd, parseValue: parseValue, judge: judge, mistakes: cleanMistakes, fracStr: fracStr, piStr: piStr,
  parseMarkup: parseMarkup, mathHTML: mathHTML, countBlanks: countBlanks, am: answerMarkup, answerMarkup: answerMarkup, fillForm: fillForm };
M.dungeon = { T: T, isSolid: isSolid, bfs: bfs, genFloor: genFloor, floorSeed: floorSeed, bossRoom: bossRoom };
M.path = { find: findPath }; M.MOVE_MS = MOVE_MS;
M.rules = rules; M.JOBS = JOBS; M.buildQuestion = buildQuestion; M.bossIds = bossIds;
M.password = { encode: pwEncode, decode: pwDecode, alphabet: PW };
M.art = { PAL: PAL, TILES: TILES, HEROES: HEROES, NPC: NPC, expandSprite: expandSprite, heroRows: heroRows, heroPal: heroPal };
M.BASE_LEGEND = {
  '.': { tile: 'grass' }, ',': { tile: 'grass2' }, '=': { tile: 'road' }, 'T': { tile: 'tree', solid: true }, '~': { tile: 'water', solid: true },
  '^': { tile: 'mountain', solid: true }, 'h': { tile: 'house', solid: true }
};
M.newState = function (c) {
  return { v: 1, name: c.name, gender: c.gender ? 1 : 0, job: c.job, lv: 1, xp: 0, hp: rules.maxHp(1, c.job), gold: 20, items: { herb: 3, bell: 0 },
    flags: {}, titles: [], title: null, pos: null, dun: null, combo: 0, review: [],
    stats: { battles: 0, correct: 0, wrong: 0, maxCombo: 0, mistakes: {}, types: {} }, days: { last: '', streak: 0 }, sound: false, dpad: false };
};

/* ===== 8. ブラウザ部 ===== */
const BGM = {
  town: { tempo: 110, lead: 'A4:2 C5:2 F5:4 E5:2 D5:2 C5:4 Bb4:2 D5:2 G5:4 F5:2 E5:2 C5:4 A4:2 C5:2 F5:2 A5:2 G5:3 F5:1 D5:4 C5:2 D5:2 E5:2 G5:2 F5:6 -:2',
    bass: 'F3:4 C3:4 D3:4 A2:4 Bb2:4 G2:4 C3:4 C3:4 F3:4 A2:4 Bb2:4 Bb2:4 C3:4 C3:4 F3:6 -:2' },
  field: { tempo: 132, lead: 'E4:2 G4:2 C5:3 B4:1 A4:2 G4:2 E4:4 F4:2 A4:2 D5:3 C5:1 B4:2 G4:2 D4:4 E4:2 G4:2 C5:2 E5:2 D5:3 C5:1 A4:4 G4:2 A4:1 B4:1 C5:2 D5:2 C5:6 -:2',
    bass: 'C3:4 G3:4 A3:4 E3:4 F3:4 D3:4 G3:4 G2:4 C3:4 E3:4 F3:4 A3:4 G3:4 G2:4 C3:6 -:2' },
  dungeon: { tempo: 96, lead: 'A3:2 C4:2 E4:2 C4:2 B3:2 D4:2 E4:4 A3:2 C4:2 F4:2 E4:2 D4:2 B3:2 C4:4 E4:3 D4:1 C4:2 B3:2 A3:2 C4:2 B3:4 G#3:2 B3:2 D4:2 B3:2 A3:6 -:2',
    bass: 'A2:8 E2:8 F2:8 E2:8 A2:8 G2:8 E2:8 A2:8' },
  battle: { tempo: 168, lead: 'D4:1 D4:1 F4:1 A4:1 D5:2 C5:1 A4:1 Bb4:2 A4:1 G4:1 A4:4 D4:1 D4:1 F4:1 A4:1 D5:2 E5:1 F5:1 E5:2 D5:1 C#5:1 D5:4 F5:2 E5:1 D5:1 C5:2 A4:2 Bb4:2 A4:1 G4:1 F4:4 G4:1 A4:1 Bb4:1 G4:1 A4:2 C#5:2 D5:6 -:2',
    bass: 'D3:2 D3:2 D3:2 D3:2 Bb2:2 Bb2:2 A2:2 A2:2 D3:2 D3:2 D3:2 D3:2 C3:2 C3:2 D3:2 D3:2 F3:2 F3:2 C3:2 C3:2 Bb2:2 Bb2:2 F2:2 F2:2 G2:2 G2:2 A2:2 A2:2 D3:4 D3:2 -:2' },
  boss: { tempo: 150, lead: 'E4:3 E4:1 G4:2 F#4:2 E4:2 B4:2 A4:4 E4:3 E4:1 G4:2 A4:2 B4:2 D5:2 C5:4 B4:1 C5:1 B4:1 A4:1 G4:2 E4:2 F#4:2 D#4:2 E4:4 E5:2 D5:2 C5:2 B4:2 A4:2 F#4:2 D#4:2 B3:2',
    bass: 'E2:2 E3:2 E2:2 E3:2 C3:2 C3:2 D3:2 D3:2 E2:2 E3:2 E2:2 E3:2 A2:2 A2:2 C3:2 C3:2 G2:2 G2:2 E2:2 E2:2 B2:2 B2:2 E2:2 E2:2 C3:2 C3:2 A2:2 A2:2 B2:2 B2:2 B2:2 B2:2' }
};
const SFX = {
  cursor: [[880, 0.04]], ok: [[660, 0.07], [990, 0.12]], ng: [[196, 0.12], [147, 0.2]], hit: [[220, 0.05], [110, 0.08]], hurt: [[130, 0.08], [98, 0.15]],
  encounter: [[330, 0.06], [466, 0.06], [330, 0.06], [466, 0.06], [660, 0.12]], stairs: [[440, 0.05], [330, 0.05], [220, 0.08]],
  chest: [[523, 0.06], [659, 0.06], [784, 0.12]], heal: [[523, 0.08], [784, 0.08], [1047, 0.15]], flee: [[660, 0.05], [440, 0.05], [330, 0.08]],
  win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]], level: [[392, 0.1], [523, 0.1], [659, 0.1], [523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.35]],
  title: [[440, 0.12], [554, 0.12], [659, 0.12], [880, 0.12], [740, 0.12], [880, 0.12], [1109, 0.45]], lose: [[330, 0.2], [262, 0.2], [196, 0.4]]
};
const THEMES = {
  field: { id: 'field', floor: 'grass', wall: 'tree', bg: ['#3cbcfc', '#00a800', '#005800'] },
  cave: { id: 'cave', floor: 'floor_cave', wall: 'wall_cave', down: true, bg: ['#2a1800', '#503000', '#a85c10'] },
  tower: { id: 'tower', floor: 'floor_tower', wall: 'wall_tower', bg: ['#1c1c3c', '#44009c', '#7c7c7c'] },
  forest: { id: 'forest', floor: 'floor_forest', wall: 'tree_dark', bg: ['#002800', '#005800', '#00a800'] },
  castle: { id: 'castle', floor: 'floor_castle', wall: 'wall_castle', bg: ['#1a0030', '#881400', '#44009c'] },
  meikyu: { id: 'meikyu', floor: 'floor_cave', wall: 'wall_cave', down: true, swap: { N: 'p', n: 'v', y: 'P' }, bg: ['#12002a', '#44009c', '#9878f8'] },
  abyss: { id: 'abyss', floor: 'floor_tower', wall: 'wall_tower', swap: { G: 't', g: 'K', b: 'K', v: 't' }, bg: ['#000010', '#0f0f1b', '#008888'] }
};
const JEST = ['{n}は 三角じょうぎで 背中を かいている。', '{n}は コンパスで きれいな円を かいて 満足した。', '{n}は 「サイン、コサイン、しんこきゅう〜」と 歌っている。',
  '{n}は 電卓を さがしている。……ない。', '{n}は ノートのすみに パラパラまんがを かいた。'];
const RANDOM_NAMES = ['ソラ', 'ミナト', 'ハル', 'ユズ', 'カナタ', 'リコ', 'アオイ', 'つむぎ', 'れん', 'ひなた'];
const ITEMS = { herb: { name: 'やくそう', price: 10, desc: 'HPを 最大の半分 回復' }, bell: { name: 'もどりの鈴', price: 25, desc: 'ダンジョンから 町へ もどる' } };

M.start = function (courseId, mount) {
  const course = M.courses[courseId];
  if (!course) { mount.textContent = 'コースが見つかりません: ' + courseId; return; }
  const SAVE_KEY = 'mathrpg:' + course.id;
  const params = new URLSearchParams(location.search), debug = params.get('debug') || '';
  /* 開発用の URL(&debug= &pad= &lv= &job= &g= のどれか)で開いたときは「開発用表示」。
     セーブの読み込みも書き込みも 一切しない(公開ページで使われても 進み具合に影響しない)。 */
  const DEV = ['debug', 'pad', 'lv', 'job', 'g'].some(function (k) { return params.has(k); });
  mount.innerHTML =
    '<div id="hud"><span id="hudl"></span><span id="hudr"><button id="mnu" class="mini">メニュー</button><button id="snd" class="mini">♪オフ</button></span></div>' +
    '<div id="stage"><canvas id="cv" width="240" height="176"></canvas><div id="ename"></div><div id="toast"></div><div id="banner"></div><div id="cutin"></div><div id="fx"></div></div>' +
    '<div id="panel"><div id="msg" class="win"></div><div id="choices"></div></div>' +
    '<div id="pad"><div id="dpad"><i class="u">▲</i><i class="l">◀</i><i class="r">▶</i><i class="d">▼</i></div><div id="ab"><button id="bB">B</button><button id="bA">A</button></div></div>' +
    '<div id="keys"></div><div id="ov"></div>';
  const $ = function (id) { return document.getElementById(id); };
  const cv = $('cv'), msgEl = $('msg'), chEl = $('choices'), ovEl = $('ov'), keysEl = $('keys'), padEl = $('pad'), stageEl = $('stage');
  let ctx = cv.getContext('2d');
  let S = null, mode = 'title', busy = false, modal = null, cur = null, bt = null, stepsLeft = 8;
  const P = { x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0, dir: 'down', moving: false, t: 0 };
  const input = { dir: null, lock: false };
  const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const job = function () { return jobOf(S.job); };
  const maxHp = function () { return rules.maxHp(S.lv, S.job); };

  /* ---------- 音 ---------- */
  let AC = null, soundOn = false, bgmName = null, bgmTimer = null, bgmTracks = null, bgmPos = 0, bgmNext = 0;
  function noteFreq(n) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(n); if (!m) return 0;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (base + (parseInt(m[3], 10) + 1) * 12 - 69) / 12);
  }
  function tone(freq, at, dur, type, vol) {
    if (!AC || !freq) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, at); g.gain.setValueAtTime(vol, at + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(AC.destination); o.start(at); o.stop(at + dur + 0.02);
  }
  function ensureAudio() {
    if (!soundOn) return;
    if (!AC) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; AC = new A(); }
    if (AC.state === 'suspended') AC.resume();
  }
  function sfx(name) {
    if (!soundOn) return; ensureAudio(); if (!AC) return;
    let t = AC.currentTime + 0.01;
    (SFX[name] || []).forEach(function (n) { tone(n[0], t, n[1], 'square', 0.07); t += n[1]; });
  }
  function parseTrack(str) {
    const ev = []; let pos = 0;
    str.split(/\s+/).forEach(function (tok) { const p = tok.split(':'), len = parseInt(p[1], 10); ev.push({ at: pos, len: len, f: noteFreq(p[0]) }); pos += len; });
    return { ev: ev, total: pos };
  }
  function bgmTick() {
    if (!AC || !bgmTracks) return;
    const step = 30 / bgmTracks.tempo;
    while (bgmNext < AC.currentTime + 0.25) {
      const pos = bgmPos % bgmTracks.total;
      bgmTracks.parts.forEach(function (tr, i) {
        tr.ev.forEach(function (e) { if (e.at === pos % tr.total && e.f) tone(e.f, bgmNext, e.len * step * 0.92, i ? 'triangle' : 'square', i ? 0.09 : 0.035); });
      });
      bgmPos++; bgmNext += step;
    }
  }
  function playBgm(name) {
    bgmName = name;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    bgmTracks = null;
    if (!soundOn || !name) return;
    ensureAudio(); if (!AC) return;
    const def = (course.music && course.music[name]) || BGM[name]; if (!def) return;
    const parts = [parseTrack(def.lead), parseTrack(def.bass)];
    bgmTracks = { tempo: def.tempo, parts: parts, total: Math.max(parts[0].total, parts[1].total) };
    bgmPos = 0; bgmNext = AC.currentTime + 0.05;
    bgmTimer = setInterval(bgmTick, 80);
  }
  function setSound(on) {
    soundOn = on; if (S) { S.sound = on; save(); }
    $('snd').textContent = on ? '♪オン' : '♪オフ';
    if (on) { ensureAudio(); playBgm(bgmName); } else playBgm(bgmName);
  }
  $('snd').onclick = function () { setSound(!soundOn); };
  /* 十字キーと A/B ボタンの表示(初期設定はオフ = タップ移動だけ) */
  function setPad(on) { if (S) S.dpad = !!on; mount.classList.toggle('nopad', !on); }
  setPad(false);
  $('mnu').onclick = function () { press('B'); };

  /* ---------- ドット絵 ---------- */
  function makeSprite(def, map) {
    const rows = expandSprite(def), c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach(function (row, y) {
      for (let x = 0; x < row.length; x++) {
        let ch = row[x]; if (map && map[ch] !== undefined) ch = map[ch];
        if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); }
      }
    });
    return c;
  }
  const cache = {};
  function tileCanvas(name, th) {
    const key = 't:' + name + '|' + th.id; if (cache[key]) return cache[key];
    const def = TILES[name] || (course.tiles && course.tiles[name]) || TILES.grass;
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d');
    if (def.under) g.drawImage(tileCanvas(def.under === 'floor' ? th.floor : def.under, th), 0, 0);
    const sp = makeSprite(def, th.swap);
    if (sp.width === 8) { g.drawImage(sp, 0, 0); g.drawImage(sp, 8, 0); g.drawImage(sp, 0, 8); g.drawImage(sp, 8, 8); } else g.drawImage(sp, 0, 0);
    return (cache[key] = c);
  }
  function heroCanvas(jobId, gender) {
    const key = 'h:' + jobId + gender; if (cache[key]) return cache[key];
    return (cache[key] = makeSprite({ rows: heroRows(jobId, gender) }, heroPal(jobId, gender)));
  }
  function npcCanvas(npc) {
    const key = 'n:' + JSON.stringify(npc); if (cache[key]) return cache[key];
    return (cache[key] = makeSprite(NPC, Object.assign({ h: 'n', s: 'S', e: 'K', k: 'n', 1: 'B', 2: 'g' }, npc.pal || {})));
  }
  function enemyCanvas(E, phase2) {
    const sw = phase2 && E.phase2 ? E.phase2.swap : E.swap, key = 'e:' + E.sprite + JSON.stringify(sw || 0); if (cache[key]) return cache[key];
    return (cache[key] = makeSprite(course.sprites[E.sprite], sw));
  }

  /* ---------- セーブ ---------- */
  function save() { if (!S || DEV) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない端末でも遊べるようにする */ } }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d || !d.v) return null;
      const base = M.newState({ name: d.name || 'ゆうしゃ', gender: d.gender, job: d.job || 'hero' });   // 版が上がって項目が増えても消えないよう補う
      const st = Object.assign(base, d);
      st.stats = Object.assign(base.stats, d.stats || {}); st.items = Object.assign({ herb: 0, bell: 0 }, d.items || {});
      st.v = 1; return st;
    } catch (e) { return null; }
  }
  function dayStr(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function touchDays() {
    const now = new Date(), today = dayStr(now), y = new Date(now.getTime() - 86400000);
    if (S.days.last === today) return;
    S.days.streak = S.days.last === dayStr(y) ? S.days.streak + 1 : 1;
    S.days.last = today;
  }
  function hasAll(flags) { return (flags || []).every(function (f) { return S.flags[f]; }); }

  /* ---------- 画面の部品 ---------- */
  function hud() {
    if (!S) { $('hudl').textContent = course.title; return; }
    const mh = maxHp(), low = S.hp <= mh * 0.3;
    $('hudl').innerHTML = escH(S.name) + ' Lv' + S.lv + ' <span class="' + (low ? 'low' : '') + '">HP ' + S.hp + '/' + mh + '</span> ' + S.gold + 'G' +
      (S.combo >= 2 ? ' <span class="cmb">' + S.combo + 'コンボ</span>' : '');
  }
  function setStage(kind) {
    cv.height = kind === 'battle' ? 112 : 176; ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    $('ename').style.display = kind === 'battle' ? 'block' : 'none';
  }
  function toast(text) { const t = $('toast'); t.textContent = text; t.className = ''; void t.offsetWidth; t.className = 'on'; }
  function fx(cls, ms) { const f = $('fx'); f.className = cls; return wait(ms).then(function () { f.className = ''; }); }
  function shake(el, cls, ms) { el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, ms); }
  async function banner(a, b, sound) {
    const el = $('banner'); el.innerHTML = '<div class="b1">' + escH(a) + '</div><div class="b2">' + escH(b) + '</div>';
    el.className = 'on'; sfx(sound); await wait(1500); el.className = '';
  }
  function showMsg(html) { msgEl.classList.remove('done'); msgEl.innerHTML = html; msgEl.scrollTop = 0; }
  /* メッセージを1文字ずつ表示し、A か タップで次へ */
  function say(text) {
    return new Promise(function (res) {
      showMsg('<div class="mt">' + mathHTML(text) + '</div><span class="more">▼</span>');
      const box = msgEl.firstChild, units = [];
      Array.from(box.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          Array.from(n.textContent).forEach(function (chr) { const s = document.createElement('span'); s.textContent = chr; s.style.visibility = 'hidden'; frag.appendChild(s); units.push(s); });
          box.replaceChild(frag, n);
        } else if (n.tagName !== 'BR') { n.style.visibility = 'hidden'; units.push(n); }
      });
      let k = 0, done = false;
      const timer = setInterval(function () { for (let j = 0; j < 2 && k < units.length; j++) units[k++].style.visibility = ''; if (k >= units.length) finish(); }, 22);
      function finish() { clearInterval(timer); units.forEach(function (u) { u.style.visibility = ''; }); done = true; msgEl.classList.add('done'); }
      const go = function () { if (!done) finish(); else { modal = null; msgEl.classList.remove('done'); res(); } };
      modal = { A: go, B: go };
    });
  }
  /* えらぶ。options は文字列の配列。もどり値は番号(キャンセルは -1) */
  function choose(options, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      if (opt.prompt !== undefined) showMsg('<div class="mt">' + mathHTML(opt.prompt) + '</div>');
      if (opt.html !== undefined) showMsg(opt.html);
      const cols = opt.cols || 1; let sel = 0;
      chEl.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
      chEl.innerHTML = options.map(function (l, i) { return '<button class="ch" data-i="' + i + '">' + mathHTML(l) + '</button>'; }).join('');
      const btns = Array.from(chEl.children);
      function hi() { btns.forEach(function (b, i) { b.classList.toggle('sel', i === sel); }); }
      function pick(i) { chEl.innerHTML = ''; chEl.onclick = null; modal = null; sfx('cursor'); res(i); }
      chEl.onclick = function (e) { const b = e.target.closest('.ch'); if (b) pick(parseInt(b.getAttribute('data-i'), 10)); };
      modal = {
        noTap: true,                                   // 文章のタップで うっかり えらばないように
        A: function () { pick(sel); }, B: function () { if (opt.cancel !== false) pick(-1); },
        dir: function (d) {
          const n = options.length; let s = sel;
          if (d === 'left') s--; else if (d === 'right') s++; else if (d === 'up') s -= cols; else s += cols;
          if (s >= 0 && s < n) { sel = s; hi(); sfx('cursor'); }
        }
      };
      hi();
    });
  }
  function ov(html) { ovEl.innerHTML = html; ovEl.className = 'on'; ovEl.scrollTop = 0; }
  function ovClose() { ovEl.className = ''; ovEl.innerHTML = ''; ovEl.onclick = null; }
  function drawTo(canvas, sprite) { const g = canvas.getContext('2d'); g.clearRect(0, 0, canvas.width, canvas.height); g.imageSmoothingEnabled = false; g.drawImage(sprite, 0, 0, canvas.width, canvas.height); }

  /* ---------- 入力 ---------- */
  function press(btn) {
    ensureAudio();
    if (ovEl.className === 'on') return;
    if (modal) { if (modal[btn]) modal[btn](); return; }
    if (busy || mode !== 'map') return;
    if (btn === 'A') interact(); else run(openMenu);
  }
  function dirPress(d) { ensureAudio(); if (modal) { if (modal.dir) modal.dir(d); return; } input.dir = d; }
  function dirRelease() { input.dir = null; input.lock = false; }
  const dpad = $('dpad'); let dheld = null;
  function dpadDir(e) {
    const r = dpad.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    if (Math.abs(x) < 8 && Math.abs(y) < 8) return null;
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
  }
  dpad.addEventListener('pointerdown', function (e) { e.preventDefault(); try { dpad.setPointerCapture(e.pointerId); } catch (x) { /* 古い端末 */ } dheld = dpadDir(e) || 'none'; if (dheld !== 'none') dirPress(dheld); });
  dpad.addEventListener('pointermove', function (e) { if (!dheld) return; const d = dpadDir(e); if (d && d !== dheld) { dheld = d; if (!modal) input.dir = d; } });
  ['pointerup', 'pointercancel'].forEach(function (ev) { dpad.addEventListener(ev, function () { dheld = null; dirRelease(); }); });
  $('bA').addEventListener('pointerdown', function (e) { e.preventDefault(); press('A'); });
  $('bB').addEventListener('pointerdown', function (e) { e.preventDefault(); press('B'); });
  $('panel').addEventListener('click', function (e) { if (e.target.closest('#choices') || e.target.closest('.blank')) return; if (modal && modal.A && !modal.noTap) press('A'); });
  const DIRKEY = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  let kheld = null;
  document.addEventListener('keydown', function (e) {
    if (ovEl.className === 'on') return;
    if (modal && modal.key && modal.key(e)) { e.preventDefault(); return; }
    if (DIRKEY[e.key]) { e.preventDefault(); kheld = e.key; if (!e.repeat || !modal) dirPress(DIRKEY[e.key]); }
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') { e.preventDefault(); if (!e.repeat) press('A'); }
    else if (e.key === 'Escape' || e.key === 'x') { e.preventDefault(); if (!e.repeat) press('B'); }
  });
  document.addEventListener('keyup', function (e) { if (e.key === kheld) { kheld = null; dirRelease(); } });
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  /* ---------- タップ移動 ---------- */
  let route = null, camX = 0, camY = 0;
  const STEP_KINDS = { next: 1, back: 1, warp: 1, hidden: 1 };
  function canAct(c) { return !!c && c.solid && (!!c.event || c.k === 'boss' || c.k === 'seal'); }
  function tapTile(tx, ty) {
    if (mode !== 'map' || !S || !cur || busy || modal) return;
    tx = Math.max(0, Math.min(cur.w - 1, tx)); ty = Math.max(0, Math.min(cur.h - 1, ty));
    const from = P.moving ? { x: P.tx, y: P.ty } : { x: P.x, y: P.y }, cell = cur.cell(tx, ty);
    const r = findPath(cur.w, cur.h,
      function (x, y) { const c = cur.cell(x, y); return !c || !!c.solid; }, from, { x: tx, y: ty },
      function (x, y) { const c = cur.cell(x, y); return !!c && !c.solid && (!!c.event || !!STEP_KINDS[c.k]); });
    const act = canAct(cell) && r.adjacent ? { x: tx, y: ty } : null;
    if (!r.path.length && !act) { route = null; return; }
    route = { path: r.path, act: act, mark: act || r.goal };
    input.dir = null; sfx('cursor');
  }
  function stepRoute() {
    if (route.path.length) {
      const n = route.path[0], c = cur.cell(n.x, n.y), dx = n.x - P.x, dy = n.y - P.y;
      if (!c || c.solid || Math.abs(dx) + Math.abs(dy) !== 1) { route = null; return; }
      route.path.shift();
      tryMove(dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up');
      return;
    }
    const a = route.act; route = null;
    if (a) { P.dir = a.x > P.x ? 'right' : a.x < P.x ? 'left' : a.y > P.y ? 'down' : 'up'; bump(cur.cell(a.x, a.y), a.x, a.y); }
  }
  stageEl.addEventListener('pointerdown', function (e) {
    ensureAudio();
    if (ovEl.className === 'on' || mode !== 'map' || !S || !cur) return;
    if (modal) { if (modal.A && !modal.noTap) { e.preventDefault(); press('A'); } return; }
    const r = cv.getBoundingClientRect();
    tapTile(Math.floor(((e.clientX - r.left) / r.width * cv.width + camX) / 16), Math.floor(((e.clientY - r.top) / r.height * cv.height + camY) / 16));
  });
  function run(fn) {
    route = null;
    if (busy) return; busy = true;
    Promise.resolve().then(fn).catch(function (e) { console.error(e); }).then(function () { busy = false; if (input.dir) input.lock = true; hud(); });
  }

  /* ---------- マップ ---------- */
  function staticMap(id) {
    const m = course.maps[id], legend = Object.assign({}, M.BASE_LEGEND, course.legend || {}, m.legend || {});
    return { id: id, w: m.rows[0].length, h: m.rows.length, theme: THEMES.field, bgm: m.bgm || 'field', bg: THEMES.field.bg,
      cell: function (x, y) { if (y < 0 || y >= this.h || x < 0 || x >= this.w) return null; return legend[m.rows[y][x]] || legend['.']; } };
  }
  function themeOf(d) { return (course.themes && course.themes[d.theme]) || THEMES[d.theme] || THEMES.cave; }
  function dungeonMap() {
    const D = S.dun, d = course.dungeons[D.id], th = themeOf(d), isBoss = D.floor >= d.floors.length;
    const f = isBoss ? bossRoom({ bossAlive: !S.flags['boss:' + d.boss], hasHidden: !!d.hidden, hiddenOpen: !!d.hidden && hasAll(d.hidden.need) })
      : genFloor(floorSeed(D.seed, D.floor));
    const up = !th.down, cells = {};
    cells[T.WALL] = { tile: th.wall, solid: true }; cells[T.FLOOR] = { tile: th.floor };
    cells[T.NEXT] = { tile: up ? 'stairs_up' : 'stairs_down', k: 'next' }; cells[T.BACK] = { tile: up ? 'stairs_down' : 'stairs_up', k: 'back' };
    cells[T.CHEST] = { tile: 'chest', k: 'chest' }; cells[T.BOSS] = { tile: th.floor, solid: true, k: 'boss' };
    cells[T.SEAL] = { tile: 'seal', solid: true, k: 'seal' }; cells[T.HIDDEN] = { tile: 'hidden', k: 'hidden' }; cells[T.WARP] = { tile: 'warp', k: 'warp' };
    const opened = { tile: 'chest_open' };
    return { dun: d, floor: f, isBoss: isBoss, w: f.w, h: f.h, theme: th, bgm: 'dungeon', bg: th.bg,
      cell: function (x, y) {
        if (y < 0 || y >= f.h || x < 0 || x >= f.w) return null;
        const t = f.grid[y][x];
        if (t === T.CHEST && D.opened[D.floor + ':' + x + ',' + y]) return opened;
        return cells[t];
      } };
  }
  function loadMap() {
    if (S.dun) { cur = dungeonMap(); P.x = S.dun.x; P.y = S.dun.y; }
    else { if (!S.pos || !course.maps[S.pos.map]) S.pos = Object.assign({}, course.start); cur = staticMap(S.pos.map); P.x = S.pos.x; P.y = S.pos.y; }
    P.moving = false; P.px = P.x * 16; P.py = P.y * 16; route = null;
    stepsLeft = 4 + Math.floor(Math.random() * 6);
    if (mode === 'map') playBgmFor();
  }
  function playBgmFor() { const b = cur.bgm; if (bgmName !== b || !bgmTracks) playBgm(b); }
  function setPos(x, y) { P.x = x; P.y = y; P.px = x * 16; P.py = y * 16; P.moving = false; if (S.dun) { S.dun.x = x; S.dun.y = y; } else { S.pos.x = x; S.pos.y = y; } }
  const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function tryMove(d) {
    P.dir = d;
    const tx = P.x + DV[d][0], ty = P.y + DV[d][1], cell = cur.cell(tx, ty);
    if (!cell) return;
    if (cell.solid) { bump(cell, tx, ty); return; }
    P.tx = tx; P.ty = ty; P.t = 0; P.moving = true;
  }
  function bump(cell, x, y) {
    if (cell.event) runEvent(cell.event, x, y);
    else if (cell.k === 'boss') run(bossEvent);
    else if (cell.k === 'seal') run(function () { return say('ふしぎな力で かたく とざされている……。'); });
  }
  function interact() { const x = P.x + DV[P.dir][0], y = P.y + DV[P.dir][1], cell = cur.cell(x, y); if (cell && cell.solid) bump(cell, x, y); }
  function updateMap(dt) {
    if (busy || modal) return;
    if (P.moving) {
      P.t += dt / MOVE_MS;
      if (P.t >= 1) { P.moving = false; setPos(P.tx, P.ty); arrive(); }
      else { P.px = (P.x + (P.tx - P.x) * P.t) * 16; P.py = (P.y + (P.ty - P.y) * P.t) * 16; }
    }
    if (P.moving || busy) return;
    if (input.dir && !input.lock) { route = null; tryMove(input.dir); }      // 矢印キー・十字キーが優先
    else if (route) stepRoute();
  }
  function arrive() {
    const cell = cur.cell(P.x, P.y); if (!cell) return;
    if (cell.event) { runEvent(cell.event, P.x, P.y); return; }
    if (S.dun) {
      if (cell.k === 'next') return run(function () { return gotoFloor(S.dun.floor + 1, 'start'); });
      if (cell.k === 'back') return run(backStairs);
      if (cell.k === 'chest') return run(openChest);
      if (cell.k === 'warp') return run(async function () { await say('ひかりに つつまれ、外へ もどった。'); leaveDungeon(); });
      if (cell.k === 'hidden') return run(hiddenPassage);
      if (!cur.isBoss) encounter(cur.dun.floors[S.dun.floor].enemies, 5, 11);
    } else if (cell.zone && course.zones[cell.zone]) encounter(course.zones[cell.zone].enemies, 6, 13);
  }
  function encounter(list, min, max) {
    if (--stepsLeft > 0) return;
    stepsLeft = min + Math.floor(Math.random() * (max - min + 1));
    const eid = list[Math.floor(Math.random() * list.length)];
    run(function () { return battle(eid); });
  }
  function runEvent(ev, x, y) {
    run(async function () {
      if (ev.type === 'dungeon') await enterDungeon(ev.id, { map: S.pos.map, x: x, y: y });
      else if (ev.type === 'map') { sfx('stairs'); S.pos = { map: ev.map, x: ev.x, y: ev.y }; loadMap(); save(); }
      else if (ev.type === 'sign') await say(ev.text);
      else if (ev.type === 'talk') { for (const l of ev.lines) await say(l); }
      else if (ev.type === 'inn') await inn();
      else if (ev.type === 'shop') await shop();
      else if (ev.type === 'church') await church();
    });
  }
  function floorLabel(d, n) { return n >= d.floors.length ? 'ボスの部屋' : (themeOf(d).down ? 'B' + (n + 1) + 'F' : (n + 1) + 'F'); }
  async function enterDungeon(id, ret) {
    const d = course.dungeons[id];
    if (d.need && !hasAll(d.need)) { await say(d.needText || 'いまは まだ 入れないようだ。'); return; }
    await say('【' + d.name + '】\n' + d.unit + '\n目安レベル ' + d.level + '〜' + (d.extra ? '\n※ここから先は 考査範囲外(発展)。挑戦は自分で決めよう。' : ''));
    if (await choose(['はいる', 'やめる'], { cols: 2, prompt: d.name + 'に 入りますか?' }) !== 0) { showMsg(''); return; }
    S.dun = { id: id, floor: 0, seed: Math.floor(Math.random() * 2147483647), opened: {}, ret: ret, x: 0, y: 0 };
    await gotoFloor(0, 'start');
  }
  async function gotoFloor(n, at) {
    sfx('stairs'); await fx('fade', 180);
    S.dun.floor = n; cur = dungeonMap();
    const p = at === 'exit' ? cur.floor.exit : cur.floor.start;
    setPos(p.x, p.y); stepsLeft = 4 + Math.floor(Math.random() * 6); playBgmFor(); save();
    const d = cur.dun; showMsg('');
    toast(d.name + ' ' + floorLabel(d, n) + (cur.isBoss ? '(目安Lv ' + course.enemies[d.boss].level + ')' : ''));
  }
  async function backStairs() {
    if (S.dun.floor > 0) return gotoFloor(S.dun.floor - 1, 'exit');
    if (await choose(['そとに でる', 'やめる'], { cols: 2, prompt: 'ダンジョンの 外に 出ますか?\n(入り直すと 形が 変わります)' }) === 0) leaveDungeon(); else showMsg('');
  }
  function leaveDungeon() { sfx('stairs'); S.pos = Object.assign({}, S.dun.ret || course.start); S.dun = null; loadMap(); showMsg(''); save(); }
  async function openChest() {
    const D = S.dun, d = cur.dun; D.opened[D.floor + ':' + P.x + ',' + P.y] = 1; sfx('chest');
    if ((P.x * 7 + P.y * 13 + D.seed) % 2 === 0) { S.items.herb++; await say('宝箱を あけた! やくそうを 手に入れた!'); }
    else { const g = 8 + d.level * 4; S.gold += g; await say('宝箱を あけた! ' + g + 'ゴールドを 手に入れた!'); }
    save();
  }
  async function hiddenPassage() {
    const h = cur.dun.hidden, d = course.dungeons[h.to];
    await say('【' + d.name + '】\n' + d.unit + '\n目安レベル ' + d.level + '〜' + (d.extra ? '\n※ここから先は 考査範囲外(発展)。挑戦は自分で決めよう。' : ''));
    if (await choose(['すすむ', 'やめる'], { cols: 2, prompt: 'この先へ 進みますか?' }) !== 0) { showMsg(''); return; }
    S.dun = { id: h.to, floor: 0, seed: Math.floor(Math.random() * 2147483647), opened: {}, ret: S.dun.ret, x: 0, y: 0 };
    await gotoFloor(0, 'start');
  }
  function unlockedList() {
    const out = [];
    Object.keys(course.dungeons).forEach(function (id) {
      const d = course.dungeons[id];
      if (d.need && hasAll(d.need)) out.push('d:' + id);
      if (d.hidden && hasAll(d.hidden.need)) out.push('h:' + id);
    });
    return out;
  }
  async function bossEvent() {
    const d = cur.dun, E = course.enemies[d.boss];
    await say(E.name + 'が 待ちかまえている!\n目安レベル ' + E.level + '(いま Lv' + S.lv + ')');
    if (await choose(['たたかう', 'やめる'], { cols: 2, prompt: 'ボスに いどみますか?(にげられない)' }) !== 0) { showMsg(''); return; }
    const before = unlockedList(), r = await battle(d.boss);
    if (r !== 'win') return;
    cur = dungeonMap();
    for (const u of unlockedList()) {
      if (before.indexOf(u) >= 0) continue;
      const dd = course.dungeons[u.slice(2)];
      await say(u[0] === 'd' ? (dd.openText || dd.name + 'への 道が ひらいた!') : (dd.hidden.openText || 'どこかで 隠し通路が ひらいた 気がする……。'));
    }
    await say('部屋の中央に 帰りの魔法陣が あらわれた。');
    save();
  }
  function drawMap(t) {
    const VW = 240, VH = 176, mw = cur.w * 16, mh = cur.h * 16, th = cur.theme;
    let camx = Math.round(P.px + 8 - VW / 2), camy = Math.round(P.py + 8 - VH / 2);
    camx = mw <= VW ? Math.round((mw - VW) / 2) : Math.max(0, Math.min(mw - VW, camx));
    camy = mh <= VH ? Math.round((mh - VH) / 2) : Math.max(0, Math.min(mh - VH, camy));
    camX = camx; camY = camy;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
    for (let ty = Math.floor(camy / 16); ty <= Math.floor((camy + VH - 1) / 16); ty++) {
      for (let tx = Math.floor(camx / 16); tx <= Math.floor((camx + VW - 1) / 16); tx++) {
        const c = cur.cell(tx, ty); if (!c) continue;
        ctx.drawImage(tileCanvas(c.tile, th), tx * 16 - camx, ty * 16 - camy);
        if (c.npc) ctx.drawImage(npcCanvas(c.npc), tx * 16 - camx, ty * 16 - camy - 2);
      }
    }
    if (cur.isBoss && !S.flags['boss:' + cur.dun.boss]) {
      const sp = enemyCanvas(course.enemies[cur.dun.boss]), b = cur.floor.boss;
      ctx.drawImage(sp, b.x * 16 + 8 - sp.width / 2 - camx, b.y * 16 + 16 - sp.height - camy + (Math.floor(t / 500) % 2));
    }
    if (route) {                                   // タップした行き先の印(四すみの かぎ形)
      const mx = route.mark.x * 16 - camx, my = route.mark.y * 16 - camy, o = Math.floor(t / 250) % 2;
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (cn) {
        const x = mx + (cn[0] ? 15 - o : o), y = my + (cn[1] ? 15 - o : o), sx = cn[0] ? -1 : 1, sy = cn[1] ? -1 : 1;
        ctx.fillStyle = '#0f0f1b'; ctx.fillRect(Math.min(x, x + sx * 4) - (sx < 0 ? 0 : 1), y - 1, 6, 3); ctx.fillRect(x - 1, Math.min(y, y + sy * 4) - (sy < 0 ? 0 : 1), 3, 6);
        ctx.fillStyle = '#f8d820'; ctx.fillRect(Math.min(x, x + sx * 3), y, 4, 1); ctx.fillRect(x, Math.min(y, y + sy * 3), 1, 4);
      });
    }
    const bob = P.moving && P.t > 0.5 ? 1 : 0;
    ctx.drawImage(heroCanvas(S.job, S.gender), Math.round(P.px) - camx, Math.round(P.py) - camy - 2 - bob);
  }

  /* ---------- 町の施設・メニュー ---------- */
  async function inn() {
    const price = 4 + S.lv;
    const c = await choose(['とまる(' + price + 'G)', 'すがたを かえる', 'やめる'], { prompt: '宿屋「いらっしゃい。ひとばん ' + price + 'ゴールドだよ。\n職業や見た目を 変えることも できるよ」' });
    if (c === 0) {
      if (S.gold < price) await say('宿屋「おや、お金が 足りないね。……今日は おまけして あげるよ」'); else S.gold -= price;
      await fx('fade', 500); S.hp = maxHp(); sfx('heal'); hud(); await say('ぐっすり 休んで、HPが 全回復した!'); save();
    } else if (c === 1) {
      const r = await createScreen({ name: S.name, gender: S.gender, job: S.job }, true);
      if (r) { S.job = r.job; S.gender = r.gender; S.hp = Math.min(S.hp, maxHp()); save(); await say('すがたを 変えた!(レベルや称号は そのまま)'); }
    }
    showMsg('');
  }
  async function shop() {
    for (;;) {
      const ids = Object.keys(ITEMS);
      const c = await choose(ids.map(function (id) { return ITEMS[id].name + ' ' + ITEMS[id].price + 'G(もっている数 ' + S.items[id] + ')'; }).concat(['やめる']),
        { prompt: '道具屋「なにを 買うかい?」 所持金 ' + S.gold + 'G\nやくそう:HPを 半分回復 / もどりの鈴:ダンジョンから 町へ' });
      if (c < 0 || c >= ids.length) break;
      const it = ITEMS[ids[c]];
      if (S.gold < it.price) { await say('道具屋「お金が 足りないようだね」'); continue; }
      S.gold -= it.price; S.items[ids[c]]++; sfx('chest'); hud(); save();
    }
    showMsg('');
  }
  async function church() {
    const c = await choose(['きろくする(セーブ)', '記録のことばを きく', 'やめる'], { prompt: '教会「ここまでの 旅を 記録しますか?」' });
    if (c === 0) { save(); sfx('heal'); await say('教会「たしかに 記録しました。\n戦いのあとにも 自動で 記録されますよ」'); }
    else if (c === 1) await passwordShow();
    showMsg('');
  }
  function useHerb() { const mh = maxHp(), heal = Math.min(mh - S.hp, Math.ceil(mh / 2)); S.items.herb--; S.hp += heal; sfx('heal'); hud(); return heal; }
  async function itemMenu(inBattle) {
    const c = await choose(['やくそう ×' + S.items.herb, 'もどりの鈴 ×' + S.items.bell, 'やめる'], { prompt: 'どの道具を 使う?' });
    if (c === 0) {
      if (S.items.herb <= 0) await say('やくそうを 持っていない!');
      else if (S.hp >= maxHp()) await say('HPは 満タンだ。');
      else { const h = useHerb(); await say(S.name + 'は やくそうを 使った! HPが ' + h + ' 回復した!'); return 'herb'; }
    } else if (c === 1) {
      if (S.items.bell <= 0) await say('もどりの鈴を 持っていない!');
      else if (inBattle) await say('戦いの最中は 使えない!');
      else if (!S.dun) await say('ダンジョンの中で 使う道具だ。');
      else { S.items.bell--; await say('もどりの鈴を 鳴らした。……町へ もどった!'); S.dun = null; S.pos = Object.assign({}, course.start); loadMap(); save(); return 'bell'; }
    }
    return null;
  }
  async function openMenu() {
    for (;;) {
      const c = await choose(['つよさ・称号', 'どうぐ', '音:' + (soundOn ? 'オン' : 'オフ'), '十字キー:' + (S.dpad ? 'オン' : 'オフ'), '記録のことば', 'とじる'],
        { cols: 2, prompt: 'メニュー\n(歩く:マップをタップ。十字キーを出すこともできる)' });
      if (c === 0) await statusScreen();
      else if (c === 1) { if (await itemMenu(false) === 'bell') break; }
      else if (c === 2) setSound(!soundOn);
      else if (c === 3) { setPad(!S.dpad); save(); }
      else if (c === 4) await passwordShow();
      else break;
    }
    showMsg('');
  }

  /* ---------- 称号 ---------- */
  function levelTitle(lv) { let t = ''; course.titles.level.forEach(function (x) { if (lv >= x.lv) t = x.name; }); return t; }
  function titleName(id) { const t = course.titles.special.find(function (x) { return x.id === id; }); return t ? t.name : ''; }
  async function checkTitles() {
    for (const t of course.titles.special) {
      if (S.titles.indexOf(t.id) >= 0) continue;
      const c = t.cond || {};
      const ok = (c.boss && S.flags['boss:' + c.boss]) || (c.combo && S.stats.maxCombo >= c.combo) || (c.streak && S.days.streak >= c.streak);
      if (!ok) continue;
      S.titles.push(t.id); if (!S.title) S.title = t.id;
      await banner('称号 かくとく!', '『' + t.name + '』', 'title');
      await say('特別称号『' + t.name + '』を 手に入れた!\n(メニューの「つよさ・称号」で 名前の横に 付けられる)');
    }
  }

  /* ---------- 戦闘 ---------- */
  function pickType(b) {
    const list = b.phase === 2 && b.E.phase2 ? b.E.phase2.types : b.E.types;
    const ws = list.map(function (r) {
      const id = typeId(r);
      let w = 1 + 2 * Math.min(2, S.review.filter(function (x) { return x === id; }).length);   // まちがえた型は出やすく
      if (list.length > 1 && id === b.lastType) w *= 0.4;
      return w;
    });
    let x = Math.random() * ws.reduce(function (a, c) { return a + c; }, 0);
    for (let i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function enameUpdate() {
    const pct = Math.max(0, Math.round(bt.hp / bt.max * 100));
    $('ename').innerHTML = '<span>' + escH(bt.name) + '</span>' + (bt.E.boss || bt.max > rules.atk(bt.E.level) ? '<i class="bar"><b style="width:' + pct + '%"></b></i>' : '');
  }
  function qHTML(q, withForm) {
    return '<div class="q"><div class="qt">' + mathHTML(q.text) + '</div>' + (q.expr ? '<div class="qe">' + mathHTML(q.expr) + '</div>' : '') +
      (withForm ? '<div class="qf">' + mathHTML(q.form) + '</div>' : '') + (q.hintShown ? '<div class="qh">💡 ' + mathHTML(q.hint) + '</div>' : '') + '<div class="qn"></div></div>';
  }
  const KEYLABEL = { '-': '−', '⌫': '⌫', '分数': '<span class="mf"><span class="mn">□</span><span class="md">□</span></span>', '+': '＋', '<': '＜', '>': '＞', hint: '💡ヒント', back: 'もどる' };
  function partHTML(s) {
    if (s === '') return '&nbsp;';
    if (s === '+' || s === '<' || s === '>') return KEYLABEL[s];
    if (s[s.length - 1] === '√') return (s.length > 1 ? mathHTML(s.slice(0, -1)) : '') + '<span class="mr">' + ROOT_SVG + '<span class="mb">&nbsp;</span></span>';
    return mathHTML(s);
  }
  /* 答えの入力。もどり値: { judge, raws } / null(もどる) */
  let autoAnswer = null;
  function askAnswer(q, b, prefill) {
    if (autoAnswer) return Promise.resolve(autoAnswer(q));
    return new Promise(function (res) {
      const n = countBlanks(q.form), cells = [];
      for (let i = 0; i < n; i++) cells.push({ num: '', den: null, part: 'num' });
      if (prefill) prefill.forEach(function (raw, i) { const p = raw.split('/'); cells[i].num = p[0]; if (p.length > 1) cells[i].den = p[1]; });
      let act = 0, note = '';
      function raw(c) { return c.den !== null ? c.num + '/' + c.den : c.num; }
      function render() {
        showMsg(qHTML(q, true));
        msgEl.querySelector('.qn').textContent = note;
        Array.from(msgEl.querySelectorAll('.blank')).forEach(function (el, i) {
          const c = cells[i], on = i === act;
          el.className = 'blank' + (on ? ' act' : '');
          if (c.den !== null) {
            const neg = c.num[0] === '-';
            el.innerHTML = (neg ? '−' : '') + '<span class="mf"><span class="mn bp' + (on && c.part === 'num' ? ' cur' : '') + '" data-p="num">' + partHTML(neg ? c.num.slice(1) : c.num) +
              '</span><span class="md bp' + (on && c.part === 'den' ? ' cur' : '') + '" data-p="den">' + partHTML(c.den) + '</span></span>';
          } else el.innerHTML = partHTML(c.num);
        });
      }
      msgEl.onclick = function (e) {
        const bl = e.target.closest('.blank'); if (!bl) return;
        act = parseInt(bl.getAttribute('data-i'), 10);
        const bp = e.target.closest('.bp'); if (bp && cells[act].den !== null) cells[act].part = bp.getAttribute('data-p');
        note = ''; render();
      };
      function finish(v) { msgEl.onclick = null; keysEl.onpointerdown = null; keysEl.className = ''; padEl.style.display = ''; modal = null; res(v); }
      function key(k) {
        const c = cells[act], p = c.part, v = c[p]; note = '';
        if (/^\d$/.test(k)) { if (c.num === '+' || c.num === '<' || c.num === '>') c.num = ''; if (c[p].length < 6 && c[p].slice(-1) !== 'π') c[p] += k; }
        else if (k === '-') { if (p === 'num' && (v === '' || SYMS[v])) c.num = v === '-' ? '' : '-'; }
        else if (k === '√') { if (SYMS[v] && v !== '-') c[p] = '√'; else if (v.indexOf('√') < 0 && v.indexOf('π') < 0 && v.length < 5) c[p] += '√'; }
        else if (k === 'π') { if (v.indexOf('π') < 0 && v.slice(-1) !== '√' && !(SYMS[v] && v !== '-')) c[p] += 'π'; }
        else if (k === '分数') { if (c.den === null) { if (SYMS[c.num] && c.num !== '-') c.num = ''; c.den = ''; c.part = c.num === '' || c.num === '-' ? 'num' : 'den'; } else if (c.den === '') { c.den = null; c.part = 'num'; } }
        else if (k === '+' || k === '<' || k === '>') { c.num = k; c.den = null; c.part = 'num'; }
        else if (k === '⌫') { if (v.length) c[p] = v.slice(0, -1); else if (p === 'den') { c.den = null; c.part = 'num'; } else if (c.den === '') c.den = null; }
        else if (k === 'next') { if (c.den !== null && p === 'num') c.part = 'den'; else { act = (act + 1) % n; } }
        else if (k === 'back') return finish(null);
        else if (k === 'hint') {
          if (q.hintShown) note = 'ヒントは 上に 出ているよ';
          else if (b.hints <= 0) note = 'ひらめきは もう 使えない!';
          else { b.hints--; q.hintShown = true; sfx('chest'); }
        } else if (k === 'ok') {
          for (let i = 0; i < n; i++) {
            const cc = cells[i];
            if (cc.num === '' || cc.num === '-' && cc.den !== null || cc.den === '') { if (cc.num === '-' && cc.den === null) continue; act = i; cc.part = cc.num === '' ? 'num' : 'den'; note = 'あいている ところが あるよ'; return render(); }
          }
          const raws = cells.map(raw), j = judge(q, raws);
          if (j.result === 'invalid') { act = j.index; note = '書き方を たしかめよう(例:2√3、5π、− は先頭)'; return render(); }
          if (j.result === 'unsimplified') { note = '値は 合っている! 約分・有理化して、最も簡単な形に 直そう'; sfx('cursor'); return render(); }
          return finish({ judge: j, raws: raws });
        }
        sfx('cursor'); render();
      }
      const ex = q.keys.slice(0, 4);
      let h = '';
      [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['-', '0', '⌫']].forEach(function (r, i) {
        r.forEach(function (k) { h += '<button class="k" data-k="' + k + '">' + (KEYLABEL[k] || k) + '</button>'; });
        h += ex[i] ? '<button class="k x" data-k="' + escH(ex[i]) + '">' + (KEYLABEL[ex[i]] || ex[i]) + '</button>' : '<span></span>';
      });
      h += '<button class="k f" data-k="hint">' + KEYLABEL.hint + '</button><button class="k f" data-k="back">もどる</button><button class="k ok" data-k="ok">けってい</button>';
      keysEl.innerHTML = h; keysEl.className = 'on'; padEl.style.display = 'none';
      keysEl.onpointerdown = function (e) { const k = e.target.closest('.k'); if (k) { e.preventDefault(); ensureAudio(); key(k.getAttribute('data-k')); } };
      modal = { noTap: true, key: function (e) {
        const k = e.key;
        if (/^\d$/.test(k) || k === '-' || k === '+' || k === '<' || k === '>') key(k);
        else if (k === 'Backspace') key('⌫'); else if (k === 'Enter') key('ok'); else if (k === 'Escape') key('back');
        else if (k === 'Tab' || k === 'ArrowRight' || k === 'ArrowDown') key('next');
        else if (k === '/' && q.keys.indexOf('分数') >= 0) key('分数'); else if ((k === 'r' || k === 's') && q.keys.indexOf('√') >= 0) key('√');
        else if (k === 'p' && q.keys.indexOf('π') >= 0) key('π'); else if (k === 'h') key('hint'); else return false;
        return true;
      } };
      render();
    });
  }
  function showExplain(q) {
    return new Promise(function (res) {
      showMsg('<div class="ex"><div class="exa">こたえ <span class="exf">' + mathHTML(fillForm(q.form, q.answers)) + '</span></div>' +
        q.explain.map(function (l) { return '<div class="exl">' + mathHTML(l) + '</div>'; }).join('') + '</div><span class="more">▼</span>');
      msgEl.classList.add('done');
      const at = Date.now(), go = function () { if (Date.now() - at < 500) return; modal = null; msgEl.classList.remove('done'); res(); };
      modal = { A: go, B: go };
    });
  }
  async function cutin(name, line, sprite) {
    const el = $('cutin');
    el.innerHTML = '<div class="band"><canvas width="' + sprite.width + '" height="' + sprite.height + '"></canvas><div><div class="cn">' + escH(name) + '</div><div class="cl">' + escH(line || '') + '</div></div></div>';
    drawTo(el.querySelector('canvas'), sprite);
    el.className = 'on'; await wait(1900); el.className = '';
  }
  async function enemyAttack(mult) {
    const dmg = Math.max(1, Math.round(rules.enemyDamage(bt.E, S.lv) * mult));
    S.hp = Math.max(0, S.hp - dmg); sfx('hurt'); shake(mount, 'shake', 300); fx('hurt', 250); hud();
    await say(bt.name + 'の こうげき! ' + S.name + 'は ' + dmg + 'の ダメージを うけた!');
    return S.hp <= 0;
  }
  async function battle(eid) {
    const E = course.enemies[eid], boss = !!E.boss;
    bt = { E: E, name: E.name, hp: rules.enemyMaxHp(E), max: rules.enemyMaxHp(E), hints: (boss ? 2 : 1) + (job().hint || 0), turn: 0, phase: 1,
      spr: enemyCanvas(E), blink: 0, gone: false, bg: cur.bg, lastType: null };
    S.stats.battles++;
    playBgm(null); sfx('encounter'); await fx('flash', 450);
    mode = 'battle'; setStage('battle'); enameUpdate(); playBgm(boss ? 'boss' : 'battle');
    if (boss) await cutin(E.name, E.line, bt.spr);
    await say(E.name + 'が あらわれた!');
    let result = null;
    while (!result) {
      bt.turn++;
      const q = buildQuestion(course, pickType(bt), makeRng(Math.floor(Math.random() * 4294967296)));
      bt.lastType = q.type;
      if (job().jest && Math.random() < 0.18) await say(JEST[Math.floor(Math.random() * JEST.length)].replace('{n}', S.name));
      let acted = false;
      while (!acted && !result) {
        const c = await choose(['とく', 'ひらめき(のこり' + bt.hints + ')', 'どうぐ', 'にげる'], { cols: 2, cancel: false, html: qHTML(q, false) });
        if (c === 0) {
          const r = await askAnswer(q, bt);
          if (!r) continue;
          acted = true;
          const st = S.stats.types[q.type] || (S.stats.types[q.type] = [0, 0]);
          if (r.judge.result === 'correct') {
            S.combo++; S.stats.correct++; st[0]++; S.stats.maxCombo = Math.max(S.stats.maxCombo, S.combo);
            const ri = S.review.indexOf(q.type); if (ri >= 0) S.review.splice(ri, 1);
            const dmg = rules.playerDamage(S.lv, S.combo, S.job);
            bt.hp = Math.max(0, bt.hp - dmg); sfx('ok'); sfx('hit'); bt.blink = performance.now() + 350; shake(stageEl, 'shake', 250); enameUpdate(); hud();
            await say((S.combo >= 2 ? S.combo + '問連続 正解! ' : '正解! ') + bt.name + 'に ' + dmg + 'の ダメージ!');
            if (bt.hp <= 0) { result = 'win'; break; }
            if (E.phase2 && bt.phase === 1 && bt.hp <= bt.max / 2) {
              bt.phase = 2; await fx('flash', 450); bt.name = E.phase2.name; bt.spr = enemyCanvas(E, true); enameUpdate();
              await cutin(E.phase2.name, E.phase2.line, bt.spr);
              await say(E.name + 'は 真のすがたを あらわした! 問題が 総合問題に 変わる!');
            }
          } else {
            S.combo = 0; S.stats.wrong++; st[1]++;
            S.review.push(q.type); if (S.review.length > 12) S.review.shift();
            const mk = r.judge.mistake;
            if (mk) S.stats.mistakes[mk.tag] = (S.stats.mistakes[mk.tag] || 0) + 1;
            sfx('ng'); hud();
            await say('ざんねん、不正解……。' + (mk ? '\n💡 ' + mk.msg : ''));
            await showExplain(q);
            if (await enemyAttack(1)) { result = 'lose'; break; }
          }
          if (boss && bt.turn % 3 === 0) {
            await say(bt.name + 'は 力を ためている……怒りの波動!');
            if (await enemyAttack(0.5)) { result = 'lose'; break; }
          }
        } else if (c === 1) {
          if (q.hintShown) await say('💡 ' + q.hint);
          else if (bt.hints <= 0) await say('ひらめきは もう 使えない!');
          else { bt.hints--; q.hintShown = true; sfx('chest'); await say('💡 ひらめいた!\n' + q.hint); }
        } else if (c === 2) { await itemMenu(true); }
        else if (c === 3) {
          if (boss) await say('ボスからは にげられない!');
          else if (Math.random() < 0.7) { sfx('flee'); await say(S.name + 'は にげだした!'); result = 'flee'; }
          else { await say('にげ道を ふさがれた!'); acted = true; if (await enemyAttack(1)) result = 'lose'; }
        }
      }
    }
    if (result === 'win') await winBattle(E, eid);
    else if (result === 'lose') await loseBattle();
    bt = null; mode = 'map'; setStage('map'); showMsg(''); loadMap(); playBgmFor(); hud(); save();
    return result;
  }
  async function winBattle(E, eid) {
    bt.gone = true; playBgm(null); sfx('win');
    await say(bt.name + 'を たおした!');
    const xp = Math.round(rules.xpOf(E) * (job().xp || 1)), gold = Math.round(rules.goldOf(E) * (job().gold || 1));
    S.gold += gold; const cap = rules.levelCap(course, S.flags);
    if (S.lv < cap) S.xp += xp;
    await say(xp + 'の 経験値と ' + gold + 'ゴールドを 手に入れた!');
    if (E.boss) S.flags['boss:' + eid] = 1;
    while (S.lv < rules.levelCap(course, S.flags) && S.xp >= rules.needXp(S.lv)) {
      S.xp -= rules.needXp(S.lv); const before = maxHp(); S.lv++; S.hp += maxHp() - before; hud();
      await banner('レベルアップ!', 'Lv ' + S.lv, 'level');
      await say(S.name + 'は レベル' + S.lv + 'に 上がった!\n最大HP ' + maxHp() + ' / こうげき力 ' + rules.atk(S.lv));
      const lt = course.titles.level.find(function (x) { return x.lv === S.lv; });
      if (lt) { await banner('あたらしい称号!', '『' + lt.name + '』', 'title'); await say('レベル称号が『' + lt.name + '』に なった!'); }
    }
    if (S.lv >= rules.levelCap(course, S.flags)) S.xp = 0;
    if (job().regen) { const h = Math.min(maxHp() - S.hp, Math.ceil(maxHp() * job().regen)); if (h > 0) { S.hp += h; await say('僧侶の いのりで HPが ' + h + ' 回復した。'); } }
    await checkTitles();
  }
  async function loseBattle() {
    playBgm(null); sfx('lose');
    await say(S.name + 'は 力つきた……。');
    await fx('fade', 600);
    S.gold = Math.floor(S.gold / 2); S.hp = maxHp(); S.combo = 0; S.dun = null; S.pos = Object.assign({}, course.start);
    bt.gone = true; mode = 'map'; setStage('map'); loadMap();
    await say('気がつくと 町に もどっていた。\nゴールドが 半分に なった……。(レベルと称号は そのまま)\n草原で きたえ直して、もう一度 挑戦しよう!');
  }
  function drawBattle(t) {
    const bg = bt.bg || THEMES.field.bg;
    ctx.fillStyle = bg[0]; ctx.fillRect(0, 0, 240, 112);
    ctx.fillStyle = bg[1]; ctx.fillRect(0, 80, 240, 32);
    ctx.fillStyle = bg[2]; for (let i = 0; i < 5; i++) ctx.fillRect(0, 82 + i * 7, 240, 1);
    if (bt.gone) return;
    if (bt.blink > t && Math.floor(t / 60) % 2) return;
    const sp = bt.spr, sc = 4, w = sp.width * sc, h = sp.height * sc;
    ctx.drawImage(sp, Math.round((240 - w) / 2), 102 - h + Math.round(Math.sin(t / 400) * 2), w, h);
  }

  /* ---------- 全画面の画面(タイトル・キャラ作成・ステータス・記録のことば) ---------- */
  function titleScreen() {
    return new Promise(function (res) {
      const has = !!load();
      ov('<div class="ttl"><div class="t0">すうがく RPG</div><h1>' + escH(course.title) + '</h1><div class="t2">' + escH(course.subtitle || '') + '</div><div class="heroes">' +
        JOBS.map(function () { return '<canvas width="48" height="48"></canvas>'; }).join('') + '</div><div class="vbtn">' +
        (has ? '<button data-a="continue">つづきから</button>' : '') + '<button data-a="new">はじめから</button><button data-a="pw">記録のことばを いれる</button></div>' +
        '<div class="note">音は はじめ オフです。ゲーム中の 右上「♪」で 切りかえられます。</div></div>');
      Array.from(ovEl.querySelectorAll('.heroes canvas')).forEach(function (c, i) { drawTo(c, heroCanvas(JOBS[i].id, i % 2)); });
      ovEl.onclick = function (e) {
        const a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
        if (a === 'new' && has && !window.confirm('いまの記録を 消して、はじめから 遊びますか?')) return;
        ovClose(); res(a);
      };
    });
  }
  function createScreen(init, keepName) {
    return new Promise(function (res) {
      const sel = { name: init.name || '', gender: init.gender ? 1 : 0, job: init.job || 'hero' };
      ov('<div class="crt"><h2>' + (keepName ? 'すがたを かえる' : 'キャラクターを つくる') + '</h2>' +
        (keepName ? '' : '<div class="lab">なまえ(ひらがな・カタカナ 6文字まで)</div><div class="row"><input id="nm" maxlength="6" autocomplete="off" value="' + escH(sel.name) + '"><button id="rnd" class="mini">おまかせ</button></div>') +
        '<div class="lab">せいべつ</div><div class="row" id="gsel"><button data-g="0">おとこ</button><button data-g="1">おんな</button></div>' +
        '<div class="lab">しょくぎょう(どれを選んでも 問題と進めやすさは 同じ)</div><div class="jobs" id="jsel">' +
        JOBS.map(function (j) { return '<button data-j="' + j.id + '"><canvas width="48" height="48"></canvas><span>' + j.name + '</span></button>'; }).join('') +
        '</div><div class="jdesc" id="jd"></div><div class="err" id="er"></div><div class="row"><button id="okb" class="big">けってい</button>' + (keepName ? '<button id="ccb" class="big sub">やめる</button>' : '') + '</div></div>');
      function update() {
        Array.from(ovEl.querySelectorAll('#gsel button')).forEach(function (b) { b.classList.toggle('sel', +b.getAttribute('data-g') === sel.gender); });
        Array.from(ovEl.querySelectorAll('#jsel button')).forEach(function (b) {
          const id = b.getAttribute('data-j'); b.classList.toggle('sel', id === sel.job); drawTo(b.querySelector('canvas'), heroCanvas(id, sel.gender));
        });
        $('jd').textContent = jobOf(sel.job).name + ':' + jobOf(sel.job).desc;
      }
      ovEl.onclick = function (e) {
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-g')) sel.gender = +b.getAttribute('data-g');
        else if (b.hasAttribute('data-j')) sel.job = b.getAttribute('data-j');
        else if (b.id === 'rnd') $('nm').value = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
        else if (b.id === 'ccb') { ovClose(); return res(null); }
        else if (b.id === 'okb') {
          if (!keepName) {
            sel.name = $('nm').value.trim();
            if (!/^[ぁ-ゖァ-ヺー]{1,6}$/.test(sel.name)) { $('er').textContent = 'なまえは ひらがな・カタカナで 1〜6文字に してください'; return; }
          }
          ovClose(); return res(sel);
        }
        update();
      };
      update();
    });
  }
  function statusScreen() {
    return new Promise(function (res) {
      function render() {
        const bosses = bossIds(course), cap = rules.levelCap(course, S.flags);
        ov('<div class="card"><div class="chead"><canvas id="scv" width="96" height="96"></canvas><div><div class="cname">' + escH(S.name) + '</div>' +
          (S.title ? '<div class="ctitle2">『' + escH(titleName(S.title)) + '』</div>' : '') +
          '<div class="cjob">' + jobOf(S.job).name + ' Lv ' + S.lv + '</div><div class="ctitle">' + escH(levelTitle(S.lv)) + '</div></div></div>' +
          '<div class="cstat"><span>HP ' + S.hp + '/' + maxHp() + '</span><span>こうげき ' + rules.atk(S.lv) + '</span><span>' + S.gold + ' G</span>' +
          '<span>つぎのLvまで ' + (S.lv >= cap ? '—' : rules.needXp(S.lv) - S.xp) + '</span><span>最大コンボ ' + S.stats.maxCombo + '</span><span>連続プレイ ' + S.days.streak + '日</span>' +
          '<span>正解 ' + S.stats.correct + '問</span><span>戦闘 ' + S.stats.battles + '回</span></div>' +
          '<div class="lab">たおしたボス</div><div class="bosses">' + bosses.map(function (id) {
            return '<div class="' + (S.flags['boss:' + id] ? 'got' : 'yet') + '"><canvas data-b="' + id + '" width="48" height="48"></canvas></div>';
          }).join('') + '</div><div class="lab">特別称号(タップで 名前の横に 付ける)</div><div class="tlist">' +
          (S.titles.length ? S.titles.map(function (id) { return '<button data-t="' + id + '" class="' + (S.title === id ? 'sel' : '') + '">' + escH(titleName(id)) + '</button>'; }).join('') : '<span class="note">まだ ありません。ボスを たおすと 手に入ります。</span>') +
          '</div><div class="cfoot">' + escH(course.title) + '</div><button id="clb" class="big">とじる</button></div>');
        drawTo($('scv'), heroCanvas(S.job, S.gender));
        Array.from(ovEl.querySelectorAll('canvas[data-b]')).forEach(function (c) { drawTo(c, enemyCanvas(course.enemies[c.getAttribute('data-b')])); });
      }
      render();
      ovEl.onclick = function (e) {
        const b = e.target.closest('button'); if (!b) return;
        if (b.id === 'clb') { ovClose(); save(); return res(); }
        if (b.hasAttribute('data-t')) { const id = b.getAttribute('data-t'); S.title = S.title === id ? null : id; const keep = ovEl.onclick; render(); ovEl.onclick = keep; }
      };
    });
  }
  function passwordShow() {
    return new Promise(function (res) {
      const pw = pwEncode(course, S), g = pw.match(/.{1,5}/g).join(' ');
      ov('<div class="crt"><h2>記録のことば</h2><p class="note">ノートに 書き写しておくと、機種変更や 別の端末でも つづきから 遊べます。(レベル・ゴールド・たおしたボス・称号を 記録。場所は 町から)</p><div class="pw">' + g + '</div><button id="clb" class="big">とじる</button></div>');
      ovEl.onclick = function (e) { if (e.target.id === 'clb') { ovClose(); res(); } };
    });
  }
  function passwordInput() {
    return new Promise(function (res) {
      ov('<div class="crt"><h2>記録のことばを いれる</h2><p class="note">ひらがな 27文字を 入力してください(空白は あっても なくても よい)。</p><textarea id="pwi" rows="4"></textarea><div class="err" id="er"></div><div class="row"><button id="okb" class="big">けってい</button><button id="ccb" class="big sub">もどる</button></div></div>');
      ovEl.onclick = function (e) {
        if (e.target.id === 'ccb') { ovClose(); return res(null); }
        if (e.target.id !== 'okb') return;
        const o = pwDecode(course, $('pwi').value);
        if (!o) { $('er').textContent = '記録のことばが ちがいます。もう一度 たしかめてください。'; return; }
        const st = M.newState({ name: o.name, gender: o.gender, job: o.job });
        st.lv = Math.min(o.lv, 40); st.xp = o.xp; st.gold = o.gold; st.items.herb = o.herb; st.items.bell = o.bell; st.titles = o.titles; st.title = o.title;
        o.bosses.forEach(function (id) { st.flags['boss:' + id] = 1; });
        st.days.streak = o.streak; st.stats.maxCombo = o.maxCombo; st.hp = rules.maxHp(st.lv, st.job);
        ovClose(); res(st);
      };
    });
  }

  /* ---------- 進行 ---------- */
  function frame(t) {
    if (S && cur) { if (mode === 'map') { updateMap(Math.min(50, t - (frame.last || t))); drawMap(t); } else if (mode === 'battle' && bt) drawBattle(t); }
    frame.last = t; requestAnimationFrame(frame);
  }
  async function main() {
    hud(); setStage('map');
    let fresh = false;
    while (!S) {
      const a = await titleScreen();
      if (a === 'continue') S = load();
      else if (a === 'new') { const c = await createScreen({}, false); S = M.newState(c); fresh = true; }
      else if (a === 'pw') S = await passwordInput();
    }
    setSound(!!S.sound); setPad(!!S.dpad);
    touchDays(); mode = 'map'; loadMap(); hud(); save(); playBgmFor();
    busy = true;
    if (fresh && course.intro) for (const l of course.intro) await say(l.replace('{n}', S.name));
    await checkTitles(); showMsg(''); busy = false; save();
  }
  /* 開発用: ?debug=sprites | battle:敵ID | ask:型ID | explain:型ID | dun:ダンジョンID:階 | status | world | create (セーブはしない) */
  async function debugMain() {
    const a = debug.split(':');
    S = M.newState({ name: 'ソラ', gender: params.get('g') === '1' ? 1 : 0, job: params.get('job') || 'hero' });
    S.lv = parseInt(params.get('lv') || '5', 10); S.hp = maxHp(); S.gold = 123; S.days.streak = 3; S.pos = Object.assign({}, course.start);
    mode = 'map'; setStage('map'); loadMap(); hud(); setPad(params.get('pad') === '1');
    if (a[0] === 'tap') { tapTile(parseInt(a[1], 10), parseInt(a[2], 10)); }
    else if (a[0] === 'sprites') {
      const list = [];
      JOBS.forEach(function (j) { list.push(heroCanvas(j.id, 0)); list.push(heroCanvas(j.id, 1)); });
      Object.keys(course.enemies).forEach(function (id) { list.push(enemyCanvas(course.enemies[id])); if (course.enemies[id].phase2) list.push(enemyCanvas(course.enemies[id], true)); });
      Object.keys(TILES).forEach(function (n) { list.push(tileCanvas(n, THEMES.cave)); });
      ov('<div style="background:#3a6;padding:4px">' + list.map(function (c) { return '<canvas width="' + c.width * 3 + '" height="' + c.height * 3 + '" style="margin:2px;image-rendering:pixelated"></canvas>'; }).join('') + '</div>');
      Array.from(ovEl.querySelectorAll('canvas')).forEach(function (c, i) { drawTo(c, list[i]); });
    } else if (a[0] === 'battle') { busy = true; await battle(a[1]); busy = false; }
    else if (a[0] === 'ask' || a[0] === 'explain') {
      const eid = Object.keys(course.enemies).find(function (id) { return course.enemies[id].types.some(function (r) { return typeId(r) === a[1]; }); });
      const E = course.enemies[eid];
      bt = { E: E, name: E.name, hp: 10, max: 10, hints: 1, turn: 1, phase: 1, spr: enemyCanvas(E), blink: 0, bg: THEMES.cave.bg };
      mode = 'battle'; setStage('battle'); enameUpdate();
      const q = buildQuestion(course, a[1], makeRng(parseInt(a[2] || '1', 10)));
      q.hintShown = true;
      if (a[0] === 'ask') askAnswer(q, bt, q.answers); else showExplain(q);
    } else if (a[0] === 'dun') {
      S.dun = { id: a[1], floor: parseInt(a[2] || '0', 10), seed: 12345, opened: {}, ret: course.start, x: 0, y: 0 };
      cur = dungeonMap(); setPos(cur.floor.start.x, cur.floor.start.y);
    } else if (a[0] === 'world') { S.pos = { map: 'world', x: course.maps.town.legend ? 16 : 16, y: 13 }; loadMap(); }
    else if (a[0] === 'status') { S.flags['boss:' + bossIds(course)[0]] = 1; S.titles = [course.titles.special[0].id]; S.title = S.titles[0]; statusScreen(); }
    else if (a[0] === 'create') createScreen({}, false);
    else if (a[0] === 'auto') {
      /* 自動プレイで 戦闘の流れを ひととおり動かし、結果を画面に出す(動作確認用) */
      const log = []; let wrongMode = 0;
      window.addEventListener('error', function (e) { log.push('ERROR ' + e.message); });
      window.addEventListener('unhandledrejection', function (e) { log.push('REJECT ' + (e.reason && e.reason.stack || e.reason)); });
      autoAnswer = function (q) {
        const wrong = wrongMode === 1 || (wrongMode === 2 && Math.random() < 0.5);
        const m = q.mistakes[0], raws = !wrong ? q.answers : m ? m.answers.map(function (x, i) { return x === '*' ? q.answers[i] : x; }) : q.answers.map(function () { return '9999'; });
        return { judge: judge(q, raws), raws: raws };
      };
      setInterval(function () { if (modal && modal.A) modal.A(); }, 5);
      try {
        /* 画面の更新回数で待つ(ヘッドレスでは 時間の進み方が ちがうため) */
        const frames = function (n, until) { return new Promise(function (res) { (function f() { updateMap(16); if (--n <= 0 || (until && until())) res(n); else setTimeout(f, 1); })(); }); };
        const idle = function () { return !route && !P.moving && !busy; };
        let moved = 0;
        tapTile(12, 8); const mark = JSON.stringify(route && route.mark), steps = route.path.length;
        await frames(3000, function () { moved++; return idle(); });
        log.push('タップ移動 (7,9)→(12,8): ' + steps + '歩 印=' + mark + ' → 着いた位置 ' + P.x + ',' + P.y + ' / 1歩あたり ' + Math.round(moved * 16 / steps) + 'ms(設定 ' + MOVE_MS + ')');
        tapTile(1, 1); await frames(40); const mid = P.x + ',' + P.y; tapTile(2, 7); await frames(6000, function () { return idle() && P.x <= 3; });
        log.push('途中(' + mid + ')で行き先変更 → 町の人(2,7)をタップ: 位置 ' + P.x + ',' + P.y + ' 向き=' + P.dir + '(話しかけて 会話が終わった)');
        tapTile(7, 12); await frames(6000, idle); log.push('通れない木(7,12)をタップ → いちばん近いマスへ: map=' + S.pos.map + ' ' + P.x + ',' + P.y);
        S.pos = Object.assign({}, course.start); loadMap();
      } catch (e) { log.push('EXCEPTION ' + (e.stack || e)); }
      busy = true;
      try {
        S.lv = 8; S.hp = maxHp(); log.push('boss kahou Lv8 全問正解 → ' + await battle('kahou') + ' / Lv' + S.lv + ' flag=' + S.flags['boss:kahou'] + ' titles=' + S.titles.join(','));
        S.lv = 30; S.hp = maxHp(); log.push('maou Lv30 → ' + await battle('maou') + ' / Lv' + S.lv + ' cap=' + rules.levelCap(course, S.flags) + ' combo=' + S.stats.maxCombo + ' titles=' + S.titles.join(','));
        wrongMode = 1; S.lv = 3; S.hp = maxHp(); S.gold = 100; S.dun = { id: 'tower', floor: 1, seed: 5, opened: {}, ret: course.start, x: 3, y: 3 };
        log.push('harmo Lv3 全問不正解 → ' + await battle('harmo') + ' / gold=' + S.gold + ' hp=' + S.hp + ' dun=' + S.dun + ' pos=' + JSON.stringify(S.pos) + ' mistakes=' + JSON.stringify(S.stats.mistakes));
        wrongMode = 2; for (const e of Object.keys(course.enemies)) { if (course.enemies[e].boss) continue; S.lv = course.enemies[e].level + 2; S.hp = maxHp(); log.push(e + ' → ' + await battle(e)); }
        wrongMode = 0; await enterDungeon('cave', course.start); log.push('cave に入る → floor=' + (S.dun && S.dun.floor) + ' 位置=' + P.x + ',' + P.y);
        await gotoFloor(1, 'start'); await gotoFloor(2, 'start'); log.push('ボス部屋 isBoss=' + cur.isBoss + ' 隠し通路=' + cur.cell(6, 1).k);
        await openChest(); await inn(); await church(); log.push('宿屋・教会 OK hp=' + S.hp);
        const st = pwDecode(course, pwEncode(course, S)); log.push('記録のことば → ' + (st && st.name + ' Lv' + st.lv));
        log.push('review=' + S.review.join(',') + ' / 完了');
      } catch (e) { log.push('EXCEPTION ' + (e.stack || e)); }
      ov('<div style="font-size:11px;line-height:1.5;font-weight:normal;word-break:break-all">' + log.map(escH).join('<br>') + '</div>');
    }
    else if (a[0] === 'say') say('ソラは レベル6に 上がった!\nsin 75° = {√6 + √2/4}、2^{-3} = {1/8}、[3]√{27} = 3');
  }
  requestAnimationFrame(frame);
  (DEV ? debugMain() : main()).catch(function (e) { console.error(e); });
};

if (typeof module !== 'undefined' && module.exports) module.exports = M;
root.MathRPG = M;
})(typeof globalThis !== 'undefined' ? globalThis : this);

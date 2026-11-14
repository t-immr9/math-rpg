/* ============================================================
 * コース: 数学A 2学期期末(接線と弦の作る角・方べきの定理・2つの円・作図・空間図形・多面体)
 * 書き方の説明は docs/course-format.md。型の一覧は先生の承認ずみ。
 * 作図は 実際にはかかせず、「方針を選ぶ」と「手順の並べ替え」だけにする。
 * ============================================================ */
(function () {
'use strict';
const M = (typeof MathRPG !== 'undefined') ? MathRPG : require('../engine.js');
const U = M.util, am = U.am, F = U.fracStr, G = M.geo;
const DEG = Math.PI / 180;

/* ---------- 小さな道具 ---------- */
function pickUntil(make, ok, fallback) { for (let i = 0; i < 200; i++) { const v = make(); if (ok(v)) return v; } return fallback; }
function N(x) { return String(x); }
function m1(v, tag, msg) { return { answers: [N(v)], tag: tag, msg: msg }; }
function sqrtStr(n) { let k = 1; for (let f = 2; f * f <= n; f++) while (n % (f * f) === 0) { n /= f * f; k *= f; } return n === 1 ? N(k) : (k === 1 ? '' : k) + '√' + n; }
/* 選ぶ問題: 1つ目が正解、あとは [文, tag, ひとこと] */
function ch(right, wrongs) { return [{ text: right, ok: true }].concat(wrongs.map(function (w) { return { text: w[0], tag: w[1], msg: w[2] }; })); }
/* ベクトル */
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.sqrt(dot(a, a)); }
function acute(u, v) { return Math.acos(Math.min(1, Math.abs(dot(u, v)) / (len(u) * len(v)))) / DEG; }      // 2直線(または 2つの法線)のなす角 0〜90°
function eDir(S, e) { return sub(S.verts[e[1]], S.verts[e[0]]); }
function fNormal(S, f) { return cross(sub(S.verts[f[1]], S.verts[f[0]]), sub(S.verts[f[2]], S.verts[f[0]])); }
/* 辺 e と 辺 x の位置関係: para(平行)/ cross(交わる)/ skew(ねじれ) */
function edgeRel(S, e, x) {
  if (len(cross(eDir(S, e), eDir(S, x))) < 1e-9) return 'para';
  return (x[0] === e[0] || x[0] === e[1] || x[1] === e[0] || x[1] === e[1]) ? 'cross' : 'skew';
}
/* 面 f と 辺 x の位置関係: on(面上)/ para(平行)/ perp(垂直)/ other */
function faceEdgeRel(S, f, x) {
  if (f.indexOf(x[0]) >= 0 && f.indexOf(x[1]) >= 0) return 'on';
  const n = fNormal(S, f), d = eDir(S, x);
  if (Math.abs(dot(n, d)) < 1e-9) return 'para';
  return len(cross(n, d)) < 1e-9 ? 'perp' : 'other';
}

/* ---------- 円の図(円 O、半径 5。接点 A は いちばん下) ---------- */
const O = [0, 0], RR = 5;
function cp(deg) { return G.on(O, RR, deg); }
function pnt(p, label, o) { return Object.assign({ t: 'point', p: p, label: label, away: O }, o || {}); }
function ang(at, a, b, label, acc) { return { t: 'angle', at: at, a: a, b: b, label: label, color: acc ? 'acc' : undefined }; }
/* A での接線 ST(T が右)。もどり値 { A, S, T, items } */
function tangentScene() {
  const A = cp(270), tl = G.tangentAt(O, A, 6.5);
  return { A: A, S: tl[0], T: tl[1], items: [{ t: 'circle', c: O, r: RR }, { t: 'seg', a: tl[0], b: tl[1] }, pnt(A, 'A', { away: undefined, pos: 's' }),
    { t: 'point', p: tl[0], label: 'S', pos: 'n', dot: false }, { t: 'point', p: tl[1], label: 'T', pos: 'n', dot: false }] };
}
function geo(items) { return { type: 'geo', items: items }; }
const TC_HINT = '接線と弦の作る角は、その角の内部にある弧に対する円周角に等しい';

/* ---------- 方べきの図(長さは 問題文に書き、図には 点の名前と x だけを出す) ---------- */
function powIn(a, b, c, phi) {            // 円の内部の点 P で 弦 AB、CD が交わる
  const u = [Math.cos(phi * DEG), Math.sin(phi * DEG)], d = a * b / c, P = [0, 0], A = [-a, 0], B = [b, 0], C = [c * u[0], c * u[1]], D = [-d * u[0], -d * u[1]], cir = G.circum(A, B, C);
  return { cir: cir, D: D, d: d, fig: geo([{ t: 'circle', c: cir.c, r: cir.r }, { t: 'seg', a: A, b: B }, { t: 'seg', a: C, b: P }, { t: 'seg', a: P, b: D, color: 'acc', w: 2.4, label: 'x' },
    pnt(A, 'A', { away: cir.c }), pnt(B, 'B', { away: cir.c }), pnt(C, 'C', { away: cir.c }), pnt(D, 'D', { away: cir.c }), pnt(P, 'P', { away: undefined, dir: phi > 90 ? 45 : 135 })]) };
}
function powOut(a, b, c, phi, mark) {     // 円の外部の点 P から 2本の直線。mark: 'PD' か 'CD' を x にする
  const u = [Math.cos(phi * DEG), Math.sin(phi * DEG)], d = a * b / c, P = [0, 0], A = [a, 0], B = [b, 0], C = [c * u[0], c * u[1]], D = [d * u[0], d * u[1]], cir = G.circum(A, B, C);
  return { cir: cir, C: C, D: D, d: d, fig: geo([{ t: 'circle', c: cir.c, r: cir.r }, { t: 'seg', a: P, b: B }, { t: 'seg', a: P, b: D },
    { t: 'seg', a: mark === 'CD' ? C : P, b: D, color: 'acc', w: 2.4, label: 'x', side: -1 },
    pnt(A, 'A', { away: undefined, pos: 's' }), pnt(B, 'B', { away: undefined, pos: 's' }), pnt(C, 'C', { away: undefined, pos: 'n' }), pnt(D, 'D', { away: undefined, pos: 'n' }), pnt(P, 'P', { away: undefined, pos: 'w' })]) };
}
function powTan(a, b, k, mark) {          // 接線 PT と 割線 PAB。mark: 'PT' か 'PB'
  const P = [0, 0], A = [a, 0], B = [b, 0], h = k * (b - a) / 2, c = [(a + b) / 2, -h], r = Math.hypot((b - a) / 2, h), ts = G.tangentFrom(c, r, P), T = ts[0][1] > ts[1][1] ? ts[0] : ts[1];
  return { T: T, c: c, r: r, fig: geo([{ t: 'circle', c: c, r: r }, { t: 'seg', a: P, b: B, color: mark === 'PB' ? 'acc' : undefined, w: mark === 'PB' ? 2.4 : undefined }, { t: 'seg', a: P, b: G.lerp(P, T, 1.35) },
    mark === 'PT' ? { t: 'seg', a: P, b: T, color: 'acc', w: 2.4, label: 'x' } : { t: 'seg', a: P, b: T, w: 0.1 },
    pnt(A, 'A', { away: undefined, pos: 's' }), pnt(B, 'B', { away: undefined, pos: 's' }), pnt(T, 'T', { away: c }), pnt(P, 'P', { away: undefined, pos: 'w' })]) };
}
const PW_HINT = '方べきの定理:点 P から 円までの長さ × 点 P から 円までの長さ が、どの直線でも 等しい';

/* ---------- 2つの円の図 ---------- */
function twoCircles(R1, r1, d, more) {
  return geo([{ t: 'circle', c: [0, 0], r: R1 }, { t: 'circle', c: [d, 0], r: r1 }, { t: 'point', p: [0, 0], label: 'O', pos: 's' }, { t: 'point', p: [d, 0], label: "O'", pos: d === 0 ? 'n' : 's' }].concat(more || []));
}
const REL = ['互いに外部にある', '外接する', '2点で交わる', '内接する', '一方が他方の内部にある'];       // 位置関係(共通接線は 4・3・2・1・0 本)
function relOf(R1, r1, d) { return d > R1 + r1 ? 0 : d === R1 + r1 ? 1 : d > R1 - r1 ? 2 : d === R1 - r1 ? 3 : 4; }
function relPick(R, k) {                  // 位置関係 k になる [大きい半径, 小さい半径, 中心間の距離]
  const r1 = R.int(1, 4), R1 = r1 + R.int(2, 4);
  const d = k === 0 ? R1 + r1 + R.int(1, 3) : k === 1 ? R1 + r1 : k === 2 ? R.int(R1 - r1 + 1, R1 + r1 - 1) : k === 3 ? R1 - r1 : R.int(0, R1 - r1 - 1);
  return [R1, r1, d];
}

/* ---------- 立体 ---------- */
const CUBE = M.solids.cuboid(4, 4, 4), PRISM = M.solids.prism(3, 3, 5);
function faceName(f) { return '面 ' + f.join(''); }
/* 正多面体(頂点の座標から 辺と面を作る)。F = 面の数 4・6・8・12・20 */
const PHI = (1 + Math.sqrt(5)) / 2;
function signs(v) { let out = [[]]; v.forEach(function (x) { const n = []; out.forEach(function (o) { n.push(o.concat([x])); if (x !== 0) n.push(o.concat([-x])); }); out = n; }); return out; }
function cyc(list) { const out = []; list.forEach(function (v) { out.push(v, [v[2], v[0], v[1]], [v[1], v[2], v[0]]); }); return out; }
const PV = { 4: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], 6: signs([1, 1, 1]), 8: cyc(signs([1, 0, 0])), 20: cyc(signs([0, 1, PHI])), 12: signs([1, 1, 1]).concat(cyc(signs([0, 1 / PHI, PHI]))) };
const PN = { 4: PV[4].map(function (v) { return [-v[0], -v[1], -v[2]]; }), 6: PV[8], 8: PV[6], 20: PV[12], 12: PV[20] };       // 面の向き(双対の頂点)
const REGULAR = {};
function regular(Fn) {
  if (REGULAR[Fn]) return REGULAR[Fn];
  const a = 24 * DEG, b = 17 * DEG;
  const rot = function (v) { const x = v[0] * Math.cos(a) - v[1] * Math.sin(a), y = v[0] * Math.sin(a) + v[1] * Math.cos(a); return [x, y * Math.cos(b) - v[2] * Math.sin(b), y * Math.sin(b) + v[2] * Math.cos(b)]; };
  /* 正四面体は 回さず、底面を下にして 立てた向きにする(頂点が 上、手前の面が 正面に見える) */
  const TET = [[0, 3, 3 * Math.SQRT2], [3 * Math.cos(210 * DEG), 3 * Math.sin(210 * DEG) + 3, 0], [3 * Math.cos(330 * DEG), 3 * Math.sin(330 * DEG) + 3, 0], [0, 6, 0]], tc = [0, 3, 0.75 * Math.SQRT2];
  const pts = Fn === 4 ? TET : PV[Fn].map(rot), nm = pts.map(function (_, i) { return 'v' + i; }), verts = {}, edges = [], faces = [];
  const normals = Fn === 4 ? TET.map(function (p) { return sub(tc, p); }) : PN[Fn].map(rot);
  let dmin = 1e9;
  pts.forEach(function (p, i) { verts[nm[i]] = p; pts.forEach(function (q, j) { if (j > i) dmin = Math.min(dmin, len(sub(p, q))); }); });
  pts.forEach(function (p, i) { pts.forEach(function (q, j) { if (j > i && len(sub(p, q)) < dmin + 1e-6) edges.push([nm[i], nm[j]]); }); });
  normals.forEach(function (n) {
    let mx = -1e9; pts.forEach(function (p) { mx = Math.max(mx, dot(p, n)); });
    const idx = []; pts.forEach(function (p, i) { if (dot(p, n) > mx - 1e-6) idx.push(i); });
    const c = [0, 0, 0]; idx.forEach(function (i) { c[0] += pts[i][0] / idx.length; c[1] += pts[i][1] / idx.length; c[2] += pts[i][2] / idx.length; });
    const u = sub(pts[idx[0]], c), w = cross(n, u);
    idx.sort(function (i, j) { return Math.atan2(dot(sub(pts[i], c), w), dot(sub(pts[i], c), u)) - Math.atan2(dot(sub(pts[j], c), w), dot(sub(pts[j], c), u)); });
    faces.push(idx.map(function (i) { return nm[i]; }));
  });
  return (REGULAR[Fn] = { type: 'solid', verts: verts, edges: edges, faces: faces, labels: false });
}
const RP = [   // [名前, 面の数, 面の形, 1つの面の辺の数, 1つの頂点に集まる面の数]
  ['正四面体', 4, '正三角形', 3, 3], ['正六面体(立方体)', 6, '正方形', 4, 3], ['正八面体', 8, '正三角形', 3, 4], ['正十二面体', 12, '正五角形', 5, 3], ['正二十面体', 20, '正三角形', 3, 5]];

const types = {};

/* ==================== 東の草原(円) ==================== */
types['tc-basic'] = {
  name: '接弦定理の基本(円周角 ⇔ 接線と弦の角、直径なら 90°)', level: 0,
  gen: function (R) {
    const k = R.pick([0, 0, 1, 1, 2]), sc = tangentScene(), A = sc.A, T = sc.T;
    if (k === 2) {
      const B = cp(90), C = cp(R.pick([15, 30, 150, 165]));
      return {
        text: '線分 AB は 円 O の直径で、直線 ST は 点 A で 円に接している。x の値を求めよ。',
        fig: geo(sc.items.concat([{ t: 'poly', pts: [A, B, C] }, ang(A, T, B, 'x', true), pnt(B, 'B'), pnt(C, 'C'), { t: 'point', p: O, label: 'O', pos: 'e' }])),
        form: 'x = □°', answers: ['90'], num: [G.angleDeg(A, T, B)],
        hint: '円の接線は、接点を通る半径(直径)に 垂直',
        explain: ['円の接線は、接点を通る半径に垂直', 'AB は直径だから AB ⊥ ST', 'x = 90°'],
        mistakes: [m1(45, 'tc-diameter', '直径と接線は 垂直に交わるよ。図の見た目で 決めないようにしよう'), m1(180, 'tc-diameter', '∠BAT は 直径 AB と 接線 AT の作る角。垂直だから 90° だよ')]
      };
    }
    const th = R.int(6, 14) * 5, B = cp(270 + 2 * th), C = cp(270 + 2 * th + (360 - 2 * th) * R.pick([0.4, 0.5, 0.6]));
    const fig = geo(sc.items.concat([{ t: 'poly', pts: [A, B, C] }, ang(C, A, B, k === 0 ? th + '°' : 'x', k === 1), ang(A, T, B, k === 0 ? 'x' : th + '°', k === 0), pnt(B, 'B'), pnt(C, 'C')]));
    return {
      text: '直線 ST は 点 A で 円に接している。x の値を求めよ。', fig: fig, form: 'x = □°', answers: [N(th)], num: [k === 0 ? G.angleDeg(A, T, B) : G.angleDeg(C, A, B)],
      hint: TC_HINT, explain: ['接線と弦の作る角の定理', '∠BAT = ∠ACB', 'x = ' + th + '°'],
      mistakes: U.mistakes([N(th)], [m1(2 * th, 'tc-central', '等しいのは 円周角。中心角(2倍)と まちがえていないかな?'), m1(90 - th, 'tc-complement', '90° から引く必要は ないよ。∠BAT と ∠ACB は 等しい'),
        m1(180 - th, 'tc-other-side', '反対側の角(∠BAS)と 取りちがえていないかな。角の内部にある弧を 確かめよう')])
    };
  }
};
types['pw-basic'] = {
  name: '方べきの定理の基本(内部の点・外部の点・接線と割線)', level: 0,
  gen: function (R) {
    const k = R.int(0, 3);
    if (k === 0) {
      const v = pickUntil(function () { return [R.int(2, 6), R.int(2, 8), R.int(2, 8)]; }, function (v) { return (v[0] * v[1]) % v[2] === 0 && v[2] !== v[0] && v[2] !== v[1]; }, [3, 4, 2]);
      const a = v[0], b = v[1], c = v[2], s = powIn(a, b, c, R.int(50, 130)), ans = N(s.d);
      return {
        text: '円の 2つの弦 AB、CD が 点 P で交わっている。PA = ' + a + '、PB = ' + b + '、PC = ' + c + ' のとき、PD = x の値を求めよ。', fig: s.fig, form: 'x = □', answers: [ans], keys: ['分数'],
        verify: function (w) { return Math.abs(G.dist([s.D[0] / s.d * w[0], s.D[1] / s.d * w[0]], s.cir.c) - s.cir.r) < 1e-6; },
        hint: PW_HINT, explain: ['方べきの定理より PA·PB = PC·PD', a + '·' + b + ' = ' + c + '·x', 'x = ' + ans],
        mistakes: U.mistakes([ans], [{ answers: [F(a * c, b)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さだよ(PA·PB = PC·PD)' }, { answers: [F(b * c, a)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さだよ(PA·PB = PC·PD)' },
          m1(a + b - c, 'power-sum', '足し算ではなく かけ算だよ(PA·PB = PC·PD)')])
      };
    }
    if (k === 1) {
      const v = pickUntil(function () { const a = R.int(2, 5); return [a, a + R.int(2, 8), R.int(2, 8)]; }, function (v) { const p = v[0] * v[1]; return p % v[2] === 0 && v[2] !== v[0] && v[2] * v[2] < p && p / v[2] <= 14; }, [2, 9, 3]);
      const a = v[0], b = v[1], c = v[2], s = powOut(a, b, c, R.int(22, 42), 'PD'), ans = N(s.d);
      return {
        text: '円の外部の点 P から 2本の直線を引き、円との交点を 図のように A、B、C、D とする。PA = ' + a + '、PB = ' + b + '、PC = ' + c + ' のとき、PD = x の値を求めよ。', fig: s.fig, form: 'x = □', answers: [ans], keys: ['分数'],
        verify: function (w) { return Math.abs(G.dist([s.D[0] / s.d * w[0], s.D[1] / s.d * w[0]], s.cir.c) - s.cir.r) < 1e-6; },
        hint: PW_HINT, explain: ['方べきの定理より PA·PB = PC·PD', a + '·' + b + ' = ' + c + '·x', 'x = ' + ans],
        mistakes: U.mistakes([ans], [{ answers: [F(a * (b - a), c)], tag: 'power-chord', msg: 'かけるのは PA と PB。弦の長さ AB を かけていないかな' }, { answers: [F(a * c, b)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さだよ(PA·PB = PC·PD)' }])
      };
    }
    const pr = R.pick([[1, 4], [2, 8], [1, 9], [3, 12], [4, 9], [2, 18], [4, 16]]), a = pr[0], b = pr[1], t = Math.round(Math.sqrt(a * b));
    if (k === 2) {
      const s = powTan(a, b, R.pick([0.7, 1, 1.4]), 'PT');
      return {
        text: '点 P から 円に 接線 PT と、円と 2点 A、B で交わる直線を引く。PA = ' + a + '、PB = ' + b + ' のとき、PT = x の値を求めよ。', fig: s.fig, form: 'x = □', answers: [N(t)], keys: ['分数'], num: [G.dist([0, 0], s.T)],
        hint: '接線のときは PA·PB = PT^2', explain: ['方べきの定理より PA·PB = PT^2', 'x^2 = ' + a + '·' + b + ' = ' + (a * b), 'x > 0 より x = ' + t],
        mistakes: U.mistakes([N(t)], [m1(a * b, 'pt-square', 'それは PT^2 の値。PT は その正の平方根だよ'), { answers: [F(a * b, 2)], tag: 'pt-double', msg: 'PT^2 は PT×2 ではないよ。2乗して ' + (a * b) + ' になる数を 求めよう' }])
      };
    }
    const s = powTan(a, b, R.pick([0.7, 1, 1.4]), 'PB');
    return {
      text: '点 P から 円に 接線 PT と、円と 2点 A、B で交わる直線を引く。PT = ' + t + '、PA = ' + a + ' のとき、PB = x の値を求めよ。', fig: s.fig, form: 'x = □', answers: [N(b)], keys: ['分数'],
      verify: function (w) { return Math.abs(G.dist([w[0], 0], s.c) - s.r) < 1e-6 && w[0] > a; },
      hint: '接線のときは PA·PB = PT^2', explain: ['方べきの定理より PA·PB = PT^2', a + '·x = ' + t + '^2 = ' + (t * t), 'x = ' + b],
      mistakes: U.mistakes([N(b)], [{ answers: [F(2 * t, a)], tag: 'pt-double', msg: 'PT^2 は PT×2 ではないよ。' + t + '^2 = ' + (t * t) }, { answers: [F(t, a)], tag: 'pt-square', msg: 'PT を 2乗し忘れていないかな(PA·PB = PT^2)' }])
    };
  }
};
types['cc-dist'] = {
  name: '2つの円の中心間の距離(外接は和、内接は差)', level: 0,
  gen: function (R) {
    const r1 = R.int(1, 4), R1 = r1 + R.int(1, 4), ext = R.chance(0.5), d = ext ? R1 + r1 : R1 - r1;
    return {
      text: '半径 ' + R1 + ' の円 O と 半径 ' + r1 + ' の円 O\' が ' + (ext ? '外接' : '内接') + 'している。中心間の距離 d を求めよ。',
      fig: twoCircles(R1, r1, d, [{ t: 'seg', a: [0, 0], b: [d, 0], color: 'acc', label: 'd' }]), form: 'd = □', answers: [N(d)],
      num: [ext ? G.dist([0, 0], G.on([0, 0], R1, 0)) + r1 : G.dist([0, 0], G.on([0, 0], R1, 0)) - r1],
      hint: '接点は 2つの中心を通る直線上にある。外接なら 半径の和、内接なら 半径の差',
      explain: [ext ? '外接するとき d = (半径の和)' : '内接するとき d = (半径の差)', 'd = ' + R1 + (ext ? ' + ' : ' - ') + r1, 'd = ' + d],
      mistakes: U.mistakes([N(d)], [m1(ext ? R1 - r1 : R1 + r1, 'cc-sumdiff', '外接は 半径の和、内接は 半径の差。逆になっていないかな'), m1(R1 * r1, 'cc-product', 'かけ算ではないよ。半径の' + (ext ? '和' : '差') + 'を 考えよう')])
    };
  }
};

/* ==================== 西の草原(立体) ==================== */
types['sp-cube-edges'] = {
  name: '立方体の 平行・ねじれ・直交する辺を選ぶ', level: 0,
  gen: function (R) {
    const e = R.pick(CUBE.edges), rel = R.pick(['skew', 'para', 'cross']), others = CUBE.edges.filter(function (x) { return x !== e; });
    const label = { skew: 'ねじれの位置にある辺', para: '平行な辺', cross: '直交する辺(垂直に交わる辺)' }[rel];
    return {
      text: '立方体 ABCD-EFGH で、辺 ' + e + ' と ' + label + 'を すべて選べ。', fig: Object.assign({}, CUBE, { mark: [e] }), cols: 4,
      choices: others.map(function (x) {
        const r = edgeRel(CUBE, e, x);
        return { text: x, ok: r === rel, tag: 'edge-' + r, msg: { para: '辺 ' + x + ' は 辺 ' + e + ' と 平行だよ(同じ平面上にある)', cross: '辺 ' + x + ' は 辺 ' + e + ' と 交わっているよ', skew: '辺 ' + x + ' は 辺 ' + e + ' と ねじれの位置(平行でなく、交わりもしない)だよ' }[r] };
      }),
      verify: function () { return others.filter(function (x) { return edgeRel(CUBE, e, x) === rel; }).length === { skew: 4, para: 3, cross: 4 }[rel]; },
      missingMsg: 'えらんだものは 合っている。まだ ほかにも あるよ(' + { skew: '4', para: '3', cross: '4' }[rel] + '本 ある)',
      hint: 'ねじれの位置は「平行でなく、交わりもしない」。直交は「実際に交わって 垂直」',
      explain: ['辺 ' + e + ' と 平行な辺は 3本、交わる辺は 4本(どれも 垂直に交わる)', 'のこりの 4本が ねじれの位置', label + 'は ' + others.filter(function (x) { return edgeRel(CUBE, e, x) === rel; }).join(', ')]
    };
  }
};
types['ph-count'] = {
  name: '角柱・角錐の 面・辺・頂点の数', level: 0,
  gen: function (R) {
    const n = R.int(3, 6), prism = R.chance(0.5), q = R.int(0, 2), S = prism ? M.solids.prism(n, 3, 5) : M.solids.pyramid(n, 3, 5), kn = ['三', '四', '五', '六'][n - 3] + (prism ? '角柱' : '角錐');
    const cnt = prism ? [n + 2, 3 * n, 2 * n] : [n + 1, 2 * n, n + 1], what = ['面', '辺', '頂点'][q], ans = N(cnt[q]);
    const mis = prism
      ? [q === 0 ? m1(n, 'count-base', '上下の 2つの底面を 数え忘れていないかな') : q === 1 ? m1(2 * n, 'count-side', '側面の たての辺(' + n + ' 本)を 数え忘れていないかな') : m1(n, 'count-base', '上の面と 下の面の 両方の頂点を 数えよう')]
      : [q === 0 ? m1(n, 'count-base', '底面を 数え忘れていないかな') : q === 1 ? m1(n, 'count-side', '底面の辺と、頂点に集まる辺の 両方を 数えよう') : m1(n, 'count-apex', 'いちばん上の 1点を 数え忘れていないかな')];
    mis.push(m1(cnt[(q + 1) % 3], 'count-which', 'それは ' + ['面', '辺', '頂点'][(q + 1) % 3] + 'の数。' + what + 'を 数えよう'));
    return {
      text: '図の' + kn + 'の ' + what + 'の数を求めよ。', fig: Object.assign({}, S), form: '□', answers: [ans], num: [[S.faces.length, S.edges.length, Object.keys(S.verts).length][q]],
      hint: prism ? 'n 角柱:面 n+2、辺 3n、頂点 2n(図で 数えてもよい)' : 'n 角錐:面 n+1、辺 2n、頂点 n+1(図で 数えてもよい)',
      explain: [prism ? '底面が 2つ、側面が ' + n + ' 個' : '底面が 1つ、側面が ' + n + ' 個、頂点が 上に 1つ', kn + 'は 面 ' + cnt[0] + '、辺 ' + cnt[1] + '、頂点 ' + cnt[2], what + 'の数は ' + ans],
      mistakes: U.mistakes([ans], mis)
    };
  }
};
types['rp-count'] = {
  name: '正多面体の 頂点・辺・1つの頂点に集まる面の数', level: 0,
  gen: function (R) {
    const v = R.pick(RP), S = regular(v[1]), E = v[1] * v[3] / 2, V = v[1] * v[3] / v[4], q = R.int(0, 2), what = ['頂点の数', '辺の数', '1つの頂点に集まる面の数'][q], ans = N([V, E, v[4]][q]);
    const deg = {}; S.edges.forEach(function (e) { deg[e[0]] = (deg[e[0]] || 0) + 1; });
    return {
      text: v[0] + '(面は ' + v[2] + 'で ' + v[1] + ' 個)の ' + what + 'を求めよ。', fig: S, form: '□', answers: [ans], num: [[Object.keys(S.verts).length, S.edges.length, deg.v0][q]],
      hint: '辺の数 = (1つの面の辺の数 × 面の数) ÷ 2、頂点の数 = (1つの面の頂点の数 × 面の数) ÷ (1つの頂点に集まる面の数)',
      explain: [v[0] + 'は ' + v[2] + 'が 1つの頂点に ' + v[4] + ' 個ずつ 集まる', '辺 = ' + v[3] + '×' + v[1] + '÷2 = ' + E + '、頂点 = ' + v[3] + '×' + v[1] + '÷' + v[4] + ' = ' + V, what + 'は ' + ans],
      mistakes: U.mistakes([ans], [
        q === 0 ? m1(v[1], 'rp-swap', 'それは 面の数。正十二面体(頂点 20)と 正二十面体(頂点 12)は 入れかわりやすいよ') : null,
        q === 1 ? m1(v[1] * v[3], 'edge-double', '1本の辺は 2つの面に 共有されている。2 で割ろう') : null,
        q === 0 ? m1(v[1] * v[3], 'vertex-nodiv', '1つの頂点は ' + v[4] + ' つの面に 共有されている。' + v[4] + ' で割ろう') : null,
        q === 2 ? m1(v[3], 'rp-which', 'それは 1つの面の辺の数。1つの頂点に 面が いくつ集まるかを 答えよう') : null,
        q === 1 ? m1(V, 'count-which', 'それは 頂点の数だよ') : null, q === 0 ? m1(E, 'count-which', 'それは 辺の数だよ') : null])
    };
  }
};
const EUL = [[4, 6, 4], [8, 12, 6], [6, 12, 8], [20, 30, 12], [12, 30, 20], [6, 9, 5], [10, 15, 7], [5, 8, 5], [7, 12, 7], [12, 18, 8], [9, 16, 9], [60, 90, 32], [24, 36, 14]];      // [頂点, 辺, 面]
types['euler'] = {
  name: 'オイラーの多面体定理', level: 0,
  gen: function (R) {
    const t = R.pick(EUL), q = R.int(0, 2), nm = ['頂点', '辺', '面'], g = [0, 1, 2].filter(function (i) { return i !== q; }), ans = N(t[q]);
    const w = q === 0 ? [t[1] + t[2] - 2, t[1] - t[2] - 2] : q === 1 ? [t[0] + t[2] + 2, t[0] + t[2]] : [t[1] + t[0] - 2, t[1] - t[0] - 2];
    return {
      text: 'へこみのない多面体で、' + nm[g[0]] + 'の数が ' + t[g[0]] + '、' + nm[g[1]] + 'の数が ' + t[g[1]] + ' である。' + nm[q] + 'の数を求めよ。', form: '□', answers: [ans],
      verify: function (v) { const c = t.slice(); c[q] = v[0]; return c[0] - c[1] + c[2] === 2; },
      hint: 'オイラーの多面体定理:(頂点の数) - (辺の数) + (面の数) = 2',
      explain: ['(頂点) - (辺) + (面) = 2', q === 0 ? 'v - ' + t[1] + ' + ' + t[2] + ' = 2' : q === 1 ? t[0] + ' - e + ' + t[2] + ' = 2' : t[0] + ' - ' + t[1] + ' + f = 2', nm[q] + 'の数は ' + ans],
      mistakes: U.mistakes([ans], [m1(w[0], 'euler-sign', '符号に注意。(頂点) - (辺) + (面) = 2 だよ'), m1(w[1], 'euler-sign', '符号と 右辺の 2 を 確かめよう。(頂点) - (辺) + (面) = 2')])
    };
  }
};

/* ==================== 接弦の洞窟 ==================== */
types['tc-tri'] = {
  name: '接弦定理 + 三角形の内角の和', level: 1,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(6, 12) * 5, R.int(8, 14) * 5]; }, function (v) { return v[0] + v[1] <= 140; }, [50, 60]), al = v[0], be = v[1], x = 180 - al - be;
    const sc = tangentScene(), A = sc.A, B = cp(270 + 2 * al), C = cp(270 + 2 * al + 2 * x), ans = N(x);
    return {
      text: '直線 ST は 点 A で 円に接している。∠BAT = ' + al + '°、∠ABC = ' + be + '° のとき、x の値を求めよ。',
      fig: geo(sc.items.concat([{ t: 'poly', pts: [A, B, C] }, ang(A, sc.T, B, al + '°'), ang(B, C, A, be + '°'), ang(A, B, C, 'x', true), pnt(B, 'B'), pnt(C, 'C')])),
      form: 'x = □°', answers: [ans], num: [G.angleDeg(A, B, C)],
      hint: TC_HINT + '。まず ∠ACB を 求めよう',
      explain: ['接弦定理より ∠ACB = ∠BAT = ' + al + '°', '三角形の内角の和より x = 180° - ' + al + '° - ' + be + '°', 'x = ' + x + '°'],
      mistakes: U.mistakes([ans], [m1(al, 'tc-stop', 'それは ∠ACB。三角形の内角の和を使って ∠BAC を 求めよう'), m1(180 - al, 'tri-sum', '∠ABC = ' + be + '° も 引こう(内角の和は 180°)'),
        m1(180 - 2 * be, 'tc-other-side', '∠BAT と等しいのは ∠ACB(∠ABC ではない)。角の内部にある弧を 確かめよう')])
    };
  }
};
types['tc-iso'] = {
  name: '接弦定理 + 二等辺三角形', level: 1,
  gen: function (R) {
    const al = R.int(3, 7) * 10, x = (180 - al) / 2, sc = tangentScene(), A = sc.A, B = cp(270 + 2 * al), C = cp(270 + 2 * al + 180 - al), ans = N(x);
    return {
      text: '直線 ST は 点 A で 円に接している。AC = BC、∠BAT = ' + al + '° のとき、x の値を求めよ。',
      fig: geo(sc.items.concat([{ t: 'poly', pts: [A, B, C] }, ang(A, sc.T, B, al + '°'), ang(B, C, A, 'x', true), pnt(B, 'B'), pnt(C, 'C')])),
      form: 'x = □°', answers: [ans], num: [G.angleDeg(B, C, A)],
      hint: TC_HINT + '。AC = BC だから ∠CAB = ∠CBA',
      explain: ['接弦定理より ∠ACB = ∠BAT = ' + al + '°', 'AC = BC より ∠CAB = ∠CBA = x', 'x = (180° - ' + al + '°) ÷ 2 = ' + x + '°'],
      mistakes: U.mistakes([ans], [m1(al, 'tc-stop', 'それは ∠ACB。AC = BC を使って 底角を 求めよう'), m1(180 - al, 'iso-half', '底角は 2つある。2 で割ろう'), m1(90 - al, 'tc-complement', '(180° - ' + al + '°) を 2 で割るよ。90° から引くのではない')])
    };
  }
};
types['tc-xy'] = {
  name: '図の中の 2つの角 x、y を求める', level: 2,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(6, 12) * 5, R.int(7, 14) * 5]; }, function (v) { return v[0] !== v[1] && v[0] + v[1] <= 150; }, [40, 65]), al = v[0], be = v[1];
    const sc = tangentScene(), A = sc.A, B = cp(270 + 2 * al), C = cp(270 - 2 * be), ans = [N(al), N(be)];
    return {
      text: '直線 ST は 点 A で 円に接している。∠BAT = ' + al + '°、∠CAS = ' + be + '° のとき、x、y の値を求めよ。',
      fig: geo(sc.items.concat([{ t: 'poly', pts: [A, B, C] }, ang(A, sc.T, B, al + '°'), ang(A, C, sc.S, be + '°'), ang(C, A, B, 'x', true), ang(B, C, A, 'y', true), pnt(B, 'B'), pnt(C, 'C')])),
      form: 'x = □°、y = □°', answers: ans, num: [G.angleDeg(C, A, B), G.angleDeg(B, C, A)],
      hint: '∠BAT の内部にある弧は 弧 AB、∠CAS の内部にある弧は 弧 AC。それぞれの弧に対する円周角は どれかな',
      explain: ['∠BAT の内部にある弧 AB に対する円周角は ∠ACB', '∠CAS の内部にある弧 AC に対する円周角は ∠ABC', 'x = ' + al + '°、y = ' + be + '°'],
      mistakes: U.mistakes(ans, [{ answers: [N(be), N(al)], tag: 'tc-swap', msg: 'x と y が 逆だよ。それぞれの角の「内部にある弧」に対する円周角を 選ぼう' },
        { answers: [N(al), N(180 - al - be)], tag: 'tc-straight', msg: 'y は ∠ABC。∠BAC(= 180° - ' + al + '° - ' + be + '°)と 取りちがえていないかな' }], [])
    };
  }
};
types['tc-ext'] = {
  name: '接弦定理 + 中心角・半径', level: 2,
  gen: function (R) {
    const k = R.int(0, 2), al = R.int(6, 13) * 5, sc = tangentScene(), A = sc.A, B = cp(270 + 2 * al);
    const base = sc.items.concat([{ t: 'seg', a: A, b: B }, { t: 'seg', a: O, b: A }, { t: 'seg', a: O, b: B }, pnt(B, 'B'), { t: 'point', p: O, label: 'O', pos: 'w' }]);
    if (k === 0) return {
      text: '直線 ST は 点 A で 円 O に接している。∠BAT = ' + al + '° のとき、x(∠AOB)の値を求めよ。', fig: geo(base.concat([ang(A, sc.T, B, al + '°'), ang(O, A, B, 'x', true)])),
      form: 'x = □°', answers: [N(2 * al)], num: [G.angleDeg(O, A, B)], hint: TC_HINT + '。中心角は 円周角の 2倍',
      explain: ['接弦定理より、弧 AB に対する円周角は ' + al + '°', '中心角は 円周角の 2倍', 'x = 2×' + al + '° = ' + 2 * al + '°'],
      mistakes: U.mistakes([N(2 * al)], [m1(al, 'tc-central', '∠AOB は 中心角。円周角(= ∠BAT)の 2倍だよ'), m1(180 - 2 * al, 'tc-ext-tri', 'それは ∠OAB + ∠OBA。∠AOB を 答えよう'), m1(90 - al, 'tc-complement', 'それは ∠OAB。∠AOB は 円周角の 2倍')])
    };
    if (k === 1) return {
      text: '直線 ST は 点 A で 円 O に接している。∠AOB = ' + 2 * al + '° のとき、x(∠BAT)の値を求めよ。', fig: geo(base.concat([ang(O, A, B, 2 * al + '°'), ang(A, sc.T, B, 'x', true)])),
      form: 'x = □°', answers: [N(al)], num: [G.angleDeg(A, sc.T, B)], hint: '弧 AB に対する円周角は 中心角の半分。' + TC_HINT,
      explain: ['弧 AB に対する円周角は 中心角の半分で ' + al + '°', '接弦定理より ∠BAT は その円周角に等しい', 'x = ' + al + '°'],
      mistakes: U.mistakes([N(al)], [m1(2 * al, 'tc-central', '∠BAT と等しいのは 円周角。中心角の 半分だよ'), m1(90 - al, 'tc-complement', 'それは ∠OAB。∠BAT = 90° - ∠OAB'), m1(180 - 2 * al, 'tc-ext-tri', '中心角の半分が 円周角。180° から引くのではないよ')])
    };
    return {
      text: '直線 ST は 点 A で 円 O に接している。∠BAT = ' + al + '° のとき、x(∠OAB)の値を求めよ。', fig: geo(base.concat([ang(A, sc.T, B, al + '°'), ang(A, B, O, 'x', true)])),
      form: 'x = □°', answers: [N(90 - al)], num: [G.angleDeg(A, B, O)], hint: '円の接線は、接点を通る半径に 垂直(OA ⊥ ST)',
      explain: ['OA ⊥ ST より ∠OAT = 90°', 'x = ∠OAT - ∠BAT = 90° - ' + al + '°', 'x = ' + (90 - al) + '°'],
      mistakes: U.mistakes([N(90 - al)], [m1(al, 'tc-radius', '∠OAB は ∠BAT と 等しくないよ。OA ⊥ ST を 使おう'), m1(2 * al, 'tc-central', 'それは 中心角 ∠AOB。∠OAB は 90° - ∠BAT'), m1(180 - al, 'tc-other-side', '∠OAT は 90°。そこから ∠BAT を 引こう')])
    };
  }
};
types['tc-quad'] = {
  name: '接弦定理 + 円に内接する四角形', level: 3,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(5, 11) * 5, R.int(5, 11) * 5]; }, function (v) { return v[0] !== v[1] && v[0] + v[1] <= 110 && v[0] + v[1] !== 90; }, [40, 30]), al = v[0], be = v[1];
    const sc = tangentScene(), A = sc.A, B = cp(270 + 2 * al), D = cp(270 - 2 * be), C = cp(450 + al - be), ans = N(al + be);
    return {
      text: '四角形 ABCD は 円に内接し、直線 ST は 点 A で 円に接している。∠BAT = ' + al + '°、∠DAS = ' + be + '° のとき、x の値を求めよ。',
      fig: geo(sc.items.concat([{ t: 'poly', pts: [A, B, C, D] }, ang(A, sc.T, B, al + '°'), ang(A, D, sc.S, be + '°'), ang(C, D, B, 'x', true), pnt(B, 'B'), pnt(C, 'C'), pnt(D, 'D')])),
      form: 'x = □°', answers: [ans], num: [G.angleDeg(C, B, D)],
      hint: 'まず ∠BAD を 求める(ST は直線)。円に内接する四角形の 向かい合う角の和は 180°',
      explain: ['∠BAD = 180° - ' + al + '° - ' + be + '° = ' + (180 - al - be) + '°', '円に内接する四角形の 向かい合う角の和は 180°', 'x = 180° - ' + (180 - al - be) + '° = ' + ans + '°'],
      mistakes: U.mistakes([ans], [m1(180 - al - be, 'quad-opposite', 'それは ∠BAD。向かい合う角 ∠BCD は 180° から引こう'), m1(al, 'tc-stop', '∠BCD は ∠ACB と ∠ACD を 合わせた角だよ'), m1(be, 'tc-stop', '∠BCD は ∠ACB と ∠ACD を 合わせた角だよ'),
        m1(Math.abs(al - be), 'quad-sum', '引き算ではなく、2つの角を 合わせるよ')])
    };
  }
};
types['tc-para'] = {
  name: '接線と弦が平行(錯角)', level: 3,
  gen: function (R) {
    const th = R.pick([35, 40, 45, 50, 55, 65, 70]), sc = tangentScene(), A = sc.A, B = cp(270 - 2 * th), C = cp(270 + 2 * th), x = 180 - 2 * th, ans = N(x);
    return {
      text: '直線 ST は 点 A で 円に接していて、ST ∥ BC である。∠ACB = ' + th + '° のとき、x の値を求めよ。',
      fig: geo(sc.items.concat([{ t: 'poly', pts: [A, B, C] }, ang(C, A, B, th + '°'), ang(A, C, B, 'x', true), pnt(B, 'B'), pnt(C, 'C')])),
      form: 'x = □°', answers: [ans], num: [G.angleDeg(A, C, B)],
      hint: 'ST ∥ BC だから 錯角が等しい(∠CAT = ∠ACB)。さらに 接弦定理で ∠CAT = ∠ABC',
      explain: ['ST ∥ BC より ∠CAT = ∠ACB = ' + th + '°(錯角)', '接弦定理より ∠ABC = ∠CAT = ' + th + '°', 'x = 180° - ' + th + '° - ' + th + '° = ' + x + '°'],
      mistakes: U.mistakes([ans], [m1(th, 'tc-stop', 'それは ∠CAT や ∠ABC。内角の和から ∠BAC を 求めよう'), m1(180 - th, 'tri-sum', '∠ABC も ' + th + '°。2つとも 引こう'), m1(90 - th, 'tc-complement', '180° から ' + th + '° を 2回 引くよ')])
    };
  }
};

types['tc-triext'] = {
  name: '接弦定理 + 三角形の外角', level: 2,
  gen: function (R) {
    const A = cp(270);
    /* 接線と 直線 CB が 点 P で交わる。∠ACB = al、∠APB = ga、∠ABC = al + ga(△PAB の外角) */
    function scene(al, ga) {
      const B = cp(270 + 2 * al), C = cp(270 - 2 * (al + ga)), P = G.meet(C, B, [-1, -RR], [1, -RR]);
      return { B: B, C: C, P: P, ok: !!P && P[0] > 4 && P[0] < 15 && Math.abs(G.angleDeg(P, A, B) - ga) < 1e-6 && 2 * al + 2 * (al + ga) < 330 };
    }
    const v = pickUntil(function () { return [R.int(6, 10) * 5, R.int(3, 7) * 5]; }, function (v) { return scene(v[0], v[1]).ok; }, [40, 30]);
    const al = v[0], ga = v[1], be = al + ga, sc = scene(al, ga), B = sc.B, C = sc.C, P = sc.P, k = R.int(0, 1), S = [-6.5, -RR];
    const items = [{ t: 'circle', c: O, r: RR }, { t: 'seg', a: S, b: [P[0] + 1.5, -RR] }, { t: 'poly', pts: [A, B, C] }, { t: 'seg', a: B, b: P },
      ang(P, A, B, ga + '°'), ang(C, A, B, k === 0 ? al + '°' : 'x', k === 1), ang(B, C, A, k === 0 ? 'x' : be + '°', k === 0),
      pnt(A, 'A', { away: undefined, pos: 's' }), pnt(B, 'B', { away: undefined, pos: 'ne' }), pnt(C, 'C'), { t: 'point', p: S, label: 'S', pos: 'n', dot: false }, { t: 'point', p: P, label: 'P', pos: 's' }];
    if (k === 0) return {
      text: '直線 SP は 点 A で 円に接し、直線 CB と 点 P で交わっている。∠ACB = ' + al + '°、∠APB = ' + ga + '° のとき、x の値を求めよ。', fig: geo(items), form: 'x = □°', answers: [N(be)], num: [G.angleDeg(B, C, A)],
      hint: TC_HINT + '(∠PAB = ∠ACB)。そのあと △PAB の外角を 考えよう',
      explain: ['接弦定理より ∠PAB = ∠ACB = ' + al + '°', '∠ABC は △PAB の外角だから ∠ABC = ∠PAB + ∠APB', 'x = ' + al + '° + ' + ga + '° = ' + be + '°'],
      mistakes: U.mistakes([N(be)], [m1(al, 'tc-stop', 'それは ∠PAB。∠ABC は △PAB の外角だから、∠APB も 足そう'), m1(180 - al - ga, 'ext-inner', 'それは ∠ABP(△PAB の内角)。求めるのは その外角 ∠ABC だよ'),
        m1(Math.abs(al - ga), 'ext-sign', '外角は、となり合わない 2つの内角の「和」だよ'), m1(180 - al, 'tc-other-side', '∠PAB と等しいのは ∠ACB。そこから 外角を 考えよう')])
    };
    return {
      text: '直線 SP は 点 A で 円に接し、直線 CB と 点 P で交わっている。∠ABC = ' + be + '°、∠APB = ' + ga + '° のとき、x の値を求めよ。', fig: geo(items), form: 'x = □°', answers: [N(al)], num: [G.angleDeg(C, A, B)],
      hint: '∠ABC は △PAB の外角。まず ∠PAB を 求めて、' + TC_HINT.slice(0, 9) + 'の定理を 使おう',
      explain: ['∠ABC は △PAB の外角だから ∠PAB = ' + be + '° - ' + ga + '° = ' + al + '°', '接弦定理より ∠ACB = ∠PAB', 'x = ' + al + '°'],
      mistakes: U.mistakes([N(al)], [m1(be + ga, 'ext-sign', '外角 = となり合わない 2つの内角の和。∠PAB = ∠ABC - ∠APB と 引き算になるよ'), m1(be, 'tc-other-side', '∠ACB と等しいのは ∠PAB(∠ABC ではない)'),
        m1(180 - be - ga, 'ext-inner', '∠ABC は △PAB の「外角」。内角の和の式に そのまま 入れていないかな'), m1(ga, 'tc-stop', 'それは ∠APB。∠PAB = ' + be + '° - ' + ga + '° を 求めよう')])
    };
  }
};

/* ==================== 方べきと2円の塔 ==================== */
types['pw-chord'] = {
  name: '方べき(PB = PA + AB を 先に求める)', level: 1,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(2, 5), R.int(2, 8), R.int(2, 8)]; }, function (v) { const p = v[0] * (v[0] + v[1]); return p % v[2] === 0 && v[2] !== v[0] && v[2] * v[2] < p && p / v[2] <= 14 && (v[0] * v[1]) / v[2] !== p / v[2] - v[2]; }, [2, 7, 3]);
    const a = v[0], m = v[1], c = v[2], b = a + m, s = powOut(a, b, c, R.int(22, 42), 'CD'), x = s.d - c, ans = N(x);
    return {
      text: '円の外部の点 P から 2本の直線を引き、円との交点を 図のように A、B、C、D とする。PA = ' + a + '、AB = ' + m + '、PC = ' + c + ' のとき、CD = x の値を求めよ。', fig: s.fig, form: 'x = □', answers: [ans], keys: ['分数'],
      verify: function (w) { const pd = c + w[0]; return Math.abs(G.dist([s.D[0] / s.d * pd, s.D[1] / s.d * pd], s.cir.c) - s.cir.r) < 1e-6; },
      hint: 'かけるのは「P からの長さ」。まず PB = PA + AB、PD = PC + CD と 表そう',
      explain: ['PB = PA + AB = ' + b + '、PD = ' + c + ' + x', '方べきの定理より ' + a + '·' + b + ' = ' + c + '·(' + c + ' + x)', c + ' + x = ' + s.d + ' より x = ' + ans],
      mistakes: U.mistakes([ans], [{ answers: [F(a * m, c)], tag: 'power-chord', msg: 'PB の代わりに 弦の長さ AB を かけていないかな(PA·AB = PC·CD ではない)' }, m1(s.d, 'power-whole', 'それは PD。CD = PD - PC だよ'),
        { answers: [F(a * b, c * c)], tag: 'power-chord', msg: 'PD = PC + CD。PC·PD = PA·PB から PD を出して、PC を 引こう' }])
    };
  }
};
types['pw-frac-root'] = {
  name: '方べき(答えが 分数・根号)', level: 2,
  gen: function (R) {
    if (R.chance(0.5)) {
      const v = pickUntil(function () { return [R.int(2, 6), R.int(2, 8), R.int(3, 7)]; }, function (v) { return (v[0] * v[1]) % v[2] !== 0 && v[0] * v[1] / v[2] < 9; }, [3, 4, 5]);
      const a = v[0], b = v[1], c = v[2], s = powIn(a, b, c, R.int(50, 130)), ans = F(a * b, c);
      return {
        text: '円の 2つの弦 AB、CD が 点 P で交わっている。PA = ' + a + '、PB = ' + b + '、PC = ' + c + ' のとき、PD = x の値を求めよ。', fig: s.fig, form: 'x = □', answers: [ans], keys: ['√', '分数'],
        verify: function (w) { return Math.abs(G.dist([s.D[0] / s.d * w[0], s.D[1] / s.d * w[0]], s.cir.c) - s.cir.r) < 1e-6; },
        hint: PW_HINT, explain: ['方べきの定理より PA·PB = PC·PD', a + '·' + b + ' = ' + c + '·x', 'x = ' + am(ans)],
        mistakes: U.mistakes([ans], [{ answers: [F(a * c, b)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さだよ(PA·PB = PC·PD)' }, { answers: [F(b * c, a)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さだよ(PA·PB = PC·PD)' },
          { answers: [F(c, a * b)], tag: 'frac-upside', msg: '分母と分子が 逆だよ。x = ' + a + '·' + b + ' ÷ ' + c }])
      };
    }
    const v = pickUntil(function () { const a = R.int(1, 5); return [a, a + R.int(1, 9)]; }, function (v) { const t = Math.round(Math.sqrt(v[0] * v[1])); return t * t !== v[0] * v[1]; }, [2, 9]);
    const a = v[0], b = v[1], s = powTan(a, b, R.pick([0.7, 1, 1.4]), 'PT'), ans = sqrtStr(a * b);
    return {
      text: '点 P から 円に 接線 PT と、円と 2点 A、B で交わる直線を引く。PA = ' + a + '、PB = ' + b + ' のとき、PT = x の値を求めよ。', fig: s.fig, form: 'x = □', answers: [ans], keys: ['√', '分数'], num: [G.dist([0, 0], s.T)],
      hint: '接線のときは PA·PB = PT^2。√ の中は 簡単にしよう',
      explain: ['方べきの定理より PA·PB = PT^2', 'x^2 = ' + a + '·' + b + ' = ' + (a * b), 'x > 0 より x = ' + am(ans)],
      mistakes: U.mistakes([ans], [m1(a * b, 'pt-square', 'それは PT^2 の値。PT は その正の平方根だよ'), { answers: [F(a * b, 2)], tag: 'pt-double', msg: 'PT^2 は PT×2 ではないよ。2乗して ' + (a * b) + ' になる数を 求めよう' },
        { answers: [sqrtStr(a * (b - a))], tag: 'power-chord', msg: 'かけるのは PA と PB。弦の長さ AB を 使っていないかな' }])
    };
  }
};
types['cc-range'] = {
  name: '2つの円の位置関係と 中心間の距離 d の範囲', level: 1,
  gen: function (R) {
    const r1 = R.int(1, 4), R1 = r1 + R.int(1, 4), k = R.int(0, 2), s = R1 + r1, df = R1 - r1;
    const sol = [{ kind: 'between', a: N(df), b: N(s) }, { kind: 'gt', a: N(s) }, { kind: 'lt', a: N(df) }][k], dEx = [R1, s + 2, Math.max(0, df - 1) / 2][k];
    const mis = k === 0 ? [{ sol: { kind: 'lt', a: N(s) }, tag: 'cc-lower', msg: '下側の条件(' + df + ' < d)も 必要。それより近いと 交わらずに 内側に 入ってしまうよ' }, { sol: { kind: 'between', eq: true, a: N(df), b: N(s) }, tag: 'cc-touch', msg: 'ちょうど 和・差に等しいときは「接する」。交わるときは 等号が つかないよ' }, { sol: { kind: 'gt', a: N(df) }, tag: 'cc-lower', msg: '上側の条件(d < ' + s + ')も 必要だよ' }]
      : k === 1 ? [{ sol: { kind: 'gt', a: N(df) }, tag: 'cc-sumdiff', msg: '互いに外部にあるのは、d が 半径の「和」より 大きいとき' }, { sol: { kind: 'gt', eq: true, a: N(s) }, tag: 'cc-touch', msg: 'ちょうど 和に等しいときは 外接する。等号は つかないよ' }, { sol: { kind: 'lt', a: N(s) }, tag: 'ineq-dir', msg: '不等号の向きが 逆だよ。離れているほど d は 大きい' }]
        : [{ sol: { kind: 'lt', a: N(s) }, tag: 'cc-sumdiff', msg: '内部にあるのは、d が 半径の「差」より 小さいとき' }, { sol: { kind: 'lt', eq: true, a: N(df) }, tag: 'cc-touch', msg: 'ちょうど 差に等しいときは 内接する。等号は つかないよ' }, { sol: { kind: 'gt', a: N(df) }, tag: 'ineq-dir', msg: '不等号の向きが 逆だよ。内部に入るほど d は 小さい' }];
    return {
      text: '半径 ' + R1 + ' の円 O と 半径 ' + r1 + ' の円 O\' が ' + ['2点で交わる', '互いに外部にある', '一方が他方の内部にある(接しない)'][k] + 'とき、中心間の距離 d の範囲を求めよ。' + (k === 2 ? '(d ≧ 0 は 書かなくてよい)' : ''),
      fig: twoCircles(R1, r1, dEx), sol: sol, solVar: 'd', shapes: ['between', 'outside', 'gt', 'lt'],
      inside: function (x) { if (x < 0) return k === 2; return k === 0 ? (x > R1 - r1 && x < R1 + r1) : k === 1 ? x > R1 + r1 : x < R1 - r1; },
      hint: 'd を 半径の和 ' + s + ' と 半径の差 ' + df + ' と くらべよう',
      explain: ['半径の和は ' + s + '、半径の差は ' + df, ['2点で交わるのは、d が 差より大きく 和より小さいとき', '互いに外部にあるのは、d が 和より大きいとき', '一方が他方の内部にあるのは、d が 差より小さいとき'][k], M.sol.markup(sol, 'd')],
      mistakes: mis
    };
  }
};
types['cc-tangents'] = {
  name: '共通接線の本数', level: 1,
  gen: function (R) {
    const k = R.int(0, 4), v = relPick(R, k), R1 = v[0], r1 = v[1], d = v[2], n = 4 - k, ans = N(n);
    const cnt = d > R1 + r1 ? 4 : d === R1 + r1 ? 3 : d > Math.abs(R1 - r1) ? 2 : d === Math.abs(R1 - r1) ? 1 : 0;
    return {
      text: '半径 ' + R1 + ' の円 O と 半径 ' + r1 + ' の円 O\' があり、中心間の距離は ' + d + ' である。2つの円の 共通接線は 何本あるか。', fig: twoCircles(R1, r1, d), form: '□ 本', answers: [ans], num: [cnt],
      hint: '位置関係を調べよう。互いに外部 4本、外接 3本、2点で交わる 2本、内接 1本、内部 0本',
      explain: ['半径の和は ' + (R1 + r1) + '、差は ' + (R1 - r1) + '、d = ' + d + ' だから 2つの円は ' + REL[k], '共通接線の本数は 外側から順に 4・3・2・1・0 本', ans + ' 本'],
      mistakes: U.mistakes([ans], [m1(n + 1, 'cc-count', '外接(3本)と 2点で交わる(2本)など、となりの位置関係と 混同していないかな。d を 和・差と くらべよう'), m1(n - 1, 'cc-count', 'となりの位置関係と 混同していないかな。d を 半径の和・差と くらべよう'),
        m1(k, 'cc-count-rev', '数え方が 逆だよ。離れているほど 共通接線は 多い')].filter(function (m) { return +m.answers[0] >= 0 && +m.answers[0] <= 4; }))
    };
  }
};
types['cc-relation'] = {
  name: '半径と d から 位置関係を選ぶ', level: 2,
  gen: function (R) {
    const k = R.int(0, 4), v = relPick(R, k), R1 = v[0], r1 = v[1], d = v[2];
    return {
      text: '半径 ' + R1 + ' の円と 半径 ' + r1 + ' の円があり、中心間の距離は ' + d + ' である。2つの円の位置関係を選べ。',
      choices: REL.map(function (t, i) {
        return { text: t, ok: i === k, tag: Math.abs(i - k) === 2 && (i === 1 || i === 3) && (k === 1 || k === 3) ? 'cc-sumdiff' : 'cc-relation',
          msg: 'd = ' + d + ' を、半径の和 ' + (R1 + r1) + ' と 差 ' + (R1 - r1) + ' と くらべよう。' + (i === 1 ? '外接するのは d = 和 のとき' : i === 3 ? '内接するのは d = 差 のとき' : i === 2 ? '2点で交わるのは 差 < d < 和 のとき' : i === 0 ? '互いに外部にあるのは d > 和 のとき' : '内部にあるのは d < 差 のとき') };
      }),
      verify: function () { return relOf(R1, r1, d) === k; },
      hint: '図を かかなくても、d を 半径の和・差と くらべるだけで 分かる',
      explain: ['半径の和は ' + (R1 + r1) + '、半径の差は ' + (R1 - r1), 'd = ' + d + ' は ' + ['和より大きい', '和に等しい', '差より大きく 和より小さい', '差に等しい', '差より小さい'][k], 'よって 2つの円は ' + REL[k]]
    };
  }
};
types['cc-tanlen'] = {
  name: '共通接線の長さ(三平方の定理)', level: 3,
  gen: function (R) {
    const ext = R.chance(0.4), r1 = R.int(1, 4), R1 = r1 + R.int(1, 4), d = ext ? R1 + r1 : R1 + r1 + R.int(1, 5), sq = d * d - (R1 - r1) * (R1 - r1), ans = sqrtStr(sq);
    const n = [(R1 - r1) / d, Math.sqrt(1 - (R1 - r1) * (R1 - r1) / (d * d))], A = [R1 * n[0], R1 * n[1]], B = [d + r1 * n[0], r1 * n[1]], Oa = [0, 0], Ob = [d, 0];
    const mis = [{ answers: [sqrtStr(d * d + (R1 - r1) * (R1 - r1))], tag: 'tan-pyth', msg: '中心間の距離 d が 斜辺。AB^2 = d^2 - (半径の差)^2 と 引き算になるよ' }, m1(d, 'tan-d', '中心間の距離 そのものではないよ。O\' から OA に 垂線を引いて、直角三角形を作ろう')];
    if (d * d - (R1 + r1) * (R1 + r1) > 0) mis.push({ answers: [sqrtStr(d * d - (R1 + r1) * (R1 + r1))], tag: 'tan-sum', msg: '使うのは 半径の「差」。和ではないよ' });
    else mis.push({ answers: [sqrtStr((R1 + r1) * (R1 + r1) - (R1 - r1))], tag: 'tan-sum', msg: '(半径の差)を 2乗し忘れていないかな' });
    return {
      text: '半径 ' + R1 + ' の円 O と 半径 ' + r1 + ' の円 O\' ' + (ext ? 'が 外接している。' : 'があり、中心間の距離は ' + d + ' である。') + '図のように 共通接線が 2つの円と A、B で接するとき、線分 AB の長さを求めよ。',
      fig: geo([{ t: 'circle', c: Oa, r: R1 }, { t: 'circle', c: Ob, r: r1 }, { t: 'seg', a: Oa, b: Ob }, { t: 'seg', a: Oa, b: A }, { t: 'seg', a: Ob, b: B }, { t: 'seg', a: A, b: B, color: 'acc', w: 2.4, label: 'x' },
        { t: 'right', at: A, a: Oa, b: B }, { t: 'right', at: B, a: Ob, b: A }, { t: 'point', p: A, label: 'A', pos: 'n' }, { t: 'point', p: B, label: 'B', pos: 'n' }, { t: 'point', p: Oa, label: 'O', pos: 's' }, { t: 'point', p: Ob, label: "O'", pos: 's' }]),
      form: 'AB = □', answers: [ans], keys: ['√'], num: [G.dist(A, B)],
      hint: '小さい円の中心 O\' から OA に 垂線を引く。斜辺が 中心間の距離、1辺が 半径の差の 直角三角形が できる',
      explain: [(ext ? '外接するから 中心間の距離は ' + R1 + ' + ' + r1 + ' = ' + d + '。' : '') + 'O\' から OA に垂線を引くと、斜辺 ' + d + '、1辺 ' + (R1 - r1) + ' の直角三角形', 'AB^2 = ' + d + '^2 - ' + (R1 - r1) + '^2 = ' + sq, 'AB = ' + am(ans)],
      mistakes: U.mistakes([ans], mis)
    };
  }
};

/* ==================== 作図の工房(方針を選ぶ・手順を並べる) ==================== */
const ORD1 = [
  ['線分 AB の垂直二等分線', ['2点 A、B を それぞれ中心として、等しい半径の円をかく', '2つの円の交点を P、Q とする', '直線 PQ を引く']],
  ['∠AOB の二等分線', ['点 O を中心とする円をかき、2辺 OA、OB との交点を それぞれ C、D とする', '2点 C、D を それぞれ中心として、等しい半径の円をかき、交点を P とする', '半直線 OP を引く']],
  ['直線 ℓ 上にない点 P を通る ℓ の垂線', ['点 P を中心とする円をかき、直線 ℓ との交点を A、B とする', '2点 A、B を それぞれ中心として、等しい半径の円をかき、交点の 1つを Q とする', '直線 PQ を引く']],
  ['直線 ℓ 上にない点 P を通り ℓ に平行な直線', ['直線 ℓ 上に 点 A をとり、A を中心として 半径 AP の円をかき、ℓ との交点を B とする', '2点 P、B を それぞれ中心として、半径 AP の円をかき、A 以外の交点を Q とする', '直線 PQ を引く']]];
const ORD2 = [
  ['△ABC の外接円', ['辺 AB の垂直二等分線を引く', '辺 BC の垂直二等分線を引き、2本の交点を O とする', '点 O を中心として、半径 OA の円をかく']],
  ['線分 AB を 1：2 に内分する点', ['点 A から 半直線 AX を引き、AX 上に 等しい間隔で 3点 C、D、E を 順にとる', '点 E と 点 B を結ぶ', '点 C を通り 直線 EB に平行な直線を引き、線分 AB との交点を P とする']],
  ['円 O の外部の点 P から 円 O に引いた接線', ['線分 OP の垂直二等分線を引き、線分 OP との交点を M とする', '点 M を中心として 半径 MO の円をかき、円 O との交点を A、B とする', '直線 PA、PB を引く']]];
function orderType(name, level, sets) {
  return { name: name, level: level, gen: function (R) {
    const v = R.pick(sets);
    return { text: v[0] + 'を作図する。手順を 正しい順に 並べよ。', order: v[1],
      hint: '交点に 名前をつける前に、その交点を作る 円や直線を かく。直線を引くのは、通る点が 決まってから',
      explain: v[1].map(function (st, i) { return (i + 1) + '. ' + st; }),
      mistakes: [{ order: [0, 2, 1], tag: 'order-line-first', msg: '最後の手順で使う点が、まだ とれていないよ。交点を とるのが 先' }, { order: [1, 0, 2], tag: 'order-point-first', msg: 'その手順で使う 円や点が まだ かけていないよ。最初の手順を 確かめよう' },
        { order: [2, 0, 1], tag: 'order-line-first', msg: '直線を引くのは、通る点が 決まってから。まず 円をかいて 交点を とろう' }] };
  } };
}
types['sk-order-basic'] = orderType('作図の手順(垂直二等分線・角の二等分線・垂線・平行線)', 1, ORD1);
types['sk-order-adv'] = orderType('作図の手順(外接円・1:2 の内分点・外部の点からの接線)', 2, ORD2);
const CEN = ['3辺の垂直二等分線の交点', '3つの内角の二等分線の交点', '3本の中線の交点', '3つの頂点から 対辺に引いた垂線の交点'];
const CEN_WHY = ['それは 外心。3つの頂点から 等しい距離にある点だよ', 'それは 内心。3つの辺から 等しい距離にある点だよ', 'それは 重心。頂点と 対辺の中点を結ぶ線分(中線)の交点だよ', 'それは 垂心。外心・内心・重心の どれでもないよ'];
types['sk-center'] = {
  name: '外心・内心・重心は どの線の交点か', level: 1,
  gen: function (R) {
    const k = R.int(0, 2), name = ['外心', '内心', '重心'][k], tri = R.pick(['△ABC', '△PQR', '△DEF']);
    const txt = R.pick([tri + ' の' + name + 'を 作図で求めたい。どの線の交点を とればよいか。', tri + ' の' + name + 'は、どの 3本の線の 交点か。', ['3つの頂点から 等しい距離にある点', '3つの辺から 等しい距離にある点', '3本の中線が交わる点'][k] + '(' + tri + ' の' + name + ')を 作図するとき、とるべき交点は どれか。']);
    return {
      text: txt, choices: CEN.map(function (t, i) { return { text: t, ok: i === k, tag: 'center-' + ['gaishin', 'naishin', 'juushin', 'suishin'][i], msg: CEN_WHY[i] }; }),
      hint: ['外心は 3つの頂点から 等しい距離にある点(外接円の中心)', '内心は 3つの辺から 等しい距離にある点(内接円の中心)', '重心は 3本の中線が 交わる点'][k],
      explain: [['2点から等しい距離にある点は、その 2点を結ぶ線分の 垂直二等分線上にある', '角の 2辺から等しい距離にある点は、その角の 二等分線上にある', '頂点と 対辺の中点を結ぶ線分が 中線'][k], 'よって ' + name + 'は ' + CEN[k]]
    };
  }
};
types['sk-two-cond'] = {
  name: '2つの条件を満たす点の求め方', level: 2,
  gen: function (R) {
    const k = R.int(0, 2), nm = R.pick([['A', 'B', 'C'], ['P', 'Q', 'R']]), a = nm[0], b = nm[1], c = nm[2];
    const q = [
      ['2点 ' + a + '、' + b + ' から 等しい距離にあり、しかも ∠' + a + b + c + ' の 2辺から 等しい距離にある点を 作図で求めたい。どの 2本の線の交点を とればよいか。',
        '線分 ' + a + b + ' の垂直二等分線と、∠' + a + b + c + ' の二等分線', [['線分 ' + a + b + ' の垂直二等分線と、線分 ' + b + c + ' の垂直二等分線', 'two-wrong-tool', '「2辺から等しい距離」は 角の二等分線。垂直二等分線は「2点から等しい距離」だよ'],
          ['∠' + a + b + c + ' の二等分線と、∠' + b + c + a + ' の二等分線', 'two-wrong-tool', '「2点から等しい距離」は 垂直二等分線。角の二等分線は「2辺から等しい距離」だよ'], ['線分 ' + a + b + ' の垂直二等分線と、点 ' + c + ' から ' + a + b + ' に引いた垂線', 'two-perp', '垂線は 距離が等しい点の 集まりではないよ']]],
      ['3点 ' + a + '、' + b + '、' + c + ' から 等しい距離にある点を 作図で求めたい。どの 2本の線の交点を とればよいか。',
        '線分 ' + a + b + ' の垂直二等分線と、線分 ' + b + c + ' の垂直二等分線', [['∠' + a + b + c + ' の二等分線と、∠' + b + c + a + ' の二等分線', 'two-wrong-tool', 'それは「3辺から等しい距離」の点(内心)。点から等しい距離は 垂直二等分線だよ'],
          ['線分 ' + a + b + ' の垂直二等分線と、∠' + a + b + c + ' の二等分線', 'two-wrong-tool', '3点とも「点からの距離」。角の二等分線は 使わないよ'], ['△' + a + b + c + ' の 2本の中線', 'center-juushin', '中線の交点は 重心。頂点から 等しい距離とは 限らないよ']]],
      ['△' + a + b + c + ' の 3辺から 等しい距離にある点を 作図で求めたい。どの 2本の線の交点を とればよいか。',
        '∠' + a + b + c + ' の二等分線と、∠' + b + c + a + ' の二等分線', [['線分 ' + a + b + ' の垂直二等分線と、線分 ' + b + c + ' の垂直二等分線', 'two-wrong-tool', 'それは「3頂点から等しい距離」の点(外心)。辺から等しい距離は 角の二等分線だよ'],
          ['△' + a + b + c + ' の 2本の中線', 'center-juushin', '中線の交点は 重心。辺から 等しい距離とは 限らないよ'], ['2つの頂点から 対辺に引いた垂線', 'center-suishin', '垂線の交点は 垂心。辺から 等しい距離とは 限らないよ']]]][k];
    return {
      text: q[0], choices: ch(q[1], q[2]), hint: '2点から等しい距離 → 垂直二等分線。2辺から等しい距離 → 角の二等分線',
      explain: ['2点から等しい距離にある点の集まりは、その 2点を結ぶ線分の 垂直二等分線', '角の 2辺から等しい距離にある点の集まりは、その角の 二等分線', '求める点は ' + q[1] + ' の交点']
    };
  }
};
types['sk-tangent-why'] = {
  name: '外部の点からの接線の作図(中点の決め方・接線になる理由)', level: 2,
  gen: function (R) {
    const k = R.int(0, 2);
    const q = [
      ['円 O の外部の点 P から 円 O に 接線を引く作図では、まず 線分 OP の中点 M をとる。M は どのようにして 求めるか。', '線分 OP の垂直二等分線を引き、線分 OP との交点を とる',
        [['円 O と 線分 OP の交点を とる', 'tan-midpoint', 'それは 中点ではないよ。円 O と OP の交点は、O から 半径の長さだけ 離れた点'], ['点 P を中心として 半径 PO の円をかき、円 O との交点を とる', 'tan-midpoint', 'それでは OP の中点に ならないよ'], ['∠OPA の二等分線を引く', 'tan-midpoint', '角の二等分線では 中点は 決まらないよ']]],
      ['円 O の外部の点 P から 接線を引く作図では、線分 OP の中点 M を中心として 半径 MO の円をかき、円 O との交点を A とする。直線 PA が 円 O の接線になる理由は どれか。', '線分 OP を直径とする円の 円周角だから ∠OAP = 90° となり、PA は 半径 OA に垂直',
        [['MA = MO だから、△MOA が 正三角形になる', 'tan-why', 'MA = MO だけでは 正三角形とは いえないよ。OP が 直径になることを 使おう'], ['接線と弦の作る角が 円周角に等しいから', 'tan-why', 'ここで使うのは「直径に対する円周角は 90°」と「接線は 半径に垂直」だよ'], ['PA = PO だから、△POA が 二等辺三角形になる', 'tan-why', 'PA = PO とは いえないよ。∠OAP が 90° になることを 示そう']]],
      ['円 O の外部の点 P から 接線を引く作図で、線分 OP の中点 M をとったあと、接点を求めるために かく円は どれか。', '点 M を中心とし、半径 MO の円',
        [['点 P を中心とし、半径 PO の円', 'tan-circle', 'OP を「直径」とする円をかくよ。中心は 中点 M'], ['点 O を中心とし、半径 OM の円', 'tan-circle', 'OP を「直径」とする円をかくよ。中心は 中点 M'], ['点 M を中心とし、円 O と同じ半径の円', 'tan-circle', '半径は MO(= MP)。OP が 直径になるように かくよ']]]][k];
    return {
      text: q[0], choices: ch(q[1], q[2]), hint: '線分 OP を直径とする円を かく。直径に対する円周角は 90°',
      explain: ['線分 OP の中点 M を中心とし、半径 MO の円は、OP を直径とする円', 'その円と 円 O の交点 A について ∠OAP = 90°(直径に対する円周角)', 'PA ⊥ OA だから、直線 PA は 円 O の接線']
    };
  }
};
types['sk-ratio'] = {
  name: 'm : n に内分する点の作図(とる点の数と、平行線を通す点)', level: 2,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(1, 5), R.int(1, 5)]; }, function (v) { return v[0] !== v[1] && U.gcd(v[0], v[1]) === 1; }, [2, 3]), m = v[0], n = v[1], ans = [N(m + n), N(m)];
    return {
      text: '線分 AB を ' + m + ' : ' + n + ' に内分する点 P を 作図する。点 A から 半直線 AX を引き、AX 上に A から 等しい間隔で 点をとる。最後の点と B を結び、それに平行な直線を引いて P を決める。',
      form: 'とる点は □ 個、平行線は A から数えて □ 番目の点を通る', answers: ans,
      verify: function (w) { return w[0] > w[1] && w[1] > 0 && w[1] * n === (w[0] - w[1]) * m; },
      hint: 'AP : PB = ' + m + ' : ' + n + ' だから、AB 全体を ' + (m + n) + ' 等分することを 考えよう',
      explain: ['AP : PB = ' + m + ' : ' + n + ' なので、全体を ' + m + ' + ' + n + ' = ' + (m + n) + ' 等分する', '等間隔に ' + (m + n) + ' 個の点をとり、最後の点と B を結ぶ', 'A から ' + m + ' 番目の点を通る平行線が AB と交わる点が P'],
      mistakes: U.mistakes(ans, [{ answers: [N(m + n), N(n)], tag: 'ratio-nth', msg: 'AP のほうが ' + m + ' だから、A から ' + m + ' 番目の点を通すよ(' + n + ' 番目ではない)' }, { answers: [N(m), '*'], tag: 'ratio-count', msg: 'とる点の数は m + n = ' + (m + n) + ' 個。全体を ' + (m + n) + ' 等分するよ' },
        { answers: [N(n), '*'], tag: 'ratio-count', msg: 'とる点の数は m + n = ' + (m + n) + ' 個。全体を ' + (m + n) + ' 等分するよ' }, { answers: [N(Math.max(m, n)), N(Math.min(m, n))], tag: 'ratio-count', msg: 'とる点の数は m + n = ' + (m + n) + ' 個だよ' }], [])
    };
  }
};
types['sk-circle-center'] = {
  name: '円の中心の求め方', level: 2,
  gen: function (R) {
    const t = R.pick(['中心の分からない円がある。この円の中心を 作図で求める方法は どれか。', '円周上の 3点 A、B、C が 分かっている。この円の中心を 作図で求める方法は どれか。', '円の一部(弧)だけが かかれている。もとの円の中心を 作図で求める方法は どれか。']);
    return {
      text: t, choices: ch('円周上に 3点をとり、2本の弦の 垂直二等分線の交点を とる', [['円周上に 3点をとり、2つの角の 二等分線の交点を とる', 'center-naishin', '角の二等分線の交点は 内心。円周上の点から 等しい距離にある点は、弦の垂直二等分線上にあるよ'],
        ['円周上に 2点をとり、その 2点を結ぶ弦の 中点を とる', 'cen-chord-mid', '弦の中点は 円の中心とは 限らないよ(直径のときだけ)。垂直二等分線を 2本 引こう'], ['円周上の 1点で 接線を引き、その接線上の点を とる', 'cen-tangent', '接線の上に 中心は ないよ。中心は どの弦の垂直二等分線の上にも ある']]),
      hint: '円の中心は、円周上の どの点からも 等しい距離にある',
      explain: ['円の中心は、弦の両はしから 等しい距離にある', 'だから 中心は、弦の 垂直二等分線の上にある', '2本の弦の 垂直二等分線の交点が 中心(外接円の中心と 同じ考え方)']
    };
  }
};
types['sk-tangent-at'] = {
  name: '円周上の点での接線の作図', level: 2,
  gen: function (R) {
    const p = R.pick(['A', 'P', 'T']), t = R.pick(['円 O の周上の点 ' + p + ' で、この円に接する直線を 作図する方法は どれか。', '円 O の周上の点 ' + p + ' を通る 接線を 引きたい。どの直線を 作図すればよいか。', '点 ' + p + ' は 円 O の周上にある。' + p + ' を接点とする接線を 作図するときの方針は どれか。']);
    return {
      text: t, choices: ch('点 ' + p + ' を通り、半径 O' + p + ' に垂直な直線を引く', [['線分 O' + p + ' の垂直二等分線を引く', 'tanat-bisector', 'それは O' + p + ' の中点を通る直線。接線は 接点 ' + p + ' を 通るよ'], ['点 ' + p + ' を通り、半径 O' + p + ' に平行な直線を引く', 'tanat-parallel', '接線は 半径に「垂直」。平行な直線は 引けないよ(' + p + ' を通れば O' + p + ' 自身になる)'],
        ['線分 O' + p + ' を直径とする円をかき、円 O との交点と ' + p + ' を結ぶ', 'tanat-outside', 'それは 円の外部の点から 接線を引くときの方法に 似ているけれど、' + p + ' は 円周上の点。半径に垂直な直線を 引けばよい']]),
      hint: '円の接線は、接点を通る半径に 垂直',
      explain: ['円の接線は、接点を通る半径に垂直である', '直線 O' + p + ' を引き、点 ' + p + ' を通る O' + p + ' の垂線を 作図する', 'その垂線が 点 ' + p + ' での接線']
    };
  }
};

/* ==================== 立体の迷宮 ==================== */
types['sp-face-edges'] = {
  name: '面と平行な辺・垂直な辺、面と垂直な面を選ぶ', level: 1,
  gen: function (R) {
    const f = R.pick(CUBE.faces), k = R.int(0, 2), fn = faceName(f);
    if (k === 2) {
      const others = CUBE.faces.filter(function (x) { return x !== f; }), nf = fNormal(CUBE, f);
      const perp = function (x) { return Math.abs(dot(nf, fNormal(CUBE, x))) < 1e-9; };
      return {
        text: '立方体 ABCD-EFGH で、' + fn + ' と 垂直な面を すべて選べ。', fig: Object.assign({}, CUBE, { shade: [f] }), cols: 2,
        choices: others.map(function (x) { return { text: faceName(x), ok: perp(x), tag: 'face-para', msg: faceName(x) + ' は ' + fn + ' と 向かい合う面。平行だよ' }; }),
        verify: function () { return others.filter(perp).length === 4; }, missingMsg: 'えらんだものは 合っている。となり合う面は 4つ あるよ',
        hint: '立方体では、となり合う面は 垂直、向かい合う面は 平行',
        explain: [fn + ' と となり合う面は 4つ あり、どれも 垂直', '向かい合う面 1つは 平行', '垂直な面は ' + others.filter(perp).map(faceName).join('、')]
      };
    }
    const want = k === 0 ? 'para' : 'perp', hit = CUBE.edges.filter(function (x) { return faceEdgeRel(CUBE, f, x) === want; });
    return {
      text: '立方体 ABCD-EFGH で、' + fn + ' と ' + (k === 0 ? '平行な辺' : '垂直な辺') + 'を すべて選べ。', fig: Object.assign({}, CUBE, { shade: [f] }), cols: 4,
      choices: CUBE.edges.map(function (x) {
        const r = faceEdgeRel(CUBE, f, x);
        return { text: x, ok: r === want, tag: 'face-edge-' + r, msg: { on: '辺 ' + x + ' は ' + fn + ' の上にある辺。面上の辺は 平行・垂直には 入れないよ', para: '辺 ' + x + ' は ' + fn + ' と 平行だよ(交わらない)', perp: '辺 ' + x + ' は ' + fn + ' と 垂直だよ' }[r] };
      }),
      verify: function () { return hit.length === 4; }, missingMsg: 'えらんだものは 合っている。全部で 4本 あるよ',
      hint: k === 0 ? '面と平行な辺は、その面と 交わらない辺(面上の辺は 入れない)' : '面と垂直な辺は、その面に つきささる向きの辺',
      explain: [fn + ' の上にある辺は 4本(これは 入れない)', k === 0 ? '向かい合う面の 4本の辺が ' + fn + ' と 平行' : '2つの面を つなぐ 4本の辺が ' + fn + ' と 垂直', (k === 0 ? '平行な辺' : '垂直な辺') + 'は ' + hit.join(', ')]
    };
  }
};
const SPA = [   // 立方体の なす角。['l' 直線 / 'p' 平面, 1つ目, 2つ目, 答え]
  ['l', 'AB', 'EG', 45], ['l', 'AB', 'CG', 90], ['l', 'AC', 'CF', 60], ['l', 'BD', 'EG', 90], ['l', 'AF', 'CH', 90], ['l', 'AB', 'FH', 45], ['l', 'AC', 'DG', 60], ['l', 'AD', 'BF', 90], ['l', 'BG', 'EG', 60],
  ['p', 'ABCD', 'BCGF', 90], ['p', 'ABCD', 'ABGH', 45], ['p', 'AEGC', 'BFHD', 90], ['p', 'EFGH', 'CDEF', 45]];
types['sp-angle'] = {
  name: '2直線・2平面のなす角(立方体)', level: 2,
  gen: function (R) {
    const v = R.pick(SPA), line = v[0] === 'l', a = v[1].split(''), b = v[2].split(''), ans = N(v[3]);
    const val = line ? acute(eDir(CUBE, a), eDir(CUBE, b)) : acute(fNormal(CUBE, a), fNormal(CUBE, b));
    const fig = line ? Object.assign({}, CUBE, { segs: [{ e: a, color: 'acc', dash: false }, { e: b, color: 'acc2', dash: false }] }) : Object.assign({}, CUBE, { shade: [a, b] });
    return {
      text: '立方体 ABCD-EFGH で、' + (line ? '直線 ' + v[1] + ' と 直線 ' + v[2] : '平面 ' + v[1] + ' と 平面 ' + v[2]) + ' のなす角 θ を求めよ。ただし 0° ≦ θ ≦ 90° とする。', fig: fig, form: 'θ = □°', answers: [ans], num: [val],
      hint: line ? '一方の直線を 平行移動して、もう一方と 交わらせてから 角を測る(面の対角線どうしなら 正三角形を さがす)' : '2平面の交線に 垂直な直線を それぞれの平面上に引き、その 2直線のなす角を測る',
      explain: line ? ['ねじれの位置にあるときは、一方を 平行移動して 交わらせる', v[3] === 60 ? '面の対角線 3本で 正三角形が できる' : v[3] === 45 ? '正方形の 辺と対角線のなす角は 45°' : '平行移動すると 垂直に交わる', 'θ = ' + ans + '°']
        : ['2平面の交線に 垂直な直線を、それぞれの平面上に 引く', v[3] === 45 ? '一方は 正方形の辺、もう一方は 正方形の対角線の向き' : 'その 2直線は 垂直に交わる', 'θ = ' + ans + '°'],
      mistakes: U.mistakes([ans], [45, 60, 90].filter(function (x) { return x !== v[3]; }).map(function (x) {
        return m1(x, x === 90 ? 'angle-look' : 'angle-shift', x === 90 ? '見た目で 90° と 決めていないかな。' + (line ? '一方を 平行移動して 交わらせてから 測ろう' : '交線に垂直な 2直線の角を 測ろう') : (line ? '平行移動したあとの 三角形の形(正方形の対角線・正三角形)を 確かめよう' : '交線に垂直な 2直線が どの向きかを 確かめよう'));
      }))
    };
  }
};
types['sp-perp-word'] = {
  name: '「垂直」と「直交」の違い', level: 1,
  gen: function (R) {
    const k = R.int(0, 2);
    const q = [
      ['空間の 2直線が「直交する」とは、どういうことか。', '2直線が 垂直で、しかも 交わっていること', [['2直線のなす角が 90° であること(交わらなくてもよい)', 'perp-word', 'それは「垂直」。交わらなくても 垂直とは いうが、「直交」は 実際に 交わるときだけ'], ['2直線が ねじれの位置にあること', 'perp-word', 'ねじれの位置は「平行でなく、交わりもしない」。直交は 交わっているよ'], ['2直線が 同じ平面上に あること', 'perp-word', '同じ平面上でも、垂直に交わるとは 限らないよ']]],
      ['直線 ℓ が 平面 α に垂直であることを 確かめるには、何を 示せばよいか。', '平面 α 上の 交わる 2直線に、ℓ が 垂直であること', [['平面 α 上の 1本の直線に、ℓ が 垂直であること', 'perp-plane', '1本だけでは 足りないよ。ℓ が ななめに 倒れていても、1本の直線には 垂直になれる'], ['平面 α 上の 平行な 2直線に、ℓ が 垂直であること', 'perp-plane', '平行な 2直線では 足りないよ。「交わる」2直線で 確かめよう'], ['ℓ が 平面 α と 1点で 交わること', 'perp-plane', '交わるだけでは 垂直とは いえないよ']]],
      ['立方体 ABCD-EFGH で、辺 AB と 辺 CG の関係として 正しいものは どれか。', '垂直であるが、交わらないので 直交は していない', [['直交している', 'perp-word', '辺 AB と 辺 CG は 交わらない(ねじれの位置)。直交は 交わるときだけ いうよ'], ['平行である', 'edge-para', '向きが ちがうので 平行ではないよ'], ['垂直でも 平行でも ない', 'angle-shift', 'CG を 平行移動して BF に重ねると、AB と 垂直に交わる。なす角は 90° だよ']]]][k];
    return {
      text: q[0], choices: ch(q[1], q[2]), fig: k === 2 ? Object.assign({}, CUBE, { mark: ['AB', 'CG'] }) : undefined,
      hint: '「垂直」は なす角が 90°(交わらなくても よい)。「直交」は 垂直で、しかも 交わる',
      explain: ['2直線のなす角が 90° のとき「垂直」という(ねじれの位置でも よい)', '垂直な 2直線が 交わるとき「直交する」という', k === 1 ? '直線が平面に垂直 ⇔ 平面上の 交わる 2直線に 垂直' : q[1]]
    };
  }
};
types['sp-prism-rel'] = {
  name: '三角柱での 辺と面の位置関係', level: 2,
  gen: function (R) {
    const k = R.int(0, 2), top = PRISM.faces[0], bot = PRISM.faces[1];
    if (k === 0) {
      const e = R.pick(PRISM.edges), others = PRISM.edges.filter(function (x) { return x !== e; }), hit = others.filter(function (x) { return edgeRel(PRISM, e, x) === 'skew'; });
      return {
        text: '三角柱 ABC-DEF で、辺 ' + e + ' と ねじれの位置にある辺を すべて選べ。', fig: Object.assign({}, PRISM, { mark: [e] }), cols: 4,
        choices: others.map(function (x) { const r = edgeRel(PRISM, e, x); return { text: x, ok: r === 'skew', tag: 'edge-' + r, msg: r === 'para' ? '辺 ' + x + ' は 辺 ' + e + ' と 平行だよ' : '辺 ' + x + ' は 辺 ' + e + ' と 交わっているよ' }; }),
        verify: function () { return hit.length >= 2 && hit.every(function (x) { return x[0] !== e[0] && x[0] !== e[1] && x[1] !== e[0] && x[1] !== e[1]; }); },
        hint: 'ねじれの位置は「平行でなく、交わりもしない」。平行な辺と 交わる辺を 先に のぞこう',
        explain: ['辺 ' + e + ' と 平行な辺、交わる辺を のぞく', 'のこった辺が ねじれの位置', 'ねじれの位置にある辺は ' + hit.join(', ')]
      };
    }
    const f = R.chance(0.5) ? top : bot, want = k === 1 ? 'para' : 'perp', hit = PRISM.edges.filter(function (x) { return faceEdgeRel(PRISM, f, x) === want; }), fn = faceName(f);
    return {
      text: '三角柱 ABC-DEF で、' + fn + ' と ' + (k === 1 ? '平行な辺' : '垂直な辺') + 'を すべて選べ。', fig: Object.assign({}, PRISM, { shade: [f] }), cols: 3,
      choices: PRISM.edges.map(function (x) { const r = faceEdgeRel(PRISM, f, x); return { text: x, ok: r === want, tag: 'face-edge-' + r, msg: { on: '辺 ' + x + ' は ' + fn + ' の上にある辺。面上の辺は 入れないよ', para: '辺 ' + x + ' は ' + fn + ' と 平行だよ', perp: '辺 ' + x + ' は ' + fn + ' と 垂直だよ' }[r] }; }),
      verify: function () { return hit.length === 3; }, missingMsg: 'えらんだものは 合っている。全部で 3本 あるよ',
      hint: '三角柱の 2つの底面は 平行。側面の たての辺は 底面に 垂直',
      explain: [fn + ' の上にある辺 3本は 入れない', k === 1 ? 'もう一方の底面の 3本の辺が ' + fn + ' と 平行' : '2つの底面を つなぐ 3本の辺が ' + fn + ' と 垂直', (k === 1 ? '平行な辺' : '垂直な辺') + 'は ' + hit.join(', ')]
    };
  }
};
types['sp-prism-angle'] = {
  name: '三角柱での 2直線・2平面のなす角', level: 3,
  gen: function (R) {
    const be = R.pick([30, 60, 40, 50, 35, 55]), ab = 5 * Math.cos(be * DEG), h = 5;
    const B = [0, 0], C = [5, 0], A = [ab * Math.cos(be * DEG), ab * Math.sin(be * DEG)], V = { A: [A[0], A[1], h], B: [0, 0, h], C: [5, 0, h], D: [A[0], A[1], 0], E: [0, 0, 0], F: [5, 0, 0] };
    const S = { type: 'solid', verts: V, edges: ['AB', 'BC', 'CA', 'DE', 'EF', 'FD', 'AD', 'BE', 'CF'], faces: [['A', 'B', 'C'], ['D', 'E', 'F'], ['A', 'B', 'E', 'D'], ['B', 'C', 'F', 'E'], ['C', 'A', 'D', 'F']] };
    const items = [['l', 'AB', 'EF', be], ['l', 'AC', 'EF', 90 - be], ['l', 'AB', 'DF', 90], ['p', 'ABED', 'BCFE', be], ['p', 'CADF', 'BCFE', 90 - be], ['l', 'AD', 'BC', 90]], v = R.pick(items), line = v[0] === 'l', a = v[1].split(''), b = v[2].split(''), ans = N(v[3]);
    return {
      text: '三角柱 ABC-DEF で、底面は ∠BAC = 90°、∠ABC = ' + be + '° の直角三角形であり、側面は すべて 底面に垂直である。' + (line ? '直線 ' + v[1] + ' と 直線 ' + v[2] : '平面 ' + v[1] + ' と 平面 ' + v[2]) + ' のなす角 θ を求めよ(0° ≦ θ ≦ 90°)。',
      fig: line ? Object.assign({}, S, { mark: [a, b] }) : Object.assign({}, S, { shade: [a, b] }), form: 'θ = □°', answers: [ans], num: [line ? acute(eDir(S, a), eDir(S, b)) : acute(fNormal(S, a), fNormal(S, b))],
      hint: line ? 'DE ∥ AB、EF ∥ BC、DF ∥ AC。平行移動して 底面の三角形の角に 直そう' : '2つの側面の交線は 底面に垂直。だから なす角は 底面の三角形の角と 同じ',
      explain: line ? ['EF ∥ BC、DF ∥ AC(上下の底面の辺は 平行)', '平行移動すると、底面の △ABC の中の角になる(∠ACB = ' + (90 - be) + '°)', 'θ = ' + ans + '°']
        : ['2つの側面の交線は 底面に垂直', 'なす角は、底面の三角形で その交線が通る頂点の角(∠ACB = ' + (90 - be) + '°)', 'θ = ' + ans + '°'],
      mistakes: U.mistakes([ans], [m1(v[3] === be ? 90 - be : be, 'angle-which', '底面の三角形の どの角に 当たるかを 確かめよう(∠ABC = ' + be + '°、∠ACB = ' + (90 - be) + '°)'), m1(v[3] === 90 ? be : 90, 'angle-look', '見た目で 決めず、平行移動して 底面の三角形の角に 直そう'),
        m1(180 - v[3], 'angle-range', 'なす角は 0° から 90° の範囲で 答えるよ')])
    };
  }
};
types['rp-calc'] = {
  name: '面の数から 辺・頂点の数を計算する', level: 2,
  gen: function (R) {
    const v = R.pick(RP), S = regular(v[1]), E = v[1] * v[3] / 2, V = v[1] * v[3] / v[4], ans = [N(E), N(V)];
    return {
      text: v[0] + 'は、' + v[1] + ' 個の ' + v[2] + 'でできていて、1つの頂点に ' + v[4] + ' つの面が集まる。辺の数と 頂点の数を求めよ。', fig: S, form: '辺 □ 本、頂点 □ 個', answers: ans, num: [S.edges.length, Object.keys(S.verts).length],
      hint: '面ごとに 数えて、重なりの数で 割る。辺は 2つの面に、頂点は ' + v[4] + ' つの面に 共有されている',
      explain: ['辺:' + v[3] + '×' + v[1] + ' = ' + v[1] * v[3] + '、1本の辺は 2つの面に共有されるから ÷2 で ' + E, '頂点:' + v[3] + '×' + v[1] + ' = ' + v[1] * v[3] + '、1つの頂点は ' + v[4] + ' つの面に共有されるから ÷' + v[4] + ' で ' + V, '辺 ' + E + ' 本、頂点 ' + V + ' 個'],
      mistakes: U.mistakes(ans, [{ answers: [N(v[1] * v[3]), '*'], tag: 'edge-double', msg: '1本の辺は 2つの面に 共有されている。2 で割ろう' }, { answers: ['*', N(v[1] * v[3])], tag: 'vertex-nodiv', msg: '1つの頂点は ' + v[4] + ' つの面に 共有されている。' + v[4] + ' で割ろう' },
        { answers: ['*', N(v[1] * v[3] / 2)], tag: 'vertex-nodiv', msg: '頂点は 2 ではなく、集まる面の数 ' + v[4] + ' で割るよ' }, { answers: [N(V), N(E)], tag: 'count-which', msg: '辺の数と 頂点の数が 逆だよ' }, { answers: ['*', N(v[1])], tag: 'rp-swap', msg: 'それは 面の数。頂点の数は 計算で 求めよう' }], [])
    };
  }
};
types['rp-five'] = {
  name: '正多面体の定義と、5種類しかないこと', level: 2,
  gen: function (R) {
    const k = R.int(0, 3);
    if (k === 0) return {
      text: '正多面体の説明として 正しいものは どれか。', choices: ch('すべての面が 合同な正多角形で、どの頂点にも 同じ数の面が集まる、へこみのない多面体',
        [['すべての面が 正多角形である多面体', 'rp-def', '面が 合同であること、どの頂点にも 同じ数の面が 集まることも 必要だよ'], ['すべての辺の長さが 等しい多面体', 'rp-def', '辺の長さだけでは 決まらないよ。面の形と 頂点への集まり方が 条件'], ['面の数が 4、6、8、12、20 の どれかである多面体', 'rp-def', '面の数が 合っていても、正多面体とは 限らないよ(たとえば 四角柱は 面が 6つ)']]),
      hint: '面の形(合同な正多角形)と、頂点への 面の集まり方(どこも 同じ数)の 2つの条件', explain: ['正多面体は、すべての面が 合同な正多角形', 'どの頂点にも 同じ数の面が 集まる(へこみのない多面体)', '正四面体・正六面体・正八面体・正十二面体・正二十面体の 5種類しかない']
    };
    if (k === 1) return {
      text: '面が 正三角形である正多面体を すべて選べ。', cols: 2, choices: RP.map(function (v) { return { text: v[0], ok: v[3] === 3, tag: 'rp-face', msg: v[0] + ' の面は ' + v[2] + 'だよ' }; }),
      verify: function () { return RP.filter(function (v) { return v[3] === 3; }).length === 3; }, missingMsg: 'えらんだものは 合っている。面が正三角形の正多面体は 3種類 あるよ',
      hint: '1つの頂点に 正三角形が 3つ・4つ・5つ 集まる場合が ある(6つだと 平らになる)', explain: ['正三角形が 1つの頂点に 3つ → 正四面体、4つ → 正八面体、5つ → 正二十面体', '6つ集まると 60°×6 = 360° で 平らになり、立体に ならない', '正四面体、正八面体、正二十面体']
    };
    if (k === 2) return {
      text: '正六角形だけを面とする 正多面体が 存在しない理由は どれか。', choices: ch('1つの頂点に 正六角形を 3つ集めると、角の和が 360° になり、平らになってしまうから',
        [['正六角形は 辺の数が 偶数だから', 'rp-why', '辺の数が 偶数かどうかは 関係ないよ(正方形は 4本で 立方体になる)'], ['オイラーの多面体定理が 成り立たないから', 'rp-why', '理由は 1つの頂点に集まる角の和。360° より 小さくないと 立体に ならないよ'], ['正六角形は 合同に かけないから', 'rp-why', '正六角形は 合同に かけるよ。問題は 頂点に集まる角の和']]),
      hint: '1つの頂点に集まる角の和は、360° より 小さくなければ ならない', explain: ['正六角形の 1つの内角は 120°', '1つの頂点には 3つ以上の面が 集まるので、角の和は 120°×3 = 360° 以上', '360° では 平らになり、立体が 作れない']
    };
    return {
      text: '正多面体は 全部で 何種類あるか。また、面の数が いちばん多いものは どれか。正しい組み合わせを選べ。', choices: ch('5種類で、面の数が いちばん多いのは 正二十面体',
        [['5種類で、面の数が いちばん多いのは 正十二面体', 'rp-swap', '正十二面体は 面が 12。正二十面体は 面が 20 だよ'], ['6種類で、面の数が いちばん多いのは 正二十面体', 'rp-five', '正多面体は 正四・正六・正八・正十二・正二十面体の 5種類だけ'], ['無数にあり、面の数は いくらでも 多くできる', 'rp-five', '正多角形は 無数にあるけれど、正多面体は 5種類だけ']]),
      hint: '1つの頂点に集まる角の和が 360° より小さい、という条件から 5種類に かぎられる', explain: ['正三角形が 3・4・5 つ集まる → 正四面体・正八面体・正二十面体', '正方形が 3つ → 正六面体、正五角形が 3つ → 正十二面体', '合わせて 5種類。面の数が いちばん多いのは 正二十面体']
    };
  }
};
types['rp-tetra'] = {
  name: '立方体の中の正四面体', level: 2,
  gen: function (R) {
    const k = R.int(0, 2), fig = Object.assign({}, CUBE, { segs: ['AC', 'AF', 'AH', 'CF', 'CH', 'FH'].map(function (e) { return { e: e, color: 'acc', dash: false }; }) });
    if (k === 2) {
      const a = R.int(2, 6);
      return {
        text: '1辺の長さが ' + a + ' の立方体 ABCD-EFGH で、4つの頂点 A、C、F、H を結ぶと 正四面体ができる。この正四面体の 1辺の長さを求めよ。', fig: fig, form: '□', answers: [a + '√2'], keys: ['√'], num: [len(eDir(M.solids.cuboid(a, a, a), ['A', 'C']))],
        hint: '正四面体の辺は、立方体の どの線分に なっているかな', explain: ['正四面体 ACFH の辺は、どれも 立方体の面(正方形)の対角線', '1辺 ' + a + ' の正方形の対角線は ' + a + '√2', '1辺の長さは ' + a + '√2'],
        mistakes: U.mistakes([a + '√2'], [m1(a, 'tetra-edge', '正四面体の辺は 立方体の辺ではなく、面の対角線だよ'), { answers: [a + '√3'], tag: 'tetra-edge', msg: 'それは 立方体の対角線(頂点から 反対の頂点まで)。使うのは 面の対角線' }, m1(2 * a, 'tetra-edge', '正方形の対角線は 1辺の √2 倍だよ')])
      };
    }
    const q = k === 0
      ? ['立方体 ABCD-EFGH の 4つの頂点 A、C、F、H を結んだ四面体が 正四面体になる理由は どれか。', '6本の辺が すべて 立方体の面の対角線で、長さが 等しいから',
        [['6本の辺が すべて 立方体の辺と 平行だから', 'tetra-why', '四面体の辺は 立方体の辺と 平行ではないよ。面の対角線に なっている'], ['4つの頂点が 同じ平面上に あるから', 'tetra-why', '同じ平面上にあったら 立体に ならないよ'], ['4つの面が すべて 直角三角形だから', 'tetra-why', '面は 直角三角形ではなく 正三角形。3辺とも 面の対角線で 長さが等しい']]]
      : ['立方体 ABCD-EFGH の 4つの頂点 A、C、F、H を結んだ四面体について、正しいものは どれか。', '4つの面は すべて 合同な正三角形である',
        [['4つの面は すべて 直角二等辺三角形である', 'tetra-why', '3辺とも 正方形の対角線で 長さが等しい。直角三角形ではなく 正三角形だよ'], ['辺の長さは 立方体の 1辺の長さと 等しい', 'tetra-edge', '辺は 面の対角線。立方体の 1辺の √2 倍だよ'], ['辺 AC と 辺 FH は 平行である', 'edge-skew', 'AC と FH は ねじれの位置(上の面と 下の面の、向きの ちがう対角線)だよ']]];
    return {
      text: q[0], fig: fig, choices: ch(q[1], q[2]), hint: 'AC、AF、AH、CF、CH、FH は、それぞれ 立方体の どの線分かな',
      explain: ['AC、AF、AH、CF、CH、FH は、どれも 立方体の面(正方形)の対角線', '正方形の対角線の長さは すべて 等しい', '6辺が等しいので、4つの面は すべて 正三角形 → 正四面体']
    };
  }
};
types['sp-cut-volume'] = {
  name: '立方体から切り取った三角錐の体積と 辺の長さ', level: 3,
  gen: function (R) {
    const k = R.int(0, 2), a = R.int(2, 6), S = M.solids.cuboid(a, a, a), V3 = a * a * a, vol = Math.abs(dot(eDir(S, ['B', 'A']), cross(eDir(S, ['B', 'C']), eDir(S, ['B', 'F'])))) / 6;
    const fig = Object.assign({}, CUBE, { segs: [{ e: 'AC', color: 'acc', dash: false }, { e: 'AF', color: 'acc', dash: false }, { e: 'CF', color: 'acc', dash: false }] });
    const ex = ['BA、BC、BF は たがいに垂直。△ABC を底面、BF を高さとみる', '体積 = {1/3}×({1/2}×a×a)×a = {a^3/6}'];
    if (k === 0) return {
      text: '立方体 ABCD-EFGH から、3点 A、C、F を通る平面で 三角錐 B-ACF を切り取る。この三角錐の体積は、立方体の体積の 何分の 1 か。', fig: fig, form: '{1/□}', answers: ['6'], num: [V3 / vol],
      hint: '△ABC を底面、BF を高さとして 体積を求め、立方体の体積 a^3 と くらべよう', explain: ex.concat(['立方体の体積 a^3 の {1/6}']),
      mistakes: [m1(3, 'vol-half', '底面の三角形の面積は {1/2}×a×a。{1/2} を 忘れていないかな'), m1(2, 'vol-third', '錐の体積は {1/3}×(底面積)×(高さ)。{1/3} を 忘れていないかな'), m1(4, 'vol-third', '{1/3} と {1/2} を かけると {1/6} だよ')]
    };
    if (k === 1) return {
      text: '1辺の長さが ' + a + ' の立方体 ABCD-EFGH から、3点 A、C、F を通る平面で 三角錐 B-ACF を切り取る。この三角錐の体積を求めよ。', fig: fig, form: '□', answers: [F(V3, 6)], keys: ['分数'], num: [vol],
      hint: '△ABC を底面、BF を高さとみる。錐の体積 = {1/3}×(底面積)×(高さ)', explain: ex.concat(['a = ' + a + ' より 体積は ' + am(F(V3, 6))]),
      mistakes: U.mistakes([F(V3, 6)], [{ answers: [F(V3, 2)], tag: 'vol-third', msg: '錐の体積は {1/3}×(底面積)×(高さ)。{1/3} を 忘れていないかな' }, { answers: [F(V3, 3)], tag: 'vol-half', msg: '底面は 直角三角形。面積は {1/2}×' + a + '×' + a + ' だよ' }, m1(V3, 'vol-cube', 'それは 立方体の体積。三角錐は その {1/6}')])
    };
    return {
      text: '立方体 ABCD-EFGH から、3点 A、C、F を通る平面で 三角錐 B-ACF を切り取ると、その体積は ' + am(F(V3, 6)) + ' であった。立方体の 1辺の長さを求めよ。', fig: fig, form: '□', answers: [N(a)], keys: ['分数'], num: [Math.cbrt(6 * vol)],
      hint: '三角錐 B-ACF の体積は、立方体の体積の {1/6}', explain: ['三角錐の体積は 立方体の体積の {1/6}', '立方体の体積 = 6×' + am(F(V3, 6)) + ' = ' + V3, '3乗して ' + V3 + ' になる数は ' + a],
      mistakes: U.mistakes([N(a)], [m1(V3, 'vol-cube', 'それは 立方体の体積。1辺は、3乗して その数になる長さだよ'), { answers: [F(V3, 3)], tag: 'vol-cube', msg: '体積を 3 で割っても 1辺には ならないよ。3乗して ' + V3 + ' になる数を 探そう' }, m1(2 * a, 'vol-third', '三角錐は 立方体の {1/6}。まず 立方体の体積を 求めよう')])
    };
  }
};
const SOC = [   // [名前, [面の形の名前, 辺の数, 面の数], [同], 1つの頂点に集まる面の数]
  ['サッカーボールの形の多面体', ['正五角形', 5, 12], ['正六角形', 6, 20], 3], ['ある多面体', ['正三角形', 3, 4], ['正六角形', 6, 4], 3], ['ある多面体', ['正方形', 4, 6], ['正六角形', 6, 8], 3],
  ['ある多面体', ['正三角形', 3, 8], ['正方形', 4, 6], 4], ['ある多面体', ['正三角形', 3, 8], ['正八角形', 8, 6], 3], ['ある多面体', ['正三角形', 3, 20], ['正五角形', 5, 12], 4]];
types['soccer'] = {
  name: '2種類の正多角形でできた多面体の 辺・頂点の数', level: 3,
  gen: function (R) {
    const v = R.pick(SOC), a = v[1], b = v[2], tot = a[1] * a[2] + b[1] * b[2], E = tot / 2, V = tot / v[3], ans = [N(E), N(V)];
    return {
      text: v[0] + 'は、' + a[2] + ' 個の ' + a[0] + 'と ' + b[2] + ' 個の ' + b[0] + 'でできていて、どの頂点にも ' + v[3] + ' つの面が集まっている。辺の数と 頂点の数を求めよ。', form: '辺 □ 本、頂点 □ 個', answers: ans,
      verify: function (w) { return w[0] * 2 === tot && w[1] * v[3] === tot && w[1] - w[0] + (a[2] + b[2]) === 2; },       // オイラーの多面体定理でも 確かめる
      hint: '面ごとに 辺を数えて 合計し、2 で割る。頂点も 同じ合計を、集まる面の数 ' + v[3] + ' で割る',
      explain: ['面ごとの辺の合計は ' + a[1] + '×' + a[2] + ' + ' + b[1] + '×' + b[2] + ' = ' + tot, '辺は 2つの面に 共有されるから ' + tot + '÷2 = ' + E, '頂点は ' + v[3] + ' つの面に 共有されるから ' + tot + '÷' + v[3] + ' = ' + V],
      mistakes: U.mistakes(ans, [{ answers: [N(tot), '*'], tag: 'edge-double', msg: '1本の辺は 2つの面に 共有されている。2 で割ろう' }, { answers: ['*', N(tot)], tag: 'vertex-nodiv', msg: '1つの頂点は ' + v[3] + ' つの面に 共有されている。' + v[3] + ' で割ろう' },
        { answers: ['*', N(a[2] + b[2])], tag: 'count-which', msg: 'それは 面の数。頂点の数は 計算で 求めよう' }, { answers: [N(V), N(E)], tag: 'count-which', msg: '辺の数と 頂点の数が 逆だよ' }], [])
    };
  }
};

/* ==================== 隠し:失われた定理の地下迷宮(考査範囲外) ==================== */
types['hx-two-tangents'] = {
  name: '発展: 2本の接線の長さ + 接弦定理', level: 5,
  gen: function (R) {
    const th = R.int(2, 8) * 10, x = 90 - th / 2, d = RR / Math.sin(th / 2 * DEG), P = [0, -d], ts = G.tangentFrom(O, RR, P), A = ts[0][0] < ts[1][0] ? ts[0] : ts[1], B = ts[0][0] < ts[1][0] ? ts[1] : ts[0], C = cp(R.pick([70, 90, 110])), ans = N(x);
    return {
      text: '点 P から 円に 2本の接線を引き、接点を A、B とする。点 C は 円周上の点である。∠APB = ' + th + '° のとき、x の値を求めよ。',
      fig: geo([{ t: 'circle', c: O, r: RR }, { t: 'seg', a: P, b: G.lerp(P, A, 1.25) }, { t: 'seg', a: P, b: G.lerp(P, B, 1.25) }, { t: 'poly', pts: [A, B, C] }, ang(P, A, B, th + '°'), ang(C, A, B, 'x', true),
        pnt(A, 'A'), pnt(B, 'B'), pnt(C, 'C'), { t: 'point', p: P, label: 'P', pos: 's' }]),
      form: 'x = □°', answers: [ans], num: [G.angleDeg(C, A, B)],
      hint: '円の外部の点から引いた 2本の接線の長さは 等しい(PA = PB)。△PAB は 二等辺三角形',
      explain: ['PA = PB より ∠PAB = (180° - ' + th + '°) ÷ 2 = ' + x + '°', '接弦定理より ∠ACB = ∠PAB', 'x = ' + x + '°'],
      mistakes: U.mistakes([ans], [m1(th, 'two-tan', '∠ACB は ∠APB と 等しくないよ。PA = PB を 使おう'), m1(180 - th, 'iso-half', '△PAB の底角は 2つある。2 で割ろう'), m1(th / 2, 'two-tan', '∠APB の半分ではなく、(180° - ∠APB) の半分だよ')])
    };
  }
};
const HQ = [[2, 6, 4], [3, 9, 6], [4, 5, 6], [1, 8, 3], [4, 12, 8], [8, 10, 12], [9, 7, 12], [2, 16, 6], [1, 3, 2], [3, 1, 2], [5, 4, 6]].filter(function (v) { return v[0] * (v[0] + v[1]) === v[2] * v[2]; });
types['hx-power-quad'] = {
  name: '発展: 方べきの定理で 2次方程式になる型', level: 5,
  gen: function (R) {
    const v = R.pick(HQ), x = v[0], m = v[1], t = v[2], s = powTan(x, x + m, R.pick([0.7, 1, 1.4]), 'PT'), ans = N(x);
    s.fig.items = s.fig.items.filter(function (it) { return !(it.t === 'seg' && it.label === 'x'); }).concat([{ t: 'seg', a: [0, 0], b: [x, 0], color: 'acc', w: 2.4, label: 'x', side: -1 }]);
    return {
      text: '点 P から 円に 接線 PT と、円と 2点 A、B で交わる直線を引く。PT = ' + t + '、AB = ' + m + ' のとき、PA = x の値を求めよ。', fig: s.fig, form: 'x = □', answers: [ans], keys: ['分数'],
      verify: function (w) { return w[0] > 0 && Math.abs(w[0] * (w[0] + m) - t * t) < 1e-9; },
      hint: 'PB = x + ' + m + '。方べきの定理 PA·PB = PT^2 から、x の 2次方程式を作ろう',
      explain: ['PB = x + ' + m + ' だから x(x + ' + m + ') = ' + t + '^2', 'x^2 + ' + m + 'x - ' + t * t + ' = 0 より (x - ' + x + ')(x + ' + (x + m) + ') = 0', 'x > 0 より x = ' + x],
      mistakes: U.mistakes([ans], [{ answers: [F(t * t, m)], tag: 'power-chord', msg: 'PB の代わりに 弦の長さ AB を かけていないかな。PB = x + ' + m }, m1(x + m, 'quad-root', 'それは PB の長さ。求めるのは PA = x(もう一方の解 -' + (x + m) + ' は 長さにならない)'),
        m1(-(x + m), 'quad-root', '長さは 正の数。x > 0 のほうを 選ぼう')])
    };
  }
};
types['hx-power-twice'] = {
  name: '発展: 方べきの定理を 2回使う型', level: 5,
  gen: function (R) {
    const v = pickUntil(function () { const a = R.int(2, 4); return [a, a + R.int(4, 8), R.int(3, 6), R.int(3, 7)]; }, function (v) { const p = v[0] * v[1]; return p % v[2] === 0 && v[2] !== v[3] && v[2] * v[2] < p && v[3] * v[3] < p && p / v[2] <= 13 && p / v[3] <= 13; }, [2, 9, 3, 4]);
    const a = v[0], b = v[1], c = v[2], e = v[3], p = a * b, d = p / c, f = p / e, x0 = (a + b) / 2, P = [0, 0], A = [a, 0], B = [b, 0];
    function sec(cy, len1, len2, up) {           // 中心 (x0, cy) の円で、P からの 2つの長さが len1、len2 になる向き
      const cen = [x0, cy], rad = Math.hypot((b - a) / 2, cy), L = Math.hypot(x0, cy), t = Math.acos(Math.min(1, (len1 + len2) / 2 / L)), base = Math.atan2(cy, x0), th = up ? base + t : base - t;
      return { cen: cen, rad: rad, u: [Math.cos(th), Math.sin(th)] };
    }
    const hmin = function (l1, l2) { const h2 = (l1 + l2) * (l1 + l2) / 4 - x0 * x0; return Math.sqrt(Math.max(0, h2)) + 1.2; };
    const s1 = sec(hmin(c, d), c, d, true), s2 = sec(-hmin(e, f), e, f, false);
    const C = [c * s1.u[0], c * s1.u[1]], D = [d * s1.u[0], d * s1.u[1]], E = [e * s2.u[0], e * s2.u[1]], Fp = [f * s2.u[0], f * s2.u[1]], ans = F(p, e);
    return {
      text: '2つの円が 2点 A、B で交わっている。直線 AB 上の点 P から、一方の円と C、D で交わる直線と、他方の円と E、F で交わる直線を引く。PC = ' + c + '、PD = ' + d + '、PE = ' + e + ' のとき、PF = x の値を求めよ。',
      fig: geo([{ t: 'circle', c: s1.cen, r: s1.rad }, { t: 'circle', c: s2.cen, r: s2.rad }, { t: 'seg', a: P, b: B }, { t: 'seg', a: P, b: D }, { t: 'seg', a: P, b: Fp, color: 'acc', w: 2.4, label: 'x', side: -1 },
        { t: 'point', p: A, label: 'A', pos: 'se' }, { t: 'point', p: B, label: 'B', pos: 'e' }, pnt(C, 'C', { away: undefined, pos: 'n' }), pnt(D, 'D', { away: undefined, pos: 'n' }), pnt(E, 'E', { away: undefined, pos: 's' }), pnt(Fp, 'F', { away: undefined, pos: 's' }), { t: 'point', p: P, label: 'P', pos: 'w' }]),
      form: 'x = □', answers: [ans], keys: ['分数'],
      verify: function (w) { return Math.abs(G.dist([w[0] * s2.u[0], w[0] * s2.u[1]], s2.cen) - s2.rad) < 1e-6 && Math.abs(G.dist(C, s1.cen) - s1.rad) < 1e-6 && Math.abs(G.dist(D, s1.cen) - s1.rad) < 1e-6; },
      hint: '直線 PAB は 両方の円と 交わっている。PA·PB を「橋わたし」にして、方べきの定理を 2回使おう',
      explain: ['一方の円で PC·PD = PA·PB、他方の円で PE·PF = PA·PB', 'よって PC·PD = PE·PF、つまり ' + c + '·' + d + ' = ' + e + '·x', 'x = ' + am(ans)],
      mistakes: U.mistakes([ans], [{ answers: [F(c * e, d)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さ。PC·PD = PE·PF だよ' }, { answers: [F(d * e, c)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さ。PC·PD = PE·PF だよ' }, m1(c + d - e, 'power-sum', '足し算ではなく かけ算だよ')])
    };
  }
};
types['hx-radius-letter'] = {
  name: '発展: 半径が文字のときの 接する条件・交わる条件', level: 5,
  gen: function (R) {
    const R0 = R.int(2, 5), d = pickUntil(function () { return R.int(1, 9); }, function (x) { return x !== R0; }, R0 + 2), lo = Math.abs(d - R0), hi = d + R0;
    if (R.chance(0.5)) {
      const ans = [N(lo), N(hi)];
      return {
        text: '半径 r の円と 半径 ' + R0 + ' の円があり、中心間の距離は ' + d + ' である。2つの円が 接するような r の値を すべて求めよ。', form: 'r = □, □', answers: ans, unordered: [[0, 1]],
        verify: function (w) { return w[0] !== w[1] && w.every(function (r) { return r > 0 && (Math.abs(r + R0 - d) < 1e-9 || Math.abs(Math.abs(r - R0) - d) < 1e-9); }); },
        hint: '外接する場合(r + ' + R0 + ' = ' + d + ')と、内接する場合(|r - ' + R0 + '| = ' + d + ')の 両方を 調べよう',
        explain: [d > R0 ? '外接するとき r + ' + R0 + ' = ' + d + ' より r = ' + lo : '内接するとき(r のほうが小さい)' + R0 + ' - r = ' + d + ' より r = ' + lo, '内接するとき(r のほうが大きい)r - ' + R0 + ' = ' + d + ' より r = ' + hi, 'r = ' + lo + ', ' + hi],
        mistakes: U.mistakes(ans, [{ answers: [N(lo), N(d)], tag: 'cc-letter', msg: '内接は r - ' + R0 + ' = ' + d + '(r のほうが大きい場合)も ある。r = ' + hi + ' を 忘れていないかな' }, { answers: [N(hi), N(d)], tag: 'cc-letter', msg: '半径の大小が 2通りある。|r - ' + R0 + '| = ' + d + ' と r + ' + R0 + ' = ' + d + ' を 両方 調べよう' },
          { answers: [N(d), N(R0)], tag: 'cc-letter', msg: 'd と 半径の「和」「差」を 等しいとおいて、r の式を 解こう' }], [[0, 1]])
      };
    }
    const sol = { kind: 'between', a: N(lo), b: N(hi) };
    return {
      text: '半径 r の円と 半径 ' + R0 + ' の円があり、中心間の距離は ' + d + ' である。2つの円の 共通接線が ちょうど 2本になるような r の範囲を求めよ。', sol: sol, solVar: 'r', shapes: ['between', 'outside', 'gt', 'lt'],
      inside: function (r) { return r > 0 && Math.abs(r - R0) < d && d < r + R0; },
      hint: '共通接線が 2本になるのは、2点で交わるとき。|r - ' + R0 + '| < ' + d + ' < r + ' + R0 + ' を 解こう',
      explain: ['共通接線が 2本 ⇔ 2つの円が 2点で交わる ⇔ |r - ' + R0 + '| < ' + d + ' < r + ' + R0, d + ' < r + ' + R0 + ' より r > ' + (d - R0) + '、|r - ' + R0 + '| < ' + d + ' より ' + (R0 - d) + ' < r < ' + hi, M.sol.markup(sol, 'r')],
      mistakes: [{ sol: { kind: 'lt', a: N(hi) }, tag: 'cc-lower', msg: '下側の条件(r > ' + lo + ')も 必要だよ' }, { sol: { kind: 'gt', a: N(lo) }, tag: 'cc-lower', msg: '上側の条件(r < ' + hi + ')も 必要だよ' },
        { sol: { kind: 'between', eq: true, a: N(lo), b: N(hi) }, tag: 'cc-touch', msg: 'ちょうど 等しいときは 接する(共通接線は 1本か 3本)。等号は つかないよ' }]
    };
  }
};
const PLANE = [['1直線上にない 3点', true, ''], ['交わる 2直線', true, ''], ['平行な 2直線', true, ''], ['1直線と、その直線上にない 1点', true, ''],
  ['1直線上にある 3点', false, '1直線上の 3点を通る平面は、その直線を軸に 回せるので 無数にあるよ'], ['ねじれの位置にある 2直線', false, 'ねじれの位置の 2直線を 両方ふくむ平面は 存在しないよ'], ['1本の直線', false, '1本の直線を通る平面は、その直線を軸に 回せるので 無数にあるよ'], ['異なる 2点', false, '2点を通る平面は 無数にあるよ(2点を通る直線を 軸に 回せる)']];
types['hx-plane'] = {
  name: '発展: 平面が ただ 1つに決まる条件', level: 5,
  gen: function (R) {
    const tr = R.shuffle(PLANE.filter(function (v) { return v[1]; })).slice(0, R.int(2, 3)), fl = R.shuffle(PLANE.filter(function (v) { return !v[1]; })).slice(0, 5 - tr.length), set = tr.concat(fl);
    return {
      text: 'つぎのうち、それをふくむ平面が ただ 1つに決まるものを すべて選べ。', multi: true,
      choices: set.map(function (v) { return { text: v[0], ok: v[1], tag: 'plane-decide', msg: v[2] }; }),
      verify: function () { return set.filter(function (v) { return v[1]; }).length === tr.length && tr.length >= 2; },
      hint: '平面は「1直線上にない 3点」で ただ 1つに 決まる。ほかの条件も、3点が とれるかどうかで 考えよう',
      explain: ['平面は、1直線上にない 3点で ただ 1つに決まる', '交わる 2直線、平行な 2直線、1直線と その上にない 1点 も、同じことに なる', '決まるのは ' + tr.map(function (v) { return v[0]; }).join('、')]
    };
  }
};
const SPT = ['同じ直線に平行な 2直線は、平行である', '同じ平面に垂直な 2直線は、平行である', '同じ直線に垂直な 2平面は、平行である', '同じ平面に平行な 2平面は、平行である'];
const SPF = [['同じ直線に垂直な 2直線は、平行である', '平面上では 正しいが、空間では 立方体の 1つの頂点に集まる 3辺のように、垂直に交わったり ねじれの位置になったりするよ'],
  ['同じ平面に平行な 2直線は、平行である', '立方体の上の面の 2本の対角線は、どちらも 下の面に平行だが、交わっているよ'], ['同じ平面に垂直な 2平面は、平行である', '立方体の となり合う 2つの側面は、どちらも 底面に垂直だが、交わっているよ'],
  ['交わらない 2直線は、平行である', '空間では、交わらなくても 平行とは 限らない(ねじれの位置)'], ['同じ直線に平行な 2平面は、平行である', '立方体の上の面と 側面は、どちらも ある辺に平行に できるが、交わっているよ']];
types['hx-space-tf'] = {
  name: '発展: 空間での 正誤判定', level: 5,
  gen: function (R) {
    const t = R.pick(SPT), fl = R.shuffle(SPF).slice(0, 3);
    return {
      text: '空間における 直線・平面について、つねに正しいものは どれか。', choices: ch(t, fl.map(function (v) { return [v[0], 'space-tf', v[1]]; })),
      hint: '立方体の 辺や面を使って、成り立たない例(反例)が ないかを さがそう',
      explain: ['「' + t + '」は 空間でも つねに 成り立つ', 'ほかの 3つは、立方体の 辺や面で 反例が 作れる', '平面では 正しくても、空間では ねじれの位置が あるので 注意']
    };
  }
};
types['hx-octa'] = {
  name: '発展: 立方体の中の 正八面体の体積', level: 5,
  gen: function (R) {
    const a = R.pick([2, 3, 4, 5, 6, 8]), h = 2, V = Object.assign({}, CUBE.verts), cs = { P: [2, 2, 4], Q: [2, 2, 0], R: [2, 0, 2], S: [4, 2, 2], T: [2, 4, 2], U: [0, 2, 2] }, ans = F(a * a * a, 6);
    Object.keys(cs).forEach(function (kk) { V[kk] = cs[kk]; });
    const oe = ['PR', 'PS', 'PT', 'PU', 'QR', 'QS', 'QT', 'QU', 'RS', 'ST', 'TU', 'UR'];
    const sc = a / 4, base = len(sub(cs.R, cs.S)) * sc, vol = base * base * (h * sc) / 3 * 2;
    return {
      text: '1辺の長さが ' + a + ' の立方体の、6つの面の 対角線の交点(面の中心)を結ぶと、正八面体ができる。この正八面体の体積を求めよ。',
      fig: { type: 'solid', verts: V, edges: CUBE.edges, faces: CUBE.faces, labels: false, segs: oe.map(function (e) { return { e: e, color: 'acc', dash: false }; }) }, form: '□', answers: [ans], keys: ['分数'], num: [vol],
      hint: '正八面体を、まん中の正方形で 上下 2つの四角錐に 分ける。底面の正方形は、対角線の長さが ' + a,
      explain: ['まん中の正方形の面積は(対角線)×(対角線)÷2 = ' + a + '×' + a + '÷2 = ' + am(F(a * a, 2)), '四角錐 1つの高さは ' + am(F(a, 2)) + '。体積は {1/3}×' + am(F(a * a, 2)) + '×' + am(F(a, 2)) + ' = ' + am(F(a * a * a, 12)), '2つ分で ' + am(ans)],
      mistakes: U.mistakes([ans], [{ answers: [F(a * a * a, 12)], tag: 'octa-half', msg: 'それは 四角錐 1つ分。上下 2つ あるよ' }, { answers: [F(a * a * a, 3)], tag: 'octa-base', msg: 'まん中の正方形は、1辺が ' + a + ' ではなく、対角線が ' + a + '。面積は ' + am(F(a * a, 2)) + ' だよ' },
        { answers: [F(a * a * a, 2)], tag: 'vol-third', msg: '錐の体積は {1/3}×(底面積)×(高さ)。{1/3} を 忘れていないかな' }])
    };
  }
};

/* ==================== 敵の絵 ==================== */
const sprites = {
  koro: { mirror: true, rows: ['........', '........', '....CCCC', '..CCCCCC', '.CCCWWCC', '.CCCWKCC', 'CCCCCCCC', 'CCCCCCCB', 'CCCCCCBB', 'CCCCCCCC', '.CCCCCCC', '.CCBCCCC', '..CCCCCC', '....CCCC', '........', '........'] },
  mogura: { mirror: true, rows: ['........', '........', '....nnnn', '...nNNNN', '..nNNNNN', '..nNKNNN', '..nNNNNP', '.nNNNNPP', '.nNNNNNN', 'GnNNNNNN', 'GGnNNNEE', 'GnNNNEEE', '..nNNEEE', '..nnNNEE', '...nnnnn', '........'] },
  hari: { mirror: true, rows: ['........', '.n.n.n..', 'n.nnnnn.', '.nnNNNNn', 'nnNNNNNN', '.nNNEEEE', 'nnNEEKEE', '.nNEEEEE', 'nnNEEEEP', '.nNNEEEE', '..nNNNEE', '...nnnNN', '....n..n', '........', '........', '........'] },
  pira: { mirror: true, rows: ['........', '.......Y', '......YY', '......YE', '.....YYE', '.....YEE', '....YYEE', '....YEKE', '...YYEEE', '...YEEEE', '..YYEEER', '..YEEEEE', '.YYEEEEE', '.yyyyyyy', '..y...y.', '........'] },
  kyodai: { mirror: true, rows: ['........', '........', '........', '..LLLL..', '.LLLLLL.', '.LKLLKL.', 'LLLLLLLL', 'LLLLLLLL', 'LLRRRRLL', 'LLLLLLLL', '.LLLLLL.', '..LLLL..', '..l..l..', '........', '........', '........'] },
  kumo: { mirror: true, rows: ['........', 'v......v', '.v....v.', '..v..vVV', '...vvVVV', 'vvvvVKVV', '....vVVV', '.vvvVVVW', 'v...vVVV', '..vvvVVV', '.v...vVV', 'v....vvv', '........', '........', '........', '........'] },
  golem: { mirror: true, rows: ['........', '...ggggg', '...gGGGG', '...gGKGG', '...gGGGG', '.ggggggg', 'gGGgGGGG', 'gGGgGGYG', 'gGGgGGGG', '.gg.gGGG', '....gGGG', '....gg.g', '....gG.g', '...ggg.g', '........', '........'] },
  dice: { mirror: true, rows: ['........', '......tT', '....ttTT', '..ttTTTT', '.tTTTTWT', '.tTTKTTT', '.tTTTTTT', '.tTWTTTW', '.tTTTTTT', '.tTTTTTT', '..ttTTWT', '....ttTT', '......tt', '...t....', '..t.....', '........'] },
  mimizuku: { mirror: true, rows: ['..y...y.', '..yy.yy.', '..yYYYYY', '.yYWWWYY', '.yYWKWYO', '.yYWWWYO', '.yYYYYYY', 'yYYEEEEE', 'yYYEyEEE', 'yYYEEEyE', '.yYEEEEE', '..yYYYYY', '...yy.yy', '...OO.OO', '........', '........'] },
  komori: { mirror: true, rows: ['........', 'r......K', 'rr....KK', 'rrr..KRR', 'rrrr.RRR', 'rrrrrRWK', 'rrrrrRRR', 'rr.rrRRR', 'r...rRRW', '.....RRR', '.....R.R', '........', '........', '........', '........', '........'] },
  knight: { mirror: true, rows: ['.....ggg', '....gGGG', '....gKKG', '....gGGG', '.....ggg', '..CCCgGG', '.CWWCgGG', '.CWCCgGG', '.CCCCgGG', '..CC.gGG', '.....gGG', '.....g.g', '.....g.g', '....gg.g', '........', '........'] },
  ring: { mirror: true, rows: ['........', '........', '..YYYY..', '.YY..YY.', 'YY....YY', 'Y..KK..Y', 'Y......Y', 'YY....YY', '.YY..YY.', '..YYYY..', '........', '...Y....', '..Y.....', '........', '........', '........'] },
  kani: { mirror: true, rows: ['.G......', '.GG.....', '..GG....', '...G.RRR', '...RRRRR', '..RRKRRR', '..RRRRRR', '.RRRRRRR', '.RRRRRWW', '..RRRRRR', '.R.RRRRR', 'R..R.RR.', '...R..R.', '........', '........', '........'] },
  robo: { mirror: true, rows: ['....g...', '....g...', '..gggggg', '.gGGGGGG', '.gGYYGGG', '.gGGGGGG', '.ggggggg', '..gGGGGG', '.gGGBGGB', 'gGGGBGGB', 'gGG.GGGG', '.gg.gggg', '....gG.g', '....gG.g', '...ggg.g', '........'] },
  gargoyle: { mirror: true, rows: ['........', 'g....g..', 'gg...gg.', 'ggg..gGG', 'gggggGKG', '.ggggGGG', '..gggGGR', '...ggGGG', '..gggGGG', '.gg.gGGG', '.g..gGGG', '....gG.G', '....gG.G', '...ggg.g', '........', '........'] },
  rei: { mirror: true, rows: ['........', '....pppp', '..pppppp', '.ppppppp', '.pppWKpp', '.ppppppp', 'pppppppp', 'ppppppKK', 'pppppppp', 'pppppppp', '.ppppppp', '.pp.pppp', '..p..pp.', '........', '........', '........'] },
  madoushi: { mirror: true, rows: ['.......b', '......bb', '.....bBB', '....bBBB', '..bbbbbb', '....SSSS', '....SKSS', '....SSSS', '...BBBBB', '..BBBYBB', '.BBBBBBB', '.BB.BBBB', '....BBBB', '....BBBB', '...bbbbb', '........'] },
  b_ryu: { mirror: true, rows: ['............', '..Y.........', '..YY........', '...YY...llll', '...lYlllLLLL', '....lLLLLLLL', '...lLLWWLLLL', '...lLLWKLLLL', '...lLLLLLLLL', '.ll.lLLLLLKK', 'lddllLLLLLLL', 'ldddllLLWLWL',
    'lddddllLLLLL', 'ldddddllllll', 'lddlddlEEEEE', 'ldl.ldlEEEEE', 'll...lLEEEEE', '....lLLEEEEE', '....lLLLEEEE', '...lLLLLLLLL', '...lLLLllLLL', '..lLLLl..lLL', '..lYYYl..lYY', '..lllll..lll'] },
  b_twin: { mirror: true, rows: ['............', '............', '...YYYY.....', '..YY..YY...Y', '.YY....YY.YY', '.Y......YYY.', '.Y......YY..', '.YY....YYY..', '..YY..YY.YY.', '...YYYY...YY', '............', '....BBBBBBBB',
    '...BBBBBBBBB', '..BBBWWBBBBB', '..BBBWKBBBBB', '..BBBBBBBBBB', '..BBBBBBBRRR', '...BBBBBBBBB', '....BBBBBBBB', '..BB.BBBBBBB', '.BB..BBBBBBB', '.B...BB..BBB', '.....BB..BBB', '....bbb..bbb'] },
  b_oyakata: { mirror: true, rows: ['............', '.....nnnnnnn', '....nNNNNNNN', '....nNNNNNNN', '...nnnnnnnnn', '....KSSSSSSS', '....KSWKSSSS', '....KSSSSSSS', '....KGGSSSGG', '....KGGGGGGG', '.G...KGGGGGG', '.GG.KKKGGGGK',
    '.G.GKOOKKKKO', '.G..KOOOOOOO', 'GG..KOOOYOOO', 'G...SKOOOOOO', '.....KOOOYOO', '.....KOOOOOO', '.....KNNNNNN', '.....KNNNNNN', '.....KNN..NN', '.....KNN..NN', '....KKKK..KK', '............'] },
  b_poly: { mirror: true, rows: ['............', '...........W', '..........WT', '.........WTT', '........WTTT', '.......WTTTT', '......WTTTTT', '.....WTTTTTT', '....WTTTTTTt', '...WTTTTTTtt', '..WTTTTWKttt', '.WTTTTTWKttt',
    'WTTTTTTTtttt', 'tTTTTTTttttt', '.tTTTTtttttt', '..tTTttttKKK', '...tTttttttt', '....tttttttt', '.....ttttttt', '......tttttt', '.......ttttt', '........tttt', '.........ttt', '..........tt'] },
  b_maou: { mirror: true, rows: ['.K..........', '.KK.........', '.KvK....KKKK', '..KvK..KvvvV', '..KvvKKvvVVV', '...KvvvvVVVV', '....KvVRRVVV', '....KvVRYVVV', '....KvVVVVVV', '....KvVVKVKV', '.....KvVVVVV', '..KKKKKvvvvv',
    '.KggggKKvvvG', 'KgGGGGgKKKGG', 'KgGGGGGgGGGY', 'KgGgGGGGGGGY', '.KgKgGGGYYYY', '.KvKKgGGGGGY', '.KvK.KgGGGGY', '.KRK.KgGGGGG', '.....KvvVVVV', '....KvvVKKVV', '...KvvVK..KV', '...KKKKK..KK'] },
  b_guard: { mirror: true, rows: ['...........b', '..........bb', '.........bBB', '........bBBB', '.......bBBYB', '......bBBBBB', '.....bBBBBBB', '..bbbbbbbbbb', '.bBBBBBBBBBB', '..bbbbbbbbbb', '....KSSSSSSS', '....KSTKSSSS',
    '....KSSSSSSS', '....KWWWWSSS', '...KKWWWWWWW', '..KbbKWWWWWW', '.KbBBbKWWWWK', 'KbBBBBbKKKKb', 'KbBBYBBBBBBB', 'KbBBBBBBBYBB', 'SKbBBBYBBBBB', '.KbBBBBBBBBB', '.KbBBBBBYBBB', '.KKKKKKKKKKK'] }
};

/* ==================== 敵 ==================== */
const Z = { level: 1, hp: 0.5, atk: 0.6 };
function zako(name, sprite, typesList, o) { return Object.assign({ name: name, sprite: sprite, types: typesList }, Z, o || {}); }
const enemies = {
  // 東の草原(円)
  koro: zako('えんしゅうコロコロ', 'koro', ['tc-basic']),
  mogura: zako('げんモグラ', 'mogura', ['pw-basic']),
  hari: zako('はんけいハリネズミ', 'hari', ['cc-dist']),
  // 西の草原(立体)
  saikoro: zako('サイコロン', 'dice', ['sp-cube-edges']),
  pira: zako('ピラミン', 'pira', ['ph-count']),
  kessho: zako('せいためんクリスタル', 'dice', ['rp-count'], { swap: { T: 'P', t: 'M' } }),
  fukurou: zako('オイラーフクロウ', 'mimizuku', ['euler']),
  // 接弦の洞窟
  komori: zako('せつげんコウモリ', 'komori', ['tc-tri', 'tc-triext'], { level: 3, hp: 1, atk: 1 }),
  kani: zako('にとうへんがに', 'kani', ['tc-iso', 'tc-ext'], { level: 4, hp: 1.2, atk: 1 }),
  kyodai: zako('エックスワイ兄弟', 'kyodai', ['tc-xy', 'tc-quad', 'tc-para'], { level: 5, hp: 1.3, atk: 1 }),
  ryu: { name: '接弦竜セツゲンドラゴ', sprite: 'b_ryu', boss: true, level: 6, hp: 6, atk: 1.2, line: 'このセツゲンドラゴの 接線と弦の角、見切れるか!', types: ['tc-tri', 'tc-triext', 'tc-iso', 'tc-xy', 'tc-ext', 'tc-quad', 'tc-para'] },
  // 作図の工房
  robo: zako('コンパスロボ', 'robo', ['sk-order-basic', 'sk-center'], { level: 5, hp: 1, atk: 1 }),
  jougi: zako('じょうぎ兵', 'knight', ['sk-order-adv', 'sk-two-cond', 'sk-ratio'], { level: 6, hp: 1.2, atk: 1, swap: { C: 'Y', W: 'E' } }),
  karakuri: zako('ないぶんカラクリ', 'robo', ['sk-tangent-why', 'sk-circle-center', 'sk-tangent-at'], { level: 7, hp: 1.3, atk: 1, swap: { G: 'N', g: 'n', B: 'R' } }),
  oyakata: { name: '工房長サクズマイスター', sprite: 'b_oyakata', boss: true, level: 8, hp: 6, atk: 1.2, line: 'わしは 工房長サクズマイスター。手順を まちがえる者に、図は かけん!',
    types: ['sk-order-basic', 'sk-order-adv', 'sk-center', 'sk-two-cond', 'sk-tangent-why', 'sk-ratio', 'sk-circle-center', 'sk-tangent-at'] },
  // 方べきと2円の塔
  golem: zako('ほうべきゴーレム', 'golem', ['pw-chord', 'pw-frac-root'], { level: 8, hp: 1, atk: 1 }),
  ring: zako('ツインサークル', 'ring', ['cc-range', 'cc-tangents', 'cc-relation'], { level: 9, hp: 1.2, atk: 1 }),
  kumo: zako('きょうつうせっせん蜘蛛', 'kumo', ['cc-tanlen', 'pw-frac-root'], { level: 10, hp: 1.3, atk: 1 }),
  twin: { name: '塔の王ホウベキング', sprite: 'b_twin', boss: true, level: 11, hp: 6, atk: 1.2, line: '塔の王ホウベキングの 方べきの力、その身で 味わうがよい!', types: ['pw-chord', 'pw-frac-root', 'cc-range', 'cc-tangents', 'cc-relation', 'cc-tanlen'] },
  // 立体の迷宮
  ghost: zako('ねじれゴースト', 'rei', ['sp-face-edges', 'sp-perp-word', 'sp-prism-rel'], { level: 10, hp: 1, atk: 1 }),
  gargoyle: zako('ちょっこうガーゴイル', 'gargoyle', ['sp-angle', 'sp-prism-angle'], { level: 11, hp: 1.2, atk: 1 }),
  kishi: zako('しめんたい騎士', 'knight', ['rp-calc', 'rp-five', 'rp-tetra', 'sp-cut-volume', 'soccer'], { level: 12, hp: 1.3, atk: 1, swap: { C: 'T', W: 'W', G: 'C', g: 'B' } }),
  poly: { name: '迷宮の主ポリヘドロン', sprite: 'b_poly', boss: true, level: 14, hp: 7, atk: 1.2, line: 'われは 迷宮の主ポリヘドロン。頂点、辺、面……数え落としは ゆるさぬ。',
    types: ['sp-face-edges', 'sp-angle', 'sp-prism-rel', 'sp-prism-angle', 'rp-calc', 'rp-tetra', 'sp-cut-volume', 'soccer'] },
  // 魔王の城(各エリアの上位種)
  g_komori: zako('城の衛兵・ブラッドコウモリ', 'komori', ['tc-triext', 'tc-xy', 'tc-quad', 'tc-para'], { level: 20, hp: 1.2, atk: 1, swap: { r: 'v', R: 'p' } }),
  g_ring: zako('城の衛兵・ダークサークル', 'ring', ['pw-chord', 'pw-frac-root', 'cc-tanlen', 'cc-range'], { level: 20, hp: 1.3, atk: 1, swap: { Y: 'R' } }),
  g_robo: zako('城の衛兵・コンパスロボ改', 'robo', ['sk-order-adv', 'sk-two-cond', 'sk-tangent-why', 'sk-ratio'], { level: 21, hp: 1.3, atk: 1, swap: { G: 'v', g: 'K', Y: 'R', B: 'Y' } }),
  g_gargoyle: zako('城の衛兵・ストーンガーゴイル', 'gargoyle', ['sp-angle', 'sp-prism-angle', 'sp-cut-volume', 'soccer'], { level: 21, hp: 1.4, atk: 1, swap: { G: 'R', g: 'r', R: 'Y' } }),
  maou: { name: '図形魔王ジオメトラ', sprite: 'b_maou', boss: true, level: 23, hp: 8, atk: 1.2, line: 'われこそは 図形魔王ジオメトラ。円も 立体も、すべては わが手の中!', swap: { v: 'b', V: 'B', G: 'C', g: 't' },
    types: ['tc-tri', 'tc-xy', 'pw-chord', 'cc-range', 'cc-tangents', 'sk-order-adv', 'sk-two-cond', 'sp-face-edges', 'rp-calc'],
    phase2: { name: '真・図形魔王ジオメトラ', line: 'ジオメトラの 真のすがた……ここからが 本当の 考査だ!', swap: { v: 'r', V: 'R', G: 'g', g: 'K', R: 'Y' }, types: ['tc-triext', 'tc-quad', 'tc-para', 'pw-frac-root', 'cc-tanlen', 'sk-tangent-why', 'sk-ratio', 'sp-angle', 'sp-prism-angle', 'sp-cut-volume', 'soccer'] } },
  // 隠し
  kage: zako('失われた補助線の影', 'rei', ['hx-two-tangents', 'hx-power-quad'], { level: 25, hp: 1.2, atk: 1, swap: { p: 'v', W: 'R' } }),
  bourei: zako('忘れられた円の亡霊', 'ring', ['hx-power-twice', 'hx-radius-letter'], { level: 26, hp: 1.3, atk: 1, swap: { Y: 'p' } }),
  kataribe: zako('封じられた空間の語り部', 'madoushi', ['hx-plane', 'hx-space-tf', 'hx-octa'], { level: 26, hp: 1.3, atk: 1 }),
  guard: { name: '失われた定理の番人', sprite: 'b_guard', boss: true, level: 28, hp: 7, atk: 1.2, line: 'わたしは 失われた定理の番人。教科書の 外へ ようこそ。覚悟は あるか。', swap: { b: 'v', B: 'p' },
    types: ['hx-two-tangents', 'hx-power-quad', 'hx-power-twice', 'hx-radius-letter', 'hx-plane', 'hx-space-tf', 'hx-octa'] }
};

/* ==================== マップ ==================== */
const maps = {
  town: { bgm: 'town',
    rows: ['TTTTTTTTTTTTTTT', 'T,hhh.,.hhh.,.T', 'T.hih...hch...T', 'T..=.....=....T', 'T..=======....T', 'T.,....=...hhhT', 'T......=...hphT', 'T.k....=....=.T', 'T......======.T', 'T..v...=...,..T', 'T.,....=......T', 'TTTTTTTxTTTTTTT', 'TTTTTTTTTTTTTTT'],
    legend: {
      i: { tile: 'wood', solid: true, npc: { pal: { 1: 'R', 2: 'N', h: 'y' } }, event: { type: 'inn' } },
      c: { tile: 'wood', solid: true, npc: { pal: { 1: 'W', 2: 'W', h: 'g' } }, event: { type: 'church' } },
      p: { tile: 'wood', solid: true, npc: { pal: { 1: 'l', 2: 'N', h: 'K' } }, event: { type: 'shop' } },
      k: { tile: 'grass', solid: true, npc: { pal: { 1: 'Y', 2: 'B', h: 'N' } }, event: { type: 'talk', lines: ['こども「東の草原は 円のモンスター、西の草原は 立体のモンスターが 出るよ!」', 'こども「図は タップすると 大きくなるよ。角度は 見た目で 決めないで、条件から 求めてね」'] } },
      v: { tile: 'grass', solid: true, npc: { pal: { 1: 'p', 2: 'g', h: 'W' } }, event: { type: 'talk', lines: ['長老「作図の工房では、作図そのものは させん。方針と 手順の順番を 問うのじゃ」', '長老「ボスは 目安レベルに 届かぬうちは まず 勝てん。草原で きたえるのじゃ」', '長老「4つの ダンジョンの 主を たおせば、北の 魔王の城の 封印が 解けるという……」'] } },
      x: { tile: 'road', event: { type: 'map', map: 'world', x: 16, y: 13 } } } },
  world: { bgm: 'field',
    rows: [
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^', '^^wwwwwwww^~~~~~~~~~~~^eeeeeeee^^', '^^Lwwwwwww^~~~~~M~~~~~^eeeeeeeG^^', '^^wwwwwwww^~~~~~=~~~~~^eeeeeeee^^', '^wwwwwwwww^~~~~~=~~~~~^eeeeeeeee^', '^wwwwwwwwww~~~~~=~~~~~eeeeeeeeee^',
      '^wwwwwTwwwwwwwww=eeeeeeeeeTeeeee^', '^wwTwwwwwwwwwwww=eeeeeeeeeeeeTee^', '^wwwwwwwwwTwwwww=eeTeeeeeeeeeeee^', '^wwwwwwwwwwwwwww=eeeeeeeeeeeeeee^', '^wwwwwwwwwwww...=...eeeeeeeeeeee^', '^wwwwwwwwwww...s=....eeeeeeTeeee^',
      '^wwwTwwwwwww....H....eeeeeeeeeee^', '^wwwwwwwwwww....=....eeeeeeeeeee^', '^wwwwwwwwwwww...=...eeeeeeeeeeee^', '^wwwwwwTwwwwwwww=eeeeeeeeTeeeeee^', '^wwwwwwwwwwwwwww=eeeeeeeeeeeeeee^', '^TTTwwwwwwwwwwww.eeeeeeeeeee^^^^^',
      '^TTTTwwwwwwwwwww.eeeeeeeeee^^^^^^', '^TTFwwwwwwwwwwww.eeeeeeeeeeeC^^^^', '^TTTTwwwwwwwwwww.eeeeeeeeee^^^^^^', '^TTTTTwwwwwwwwwTTeeeeeeeee^^^^^^^', '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^'],
    legend: {
      e: { tile: 'grass', zone: 'east' }, w: { tile: 'grass2', zone: 'west' },
      H: { tile: 'i_town', event: { type: 'map', map: 'town', x: 7, y: 10 } },
      C: { tile: 'i_cave', event: { type: 'dungeon', id: 'cave' } }, G: { tile: 'i_tower', event: { type: 'dungeon', id: 'tower' } },
      F: { tile: 'house', event: { type: 'dungeon', id: 'koubou' } }, L: { tile: 'i_cave', event: { type: 'dungeon', id: 'rittai' } },
      M: { tile: 'i_castle', event: { type: 'dungeon', id: 'castle' } },
      s: { tile: 'sign', solid: true, event: { type: 'sign', text: '【道しるべ】\n北:魔王の城 / 東:円の草原(接弦の洞窟・方べきと2円の塔)\n西:立体の草原(作図の工房・立体の迷宮)' } } } }
};
const SEAL4 = ['boss:ryu', 'boss:oyakata', 'boss:twin', 'boss:poly'];
const dungeons = {
  cave: { name: '接弦の洞窟', unit: '接線と弦の作る角', level: 3, theme: 'cave', boss: 'ryu', floors: [{ enemies: ['komori', 'kani'] }, { enemies: ['kani', 'kyodai'] }],
    hidden: { need: ['boss:maou'], to: 'meikyu', openText: '接弦の洞窟の 奥で、封印の扉が ひらく 音がした……。' } },
  koubou: { name: '作図の工房', unit: '作図の方針・手順の並べ替え', level: 5, theme: 'koubou', boss: 'oyakata', floors: [{ enemies: ['robo', 'jougi'] }, { enemies: ['jougi', 'karakuri'] }] },
  tower: { name: '方べきと2円の塔', unit: '方べきの定理・2つの円', level: 8, theme: 'tower', boss: 'twin', floors: [{ enemies: ['golem'] }, { enemies: ['golem', 'ring'] }, { enemies: ['ring', 'kumo'] }] },
  rittai: { name: '立体の迷宮', unit: '空間における直線と平面・多面体', level: 10, theme: 'rittai', boss: 'poly', floors: [{ enemies: ['ghost'] }, { enemies: ['ghost', 'gargoyle'] }, { enemies: ['gargoyle', 'kishi'] }] },
  castle: { name: '魔王の城', unit: '全範囲の総合(考査本番レベル)', level: 20, theme: 'castle', boss: 'maou', need: SEAL4,
    needText: '城門は 4つの封印で とざされている。\n4つの ダンジョンの ボスを すべて たおすと ひらくようだ。', openText: '4つの封印が 解けた! 北の 魔王の城の 門が ひらいた!',
    floors: [{ enemies: ['g_komori', 'g_robo'] }, { enemies: ['g_ring', 'g_gargoyle'] }, { enemies: ['g_komori', 'g_ring', 'g_robo', 'g_gargoyle'] }] },
  meikyu: { name: '失われた定理の地下迷宮', unit: '教科書の先の定理(2本の接線・2次方程式になる方べき・平面の決定 など)', level: 25, theme: 'meikyu', boss: 'guard', extra: true,
    floors: [{ enemies: ['kage', 'bourei'] }, { enemies: ['bourei', 'kataribe'] }] }
};

M.registerCourse({
  id: 'suuA-2gakki-kimatsu',
  title: '数学A 2学期期末クエスト',
  subtitle: '接弦定理・方べきの定理・2つの円・作図・空間図形・多面体',
  start: { map: 'town', x: 7, y: 9 },
  intro: ['ここは はじまりの町。', '{n}は 期末考査という 大いなる試練に そなえ、旅に 出ることに した。',
    '町の南から 外に出よう。東の草原は 円、西の草原は 立体の 修行場だ。\n(歩く:行きたい場所を タップ / 図は タップで 大きくなる / 右上の「メニュー」で 十字キーも出せる)'],
  levelCap: { base: 30, extended: 40, extendFlag: 'boss:maou' },
  themes: {
    koubou: { id: 'koubou', floor: 'wood', wall: 'wall_cave', swap: { y: 'E' }, bg: ['#3a2410', '#a85c10', '#503000'] },
    rittai: { id: 'rittai', floor: 'floor_tower', wall: 'wall_castle', swap: { b: 't', v: 'K', V: 'T' }, bg: ['#001c24', '#008888', '#00e8d8'] } },
  zones: { east: { enemies: ['koro', 'mogura', 'hari'] }, west: { enemies: ['saikoro', 'pira', 'kessho', 'fukurou'] } },
  maps: maps, dungeons: dungeons, enemies: enemies, sprites: sprites, types: types,
  /* 称号。name は いつでも変えられる(id と 並び順は 公開後に 変えない) */
  titles: {
    level: [{ lv: 1, name: '見習い製図工' }, { lv: 5, name: '円の旅人' }, { lv: 10, name: '接弦の使い手' }, { lv: 15, name: '方べきの職人' }, { lv: 20, name: '作図の匠' },
      { lv: 25, name: '立体の賢者' }, { lv: 30, name: '数学Aの勇者' }, { lv: 35, name: '図形を統べる者' }, { lv: 40, name: '伝説の一級製図技士' }],
    special: [
      { id: 'cave', name: 'セツゲンドラゴを討ちし者', cond: { boss: 'ryu' } }, { id: 'koubou', name: 'サクズマイスターに認められし者', cond: { boss: 'oyakata' } },
      { id: 'tower', name: 'ホウベキングを退けし者', cond: { boss: 'twin' } }, { id: 'rittai', name: 'ポリヘドロンを見切りし者', cond: { boss: 'poly' } },
      { id: 'maou', name: '魔王ジオメトラを破りし覇者', cond: { boss: 'maou' } }, { id: 'meikyu', name: '失われた定理を継ぐ者', cond: { boss: 'guard' } },
      { id: 'combo10', name: '十連撃の達人', cond: { combo: 10 } }, { id: 'streak7', name: '毎日の求道者', cond: { streak: 7 } }]
  }
});
})();

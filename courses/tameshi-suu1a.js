/* ============================================================
 * 試しのコース: 数学I・数学A で使う 新しい機能の見本
 *   図(円と接線・弦・三角形・見取り図・箱ひげ図・散布図・ヒストグラム)/ 選ぶ / 並べ替え / 小数 / 不等式
 * 本番のコースではない(index.html の一覧には 出さない)。開くときは  index.html?course=tameshi-suu1a
 * 見本の問題は 型の一覧の承認前の「書き方の例」。本番のコースへは そのまま 入れない。
 * ============================================================ */
(function () {
'use strict';
const M = (typeof MathRPG !== 'undefined') ? MathRPG : require('../engine.js');
const U = M.util, am = U.am, F = U.fracStr, G = M.geo;

/* 条件に合う数値が出るまで 引き直す(200 回で打ち切り、安全な値にする) */
function pickUntil(make, ok, fallback) {
  for (let i = 0; i < 200; i++) { const v = make(); if (ok(v)) return v; }
  return fallback;
}
function term(c, body, first) {
  if (c === 0) return '';
  const a = Math.abs(c), s = body ? (a === 1 ? body : a + body) : String(a);
  return first ? (c < 0 ? '-' : '') + s : (c < 0 ? ' - ' : ' + ') + s;
}
function fac(a) { return a === 0 ? 'x' : '(x' + term(-a) + ')'; }      // 因数 (x − a)
/* 相関係数(検算用) */
function corr(pts) {
  const n = pts.length, mx = pts.reduce(function (s, p) { return s + p[0]; }, 0) / n, my = pts.reduce(function (s, p) { return s + p[1]; }, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  pts.forEach(function (p) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) * (p[0] - mx); syy += (p[1] - my) * (p[1] - my); });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

const types = {};

/* ---------- 図(円・接線・弦)+ 数の入力 ---------- */
types['ts-tangent'] = {
  name: '見本: 接線と弦の作る角(図つき)', level: 0,
  gen: function (R) {
    const th = R.int(6, 14) * 5, O = [0, 0], r = 5;
    const A = G.on(O, r, 270), B = G.on(O, r, 270 + 2 * th), C = G.on(O, r, 270 + 2 * th + (360 - 2 * th) * R.pick([0.4, 0.5, 0.6]));
    const tl = G.tangentAt(O, A, 6.5), S = tl[0], T = tl[1];           // A での接線。T は B の側
    const ans = String(th);
    return {
      text: '直線 ST は 点 A で 円に接している。x の値を求めよ。',
      fig: { type: 'geo', items: [
        { t: 'circle', c: O, r: r }, { t: 'seg', a: S, b: T }, { t: 'poly', pts: [A, B, C] },
        { t: 'angle', at: C, a: A, b: B, label: th + '°' }, { t: 'angle', at: A, a: T, b: B, label: 'x', color: 'acc' },
        { t: 'point', p: A, label: 'A', pos: 's' }, { t: 'point', p: B, label: 'B', away: O }, { t: 'point', p: C, label: 'C', away: O },
        { t: 'point', p: S, label: 'S', pos: 'n', dot: false }, { t: 'point', p: T, label: 'T', pos: 'n', dot: false }] },
      form: 'x = □°', answers: [ans], num: [G.angleDeg(A, T, B)],
      hint: '接線と弦の作る角は、その角の内部にある弧に対する円周角に等しい',
      explain: ['接線と弦の作る角の定理', '∠BAT = ∠ACB', 'x = ' + th + '°'],
      mistakes: U.mistakes([ans], [
        { answers: [String(2 * th)], tag: 'tc-central', msg: '等しいのは 円周角。中心角(2倍)と まちがえていないかな?' },
        { answers: [String(90 - th)], tag: 'tc-complement', msg: '90° から引く必要は ないよ。∠BAT は ∠ACB と等しい' },
        { answers: [String(180 - th)], tag: 'tc-supplement', msg: '反対側の角(∠BAS)を 求めていないかな?' }])
    };
  }
};
types['ts-power'] = {
  name: '見本: 方べきの定理(図つき・分数の答え)', level: 0,
  gen: function (R) {
    const a = R.int(2, 6), b = R.int(3, 8), c = R.int(2, 6), phi = R.int(50, 130), u = [Math.cos(phi * Math.PI / 180), Math.sin(phi * Math.PI / 180)], d = a * b / c;
    const P = [0, 0], A = [-a, 0], B = [b, 0], C = [c * u[0], c * u[1]], D = [-d * u[0], -d * u[1]], cir = G.circum(A, B, C), ans = F(a * b, c);
    return {
      text: '円の 2つの弦 AB、CD が 点 P で交わっている。x の値を求めよ。',
      fig: { type: 'geo', items: [
        { t: 'circle', c: cir.c, r: cir.r }, { t: 'seg', a: A, b: B }, { t: 'seg', a: C, b: D },
        { t: 'seg', a: P, b: A, label: a, side: 1, w: 0.1 }, { t: 'seg', a: P, b: B, label: b, side: -1, w: 0.1 }, { t: 'seg', a: P, b: C, label: c, side: 1, w: 0.1 },
        { t: 'seg', a: P, b: D, label: 'x', side: 1, color: 'acc', w: 2.4 },
        { t: 'point', p: A, label: 'A', away: cir.c }, { t: 'point', p: B, label: 'B', away: cir.c }, { t: 'point', p: C, label: 'C', away: cir.c }, { t: 'point', p: D, label: 'D', away: cir.c },
        { t: 'point', p: P, label: 'P', dir: phi > 90 ? 45 : 135 }] },
      form: 'x = □', answers: [ans], keys: ['分数'],
      verify: function (v) { return Math.abs(G.dist([-v[0] * u[0], -v[0] * u[1]], cir.c) - cir.r) < 1e-6; },      // D が 本当に 円周上にあるか
      hint: '方べきの定理:PA·PB = PC·PD(同じ直線上の 2つの長さを かける)',
      explain: ['方べきの定理より PA·PB = PC·PD', a + '·' + b + ' = ' + c + '·x', 'x = ' + am(ans)],
      mistakes: U.mistakes([ans], [
        { answers: [F(a * c, b)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さだよ(PA·PB = PC·PD)' },
        { answers: [F(b * c, a)], tag: 'power-pair', msg: 'かけるのは 同じ直線上の 2つの長さだよ(PA·PB = PC·PD)' },
        { answers: [String(a + b - c)], tag: 'power-sum', msg: '足し算ではなく かけ算だよ(PA·PB = PC·PD)' }])
    };
  }
};

/* ---------- 箱ひげ図・ヒストグラム・小数 ---------- */
types['ts-box'] = {
  name: '見本: 箱ひげ図を読む', level: 0,
  gen: function (R) {
    const v = [5 * R.int(2, 6)]; [R.int(1, 3), R.int(1, 3), R.int(1, 3), R.int(1, 4)].forEach(function (k) { v.push(v[v.length - 1] + 5 * k); });
    const kind = R.int(0, 2), iqr = v[3] - v[1], range = v[4] - v[0];
    const ask = ['四分位範囲', '範囲', '中央値'][kind], ans = String([iqr, range, v[2]][kind]);
    const sorted = v.slice().sort(function (p, q) { return p - q; });
    return {
      text: 'つぎの箱ひげ図から、データの' + ask + 'を求めよ。',
      fig: { type: 'boxplot', rows: [{ v: v }], axis: [Math.floor(v[0] / 10) * 10, Math.ceil(v[4] / 10) * 10 + (v[4] % 10 === 0 ? 10 : 0), 10], minor: 5, unit: '(点)' },
      form: '□', answers: [ans], keys: ['.'], num: [[sorted[3] - sorted[1], sorted[4] - sorted[0], sorted[2]][kind]],
      hint: ['四分位範囲 = 第3四分位数 − 第1四分位数(箱の長さ)', '範囲 = 最大値 − 最小値(ひげの はしから はしまで)', '中央値は 箱の中の線の位置'][kind],
      explain: kind === 0 ? ['箱の左はしが Q1、右はしが Q3', '四分位範囲 = Q3 - Q1 = ' + v[3] + ' - ' + v[1], '= ' + iqr]
        : kind === 1 ? ['ひげの左はしが 最小値、右はしが 最大値', '範囲 = ' + v[4] + ' - ' + v[0], '= ' + range]
          : ['箱の中の線が 中央値(第2四分位数)', '目盛りを読んで ' + v[2]],
      mistakes: U.mistakes([ans], [
        { answers: [String(kind === 0 ? range : iqr)], tag: 'box-range-iqr', msg: '範囲は ひげの はしから はしまで、四分位範囲は 箱の長さだよ' },
        kind === 2 ? { answers: [String((v[1] + v[3]) / 2)], tag: 'box-median', msg: '中央値は 箱のまん中ではなく、箱の中の線の位置だよ' } : null,
        kind === 2 ? { answers: [String((v[0] + v[4]) / 2)], tag: 'box-median', msg: '中央値は 最小値と最大値の平均ではないよ。箱の中の線を読もう' } : null])
    };
  }
};
types['ts-hist'] = {
  name: '見本: ヒストグラムを読む', level: 0,
  gen: function (R) {
    const n = R.int(5, 6), start = 40, freqs = []; for (let i = 0; i < n; i++) freqs.push(R.int(1, 9));
    const i = R.int(0, n - 2), lo = start + 10 * i, sum = freqs[i] + freqs[i + 1], ans = String(sum);
    return {
      text: 'つぎのヒストグラムで、' + lo + '点以上 ' + (lo + 20) + '点未満の人数を求めよ。',
      fig: { type: 'hist', start: start, width: 10, freqs: freqs, xl: '(点)', yl: '(人)' },
      form: '□ 人', answers: [ans], num: [freqs.slice(i, i + 2).reduce(function (s, x) { return s + x; }, 0)],
      hint: lo + '点以上 ' + (lo + 20) + '点未満は、2つの階級を 合わせた範囲',
      explain: [lo + '点以上 ' + (lo + 10) + '点未満が ' + freqs[i] + '人、' + (lo + 10) + '点以上 ' + (lo + 20) + '点未満が ' + freqs[i + 1] + '人', freqs[i] + ' + ' + freqs[i + 1] + ' = ' + sum + '(人)'],
      mistakes: U.mistakes([ans], [
        { answers: [String(freqs[i])], tag: 'hist-one-class', msg: '2つの階級に またがっているよ。となりの階級も 足そう' },
        { answers: [String(freqs[i + 1])], tag: 'hist-one-class', msg: '2つの階級に またがっているよ。となりの階級も 足そう' },
        i + 2 < n ? { answers: [String(sum + freqs[i + 2])], tag: 'hist-boundary', msg: (lo + 20) + '点「未満」だから、' + (lo + 20) + '点からの階級は 入らないよ' } : null])
    };
  }
};
types['ts-median'] = {
  name: '見本: 偶数個のデータの中央値(小数の答え)', level: 0,
  gen: function (R) {
    const data = []; for (let i = 0; i < 6; i++) data.push(R.int(1, 20));
    const s = data.slice().sort(function (p, q) { return p - q; }), med = (s[2] + s[3]) / 2, ans = String(med);
    return {
      text: 'つぎの 6個のデータの中央値を求めよ。', expr: data.join(', '),
      form: '□', answers: [ans], keys: ['.'],
      verify: function (v) { return data.filter(function (x) { return x < v[0]; }).length <= 3 && data.filter(function (x) { return x > v[0]; }).length <= 3 && Math.abs(v[0] * 2 - s[2] - s[3]) < 1e-9; },
      hint: 'まず 小さい順に 並べる。偶数個のときは 中央の 2つの平均',
      explain: ['小さい順に並べると ' + s.join(', '), '中央の 2つは ' + s[2] + ' と ' + s[3], '中央値 = (' + s[2] + ' + ' + s[3] + ') ÷ 2 = ' + ans],
      mistakes: U.mistakes([ans], [
        { answers: [String(s[2])], tag: 'median-one', msg: '偶数個のときは、中央の 2つの平均を とるよ' },
        { answers: [String(s[3])], tag: 'median-one', msg: '偶数個のときは、中央の 2つの平均を とるよ' },
        { answers: [String((data[2] + data[3]) / 2)], tag: 'median-sort', msg: '先に 小さい順に 並べかえよう' }])
    };
  }
};

/* ---------- 散布図 + 選ぶ ---------- */
const SC_FALL = {
  pos: [[1, 2], [2, 1], [2, 3], [3, 3], [4, 3], [4, 5], [5, 4], [5, 6], [6, 6], [7, 6], [7, 8], [8, 7], [8, 9], [9, 8]],
  neg: [[1, 8], [2, 9], [2, 7], [3, 7], [4, 7], [4, 5], [5, 6], [5, 4], [6, 4], [7, 4], [7, 2], [8, 3], [8, 1], [9, 2]],
  none: [[1, 5], [2, 2], [2, 8], [3, 5], [4, 1], [4, 9], [5, 5], [5, 3], [6, 7], [7, 2], [7, 8], [8, 5], [8, 3], [9, 6]]
};
types['ts-scatter'] = {
  name: '見本: 散布図から 相関を選ぶ', level: 0,
  gen: function (R) {
    const kind = R.pick(['pos', 'neg', 'none']);
    const pts = pickUntil(function () {
      const p = [];
      for (let i = 0; i < 14; i++) {
        const x = R.int(1, 9), y = kind === 'none' ? R.int(1, 9) : (kind === 'pos' ? x : 10 - x) + R.int(-2, 2);
        p.push([x, Math.max(0, Math.min(10, y))]);
      }
      return p;
    }, function (p) { const r = corr(p); return kind === 'pos' ? r > 0.75 : kind === 'neg' ? r < -0.75 : Math.abs(r) < 0.25; }, SC_FALL[kind]);
    const r = corr(pts);
    return {
      text: 'つぎの散布図で、2つの変量 x、y の間には どのような相関があるか。',
      fig: { type: 'scatter', pts: pts, xr: [0, 10, 2], yr: [0, 10, 2] },
      choices: [
        { text: '正の相関がある', ok: kind === 'pos', tag: 'corr-sign', msg: '右上がりなら 正の相関。この図は ' + (kind === 'neg' ? '右下がりだよ' : 'ばらばらに 散らばっているよ') },
        { text: '負の相関がある', ok: kind === 'neg', tag: 'corr-sign', msg: '右下がりなら 負の相関。この図は ' + (kind === 'pos' ? '右上がりだよ' : 'ばらばらに 散らばっているよ') },
        { text: '相関がない', ok: kind === 'none', tag: 'corr-none', msg: kind === 'neg' ? '右下がりは「相関がない」ではなく 負の相関だよ' : '点が 右上がりの直線の近くに 集まっているよ' }],
      verify: function () { return kind === 'pos' ? r > 0.7 : kind === 'neg' ? r < -0.7 : Math.abs(r) < 0.3; },
      hint: '点の集まりが 右上がりか、右下がりか、どちらでもないかを見よう',
      explain: ['右上がり → 正の相関、右下がり → 負の相関、どちらでもない → 相関がない',
        'この散布図は ' + (kind === 'pos' ? '右上がり' : kind === 'neg' ? '右下がり' : '全体に 散らばっている') + '(相関係数は 約 ' + r.toFixed(2) + ')']
    };
  }
};

/* ---------- 三角形の図 + 選ぶ(作図の方針) ---------- */
types['ts-center'] = {
  name: '見本: 外心・内心・重心(方針を選ぶ)', level: 0,
  gen: function (R) {
    const k = R.int(0, 2), name = ['外心(外接円の中心)', '内心(内接円の中心)', '重心'][k];
    const A = [R.int(2, 6), R.int(5, 7)], B = [0, 0], C = [R.int(7, 9), 0];
    const txt = ['3辺の垂直二等分線の交点', '3つの内角の二等分線の交点', '3本の中線の交点', '3つの頂点から 対辺に引いた垂線の交点'];
    const why = ['それは 外心。3頂点から 等しい距離にある点だよ', 'それは 内心。3辺から 等しい距離にある点だよ', 'それは 重心。頂点と 対辺の中点を結んだ線(中線)の交点だよ', 'それは 垂心。外心・内心・重心の どれでもないよ'];
    return {
      text: '△ABC の' + name + 'を 作図で求めたい。どの線の交点を とればよいか。',
      fig: { type: 'geo', items: [{ t: 'poly', pts: [A, B, C] }, { t: 'point', p: A, label: 'A', pos: 'n' }, { t: 'point', p: B, label: 'B', pos: 'sw' }, { t: 'point', p: C, label: 'C', pos: 'se' }] },
      choices: txt.map(function (t, i) { return { text: t, ok: i === k, tag: 'center-' + ['gaishin', 'naishin', 'juushin', 'suishin'][i], msg: why[i] }; }),
      hint: ['外心は 3つの頂点から 等しい距離にある点', '内心は 3つの辺から 等しい距離にある点', '重心は 3本の中線が 交わる点'][k],
      explain: [['2点から等しい距離にある点は、その 2点を結ぶ線分の垂直二等分線上にある', '角の 2辺から等しい距離にある点は、その角の二等分線上にある', '頂点と 対辺の中点を結ぶ線分が 中線'][k], 'よって ' + name + 'は ' + txt[k]]
    };
  }
};

/* ---------- 並べ替え(作図の手順) ---------- */
const ORDERS = [
  ['線分 AB の垂直二等分線', ['2点 A、B を それぞれ中心として、等しい半径の円をかく', '2つの円の交点を P、Q とする', '直線 PQ を引く']],
  ['∠AOB の二等分線', ['点 O を中心とする円をかき、2辺 OA、OB との交点を それぞれ C、D とする', '2点 C、D を それぞれ中心として、等しい半径の円をかき、交点を P とする', '半直線 OP を引く']],
  ['直線 ℓ 上にない点 P を通る ℓ の垂線', ['点 P を中心とする円をかき、直線 ℓ との交点を A、B とする', '2点 A、B を それぞれ中心として、等しい半径の円をかき、交点の 1つを Q とする', '直線 PQ を引く']],
  ['△ABC の外接円', ['辺 AB の垂直二等分線を引く', '辺 BC の垂直二等分線を引き、2本の交点を O とする', '点 O を中心として、半径 OA の円をかく']],
  ['線分 AB を 1：2 に内分する点', ['点 A から 半直線 AX を引き、AX 上に 等しい間隔で 3点 C、D、E を 順にとる', '点 E と 点 B を結ぶ', '点 C を通り EB に平行な直線を引き、AB との交点を P とする']]
];
types['ts-order'] = {
  name: '見本: 作図の手順の並べ替え', level: 0,
  gen: function (R) {
    const v = R.pick(ORDERS);
    return {
      text: v[0] + 'を作図する。手順を 正しい順に 並べよ。',
      order: v[1],
      hint: '交点に名前をつける前に、その交点を作る 円や直線が 必要だよ',
      explain: v[1].map(function (st, i) { return (i + 1) + '. ' + st; }),
      mistakes: [{ order: [0, 2, 1], tag: 'order-line-first', msg: '最後の手順で使う点が、まだ とれていないよ。交点を とるのが 先' },
        { order: [1, 0, 2], tag: 'order-point-first', msg: '最初に使う円や直線が まだ かけていないよ' }]
    };
  }
};

/* ---------- 不等式の答え ---------- */
types['ts-ineq'] = {
  name: '見本: 2次不等式(不等式の形で答える)', level: 1,
  gen: function (R) {
    const kind = R.int(0, 9), sign = ['>', '≧', '<', '≦'][kind % 4], strict = kind % 4 === 0 || kind % 4 === 2, gt = kind % 4 < 2;
    function holds(val) { return sign === '>' ? val > 0 : sign === '≧' ? val >= 0 : sign === '<' ? val < 0 : val <= 0; }
    if (kind < 4) {            // 異なる 2点で交わる
      const a = R.int(-5, 3), b = a + R.int(1, 5), sol = { kind: gt ? 'outside' : 'between', eq: !strict, a: String(a), b: String(b) };
      return {
        text: 'つぎの 2次不等式を解け。', expr: 'x^2' + term(-(a + b), 'x') + term(a * b) + ' ' + sign + ' 0', sol: sol,
        inside: function (x) { return holds(x * x - (a + b) * x + a * b); },
        hint: '左辺を因数分解して、グラフが x軸より 上か下かを 考えよう',
        explain: ['左辺を因数分解して (x' + term(-a) + ')(x' + term(-b) + ') ' + sign + ' 0', 'グラフは x = ' + a + ', ' + b + ' で x軸と交わり、' + (gt ? '外側で 正' : '内側で 負'), M.sol.markup(sol)],
        mistakes: [
          { sol: { kind: gt ? 'between' : 'outside', a: String(a), b: String(b) }, tag: 'ineq-inout', msg: '＞0 なら 2つの解の外側、＜0 なら 内側。グラフを かいて確かめよう' },
          { sol: { kind: sol.kind, eq: strict, a: String(a), b: String(b) }, tag: 'ineq-eq', msg: '等号(≦・≧)が つくかどうかを 問題の不等号で 確かめよう' },
          { sol: { kind: sol.kind, a: String(-b), b: String(-a) }, tag: 'factor-sign', msg: fac(a) + fac(b) + ' = 0 の解は x = ' + a + ', ' + b + '。符号を確かめよう' }].filter(function (m) { return !(m.tag === 'factor-sign' && a === -b); })
      };
    }
    if (kind < 8) {            // x軸に接する
      const a = R.int(-5, 5), sol = [{ kind: 'except', a: String(a) }, { kind: 'all' }, { kind: 'none' }, { kind: 'point', a: String(a) }][kind % 4];
      return {
        text: 'つぎの 2次不等式を解け。', expr: 'x^2' + term(-2 * a, 'x') + term(a * a) + ' ' + sign + ' 0', sol: sol,
        inside: function (x) { return holds(x * x - 2 * a * x + a * a); },
        hint: '左辺は ' + fac(a) + '^2 と因数分解できる。2乗は いつも 0 以上',
        explain: ['左辺 = (x' + term(-a) + ')^2', fac(a) + '^2 は x = ' + a + ' のとき 0、それ以外は 正', M.sol.markup(sol)],
        mistakes: [
          { sol: { kind: kind % 4 === 0 ? 'all' : kind % 4 === 1 ? 'except' : kind % 4 === 2 ? 'point' : 'none' }, tag: 'sq-zero', msg: 'x = ' + a + ' のとき 左辺は ちょうど 0。等号が つくかどうかで 答えが変わるよ' },
          { sol: { kind: gt ? 'none' : 'all' }, tag: 'all-none', msg: '「すべての実数」と「解なし」が 逆になっていないかな。2乗は 0 以上だよ' }]
      };
    }
    const k = R.int(1, 9), sol = { kind: kind === 8 ? 'all' : 'none' }, sg = kind === 8 ? '>' : '<';
    return {
      text: 'つぎの 2次不等式を解け。', expr: 'x^2 + ' + k + ' ' + sg + ' 0', sol: sol,
      inside: function (x) { return kind === 8 ? x * x + k > 0 : x * x + k < 0; },
      hint: 'x^2 は いつも 0 以上。x^2 + ' + k + ' は 正・負の どちらかな',
      explain: ['x^2 ≧ 0 だから x^2 + ' + k + ' は いつも 正', 'グラフは x軸より 上にあり、x軸と 共有点をもたない', M.sol.markup(sol)],
      mistakes: [{ sol: { kind: kind === 8 ? 'none' : 'all' }, tag: 'all-none', msg: '「すべての実数」と「解なし」が 逆だよ。x^2 + ' + k + ' は いつも 正' }]
    };
  }
};

/* ---------- 見取り図 + すべて選ぶ ---------- */
types['ts-skew'] = {
  name: '見本: 立方体の辺の位置関係(見取り図・すべて選ぶ)', level: 1,
  gen: function (R) {
    const cube = M.solids.cuboid(4, 4, 4), e = R.pick(cube.edges), rel = R.pick(['skew', 'para', 'cross']), V = cube.verts;
    function dirOf(x) { return [0, 1, 2].map(function (i) { return V[x[1]][i] - V[x[0]][i]; }); }
    function relOf(x) {
      const d1 = dirOf(e), d2 = dirOf(x), cr = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]];
      if (Math.abs(cr[0]) + Math.abs(cr[1]) + Math.abs(cr[2]) < 1e-9) return 'para';
      return (x[0] === e[0] || x[0] === e[1] || x[1] === e[0] || x[1] === e[1]) ? 'cross' : 'skew';
    }
    const label = { skew: 'ねじれの位置にある辺', para: '平行な辺', cross: '垂直に交わる辺' }[rel];
    const others = cube.edges.filter(function (x) { return x !== e; });
    return {
      text: '立方体 ABCD-EFGH で、辺 ' + e + ' と ' + label + 'を すべて選べ。',
      fig: Object.assign({}, cube, { mark: [e] }), cols: 4,
      choices: others.map(function (x) {
        const r = relOf(x);
        return { text: x, ok: r === rel, tag: 'edge-' + r, msg: { para: '辺 ' + x + ' は 辺 ' + e + ' と 平行だよ', cross: '辺 ' + x + ' は 辺 ' + e + ' と 交わっているよ', skew: '辺 ' + x + ' は 辺 ' + e + ' と ねじれの位置(平行でなく、交わりもしない)だよ' }[r] };
      }),
      verify: function () { const n = others.filter(function (x) { return relOf(x) === rel; }).length; return n === { skew: 4, para: 3, cross: 4 }[rel]; },
      hint: 'ねじれの位置は「平行でなく、交わりもしない」。まず 平行な辺と 交わる辺を のぞこう',
      explain: ['辺 ' + e + ' と 平行な辺は 3本、交わる辺は 4本(どれも 垂直に交わる)', 'のこりの 4本が ねじれの位置',
        label + 'は ' + others.filter(function (x) { return relOf(x) === rel; }).join(', ')]
    };
  }
};

/* ==================== 絵・敵・マップ(確認用の 小さな世界) ==================== */
const sprites = {
  kame: { mirror: true, rows: ['........', '.....lll', '....lLLL', '..lllLdL', '.lLLLLLL', 'lLLdLLLd', 'lLLLLLLL', 'lLLLLdLL', 'lLdLLLLL', '.lLLLLLL', '..llLLdL', '.ll.llll', '.ll...LL', '......LK', '......LL', '........'] },
  neko: { mirror: true, rows: ['..O.....', '..OO....', '..OOO...', '..OOOOOO', '.OOOOOOO', '.OOKOOOO', '.OOOOOOO', 'WWOOOOOP', '.OOOOOOO', 'WWOOOOWW', '.OOOOOOO', '..OOOOOO', '...OOOOO', '........', '........', '........'] },
  hotaru: { mirror: true, rows: ['........', '....K...', '.....K..', '.....KKK', '..CC.KRK', '.CCCCKKK', 'CCCCCKKK', '.CCC.KKK', '.....KKK', '.....YYY', '....YYYY', '....YYYY', '.....YYY', '........', '........', '........'] },
  ari: { mirror: true, rows: ['....n...', '.....n..', '.....nnn', '....nnWn', '....nnnn', '.....nnn', '..n...nn', '...nnnnn', '.....nnn', '..nnnnnn', '.n..nnnn', '....nnnn', '..nnnnnn', '.n...nnn', '........', '........'] },
  b_proto: { mirror: true, rows: ['............', '............', '......gggggg', '....ggGGGGGG', '...gGGGGGGGG', '..gGGGTTGGGG', '..gGGGTTGGGG', '..gGGGGGGGGG', '..gGGGGGGKKK', '...gGGGGGGGG', '....gggggggg', '......gGGGGG',
    '..ggggGGYGGG', '.gGGGGGGGGGG', 'gGGgGGGGGYGG', 'gGG.gGGGGGGG', 'gGG.gGGGYGGG', '.gg.gGGGGGGG', '....gGGGGGGG', '....gggggggg', '....gGGg.gGG', '....gGGg.gGG', '...ggGGg.gGG', '...ggggg.ggg'] }
};
const Z = { level: 1, hp: 0.5, atk: 0.6 };
const enemies = {
  kame: Object.assign({ name: 'えんしゅうガメ', sprite: 'kame', types: ['ts-tangent', 'ts-power'] }, Z),
  neko: Object.assign({ name: 'はこひげネコ', sprite: 'neko', types: ['ts-box', 'ts-hist', 'ts-median'] }, Z),
  hotaru: Object.assign({ name: 'さんぷホタル', sprite: 'hotaru', types: ['ts-scatter'] }, Z),
  ari: Object.assign({ name: 'ならべかえアリ', sprite: 'ari', types: ['ts-order', 'ts-center'] }, Z),
  ari2: { name: 'ふとうしきアリ', sprite: 'ari', swap: { n: 'r' }, level: 2, hp: 1, atk: 1, types: ['ts-ineq'] },
  kame2: { name: 'ねじれガメ', sprite: 'kame', swap: { l: 'b', L: 'C', d: 'B' }, level: 2, hp: 1, atk: 1, types: ['ts-skew'] },
  proto: { name: '試しの番人 プロトン', sprite: 'b_proto', boss: true, level: 3, hp: 5, atk: 1.2, line: '新しい しかけ、ぜんぶ 試して いくがいい!',
    types: ['ts-tangent', 'ts-power', 'ts-box', 'ts-hist', 'ts-median', 'ts-scatter', 'ts-center', 'ts-order', 'ts-ineq', 'ts-skew'] }
};
const maps = {
  town: { bgm: 'town',
    rows: ['TTTTTTTTTTT', 'T.hih.hch.T', 'T..=...=..T', 'T..=====..T', 'T....=....T', 'T.p..=..v.T', 'TTTTTxTTTTT', 'TTTTTTTTTTT'],
    legend: {
      i: { tile: 'wood', solid: true, npc: { pal: { 1: 'R', 2: 'N', h: 'y' } }, event: { type: 'inn' } },
      c: { tile: 'wood', solid: true, npc: { pal: { 1: 'W', 2: 'W', h: 'g' } }, event: { type: 'church' } },
      p: { tile: 'grass', solid: true, npc: { pal: { 1: 'l', 2: 'N', h: 'K' } }, event: { type: 'shop' } },
      v: { tile: 'grass', solid: true, npc: { pal: { 1: 'p', 2: 'g', h: 'W' } }, event: { type: 'talk', lines: ['案内人「ここは 新しい しかけを 試すための 小さな世界です」', '案内人「外の草原には 図・選ぶ・並べ替え・小数の問題、東の洞窟には 不等式と 見取り図の問題が 出ます」'] } },
      x: { tile: 'road', event: { type: 'map', map: 'world', x: 5, y: 3 } } } },
  world: { bgm: 'field',
    rows: ['^^^^^^^^^^^', '^zzzzzzzzC^', '^zzzzzzzzz^', '^zzzz=zzzz^', '^zzzzHzzzz^', '^^^^^^^^^^^'],
    legend: { z: { tile: 'grass', zone: 'field' }, H: { tile: 'i_town', event: { type: 'map', map: 'town', x: 5, y: 5 } }, C: { tile: 'i_cave', event: { type: 'dungeon', id: 'lab' } } } }
};

M.registerCourse({
  id: 'tameshi-suu1a',
  title: '試しのコース(数学I・A の新機能)',
  subtitle: '図・選ぶ・並べ替え・小数・不等式の 見本',
  start: { map: 'town', x: 5, y: 4 },
  intro: ['ここは 新しい しかけを 試すための 小さな世界。', '{n}は 図や 並べ替えの問題を たしかめに 出かけた。\n(歩く:行きたい場所を タップ)'],
  levelCap: { base: 30, extended: 30, extendFlag: 'boss:proto' },
  zones: { field: { enemies: ['kame', 'neko', 'hotaru', 'ari'] } },
  maps: maps,
  dungeons: { lab: { name: '試しの洞窟', unit: '不等式の答え・見取り図', level: 2, theme: 'cave', boss: 'proto', floors: [{ enemies: ['ari2', 'kame2'] }] } },
  enemies: enemies, sprites: sprites, types: types,
  titles: { level: [{ lv: 1, name: '試しの旅人' }], special: [{ id: 'lab', name: '試しを終えし者', cond: { boss: 'proto' } }] }
});
})();

/* ============================================================
 * コース: 数学I 2学期期末(2次方程式・判別式・2次不等式・データの分析)
 * 書き方の説明は docs/course-format.md。型の一覧は先生の承認ずみ。
 * ============================================================ */
(function () {
'use strict';
const M = (typeof MathRPG !== 'undefined') ? MathRPG : require('../engine.js');
const U = M.util, am = U.am, F = U.fracStr, G = M.geo;

/* ---------- 小さな道具 ---------- */
function pickUntil(make, ok, fallback) { for (let i = 0; i < 200; i++) { const v = make(); if (ok(v)) return v; } return fallback; }
function N(x) { return String(x); }
function m1(v, tag, msg) { return { answers: [N(v)], tag: tag, msg: msg }; }
function gcd(a, b) { return U.gcd(a, b); }
function dec(x) { return String(parseFloat(Number(x).toFixed(6))); }
function isTerm(x) { return isFinite(x) && Math.abs(x * 1000 - Math.round(x * 1000)) < 1e-6; }      // 小数第3位までで 割り切れる
function z(v) { return Math.abs(v) < 1e-9 ? 0 : v; }
function isSq(n) { if (n < 0) return false; const r = Math.round(Math.sqrt(n)); return r * r === n; }
function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
function sorted(a) { return a.slice().sort(function (x, y) { return x - y; }); }
function median(a) { const s = sorted(a), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
function midPos(a) { const n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; }       // 並べかえずに まん中を とる(まちがい用)
/* [最小値, Q1, 中央値, Q3, 最大値](奇数個のときは 中央値を 下半分・上半分に 入れない) */
function five(a) { const s = sorted(a), n = s.length; return [s[0], median(s.slice(0, Math.floor(n / 2))), median(s), median(s.slice(Math.ceil(n / 2))), s[n - 1]]; }
function fiveIn(a) { const s = sorted(a), n = s.length; return [s[0], median(s.slice(0, Math.ceil(n / 2))), median(s), median(s.slice(Math.floor(n / 2))), s[n - 1]]; }
function varOf(a) { const m = sum(a) / a.length; return sum(a.map(function (x) { return (x - m) * (x - m); })) / a.length; }
function corr(pts) {
  const n = pts.length, mx = sum(pts.map(function (p) { return p[0]; })) / n, my = sum(pts.map(function (p) { return p[1]; })) / n;
  let sxy = 0, sxx = 0, syy = 0;
  pts.forEach(function (p) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) * (p[0] - mx); syy += (p[1] - my) * (p[1] - my); });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}
function term(c, body, first) { if (c === 0) return ''; const a = Math.abs(c), s = body ? (a === 1 ? body : a + body) : String(a); return first ? (c < 0 ? '-' : '') + s : (c < 0 ? ' - ' : ' + ') + s; }
function poly(a, b, c, v) { v = v || 'x'; return term(a, v + '^2', true) + term(b, v, false) + term(c, '', false); }
function fac(r) { return r === 0 ? 'x' : '(x' + term(-r, '', false) + ')'; }
function facPair(a, b) { return (b === 0 && a !== 0) ? fac(b) + fac(a) : fac(a) + fac(b); }
function facL(p, q) { return '(' + (p === 1 ? '' : p) + 'x' + term(-q, '', false) + ')'; }
function sqrtStr(n) { let k = 1; for (let f = 2; f * f <= n; f++) while (n % (f * f) === 0) { n /= f * f; k *= f; } return n === 1 ? N(k) : (k === 1 ? '' : k) + '√' + n; }
/* k√r / d を 最も簡単な形に */
function radFrac(k, r, d) {
  for (let f = 2; f * f <= r; f++) while (r % (f * f) === 0) { r /= f * f; k *= f; }
  const g = gcd(k, d); k /= g; d /= g;
  const head = r === 1 ? N(k) : (k === 1 ? '' : k) + '√' + r;
  return d === 1 ? head : head + '/' + d;
}
/* (n0 ± k√r) / d を 最も簡単な形に(r は 平方数でない) */
function pmStr(n0, k, r, d) {
  for (let f = 2; f * f <= r; f++) while (r % (f * f) === 0) { r /= f * f; k *= f; }
  if (d < 0) { d = -d; n0 = -n0; }
  const g = gcd(gcd(Math.abs(n0), k), d); n0 /= g; k /= g; d /= g;
  const rt = (k === 1 ? '' : k) + '√' + r;
  if (n0 === 0) return '±' + (d === 1 ? rt : rt + '/' + d);
  return d === 1 ? n0 + '±' + rt : '(' + n0 + '±' + rt + ')/' + d;
}
function pmVerify(a, b, c) { return function (v, raws) { const pv = U.parseValue(raws[0]); return !!pv.pm && pv.nums[0] < pv.nums[1] && pv.nums.every(function (x) { return Math.abs(a * x * x + b * x + c) < 1e-7; }); }; }
function rootsVerify(a, b, c) { return function (v) { if (v.length === 2 && Math.abs(v[0] - v[1]) < 1e-9) return false; return v.every(function (x) { return Math.abs(a * x * x + b * x + c) < 1e-7; }); }; }
function split(R, total, n) { const a = []; for (let i = 0; i < n; i++) a.push(1); for (let i = 0; i < total - n; i++) a[R.int(0, n - 1)]++; return a; }
function tbl(head, rows) { return { type: 'table', head: head, rows: rows }; }
function classRows(start, w, fr, total) { return fr.map(function (f, i) { return [(start + w * i) + ' 以上 ' + (start + w * (i + 1)) + ' 未満', f]; }).concat(total ? [['計', sum(fr)]] : []); }

/* ---------- 不等式の道具 ---------- */
const SIGNS = ['>', '≧', '<', '≦'];
const FLIP = { '>': '<', '≧': '≦', '<': '>', '≦': '≧' };
function holdsRaw(v, s) { return s === '>' ? v > 0 : s === '≧' ? v >= 0 : s === '<' ? v < 0 : v <= 0; }      // 2乗の式用(z を かけない)
function holds(v, s) { v = z(v); return s === '>' ? v > 0 : s === '≧' ? v >= 0 : s === '<' ? v < 0 : v <= 0; }
function solAB(sign, a, b) { return { kind: sign === '>' || sign === '≧' ? 'outside' : 'between', eq: sign === '≧' || sign === '≦', a: a, b: b }; }
function ioMis(sol) {
  return [{ sol: { kind: sol.kind === 'outside' ? 'between' : 'outside', a: sol.a, b: sol.b }, tag: 'ineq-inout', msg: '＞0 なら 2つの解の外側、＜0 なら 内側。グラフを かいて確かめよう' },
    { sol: { kind: sol.kind, eq: !sol.eq, a: sol.a, b: sol.b }, tag: 'ineq-eq', msg: '等号(≦・≧)が つくかどうかを、問題の不等号で 確かめよう' }];
}
/* (x - α)^2 S 0 の 4種類 */
function sqSol(sign, a) { return sign === '>' ? { kind: 'except', a: a } : sign === '≧' ? { kind: 'all' } : sign === '<' ? { kind: 'none' } : { kind: 'point', a: a }; }
function sqMis(sign, aStr) {
  const zk = { '>': 'all', '≧': 'except', '<': 'point', '≦': 'none' }[sign], an = { '>': 'none', '≧': 'none', '<': 'all', '≦': 'all' }[sign];
  return [{ sol: { kind: zk }, tag: 'sq-zero', msg: 'x = ' + aStr + ' のとき 左辺は ちょうど 0。等号が つくかどうかで 答えが 変わるよ' },
    { sol: { kind: an }, tag: 'all-none', msg: '「すべての実数」と「解なし」が 逆になっていないかな。2乗は いつも 0 以上だよ' }];
}
function solText(sign) { return sign === '>' || sign === '≧' ? 'グラフが x軸より 上' + (sign === '≧' ? '(x軸上も ふくむ)' : '') + 'の部分' : 'グラフが x軸より 下' + (sign === '≦' ? '(x軸上も ふくむ)' : '') + 'の部分'; }

const types = {};

/* ==================== 東の草原(2次) ==================== */
types['eq-factor'] = {
  name: '因数分解で解く(x^2 の係数が 1・平方の差・共通因数・重解)', level: 0,
  gen: function (R) {
    const k = R.int(0, 3);
    if (k === 3) {
      const a = pickUntil(function () { return R.int(-6, 6); }, function (x) { return x !== 0; }, 3);
      return {
        text: 'つぎの 2次方程式を解け。', expr: poly(1, -2 * a, a * a) + ' = 0', form: 'x = □', answers: [N(a)], verify: rootsVerify(1, -2 * a, a * a),
        hint: '左辺は (x ± ○)^2 の形に 因数分解できる',
        explain: ['左辺を因数分解すると ' + fac(a) + '^2 = 0', fac(a) + ' = 0 より x = ' + a + '(重解)'],
        mistakes: [m1(-a, 'factor-sign', fac(a) + ' = 0 の解は x = ' + a + '。符号を 確かめよう')]
      };
    }
    let a, b;
    if (k === 0) { const v = pickUntil(function () { return [R.int(-7, 7), R.int(-7, 7)]; }, function (v) { return v[0] !== 0 && v[1] !== 0 && v[0] !== v[1] && v[0] !== -v[1]; }, [2, -5]); a = v[0]; b = v[1]; }
    else if (k === 1) { const n = R.int(1, 9); a = -n; b = n; }
    else { a = 0; b = pickUntil(function () { return R.int(-9, 9); }, function (x) { return x !== 0; }, 4); }
    const B = -(a + b), C = a * b, lo = Math.min(a, b), hi = Math.max(a, b), ans = [N(lo), N(hi)];
    const mis = [{ answers: [N(-hi), N(-lo)], tag: 'factor-sign', msg: '(x - ○)(x - △) = 0 の解は x = ○, △。符号を 逆にしていないかな' }];
    if (k === 1) mis.push({ answers: [N(-hi * hi), N(hi * hi)], tag: 'sq-root', msg: 'x^2 = ' + hi * hi + ' だから、2乗して ' + hi * hi + ' になる数を 求めよう' });
    if (k === 2) mis.push({ answers: [N(lo === 0 ? -hi : -lo), '0'], tag: 'factor-sign', msg: 'x(x ' + (b > 0 ? '- ' + b : '+ ' + -b) + ') = 0 の解は x = 0, ' + b });
    return {
      text: 'つぎの 2次方程式を解け。', expr: poly(1, B, C) + ' = 0', form: 'x = □, □', answers: ans, unordered: [[0, 1]], verify: rootsVerify(1, B, C),
      hint: k === 1 ? 'a^2 - b^2 = (a + b)(a - b) を 使おう' : k === 2 ? '共通因数 x で くくろう' : '足して ' + B + '、かけて ' + C + ' になる 2数を さがそう',
      explain: ['左辺を因数分解すると ' + facPair(a, b) + ' = 0', 'x = ' + lo + ', ' + hi],
      mistakes: U.mistakes(ans, mis, [[0, 1]])
    };
  }
};
types['disc'] = {
  name: '判別式の値と 実数解の個数', level: 0,
  gen: function (R) {
    const v = pickUntil(function () { return [R.pick([1, 1, 2, 3, -1, -2]), R.int(-6, 6), R.int(-6, 6)]; }, function (v) { return v[2] !== 0; }, [1, 3, 2]);
    const a = v[0], b = v[1], c = v[2], D = b * b - 4 * a * c, cnt = D > 0 ? 2 : D === 0 ? 1 : 0, ex = poly(a, b, c) + ' = 0', vert = c - b * b / (4 * a);
    const Dw = b * b + 4 * a * c, cw = Dw > 0 ? 2 : Dw === 0 ? 1 : 0;
    const line1 = 'D = b^2 - 4ac = (' + b + ')^2 - 4·(' + a + ')·(' + c + ') = ' + D;
    if (R.chance(0.5)) return {
      text: '2次方程式 ' + ex + ' の 判別式 D の値を求めよ。', form: 'D = □', answers: [N(D)], num: [Math.pow(b, 2) - 4 * a * c],
      hint: 'D = b^2 - 4ac。負の数は かっこを つけて 代入しよう',
      explain: ['a = ' + a + ', b = ' + b + ', c = ' + c, line1],
      mistakes: U.mistakes([N(D)], [m1(Dw, 'disc-sign', '-4ac の符号に注意。a、c を かっこごと 代入しよう'), a !== 1 ? m1(b * b - 4 * c, 'disc-a', 'a = ' + a + ' を かけ忘れていないかな(D = b^2 - 4ac)') : null,
        m1(2 * b - 4 * a * c, 'disc-square', 'b^2 は b × 2 ではないよ')])
    };
    return {
      text: '2次方程式 ' + ex + ' の 実数解の個数を求めよ。', form: '□ 個', answers: [N(cnt)], num: [Math.abs(vert) < 1e-12 ? 1 : (a * vert < 0 ? 2 : 0)],
      hint: '判別式 D = b^2 - 4ac の 符号を 調べよう',
      explain: [line1, D > 0 ? 'D > 0 だから 異なる 2つの実数解' : D === 0 ? 'D = 0 だから 重解(1個)' : 'D < 0 だから 実数解は ない', cnt + ' 個'],
      mistakes: U.mistakes([N(cnt)], [m1(cw, 'disc-sign', '-4ac の符号に注意。a、c を かっこごと 代入しよう'), D === 0 ? m1(2, 'double-count', '重解は 1個と 数えるよ') : null])
    };
  }
};
types['axis-pts'] = {
  name: 'グラフと x軸の共有点の x座標(2点・接する・上に凸)', level: 0,
  gen: function (R) {
    const k = R.int(0, 2), text = 'つぎの 2次関数の グラフと x軸の 共有点の x座標を求めよ。';
    if (k === 1) {
      const v = pickUntil(function () { return [R.int(1, 3), R.int(-5, 5)]; }, function (v) { return v[1] !== 0 && gcd(v[0], Math.abs(v[1])) === 1; }, [2, 1]), m = v[0], n = v[1], ans = F(n, m);
      return {
        text: text, expr: 'y = ' + poly(m * m, -2 * m * n, n * n), form: 'x = □', answers: [ans], keys: ['分数'], verify: rootsVerify(m * m, -2 * m * n, n * n),
        hint: 'y = 0 とおく。左辺は (○x - △)^2 の形に なる',
        explain: ['y = 0 とおくと ' + facL(m, n) + '^2 = 0', 'x = ' + am(ans) + '(x軸に 接する)'],
        mistakes: U.mistakes([ans], [{ answers: [F(-n, m)], tag: 'factor-sign', msg: '符号に注意。' + facL(m, n) + ' = 0 を 解こう' }, { answers: [F(m, n)], tag: 'frac-upside', msg: '分母と分子が 逆だよ' }])
      };
    }
    const v = pickUntil(function () { return [R.int(-6, 6), R.int(-6, 6)]; }, function (v) { return v[0] < v[1] && v[0] !== -v[1]; }, [-1, 3]), p = v[0], q = v[1], s = k === 2 ? -1 : 1;
    const A = s, B = -s * (p + q), C = s * p * q, ans = [N(p), N(q)];
    return {
      text: text, expr: 'y = ' + poly(A, B, C), form: 'x = □, □', answers: ans, unordered: [[0, 1]], verify: rootsVerify(A, B, C),
      hint: 'y = 0 とおいて、2次方程式を 解こう' + (s < 0 ? '(両辺に -1 を かけると 解きやすい)' : ''),
      explain: ['y = 0 とおくと ' + (s < 0 ? '両辺に -1 を かけて ' : '') + poly(1, -(p + q), p * q) + ' = 0', facPair(p, q) + ' = 0 より x = ' + p + ', ' + q],
      mistakes: U.mistakes(ans, [{ answers: [N(-q), N(-p)], tag: 'factor-sign', msg: '(x - ○)(x - △) = 0 の解は x = ○, △。符号を 逆にしていないかな' }], [[0, 1]])
    };
  }
};
types['ineq-fact'] = {
  name: '(x - α)(x - β) の不等式', level: 0,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(-6, 6), R.int(-6, 6)]; }, function (v) { return v[0] < v[1]; }, [-1, 3]), a = v[0], b = v[1], sign = R.pick(SIGNS), sol = solAB(sign, N(a), N(b));
    return {
      text: 'つぎの 2次不等式を解け。', expr: facPair(a, b) + ' ' + sign + ' 0', sol: sol, inside: function (x) { return holds((x - a) * (x - b), sign); },
      hint: 'y = ' + facPair(a, b) + ' の グラフは x = ' + a + ', ' + b + ' で x軸と交わる',
      explain: ['グラフは 下に凸で、x = ' + a + ', ' + b + ' で x軸と 交わる', solText(sign), M.sol.markup(sol)],
      mistakes: ioMis(sol).concat(a !== -b ? [{ sol: { kind: sol.kind, a: N(-b), b: N(-a) }, tag: 'factor-sign', msg: facPair(a, b) + ' = 0 の解は x = ' + a + ', ' + b + '。符号を 確かめよう' }] : [])
    };
  }
};
types['ineq-sq'] = {
  name: '(x - α)^2 の 4種類の不等式', level: 0,
  gen: function (R) {
    const a = R.int(-5, 5), sign = R.pick(SIGNS), sol = sqSol(sign, N(a));
    return {
      text: 'つぎの 2次不等式を解け。', expr: fac(a) + '^2 ' + sign + ' 0', sol: sol, inside: function (x) { const t = z(x - a); return holdsRaw(t * t, sign); },
      hint: '2乗は いつも 0 以上。x = ' + a + ' のとき だけ 0 になる',
      explain: [fac(a) + '^2 は x = ' + a + ' のとき 0、それ以外は 正', 'グラフは x = ' + a + ' で x軸に 接する', M.sol.markup(sol)],
      mistakes: sqMis(sign, N(a))
    };
  }
};

/* ==================== 西の草原(データ) ==================== */
types['freq-basic'] = {
  name: '階級値・相対度数・累積度数', level: 0,
  gen: function (R) {
    const st = R.pick([[40, 10], [150, 5], [0, 10], [20, 5]]), start = st[0], w = st[1], Nt = R.pick([20, 25, 40, 50]), fr = split(R, Nt, 5), k = R.int(0, 2);
    const fig = tbl(['階級', '度数'], classRows(start, w, fr, true));
    if (k === 0) {
      const i = R.int(0, 4), lo = start + w * i, hi = lo + w, mark = dec(lo + w / 2);
      return {
        text: '度数分布表で、' + lo + ' 以上 ' + hi + ' 未満の階級の 階級値を求めよ。', fig: fig, form: '□', answers: [mark], keys: ['.'], num: [(lo + hi) / 2],
        hint: '階級値は 階級の まん中の値', explain: ['階級値 = (階級の 両はしの 平均)', '(' + lo + ' + ' + hi + ') ÷ 2 = ' + mark],
        mistakes: U.mistakes([mark], [m1(lo, 'mark-lower', '階級値は 階級の まん中の値。左はしでは ないよ'), m1(hi, 'mark-lower', '階級値は 階級の まん中の値。右はしでは ないよ'), m1(w, 'mark-width', 'それは 階級の幅')])
      };
    }
    const i = R.int(k === 2 ? 1 : 0, 4), lo = start + w * i, f = fr[i];
    if (k === 1) {
      const ans = dec(f / Nt);
      return {
        text: '度数分布表で、' + lo + ' 以上 ' + (lo + w) + ' 未満の階級の 相対度数を 小数で求めよ。', fig: fig, form: '□', answers: [ans], keys: ['.'], num: [f / Nt],
        hint: '相対度数 = (その階級の度数) ÷ (度数の合計)', explain: ['相対度数 = (その階級の度数) ÷ (度数の合計)', f + ' ÷ ' + Nt + ' = ' + ans],
        mistakes: U.mistakes([ans], [m1(dec(f / Nt * 100), 'rel-percent', '百分率ではなく、度数 ÷ 度数の合計 を 小数で 答えよう'), isTerm(Nt / f) ? m1(dec(Nt / f), 'rel-upside', '割る順番が 逆だよ。(度数) ÷ (合計)') : null, m1(f, 'rel-freq', 'それは 度数。合計で 割ろう')])
      };
    }
    const cum = sum(fr.slice(0, i + 1));
    return {
      text: '度数分布表で、' + lo + ' 以上 ' + (lo + w) + ' 未満の階級までの 累積度数を求めよ。', fig: fig, form: '□', answers: [N(cum)], num: [fr.reduce(function (s, x, j) { return j <= i ? s + x : s; }, 0)],
      hint: '累積度数は、最初の階級から その階級までの 度数の合計', explain: ['最初の階級から その階級までの 度数を 足す', fr.slice(0, i + 1).join(' + ') + ' = ' + cum],
      mistakes: U.mistakes([N(cum)], [m1(f, 'cum-one', '累積度数は、最初の階級から その階級までの 度数の合計だよ'), m1(sum(fr.slice(i)), 'cum-dir', '数えるのは 最初の階級から。大きいほうからでは ないよ')])
    };
  }
};
types['rep-val'] = {
  name: '平均値・中央値(奇数個・偶数個)・最頻値', level: 0,
  gen: function (R) {
    const k = R.int(0, 3);
    if (k === 0) {
      const n = R.pick([4, 5]), data = []; for (let i = 0; i < n; i++) data.push(R.int(1, 20));
      const S = sum(data), ans = dec(S / n);
      return {
        text: 'つぎの データの 平均値を求めよ。', expr: data.join(', '), form: '□', answers: [ans], keys: ['.'], num: [S / n],
        hint: '平均値 = (データの合計) ÷ (データの個数)', explain: ['合計は ' + S + '、個数は ' + n, S + ' ÷ ' + n + ' = ' + ans],
        mistakes: U.mistakes([ans], [isTerm(S / (n - 1)) ? m1(dec(S / (n - 1)), 'mean-count', 'データの個数(' + n + ' 個)で 割ろう') : null, m1(S, 'mean-div', '合計を 個数で 割るのを 忘れていないかな')])
      };
    }
    if (k === 3) {
      const mv = R.int(1, 15), data = pickUntil(function () { const d = [mv, mv, mv]; for (let i = 0; i < R.int(4, 5); i++) d.push(R.int(1, 15)); return R.shuffle(d); },
        function (d) { const c = {}; d.forEach(function (x) { c[x] = (c[x] || 0) + 1; }); return Object.keys(c).filter(function (x) { return c[x] >= c[mv] && +x !== mv; }).length === 0; }, [mv, 1, mv, 20, mv, 16]);
      const cnt = data.filter(function (x) { return x === mv; }).length;
      return {
        text: 'つぎの データの 最頻値を求めよ。', expr: data.join(', '), form: '□', answers: [N(mv)], keys: ['.'],
        verify: function (v) { const c = data.filter(function (x) { return x === v[0]; }).length; return data.every(function (x) { return data.filter(function (y) { return y === x; }).length <= c; }); },
        hint: 'いちばん 多く 出てくる 値', explain: [mv + ' が ' + cnt + ' 回で いちばん多い', '最頻値は ' + mv],
        mistakes: U.mistakes([N(mv)], [m1(cnt, 'mode-freq', 'それは 度数(個数)。最頻値は いちばん多く 出てくる「値」だよ'), m1(dec(median(data)), 'mode-median', 'それは 中央値。最頻値は いちばん多く 出てくる値')])
      };
    }
    const n = k === 1 ? 7 : 6, data = []; for (let i = 0; i < n; i++) data.push(R.int(1, 30));
    const s = sorted(data), med = median(data), ans = dec(med);
    return {
      text: 'つぎの データの 中央値を求めよ。', expr: data.join(', '), form: '□', answers: [ans], keys: ['.'],
      verify: function (v) { return data.filter(function (x) { return x < v[0]; }).length <= n / 2 && data.filter(function (x) { return x > v[0]; }).length <= n / 2; },
      hint: 'まず 小さい順に 並べる。' + (n % 2 ? 'まん中の値' : '偶数個のときは 中央の 2つの 平均'),
      explain: ['小さい順に並べると ' + s.join(', '), n % 2 ? 'まん中(4番目)の値は ' + med : '中央の 2つ ' + s[2] + ' と ' + s[3] + ' の平均は ' + ans],
      mistakes: U.mistakes([ans], [m1(dec(midPos(data)), 'median-sort', '先に 小さい順に 並べかえよう'), n % 2 ? null : m1(s[2], 'median-one', '偶数個のときは、中央の 2つの 平均を とるよ'), n % 2 ? null : m1(s[3], 'median-one', '偶数個のときは、中央の 2つの 平均を とるよ')])
    };
  }
};
types['range-iqr'] = {
  name: '範囲・四分位範囲', level: 0,
  gen: function (R) {
    const n = R.int(7, 11), data = []; for (let i = 0; i < n; i++) data.push(R.int(0, 30));
    const f = five(data), fi = fiveIn(data), s = sorted(data), k = R.int(0, 1);
    if (k === 0) {
      const ans = N(f[4] - f[0]);
      return {
        text: 'つぎの データの 範囲を求めよ。', expr: data.join(', '), form: '□', answers: [ans], keys: ['.'], num: [Math.max.apply(null, data) - Math.min.apply(null, data)],
        hint: '範囲 = (最大値) - (最小値)', explain: ['最大値 ' + f[4] + '、最小値 ' + f[0], '範囲 = ' + f[4] + ' - ' + f[0] + ' = ' + ans],
        mistakes: U.mistakes([ans], [m1(dec(f[3] - f[1]), 'range-iqr', 'それは 四分位範囲。範囲は 最大値 - 最小値'), m1(f[4], 'range-max', '最小値を 引くのを 忘れていないかな')])
      };
    }
    const ans = dec(f[3] - f[1]);
    return {
      text: 'つぎの データの 四分位範囲を求めよ。', expr: data.join(', '), form: '□', answers: [ans], keys: ['.'], num: [f[3] - f[1]],
      hint: '四分位範囲 = Q_3 - Q_1。まず 小さい順に 並べて 半分に 分けよう',
      explain: ['小さい順に並べると ' + s.join(', '), 'Q_1 = ' + dec(f[1]) + '、Q_3 = ' + dec(f[3]), '四分位範囲 = ' + dec(f[3]) + ' - ' + dec(f[1]) + ' = ' + ans],
      mistakes: U.mistakes([ans], [m1(N(f[4] - f[0]), 'range-iqr', 'それは 範囲。四分位範囲は Q_3 - Q_1'), n % 2 ? m1(dec(fi[3] - fi[1]), 'q-median-in', '奇数個のときは、中央値を のぞいて 半分に 分けよう') : null])
    };
  }
};
types['deviation'] = {
  name: '偏差', level: 0,
  gen: function (R) {
    const data = pickUntil(function () { const d = []; for (let i = 0; i < 5; i++) d.push(R.int(1, 20)); return d; }, function (d) { return sum(d) % 5 === 0; }, [3, 7, 8, 10, 12]), m = sum(data) / 5;
    if (R.chance(0.2)) return {
      text: 'つぎの データの 偏差の和を求めよ。', expr: data.join(', '), form: '□', answers: ['0'], num: [sum(data.map(function (x) { return x - m; }))],
      hint: '偏差 = (データの値) - (平均値)。全部 足すと どうなるかな', explain: ['平均値は ' + m + '、偏差は ' + data.map(function (x) { return x - m; }).join(', '), '偏差の和は いつも 0'],
      mistakes: U.mistakes(['0'], [m1(sum(data), 'dev-sum', '偏差は (値) - (平均値)。偏差の和は いつも 0 になるよ'), m1(sum(data.map(function (x) { return Math.abs(x - m); })), 'dev-sum', '負の偏差も そのまま 足そう(絶対値は とらない)')])
    };
    const i = R.int(0, 4), d = data[i] - m;
    return {
      text: 'つぎの データで、' + data[i] + ' の 偏差を求めよ。', expr: data.join(', '), form: '偏差 = □', answers: [N(d)], num: [data[i] - sum(data) / data.length],
      hint: '偏差 = (データの値) - (平均値)', explain: ['平均値は ' + sum(data) + ' ÷ 5 = ' + m, '偏差 = ' + data[i] + ' - ' + m + ' = ' + d],
      mistakes: U.mistakes([N(d)], [m1(-d, 'dev-sign', '偏差は (データの値) - (平均値)。引く順番に 注意'), m1(m, 'dev-mean', 'それは 平均値。偏差は (値) - (平均値)')])
    };
  }
};
const RCTX = [['身長', '体重'], ['数学の得点', '英語の得点'], ['気温', 'アイスの売上'], ['睡眠時間', '50m走の記録'], ['通学時間', '読書時間'], ['身長', '靴のサイズ']];
types['r-range'] = {
  name: '相関係数のとりうる範囲', level: 0,
  gen: function (R) {
    const c = R.pick(RCTX), sol = { kind: 'between', eq: true, a: '-1', b: '1' };
    return {
      text: R.pick(['2つの変量 ', '']) + c[0] + ' と ' + c[1] + ' の 相関係数 r の とりうる値の 範囲を答えよ。', sol: sol, solVar: 'r', shapes: ['between', 'outside', 'gt', 'lt'],
      inside: function (r) { return r >= -1 && r <= 1; },
      hint: '強い正の相関・強い負の相関のとき、r は どんな値に 近づくかな',
      explain: ['相関係数 r は いつも -1 以上 1 以下', '1 に近いほど 強い正の相関、-1 に近いほど 強い負の相関', '-1 ≦ r ≦ 1'],
      mistakes: [{ sol: { kind: 'between', eq: false, a: '-1', b: '1' }, tag: 'r-eq', msg: 'r = 1 や r = -1 にも なりうる(点が 一直線に 並ぶとき)。等号が つくよ' },
        { sol: { kind: 'between', a: '0', b: '1' }, tag: 'r-neg', msg: '負の相関のとき r は 負。-1 から 1 までだよ' }, { sol: { kind: 'between', a: '-100', b: '100' }, tag: 'r-percent', msg: '相関係数は 百分率では ないよ。-1 から 1 まで' }]
    };
  }
};
/* ==================== 解の公式の洞窟 ==================== */
types['eq-tasuki'] = {
  name: 'たすき掛けで解く', level: 1,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(1, 3), R.int(-5, 5), R.int(1, 3), R.int(-5, 5)]; }, function (v) {
      return v[1] !== 0 && v[3] !== 0 && gcd(v[0], Math.abs(v[1])) === 1 && gcd(v[2], Math.abs(v[3])) === 1 && (v[0] > 1 || v[2] > 1) && v[1] * v[2] !== v[3] * v[0] &&
        gcd(gcd(v[0] * v[2], Math.abs(v[0] * v[3] + v[1] * v[2])), Math.abs(v[1] * v[3])) === 1;
    }, [2, 1, 1, -3]);
    const p = v[0], q = v[1], r = v[2], s = v[3], A = p * r, B = -(p * s + q * r), C = q * s, ans = [F(q, p), F(s, r)];
    return {
      text: 'つぎの 2次方程式を解け。', expr: poly(A, B, C) + ' = 0', form: 'x = □, □', answers: ans, unordered: [[0, 1]], keys: ['分数'], verify: rootsVerify(A, B, C),
      hint: 'たすき掛けで (○x + △)(◇x + ☆) の形に 因数分解しよう',
      explain: ['たすき掛けで因数分解すると ' + facL(p, q) + facL(r, s) + ' = 0', 'x = ' + am(ans[0]) + ', ' + am(ans[1])],
      mistakes: U.mistakes(ans, [{ answers: [F(-q, p), F(-s, r)], tag: 'factor-sign', msg: '(○x - △) = 0 の解は x = {△/○}。符号を 確かめよう' }, { answers: [F(p, q), F(r, s)], tag: 'frac-upside', msg: '(○x - △) = 0 の解は x = {△/○}。分母と分子が 逆だよ' }], [[0, 1]])
    };
  }
};
types['eq-formula'] = {
  name: '解の公式(± √ の答え)', level: 1,
  gen: function (R) {
    const v = pickUntil(function () { return [R.pick([1, 1, 2, 3]), R.int(-7, 7), R.int(-6, 6)]; }, function (v) { const D = v[1] * v[1] - 4 * v[0] * v[2]; return D > 0 && !isSq(D) && gcd(gcd(v[0], Math.abs(v[1])), Math.abs(v[2])) === 1; }, [1, 3, 1]);
    const a = v[0], b = v[1], c = v[2], D = b * b - 4 * a * c, Dw = b * b + 4 * a * c, ans = pmStr(-b, 1, D, 2 * a);
    return {
      text: 'つぎの 2次方程式を 解の公式を使って解け。', expr: poly(a, b, c) + ' = 0', form: 'x = □', answers: [ans], keys: ['±', '√', '分数'], verify: pmVerify(a, b, c),
      hint: '解の公式 x = {-b ± √{b^2 - 4ac}/2a}。b が負のときは かっこを つけて 代入',
      explain: ['a = ' + a + ', b = ' + b + ', c = ' + c + ' を 解の公式に代入', 'x = {' + (-b) + ' ± √{' + D + '}/' + 2 * a + '}', 'x = ' + am(ans)],
      mistakes: U.mistakes([ans], [{ answers: [pmStr(b, 1, D, 2 * a)], tag: 'formula-b-sign', msg: '分子は -b。b = ' + b + ' だから -b = ' + (-b) },
        { answers: [pmStr(-b, 1, D, a)], tag: 'formula-2a', msg: '分母は 2a = ' + 2 * a + '。2 を かけ忘れていないかな' },
        Dw > 0 && !isSq(Dw) ? { answers: [pmStr(-b, 1, Dw, 2 * a)], tag: 'disc-sign', msg: '√ の中は b^2 - 4ac。-4ac の符号に 注意' } : null])
    };
  }
};
types['eq-even'] = {
  name: 'x の係数が偶数のときの 解の公式', level: 2,
  gen: function (R) {
    const v = pickUntil(function () { return [R.pick([1, 1, 2, 3]), R.int(-5, 5), R.int(-6, 6)]; }, function (v) { const D = v[1] * v[1] - v[0] * v[2]; return v[1] !== 0 && D > 0 && !isSq(D) && gcd(gcd(v[0], Math.abs(2 * v[1])), Math.abs(v[2])) === 1; }, [1, 2, -1]);
    const a = v[0], h = v[1], c = v[2], D4 = h * h - a * c, ans = pmStr(-h, 1, D4, a);
    return {
      text: 'つぎの 2次方程式を解け。', expr: poly(a, 2 * h, c) + ' = 0', form: 'x = □', answers: [ans], keys: ['±', '√', '分数'], verify: pmVerify(a, 2 * h, c),
      hint: "x の係数が 2b' のとき x = {-b' ± √{b'^2 - ac}/a}",
      explain: ["b = 2b' とみると b' = " + h + "。x = {-b' ± √{b'^2 - ac}/a} に代入", a === 1 ? 'x = ' + (-h) + ' ± √{' + D4 + '}' : 'x = {' + (-h) + ' ± √{' + D4 + '}/' + a + '}', 'x = ' + am(ans)],
      mistakes: U.mistakes([ans], [{ answers: [pmStr(-2 * h, 1, D4, a)], tag: 'even-b', msg: "公式の b' は x の係数の 半分(" + h + ")だよ" }, { answers: [pmStr(-h, 1, D4, 2 * a)], tag: 'even-2a', msg: "b' の公式では 分母は a(2a ではない)" },
        { answers: [pmStr(h, 1, D4, a)], tag: 'formula-b-sign', msg: "分子は -b'。符号に注意" }])
    };
  }
};
types['m-range'] = {
  name: 'D > 0(異なる2つの実数解)となる m の範囲', level: 1,
  gen: function (R) {
    const k = R.int(0, 2), text = '2次方程式 が 異なる 2つの実数解をもつような 定数 m の値の範囲を求めよ。';
    if (k === 1) {
      const kk = R.int(1, 5), c = kk * kk, sol = { kind: 'outside', a: N(-kk), b: N(kk) };
      return {
        text: text.replace('が', 'x^2 + 2mx + ' + c + ' = 0 が'), sol: sol, solVar: 'm', keys: ['分数'], shapes: ['between', 'outside', 'gt', 'lt'], inside: function (m) { return m * m - c > 0; },
        hint: "x の係数が 2m なので D/4 = m^2 - " + c + ' > 0 を 解こう',
        explain: ['D/4 = m^2 - ' + c + ' > 0', '(m + ' + kk + ')(m - ' + kk + ') > 0', M.sol.markup(sol, 'm')],
        mistakes: [{ sol: { kind: 'between', a: N(-kk), b: N(kk) }, tag: 'ineq-inout', msg: '＞0 なら 2つの解の外側だよ' }, { sol: { kind: 'gt', a: N(kk) }, tag: 'sq-both', msg: 'm^2 > ' + c + ' は m > ' + kk + ' だけでは ないよ。負の側も 考えよう' }]
      };
    }
    const b = pickUntil(function () { return R.int(-7, 7); }, function (x) { return x !== 0; }, 3), a = k === 2 ? R.pick([2, 3]) : 1, sol = { kind: 'lt', a: F(b * b, 4 * a) };
    return {
      text: text.replace('が', poly(a, b, 0) + ' + m = 0 が'), sol: sol, solVar: 'm', keys: ['分数'], shapes: ['between', 'outside', 'gt', 'lt'], inside: function (m) { return z(b * b - 4 * a * m) > 0; },
      hint: '異なる 2つの実数解 ⇔ 判別式 D > 0',
      explain: ['D = ' + b * b + ' - ' + 4 * a + 'm > 0', '-' + 4 * a + 'm > ' + (-b * b) + ' の両辺を -' + 4 * a + ' で割ると 向きが 変わる', M.sol.markup(sol, 'm')],
      mistakes: [{ sol: { kind: 'gt', a: F(b * b, 4 * a) }, tag: 'ineq-dir', msg: '負の数で 割ると、不等号の向きが 逆になるよ' }, { sol: { kind: 'lt', eq: true, a: F(b * b, 4 * a) }, tag: 'disc-eq', msg: '「異なる 2つの実数解」は D > 0。等号は つかないよ' },
        a > 1 ? { sol: { kind: 'lt', a: F(b * b, 4) }, tag: 'disc-a', msg: 'D = b^2 - 4ac の a = ' + a + ' を かけ忘れていないかな' } : { sol: { kind: 'lt', a: N(b * b) }, tag: 'disc-4', msg: 'D = b^2 - 4m。4 で 割るのを 忘れていないかな' }]
    };
  }
};
types['m-double'] = {
  name: '重解となる m の値', level: 2,
  gen: function (R) {
    if (R.chance(0.5)) {
      const kk = R.int(1, 6), c = kk * kk, ans = '±' + 2 * kk;
      return {
        text: '2次方程式 x^2 + mx + ' + c + ' = 0 が 重解をもつような 定数 m の値を求めよ。', form: 'm = □', answers: [ans], keys: ['±'],
        verify: function (v, raws) { const pv = U.parseValue(raws[0]); return !!pv.pm && pv.nums.every(function (m) { return Math.abs(m * m - 4 * c) < 1e-9; }); },
        hint: '重解 ⇔ D = 0', explain: ['D = m^2 - 4·' + c + ' = 0', 'm^2 = ' + 4 * c + ' より m = ' + am(ans)],
        mistakes: U.mistakes([ans], [m1(2 * kk, 'pm-both', 'm^2 = ' + 4 * c + ' の解は 正と負の 2つ あるよ'), m1('±' + kk, 'disc-4', 'D = m^2 - 4·' + c + '。4 を かけ忘れていないかな')])
      };
    }
    const b = pickUntil(function () { return R.int(-7, 7); }, function (x) { return x !== 0; }, 3), ans = F(b * b, 4);
    return {
      text: '2次方程式 ' + poly(1, b, 0) + ' + m = 0 が 重解をもつような 定数 m の値を求めよ。', form: 'm = □', answers: [ans], keys: ['分数'], num: [Math.pow(b / 2, 2)],
      hint: '重解 ⇔ D = 0', explain: ['D = ' + b * b + ' - 4m = 0', 'm = ' + am(ans)],
      mistakes: U.mistakes([ans], [{ answers: [F(b * b, 2)], tag: 'disc-4', msg: 'D = b^2 - 4m。4 で 割ろう' }, { answers: [F(-b * b, 4)], tag: 'disc-sign', msg: '符号に注意。4m = ' + b * b }])
    };
  }
};
types['m-real'] = {
  name: '実数解をもつ条件 D ≧ 0', level: 2,
  gen: function (R) {
    const a = R.pick([1, 1, 2, 3, -1, -2]), b = pickUntil(function () { return R.int(-7, 7); }, function (x) { return x !== 0; }, 4), v = F(b * b, 4 * a), sol = { kind: a > 0 ? 'lt' : 'gt', eq: true, a: v };
    return {
      text: '2次方程式 ' + poly(a, b, 0) + ' + m = 0 が 実数解をもつような 定数 m の値の範囲を求めよ。', sol: sol, solVar: 'm', keys: ['分数'], shapes: ['between', 'outside', 'gt', 'lt'],
      inside: function (m) { return z(b * b - 4 * a * m) >= 0; },
      hint: '実数解をもつ ⇔ D ≧ 0(異なる 2つの解と 重解の 両方)',
      explain: ['実数解をもつ ⇔ D ≧ 0', 'D = ' + b * b + term(-4 * a, 'm', false) + ' ≧ 0', M.sol.markup(sol, 'm')],
      mistakes: [{ sol: { kind: sol.kind, eq: false, a: v }, tag: 'disc-eq', msg: '「実数解をもつ」は 重解の場合も ふくむので D ≧ 0' }, { sol: { kind: a > 0 ? 'gt' : 'lt', a: v }, tag: 'ineq-dir', msg: '負の数で 割ると、不等号の向きが 逆になるよ' }]
    };
  }
};
types['cnt-cross'] = {
  name: 'グラフと x軸の共有点の個数(上に凸を含む)', level: 1,
  gen: function (R) {
    const v = pickUntil(function () { return [R.pick([1, 2, 3, -1, -2, -3]), R.int(-6, 6), R.int(-6, 6)]; }, function (v) { return v[2] !== 0; }, [-1, 2, 3]);
    const a = v[0], b = v[1], c = v[2], D = b * b - 4 * a * c, cnt = D > 0 ? 2 : D === 0 ? 1 : 0, Dw = b * b + 4 * a * c, vert = c - b * b / (4 * a);
    return {
      text: '2次関数 y = ' + poly(a, b, c) + ' の グラフと x軸の 共有点の個数を求めよ。', form: '□ 個', answers: [N(cnt)], num: [Math.abs(vert) < 1e-12 ? 1 : (a * vert < 0 ? 2 : 0)],
      hint: 'y = 0 とおいた 2次方程式の 判別式 D の符号を 調べよう',
      explain: ['D = (' + b + ')^2 - 4·(' + a + ')·(' + c + ') = ' + D, D > 0 ? 'D > 0 だから 2点で交わる' : D === 0 ? 'D = 0 だから 接する' : 'D < 0 だから 共有点はない', cnt + ' 個'],
      mistakes: U.mistakes([N(cnt)], [m1(Dw > 0 ? 2 : Dw === 0 ? 1 : 0, 'disc-sign', 'a < 0 や c < 0 のときの -4ac の符号に注意'), D === 0 ? m1(2, 'double-count', '接するときは 共有点 1個') : null])
    };
  }
};
types['m-cross'] = {
  name: '異なる 2点で交わる m の範囲', level: 2,
  gen: function (R) {
    const a = R.pick([1, -1, 2, -2]), b = pickUntil(function () { return R.int(-6, 6); }, function (x) { return x !== 0; }, 2), v = F(b * b, 4 * a), sol = { kind: a > 0 ? 'lt' : 'gt', a: v };
    return {
      text: '2次関数 y = ' + poly(a, b, 0) + ' + m の グラフが x軸と 異なる 2点で交わるような 定数 m の値の範囲を求めよ。', sol: sol, solVar: 'm', keys: ['分数'], shapes: ['between', 'outside', 'gt', 'lt'],
      inside: function (m) { return z(b * b - 4 * a * m) > 0; },
      hint: 'x軸と 異なる 2点で交わる ⇔ D > 0',
      explain: ['D = ' + b * b + term(-4 * a, 'm', false) + ' > 0', a > 0 ? '両辺を負の数で割ると 向きが変わる' : '両辺を正の数で割る', M.sol.markup(sol, 'm')],
      mistakes: [{ sol: { kind: a > 0 ? 'gt' : 'lt', a: v }, tag: 'ineq-dir', msg: '割る数の 符号に 注意。負の数で 割ると 不等号の向きが 逆になる' }, { sol: { kind: sol.kind, eq: true, a: v }, tag: 'disc-eq', msg: '異なる 2点で交わるのは D > 0。等号は つかないよ' }]
    };
  }
};
types['cnt-vertex'] = {
  name: '凸の向きと頂点から 共有点の個数を判断', level: 2,
  gen: function (R) {
    const a = R.pick([1, 2, 3, -1, -2, -3]), p = R.int(-4, 4), q = R.int(-5, 5), cnt = q === 0 ? 1 : a * q < 0 ? 2 : 0, wrong = q === 0 ? 1 : q < 0 ? 2 : 0;
    const B = -2 * a * p, C = a * p * p + q, D = B * B - 4 * a * C;
    return {
      text: '2次関数 y = ' + (a === 1 ? '' : a === -1 ? '-' : a) + fac(p) + '^2' + term(q, '', false) + ' の グラフと x軸の 共有点の個数を求めよ。', form: '□ 個', answers: [N(cnt)], num: [D > 0 ? 2 : D === 0 ? 1 : 0],
      hint: 'グラフの 凸の向き(a の符号)と、頂点の y座標の 符号を 見よう',
      explain: ['a ' + (a > 0 ? '> 0 だから 下に凸' : '< 0 だから 上に凸') + '、頂点は (' + p + ', ' + q + ')', q === 0 ? '頂点が x軸上にあるので 接する' : (a * q < 0 ? '頂点が x軸の 反対側にあるので 2点で交わる' : '頂点から x軸へ 向かわないので 共有点はない'), cnt + ' 個'],
      mistakes: U.mistakes([N(cnt)], [m1(wrong, 'convex-sign', 'a < 0 のとき グラフは 上に凸。頂点が x軸より 上なら x軸と 2点で交わるよ'), m1(cnt === 1 ? 2 : 1, 'vertex-one', '頂点が x軸上に あるときだけ 1個')])
    };
  }
};

/* ==================== 不等式の塔 ==================== */
types['ineq-int'] = {
  name: '因数分解できる 2次不等式(≦・≧ を含む)', level: 1,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(-6, 6), R.int(-6, 6)]; }, function (v) { return v[0] < v[1]; }, [-2, 3]), a = v[0], b = v[1], sign = R.pick(SIGNS), sol = solAB(sign, N(a), N(b));
    return {
      text: 'つぎの 2次不等式を解け。', expr: poly(1, -(a + b), a * b) + ' ' + sign + ' 0', sol: sol, inside: function (x) { return holds(x * x - (a + b) * x + a * b, sign); },
      hint: '左辺を 因数分解して、グラフが x軸より 上か 下かを 考えよう',
      explain: ['左辺を因数分解して ' + facPair(a, b) + ' ' + sign + ' 0', solText(sign), M.sol.markup(sol)],
      mistakes: ioMis(sol).concat(a !== -b ? [{ sol: { kind: sol.kind, a: N(-b), b: N(-a) }, tag: 'factor-sign', msg: facPair(a, b) + ' = 0 の解は x = ' + a + ', ' + b }] : [])
    };
  }
};
types['ineq-root'] = {
  name: '境界が ±√ の 2次不等式', level: 2,
  gen: function (R) {
    const pp = R.int(-3, 3), r = R.pick([2, 3, 5, 6, 7]), sign = R.pick(SIGNS), a = (pp === 0 ? '' : pp) + '-√' + r, b = pp === 0 ? '√' + r : pp + '+√' + r, sol = solAB(sign, a, b), B = -2 * pp, C = pp * pp - r;
    return {
      text: 'つぎの 2次不等式を解け。', expr: poly(1, B, C) + ' ' + sign + ' 0', sol: sol, keys: ['+', '√'], inside: function (x) { return holds(x * x + B * x + C, sign); },
      hint: '左辺 = 0 を 解の公式で解いて 境界を求めよう(小さいほうが 左)',
      explain: ['左辺 = 0 を解くと x = ' + am((pp === 0 ? '' : pp) + '±√' + r), solText(sign), M.sol.markup(sol)],
      mistakes: ioMis(sol).concat([{ sol: { kind: sol.kind, a: b, b: a }, tag: 'ineq-order', msg: '小さいほうを 左に書こう(' + am(a) + ' のほうが 小さい)' }])
    };
  }
};
types['ineq-neg'] = {
  name: 'x^2 の係数が負の 2次不等式', level: 2,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(-6, 6), R.int(-6, 6)]; }, function (v) { return v[0] < v[1]; }, [-1, 4]), a = v[0], b = v[1], sign = R.pick(SIGNS), sol = solAB(FLIP[sign], N(a), N(b));
    return {
      text: 'つぎの 2次不等式を解け。', expr: poly(-1, a + b, -a * b) + ' ' + sign + ' 0', sol: sol, inside: function (x) { return holds(-x * x + (a + b) * x - a * b, sign); },
      hint: '両辺に -1 を かけて、x^2 の係数を 正にしよう(不等号の向きが 変わる)',
      explain: ['両辺に -1 を かけると ' + poly(1, -(a + b), a * b) + ' ' + FLIP[sign] + ' 0', '因数分解して ' + facPair(a, b) + ' ' + FLIP[sign] + ' 0', M.sol.markup(sol)],
      mistakes: [{ sol: solAB(sign, N(a), N(b)), tag: 'neg-noflip', msg: '両辺に -1 を かけたら、不等号の向きを 逆にしよう' }, { sol: { kind: sol.kind, eq: !sol.eq, a: N(a), b: N(b) }, tag: 'ineq-eq', msg: '等号(≦・≧)が つくかどうかを 確かめよう' }]
    };
  }
};
types['ineq-letter'] = {
  name: '文字 α、β で答える 2次不等式', level: 2,
  gen: function (R) {
    const sign = R.pick(SIGNS), neg = R.chance(0.3), eff = neg ? FLIP[sign] : sign, sol = solAB(eff, 'α', 'β');
    return {
      text: 'α < β のとき、つぎの 2次不等式を解け。', expr: (neg ? '-' : '') + '(x - α)(x - β) ' + sign + ' 0', sol: sol, keys: ['α', 'β'], letters: { α: 1, β: 4 },
      inside: function (x) { return holds((neg ? -1 : 1) * (x - 1) * (x - 4), sign); },
      hint: (neg ? '両辺に -1 を かけてから、' : '') + 'y = (x - α)(x - β) の グラフを かいて 考えよう',
      explain: [neg ? '両辺に -1 を かけると (x - α)(x - β) ' + eff + ' 0' : 'グラフは x = α、β で x軸と 交わる', solText(eff), M.sol.markup(sol)],
      mistakes: ioMis(sol).concat([{ sol: { kind: sol.kind, a: 'β', b: 'α' }, tag: 'ab-order', msg: 'α < β だから、小さいほうの α を 左に書こう' }])
    };
  }
};
types['ineq-tasuki'] = {
  name: 'たすき掛けの 2次不等式(境界が分数)', level: 3,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(1, 3), R.int(-5, 5), R.int(1, 3), R.int(-5, 5)]; }, function (v) {
      return gcd(v[0], Math.abs(v[1])) === 1 && gcd(v[2], Math.abs(v[3])) === 1 && (v[0] > 1 || v[2] > 1) && v[1] * v[2] < v[3] * v[0] && (v[1] % v[0] !== 0 || v[3] % v[2] !== 0);
    }, [2, 1, 1, 3]);
    const p = v[0], q = v[1], r = v[2], s = v[3], a = F(q, p), b = F(s, r), sign = R.pick(SIGNS), sol = solAB(sign, a, b), A = p * r, B = -(p * s + q * r), C = q * s;
    const mis = ioMis(sol);
    if (q * r !== -s * p || true) { const na = F(-s, r), nb = F(-q, p); if (na !== a || nb !== b) mis.push({ sol: { kind: sol.kind, a: na, b: nb }, tag: 'factor-sign', msg: '(○x - △) = 0 の解は x = {△/○}。符号を 確かめよう' }); }
    return {
      text: 'つぎの 2次不等式を解け。', expr: poly(A, B, C) + ' ' + sign + ' 0', sol: sol, keys: ['分数'],
      inside: function (x) { return holds(z(p * x - q) * z(r * x - s), sign); },
      hint: 'たすき掛けで 因数分解して、境界の 2つの値を 求めよう',
      explain: ['左辺を因数分解して ' + facL(p, q) + facL(r, s) + ' ' + sign + ' 0', '境界は x = ' + am(a) + ', ' + am(b) + '。' + solText(sign), M.sol.markup(sol)],
      mistakes: mis
    };
  }
};
types['ineq-sqcomp'] = {
  name: '完全平方に直して判断する 2次不等式', level: 2,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(1, 3), R.int(-5, 5)]; }, function (v) { return gcd(v[0], Math.abs(v[1])) === 1; }, [1, 2]), m = v[0], n = v[1], aS = F(n, m), sign = R.pick(SIGNS), sol = sqSol(sign, aS);
    return {
      text: 'つぎの 2次不等式を解け。', expr: poly(m * m, -2 * m * n, n * n) + ' ' + sign + ' 0', sol: sol, keys: ['分数'], inside: function (x) { const t = z(m * x - n); return holdsRaw(t * t, sign); },
      hint: '左辺は (○x - △)^2 の形に 因数分解できる',
      explain: ['左辺 = ' + facL(m, n) + '^2', 'x = ' + am(aS) + ' のとき 0、それ以外は 正', M.sol.markup(sol)],
      mistakes: sqMis(sign, am(aS))
    };
  }
};
types['ineq-complete'] = {
  name: '平方完成して「すべての実数」「解なし」を判断', level: 2,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(-6, 6), R.int(1, 12)]; }, function (v) { return v[0] * v[0] < 4 * v[1]; }, [2, 3]), b = v[0], c = v[1], sign = R.pick(SIGNS), pos = sign === '>' || sign === '≧';
    const sol = { kind: pos ? 'all' : 'none' }, sq = b === 0 ? 'x^2' : '(x ' + (b > 0 ? '+ ' : '- ') + am(F(Math.abs(b), 2)) + ')^2';
    return {
      text: 'つぎの 2次不等式を解け。', expr: poly(1, b, c) + ' ' + sign + ' 0', sol: sol, inside: function (x) { return holds(x * x + b * x + c, sign); },
      hint: '平方完成して (x + ○)^2 + (正の数) の形に しよう',
      explain: ['左辺 = ' + sq + ' + ' + am(F(4 * c - b * b, 4)), '(2乗) + (正の数) は いつも 正', pos ? 'すべての実数' : '解なし'],
      mistakes: [{ sol: { kind: pos ? 'none' : 'all' }, tag: 'all-none', msg: '左辺は いつも 正。「すべての実数」と「解なし」が 逆だよ' }, { sol: { kind: 'except' }, tag: 'complete-zero', msg: '左辺が 0 になる x は ないよ(平方完成すると 正の数が 残る)' }]
    };
  }
};
types['ineq-dneg'] = {
  name: 'D < 0 を確かめて判断する 2次不等式', level: 3,
  gen: function (R) {
    const v = pickUntil(function () { return [R.pick([1, 2, 3, -1, -2, -3]), R.int(-6, 6), R.int(-9, 9)]; }, function (v) { return v[1] * v[1] - 4 * v[0] * v[2] < 0; }, [2, 1, 3]);
    const a = v[0], b = v[1], c = v[2], sign = R.pick(SIGNS), pos = sign === '>' || sign === '≧', all = a > 0 ? pos : !pos, sol = { kind: all ? 'all' : 'none' };
    return {
      text: 'つぎの 2次不等式を解け。', expr: poly(a, b, c) + ' ' + sign + ' 0', sol: sol, inside: function (x) { return holds(a * x * x + b * x + c, sign); },
      hint: '判別式 D の符号と、グラフの 凸の向きを 調べよう',
      explain: ['D = ' + (b * b - 4 * a * c) + ' < 0 だから グラフは x軸と 共有点をもたない', a > 0 ? '下に凸なので グラフは いつも x軸より 上' : '上に凸なので グラフは いつも x軸より 下', all ? 'すべての実数' : '解なし'],
      mistakes: a < 0 ? [{ sol: { kind: all ? 'none' : 'all' }, tag: 'neg-a', msg: 'x^2 の係数が 負なので グラフは 上に凸。いつも x軸より 下だよ' }] : [{ sol: { kind: all ? 'none' : 'all' }, tag: 'all-none', msg: '「すべての実数」と「解なし」が 逆だよ' }]
    };
  }
};
types['ineq-letter2'] = {
  name: '重解・実数解なしのときの 4種類(文字)', level: 3,
  gen: function (R) {
    const sign = R.pick(SIGNS);
    if (R.chance(0.5)) {
      const sol = sqSol(sign, 'α');
      return {
        text: 'a > 0 とする。2次方程式 ax^2 + bx + c = 0 が 重解 α をもつとき、つぎの 2次不等式を解け。', expr: 'ax^2 + bx + c ' + sign + ' 0', sol: sol, keys: ['α'], letters: { α: 2 },
        inside: function (x) { const t = z(x - 2); return holdsRaw(t * t, sign); },
        hint: 'グラフは 下に凸で、x = α で x軸に 接する',
        explain: ['ax^2 + bx + c = a(x - α)^2(a > 0)', 'x = α のとき 0、それ以外は 正', M.sol.markup(sol)],
        mistakes: sqMis(sign, 'α')
      };
    }
    const pos = sign === '>' || sign === '≧', sol = { kind: pos ? 'all' : 'none' };
    return {
      text: 'a > 0 とする。2次方程式 ax^2 + bx + c = 0 が 実数解をもたないとき、つぎの 2次不等式を解け。', expr: 'ax^2 + bx + c ' + sign + ' 0', sol: sol, keys: ['α'], letters: { α: 2 },
      inside: function (x) { return holds((x - 2) * (x - 2) + 1, sign); },
      hint: 'グラフは 下に凸で、x軸と 共有点をもたない',
      explain: ['D < 0 で a > 0 だから、グラフは いつも x軸より 上', 'ax^2 + bx + c は いつも 正', pos ? 'すべての実数' : '解なし'],
      mistakes: [{ sol: { kind: pos ? 'none' : 'all' }, tag: 'all-none', msg: '「すべての実数」と「解なし」が 逆だよ' }]
    };
  }
};
types['ineq-vertex'] = {
  name: '頂点だけのグラフで判断する 2次不等式', level: 3,
  gen: function (R) {
    const a = R.pick([1, 2, -1, -2]), p = R.int(-2, 2), q = a > 0 ? R.int(1, 4) : -R.int(1, 4), sign = R.pick(SIGNS), pos = sign === '>' || sign === '≧';
    const all = a > 0 ? pos : !pos, sol = { kind: all ? 'all' : 'none' }, dx = Math.sqrt(4 / Math.abs(a)), ylo = a > 0 ? -1 : q - 4.5, yhi = a > 0 ? q + 4.5 : 1;
    const vf = (a === 1 ? '' : a === -1 ? '-' : a) + fac(p) + '^2' + term(q, '', false);
    return {
      text: '2次関数 y = ' + vf + ' の グラフは 図のようになる。つぎの 2次不等式を解け。', expr: vf + ' ' + sign + ' 0', sol: sol,
      fig: { type: 'geo', view: [p - 3.5, ylo, p + 3.5, yhi], items: [{ t: 'axis', x: [p - 3.5, p + 3.5] }, { t: 'curve', pts: G.parabola(a, -2 * a * p, a * p * p + q, p - dx, p + dx), color: 'acc' },
        { t: 'point', p: [p, q], label: '(' + p + ', ' + q + ')', pos: a > 0 ? 'e' : 'e' }] },
      inside: function (x) { return holds(a * (x - p) * (x - p) + q, sign); },
      hint: '頂点の位置と 凸の向きから、グラフが x軸より 上にあるか 下にあるかを 見よう',
      explain: [(a > 0 ? '下に凸で 頂点 (' : '上に凸で 頂点 (') + p + ', ' + q + ') が x軸の ' + (a > 0 ? '上' : '下'), 'グラフは いつも x軸より ' + (a > 0 ? '上(y > 0)' : '下(y < 0)'), all ? 'すべての実数' : '解なし'],
      mistakes: [{ sol: { kind: all ? 'none' : 'all' }, tag: 'all-none', msg: 'グラフが x軸より 上なら y > 0、下なら y < 0。「すべての実数」と「解なし」が 逆だよ' }, { sol: { kind: 'except' }, tag: 'vertex-zero', msg: 'グラフは x軸と 交わらないので、0 になる x は ないよ' }]
    };
  }
};
/* ==================== 度数の森 ==================== */
types['tbl-freq'] = {
  name: '度数分布表の空欄をうめる', level: 1,
  gen: function (R) {
    const data = []; for (let i = 0; i < 12; i++) data.push(R.int(41, 89));
    for (let i = 0; i < 3; i++) data.push(10 * R.int(5, 8));                 // 階級の はしの値を 必ず入れる
    const cnt = function (inc) { return [0, 1, 2, 3, 4].map(function (k) { const a = 40 + 10 * k, b = a + 10; return data.filter(function (x) { return inc ? (x >= a && x < b) : (x > a && x <= b); }).length; }); };
    const fr = cnt(true), alt = cnt(false), ans = fr.map(String);
    return {
      text: 'つぎの 15人の得点を、度数分布表に まとめよ。', expr: R.shuffle(data).join(', '),
      table: { head: ['階級(点)', '度数(人)'], rows: fr.map(function (f, k) { return [(40 + 10 * k) + ' 以上 ' + (50 + 10 * k) + ' 未満', { a: String(f) }]; }).concat([['計', '15']]) },
      verify: function (v) { return sum(v) === 15 && v.every(function (x, k) { return x === data.filter(function (d) { return Math.floor(d / 10) === 4 + k; }).length; }); },
      hint: '「以上」は その値を ふくみ、「未満」は ふくまない。合計が 15 になるか 確かめよう',
      explain: ['「50 以上 60 未満」には 50 が入り、60 は 入らない', '度数は 上から順に ' + fr.join('、') + '(合計 15)'],
      mistakes: U.mistakes(ans, [{ answers: alt.map(String), tag: 'hist-boundary', msg: '階級の はしの値は「以上」のほうの階級に 入るよ(60点は 60 以上 70 未満)' }])
    };
  }
};
types['draw-hist'] = {
  name: '度数分布表から ヒストグラムをかく', level: 1,
  gen: function (R) {
    const fr = pickUntil(function () { const f = []; for (let i = 0; i < 5; i++) f.push(R.int(0, 9)); return f; }, function (f) { return new Set(f).size >= 3 && sum(f) >= 8; }, [2, 5, 8, 4, 1]);
    const rows = classRows(40, 10, fr, true);
    return {
      text: 'つぎの度数分布表をもとに、ヒストグラムをかけ。', fig: tbl(['階級(点)', '度数(人)'], rows),
      plot: { type: 'hist', start: 40, width: 10, freqs: fr, max: 10, xl: '(点)', yl: '(人)' },
      verify: function () { return rows.slice(0, 5).every(function (r, i) { return r[1] === fr[i]; }) && rows[5][1] === sum(fr); },
      hint: '階級ごとに、度数と同じ高さの柱を かく。柱と柱の間は あけない',
      explain: ['各階級の度数が、そのまま 柱の高さになる', '左から順に ' + fr.join('、')]
    };
  }
};
types['two-class'] = {
  name: '2つの階級をまたぐ人数(表)', level: 1,
  gen: function (R) {
    const n = R.int(5, 6), start = R.pick([40, 50, 0]), fr = []; for (let i = 0; i < n; i++) fr.push(R.int(1, 12));
    const i = R.int(0, n - 2), lo = start + 10 * i, s2 = fr[i] + fr[i + 1], ans = N(s2);
    return {
      text: 'つぎの度数分布表で、' + lo + '点以上 ' + (lo + 20) + '点未満の人数を求めよ。', fig: tbl(['階級(点)', '度数(人)'], classRows(start, 10, fr, true)), form: '□ 人', answers: [ans],
      num: [fr.filter(function (_, k) { return k === i || k === i + 1; }).reduce(function (a, b) { return a + b; }, 0)],
      hint: lo + '点以上 ' + (lo + 20) + '点未満は、2つの階級を 合わせた範囲',
      explain: [lo + '〜' + (lo + 10) + '点が ' + fr[i] + '人、' + (lo + 10) + '〜' + (lo + 20) + '点が ' + fr[i + 1] + '人', fr[i] + ' + ' + fr[i + 1] + ' = ' + s2 + '(人)'],
      mistakes: U.mistakes([ans], [m1(fr[i], 'hist-one-class', '2つの階級に またがっているよ。となりの階級も 足そう'), m1(fr[i + 1], 'hist-one-class', '2つの階級に またがっているよ。となりの階級も 足そう'),
        i + 2 < n ? m1(s2 + fr[i + 2], 'hist-boundary', (lo + 20) + '点「未満」だから、' + (lo + 20) + '点からの階級は 入らないよ') : null])
    };
  }
};
types['mean20'] = {
  name: '20個のデータの平均値', level: 1,
  gen: function (R) {
    const data = []; for (let i = 0; i < 20; i++) data.push(R.int(0, 10));
    const S = sum(data), ans = dec(S / 20);
    return {
      text: '20人の 小テスト(10点満点)の 得点は つぎのとおりである。平均値を求めよ。', expr: data.slice(0, 10).join(', ') + '\n' + data.slice(10).join(', '), form: '□ 点', answers: [ans], keys: ['.'],
      num: [data.reduce(function (a, b) { return a + b / 20; }, 0)],
      hint: '10個ずつ 合計してから 足すと 計算しやすい。最後に 20 で 割る',
      explain: ['1行目の合計 ' + sum(data.slice(0, 10)) + '、2行目の合計 ' + sum(data.slice(10)), '合計 ' + S + ' ÷ 20 = ' + ans],
      mistakes: U.mistakes([ans], [m1(dec(S / 10), 'mean-count', 'データは 20個。20 で 割ろう'), m1(S, 'mean-div', '合計を 個数で 割るのを 忘れていないかな')])
    };
  }
};
types['mode-table'] = {
  name: '度数分布表の最頻値(表)', level: 2,
  gen: function (R) {
    const start = R.pick([40, 50, 30]), fr = pickUntil(function () { const f = []; for (let i = 0; i < 5; i++) f.push(R.int(1, 12)); return f; }, function (f) { const mx = Math.max.apply(null, f); return f.filter(function (x) { return x === mx; }).length === 1; }, [2, 5, 9, 4, 1]);
    const mx = Math.max.apply(null, fr), i = fr.indexOf(mx), lo = start + 10 * i, ans = N(lo + 5);
    return {
      text: 'つぎの度数分布表から、得点の 最頻値を求めよ。', fig: tbl(['階級(点)', '度数(人)'], classRows(start, 10, fr, true)), form: '□ 点', answers: [ans], num: [start + 10 * fr.indexOf(Math.max.apply(null, fr)) + 5],
      hint: '度数分布表では、度数が いちばん大きい階級の 階級値が 最頻値',
      explain: ['度数が いちばん大きいのは ' + lo + ' 以上 ' + (lo + 10) + ' 未満(' + mx + '人)', 'その 階級値 ' + ans + ' が 最頻値'],
      mistakes: U.mistakes([ans], [m1(mx, 'mode-freq', 'それは 度数。最頻値は その階級の 階級値(まん中の値)'), m1(lo, 'mark-lower', '階級値は 階級の まん中の値。左はしでは ないよ')])
    };
  }
};
const WHYCTX = [['5人の 1か月の おこづかい', '千円', [2, 7], [30, 50]], ['5世帯の 1年間の 貯金額', '万円', [10, 40], [300, 500]], ['5人の 通学時間', '分', [10, 25], [90, 120]], ['5人の 1週間の 読書時間', '時間', [1, 5], [25, 40]], ['5人の 家から 駅までの 距離', 'km', [1, 4], [20, 35]]];
types['median-why'] = {
  name: '平均値より中央値が 向いている理由(選択)', level: 2,
  gen: function (R) {
    const c = R.pick(WHYCTX), data = []; for (let i = 0; i < 4; i++) data.push(R.int(c[2][0], c[2][1]));
    data.push(R.int(c[3][0], c[3][1])); const d = R.shuffle(data), m = sum(d) / 5, med = median(d);
    return {
      text: c[0] + 'は つぎのとおりである(単位 ' + c[1] + ')。このデータの 代表値として、平均値より 中央値が 向いている理由として 適切なものを選べ。', expr: d.join(', '),
      choices: [{ text: '極端に大きい値に 平均値が 引っぱられて、データ全体の 様子を 表しにくいから', ok: true },
        { text: '中央値は 必ず 平均値より 小さいので、ひかえめに 表せるから', tag: 'why-small', msg: '中央値が 平均値より 小さいとは かぎらないよ。理由は 極端な値の 影響' },
        { text: '平均値は データの個数が 奇数のときしか 求められないから', tag: 'why-odd', msg: '平均値は 何個のデータでも 求められるよ' },
        { text: '中央値のほうが 計算に 時間が かからないから', tag: 'why-time', msg: '計算の手間は 理由ではないよ。極端な値に 引っぱられるかどうかが ポイント' }],
      verify: function () { return m > med; },
      hint: '平均値と 中央値を 実際に 求めて くらべてみよう',
      explain: ['平均値は ' + dec(m) + '、中央値は ' + dec(med), '1つだけ 極端に大きい値があり、平均値は それに 引っぱられて 大きくなる']
    };
  }
};
types['mean-table'] = {
  name: '度数分布表から 平均値を求める', level: 3,
  gen: function (R) {
    const start = R.pick([40, 50]), fr = pickUntil(function () { const f = []; for (let i = 0; i < 5; i++) f.push(R.int(1, 9)); return f; },
      function (f) { const n = sum(f), s = sum(f.map(function (x, i) { return x * (start + 10 * i + 5); })); return isTerm(s / n) && Math.abs(s / n * 10 - Math.round(s / n * 10)) < 1e-9; }, [2, 3, 5, 3, 2]);
    const n = sum(fr), marks = fr.map(function (_, i) { return start + 10 * i + 5; }), S = sum(fr.map(function (x, i) { return x * marks[i]; })), ans = dec(S / n);
    return {
      text: 'つぎの度数分布表から、得点の 平均値を求めよ。', fig: tbl(['階級(点)', '階級値', '度数(人)'], fr.map(function (f, i) { return [(start + 10 * i) + '〜' + (start + 10 * i + 10), marks[i], f]; }).concat([['計', '', n]])),
      form: '□ 点', answers: [ans], keys: ['.'], num: [marks.reduce(function (a, x, i) { return a + x * fr[i] / n; }, 0)],
      hint: '各階級の 値を 階級値とみなして、(階級値) × (度数) の合計を 度数の合計で 割る',
      explain: ['(階級値) × (度数) の合計は ' + marks.map(function (x, i) { return x + '×' + fr[i]; }).join(' + ') + ' = ' + S, S + ' ÷ ' + n + ' = ' + ans],
      mistakes: U.mistakes([ans], [isTerm((S - 5 * n) / n) ? m1(dec((S - 5 * n) / n), 'mark-lower', '各階級の値は 階級値(まん中の値)とみなすよ') : null, isTerm(S / 5) ? m1(dec(S / 5), 'mean-classes', '割るのは 階級の数ではなく、度数の合計(' + n + ')') : null])
    };
  }
};

/* ==================== 散らばりの迷宮 ==================== */
types['quartile'] = {
  name: '四分位数(奇数個・偶数個)', level: 1,
  gen: function (R) {
    const n = R.int(7, 11), data = []; for (let i = 0; i < n; i++) data.push(R.int(1, 30));
    const f = five(data), fi = fiveIn(data), s = sorted(data), h = Math.floor(n / 2), ans = [dec(f[1]), dec(f[3])];
    const mis = [{ answers: [dec(midPos(data.slice(0, h))), dec(midPos(data.slice(n - h)))], tag: 'q-sort', msg: '先に 小さい順に 並べかえよう' }];
    if (n % 2) mis.push({ answers: [dec(fi[1]), dec(fi[3])], tag: 'q-median-in', msg: 'データが 奇数個のときは、中央値を のぞいて 下半分・上半分に 分けよう' });
    if (h % 2 === 0) mis.push({ answers: [dec(s[h / 2 - 1]), dec(s[n - h / 2])], tag: 'q-average', msg: '半分のデータが 偶数個のときは、中央の 2つの 平均を とろう' });
    return {
      text: 'つぎの ' + n + ' 個のデータの 第1四分位数 Q_1 と 第3四分位数 Q_3 を求めよ。', expr: data.join(', '), form: 'Q_1 = □、Q_3 = □', answers: ans, keys: ['.'],
      num: [median(s.filter(function (_, i) { return i < h; })), median(s.filter(function (_, i) { return i >= n - h; }))],
      hint: 'まず 小さい順に 並べる。' + (n % 2 ? '中央値を のぞいて ' : '') + '下半分・上半分の 中央値が Q_1・Q_3',
      explain: ['小さい順に並べると ' + s.join(', '), n % 2 ? '中央値 ' + f[2] + ' を のぞいて、下の ' + h + ' 個と 上の ' + h + ' 個に 分ける' : '下の ' + h + ' 個と 上の ' + h + ' 個に 分ける', 'Q_1 = ' + ans[0] + '、Q_3 = ' + ans[1]],
      mistakes: U.mistakes(ans, mis, [])
    };
  }
};
types['draw-box'] = {
  name: '箱ひげ図をかく', level: 2,
  gen: function (R) {
    const n = R.pick([9, 10, 11]), lo = 5 * R.int(2, 8);
    const data = pickUntil(function () { const d = []; for (let i = 0; i < n; i++) d.push(lo + R.int(0, 20)); return d; },
      function (d) { const f = five(d); return f.every(Number.isInteger) && f[0] < f[1] && f[1] < f[2] && f[2] < f[3] && f[3] < f[4]; }, [2, 4, 6, 9, 11, 14, 16, 18, 20, 20, 20].slice(0, n).map(function (x) { return x + lo; }));
    const s = sorted(data), v = five(data), w = fiveIn(data), h = Math.floor(n / 2);
    const mis = n % 2 && w.every(Number.isInteger) && w.join() !== v.join() && w.every(function (x, i) { return i === 0 || x >= w[i - 1]; }) ? [{ v: w, tag: 'box-include-median', msg: '奇数個のときは、中央値を のぞいた 下半分・上半分で 四分位数を 求めるよ' }] : [];
    return {
      text: 'つぎの ' + n + ' 個のデータの 箱ひげ図をかけ。', expr: R.shuffle(data).join(', '),
      plot: { type: 'boxplot', axis: [lo, lo + 20, 5], step: 1, v: v },
      verify: function () { return v[0] === s[0] && v[4] === s[n - 1] && v[2] === median(s) && v[1] === median(s.slice(0, h)) && v[3] === median(s.slice(n - h)); },
      hint: '小さい順に 並べて、最小値・Q_1・中央値・Q_3・最大値 の 5つを 求めよう',
      explain: ['小さい順に並べると ' + s.join(', '), '最小値 ' + v[0] + '、Q_1 = ' + v[1] + '、中央値 ' + v[2] + '、Q_3 = ' + v[3] + '、最大値 ' + v[4]],
      mistakes: mis
    };
  }
};
types['outlier-bound'] = {
  name: '外れ値の基準の値', level: 2,
  gen: function (R) {
    const q1 = R.int(20, 60), iqr = 2 * R.int(2, 10), q3 = q1 + iqr, lw = q1 - 1.5 * iqr, up = q3 + 1.5 * iqr, ans = [N(lw), N(up)];
    return {
      text: 'あるデータの 第1四分位数が ' + q1 + '、第3四分位数が ' + q3 + ' である。外れ値と 判断される値の 範囲を求めよ。', form: '□ 以下、または □ 以上の値', answers: ans,
      num: [q1 - (q3 - q1) * 3 / 2, q3 + (q3 - q1) * 3 / 2],
      hint: '外れ値の基準は Q_1 - 1.5 × (四分位範囲) 以下、Q_3 + 1.5 × (四分位範囲) 以上',
      explain: ['四分位範囲 = ' + q3 + ' - ' + q1 + ' = ' + iqr + '、1.5 × ' + iqr + ' = ' + 1.5 * iqr, q1 + ' - ' + 1.5 * iqr + ' = ' + lw + '、' + q3 + ' + ' + 1.5 * iqr + ' = ' + up, lw + ' 以下、または ' + up + ' 以上の値が 外れ値'],
      mistakes: U.mistakes(ans, [{ answers: [N(q1 - iqr), N(q3 + iqr)], tag: 'out-15', msg: '四分位範囲に 1.5 を かけるのを 忘れていないかな' }, { answers: [N(q1 + 1.5 * iqr), N(q3 - 1.5 * iqr)], tag: 'out-sign', msg: 'Q_1 からは 引き、Q_3 には 足すよ' }], [])
    };
  }
};
types['outlier-box'] = {
  name: '外れ値を含む・含まない箱ひげ図(図を選ぶ)', level: 3,
  gen: function (R) {
    const lo = 10 * R.int(1, 4);
    const pack = pickUntil(function () {
      const d = []; for (let i = 0; i < 8; i++) d.push(lo + R.int(0, 20));
      const f8 = five(d.concat([lo + 40])), iqr = f8[3] - f8[1], up = f8[3] + 1.5 * iqr, out = Math.ceil(up + 0.01) + R.int(1, 5);
      return [d, out];
    }, function (p) {
      const all = p[0].concat([p[1]]), f = five(all), iqr = f[3] - f[1], up = f[3] + 1.5 * iqr, lw = f[1] - 1.5 * iqr, mx = Math.max.apply(null, p[0]), f8 = five(p[0]);
      return f.every(Number.isInteger) && f[0] < f[1] && f[1] < f[2] && f[2] < f[3] && f[3] < mx && p[1] > up && mx <= up && Math.min.apply(null, p[0]) >= lw && p[1] <= lo + 49 && f8.slice(1, 4).join() !== f.slice(1, 4).join();
    }, [[lo + 2, lo + 4, lo + 6, lo + 8, lo + 10, lo + 12, lo + 14, lo + 16], lo + 40]);
    const d = pack[0], out = pack[1], all = d.concat([out]), f = five(all), mx = Math.max.apply(null, d), iqr = f[3] - f[1], up = f[3] + 1.5 * iqr, f8 = five(d);
    const ax = [lo, 10 * Math.ceil((out + 1) / 10), 10], bx = function (v, o) { return { type: 'boxplot', rows: [o ? { v: v, out: [out] } : { v: v }], axis: ax, minor: 5 }; };
    const right = f.slice(0, 4).concat([mx]);
    return {
      text: 'つぎの 9個のデータの 箱ひげ図として 正しいものを選べ。ただし、外れ値は ○ で表し、ひげは 外れ値を のぞいた 最大値まで かく。', expr: R.shuffle(all).join(', '), cols: 1,
      choices: [{ fig: bx(right, true), ok: true },
        { fig: bx(f.slice(0, 4).concat([out]), false), tag: 'out-whisker', msg: out + ' は 外れ値なので、ひげは ' + mx + ' まで。外れ値は ○ で かくよ' },
        { fig: bx(f.slice(0, 4).concat([out]), true), tag: 'out-whisker', msg: '外れ値を ○ で かいたら、ひげは 外れ値を のぞいた 最大値 ' + mx + ' まで' },
        { fig: bx(f8.slice(0, 4).concat([mx]), true), tag: 'out-recompute', msg: '四分位数は、外れ値も ふくめた 9個の データで 求めるよ' }],
      verify: function () { return out > up && mx <= up; },
      hint: 'Q_1、Q_3 を 求めて、Q_3 + 1.5 × (四分位範囲) より 大きい値が あるか 調べよう',
      explain: ['Q_1 = ' + f[1] + '、Q_3 = ' + f[3] + '、四分位範囲 ' + iqr, 'Q_3 + 1.5 × ' + iqr + ' = ' + dec(up) + ' より ' + out + ' は 外れ値', 'ひげは ' + mx + ' まで、' + out + ' は ○ で 表す']
    };
  }
};
types['q-position'] = {
  name: '個数で 4通りに分けて Q_1・Q_3 の位置を決める', level: 2,
  gen: function (R) {
    const n = R.int(7, 14), which = R.int(0, 1), h = Math.floor(n / 2), q = which ? 3 : 1;
    const pos = h % 2 ? [(h + 1) / 2] : [h / 2, h / 2 + 1], P = which ? pos.map(function (p) { return n + 1 - p; }).reverse() : pos;
    const form = P.length === 1 ? 'Q_' + q + ' は 小さいほうから □ 番目の値' : 'Q_' + q + ' は 小さいほうから □ 番目と □ 番目の 値の平均';
    const sh = which ? -1 : 1;
    return {
      text: n + ' 個のデータを 小さい順に 並べた。第' + q + '四分位数 Q_' + q + ' は 何番目の値か。', form: form, answers: P.map(N),
      verify: function (v) { const arr = []; for (let i = 1; i <= n; i++) arr.push(i); const Q = five(arr)[q]; return v.length === 1 ? v[0] === Q : (v[1] === v[0] + 1 && (v[0] + v[1]) / 2 === Q); },
      hint: '全体を 下半分・上半分に 分ける(' + (n % 2 ? '奇数個なので 中央値は どちらにも 入れない' : '偶数個なので ちょうど 半分ずつ') + ')。半分の データの 中央値を とる',
      explain: [n + ' 個は ' + (n % 2 ? '奇数' : '偶数') + '個。下半分・上半分は それぞれ ' + h + ' 個', h + ' 個の ' + (h % 2 ? 'まん中' : '中央の 2つ') + ' → ' + (which ? '上半分では ' : '') + P.join(' 番目と ') + ' 番目'],
      mistakes: U.mistakes(P.map(N), [{ answers: P.map(function (p) { return N(p + sh); }), tag: 'q-count', msg: '半分の データの 個数を 数え直そう(' + (n % 2 ? '中央値を のぞいて ' : '') + h + ' 個)' }, which ? { answers: pos.map(N), tag: 'q-which', msg: 'それは Q_1 の位置。Q_3 は 上半分の 中央' } : null])
    };
  }
};
types['box-read'] = {
  name: '箱ひげ図の読み取り', level: 2,
  gen: function (R) {
    const Nn = R.pick([20, 40, 80]), v = pickUntil(function () { const a = [5 * R.int(4, 9)]; for (let i = 0; i < 4; i++) a.push(a[a.length - 1] + 5 * R.int(1, 4)); return a; }, function (a) { return a[4] <= 100; }, [30, 45, 55, 70, 85]);
    const k = R.int(0, 3), qs = [[v[2] + '点以上', Nn / 2], [v[3] + '点以上', Nn / 4], [v[1] + '点以上 ' + v[3] + '点以下', Nn / 2], [v[1] + '点以下', Nn / 4]], c = qs[k], ans = N(c[1]);
    return {
      text: Nn + '人の テストの得点を 箱ひげ図に表した。' + c[0] + 'の 生徒は 約何人か。', fig: { type: 'boxplot', rows: [{ v: v }], axis: [Math.floor(v[0] / 10) * 10 - 10, Math.min(110, Math.ceil(v[4] / 10) * 10 + 10), 10], minor: 5, unit: '(点)' },
      form: '約 □ 人', answers: [ans], num: [[0.5, 0.25, 0.5, 0.25][k] * Nn],
      hint: '箱ひげ図の 4つの区間には、それぞれ 全体の 約 {1/4} ずつの データが 入っている',
      explain: ['最小値・Q_1・中央値・Q_3・最大値 で 分けた 4つの区間に、それぞれ 約 {1/4} ずつ 入る', c[0] + 'は 全体の 約 ' + (c[1] === Nn / 2 ? '{1/2}' : '{1/4}') + ' → 約 ' + ans + ' 人'],
      mistakes: U.mistakes([ans], [m1(c[1] === Nn / 2 ? Nn / 4 : Nn / 2, 'box-quarter', '箱ひげ図の 1つの区間には 全体の 約 {1/4}。いくつの区間を 合わせたかを 数えよう'), m1(3 * Nn / 4, 'box-quarter', '区間の数を 数え直そう。1つの区間に 約 {1/4} ずつ')])
    };
  }
};
types['hist-box'] = {
  name: 'ヒストグラムと箱ひげ図の対応(図を選ぶ)', level: 3,
  gen: function (R) {
    const make = function () { const d = [], sk = R.pick([1, -1]); for (let i = 0; i < 20; i++) { const u = Math.pow(R.next(), 2); d.push(Math.round(sk > 0 ? 40 + u * 49 : 89 - u * 49)); } return d; };
    const box = function (d) { return { type: 'boxplot', rows: [{ v: five(d) }], axis: [40, 90, 10], minor: 5 }; };
    const sets = pickUntil(function () { const d = make(); return [d, d.map(function (x) { return 129 - x; }), d.map(function (x) { return Math.min(89, x + 10); }), d.map(function (x) { return Math.max(40, x - 10); })]; },
      function (s) { return new Set(s.map(function (d) { return JSON.stringify(five(d)); })).size === 4; }, null);
    const d = sets ? sets[0] : [41, 42, 43, 45, 46, 48, 50, 51, 53, 55, 57, 60, 62, 65, 68, 71, 75, 80, 84, 88];
    const others = sets ? sets.slice(1) : [d.map(function (x) { return 129 - x; }), d.map(function (x) { return Math.min(89, x + 10); }), d.map(function (x) { return Math.max(40, x - 10); })];
    const fr = [0, 1, 2, 3, 4].map(function (k) { return d.filter(function (x) { return x >= 40 + 10 * k && x < 50 + 10 * k; }).length; });
    return {
      text: '20人の 得点の ヒストグラムである。このデータの 箱ひげ図として 正しいものを選べ。', fig: { type: 'hist', start: 40, width: 10, freqs: fr, xl: '(点)', yl: '(人)' }, cols: 1,
      choices: [{ fig: box(d), ok: true }, { fig: box(others[0]), tag: 'hist-box-mirror', msg: 'ヒストグラムの山が どちら側に かたよっているかを 見よう。箱の位置も 同じ側に かたよる' },
        { fig: box(others[1]), tag: 'hist-box-shift', msg: '中央値(10番目と 11番目の 平均)が どの階級に あるかを 数えて 確かめよう' }, { fig: box(others[2]), tag: 'hist-box-shift', msg: '中央値(10番目と 11番目の 平均)が どの階級に あるかを 数えて 確かめよう' }],
      verify: function () { const f = five(d), cum = function (x) { return d.filter(function (y) { return y <= x; }).length; }; return cum(f[2]) >= 10 && fr.reduce(function (a, b) { return a + b; }, 0) === 20; },
      hint: '小さいほうから 数えて、5番目・10番目・15番目あたりが どの階級に あるかを 調べよう',
      explain: ['中央値は 小さいほうから 10番目と 11番目の 平均', 'ヒストグラムの度数を 足していって、Q_1・中央値・Q_3 が 入る階級を 確かめる']
    };
  }
};
types['var-sd'] = {
  name: '分散と標準偏差(偏差から)', level: 2,
  gen: function (R) {
    const k = R.int(0, 1), data = pickUntil(function () { const d = []; for (let i = 0; i < 5; i++) d.push(R.int(1, 15)); return d; },
      function (d) { const m = sum(d) / 5, V = varOf(d); return Number.isInteger(m) && V > 0 && (k === 0 || Number.isInteger(V)); }, [2, 4, 6, 8, 10]);
    const m = sum(data) / 5, dv = data.map(function (x) { return x - m; }), S2 = sum(dv.map(function (x) { return x * x; })), V = S2 / 5;
    const head = ['平均値は ' + m + '、偏差は ' + dv.join(', '), '分散 = (偏差の2乗の和) ÷ 5 = ' + S2 + ' ÷ 5 = ' + dec(V)];
    if (k === 0) return {
      text: 'つぎの 5個のデータの 分散を求めよ。', expr: data.join(', '), form: '□', answers: [dec(V)], keys: ['.'], num: [sum(data.map(function (x) { return x * x; })) / 5 - m * m],
      hint: '分散 = (偏差の2乗) の平均', explain: head,
      mistakes: U.mistakes([dec(V)], [m1(dec(S2 / 4), 'var-n1', '分散は データの個数(5)で 割るよ'), m1(S2, 'var-div', '偏差の2乗の和を 個数で 割ろう'), m1(dec(sum(dv.map(Math.abs)) / 5), 'var-square', '偏差を 2乗してから 平均を とろう')])
    };
    const ans = sqrtStr(V);
    return {
      text: 'つぎの 5個のデータの 標準偏差を求めよ。', expr: data.join(', '), form: '□', answers: [ans], keys: ['√', '.'], num: [Math.sqrt(sum(data.map(function (x) { return x * x; })) / 5 - m * m)],
      hint: '標準偏差 = √(分散)', explain: head.concat(['標準偏差 = √{' + V + '} = ' + am(ans)]),
      mistakes: U.mistakes([ans], [m1(N(V), 'sd-root', 'それは 分散。標準偏差は その 正の平方根'), isTerm(S2 / 4) && isSq(S2 / 4) ? m1(N(Math.sqrt(S2 / 4)), 'var-n1', '分散は データの個数(5)で 割るよ') : null])
    };
  }
};
types['var-method'] = {
  name: '分散の 2つの求め方の使い分け(x^2 の平均 - 平均の2乗)', level: 3,
  gen: function (R) {
    const n = R.pick([4, 5]), data = pickUntil(function () { const d = []; for (let i = 0; i < n; i++) d.push(R.int(1, 9)); return d; }, function (d) { return sum(d) % n !== 0 && varOf(d) > 0; }, [1, 2, 4, 6]);
    const S = sum(data), S2 = sum(data.map(function (x) { return x * x; })), ans = F(n * S2 - S * S, n * n);
    return {
      text: 'つぎの データの 平均値は 整数ではない。分散を、(x^2 の平均値) - (x の平均値)^2 を使って求めよ。', expr: data.join(', '), form: '□', answers: [ans], keys: ['分数'], num: [varOf(data)],
      hint: '平均値が 整数でないときは、偏差を 使うより (x^2 の平均) - (平均)^2 のほうが 計算が 楽',
      explain: ['x の平均値は ' + am(F(S, n)) + '、x^2 の平均値は ' + am(F(S2, n)), '分散 = ' + am(F(S2, n)) + ' - (' + am(F(S, n)) + ')^2', '= ' + am(ans)],
      mistakes: U.mistakes([ans], [{ answers: [F(S * S - n * S2, n * n)], tag: 'var-order', msg: '引く順番が 逆だよ。(x^2 の平均) - (平均の2乗)。分散は 負には ならない' }, { answers: [F(S2 - S, n)], tag: 'var-meansq', msg: '平均値を 2乗するのを 忘れていないかな' }])
    };
  }
};
types['sd-compare'] = {
  name: '標準偏差で 散らばりを比べる', level: 2,
  gen: function (R) {
    const pair = pickUntil(function () { const a = [], b = []; for (let i = 0; i < 5; i++) { a.push(R.int(1, 10)); b.push(R.int(1, 10)); } return [a, b]; },
      function (p) { return sum(p[0]) === sum(p[1]) && Math.abs(varOf(p[0]) - varOf(p[1])) > 0.5; }, [[4, 5, 5, 5, 6], [1, 3, 5, 7, 9]]);
    const VA = varOf(pair[0]), VB = varOf(pair[1]), big = VA > VB ? 'A' : 'B', m = sum(pair[0]) / 5;
    return {
      text: '2つの組 A、B の 5人ずつの 小テストの得点である。標準偏差を くらべて、散らばりが 大きいほうを選べ。', expr: 'A: ' + pair[0].join(', ') + '\nB: ' + pair[1].join(', '),
      choices: [{ text: 'A のほうが 散らばりが 大きい', ok: big === 'A', tag: 'sd-compare', msg: '分散は A が ' + dec(VA) + '、B が ' + dec(VB) + '。大きいほうが 散らばりが 大きい' },
        { text: 'B のほうが 散らばりが 大きい', ok: big === 'B', tag: 'sd-compare', msg: '分散は A が ' + dec(VA) + '、B が ' + dec(VB) + '。大きいほうが 散らばりが 大きい' },
        { text: '平均値が 等しいので、散らばりの 大きさも 等しい', tag: 'sd-mean', msg: '平均値が 同じでも、散らばりの 大きさは ちがうことが あるよ' }],
      verify: function () { return (big === 'A') === (Math.sqrt(VA) > Math.sqrt(VB)); },
      hint: 'それぞれの 分散(標準偏差)を 求めて くらべよう。平均値は どちらも ' + dec(m),
      explain: ['平均値は どちらも ' + dec(m), '分散は A が ' + dec(VA) + '、B が ' + dec(VB) + '(標準偏差も 同じ大小)', big + ' のほうが 散らばりが 大きい']
    };
  }
};
types['draw-scatter'] = {
  name: '散布図をかく', level: 1,
  gen: function (R) {
    const pts = pickUntil(function () { const d = []; for (let i = 0; i < 5; i++) d.push([R.int(1, 7), R.int(1, 7)]); return d; },
      function (d) { return new Set(d.map(function (q) { return q.join(); })).size === 5 && d.some(function (q) { return q[0] !== q[1]; }); }, [[1, 2], [3, 3], [4, 6], [6, 5], [7, 7]]);
    const nm = ['A', 'B', 'C', 'D', 'E'];
    return {
      text: '5人の 2つのテストの得点 x、y が 表のとおりである。散布図をかけ。', fig: tbl([''].concat(nm), [['x'].concat(pts.map(function (q) { return q[0]; })), ['y'].concat(pts.map(function (q) { return q[1]; }))]),
      plot: { type: 'scatter', xr: [0, 8, 1], yr: [0, 8, 1], pts: pts },
      verify: function () { return pts.length === 5 && pts.every(function (q) { return q[0] >= 1 && q[0] <= 7 && q[1] >= 1 && q[1] <= 7; }); },
      hint: '表の たての 1列が 1人ぶん。横軸に x、たて軸に y を とって 点を置く',
      explain: ['表の各列の (x, y) を 1つの点として かく', '点は ' + pts.map(function (q, i) { return nm[i] + '(' + q[0] + ', ' + q[1] + ')'; }).join('、')]
    };
  }
};
const SC_FALL = {
  pos: [[1, 2], [2, 1], [2, 3], [3, 3], [4, 3], [4, 5], [5, 4], [5, 6], [6, 6], [7, 6], [7, 8], [8, 7], [8, 9], [9, 8]],
  neg: [[1, 8], [2, 9], [2, 7], [3, 7], [4, 7], [4, 5], [5, 6], [5, 4], [6, 4], [7, 4], [7, 2], [8, 3], [8, 1], [9, 2]],
  none: [[1, 5], [2, 2], [2, 8], [3, 5], [4, 1], [4, 9], [5, 5], [5, 3], [6, 7], [7, 2], [7, 8], [8, 5], [8, 3], [9, 6]]
};
types['corr-choose'] = {
  name: '散布図から 相関を選ぶ', level: 1,
  gen: function (R) {
    const kind = R.pick(['pos', 'neg', 'none']);
    const pts = pickUntil(function () { const p = []; for (let i = 0; i < 14; i++) { const x = R.int(1, 9), y = kind === 'none' ? R.int(1, 9) : (kind === 'pos' ? x : 10 - x) + R.int(-2, 2); p.push([x, Math.max(0, Math.min(10, y))]); } return p; },
      function (p) { const r = corr(p); return kind === 'pos' ? r > 0.75 : kind === 'neg' ? r < -0.75 : Math.abs(r) < 0.25; }, SC_FALL[kind]);
    const r = corr(pts);
    return {
      text: 'つぎの散布図で、2つの変量 x、y の間には どのような相関があるか。', fig: { type: 'scatter', pts: pts, xr: [0, 10, 2], yr: [0, 10, 2] },
      choices: [{ text: '正の相関がある', ok: kind === 'pos', tag: 'corr-sign', msg: '右上がりなら 正の相関。この図は ' + (kind === 'neg' ? '右下がりだよ' : 'ばらばらに 散らばっているよ') },
        { text: '負の相関がある', ok: kind === 'neg', tag: 'corr-sign', msg: '右下がりなら 負の相関。この図は ' + (kind === 'pos' ? '右上がりだよ' : 'ばらばらに 散らばっているよ') },
        { text: '相関がない', ok: kind === 'none', tag: 'corr-none', msg: kind === 'neg' ? '右下がりは「相関がない」ではなく 負の相関だよ' : '点が 右上がりの直線の近くに 集まっているよ' }],
      verify: function () { return kind === 'pos' ? r > 0.7 : kind === 'neg' ? r < -0.7 : Math.abs(r) < 0.3; },
      hint: '点の集まりが 右上がりか、右下がりか、どちらでもないかを見よう',
      explain: ['右上がり → 正の相関、右下がり → 負の相関、どちらでもない → 相関がない', 'この散布図は ' + (kind === 'pos' ? '右上がり' : kind === 'neg' ? '右下がり' : '全体に 散らばっている') + '(相関係数は 約 ' + r.toFixed(2) + ')']
    };
  }
};
const RPAIRS = [[40, 10, 20], [90, 10, 30], [20, 20, 20], [45, 20, 30], [80, 20, 40], [160, 10, 40], [50, 50, 50]];
types['corr-calc'] = {
  name: '偏差の積の表から 相関係数を求める', level: 3,
  gen: function (R) {
    const pr = R.pick(RPAIRS), rr = R.int(2, 9) * (R.chance(0.5) ? 1 : -1) / 10, Sxy = Math.round(pr[2] * rr), ans = dec(rr), alt = Sxy / (pr[0] + pr[1]);
    return {
      text: '2つの変量 x、y について、偏差の2乗の和と 偏差の積の和が 表のようになった。相関係数 r を求めよ。', fig: tbl(['', '値'], [['x の偏差の2乗の和', pr[0]], ['y の偏差の2乗の和', pr[1]], ['偏差の積の和', Sxy]]),
      form: 'r = □', answers: [ans], keys: ['.'], num: [Sxy / Math.sqrt(pr[0] * pr[1])],
      hint: 'r = (偏差の積の和) ÷ √{(x の偏差の2乗の和) × (y の偏差の2乗の和)}',
      explain: ['r = (偏差の積の和) ÷ √{(x の偏差の2乗の和) × (y の偏差の2乗の和)}', '= ' + Sxy + ' ÷ √{' + pr[0] + ' × ' + pr[1] + '} = ' + Sxy + ' ÷ ' + pr[2], 'r = ' + ans],
      mistakes: U.mistakes([ans], [m1(dec(-rr), 'r-sign', '偏差の積の和の 符号を そのまま 使おう'), isTerm(alt) ? m1(dec(alt), 'r-sum', '分母は √{(x の和) × (y の和)}。たし算では ないよ') : null,
        m1(N(Sxy), 'r-div', '偏差の積の和を √{(x の和) × (y の和)} で 割ろう。r は -1 以上 1 以下')])
    };
  }
};
const CAUSE = [['アイスクリームの売上', '水の事故の件数', '気温'], ['小学生の 靴のサイズ', '計算問題を解く速さ', '学年'], ['国ごとの テレビの台数', '国ごとの 平均寿命', '国の豊かさ'],
  ['出動した 消防車の台数', '火事の被害額', '火事の大きさ'], ['市の 図書館の本の数', '市の 交通事故の件数', '市の人口'], ['毎日の 傘の売上', '電車の遅れの回数', '雨の日']];
types['corr-cause'] = {
  name: '相関と因果の違い', level: 2,
  gen: function (R) {
    const c = R.pick(CAUSE);
    return {
      text: c[0] + ' と ' + c[1] + ' の間には、強い正の相関が 見られた。このことについて 正しいものを選べ。',
      choices: ch3('相関が あっても、一方が 他方の 原因とは かぎらない(' + c[2] + 'のような ほかの要因が 関係しているかもしれない)', [
        [c[0] + 'を 増やせば、' + c[1] + 'も 増える', 'cause-yes', '相関が あるだけでは、一方を 増やすと 他方が 増える(原因と結果)とは いえないよ'],
        [c[1] + 'が 原因で、' + c[0] + 'が 増えている', 'cause-yes', '相関係数からは、どちらが 原因かは わからないよ'],
        ['相関係数が 1 に近いので、2つは まったく 関係がない', 'corr-sign', '相関係数が 1 に近いのは、強い正の相関が あるということ']]),
      hint: '2つの量が いっしょに 増えるのは、別の 共通の原因が あるからかもしれない',
      explain: ['相関は「一方が 大きいと 他方も 大きい 傾向」を 表すだけ', c[2] + 'のような ほかの要因が、両方に 関係していると 考えられる']
    };
  }
};
function ch3(right, wrongs) { return [{ text: right, ok: true }].concat(wrongs.map(function (w) { return { text: w[0], tag: w[1], msg: w[2] }; })); }
types['r-pick'] = {
  name: '散布図から r に近い値を選ぶ', level: 3,
  gen: function (R) {
    const ks = [['0.9', function (r) { return r > 0.85; }, 1, 1], ['0.5', function (r) { return r > 0.3 && r < 0.65; }, 0.5, 3], ['-0.5', function (r) { return r < -0.3 && r > -0.65; }, -0.5, 3], ['-0.9', function (r) { return r < -0.85; }, -1, 1]];
    const t = R.int(0, 3), K = ks[t];
    let pts = null;
    for (let i = 0; i < 1000 && !pts; i++) {
      const p = []; for (let j = 0; j < 12; j++) { const x = R.int(1, 9), y = Math.round(5 + K[2] * (x - 5) + R.int(-K[3], K[3])); p.push([x, Math.max(0, Math.min(10, y))]); }
      if (K[1](corr(p))) pts = p;
    }
    if (!pts) pts = t === 0 ? SC_FALL.pos : t === 3 ? SC_FALL.neg : null;
    if (!pts) { pts = []; for (let j = 0; j < 12; j++) pts.push([1 + (j % 9), Math.round(5 + K[2] * ((j % 9) - 4) + [2, -2, 0][j % 3])]); }
    const r = corr(pts);
    return {
      text: 'つぎの散布図の 相関係数に いちばん近い値を選べ。', fig: { type: 'scatter', pts: pts, xr: [0, 10, 2], yr: [0, 10, 2] },
      choices: ks.map(function (k, i) { return { text: k[0], ok: i === t, tag: Math.sign(k[2]) !== Math.sign(K[2]) ? 'corr-sign' : 'corr-strength', msg: Math.sign(k[2]) !== Math.sign(K[2]) ? '右上がりなら 正、右下がりなら 負だよ' : '点が 直線の近くに 集まっているほど、r は ±1 に 近い' }; }),
      verify: function () { return K[1](r); },
      hint: '右上がりか 右下がりかで 符号、点が 直線に どれだけ 近いかで 大きさを 判断しよう',
      explain: ['この散布図は ' + (K[2] > 0 ? '右上がり' : '右下がり') + 'で、点の集まり方は ' + (Math.abs(K[2]) === 1 ? '直線に 近い' : 'ゆるやか'), '相関係数は 約 ' + r.toFixed(2) + ' で、' + K[0] + ' に いちばん近い']
    };
  }
};
/* ==================== 隠し①:解の配置の深淵(考査範囲外) ==================== */
types['hx-coef'] = {
  name: '発展: x^2 の係数が文字の方程式', level: 5,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(1, 4), R.pick([1, 2, 3, 4, 6, 8, 9, 12, 16])]; }, function (v) { return (v[0] * v[0]) % v[1] === 0; }, [2, 4]), b = v[0], c = v[1], A = b * b / c, ans = ['0', N(A)];
    return {
      text: 'x の方程式 ax^2 + ' + 2 * b + 'x + ' + c + ' = 0 が ただ 1つの実数解をもつような 定数 a の値を すべて求めよ。', form: 'a = □, □', answers: ans, unordered: [[0, 1]],
      verify: function (w) { return w[0] !== w[1] && w.every(function (a) { return a === 0 || Math.abs(b * b - a * c) < 1e-9; }); },
      hint: '「2次方程式」とは 書いていない。a = 0 のときも 考えよう',
      explain: ['a = 0 のとき ' + 2 * b + 'x + ' + c + ' = 0 で、解は x = ' + am(F(-c, 2 * b)) + ' の 1つ', 'a ≠ 0 のとき D/4 = ' + b * b + ' - ' + c + 'a = 0 より a = ' + A, 'a = 0, ' + A],
      mistakes: U.mistakes(ans, [{ answers: [N(A), N(-A)], tag: 'coef-zero', msg: 'a = 0 のときは 1次方程式になり、解は ただ 1つ。a = 0 も 調べよう' }, { answers: ['0', N(-A)], tag: 'disc-sign', msg: '判別式の 符号を 確かめよう' }], [[0, 1]])
    };
  }
};
types['hx-kcount'] = {
  name: '発展: k で場合分けする 実数解の個数', level: 5,
  gen: function (R) {
    const s = R.chance(0.3) ? -1 : 1, b = 2 * R.int(-3, 3) + R.int(0, 1), c = R.int(-5, 5), k0 = F(4 * c - s * b * b, 4), lo = s > 0 ? '0' : '2', hi = s > 0 ? '2' : '0', ans = [k0, lo, k0, hi];
    const cnt = function (k) { const D = b * b - 4 * s * (c - k); return D > 1e-9 ? 2 : D < -1e-9 ? 0 : 1; };
    return {
      text: 'x の方程式 ' + poly(s, s * b, c) + ' = k の 実数解の個数を、定数 k の値で 場合分けして答えよ。', form: 'k < □ のとき □ 個、k > □ のとき □ 個', answers: ans, keys: ['分数'],
      verify: function (w) { return Math.abs(w[0] - w[2]) < 1e-9 && cnt(w[0] - 1) === w[1] && cnt(w[0] + 1) === w[3] && cnt(w[0]) === 1; },
      hint: 'y = ' + poly(s, s * b, c) + ' の グラフと 直線 y = k の 共有点の 個数を 考えよう',
      explain: ['y = ' + poly(s, s * b, c) + ' の グラフは 頂点の y座標が ' + am(k0) + ' の ' + (s > 0 ? '下に凸' : '上に凸') + 'の 放物線', '直線 y = k との 共有点の数が 実数解の個数', 'k < ' + am(k0) + ' で ' + lo + ' 個、k = ' + am(k0) + ' で 1 個、k > ' + am(k0) + ' で ' + hi + ' 個'],
      mistakes: U.mistakes(ans, [{ answers: [k0, hi, k0, lo], tag: 'kcount-swap', msg: 'グラフが ' + (s > 0 ? '下に凸' : '上に凸') + 'なので、直線 y = k を 動かして 確かめよう' }, { answers: [F(-(4 * c - s * b * b), 4), lo, F(-(4 * c - s * b * b), 4), hi], tag: 'vertex-sign', msg: '頂点の y座標の 符号を 確かめよう' }])
    };
  }
};
types['hx-coef-sol'] = {
  name: '発展: 解の範囲から 係数を求める', level: 5,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(-5, 5), R.int(-5, 5)]; }, function (v) { return v[0] < v[1] && v[0] !== 0 && v[1] !== 0 && v[0] !== -v[1]; }, [-2, 3]), p = v[0], q = v[1], k = R.int(0, 2);
    if (k === 2) {
      const a = -R.int(1, 3), C = a * p * q, b = -a * (p + q), ans = [N(a), N(b)];
      return {
        text: '2次不等式 ax^2 + bx' + term(C, '', false) + ' > 0 の解が ' + p + ' < x < ' + q + ' となるような 定数 a、b の値を求めよ。', form: 'a = □、b = □', answers: ans,
        verify: function (w) { return w[0] < 0 && [p, q].every(function (x) { return Math.abs(w[0] * x * x + w[1] * x + C) < 1e-9; }); },
        hint: '解が ' + p + ' < x < ' + q + ' になるのは、a < 0 で a(x - ' + p + ')(x - ' + q + ') > 0 のとき',
        explain: ['a < 0 で、ax^2 + bx' + term(C, '', false) + ' = a' + facPair(p, q), '定数項をくらべて ' + (p * q) + 'a = ' + C + ' より a = ' + a, 'b = ' + b],
        mistakes: U.mistakes(ans, [{ answers: [N(-a), N(-b)], tag: 'coef-sign', msg: '解が 2つの値の「間」になるのは、x^2 の係数が 負のとき' }, { answers: [N(a), N(-b)], tag: 'coef-sign', msg: 'b = -a(' + p + ' + ' + q + ') の 符号に注意' }])
      };
    }
    const sign = k === 0 ? '<' : '>', ans = [N(-(p + q)), N(p * q)];
    return {
      text: '2次不等式 x^2 + ax + b ' + sign + ' 0 の解が ' + (k === 0 ? p + ' < x < ' + q : 'x < ' + p + ', ' + q + ' < x') + ' となるような 定数 a、b の値を求めよ。', form: 'a = □、b = □', answers: ans,
      verify: function (w) { return [p, q].every(function (x) { return Math.abs(x * x + w[0] * x + w[1]) < 1e-9; }); },
      hint: 'x^2 + ax + b = (x - ' + p + ')(x - ' + q + ') になる',
      explain: ['x^2 + ax + b = ' + facPair(p, q) + ' = ' + poly(1, -(p + q), p * q), 'a = ' + ans[0] + '、b = ' + ans[1]],
      mistakes: U.mistakes(ans, [{ answers: [N(p + q), N(p * q)], tag: 'coef-sign', msg: '(x - p)(x - q) を 展開すると x の係数は -(p + q)' }, { answers: [N(-(p + q)), N(-p * q)], tag: 'coef-sign', msg: '定数項は p × q。符号を 確かめよう' }])
    };
  }
};
types['hx-allreal'] = {
  name: '発展: すべての実数で成り立つ条件', level: 5,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(-4, 4), R.int(-4, 4)]; }, function (v) { return v[0] < v[1] && v[0] + v[1] !== 0; }, [-1, 2]), r1 = v[0], r2 = v[1], p = r1 + r2, q = -r1 * r2, sol = { kind: 'between', a: N(r1), b: N(r2) };
    return {
      text: 'すべての実数 x について 2次不等式 x^2 + 2mx' + term(p, 'm', false) + term(q, '', false) + ' > 0 が 成り立つような 定数 m の値の範囲を求めよ。', sol: sol, solVar: 'm', shapes: ['between', 'outside', 'gt', 'lt'],
      inside: function (m) { return z(m * m - p * m - q) < 0; },
      hint: 'x^2 の係数が 正なので、グラフが x軸と 共有点をもたない ⇔ D < 0',
      explain: ['すべての x で成り立つ ⇔ D/4 < 0', 'D/4 = m^2 - (' + term(p, 'm', true) + term(q, '', false) + ') = ' + facPair(r1, r2).replace(/x/g, 'm') + ' < 0', M.sol.markup(sol, 'm')],
      mistakes: [{ sol: { kind: 'outside', a: N(r1), b: N(r2) }, tag: 'allreal-d', msg: 'すべての x で 正 ⇔ グラフが x軸と 交わらない ⇔ D < 0' }, { sol: { kind: 'between', eq: true, a: N(r1), b: N(r2) }, tag: 'ineq-eq', msg: 'D = 0 のときは 接点で 0 になるので、> 0 は 成り立たないよ' }]
    };
  }
};
types['hx-separate'] = {
  name: '発展: 定数の分離', level: 5,
  gen: function (R) {
    const L = R.int(3, 5), p = R.int(1, L - 1), c = R.int(-3, 6), v = c - p * p, f0 = c, fL = L * L - 2 * p * L + c, mn = Math.min(f0, fL), mx = Math.max(f0, fL), sol = { kind: 'between', a: N(v), b: N(mn) };
    const mis = [{ sol: { kind: 'between', eq: true, a: N(v), b: N(mn) }, tag: 'sep-eq', msg: '端の値では 解が 1つ(x = 0 または ' + L + ' は ふくまない)、頂点では 重解。等号は つかないよ' }, { sol: { kind: 'gt', a: N(v) }, tag: 'sep-range', msg: 'x の範囲が 0 < x < ' + L + ' に かぎられている。グラフの 端の 高さも 見よう' }];
    if (mx !== mn) mis.push({ sol: { kind: 'between', a: N(v), b: N(mx) }, tag: 'sep-max', msg: '高いほうの 端まで 上げると、低いほうの 端を こえて 共有点が 1つに なるよ' });
    return {
      text: 'x の方程式 ' + poly(1, -2 * p, c) + ' = k が 0 < x < ' + L + ' の範囲に 異なる 2つの実数解をもつような 定数 k の値の範囲を求めよ。', sol: sol, solVar: 'k', shapes: ['between', 'outside', 'gt', 'lt'],
      inside: function (k) { const d = p * p - c + k; if (d <= 1e-12) return false; const s = Math.sqrt(d); return p - s > 1e-9 && p + s < L - 1e-9; },
      hint: 'y = ' + poly(1, -2 * p, c) + '(0 < x < ' + L + ')の グラフと 直線 y = k の 共有点が 2つになる k を さがそう',
      explain: ['f(x) = ' + poly(1, -2 * p, c) + ' は 頂点 (' + p + ', ' + v + ')、f(0) = ' + f0 + '、f(' + L + ') = ' + fL, '直線 y = k が 頂点より上で、低いほうの 端(' + mn + ')より 下なら 2点で 交わる', M.sol.markup(sol, 'k')],
      mistakes: mis
    };
  }
};
types['hx-placement'] = {
  name: '発展: 解の配置(2つの正の解)', level: 5,
  gen: function (R) {
    const pack = pickUntil(function () { const a = R.int(-4, 3), b = a + R.int(1, 5); return [a, b]; }, function (v) {
      const p = v[0] + v[1], q = -v[0] * v[1]; if (p === 0) return false;
      const ok = function (m) { return (m - v[0]) * (m - v[1]) > 0 && m > 0 && p * m + q > 0; }, e = sorted([v[0], v[1], 0, -q / p]);
      const segs = []; for (let i = 0; i <= e.length; i++) { const x = i === 0 ? e[0] - 1 : i === e.length ? e[e.length - 1] + 1 : (e[i - 1] + e[i]) / 2; segs.push(ok(x)); }
      const on = segs.map(function (s, i) { return s ? i : -1; }).filter(function (i) { return i >= 0; });
      return on.length >= 1 && on[on.length - 1] - on[0] === on.length - 1 && on[0] > 0 && (on[on.length - 1] < e.length || on.length === 1);
    }, [1, 3]);
    const r1 = pack[0], r2 = pack[1], p = r1 + r2, q = -r1 * r2, ok = function (m) { return (m - r1) * (m - r2) > 0 && m > 0 && p * m + q > 0; }, e = sorted([r1, r2, 0, -q / p]);
    let ia = -1, ib = -1;
    for (let i = 0; i <= e.length; i++) { const x = i === 0 ? e[0] - 1 : i === e.length ? e[e.length - 1] + 1 : (e[i - 1] + e[i]) / 2; if (ok(x)) { if (ia < 0) ia = i; ib = i; } }
    const str = function (x) { return Math.abs(x + q / p) < 1e-12 ? F(-q, p) : N(Math.round(x)); };
    const sol = ib === e.length ? { kind: 'gt', a: str(e[ia - 1]) } : { kind: 'between', a: str(e[ia - 1]), b: str(e[ib]) };
    return {
      text: 'x の 2次方程式 x^2 - 2mx' + term(p, 'm', false) + term(q, '', false) + ' = 0 が 異なる 2つの 正の解をもつような 定数 m の値の範囲を求めよ。', sol: sol, solVar: 'm', keys: ['分数'], shapes: ['between', 'outside', 'gt', 'lt'],
      inside: function (m) { const k = p * m + q, d = m * m - k; return d > 1e-9 && k > 1e-9 && m > 1e-9 && m - Math.sqrt(d) > 1e-9; },
      hint: 'f(x) = (左辺)とおき、① D > 0 ② 軸 x = m > 0 ③ f(0) > 0 の 3つを 同時に 満たす m を 求めよう',
      explain: ['① D/4 = ' + facPair(r1, r2).replace(/x/g, 'm') + ' > 0 ② 軸 m > 0 ③ f(0) = ' + term(p, 'm', true) + term(q, '', false) + ' > 0', '3つを 数直線で 重ねる', M.sol.markup(sol, 'm')],
      mistakes: [{ sol: { kind: 'outside', a: N(r1), b: N(r2) }, tag: 'place-d-only', msg: '判別式だけでは 足りない。軸の位置と f(0) の符号も 条件に 入れよう' }, { sol: { kind: sol.kind, eq: true, a: sol.a, b: sol.b }, tag: 'ineq-eq', msg: '「異なる」「正の」なので 等号は つかないよ' }]
    };
  }
};
types['hx-system'] = {
  name: '発展: 連立2次不等式・2次不等式の利用', level: 5,
  gen: function (R) {
    if (R.chance(0.35)) {
      const r1 = R.int(1, 4), r2 = 10 - r1, A = r1 * r2, sol = { kind: 'between', eq: true, a: N(r1), b: N(r2) };
      return {
        text: '周の長さが 20 cm の 長方形で、面積が ' + A + ' cm^2 以上に なるような 縦の長さ x cm の 範囲を求めよ。', sol: sol, inside: function (x) { return x > 0 && x < 10 && z(x * (10 - x) - A) >= 0; },
        hint: '横の長さは 10 - x。x(10 - x) ≧ ' + A + ' を 解こう(0 < x < 10)',
        explain: ['横の長さは 10 - x(0 < x < 10)', 'x(10 - x) ≧ ' + A + ' より ' + facPair(r1, r2) + ' ≦ 0', M.sol.markup(sol)],
        mistakes: [{ sol: { kind: 'outside', a: N(r1), b: N(r2) }, tag: 'ineq-inout', msg: 'x^2 の係数を 正にすると ≦ 0。2つの解の 間だよ' }, { sol: { kind: 'between', eq: false, a: N(r1), b: N(r2) }, tag: 'ineq-eq', msg: '「以上」なので 等号が つくよ' }]
      };
    }
    const v = pickUntil(function () { const a = R.int(-4, 2), b = a + R.int(3, 6), c = R.int(a - 3, a - 1), d = R.int(a + 1, b - 1); return [a, b, c, d]; }, function () { return true; }, [-1, 4, -3, 2]);
    const a = v[0], b = v[1], c = v[2], d = v[3], sol = { kind: 'between', a: N(d), b: N(b) };
    return {
      text: 'つぎの 連立不等式を解け。', expr: poly(1, -(a + b), a * b) + ' < 0\n' + poly(1, -(c + d), c * d) + ' > 0', sol: sol,
      inside: function (x) { return z((x - a) * (x - b)) < 0 && z((x - c) * (x - d)) > 0; },
      hint: 'それぞれを 解いて、数直線で 共通部分を とろう',
      explain: ['1つ目は ' + a + ' < x < ' + b + '、2つ目は x < ' + c + ', ' + d + ' < x', '共通部分を とる', M.sol.markup(sol)],
      mistakes: [{ sol: { kind: 'between', a: N(a), b: N(b) }, tag: 'sys-one', msg: 'もう 1つの 不等式も 満たす 範囲に しぼろう' }, { sol: { kind: 'between', a: N(c), b: N(b) }, tag: 'sys-overlap', msg: '2つ目の 不等式の解は 外側。共通部分を 数直線で 確かめよう' }]
    };
  }
};
types['hx-chord'] = {
  name: '発展: x軸から切り取る線分の長さ', level: 5,
  gen: function (R) {
    const v = pickUntil(function () { return [R.pick([1, 1, 2]), R.int(-6, 6), R.int(-8, 8)]; }, function (v) { return v[1] * v[1] - 4 * v[0] * v[2] > 0; }, [1, 2, -2]);
    const a = v[0], b = v[1], c = v[2], D = b * b - 4 * a * c, ans = radFrac(1, D, a);
    return {
      text: '放物線 y = ' + poly(a, b, c) + ' が x軸から 切り取る 線分の長さを求めよ。', form: '□', answers: [ans], keys: ['√', '分数'], num: [Math.sqrt(D) / a],
      hint: 'x軸との 2つの交点の x座標 α、β の 差 β - α を 求める',
      explain: ['y = 0 の解は x = {' + (-b) + ' ± √{' + D + '}/' + 2 * a + '}', '長さは 2つの解の差 = {2√{' + D + '}/' + 2 * a + '}', '= ' + am(ans)],
      mistakes: U.mistakes([ans], [{ answers: [radFrac(1, D, 2 * a)], tag: 'chord-half', msg: '2つの解の 差は ±の部分の 2倍だよ' }, a === 1 ? m1(D, 'chord-root', '√ を つけ忘れていないかな') : null])
    };
  }
};
types['hx-line'] = {
  name: '発展: 放物線と直線の共有点', level: 5,
  gen: function (R) {
    const v = pickUntil(function () { return [R.int(-4, 4), R.int(-4, 4), R.int(-3, 3), R.int(-3, 3), R.int(-5, 5)]; }, function (v) { return v[0] < v[1] && v[0] !== -v[1]; }, [-1, 3, 1, 2, 1]);
    const r1 = v[0], r2 = v[1], b = v[2], m = v[3], n = v[4], c = n + r1 * r2, bb = m - (r1 + r2) + 0, B = b, Cc = c;
    const A1 = 1, B1 = m - (r1 + r2) === b ? b : m - (r1 + r2);
    const ans = [N(r1), N(r2)];
    return {
      text: '放物線 y = ' + poly(1, m - (r1 + r2), c) + ' と 直線 y = ' + (term(m, 'x', true) + term(n, '', m === 0)) .replace(/^$/, '0') + ' の 共有点の x座標を求めよ。', form: 'x = □, □', answers: ans, unordered: [[0, 1]],
      verify: function (w) { return w[0] !== w[1] && w.every(function (x) { return Math.abs(x * x + (m - (r1 + r2)) * x + c - (m * x + n)) < 1e-9; }); },
      hint: 'y を 消去して、x の 2次方程式を 解こう',
      explain: ['y を消去すると ' + poly(1, m - (r1 + r2), c) + ' = ' + (term(m, 'x', true) + term(n, '', m === 0) || '0'), '整理して ' + poly(1, -(r1 + r2), r1 * r2) + ' = 0', 'x = ' + r1 + ', ' + r2],
      mistakes: U.mistakes(ans, [{ answers: [N(-r2), N(-r1)], tag: 'factor-sign', msg: '因数分解の 符号に 注意' }], [[0, 1]])
    };
  }
};

/* ==================== 隠し②:変換の書庫(考査範囲外) ==================== */
const SHAPES6 = [['sym', '山が 1つで ほぼ 左右対称。平均値と 中央値は 近い'], ['right', '右に すそが長い。平均値は 中央値より 大きくなりやすい'], ['left', '左に すそが長い。平均値は 中央値より 小さくなりやすい'], ['bi', '山が 2つ ある。性質の ちがう 2つの集団が まざっている 可能性がある']];
types['hx-hist-shape'] = {
  name: '発展: ヒストグラムの形からの読み取り', level: 5,
  gen: function (R) {
    const t = R.int(0, 3), base = [[1, 4, 8, 8, 4, 1], [9, 7, 4, 2, 1, 1], [1, 1, 2, 4, 7, 9], [2, 7, 3, 3, 7, 2]][t], fr = base.map(function (x) { return x + R.int(0, 1); });
    return {
      text: 'つぎの ヒストグラムから 読み取れることとして、もっとも 適切なものを選べ。', fig: { type: 'hist', start: R.pick([0, 10, 40]), width: 10, freqs: fr, xl: '(点)', yl: '(人)' },
      choices: SHAPES6.map(function (s, i) { return { text: s[1], ok: i === t, tag: 'hist-shape', msg: '山の 数と、すその 長い側を 見よう' }; }),
      hint: '山が いくつあるか、すそが どちら側に 長いかを 見よう',
      explain: ['山の数と すその 長さ(かたより)を 見る', SHAPES6[t][1]]
    };
  }
};
types['hx-kari'] = {
  name: '発展: 仮平均', level: 5,
  gen: function (R) {
    const A = R.pick([160, 165, 170, 50, 60, 100]), dv = []; for (let i = 0; i < 5; i++) dv.push(R.int(-8, 8));
    const data = dv.map(function (x) { return A + x; }), ans = dec(A + sum(dv) / 5);
    return {
      text: 'つぎの 5個のデータの 平均値を、仮の平均 ' + A + ' を使って求めよ。', expr: data.join(', '), form: '□', answers: [ans], keys: ['.'], num: [sum(data) / 5],
      hint: '各データから ' + A + ' を 引いた値の 平均を 求めて、' + A + ' に 足す',
      explain: [A + ' を 引くと ' + dv.join(', '), 'その平均は ' + dec(sum(dv) / 5), '平均値 = ' + A + ' + ' + dec(sum(dv) / 5) + ' = ' + ans],
      mistakes: U.mistakes([ans], [m1(dec(sum(dv) / 5), 'kari-add', '仮の平均 ' + A + ' を 足し戻すのを 忘れていないかな'), m1(dec(A + sum(dv)), 'mean-div', '引いた値の合計を 個数で 割ろう')])
    };
  }
};
types['hx-unknown'] = {
  name: '発展: 条件から 未知数を求める(代表値・分散)', level: 5,
  gen: function (R) {
    const k = R.int(0, 2);
    if (k === 0) {
      const v = pickUntil(function () { const d = []; for (let i = 0; i < 4; i++) d.push(R.int(1, 15)); const Mn = R.int(5, 12); return [d, Mn]; }, function (v) { const x = 5 * v[1] - sum(v[0]); return x >= 0 && x <= 20; }, [[3, 7, 9, 11], 8]);
      const d = v[0], Mn = v[1], x = 5 * Mn - sum(d);
      return {
        text: '5個のデータ ' + d.join(', ') + ', x の 平均値が ' + Mn + ' のとき、x の値を求めよ。', form: 'x = □', answers: [N(x)], verify: function (w) { return Math.abs((sum(d) + w[0]) / 5 - Mn) < 1e-9; },
        hint: '(合計) = (平均値) × (個数)', explain: ['合計は ' + Mn + ' × 5 = ' + 5 * Mn, 'x = ' + 5 * Mn + ' - ' + sum(d) + ' = ' + x],
        mistakes: U.mistakes([N(x)], [m1(Mn, 'unk-mean', 'x が 平均値と 等しいとは かぎらないよ'), m1(4 * Mn - sum(d), 'unk-count', 'データは 5個(x を ふくむ)')])
      };
    }
    if (k === 1) {
      const a = R.int(1, 5), b = a + R.int(1, 4), c = b + R.int(4, 9), x = R.int(b, c), md = (b + x) / 2;
      return {
        text: '4個のデータ ' + a + ', ' + b + ', x, ' + c + '(' + b + ' ≦ x ≦ ' + c + ')の 中央値が ' + dec(md) + ' のとき、x の値を求めよ。', form: 'x = □', answers: [N(x)], keys: ['.'], verify: function (w) { return w[0] >= b && w[0] <= c && median([a, b, w[0], c]) === md; },
        hint: '4個のデータの 中央値は、中央の 2つ(' + b + ' と x)の 平均', explain: ['中央値 = (' + b + ' + x) ÷ 2 = ' + dec(md), 'x = ' + x],
        mistakes: U.mistakes([N(x)], [m1(dec(md), 'unk-median', 'x が 中央値と 等しいとは かぎらないよ。中央の 2つの 平均'), m1(dec(2 * md - a), 'unk-median', '中央の 2つは ' + b + ' と x')])
      };
    }
    const v = pickUntil(function () { return [R.int(1, 12), R.int(1, 12), R.int(3, 10)]; }, function (v) { const x = 3 * v[2] - v[0] - v[1]; return x >= 0 && x <= 20; }, [4, 8, 6]);
    const a = v[0], b = v[1], m = v[2], x = 3 * m - a - b, S2 = (a - m) * (a - m) + (b - m) * (b - m) + (x - m) * (x - m), ans = [N(x), F(S2, 3)];
    return {
      text: '3個のデータ ' + a + ', ' + b + ', x の 平均値が ' + m + ' のとき、x の値と 分散を求めよ。', form: 'x = □、分散 □', answers: ans, keys: ['分数'], num: [3 * m - a - b, varOf([a, b, x])],
      hint: 'まず 合計から x を 求め、偏差の2乗の 平均で 分散を 求めよう', explain: ['x = ' + 3 * m + ' - ' + a + ' - ' + b + ' = ' + x, '偏差は ' + (a - m) + ', ' + (b - m) + ', ' + (x - m), '分散 = ' + S2 + ' ÷ 3 = ' + am(ans[1])],
      mistakes: U.mistakes(ans, [{ answers: ['*', F(S2, 2)], tag: 'var-n1', msg: '分散は データの個数(3)で 割るよ' }, { answers: ['*', N(S2)], tag: 'var-div', msg: '偏差の2乗の和を 個数で 割ろう' }])
    };
  }
};
types['hx-qdev'] = {
  name: '発展: 四分位偏差', level: 5,
  gen: function (R) {
    const n = R.pick([8, 9, 10]), data = []; for (let i = 0; i < n; i++) data.push(R.int(1, 30));
    const f = five(data), ans = dec((f[3] - f[1]) / 2);
    return {
      text: 'つぎの データの 四分位偏差を求めよ。', expr: data.join(', '), form: '□', answers: [ans], keys: ['.'], num: [(f[3] - f[1]) / 2],
      hint: '四分位偏差 = (四分位範囲) ÷ 2', explain: ['Q_1 = ' + dec(f[1]) + '、Q_3 = ' + dec(f[3]), '四分位偏差 = (' + dec(f[3]) + ' - ' + dec(f[1]) + ') ÷ 2 = ' + ans],
      mistakes: U.mistakes([ans], [m1(dec(f[3] - f[1]), 'qdev-half', 'それは 四分位範囲。2 で 割ろう'), m1(dec((f[4] - f[0]) / 2), 'qdev-range', '範囲ではなく、Q_3 - Q_1 を 使おう')])
    };
  }
};
types['hx-merge'] = {
  name: '発展: 2つのグループを合わせた 平均値・分散', level: 5,
  gen: function (R) {
    if (R.chance(0.5)) {
      const v = pickUntil(function () { return [R.int(2, 30), R.int(2, 30), R.int(40, 80), R.int(40, 80)]; }, function (v) { const Mn = (v[0] * v[2] + v[1] * v[3]) / (v[0] + v[1]); return v[0] !== v[1] && v[2] !== v[3] && isTerm(Mn) && isTerm((v[2] + v[3]) / 2); }, [10, 30, 60, 70]);
      const n1 = v[0], n2 = v[1], m1v = v[2], m2v = v[3], ans = dec((n1 * m1v + n2 * m2v) / (n1 + n2));
      return {
        text: 'A組 ' + n1 + '人の 平均点は ' + m1v + '点、B組 ' + n2 + '人の 平均点は ' + m2v + '点である。2組を 合わせた ' + (n1 + n2) + '人の 平均点を求めよ。', form: '□ 点', answers: [ans], keys: ['.'],
        num: [(n1 * m1v + n2 * m2v) / (n1 + n2)], hint: 'それぞれの 合計点を 求めて 足し、全体の 人数で 割る',
        explain: ['合計点は ' + n1 + '×' + m1v + ' + ' + n2 + '×' + m2v + ' = ' + (n1 * m1v + n2 * m2v), '÷ ' + (n1 + n2) + ' = ' + ans],
        mistakes: U.mistakes([ans], [m1(dec((m1v + m2v) / 2), 'merge-simple', '人数が ちがうので、平均点どうしの 平均では ないよ')])
      };
    }
    const v = pickUntil(function () { return [R.int(2, 10), R.int(2, 10), R.int(3, 9), R.int(3, 9), R.int(1, 9), R.int(1, 9)]; }, function (v) {
      const Nn = v[0] + v[1], Mn = (v[0] * v[2] + v[1] * v[3]) / Nn, V = (v[0] * (v[4] + v[2] * v[2]) + v[1] * (v[5] + v[3] * v[3])) / Nn - Mn * Mn; return v[2] !== v[3] && Number.isInteger(Mn) && isTerm(V);
    }, [2, 2, 4, 6, 2, 4]);
    const n1 = v[0], n2 = v[1], a1 = v[2], a2 = v[3], s1 = v[4], s2 = v[5], Nn = n1 + n2, Mn = (n1 * a1 + n2 * a2) / Nn, V = (n1 * (s1 + a1 * a1) + n2 * (s2 + a2 * a2)) / Nn - Mn * Mn, ans = dec(V);
    return {
      text: 'A組 ' + n1 + '人の 平均値は ' + a1 + '、分散は ' + s1 + '、B組 ' + n2 + '人の 平均値は ' + a2 + '、分散は ' + s2 + ' である。2組を 合わせた 分散を求めよ。', form: '□', answers: [ans], keys: ['.'],
      num: [V], hint: '分散 = (x^2 の平均) - (平均)^2。それぞれの組の x^2 の合計 = 人数 × (分散 + 平均^2)',
      explain: ['全体の平均値は ' + Mn, 'x^2 の合計は ' + n1 + '(' + s1 + ' + ' + a1 * a1 + ') + ' + n2 + '(' + s2 + ' + ' + a2 * a2 + ') = ' + (n1 * (s1 + a1 * a1) + n2 * (s2 + a2 * a2)), '分散 = ' + (n1 * (s1 + a1 * a1) + n2 * (s2 + a2 * a2)) + ' ÷ ' + Nn + ' - ' + Mn + '^2 = ' + ans],
      mistakes: U.mistakes([ans], [m1(dec((s1 + s2) / 2), 'merge-simple', '分散どうしの 平均では ないよ'), isTerm((n1 * s1 + n2 * s2) / Nn) ? m1(dec((n1 * s1 + n2 * s2) / Nn), 'merge-meandiff', '2組の 平均値の ちがいも 散らばりに 加わるよ') : null])
    };
  }
};
types['hx-transform'] = {
  name: '発展: 変量の変換', level: 5,
  gen: function (R) {
    const a = R.pick([2, 3, 5, 10, -1, -2, -3]), b = pickUntil(function () { return R.int(-20, 20); }, function (x) { return x !== 0; }, 5), xm = R.int(2, 20), s = R.int(1, 6), V = s * s, k = R.int(0, 2);
    const yx = (a === 1 ? '' : a === -1 ? '-' : a) + 'x' + term(b, '', false), what = ['平均値', '分散', '標準偏差'][k], ans = N([a * xm + b, a * a * V, Math.abs(a) * s][k]);
    const mis = k === 0 ? [m1(a * xm, 'trans-b', '平均値には b = ' + b + ' も 足されるよ')] : k === 1 ? [m1(a * V, 'trans-var-a', '分散は a^2 倍になる(a 倍ではない)'), m1(a * a * V + b, 'trans-var-b', '定数を 足しても 散らばりは 変わらない')]
      : [m1(a * s, 'trans-sd-sign', '標準偏差は |a| 倍。負には ならないよ'), m1(Math.abs(a) * s + b, 'trans-sd-b', '定数を 足しても 散らばりは 変わらない')];
    return {
      text: '変量 x の 平均値が ' + xm + '、分散が ' + V + '、標準偏差が ' + s + ' である。y = ' + yx + ' で 定まる 変量 y の ' + what + 'を求めよ。', form: '□', answers: [ans],
      num: [[a * xm + b, varOf([xm - s, xm + s].map(function (x) { return a * x + b; })) * V / (s * s), Math.sqrt(varOf([xm - s, xm + s].map(function (x) { return a * x + b; })))][k]],
      hint: 'y = ax + b のとき、平均値は a×(平均) + b、分散は a^2 倍、標準偏差は |a| 倍',
      explain: ['y = ax + b(a = ' + a + ', b = ' + b + ')', ['平均値は ' + a + '×' + xm + ' + ' + b, '分散は a^2 倍 → ' + a * a + '×' + V, '標準偏差は |a| 倍 → ' + Math.abs(a) + '×' + s][k], what + 'は ' + ans],
      mistakes: U.mistakes([ans], mis)
    };
  }
};
types['hx-modify'] = {
  name: '発展: データの修正による 平均値・分散の変化', level: 5,
  gen: function (R) {
    const data = []; for (let i = 0; i < 5; i++) data.push(R.int(2, 10));
    const i = R.int(0, 4), nv = pickUntil(function () { return R.int(0, 12); }, function (x) { return x !== data[i]; }, data[i] + 1), d2 = data.slice(); d2[i] = nv;
    const sg = function (x) { return Math.abs(x) < 1e-9 ? 0 : x > 0 ? 1 : -1; }, W = ['小さくなる', '変わらない', '大きくなる'];
    const cm = sg(sum(d2) - sum(data)), cv = sg(varOf(d2) - varOf(data)), right = '平均値は ' + W[cm + 1] + '、分散は ' + W[cv + 1];
    const all = []; [-1, 0, 1].forEach(function (x) { [-1, 0, 1].forEach(function (y) { const t = '平均値は ' + W[x + 1] + '、分散は ' + W[y + 1]; if (t !== right) all.push(t); }); });
    return {
      text: '5個のデータ ' + data.join(', ') + ' のうち、' + (i + 1) + '番目の ' + data[i] + ' は 記録の まちがいで、正しくは ' + nv + ' だった。修正すると、平均値と 分散は どうなるか。',
      choices: [{ text: right, ok: true }].concat(R.shuffle(all).slice(0, 3).map(function (t) { return { text: t, tag: 'modify', msg: '修正前と 修正後の 平均値・分散を 実際に 計算して くらべよう' }; })),
      verify: function () { return (sum(d2) > sum(data)) === (cm > 0) && (varOf(d2) > varOf(data) + 1e-9) === (cv > 0); },
      hint: '修正前・修正後の 平均値と 分散を それぞれ 求めて くらべよう',
      explain: ['修正前: 平均値 ' + dec(sum(data) / 5) + '、分散 ' + dec(varOf(data)), '修正後: 平均値 ' + dec(sum(d2) / 5) + '、分散 ' + dec(varOf(d2)), right]
    };
  }
};
types['hx-sc-med'] = {
  name: '発展: 散布図から 中央値を読む', level: 5,
  gen: function (R) {
    const n = R.pick([5, 7]), pts = pickUntil(function () { const p = []; for (let i = 0; i < n; i++) p.push([R.int(0, 10), R.int(0, 10)]); return p; }, function (p) { return new Set(p.map(function (q) { return q.join(); })).size === n; }, null)
      || [[1, 2], [2, 5], [4, 4], [6, 8], [9, 7], [3, 1], [8, 9]].slice(0, n);
    const ax = R.int(0, 1), vals = pts.map(function (q) { return q[ax]; }), md = median(vals), nm = ax ? 'y' : 'x';
    return {
      text: n + '人の 2つのテストの得点 x、y の 散布図である。' + nm + ' の 中央値を求めよ。', fig: { type: 'scatter', pts: pts, xr: [0, 10, 2], yr: [0, 10, 2] }, form: '□', answers: [N(md)], keys: ['.'],
      verify: function (w) { return vals.filter(function (v) { return v < w[0]; }).length <= (n - 1) / 2 && vals.filter(function (v) { return v > w[0]; }).length <= (n - 1) / 2; },
      hint: nm + ' 座標を 小さい順に 並べて、まん中の値を 読もう',
      explain: [nm + ' の値を 小さい順に並べると ' + sorted(vals).join(', '), 'まん中(' + (n + 1) / 2 + '番目)の値は ' + md],
      mistakes: U.mistakes([N(md)], [isTerm(sum(vals) / n) ? m1(dec(sum(vals) / n), 'med-mean', 'それは 平均値。中央値は 小さい順に 並べた まん中の値') : null, m1(dec((Math.min.apply(null, vals) + Math.max.apply(null, vals)) / 2), 'med-range', '最小値と最大値の 平均では ないよ'),
        m1(dec(median(pts.map(function (q) { return q[1 - ax]; }))), 'med-axis', (ax ? 'y は たて軸' : 'x は 横軸') + 'の値だよ')])
    };
  }
};
types['hx-cross'] = {
  name: '発展: クロス集計表', level: 5,
  gen: function (R) {
    const a = R.int(3, 20), b = R.int(3, 20), c = R.int(3, 20), d = R.int(3, 20), bl = R.shuffle([0, 1, 2, 3]).slice(0, 2), cell = function (k, v) { return bl.indexOf(k) >= 0 ? { a: N(v) } : v; };
    const order = [0, 1, 2, 3].filter(function (k) { return bl.indexOf(k) >= 0; }), vals = [a, b, c, d], ans = order.map(function (k) { return N(vals[k]); });
    return {
      text: 'ある学年で、部活(運動部・文化部)と 朝食を 食べるかどうかを 調べた クロス集計表である。空欄を うめよ。',
      table: { head: ['', '食べる', '食べない', '計'], rows: [['運動部', cell(0, a), cell(1, b), a + b], ['文化部', cell(2, c), cell(3, d), c + d], ['計', a + c, b + d, a + b + c + d]] },
      verify: function (w) { const x = vals.slice(); order.forEach(function (k, i) { x[k] = w[i]; }); return x[0] + x[1] === a + b && x[2] + x[3] === c + d && x[0] + x[2] === a + c && x[1] + x[3] === b + d; },
      hint: '横の合計・たての合計から、ひき算で 求めよう',
      explain: ['行の 合計 - わかっている数 = 空欄', '運動部: ' + a + ' + ' + b + ' = ' + (a + b) + '、文化部: ' + c + ' + ' + d + ' = ' + (c + d)],
      mistakes: U.mistakes(ans, [{ answers: ans.slice().reverse(), tag: 'cross-swap', msg: 'どの 行・列の 空欄かを 確かめよう' }])
    };
  }
};
/* ==================== 敵の絵 ==================== */
const sprites = {
  mushi: { mirror: true, rows: ['...K....', '....K...', '.....KKK', '....KOOO', '...KOKOO', '...KOOOO', '..KKYYYY', '.K.KYOYY', '...KYYYY', '..KKOOOO', '.K.KOYOO', '...KOOOO', '..KKYYYY', '.K..KYYY', '.....KKK', '........'] },
  kame: { mirror: true, rows: ['........', '.....lll', '....lLLL', '..lllLdL', '.lLLLLLL', 'lLLdLLLd', 'lLLLLLLL', 'lLLLLdLL', 'lLdLLLLL', '.lLLLLLL', '..llLLdL', '.ll.llll', '.ll...LL', '......LK', '......LL', '........'] },
  usagi: { mirror: true, rows: ['........', '...WW...', '...WP...', '...WP...', '...WW...', '..WWWWWW', '.WWWWWWW', '.WWKWWWW', '.WWWWWWW', '.WWWWWWP', '..WWWWWW', '.WWWWWWW', '.WWWWWWW', '..WWWWWW', '..WW..WW', '........'] },
  nezumi: { mirror: true, rows: ['.gg.....', 'gPPg....', 'gPPg..gg', '.gggGGGG', '..gGGGGG', '..gGKGGG', '..gGGGGG', '..gGGGGP', '...gGGGG', '...gGGWW', '..gGGWWW', '..gGGWWW', '..gGGGWW', '...ggGGG', '..PP.ggg', '........'] },
  pen: { mirror: true, rows: ['........', '....KKKK', '...KKKKK', '..KKWKKK', '..KKKWWW', '..KKWWWW', '.KKKWWWO', '.KKKWWWW', 'KKKKWWWW', 'KKKWWWWW', 'KKKWWWWW', '.KKWWWWW', '.KKKWWWW', '..KKKWWW', '...OO...', '........'] },
  hato: { mirror: true, rows: ['........', '.....ggg', '....gGGG', '....gGKG', '....gGGO', '...gGGGG', 'g.gGGGGK', 'gggGGGKW', 'gGgGGGKW', '.ggGGGGK', '..gGGGGG', '...gGGGG', '....gggg', '.....O..', '....OO..', '........'] },
  bat: { mirror: true, rows: ['........', 'p....K..', 'pp...KK.', 'ppp..vvv', 'pvpp.vvv', 'pvvpvWKv', 'pvvvvvvv', 'pvpvvvvv', 'p.pvvvWv', '..p.vvvv', '....vvv.', '.....vv.', '........', '........', '........', '........'] },
  kumo: { mirror: true, rows: ['........', 'v......v', '.v....v.', '..v..vVV', '...vvVVV', 'vvvvVKVV', '....vVVV', '.vvvVVVW', 'v...vVVV', '..vvvVVV', '.v...vVV', 'v....vvv', '........', '........', '........', '........'] },
  kani: { rows: ['................', '..W.........WWW.', '.WWW............', '..W..........R..', '..R.........R...', '..R..W..W..R....', '...R.K..K.R.....', '...RRRRRRRR.....', '..RRRRRRRRRR....', '..RRKRRRRKRR....', '..RRRRRRRRRR....', '...RRRRRRRR.....', '..r.r.rr.r.r....', '.r..r....r..r...', '................', '................'] },
  gargoyle: { mirror: true, rows: ['........', 'g....g..', 'gg...gg.', 'ggg..gGG', 'gggggGKG', '.ggggGGG', '..gggGGR', '...ggGGG', '..gggGGG', '.gg.gGGG', '.g..gGGG', '....gG.G', '....gG.G', '...ggg.g', '........', '........'] },
  ghost: { mirror: true, rows: ['........', '....WWWW', '..WWWWWW', '.WWWWWWW', '.WWWKKWW', 'WWWWKKWW', 'WWWWWWWW', 'WWWWWWWC', 'WWWWWWCC', 'WWWWWWWW', 'WWWWWWWW', 'WWCWWWWW', 'WCCWWWCW', 'W.CW.WCC', '........', '........'] },
  miira: { mirror: true, rows: ['........', '....EEEE', '...EeEEE', '...EEEEe', '...EKEEE', '...EEEEE', '....eEEE', '..EEEEEE', '.EEeEEEe', '.EE.EEEE', '.Ee.EeEE', '....EEEe', '....EE.E', '....Ee.E', '...EEE.E', '........'] },
  kinoko: { mirror: true, rows: ['........', '....RRRR', '..RRRWWR', '.RRWRRRR', '.RRRRRWW', 'RRWRRRRR', 'RRRRRRRR', '.rrrrrrr', '...EEEEE', '...EKEEE', '...EEEEE', '...EEERR', '....EEEE', '....EEEE', '...nnnnn', '........'] },
  ki: { mirror: true, rows: ['....dddd', '..ddllll', '.dllLlll', 'dllLllll', 'dlllllll', '.dllllll', '..ddlnnn', '....nNNN', '....nKNN', '....nNNN', '....nNKK', '....nNNN', '...nnNNN', '..nn.nNN', '.nn..nnN', '........'] },
  heishi: { mirror: true, rows: ['.....nnn', '....nNNN', '....nNyN', '....nNNN', '....SSSS', '....SKSS', '....SSSS', '..nnNNNN', '.nNNNNyN', '.nN.NNNN', '.SS.NNyN', '....NNNN', '....nn.n', '....nn.n', '...KKK..', '........'] },
  koro: { mirror: true, rows: ['........', '........', '....CCCC', '..CCCCCC', '.CCCWWCC', '.CCCWKCC', 'CCCCCCCC', 'CCCCCCCB', 'CCCCCCBB', 'CCCCCCCC', '.CCCCCCC', '.CCBCCCC', '..CCCCCC', '....CCCC', '........', '........'] },
  rei: { mirror: true, rows: ['........', '....pppp', '..pppppp', '.ppppppp', '.pppWKpp', '.ppppppp', 'pppppppp', 'ppppppKK', 'pppppppp', 'pppppppp', '.ppppppp', '.pp.pppp', '..p..pp.', '........', '........', '........'] },
  hebi: { mirror: true, rows: ['..ll....', '.lLLl...', '.lKLl...', '.lLLl...', '.lLLl...', '..lLl...', '..lLLl..', '...lLLll', '...lLLLL', '....lLLL', '..llllLL', '.lLLLLLL', '.lLLLLLL', '..llllll', '........', '........'] },
  inu: { mirror: true, rows: ['........', '..N.....', '.NN.....', '.NNNNNNN', '.NNNNNNN', '.NNKNNNN', '.NNNNNNN', '..NNNNNK', '...NNNNN', '..NNNNNN', '.NNNNNNN', '.NNNNNNN', '.NNnNNNN', '.NN.NN..', '.nn.nn..', '........'] },
  b_dragon: { mirror: true, rows: ['............', '...Y........', '...YY.......', '....YY..KKKK', '....KYKKRRRR', '.....KRRRRRR', '....KRRWWRRR', '....KRRWKRRR', '....KRRRRRRR', '.KK.KRRRRRKK', 'KrrKKRRRRRRR', 'KrrrKKRRWRWR',
    'KrrrrKKRRRRR', 'KrrrrrKKKKKK', 'KrrKrrKOOOOO', 'KrK.KrKOOOOO', 'KK...KROOOOO', '....KRROOOOO', '....KRRROOOO', '...KRRRRRRRR', '...KRRRKKRRR', '..KRRRK..KRR', '..KYYYK..KYY', '..KKKKK..KKK'] },
  b_mage: { mirror: true, rows: ['...........b', '..........bb', '.........bBB', '........bBBB', '.......bBBYB', '......bBBBBB', '.....bBBBBBB', '..bbbbbbbbbb', '.bBBBBBBBBBB', '..bbbbbbbbbb', '....KSSSSSSS', '....KSTKSSSS',
    '....KSSSSSSS', '....KWWWWSSS', '...KKWWWWWWW', '..KbbKWWWWWW', '.KbBBbKWWWWK', 'KbBBBBbKKKKb', 'KbBBYBBBBBBB', 'KbBBBBBBBYBB', 'SKbBBBYBBBBB', '.KbBBBBBBBBB', '.KbBBBBBYBBB', '.KKKKKKKKKKK'] },
  b_forest: { mirror: true, rows: ['K...........', 'KK..K.......', '.KK.KK......', '..KKKK...K..', '...KNK..KK..', '...KNNKKNK..', '....KNNNNK..', '.....KNNK...', '....dddKdddd', '..ddlllldlll', '.dlllLllllll', 'dllLLlllllll',
    'dlllllWWllll', 'dlllllWKllll', 'dllLllllllll', '.dlllllllRRR', '.dlllLlllllR', '..ddllllllll', '....ddnnnnnn', '.....nNNNNNN', '.....nNNnNNN', '....nnNNnNNN', '...nnNNnnNNN', '..nnnnn.nnnn'] },
  b_king: { mirror: true, rows: ['............', '..Y...Y....Y', '..YY.YYY..YY', '..YYYYYYYYYY', '..YRYYYBYYYR', '..YYYYYYYYYY', '...KSSSSSSSS', '...KSSWWKSSS', '...KSSWWKSSS', '...KSSSSSSSS', '...KWWSSSSKK', '...KWWWWWWWW',
    '..KKKWWWWWWW', '.KVVVKWWWWWW', 'KVVVVVKWWWWK', 'KVVCVVVKKKKV', 'KVCVCVVVVCVV', 'KVVVVCVVCVCV', 'KVVVVVCCVVVC', 'SKVVVVVVVVVV', '.KVVVVVVVVVV', '.KVVYYYYYYYY', '.KVVVVVVVVVV', '.KKKKKKKKKKK'] },
  b_maou: { mirror: true, rows: ['.K..........', '.KK.........', '.KvK....KKKK', '..KvK..KvvvV', '..KvvKKvvVVV', '...KvvvvVVVV', '....KvVRRVVV', '....KvVRYVVV', '....KvVVVVVV', '....KvVVKVKV', '.....KvVVVVV', '..KKKKKvvvvv',
    '.KggggKKvvvG', 'KgGGGGgKKKGG', 'KgGGGGGgGGGY', 'KgGgGGGGGGGY', '.KgKgGGGYYYY', '.KvKKgGGGGGY', '.KvK.KgGGGGY', '.KRK.KgGGGGG', '.....KvvVVVV', '....KvvVKKVV', '...KvvVK..KV', '...KKKKK..KK'] },
  b_ryu: { mirror: true, rows: ['............', '..Y.........', '..YY........', '...YY...llll', '...lYlllLLLL', '....lLLLLLLL', '...lLLWWLLLL', '...lLLWKLLLL', '...lLLLLLLLL', '.ll.lLLLLLKK', 'lddllLLLLLLL', 'ldddllLLWLWL',
    'lddddllLLLLL', 'ldddddllllll', 'lddlddlEEEEE', 'ldl.ldlEEEEE', 'll...lLEEEEE', '....lLLEEEEE', '....lLLLEEEE', '...lLLLLLLLL', '...lLLLllLLL', '..lLLLl..lLL', '..lYYYl..lYY', '..lllll..lll'] },
  b_abyss: { mirror: true, rows: ['............', '............', '.......KKKKK', '.....KKpppWW', '....KppppWWW', '...KppKKppWW', '..KppKWWKppp', '..KppKWKKppp', '..KpppKKpppp', '...KppppppRR', '....KKpppppp', '..KKKKKKpppK',
    '.KVVVVVVKKKV', 'KVVKKKVVVVVV', 'KVK...KVVVVK', 'KVK...KVVVK.', 'KVVKKKVVVVVK', '.KVVVVVVKKVV', '..KKKKKK..KV', '...........K', '....T......T', '...T.T....T.', '....T......T', '............'] }
};

/* ==================== 敵 ==================== */
const Z = { level: 1, hp: 0.5, atk: 0.6 };
function zako(name, sprite, typesList, o) { return Object.assign({ name: name, sprite: sprite, types: typesList }, Z, o || {}); }
const enemies = {
  // 東の草原(2次)
  bunkai: zako('いんすうブンカイ虫', 'mushi', ['eq-factor', 'ineq-fact']),
  jukai: zako('じゅうかいガメ', 'kame', ['disc', 'ineq-sq']),
  usagi: zako('パラボラうさぎ', 'usagi', ['axis-pts', 'ineq-fact']),
  // 西の草原(データ)
  dosu: zako('どすうネズミ', 'nezumi', ['freq-basic', 'r-range']),
  heikin: zako('へいきんペンギン', 'pen', ['rep-val', 'deviation']),
  suzume: zako('ちゅうおうちスズメ', 'hato', ['rep-val', 'range-iqr'], { swap: { G: 'N', g: 'n', W: 'E' } }),
  // 解の公式の洞窟
  rootbat: zako('ルートコウモリ', 'bat', ['eq-tasuki', 'eq-formula', 'cnt-cross'], { level: 3, hp: 1, atk: 1 }),
  tasuki: zako('たすきがけグモ', 'kumo', ['eq-even', 'm-range', 'm-double'], { level: 4, hp: 1.2, atk: 1 }),
  sasori: zako('はんべつサソリ', 'kani', ['m-real', 'm-cross', 'cnt-vertex'], { level: 5, hp: 1.3, atk: 1, swap: { R: 'O', r: 'N' } }),
  formula: { name: '解の公式竜フォーミュラ', sprite: 'b_dragon', boss: true, level: 6, hp: 6, atk: 1.2, line: 'われは 解の公式竜フォーミュラ。± の 両方を 見落とすな!', swap: { R: 'B', r: 'b', O: 'C' },
    types: ['eq-tasuki', 'eq-formula', 'eq-even', 'm-range', 'm-double', 'm-real', 'cnt-cross', 'm-cross', 'cnt-vertex'] },
  // 度数の森
  kaikyu: zako('かいきゅうキノコ', 'kinoko', ['tbl-freq', 'two-class'], { level: 5, hp: 1, atk: 1 }),
  ruiseki: zako('るいせきツリー', 'ki', ['draw-hist', 'mean20', 'mode-table'], { level: 6, hp: 1.2, atk: 1 }),
  karasu: zako('さいひんカラス', 'hato', ['median-why', 'mean-table', 'mode-table'], { level: 7, hp: 1.3, atk: 1, swap: { G: 'K', g: 'v', W: 'g' } }),
  hist: { name: '森の主ヒストガイア', sprite: 'b_forest', boss: true, level: 8, hp: 6, atk: 1.2, line: '森の主ヒストガイアが 問う。その柱、正しく 数えたか?',
    types: ['tbl-freq', 'draw-hist', 'two-class', 'mean20', 'mode-table', 'median-why', 'mean-table'] },
  // 不等式の塔
  futogo: zako('ふとうごうガーゴイル', 'gargoyle', ['ineq-int', 'ineq-root', 'ineq-neg'], { level: 8, hp: 1, atk: 1 }),
  jissu: zako('じっすうゴースト', 'ghost', ['ineq-letter', 'ineq-tasuki', 'ineq-sqcomp'], { level: 9, hp: 1.2, atk: 1 }),
  miira: zako('かいなしミイラ', 'miira', ['ineq-complete', 'ineq-dneg', 'ineq-letter2', 'ineq-vertex'], { level: 10, hp: 1.3, atk: 1 }),
  boda: { name: '境界の魔導師ボーダリオ', sprite: 'b_mage', boss: true, level: 11, hp: 6, atk: 1.2, line: '境界の魔導師ボーダリオ……等号 ひとつで 運命が 変わるのだ。',
    types: ['ineq-int', 'ineq-root', 'ineq-neg', 'ineq-letter', 'ineq-tasuki', 'ineq-sqcomp', 'ineq-complete', 'ineq-dneg', 'ineq-letter2', 'ineq-vertex'] },
  // 散らばりの迷宮
  dwarf: zako('はこひげドワーフ', 'heishi', ['quartile', 'draw-box', 'q-position', 'box-read', 'outlier-bound'], { level: 10, hp: 1, atk: 1 }),
  blob: zako('ぶんさんブロブ', 'koro', ['var-sd', 'var-method', 'sd-compare', 'outlier-box', 'hist-box'], { level: 11, hp: 1.2, atk: 1, swap: { C: 'L', B: 'l' } }),
  soukan: zako('そうかんゴースト', 'rei', ['draw-scatter', 'corr-choose', 'corr-calc', 'corr-cause', 'r-pick'], { level: 12, hp: 1.3, atk: 1 }),
  sigma: { name: '偏差の番人シグマ', sprite: 'b_king', boss: true, level: 14, hp: 7, atk: 1.2, line: 'われは 偏差の番人シグマ。散らばりを 見誤る者は 通さぬ。', swap: { V: 'T', C: 'W' },
    types: ['quartile', 'draw-box', 'outlier-box', 'box-read', 'hist-box', 'var-sd', 'var-method', 'corr-calc', 'r-pick'] },
  // 魔王の城(各エリアの上位種)
  g_bat: zako('城の衛兵・ルートコウモリ改', 'bat', ['eq-formula', 'm-range', 'cnt-vertex', 'm-cross'], { level: 20, hp: 1.2, atk: 1, swap: { p: 'r', v: 'R' } }),
  g_garg: zako('城の衛兵・ふとうごうガーゴイル改', 'gargoyle', ['ineq-root', 'ineq-tasuki', 'ineq-dneg', 'ineq-letter'], { level: 20, hp: 1.3, atk: 1, swap: { G: 'R', g: 'r', R: 'Y' } }),
  g_kinoko: zako('城の衛兵・かいきゅうキノコ改', 'kinoko', ['mean-table', 'two-class', 'median-why', 'draw-hist'], { level: 21, hp: 1.3, atk: 1, swap: { R: 'V', r: 'v' } }),
  g_ghost: zako('城の衛兵・そうかんゴースト改', 'ghost', ['var-sd', 'corr-calc', 'outlier-box', 'hist-box', 'quartile'], { level: 21, hp: 1.4, atk: 1, swap: { W: 'p', C: 'V' } }),
  maou: { name: '関数統計魔王クアドラ', sprite: 'b_maou', boss: true, level: 23, hp: 8, atk: 1.2, line: 'われこそは 関数統計魔王クアドラ。放物線も データも、すべて わが手の中!',
    types: ['eq-formula', 'm-range', 'ineq-root', 'ineq-neg', 'mean-table', 'quartile', 'var-sd', 'corr-calc'],
    phase2: { name: '真・関数統計魔王クアドラ', line: 'クアドラの 真のすがた……ここからが 本当の 考査だ!', swap: { v: 'r', V: 'R', G: 'g', g: 'K', R: 'Y' },
      types: ['eq-even', 'm-real', 'cnt-vertex', 'ineq-tasuki', 'ineq-dneg', 'ineq-letter2', 'draw-box', 'outlier-box', 'hist-box', 'var-method', 'r-pick'] } },
  // 隠し①:解の配置の深淵
  houbutsu: zako('深淵の放物霊', 'rei', ['hx-coef', 'hx-kcount', 'hx-coef-sol', 'hx-chord'], { level: 25, hp: 1.2, atk: 1, swap: { p: 't', W: 'Y' } }),
  haichi: zako('深淵のかいはいちヘビ', 'hebi', ['hx-allreal', 'hx-separate', 'hx-placement', 'hx-system', 'hx-line'], { level: 26, hp: 1.3, atk: 1, swap: { l: 'v', L: 'p' } }),
  shinryu: { name: '深淵の放物竜', sprite: 'b_ryu', boss: true, level: 28, hp: 7, atk: 1.2, line: '深淵の放物竜……解の 行方は、深淵の 底に ある。', swap: { l: 'v', L: 'p', d: 'K', E: 'V' },
    types: ['hx-coef', 'hx-kcount', 'hx-coef-sol', 'hx-allreal', 'hx-separate', 'hx-placement', 'hx-system', 'hx-chord', 'hx-line'] },
  // 隠し②:変換の書庫
  banken: zako('書庫の番犬', 'inu', ['hx-hist-shape', 'hx-kari', 'hx-unknown', 'hx-qdev'], { level: 25, hp: 1.2, atk: 1 }),
  shiori: zako('書庫のしおりコウモリ', 'bat', ['hx-merge', 'hx-transform', 'hx-modify', 'hx-sc-med', 'hx-cross'], { level: 26, hp: 1.3, atk: 1, swap: { p: 'N', v: 'n' } }),
  trans: { name: '変換の賢者トランスフォルム', sprite: 'b_abyss', boss: true, level: 28, hp: 7, atk: 1.2, line: '変換の賢者トランスフォルム。データを 変えても、本質は 見抜けるか?',
    types: ['hx-hist-shape', 'hx-kari', 'hx-unknown', 'hx-qdev', 'hx-merge', 'hx-transform', 'hx-modify', 'hx-sc-med', 'hx-cross'] }
};

/* ==================== マップ ==================== */
const maps = {
  town: { bgm: 'town',
    rows: ['TTTTTTTTTTTTTTT', 'T,hhh.,.hhh.,.T', 'T.hih...hch...T', 'T..=.....=....T', 'T..=======....T', 'T.,....=...hhhT', 'T......=...hphT', 'T.k....=....=.T', 'T......======.T', 'T..v...=...,..T', 'T.,....=......T', 'TTTTTTTxTTTTTTT', 'TTTTTTTTTTTTTTT'],
    legend: {
      i: { tile: 'wood', solid: true, npc: { pal: { 1: 'R', 2: 'N', h: 'y' } }, event: { type: 'inn' } },
      c: { tile: 'wood', solid: true, npc: { pal: { 1: 'W', 2: 'W', h: 'g' } }, event: { type: 'church' } },
      p: { tile: 'wood', solid: true, npc: { pal: { 1: 'l', 2: 'N', h: 'K' } }, event: { type: 'shop' } },
      k: { tile: 'grass', solid: true, npc: { pal: { 1: 'Y', 2: 'B', h: 'N' } }, event: { type: 'talk', lines: ['こども「東の草原は 2次方程式・2次不等式、西の草原は データの分析の モンスターが 出るよ!」', 'こども「図をかく問題が 指で かきにくいときは、メニューの「図の問題」を「えらぶ」に すると いいよ」'] } },
      v: { tile: 'grass', solid: true, npc: { pal: { 1: 'p', 2: 'g', h: 'W' } }, event: { type: 'talk', lines: ['長老「不等式は、グラフを かいて 確かめるのが いちばんじゃ」', '長老「ボスは 目安レベルに 届かぬうちは まず 勝てん。草原で きたえるのじゃ」', '長老「4つの ダンジョンの 主を たおせば、北の 魔王の城の 封印が 解けるという……」'] } },
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
      F: { tile: 'i_forest', event: { type: 'dungeon', id: 'forest' } }, L: { tile: 'i_cave', event: { type: 'dungeon', id: 'chirabari' } },
      M: { tile: 'i_castle', event: { type: 'dungeon', id: 'castle' } },
      s: { tile: 'sign', solid: true, event: { type: 'sign', text: '【道しるべ】\n北:魔王の城 / 東:2次の草原(解の公式の洞窟・不等式の塔)\n西:データの草原(度数の森・散らばりの迷宮)' } } } }
};
const SEAL4 = ['boss:formula', 'boss:hist', 'boss:boda', 'boss:sigma'];
const dungeons = {
  cave: { name: '解の公式の洞窟', unit: '2次方程式・判別式・グラフと x軸の共有点', level: 3, theme: 'cave', boss: 'formula',
    floors: [{ enemies: ['rootbat', 'tasuki'] }, { enemies: ['tasuki', 'sasori'] }],
    hidden: { need: ['boss:maou'], to: 'shinen', openText: '解の公式の洞窟の 奥で、深淵へ つづく 扉が ひらいた……。' } },
  forest: { name: '度数の森', unit: '度数分布表・ヒストグラム・代表値', level: 5, theme: 'forest', boss: 'hist', floors: [{ enemies: ['kaikyu', 'ruiseki'] }, { enemies: ['ruiseki', 'karasu'] }] },
  tower: { name: '不等式の塔', unit: '2次不等式', level: 8, theme: 'tower', boss: 'boda', floors: [{ enemies: ['futogo'] }, { enemies: ['futogo', 'jissu'] }, { enemies: ['jissu', 'miira'] }] },
  chirabari: { name: '散らばりの迷宮', unit: '四分位数・箱ひげ図・分散・相関', level: 10, theme: 'meikyu', boss: 'sigma', floors: [{ enemies: ['dwarf'] }, { enemies: ['dwarf', 'blob'] }, { enemies: ['blob', 'soukan'] }],
    hidden: { need: ['boss:maou'], to: 'shoko', openText: '散らばりの迷宮の 奥で、古い書庫の 扉が ひらいた……。' } },
  castle: { name: '魔王の城', unit: '全範囲の総合(考査本番レベル)', level: 20, theme: 'castle', boss: 'maou', need: SEAL4,
    needText: '城門は 4つの封印で とざされている。\n4つの ダンジョンの ボスを すべて たおすと ひらくようだ。', openText: '4つの封印が 解けた! 北の 魔王の城の 門が ひらいた!',
    floors: [{ enemies: ['g_bat', 'g_kinoko'] }, { enemies: ['g_garg', 'g_ghost'] }, { enemies: ['g_bat', 'g_garg', 'g_kinoko', 'g_ghost'] }] },
  shinen: { name: '解の配置の深淵', unit: '教科書の先の 2次関数(解の配置・定数の分離 など)', level: 25, theme: 'abyss', boss: 'shinryu', extra: true, floors: [{ enemies: ['houbutsu', 'haichi'] }] },
  shoko: { name: '変換の書庫', unit: '教科書の先の データの分析(仮平均・変量の変換 など)', level: 25, theme: 'shoko', boss: 'trans', extra: true, floors: [{ enemies: ['banken', 'shiori'] }] }
};

M.registerCourse({
  id: 'suu1-2gakki-kimatsu',
  title: '数学I 2学期期末クエスト',
  subtitle: '2次方程式・2次不等式・データの分析',
  start: { map: 'town', x: 7, y: 9 },
  intro: ['ここは はじまりの町。', '{n}は 期末考査という 大いなる試練に そなえ、旅に 出ることに した。',
    '町の南から 外に出よう。東の草原は 2次方程式・2次不等式、西の草原は データの分析の 修行場だ。\n(歩く:行きたい場所を タップ / 図は タップで 大きくなる / 右上の「メニュー」で 十字キーも出せる)'],
  levelCap: { base: 30, extended: 40, extendFlag: 'boss:maou' },
  themes: { shoko: { id: 'shoko', floor: 'wood', wall: 'wall_tower', swap: { G: 'N', g: 'n' }, bg: ['#2a1a08', '#503000', '#a85c10'] } },
  zones: { east: { enemies: ['bunkai', 'jukai', 'usagi'] }, west: { enemies: ['dosu', 'heikin', 'suzume'] } },
  maps: maps, dungeons: dungeons, enemies: enemies, sprites: sprites, types: types,
  /* 称号。name は いつでも変えられる(id と 並び順は 公開後に 変えない) */
  titles: {
    level: [{ lv: 1, name: '見習い測量士' }, { lv: 5, name: '放物線の旅人' }, { lv: 10, name: '解の公式の使い手' }, { lv: 15, name: '不等式の職人' }, { lv: 20, name: 'データの探究者' },
      { lv: 25, name: '統計の賢者' }, { lv: 30, name: '数学Iの勇者' }, { lv: 35, name: '関数と統計を統べる者' }, { lv: 40, name: '伝説の一級測量技士' }],
    special: [
      { id: 'cave', name: 'フォーミュラを解き明かせし者', cond: { boss: 'formula' } }, { id: 'forest', name: 'ヒストガイアに認められし者', cond: { boss: 'hist' } },
      { id: 'tower', name: 'ボーダリオの境界を越えし者', cond: { boss: 'boda' } }, { id: 'chirabari', name: 'シグマを見切りし者', cond: { boss: 'sigma' } },
      { id: 'maou', name: '魔王クアドラを破りし覇者', cond: { boss: 'maou' } }, { id: 'shinen', name: '深淵の放物竜を鎮めし者', cond: { boss: 'shinryu' } },
      { id: 'shoko', name: 'トランスフォルムの叡智を継ぐ者', cond: { boss: 'trans' } }, { id: 'combo10', name: '十連撃の達人', cond: { combo: 10 } },
      { id: 'streak7', name: '毎日の求道者', cond: { streak: 7 } }]
  }
});
})();

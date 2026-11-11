/* ============================================================
 * コース: 数学II 2学期期末(加法定理 〜 指数関数・対数関数)
 * 書き方の説明は docs/course-format.md を参照。
 * ============================================================ */
(function () {
'use strict';
const M = (typeof MathRPG !== 'undefined') ? MathRPG : require('../engine.js');
const U = M.util, am = U.am, F = U.fracStr;
const RAD = Math.PI / 180;

/* ---------- 小さな道具 ---------- */
function neg(s) { return s === '0' ? '0' : (s[0] === '-' ? s.slice(1) : '-' + s); }
function flip(s) { return s === '+' ? '-' : s === '-' ? '+' : s === '<' ? '>' : '<'; }
function pw(a, n) { return Math.pow(a, n); }
/* 多項式の項: term(-6,'2^x') → ' - 6·2^x' */
function term(c, body, first, sep) {
  if (c === 0) return '';
  const a = Math.abs(c), s = body ? (a === 1 ? body : a + (sep === undefined ? '·' : sep) + body) : String(a);
  return first ? (c < 0 ? '-' : '') + s : (c < 0 ? ' - ' : ' + ') + s;
}
/* 係数つきの sin・cos の項: coefTerm('-√3','sin θ') → ' - √3 sin θ' */
function coefTerm(str, fn, first) {
  const n = str[0] === '-', abs = n ? str.slice(1) : str, s = abs === '1' ? fn : abs + ' ' + fn;
  return first ? (n ? '-' : '') + s : (n ? ' - ' : ' + ') + s;
}
function scale(k, s) {
  const n = s[0] === '-', body = n ? s.slice(1) : s;
  return (n ? '-' : '') + (/^\d+$/.test(body) ? String(k * parseInt(body, 10)) : (k === 1 ? '' : k) + body);
}
function p12(u) { return U.piStr(u, 12); }                         // π/12 を単位にした角
function thetaPlus(a12) { return a12 >= 0 ? 'θ + ' + am(p12(a12)) : 'θ - ' + am(p12(-a12)); }
function par(n, d) { const s = F(n, d); return s[0] === '-' ? '(' + am(s) + ')' : am(s); }
function close(a, b) { return Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(a), Math.abs(b)); }

/* 有名角の表 [sin, cos, tan] */
const TRIG = {
  0: ['0', '1', '0'], 30: ['1/2', '√3/2', '√3/3'], 45: ['√2/2', '√2/2', '1'], 60: ['√3/2', '1/2', '√3'], 90: ['1', '0', null],
  120: ['√3/2', '-1/2', '-√3'], 135: ['√2/2', '-√2/2', '-1'], 150: ['1/2', '-√3/2', '-√3/3'], 180: ['0', '-1', '0'],
  210: ['-1/2', '-√3/2', '√3/3'], 225: ['-√2/2', '-√2/2', '1'], 240: ['-√3/2', '-1/2', '√3'], 270: ['-1', '0', null],
  300: ['-√3/2', '1/2', '-√3'], 315: ['-√2/2', '√2/2', '-1'], 330: ['-1/2', '√3/2', '-√3/3'], 360: ['0', '1', '0']
};
const DEGS = Object.keys(TRIG).map(Number);
/* 合成の基本パターン [sin の係数, cos の係数, r, α(π/12 単位)] */
const GS = [
  ['1', '1', '√2', 3], ['1', '-1', '√2', -3], ['-1', '1', '√2', 9], ['-1', '-1', '√2', -9],
  ['√3', '1', '2', 2], ['√3', '-1', '2', -2], ['-√3', '1', '2', 10], ['-√3', '-1', '2', -10],
  ['1', '√3', '2', 4], ['1', '-√3', '2', -4], ['-1', '√3', '2', 8], ['-1', '-√3', '2', -8]
];
const GS2 = GS.filter(function (g) { return g[2] === '2'; });
function gsExpr(g, k) { return coefTerm(scale(k, g[0]), 'sin θ', true) + coefTerm(scale(k, g[1]), 'cos θ', false); }
function gsNum(g, k) { return [U.parseValue(g[0]).num * k, U.parseValue(g[1]).num * k]; }
function alphaAns(u) { return [u >= 0 ? '+' : '-', p12(Math.abs(u))]; }
const TRI = [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17]];   // [sin, cos, 斜辺]

const types = {};

/* ==================== 東の草原:三角関数の超基本 ==================== */
types['trig-value'] = {
  name: '有名角の sin・cos・tan', level: 0,
  gen: function (R, opt) {
    let deg = R.pick(DEGS), f = opt.f ? ['sin', 'cos', 'tan'].indexOf(opt.f) : R.int(0, 2);
    while (TRIG[deg][f] === null) deg = R.pick(DEGS);
    const name = ['sin', 'cos', 'tan'][f], ans = TRIG[deg][f], mis = [];
    if (f < 2) mis.push({ answers: [TRIG[deg][1 - f]], tag: 'sincos-swap', msg: 'sin は y 座標、cos は x 座標。逆になっていないかな?' });
    else {
      const rc = { '√3': '√3/3', '√3/3': '√3', '-√3': '-√3/3', '-√3/3': '-√3' }[ans];
      if (rc) mis.push({ answers: [rc], tag: 'tan-recip', msg: 'tan θ = sin θ ÷ cos θ(y ÷ x)。逆に割っていないかな?' });
    }
    mis.push({ answers: [neg(ans)], tag: 'quadrant-sign', msg: '符号に注意。' + deg + '° が第何象限か、単位円で確かめよう' });
    const axis = deg % 90 === 0, q = Math.floor(deg / 90) + 1, ref = [deg, 180 - deg, deg - 180, 360 - deg][q - 1];
    const sign = ans[0] === '-' ? '負' : '正';
    return {
      text: 'つぎの値を求めよ。', expr: name + ' ' + deg + '°', form: '□', answers: [ans], keys: ['√', '分数'],
      num: [[Math.sin, Math.cos, Math.tan][f](deg * RAD)],
      hint: axis ? '単位円上の点の座標 (x, y) = (cos θ, sin θ) を考えよう' : '単位円で考えよう。' + deg + '° は第' + q + '象限、基準の角は ' + ref + '°',
      explain: axis
        ? ['単位円で ' + deg + '° の点は (' + am(TRIG[deg][1]) + ', ' + am(TRIG[deg][0]) + ')', 'x 座標が cos、y 座標が sin(tan は y ÷ x)', name + ' ' + deg + '° = ' + am(ans)]
        : [deg + '° は第' + q + '象限。基準の角は ' + ref + '°', name + ' ' + ref + '° = ' + am(TRIG[ref][f]) + '、第' + q + '象限で ' + name + ' は' + sign, name + ' ' + deg + '° = ' + am(ans)],
      mistakes: U.mistakes([ans], mis)
    };
  }
};
types['deg-rad'] = {
  name: '度と弧度法の変換', level: 0,
  gen: function (R) {
    const deg = R.pick(DEGS.filter(function (d) { return d > 0; })), rad = U.piStr(deg, 180);
    if (R.chance(0.5)) {
      return {
        text: 'つぎの角を 弧度法で表せ。', expr: deg + '°', form: '□', answers: [rad], keys: ['π', '分数'], num: [deg * RAD],
        hint: '180° = π だから、1° = {π/180}',
        explain: ['180° = π より 1° = {π/180}', deg + ' × {π/180} = ' + am(rad)],
        mistakes: U.mistakes([rad], [
          { answers: [U.piStr(deg, 360)], tag: 'rad-360', msg: '180° = π だよ(360° は 2π)' },
          { answers: [F(deg, 180)], tag: 'rad-nopi', msg: 'π を つけ忘れていないかな?' }])
      };
    }
    return {
      text: 'つぎの角を 度数法で表せ。', expr: am(rad), form: '□°', answers: [String(deg)], num: [deg],
      hint: 'π = 180° を 代入しよう',
      explain: ['π = 180° を代入する', am(rad).replace('π', ' × 180°').replace(/^ × /, '') + ' = ' + deg + '°'],
      mistakes: U.mistakes([String(deg)], [{ answers: [String(deg * 2)], tag: 'rad-360', msg: 'π = 180° だよ(360° ではない)' }])
    };
  }
};

/* ==================== 西の草原:指数・対数の超基本 ==================== */
types['pow-basic'] = {
  name: '累乗の計算', level: 0,
  gen: function (R, opt) {
    const a = R.pick([2, 3, 4, 5, 10]);
    let n = opt.zero ? R.int(0, 1) : R.int(0, 6);
    while (pw(a, n) > 256 && a !== 10 || pw(a, n) > 1000) n--;
    const ans = String(pw(a, n));
    const ex = n === 0 ? ['0 でない数の 0 乗は 1 と決める', a + '^0 = 1']
      : n === 1 ? ['1 乗は その数自身', a + '^1 = ' + a]
        : [a + '^' + n + ' は ' + a + ' を ' + n + ' 回かけた数', new Array(n).fill(a).join('×') + ' = ' + ans];
    return {
      text: 'つぎの値を求めよ。', expr: a + '^' + n, form: '□', answers: [ans], num: [Math.exp(n * Math.log(a))],
      hint: n === 0 ? 'a^0 = 1(0 乗は 1)' : a + ' を ' + n + ' 回 かけよう',
      explain: ex,
      mistakes: U.mistakes([ans], n === 0
        ? [{ answers: ['0'], tag: 'pow-zero', msg: '0 乗は 0 ではなく 1 だよ(a^0 = 1)' }, { answers: [String(a)], tag: 'pow-zero', msg: '0 乗は 1 だよ(a^0 = 1)' }]
        : [{ answers: [String(a * n)], tag: 'pow-mult', msg: a + '^' + n + ' は ' + a + '×' + n + ' ではないよ。' + a + ' を ' + n + ' 回かけよう' }])
    };
  }
};
types['sqrt-basic'] = {
  name: '平方根の計算', level: 0,
  gen: function (R) {
    const b = R.int(2, 12), sq = b * b;
    return {
      text: 'つぎの値を求めよ。', expr: '√{' + sq + '}', form: '□', answers: [String(b)], num: [Math.sqrt(sq)],
      hint: '2 乗して ' + sq + ' になる 正の数は?',
      explain: ['√a は「2 乗して a になる正の数」', b + '^2 = ' + sq + ' より √{' + sq + '} = ' + b],
      mistakes: U.mistakes([String(b)], sq % 2 === 0 ? [{ answers: [String(sq / 2)], tag: 'root-div', msg: '√ は 2 で割ることではないよ。2 乗して中身になる数を探そう' }] : [])
    };
  }
};
types['log-basic'] = {
  name: 'log の超基本', level: 0,
  gen: function (R) {
    const a = R.pick([2, 3, 5, 10]);
    let k = R.int(-2, 4);
    while (pw(a, Math.abs(k)) > 1000 || (a === 5 && Math.abs(k) > 3)) k += k > 0 ? -1 : 1;
    const big = pw(a, Math.abs(k)), arg = k < 0 ? '{1/' + big + '}' : String(big), ans = String(k), mis = [];
    if (k > 1 && big % a === 0) mis.push({ answers: [String(big / a)], tag: 'log-div', msg: 'log は割り算ではないよ。「' + a + ' を何乗すると ' + big + ' か」を考えよう' });
    if (k < 0) mis.push({ answers: [String(-k)], tag: 'log-neg', msg: '真数が分数(1 より小さい)のとき、log は負になるよ' });
    if (k === 0) mis.push({ answers: ['1'], tag: 'log-one', msg: 'a^0 = 1 だから log_a 1 = 0 だよ' });
    if (k === 1) mis.push({ answers: ['0'], tag: 'log-one', msg: 'a^1 = a だから log_a a = 1 だよ' });
    return {
      text: 'つぎの値を求めよ。', expr: 'log_{' + a + '} ' + arg, form: '□', answers: [ans], num: [Math.log(k < 0 ? 1 / big : big) / Math.log(a)],
      hint: a + ' を 何乗すると ' + arg + ' になるかを 考えよう',
      explain: ['log_{' + a + '} M は「' + a + ' を何乗すると M になるか」', a + '^{' + k + '} = ' + arg + ' より', 'log_{' + a + '} ' + arg + ' = ' + k],
      mistakes: U.mistakes([ans], mis)
    };
  }
};

/* ==================== 加法定理の洞窟 ==================== */
types['add-formula'] = {
  name: '加法定理の公式(符号)', level: 1, noNum: true,
  gen: function (R) {
    const f = R.pick(['sin', 'cos', 'tan']), s = R.pick(['+', '-']), sd = s === '+' ? '+' : '-';
    let form, ans, msg, tag, ex;
    if (f === 'sin') {
      form = 'sin(α ' + sd + ' β) = sin α cos β □ cos α sin β'; ans = s; tag = 'sin-sign'; msg = 'sin の加法定理は 符号がそのまま だよ';
      ex = ['sin(α ± β) = sin α cos β ± cos α sin β(複号同順)', 'sin は 左辺と同じ符号になる'];
    } else if (f === 'cos') {
      form = 'cos(α ' + sd + ' β) = cos α cos β □ sin α sin β'; ans = flip(s); tag = 'cos-sign'; msg = 'cos の加法定理は 符号が逆になるよ';
      ex = ['cos(α ± β) = cos α cos β ∓ sin α sin β(複号同順)', 'cos は 左辺と逆の符号になる'];
    } else {
      form = 'tan(α ' + sd + ' β) = {tan α ' + sd + ' tan β/1 □ tan α tan β}'; ans = flip(s); tag = 'tan-sign'; msg = 'tan の加法定理は、分母の符号が 分子と逆になるよ';
      ex = ['tan(α ± β) = {tan α ± tan β/1 ∓ tan α tan β}(複号同順)', '分子は左辺と同じ符号、分母は逆の符号'];
    }
    return {
      text: '□ に入る符号(＋ か −)を答えよ。', form: form, answers: [ans], keys: ['+'],
      hint: 'sin は「そのまま」、cos は「逆」、tan は「分子そのまま・分母は逆」',
      explain: ex, mistakes: [{ answers: [flip(ans)], tag: tag, msg: msg }]
    };
  }
};
const AV = [   // [関数, 角, √a, 符号, √b, 分け方, 展開]
  ['sin', 75, '6', '+', '2', '45° + 30°', 'sin 45° cos 30° + cos 45° sin 30°'],
  ['cos', 75, '6', '-', '2', '45° + 30°', 'cos 45° cos 30° - sin 45° sin 30°'],
  ['sin', 15, '6', '-', '2', '45° - 30°', 'sin 45° cos 30° - cos 45° sin 30°'],
  ['cos', 15, '6', '+', '2', '45° - 30°', 'cos 45° cos 30° + sin 45° sin 30°'],
  ['sin', 105, '6', '+', '2', '60° + 45°', 'sin 60° cos 45° + cos 60° sin 45°'],
  ['cos', 105, '2', '-', '6', '60° + 45°', 'cos 60° cos 45° - sin 60° sin 45°']
];
types['add-value'] = {
  name: 'sin 75° などの値', level: 2,
  gen: function (R) {
    const v = R.pick(AV), f = v[0], a = v[2], op = v[3], b = v[4], ans = [a, op, b, '4'];
    const signMsg = f === 'cos' ? 'cos の加法定理は 符号が逆になるよ' : 'sin の加法定理は 符号がそのまま だよ', signTag = f === 'cos' ? 'cos-sign' : 'sin-sign';
    const mis = op === '+'
      ? [{ answers: ['6', '-', '2', '4'], unordered: [], tag: signTag, msg: signMsg }, { answers: ['2', '-', '6', '4'], unordered: [], tag: signTag, msg: signMsg }]
      : [{ answers: ['6', '+', '2', '4'], unordered: [[0, 2]], tag: signTag, msg: signMsg },
        { answers: [b, '-', a, '4'], unordered: [], tag: 'sub-order', msg: '引く順番に注意。' + f + ' ' + v[1] + '° が 正か負かを 確かめよう' }];
    return {
      text: 'つぎの値を求めよ。', expr: f + ' ' + v[1] + '°', form: '{√□ □ √□/□}', answers: ans, unordered: op === '+' ? [[0, 2]] : [], keys: ['+'],
      verify: function (vals, raws) {
        const x = (Math.sqrt(vals[0]) + (raws[1] === '+' ? 1 : -1) * Math.sqrt(vals[2])) / vals[3];
        return close(x, (f === 'sin' ? Math.sin : Math.cos)(v[1] * RAD));
      },
      hint: v[1] + '° = ' + v[5] + ' と分けて、加法定理を使おう',
      explain: [f + ' ' + v[1] + '° = ' + f + '(' + v[5] + ')', '= ' + v[6], '= {√' + a + ' ' + op + ' √' + b + '/4}'],
      mistakes: U.mistakes(ans, mis, op === '+' ? [[0, 2]] : [])
    };
  }
};
types['double-value'] = {
  name: 'sin α から sin 2α・cos 2α', level: 3,
  gen: function (R) {
    const t = R.pick(TRI), a = t[0], b = t[1], c = t[2], q2 = R.chance(0.5), sg = q2 ? -1 : 1, isSin = R.chance(0.5);
    const alpha = q2 ? Math.PI - Math.asin(a / c) : Math.asin(a / c);
    const text = 'sin α = ' + am(F(a, c)) + '(α は第' + (q2 ? 2 : 1) + '象限の角)のとき、つぎの値を求めよ。';
    const cosLine = 'cos^2 α = 1 - sin^2 α より cos α = ' + am(F(sg * b, c)) + '(第' + (q2 ? 2 : 1) + '象限)';
    if (isSin) {
      const ans = F(sg * 2 * a * b, c * c);
      return {
        text: text, expr: 'sin 2α', form: '□', answers: [ans], keys: ['分数'], num: [Math.sin(2 * alpha)],
        hint: 'sin 2α = 2 sin α cos α。まず cos α を求めよう(象限で符号が決まる)',
        explain: [cosLine, 'sin 2α = 2 sin α cos α = 2·' + par(a, c) + '·' + par(sg * b, c), '= ' + am(ans)],
        mistakes: U.mistakes([ans], [
          { answers: [F(sg * a * b, c * c)], tag: 'double-2', msg: '2 sin α cos α の 2 を忘れていないかな?' },
          { answers: [F(2 * a, c)], tag: 'double-linear', msg: 'sin 2α は 2 sin α ではないよ。2 sin α cos α を使おう' },
          q2 ? { answers: [F(2 * a * b, c * c)], tag: 'quadrant-sign', msg: '第2象限では cos α は負だよ' } : null])
      };
    }
    const ans = F(c * c - 2 * a * a, c * c);
    return {
      text: text, expr: 'cos 2α', form: '□', answers: [ans], keys: ['分数'], num: [Math.cos(2 * alpha)],
      hint: 'cos 2α = 1 - 2 sin^2 α を使うと、sin α だけで求められる',
      explain: ['cos 2α = 1 - 2 sin^2 α', '= 1 - 2·(' + am(F(a, c)) + ')^2 = 1 - ' + am(F(2 * a * a, c * c)), '= ' + am(ans)],
      mistakes: U.mistakes([ans], [
        { answers: [F(2 * a * a - c * c, c * c)], tag: 'double-cos-sign', msg: 'cos 2α = 1 - 2 sin^2 α。引く順番を確かめよう' },
        { answers: [F(c * c - a * a, c * c)], tag: 'double-2', msg: '1 - 2 sin^2 α の 2 を忘れていないかな?' }])
    };
  }
};

/* ==================== 合成の塔 ==================== */
types['gousei'] = {
  name: '三角関数の合成', level: 1,
  gen: function (R) {
    const g = R.pick(GS), k = R.int(1, 3), r = scale(k, g[2]), a12 = g[3], ab = gsNum(g, k);
    const ans = [r].concat(alphaAns(a12)), mis = [];
    const ref = Math.min(Math.abs(a12), 12 - Math.abs(a12)), sg = a12 > 0 ? 1 : -1;
    [-a12, sg * (12 - Math.abs(a12)), a12 - sg * 12].forEach(function (u) {
      if (u === 12 || u === -12 || u === 0) return;
      mis.push({ answers: ['*'].concat(alphaAns(u)), tag: 'gousei-quadrant', msg: '点 (a, b) がどの象限にあるか、図で確かめよう' });
    });
    if (ref !== 3) mis.push({ answers: ['*'].concat(alphaAns(sg * (Math.abs(a12) < 6 ? 6 - ref : 12 - (6 - ref)))), tag: 'gousei-swap', msg: 'sin の係数が x 座標 a、cos の係数が y 座標 b。逆にしていないかな?' });
    const qn = a12 > 0 ? (a12 < 6 ? 1 : 2) : (a12 > -6 ? 4 : 3);
    return {
      text: 'つぎの式を r sin(θ + α) の形に変形せよ。ただし r > 0、-π < α ≦ π とする。', expr: gsExpr(g, k), form: '□ sin(θ □ □)', answers: ans, keys: ['√', 'π', '分数', '+'],
      verify: function (vals, raws) {
        const al = (raws[1] === '+' ? 1 : -1) * vals[2];
        return vals[0] > 0 && al > -Math.PI && al <= Math.PI + 1e-12 && [0.3, 1.1, 2.9].every(function (th) { return close(vals[0] * Math.sin(th + al), ab[0] * Math.sin(th) + ab[1] * Math.cos(th)); });
      },
      hint: '点 (a, b) = (sin の係数, cos の係数) をとり、r = √{a^2 + b^2} と 角 α を求めよう',
      explain: ['点 (' + scale(k, g[0]) + ', ' + scale(k, g[1]) + ') をとると r = ' + r, '点は第' + qn + '象限にあり α = ' + am(p12(a12)), 'よって ' + r + ' sin(' + thetaPlus(a12) + ')'],
      mistakes: U.mistakes(ans, mis)
    };
  }
};
types['gousei-max'] = {
  name: '合成を使った最大値・最小値', level: 2,
  gen: function (R) {
    const g = R.pick(GS), k = R.int(1, 2), isInt = g[2] === '2', c = isInt && R.chance(0.5) ? R.pick([-3, -2, -1, 1, 2, 3]) : 0;
    const rv = isInt ? 2 * k : null, ab = gsNum(g, k), rn = Math.hypot(ab[0], ab[1]);
    const ans = isInt ? [String(rv + c), String(-rv + c)] : [scale(k, '√2'), '-' + scale(k, '√2')], rs = isInt ? String(rv) : scale(k, '√2');
    const mis = [{ answers: [ans[1], ans[0]], tag: 'maxmin-swap', msg: '最大値と最小値が 逆になっているよ' },
      { answers: [String(1 + c), String(-1 + c)], tag: 'gousei-r', msg: '合成すると r sin(θ + α)。-r ≦ r sin(θ + α) ≦ r だよ' }];
    if (!isInt) mis.push({ answers: [String(2 * k), String(-2 * k)], tag: 'gousei-sum', msg: 'sin と cos は 同時に 1 にはならない。合成してから考えよう' });
    if (c) mis.push({ answers: [String(rv), String(-rv)], tag: 'gousei-const', msg: '定数項を 足し忘れていないかな?' });
    return {
      text: '関数 y の最大値と最小値を求めよ。', expr: 'y = ' + gsExpr(g, k) + term(c), form: '最大値 □、最小値 □', answers: ans, keys: ['√'], num: [rn + c, -rn + c],
      hint: 'まず 合成して y = r sin(θ + α)' + (c ? ' + (定数)' : '') + ' の形にしよう',
      explain: ['合成すると y = ' + rs + ' sin(' + thetaPlus(g[3]) + ')' + term(c), '-1 ≦ sin(' + thetaPlus(g[3]) + ') ≦ 1 より', '最大値 ' + am(ans[0]) + '、最小値 ' + am(ans[1])],
      mistakes: U.mistakes(ans, mis, [])
    };
  }
};
const GEQ2 = [['1', [2, 10]], ['√3', [4, 8]], ['√2', [3, 9]], ['-1', [14, 22]], ['-√3', [16, 20]], ['-√2', [15, 21]]];   // 2 sin t = c となる t
const GEQR = [['1', [3, 9]], ['-1', [15, 21]]];                                                                          // √2 sin t = c
types['gousei-eq'] = {
  name: '合成を使う方程式', level: 3,
  gen: function (R) {
    let g = GS[4], s = GEQ2[0], th = null;
    for (let i = 0; i < 60 && !th; i++) {
      const gg = R.pick(GS), ss = R.pick(gg[2] === '2' ? GEQ2 : GEQR);
      const t = ss[1].map(function (x) { return ((x - gg[3]) % 24 + 24) % 24; });
      if (t.every(function (u) { return u % 2 === 0 || u % 3 === 0; })) { g = gg; s = ss; th = t; }
    }
    if (!th) th = s[1].map(function (x) { return ((x - g[3]) % 24 + 24) % 24; });
    th.sort(function (a, b) { return a - b; });
    const a12 = g[3], ans = th.map(p12), ab = gsNum(g, 1), cn = U.parseValue(s[0]).num;
    const T = th.map(function (u) { return u + a12; }).sort(function (a, b) { return a - b; }), rs = g[2];
    return {
      text: '0 ≦ θ < 2π のとき、つぎの方程式を解け。', expr: gsExpr(g, 1) + ' = ' + s[0], form: 'θ = □, □', answers: ans, unordered: [[0, 1]], keys: ['π', '分数'],
      verify: function (vals) {
        return !close(vals[0], vals[1]) && vals.every(function (x) { return x > -1e-9 && x < 2 * Math.PI - 1e-9 && close(ab[0] * Math.sin(x) + ab[1] * Math.cos(x), cn); });
      },
      hint: '左辺を合成して ' + rs + ' sin(' + thetaPlus(a12) + ') の形に。' + thetaPlus(a12) + ' の範囲にも注意',
      explain: ['左辺を合成して ' + rs + ' sin(' + thetaPlus(a12) + ') = ' + s[0],
        am(p12(a12)) + ' ≦ ' + thetaPlus(a12) + ' < ' + am(p12(a12 + 24)) + ' より ' + thetaPlus(a12) + ' = ' + am(p12(T[0])) + ', ' + am(p12(T[1])),
        'よって θ = ' + am(ans[0]) + ', ' + am(ans[1])],
      mistakes: U.mistakes(ans, [
        { answers: s[1].map(p12), tag: 'gousei-eq-shift', msg: 'それは θ + α の値。最後に α を移項して θ にしよう' },
        { answers: s[1].map(function (x) { return p12(((x + a12) % 24 + 24) % 24); }), tag: 'gousei-eq-shift', msg: 'θ + α = t なら θ = t - α。移項の符号を確かめよう' }], [[0, 1]])
    };
  }
};

/* ==================== 指数の森 ==================== */
types['exp-neg'] = {
  name: '0・負の指数', level: 1,
  gen: function (R) {
    const a = R.pick([2, 3, 4, 5, 10]), kind = R.int(0, 6);
    if (kind === 0) {
      return {
        text: 'つぎの値を求めよ。', expr: a + '^0', form: '□', answers: ['1'], keys: ['分数'], num: [Math.pow(a, 0)],
        hint: 'a^0 = 1', explain: ['0 でない数の 0 乗は 1 と決める', a + '^0 = 1'],
        mistakes: [{ answers: ['0'], tag: 'pow-zero', msg: '0 乗は 0 ではなく 1 だよ(a^0 = 1)' }]
      };
    }
    let n = R.int(1, 3);
    if (kind <= 4) {
      while (pw(a, n) > 1000) n--;
      const big = pw(a, n), ans = F(1, big);
      return {
        text: 'つぎの値を求めよ。', expr: a + '^{-' + n + '}', form: '□', answers: [ans], keys: ['分数'], num: [Math.pow(a, -n)],
        hint: 'a^{-n} = {1/a^n}(マイナス乗は 逆数)',
        explain: ['a^{-n} = {1/a^n}', a + '^{-' + n + '} = {1/' + a + '^' + n + '}', '= ' + am(ans)],
        mistakes: U.mistakes([ans], [
          { answers: [String(-big)], tag: 'neg-exp', msg: 'マイナス乗は 負の数ではなく 分数(逆数)にして答えよう' },
          { answers: [String(big)], tag: 'neg-exp', msg: 'マイナス乗は 分数にして答えよう(a^{-n} = {1/a^n})' },
          { answers: [String(-a * n)], tag: 'pow-mult', msg: '指数は かけ算ではないよ。' + a + '^{-' + n + '} = {1/' + a + '^' + n + '}' }])
      };
    }
    while (pw(a, n) > 125) n--;
    const big = pw(a, n);
    return {
      text: 'つぎの値を求めよ。', expr: '({1/' + a + '})^{-' + n + '}', form: '□', answers: [String(big)], keys: ['分数'], num: [Math.pow(1 / a, -n)],
      hint: '分数のマイナス乗は、逆数にしてから 累乗しよう',
      explain: ['マイナス乗は 逆数にする', '({1/' + a + '})^{-' + n + '} = ' + a + '^' + n, '= ' + big],
      mistakes: U.mistakes([String(big)], [
        { answers: [F(1, big)], tag: 'neg-exp-frac', msg: '分数のマイナス乗は、逆数にしてから 累乗するよ' },
        { answers: [String(-big)], tag: 'neg-exp', msg: 'マイナス乗で 符号は変わらないよ(逆数になるだけ)' }])
    };
  }
};
types['root'] = {
  name: '累乗根', level: 1,
  gen: function (R) {
    const pr = R.pick([[3, 2], [3, 3], [3, 4], [3, 5], [3, 10], [4, 2], [4, 3], [5, 2], [5, 3], [6, 2]]), n = pr[0], b = pr[1], rad = pw(b, n), mis = [];
    if (rad % n === 0) mis.push({ answers: [String(rad / n)], tag: 'root-div', msg: n + ' 乗根は ' + n + ' で割ることではないよ。' + n + ' 乗して中身になる数を探そう' });
    const sq = Math.round(Math.sqrt(rad));
    if (sq * sq === rad) mis.push({ answers: [String(sq)], tag: 'root-index', msg: '何乗根か(左肩の小さい数字)を確かめよう。これは ' + n + ' 乗根だよ' });
    return {
      text: 'つぎの値を求めよ。', expr: '[' + n + ']√{' + rad + '}', form: '□', answers: [String(b)], num: [Math.pow(rad, 1 / n)],
      hint: n + ' 乗すると ' + rad + ' になる 正の数を探そう',
      explain: ['[' + n + ']√a は「' + n + ' 乗して a になる数」', b + '^' + n + ' = ' + rad + ' より', '[' + n + ']√{' + rad + '} = ' + b],
      mistakes: U.mistakes([String(b)], mis)
    };
  }
};
types['exp-rational'] = {
  name: '有理数の指数', level: 2,
  gen: function (R) {
    let p, n, m;
    do { p = R.pick([2, 3, 5]); n = R.int(2, 4); m = R.pick([1, 2, 3, -1, -2, -3]); }
    while (U.gcd(m, n) !== 1 || pw(p, n) > 125 || pw(p, Math.abs(m)) > 125);
    const base = pw(p, n), am_ = Math.abs(m), val = pw(p, am_), ans = m > 0 ? String(val) : F(1, val);
    const ex = m > 0 ? '{' + m + '/' + n + '}' : '-{' + am_ + '/' + n + '}';
    const mis = [{ answers: [F(base * m, n)], tag: 'pow-mult', msg: '指数は かけ算ではないよ。まず ' + base + ' = ' + p + '^' + n + ' と表そう' }];
    if (am_ === 1 && pw(base, n) < 100000) mis.push({ answers: [String(pw(base, n))], tag: 'rat-exp-swap', msg: 'a^{{m/n}} は「n 乗根の m 乗」。分母が 累乗根だよ' });
    if (m < 0) {
      mis.push({ answers: [String(val)], tag: 'neg-exp', msg: 'マイナス乗は 分数にして答えよう(a^{-n} = {1/a^n})' });
      mis.push({ answers: [String(-val)], tag: 'neg-exp', msg: 'マイナス乗は 負の数ではなく 分数(逆数)だよ' });
    }
    return {
      text: 'つぎの値を求めよ。', expr: base + '^{' + ex + '}', form: '□', answers: [ans], keys: ['分数'], num: [Math.pow(base, m / n)],
      hint: base + ' = ' + p + '^' + n + ' と表して、(a^m)^n = a^{mn} を使おう',
      explain: [base + ' = ' + p + '^' + n + ' だから ' + base + '^{' + ex + '} = (' + p + '^' + n + ')^{' + ex + '}', '= ' + p + '^{' + m + '}', '= ' + am(ans)],
      mistakes: U.mistakes([ans], mis)
    };
  }
};
types['exp-eq'] = {
  name: '指数方程式', level: 3,
  gen: function (R) {
    let p, i, j;
    do { p = R.pick([2, 3]); i = R.int(1, 3); j = R.int(-3, 5); }
    while (j === 0 || (i === 1 && j === 1) || i === j || pw(p, i) > 27 || pw(p, Math.abs(j)) > 243);
    const A = pw(p, i), big = pw(p, Math.abs(j)), rhs = j < 0 ? '{1/' + big + '}' : String(big), ans = F(j, i), mis = [];
    if (j > 0 && big % A === 0) mis.push({ answers: [String(big / A)], tag: 'exp-eq-div', msg: '割り算ではなく、底を ' + p + ' にそろえて 指数を比べよう' });
    mis.push({ answers: [F(i, j)], tag: 'exp-eq-swap', msg: '底をそろえると ' + p + '^{' + (i === 1 ? '' : i) + 'x} = ' + p + '^{' + j + '}。指数どうしを比べよう' });
    if (j < 0) mis.push({ answers: [F(-j, i)], tag: 'neg-exp', msg: rhs + ' = ' + p + '^{' + j + '}。分数は マイナスの指数になるよ' });
    if (i > 1) mis.push({ answers: [String(j)], tag: 'exp-base', msg: A + ' = ' + p + '^' + i + ' だから 左辺は ' + p + '^{' + i + 'x}。' + i + ' で割り忘れていないかな?' });
    return {
      text: 'つぎの方程式を解け。', expr: A + '^x = ' + rhs, form: 'x = □', answers: [ans], keys: ['分数'], num: [Math.log(j < 0 ? 1 / big : big) / Math.log(A)],
      hint: '両辺を 底 ' + p + ' の累乗で 表そう',
      explain: i === 1 ? [rhs + ' = ' + p + '^{' + j + '} より ' + p + '^x = ' + p + '^{' + j + '}', '指数を比べて', 'x = ' + am(ans)]
        : [A + ' = ' + p + '^' + i + '、' + rhs + ' = ' + p + '^{' + j + '} より ' + p + '^{' + i + 'x} = ' + p + '^{' + j + '}', '指数を比べて ' + i + 'x = ' + j, 'x = ' + am(ans)],
      mistakes: U.mistakes([ans], mis)
    };
  }
};

/* ==================== 対数の塔 ==================== */
types['log-value'] = {
  name: 'log の値', level: 1,
  gen: function (R) {
    if (R.chance(0.2)) {
      const p = R.pick([2, 3, 5, 7]), n = R.pick([2, 3]), arg = n === 2 ? '√' + p : '[3]√' + p, ans = '1/' + n;
      return {
        text: 'つぎの値を求めよ。', expr: 'log_' + p + ' ' + arg, form: '□', answers: [ans], keys: ['分数'], num: [Math.log(Math.pow(p, 1 / n)) / Math.log(p)],
        hint: arg + ' を ' + p + ' の累乗(分数の指数)で 表そう',
        explain: [arg + ' = ' + p + '^{1/' + n + '}', 'log_' + p + ' ' + p + '^{1/' + n + '} = {1/' + n + '}'],
        mistakes: [{ answers: [String(n)], tag: 'root-exp', msg: arg + ' = ' + p + '^{1/' + n + '}。指数は 分数になるよ' }]
      };
    }
    let p, i, j;
    do { p = R.pick([2, 3, 5]); i = R.int(1, 3); j = R.int(-3, 4); }
    while ((i === 1 && j === 1) || (j === 0 && R.chance(0.8)) || pw(p, i) > 27 || pw(p, Math.abs(j)) > (p === 5 ? 25 : 81));
    const A = pw(p, i), big = pw(p, Math.abs(j)), arg = j < 0 ? '{1/' + big + '}' : String(big), ans = F(j, i), mis = [];
    if (j > 0 && big % A === 0) mis.push({ answers: [String(big / A)], tag: 'log-div', msg: 'log は割り算ではないよ。「' + A + ' を何乗すると ' + big + ' か」を考えよう' });
    if (j !== 0) mis.push({ answers: [F(i, j)], tag: 'log-swap', msg: 'log_a b = x は a^x = b。底と真数を 逆にしていないかな?' });
    if (j < 0) mis.push({ answers: [F(-j, i)], tag: 'log-neg', msg: '真数が 1 より小さいとき、log は負になるよ' });
    if (j === 0) mis.push({ answers: ['1'], tag: 'log-one', msg: 'a^0 = 1 だから log_a 1 = 0 だよ' });
    return {
      text: 'つぎの値を求めよ。', expr: 'log_{' + A + '} ' + arg, form: '□', answers: [ans], keys: ['分数'], num: [Math.log(j < 0 ? 1 / big : big) / Math.log(A)],
      hint: 'log_{' + A + '} ' + arg + ' = x とおくと ' + A + '^x = ' + arg + '。底を ' + p + ' にそろえよう',
      explain: i === 1 ? ['log_{' + A + '} ' + arg + ' = x とおくと ' + A + '^x = ' + arg, arg + ' = ' + p + '^{' + j + '} より', 'x = ' + am(ans)]
        : ['log_{' + A + '} ' + arg + ' = x とおくと ' + A + '^x = ' + arg, p + '^{' + i + 'x} = ' + p + '^{' + j + '} より ' + i + 'x = ' + j, 'x = ' + am(ans)],
      mistakes: U.mistakes([ans], mis)
    };
  }
};
types['log-prop-form'] = {
  name: '対数の性質(1つの log にまとめる)', level: 1,
  gen: function (R) {
    const a = R.pick([2, 3, 5, 7, 10]), kind = R.int(0, 2), lg = 'log_{' + a + '} ';
    if (kind === 0) {
      let m, n; do { m = R.int(2, 9); n = R.int(2, 9); } while (m + n === m * n);
      return {
        text: '□ に入る数を答えよ。', form: lg + m + ' + ' + lg + n + ' = ' + lg + '□', answers: [String(m * n)], num: [Math.exp(Math.log(m) + Math.log(n))],
        hint: 'log M + log N = log MN(足し算は 真数のかけ算)',
        explain: ['log_a M + log_a N = log_a MN', lg + m + ' + ' + lg + n + ' = ' + lg + '(' + m + '×' + n + ')', '= ' + lg + (m * n)],
        mistakes: [{ answers: [String(m + n)], tag: 'log-add', msg: '足し算になるのは log(ab) のときだよ(log M + log N = log MN)' }]
      };
    }
    if (kind === 1) {
      let n, qv; do { n = R.int(2, 6); qv = R.int(2, 9); } while (n * qv - n === qv);
      const m = n * qv;
      return {
        text: '□ に入る数を答えよ。', form: lg + m + ' - ' + lg + n + ' = ' + lg + '□', answers: [String(qv)], num: [Math.exp(Math.log(m) - Math.log(n))],
        hint: 'log M - log N = log {M/N}(引き算は 真数の割り算)',
        explain: ['log_a M - log_a N = log_a {M/N}', lg + m + ' - ' + lg + n + ' = ' + lg + '{' + m + '/' + n + '}', '= ' + lg + qv],
        mistakes: [{ answers: [String(m - n)], tag: 'log-sub', msg: '引き算は 真数の割り算になるよ(log M - log N = log {M/N})' }]
      };
    }
    let k, m; do { k = R.int(2, 3); m = R.int(2, 6); } while (k * m === pw(m, k));
    return {
      text: '□ に入る数を答えよ。', form: k + ' ' + lg + m + ' = ' + lg + '□', answers: [String(pw(m, k))], num: [Math.exp(k * Math.log(m))],
      hint: 'k log M = log M^k(係数は 真数の指数へ)',
      explain: ['k log_a M = log_a M^k', k + ' ' + lg + m + ' = ' + lg + m + '^' + k, '= ' + lg + pw(m, k)],
      mistakes: [{ answers: [String(k * m)], tag: 'log-coef', msg: '係数は 真数の指数になるよ(k log M = log M^k)' }]
    };
  }
};
const LPS = [[6, 2, 3, 1], [6, 4, 9, 2], [6, 2, 18, 2], [6, 3, 12, 2], [10, 2, 5, 1], [10, 4, 25, 2], [10, 2, 50, 2], [10, 5, 20, 2], [12, 3, 4, 1], [12, 2, 6, 1], [15, 3, 5, 1]];
types['log-prop'] = {
  name: '対数の性質を使う計算', level: 2,
  gen: function (R) {
    if (R.chance(0.5)) {
      const v = R.pick(LPS), a = v[0], sw = R.chance(0.5), m = sw ? v[2] : v[1], n = sw ? v[1] : v[2], k = v[3], lg = 'log_{' + a + '} ';
      return {
        text: 'つぎの式を計算せよ。', expr: lg + m + ' + ' + lg + n, form: '□', answers: [String(k)], num: [(Math.log(m) + Math.log(n)) / Math.log(a)],
        hint: 'log M + log N = log MN で 1つにまとめよう',
        explain: [lg + m + ' + ' + lg + n + ' = ' + lg + '(' + m + '×' + n + ') = ' + lg + (m * n), m * n + ' = ' + a + '^' + k + ' より', '= ' + k],
        mistakes: U.mistakes([String(k)], [
          { answers: [String(m * n)], tag: 'log-forget', msg: lg + (m * n) + ' まで来たら もう一歩。' + a + ' を何乗すると ' + (m * n) + ' かな?' },
          { answers: [String(m + n)], tag: 'log-add', msg: '足し算になるのは log(ab) のときだよ(log M + log N = log MN)' }])
      };
    }
    const a = R.pick([2, 3, 5]), k = R.int(1, a === 5 ? 2 : 3), c = R.pick([2, 3, 5, 6, 7].filter(function (x) { return x % a !== 0; })), m = c * pw(a, k), lg = 'log_{' + a + '} ';
    return {
      text: 'つぎの式を計算せよ。', expr: lg + m + ' - ' + lg + c, form: '□', answers: [String(k)], num: [(Math.log(m) - Math.log(c)) / Math.log(a)],
      hint: 'log M - log N = log {M/N} で 1つにまとめよう',
      explain: [lg + m + ' - ' + lg + c + ' = ' + lg + '{' + m + '/' + c + '} = ' + lg + pw(a, k), pw(a, k) + ' = ' + a + '^' + k + ' より', '= ' + k],
      mistakes: U.mistakes([String(k)], [
        { answers: [String(pw(a, k))], tag: 'log-forget', msg: lg + pw(a, k) + ' まで来たら もう一歩。' + a + ' を何乗すると ' + pw(a, k) + ' かな?' },
        { answers: [String(m - c)], tag: 'log-sub', msg: '引き算は 真数の割り算になるよ(log M - log N = log {M/N})' }])
    };
  }
};
types['log-eq'] = {
  name: '対数方程式(真数条件)', level: 3,
  gen: function (R) {
    function xm(d) { return d > 0 ? 'x - ' + d : 'x + ' + (-d); }
    if (R.chance(0.45)) {
      const a = R.pick([2, 3]), k = R.int(1, 3), c = R.pick([-3, -2, -1, 1, 2, 3, 4, 5]), N = pw(a, k), ans = String(N + c);
      return {
        text: 'つぎの方程式を解け。', expr: 'log_' + a + ' (' + xm(c) + ') = ' + k, form: 'x = □', answers: [ans],
        verify: function (v) { return v[0] - c > 0 && close(Math.log(v[0] - c) / Math.log(a), k); },
        hint: 'log_a M = k ⇔ M = a^k。真数 ' + xm(c) + ' > 0 も確かめよう',
        explain: ['log_' + a + ' (' + xm(c) + ') = ' + k + ' より ' + xm(c) + ' = ' + a + '^' + k + ' = ' + N, 'x = ' + ans + '(真数 ' + xm(c) + ' = ' + N + ' > 0 を満たす)'],
        mistakes: U.mistakes([ans], [
          { answers: [String(a * k + c)], tag: 'log-def', msg: 'log_a M = k は M = a^k だよ(a × k ではない)' },
          { answers: [String(N)], tag: 'log-eq-shift', msg: xm(c) + ' = ' + N + '。移項を 忘れていないかな?' },
          { answers: [String(N - c)], tag: 'log-eq-shift', msg: xm(c) + ' = ' + N + '。移項の符号を 確かめよう' }])
      };
    }
    const v = R.pick([[2, 3, 4, 2], [2, 3, 8, 1], [2, 3, 2, 4], [3, 1, 3, 1], [2, 2, 4, 1], [2, 2, 1, 4], [6, 1, 3, 2], [6, 1, 2, 3], [6, 1, 6, 1], [10, 1, 5, 2], [10, 1, 2, 5], [10, 1, 10, 1], [3, 2, 9, 1], [3, 3, 9, 3]]);
    const a = v[0], k = v[1], p = v[2], m = v[3], d = p - m, N = pw(a, k), lo = Math.max(0, d), lg = 'log_{' + a + '} ';
    return {
      text: 'つぎの方程式を解け。', expr: lg + 'x + ' + lg + '(' + xm(d) + ') = ' + k, form: 'x = □', answers: [String(p)],
      verify: function (vv) { const x = vv[0]; return x > 0 && x - d > 0 && close((Math.log(x) + Math.log(x - d)) / Math.log(a), k); },
      hint: 'まず 真数条件(x > 0、' + xm(d) + ' > 0)を書こう。それから log を 1つにまとめる',
      explain: ['真数は正より x > 0 かつ ' + xm(d) + ' > 0、つまり x > ' + lo,
        lg + 'x(' + xm(d) + ') = ' + k + ' より x(' + xm(d) + ') = ' + N + '、(x - ' + p + ')(x + ' + m + ') = 0',
        'x > ' + lo + ' より x = ' + p],
      mistakes: U.mistakes([String(p)], [
        { answers: [String(-m)], tag: 'log-domain', msg: '真数は正。条件(x > ' + lo + ')を満たすか 確かめよう' },
        { answers: [String(m)], tag: 'factor-sign', msg: '(x - ' + p + ')(x + ' + m + ') = 0 の解は x = ' + p + ', -' + m + '。符号を確かめよう' }])
    };
  }
};

/* ==================== 魔王の城:考査本番レベル ==================== */
types['maou-add-two'] = {
  name: '2つの角の加法定理', level: 4,
  gen: function (R) {
    const t1 = R.pick(TRI.slice(0, 4)), t2 = R.pick(TRI.slice(0, 4)), qa = R.int(1, 2), qb = R.int(1, 4), f = R.pick(['sin', 'cos']), s = R.pick([1, -1]);
    const c1 = t1[2], c2 = t2[2], sa = t1[0], ca = (qa === 1 ? 1 : -1) * t1[1], cb = (qb === 1 || qb === 4 ? 1 : -1) * t2[1], sb = (qb <= 2 ? 1 : -1) * t2[0];
    function calc(SA, CA, SB, CB, sg) { return f === 'sin' ? SA * CB + sg * CA * SB : CA * CB - sg * SA * SB; }
    const D = c1 * c2, ans = F(calc(sa, ca, sb, cb, s), D), op = s > 0 ? '+' : '-', op2 = f === 'sin' ? op : flip(op);
    const al = Math.atan2(sa, ca), be = Math.atan2(sb, cb);
    return {
      text: 'sin α = ' + am(F(sa, c1)) + '、cos β = ' + am(F(cb, c2)) + '(α は第' + qa + '象限、β は第' + qb + '象限の角)のとき、つぎの値を求めよ。',
      expr: f + '(α ' + op + ' β)', form: '□', answers: [ans], keys: ['分数'], num: [(f === 'sin' ? Math.sin : Math.cos)(al + s * be)],
      hint: 'まず cos α と sin β を求めよう(符号は象限で決まる)。それから加法定理',
      explain: ['cos α = ' + am(F(ca, c1)) + '、sin β = ' + am(F(sb, c2)),
        f + '(α ' + op + ' β) = ' + (f === 'sin' ? 'sin α cos β ' + op2 + ' cos α sin β' : 'cos α cos β ' + op2 + ' sin α sin β'),
        '= ' + (f === 'sin' ? par(sa, c1) + '·' + par(cb, c2) + ' ' + op2 + ' ' + par(ca, c1) + '·' + par(sb, c2) : par(ca, c1) + '·' + par(cb, c2) + ' ' + op2 + ' ' + par(sa, c1) + '·' + par(sb, c2)) + ' = ' + am(ans)],
      mistakes: U.mistakes([ans], [
        { answers: [F(calc(sa, Math.abs(ca), Math.abs(sb), Math.abs(cb), s), D)], tag: 'quadrant-sign', msg: '象限から cos α・sin β の符号を 決めよう' },
        { answers: [F(calc(sa, ca, sb, cb, -s), D)], tag: f === 'cos' ? 'cos-sign' : 'sin-sign', msg: f === 'cos' ? 'cos の加法定理は 符号が逆になるよ' : 'sin の加法定理は 符号がそのまま だよ' },
        { answers: [F(calc(sa, -ca, sb, cb, s), D)], tag: 'quadrant-sign', msg: 'cos α の符号を 象限で確かめよう' },
        { answers: [F(calc(sa, ca, -sb, cb, s), D)], tag: 'quadrant-sign', msg: 'sin β の符号を 象限で確かめよう' }])
    };
  }
};
const TV = { 0: '0', 2: '1', 4: '√3', 6: '2', 8: '√3', 10: '1', 12: '0', 14: '-1', 16: '-√3', 18: '-2', 20: '-√3', 22: '-1' };   // 2 sin(tπ/12)
types['maou-gousei-range'] = {
  name: '範囲つきの最大・最小(合成)', level: 4,
  gen: function (R) {
    const g = R.pick(GS2), a12 = g[3], D = R.pick([12, 6]), lo = a12, hi = a12 + D, ab = gsNum(g, 1);
    function val(t) { return 2 * Math.sin(t * Math.PI / 12); }
    function str(t) { return TV[((t % 24) + 24) % 24]; }
    const cand = [lo, hi];
    [-18, 6, 30, -6, 18].forEach(function (t) { if (t > lo && t < hi) cand.push(t); });
    let mx = lo, mn = lo; cand.forEach(function (t) { if (val(t) > val(mx)) mx = t; if (val(t) < val(mn)) mn = t; });
    const ans = [str(mx), str(mn)], eMax = val(lo) > val(hi) ? lo : hi, eMin = val(lo) > val(hi) ? hi : lo;
    return {
      text: '0 ≦ θ ≦ ' + (D === 12 ? 'π' : '{π/2}') + ' のとき、関数 y の最大値と最小値を求めよ。', expr: 'y = ' + gsExpr(g, 1), form: '最大値 □、最小値 □', answers: ans, keys: ['√'],
      verify: function (v) {
        let a = -9, b = 9; const end = D * Math.PI / 12;
        for (let i = 0; i <= 1200; i++) { const th = end * i / 1200, y = ab[0] * Math.sin(th) + ab[1] * Math.cos(th); a = Math.max(a, y); b = Math.min(b, y); }
        return Math.abs(v[0] - a) < 1e-5 && Math.abs(v[1] - b) < 1e-5;
      },
      hint: '合成して 2 sin(' + thetaPlus(a12) + ')。θ の範囲から ' + thetaPlus(a12) + ' の範囲を出そう',
      explain: ['合成して y = 2 sin(' + thetaPlus(a12) + ')', am(p12(lo)) + ' ≦ ' + thetaPlus(a12) + ' ≦ ' + am(p12(hi)) + ' を 単位円で調べる',
        thetaPlus(a12) + ' = ' + am(p12(mx)) + ' で最大値 ' + am(ans[0]) + '、' + am(p12(mn)) + ' で最小値 ' + am(ans[1])],
      mistakes: U.mistakes(ans, [
        { answers: ['2', '-2'], tag: 'range-ignore', msg: 'θ の範囲から θ + α の範囲を出して、単位円で確かめよう' },
        { answers: [str(eMax), str(eMin)], tag: 'range-endpoint', msg: '両端の値だけでなく、途中で sin が 1 や -1 になるかも 確かめよう' },
        { answers: [ans[1], ans[0]], tag: 'maxmin-swap', msg: '最大値と最小値が 逆になっているよ' }], [])
    };
  }
};
types['maou-exp-ineq'] = {
  name: '指数不等式', level: 4,
  gen: function (R) {
    let p, kind, j;
    do { p = R.pick([2, 3]); kind = R.pick(['p', 'p2', 'inv']); j = R.int(-3, 4); } while (j === 0 || pw(p, Math.abs(j)) > 81 || (kind === 'p2' && j % 2 === 0));
    const s = R.pick(['<', '>']), e = kind === 'p' ? 1 : kind === 'p2' ? 2 : -1, A = kind === 'inv' ? 1 / p : pw(p, e);
    const base = kind === 'inv' ? '({1/' + p + '})^x' : A + '^x', big = pw(p, Math.abs(j)), rhs = j < 0 ? '{1/' + big + '}' : String(big), rn = j < 0 ? 1 / big : big;
    const sa = e < 0 ? flip(s) : s, val = F(j, e), ans = [sa, val], mis = [];
    mis.push(e < 0 ? { answers: [s, val], tag: 'ineq-flip', msg: '底が 1 より小さいとき(または 負の数で割るとき)、不等号の向きが 逆になるよ' }
      : { answers: [flip(s), val], tag: 'ineq-noflip', msg: '底が 1 より大きいときは、不等号の向きは そのままだよ' });
    mis.push({ answers: [sa, F(-j, e)], tag: 'neg-exp', msg: '指数の符号を 確かめよう(' + rhs + ' = ' + p + '^{' + j + '})' });
    if (e === 2) mis.push({ answers: [sa, String(j)], tag: 'exp-base', msg: A + ' = ' + p + '^2 だから 左辺は ' + p + '^{2x}。2 で割り忘れていないかな?' });
    const lhs = p + '^{' + (e === 1 ? '' : e === 2 ? '2' : '-') + 'x}';
    return {
      text: 'つぎの不等式を解け。', expr: base + ' ' + s + ' ' + rhs, form: 'x □ □', answers: ans, keys: ['<', '>', '分数'],
      verify: function (v, raws) {
        const b = v[1], want = raws[0] === '>';
        function holds(x) { const l = Math.pow(A, x); return s === '<' ? l < rn : l > rn; }
        return holds(b + 1) === want && holds(b - 1) === !want;
      },
      hint: '両辺を 底 ' + p + ' の累乗で表そう。底 ' + p + ' は 1 より大きいので 指数の大小は そのまま',
      explain: [(e === 1 ? '' : base + ' = ' + lhs + '、') + rhs + ' = ' + p + '^{' + j + '} より ' + lhs + ' ' + s + ' ' + p + '^{' + j + '}',
        '底 ' + p + ' は 1 より大きいから ' + (e === 1 ? '' : e === 2 ? '2' : '-') + 'x ' + s + ' ' + j, 'x ' + sa + ' ' + am(val)],
      mistakes: U.mistakes(ans, mis, [])
    };
  }
};
types['maou-log-ineq'] = {
  name: '対数不等式(真数条件)', level: 4,
  gen: function (R) {
    const a = R.pick([2, 3]), k = R.int(1, 3), c = R.pick([-3, -2, -1, 1, 2, 3, 4]), inv = R.chance(0.4), N = pw(a, k), lo = c, hi = c + N;
    const xm = c > 0 ? 'x - ' + c : 'x + ' + (-c), bs = inv ? 1 / a : a;
    const expr = inv ? 'log_{{1/' + a + '}} (' + xm + ') > -' + k : 'log_{' + a + '} (' + xm + ') < ' + k, ans = [String(lo), String(hi)];
    const mis = [{ answers: ['0', String(hi)], tag: 'log-domain', msg: '真数は正:' + xm + ' > 0、つまり x > ' + lo + ' だよ' },
      { answers: [String(lo), String(N)], tag: 'log-eq-shift', msg: xm + ' < ' + N + '。移項を 忘れていないかな?' },
      { answers: [String(lo), String(c + a * k)], tag: 'log-def', msg: 'log_a M < k は M < a^k だよ(a × k ではない)' }];
    if (inv) mis.push({ answers: [String(lo), F(c * N + 1, N)], tag: 'neg-exp', msg: '({1/' + a + '})^{-' + k + '} = ' + a + '^' + k + ' = ' + N + '。マイナス乗に注意' });
    return {
      text: 'つぎの不等式を解け。', expr: expr, form: '□ < x < □', answers: ans, keys: ['分数'],
      verify: function (v) {
        function holds(x) { if (x - c <= 0) return false; const l = Math.log(x - c) / Math.log(bs); return inv ? l > -k : l < k; }
        return holds((v[0] + v[1]) / 2) && holds(v[0] + 1e-6) && holds(v[1] - 1e-6) && !holds(v[1] + 0.5) && !holds(v[0] - 0.5) && !holds(v[0]);
      },
      hint: 'まず 真数条件 ' + xm + ' > 0。' + (inv ? '底が 1 より小さいので、不等号の向きが 逆になる' : '底が 1 より大きいので、向きは そのまま'),
      explain: ['真数は正より ' + xm + ' > 0、つまり x > ' + lo,
        inv ? '底 {1/' + a + '} は 1 より小さいから 向きが変わり ' + xm + ' < ({1/' + a + '})^{-' + k + '} = ' + N : '底 ' + a + ' は 1 より大きいから ' + xm + ' < ' + a + '^' + k + ' = ' + N,
        'あわせて ' + lo + ' < x < ' + hi],
      mistakes: U.mistakes(ans, mis, [])
    };
  }
};

/* ==================== 隠し:失われた公式の地下迷宮(考査範囲外) ==================== */
types['half-angle'] = {
  name: '半角の公式', level: 5,
  gen: function (R) {
    const v = R.pick([[3, 5], [-3, 5], [1, 3], [-1, 3], [1, 4], [-1, 4], [7, 9], [-7, 9], [1, 9], [3, 4], [1, 2], [-1, 2]]), p = v[0], q = v[1], isSin = R.chance(0.5);
    const ans = F(isSin ? q - p : q + p, 2 * q), th = Math.acos(p / q), fn = isSin ? 'sin' : 'cos', sg = isSin ? '-' : '+';
    return {
      text: 'cos θ = ' + am(F(p, q)) + ' のとき、つぎの値を求めよ。', expr: fn + '^2 {θ/2}', form: '□', answers: [ans], keys: ['分数'],
      num: [Math.pow(isSin ? Math.sin(th / 2) : Math.cos(th / 2), 2)],
      hint: '半角の公式:sin^2 {θ/2} = {1 - cos θ/2}、cos^2 {θ/2} = {1 + cos θ/2}',
      explain: ['半角の公式 ' + fn + '^2 {θ/2} = {1 ' + sg + ' cos θ/2}', '= (1 ' + sg + ' ' + par(p, q) + ') ÷ 2', '= ' + am(ans)],
      mistakes: U.mistakes([ans], [
        { answers: [F(isSin ? q + p : q - p, 2 * q)], tag: 'half-sign', msg: 'sin^2 は 1 - cos θ、cos^2 は 1 + cos θ だよ' },
        { answers: [F(isSin ? q - p : q + p, q)], tag: 'half-2', msg: '半角の公式は 2 で割るよ' }])
    };
  }
};
types['triple'] = {
  name: '3倍角の公式', level: 5,
  gen: function (R) {
    const v = R.pick([[1, 3], [2, 3], [1, 4], [3, 4], [1, 2], [1, 5], [2, 5]]), p = v[0], q = v[1], isSin = R.chance(0.5), q3 = q * q * q, a3 = 3 * p * q * q, b4 = 4 * p * p * p;
    const n = isSin ? a3 - b4 : b4 - a3, ans = F(n, q3), fn = isSin ? 'sin' : 'cos', x = am(F(p, q));
    return {
      text: fn + ' θ = ' + x + ' のとき、つぎの値を求めよ。', expr: fn + ' 3θ', form: '□', answers: [ans], keys: ['分数'],
      num: [isSin ? Math.sin(3 * Math.asin(p / q)) : Math.cos(3 * Math.acos(p / q))],
      hint: isSin ? 'sin 3θ = 3 sin θ - 4 sin^3 θ' : 'cos 3θ = 4 cos^3 θ - 3 cos θ',
      explain: [isSin ? 'sin 3θ = 3 sin θ - 4 sin^3 θ' : 'cos 3θ = 4 cos^3 θ - 3 cos θ',
        isSin ? '= 3·' + x + ' - 4·(' + x + ')^3 = ' + am(F(a3, q3)) + ' - ' + am(F(b4, q3)) : '= 4·(' + x + ')^3 - 3·' + x + ' = ' + am(F(b4, q3)) + ' - ' + am(F(a3, q3)), '= ' + am(ans)],
      mistakes: U.mistakes([ans], [
        { answers: [F(-n, q3)], tag: 'triple-sign', msg: 'sin は 3s - 4s^3、cos は 4c^3 - 3c。引く順番が 逆だよ' },
        { answers: [F(isSin ? 4 * p * q * q - 3 * p * p * p : 3 * p * p * p - 4 * p * q * q, q3)], tag: 'triple-coef', msg: '係数の 3 と 4 の位置を 確かめよう(3 は 1乗、4 は 3乗の項)' },
        { answers: [F(3 * p, q)], tag: 'triple-linear', msg: fn + ' 3θ は 3 ' + fn + ' θ ではないよ。3倍角の公式を使おう' }])
    };
  }
};
const WS = [   // [式, 答え, 公式, 途中式, 数値]
  ['sin 75° + sin 15°', '√6/2', 'sin A + sin B = 2 sin {A + B/2} cos {A - B/2}', '= 2 sin 45° cos 30° = 2·{√2/2}·{√3/2}', Math.sin(75 * RAD) + Math.sin(15 * RAD)],
  ['sin 75° - sin 15°', '√2/2', 'sin A - sin B = 2 cos {A + B/2} sin {A - B/2}', '= 2 cos 45° sin 30° = 2·{√2/2}·{1/2}', Math.sin(75 * RAD) - Math.sin(15 * RAD)],
  ['cos 15° + cos 75°', '√6/2', 'cos A + cos B = 2 cos {A + B/2} cos {A - B/2}', '= 2 cos 45° cos 30° = 2·{√2/2}·{√3/2}', Math.cos(15 * RAD) + Math.cos(75 * RAD)],
  ['cos 75° - cos 15°', '-√2/2', 'cos A - cos B = -2 sin {A + B/2} sin {A - B/2}', '= -2 sin 45° sin 30° = -2·{√2/2}·{1/2}', Math.cos(75 * RAD) - Math.cos(15 * RAD)],
  ['cos 105° - cos 15°', '-√6/2', 'cos A - cos B = -2 sin {A + B/2} sin {A - B/2}', '= -2 sin 60° sin 45° = -2·{√3/2}·{√2/2}', Math.cos(105 * RAD) - Math.cos(15 * RAD)],
  ['cos 75° cos 15°', '1/4', 'cos A cos B = {1/2}{cos(A + B) + cos(A - B)}', '= {1/2}(cos 90° + cos 60°) = {1/2}(0 + {1/2})', Math.cos(75 * RAD) * Math.cos(15 * RAD)],
  ['sin 75° sin 15°', '1/4', 'sin A sin B = -{1/2}{cos(A + B) - cos(A - B)}', '= -{1/2}(cos 90° - cos 60°) = -{1/2}(0 - {1/2})', Math.sin(75 * RAD) * Math.sin(15 * RAD)],
  ['sin 105° cos 75°', '1/4', 'sin A cos B = {1/2}{sin(A + B) + sin(A - B)}', '= {1/2}(sin 180° + sin 30°) = {1/2}(0 + {1/2})', Math.sin(105 * RAD) * Math.cos(75 * RAD)],
  ['cos 105° cos 15°', '-1/4', 'cos A cos B = {1/2}{cos(A + B) + cos(A - B)}', '= {1/2}(cos 120° + cos 90°) = {1/2}(-{1/2} + 0)', Math.cos(105 * RAD) * Math.cos(15 * RAD)]
];
types['wa-seki'] = {
  name: '和積・積和の公式', level: 5,
  gen: function (R) {
    const v = R.pick(WS), ans = v[1], other = { '√6/2': '√2/2', '√2/2': '√6/2', '-√6/2': '-√2/2', '-√2/2': '-√6/2', '1/4': '1/2', '-1/4': '-1/2' }[ans];
    return {
      text: 'つぎの値を求めよ。', expr: v[0], form: '□', answers: [ans], keys: ['√', '分数'], num: [v[4]],
      hint: v[2].replace(/\{cos\(A \+ B\) ([+-]) cos\(A - B\)\}/, '(cos(A + B) $1 cos(A - B))').replace(/\{sin\(A \+ B\) \+ sin\(A - B\)\}/, '(sin(A + B) + sin(A - B))'),
      explain: [v[2].replace(/\{(cos|sin)\(A \+ B\) ([+-]) (cos|sin)\(A - B\)\}/, '($1(A + B) $2 $3(A - B))'), v[3], '= ' + am(ans)],
      mistakes: U.mistakes([ans], [
        { answers: [neg(ans)], tag: 'wa-seki-sign', msg: '符号を確かめよう。cos A - cos B と sin A sin B の公式には マイナスがつくよ' },
        { answers: [other], tag: ans.indexOf('√') >= 0 ? 'wa-seki-pair' : 'wa-seki-half', msg: ans.indexOf('√') >= 0 ? '公式の sin と cos の組み合わせを 確かめよう' : '積和の公式は {1/2} がつくよ' }])
    };
  }
};

/* ==================== 隠し:深淵の塔(章末問題レベル) ==================== */
types['shin-exp-sub'] = {
  name: '置き換えを使う指数方程式', level: 5,
  gen: function (R) {
    const p = R.pick([2, 3]), P = p * p, px = p + '^x';
    function ok(b, c) { return function (v) { return v.every(function (x) { return Math.abs(Math.pow(P, x) + b * Math.pow(p, x) + c) < 1e-6; }); }; }
    if (R.chance(0.5)) {
      const u = R.int(0, 2), v = R.int(u + 1, 3), r1 = pw(p, u), r2 = pw(p, v), b = -(r1 + r2), c = r1 * r2, ans = [String(u), String(v)];
      return {
        text: 'つぎの方程式を解け。', expr: P + '^x' + term(b, px) + term(c) + ' = 0', form: 'x = □, □', answers: ans, unordered: [[0, 1]],
        verify: function (vals) { return vals[0] !== vals[1] && ok(b, c)(vals); },
        hint: P + '^x = (' + px + ')^2。' + px + ' = t(t > 0)と おいてみよう',
        explain: [px + ' = t(t > 0)とおくと t^2' + term(b, 't', false, '') + term(c) + ' = 0', '(t - ' + r1 + ')(t - ' + r2 + ') = 0 より t = ' + r1 + ', ' + r2, px + ' = ' + r1 + ', ' + r2 + ' より x = ' + u + ', ' + v],
        mistakes: U.mistakes(ans, [{ answers: [String(r1), String(r2)], tag: 'sub-back', msg: 'それは t の値。t = ' + px + ' に戻して x を求めよう' }], [[0, 1]])
      };
    }
    let u, m; do { u = R.int(0, 3); m = R.int(1, 5); } while (pw(p, u) === m);
    const r = pw(p, u), b = m - r, c = -m * r;
    return {
      text: 'つぎの方程式を解け。', expr: P + '^x' + term(b, px) + term(c) + ' = 0', form: 'x = □', answers: [String(u)], verify: ok(b, c),
      hint: px + ' = t とおく。t > 0 に 注意しよう',
      explain: [px + ' = t(t > 0)とおくと t^2' + term(b, 't', false, '') + term(c) + ' = 0', '(t - ' + r + ')(t + ' + m + ') = 0、t > 0 より t = ' + r, px + ' = ' + r + ' より x = ' + u],
      mistakes: U.mistakes([String(u)], [{ answers: [String(r)], tag: 'sub-back', msg: 'それは t の値。t = ' + px + ' に戻して x を求めよう' }])
    };
  }
};
types['shin-digits'] = {
  name: '常用対数と桁数', level: 5,
  gen: function (R) {
    const base = R.pick([2, 3]), L = base === 2 ? 3010 : 4771, n = R.pick([20, 25, 30, 40, 50, 60, 70, 80, 100]), v = n * L, k = Math.floor(v / 10000), dec = String(v / 10000);
    const lt = 'log_{10} ' + base + ' = 0.' + L, ans = String(k + 1);
    if (R.chance(0.6)) {
      return {
        text: base + '^{' + n + '} は 何桁の数か。ただし ' + lt + ' とする。', form: '□ 桁', answers: [ans], num: [String(BigInt(base) ** BigInt(n)).length],
        hint: 'log_{10} ' + base + '^{' + n + '} = ' + n + ' × log_{10} ' + base + ' を 計算しよう',
        explain: ['log_{10} ' + base + '^{' + n + '} = ' + n + ' × 0.' + L + ' = ' + dec, k + ' < ' + dec + ' < ' + (k + 1) + ' より 10^{' + k + '} < ' + base + '^{' + n + '} < 10^{' + (k + 1) + '}', 'よって ' + ans + ' 桁'],
        mistakes: [{ answers: [String(k)], tag: 'digits-plus1', msg: '10^{' + k + '} は ' + (k + 1) + ' 桁の数。' + k + ' ≦ log_{10} N < ' + (k + 1) + ' なら N は ' + (k + 1) + ' 桁だよ' },
          { answers: [String(k + 2)], tag: 'digits-plus1', msg: k + ' ≦ log_{10} N < ' + (k + 1) + ' なら N は ' + (k + 1) + ' 桁だよ' }]
      };
    }
    return {
      text: '({1/' + base + '})^{' + n + '} を小数で表すと、小数第何位に 初めて 0 でない数字が現れるか。ただし ' + lt + ' とする。', form: '小数第 □ 位', answers: [ans],
      num: [Math.floor(n * Math.log10(base)) + 1],
      hint: 'log_{10} ({1/' + base + '})^{' + n + '} = -' + n + ' × log_{10} ' + base + ' を 計算しよう',
      explain: ['log_{10} ({1/' + base + '})^{' + n + '} = -' + n + ' × 0.' + L + ' = -' + dec, '-' + (k + 1) + ' < -' + dec + ' < -' + k + ' より 10^{-' + (k + 1) + '} < ({1/' + base + '})^{' + n + '} < 10^{-' + k + '}', 'よって 小数第 ' + ans + ' 位'],
      mistakes: [{ answers: [String(k)], tag: 'digits-plus1', msg: '10^{-' + (k + 1) + '} は 小数第 ' + (k + 1) + ' 位に 初めて 1 が現れる数だよ' }]
    };
  }
};
types['shin-log-max'] = {
  name: '対数関数の最小値(置き換え)', level: 5,
  gen: function (R) {
    const a = R.pick([2, 3]), p = R.int(1, 3), c = R.int(-3, 5), k = p * p + c, lg = 'log_' + a + ' x', top = pw(a, 4), x = pw(a, p), ans = [String(x), String(c)];
    return {
      text: '1 ≦ x ≦ ' + top + ' のとき、関数 y が最小となる x と、その最小値を求めよ。', expr: 'y = (' + lg + ')^2' + term(-2 * p, lg, false, ' ') + term(k), form: 'x = □ のとき 最小値 □', answers: ans,
      verify: function (v) {
        let best = 1e9; for (let i = 0; i <= 4000; i++) { const t = i / 1000; best = Math.min(best, t * t - 2 * p * t + k); }
        const t0 = Math.log(v[0]) / Math.log(a);
        return v[0] >= 1 && v[0] <= top && close(t0 * t0 - 2 * p * t0 + k, v[1]) && Math.abs(v[1] - best) < 1e-9;
      },
      hint: lg + ' = t と おこう。1 ≦ x ≦ ' + top + ' のとき 0 ≦ t ≦ 4。あとは 2次関数',
      explain: [lg + ' = t とおくと 0 ≦ t ≦ 4、y = t^2' + term(-2 * p, 't', false, '') + term(k) + ' = (t - ' + p + ')^2' + term(c), 't = ' + p + ' で 最小値 ' + c, 'このとき x = ' + a + '^' + p + ' = ' + x],
      mistakes: U.mistakes(ans, [
        { answers: [String(p), String(c)], tag: 'sub-back', msg: 'それは t の値。t = ' + lg + ' から x = ' + a + '^t に 戻そう' },
        { answers: ['*', String(k)], tag: 'complete-square', msg: '平方完成して 頂点を求めよう(定数項が そのまま 最小値とは限らない)' }], [])
    };
  }
};

/* ==================== 敵のドット絵(16×16 / ボスは 24×24) ==================== */
const sprites = {
  puchisin: { rows: ['................', '................', '................', '................', '..BBB...........', '.BCCCB......BBB.', 'BCWKCCB....BCCCB', 'BCWKCCCB..BCCCCB',
    'BCCCCCCCBBCCCBCB', '.BCCBCCCCCCCB.B.', '..BB.BCCCCCB....', '......BCCCB.....', '.......BBB......', '................', '................', '................'] },
  nezumi: { mirror: true, rows: ['.gg.....', 'gPPg....', 'gPPg..gg', '.gggGGGG', '..gGGGGG', '..gGKGGG', '..gGGGGG', '..gGGGGP', '...gGGGG', '...gGGWW', '..gGGWWW', '..gGGWWW', '..gGGGWW', '...ggGGG', '..PP.ggg', '........'] },
  bat: { mirror: true, rows: ['........', 'p....K..', 'pp...KK.', 'ppp..vvv', 'pvpp.vvv', 'pvvpvWKv', 'pvvvvvvv', 'pvpvvvvv', 'p.pvvvWv', '..p.vvvv', '....vvv.', '.....vv.', '........', '........', '........', '........'] },
  kaeru: { mirror: true, rows: ['........', '........', '..lll...', '.lWWKl..', '.lWWKl.l', '.llllLLL', 'lLLLLLLL', 'lLLLLLLL', 'lLLRRRRR', 'lLLLRRRR', '.lLLLLLL', '.llLYYYY', 'lll.lYYY', 'll...lll', '........', '........'] },
  mogura: { mirror: true, rows: ['........', '........', '....nnnn', '...nNNNN', '..nNNNNN', '..nNKNNN', '..nNNNNP', '.nNNNNPP', '.nNNNNNN', 'GnNNNNNN', 'GGnNNNEE', 'GnNNNEEE', '..nNNEEE', '..nnNNEE', '...nnnnn', '........'] },
  mushi: { mirror: true, rows: ['...K....', '....K...', '.....KKK', '....KOOO', '...KOKOO', '...KOOOO', '..KKYYYY', '.K.KYOYY', '...KYYYY', '..KKOOOO', '.K.KOYOO', '...KOOOO', '..KKYYYY', '.K..KYYY', '.....KKK', '........'] },
  kinoko: { mirror: true, rows: ['........', '....RRRR', '..RRRWWR', '.RRWRRRR', '.RRRRRWW', 'RRWRRRRR', 'RRRRRRRR', '.rrrrrrr', '...EEEEE', '...EKEEE', '...EEEEE', '...EEERR', '....EEEE', '....EEEE', '...nnnnn', '........'] },
  hato: { mirror: true, rows: ['........', '.....ggg', '....gGGG', '....gGKG', '....gGGO', '...gGGGG', 'g.gGGGGK', 'gggGGGKW', 'gGgGGGKW', '.ggGGGGK', '..gGGGGG', '...gGGGG', '....gggg', '.....O..', '....OO..', '........'] },
  kani: { rows: ['................', '..W.........WWW.', '.WWW............', '..W..........R..', '..R.........R...', '..R..W..W..R....', '...R.K..K.R.....', '...RRRRRRRR.....',
    '..RRRRRRRRRR....', '..RRKRRRRKRR....', '..RRRRRRRRRR....', '...RRRRRRRR.....', '..r.r.rr.r.r....', '.r..r....r..r...', '................', '................'] },
  hebi: { mirror: true, rows: ['..ll....', '.lLLl...', '.lKLl...', '.lLLl...', '.lLLl...', '..lLl...', '..lLLl..', '...lLLll', '...lLLLL', '....lLLL', '..llllLL', '.lLLLLLL', '.lLLLLLL', '..llllll', '........', '........'] },
  ghost: { mirror: true, rows: ['........', '....WWWW', '..WWWWWW', '.WWWWWWW', '.WWWKKWW', 'WWWWKKWW', 'WWWWWWWW', 'WWWWWWWC', 'WWWWWWCC', 'WWWWWWWW', 'WWWWWWWW', 'WWCWWWWW', 'WCCWWWCW', 'W.CW.WCC', '........', '........'] },
  knight: { mirror: true, rows: ['.....GGG', '....GGGG', '....GKKK', '....GGGG', '.....GGG', '..GGGgGG', '.GGGGGgG', '.GGbGGGR', '.GGbGGRR', '.GG.GGGG', '.gg.GGGG', '....GG.G', '....GG.G', '....GG..', '...ggg..', '........'] },
  bolt: { mirror: true, rows: ['........', '...yyyyy', '..yYYYYY', '.yYYYKKK', '.yYYYKKK', '..yYYYYY', '...yyyyy', '.....ggg', '..GGGGGG', '.GGgGGGG', '.GG.GGGG', '.GG.GGGG', '....GG.G', '....GG.G', '...ggg..', '........'] },
  risu: { rows: ['................', '..........nnn...', '....n.n..nNNNn..', '...nNnNn.nNNNNn.', '...nNNNn..nNNNn.', '...NKNKN...nNNn.', '...NNNNN...nNNn.', '....NPN...nNNn..',
    '...nNNNn.nNNn...', '..nNEEENnNNn....', '..nNKKKNnNn.....', '..nNEEENnn......', '..nNNNNNn.......', '..nn...nn.......', '................', '................'] },
  ki: { mirror: true, rows: ['....dddd', '..ddllll', '.dllLlll', 'dllLllll', 'dlllllll', '.dllllll', '..ddlnnn', '....nNNN', '....nKNN', '....nNNN', '....nNKK', '....nNNN', '...nnNNN', '..nn.nNN', '.nn..nnN', '........'] },
  fukurou: { mirror: true, rows: ['...n....', '...nn...', '...nNNNN', '..nNWWWN', '..nNWKWN', '..nNWWWO', '.nNNNNNO', '.nNEEEEE', 'nNNEnEEE', 'nNNEEEnE', 'nNNEnEEE', '.nNEEEEE', '..nNNNNN', '....OO..', '........', '........'] },
  pierrot: { mirror: true, rows: ['.......Y', '......RR', '.....RRR', '....WWWW', '...WWKWW', '...WWWWR', '...WWWWW', '....WRRR', '..PPPPPP', '.BBBBRRR', '.BBYBRRR', '.BB.BRRR', '....BRRR', '....BB.R', '...KKK..', '........'] },
  heishi: { mirror: true, rows: ['.....nnn', '....nNNN', '....nNyN', '....nNNN', '....SSSS', '....SKSS', '....SSSS', '..nnNNNN', '.nNNNNyN', '.nN.NNNN', '.SS.NNyN', '....NNNN', '....nn.n', '....nn.n', '...KKK..', '........'] },
  robo: { mirror: true, rows: ['......K.', '......K.', '...ggggg', '..gGGGGG', '..gGTTGG', '..gGGGGG', '..gggggg', '.gGGGGGG', 'gGGKGGKK', 'gGGKGKGG', 'gGGKGKGG', 'gGGKGGKK', '.gGGGGGG', '..gg..gg', '..gg..gg', '........'] },
  lich: { mirror: true, rows: ['....vvvv', '...vvvvv', '..vvKKKK', '..vKWWWW', '..vKWKKW', '..vKWWWW', '..vvKWKW', '.vvvvKKK', '.vVVvvvv', 'vvVVVvvv', 'vVVVVVvY', 'vVV.VVVv', 'vV..VVVV', 'v..vVVVV', '...vvvvv', '........'] },
  kage: { mirror: true, rows: ['........', '.....vvv', '...vvvvv', '..vvvvRR', '..vvvvvv', '.vvRRvvv', '.vvRRvvv', '.vvvvvvv', 'vvvvvvvv', 'vvVvvvvv', 'vvvvvVvv', 'vVvvvvvv', 'v.vvv.vv', '..v.v..v', '........', '........'] },
  banpei: { mirror: true, rows: ['........', '....tttt', '..ttTTTT', '.tTTTTTT', '.tTTWWWW', 'tTTWWWKK', 'tTTWWKKK', 'tTTWWKKK', 'tTTWWWKK', '.tTTWWWW', '.tTTTTTT', '..ttTTTT', '....tttt', '..t..t..', '.t..t...', '........'] },
  b_dragon: { mirror: true, rows: ['............', '...Y........', '...YY.......', '....YY..KKKK', '....KYKKRRRR', '.....KRRRRRR', '....KRRWWRRR', '....KRRWKRRR', '....KRRRRRRR', '.KK.KRRRRRKK', 'KrrKKRRRRRRR', 'KrrrKKRRWRWR',
    'KrrrrKKRRRRR', 'KrrrrrKKKKKK', 'KrrKrrKOOOOO', 'KrK.KrKOOOOO', 'KK...KROOOOO', '....KRROOOOO', '....KRRROOOO', '...KRRRRRRRR', '...KRRRKKRRR', '..KRRRK..KRR', '..KYYYK..KYY', '..KKKKK..KKK'] },
  b_king: { mirror: true, rows: ['............', '..Y...Y....Y', '..YY.YYY..YY', '..YYYYYYYYYY', '..YRYYYBYYYR', '..YYYYYYYYYY', '...KSSSSSSSS', '...KSSWWKSSS', '...KSSWWKSSS', '...KSSSSSSSS', '...KWWSSSSKK', '...KWWWWWWWW',
    '..KKKWWWWWWW', '.KVVVKWWWWWW', 'KVVVVVKWWWWK', 'KVVCVVVKKKKV', 'KVCVCVVVVCVV', 'KVVVVCVVCVCV', 'KVVVVVCCVVVC', 'SKVVVVVVVVVV', '.KVVVVVVVVVV', '.KVVYYYYYYYY', '.KVVVVVVVVVV', '.KKKKKKKKKKK'] },
  b_forest: { mirror: true, rows: ['K...........', 'KK..K.......', '.KK.KK......', '..KKKK...K..', '...KNK..KK..', '...KNNKKNK..', '....KNNNNK..', '.....KNNK...', '....dddKdddd', '..ddlllldlll', '.dlllLllllll', 'dllLLlllllll',
    'dlllllWWllll', 'dlllllWKllll', 'dllLllllllll', '.dlllllllRRR', '.dlllLlllllR', '..ddllllllll', '....ddnnnnnn', '.....nNNNNNN', '.....nNNnNNN', '....nnNNnNNN', '...nnNNnnNNN', '..nnnnn.nnnn'] },
  b_mage: { mirror: true, rows: ['...........b', '..........bb', '.........bBB', '........bBBB', '.......bBBYB', '......bBBBBB', '.....bBBBBBB', '..bbbbbbbbbb', '.bBBBBBBBBBB', '..bbbbbbbbbb', '....KSSSSSSS', '....KSTKSSSS',
    '....KSSSSSSS', '....KWWWWSSS', '...KKWWWWWWW', '..KbbKWWWWWW', '.KbBBbKWWWWK', 'KbBBBBbKKKKb', 'KbBBYBBBBBBB', 'KbBBBBBBBYBB', 'SKbBBBYBBBBB', '.KbBBBBBBBBB', '.KbBBBBBYBBB', '.KKKKKKKKKKK'] },
  b_maou: { mirror: true, rows: ['.K..........', '.KK.........', '.KvK....KKKK', '..KvK..KvvvV', '..KvvKKvvVVV', '...KvvvvVVVV', '....KvVRRVVV', '....KvVRYVVV', '....KvVVVVVV', '....KvVVKVKV', '.....KvVVVVV', '..KKKKKvvvvv',
    '.KggggKKvvvG', 'KgGGGGgKKKGG', 'KgGGGGGgGGGY', 'KgGgGGGGGGGY', '.KgKgGGGYYYY', '.KvKKgGGGGGY', '.KvK.KgGGGGY', '.KRK.KgGGGGG', '.....KvvVVVV', '....KvvVKKVV', '...KvvVK..KV', '...KKKKK..KK'] },
  b_twin: { mirror: true, rows: ['............', '..K..K......', '..KK.KK.....', '..KTKKTK....', '.KTTTTTTK...', 'KTTWKTTTK...', 'KTTWWTTTK...', 'KTTTTTTTK...', 'KWTWTTTK....', '.KKKTTTK....', '...KTTTK....', '...KTTTTK...',
    '....KTTTK..K', '....KTTTTKKt', '.....KTTTTtt', '.....KTTTTTt', '....KKtTTTTT', '...KttKtTTTT', '..KttttKtTTT', '..KtttKKtTTT', '..KttK.KtTTT', '..KKK.KttTTT', '.....KYYtKYY', '.....KKKKKKK'] },
  b_abyss: { mirror: true, rows: ['............', '............', '.......KKKKK', '.....KKpppWW', '....KppppWWW', '...KppKKppWW', '..KppKWWKppp', '..KppKWKKppp', '..KpppKKpppp', '...KppppppRR', '....KKpppppp', '..KKKKKKpppK',
    '.KVVVVVVKKKV', 'KVVKKKVVVVVV', 'KVK...KVVVVK', 'KVK...KVVVK.', 'KVVKKKVVVVVK', '.KVVVVVVKKVV', '..KKKKKK..KV', '...........K', '....T......T', '...T.T....T.', '....T......T', '............'] }
};

/* ==================== 敵 ====================
 * level: 強さの目安レベル  hp: 何発で倒せるかの目安(1 = 目安レベルで1発)  atk: 反撃の強さの倍率 */
const Z = { level: 1, hp: 0.5, atk: 0.6 };
function zako(name, sprite, typesList, o) { return Object.assign({ name: name, sprite: sprite, types: typesList }, Z, o || {}); }
const enemies = {
  // 東の草原
  puchisin: zako('ぷちサイン', 'puchisin', [{ type: 'trig-value', opt: { f: 'sin' } }]),
  nezumi: zako('コサインねずみ', 'nezumi', [{ type: 'trig-value', opt: { f: 'cos' } }]),
  radbat: zako('ラジアンこうもり', 'bat', ['deg-rad']),
  kaeru: zako('タンジェントがえる', 'kaeru', [{ type: 'trig-value', opt: { f: 'tan' } }]),
  // 西の草原
  mogura: zako('ルートもぐら', 'mogura', ['sqrt-basic']),
  mushi: zako('るいじょう虫', 'mushi', ['pow-basic']),
  kinoko: zako('ログきのこ', 'kinoko', ['log-basic']),
  hato: zako('ゼロじょうバト', 'hato', [{ type: 'pow-basic', opt: { zero: true } }, 'log-basic']),
  // 加法定理の洞窟
  kani: zako('プラマイがに', 'kani', ['add-formula'], { level: 3, hp: 1, atk: 1 }),
  kahoubat: zako('かほうコウモリ', 'bat', ['add-value', 'add-formula'], { level: 4, hp: 1.2, atk: 1, swap: { p: 'O', v: 'r' } }),
  hebi: zako('ダブルアングルへび', 'hebi', ['double-value'], { level: 5, hp: 1.3, atk: 1 }),
  kahou: { name: '洞窟の主 カホウドラゴン', sprite: 'b_dragon', boss: true, level: 6, hp: 6, atk: 1.2, line: 'わが加法定理を 見破れるか!', types: ['add-value', 'double-value', 'add-formula'] },
  // 合成の塔
  ghost: zako('なみなみゴースト', 'ghost', ['gousei'], { level: 8, hp: 1, atk: 1 }),
  knight: zako('アルファ騎士', 'knight', ['gousei', 'gousei-max'], { level: 9, hp: 1.2, atk: 1 }),
  bolt: zako('ボルトナット兵', 'bolt', ['gousei-max', 'gousei-eq'], { level: 10, hp: 1.3, atk: 1 }),
  harmo: { name: '合成王ハーモニクス', sprite: 'b_king', boss: true, level: 11, hp: 6, atk: 1.2, line: 'sin と cos、ひとつに 束ねてみせよ!', types: ['gousei', 'gousei-max', 'gousei-eq'] },
  // 指数の森
  risu: zako('マイナスじょうリス', 'risu', ['exp-neg'], { level: 3, hp: 1, atk: 1 }),
  ki: zako('るいじょう根の木', 'ki', ['root', 'exp-rational'], { level: 4, hp: 1.2, atk: 1 }),
  fukurou: zako('ゆうりすうフクロウ', 'fukurou', ['exp-rational', 'exp-eq'], { level: 5, hp: 1.3, atk: 1 }),
  expo: { name: '森の主 エクスポネンタ', sprite: 'b_forest', boss: true, level: 6, hp: 6, atk: 1.2, line: '指数の森は 急に 深くなるぞ……!', types: ['exp-neg', 'exp-rational', 'exp-eq'] },
  // 対数の塔
  heishi: zako('ログ兵士', 'heishi', ['log-value'], { level: 10, hp: 1, atk: 1 }),
  pierrot: zako('ていへんかんピエロ', 'pierrot', ['log-prop-form', 'log-value'], { level: 11, hp: 1.2, atk: 1 }),
  robo: zako('じょうよう対数ロボ', 'robo', ['log-prop', 'log-eq'], { level: 12, hp: 1.3, atk: 1 }),
  loga: { name: '対数の魔術師ロガリズ', sprite: 'b_mage', boss: true, level: 14, hp: 7, atk: 1.2, line: '真数は 正……それを 忘れた者から 消えてゆく。', types: ['log-value', 'log-prop', 'log-eq'] },
  // 魔王の城(各エリアの上位種)
  g_hebi: zako('城の衛兵・ツインヘッド', 'hebi', ['double-value', 'maou-add-two'], { level: 20, hp: 1.2, atk: 1, swap: { l: 'r', L: 'R' } }),
  g_knight: zako('城の衛兵・ブラックアルファ', 'knight', ['gousei-eq', 'maou-gousei-range'], { level: 20, hp: 1.3, atk: 1, swap: { G: 'g', g: 'K', R: 'Y', b: 'R' } }),
  g_fukurou: zako('城の衛兵・ミッドナイトオウル', 'fukurou', ['exp-eq', 'maou-exp-ineq'], { level: 21, hp: 1.3, atk: 1, swap: { N: 'v', n: 'K', E: 'p' } }),
  g_robo: zako('城の衛兵・ログマシンMk2', 'robo', ['log-eq', 'maou-log-ineq'], { level: 21, hp: 1.4, atk: 1, swap: { G: 'R', g: 'r', T: 'Y' } }),
  maou: { name: '関数魔王グラフィード', sprite: 'b_maou', boss: true, level: 23, hp: 8, atk: 1.2, line: 'すべての関数は わが手の中に ある!',
    types: ['add-value', 'double-value', 'gousei-eq', 'exp-eq', 'log-prop', 'log-eq'],
    phase2: { name: '真・関数魔王グラフィード', line: 'ここからが 本当の 考査だ……!', swap: { v: 'r', V: 'R', G: 'g', g: 'K', R: 'Y' }, types: ['maou-add-two', 'maou-gousei-range', 'maou-exp-ineq', 'maou-log-ineq'] } },
  // 隠し
  lich: zako('ハーフアングル・リッチ', 'lich', ['half-angle'], { level: 25, hp: 1.2, atk: 1 }),
  kage: zako('さんばいかくの影', 'kage', ['triple', 'wa-seki'], { level: 26, hp: 1.3, atk: 1 }),
  twin: { name: '和積と積和の双子竜', sprite: 'b_twin', boss: true, level: 28, hp: 7, atk: 1.2, line: '和は積に、積は和に。われらは 二つで 一つ!', types: ['half-angle', 'triple', 'wa-seki'] },
  banpei: zako('深淵の番兵', 'banpei', ['shin-exp-sub', 'shin-digits'], { level: 26, hp: 1.3, atk: 1 }),
  infinity: { name: '深淵の王 インフィニティ', sprite: 'b_abyss', boss: true, level: 30, hp: 8, atk: 1.25, line: '……おまえの 限界は、どこに ある?', types: ['shin-exp-sub', 'shin-digits', 'shin-log-max'] }
};

/* ==================== マップ ==================== */
const maps = {
  town: {
    bgm: 'town',
    rows: [
      'TTTTTTTTTTTTTTT',
      'T,hhh.,.hhh.,.T',
      'T.hih...hch...T',
      'T..=.....=....T',
      'T..=======....T',
      'T.,....=...hhhT',
      'T......=...hphT',
      'T.k....=....=.T',
      'T......======.T',
      'T..v...=...,..T',
      'T.,....=......T',
      'TTTTTTTxTTTTTTT',
      'TTTTTTTTTTTTTTT'],
    legend: {
      i: { tile: 'wood', solid: true, npc: { pal: { 1: 'R', 2: 'N', h: 'y' } }, event: { type: 'inn' } },
      c: { tile: 'wood', solid: true, npc: { pal: { 1: 'W', 2: 'W', h: 'g' } }, event: { type: 'church' } },
      p: { tile: 'wood', solid: true, npc: { pal: { 1: 'l', 2: 'N', h: 'K' } }, event: { type: 'shop' } },
      k: { tile: 'grass', solid: true, npc: { pal: { 1: 'Y', 2: 'B', h: 'N' } }, event: { type: 'talk', lines: ['こども「東の草原は 三角関数、西の草原は 指数と対数の モンスターが 出るよ!」', 'こども「まちがえても 解説が 出るから、草原で 何回も 練習すると いいよ」'] } },
      v: { tile: 'grass', solid: true, npc: { pal: { 1: 'p', 2: 'g', h: 'W' } }, event: { type: 'talk', lines: ['長老「ダンジョンは 入るたびに 形が 変わる。やくそうを 忘れずにな」', '長老「ボスは 目安レベルに 届かぬうちは まず 勝てん。あせらず 草原で きたえるのじゃ」', '長老「4つの ダンジョンの 主を たおせば、北の 魔王の城の 封印が 解けるという……」'] } },
      x: { tile: 'road', event: { type: 'map', map: 'world', x: 16, y: 13 } }
    }
  },
  world: {
    bgm: 'field',
    rows: [
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^wwwwwwww^~~~~~~~~~~~^eeeeeeee^^',
      '^^Lwwwwwww^~~~~~M~~~~~^eeeeeeeG^^',
      '^^wwwwwwww^~~~~~=~~~~~^eeeeeeee^^',
      '^wwwwwwwww^~~~~~=~~~~~^eeeeeeeee^',
      '^wwwwwwwwww~~~~~=~~~~~eeeeeeeeee^',
      '^wwwwwTwwwwwwwww=eeeeeeeeeTeeeee^',
      '^wwTwwwwwwwwwwww=eeeeeeeeeeeeTee^',
      '^wwwwwwwwwTwwwww=eeTeeeeeeeeeeee^',
      '^wwwwwwwwwwwwwww=eeeeeeeeeeeeeee^',
      '^wwwwwwwwwwww...=...eeeeeeeeeeee^',
      '^wwwwwwwwwww...s=....eeeeeeTeeee^',
      '^wwwTwwwwwww....H....eeeeeeeeeee^',
      '^wwwwwwwwwww....=....eeeeeeeeeee^',
      '^wwwwwwwwwwww...=...eeeeeeeeeeee^',
      '^wwwwwwTwwwwwwww=eeeeeeeeTeeeeee^',
      '^wwwwwwwwwwwwwww=eeeeeeeeeeeeeee^',
      '^TTTwwwwwwwwwwww.eeeeeeeeeee^^^^^',
      '^TTTTwwwwwwwwwww.eeeeeeeeee^^^^^^',
      '^TTFwwwwwwwwwwww.eeeeeeeeeeeC^^^^',
      '^TTTTwwwwwwwwwww.eeeeeeeeee^^^^^^',
      '^TTTTTwwwwwwwwwTTeeeeeeeee^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^'],
    legend: {
      e: { tile: 'grass', zone: 'east' }, w: { tile: 'grass2', zone: 'west' },
      H: { tile: 'i_town', event: { type: 'map', map: 'town', x: 7, y: 10 } },
      C: { tile: 'i_cave', event: { type: 'dungeon', id: 'cave' } }, G: { tile: 'i_tower', event: { type: 'dungeon', id: 'tower' } },
      F: { tile: 'i_forest', event: { type: 'dungeon', id: 'forest' } }, L: { tile: 'i_tower', event: { type: 'dungeon', id: 'logtower' } },
      M: { tile: 'i_castle', event: { type: 'dungeon', id: 'castle' } },
      s: { tile: 'sign', solid: true, event: { type: 'sign', text: '【道しるべ】\n北:魔王の城 / 東:三角関数の草原(洞窟・合成の塔)\n西:指数・対数の草原(指数の森・対数の塔)' } }
    }
  }
};
const EXTRA4 = ['boss:kahou', 'boss:harmo', 'boss:expo', 'boss:loga'];
const dungeons = {
  cave: { name: '加法定理の洞窟', unit: '加法定理・2倍角', level: 3, theme: 'cave', boss: 'kahou',
    floors: [{ enemies: ['kani', 'kahoubat'] }, { enemies: ['kahoubat', 'hebi'] }],
    hidden: { need: ['boss:maou'], to: 'meikyu', openText: '加法定理の洞窟の 奥で、封印の扉が ひらく 音がした……。' } },
  tower: { name: '合成の塔', unit: '三角関数の合成', level: 8, theme: 'tower', boss: 'harmo',
    floors: [{ enemies: ['ghost'] }, { enemies: ['ghost', 'knight'] }, { enemies: ['knight', 'bolt'] }] },
  forest: { name: '指数の森', unit: '0・負の指数、累乗根、有理数の指数、指数方程式', level: 3, theme: 'forest', boss: 'expo',
    floors: [{ enemies: ['risu', 'ki'] }, { enemies: ['ki', 'fukurou'] }] },
  logtower: { name: '対数の塔', unit: '対数の定義と性質、対数方程式', level: 10, theme: 'tower', boss: 'loga',
    floors: [{ enemies: ['heishi'] }, { enemies: ['heishi', 'pierrot'] }, { enemies: ['pierrot', 'robo'] }],
    hidden: { need: ['boss:maou'], to: 'shinen', openText: '対数の塔の 最上階に、さらに上へ つづく 階段が あらわれた らしい……。' } },
  castle: { name: '魔王の城', unit: '全範囲の総合(考査本番レベル)', level: 20, theme: 'castle', boss: 'maou',
    need: EXTRA4, needText: '城門は 4つの封印で とざされている。\n4つの ダンジョンの ボスを すべて たおすと ひらくようだ。', openText: '4つの封印が 解けた! 北の 魔王の城の 門が ひらいた!',
    floors: [{ enemies: ['g_hebi', 'g_fukurou'] }, { enemies: ['g_knight', 'g_robo'] }, { enemies: ['g_hebi', 'g_knight', 'g_fukurou', 'g_robo'] }] },
  meikyu: { name: '失われた公式の地下迷宮', unit: '半角・3倍角・和積・積和の公式', level: 25, theme: 'meikyu', boss: 'twin', extra: true,
    floors: [{ enemies: ['lich'] }, { enemies: ['lich', 'kage'] }] },
  shinen: { name: '深淵の塔・最上階', unit: '指数・対数の章末問題レベル', level: 26, theme: 'abyss', boss: 'infinity', extra: true,
    floors: [{ enemies: ['banpei'] }] }
};

M.registerCourse({
  id: 'suu2-2gakki-kimatsu',
  title: '数学II 2学期期末クエスト',
  subtitle: '加法定理 〜 指数関数・対数関数',
  start: { map: 'town', x: 7, y: 9 },
  intro: ['ここは はじまりの町。', '{n}は 期末考査という 大いなる試練に そなえ、旅に 出ることに した。',
    '町の南から 外に出よう。東の草原は 三角関数、西の草原は 指数・対数の 修行場だ。\n(十字キーで歩く / A:しらべる・決定 / B:メニュー)'],
  levelCap: { base: 30, extended: 40, extendFlag: 'boss:maou' },
  zones: { east: { enemies: ['puchisin', 'nezumi', 'radbat', 'kaeru'] }, west: { enemies: ['mogura', 'mushi', 'kinoko', 'hato'] } },
  maps: maps, dungeons: dungeons, enemies: enemies, sprites: sprites, types: types,
  titles: {
    level: [{ lv: 1, name: '見習い計算工' }, { lv: 5, name: '角度の旅人' }, { lv: 10, name: '加法定理の使い手' }, { lv: 15, name: '合成の職人' }, { lv: 20, name: '指数の探究者' },
      { lv: 25, name: '対数の賢者' }, { lv: 30, name: '数学IIの勇者' }, { lv: 35, name: '公式を統べる者' }, { lv: 40, name: '伝説の一級数学技士' }],
    special: [
      { id: 'cave', name: '洞窟の主を倒しし者', cond: { boss: 'kahou' } }, { id: 'tower', name: '塔をきわめし者', cond: { boss: 'harmo' } },
      { id: 'forest', name: '森の守り手', cond: { boss: 'expo' } }, { id: 'log', name: '対数の扉を開きし者', cond: { boss: 'loga' } },
      { id: 'maou', name: '数学IIの覇者', cond: { boss: 'maou' } }, { id: 'meikyu', name: '禁断の公式を解き明かす者', cond: { boss: 'twin' } },
      { id: 'shinen', name: '深淵を見た数学技士', cond: { boss: 'infinity' } }, { id: 'combo10', name: '十連撃の達人', cond: { combo: 10 } },
      { id: 'streak7', name: '毎日の求道者', cond: { streak: 7 } }]
  }
});
})();

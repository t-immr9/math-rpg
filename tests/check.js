/* ============================================================
 * tests/check.js — 自動テスト     実行: node tests/check.js
 *   0. 止まらないこと(別プロセスで 型ごとに 20000 問・階ごとに 2000 回。時間切れなら 場所を報告)
 *   1. エンジンの判定・数式表示・図(SVG)・新しい入力(選ぶ/並べ替え/不等式/小数)・記録のことば・こわれたデータへの そなえ
 *   2. すべての問題の型(各 400 問): 正解・表示・誤答データ
 *   3. ダンジョン生成(1200 回 × 3 階)と 隠し通路
 *   4. コースのデータ(マップ・敵・ドット絵・称号・強さのバランス)
 * courses/ にあるコースを すべて検査する。
 * ============================================================ */
'use strict';
const fs = require('fs'), path = require('path');
const M = require('../engine.js');
const dir = path.join(__dirname, '..', 'courses');
fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => require(path.join(dir, f)));
const U = M.util, D = M.dungeon, R = M.rules;

/* 「止まらないこと」の確認は 別プロセスで 最初に行う(終わらないループがあっても、時間切れで 打ち切って 場所を報告できる) */
const { spawnSync } = require('child_process');
const FUZZ_TYPES = 20000, FUZZ_FLOORS = 2000;       // 型ごとの問題数、階ごとの生成回数
function runFuzz() {
  const post = m => fs.appendFileSync(process.argv[3], JSON.stringify(m) + '\n'), now = () => Number(process.hrtime.bigint()) / 1e6;
  const seeds = U.makeRng(20261114);
  Object.keys(M.courses).forEach(function (cid) {
    const C = M.courses[cid], refs = Object.keys(C.types);
    Object.keys(C.enemies).forEach(id => { const E = C.enemies[id]; E.types.concat(E.phase2 ? E.phase2.types : []).forEach(r => { if (typeof r !== 'string') refs.push(r); }); });
    refs.forEach(function (ref) {
      const label = cid + ' 型 ' + (typeof ref === 'string' ? ref : ref.type + JSON.stringify(ref.opt));
      post({ start: label });
      let max = 0, total = 0, errs = 0, bad = 0, first = '';
      for (let i = 0; i < FUZZ_TYPES; i++) {
        const seed = Math.floor(seeds.next() * 4294967296), t0 = now(); let q = null;
        try { q = M.buildQuestion(C, ref, U.makeRng(seed)); } catch (e) { errs++; first = first || 'seed ' + seed + ': ' + e.message; }
        const dt = now() - t0; total += dt; if (dt > max) max = dt;
        if (q) { const e = M.checkQuestion(q); if (e) { bad++; first = first || 'seed ' + seed + ': ' + e; } }
      }
      post({ done: label, kind: 'type', n: FUZZ_TYPES, max: max, avg: total / FUZZ_TYPES, errs: errs, bad: bad, first: first });
    });
    Object.keys(C.dungeons).forEach(function (did) {
      const d = C.dungeons[did];
      for (let fl = 0; fl < d.floors.length; fl++) {
        const label = cid + ' ダンジョン ' + did + ' ' + (fl + 1) + '階';
        post({ start: label });
        let max = 0, total = 0, errs = 0, bad = 0, safe = 0, pmax = 0, first = '';
        for (let i = 0; i < FUZZ_FLOORS; i++) {
          const entry = Math.floor(seeds.next() * 2147483647), t0 = now(); let f = null;
          try { f = D.genFloor(D.floorSeed(entry, fl)); } catch (e) { errs++; first = first || 'seed ' + entry + ': ' + e.message; }
          const dt = now() - t0; total += dt; if (dt > max) max = dt;
          if (!f) continue;
          if (f.safe) safe++;
          const dist = D.bfs(f.grid, f.start);
          if (dist[f.exit.y][f.exit.x] <= 0 || f.chests.some(c => dist[c.y][c.x] <= 0)) { bad++; first = first || 'seed ' + entry + ': 階段か宝箱に 行けない'; }
          const t1 = now(), solid = (x, y) => D.isSolid(f.grid[y][x]);
          const r = M.path.find(f.w, f.h, solid, f.start, f.exit, (x, y) => f.grid[y][x] === D.T.NEXT), r2 = M.path.find(f.w, f.h, solid, f.start, { x: 0, y: 0 });
          pmax = Math.max(pmax, now() - t1);
          if (r.goal.x !== f.exit.x || r.goal.y !== f.exit.y || solid(r2.goal.x, r2.goal.y)) { bad++; first = first || 'seed ' + entry + ': 道探しが 階段に着かない'; }
        }
        post({ done: label, kind: 'floor', n: FUZZ_FLOORS, max: max, avg: total / FUZZ_FLOORS, errs: errs, bad: bad, safe: safe, pmax: pmax, first: first });
      }
    });
  });
  post({ end: true });
}
if (process.argv[2] === '--fuzz') { runFuzz(); return; }

let fails = 0, checks = 0;
const seen = {};
function ok(cond, msg) {
  checks++;
  if (cond) return true;
  fails++;
  const key = msg.replace(/\d+/g, '#');
  seen[key] = (seen[key] || 0) + 1;
  if (seen[key] <= 3) console.log('  ✗ ' + msg);
  return false;
}
function section(name) { console.log('\n■ ' + name); }
function tryDo(msg, fn) { try { return fn(); } catch (e) { ok(false, msg + ' → ' + e.message); return undefined; } }

/* HTML が くずれていないか(タグの対応、マークアップ記号の残り) */
function htmlOk(html) {
  const stack = [], re = /<(\/?)([a-z]+)[^>]*?(\/?)>/g; let m;
  while ((m = re.exec(html))) {
    if (m[2] === 'br' || m[2] === 'path' || m[3] === '/') continue;
    if (m[1]) { if (stack.pop() !== m[2]) return 'タグの対応が おかしい'; } else stack.push(m[2]);
  }
  if (stack.length) return 'タグが 閉じていない';
  const text = html.replace(/<[^>]*>/g, '');
  if (/[{}^_□]/.test(text)) return 'マークアップの記号が 残っている: ' + text;
  if (/undefined|NaN|null|\[object/.test(text)) return '表示に undefined / NaN などが まじっている: ' + text;
  return null;
}
function renderOk(label, src, withBlanks) {
  if (typeof src !== 'string' || !src.length) return ok(false, label + ' が 空');
  const html = tryDo(label + ' の表示「' + src + '」', () => U.mathHTML(src, withBlanks === true));
  if (html === undefined) return false;
  const e = htmlOk(html);
  return ok(!e, label + '「' + src + '」: ' + e);
}
/* 図(SVG)が くずれていないか: タグの対応、NaN など、枠の外への はみ出し */
function figOk(svg) {
  if (typeof svg !== 'string') return '図が 作れない';
  const e = htmlOk(svg); if (e) return e;
  if (/NaN|Infinity/.test(svg)) return '図に 計算できない数がある';
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg); if (!vb) return 'viewBox がない';
  const W = +vb[1], H = +vb[2]; let bad = null;
  if (!(W === 300 && H >= 20 && H <= 260)) return '図の大きさが おかしい(' + W + '×' + H + ')';
  svg.replace(/ (x|x1|x2|cx|y|y1|y2|cy)="(-?[\d.]+)"/g, function (m, k, v) { const lim = /y/.test(k) ? H : W; if (+v < -1 || +v > lim + 1) bad = k + '=' + v; return m; });
  svg.replace(/ points="([^"]*)"/g, function (m, list) { list.split(' ').forEach(function (pr) { const q = pr.split(','); if (+q[0] < -1 || +q[0] > W + 1 || +q[1] < -1 || +q[1] > H + 1) bad = 'points ' + pr; }); return m; });
  return bad ? '図が 枠の外に はみ出している(' + bad + ')' : null;
}
/* 順列を すべて作る */
function perms(n) { const out = []; (function rec(rest, acc) { if (!rest.length) return out.push(acc); rest.forEach((x, i) => rec(rest.slice(0, i).concat(rest.slice(i + 1)), acc.concat([x]))); })(Array.from({ length: n }, (_, i) => i), []); return out; }
/* その答えを キーで打てるか */
function typeable(raw, keys) {
  if (raw === '*') return true;
  if (raw === '-') return true;
  if (raw === '+' || raw === '<' || raw === '>') return keys.indexOf(raw) >= 0;
  if (raw.indexOf('/') >= 0 && keys.indexOf('分数') < 0) return false;
  if (raw.indexOf('√') >= 0 && keys.indexOf('√') < 0) return false;
  if (raw.indexOf('π') >= 0 && keys.indexOf('π') < 0) return false;
  if (raw.indexOf('.') >= 0 && keys.indexOf('.') < 0) return false;
  return raw.split('/').every(p => p.length >= 1 && p.length <= 6) && /^[-0-9√π/.]+$/.test(raw);
}

/* ---------- 0. 止まらないこと・時間がかかりすぎないこと(最初に行う) ---------- */
section('止まらないこと・時間がかかりすぎないこと(型ごとに ' + FUZZ_TYPES + ' 問、階ごとに ' + FUZZ_FLOORS + ' 回)');
(function () {
  const LIMIT = parseInt(process.env.MATHRPG_FUZZ_LIMIT || '120000', 10), SLOW_MS = 250, AVG_MS = 2;     // 全体で 120秒 かかったら 打ち切り。1回 250ms、平均 2ms を こえたら 失敗
  const tmp = path.join(require('os').tmpdir(), 'mathrpg-fuzz-' + process.pid + '.jsonl');   // 結果は 一時ファイルで 受け取る
  fs.writeFileSync(tmp, '');
  const res = spawnSync(process.execPath, [__filename, '--fuzz', tmp], { stdio: 'ignore', timeout: LIMIT });
  const out = fs.readFileSync(tmp, 'utf8'); try { fs.unlinkSync(tmp); } catch (e) { /* 消せなくても よい */ }
  let current = '(開始前)', ended = false, nType = 0, nFloor = 0, slowT = null, slowF = null, pmax = 0, safe = 0;
  out.split('\n').forEach(function (line) {
    let m; try { m = JSON.parse(line); } catch (e) { return; }
    if (m.start) { current = m.start; return; }
    if (m.end) { ended = true; return; }
    ok(m.errs === 0, m.done + ': 例外が出た(' + m.errs + ' 回) ' + m.first);
    ok(m.bad === 0, m.done + ': こわれた結果(' + m.bad + ' 回) ' + m.first);
    ok(m.max < SLOW_MS, m.done + ': 1回に ' + m.max.toFixed(1) + 'ms かかった');
    ok(m.avg < AVG_MS, m.done + ': 平均 ' + m.avg.toFixed(3) + 'ms');
    if (m.kind === 'type') { nType++; if (!slowT || m.max > slowT.max) slowT = m; }
    else {
      nFloor++; safe += m.safe; pmax = Math.max(pmax, m.pmax);
      ok(m.safe <= m.n / 100, m.done + ': 安全な階への 作り直しが 多すぎる(' + m.safe + ')'); ok(m.pmax < SLOW_MS, m.done + ': 道探しに ' + m.pmax.toFixed(1) + 'ms');
      if (!slowF || m.max > slowF.max) slowF = m;
    }
  });
  if (slowT) console.log('  型 ' + nType + ' 種類 × ' + FUZZ_TYPES + ' 問: いちばん遅い 1問 ' + slowT.max.toFixed(2) + 'ms(' + slowT.done + '、平均 ' + slowT.avg.toFixed(4) + 'ms)');
  if (slowF) console.log('  階 ' + nFloor + ' 個 × ' + FUZZ_FLOORS + ' 回: いちばん遅い 生成 ' + slowF.max.toFixed(2) + 'ms(' + slowF.done + '、平均 ' + slowF.avg.toFixed(4) + 'ms)、道探し 最大 ' + pmax.toFixed(2) + 'ms、安全な階への作り直し ' + safe + ' 回');
  if (!ended) {
    const why = res.error && res.error.code === 'ETIMEDOUT' ? LIMIT / 1000 + '秒たっても 終わらない(終わらないループの うたがい)' : 'とちゅうで 止まった(終了コード ' + res.status + ')';
    ok(false, why + ' → 止まった場所: ' + current);
    console.log('\n✗ 止まる場所があるため、ほかの検査は 行いません(' + current + ' を 先に直してください)');
    process.exit(1);
  }
})();

/* ---------- 1. エンジン ---------- */
section('エンジン: 答えの判定');
(function () {
  const q = { answers: ['√3/2'] };
  ok(U.judge(q, ['√3/2']).result === 'correct', '√3/2 は正解');
  ok(U.judge(q, ['2√3/4']).result === 'unsimplified', '2√3/4 は「約分しよう」');
  ok(U.judge(q, ['3/2√3']).result === 'unsimplified', '3/2√3 は「有理化しよう」');
  ok(U.judge(q, ['√12/4']).result === 'unsimplified', '√12/4 は「簡単にしよう」');
  ok(U.judge(q, ['1/2']).result === 'wrong', '1/2 は不正解');
  ok(U.judge(q, ['√']).result === 'invalid', '√ だけは 書き方の誤り');
  ok(U.judge({ answers: ['-√3/3'] }, ['-1/√3']).result === 'unsimplified', '-1/√3 は 有理化を促す');
  ok(U.judge({ answers: ['5π/6'] }, ['5π/6']).result === 'correct', '5π/6');
  ok(U.judge({ answers: ['5π/6'] }, ['10π/12']).result === 'unsimplified', '10π/12');
  ok(U.judge({ answers: ['0'] }, ['0']).result === 'correct', '0');
  ok(U.judge({ answers: ['0'] }, ['-0']).result === 'unsimplified', '-0');
  ok(U.judge({ answers: ['2'] }, ['4/2']).result === 'unsimplified', '4/2');
  ok(U.judge({ answers: ['6', '+', '2', '4'], unordered: [[0, 2]] }, ['2', '+', '6', '4']).result === 'correct', '順不同の正解');
  ok(U.judge({ answers: ['6', '-', '2', '4'], unordered: [] }, ['2', '-', '6', '4']).result === 'wrong', '引き算は順不同にしない');
  ok(U.judge({ answers: ['<', '-2'] }, ['<', '-2']).result === 'correct', '不等号つきの答え');
  ok(U.judge({ answers: ['<', '-2'] }, ['>', '-2']).result === 'wrong', '不等号の向きちがい');
  const j = U.judge({ answers: ['1/8'], mistakes: [{ answers: ['-8'], tag: 't', msg: 'm' }] }, ['-8']);
  ok(j.result === 'wrong' && j.mistake && j.mistake.tag === 't', 'よくある誤答を 見分ける');
  ok(!U.judge({ answers: ['1/8'], mistakes: [{ answers: ['-8'], tag: 't', msg: 'm' }] }, ['7']).mistake, '当てはまらない誤答は 診断なし');
  ok(U.fracStr(-6, 4) === '-3/2' && U.fracStr(4, 2) === '2' && U.fracStr(3, -6) === '-1/2', 'fracStr');
  ok(U.piStr(5, 6) === '5π/6' && U.piStr(2, 2) === 'π' && U.piStr(0, 3) === '0' && U.piStr(-3, 12) === '-π/4' && U.piStr(24, 12) === '2π', 'piStr');
  ok(Math.abs(U.parseValue('-2√3/3').num + 2 * Math.sqrt(3) / 3) < 1e-12, 'parseValue の数値');
})();
section('エンジン: 数式の表示');
(function () {
  ['sin 75° = {√6 + √2/4}', '2^{-3} = {1/8}', '8^{{2/3}}', '8^{-{2/3}}', '[3]√{27} = 3', 'log_2 8', 'log_{{1/2}} (x - 1) > -2', '□ sin(θ □ □)', '{√□ □ √□/□}', 'a\nb', '0 ≦ θ < 2π']
    .forEach(s => renderOk('見本', s, true));
  ok(U.mathHTML('□ に入る数').indexOf('class="blank"') < 0 && U.mathHTML('□ に入る数').indexOf('□') >= 0, '問題文の □ は 空欄にせず ただの文字で出す');
  ok(U.mathHTML('{1/2}').indexOf('class="mf"') >= 0, '分数は 縦に組む');
  ok(U.mathHTML('2^3').indexOf('<sup>3</sup>') >= 0, '指数は 上付き');
  ok(U.mathHTML('√3').indexOf('class="mr"') >= 0 && U.mathHTML('√3').indexOf('<svg') >= 0, '√ は 根号を描く');
  ok(U.mathHTML('[3]√8').indexOf('class="mi"') >= 0, '累乗根の 左肩の数');
  ok(U.mathHTML('-1').indexOf('−1') >= 0, '- は − で表示');
  ok(U.countBlanks('□ sin(θ □ □)') === 3 && (U.mathHTML('□ sin(θ □ □)', true).match(/class="blank"/g) || []).length === 3, '空欄の数');
  ok(U.fillForm('□ sin(θ □ □)', ['2', '-', 'π/6']) === '2 sin(θ - {π/6})', '答えを 式に はめる');
  let threw = false; try { U.mathHTML('{1/2'); } catch (e) { threw = true; } ok(threw, '} の不足は エラーにする');
})();

section('エンジン: 小数・選ぶ・並べ替え・不等式の答え');
(function () {
  ok(U.judge({ answers: ['7.5'] }, ['7.5']).result === 'correct' && U.judge({ answers: ['-0.87'] }, ['-0.87']).result === 'correct', '小数の答え');
  ok(U.judge({ answers: ['7.5'] }, ['7.50']).result === 'correct' && U.judge({ answers: ['7.5'] }, ['7.6']).result === 'wrong', '7.50 は 7.5 と同じ、7.6 は ちがう');
  ok(U.judge({ answers: ['0.5'] }, ['1/2']).result === 'correct' && U.judge({ answers: ['3'] }, ['3.0']).result === 'correct', '0.5 と 1/2、3 と 3.0 は 同じ値');
  ['3.', '.5', '1.5/2', '1/2.5', '1.5√2', '1.5π', '1.2.3'].forEach(r => ok(U.parseValue(r) === null, r + ' は 書き方の誤り'));
  ok(Math.abs(U.parseValue('-12.75').num + 12.75) < 1e-12, '小数の数値');
  // 選ぶ
  const qc = { input: 'choice', choice: [{ text: 'a', ok: false, tag: 't1', msg: 'm1' }, { text: 'b', ok: true }, { text: 'c', ok: false }] };
  ok(M.judgeAny(qc, [1]).result === 'correct' && M.judgeAny(qc, [0]).mistake.tag === 't1' && M.judgeAny(qc, [2]).result === 'wrong' && !M.judgeAny(qc, [2]).mistake, '選ぶ: 正解・診断つきの誤答・診断なしの誤答');
  ok(M.judgeAny(qc, [0, 1]).result === 'wrong' && M.judgeAny(qc, []).result === 'wrong', '選ぶ: 2つ選ぶ・何も選ばないは 不正解');
  const qm = { input: 'choice', multi: true, choice: [{ text: 'a', ok: true }, { text: 'b', ok: false }, { text: 'c', ok: true }] };
  ok(M.judgeAny(qm, [2, 0]).result === 'correct' && M.judgeAny(qm, [0]).mistake.tag === 'choice-missing' && M.judgeAny(qm, [0, 1, 2]).result === 'wrong', 'すべて選ぶ: 順番は問わない・足りない・多すぎる');
  // 並べ替え
  const qo = { input: 'order', order: ['p', 'q', 'r'], orderShow: [2, 0, 1], mistakes: [{ order: [0, 2, 1], tag: 'o', msg: 'm' }] };
  ok(M.judgeAny(qo, [0, 1, 2]).result === 'correct' && M.judgeAny(qo, [0, 2, 1]).mistake.tag === 'o' && M.judgeAny(qo, [1, 0, 2]).result === 'wrong' && M.judgeAny(qo, [0, 1]).result === 'wrong', '並べ替えの判定');
  ok(M.answerText(qo) === 'イ → ウ → ア', '並べ替えの正解の表示(' + M.answerText(qo) + ')');
  // 不等式
  const S = (kind, eq, a, b) => ({ input: 'ineq', sol: { kind: kind, eq: eq, a: a, b: b } }), I = (kind, eq, raws) => ({ kind: kind, eq: eq, raws: raws });
  ok(M.judgeAny(S('outside', false, '1', '3'), I('outside', false, ['1', '3'])).result === 'correct', 'x<1, 3<x');
  ok(M.judgeAny(S('outside', false, '1', '3'), I('outside', true, ['1', '3'])).result === 'wrong', '等号の有無が ちがえば 不正解');
  ok(M.judgeAny(S('outside', false, '1', '3'), I('between', false, ['1', '3'])).result === 'wrong', '内側と外側が 逆なら 不正解');
  ok(M.judgeAny(S('outside', false, '1', '3'), I('outside', false, ['3', '1'])).result === 'wrong', '値の順が 逆なら 不正解');
  ok(M.judgeAny(S('between', true, '-1/2', '√3'), I('between', true, ['-1/2', '√3'])).result === 'correct', '分数・根号の入った範囲');
  ok(M.judgeAny(S('between', true, '-1/2', '3'), I('between', true, ['-2/4', '3'])).result === 'unsimplified', '約分していない範囲は 入れ直し');
  ok(M.judgeAny(S('all'), I('all', false, [])).result === 'correct' && M.judgeAny(S('all'), I('none', false, [])).result === 'wrong', 'すべての実数 / 解なし');
  ok(M.judgeAny(S('except', false, '2'), I('except', false, ['2'])).result === 'correct' && M.judgeAny(S('except', false, '2'), I('outside', false, ['2', '2'])).result === 'correct', '2 以外のすべての実数 = x<2, 2<x');
  ok(M.judgeAny(S('point', false, '2'), I('point', true, ['2'])).result === 'correct' && M.judgeAny(S('point', false, '2'), I('between', true, ['2', '2'])).result === 'correct', 'x=2 = 2≦x≦2');
  ok(M.judgeAny(S('gt', true, '1/3'), I('gt', true, ['1/3'])).result === 'correct' && M.judgeAny(S('gt', true, '1/3'), I('lt', true, ['1/3'])).result === 'wrong', 'm≧1/3 と 向きちがい');
  ok(M.judgeAny(S('lt', false, '1'), I('lt', false, ['√'])).result === 'invalid', '書きかけは 書き方の誤り');
  const qi = Object.assign(S('outside', false, '1', '3'), { mistakes: [{ sol: { kind: 'between', a: '1', b: '3' }, tag: 'io', msg: 'm' }, { sol: { kind: 'all' }, tag: 'al', msg: 'm' }] });
  ok(M.judgeAny(qi, I('between', true, ['1', '3'])).mistake.tag === 'io' && M.judgeAny(qi, I('all', false, [])).mistake.tag === 'al' && !M.judgeAny(qi, I('between', false, ['0', '3'])).mistake, '不等式の よくある誤答');
  ok(M.sol.markup({ kind: 'outside', a: '1', b: '3' }) === 'x < 1, 3 < x' && M.sol.markup({ kind: 'between', eq: true, a: '-1/2', b: '3' }, 'm') === '-{1/2} ≦ m ≦ 3' && M.sol.markup({ kind: 'none' }) === '解なし', '不等式の表示');
  ok(M.sol.contains({ kind: 'outside', eq: true, a: '1', b: '3' }, 1) && !M.sol.contains({ kind: 'outside', a: '1', b: '3' }, 1) && M.sol.contains({ kind: 'except', a: '2' }, 5) && !M.sol.contains({ kind: 'except', a: '2' }, 2), '範囲に入るかどうか');
  // 問題にしたときの 並べ替え(毎回 変わる・種が同じなら同じ)
  const fake = { types: {
    c: { gen: () => ({ text: 't', choices: ['正解', '誤答1', '誤答2', '誤答3'], hint: 'h', explain: ['a', 'b'] }) },
    o: { gen: () => ({ text: 't', order: ['1つ目', '2つ目', '3つ目'], hint: 'h', explain: ['a', 'b'] }) },
    i: { gen: () => ({ text: 't', sol: { kind: 'between', a: '1', b: '3' }, hint: 'h', explain: ['a', 'b'] }) },
    badC: { gen: () => ({ text: 't', choices: ['同じ', '同じ'], hint: 'h', explain: ['a', 'b'] }) },
    badI: { gen: () => ({ text: 't', sol: { kind: 'between', a: '3', b: '1' }, hint: 'h', explain: ['a', 'b'] }) },
    badF: { gen: () => ({ text: 't', form: '□', answers: ['1'], fig: { type: 'geo', items: [{ t: 'circle', c: [0, 0], r: NaN }] }, hint: 'h', explain: ['a', 'b'] }) } } };
  const pos = {}, ord = {};
  for (let i = 0; i < 200; i++) {
    const c = M.buildQuestion(fake, 'c', U.makeRng(i)), o = M.buildQuestion(fake, 'o', U.makeRng(i));
    pos[c.choice.findIndex(x => x.ok)] = 1; ord[o.orderShow.join('')] = 1;
    ok(c.input === 'choice' && c.choice.filter(x => x.ok).length === 1 && c.choice.find(x => x.ok).text === '正解' && M.checkQuestion(c) === null, '選ぶ問題: 1つ目が正解・並べ替えても 正解は変わらない');
    ok(o.input === 'order' && o.orderShow.join('') !== '012' && M.checkQuestion(o) === null, '並べ替え問題: はじめから 正しい順では 出さない');
    ok(JSON.stringify(M.buildQuestion(fake, 'c', U.makeRng(i)).choice) === JSON.stringify(c.choice), '同じ種なら 同じ並び');
  }
  ok(Object.keys(pos).length === 4, '選択肢は 毎回 並べ替える(正解の位置が 4通り 出る)');
  ok(Object.keys(ord).length === 5, '並べ替えの 出し方が 5通り 出る');
  ok(M.buildQuestion(fake, 'i', U.makeRng(1)).input === 'ineq' && M.checkQuestion(M.buildQuestion(fake, 'i', U.makeRng(1))) === null, '不等式の問題');
  ['badC', 'badI', 'badF'].forEach(b => ok(typeof M.checkQuestion(M.buildQuestion(fake, b, U.makeRng(1))) === 'string' && M.safeQuestion(fake, [b], b, () => 1) === null, 'こわれた問題(' + b + ')は 出さない'));
})();

section('エンジン: 図(SVG)');
(function () {
  const G = M.geo, R = U.makeRng(77), fig = f => tryDo('図 ' + f.type, () => M.figure.svg(f));
  // 図形の計算
  for (let i = 0; i < 300; i++) {
    const c = [R.int(-5, 5), R.int(-5, 5)], r = R.int(1, 9), d1 = R.int(0, 359), p = G.on(c, r, d1), tl = G.tangentAt(c, p, 3, 4);
    ok(Math.abs(G.dist(c, p) - r) < 1e-9, '円周上の点');
    ok(Math.abs((tl[1][0] - tl[0][0]) * (p[0] - c[0]) + (tl[1][1] - tl[0][1]) * (p[1] - c[1])) < 1e-9 && Math.abs(G.dist(tl[0], p) - 3) < 1e-9 && Math.abs(G.dist(tl[1], p) - 4) < 1e-9, '接線は 半径に垂直');
    const P = G.on(c, r + R.int(1, 9), R.int(0, 359)), tf = G.tangentFrom(c, r, P);
    ok(tf && tf.every(t => Math.abs(G.dist(c, t) - r) < 1e-9 && Math.abs((t[0] - c[0]) * (t[0] - P[0]) + (t[1] - c[1]) * (t[1] - P[1])) < 1e-7), '外の点からの接線の接点');
    ok(G.tangentFrom(c, r, G.on(c, r * 0.5, d1)) === null, '円の中の点からは 接線が引けない');
    const a = G.on(c, r, d1), b = G.on(c, r, d1 + R.int(40, 140)), e = G.on(c, r, d1 + R.int(180, 320)), cc = G.circum(a, b, e);
    ok(cc && G.dist(cc.c, c) < 1e-7 && Math.abs(cc.r - r) < 1e-7, '3点を通る円');
    const ft = G.foot(P, a, b); ok(Math.abs((ft[0] - P[0]) * (b[0] - a[0]) + (ft[1] - P[1]) * (b[1] - a[1])) < 1e-7, '垂線の足');
    const mt = G.meet(a, e, b, P); if (mt) ok(Math.abs((mt[0] - a[0]) * (e[1] - a[1]) - (mt[1] - a[1]) * (e[0] - a[0])) < 1e-6, '2直線の交点');
    ok(Math.abs(G.angleDeg(c, G.on(c, 1, 10), G.on(c, 3, 10 + 73)) - 73) < 1e-9, '角の大きさ');
  }
  ok(G.circum([0, 0], [1, 1], [2, 2]) === null && G.meet([0, 0], [1, 1], [0, 1], [1, 2]) === null, '一直線上の3点・平行な2直線は null');
  // 図の種類ごと(数値を ランダムに変えても くずれない)
  for (let i = 0; i < 300; i++) {
    const c = [R.int(-20, 20), R.int(-20, 20)], r = R.int(1, 40) / 4, A = G.on(c, r, R.int(0, 359)), B = G.on(c, r, R.int(0, 359)), P = G.on(c, r * (1.2 + R.next() * 3), R.int(0, 359)), tf = G.tangentFrom(c, r, P), tl = G.tangentAt(c, A, r, r * 1.5);
    const svg = fig({ type: 'geo', items: [{ t: 'circle', c: c, r: r }, { t: 'seg', a: A, b: B, label: 'x', color: 'acc' }, { t: 'line', a: P, b: tf[0] }, { t: 'seg', a: P, b: tf[1], dash: true, label: R.int(1, 99), side: -1 },
      { t: 'seg', a: tl[0], b: tl[1] }, { t: 'poly', pts: [A, B, tf[0]], fill: true }, { t: 'angle', at: P, a: tf[0], b: tf[1], label: R.int(10, 170) + '°' }, { t: 'right', at: tf[0], a: c, b: P },
      { t: 'point', p: A, label: 'A', away: c }, { t: 'point', p: P, label: 'P', pos: 'ne' }, { t: 'point', p: c, label: 'O', dir: 200 }, { t: 'text', p: G.mid(A, B), s: 'ℓ' }] });
    const e = figOk(svg); ok(!e, '図 geo(円・接線・弦・三角形): ' + e);
    if (i === 0) ok((svg.match(/<circle/g) || []).length === 4 && (svg.match(/<line/g) || []).length === 4 && (svg.match(/<text/g) || []).length === 7 && svg.indexOf('stroke-dasharray') > 0, '図 geo: 部品が そろっている');
    const a2 = R.pick([1, -1, 0.5, 2]), p2 = R.int(-3, 3), q2 = R.int(-4, 4);
    const e2 = figOk(fig({ type: 'geo', view: [p2 - 4, -6, p2 + 4, 6], items: [{ t: 'axis', x: [p2 - 4, p2 + 4], y: [-6, 6] }, { t: 'curve', pts: G.parabola(a2, -2 * a2 * p2, a2 * p2 * p2 + q2, p2 - 4, p2 + 4), color: 'acc' }, { t: 'point', p: [p2, q2], label: '頂点', pos: q2 > 0 ? 'n' : 's' }] }));
    ok(!e2, '図 geo(放物線と軸): ' + e2);
    // 箱ひげ図
    const v = [R.int(-50, 50)]; for (let k = 0; k < 4; k++) v.push(v[k] + R.int(0, 30) / 2);
    const bs = fig({ type: 'boxplot', rows: [{ label: 'A組', v: v, out: [v[4] + R.int(1, 9)] }, { label: 'B組', v: v.map(x => x + 3) }], unit: '(点)' }), eb = figOk(bs); ok(!eb, '図 箱ひげ図: ' + eb);
    const xs = []; bs.replace(/<rect x="([\d.]+)"[^>]*width="([\d.]+)"/g, (m, x, w) => { xs.push(+x, +x + +w); return m; });
    ok(xs.length === 4 && xs[0] <= xs[1] + 1e-9 && Math.abs((xs[1] - xs[0]) - (xs[3] - xs[2])) < 0.3, '図 箱ひげ図: 箱の幅が Q3−Q1 に 比例する');
    ok(!figOk(fig({ type: 'boxplot', rows: [{ v: [10, 20, 30, 45, 60] }], axis: [0, 70, 10], minor: 5 })), '図 箱ひげ図: 目盛りを 指定');
    // 散布図・ヒストグラム・表
    const pts = []; for (let k = R.int(1, 30); k > 0; k--) pts.push([R.int(-100, 100) / 4, R.int(0, 1000) / 7]);
    const ss = fig({ type: 'scatter', pts: pts, xl: '数学(点)', yl: '英語(点)' }), es = figOk(ss); ok(!es, '図 散布図: ' + es);
    ok((ss.match(/<circle/g) || []).length === pts.length, '図 散布図: 点の数が データの数と同じ');
    const fr = []; for (let k = R.int(1, 12); k > 0; k--) fr.push(R.int(0, 40));
    const hs = fig({ type: 'hist', start: R.int(0, 9) * 10, width: R.pick([1, 5, 10, 0.5]), freqs: fr, xl: '(点)', yl: '(人)' }), eh = figOk(hs); ok(!eh, '図 ヒストグラム: ' + eh);
    const hts = []; hs.replace(/<rect [^>]*height="([\d.]+)"/g, (m, h) => { hts.push(+h); return m; });
    const mx = Math.max.apply(null, fr), hm = Math.max.apply(null, hts);
    ok(hts.length === fr.length && fr.every((f, k) => mx === 0 || Math.abs(hts[k] / (hm || 1) - f / mx) < 0.02), '図 ヒストグラム: 柱の高さが 度数に 比例する');
    const et = figOk(fig({ type: 'table', head: ['階級(点)', '度数(人)'], rows: fr.slice(0, 6).map((f, k) => [k * 10 + '以上 ' + (k * 10 + 10) + '未満', f]) })); ok(!et, '図 表: ' + et);
    // 見取り図
    [M.solids.cuboid(R.int(1, 9), R.int(1, 9), R.int(1, 9)), M.solids.prism(R.int(3, 6), R.int(1, 5), R.int(1, 9)), M.solids.pyramid(R.int(3, 6), R.int(1, 5), R.int(1, 9))].forEach(function (sd) {
      const sv = fig(Object.assign({}, sd, { mark: [sd.edges[R.int(0, sd.edges.length - 1)]], shade: [sd.faces[0]], segs: [[Object.keys(sd.verts)[0], Object.keys(sd.verts)[2]]] })), ev = figOk(sv);
      ok(!ev, '図 見取り図: ' + ev);
      ok((sv.match(/<text/g) || []).length === Object.keys(sd.verts).length && (sv.match(/<line/g) || []).length === sd.edges.length + 1, '図 見取り図: 頂点の名前と 辺が そろっている');
    });
  }
  const cube = M.figure.svg(M.solids.cuboid(4, 4, 4));
  ok((cube.match(/stroke-dasharray/g) || []).length === 3 && (cube.match(/<line/g) || []).length === 12 && 'ABCDEFGH'.split('').every(n => cube.indexOf('>' + n + '</text>') > 0), '立方体: 辺 12本のうち かくれた 3本が 破線、頂点 A〜H');
  const pr = M.solids.prism(3, 3, 5); ok(Object.keys(pr.verts).join('') === 'ADBECF' && pr.edges.length === 9 && pr.faces.length === 5, '三角柱 ABC-DEF: 辺 9、面 5');
  const py = M.solids.pyramid(4, 3, 5); ok(Object.keys(py.verts).length === 5 && py.edges.length === 8 && py.faces.length === 5, '四角錐: 頂点 5、辺 8、面 5');
  ['x', null, { type: 'nai' }, { type: 'geo', items: [{ t: 'nai' }] }, { type: 'scatter', pts: [[NaN, 1]] }, { type: 'solid', verts: { A: [0, 0, 0] }, edges: ['AZ'] }].forEach(function (b) {
    let threw = false; try { M.figure.svg(b); } catch (e) { threw = true; } ok(threw, 'こわれた図のデータは エラーにする(問題は 出さずに 作り直す)');
  });
  const ax = M.figure.niceAxis(3, 97, 5); ok(ax.lo === 0 && ax.hi === 100 && ax.step === 20 && ax.ticks.length === 6, 'きりのよい目盛り');
})();

section('エンジン: 開発用表示ではセーブしない');
(function () {
  const src = fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8');
  const sets = src.match(/localStorage\.(setItem|removeItem|clear)\(/g) || [];
  ok(sets.length === 1, 'localStorage に書くのは save() の1か所だけ(' + sets.length + ' か所)');
  ok(/function save\(\) \{ if \(!S \|\| DEV\) return;/.test(src), 'save() は 開発用表示(DEV)なら 何もしない');
  ok(/const DEV = \[[^\]]*'debug'[^\]]*'pad'[^\]]*\]\.some/.test(src), '&debug= や &pad= などがあれば DEV になる');
  ok(/\(DEV \? debugMain\(\) : main\(\)\)/.test(src), '開発用表示では セーブを読まない debugMain で始める');
  const dm = src.slice(src.indexOf('async function debugMain'), src.indexOf('requestAnimationFrame(frame);\n  (DEV'));
  ok(dm.length > 0 && dm.indexOf('load()') < 0 && dm.indexOf('localStorage') < 0, 'debugMain は セーブデータを 読み書きしない');
})();

section('エンジン: こわれた問題・こわれた階でも 止まらない');
(function () {
  // ダンジョン: 作り直しの上限に達したら「安全な階」になる
  const sf = D.genFloor(123, { tries: 0 }), sd = D.bfs(sf.grid, sf.start);
  ok(sf.safe === true && sd[sf.exit.y][sf.exit.x] > 0 && sf.chests.length === 1 && sd[sf.chests[0].y][sf.chests[0].x] > 0, '上限に達したら 安全な階(階段と宝箱に 行ける)');
  ok(sf.grid[sf.start.y][sf.start.x] === D.T.BACK && sf.grid[sf.exit.y][sf.exit.x] === D.T.NEXT, '安全な階にも 入口と 次の階段がある');
  let threw = false; try { D.genFloor(NaN); D.genFloor(-1); D.genFloor(1e15); D.genFloor(5, { w: 27, h: 21, tries: 3 }); } catch (e) { threw = true; }
  ok(!threw, 'ダンジョン生成は どんな種でも 例外を出さない');
  // 問題: 例外を出す型・□ が問題文にある型は 使わず、同じ敵の ほかの型にする
  const good = { text: 'つぎの値を求めよ。', expr: '2^3', form: '□', answers: ['8'], hint: 'h', explain: ['a', 'b'], mistakes: [] };
  const fake = { types: {
    boom: { gen: function () { throw new Error('boom'); } },
    blankText: { gen: function () { return Object.assign({}, good, { text: '□ に入る数を答えよ。' }); } },
    count: { gen: function () { return Object.assign({}, good, { form: '□ + □' }); } },
    badAns: { gen: function () { return Object.assign({}, good, { answers: ['8//2'] }); } },
    badMark: { gen: function () { return Object.assign({}, good, { explain: ['{1/2', 'b'] }); } },
    nothing: { gen: function () { return null; } },
    fine: { gen: function () { return Object.assign({}, good); } } } };
  let k = 0; const seedFn = () => ++k;
  ['boom', 'blankText', 'count', 'badAns', 'badMark', 'nothing'].forEach(function (bad) {
    let q = null, t = false; try { q = M.safeQuestion(fake, [bad, 'fine'], bad, seedFn); } catch (e) { t = true; }
    ok(!t && q && q.type === 'fine', 'こわれた型(' + bad + ')は とばして 別の型の問題にする');
    let q2 = 'x', t2 = false; try { q2 = M.safeQuestion(fake, [bad], bad, seedFn); } catch (e) { t2 = true; }
    ok(!t2 && q2 === null, 'こわれた型(' + bad + ')しかなければ null(戦闘は 安全に終わる)');
  });
  ok(M.checkQuestion(M.buildQuestion(fake, 'fine', U.makeRng(1))) === null, '正しい問題は 通る');
  ok(/□/.test(M.checkQuestion(M.buildQuestion(fake, 'blankText', U.makeRng(1))) || ''), '問題文の □ を 見つける');
  // 道探し: 囲まれている・盤の外・1マスだけ でも 止まらない
  const wall = (x, y) => !(x === 2 && y === 2);
  const r1 = M.path.find(5, 5, wall, { x: 2, y: 2 }, { x: 4, y: 4 });
  ok(r1.path.length === 0 && r1.goal.x === 2 && r1.goal.y === 2, '囲まれていたら その場に とどまる');
  const r2 = M.path.find(1, 1, () => false, { x: 0, y: 0 }, { x: 99, y: -99 });
  ok(r2.path.length === 0, '1マスだけの盤でも 止まらない');
  const r3 = M.path.find(40, 40, () => false, { x: 0, y: 0 }, { x: 1000, y: 1000 }, () => true);
  ok(r3.path.length <= 78 && r3.goal.x >= 0 && r3.goal.y >= 0, '盤の外をタップしても 盤の中で止まる');
})();

/* ---------- 2〜4. コースごと ---------- */
const ids = Object.keys(M.courses);
ok(ids.length > 0, 'コースが 1つ以上ある');
ids.forEach(function (cid) {
  const C = M.courses[cid];
  console.log('\n══════ コース: ' + cid + '(' + C.title + ') ══════');

  section('問題の型(各 400 問)');
  const usedTypes = {};
  Object.keys(C.enemies).forEach(id => { const E = C.enemies[id]; E.types.concat(E.phase2 ? E.phase2.types : []).forEach(r => { usedTypes[typeof r === 'string' ? r : r.type] = 1; }); });
  const refs = [];
  Object.keys(C.types).forEach(id => refs.push(id));
  Object.keys(C.enemies).forEach(id => { const E = C.enemies[id]; E.types.concat(E.phase2 ? E.phase2.types : []).forEach(r => { if (typeof r !== 'string') refs.push(r); }); });
  refs.forEach(function (ref) {
    const id = typeof ref === 'string' ? ref : ref.type, label = typeof ref === 'string' ? id : id + JSON.stringify(ref.opt);
    const t = C.types[id];
    if (!ok(!!t, '型 ' + id + ' が 定義されている')) return;
    ok(typeof t.name === 'string' && typeof t.level === 'number', label + ': name と level がある');
    if (typeof ref === 'string') ok(usedTypes[id], label + ': どの敵にも 使われていない');
    let withMistake = 0; const variety = {}, before = fails, kinds = {}, shown = {};
    for (let i = 0; i < 400 && fails - before < 6; i++) {
      const q = tryDo(label + ' #' + i + ' の生成', () => M.buildQuestion(C, ref, U.makeRng(1000 + i * 7919)));
      if (!q) continue;
      const tag = label + ' #' + i;
      renderOk(tag + ' text', q.text);
      if (q.expr !== undefined) renderOk(tag + ' expr', q.expr);
      const cq = M.checkQuestion(q);
      if (!ok(cq === null, tag + ': 画面に出せる形(' + cq + ')')) continue;
      renderOk(tag + ' hint', q.hint);
      ok(Array.isArray(q.explain) && q.explain.length >= 2 && q.explain.length <= 3, tag + ': 解説は 2〜3行');
      (q.explain || []).forEach((l, k) => renderOk(tag + ' 解説' + (k + 1), l));
      if (q.fig) { const fe = figOk(tryDo(tag + ' 図', () => M.figure.svg(q.fig))); ok(!fe, tag + ' 図: ' + fe); }
      ok(q.keys.length <= (q.input === 'ineq' ? 3 : 4) && q.keys.every(k => ['√', 'π', '分数', '+', '<', '>', '.'].indexOf(k) >= 0), tag + ': 追加キーは 4つまで(不等式は 3つまで)・決まった名前');
      renderOk(tag + ' 正解の表示', M.answerText(q));
      ok(M.judgeAny(q, M.correctInput(q)).result === 'correct', tag + ': 正解を入れると 正解になる');
      ok(M.judgeAny(q, M.wrongInput(q)).result === 'wrong', tag + ': まちがいを入れると 不正解になる');
      kinds[q.input] = 1;
      if (q.input === 'form') {
        if (!renderOk(tag + ' form', q.form, true)) continue;
        // 入力画面と同じ組み立てで、空欄の数が 答えの数と 同じ(ちがうと 入力画面が止まる)
        const ui = U.mathHTML(q.text) + (q.expr ? U.mathHTML(q.expr) : '') + U.mathHTML(q.form, true) + U.mathHTML(q.hint || '');
        ok((ui.match(/class="blank"/g) || []).length === q.answers.length, tag + ': 入力画面の空欄の数が 答えの数と ちがう');
        const vals = q.answers.map(U.parseValue);
        if (!ok(vals.every(v => v), tag + ': 答えの書き方が正しい ' + JSON.stringify(q.answers))) continue;
        ok(vals.every(v => v.simple), tag + ': 答えは 最も簡単な形 ' + JSON.stringify(q.answers));
        ok(q.answers.every(a => typeable(a, q.keys)), tag + ': 答えを キーで入力できる ' + JSON.stringify(q.answers) + ' keys=' + q.keys.join(''));
        // 正解の数値を、別の計算(Math の関数)と つきあわせる
        if (q.num) {
          ok(q.num.length === vals.length && q.num.every((x, k) => x === null || (isFinite(x) && Math.abs(vals[k].num - x) <= 1e-7 * Math.max(1, Math.abs(x)))),
            tag + ': 正解の値が 検算と合う ' + JSON.stringify(q.answers) + ' ≠ ' + JSON.stringify(q.num) + '  ' + (q.expr || q.form));
        } else if (q.verify) {
          ok(tryDo(tag + ' verify', () => q.verify(vals.map(v => v.num), q.answers)) === true, tag + ': 正解が 検算(verify)を通る ' + JSON.stringify(q.answers) + '  ' + (q.expr || q.form));
        } else ok(t.noNum === true, tag + ': num か verify が必要(公式の穴うめなどは noNum:true)');
        // よくある誤答
        if (q.mistakes.length) withMistake++;
        q.mistakes.forEach(function (m, k) {
          const mt = tag + ' 誤答' + (k + 1);
          if (!ok(m && Array.isArray(m.answers) && m.answers.length === q.answers.length && typeof m.tag === 'string' && m.tag && typeof m.msg === 'string', mt + ': answers・tag・msg がある')) return;
          renderOk(mt + ' ひとこと', m.msg);
          const full = m.answers.map((a, x) => a === '*' ? q.answers[x] : a);
          if (!ok(full.every(a => U.parseValue(a)), mt + ': 書き方が正しい ' + JSON.stringify(m.answers))) return;
          ok(m.answers.every(a => typeable(a, q.keys)), mt + ': キーで入力できる ' + JSON.stringify(m.answers));
          const r = U.judge(q, full).result;
          ok(r === 'wrong', mt + ': 正解と同じ値に なっている ' + JSON.stringify(m.answers) + ' (正解 ' + JSON.stringify(q.answers) + ')');
          if (r === 'wrong') { const jm = U.judge(q, full).mistake; ok(!!jm, mt + ': 入力すると 診断が出る'); }
        });
      } else if (q.input === 'choice') {
        const it = q.choice, okIdx = M.correctInput(q);
        shown[it.findIndex(c => c.ok) + ':' + it.map(c => c.text).join('|')] = 1;
        it.forEach(function (c, k) {
          renderOk(tag + ' 選択肢' + (k + 1), c.text);
          if (c.ok) return;
          const j = M.judgeAny(q, [k]);
          ok(j.result === 'wrong', tag + ': まちがいの選択肢「' + c.text + '」だけを選ぶと 不正解');
          if (c.tag) { ok(j.mistake && j.mistake.tag === c.tag && typeof c.msg === 'string' && c.msg.length > 0, tag + ': 選択肢「' + c.text + '」に ひとこと(msg)がある'); renderOk(tag + ' 選択肢のひとこと', c.msg); }
        });
        if (it.some(c => !c.ok && c.tag)) withMistake++;
        ok(M.judgeAny(q, it.map((_, k) => k)).result === 'wrong', tag + ': 全部選ぶと 不正解');
        if (q.multi) { if (okIdx.length > 1) ok(M.judgeAny(q, okIdx.slice(1)).result === 'wrong', tag + ': 一部だけ選ぶと 不正解'); }
        else ok(okIdx.length === 1, tag + ': 正解は 1つ(複数なら multi になる)');
        if (q.verify) ok(tryDo(tag + ' verify', () => q.verify()) === true, tag + ': 正解の選択肢が 検算(verify)を通る');
      } else if (q.input === 'order') {
        const n = q.order.length;
        shown[q.orderShow.join('')] = 1;
        q.order.forEach((x, k) => renderOk(tag + ' 手順' + (k + 1), x));
        if (n <= 5) perms(n).forEach(pm => ok((M.judgeAny(q, pm).result === 'correct') === pm.every((x, k) => x === k), tag + ': 正しい順だけが 正解'));
        if (q.mistakes.length) withMistake++;
        q.mistakes.forEach(function (m, k) {
          const mt = tag + ' 誤答' + (k + 1);
          if (!ok(Array.isArray(m.order) && typeof m.tag === 'string' && m.tag && typeof m.msg === 'string' && m.msg, mt + ': order・tag・msg がある')) return;
          renderOk(mt + ' ひとこと', m.msg);
          const j = M.judgeAny(q, m.order);
          ok(j.result === 'wrong' && !!j.mistake, mt + ': 正解と同じ順に なっている、または 診断が出ない');
        });
      } else {
        const sl = q.sol, vs = [sl.a, sl.b].filter(x => x !== undefined), nums = vs.map(x => U.parseValue(x).num);
        ok(vs.every(x => U.parseValue(x).simple && typeable(x, q.keys)), tag + ': 不等式の値は 最も簡単な形で、キーで入力できる ' + JSON.stringify(vs));
        const xs = [0, -1000, 1000, 0.123];
        nums.forEach(v => xs.push(v, v - 1e-6, v + 1e-6, v - 0.5, v + 0.5, v - 7, v + 7));
        if (nums.length === 2) xs.push((nums[0] + nums[1]) / 2);
        // 正解の範囲を、もとの不等式に 数を代入して 確かめる
        if (typeof q.inside === 'function') xs.forEach(x => ok(M.sol.contains(sl, x) === !!q.inside(x), tag + ': x = ' + x + ' が 答えの範囲に 入るかどうかが、もとの不等式と 合わない  ' + (q.expr || '') + ' → ' + M.answerText(q)));
        else ok(t.noNum === true, tag + ': 不等式の問題には inside(x)(もとの条件を 代入して確かめる関数)が必要');
        // ほかの形・等号の有無を 入れたとき、同じ範囲のときだけ 正解になる
        const a0 = vs[0] || '0', b0 = vs[1] || (Number.isInteger(nums[0] === undefined ? 0 : nums[0]) ? String((nums[0] === undefined ? 0 : nums[0]) + 1) : null);
        M.sol.shapes.forEach(k => [false, true].forEach(function (eq) {
          if (b0 === null && ['between', 'outside'].indexOf(k) >= 0) return;
          const inp = { kind: k, eq: eq, raws: ['between', 'outside'].indexOf(k) >= 0 ? [a0, b0] : ['all', 'none'].indexOf(k) >= 0 ? [] : [a0] };
          const mine = { kind: k, eq: eq, a: inp.raws[0], b: inp.raws[1] }, pts = xs.concat([U.parseValue(a0).num, b0 === null ? 0 : U.parseValue(b0).num, U.parseValue(a0).num + 1e-6, U.parseValue(a0).num - 1e-6]);
          const same = pts.every(x => M.sol.contains(mine, x) === M.sol.contains(sl, x));
          ok((M.judgeAny(q, inp).result === 'correct') === same, tag + ': 「' + M.sol.markup(mine, q.solVar) + '」の判定が おかしい(正解 ' + M.answerText(q) + ')');
        }));
        if (q.mistakes.length) withMistake++;
        q.mistakes.forEach(function (m, k) {
          const mt = tag + ' 誤答' + (k + 1);
          if (!ok(m.sol && typeof m.tag === 'string' && m.tag && typeof m.msg === 'string' && m.msg, mt + ': sol・tag・msg がある')) return;
          renderOk(mt + ' ひとこと', m.msg);
          const pickV = (x, d) => (x !== undefined && x !== '*') ? x : d;
          const inp = { kind: m.sol.kind, eq: m.sol.eq === undefined ? !!sl.eq : !!m.sol.eq, raws: [pickV(m.sol.a, a0), pickV(m.sol.b, b0 || '1')].slice(0, { between: 2, outside: 2, all: 0, none: 0 }[m.sol.kind] === undefined ? 1 : { between: 2, outside: 2, all: 0, none: 0 }[m.sol.kind]) };
          ok(inp.raws.every(x => typeable(x, q.keys)), mt + ': キーで入力できる ' + JSON.stringify(inp.raws));
          const j = M.judgeAny(q, inp);
          ok(j.result === 'wrong' && !!j.mistake, mt + ': 正解と同じ範囲に なっている、または 診断が出ない(' + M.sol.markup({ kind: inp.kind, eq: inp.eq, a: inp.raws[0], b: inp.raws[1] }) + ')');
        });
      }
      variety[(q.expr || '') + '|' + q.text + '|' + M.answerText(q) + '|' + (q.fig ? JSON.stringify(q.fig).length : '')] = 1;
    }
    if (kinds.choice) ok(Object.keys(shown).length >= 2, label + ': 選択肢の並びが 毎回 変わる');
    if (kinds.order) ok(Object.keys(shown).length >= 2, label + ': 並べ替えの 出し方が 毎回 変わる');
    ok(withMistake > 0, label + ': よくある誤答のデータが 1つもない');
    ok(Object.keys(variety).length >= 4, label + ': 問題の種類が 少なすぎる(' + Object.keys(variety).length + ' 通り)');
  });
  console.log('  型 ' + Object.keys(C.types).length + ' 種類を 検査');

  section('ダンジョン生成(1200 回 × 3 階)');
  let stepSum = 0, n = 0;
  for (let s = 0; s < 1200; s++) {
    const entry = (s * 2654435761) >>> 0;
    for (let fl = 0; fl < 3; fl++) {
      const f = tryDo('ダンジョン生成 seed=' + entry, () => D.genFloor(D.floorSeed(entry, fl)));
      if (!f) continue;
      const dist = D.bfs(f.grid, f.start);
      ok(dist[f.exit.y][f.exit.x] > 0, '階段に たどり着ける seed=' + entry + ' 階=' + fl);
      ok(f.grid[f.start.y][f.start.x] === D.T.BACK && f.grid[f.exit.y][f.exit.x] === D.T.NEXT, '入口と 次の階段が ある');
      ok(f.chests.length >= 1 && f.chests.length <= 2 && f.chests.every(c => dist[c.y][c.x] > 0 && f.grid[c.y][c.x] === D.T.CHEST), '宝箱は 1〜2個で 取りに行ける');
      ok(f.grid.every((row, y) => row.every((t, x) => (y > 0 && y < f.h - 1 && x > 0 && x < f.w - 1) || t === D.T.WALL)), '外周は 壁');
      ok(dist[f.exit.y][f.exit.x] >= 6 && dist[f.exit.y][f.exit.x] <= 80, '階段までの 歩数が ほどよい(' + dist[f.exit.y][f.exit.x] + ')');
      const again = D.genFloor(D.floorSeed(entry, fl));
      ok(JSON.stringify(again.grid) === JSON.stringify(f.grid), '同じ種なら 同じ形(中にいる間は変わらない)');
      stepSum += dist[f.exit.y][f.exit.x]; n++;
    }
    const a = D.genFloor(D.floorSeed(entry, 0)), b = D.genFloor(D.floorSeed(entry + 1, 0));
    if (s < 50) ok(JSON.stringify(a.grid) !== JSON.stringify(b.grid), '入り直すと 形が変わる');
  }
  console.log('  階段までの平均 ' + (stepSum / n).toFixed(1) + ' 歩');
  section('ボス部屋と 隠し通路');
  [[true, false, false], [false, false, false], [false, true, false], [false, true, true], [true, true, false], [true, true, true]].forEach(function (v) {
    const f = D.bossRoom({ bossAlive: v[0], hasHidden: v[1], hiddenOpen: v[2] }), dist = D.bfs(f.grid, f.start), h = f.hidden;
    ok(JSON.stringify(D.bossRoom({ bossAlive: v[0], hasHidden: v[1], hiddenOpen: v[2] }).grid) === JSON.stringify(f.grid), 'ボス部屋は 毎回同じ形');
    ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(d => dist[f.boss.y + d[1]][f.boss.x + d[0]] > 0), 'ボスの となりまで 行ける');
    ok(v[0] ? f.grid[f.boss.y][f.boss.x] === D.T.BOSS : dist[f.warp.y][f.warp.x] > 0 && f.grid[f.warp.y][f.warp.x] === D.T.WARP, 'ボスがいる / 倒したあとは 帰りの魔法陣');
    if (v[1] && v[2]) ok(f.grid[h.y][h.x] === D.T.HIDDEN && dist[h.y][h.x] > 0, '条件を満たすと 隠し通路に 入れる');
    else ok(dist[h.y][h.x] < 0 && D.isSolid(f.grid[h.y][h.x]), '条件を満たすまで 隠し通路は 通れない');
  });

  section('タップ移動の道探し');
  (function () {
    /* 1つの盤面で、いろいろなマスをタップして確かめる */
    function checkBoard(label, w, h, solid, avoid, from, rng, taps) {
      const grid = []; for (let y = 0; y < h; y++) { grid.push([]); for (let x = 0; x < w; x++) grid[y].push(solid(x, y) ? D.T.WALL : D.T.FLOOR); }
      const dist = D.bfs(grid, from);
      for (let k = 0; k < taps; k++) {
        const to = { x: rng.int(-1, w), y: rng.int(-1, h) }, cx = Math.max(0, Math.min(w - 1, to.x)), cy = Math.max(0, Math.min(h - 1, to.y));
        const tag = label + ' (' + from.x + ',' + from.y + ')→(' + to.x + ',' + to.y + ')';
        [null, avoid].forEach(function (av) {
          const r = tryDo(tag, () => M.path.find(w, h, solid, from, to, av)); if (!r) return;
          let px = from.x, py = from.y, good = true, through = false;
          r.path.forEach(function (p, i) {
            if (Math.abs(p.x - px) + Math.abs(p.y - py) !== 1 || p.x < 0 || p.y < 0 || p.x >= w || p.y >= h || solid(p.x, p.y)) good = false;
            if (av && i < r.path.length - 1 && av(p.x, p.y)) through = true;
            px = p.x; py = p.y;
          });
          ok(good, tag + ': 1マスずつ進み、壁を通らない');
          ok(px === r.goal.x && py === r.goal.y && !solid(r.goal.x, r.goal.y), tag + ': 道の終わりが 行き先(通れるマス)');
          const reachable = !solid(cx, cy) && dist[cy][cx] >= 0;
          if (reachable) {
            ok(r.goal.x === cx && r.goal.y === cy, tag + ': 行けるマスには 必ずたどり着く');
            if (!av) ok(r.path.length === dist[cy][cx], tag + ': 最短の道(' + r.path.length + ' 歩、最短は ' + dist[cy][cx] + ')');
            else ok(r.path.length >= dist[cy][cx], tag + ': 最短より短くは ならない');
          } else {
            let best = 1e9;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dist[y][x] >= 0 && !(av && av(x, y) && !(x === from.x && y === from.y))) best = Math.min(best, Math.abs(x - cx) + Math.abs(y - cy));
            ok(Math.abs(r.goal.x - cx) + Math.abs(r.goal.y - cy) === best, tag + ': 行けないマスなら いちばん近い行けるマスへ');
            ok(!through, tag + ': 階段などを 通り道にしない');
          }
          ok(r.adjacent === (Math.abs(r.goal.x - cx) + Math.abs(r.goal.y - cy) === 1), tag + ': となりかどうかの判定');
        });
      }
    }
    let boards = 0;
    for (let s = 0; s < 150; s++) {
      const f = D.genFloor(D.floorSeed(s * 97 + 3, s % 3)), rng = U.makeRng(s + 77);
      const solid = (x, y) => D.isSolid(f.grid[y][x]), avoid = (x, y) => f.grid[y][x] === D.T.NEXT || f.grid[y][x] === D.T.BACK;
      checkBoard('ダンジョン#' + s, f.w, f.h, solid, avoid, f.start, rng, 25); boards++;
      // 次の階段をタップしたら、階段まで行ける
      const r = M.path.find(f.w, f.h, solid, f.start, f.exit, avoid);
      ok(r.goal.x === f.exit.x && r.goal.y === f.exit.y && r.path.length > 0, 'ダンジョン#' + s + ': 階段をタップすると 階段に着く');
      f.chests.forEach(c => { const rc = M.path.find(f.w, f.h, solid, f.start, c, avoid); ok(rc.goal.x === c.x && rc.goal.y === c.y, 'ダンジョン#' + s + ': 宝箱をタップすると 宝箱に着く'); });
    }
    [true, false].forEach(function (alive) {
      const f = D.bossRoom({ bossAlive: alive, hasHidden: true, hiddenOpen: !alive }), solid = (x, y) => D.isSolid(f.grid[y][x]);
      const avoid = (x, y) => [D.T.BACK, D.T.WARP, D.T.HIDDEN].indexOf(f.grid[y][x]) >= 0;
      checkBoard('ボス部屋', f.w, f.h, solid, avoid, f.start, U.makeRng(alive ? 1 : 2), 200); boards++;
      const r = M.path.find(f.w, f.h, solid, f.start, alive ? f.boss : f.hidden, avoid);
      if (alive) ok(r.adjacent && r.path.length > 0, 'ボスをタップすると となりまで歩く(そこで調べる)');
      else ok(r.goal.x === f.hidden.x && r.goal.y === f.hidden.y && !r.path.slice(0, -1).some(p => avoid(p.x, p.y)), '隠し通路をタップすると、魔法陣を ふまずに 通路へ着く');
    });
    Object.keys(C.maps).forEach(function (mid) {
      const m = C.maps[mid], lg = Object.assign({}, M.BASE_LEGEND, C.legend || {}, m.legend || {}), w = m.rows[0].length, h = m.rows.length;
      const cell = (x, y) => lg[m.rows[y][x]], solid = (x, y) => !!cell(x, y).solid, avoid = (x, y) => !cell(x, y).solid && !!cell(x, y).event;
      const walk = []; m.rows.forEach((r, y) => r.split('').forEach((ch, x) => { if (!lg[ch].solid) walk.push({ x: x, y: y }); }));
      const rng = U.makeRng(mid.length + 9);
      for (let k = 0; k < 12; k++) { checkBoard('マップ ' + mid, w, h, solid, avoid, rng.pick(walk), rng, 60); boards++; }
      // 町の人・看板をタップしたら となりまで歩ける
      const from = mid === C.start.map ? C.start : walk[0];
      m.rows.forEach((r, y) => r.split('').forEach((ch, x) => {
        if (lg[ch].solid && lg[ch].event && mid === C.start.map) ok(M.path.find(w, h, solid, from, { x: x, y: y }, avoid).adjacent, 'マップ ' + mid + ' の「' + ch + '」をタップすると となりまで歩く');
      }));
    });
    console.log('  盤面 ' + boards + ' 枚で 検査');
    ok(M.MOVE_MS >= 200 && M.MOVE_MS <= 400, '移動の速さ MOVE_MS(' + M.MOVE_MS + ')が ゆっくりめ(200〜400)');
  })();

  section('コースのデータ');
  const legendOf = m => Object.assign({}, M.BASE_LEGEND, C.legend || {}, m.legend || {});
  const tileOk = name => !!(M.art.TILES[name] || (C.tiles && C.tiles[name]));
  const entrances = {};
  Object.keys(C.maps).forEach(function (mid) {
    const m = C.maps[mid], lg = legendOf(m), w = m.rows[0].length;
    m.rows.forEach((r, y) => {
      ok(r.length === w, 'マップ ' + mid + ' の ' + y + ' 行目の長さ(' + r.length + ')が ' + w + ' と ちがう');
      r.split('').forEach(ch => ok(!!lg[ch], 'マップ ' + mid + ': 文字「' + ch + '」が legend にない'));
    });
    Object.keys(lg).forEach(ch => ok(tileOk(lg[ch].tile), 'legend「' + ch + '」の tile ' + lg[ch].tile + ' が ない'));
    // 歩いて行ける範囲
    const start = mid === C.start.map ? C.start : null;
    const from = start || (function () {
      let p = null; Object.keys(C.maps).forEach(o => { const l2 = legendOf(C.maps[o]); Object.keys(l2).forEach(ch => { const ev = l2[ch].event; if (ev && ev.type === 'map' && ev.map === mid) p = { x: ev.x, y: ev.y }; }); }); return p;
    })();
    if (!ok(!!from, 'マップ ' + mid + ' に 入る方法がある')) return;
    const cell = (x, y) => (m.rows[y] && lg[m.rows[y][x]]) || null;
    ok(cell(from.x, from.y) && !cell(from.x, from.y).solid, 'マップ ' + mid + ' の 出現位置が 歩ける場所');
    const reach = {}, queue = [[from.x, from.y]]; reach[from.x + ',' + from.y] = 1;
    while (queue.length) {
      const p = queue.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => {
        const x = p[0] + d[0], y = p[1] + d[1], c = cell(x, y); if (!c) return;
        if (c.solid) { if (c.event) reach['ev:' + x + ',' + y] = 1; return; }
        if (!reach[x + ',' + y]) { reach[x + ',' + y] = 1; queue.push([x, y]); }
      });
    }
    m.rows.forEach((r, y) => r.split('').forEach((ch, x) => {
      const c = lg[ch]; if (!c) return;
      if (c.event) {
        ok(reach[x + ',' + y] || reach['ev:' + x + ',' + y], 'マップ ' + mid + ' の (' + x + ',' + y + ')「' + ch + '」に たどり着ける');
        if (c.event.type === 'dungeon') { ok(!!C.dungeons[c.event.id], 'ダンジョン ' + c.event.id + ' がある'); entrances[c.event.id] = 1; }
        if (c.event.type === 'map') ok(!!C.maps[c.event.map], '行き先マップ ' + c.event.map + ' がある');
      }
      if (c.zone) ok(!!C.zones[c.zone], 'zone ' + c.zone + ' がある');
    }));
  });
  ok(C.maps[C.start.map], 'はじまりの場所のマップがある');
  Object.keys(C.zones).forEach(z => C.zones[z].enemies.forEach(e => ok(C.enemies[e] && !C.enemies[e].boss, 'zone ' + z + ' の敵 ' + e)));

  // ドット絵
  function spriteOk(label, def, map) {
    const rows = M.art.expandSprite(def);
    ok(rows.length === rows[0].length || rows[0].length === 8 && rows.length === 8, label + ': 正方形(' + rows[0].length + '×' + rows.length + ')');
    rows.forEach((r, y) => {
      ok(r.length === rows[0].length, label + ' の ' + y + ' 行目の長さが ' + r.length);
      r.split('').forEach(ch => { const c = map && map[ch] !== undefined ? map[ch] : ch; ok(c === '.' || !!M.art.PAL[c], label + ': 色「' + ch + '」が パレットにない'); });
    });
  }
  Object.keys(M.art.TILES).forEach(n => spriteOk('タイル ' + n, M.art.TILES[n]));
  M.JOBS.forEach(j => [0, 1].forEach(g => spriteOk('主人公 ' + j.id + g, { rows: M.art.heroRows(j.id, g) }, M.art.heroPal(j.id, g))));
  const looks = {}; M.JOBS.forEach(j => [0, 1].forEach(g => { looks[M.art.heroRows(j.id, g).join('') + JSON.stringify(M.art.heroPal(j.id, g))] = 1; }));
  ok(Object.keys(looks).length === 12, '主人公の見た目が 12通り');
  spriteOk('NPC', M.art.NPC, { h: 'n', s: 'S', e: 'K', k: 'n', 1: 'B', 2: 'g' });
  Object.keys(C.sprites).forEach(n => spriteOk('敵の絵 ' + n, C.sprites[n]));

  // 敵
  const names = {};
  Object.keys(C.enemies).forEach(function (id) {
    const E = C.enemies[id];
    ok(typeof E.name === 'string' && !names[E.name], '敵 ' + id + ' の名前が 重複していない'); names[E.name] = 1;
    ok(!!C.sprites[E.sprite], '敵 ' + id + ' の絵 ' + E.sprite + ' がある');
    ok(E.level >= 1 && E.types.length >= 1, '敵 ' + id + ' に level と types がある');
    E.types.concat(E.phase2 ? E.phase2.types : []).forEach(r => ok(!!C.types[typeof r === 'string' ? r : r.type], '敵 ' + id + ' の型 ' + JSON.stringify(r) + ' がある'));
    const hits = Math.ceil(R.enemyMaxHp(E) / R.playerDamage(E.level, 1, 'hero'));
    if (E.boss) { ok(hits >= 5 && hits <= 8, 'ボス ' + id + ' は 5〜8問で倒せる(' + hits + ')'); ok(typeof E.line === 'string', 'ボス ' + id + ' に セリフがある'); }
    else ok(hits >= 1 && hits <= 2, 'ザコ ' + id + ' は 1〜2問で倒せる(' + hits + ')');
    if (E.swap) spriteOk('敵 ' + id + ' の色ちがい', C.sprites[E.sprite], E.swap);
    if (E.phase2) { ok(E.phase2.name && E.phase2.types.length, '変身後の名前と型'); if (E.phase2.swap) spriteOk('変身後 ' + id, C.sprites[E.sprite], E.phase2.swap); }
  });
  ok(M.bossIds(C).length <= 12, 'ボスは 12体まで(記録のことばの都合)');

  // ダンジョンと 開放の順番
  Object.keys(C.dungeons).forEach(function (id) {
    const d = C.dungeons[id];
    ok(d.name && d.unit && d.level >= 1, 'ダンジョン ' + id + ': 名前・単元・目安レベル');
    ok(d.floors.length >= 1 && d.floors.length <= 3, 'ダンジョン ' + id + ': 1〜3階 + ボス部屋');
    ok(C.enemies[d.boss] && C.enemies[d.boss].boss, 'ダンジョン ' + id + ' の ボス');
    d.floors.forEach((f, k) => f.enemies.forEach(e => {
      ok(C.enemies[e] && !C.enemies[e].boss, 'ダンジョン ' + id + ' ' + (k + 1) + '階の敵 ' + e);
      if (C.enemies[e]) ok(C.enemies[e].level >= d.level && C.enemies[e].level <= C.enemies[d.boss].level, 'ダンジョン ' + id + ' の敵 ' + e + ' の level が 目安〜ボスの間');
    }));
    (d.need || []).concat(d.hidden ? d.hidden.need : []).forEach(f => ok(/^boss:/.test(f) && C.enemies[f.slice(5)] && C.enemies[f.slice(5)].boss, 'ダンジョン ' + id + ' の条件 ' + f));
    if (d.hidden) ok(!!C.dungeons[d.hidden.to] && d.hidden.need.length > 0, 'ダンジョン ' + id + ' の 隠し通路の行き先');
    if (d.need) ok(typeof d.needText === 'string', 'ダンジョン ' + id + ': 入れないときの説明');
  });
  const flags = {}, open = {}; let changed = true;
  const has = list => (list || []).every(f => flags[f]);
  while (changed) {
    changed = false;
    Object.keys(C.dungeons).forEach(function (id) {
      const d = C.dungeons[id];
      const can = (entrances[id] && has(d.need)) || Object.keys(C.dungeons).some(o => open[o] && C.dungeons[o].hidden && C.dungeons[o].hidden.to === id && has(C.dungeons[o].hidden.need));
      if (can && !open[id]) { open[id] = 1; flags['boss:' + d.boss] = 1; changed = true; }
    });
  }
  Object.keys(C.dungeons).forEach(id => ok(open[id], 'ダンジョン ' + id + ' に いつか 入れる(開放条件が 壊れていない)'));
  Object.keys(C.dungeons).forEach(id => { const d = C.dungeons[id]; if (d.hidden) ok(!has.call(null, []) || d.hidden.need.every(f => f !== 'boss:' + C.dungeons[d.hidden.to].boss), '隠し通路 ' + id + ' の条件が 行き先のボスに なっていない'); });

  // 称号
  ok(C.titles.level.length >= 1 && C.titles.level[0].lv === 1, 'Lv1 の称号がある');
  ok(C.titles.special.length <= 16, '特別称号は 16個まで(記録のことばの都合)');
  C.titles.special.forEach(t => {
    const c = t.cond || {};
    ok(t.id && t.name && (c.boss ? !!(C.enemies[c.boss] && C.enemies[c.boss].boss) : (c.combo > 0 || c.streak > 0)), '特別称号 ' + t.id + ' の条件');
  });

  section('強さのバランス');
  Object.keys(C.dungeons).forEach(function (id) {
    const d = C.dungeons[id], A = d.level, E = { level: A, atk: 1 };
    const at = Math.ceil(R.maxHp(A, 'hero') / R.enemyDamage(E, A));
    ok(at >= 3 && at <= 4, id + ': 目安レベルちょうどで 不正解 3〜4回(' + at + ')');
    if (A > 5) { const low = Math.ceil(R.maxHp(A - 5, 'hero') / R.enemyDamage(E, A - 5)); ok(low >= 1 && low <= 2, id + ': 5レベル低いと 不正解 1〜2回(' + low + ')'); }
    const B = C.enemies[d.boss], bl = B.level - 5;
    if (bl >= 1) {
      // 5レベル低い状態で ボスに全問正解しても、怒りの波動(3ターンごと)で 力つきる
      let hp = R.maxHp(bl, 'hero'), ehp = R.enemyMaxHp(B), turn = 0, combo = 0;
      while (ehp > 0 && hp > 0) { turn++; combo++; ehp -= R.playerDamage(bl, combo, 'hero'); if (ehp > 0 && turn % 3 === 0) hp -= Math.max(1, Math.round(R.enemyDamage(B, bl) * 0.5)); }
      const wrongOk = Math.ceil(hp / R.enemyDamage(B, bl));
      ok(hp <= 0 || wrongOk <= 1, id + ' のボス: 5レベル低いと まず勝てない(全問正解でも のこりHP ' + hp + ')');
    }
  });
  Object.keys(C.zones).forEach(z => C.zones[z].enemies.forEach(e => {
    const w = Math.ceil(R.maxHp(1, 'hero') / R.enemyDamage(C.enemies[e], 1));
    ok(w >= 5, '草原の ' + e + ': Lv1 でも 不正解 5回まで 耐えられる(' + w + ')');
    ok(R.enemyMaxHp(C.enemies[e]) <= R.playerDamage(1, 1, 'hero'), '草原の ' + e + ': Lv1 の 1問正解で 倒せる');
  }));
  let total = 0; for (let lv = 1; lv < 20; lv++) total += R.needXp(lv);
  console.log('  Lv20 までの経験値 ' + total + '(Lv10 のザコ約 ' + Math.round(total / R.xpOf({ level: 10, hp: 1.2 })) + ' 体ぶん)');
  ok(R.levelCap(C, {}) === C.levelCap.base && R.levelCap(C, { [C.levelCap.extendFlag]: 1 }) === C.levelCap.extended, 'レベル上限の 切りかえ');

  section('記録のことば');
  ok(Array.from(M.password.alphabet).length === 64 && new Set(Array.from(M.password.alphabet)).size === 64, '文字は 64種類');
  for (let i = 0; i < 300; i++) {
    const r = U.makeRng(i + 5), st = M.newState({ name: r.pick(['ソラ', 'あいうえおか', 'ヴァーミリ', 'ー', 'つむぎ']), gender: r.int(0, 1), job: r.pick(M.JOBS).id });
    st.lv = r.int(1, 40); st.xp = r.int(0, 900); st.gold = r.int(0, 16383); st.items.herb = r.int(0, 63); st.items.bell = r.int(0, 15);
    M.bossIds(C).forEach(b => { if (r.chance(0.5)) st.flags['boss:' + b] = 1; });
    st.titles = C.titles.special.filter(() => r.chance(0.5)).map(t => t.id); st.title = st.titles[0] || null;
    st.days.streak = r.int(0, 7); st.stats.maxCombo = r.int(0, 127);
    const pw = M.password.encode(C, st), o = M.password.decode(C, pw);
    ok(pw.length === 27, '記録のことばは 27文字');
    ok(o && o.name === st.name && o.gender === st.gender && o.job === st.job && o.lv === st.lv && o.xp === st.xp && o.gold === st.gold && o.herb === st.items.herb && o.bell === st.items.bell &&
      JSON.stringify(o.titles) === JSON.stringify(st.titles) && o.title === st.title && o.streak === st.days.streak && o.maxCombo === st.stats.maxCombo &&
      JSON.stringify(o.bosses) === JSON.stringify(M.bossIds(C).filter(b => st.flags['boss:' + b])), '記録のことばで 元にもどる #' + i);
    const ch = Array.from(pw), k = r.int(0, 26); ch[k] = M.password.alphabet[(M.password.alphabet.indexOf(ch[k]) + 1 + r.int(0, 62)) % 64];
    if (i < 100) ok(M.password.decode(C, ch.join('')) === null || i < 0, '1文字 ちがうと 受けつけない #' + i);
  }
});

console.log('\n' + (fails ? '✗ ' + fails + ' 件の 失敗(検査 ' + checks + ' 件)' : '✓ すべて合格(検査 ' + checks + ' 件)'));
process.exit(fails ? 1 : 0);

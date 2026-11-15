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
        // 画面に出せる形か(図の組み立てを含むので 時間がかかる)は 10 問に 1 問 調べる。生成そのものは 全問 調べている
        if (q && i % 10 === 0) { const e = M.checkQuestion(q); if (e) { bad++; first = first || 'seed ' + seed + ': ' + e; } }
        if (!q && errs === 0) { bad++; first = first || 'seed ' + seed + ': 問題が 作られなかった'; }
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
  if (!(W === 300 && H >= 20 && H <= 320)) return '図の大きさが おかしい(' + W + '×' + H + ')';
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
  if (raw === '+' || raw === '<' || raw === '>' || raw === 'α' || raw === 'β') return keys.indexOf(raw) >= 0;
  if (!/^[-0-9√π/.+±()]+$/.test(raw)) return false;
  const pf = /^\((.+)\)\/(.+)$/.exec(raw), parts = pf ? [pf[1], pf[2]] : raw.split('/');
  if (parts.length > 1 && keys.indexOf('分数') < 0) return false;
  if (raw.indexOf('√') >= 0 && keys.indexOf('√') < 0) return false;
  if (raw.indexOf('π') >= 0 && keys.indexOf('π') < 0) return false;
  if (raw.indexOf('.') >= 0 && keys.indexOf('.') < 0) return false;
  if (raw.indexOf('±') >= 0 && keys.indexOf('±') < 0) return false;
  const joined = /[+±]/.test(parts[0]) || parts[0].indexOf('-', 1) > 0;          // 2つの項を つないだ形
  if (joined && keys.indexOf('±') < 0 && keys.indexOf('+') < 0) return false;
  if (parts[0].indexOf('+') >= 0 && keys.indexOf('+') < 0) return false;
  return parts.every(p => p.length >= 1 && p.length <= 10);
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

section('エンジン: 和・差の形の値(2±√7 など)');
(function () {
  const J = (ans, inp) => U.judge({ answers: [ans] }, [inp]).result, V = U.parseValue;
  ok(J('2±√7', '2±√7') === 'correct' && J('(3±√5)/2', '(3±√5)/2') === 'correct' && J('-1±2√3', '-1±2√3') === 'correct' && J('±3', '±3') === 'correct' && J('±√3/2', '±√3/2') === 'correct', '± の答え');
  ok(J('2±√7', '2+√7') === 'wrong' && J('2±√7', '2-√7') === 'wrong' && J('2±√7', '-2±√7') === 'wrong' && J('2±√7', '2±√5') === 'wrong' && J('(3±√5)/2', '3±√5') === 'wrong', '± の 片方だけ・符号ちがい・√ の中身ちがい・分母の わすれは 不正解');
  ok(J('2±√7', '(4±2√7)/2') === 'unsimplified' && J('2±√7', '2±√28') === 'wrong' && J('2±2√7', '2±√28') === 'unsimplified' && J('(3±√5)/2', '(6±2√5)/4') === 'unsimplified', '約分していない・√ の中を 簡単にしていない形は 入れ直し');
  ok(J('2+√7', '2+√7') === 'correct' && J('2-√7', '2-√7') === 'correct' && J('2+√7', '2-√7') === 'wrong' && J('(3-√5)/2', '(3-√5)/2') === 'correct' && J('2+√7', '√7+2') === 'correct', '+ − の値(項の順は どちらでも)');
  ok(J('√6+√2', '√2+√6') === 'correct' && J('(√6-√2)/4', '(√6-√2)/4') === 'correct' && J('(√6-√2)/4', '(√2-√6)/4') === 'wrong', '√ どうしの 和・差');
  ok(J('5', '2+3') === 'unsimplified' && J('4', '2+√4') === 'unsimplified' && J('3√2', '√2+2√2') === 'unsimplified' && J('2', '2±√0') === 'unsimplified', '1つの数に まとまる書き方は 入れ直し');
  ['2±', '±', '2±3', '3±√5/2', '(3±√5)', '(3)/2', '2+√7+1', '2±√7±1', '(3±√5)/√2', '2±π', '1.5±√2', '±-3', '(3±√5)/0'].forEach(r => ok(V(r) === null, r + ' は 書き方の誤り'));
  ok(Math.abs(V('2-√7').num - (2 - Math.sqrt(7))) < 1e-12 && Math.abs(V('(3+√5)/2').num - (3 + Math.sqrt(5)) / 2) < 1e-12, '+ − の値の数値');
  const pm = V('(3±√5)/2'); ok(pm.pm && isNaN(pm.num) && Math.abs(pm.nums[0] - (3 - Math.sqrt(5)) / 2) < 1e-12 && Math.abs(pm.nums[1] - (3 + Math.sqrt(5)) / 2) < 1e-12, '± の値は 2つの数の組');
  ok(V('2±√7').simple && V('(3±√5)/2').simple && !V('(4±2√6)/2').simple && !V('0±√3').simple && V('±√3').key === V('0±√3').key, '最も簡単な形かどうか');
  ok(U.am('2±√7') === '2 ± √7' && U.am('(3±√5)/2') === '{3 ± √5/2}' && U.am('-1-2√3') === '-1 - 2√3' && U.am('±√3/2') === '±{√3/2}' && U.am('-√7') === '-√7', '和・差の値の表示');
  renderOk('± の表示', U.am('(-1±√13)/2')); renderOk('+ の表示', 'x < ' + U.am('2-√7') + ', ' + U.am('2+√7') + ' < x');
  // 不等式の境界
  const S = (kind, eq, a, b) => ({ input: 'ineq', sol: { kind: kind, eq: eq, a: a, b: b }, mistakes: [], explain: ['a', 'b'], text: 't', hint: 'h', keys: ['+', '√'] }), I = (kind, eq, raws) => ({ kind: kind, eq: eq, raws: raws });
  const q = S('outside', false, '2-√7', '2+√7');
  ok(M.checkQuestion(q) === null && M.judgeAny(q, I('outside', false, ['2-√7', '2+√7'])).result === 'correct' && M.answerText(q) === 'x < 2 - √7, 2 + √7 < x', 'x < 2−√7, 2+√7 < x(' + M.answerText(q) + ')');
  ok(M.judgeAny(q, I('outside', false, ['2+√7', '2-√7'])).result === 'wrong' && M.judgeAny(q, I('between', false, ['2-√7', '2+√7'])).result === 'wrong' && M.judgeAny(q, I('outside', false, ['(4-2√7)/2', '2+√7'])).result === 'unsimplified', '境界の 左右が逆・内外が逆は 不正解、約分前は 入れ直し');
  const ql = { input: 'ineq', sol: { kind: 'outside', a: 'α', b: 'β' }, letters: { α: 1, β: 4 }, mistakes: [], explain: ['a', 'b'], text: 't', hint: 'h', keys: ['α', 'β'] };
  ok(M.checkQuestion(ql) === null && M.judgeAny(ql, { kind: 'outside', eq: false, raws: ['α', 'β'] }).result === 'correct' && M.judgeAny(ql, { kind: 'outside', eq: false, raws: ['β', 'α'] }).result === 'wrong' && M.judgeAny(ql, { kind: 'between', eq: false, raws: ['α', 'β'] }).result === 'wrong' && M.answerText(ql) === 'x < α, β < x' && M.sol.contains(ql.sol, 0, ql.letters) && !M.sol.contains(ql.sol, 2, ql.letters), '文字 α、β で答える不等式');
  ok(typeof M.checkQuestion(Object.assign({}, ql, { letters: undefined })) === 'string' && typeable('α', ['α', 'β']) && !typeable('α', ['√']), '文字の答えには letters と キーが必要');
  ok(M.sol.contains(q.sol, -1) && !M.sol.contains(q.sol, 0) && M.sol.contains(q.sol, 5) && !M.sol.contains(q.sol, 2 - Math.sqrt(7)), '境界が √ を含む範囲に 入るかどうか');
  ok(typeof M.checkQuestion(S('between', false, '2+√7', '2-√7')) === 'string' && typeof M.checkQuestion(S('gt', false, '2±√7')) === 'string', '境界が 大小逆・± の不等式は 問題として 出さない');
  ok(typeable('(3±√5)/2', ['±', '√', '分数']) && !typeable('(3±√5)/2', ['±', '√']) && !typeable('2±√7', ['+', '√']) && typeable('2-√7', ['+', '√']) && !typeable('2-√7', ['√']) && !typeable('2+√7', ['±', '√']), 'キーで入力できるかの 判定');
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
  // 見取り図の 頂点の名前が、辺・対角線・ほかの名前に 重ならない
  const dseg = (pt, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy, t = L2 ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * vx + (pt[1] - a[1]) * vy) / L2)) : 0; return Math.hypot(pt[0] - a[0] - vx * t, pt[1] - a[1] - vy * t); };
  let worst = 99, nSolid = 0;
  for (let i = 0; i < 400; i++) {
    const sd = [M.solids.cuboid(R.int(2, 9), R.int(2, 9), R.int(2, 9)), M.solids.prism(R.int(3, 6), R.int(2, 5), R.int(2, 9)), M.solids.pyramid(R.int(3, 6), R.int(2, 5), R.int(2, 9))][i % 3], vn = Object.keys(sd.verts);
    const sv = M.figure.svg(Object.assign({}, sd, i % 2 ? { segs: [[vn[0], vn[vn.length - 1]]], mark: [sd.edges[R.int(0, sd.edges.length - 1)]] } : {})), lines = [], texts = [];
    sv.replace(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g, (m, a, b, c, d) => { lines.push([[+a, +b], [+c, +d]]); return m; });
    sv.replace(/<text x="([-\d.]+)" y="([-\d.]+)"/g, (m, a, b) => { texts.push([+a, +b]); return m; });
    let near = 99; texts.forEach((t, k) => { lines.forEach(l => { near = Math.min(near, dseg(t, l[0], l[1])); }); texts.forEach((o, j) => { if (j !== k) near = Math.min(near, Math.hypot(t[0] - o[0], t[1] - o[1]) - 6); }); });
    worst = Math.min(worst, near); nSolid++;
    ok(texts.length === vn.length && near >= 6.5, '見取り図: 頂点の名前が 線や ほかの名前から 6.5px 以上 離れている(いちばん近い所 ' + near.toFixed(1) + 'px、' + ['直方体', '角柱', '角錐'][i % 3] + ')');
    ok(!figOk(sv), '見取り図: 名前を置いても 枠から はみ出さない');
  }
  console.log('  見取り図 ' + nSolid + ' 個: 頂点の名前と 線の いちばん近い所 ' + worst.toFixed(1) + 'px');
  const cube = M.figure.svg(M.solids.cuboid(4, 4, 4));
  ok((cube.match(/stroke-dasharray/g) || []).length === 3 && (cube.match(/<line/g) || []).length === 12 && 'ABCDEFGH'.split('').every(n => cube.indexOf('>' + n + '</text>') > 0), '立方体: 辺 12本のうち かくれた 3本が 破線、頂点 A〜H');
  const pr = M.solids.prism(3, 3, 5); ok(Object.keys(pr.verts).join('') === 'ADBECF' && pr.edges.length === 9 && pr.faces.length === 5, '三角柱 ABC-DEF: 辺 9、面 5');
  const py = M.solids.pyramid(4, 3, 5); ok(Object.keys(py.verts).length === 5 && py.edges.length === 8 && py.faces.length === 5, '四角錐: 頂点 5、辺 8、面 5');
  ['x', null, { type: 'nai' }, { type: 'geo', items: [{ t: 'nai' }] }, { type: 'scatter', pts: [[NaN, 1]] }, { type: 'solid', verts: { A: [0, 0, 0] }, edges: ['AZ'] }].forEach(function (b) {
    let threw = false; try { M.figure.svg(b); } catch (e) { threw = true; } ok(threw, 'こわれた図のデータは エラーにする(問題は 出さずに 作り直す)');
  });
  const ax = M.figure.niceAxis(3, 97, 5); ok(ax.lo === 0 && ax.hi === 100 && ax.step === 20 && ax.ticks.length === 6, 'きりのよい目盛り');
})();

section('エンジン: 図をかく入力・表の空欄・図を選ぶ4択');
(function () {
  const DR = M.draw, R = U.makeRng(4242), J = (q, inp) => M.judgeAny(q, inp);
  // 箱ひげ図
  const qb = { input: 'boxplot', plot: { type: 'boxplot', axis: [10, 30, 5], step: 1, v: [12, 15, 21, 27, 30] }, mistakes: [{ v: [12, 16, 21, 26, 30], tag: 'inc', msg: 'm' }] };
  ok(J(qb, [12, 15, 21, 27, 30]).result === 'correct', '箱ひげ図: 5つの値が 合えば 正解');
  ok(J(qb, [12, 16, 21, 26, 30]).mistake.tag === 'inc', '箱ひげ図: コースの誤答を 見分ける');
  ok(J(qb, [12, 14, 21, 27, 30]).mistake.tag === 'box-q1' && J(qb, [12, 15, 20, 27, 30]).mistake.tag === 'box-med' && J(qb, [11, 15, 21, 27, 30]).mistake.tag === 'box-min' && J(qb, [12, 15, 21, 28, 29]).mistake.tag === 'box-q3', '箱ひげ図: どの値が ちがうかを 見分ける');
  ok(J(qb, [12, 21, 15, 27, 30]).mistake.tag === 'box-order' && J(qb, [12, 15, null, 27, 30]).result === 'invalid' && J(qb, [12, 15, 21]).result === 'invalid', '箱ひげ図: 順番が おかしい・置いていない値がある');
  // ヒストグラム
  const qh = { input: 'hist', plot: { type: 'hist', start: 40, width: 10, freqs: [2, 5, 8, 4, 1], max: 10 }, mistakes: [] };
  ok(J(qh, [2, 5, 8, 4, 1]).result === 'correct' && J(qh, [0, 2, 5, 8, 4]).mistake.tag === 'hist-shift' && J(qh, [5, 8, 4, 1, 0]).mistake.tag === 'hist-shift', 'ヒストグラム: 正解・階級 1つぶんの ずれ');
  ok(J(qh, [2, 5, 8, 4, 2]).mistake.tag === 'hist-total' && J(qh, [2, 5, 7, 5, 1]).mistake.tag === 'hist-class' && /60 以上 70 未満/.test(J(qh, [2, 5, 7, 5, 1]).mistake.msg) && J(qh, [2, 5, 8]).result === 'invalid', 'ヒストグラム: 合計ちがい・ちがう階級を 知らせる');
  // 散布図
  const qs = { input: 'scatter', plot: { type: 'scatter', xr: [0, 8, 1], yr: [0, 8, 1], pts: [[1, 2], [3, 3], [4, 6], [6, 5], [7, 7]] }, mistakes: [] };
  ok(J(qs, [[7, 7], [6, 5], [4, 6], [3, 3], [1, 2]]).result === 'correct', '散布図: 置く順番は 問わない');
  ok(J(qs, [[2, 1], [3, 3], [6, 4], [5, 6], [7, 7]]).mistake.tag === 'scatter-swap' && J(qs, [[1, 2], [3, 3], [4, 6], [6, 5]]).mistake.tag === 'scatter-count' && J(qs, [[1, 2], [3, 3], [4, 6], [6, 5], [7, 6]]).mistake.tag === 'scatter-point', '散布図: x と y が逆・点の数ちがい・位置ちがい');
  // 位置 ⇔ 値(ランダムな目盛りで、タップした位置から もとの値に もどる)
  for (let i = 0; i < 300; i++) {
    const lo = R.int(-20, 50), st = R.pick([0.5, 1, 2, 5]), n = R.int(8, 40), pb = { type: 'boxplot', axis: [lo, lo + st * n, st * R.pick([2, 5])], step: st };
    const k = R.int(0, n), v = lo + st * k; ok(Math.abs(DR.boxHit(pb, DR.boxX(pb, v)) - v) < 1e-9 && DR.boxHit(pb, -50) === lo && DR.boxHit(pb, 999) === lo + st * n, '箱ひげ図: 位置 → 値(はしを こえたら はしの値)');
    const ph = { type: 'hist', start: 0, width: 10, freqs: Array.from({ length: R.int(2, 8) }, () => 0), max: R.pick([10, 15, 20]) }, ci = R.int(0, ph.freqs.length - 1), cv = R.int(0, ph.max), hp = DR.histPos(ph, ci, cv), hh = DR.histHit(ph, hp[0], hp[1]);
    ok(hh && hh.i === ci && hh.v === cv && DR.histHit(ph, 5, 100) === null && DR.histHit(ph, hp[0], 999).v === 0 && DR.histHit(ph, hp[0], -99).v === ph.max, 'ヒストグラム: 位置 → 階級と高さ(下の はしは 0)');
    const sx = R.pick([1, 2, 5, 10]), nx = R.int(4, 10), ny = R.int(4, 10), ps = { type: 'scatter', xr: [0, sx * nx, sx], yr: [10, 10 + 2 * ny, 2] }, px = sx * R.int(0, nx), py = 10 + 2 * R.int(0, ny), sp = DR.scPos(ps, px, py), sh = DR.scHit(ps, sp[0] + 3, sp[1] - 3);
    ok(sh && sh[0] === px && sh[1] === py && DR.scHit(ps, 2, 150) === null && DR.scHit(ps, 150, 299) === null, '散布図: 位置 → 方眼の交点(方眼の外は 無視)');
  }
  // かいている途中の図・正しい図
  [[qb, [null, 15, null, null, 30]], [qb, [12, 15, 21, 27, 30]], [qh, [0, 3, 10, 0, 1]], [qs, []], [qs, [[0, 0], [8, 8], [4, 4]]]].forEach(function (c) {
    const e = figOk(DR.svg(c[0].plot, c[1], 1)); ok(!e, 'かいている途中の図(' + c[0].input + '): ' + e);
    const e2 = figOk(M.figure.svg(DR.answerFig(c[0]))); ok(!e2, '正しい図(' + c[0].input + '): ' + e2);
  });
  ok(DR.svg(qb.plot, [12, 15, 21, 27, 30], 0).indexOf('<rect') > 0 && DR.svg(qb.plot, [12, 21, 15, 27, 30], 0).indexOf('<rect') < 0, '箱ひげ図: 5つの値が 順に そろったときだけ 箱を かく');
  ok((DR.svg(qs.plot, [[1, 2], [3, 3]], -1).match(/<circle/g) || []).length === 2 && (DR.svg(qh.plot, [2, 0, 8, 0, 0], 0).match(/fill="rgba\(60/g) || []).length === 2, '散布図の点・ヒストグラムの柱の数');
  // 表の空欄
  const fake = { types: {
    t: { gen: () => ({ text: 't', table: { head: ['階級', '度数'], rows: [['40 以上 50 未満', { a: '3' }], ['50 以上 60 未満', { a: '7' }], ['計', '10']] }, hint: 'h', explain: ['a', 'b'], mistakes: [{ answers: ['7', '3'], tag: 'sw', msg: 'm' }] }) },
    dev: { gen: () => ({ text: 't', table: { head: ['x', 'x - 平均', '(x - 平均)^2'], rows: [['4', { a: '-1.5' }, { a: '2.25' }]] }, keys: ['.'], hint: 'h', explain: ['a', 'b'] }) },
    badT: { gen: () => ({ text: 't', table: { rows: [['a', 'b'], ['c']] }, hint: 'h', explain: ['a', 'b'] }) },
    noBlank: { gen: () => ({ text: 't', table: { rows: [['a', 'b']] }, hint: 'h', explain: ['a', 'b'] }) },
    badBox: { gen: () => ({ text: 't', plot: { type: 'boxplot', axis: [0, 10, 5], step: 1, v: [1, 5, 3, 7, 9] }, hint: 'h', explain: ['a', 'b'] }) },
    offBox: { gen: () => ({ text: 't', plot: { type: 'boxplot', axis: [0, 10, 5], step: 1, v: [1, 2.5, 3, 7, 12] }, hint: 'h', explain: ['a', 'b'] }) },
    badHist: { gen: () => ({ text: 't', plot: { type: 'hist', start: 0, width: 10, freqs: [3, 12, 1], max: 10 }, hint: 'h', explain: ['a', 'b'] }) },
    badSc: { gen: () => ({ text: 't', plot: { type: 'scatter', xr: [0, 8, 1], yr: [0, 8, 1], pts: [[1, 1], [1, 1]] }, hint: 'h', explain: ['a', 'b'] }) },
    bigSc: { gen: () => ({ text: 't', plot: { type: 'scatter', xr: [0, 30, 1], yr: [0, 8, 1], pts: [[1, 1]] }, hint: 'h', explain: ['a', 'b'] }) },
    fc: { gen: () => ({ text: 't', choices: [{ fig: DR.plotFig(qh.plot, [2, 5, 8, 4, 1]), ok: true }, { fig: DR.plotFig(qh.plot, [1, 4, 8, 5, 2]), tag: 'x', msg: 'm' }, { fig: DR.plotFig(qh.plot, [8, 5, 2, 4, 1]) }, { text: 'どれでもない' }], hint: 'h', explain: ['a', 'b'] }) },
    fcDup: { gen: () => ({ text: 't', choices: [{ fig: DR.plotFig(qh.plot, [2, 5, 8, 4, 1]), ok: true }, { fig: DR.plotFig(qh.plot, [2, 5, 8, 4, 1]) }], hint: 'h', explain: ['a', 'b'] }) } } };
  const qt = M.buildQuestion(fake, 't', U.makeRng(1));
  ok(qt.input === 'table' && qt.answers.join() === '3,7' && M.checkQuestion(qt) === null && J(qt, ['3', '7']).result === 'correct' && J(qt, ['7', '3']).mistake.tag === 'sw' && J(qt, ['3', '8']).result === 'wrong' && J(qt, ['3', '']).result === 'invalid', '表の空欄: 答えは 表から集め、ふつうの空欄と 同じように 判定する');
  const th = DR.tableHTML(qt.table, 'input'), ta = DR.tableHTML(qt.table, 'answer');
  ok(!htmlOk(th) && !htmlOk(ta) && (th.match(/class="blank"/g) || []).length === 2 && ta.indexOf('class="blank"') < 0 && ta.indexOf('<b>3</b>') > 0 && (th.match(/<tr>/g) || []).length === 4, '表の表示(入力用は 空欄 2つ、答えは 数が入る)');
  const qd = M.buildQuestion(fake, 'dev', U.makeRng(1)); ok(M.checkQuestion(qd) === null && J(qd, ['-1.5', '2.25']).result === 'correct' && DR.tableHTML(qd.table, 'input').indexOf('<sup>2</sup>') > 0, '偏差の表(小数・負の数・見出しの数式)');
  ['badT', 'noBlank', 'badBox', 'offBox', 'badHist', 'badSc', 'bigSc', 'fcDup'].forEach(b => ok(typeof M.checkQuestion(M.buildQuestion(fake, b, U.makeRng(1))) === 'string', 'こわれたデータ(' + b + ')は 問題として 出さない'));
  // 図を選ぶ4択
  const pos = {};
  for (let i = 0; i < 200; i++) {
    const c = M.buildQuestion(fake, 'fc', U.makeRng(i)), oi = c.choice.findIndex(x => x.ok); pos[oi] = 1;
    ok(M.checkQuestion(c) === null && J(c, [oi]).result === 'correct' && c.choice.every((x, k) => k === oi || J(c, [k]).result === 'wrong') && JSON.stringify(DR.answerFig(c)) === JSON.stringify(c.choice[oi].fig), '図の4択: 正しい図だけが 正解(図と 文の選択肢を まぜてもよい)');
    [qb, qh, qs].forEach(function (q0) {
      const fc = DR.asFigChoice(Object.assign({ text: 't', hint: 'h', explain: ['a', 'b'], keys: [] }, q0), U.makeRng(i));
      ok(fc && fc.input === 'choice' && !fc.plot && fc.choice.length === 4 && M.checkQuestion(fc) === null && new Set(fc.choice.map(x => JSON.stringify(x.fig))).size === 4 && fc.choice.filter(x => x.ok).length === 1, '図をかく問題(' + q0.input + ')を 図の4択に 作りかえる');
    });
  }
  ok(Object.keys(pos).length === 4, '図の4択も 毎回 並べ替える');
  const fb = DR.asFigChoice(Object.assign({ text: 't', hint: 'h', explain: ['a', 'b'], keys: [] }, qb), U.makeRng(1));
  ok(fb.choice.some(c => c.tag === 'inc') && fb.cols === 1 && /正しい図/.test(fb.text), '4択にするとき、コースの誤答の図を 先に使う');
  ok(M.newState({ name: 'あ', gender: 0, job: 'hero' }).figChoice === false, '「図の問題:えらぶ」の設定は はじめ オフ(かく)');
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
    let withMistake = 0; const variety = {}, before = fails, kinds = {}, shown = {}, fcPos = {};
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
      ok(q.keys.length <= (q.input === 'ineq' ? 3 : 4) && q.keys.every(k => ['√', 'π', '分数', '+', '<', '>', '.', '±', 'α', 'β'].indexOf(k) >= 0), tag + ': 追加キーは 4つまで(不等式は 3つまで)・決まった名前');
      renderOk(tag + ' 正解の表示', M.answerText(q));
      ok(M.judgeAny(q, M.correctInput(q)).result === 'correct', tag + ': 正解を入れると 正解になる');
      ok(M.judgeAny(q, M.wrongInput(q)).result === 'wrong', tag + ': まちがいを入れると 不正解になる');
      kinds[q.input] = 1;
      if (q.input === 'form' || q.input === 'table') {
        if (q.input === 'form' && !renderOk(tag + ' form', q.form, true)) continue;
        if (q.input === 'table') ['input', 'answer'].forEach(md => { const te = htmlOk(M.draw.tableHTML(q.table, md)); ok(!te, tag + ' 表: ' + te); });
        // 入力画面と同じ組み立てで、空欄の数が 答えの数と 同じ(ちがうと 入力画面が止まる)
        const ui = U.mathHTML(q.text) + (q.expr ? U.mathHTML(q.expr) : '') + (q.input === 'form' ? U.mathHTML(q.form, true) : M.draw.tableHTML(q.table, 'input')) + U.mathHTML(q.hint || '');
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
        shown[it.findIndex(c => c.ok) + ':' + it.map(c => c.text || 'fig').join('|')] = 1;
        it.forEach(function (c, k) {
          if (c.text) renderOk(tag + ' 選択肢' + (k + 1), c.text);
          if (c.fig) { const fe = figOk(tryDo(tag + ' 選択肢の図', () => M.figure.svg(c.fig))); ok(!fe, tag + ' 選択肢' + (k + 1) + 'の図: ' + fe); }
          ok(!!(c.text || c.fig), tag + ': 選択肢に 文か 図がある');
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
      } else if (q.plot) {
        /* 図をかく入力(箱ひげ図・ヒストグラム・散布図) */
        const pl = q.plot, ci = M.correctInput(q), DR = M.draw, g = DR.geom;
        kinds.draw = 1; withMistake++;                         // まちがいの種類は エンジンが 自動で見分ける
        const e1 = figOk(DR.svg(pl, pl.type === 'boxplot' ? [null, null, null, null, null] : pl.type === 'hist' ? pl.freqs.map(() => 0) : [], 0)), e2 = figOk(DR.svg(pl, ci, 1)), e3 = figOk(M.figure.svg(DR.answerFig(q)));
        ok(!e1 && !e2 && !e3, tag + ': かく図・正しい図が くずれている ' + (e1 || e2 || e3));
        // 目盛りから 少しずれた所(間隔の 4割)を タップしても、正しい値が入る
        [-0.4, 0, 0.4].forEach(function (off) {
          let tapped;
          if (pl.type === 'boxplot') { const sp = DR.boxX(pl, pl.axis[0] + DR.step(pl)) - DR.boxX(pl, pl.axis[0]); tapped = ci.map(v => DR.boxHit(pl, DR.boxX(pl, v) + off * sp)); ok(sp >= 4.4, tag + ': 箱ひげ図の 置ける位置の間隔が せますぎる(' + sp.toFixed(1) + ')'); }
          else if (pl.type === 'hist') {
            const bw = (g.hist.W - g.hist.l - g.hist.r) / pl.freqs.length, un = (g.hist.H - g.hist.t - g.hist.b) / DR.histMax(pl);
            tapped = ci.map((v, k) => { const ps = DR.histPos(pl, k, v), h = DR.histHit(pl, ps[0] + off * bw, ps[1] + off * un); return h && h.i === k ? h.v : -1; });
            ok(bw >= 30 && un >= 9, tag + ': ヒストグラムの 柱の幅・1目盛りの高さが 小さすぎる(' + bw.toFixed(0) + '、' + un.toFixed(1) + ')');
          } else {
            const sx = DR.scPos(pl, pl.xr[0] + pl.xr[2], pl.yr[0])[0] - DR.scPos(pl, pl.xr[0], pl.yr[0])[0], sy = DR.scPos(pl, pl.xr[0], pl.yr[0])[1] - DR.scPos(pl, pl.xr[0], pl.yr[0] + pl.yr[2])[1];
            tapped = ci.map(pt => { const ps = DR.scPos(pl, pt[0], pt[1]); return DR.scHit(pl, ps[0] + off * sx, ps[1] - off * sy) || [NaN, NaN]; });
            ok(sx >= 25 && sy >= 25, tag + ': 散布図の 方眼の間隔が せますぎる(' + sx.toFixed(0) + ')');
          }
          ok(M.judgeAny(q, tapped).result === 'correct', tag + ': 図の上をタップして 正解を かける(ずれ ' + off + ')');
        });
        const jw = M.judgeAny(q, M.wrongInput(q));
        ok(jw.mistake && jw.mistake.tag && jw.mistake.msg, tag + ': まちがえた図には ひとことが出る') && renderOk(tag + ' 図のひとこと', jw.mistake.msg);
        q.mistakes.forEach(function (m, k) {
          const mv = m.v || m.freqs || m.pts, j = M.judgeAny(q, mv);
          ok(typeof m.tag === 'string' && m.tag && typeof m.msg === 'string' && m.msg && j.result === 'wrong' && j.mistake === m, tag + ' 誤答' + (k + 1) + ': 正解と同じ図に なっている、または 診断が出ない');
          renderOk(tag + ' 誤答' + (k + 1) + ' ひとこと', m.msg);
        });
        // 図を選ぶ4択に 作りかえられる(かくのが むずかしい端末用)
        const fc = DR.asFigChoice(q, U.makeRng(i * 13 + 3));
        if (ok(!!fc && M.checkQuestion(fc) === null, tag + ': 図を選ぶ4択に 作りかえられる(' + (fc ? M.checkQuestion(fc) : 'まちがいの図が 3つ 作れない') + ')')) {
          const oi = fc.choice.findIndex(c => c.ok); fcPos[oi] = 1;
          ok(fc.choice.length === 4 && fc.choice.filter(c => c.ok).length === 1 && new Set(fc.choice.map(c => JSON.stringify(c.fig))).size === 4, tag + ': 4つの図が すべて ちがい、正解は 1つ');
          ok(JSON.stringify(fc.choice[oi].fig) === JSON.stringify(DR.answerFig(q)) && M.judgeAny(fc, [oi]).result === 'correct' && fc.choice.every((c, k) => k === oi || (M.judgeAny(fc, [k]).result === 'wrong' && !!M.judgeAny(fc, [k]).mistake)), tag + ': 4択でも 正しい図だけが 正解');
          fc.choice.forEach(c => { const fe = figOk(M.figure.svg(c.fig)); ok(!fe, tag + ' 4択の図: ' + fe); });
        }
        if (q.verify) ok(tryDo(tag + ' verify', () => q.verify()) === true, tag + ': 正しい図のデータが 検算(verify)を通る');
        else ok(t.noNum === true, tag + ': 図をかく問題には verify が必要');
      } else {
        const sl = q.sol, LT = q.letters, vs = [sl.a, sl.b].filter(x => x !== undefined), nums = vs.map(x => U.parseValue(x).letter ? LT[x] : U.parseValue(x).num);
        ok(vs.every(x => U.parseValue(x).simple && typeable(x, q.keys)), tag + ': 不等式の値は 最も簡単な形で、キーで入力できる ' + JSON.stringify(vs));
        const xs = [0, -1000, 1000, 0.123];
        // 境界ちょうどの数は、√ を含まない値のときだけ 代入する(√ を含む値は 小数にすると ごくわずかに ずれるため、すぐ前後の数で 確かめる)
        nums.forEach((v, k) => { if (vs[k].indexOf('√') < 0) xs.push(v); xs.push(v - 1e-6, v + 1e-6, v - 0.5, v + 0.5, v - 7, v + 7); });
        if (nums.length === 2) xs.push((nums[0] + nums[1]) / 2);
        // 正解の範囲を、もとの不等式に 数を代入して 確かめる
        if (typeof q.inside === 'function') xs.forEach(x => ok(M.sol.contains(sl, x, LT) === !!q.inside(x), tag + ': x = ' + x + ' が 答えの範囲に 入るかどうかが、もとの不等式と 合わない  ' + (q.expr || '') + ' → ' + M.answerText(q)));
        else ok(t.noNum === true, tag + ': 不等式の問題には inside(x)(もとの条件を 代入して確かめる関数)が必要');
        // ほかの形・等号の有無を 入れたとき、同じ範囲のときだけ 正解になる
        const a0 = vs[0] || '0', b0 = vs[1] || (Number.isInteger(nums[0] === undefined ? 0 : nums[0]) ? String((nums[0] === undefined ? 0 : nums[0]) + 1) : null);
        M.sol.shapes.forEach(k => [false, true].forEach(function (eq) {
          if (b0 === null && ['between', 'outside'].indexOf(k) >= 0) return;
          const inp = { kind: k, eq: eq, raws: ['between', 'outside'].indexOf(k) >= 0 ? [a0, b0] : ['all', 'none'].indexOf(k) >= 0 ? [] : [a0] };
          const mine = { kind: k, eq: eq, a: inp.raws[0], b: inp.raws[1] }, nv = r => (U.parseValue(r).letter ? LT[r] : U.parseValue(r).num), pts = xs.concat([nv(a0), b0 === null ? 0 : nv(b0), nv(a0) + 1e-6, nv(a0) - 1e-6]);
          const same = pts.every(x => M.sol.contains(mine, x, LT) === M.sol.contains(sl, x, LT));
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
    if (kinds.draw) ok(Object.keys(fcPos).length >= 3, label + ': 図を選ぶ4択にしたとき、正解の位置が 毎回 変わる');
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

/* ============================================================
 * 5. 育成ゲーム(pet.js): 成長の段階・1日5問までの成長・放置しても死なない/退化しない・進化の分かれ道・
 *    見た目の組み合わせ・問題の出し方・記録のことば・セーブが消えない
 * ============================================================ */
const P = require('../pet.js');
(function petTests() {
  const DAY0 = new Date(2026, 10, 16, 8), day = k => new Date(DAY0.getTime() + k * 86400000);
  const strip = s => s.replace(/(pc|lg|au)\d+/g, '$1').replace(/\d+ic/g, 'ic');
  const svgOk = function (svg) {
    if (typeof svg !== 'string' || svg.indexOf('<svg') !== 0) return 'SVG が 作れない';
    if (/NaN|undefined|Infinity|null|\[object/.test(svg)) return 'NaN / undefined が まじっている';
    const stack = [], re = /<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g; let m;
    while ((m = re.exec(svg))) { if (m[3] === '/') continue; if (m[1]) { if (stack.pop() !== m[2]) return 'タグの対応が おかしい'; } else stack.push(m[2]); }
    return stack.length ? 'タグが 閉じていない' : null;
  };
  const mainCourses = Object.keys(M.courses).filter(id => P.units(M.courses[id]).length === 4);
  const feed = (S, units, k, unit, n) => { let ev = null; for (let i = 0; i < (n || P.MEAL); i++) ev = P.record(S, units, { mode: 'meal', type: 't', unit: unit || units[0].id }, true, null, day(k)); return ev; };
  const fresh = function (kind) { const S = P.newState('x'); P.adopt(S, kind || 'mystic', [0, 1, 2, 3, 4], 'もこ', day(0)); return S; };
  const U4 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  section('育成ゲーム: 見た目の組み合わせ・絵');
  ok(P.KINDS.length === 3, 'キャラクターは 3種類');
  P.KINDS.forEach(function (K) {
    ok(P.lookCount(K.id) >= 300, K.name + ': 見た目の組み合わせが 数百通り(' + P.lookCount(K.id) + ')');
    ok(K.stages.length === 5 && new Set(K.stages).size === 5, K.name + ': 段階の名前が 5つ');
    K.parts.forEach(pt => ok(pt.opts.length >= 3 && pt.opts.length <= 6 && new Set(pt.opts).size === pt.opts.length, K.name + ' の部品「' + pt.label + '」は 3〜6 通り'));
    const base = K.parts.map((pt, i) => (i + 1) % pt.opts.length), mk = (look, st, br) => { const p = P.newPet(K.id, look, 'てすと'); p.gp = [0, 5, 15, 35, 35][st - 1]; p.branch = st >= 4 ? br : null; p.legend = st >= 5; return p; };
    // 部品を 1つずつ 変えると、絵が 変わる(育った姿で)。どの段階・気分でも 絵が くずれない
    K.parts.forEach(function (pt, pi) {
      const seen = new Set();
      pt.opts.forEach(function (_, oi) {
        const look = base.slice(); look[pi] = oi;
        for (let st = 1; st <= 5; st++) ['fine', 'happy', 'eat', 'hungry', 'lonely', 'sleep'].forEach(function (md, mi) { const e = svgOk(P.art.pet(mk(look, st, (oi + mi) % 4), { mood: md })); ok(!e, K.name + ' ' + pt.label + oi + ' 段階' + st + ' ' + md + ': ' + e); });
        seen.add(strip(P.art.pet(mk(look, 3, 0), {})));
      });
      ok(seen.size === pt.opts.length, K.name + ' の「' + pt.label + '」を 変えると 見た目が 変わる(' + seen.size + '/' + pt.opts.length + ')');
    });
    const stg = [1, 2, 3, 4, 5].map(st => strip(P.art.pet(mk(base, st, 1), {})));
    ok(new Set(stg).size === 5, K.name + ': 5つの段階で 姿が ちがう');
    const brs = [0, 1, 2, 3].map(b => strip(P.art.pet(mk(base, 4, b), {})));
    ok(new Set(brs).size === 4, K.name + ': 分かれ道の 4通りで 姿が ちがう');
    ok(new Set([0, 1, 2, 3].map(b => strip(P.art.pet(mk(base, 5, b), {})))).size === 4 && brs.indexOf(strip(P.art.pet(mk(base, 5, 0), {}))) < 0, K.name + ': 伝説の姿は 別の絵');
    P.ITEMS.filter(it => it.cat === 'acc').forEach(function (it) {
      [2, 4].forEach(function (st) { const p = mk(base, st, 2), plain = strip(P.art.pet(p, {})); p.acc[it.slot] = it.id; const s = P.art.pet(p, {}); ok(!svgOk(s) && strip(s) !== plain, K.name + ' 段階' + st + ' に 小物 ' + it.id + ' を つけられる'); ok(strip(P.art.pet(p, { acc: false })) === plain, '小物なしの 絵に もどせる'); });
    });
    ok(P.zukanKeys().filter(k => k.indexOf(K.id + ':') === 0).length === 5, K.name + ': ずかんは 分かれ道 4 + 伝説 1');
  });
  ok(P.zukanKeys().length === 15 && new Set(P.zukanKeys()).size === 15, 'ずかんは 15 種類');
  ok(P.ITEMS.length <= 48 && new Set(P.ITEMS.map(i => i.id)).size === P.ITEMS.length, '品物の ID が 重ならない・48個まで(記録のことばの都合)');
  ok(P.TITLES.length <= 16 && new Set(P.TITLES.map(t => t.id)).size === P.TITLES.length, '称号の ID が 重ならない・16個まで');
  P.ITEMS.forEach(function (it) {
    ok(!svgOk(P.art.itemIcon(it.id)), '品物 ' + it.id + ' の絵');
    ok(it.limited ? P.STREAK_REWARDS.some(r => r.item === it.id && r.days === it.limited) : (it.price === 0 || (it.price >= 20 && it.price <= 300)), '品物 ' + it.id + ' の 値段(20〜300)か 限定品の設定');
    if (it.cat === 'acc') ok(P.SLOTS.indexOf(it.slot) >= 0 && typeof P.art.ACC[it.id] === 'function', '小物 ' + it.id + ' の つける場所と絵');
    if (it.cat === 'furn') ok(typeof P.art.FURN[it.id] === 'function' && it.w > 0 && it.h > 0 && (it.on === 'wall' || it.on === 'floor'), '家具 ' + it.id + ' の 大きさと絵');
  });
  ['acc', 'furn', 'wall', 'floor'].forEach(c => ok(P.ITEMS.filter(i => i.cat === c && !i.limited).length >= 4, '品物の種類 ' + c + ' が 4つ以上'));
  P.STREAK_REWARDS.forEach(r => ok(P.itemOf(r.item) && P.itemOf(r.item).limited === r.days, r.days + '日の ごほうびの 限定品'));
  (function () {
    const S = fresh(); P.ITEMS.forEach(it => { S.owned[it.id] = 1; });
    P.ITEMS.filter(it => it.cat === 'furn').forEach((it, i) => { const pl = P.place(S, it.id, i * 53 % 400 - 40, i * 71 % 300 - 20); ok(pl.x - it.w / 2 >= 0 && pl.x + it.w / 2 <= P.ROOM.w && pl.y <= P.ROOM.h && pl.y - it.h >= 0 && (it.on === 'wall' ? pl.y <= P.ROOM.floorY : pl.y >= P.ROOM.floorY), '家具 ' + it.id + ' は 部屋の中(' + it.on + ')に おさまる'); });
    P.ITEMS.filter(it => it.cat === 'wall').forEach(function (w, i) { ok(P.setRoom(S, w.id), '壁紙 ' + w.id + ' に かえられる'); P.setRoom(S, ['y_wood', 'y_check', 'y_shiba', 'y_tile'][i % 4]); [3, 12, 17, 22].forEach(h => { const e = svgOk(P.art.room(S, { hour: h, sel: 'f_bed' })); ok(!e, '部屋の絵(' + w.id + ' ' + h + '時): ' + e); }); });
    const n0 = S.room.placed.length; P.place(S, 'f_bed', 100, 200); ok(S.room.placed.length === n0, '同じ家具を 置き直しても 増えない(動くだけ)'); P.unplace(S, 'f_bed'); ok(S.room.placed.length === n0 - 1, '家具を しまえる');
  })();

  section('育成ゲーム: 成長の段階・1日5問までの成長');
  P.KINDS.forEach(function (K) {
    const S = fresh(K.id), pet = S.pets[0], seen = [P.stageOf(pet)];
    for (let k = 0; k < 7; k++) { const ev = feed(S, U4, k); seen.push(P.stageOf(pet)); ok(ev.mealDone && S.today.done && pet.gp === (k + 1) * P.MEAL, K.name + ': ' + (k + 1) + '日目の ごはんで 成長 ' + (k + 1) * P.MEAL); }
    ok(seen.join() === '1,2,2,3,3,3,3,4', K.name + ': 段階は 1日目で 2、3日ぶんで 3、7日ぶんで 4(' + seen.join() + ')');
    ok(P.stageName(pet) === K.stages[3] && S.days.total === 7 && S.days.streak === 7 && S.days.stamps.length === 7, K.name + ': 7日で ' + K.stages[3] + '・スタンプ 7');
  });
  (function () {
    const S = fresh(), pet = S.pets[0];
    for (let i = 0; i < 4; i++) { const ev = P.record(S, U4, { mode: 'meal', type: 't', unit: 'a' }, true, null, day(0)); ok(ev.grew && !ev.mealDone && pet.gp === i + 1 && S.today.fed === i + 1, (i + 1) + '問目: 成長ゲージが 1 進む'); }
    const e5 = P.record(S, U4, { mode: 'meal', type: 't', unit: 'a' }, true, null, day(0));
    ok(e5.grew && e5.mealDone && S.today.done && S.days.stamps.length === 1 && S.days.streak === 1, '5問目で「今日のごはん」完了・スタンプ');
    const coins = S.coins;
    for (let i = 0; i < 30; i++) { const ev = P.record(S, U4, { mode: i % 2 ? 'meal' : 'snack', type: 't', unit: 'a' }, true, null, day(0)); ok(!ev.grew && pet.gp === P.MEAL, '6問目から: 成長しない'); ok(ev.coins >= P.COIN.base, '6問目から: コインは もらえる'); }
    ok(S.coins > coins && S.days.stamps.length === 1 && S.days.total === 1, 'おやつ: コインだけ 増える(スタンプ・日数は 1日 1回)');
    const S2 = fresh(); let c2 = 0;
    for (let i = 0; i < 3; i++) { const g = S2.pets[0].gp, ev = P.record(S2, U4, { mode: 'meal', type: 't', unit: 'a' }, false, 'tag', day(0)); ok(!ev.grew && ev.coins === 0 && S2.pets[0].gp === g && S2.coins === c2, 'まちがい: 何も へらない・増えない'); c2 = S2.coins; }
    ok(S2.stats.wrong === 3 && S2.stats.mistakes.tag === 3 && S2.review.length === 3 && S2.today.fed === 0, 'まちがいは 記録だけ される(型・まちがい方)');
    feed(S2, U4, 0, 'a', 2); const g2 = S2.pets[0].gp; P.touch(S2, day(1)); ok(S2.today.fed === 0 && !S2.today.done && S2.pets[0].gp === g2, '日付が かわると 今日のごはんは 0 から(成長は そのまま)');
    feed(S2, U4, 1); ok(S2.pets[0].gp === g2 + P.MEAL, 'つぎの日は また 5問ぶん 成長できる');
    const S3 = fresh(); let cb = []; for (let i = 0; i < 6; i++) cb.push(P.record(S3, U4, { mode: 'snack', type: 't', unit: 'a' }, true, null, day(0)).coins);
    ok(cb.join() === [2, 2, 3, 3, 4, 4].map(x => x + P.COIN.base - 2).join(), '連続正解で コインが 少し増える(' + cb.join() + ')');
  })();

  section('育成ゲーム: 放置しても 死なない・退化しない');
  [1, 2, 3, 10, 100, 1000].forEach(function (gap) {
    const S = fresh('animal'); for (let k = 0; k < 4; k++) feed(S, U4, k);
    const pet = S.pets[0], gp = pet.gp, st = P.stageOf(pet), coins = S.coins, total = S.days.total, best = S.days.best;
    const r = P.touch(S, day(3 + gap));
    ok(S.pets.length === 1 && pet.gp === gp && P.stageOf(pet) === st && S.coins === coins && S.days.total === total && S.days.best === best, gap + '日 放置: なかま・成長・段階・コイン・合計日数は そのまま');
    ok(r.away === gap && P.mood(S, day(3 + gap)) === (gap >= 2 ? 'lonely' : 'hungry'), gap + '日 放置: 気分は ' + (gap >= 2 ? 'さみしそう' : 'おなかがすいた'));
    ok(S.days.streak === (gap >= 2 ? 0 : 4), gap + '日 放置: 連続日数は ' + (gap >= 2 ? 'とぎれる' : 'つづく'));
    feed(S, U4, 3 + gap);
    ok(P.mood(S, day(3 + gap)) === 'fine' && pet.gp === gp + P.MEAL && S.days.total === total + 1 && S.days.streak === (gap >= 2 ? 1 : 5) && S.days.best >= best, gap + '日 放置のあと ごはん: すぐ 元気・成長は つづきから');
  });
  (function () {
    const S = fresh(); feed(S, U4, 5); const gp = S.pets[0].gp;
    tryDo('時計を もどしても 止まらない', () => { P.touch(S, day(-30)); feed(S, U4, -30); P.touch(S, day(5)); });
    ok(S.pets[0].gp >= gp && S.pets.length === 1, '時計を もどしても 成長は へらない');
    ok(P.mood(P.newState('x'), day(0)) === 'fine', 'なかまが いないときも 気分の計算で 止まらない');
    // でたらめな操作を くり返しても、成長・段階・なかま・合計日数は へらない。1日の成長は 5問まで
    for (let t = 0; t < 120; t++) {
      const r = U.makeRng(900 + t); let S2 = fresh(r.pick(['mystic', 'animal', 'human'])), k = 0, gained = 0, today = 0;
      for (let i = 0; i < 160; i++) {
        const before = S2.pets.map(p => [p.gp, P.stageOf(p)]), n = S2.pets.length, tot = S2.days.total, best = S2.days.best, op = r.int(0, 11);
        if (op === 0) { const j = r.pick([1, 1, 1, 2, 3, 9, 40]); k += j; today = k; gained = 0; P.touch(S2, day(k)); }
        else if (op <= 6) { const g0 = S2.pets[S2.cur].gp; P.record(S2, U4, { mode: r.pick(['meal', 'meal', 'snack', 'legend']), type: 'ty' + r.int(0, 5), unit: r.pick(U4).id }, r.chance(0.75), 'tg', day(k)); gained += S2.pets[S2.cur].gp - g0; }
        else if (op === 7) P.buy(S2, r.pick(P.ITEMS).id);
        else if (op === 8) { P.wear(S2, S2.cur, r.pick(P.ITEMS).id); P.place(S2, r.pick(P.ITEMS).id, r.int(-50, 400), r.int(-50, 400)); P.setRoom(S2, r.pick(P.ITEMS).id); }
        else if (op === 9) { P.adopt(S2, r.pick(P.adoptInfo(S2).kinds), [r.int(0, 5), r.int(0, 5), r.int(0, 5), r.int(0, 5), r.int(0, 5)], 'にごう', day(k)); if (S2.pets.length > n) { before.push([0, 1]); } S2.cur = r.int(0, S2.pets.length - 1); gained = Math.min(gained, P.MEAL); }
        else if (op === 10) P.restyle(S2.pets[S2.cur], [r.int(0, 9), r.int(0, 9), r.int(0, 9), r.int(0, 9), r.int(0, 9)], 'かえた');
        else S2 = P.restore(JSON.stringify(S2), 'x');
        if (!ok(S2 && S2.pets.length >= n && S2.pets.length <= P.MAX_PETS && S2.days.total >= tot && S2.days.best >= best && S2.coins >= 0 && before.every((b, j) => S2.pets[j].gp >= b[0] && P.stageOf(S2.pets[j]) >= b[1]), 'でたらめな操作 #' + t + ': 何も へらない(操作 ' + op + ')')) break;
        if (!ok(gained <= P.MEAL && S2.today.fed <= P.MEAL, 'でたらめな操作 #' + t + ': 1日の成長は 5問まで(' + gained + ')')) break;
      }
    }
  })();

  section('育成ゲーム: 進化の分かれ道・伝説・なかま・ごほうび');
  P.KINDS.forEach(function (K) {
    [0, 1, 2, 3].forEach(function (b) {
      const S = fresh(K.id), pet = S.pets[0]; let ev = null;
      for (let k = 0; k < 7; k++) { for (let i = 0; i < P.MEAL; i++) ev = P.record(S, U4, { mode: 'meal', type: 't', unit: U4[i < 3 ? b : (b + 1 + i + k) % 4].id }, true, null, day(k)); if (k < 6) ok(pet.branch === null, K.name + ': おとなに なるまでは 分かれ道は 決まらない'); }
      ok(P.stageOf(pet) === 4 && pet.branch === b && ev.branch === b && ev.stageFrom === 3 && ev.stageTo === 4, K.name + ': 単元 ' + (b + 1) + ' を いちばん解くと 分かれ道 ' + b);
      ok(!!S.zukan[K.id + ':' + b] && ev.zukan.indexOf(K.id + ':' + b) >= 0 && Object.keys(S.zukan).length === 1, K.name + ': ずかんに 登録(' + P.formName(K.id, b, false) + ')');
      for (let i = 0; i < 40; i++) P.record(S, U4, { mode: 'snack', type: 't', unit: U4[(b + 1) % 4].id }, true, null, day(6));
      ok(pet.branch === b, K.name + ': 一度 決まった姿は あとから 変わらない');
      for (let i = 0; i < P.LEGEND_NEED - 1; i++) ev = P.record(S, U4, { mode: 'legend', type: 'hx', unit: null }, true, null, day(6));
      ok(!pet.legend && pet.lg === P.LEGEND_NEED - 1 && P.gauge(pet).now === P.LEGEND_NEED - 1, K.name + ': 発展問題 ' + (P.LEGEND_NEED - 1) + '問では まだ');
      P.record(S, U4, { mode: 'legend', type: 'hx', unit: null }, false, null, day(6)); ok(pet.lg === P.LEGEND_NEED - 1, 'まちがえても 伝説への 進み具合は へらない');
      ev = P.record(S, U4, { mode: 'legend', type: 'hx', unit: null }, true, null, day(6));
      ok(pet.legend && ev.legend && P.stageOf(pet) === 5 && ev.stageTo === 5 && !!S.zukan[K.id + ':L'] && P.stageName(pet) === K.stages[4], K.name + ': 発展問題 ' + P.LEGEND_NEED + '問で 伝説の姿');
    });
  });
  (function () {
    const S = fresh(); for (let i = 0; i < 12; i++) P.record(S, U4, { mode: 'legend', type: 'hx', unit: null }, true, null, day(0));
    ok(!S.pets[0].legend && S.pets[0].lg === 0, 'おとなに なる前は 伝説への挑戦が 数えられない');
    ok(P.decideBranch({ unitOk: { b: 3, c: 3 } }, U4) === 1 && P.decideBranch({ unitOk: {} }, U4) === 0, '同じ数のときは 並び順で 先の単元');
    ok(!P.adoptInfo(S).can && P.adopt(S, 'animal', [0], 'にごう', day(0)) === null, 'おとなに なる前は 2人目を むかえられない');
    for (let k = 0; k < 7; k++) feed(S, U4, k);
    const info = P.adoptInfo(S); ok(info.can && info.kinds.join() === 'animal,human', 'おとなに なると 別の種類を むかえられる');
    ok(P.adopt(S, 'mystic', [0], 'だめ', day(7)) === null && !!P.adopt(S, 'animal', [1, 2, 3, 4], 'にごう', day(7)) && S.pets.length === 2 && S.cur === 1 && P.stageOf(S.pets[0]) === 4, '2人目を むかえても 1人目は 部屋に のこる');
    const gp0 = S.pets[0].gp; feed(S, U4, 7); ok(S.pets[1].gp === P.MEAL && S.pets[0].gp === gp0, 'ごはんは おせわ中の子が 育つ');
    const p = S.pets[0], look = p.look.slice(); P.restyle(p, [2, 3, 4, 1], 'あたらし'); ok(p.gp === gp0 && P.stageOf(p) === 4 && p.look.join() !== look.join() && p.name === 'あたらし', 'かがみ: 見た目だけ 変わる(成長は そのまま)');
    // 連続日数の ごほうび・称号
    const T = fresh(), got = [];
    for (let k = 0; k < 31; k++) { const ev = feed(T, U4, k); ev.rewards.forEach(r => got.push(r.days + ':' + (k + 1))); }
    ok(got.join() === '3:3,7:7,14:14,30:30', '連続 3・7・14・30日で ごほうび(' + got.join() + ')');
    P.STREAK_REWARDS.forEach(r => ok(T.owned[r.item] === 1, r.days + '日の 限定品を 持っている'));
    ok(['s3', 's7', 's14', 's30', 'p1', 'd10', 'd30', 'c10'].every(t => T.titles.indexOf(t) >= 0) && T.title === T.titles[0], '称号が もらえる(' + T.titles.join() + ')');
    ok(!P.buy(T, 'l_niji').ok && !P.buy(T, 'nai').ok, '限定品・ない品物は 買えない');
    T.coins = 39; ok(!P.buy(T, 'a_mugi').ok && T.coins === 39, 'コインが 足りないと 買えない'); T.coins = 40; ok(P.buy(T, 'a_mugi').ok && T.coins === 0 && !P.buy(T, 'a_mugi').ok, '買うと コインが へる・2回は 買えない');
    ok(P.wear(T, 0, 'a_mugi') && T.pets[0].acc.head === 'a_mugi' && P.wear(T, 0, 'a_mugi') && !T.pets[0].acc.head && !P.wear(T, 0, 'a_beret'), '小物を つける・はずす(持っていない物は つけられない)');
  })();

  section('育成ゲーム: 問題の出し方(コースから 自動で 取り出す)');
  ok(mainCourses.length >= 3, '単元が 4つ とれるコースが 3つ以上(' + mainCourses.join() + ')');
  Object.keys(M.courses).forEach(id => tryDo(id + ': 単元の取り出しで 止まらない', () => { P.units(M.courses[id]); P.legendPool(M.courses[id]); }));
  mainCourses.forEach(function (cid) {
    const C = M.courses[cid], units = P.units(C), tid = P.typeId, lp = P.legendPool(C), r = U.makeRng(31);
    const extraTypes = {}; Object.keys(C.dungeons).filter(d => C.dungeons[d].extra).forEach(d => [].concat.apply([C.dungeons[d].boss], C.dungeons[d].floors.map(f => f.enemies)).forEach(e => C.enemies[e].types.forEach(t => { extraTypes[tid(t)] = 1; })));
    units.forEach(function (u) {
      ['basic', 'standard', 'advanced'].forEach(function (tier) {
        ok(u[tier].length >= 1, cid + ' 単元 ' + u.id + ': ' + tier + ' の型が ある');
        u[tier].forEach(function (ref) { ok(!!C.types[tid(ref)] && !extraTypes[tid(ref)], cid + ' ' + u.id + ' ' + tier + ': 型 ' + tid(ref) + ' が ある(発展の型は まぜない)'); ok(!!M.safeQuestion(C, [ref], ref, () => Math.floor(r.next() * 4294967296)), cid + ' ' + tid(ref) + ': 問題を 作れる'); });
      });
      ok(typeof u.name === 'string' && u.name.length > 0 && !!C.dungeons[u.id] && !C.dungeons[u.id].extra && !C.dungeons[u.id].need, cid + ' 単元 ' + u.id + ' は 4つのダンジョンの 1つ');
    });
    if (C.pet && C.pet.basic) Object.keys(C.pet.basic).forEach(t => ok(!!C.types[t] && [].concat(C.pet.basic[t]).every(u => units.some(x => x.id === u)), cid + ' の pet.basic: ' + t));
    ok(lp.length >= 1 && lp.every(ref => extraTypes[tid(ref)]), cid + ': 発展(伝説への挑戦)は 隠しダンジョンの型');
    for (let i = 0; i < 300; i++) {
      const sel = units.filter(() => r.chance(0.6)), us = sel.length ? sel : [r.pick(units)], S = P.newState(cid); units.forEach(u => { if (us.indexOf(u) < 0) S.units[u.id] = false; });
      ok(P.selectedUnits(S, units).map(u => u.id).join() === us.map(u => u.id).join(), '外した単元は 出ない(えらんだ単元だけ)');
      const meal = P.pickMeal(us, r, P.MEAL, i % 3 ? [] : [tid(us[0].basic[0])]), nb = meal.filter(m => m.tier === 'basic').length;
      ok(meal.length === P.MEAL && meal.every(m => us.some(u => u.id === m.unit && u[m.tier].indexOf(m.ref) >= 0)), cid + ': ごはんは 5問・えらんだ単元から #' + i);
      ok(nb >= 3 && nb <= 4, cid + ': ごはんは 基本 3〜4問 + 標準 1〜2問(基本 ' + nb + ')#' + i);
      ok(meal.every((m, k) => k === 0 || tid(m.ref) !== tid(meal[k - 1].ref)), cid + ': 同じ型が 続かない #' + i + ' ' + meal.map(m => tid(m.ref)).join());
      const rest = r.int(1, 4); ok(P.pickMeal(us, r, rest, []).length === rest, cid + ': とちゅうから(のこり ' + rest + '問)');
      ['basic', 'standard', 'advanced'].forEach(function (tier) { const a = P.pickSnack(us, tier, r, null, []), b = a && P.pickSnack(us, tier, r, tid(a.ref), []); ok(a && a.tier === tier && us.some(u => u.id === a.unit) && b && (tid(b.ref) !== tid(a.ref) || new Set([].concat.apply([], us.map(u => u[tier].map(tid)))).size === 1), cid + ': おやつ(' + tier + ')'); });
      const lg = P.pickLegend(C, r, null, []); ok(lg && extraTypes[tid(lg.ref)] && lg.unit === null, cid + ': 伝説への挑戦の問題');
    }
  });

  section('育成ゲーム: 記録のことば・セーブが消えない');
  const names = ['もこ', 'ソラ', 'あいうえおか', 'ヴァーミリ', 'ー', 'ぷるる'];
  ok(P.nameOk('もこ') && P.nameOk('ヴァーミリ') && !P.nameOk('') && !P.nameOk('あいうえおかき') && !P.nameOk('abc') && !P.nameOk('漢字'), 'なまえは ひらがな・カタカナ 1〜6文字');
  const randomState = function (cid, r) {
    const C = M.courses[cid], units = P.units(C), S = P.newState(cid), np = r.int(1, P.MAX_PETS);
    for (let i = 0; i < np; i++) { const K = r.pick(P.KINDS), p = P.newPet(K.id, K.parts.map(pt => r.int(0, pt.opts.length - 1)), r.pick(names), day(0)); p.gp = r.pick([0, 3, 5, 14, 15, 34, 35, 35, 50]); if (p.gp >= 35) { p.branch = r.int(0, 3); p.legend = r.chance(0.3); p.lg = p.legend ? P.LEGEND_NEED : r.int(0, 9); } S.pets.push(p); }
    S.cur = r.int(0, np - 1); S.coins = r.int(0, 9999); S.days = { last: r.chance(0.8) ? P.dayKey(day(r.int(-300, 0))) : null, streak: r.int(0, 60), best: r.int(60, 200), total: r.int(0, 900), stamps: [] };
    P.ITEMS.forEach(it => { if (r.chance(0.4)) S.owned[it.id] = 1; }); P.STREAK_REWARDS.forEach(x => { if (r.chance(0.5)) S.rewards[x.days] = 1; });
    S.pets.forEach((p, i) => P.ITEMS.forEach(it => { if (it.cat === 'acc' && S.owned[it.id] && r.chance(0.3)) P.wear(S, i, it.id); }));
    P.ITEMS.forEach(it => { if (S.owned[it.id] && r.chance(0.5)) { P.setRoom(S, it.id); P.place(S, it.id, r.int(0, 300), r.int(0, 240)); } });
    units.forEach(u => { if (r.chance(0.3)) S.units[u.id] = false; });
    P.zukanKeys().forEach(k => { if (r.chance(0.3)) S.zukan[k] = { look: P.fixLook(k.split(':')[0], null), name: '' }; }); S.pets.forEach(p => { if (p.gp >= 35) S.zukan[p.kind + ':' + p.branch] = { look: p.look.slice(), name: p.name }; if (p.legend) S.zukan[p.kind + ':L'] = { look: p.look.slice(), name: p.name }; });
    S.titles = P.TITLES.filter(() => r.chance(0.4)).map(t => t.id); S.title = S.titles.length ? r.pick(S.titles) : null;
    S.stats.correct = r.int(0, 999); S.stats.types = { a: [3, 1] }; S.stats.maxCombo = r.int(0, 30); S.sound = r.chance(0.5); S.figChoice = r.chance(0.5);
    return S;
  };
  const core = S => JSON.stringify([S.pets.map(p => [p.kind, p.look, p.name, Math.min(p.gp, 63), p.branch, p.legend, Math.min(p.lg, 15), P.SLOTS.map(s => p.acc[s] || null)]), S.cur, S.coins, Math.min(S.days.streak, 63), S.days.total, S.days.last,
    P.zukanKeys().filter(k => S.zukan[k]), S.titles, S.title, P.STREAK_REWARDS.map(x => !!S.rewards[x.days]), P.ITEMS.filter(it => S.owned[it.id]).map(it => it.id), S.room.wall, S.room.floor]);
  mainCourses.forEach(function (cid, ci) {
    const C = M.courses[cid], other = M.courses[mainCourses[(ci + 1) % mainCourses.length]], units = P.units(C);
    for (let i = 0; i < 200; i++) {
      const r = U.makeRng(i * 13 + ci), S = randomState(cid, r), pw = P.password.encode(C, S), back = P.password.decode(C, pw, day(0)), chars = Array.from(pw);
      ok(chars.every(c => M.password.alphabet.indexOf(c) >= 0) && chars.length <= Math.ceil((164 + 100 * S.pets.length) / 6) + 2, cid + ': 記録のことばは ひらがな(' + chars.length + '文字・なかま ' + S.pets.length + '人)');
      if (!ok(!!back && core(back) === core(S), cid + ': 記録のことばで 元にもどる #' + i)) continue;
      ok(units.every(u => (back.units[u.id] === false) === (S.units[u.id] === false)), cid + ': えらんだ単元も 引きつぐ #' + i);
      ok(back.pets.every((p, j) => P.stageOf(p) === P.stageOf(S.pets[j])), cid + ': 段階は そのまま #' + i);
      if (i < 60) { const k = r.int(0, chars.length - 1), ch = chars.slice(); ch[k] = M.password.alphabet[(M.password.alphabet.indexOf(ch[k]) + 1 + r.int(0, 62)) % 64]; ok(P.password.decode(C, ch.join(''), day(0)) === null, cid + ': 1文字 ちがうと 受けつけない #' + i); ok(P.password.decode(other, pw, day(0)) === null, 'ほかのコースの ことばは 受けつけない'); }
      // セーブ: 保存 → 読み直しで 同じ。項目が 欠けた古い記録・新しい版の記録でも、なかま・成長・コインは 消えない
      const json = JSON.stringify(S), again = P.restore(json, cid);
      ok(!!again && core(again) === core(S) && again.days.streak === S.days.streak && again.days.best === S.days.best && JSON.stringify(again.stats) === JSON.stringify(S.stats) && again.sound === S.sound && again.figChoice === S.figChoice && again.room.placed.length === S.room.placed.length, cid + ': 保存 → 読み直しで 同じ #' + i);
      ok(JSON.stringify(P.restore(JSON.stringify(again), cid)) === JSON.stringify(again), cid + ': 何度 読み直しても 変わらない #' + i);
      const old = JSON.parse(json); ['days', 'today', 'units', 'stats', 'review', 'owned', 'room', 'zukan', 'titles', 'title', 'rewards', 'sound', 'figChoice', 'seen', 'combo', 'ver'].forEach(k => { if (r.chance(0.5)) delete old[k]; }); old.pets.forEach(p => { if (r.chance(0.5)) delete p.acc; if (r.chance(0.5)) delete p.unitOk; if (r.chance(0.3)) delete p.lg; });
      old.ver = 99; old.mirai = { a: 1 };
      const o2 = tryDo(cid + ': 古い・新しい版の記録の 読みこみ #' + i, () => P.restore(JSON.stringify(old), cid));
      ok(!!o2 && o2.pets.length === S.pets.length && o2.coins === S.coins && o2.pets.every((p, j) => p.gp === S.pets[j].gp && p.name === S.pets[j].name && p.kind === S.pets[j].kind && P.stageOf(p) >= Math.min(4, P.stageOf(S.pets[j]))), cid + ': 項目が 欠けた記録でも なかま・成長・コインは 残る #' + i);
      ok(!!o2 && !!o2.room.wall && !!o2.room.floor && Array.isArray(o2.days.stamps) && typeof o2.stats.correct === 'number' && o2.owned.w_cream === 1, cid + ': 欠けた項目は 初期値で 補う #' + i);
    }
  });
  ['', '{', 'null', '[]', '123', '{"v":0}', 'こわれた'].forEach(raw => ok(tryDo('こわれた記録「' + raw + '」', () => P.restore(raw, 'x')) === null, 'こわれた記録「' + raw + '」は 読まずに null(ひかえを使う)'));
  ['{"v":1}', '{"v":1,"pets":"x","days":5,"room":[1],"stats":null}', '{"v":1,"pets":[null,3,{"kind":"nai","look":"x","gp":"abc","acc":{"head":"f_bed"}},{"kind":"human","gp":-5,"branch":9,"legend":true}],"cur":77,"coins":-9,"today":{"fed":99}}'].forEach(function (raw) {
    const S = tryDo('おかしな記録の 読みこみ', () => P.restore(raw, 'x'));
    ok(!!S && S.pets.every(p => P.kindOf(p.kind).id === p.kind && p.gp >= 0 && !p.acc.head && (p.branch === null || p.branch < 4) && P.stageOf(p) >= 1 && !svgOk(P.art.pet(p, {}))) && S.cur >= 0 && S.cur <= Math.max(0, S.pets.length - 1) && S.coins >= 0 && S.today.fed <= P.MEAL && !svgOk(P.art.room(S, {})), 'おかしな値の 記録も 遊べる形に 直して 読む');
  });
})();

console.log('\n' + (fails ? '✗ ' + fails + ' 件の 失敗(検査 ' + checks + ' 件)' : '✓ すべて合格(検査 ' + checks + ' 件)'));
process.exit(fails ? 1 : 0);

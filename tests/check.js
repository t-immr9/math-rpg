/* ============================================================
 * tests/check.js — 自動テスト     実行: node tests/check.js
 *   1. エンジンの判定・数式表示・記録のことば
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
function renderOk(label, src) {
  if (typeof src !== 'string' || !src.length) return ok(false, label + ' が 空');
  const html = tryDo(label + ' の表示「' + src + '」', () => U.mathHTML(src));
  if (html === undefined) return false;
  const e = htmlOk(html);
  return ok(!e, label + '「' + src + '」: ' + e);
}
/* その答えを キーで打てるか */
function typeable(raw, keys) {
  if (raw === '*') return true;
  if (raw === '-') return true;
  if (raw === '+' || raw === '<' || raw === '>') return keys.indexOf(raw) >= 0;
  if (raw.indexOf('/') >= 0 && keys.indexOf('分数') < 0) return false;
  if (raw.indexOf('√') >= 0 && keys.indexOf('√') < 0) return false;
  if (raw.indexOf('π') >= 0 && keys.indexOf('π') < 0) return false;
  return raw.split('/').every(p => p.length >= 1 && p.length <= 6) && /^[-0-9√π/]+$/.test(raw);
}

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
    .forEach(s => renderOk('見本', s));
  ok(U.mathHTML('{1/2}').indexOf('class="mf"') >= 0, '分数は 縦に組む');
  ok(U.mathHTML('2^3').indexOf('<sup>3</sup>') >= 0, '指数は 上付き');
  ok(U.mathHTML('√3').indexOf('class="mr"') >= 0 && U.mathHTML('√3').indexOf('<svg') >= 0, '√ は 根号を描く');
  ok(U.mathHTML('[3]√8').indexOf('class="mi"') >= 0, '累乗根の 左肩の数');
  ok(U.mathHTML('-1').indexOf('−1') >= 0, '- は − で表示');
  ok(U.countBlanks('□ sin(θ □ □)') === 3 && (U.mathHTML('□ sin(θ □ □)').match(/class="blank"/g) || []).length === 3, '空欄の数');
  ok(U.fillForm('□ sin(θ □ □)', ['2', '-', 'π/6']) === '2 sin(θ - {π/6})', '答えを 式に はめる');
  let threw = false; try { U.mathHTML('{1/2'); } catch (e) { threw = true; } ok(threw, '} の不足は エラーにする');
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
    let withMistake = 0; const variety = {}, before = fails;
    for (let i = 0; i < 400 && fails - before < 6; i++) {
      const q = tryDo(label + ' #' + i + ' の生成', () => M.buildQuestion(C, ref, U.makeRng(1000 + i * 7919)));
      if (!q) continue;
      const tag = label + ' #' + i;
      renderOk(tag + ' text', q.text);
      if (q.expr !== undefined) renderOk(tag + ' expr', q.expr);
      if (!renderOk(tag + ' form', q.form)) continue;
      renderOk(tag + ' hint', q.hint);
      ok(Array.isArray(q.explain) && q.explain.length >= 2 && q.explain.length <= 3, tag + ': 解説は 2〜3行');
      (q.explain || []).forEach((l, k) => renderOk(tag + ' 解説' + (k + 1), l));
      ok(Array.isArray(q.answers) && q.answers.length === U.countBlanks(q.form) && q.answers.length >= 1, tag + ': 空欄の数と 答えの数が同じ');
      ok(q.keys.length <= 4 && q.keys.every(k => ['√', 'π', '分数', '+', '<', '>'].indexOf(k) >= 0), tag + ': 追加キーは 4つまで・決まった名前');
      const vals = q.answers.map(U.parseValue);
      if (!ok(vals.every(v => v), tag + ': 答えの書き方が正しい ' + JSON.stringify(q.answers))) continue;
      ok(vals.every(v => v.simple), tag + ': 答えは 最も簡単な形 ' + JSON.stringify(q.answers));
      ok(q.answers.every(a => typeable(a, q.keys)), tag + ': 答えを キーで入力できる ' + JSON.stringify(q.answers) + ' keys=' + q.keys.join(''));
      ok(U.judge(q, q.answers).result === 'correct', tag + ': 正解を入れると 正解になる');
      renderOk(tag + ' 正解の表示', U.fillForm(q.form, q.answers));
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
      variety[(q.expr || '') + '|' + q.form + '|' + q.text] = 1;
    }
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

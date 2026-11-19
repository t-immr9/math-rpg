/* ============================================================
 * 入力画面の 置き場所の検査(画面の大きさごと)
 *   node tests/layout.js          … 全コース × RPG と 育成ゲーム × スマホの 4つの大きさ
 *   node tests/layout.js suuA-2gakki-kimatsu   … 1つのコースだけ
 * パソコンの Chrome(または Edge)を 画面なしで 動かし、index.html / pet.html の &debug=fit を 開く。
 * 図のある問題・選ぶ・並べ替え・不等式・図をかく・表の 全部の型について、答えの部分と キーが
 * スクロールしなくても 画面の中に あるかを 調べる(判定は engine.js の M.layoutCheck)。
 * 外部ライブラリは 使わない(Chrome の DevTools プロトコルを Node の WebSocket で 直接 使う)。
 * Chrome が 見つからないときは「とばす」と 表示して 終わる(失敗には しない)。
 * 場所を 指定するときは 環境変数 MATHRPG_CHROME に 実行ファイルの パスを 書く。
 * ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process'), { pathToFileURL } = require('url');

const SIZES = [[390, 844], [375, 667], [360, 740], [320, 568]];      // よく使われる スマホの 画面(CSS の px)
const ROOT = path.join(__dirname, '..');
const SEEDS = parseInt(process.env.MATHRPG_LAYOUT_SEEDS || '3', 10);

function findChrome() {
  const env = process.env.MATHRPG_CHROME;
  const c = [env,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return c.find(function (p) { try { return p && fs.statSync(p).isFile(); } catch (e) { return false; } }) || null;
}
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function main() {
  const only = process.argv[2];
  const exe = findChrome();
  if (!exe) { console.log('■ 入力画面の 置き場所(画面の大きさごと): Chrome / Edge が 見つからないので とばす(MATHRPG_CHROME で 場所を 指定できる)'); return 0; }
  if (typeof WebSocket === 'undefined') { console.log('■ 入力画面の 置き場所: この Node には WebSocket が ないので とばす(Node 22 以上で 動く)'); return 0; }
  const courses = fs.readdirSync(path.join(ROOT, 'courses')).filter(function (f) { return f.endsWith('.js'); }).map(function (f) { return f.slice(0, -3); }).filter(function (id) { return !only || id === only; });
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'mathrpg-layout-'));
  const proc = spawn(exe, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
  let fails = 0, checks = 0;
  try {
    /* DevTools の ポート番号は プロファイルの DevToolsActivePort に 書かれる */
    let port = null;
    for (let i = 0; i < 150 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch (e) { /* まだ */ } }
    if (!port) throw new Error('Chrome が 起動しない');
    let list = null;
    for (let i = 0; i < 50 && !(list && list.some(function (t) { return t.type === 'page'; })); i++) { try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); } catch (e) { /* まだ */ } if (!list) await sleep(100); }
    const page = list.find(function (t) { return t.type === 'page'; });
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(function (res, rej) { ws.onopen = res; ws.onerror = function () { rej(new Error('DevTools に つながらない')); }; });
    let seq = 0; const wait = {};
    ws.onmessage = function (ev) { const m = JSON.parse(ev.data); if (m.id && wait[m.id]) { wait[m.id](m); delete wait[m.id]; } };
    const send = function (method, params) { return new Promise(function (res, rej) { const id = ++seq; wait[id] = function (m) { m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); }; ws.send(JSON.stringify({ id: id, method: method, params: params || {} })); }); };
    const evalJS = async function (expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result && r.result.value; };
    await send('Page.enable');

    console.log('\n■ 入力画面の 置き場所(画面の大きさごと。' + path.basename(exe) + ')');
    for (const size of SIZES) {
      await send('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 2, mobile: true });
      for (const id of courses) {
        for (const game of ['index.html', 'pet.html']) {
          const url = pathToFileURL(path.join(ROOT, game)).href + '?course=' + id + '&debug=fit&n=' + SEEDS;
          await send('Page.navigate', { url: url });
          let fit = null; const t0 = Date.now();
          while (!fit && Date.now() - t0 < 120000) { await sleep(150); try { fit = await evalJS('window.__fit && window.__fit.done ? JSON.stringify(window.__fit) : null'); } catch (e) { /* 読みこみ中 */ } }
          const label = size[0] + '×' + size[1] + ' ' + (game === 'pet.html' ? 'ペット' : 'RPG') + ' ' + id;
          checks++;
          if (!fit) { fails++; console.log('  ✗ ' + label + ': 結果が 出ない(120秒)'); continue; }
          const F = JSON.parse(fit);
          if (F.w !== size[0] || F.h !== size[1]) { fails++; console.log('  ✗ ' + label + ': 画面の大きさが ちがう(' + F.w + '×' + F.h + ')'); continue; }
          const ng = F.res.filter(function (r) { return r.bad.length; });
          checks += F.res.length;
          const sc = F.res.filter(function (r) { return r.m && r.m.scroll; }).length;
          if (ng.length) {
            fails += ng.length;
            console.log('  ✗ ' + label + ': ' + ng.length + ' / ' + F.res.length + ' 問で 問題あり');
            ng.slice(0, 12).forEach(function (r) { console.log('      ' + r.type + '#' + r.seed + ' ' + r.input + ': ' + r.bad.join(' / ')); });
            if (ng.length > 12) console.log('      …ほか ' + (ng.length - 12) + ' 問');
          } else console.log('  ✓ ' + label + ': ' + F.res.length + ' 問(問題文を スクロールする問題 ' + sc + ')');
        }
      }
    }
    ws.close();
  } catch (e) { fails++; console.log('  ✗ 検査が 動かない: ' + (e.stack || e.message)); }
  finally {
    proc.kill();
    await sleep(300);
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* Chrome が まだ つかんでいる */ }
  }
  console.log(fails ? '  ✗ 置き場所の検査: ' + fails + ' 件の 失敗' : '  ✓ 置き場所の検査: すべて合格(' + checks + ' 件)');
  return fails;
}

if (require.main === module) main().then(function (f) { process.exit(f ? 1 : 0); });
module.exports = main;

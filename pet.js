/* ============================================================
 * pet.js — すうがく ペット育成ゲーム(math-rpg の 2つ目のゲーム)
 *   問題・入力画面・図・まちがい方の診断は engine.js と courses/ を そのまま使う。
 *   1. きまりごと(成長・ごはん・コイン・称号・品物)   … Node でも動く(tests/check.js が検査)
 *   2. 絵(キャラクター・小物・家具・部屋を SVG で かく) … Node でも動く
 *   3. ブラウザ部(画面・操作・音・セーブ)             … MathPet.start(コースID, 置き場所)
 * キャラクター・品物・音は すべてオリジナル。画像・音声ファイルは 使わない。
 * ============================================================ */
(function (root) {
'use strict';
const M = (typeof MathRPG !== 'undefined') ? MathRPG : require('./engine.js');
const U = M.util;
const P = { version: 1 };

/* ===== 1. きまりごと ===== */
const MEAL = 5;                       // 今日のごはんの問題数(成長は 1日 この数まで)
const GROW = [0, 5, 15, 35];          // 段階 1〜4 に なるのに 必要な 成長ポイント(ごはん 1日・3日・7日ぶん)
const LEGEND_NEED = 10;               // 伝説の姿に なるのに 必要な 発展問題の正解数
const MAX_PETS = 6;
const COIN = { base: 2, combo3: 1, combo5: 2, meal: 5, legend: 1, max: 9999 };
const STREAK_REWARDS = [{ days: 3, coins: 20, item: 'l_niji' }, { days: 7, coins: 50, item: 'l_hoshirug' }, { days: 14, coins: 100, item: 'l_aurora' }, { days: 30, coins: 300, item: 'l_kin' }];
/* 進化の分かれ道(コースの 4つの単元の 並び順に 対応)*/
const BRANCH = [{ id: 'nami', name: 'なみ', color: '#6ec6e8', dark: '#3f9ccc' }, { id: 'hoshi', name: 'ほし', color: '#f7c948', dark: '#d9a520' },
  { id: 'konoha', name: 'このは', color: '#7cc66a', dark: '#4f9c44' }, { id: 'tou', name: 'とう', color: '#b08ae0', dark: '#8460c0' }];
const C6 = function (list) { return list.map(function (a) { return { name: a[0], fill: a[1], dark: a[2] }; }); };
const BODY = C6([['もも', '#ffb7c5', '#f08aa2'], ['そら', '#a8d8f8', '#70b0e6'], ['わかば', '#bfeaa8', '#84c670'], ['レモン', '#ffe993', '#eec24a'], ['すみれ', '#d0bcf6', '#a088de'], ['ミルク', '#fff4e0', '#e6cca4']]);
const FUR = C6([['しろ', '#fffaf2', '#e4d4c0'], ['ちゃいろ', '#dcab7c', '#b07f52'], ['くろ', '#77707c', '#544c5a'], ['はいいろ', '#c9cbd6', '#9c9eae'], ['きつねいろ', '#f8c67c', '#de9a48'], ['さくら', '#ffd3da', '#f0a0b2']]);
const HAIRC = C6([['くろ', '#544a52', '#3a3238'], ['ちゃいろ', '#96644a', '#70452f'], ['きんいろ', '#f4d070', '#d8aa3c'], ['あかね', '#e67c68', '#c4563f'], ['あお', '#78a4e6', '#4f7cc8'], ['ぎんいろ', '#d4d8e0', '#a4a9b8']]);
const SKIN = C6([['あかるい', '#ffe8d6', '#f4c4a8'], ['ふつう', '#fdd6b6', '#eaae88'], ['こむぎ', '#eabb90', '#c89260'], ['ブラウン', '#bd8a66', '#986648']]);
const CLOTH = C6([['あか', '#f29090', '#d26a6a'], ['あお', '#90bcf2', '#6292da'], ['みどり', '#9cdaa4', '#6aba7a'], ['きいろ', '#f8de84', '#e0b84a'], ['むらさき', '#c4a4ea', '#9a7ad2'], ['しろ', '#f8f4ec', '#d6cab6']]);
const EYES = ['まる', 'たれ目', 'きらきら', 'てんてん', 'ねむそう'];
const nm = function (l) { return l.map(function (c) { return c.name; }); };
const KINDS = [
  { id: 'mystic', name: 'ふしぎな生き物', desc: 'たまごから 生まれ、姿が 大きく 変わりながら 進化する', stages: ['たまご', 'あかちゃん', 'こども', 'おとな', '伝説の姿'], legend: '伝説の姿',
    parts: [{ label: 'かたち', opts: ['もこもこ', 'きらきら', 'ぷるぷる'] }, { label: '体の色', opts: nm(BODY), col: BODY }, { label: '目', opts: EYES }, { label: 'もよう', opts: ['なし', 'みずたま', 'しましま', 'ほし', 'ハート'] }] },
  { id: 'animal', name: '動物', desc: 'あかちゃんから 育ち、体が 大きくなって 毛並みや 小物が 変わる', stages: ['あかちゃん', 'こども', '若者', 'おとな', '伝説の毛並み'], legend: '伝説の毛並み',
    parts: [{ label: 'しゅるい', opts: ['ねこ', 'いぬ', 'うさぎ', 'とり', 'たぬき'] }, { label: '毛の色', opts: nm(FUR), col: FUR }, { label: '目', opts: EYES }, { label: 'もよう', opts: ['なし', 'ぶち', 'しま', 'くつした', 'おなか白'] }] },
  { id: 'human', name: '人間', desc: '見た目は 選んだまま。服装・持ち物・まわりの オーラが 進化する', stages: ['見習い', '駆け出し', '一人前', '達人', '伝説の達人'], legend: '伝説の達人',
    parts: [{ label: '髪型', opts: ['ショート', 'ボブ', 'ロング', 'ふたつむすび', 'ポニーテール', 'つんつん'] }, { label: '髪の色', opts: nm(HAIRC), col: HAIRC }, { label: '肌の色', opts: nm(SKIN), col: SKIN }, { label: '目', opts: EYES }, { label: '服の色', opts: nm(CLOTH), col: CLOTH }] }
];
function kindOf(id) { return KINDS.find(function (k) { return k.id === id; }) || KINDS[0]; }
function lookCount(kind) { return kindOf(kind).parts.reduce(function (a, p) { return a * p.opts.length; }, 1); }
function fixLook(kind, look) { return kindOf(kind).parts.map(function (p, i) { const v = look && look[i]; return Number.isInteger(v) && v >= 0 && v < p.opts.length ? v : 0; }); }
/* ずかんの名前 */
function formName(kind, branch, legend) {
  const k = kindOf(kind);
  if (legend) return k.legend;
  const b = BRANCH[branch] || BRANCH[0];
  return b.name + (k.id === 'mystic' ? 'の すがた' : k.id === 'animal' ? 'の 毛並み' : 'の 達人');
}
function zukanKeys() { const out = []; KINDS.forEach(function (k) { BRANCH.forEach(function (b, i) { out.push(k.id + ':' + i); }); }); KINDS.forEach(function (k) { out.push(k.id + ':L'); }); return out; }

/* 品物。並び順は 公開後に 変えない(記録のことばが 並び順に よる)。足すときは 末尾に足す。48個まで。 */
const ITEMS = [
  { id: 'a_mugi', cat: 'acc', slot: 'head', name: 'むぎわらぼうし', price: 40 }, { id: 'a_tongari', cat: 'acc', slot: 'head', name: 'とんがりぼうし', price: 50 },
  { id: 'a_beret', cat: 'acc', slot: 'head', name: 'ベレーぼう', price: 60 }, { id: 'a_hana', cat: 'acc', slot: 'head', name: 'はなかんむり', price: 90 },
  { id: 'a_knit', cat: 'acc', slot: 'head', name: 'ニットぼう', price: 70 }, { id: 'a_crown', cat: 'acc', slot: 'head', name: 'ちいさな おうかん', price: 240 },
  { id: 'a_megane', cat: 'acc', slot: 'face', name: 'まるめがね', price: 50 }, { id: 'a_hoshimegane', cat: 'acc', slot: 'face', name: 'ほしの サングラス', price: 80 },
  { id: 'a_ribbon', cat: 'acc', slot: 'neck', name: 'リボン', price: 30 }, { id: 'a_muffler', cat: 'acc', slot: 'neck', name: 'マフラー', price: 45 },
  { id: 'a_suzu', cat: 'acc', slot: 'neck', name: 'すずの くびかざり', price: 40 }, { id: 'a_tie', cat: 'acc', slot: 'neck', name: 'ちょうネクタイ', price: 55 },
  { id: 'f_bed', cat: 'furn', on: 'floor', name: 'ベッド', price: 120, w: 96, h: 56 }, { id: 'f_desk', cat: 'furn', on: 'floor', name: 'つくえ', price: 90, w: 70, h: 52 },
  { id: 'f_shelf', cat: 'furn', on: 'floor', name: 'ほんだな', price: 110, w: 56, h: 84 }, { id: 'f_plant', cat: 'furn', on: 'floor', name: 'はちうえ', price: 40, w: 34, h: 56 },
  { id: 'f_rug', cat: 'furn', on: 'floor', name: 'まるい ラグ', price: 60, w: 96, h: 34, flat: true }, { id: 'f_cushion', cat: 'furn', on: 'floor', name: 'クッション', price: 35, w: 40, h: 26 },
  { id: 'f_lamp', cat: 'furn', on: 'floor', name: 'フロアランプ', price: 55, w: 30, h: 84 }, { id: 'f_toybox', cat: 'furn', on: 'floor', name: 'おもちゃばこ', price: 70, w: 54, h: 44 },
  { id: 'f_globe', cat: 'furn', on: 'floor', name: 'ちきゅうぎ', price: 85, w: 36, h: 50 }, { id: 'f_board', cat: 'furn', on: 'floor', name: 'ちいさな こくばん', price: 100, w: 64, h: 66 },
  { id: 'f_clock', cat: 'furn', on: 'wall', name: 'かべどけい', price: 45, w: 34, h: 34 }, { id: 'f_picture', cat: 'furn', on: 'wall', name: 'かざりの え', price: 50, w: 46, h: 38 },
  { id: 'f_garland', cat: 'furn', on: 'wall', name: 'ガーランド', price: 40, w: 110, h: 30 }, { id: 'f_wshelf', cat: 'furn', on: 'wall', name: 'かべの たな', price: 60, w: 60, h: 34 },
  { id: 'w_cream', cat: 'wall', name: 'クリーム', price: 0 }, { id: 'w_dots', cat: 'wall', name: 'みずたま', price: 60 }, { id: 'w_stripe', cat: 'wall', name: 'ストライプ', price: 60 },
  { id: 'w_haru', cat: 'wall', name: 'はる(さくら)', price: 80 }, { id: 'w_natsu', cat: 'wall', name: 'なつ(あおぞら)', price: 80 }, { id: 'w_aki', cat: 'wall', name: 'あき(もみじ)', price: 80 },
  { id: 'w_fuyu', cat: 'wall', name: 'ふゆ(ゆき)', price: 80 }, { id: 'w_yozora', cat: 'wall', name: 'よぞら', price: 120 },
  { id: 'y_wood', cat: 'floor', name: 'もくめ', price: 0 }, { id: 'y_check', cat: 'floor', name: 'チェック', price: 50 }, { id: 'y_shiba', cat: 'floor', name: 'しばふ', price: 70 }, { id: 'y_tile', cat: 'floor', name: 'タイル', price: 50 },
  { id: 'l_niji', cat: 'acc', slot: 'neck', name: 'にじの リボン', limited: 3 }, { id: 'l_hoshirug', cat: 'furn', on: 'floor', name: 'ほしぞらの ラグ', limited: 7, w: 96, h: 34, flat: true },
  { id: 'l_aurora', cat: 'wall', name: 'オーロラ', limited: 14 }, { id: 'l_kin', cat: 'acc', slot: 'head', name: 'きんの かんむり', limited: 30 }
];
function itemOf(id) { return ITEMS.find(function (i) { return i.id === id; }) || null; }
const SLOTS = ['head', 'face', 'neck'];
const ROOM = { w: 300, h: 240, floorY: 150 };

/* 称号。並び順は 公開後に 変えない(足すときは 末尾に足す。16個まで)。 */
function adults(S) { return S.pets.filter(function (p) { return stageOf(p) >= 4; }); }
function zukanCount(S) { return zukanKeys().filter(function (k) { return S.zukan[k]; }).length; }
const TITLES = [
  { id: 's3', name: '3日坊主卒業', how: '3日 つづけて ごはん', test: function (S) { return S.days.best >= 3; } },
  { id: 's7', name: '毎日の世話人', how: '7日 つづけて ごはん', test: function (S) { return S.days.best >= 7; } },
  { id: 's14', name: '二週間の相棒', how: '14日 つづけて ごはん', test: function (S) { return S.days.best >= 14; } },
  { id: 's30', name: 'ひと月の名人', how: '30日 つづけて ごはん', test: function (S) { return S.days.best >= 30; } },
  { id: 'z3', name: 'ずかん見習い', how: 'ずかんを 3つ 集める', test: function (S) { return zukanCount(S) >= 3; } },
  { id: 'z6', name: 'ずかん研究員', how: 'ずかんを 6つ 集める', test: function (S) { return zukanCount(S) >= 6; } },
  { id: 'z12', name: 'ずかん博士', how: 'ずかんを 12 集める', test: function (S) { return zukanCount(S) >= 12; } },
  { id: 'z15', name: 'ずかんの達人', how: 'ずかんを 全部 集める', test: function (S) { return zukanCount(S) >= 15; } },
  { id: 'p1', name: 'はじめての育て親', how: '1人を おとな(達人)まで 育てる', test: function (S) { return adults(S).length >= 1; } },
  { id: 'p2', name: 'なかよし育て親', how: '2人を おとな(達人)まで 育てる', test: function (S) { return adults(S).length >= 2; } },
  { id: 'p3', name: 'みんなの育て親', how: '3人を おとな(達人)まで 育てる', test: function (S) { return adults(S).length >= 3; } },
  { id: 'd10', name: 'こつこつ十日', how: 'ごはんの日が 合計 10日', test: function (S) { return S.days.total >= 10; } },
  { id: 'd30', name: 'こつこつ三十日', how: 'ごはんの日が 合計 30日', test: function (S) { return S.days.total >= 30; } },
  { id: 'lg', name: '伝説を見た者', how: 'だれかを 伝説の姿に する', test: function (S) { return S.pets.some(function (p) { return p.legend; }); } },
  { id: 'c10', name: '十問れんぞくの名手', how: '10問 つづけて 正解', test: function (S) { return S.stats.maxCombo >= 10; } }
];

/* ---------- 日付(端末の時計)---------- */
function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function dayNum(key) { const p = String(key).split('-').map(Number); if (p.length !== 3 || p.some(function (x) { return !isFinite(x); })) return NaN; return Math.round(new Date(p[0], p[1] - 1, p[2], 12).getTime() / 86400000); }
function daysBetween(a, b) { const d = dayNum(a) - dayNum(b); return isFinite(d) ? d : 0; }

/* ---------- 単元と問題(コースのデータから 自動で 取り出す)----------
   単元 = コースの 4つのダンジョン(城・隠しダンジョンを のぞく)。
   基本 = 草原の型 / 標準 = ダンジョン1階の型 / 応用 = 2階より先・ボス・魔王の城の型 / 発展 = 隠しダンジョンの型。
   草原の型が どの単元かは、コースの pet.basic(型ID → ダンジョンID)で決める。書いていない型は、その型を使うダンジョン、なければ 全部の単元。 */
function tid(ref) { return typeof ref === 'string' ? ref : ref.type; }
function uniqRefs(refs) { const seen = {}, out = []; refs.forEach(function (r) { const k = JSON.stringify(r); if (!seen[k]) { seen[k] = 1; out.push(r); } }); return out; }
function unitsOf(course) {
  const ds = course.dungeons, ids = Object.keys(ds), en = function (e) { return course.enemies[e] || { types: [] }; };
  const refsOf = function (eids) { let out = []; eids.forEach(function (e) { out = out.concat(en(e).types, en(e).phase2 ? en(e).phase2.types : []); }); return out; };
  const units = ids.filter(function (id) { return !ds[id].extra && !ds[id].need; }).slice(0, 4).map(function (id, i) {
    const d = ds[id], std = uniqRefs(refsOf(d.floors[0].enemies)), all = uniqRefs(refsOf([].concat.apply([], d.floors.map(function (f) { return f.enemies; })).concat([d.boss])));
    const own = {}; all.forEach(function (r) { own[tid(r)] = 1; });
    const stdIds = {}; std.forEach(function (r) { stdIds[tid(r)] = 1; });
    return { id: id, index: i, name: d.unit || d.name, place: d.name, basic: [], standard: std, advanced: all.filter(function (r) { return !stdIds[tid(r)]; }), own: own };
  });
  const byId = {}; units.forEach(function (u) { byId[u.id] = u; });
  const map = (course.pet && course.pet.basic) || {};
  Object.keys(course.zones || {}).forEach(function (z) {
    refsOf(course.zones[z].enemies).forEach(function (ref) {
      const t = tid(ref); let to = map[t];
      if (to === undefined) { to = units.filter(function (u) { return u.own[t]; }).map(function (u) { return u.id; }); if (!to.length) to = units.map(function (u) { return u.id; }); }
      [].concat(to).forEach(function (uid) { if (byId[uid]) byId[uid].basic.push(ref); });
    });
  });
  /* 魔王の城(need のある ダンジョン)の型は 応用。城だけの型は、同じ敵が持つ ほかの型の単元に 入れる */
  ids.filter(function (id) { return !ds[id].extra && ds[id].need; }).forEach(function (id) {
    const d = ds[id], eids = uniqRefs([].concat.apply([], d.floors.map(function (f) { return f.enemies; })).concat([d.boss]));
    eids.forEach(function (e) {
      const refs = refsOf([e]);
      refs.forEach(function (ref) {
        let to = units.filter(function (u) { return u.own[tid(ref)]; });
        if (!to.length) { const sib = refs.filter(function (r) { return units.some(function (u) { return u.own[tid(r)]; }); })[0]; to = sib ? units.filter(function (u) { return u.own[tid(sib)]; }).slice(0, 1) : units; }
        to.forEach(function (u) { u.advanced.push(ref); });
      });
    });
  });
  units.forEach(function (u) {
    u.basic = uniqRefs(u.basic); u.advanced = uniqRefs(u.advanced);
    if (!u.basic.length) {                                                        // 草原に その単元の型が ないとき: 1階の はじめの敵の型を 基本に、のこりを 標準にする
      const d = ds[u.id], first = uniqRefs(refsOf([d.floors[0].enemies[0]])), fid = {}; first.forEach(function (r) { fid[tid(r)] = 1; });
      const rest = u.standard.filter(function (r) { return !fid[tid(r)]; });
      u.basic = first; u.standard = rest.length ? rest : (u.advanced.length ? u.advanced.slice(0, 3) : first);
    }
    if (!u.advanced.length) u.advanced = u.standard.slice();
  });
  return units;
}
/* 発展(隠しダンジョン)の型 */
function legendPool(course) {
  const ds = course.dungeons; let out = [];
  Object.keys(ds).filter(function (id) { return ds[id].extra; }).forEach(function (id) {
    const d = ds[id]; [].concat.apply([], d.floors.map(function (f) { return f.enemies; })).concat([d.boss]).forEach(function (e) { const E = course.enemies[e]; if (E) out = out.concat(E.types, E.phase2 ? E.phase2.types : []); });
  });
  return uniqRefs(out);
}
function selectedUnits(S, units) { const on = units.filter(function (u) { return S.units[u.id] !== false; }); return on.length ? on : units; }
/* 問題の候補(tier: basic / standard / advanced)。もどり値は [{ ref, unit, tier }] */
function poolOf(units, tier) { const out = []; units.forEach(function (u) { u[tier].forEach(function (ref) { out.push({ ref: ref, unit: u.id, tier: tier }); }); }); return out; }
/* 候補から 1つ。直前と同じ型を さけ、まだ出していない型・まちがえた型(review)を 出やすくする */
function pickFrom(cands, rng, prevType, used, review) {
  let list = cands.filter(function (c) { return tid(c.ref) !== prevType; });
  if (!list.length) list = cands;
  if (!list.length) return null;
  const least = Math.min.apply(null, list.map(function (c) { return used[tid(c.ref)] || 0; }));
  list = list.filter(function (c) { return (used[tid(c.ref)] || 0) === least; });
  const ws = list.map(function (c) { return 1 + 2 * Math.min(2, (review || []).filter(function (x) { return x === tid(c.ref); }).length); });
  let x = rng.next() * ws.reduce(function (a, b) { return a + b; }, 0);
  for (let i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) return list[i]; }
  return list[list.length - 1];
}
/* 今日のごはん: 基本 3〜4問 + 標準 1〜2問。同じ型が 続かないように 並べる */
function pickMeal(units, rng, n, review) {
  n = n === undefined ? MEAL : n;
  const B = poolOf(units, 'basic'), S2 = poolOf(units, 'standard'), kinds = function (l) { const s = {}; l.forEach(function (c) { s[tid(c.ref)] = 1; }); return Object.keys(s).length; };
  let pattern;
  if (!S2.length) pattern = 'BBBBB'; else if (!B.length) pattern = 'SSSSS';
  else if (kinds(B) < 2) pattern = 'BSBSB';                                     // 基本の型が 1つだけ: 標準と かわりばんこ
  else pattern = rng.chance(0.5) ? 'BBBBS' : 'BBSBS';
  pattern = pattern.slice(MEAL - n);
  const out = [], used = {}; let prev = null;
  for (let i = 0; i < pattern.length; i++) {
    const main = pattern[i] === 'B' ? B : S2, other = pattern[i] === 'B' ? S2 : B;
    let c = pickFrom(main.filter(function (x) { return tid(x.ref) !== prev; }), rng, prev, used, review) || pickFrom(other.filter(function (x) { return tid(x.ref) !== prev; }), rng, prev, used, review) || pickFrom(main, rng, null, used, review);
    if (!c) break;
    out.push(c); prev = tid(c.ref); used[prev] = (used[prev] || 0) + 1;
  }
  return out;
}
/* おやつ・伝説への挑戦の 1問 */
function pickSnack(units, tier, rng, prevType, review) { return pickFrom(poolOf(units, tier), rng, prevType, {}, review); }
function pickLegend(course, rng, prevType, review) { return pickFrom(legendPool(course).map(function (r) { return { ref: r, unit: null, tier: 'legend' }; }), rng, prevType, {}, review); }

/* ---------- 記録(セーブデータ)---------- */
function newPet(kind, look, name, now) {
  return { kind: kindOf(kind).id, look: fixLook(kind, look), name: String(name || 'なまえ').slice(0, 6), gp: 0, branch: null, legend: false, lg: 0, unitOk: {}, acc: {}, born: dayKey(now || new Date()) };
}
function newState(courseId) {
  return { v: 1, ver: P.version, course: courseId, pets: [], cur: 0, coins: 0, combo: 0,
    days: { last: null, streak: 0, best: 0, total: 0, stamps: [] }, today: { date: null, fed: 0, done: false, snack: 0 },
    units: {}, stats: { types: {}, units: {}, mistakes: {}, correct: 0, wrong: 0, maxCombo: 0 }, review: [],
    owned: { w_cream: 1, y_wood: 1 }, room: { wall: 'w_cream', floor: 'y_wood', placed: [] }, zukan: {}, titles: [], title: null, rewards: {},
    sound: false, figChoice: false, seen: {} };
}
function stageOf(pet) { if (!pet) return 1; if (pet.legend) return 5; let s = 1; for (let i = 1; i < GROW.length; i++) if (pet.gp >= GROW[i]) s = i + 1; return s; }
function stageName(pet) { return kindOf(pet.kind).stages[stageOf(pet) - 1]; }
/* 成長ゲージ: { now, need, label }。段階4 のあとは 伝説への 進み具合 */
function gauge(pet) {
  const s = stageOf(pet);
  if (s >= 5) return { now: 1, need: 1, label: 'さいごの姿まで 育った!' };
  if (s === 4) return { now: Math.min(pet.lg, LEGEND_NEED), need: LEGEND_NEED, label: '伝説まで 発展問題 あと ' + Math.max(0, LEGEND_NEED - pet.lg) + '問' };
  return { now: pet.gp - GROW[s - 1], need: GROW[s] - GROW[s - 1], label: 'つぎの姿まで あと ' + (GROW[s] - pet.gp) + '問' };
}
/* 進化の分かれ道: この子が いちばん多く 正解した単元(同じ数なら 単元の並び順で 先のもの)*/
function decideBranch(pet, units) {
  let best = 0, bn = -1;
  units.forEach(function (u, i) { const n = (pet.unitOk && pet.unitOk[u.id]) || 0; if (n > bn) { bn = n; best = i; } });
  return Math.min(best, BRANCH.length - 1);
}
/* 日付が かわったら 今日の記録を 新しくする。もどり値 { newDay, away(さいごの ごはんから 何日)} */
function touch(S, now) {
  const t = dayKey(now), r = { newDay: false, away: 0 };
  if (S.today.date !== t) { r.newDay = true; S.today = { date: t, fed: 0, done: false, snack: 0 }; }
  r.away = S.days.last ? daysBetween(t, S.days.last) : 0;
  if (r.away >= 2 || r.away < 0) S.days.streak = 0;                              // 連続は とぎれる(合計・最高記録・成長は そのまま)
  return r;
}
/* 気分: fine(元気)/ hungry(今日の ごはんが まだ)/ lonely(2日以上 ごはんが ない)。ごはんを あげれば すぐ fine に もどる */
function mood(S, now) {
  if (!S.pets.length) return 'fine';
  const t = dayKey(now);
  if (S.today.date === t && S.today.done) return 'fine';
  const since = S.days.last || S.pets[0].born;
  return daysBetween(t, since) >= 2 ? 'lonely' : 'hungry';
}
function checkTitles(S) { const got = []; TITLES.forEach(function (t) { if (S.titles.indexOf(t.id) < 0 && t.test(S)) { S.titles.push(t.id); got.push(t); } }); if (!S.title && S.titles.length) S.title = S.titles[0]; return got; }
function titleName(id) { const t = TITLES.find(function (x) { return x.id === id; }); return t ? t.name : ''; }
function registerZukan(S, pet) {
  const out = [];
  if (stageOf(pet) >= 4 && pet.branch !== null) { const k = pet.kind + ':' + pet.branch; if (!S.zukan[k]) { S.zukan[k] = { look: pet.look.slice(), name: pet.name }; out.push(k); } }
  if (pet.legend) { const k = pet.kind + ':L'; if (!S.zukan[k]) { S.zukan[k] = { look: pet.look.slice(), name: pet.name, branch: pet.branch }; out.push(k); } }
  return out;
}
/* 1問の結果を 記録する。ctx = { mode: 'meal' | 'snack' | 'legend', type, unit }。
   もどり値(画面の演出用): { coins, grew, mealDone, stageFrom, stageTo, branch, legend, rewards, titles, zukan } */
function record(S, units, ctx, correct, tag, now) {
  touch(S, now);
  const pet = S.pets[S.cur], ev = { coins: 0, grew: false, mealDone: false, stageFrom: stageOf(pet), stageTo: stageOf(pet), branch: null, legend: false, rewards: [], titles: [], zukan: [] };
  const st = S.stats.types[ctx.type] || (S.stats.types[ctx.type] = [0, 0]), su = ctx.unit ? (S.stats.units[ctx.unit] || (S.stats.units[ctx.unit] = [0, 0])) : [0, 0];
  if (!correct) {
    st[1]++; su[1]++; S.stats.wrong++; S.combo = 0;
    if (tag) S.stats.mistakes[tag] = (S.stats.mistakes[tag] || 0) + 1;
    S.review.push(ctx.type); if (S.review.length > 12) S.review.shift();
    return ev;                                                                     // まちがえても 何も へらない
  }
  st[0]++; su[0]++; S.stats.correct++; S.combo++; S.stats.maxCombo = Math.max(S.stats.maxCombo, S.combo);
  const ri = S.review.indexOf(ctx.type); if (ri >= 0) S.review.splice(ri, 1);
  if (ctx.unit) pet.unitOk[ctx.unit] = (pet.unitOk[ctx.unit] || 0) + 1;
  ev.coins = COIN.base + (S.combo >= 5 ? COIN.combo5 : S.combo >= 3 ? COIN.combo3 : 0) + (ctx.mode === 'legend' ? COIN.legend : 0);
  if (ctx.mode === 'meal' && S.today.fed < MEAL) {
    S.today.fed++; pet.gp++; ev.grew = true;
    if (S.today.fed >= MEAL) {
      const t = dayKey(now), gap = S.days.last ? daysBetween(t, S.days.last) : null;
      S.today.done = true; ev.mealDone = true; ev.coins += COIN.meal;
      if (gap !== 0) { S.days.streak = gap === 1 ? S.days.streak + 1 : 1; S.days.total++; }
      S.days.last = t; S.days.best = Math.max(S.days.best, S.days.streak);
      if (S.days.stamps.indexOf(t) < 0) { S.days.stamps.push(t); if (S.days.stamps.length > 400) S.days.stamps.shift(); }
      STREAK_REWARDS.forEach(function (r) { if (S.days.streak >= r.days && !S.rewards[r.days]) { S.rewards[r.days] = 1; S.owned[r.item] = 1; ev.coins += r.coins; ev.rewards.push(r); } });
    }
  } else if (ctx.mode === 'legend') {
    if (stageOf(pet) === 4) { pet.lg++; if (pet.lg >= LEGEND_NEED) { pet.legend = true; ev.legend = true; } }
  } else S.today.snack++;                                                           // おやつ(と 6問目から): コインだけ
  S.coins = Math.min(COIN.max, S.coins + ev.coins);
  ev.stageTo = stageOf(pet);
  if (ev.stageTo >= 4 && pet.branch === null) { pet.branch = decideBranch(pet, units); ev.branch = pet.branch; }
  ev.zukan = registerZukan(S, pet);
  ev.titles = checkTitles(S);
  return ev;
}
/* 新しい なかまを むかえられるか(いまの子が みんな 段階4 以上)。kinds は えらべる種類 */
function adoptInfo(S) {
  const raised = {}; S.pets.forEach(function (p) { raised[p.kind] = 1; });
  const fresh = KINDS.filter(function (k) { return !raised[k.id]; }).map(function (k) { return k.id; });
  const can = S.pets.length === 0 || (S.pets.length < MAX_PETS && S.pets.every(function (p) { return stageOf(p) >= 4; }));
  return { can: can, kinds: S.pets.length === 0 || !fresh.length ? KINDS.map(function (k) { return k.id; }) : fresh, full: S.pets.length >= MAX_PETS };
}
function adopt(S, kind, look, name, now) {
  const info = adoptInfo(S); if (!info.can || info.kinds.indexOf(kindOf(kind).id) < 0) return null;
  const pet = newPet(kind, look, name, now); S.pets.push(pet); S.cur = S.pets.length - 1; return pet;
}
/* かがみ: 見た目だけ 変える(成長は そのまま)*/
function restyle(pet, look, name) { pet.look = fixLook(pet.kind, look); if (name) pet.name = String(name).slice(0, 6); return pet; }
function buy(S, id) {
  const it = itemOf(id);
  if (!it || it.limited) return { ok: false, why: 'この品物は お店では 買えない' };
  if (S.owned[id]) return { ok: false, why: 'もう 持っている' };
  if (S.coins < it.price) return { ok: false, why: 'コインが あと ' + (it.price - S.coins) + ' 足りない' };
  S.coins -= it.price; S.owned[id] = 1; return { ok: true };
}
function wear(S, petIndex, id) {
  const it = itemOf(id), pet = S.pets[petIndex];
  if (!it || it.cat !== 'acc' || !S.owned[id] || !pet) return false;
  if (pet.acc[it.slot] === id) delete pet.acc[it.slot]; else pet.acc[it.slot] = id;
  return true;
}
/* 家具を置く(x, y は 家具の まん中下。壁の家具は 壁、床の家具は 床に おさまるように 直す)。もう置いてあれば 動かす */
function place(S, id, x, y) {
  const it = itemOf(id); if (!it || it.cat !== 'furn' || !S.owned[id]) return null;
  const hw = it.w / 2; x = Math.round(Math.max(hw + 2, Math.min(ROOM.w - hw - 2, x)));
  y = it.on === 'wall' ? Math.round(Math.max(it.h + 6, Math.min(ROOM.floorY - 12, y))) : Math.round(Math.max(ROOM.floorY + (it.flat ? it.h : 8), Math.min(ROOM.h - 4, y)));
  let pl = S.room.placed.find(function (p) { return p.id === id; });
  if (!pl) { pl = { id: id, x: x, y: y }; S.room.placed.push(pl); } else { pl.x = x; pl.y = y; }
  return pl;
}
function unplace(S, id) { S.room.placed = S.room.placed.filter(function (p) { return p.id !== id; }); }
function setRoom(S, id) { const it = itemOf(id); if (!it || !S.owned[id] || (it.cat !== 'wall' && it.cat !== 'floor')) return false; S.room[it.cat] = id; return true; }

/* ---------- セーブの読み書き(版が上がっても、項目が足りなくても 消さない)---------- */
function num(v, d, lo, hi) { v = Number(v); if (!isFinite(v)) return d; return Math.max(lo, Math.min(hi, Math.floor(v))); }
function restore(raw, courseId) {
  let d; try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
  if (!d || typeof d !== 'object' || !d.v) return null;
  const S = newState(courseId), obj = function (x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; };
  S.pets = (Array.isArray(d.pets) ? d.pets : []).filter(function (p) { return p && typeof p === 'object'; }).slice(0, MAX_PETS).map(function (p) {
    const q = newPet(p.kind, p.look, p.name); q.gp = num(p.gp, 0, 0, 9999); q.lg = num(p.lg, 0, 0, 99); q.legend = !!p.legend && q.gp >= GROW[3];
    q.branch = Number.isInteger(p.branch) && p.branch >= 0 && p.branch < BRANCH.length ? p.branch : null; q.unitOk = obj(p.unitOk); q.born = typeof p.born === 'string' ? p.born : q.born;
    SLOTS.forEach(function (s) { const a = obj(p.acc)[s], it = itemOf(a); if (it && it.cat === 'acc' && it.slot === s) q.acc[s] = a; });
    return q;
  });
  S.cur = num(d.cur, 0, 0, Math.max(0, S.pets.length - 1)); S.coins = num(d.coins, 0, 0, COIN.max); S.combo = num(d.combo, 0, 0, 9999);
  const dd = obj(d.days); S.days = { last: typeof dd.last === 'string' && isFinite(dayNum(dd.last)) ? dd.last : null, streak: num(dd.streak, 0, 0, 9999), best: num(dd.best, 0, 0, 9999), total: num(dd.total, 0, 0, 99999),
    stamps: (Array.isArray(dd.stamps) ? dd.stamps : []).filter(function (s) { return typeof s === 'string' && isFinite(dayNum(s)); }).slice(-400) };
  S.days.best = Math.max(S.days.best, S.days.streak);
  const td = obj(d.today); S.today = { date: typeof td.date === 'string' ? td.date : null, fed: num(td.fed, 0, 0, MEAL), done: !!td.done, snack: num(td.snack, 0, 0, 99999) };
  S.units = obj(d.units);
  const st = obj(d.stats); S.stats = { types: obj(st.types), units: obj(st.units), mistakes: obj(st.mistakes), correct: num(st.correct, 0, 0, 1e9), wrong: num(st.wrong, 0, 0, 1e9), maxCombo: num(st.maxCombo, 0, 0, 1e6) };
  S.review = (Array.isArray(d.review) ? d.review : []).filter(function (x) { return typeof x === 'string'; }).slice(-12);
  Object.keys(obj(d.owned)).forEach(function (id) { if (itemOf(id) && d.owned[id]) S.owned[id] = 1; });
  const rm = obj(d.room);
  if (S.owned[rm.wall] && itemOf(rm.wall).cat === 'wall') S.room.wall = rm.wall;
  if (S.owned[rm.floor] && itemOf(rm.floor).cat === 'floor') S.room.floor = rm.floor;
  (Array.isArray(rm.placed) ? rm.placed : []).forEach(function (p) { if (p && S.owned[p.id]) place(S, p.id, num(p.x, 150, 0, ROOM.w), num(p.y, 200, 0, ROOM.h)); });
  const zk = obj(d.zukan); zukanKeys().forEach(function (k) { if (zk[k]) { const kd = k.split(':')[0]; S.zukan[k] = { look: fixLook(kd, obj(zk[k]).look), name: String(obj(zk[k]).name || ''), branch: Number.isInteger(obj(zk[k]).branch) ? obj(zk[k]).branch : undefined }; } });
  S.titles = (Array.isArray(d.titles) ? d.titles : []).filter(function (t) { return titleName(t); });
  S.title = S.titles.indexOf(d.title) >= 0 ? d.title : (S.titles[0] || null);
  S.rewards = obj(d.rewards); S.sound = !!d.sound; S.figChoice = !!d.figChoice; S.seen = obj(d.seen);
  S.pets.forEach(function (p) { registerZukan(S, p); });
  return S;
}

/* ---------- 記録のことば(RPG と同じ ひらがな 64文字。長さは なかまの数で 変わる)---------- */
const PW = M.password.alphabet, PW_BASE = dayNum('2026-1-1');
function hashStr(s) { let h = 11; for (let i = 0; i < s.length; i++) h = (h * 37 + s.charCodeAt(i)) % 4093; return h; }
function nameOk(name) { const a = Array.from(String(name || '')); return a.length >= 1 && a.length <= 6 && a.every(function (c) { const k = c.charCodeAt(0); return c.length === 1 && k >= 0x3041 && k <= 0x30fe; }); }
function pwEncode(course, S) {
  const bits = [], put = function (v, n) { v = Math.max(0, Math.min(Math.pow(2, n) - 1, Math.floor(v) || 0)); for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(v / Math.pow(2, i)) % 2); };
  const idx = function (id) { return ITEMS.findIndex(function (i) { return i.id === id; }) + 1; }, units = unitsOf(course), zk = zukanKeys();
  put(1, 3); put(S.pets.length, 3); put(S.cur, 3); put(S.coins, 14); put(S.days.streak, 6); put(S.days.best, 8); put(S.days.total, 10);
  put(S.days.last ? Math.max(0, dayNum(S.days.last) - PW_BASE) + 1 : 0, 13);
  zk.forEach(function (k) { put(S.zukan[k] ? 1 : 0, 1); });
  for (let i = 0; i < 16; i++) put(TITLES[i] && S.titles.indexOf(TITLES[i].id) >= 0 ? 1 : 0, 1);
  put(S.title ? TITLES.findIndex(function (t) { return t.id === S.title; }) + 1 : 0, 5);
  STREAK_REWARDS.forEach(function (r) { put(S.rewards[r.days] ? 1 : 0, 1); });
  for (let i = 0; i < 48; i++) put(ITEMS[i] && S.owned[ITEMS[i].id] ? 1 : 0, 1);
  put(idx(S.room.wall), 6); put(idx(S.room.floor), 6);
  for (let i = 0; i < 4; i++) put(units[i] && S.units[units[i].id] === false ? 0 : 1, 1);
  S.pets.forEach(function (p) {
    const nmc = Array.from(p.name).slice(0, 6);
    put(KINDS.findIndex(function (k) { return k.id === p.kind; }), 2);
    for (let i = 0; i < 5; i++) put(p.look[i] || 0, 3);
    put(nmc.length, 3); nmc.forEach(function (c) { put(c.charCodeAt(0) - 0x3040, 8); });
    put(Math.min(p.gp, 63), 6); put(p.branch === null ? 0 : p.branch + 1, 3); put(p.legend ? 1 : 0, 1); put(Math.min(p.lg, 15), 4);
    SLOTS.forEach(function (s) { put(idx(p.acc[s]), 6); });
  });
  while (bits.length % 6) bits.push(0);
  const vals = []; for (let i = 0; i < bits.length; i += 6) vals.push(bits.slice(i, i + 6).reduce(function (a, b) { return a * 2 + b; }, 0));
  let sum = hashStr('pet:' + course.id); vals.forEach(function (v, i) { sum = (sum * 31 + v + i) % 4096; });
  vals.push(sum >> 6, sum & 63);
  return vals.map(function (v) { return PW[v]; }).join('');
}
/* もどり値は 新しい記録(state)。読めないときは null */
function pwDecode(course, text, now) {
  const vals = Array.from(String(text)).map(function (c) { return PW.indexOf(c); }).filter(function (v) { return v >= 0; });
  if (vals.length < 10) return null;
  const body = vals.slice(0, -2); let sum = hashStr('pet:' + course.id);
  body.forEach(function (v, i) { sum = (sum * 31 + v + i) % 4096; });
  if ((sum >> 6) !== vals[vals.length - 2] || (sum & 63) !== vals[vals.length - 1]) return null;
  const bits = []; body.forEach(function (v) { for (let i = 5; i >= 0; i--) bits.push((v >> i) & 1); });
  let p = 0, short = false; const get = function (n) { let v = 0; for (let i = 0; i < n; i++) { if (p >= bits.length) short = true; v = v * 2 + (bits[p++] || 0); } return v; };
  if (get(3) !== 1) return null;
  const S = newState(course.id), np = get(3), units = unitsOf(course), item = function (i) { return i > 0 && ITEMS[i - 1] ? ITEMS[i - 1].id : null; };
  if (np < 1 || np > MAX_PETS) return null;
  S.cur = Math.min(get(3), np - 1); S.coins = Math.min(COIN.max, get(14)); S.days.streak = get(6); S.days.best = Math.max(get(8), S.days.streak); S.days.total = get(10);
  const last = get(13); S.days.last = last ? (function () { const d = new Date((PW_BASE + last - 1) * 86400000); return dayKey(d); })() : null;
  const zk = zukanKeys().filter(function () { return get(1); });
  for (let i = 0; i < 16; i++) if (get(1) && TITLES[i]) S.titles.push(TITLES[i].id);
  const ti = get(5); S.title = ti && TITLES[ti - 1] && S.titles.indexOf(TITLES[ti - 1].id) >= 0 ? TITLES[ti - 1].id : (S.titles[0] || null);
  STREAK_REWARDS.forEach(function (r) { if (get(1)) S.rewards[r.days] = 1; });
  for (let i = 0; i < 48; i++) if (get(1) && ITEMS[i]) S.owned[ITEMS[i].id] = 1;
  const w = item(get(6)), f = item(get(6)); if (w && S.owned[w] && itemOf(w).cat === 'wall') S.room.wall = w; if (f && S.owned[f] && itemOf(f).cat === 'floor') S.room.floor = f;
  for (let i = 0; i < 4; i++) { const on = get(1); if (units[i] && !on) S.units[units[i].id] = false; }
  for (let k = 0; k < np; k++) {
    const kind = (KINDS[get(2)] || KINDS[0]).id, look = []; for (let i = 0; i < 5; i++) look.push(get(3));
    const len = get(3); let name = ''; for (let i = 0; i < len; i++) name += String.fromCharCode(get(8) + 0x3040);
    const pet = newPet(kind, look, name, now); pet.gp = get(6); const br = get(3); pet.branch = br ? Math.min(br - 1, BRANCH.length - 1) : null; pet.legend = !!get(1) && pet.gp >= GROW[3]; pet.lg = get(4);
    if (pet.gp >= GROW[3] && pet.branch === null) pet.branch = 0;
    SLOTS.forEach(function (s) { const a = item(get(6)), it = itemOf(a); if (it && it.cat === 'acc' && it.slot === s && S.owned[a]) pet.acc[s] = a; });
    if (!nameOk(pet.name)) return null;
    S.pets.push(pet);
  }
  if (short) return null;
  zk.forEach(function (key) { const kd = key.split(':')[0], own = S.pets.find(function (q) { return q.kind === kd; }); S.zukan[key] = { look: own ? own.look.slice() : fixLook(kd, null), name: own ? own.name : '' }; });
  S.pets.forEach(function (q) { registerZukan(S, q); });
  if (now && S.days.last === dayKey(now)) S.today = { date: dayKey(now), fed: MEAL, done: true, snack: 0 };      // 今日の ごはんが すんでいたら、すんだままにする
  return S;
}

P.MEAL = MEAL; P.GROW = GROW; P.LEGEND_NEED = LEGEND_NEED; P.MAX_PETS = MAX_PETS; P.COIN = COIN; P.STREAK_REWARDS = STREAK_REWARDS; P.BRANCH = BRANCH; P.KINDS = KINDS; P.ITEMS = ITEMS; P.TITLES = TITLES; P.ROOM = ROOM; P.SLOTS = SLOTS;
P.kindOf = kindOf; P.lookCount = lookCount; P.fixLook = fixLook; P.formName = formName; P.zukanKeys = zukanKeys; P.itemOf = itemOf; P.dayKey = dayKey; P.daysBetween = daysBetween;
P.units = unitsOf; P.legendPool = legendPool; P.selectedUnits = selectedUnits; P.pickMeal = pickMeal; P.pickSnack = pickSnack; P.pickLegend = pickLegend; P.typeId = tid;
P.newState = newState; P.newPet = newPet; P.stageOf = stageOf; P.stageName = stageName; P.gauge = gauge; P.decideBranch = decideBranch; P.touch = touch; P.mood = mood; P.record = record;
P.checkTitles = checkTitles; P.titleName = titleName; P.adoptInfo = adoptInfo; P.adopt = adopt; P.restyle = restyle; P.buy = buy; P.wear = wear; P.place = place; P.unplace = unplace; P.setRoom = setRoom;
/* はじめからやり直す: そのコースの ペットの記録だけを 消す(RPG の mathrpg: や、ほかのコースの記録は さわらない)*/
function saveKeys(courseId) { const k = 'mathpet:' + courseId; return [k, k + ':bak', k + ':broken']; }
function wipeSave(storage, courseId) { const keys = saveKeys(courseId); keys.forEach(function (k) { try { storage.removeItem(k); } catch (e) { /* 消せない端末でも 止まらない */ } }); return keys; }
P.saveKeys = saveKeys; P.wipeSave = wipeSave;
P.restore = restore; P.nameOk = nameOk; P.password = { encode: pwEncode, decode: pwDecode };

/* ===== 2. 絵(SVG を コードで かく。画像ファイルは 使わない)=====
   キャラクターは 120×120 の わくに かく(足もとは y = 108)。部品(形・色・目・もよう・髪型など)を 組み合わせる。 */
const OL = '#6b5a66', INK = '#4a3f48', GOLD = '#ffd94a', GOLDD = '#e0a820';
const ST = ' stroke="' + OL + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
let UID = 0;
function nid(p) { UID++; return p + UID; }
function f(n) { return Math.round(n * 10) / 10; }
function ci(cx, cy, r, fill, ex) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex === undefined ? ST : ex) + '/>'; }
function el(cx, cy, rx, ry, fill, ex, rot) { return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '"' + (ex === undefined ? ST : ex) + (rot ? ' transform="rotate(' + rot + ' ' + f(cx) + ' ' + f(cy) + ')"' : '') + '/>'; }
function pa(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex === undefined ? ST : ex) + '/>'; }
function ln(d, color, w) { return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
function rc(x, y, w, h, r, fill, ex) { return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + f(r) + '" fill="' + fill + '"' + (ex === undefined ? ST : ex) + '/>'; }
function starPts(cx, cy, r, n, inner) { const p = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * inner : r; p.push(f(cx + rr * Math.cos(a)) + ',' + f(cy + rr * Math.sin(a))); } return p.join(' '); }
function star(cx, cy, r, fill, ex) { return '<polygon points="' + starPts(cx, cy, r, 5, 0.48) + '" fill="' + fill + '"' + (ex === undefined ? ' stroke="' + OL + '" stroke-width="1.6" stroke-linejoin="round"' : ex) + '/>'; }
function spark(cx, cy, r, fill) { return '<polygon points="' + starPts(cx, cy, r, 4, 0.36) + '" fill="' + fill + '" stroke="none"/>'; }
function heart(cx, cy, s, fill, ex) { return pa('M' + f(cx) + ' ' + f(cy + 3 * s) + ' C' + f(cx - 6 * s) + ' ' + f(cy - 1 * s) + ' ' + f(cx - 3 * s) + ' ' + f(cy - 5 * s) + ' ' + f(cx) + ' ' + f(cy - 2 * s) + ' C' + f(cx + 3 * s) + ' ' + f(cy - 5 * s) + ' ' + f(cx + 6 * s) + ' ' + f(cy - 1 * s) + ' ' + f(cx) + ' ' + f(cy + 3 * s) + ' Z', fill, ex === undefined ? ' stroke="none"' : ex); }
function leaf(x, y, len, ang, fill) { return '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + ang + ')">' + pa('M0 0 C' + f(len * 0.5) + ' ' + f(-len * 0.45) + ' ' + f(len * 0.9) + ' ' + f(-len * 0.3) + ' ' + f(len) + ' 0 C' + f(len * 0.9) + ' ' + f(len * 0.3) + ' ' + f(len * 0.5) + ' ' + f(len * 0.45) + ' 0 0 Z', fill, ' stroke="' + OL + '" stroke-width="1.6" stroke-linejoin="round"') + ln('M' + f(len * 0.15) + ' 0 L' + f(len * 0.8) + ' 0', 'rgba(255,255,255,.6)', 1) + '</g>'; }
function grp(inner, tf) { return '<g' + (tf ? ' transform="' + tf + '"' : '') + '>' + inner + '</g>'; }
function mirror(inner) { return grp(inner, 'translate(120 0) scale(-1 1)'); }
function tower(x, y, s, fill, dark) {                 // 小さな塔(x, y は 土台の まん中下)
  return rc(x - 5 * s, y - 9 * s, 10 * s, 9 * s, 1, fill, ' stroke="' + OL + '" stroke-width="1.6"') + rc(x - 3.6 * s, y - 16 * s, 7.2 * s, 7 * s, 1, fill, ' stroke="' + OL + '" stroke-width="1.6"') +
    pa('M' + f(x - 5 * s) + ' ' + f(y - 16 * s) + ' L' + f(x) + ' ' + f(y - 24 * s) + ' L' + f(x + 5 * s) + ' ' + f(y - 16 * s) + ' Z', dark, ' stroke="' + OL + '" stroke-width="1.6" stroke-linejoin="round"') + rc(x - 1.2 * s, y - 13.5 * s, 2.4 * s, 3 * s, 1, '#fff8d0', ' stroke="none"');
}
function waveCurl(x, y, s, fill) { return pa('M' + f(x - 9 * s) + ' ' + f(y) + ' C' + f(x - 9 * s) + ' ' + f(y - 15 * s) + ' ' + f(x + 11 * s) + ' ' + f(y - 17 * s) + ' ' + f(x + 11 * s) + ' ' + f(y - 5 * s) + ' C' + f(x + 11 * s) + ' ' + f(y + 1 * s) + ' ' + f(x + 3 * s) + ' ' + f(y + 1 * s) + ' ' + f(x + 3 * s) + ' ' + f(y - 4 * s) + ' C' + f(x + 3 * s) + ' ' + f(y - 8 * s) + ' ' + f(x - 2 * s) + ' ' + f(y - 7 * s) + ' ' + f(x - 1 * s) + ' ' + f(y) + ' Z', fill); }
/* 顔: 目(5種類)・口・ほっぺ。mood = fine / happy / eat / hungry / lonely / sleep */
function face(cx, cy, gap, eye, mood, s, o) {
  o = o || {}; let h = '';
  const happy = mood === 'happy' || mood === 'eat', sleep = mood === 'sleep', lw = f(1.8 * s);
  [-1, 1].forEach(function (dir) {
    const x = cx + dir * gap, y = cy;
    if (sleep) h += ln('M' + f(x - 3.2 * s) + ' ' + f(y) + ' Q' + f(x) + ' ' + f(y + 3 * s) + ' ' + f(x + 3.2 * s) + ' ' + f(y), INK, lw);
    else if (happy) h += ln('M' + f(x - 3.2 * s) + ' ' + f(y + 1 * s) + ' Q' + f(x) + ' ' + f(y - 3.8 * s) + ' ' + f(x + 3.2 * s) + ' ' + f(y + 1 * s), INK, lw);
    else if (eye === 1) h += el(x, y, 2.8 * s, 3.5 * s, INK, ' stroke="none"', dir * 16) + ci(x - 0.8 * s, y - 1.2 * s, 1 * s, '#fff', ' stroke="none"');
    else if (eye === 2) h += ci(x, y, 4 * s, INK, ' stroke="none"') + ci(x - 1.3 * s, y - 1.4 * s, 1.5 * s, '#fff', ' stroke="none"') + ci(x + 1.4 * s, y + 1.3 * s, 0.8 * s, '#fff', ' stroke="none"');
    else if (eye === 3) h += ci(x, y, 1.9 * s, INK, ' stroke="none"');
    else if (eye === 4) h += pa('M' + f(x - 3.2 * s) + ' ' + f(y - 0.6 * s) + ' A' + f(3.2 * s) + ' ' + f(3.2 * s) + ' 0 0 0 ' + f(x + 3.2 * s) + ' ' + f(y - 0.6 * s) + ' Z', INK, ' stroke="none"') + ln('M' + f(x - 3.8 * s) + ' ' + f(y - 0.8 * s) + ' L' + f(x + 3.8 * s) + ' ' + f(y - 0.8 * s), INK, f(1.4 * s));
    else h += ci(x, y, 3.1 * s, INK, ' stroke="none"') + ci(x - 1 * s, y - 1.1 * s, 1.1 * s, '#fff', ' stroke="none"');
    if (mood === 'lonely') h += ln('M' + f(x - dir * 3 * s) + ' ' + f(y - 7 * s) + ' L' + f(x + dir * 3 * s) + ' ' + f(y - 5.2 * s), INK, f(1.4 * s));
  });
  if (mood === 'lonely') h += pa('M' + f(cx + gap + 3.4 * s) + ' ' + f(cy + 2 * s) + ' q' + f(-2 * s) + ' ' + f(3.4 * s) + ' 0 ' + f(4.6 * s) + ' q' + f(2 * s) + ' ' + f(-1.2 * s) + ' 0 ' + f(-4.6 * s) + ' Z', '#8fd0f4', ' stroke="none"');
  if (!o.noCheek && !sleep) [-1, 1].forEach(function (dir) { h += el(cx + dir * (gap + 4.6 * s), cy + 4.2 * s, 3.2 * s, 2 * s, '#ff9db0', ' stroke="none" opacity="0.55"'); });
  const my = cy + (o.mouthY || 6.5) * s;
  if (o.beak) {
    const open = mood === 'eat' || mood === 'hungry' || mood === 'happy';
    h += pa('M' + f(cx - 4 * s) + ' ' + f(my - 2.5 * s) + ' L' + f(cx + 4 * s) + ' ' + f(my - 2.5 * s) + ' L' + f(cx) + ' ' + f(my + (open ? 0.5 : 3.5) * s) + ' Z', '#ffc24a', ' stroke="' + OL + '" stroke-width="1.4" stroke-linejoin="round"');
    if (open) h += pa('M' + f(cx - 3 * s) + ' ' + f(my + 1.6 * s) + ' L' + f(cx + 3 * s) + ' ' + f(my + 1.6 * s) + ' L' + f(cx) + ' ' + f(my + 5 * s) + ' Z', '#f0a030', ' stroke="' + OL + '" stroke-width="1.4" stroke-linejoin="round"');
    return h;
  }
  if (mood === 'happy') h += pa('M' + f(cx - 3.6 * s) + ' ' + f(my) + ' Q' + f(cx) + ' ' + f(my + 6.4 * s) + ' ' + f(cx + 3.6 * s) + ' ' + f(my) + ' Z', '#f08a9a', ' stroke="' + INK + '" stroke-width="' + f(1.4 * s) + '" stroke-linejoin="round"');
  else if (mood === 'eat') h += ci(cx, my + 1.6 * s, 3.2 * s, '#d86a7c', ' stroke="' + INK + '" stroke-width="' + f(1.4 * s) + '"');
  else if (mood === 'hungry') h += el(cx, my + 1.2 * s, 1.9 * s, 2.4 * s, '#d86a7c', ' stroke="' + INK + '" stroke-width="' + f(1.2 * s) + '"');
  else if (mood === 'lonely') h += ln('M' + f(cx - 3 * s) + ' ' + f(my + 2.6 * s) + ' Q' + f(cx) + ' ' + f(my - 0.8 * s) + ' ' + f(cx + 3 * s) + ' ' + f(my + 2.6 * s), INK, f(1.6 * s));
  else if (sleep) h += ln('M' + f(cx - 1.6 * s) + ' ' + f(my + 1 * s) + ' Q' + f(cx) + ' ' + f(my + 2.4 * s) + ' ' + f(cx + 1.6 * s) + ' ' + f(my + 1 * s), INK, f(1.4 * s));
  else h += ln('M' + f(cx - 3 * s) + ' ' + f(my) + ' Q' + f(cx - 1.5 * s) + ' ' + f(my + 2.7 * s) + ' ' + f(cx) + ' ' + f(my) + ' Q' + f(cx + 1.5 * s) + ' ' + f(my + 2.7 * s) + ' ' + f(cx + 3 * s) + ' ' + f(my), INK, f(1.6 * s));
  return h;
}
/* もよう(ふしぎな生き物): 体の形で 切りぬく */
function mysticPattern(pat, color, cx, cy) {
  const ns = ' stroke="none" opacity="0.6"'; let h = '';
  if (pat === 1) [[-16, -14, 5], [14, -18, 4], [18, 6, 5.5], [-18, 10, 4.5], [0, 22, 5], [-4, -26, 3.5]].forEach(function (d) { h += ci(cx + d[0], cy + d[1], d[2], color, ns); });
  else if (pat === 2) [-22, -6, 12].forEach(function (dy) { h += '<path d="M' + f(cx - 34) + ' ' + f(cy + dy) + ' q8.5 -6 17 0 t17 0 t17 0 t17 0" fill="none" stroke="' + color + '" stroke-width="5" opacity="0.6" stroke-linecap="round"/>'; });
  else if (pat === 3) [[-17, -12, 5], [16, -16, 4], [17, 12, 5], [-15, 14, 4]].forEach(function (d) { h += star(cx + d[0], cy + d[1], d[2], color, ns); });
  else if (pat === 4) [[-16, -10, 1], [16, -14, 0.8], [15, 13, 1], [-14, 15, 0.8]].forEach(function (d) { h += heart(cx + d[0], cy + d[1], d[2], color, ns); });
  return h;
}
function clipTo(shape, inner) { if (!inner) return ''; const id = nid('pc'); return '<clipPath id="' + id + '">' + shape + '</clipPath><g clip-path="url(#' + id + ')">' + inner + '</g>'; }
function tf(k, kx, ky) { kx = (kx || 1) * k; ky = (ky || 1) * k; return { kx: kx, ky: ky, str: 'translate(60 108) scale(' + f(kx * 100) / 100 + ' ' + f(ky * 100) / 100 + ') translate(-60 -108)', pt: function (x, y, w) { return { x: 60 + (x - 60) * kx, y: 108 + (y - 108) * ky, w: w * kx }; } }; }
/* 分かれ道の 頭のかざり(x, y は 頭の てっぺん)*/
function branchTop(b, x, y, legend) {
  const B = BRANCH[b], c = legend ? GOLD : B.color, d = legend ? GOLDD : B.dark;
  if (b === 0) return waveCurl(x - 1, y + 3, 1, c);
  if (b === 1) return ln('M' + x + ' ' + (y + 2) + ' L' + x + ' ' + (y - 5), OL, 2) + star(x, y - 12, 9, c);
  if (b === 2) return leaf(x, y + 2, 17, -150, c) + leaf(x, y + 2, 17, -30, c) + ci(x, y, 3.4, '#ffb7c5', ' stroke="' + OL + '" stroke-width="1.4"');
  return tower(x, y + 3, 1, c, d);
}

/* ---------- ふしぎな生き物 ---------- */
function drawMystic(pet, stage, mood, hasHat) {
  const form = pet.look[0], col = BODY[pet.look[1]], eye = pet.look[2], pat = pet.look[3], legend = stage >= 5, br = pet.branch === null || pet.branch === undefined ? 0 : pet.branch;
  let h = '';
  if (stage === 1) {                                                           // たまご
    const egg = 'M60 46 C76 46 84 70 84 82 A24 24 0 0 1 36 82 C36 70 44 46 60 46 Z';
    h += pa(egg, col.fill) + clipTo('<path d="' + egg + '"/>', mysticPattern(pat || 1, col.dark, 60, 80));
    h += el(50, 62, 5, 3, '#fff', ' stroke="none" opacity="0.7"', -35);
    if (form === 0) h += ci(52, 47, 5, '#fff') + ci(60, 44, 6, '#fff') + ci(68, 47, 5, '#fff') + ci(60, 47, 5, '#fff', ' stroke="none"');
    else if (form === 1) h += spark(78, 50, 7, '#fff3a0') + spark(42, 58, 4, '#fff3a0');
    else h += el(60, 104, 26, 4, col.dark, ' stroke="none" opacity="0.35"');
    if (pet.gp >= 3) h += ln('M50 74 l5 5 l5 -6 l5 6 l5 -5', OL, 1.8);
    if (mood === 'sleep') h += zzz(86, 44);
    return { svg: h, top: { x: 60, y: 47, w: 26 }, eyes: { x: 60, y: 74, g: 8, s: 1 }, neck: { x: 60, y: 92, w: 40 }, noFace: true };
  }
  const BX = [[1.12, 0.95], [0.95, 1.05], [1.06, 1], [0.93, 1.1]][br], T = stage >= 4 ? tf(legend ? 1.04 : 1, BX[0], BX[1]) : tf(stage === 2 ? 0.62 : 0.8);
  const topY = [39, 36, 44][form], fc = [[60, 74, 9], [60, 80, 9], [60, 74, 10]][form], bodyFill = legend ? 'url(#' + (h = nid('lg')) + ')' : col.fill;
  let g = '', defs = '';
  if (legend) { defs = '<linearGradient id="' + h + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.55" stop-color="' + col.fill + '"/><stop offset="1" stop-color="' + col.dark + '"/></linearGradient>'; }
  h = '';
  const acc = BRANCH[br].color, accD = BRANCH[br].dark, bc = legend ? GOLD : acc;
  /* うしろの部品 */
  if (stage >= 4) {
    if (br === 0) { const fin = pa('M36 78 C16 70 10 84 20 92 C14 92 12 100 22 102 C28 104 36 98 38 92 Z', bc); g += fin + mirror(fin); }
    if (br === 1) g += ln('M84 92 Q92 92 94 98', OL, 2) + star(96, 98, 6.5, bc);
    if (br === 2) g += leaf(84, 96, 16, -20, bc);
    if (br === 3) g += pa('M26 96 l5 -9 l5 9 l-5 6 Z', bc) + pa('M84 96 l5 -9 l5 9 l-5 6 Z', bc);
  }
  if (stage >= 3 && form === 0) g += ci(41, 46, 7.5, col.fill) + ci(79, 46, 7.5, col.fill);
  if (stage >= 3 && form === 1) { const fin2 = pa('M35 82 L24 78 L28 90 Z', col.dark); g += fin2 + mirror(fin2); }
  if (stage >= 3 && form !== 2) g += el(50, 106, 6.5, 3.6, col.dark) + el(70, 106, 6.5, 3.6, col.dark);
  /* 体 */
  let shape;
  if (form === 0) {
    const cs = [[60, 76, 26], [40, 66, 14], [52, 54, 15], [70, 55, 15], [82, 68, 13], [84, 84, 12], [36, 84, 12], [48, 96, 12], [72, 96, 12], [60, 98, 12]];
    g += cs.map(function (c) { return ci(c[0], c[1], c[2], bodyFill); }).join(''); shape = cs.map(function (c) { return ci(c[0], c[1], c[2] - 1, bodyFill, ' stroke="none"'); }).join(''); g += shape;
  } else if (form === 1) { shape = pa('M60 36 C66 52 86 62 86 82 A26 24 0 0 1 34 82 C34 62 54 52 60 36 Z', bodyFill); g += shape; }
  else { shape = pa('M32 100 C30 60 44 44 60 44 C76 44 90 60 88 100 Q81 108 74 100 Q67 108 60 100 Q53 108 46 100 Q39 108 32 100 Z', bodyFill); g += shape; }
  g += clipTo(shape, mysticPattern(pat, col.dark, 60, fc[1] + 2));
  if (form === 2) g += el(45, 58, 6, 3.4, '#fff', ' stroke="none" opacity="0.75"', -32);
  if (form === 1) g += spark(30, 52, 5, '#fff3a0') + spark(91, 58, 4, '#fff3a0') + (stage >= 3 ? spark(86, 36, 3.2, '#fff3a0') : '');
  if (stage === 3 && form === 2) g += ln('M60 44 L60 34', OL, 2) + ci(60, 31, 4, col.dark);
  if (stage >= 4 && !hasHat) g += branchTop(br, 60, topY, legend);
  if (legend) g += '<ellipse cx="60" cy="' + (topY - 30) + '" rx="13" ry="4" fill="none" stroke="' + GOLD + '" stroke-width="3"/>';
  g += face(fc[0], fc[1], fc[2], eye, mood, 1);
  h += defs + grp(g, T.str);
  if (mood === 'sleep') h += zzz(88, T.pt(60, topY, 1).y + 4);
  return { svg: h, top: T.pt(60, topY + 2, 34), eyes: { x: T.pt(fc[0], fc[1], 1).x, y: T.pt(fc[0], fc[1], 1).y, g: fc[2] * T.kx, s: T.kx }, neck: T.pt(60, fc[1] + 17, 44) };
}
function zzz(x, y) { return '<g class="zz" fill="#8a9ad0" font-family="sans-serif" font-weight="bold"><text x="' + f(x) + '" y="' + f(y) + '" font-size="11">z</text><text x="' + f(x + 8) + '" y="' + f(y - 9) + '" font-size="14">Z</text></g>'; }

/* ---------- 動物 ---------- */
function drawAnimal(pet, stage, mood) {
  const sp = pet.look[0], fur = FUR[pet.look[1]], eye = pet.look[2], pat = pet.look[3], legend = stage >= 5, br = pet.branch === null || pet.branch === undefined ? 0 : pet.branch;
  const T = tf([0.6, 0.74, 0.88, 1, 1.04][stage - 1]), white = pet.look[1] === 0 ? fur.dark : '#fffdf8', tip = stage >= 4 ? (legend ? GOLD : BRANCH[br].color) : null, pink = '#ffc4cf';
  let g = '';
  const thick = function (d, w, color) { return ln(d, OL, w + 3.2) + ln(d, color, w); };
  /* しっぽ(体の うしろ)*/
  if (sp === 0) g += thick('M74 98 C94 98 96 80 87 72', 6.5, fur.fill) + (tip || pat === 3 ? thick('M90.4 76 C89.6 74.4 88.6 73 87 72', 6.5, tip || white) : '');
  else if (sp === 1) g += thick('M74 94 C86 92 89 82 83 76', 6.5, fur.fill) + (tip || pat === 3 ? thick('M85.6 79 C85 77.8 84.2 76.8 83 76', 6.5, tip || white) : '');
  else if (sp === 2) g += ci(78, 98, 6.5, tip || white);
  else if (sp === 3) g += pa('M72 92 L94 86 L92 96 L95 104 L74 100 Z', tip || fur.dark);
  else g += el(85, 93, 9, 14, fur.fill, undefined, 38) + grp(ln('M79 88 l10 7', fur.dark, 3.4) + ln('M84 82 l9 6', tip || fur.dark, 3.4), '');
  /* 耳(頭の うしろ)*/
  if (sp === 0) { const e = pa('M40 46 L37 21 L57 36 Z', fur.fill) + pa('M42 40 L40.5 27 L51 35 Z', tip || pink, ' stroke="none"'); g += e + mirror(e); }
  if (sp === 2) { const e = el(49, 25, 6.8, 17, fur.fill, undefined, -9) + el(49, 26, 3.2, 12, tip || pink, ' stroke="none"', -9); g += e + mirror(e); }
  if (sp === 4) { const e = ci(42, 38, 8.5, fur.dark) + ci(42, 38, 4.2, tip || pink, ' stroke="none"'); g += e + mirror(e); }
  if (sp === 3) g += pa('M60 37 C55 27 59 22 62 30 C64 22 71 26 65 37 Z', tip || fur.dark);
  /* 体と 足 */
  const body = el(60, 90, 17.5, 16, fur.fill); g += body;
  let bp = '';
  if (pat === 1) bp += el(50, 94, 7.5, 6, fur.dark, ' stroke="none" opacity="0.75"') + el(72, 84, 5, 4.4, fur.dark, ' stroke="none" opacity="0.75"');
  if (pat === 2) bp += ln('M44 84 l8 2', fur.dark, 3) + ln('M43 91 l8 1', fur.dark, 3) + ln('M76 84 l-8 2', fur.dark, 3) + ln('M77 91 l-8 1', fur.dark, 3);
  if (pat === 4) bp += el(60, 94, 10.5, 12, white, ' stroke="none"');
  g += clipTo(body, bp);
  if (sp === 3) { const wg = el(43.5, 89, 6.5, 12, fur.dark, undefined, 14); g += wg + mirror(wg) + ln('M53 105 l-3 4 M53 105 l3 4', '#f0a030', 2) + ln('M67 105 l-3 4 M67 105 l3 4', '#f0a030', 2); }
  else g += el(51, 104.5, 6.2, 4, pat === 3 ? white : fur.fill) + el(69, 104.5, 6.2, 4, pat === 3 ? white : fur.fill);
  if (stage >= 3) g += pa('M52 74 Q55 83 60 77 Q65 83 68 74 Z', pat === 4 ? white : fur.fill, ' stroke="' + OL + '" stroke-width="1.6" stroke-linejoin="round"');
  /* 頭 */
  if (stage >= 4) { const ck = pa('M38 58 L29 61 L37 65 L31 70 L41 70 Z', fur.fill); g += ck + mirror(ck); }
  const head = el(60, 56, 24, 21, fur.fill); g += head;
  let hp = '';
  if (pat === 1) hp += el(73, 44, 10, 8, fur.dark, ' stroke="none" opacity="0.75"');
  if (pat === 2) hp += ln('M60 34 L60 43', fur.dark, 3.2) + ln('M52 36 L54 44', fur.dark, 3.2) + ln('M68 36 L66 44', fur.dark, 3.2);
  if (pat === 4 || sp === 1) hp += el(60, 66, 10, 8, white, ' stroke="none"' + (pat === 4 ? '' : ' opacity="0.7"'));
  if (sp === 4) hp += el(50.5, 56, 8, 6.6, fur.dark, ' stroke="none" opacity="0.85"', -12) + el(69.5, 56, 8, 6.6, fur.dark, ' stroke="none" opacity="0.85"', 12);
  g += clipTo(head, hp);
  if (sp === 1) { const e = el(37.5, 52, 7.5, 15, fur.dark, undefined, 16) + (tip ? el(34.5, 62, 4, 4.5, tip, ' stroke="none"', 16) : ''); g += e + mirror(e); }
  /* ひたいの しるし(分かれ道で 変わる)*/
  if (stage >= 4) {
    const c = legend ? GOLD : BRANCH[br].color;
    g += br === 0 ? ln('M53 42 q3.5 -4 7 0 t7 0', c, 2.6) : br === 1 ? star(60, 42, 5, c, ' stroke="none"') : br === 2 ? leaf(55, 43, 10, -20, c) : pa('M60 37 l4 5 l-4 5 l-4 -5 Z', c, ' stroke="none"');
  }
  const fy = 57;
  if (sp === 3) g += face(60, fy, 9.5, eye, mood, 1, { beak: true, mouthY: 6 });
  else {
    g += face(60, fy, 10, eye, mood, 1, { mouthY: 8.2, noCheek: sp === 4 && false });
    g += pa('M57.4 61.4 L62.6 61.4 L60 64.6 Z', sp === 1 || sp === 4 ? INK : '#f08aa0', ' stroke="' + INK + '" stroke-width="0.8" stroke-linejoin="round"');
    if (sp === 0) g += ln('M40 60 l-8 -2 M40 64 l-8 2 M80 60 l8 -2 M80 64 l8 2', 'rgba(107,90,102,.55)', 1.1);
  }
  /* 分かれ道の 首かざり(小物の 首かざりを つけていないとき)*/
  if (stage >= 4 && !(pet.acc && pet.acc.neck)) {
    const c = legend ? GOLD : BRANCH[br].color, d = legend ? GOLDD : BRANCH[br].dark;
    if (br === 0) g += pa('M45 73 Q60 81 75 73 L76 78 Q60 87 44 78 Z', c) + ln('M48 77 q3 -2.4 6 0 t6 0 t6 0 t6 0', '#fff', 1.4) + pa('M73 76 l8 3 l-5 5 Z', c);
    else if (br === 1) g += ln('M46 75 Q60 82 74 75', d, 3) + star(60, 83, 5.5, c);
    else if (br === 2) g += ln('M46 75 Q60 82 74 75', d, 3) + leaf(60, 80, 9, 60, c) + leaf(60, 80, 9, 120, c);
    else g += ln('M46 75 Q60 82 74 75', d, 3) + tower(60, 93, 0.55, c, d);
  }
  let h = grp(g, T.str);
  if (mood === 'sleep') h += zzz(88, T.pt(60, 35, 1).y + 6);
  return { svg: h, top: T.pt(60, 36.5, 34), eyes: { x: 60, y: T.pt(60, fy, 1).y, g: 10 * T.kx, s: T.kx }, neck: T.pt(60, 76, 34) };
}

/* ---------- 人間(年は とらない。服装・持ち物・オーラが 進化する)---------- */
function drawHuman(pet, stage, mood, hasHat) {
  const hs = pet.look[0], hc = HAIRC[pet.look[1]], sk = SKIN[pet.look[2]], eye = pet.look[3], cl = CLOTH[pet.look[4]], legend = stage >= 5, br = pet.branch === null || pet.branch === undefined ? 0 : pet.branch;
  const acc = legend ? GOLD : BRANCH[br].color, accD = legend ? GOLDD : BRANCH[br].dark, trim = stage >= 4 ? acc : cl.dark;
  let g = '';
  /* マント(段階4 から)*/
  if (stage >= 4) {
    const cape = pa('M45 66 C29 80 27 98 29 106 L91 106 C93 98 91 80 75 66 Z', acc); g += cape;
    let m = '';
    if (br === 0) m = ln('M30 99 q5 -5 10 0 t10 0 t10 0 t10 0 t10 0 t10 0', '#fff', 1.8);
    else if (br === 1) m = star(36, 98, 3.6, '#fff', ' stroke="none"') + star(84, 98, 3.6, '#fff', ' stroke="none"') + star(33, 86, 2.6, '#fff', ' stroke="none"') + star(87, 86, 2.6, '#fff', ' stroke="none"');
    else if (br === 2) m = leaf(31, 99, 8, -30, '#eaffd8') + leaf(89, 99, 8, -150, '#eaffd8');
    else m = ln('M29 100 L91 100 M29 94 L91 94 M36 94 L36 100 M84 94 L84 100 M32 100 L32 106 M88 100 L88 106', 'rgba(255,255,255,.75)', 1.2);
    g += clipTo(cape, m);
  }
  /* うしろ髪 */
  if (hs === 1) g += pa('M39 46 C37 21 83 21 81 46 L82 60 C82 67 73 67 73 60 L47 60 C47 67 38 67 38 60 Z', hc.fill);
  else if (hs === 2) g += pa('M38 46 C36 19 84 19 82 46 L85 84 C79 89 70 87 68 80 L52 80 C50 87 41 89 35 84 Z', hc.fill);
  else g += ci(60, 44, 21.5, hc.fill);
  if (hs === 3) { const t = el(33, 57, 7, 14, hc.fill, undefined, 14) + ci(37, 44, 3.2, trim, ' stroke="' + OL + '" stroke-width="1.4"'); g += t + mirror(t); }
  if (hs === 4) g += pa('M76 33 C93 29 97 50 88 63 C87 53 83 46 76 44 Z', hc.fill) + ci(77, 37, 3.2, trim, ' stroke="' + OL + '" stroke-width="1.4"');
  /* 足・体・うで */
  g += rc(52, 94, 6.4, 11, 2, sk.fill) + rc(61.6, 94, 6.4, 11, 2, sk.fill) + el(54.4, 106, 6.2, 3.6, '#9a6a4a') + el(65.6, 106, 6.2, 3.6, '#9a6a4a');
  const long = stage >= 3, hem = long ? 100 : 96, body = pa('M49 65 L71 65 C75 66 77 70 77 74 L' + (long ? 81 : 79) + ' ' + hem + ' L' + (long ? 39 : 41) + ' ' + hem + ' L43 74 C43 70 45 66 49 65 Z', cl.fill);
  g += body + clipTo(body, rc(36, hem - 5, 48, 5, 0, trim, ' stroke="none"') + (stage >= 3 ? ln('M60 68 L60 ' + (hem - 5), cl.dark, 1.4) + ci(60, 76, 1.4, '#fff', ' stroke="none"') + ci(60, 84, 1.4, '#fff', ' stroke="none"') : ''));
  if (stage < 3) g += ln('M43.5 84 L76.5 84', cl.dark, 3);
  if (stage >= 3) g += pa('M52 65 L60 73 L68 65 Z', '#fffaf0', ' stroke="' + OL + '" stroke-width="1.4" stroke-linejoin="round"');
  const armL = el(42.5, 78, 4.6, 10.5, cl.fill, undefined, 14) + ci(39.6, 88.5, 3.6, sk.fill), armR = el(77.5, 78, 4.6, 10.5, cl.fill, undefined, -14) + ci(80.4, 88.5, 3.6, sk.fill);
  if (stage === 2) g += ln('M50 66 L73 90', '#9a6a4a', 2.4) + rc(68, 86, 11, 10, 2.5, '#c89868') + ln('M68 90 L79 90', '#9a6a4a', 1.4);
  g += armL + armR;
  if (stage === 2) g += pa('M49 64 L71 64 L71 69.5 L49 69.5 Z', cl.dark) + pa('M66 69 L70 80 L64 79 Z', cl.dark);
  if (stage === 3) g += rc(30.5, 82, 11, 13, 1.5, '#8cc4e8') + ln('M36 82 L36 95', '#fff', 1.2);
  /* つえ(段階4 から。かざりが 分かれ道で 変わる)*/
  if (stage >= 4) {
    g += ln('M86 62 L86 107', '#9a6a4a', 3);
    g += br === 0 ? waveCurl(85, 62, 0.8, acc) : br === 1 ? star(86, 56, 8, acc) : br === 2 ? leaf(86, 62, 13, -140, acc) + leaf(86, 62, 13, -40, acc) + ci(86, 60, 3, '#ffb7c5', ' stroke="' + OL + '" stroke-width="1.4"') : tower(86, 63, 0.75, acc, accD);
    g += ci(82.6, 88.5, 3.6, sk.fill);
  }
  /* 頭・前髪 */
  g += ci(60, 46, 19, sk.fill);
  g += face(60, 49, 7.6, eye, mood, 0.92, { mouthY: 6.4 });
  const fr = ['M41 46 C40 27 80 27 79 46 C72 38 64 36 60 40 C54 36 46 40 41 46 Z', 'M41 45 C42 29 78 29 79 45 C70 40 50 40 41 45 Z', 'M41 46 C42 27 60 27 60 34 C60 27 78 27 79 46 C74 40 64 36 60 36 C56 36 46 40 41 46 Z',
    'M41 46 C40 27 80 27 79 46 C72 38 64 36 60 40 C54 36 46 40 41 46 Z', 'M41 46 C40 27 80 27 79 46 C76 40 70 36 62 37 C56 44 48 46 41 46 Z', 'M40 46 L42 31 L48 38 L52 25 L58 36 L64 24 L68 36 L76 29 L79 46 C70 40 50 40 40 46 Z'][hs];
  g += pa(fr, hc.fill);
  if (legend && !hasHat) g += pa('M43 34 Q60 27 77 34 L77 38 Q60 31 43 38 Z', GOLD) + ci(60, 32.5, 2.6, '#ff8fa8', ' stroke="' + OL + '" stroke-width="1"');
  let h = g;
  if (mood === 'sleep') h += zzz(86, 30);
  return { svg: h, top: { x: 60, y: 27.5, w: 33 }, eyes: { x: 60, y: 49, g: 7.6, s: 0.92 }, neck: { x: 60, y: 67, w: 24 } };
}

/* ---------- 小物(どの姿にも つけられる。a は つける場所)---------- */
const ACC_ART = {
  a_mugi: function (a) { const u = a.w / 30; return el(a.x, a.y + 3 * u, 18 * u, 4.6 * u, '#f4d88c') + pa('M' + f(a.x - 9.5 * u) + ' ' + f(a.y + 2.5 * u) + ' C' + f(a.x - 9.5 * u) + ' ' + f(a.y - 10 * u) + ' ' + f(a.x + 9.5 * u) + ' ' + f(a.y - 10 * u) + ' ' + f(a.x + 9.5 * u) + ' ' + f(a.y + 2.5 * u) + ' Z', '#f4d88c') + ln('M' + f(a.x - 9 * u) + ' ' + f(a.y + 0.6 * u) + ' Q' + f(a.x) + ' ' + f(a.y + 3.4 * u) + ' ' + f(a.x + 9 * u) + ' ' + f(a.y + 0.6 * u), '#e87a7a', 2.6 * u); },
  a_tongari: function (a) { const u = a.w / 30; return pa('M' + f(a.x - 8 * u) + ' ' + f(a.y + 3 * u) + ' L' + f(a.x + 8 * u) + ' ' + f(a.y + 3 * u) + ' L' + f(a.x + 1 * u) + ' ' + f(a.y - 17 * u) + ' Z', '#ffb3c7') + ln('M' + f(a.x - 5 * u) + ' ' + f(a.y - 3 * u) + ' L' + f(a.x + 5.4 * u) + ' ' + f(a.y - 3 * u) + ' M' + f(a.x - 2.4 * u) + ' ' + f(a.y - 9.5 * u) + ' L' + f(a.x + 3.4 * u) + ' ' + f(a.y - 9.5 * u), '#fff', 2 * u) + ci(a.x + 1 * u, a.y - 18 * u, 3 * u, '#fff8d0'); },
  a_beret: function (a) { const u = a.w / 30; return el(a.x + 1 * u, a.y, 13.5 * u, 6.2 * u, '#c96a5c', undefined, -8) + ln('M' + f(a.x + 2 * u) + ' ' + f(a.y - 6 * u) + ' l' + f(1.5 * u) + ' ' + f(-3.5 * u), OL, 2); },
  a_hana: function (a) { const u = a.w / 30; let h = ln('M' + f(a.x - 13 * u) + ' ' + f(a.y + 4 * u) + ' Q' + f(a.x) + ' ' + f(a.y - 5 * u) + ' ' + f(a.x + 13 * u) + ' ' + f(a.y + 4 * u), '#7cc66a', 2.4 * u); [[-12, 3.4, '#ffb7c5'], [-6.4, -0.6, '#fff3a0'], [0, -2, '#ffffff'], [6.4, -0.6, '#ffb7c5'], [12, 3.4, '#fff3a0']].forEach(function (d) { h += ci(a.x + d[0] * u, a.y + d[1] * u, 3.3 * u, d[2], ' stroke="' + OL + '" stroke-width="1.2"') + ci(a.x + d[0] * u, a.y + d[1] * u, 1.1 * u, '#f0a030', ' stroke="none"'); }); return h; },
  a_knit: function (a) { const u = a.w / 30; return pa('M' + f(a.x - 11.5 * u) + ' ' + f(a.y + 3 * u) + ' C' + f(a.x - 11.5 * u) + ' ' + f(a.y - 12 * u) + ' ' + f(a.x + 11.5 * u) + ' ' + f(a.y - 12 * u) + ' ' + f(a.x + 11.5 * u) + ' ' + f(a.y + 3 * u) + ' Z', '#8fc7e8') + rc(a.x - 12.5 * u, a.y + 0.5 * u, 25 * u, 5 * u, 2.5 * u, '#fff') + ci(a.x, a.y - 10 * u, 3.6 * u, '#fff'); },
  a_crown: function (a) { const u = a.w / 30; return pa('M' + f(a.x - 8 * u) + ' ' + f(a.y + 2 * u) + ' L' + f(a.x - 9.5 * u) + ' ' + f(a.y - 8 * u) + ' L' + f(a.x - 4.4 * u) + ' ' + f(a.y - 3.4 * u) + ' L' + f(a.x) + ' ' + f(a.y - 10.5 * u) + ' L' + f(a.x + 4.4 * u) + ' ' + f(a.y - 3.4 * u) + ' L' + f(a.x + 9.5 * u) + ' ' + f(a.y - 8 * u) + ' L' + f(a.x + 8 * u) + ' ' + f(a.y + 2 * u) + ' Z', '#f4c84a') + ci(a.x, a.y - 1.4 * u, 1.6 * u, '#f47a9a', ' stroke="none"'); },
  l_kin: function (a) { const u = a.w / 30; return pa('M' + f(a.x - 10 * u) + ' ' + f(a.y + 2.5 * u) + ' L' + f(a.x - 12 * u) + ' ' + f(a.y - 10 * u) + ' L' + f(a.x - 5.6 * u) + ' ' + f(a.y - 4 * u) + ' L' + f(a.x) + ' ' + f(a.y - 13.5 * u) + ' L' + f(a.x + 5.6 * u) + ' ' + f(a.y - 4 * u) + ' L' + f(a.x + 12 * u) + ' ' + f(a.y - 10 * u) + ' L' + f(a.x + 10 * u) + ' ' + f(a.y + 2.5 * u) + ' Z', GOLD) + ci(a.x, a.y - 1.6 * u, 2 * u, '#ff7a9a', ' stroke="none"') + ci(a.x - 6 * u, a.y - 1 * u, 1.4 * u, '#7ac8ff', ' stroke="none"') + ci(a.x + 6 * u, a.y - 1 * u, 1.4 * u, '#7ac8ff', ' stroke="none"') + spark(a.x + 12 * u, a.y - 14 * u, 3.4 * u, '#fff8c0'); },
  a_megane: function (a) { const s = a.s, r = 5.6 * s; return ci(a.x - a.g, a.y, r, 'rgba(255,255,255,.28)', ' stroke="#8a6248" stroke-width="' + f(1.6 * s) + '"') + ci(a.x + a.g, a.y, r, 'rgba(255,255,255,.28)', ' stroke="#8a6248" stroke-width="' + f(1.6 * s) + '"') + ln('M' + f(a.x - a.g + r) + ' ' + f(a.y) + ' L' + f(a.x + a.g - r) + ' ' + f(a.y), '#8a6248', 1.6 * s); },
  a_hoshimegane: function (a) { const s = a.s; return star(a.x - a.g, a.y, 6.8 * s, '#4a4666', ' stroke="none"') + star(a.x + a.g, a.y, 6.8 * s, '#4a4666', ' stroke="none"') + ln('M' + f(a.x - a.g + 4 * s) + ' ' + f(a.y) + ' L' + f(a.x + a.g - 4 * s) + ' ' + f(a.y), '#4a4666', 1.8 * s) + ci(a.x - a.g - 1.6 * s, a.y - 1.6 * s, 1 * s, '#fff', ' stroke="none"') + ci(a.x + a.g - 1.6 * s, a.y - 1.6 * s, 1 * s, '#fff', ' stroke="none"'); },
  a_ribbon: function (a) { return bow(a.x, a.y + 2, 1.15, '#f47a9a', '#d85a7c'); },
  a_tie: function (a) { return bow(a.x, a.y + 2, 0.85, '#5a6ab0', '#44528c'); },
  l_niji: function (a) { const b = bow(a.x, a.y + 2, 1.3, '#ff9db0', '#f47a9a'), x = a.x, y = a.y + 2; return b + ln('M' + f(x - 9) + ' ' + f(y - 2) + ' L' + f(x - 4) + ' ' + f(y - 0.6), '#ffe27a', 1.6) + ln('M' + f(x - 9) + ' ' + f(y + 1.6) + ' L' + f(x - 4) + ' ' + f(y + 0.8), '#8fd0f4', 1.6) + ln('M' + f(x + 9) + ' ' + f(y - 2) + ' L' + f(x + 4) + ' ' + f(y - 0.6), '#9be08a', 1.6) + ln('M' + f(x + 9) + ' ' + f(y + 1.6) + ' L' + f(x + 4) + ' ' + f(y + 0.8), '#c9a8f4', 1.6); },
  a_muffler: function (a) { const w = a.w; return rc(a.x - w / 2, a.y - 3, w, 7.5, 3.6, '#f08a70') + pa('M' + f(a.x + w / 2 - 9) + ' ' + f(a.y + 3) + ' l8 0 l1.5 12 l-9 0 Z', '#f08a70') + ln('M' + f(a.x - w / 2 + 6) + ' ' + f(a.y - 2.4) + ' l0 6.4 M' + f(a.x) + ' ' + f(a.y - 2.4) + ' l0 6.4 M' + f(a.x + w / 2 - 8.6) + ' ' + f(a.y + 10) + ' l8 0', '#fff3e0', 1.6); },
  a_suzu: function (a) { const w = a.w; return ln('M' + f(a.x - w / 2 + 2) + ' ' + f(a.y - 1) + ' Q' + f(a.x) + ' ' + f(a.y + 5) + ' ' + f(a.x + w / 2 - 2) + ' ' + f(a.y - 1), '#e06a6a', 3) + ci(a.x, a.y + 5.6, 4, '#f4c84a') + ln('M' + f(a.x - 2) + ' ' + f(a.y + 6.4) + ' l4 0', OL, 1.2); }
};
function bow(x, y, s, c, d) { return pa('M' + f(x) + ' ' + f(y) + ' L' + f(x - 9 * s) + ' ' + f(y - 5 * s) + ' L' + f(x - 9 * s) + ' ' + f(y + 5 * s) + ' Z', c) + pa('M' + f(x) + ' ' + f(y) + ' L' + f(x + 9 * s) + ' ' + f(y - 5 * s) + ' L' + f(x + 9 * s) + ' ' + f(y + 5 * s) + ' Z', c) + ci(x, y, 2.8 * s, d); }
/* キャラクター 1人ぶんの SVG。o = { mood, stage, branch, legend, acc(false で 小物なし), cls } */
function petSVG(pet, o) {
  o = o || {};
  const p = Object.assign({}, pet, { look: fixLook(pet.kind, pet.look), acc: o.acc === false ? {} : (pet.acc || {}) });
  if (o.branch !== undefined) p.branch = o.branch;
  let stage = o.stage || stageOf(pet); if (o.legend) stage = 5;
  const mood = o.mood || 'fine', hasHat = !!p.acc.head;
  const d = p.kind === 'animal' ? drawAnimal(p, stage, mood) : p.kind === 'human' ? drawHuman(p, stage, mood, hasHat) : drawMystic(p, stage, mood, hasHat);
  let h = '';
  if (stage >= 5) {
    const id = nid('au');
    h += '<radialGradient id="' + id + '"><stop offset="0.35" stop-color="#fff6b8" stop-opacity="0.95"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient><circle class="aura" cx="60" cy="66" r="58" fill="url(#' + id + ')"/>';
    [[14, 30, 5], [104, 24, 6], [110, 78, 4.4], [10, 84, 4], [60, 8, 4.4]].forEach(function (s) { h += '<g class="tw">' + spark(s[0], s[1], s[2], '#fff3a0') + '</g>'; });
  } else if (stage === 4 && p.kind === 'human') h += '<ellipse cx="60" cy="107" rx="34" ry="5" fill="' + BRANCH[p.branch || 0].color + '" opacity="0.28"/>';
  h += '<ellipse cx="60" cy="109" rx="' + (stage === 1 && p.kind === 'mystic' ? 22 : 26) + '" ry="4" fill="rgba(90,70,90,.16)"/>' + d.svg;
  if (p.acc.neck && ACC_ART[p.acc.neck]) h += ACC_ART[p.acc.neck](d.neck);
  if (p.acc.face && ACC_ART[p.acc.face] && !d.noFace) h += ACC_ART[p.acc.face](d.eyes);
  if (p.acc.head && ACC_ART[p.acc.head]) h += ACC_ART[p.acc.head](d.top);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="pet' + (o.cls ? ' ' + o.cls : '') + '">' + h + '</svg>';
}

/* ---------- 家具(w × h の わくに かく)---------- */
const FURN_ART = {
  f_bed: function () { return rc(2, 30, 92, 22, 5, '#d9a877') + rc(4, 22, 88, 20, 8, '#fffaf0') + rc(30, 22, 62, 22, 8, '#a8d8f8') + el(18, 26, 11, 6.5, '#fff') + rc(2, 10, 8, 44, 3, '#c08a58') + ln('M40 30 q6 -4 12 0 t12 0 t12 0', '#fff', 2) + rc(6, 50, 6, 5, 1, '#b07f52') + rc(84, 50, 6, 5, 1, '#b07f52'); },
  f_desk: function () { return rc(8, 22, 5, 30, 1.5, '#c08a58') + rc(57, 22, 5, 30, 1.5, '#c08a58') + rc(2, 16, 66, 8, 3, '#e8c08c') + rc(38, 24, 22, 12, 2, '#d9a877') + ci(49, 30, 1.6, '#fff', ' stroke="none"') + rc(10, 9, 16, 7, 1.5, '#f29090') + rc(12, 4, 14, 6, 1.5, '#90bcf2') + ln('M34 15 l10 -9', '#f4c84a', 2.6); },
  f_shelf: function () { let h = rc(2, 2, 52, 80, 4, '#e8c08c') + rc(6, 6, 44, 21, 2, '#fff6e6') + rc(6, 31, 44, 21, 2, '#fff6e6') + rc(6, 56, 44, 22, 2, '#fff6e6'); [[8, '#f29090', 6, 17], [15, '#90bcf2', 5, 14], [21, '#9cdaa4', 7, 18], [29, '#f8de84', 5, 15], [35, '#c4a4ea', 6, 17]].forEach(function (b) { h += rc(b[0], 27 - b[3], b[2], b[3], 1, b[1], ' stroke="' + OL + '" stroke-width="1.2"'); }); [[8, '#c4a4ea', 6, 16], [15, '#f8de84', 7, 18], [23, '#f29090', 5, 14]].forEach(function (b) { h += rc(b[0], 52 - b[3], b[2], b[3], 1, b[1], ' stroke="' + OL + '" stroke-width="1.2"'); }); return h + ci(40, 45, 6, '#8fc7e8') + rc(10, 64, 14, 14, 2, '#ffd3da') + rc(30, 68, 16, 10, 2, '#bfeaa8'); },
  f_plant: function () { return leaf(17, 34, 22, -110, '#84c670') + leaf(17, 34, 20, -60, '#9cdaa4') + leaf(17, 34, 19, -150, '#9cdaa4') + leaf(17, 34, 24, -88, '#bfeaa8') + pa('M6 34 L28 34 L25 54 L9 54 Z', '#f0a888') + rc(4, 31, 26, 6, 2, '#f8c0a4'); },
  f_rug: function () { return el(48, 17, 46, 15, '#ffd3da') + el(48, 17, 34, 10.5, '#fff0f3', ' stroke="#f4a8b8" stroke-width="2" stroke-dasharray="4 4"') + el(48, 17, 16, 4.6, '#ffb7c5', ' stroke="none"'); },
  l_hoshirug: function () { let h = el(48, 17, 46, 15, '#4a5296'); [[20, 14, 3], [36, 22, 2.4], [50, 11, 3.4], [66, 20, 2.8], [78, 13, 2.4], [58, 25, 2]].forEach(function (s) { h += star(s[0], s[1], s[2], '#fff3a0', ' stroke="none"'); }); return h + el(48, 17, 40, 12, 'none', ' stroke="#8a94d8" stroke-width="1.4" stroke-dasharray="3 4"'); },
  f_cushion: function () { return pa('M6 8 Q20 2 34 8 Q38 14 34 21 Q20 26 6 21 Q2 14 6 8 Z', '#c4a4ea') + ci(20, 14.5, 2.4, '#fff') + ln('M10 9 q3 2 2 5 M30 9 q-3 2 -2 5', '#9a7ad2', 1.4); },
  f_lamp: function () { return '<circle cx="15" cy="16" r="15" fill="#fff6b8" opacity="0.5"/>' + ln('M15 26 L15 78', '#b07f52', 3) + el(15, 80, 10, 3.4, '#c08a58') + pa('M5 26 L25 26 L21 6 L9 6 Z', '#ffe993'); },
  f_toybox: function () { return ci(16, 12, 9, '#f29090') + ln('M8.4 9 q7.6 4 15.2 0', '#fff', 2) + rc(30, 6, 12, 12, 2, '#90bcf2') + pa('M40 14 l6 -10 l6 10 Z', '#f8de84') + rc(3, 16, 48, 26, 4, '#9cdaa4') + rc(3, 16, 48, 7, 3, '#bfeaa8') + star(27, 31, 6, '#fff', ' stroke="none"'); },
  f_globe: function () { const s = ci(18, 20, 15, '#a8d8f8'); return ln('M18 36 L18 44', '#b07f52', 3) + el(18, 46, 11, 3.4, '#c08a58') + ln('M5 9 A17 17 0 0 0 30 33', '#b07f52', 2.4) + s + clipTo(s, pa('M8 12 q6 -4 10 2 q2 6 -4 8 q-6 0 -6 -10 Z', '#9cdaa4', ' stroke="none"') + pa('M22 22 q6 -2 9 3 q-1 7 -7 6 q-4 -3 -2 -9 Z', '#9cdaa4', ' stroke="none"')); },
  f_board: function () { return ln('M12 40 L4 64 M52 40 L60 64 M32 42 L32 62', '#b07f52', 3) + rc(4, 2, 56, 40, 3, '#c08a58') + rc(8, 6, 48, 32, 2, '#3f6b5c') + ln('M14 30 L50 30 M32 10 L32 34', 'rgba(255,255,255,.55)', 1) + ln('M18 12 Q32 46 46 12', '#fff3a0', 1.8) + rc(22, 40, 10, 3, 1, '#fff', ' stroke="none"'); },
  f_clock: function () { return ci(17, 17, 15, '#fffaf0') + ci(17, 17, 15, 'none', ' stroke="#f29090" stroke-width="3"') + ln('M17 17 L17 8 M17 17 L23 20', INK, 2) + ci(17, 17, 1.6, INK, ' stroke="none"') + ci(17, 5.6, 1, INK, ' stroke="none"') + ci(17, 28.4, 1, INK, ' stroke="none"') + ci(5.6, 17, 1, INK, ' stroke="none"') + ci(28.4, 17, 1, INK, ' stroke="none"'); },
  f_picture: function () { const s = rc(5, 5, 36, 28, 1, '#cfeeff'); return rc(2, 2, 42, 34, 3, '#e8c08c') + s + clipTo(s, ci(32, 12, 4.4, '#ffe27a', ' stroke="none"') + pa('M2 34 L16 14 L26 28 L32 21 L44 34 Z', '#9cdaa4', ' stroke="none"')); },
  f_garland: function () { let h = ln('M3 5 Q55 30 107 5', '#b07f52', 1.6); [[14, 9.6, '#f29090'], [30, 15.4, '#f8de84'], [46, 18.6, '#9cdaa4'], [64, 18.6, '#90bcf2'], [80, 15.4, '#c4a4ea'], [96, 9.6, '#ffb7c5']].forEach(function (g) { h += pa('M' + (g[0] - 6) + ' ' + g[1] + ' L' + (g[0] + 6) + ' ' + g[1] + ' L' + g[0] + ' ' + f(g[1] + 11) + ' Z', g[2], ' stroke="' + OL + '" stroke-width="1.4" stroke-linejoin="round"'); }); return h; },
  f_wshelf: function () { return rc(2, 24, 56, 6, 2, '#e8c08c') + ln('M10 30 l0 3 M50 30 l0 3', '#b07f52', 2.4) + pa('M10 24 L22 24 L20 14 L12 14 Z', '#f0a888') + el(16, 10, 5, 7, '#84c670') + ln('M16 5 l0 8 M13.4 8 l5.2 0', '#eaffd8', 1) + rc(32, 14, 10, 10, 2, '#fffaf0') + ln('M42 16 q5 2 0 6', OL, 1.6) + rc(46, 11, 6, 13, 1, '#f29090', ' stroke="' + OL + '" stroke-width="1.2"'); }
};
function itemArt(id) { const it = itemOf(id); return it && FURN_ART[id] ? FURN_ART[id]() : ''; }
/* お店・一覧用の 品物の絵(小物は 丸い見本に つけて 見せる)*/
function itemIcon(id) {
  const it = itemOf(id); if (!it) return '';
  if (it.cat === 'furn') return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ' + (it.w + 6) + ' ' + (it.h + 6) + '" class="ico">' + FURN_ART[id]() + '</svg>';
  if (it.cat === 'acc') {
    const a = it.slot === 'head' ? { x: 30, y: 30, w: 34 } : it.slot === 'face' ? { x: 30, y: 30, g: 10, s: 1.1 } : { x: 30, y: 30, w: 36 };
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" class="ico">' + (it.slot === 'head' ? pa('M10 60 C10 26 50 26 50 60 Z', '#f3e9f0', ' stroke="none"') : ci(30, 32, 22, '#f3e9f0', ' stroke="none"')) + ACC_ART[id](a) + '</svg>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" class="ico"><clipPath id="' + (UID + 1) + 'ic"><rect x="4" y="4" width="52" height="52" rx="8"/></clipPath><g clip-path="url(#' + nid('') + 'ic)">' +
    (it.cat === 'wall' ? grp(wallArt(id, 12), 'scale(0.4)') : grp(floorArt(id), 'translate(0 -75) scale(0.9)')) + '</g><rect x="4" y="4" width="52" height="52" rx="8" fill="none" stroke="' + OL + '" stroke-width="2"/></svg>';
}

/* ---------- 部屋(300 × 240。壁は y < 150、床は y ≧ 150)---------- */
function wallArt(id, hour) {
  const R = U.makeRng(77), W = ROOM.w, H = ROOM.floorY, ns = ' stroke="none"'; let h = '';
  const scatter = function (n, fn) { for (let i = 0; i < n; i++) h += fn(8 + R.next() * (W - 16), 6 + R.next() * (H - 14), R.next()); };
  if (id === 'w_dots') { h += rc(0, 0, W, H, 0, '#ffe9ef', ns); for (let y = 12; y < H; y += 22) for (let x = (y / 22 % 2 ? 12 : 23); x < W; x += 22) h += ci(x, y, 3.6, '#fff', ns); }
  else if (id === 'w_stripe') { h += rc(0, 0, W, H, 0, '#e6f3ff', ns); for (let x = 0; x < W; x += 24) h += rc(x, 0, 12, H, 0, '#d2e8fc', ns); }
  else if (id === 'w_haru') { h += rc(0, 0, W, H, 0, '#fff0f4', ns); scatter(26, function (x, y, r) { return el(x, y, 4.4, 2.6, r < 0.5 ? '#ffc2d0' : '#ffd9e2', ns, Math.round(r * 180)); }); }
  else if (id === 'w_natsu') { h += rc(0, 0, W, H, 0, '#bfe6ff', ns) + rc(0, H * 0.6, W, H * 0.4, 0, '#d8f0ff', ns); [[50, 34, 1], [170, 22, 0.8], [250, 60, 1.1], [110, 84, 0.7]].forEach(function (c) { h += el(c[0], c[1], 22 * c[2], 9 * c[2], '#fff', ns) + ci(c[0] - 8 * c[2], c[1] - 6 * c[2], 9 * c[2], '#fff', ns) + ci(c[0] + 6 * c[2], c[1] - 8 * c[2], 11 * c[2], '#fff', ns); }); }
  else if (id === 'w_aki') { h += rc(0, 0, W, H, 0, '#fff1da', ns); scatter(20, function (x, y, r) { return star(x, y, 5.4, r < 0.4 ? '#f4a060' : r < 0.75 ? '#e87a5a' : '#f4c84a', ns + ' opacity="0.8"'); }); }
  else if (id === 'w_fuyu') { h += rc(0, 0, W, H, 0, '#e4eef9', ns); scatter(34, function (x, y, r) { return r < 0.3 ? spark(x, y, 5, '#fff') : ci(x, y, 1.6 + r * 1.6, '#fff', ns); }); }
  else if (id === 'w_yozora') { h += rc(0, 0, W, H, 0, '#343a70', ns) + rc(0, H * 0.55, W, H * 0.45, 0, '#474e8c', ns); scatter(30, function (x, y, r) { return r < 0.25 ? spark(x, y, 4.4, '#fff3a0') : ci(x, y, 0.8 + r, '#fff8d0', ns); }); h += ci(150, 34, 13, '#fff3a0', ns) + ci(155.5, 30, 11, '#343a70', ns); }
  else if (id === 'l_aurora') { h += rc(0, 0, W, H, 0, '#1f3f5c', ns); [['#7af0c0', 30], ['#b8a0ff', 58], ['#ff9ed0', 84]].forEach(function (a, i) { h += '<path d="M-10 ' + a[1] + ' q40 -' + (26 - i * 4) + ' 80 0 t80 0 t80 0 t80 0" fill="none" stroke="' + a[0] + '" stroke-width="16" opacity="0.5" stroke-linecap="round"/>'; }); scatter(16, function (x, y, r) { return ci(x, y, 0.8 + r, '#fff', ns); }); }
  else h += rc(0, 0, W, H, 0, '#fff3dc', ns);
  const sky = hour >= 19 || hour < 5 ? '#39407a' : hour >= 16 ? '#ffd3a8' : '#bfe6ff', night = hour >= 19 || hour < 5, win = rc(20, 26, 50, 54, 4, sky);
  h += rc(15, 21, 60, 64, 6, '#fffaf0') + win + clipTo(win, night ? ci(56, 42, 7, '#fff3a0', ns) + ci(59, 39.6, 6, sky, ns) + ci(30, 38, 1, '#fff', ns) + ci(40, 60, 1, '#fff', ns) + ci(32, 68, 1.2, '#fff', ns) : ci(56, 42, 7.4, hour >= 16 ? '#ff9a6a' : '#fff3a0', ns) + el(34, 62, 12, 5, '#fff', ns) + ci(30, 58, 5, '#fff', ns)) + ln('M45 26 L45 80 M20 53 L70 53', '#fffaf0', 3);
  return h + rc(0, H - 7, W, 7, 0, 'rgba(120,90,80,.18)', ns);
}
function floorArt(id) {
  const W = ROOM.w, Y = ROOM.floorY, H = ROOM.h - Y, ns = ' stroke="none"'; let h = '';
  if (id === 'y_check') { h += rc(0, Y, W, H, 0, '#fff4e4', ns); for (let r = 0; r < 4; r++) for (let c = r % 2; c < 10; c += 2) h += rc(c * 30, Y + r * 22.5, 30, 22.5, 0, '#ffd9c2', ns); }
  else if (id === 'y_shiba') { h += rc(0, Y, W, H, 0, '#c6e8a8', ns); const R = U.makeRng(5); for (let i = 0; i < 40; i++) { const x = R.next() * W, y = Y + 8 + R.next() * (H - 12); h += ln('M' + f(x) + ' ' + f(y) + ' l-2 -5 M' + f(x) + ' ' + f(y) + ' l2 -5', '#8cc670', 1.4); } }
  else if (id === 'y_tile') { h += rc(0, Y, W, H, 0, '#eaf1f6', ns); for (let x = 30; x < W; x += 30) h += ln('M' + x + ' ' + Y + ' L' + x + ' ' + ROOM.h, '#cfdbe4', 1.4); for (let y = Y + 22.5; y < ROOM.h; y += 22.5) h += ln('M0 ' + y + ' L' + W + ' ' + y, '#cfdbe4', 1.4); }
  else { h += rc(0, Y, W, H, 0, '#ecd0a8', ns); for (let r = 0; r < 4; r++) { const y = Y + r * 22.5; h += ln('M0 ' + y + ' L' + W + ' ' + y, '#d8b488', 1.4); for (let x = (r % 2 ? 40 : 90); x < W; x += 100) h += ln('M' + x + ' ' + y + ' L' + x + ' ' + (y + 22.5), '#d8b488', 1.4); } }
  return h;
}
/* 部屋の絵。o = { hour, sel(えらんでいる家具) }。キャラクターは 画面で 上に かさねる */
function roomSVG(S, o) {
  o = o || {};
  const order = function (p) { const it = itemOf(p.id); return it.on === 'wall' ? 0 : it.flat ? 1 : 2; };
  const list = S.room.placed.filter(function (p) { return itemOf(p.id) && FURN_ART[p.id]; }).slice().sort(function (a, b) { return order(a) - order(b) || a.y - b.y; });
  let h = wallArt(S.room.wall, o.hour === undefined ? 12 : o.hour) + floorArt(S.room.floor);
  list.forEach(function (p) {
    const it = itemOf(p.id), x = p.x - it.w / 2, y = p.y - it.h;
    h += '<g class="furn" data-id="' + p.id + '" transform="translate(' + f(x) + ' ' + f(y) + ')">' + (o.sel === p.id ? '<rect x="-4" y="-4" width="' + (it.w + 8) + '" height="' + (it.h + 8) + '" rx="6" fill="rgba(255,255,255,.35)" stroke="#f47a9a" stroke-width="2.4" stroke-dasharray="6 4"/>' : '') + FURN_ART[p.id]() + '</g>';
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + ROOM.w + ' ' + ROOM.h + '" class="roomsvg">' + h + '</svg>';
}
P.art = { pet: petSVG, room: roomSVG, itemIcon: itemIcon, itemArt: itemArt, ACC: ACC_ART, FURN: FURN_ART, colors: { BODY: BODY, FUR: FUR, HAIRC: HAIRC, SKIN: SKIN, CLOTH: CLOTH } };

/* ===== 3. ブラウザ部 ===== */
const SND = { tap: [[660, 0.05]], pop: [[880, 0.06]], ok: [[784, 0.08], [1047, 0.16]], eat: [[523, 0.06], [659, 0.06], [523, 0.06]], ng: [[392, 0.12], [330, 0.18]], coin: [[1319, 0.05], [1568, 0.1]],
  buy: [[784, 0.07], [988, 0.07], [1175, 0.14]], evo: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [1319, 0.14], [1568, 0.4]], stamp: [[440, 0.06], [880, 0.14]] };
/* BGM(オリジナルの オルゴール風。0 は 休み)*/
const TUNE = [523, 0, 659, 784, 0, 659, 587, 0, 698, 880, 0, 698, 659, 0, 784, 1047, 0, 784, 698, 659, 587, 0, 0, 0, 440, 0, 523, 659, 0, 523, 494, 0, 587, 784, 0, 587, 523, 0, 659, 880, 784, 659, 587, 523, 523, 0, 0, 0];
const NAMES = ['もこ', 'ぷるる', 'きらり', 'ポン', 'ミルク', 'そら', 'こむぎ', 'ルナ', 'まめ', 'ココ', 'ゆず', 'はな'];
const TALK = { fine: ['なでなで うれしい!', 'きょうも いっしょだね', 'えへへ', 'すうがく、たのしいね'], hungry: ['おなか すいた〜', 'ごはん まだかな?', '5問 といて ごはんに しよう'], lonely: ['……さみしかったよ', 'きてくれて うれしい', 'ごはん、いっしょに たべよう'], egg: ['コト……コト……', '(なかで うごいた!)', '(あたたかい)'] };
const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

P.start = function (courseId, app) {
  const course = M.courses[courseId];
  if (!course) { app.textContent = 'コースが見つかりません: ' + courseId; return; }
  const KEY = 'mathpet:' + course.id, params = new URLSearchParams(location.search), debug = params.get('debug') || '', DEV = params.has('debug');
  const units = unitsOf(course), $ = function (id) { return document.getElementById(id); }, wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  app.innerHTML = '<div id="ptop"><button id="pname"></button><span id="pcoin"></span><span id="pstreak"></span><button id="psnd">♪オフ</button></div>' +
    '<div id="proom"><div id="proomsvg"></div><div id="ppets"></div><div id="pbubble"></div></div><div id="pinfo"></div><div id="pedit"></div>' +
    '<div id="pnav"><button data-n="feed"><i>🍚</i>ごはん</button><button data-n="shop"><i>🛍</i>おみせ</button><button data-n="zukan"><i>📖</i>ずかん</button><button data-n="room"><i>🏠</i>へや</button><button data-n="menu"><i>☰</i>メニュー</button></div>' +
    '<div id="psheet"></div><div id="pquiz"><div id="pqhead"><div id="pqpet"></div><div id="pqside"><div id="pqprog"></div><div id="pqsay"></div></div></div><div id="quiz"></div></div><div id="pfx"></div><div id="ptoast"></div>';
  const api = M.start(courseId, $('quiz'), true);
  let S = null, editSel = null, editing = false, quizOn = false, auto = null;
  const posX = [], napUntil = [], now = function () { return new Date(); }, seed = function () { return Math.floor(Math.random() * 4294967296); };

  /* ---------- 音 ---------- */
  function snd(name) { let t = 0; (SND[name] || []).forEach(function (n) { api.tone(n[0], t, n[1] * 1.3, 'sine', 0.07); t += n[1]; }); }
  let tunePos = 0;
  setInterval(function () { if (!api.soundOn() || document.hidden) return; const n = TUNE[tunePos++ % TUNE.length]; if (n) api.tone(n, 0, 0.5, 'triangle', quizOn ? 0.012 : 0.028); }, 300);
  function setSound(on) { api.setSound(on); if (S) { S.sound = on; save(); } $('psnd').textContent = on ? '♪オン' : '♪オフ'; }
  $('psnd').onclick = function () { setSound(!api.soundOn()); snd('pop'); };

  /* ---------- セーブ(開発用表示の間は 読み書きしない)---------- */
  function save() { if (!S || DEV) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 保存できない端末でも 遊べるように */ } }
  function load() {
    if (DEV) return null;
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return null;
      const st = restore(raw, course.id);
      if (st) { if (st.today.date !== dayKey(now())) localStorage.setItem(KEY + ':bak', raw); return st; }      // 1日1回、ひかえを 残す
      localStorage.setItem(KEY + ':broken', raw);                                                                  // 読めない記録も 消さずに 取っておく
      return restore(localStorage.getItem(KEY + ':bak'), course.id);
    } catch (e) { return null; }
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); else if (S && !quizOn) { greet(touch(S, now())); render(); } });

  /* ---------- 部屋の表示 ---------- */
  const pet = function () { return S.pets[S.cur]; };
  function petMood(i) { if (napUntil[i] > Date.now()) return 'sleep'; const m = mood(S, now()); return i === S.cur ? m : (m === 'lonely' ? 'lonely' : 'fine'); }
  function renderPets() {
    const order = S.pets.map(function (_, i) { return i; }).filter(function (i) { return i !== S.cur; }).slice(-3).concat([S.cur]);
    $('ppets').innerHTML = order.map(function (i, k) {
      if (posX[i] === undefined) posX[i] = i === S.cur ? 50 : [16, 84, 30, 70][k % 4];
      return '<div class="pw' + (i === S.cur ? ' main' : '') + '" data-i="' + i + '" style="left:' + posX[i] + '%;z-index:' + (k + 2) + '"><div class="pin">' + petSVG(S.pets[i], { mood: petMood(i) }) + '</div></div>';
    }).join('');
  }
  function render() {
    if (!S || !S.pets.length) return;
    const p = pet(), g = gauge(p), md = mood(S, now());
    $('pname').innerHTML = esc(p.name) + '<small>' + esc(stageName(p)) + '</small>';
    $('pcoin').innerHTML = '<b class="coin"></b>' + S.coins; $('pstreak').innerHTML = '🔥' + S.days.streak + '日';
    $('proomsvg').innerHTML = roomSVG(S, { hour: now().getHours(), sel: editing ? editSel : null });
    renderPets();
    let dots = ''; for (let i = 0; i < MEAL; i++) dots += '<i class="food' + (i < S.today.fed ? ' on' : '') + '"></i>';
    $('pinfo').innerHTML = '<div class="grow"><span>' + esc(stageOf(p) >= 4 ? formName(p.kind, p.branch, p.legend) : stageName(p)) + '</span><div class="bar"><b style="width:' + Math.round(g.now / g.need * 100) + '%"></b></div><small>' + esc(g.label) + '</small></div>' +
      '<div class="meal"><span>今日のごはん</span>' + dots + '<small>' + (S.today.done ? 'ごちそうさま! おやつも あげられるよ' : md === 'lonely' ? 'ずっと まっていたみたい。ごはんを あげよう' : 'あと ' + (MEAL - S.today.fed) + '問で 完了') + '</small></div>';
    app.classList.toggle('editing', editing);
    $('pinfo').style.display = editing ? 'none' : ''; $('pedit').style.display = editing ? '' : 'none';
    document.querySelector('#pnav [data-n="feed"]').classList.toggle('call', !S.today.done && !editing);
    document.querySelector('#pnav [data-n="feed"]').lastChild.textContent = S.today.done ? 'おやつ' : 'ごはん';
  }
  let bubbleT = null;
  function say(text, ms) { const b = $('pbubble'); b.innerHTML = U.mathHTML(text); b.className = 'on'; clearTimeout(bubbleT); bubbleT = setTimeout(function () { b.className = ''; }, ms || 3200); }
  function toast(text) { const t = $('ptoast'); t.textContent = text; t.className = ''; void t.offsetWidth; t.className = 'on'; }
  function greet(r) {
    if (!S.pets.length) return;
    const n = pet().name;
    if (r.away >= 2) say('おかえり! ' + n + 'は ずっと まっていたよ', 5000);
    else if (r.newDay) say(S.today.done ? 'きょうも ありがとう!' : 'おはよう! きょうも 5問 いっしょに とこう', 4500);
  }
  /* しぐさ(ゆっくり歩く・はねる・ねむる)*/
  setInterval(function () {
    if (!S || quizOn || editing || document.hidden || $('psheet').className === 'on') return;
    Array.from($('ppets').children).forEach(function (el) {
      const i = +el.getAttribute('data-i'), p = S.pets[i], r = Math.random(), egg = stageOf(p) === 1 && p.kind === 'mystic';
      if (napUntil[i] > Date.now()) return;
      if (napUntil[i]) { napUntil[i] = 0; el.querySelector('.pin').innerHTML = petSVG(p, { mood: petMood(i) }); }
      if (egg) { if (r < 0.4) { el.classList.remove('wob'); void el.offsetWidth; el.classList.add('wob'); } return; }
      if (r < 0.45) { posX[i] = Math.round(i === S.cur ? 24 + Math.random() * 52 : 15 + Math.random() * 70); el.style.left = posX[i] + '%'; el.classList.add('walk'); setTimeout(function () { el.classList.remove('walk'); }, 2600); }
      else if (r < 0.6) { el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); }
      else if (r < 0.68 && mood(S, now()) === 'fine') { napUntil[i] = Date.now() + 9000; el.querySelector('.pin').innerHTML = petSVG(p, { mood: 'sleep' }); }
    });
  }, 3400);
  $('ppets').onclick = function (e) {
    const el = e.target.closest('.pw'); if (!el || editing) return;
    const i = +el.getAttribute('data-i'), p = S.pets[i], egg = stageOf(p) === 1 && p.kind === 'mystic', m = egg ? 'egg' : mood(S, now());
    napUntil[i] = 0; snd('tap');
    el.classList.remove('hop', 'wob'); void el.offsetWidth; el.classList.add(egg ? 'wob' : 'hop');
    if (!egg) { el.querySelector('.pin').innerHTML = petSVG(p, { mood: 'happy' }) + '<span class="hearts">♥</span>'; setTimeout(function () { if (el.isConnected) el.querySelector('.pin').innerHTML = petSVG(p, { mood: petMood(i) }); }, 1300); }
    say(TALK[m][Math.floor(Math.random() * TALK[m].length)]);
  };

  /* ---------- 重ねて出す画面(シート)と お知らせ ---------- */
  let acts = {};
  function sheet(title, html, a) { acts = a || {}; const s = $('psheet'); s.innerHTML = '<div class="sh"><div class="shh"><b>' + esc(title) + '</b><button data-a="close">とじる</button></div><div class="shb">' + html + '</div></div>'; s.className = 'on'; s.firstChild.lastChild.scrollTop = 0; }
  function closeSheet() { $('psheet').className = ''; $('psheet').innerHTML = ''; acts = {}; render(); }
  $('psheet').onclick = function (e) { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.getAttribute('data-a'); snd('tap'); if (a === 'close') { if (acts.close) acts.close(); else closeSheet(); } else if (acts[a]) acts[a](b.getAttribute('data-v'), b); };
  function popup(html, cls) {
    return new Promise(function (res) {
      const x = $('pfx'); x.innerHTML = '<div class="pop ' + (cls || '') + '">' + html + '<button class="big">OK</button></div>'; x.className = 'on';
      x.querySelector('button').onclick = function () { x.className = ''; x.innerHTML = ''; res(); };
    });
  }
  const bigPet = function (p, o) { return '<div class="bigpet">' + petSVG(p, o) + '</div>'; };
  /* 進化・ごほうび・称号の 演出 */
  async function showEvents(ev) {
    const p = pet();
    if (ev.stageTo > ev.stageFrom) {
      snd('evo');
      const nm2 = ev.stageTo >= 4 ? formName(p.kind, p.branch, p.legend) : stageName(p), u = ev.stageTo === 4 ? units[p.branch] : null;
      await popup('<div class="evo"><div class="rays"></div><div class="evoa">' + petSVG(p, { stage: ev.stageFrom, legend: false, mood: 'happy' }) + '</div><div class="evob">' + petSVG(p, { mood: 'happy' }) + '</div></div>' +
        '<h3>' + (ev.legend ? '伝説の しんか!' : 'しんか!') + '</h3><p>' + esc(p.name) + 'は「' + esc(nm2) + '」に なった!' + (u ? '<br><small>〈' + esc(u.name) + '〉を いちばん よく解いたから、この姿に なったよ</small>' : '') +
        (ev.stageTo === 4 ? '<br><small>ずかんに 登録。発展問題に 正解すると 伝説の姿に。新しい なかまも むかえられるよ(メニュー)</small>' : '') + '</p>', 'evop');
    }
    for (const r of ev.rewards) { snd('buy'); await popup('<h3>🔥 ' + r.days + '日 れんぞく!</h3><div class="gift">' + itemIcon(r.item) + '</div><p>ごほうび: コイン +' + r.coins + ' と<br>限定の「' + esc(itemOf(r.item).name) + '」を もらった!</p>'); }
    for (const t of ev.titles) { snd('buy'); await popup('<h3>あたらしい称号</h3><p class="ttl">『' + esc(t.name) + '』</p><p><small>' + esc(t.how) + '</small></p>'); }
  }

  /* ---------- なかまを つくる・かがみ ---------- */
  function createScreen(mode, base) {
    return new Promise(function (res) {
      const info = adoptInfo(S), kinds = mode === 'mirror' ? [base.kind] : info.kinds;
      let kind = mode === 'mirror' ? base.kind : kinds[0], look = mode === 'mirror' ? base.look.slice() : fixLook(kind, null), name = mode === 'mirror' ? base.name : '', err = '';
      const rnd = function () { look = kindOf(kind).parts.map(function (pt) { return Math.floor(Math.random() * pt.opts.length); }); };
      if (mode !== 'mirror') rnd();
      function draw() {
        const K = kindOf(kind), tmp = Object.assign(newPet(kind, look, name || 'なまえ'), mode === 'mirror' ? { gp: base.gp, branch: base.branch, legend: base.legend, acc: base.acc } : {});
        const later = mode === 'mirror' ? '' : '<div><div class="pv">' + petSVG(tmp, { stage: kind === 'human' ? 4 : 3, branch: 0 }) + '</div><small>育つと…(例)</small></div>';
        sheet(mode === 'mirror' ? 'かがみ(見た目を かえる)' : mode === 'adopt' ? 'あたらしい なかま' : 'いっしょに 育つ なかまを つくろう',
          (mode === 'mirror' ? '' : '<div class="lab">しゅるい</div><div class="seg">' + KINDS.map(function (k) { const ok = kinds.indexOf(k.id) >= 0; return '<button data-a="kind" data-v="' + k.id + '" class="' + (k.id === kind ? 'sel' : '') + '"' + (ok ? '' : ' disabled') + '>' + k.name + '</button>'; }).join('') + '</div><p class="note">' + esc(K.desc) + '</p>') +
          '<div class="pvs"><div><div class="pv">' + petSVG(tmp, {}) + '</div><small>' + (mode === 'mirror' ? 'いまの姿' : 'はじめ(' + K.stages[0] + ')') + '</small></div>' + later + '</div>' +
          K.parts.map(function (pt, pi) { return '<div class="lab">' + pt.label + '</div><div class="opts2">' + pt.opts.map(function (o, oi) { return '<button data-a="part" data-v="' + pi + ':' + oi + '" class="' + (look[pi] === oi ? 'sel' : '') + '">' + (pt.col ? '<i style="background:' + pt.col[oi].fill + '"></i>' : '') + o + '</button>'; }).join('') + '</div>'; }).join('') +
          '<div class="lab">なまえ(ひらがな・カタカナ 6文字まで)</div><div class="row"><input id="pnm" maxlength="6" value="' + esc(name) + '" placeholder="なまえ"><button data-a="rname">おまかせ</button></div><div class="err">' + esc(err) + '</div>' +
          '<div class="row">' + (mode === 'mirror' ? '' : '<button data-a="rlook">見た目を おまかせ</button>') + '<button class="big" data-a="ok">' + (mode === 'mirror' ? 'これに する' : 'この子に きめた!') + '</button></div>',
          { kind: function (v) { keep(); kind = v; rnd(); draw(); }, part: function (v) { keep(); const a = v.split(':'); look[+a[0]] = +a[1]; draw(); }, rname: function () { name = NAMES[Math.floor(Math.random() * NAMES.length)]; err = ''; draw(); }, rlook: function () { keep(); rnd(); draw(); },
            ok: function () { keep(); if (!nameOk(name)) { err = 'なまえは ひらがな・カタカナで 1〜6文字に してね'; return draw(); } closeSheet(); res({ kind: kind, look: look, name: name }); },
            close: function () { if (mode === 'new') return; closeSheet(); res(null); } });
        if (mode === 'new') { const c = $('psheet').querySelector('[data-a="close"]'); if (c) c.style.display = 'none'; }
      }
      function keep() { const i = $('pnm'); if (i) name = i.value.trim(); err = ''; }
      draw();
    });
  }

  /* ---------- ごはん・おやつ(問題を解く)---------- */
  function unitChips() { return '<div class="lab">チャレンジする単元(まだ 習っていない単元は 外せる)</div><div class="units">' + units.map(function (u) { const on = S.units[u.id] !== false; return '<button data-a="unit" data-v="' + u.id + '" class="' + (on ? 'sel' : '') + '"><b>' + (on ? '✓' : '　') + '</b><span>' + U.mathHTML(u.name) + '<small>' + esc(u.place) + '</small></span></button>'; }).join('') + '</div>'; }
  function toggleUnit(id) { const on = S.units[id] !== false; if (on && units.filter(function (u) { return S.units[u.id] !== false; }).length <= 1) { toast('単元は 1つ以上 えらんでね'); return; } S.units[id] = !on; save(); }
  function feedSheet() {
    const p = pet(), st = stageOf(p);
    const body = S.today.done
      ? '<p class="note">今日のごはんは 完了! おやつは 何問でも あげられる(コインは もらえる。成長は 1日 5問ぶんまで)。</p>' + unitChips() + '<div class="lab">おやつの むずかしさ</div><div class="col"><button class="big" data-a="snack" data-v="basic">基本(草原の問題)</button><button class="big" data-a="snack" data-v="standard">標準(ダンジョンの問題)</button><button class="big" data-a="snack" data-v="advanced">応用(ボス・魔王の城の問題)</button>' +
        (st === 4 ? '<button class="big gold" data-a="legend">伝説への挑戦(発展問題 ' + p.lg + '/' + LEGEND_NEED + ')</button>' : st < 4 ? '<p class="note">おとな(段階4)に なると、発展問題で「伝説への挑戦」が できるよ。</p>' : '') + '</div>'
      : '<p class="note">5問 といて ごはんを あげよう(3分くらい)。まちがえても だいじょうぶ。解説のあと、同じ型の問題で もう一度 ためせるよ。</p>' + unitChips() + '<button class="big" data-a="meal">ごはんを あげる(のこり ' + (MEAL - S.today.fed) + '問)</button>';
    sheet(S.today.done ? 'おやつ' : '今日のごはん', body, { unit: function (v) { toggleUnit(v); feedSheet(); }, meal: function () { closeSheet(); runQuiz('meal'); }, snack: function (v) { closeSheet(); runQuiz('snack', v); }, legend: function () { closeSheet(); runQuiz('legend'); } });
  }
  function qhead(mode, moodNow, text) {
    $('pqpet').innerHTML = petSVG(pet(), { mood: moodNow });
    let pr = '';
    if (mode === 'meal') { pr = '<span>今日のごはん</span>'; for (let i = 0; i < MEAL; i++) pr += '<i class="food' + (i < S.today.fed ? ' on' : '') + '"></i>'; }
    else if (mode === 'legend') pr = '<span>伝説への挑戦 ' + pet().lg + '/' + LEGEND_NEED + '</span>';
    else pr = '<span>おやつ ' + S.today.snack + '問め</span>';
    $('pqprog').innerHTML = pr + '<em><b class="coin"></b>' + S.coins + '</em>';
    if (text !== undefined) $('pqsay').innerHTML = U.mathHTML(text);
  }
  async function runQuiz(mode, tier) {
    const us = selectedUnits(S, units), rng = U.makeRng(seed());
    const plan = mode === 'meal' ? pickMeal(us, rng, MEAL - S.today.fed, S.review) : null;
    let idx = 0, prev = null, retry = null, fails = 0;
    quizOn = true; app.classList.add('quiz');
    try {
      for (;;) {
        const item = retry || (mode === 'meal' ? plan[idx] : mode === 'legend' ? pickLegend(course, rng, prev, S.review) : pickSnack(us, tier, rng, prev, S.review));
        if (!item) break;
        let q = M.safeQuestion(course, [item.ref], item.ref, seed);
        if (!q) { retry = null; idx++; if (++fails > 6) break; continue; }
        if (q.plot && S.figChoice) { const q2 = M.draw.asFigChoice(q, U.makeRng(seed())); if (q2 && !M.checkQuestion(q2)) q = q2; }
        prev = q.type;
        qhead(mode, mode === 'meal' ? 'hungry' : 'fine', retry ? '同じ型の 問題で もう一度! こんどは できるよ' : mode === 'meal' ? 'あと ' + (MEAL - S.today.fed) + '問で ごはん 完了!' : mode === 'legend' ? 'むずかしい 発展問題だよ。じっくり いこう' : 'おやつ、たのしみ!');
        let r;
        if (auto) r = auto(q, api.ask(q, { hints: 1 })); else r = api.ask(q, { hints: 1 });
        r = await r;
        if (!r) break;                                                             // もどる(とちゅうまでの 記録は 残る)
        const ok = r.judge.result === 'correct', mk = r.judge.mistake;
        const ev = record(S, units, { mode: mode, type: q.type, unit: item.unit }, ok, mk && mk.tag, now()); save();
        if (ok) {
          retry = null; idx++; snd('ok'); snd('eat');
          qhead(mode, 'eat', (S.combo >= 3 ? S.combo + '問 れんぞく 正解! ' : '正解! ') + (ev.grew ? 'もぐもぐ……おいしい! ' : '') + 'コイン +' + ev.coins);
          $('pqpet').classList.remove('munch'); void $('pqpet').offsetWidth; $('pqpet').classList.add('munch'); api.clear();
          await wait(auto ? 5 : 1100);
          await showEvents(ev);
          if (ev.mealDone) { snd('stamp'); await popup('<div class="stampbig"><i></i></div><h3>今日のごはん 完了!</h3><p>カレンダーに スタンプを 押したよ。<br>🔥 ' + S.days.streak + '日 れんぞく(合計 ' + S.days.total + '日)</p><p><small>このあとは「おやつ」で 何問でも 解けるよ</small></p>'); break; }
          if (ev.legend) break;
        } else {
          retry = item; snd('ng');
          qhead(mode, 'fine', 'おしい! だいじょうぶ、何も へらないよ。' + (mk ? '\n💡 ' + mk.msg : '') + '\n(解説を 読んだら タップ)');
          await api.explain(q);
        }
      }
    } catch (e) { console.error(e); }
    api.clear(); quizOn = false; app.classList.remove('quiz'); render();
    if (S.today.done && mode === 'meal') say('ごちそうさま! ' + pet().name + 'は とっても げんき!', 4500);
  }

  /* ---------- おみせ ---------- */
  let shopTab = 'acc';
  function shopSheet() {
    const tabs = [['acc', '小物'], ['furn', '家具'], ['wall', '壁紙と床']];
    const list = ITEMS.filter(function (it) { return shopTab === 'wall' ? (it.cat === 'wall' || it.cat === 'floor') : it.cat === shopTab; });
    sheet('おみせ', '<div class="coinline"><b class="coin"></b>' + S.coins + ' コイン</div><div class="seg">' + tabs.map(function (t) { return '<button data-a="tab" data-v="' + t[0] + '" class="' + (t[0] === shopTab ? 'sel' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div class="grid">' +
      list.map(function (it) {
        const own = !!S.owned[it.id]; let btn;
        if (!own) btn = it.limited ? '<small class="lim">🔥' + it.limited + '日 れんぞくの ごほうび</small>' : '<button data-a="buy" data-v="' + it.id + '"' + (S.coins < it.price ? ' class="dim"' : '') + '><b class="coin"></b>' + it.price + '</button>';
        else if (it.cat === 'acc') btn = '<button data-a="wear" data-v="' + it.id + '" class="' + (pet().acc[it.slot] === it.id ? 'sel' : '') + '">' + (pet().acc[it.slot] === it.id ? 'はずす' : 'つける') + '</button>';
        else if (it.cat === 'furn') { const pl = S.room.placed.some(function (p) { return p.id === it.id; }); btn = '<button data-a="put" data-v="' + it.id + '" class="' + (pl ? 'sel' : '') + '">' + (pl ? 'しまう' : 'おく') + '</button>'; }
        else btn = '<button data-a="use" data-v="' + it.id + '" class="' + (S.room[it.cat] === it.id ? 'sel' : '') + '">' + (S.room[it.cat] === it.id ? 'つかっている' : 'つかう') + '</button>';
        return '<div class="card' + (own ? ' own' : '') + (it.limited ? ' ltd' : '') + '">' + itemIcon(it.id) + '<span>' + esc(it.name) + '</span>' + btn + '</div>';
      }).join('') + '</div>', {
      tab: function (v) { shopTab = v; shopSheet(); },
      buy: function (v) { const r = buy(S, v); if (r.ok) { snd('buy'); save(); toast('「' + itemOf(v).name + '」を 買った!'); const it = itemOf(v); if (it.cat === 'acc') wear(S, S.cur, v); else if (it.cat === 'furn') place(S, v, 150 + (Math.random() * 120 - 60), it.on === 'wall' ? 70 : 205); else setRoom(S, v); save(); } else toast(r.why); shopSheet(); },
      wear: function (v) { wear(S, S.cur, v); save(); shopSheet(); },
      put: function (v) { const it = itemOf(v); if (S.room.placed.some(function (p) { return p.id === v; })) unplace(S, v); else place(S, v, 150, it.on === 'wall' ? 70 : 205); save(); shopSheet(); },
      use: function (v) { setRoom(S, v); save(); shopSheet(); } });
  }

  /* ---------- ずかん・称号 ---------- */
  function zukanSheet() {
    const keys = zukanKeys(), got = keys.filter(function (k) { return S.zukan[k]; }).length;
    sheet('ずかん(' + got + '/' + keys.length + ')', '<div class="grid z">' + keys.map(function (k) {
      const kd = k.split(':')[0], b = k.split(':')[1], L = b === 'L', z = S.zukan[k], K = kindOf(kd);
      const tmp = newPet(kd, z ? z.look : null, ''); tmp.gp = GROW[3]; tmp.branch = L ? (z && Number.isInteger(z.branch) ? z.branch : 0) : +b; tmp.legend = L;
      return '<div class="card ' + (z ? 'own' : 'yet') + '">' + petSVG(tmp, { acc: false, mood: z ? 'happy' : 'fine' }) + '<span>' + (z ? esc(formName(kd, tmp.branch, L)) : '？？？') + '</span><small>' + esc(K.name) + (L ? '・発展問題 ' + LEGEND_NEED + '問' : '・' + esc(units[+b] ? units[+b].place : '')) + '</small></div>';
    }).join('') + '</div><p class="note">おとな(達人)の姿は、いちばん よく解いた単元で 4通りに 分かれる。伝説の姿は、おとなに なってから 発展問題に ' + LEGEND_NEED + '問 正解すると 見られる。</p>' +
      '<div class="lab">称号(タップで 名のる)</div><div class="tlist">' + TITLES.map(function (t) { const has = S.titles.indexOf(t.id) >= 0; return '<button data-a="title" data-v="' + t.id + '" class="' + (S.title === t.id ? 'sel' : '') + (has ? '' : ' yet') + '">' + (has ? esc(t.name) : '？？？') + '<small>' + esc(t.how) + '</small></button>'; }).join('') + '</div>',
      { title: function (v) { if (S.titles.indexOf(v) >= 0) { S.title = v; save(); zukanSheet(); } } });
  }

  /* ---------- へや(もようがえ・きがえ・かがみ・なかま)---------- */
  function roomSheet() {
    sheet('へや', '<div class="col"><button class="big" data-a="edit">もようがえ(家具を うごかす)</button><button class="big" data-a="dress">きがえ(小物を つける)</button><button class="big" data-a="mirror">かがみ(見た目・なまえを かえる)</button></div>' +
      (S.pets.length > 1 ? '<div class="lab">おせわする なかま</div><div class="grid">' + S.pets.map(function (p, i) { return '<div class="card' + (i === S.cur ? ' own' : '') + '">' + petSVG(p, {}) + '<span>' + esc(p.name) + '</span><button data-a="cur" data-v="' + i + '" class="' + (i === S.cur ? 'sel' : '') + '">' + (i === S.cur ? 'おせわ中' : 'この子に する') + '</button></div>'; }).join('') + '</div>' : '') +
      (adoptInfo(S).can ? '<div class="col"><button class="big gold" data-a="adopt">あたらしい なかまを むかえる</button></div>' : '<p class="note">いまの子が おとな(段階4)に なると、あたらしい なかまを むかえられる(育てた子は 部屋に のこる)。</p>'),
      { edit: function () { closeSheet(); startEdit(); }, dress: dressSheet, mirror: async function () { const r = await createScreen('mirror', pet()); if (r) { restyle(pet(), r.look, r.name); save(); toast('見た目を かえた!'); } render(); },
        cur: function (v) { S.cur = +v; save(); roomSheet(); }, adopt: adoptFlow });
  }
  async function adoptFlow() { const r = await createScreen('adopt'); if (!r) return; if (adopt(S, r.kind, r.look, r.name, now())) { save(); render(); say(r.name + 'が なかまに なった! よろしくね', 4500); snd('buy'); } }
  function dressSheet() {
    const own = ITEMS.filter(function (it) { return it.cat === 'acc' && S.owned[it.id]; }), p = pet();
    sheet('きがえ', bigPet(p, { mood: 'happy' }) + (own.length ? '<div class="grid">' + own.map(function (it) { return '<div class="card own">' + itemIcon(it.id) + '<span>' + esc(it.name) + '</span><button data-a="wear" data-v="' + it.id + '" class="' + (p.acc[it.slot] === it.id ? 'sel' : '') + '">' + (p.acc[it.slot] === it.id ? 'はずす' : 'つける') + '</button></div>'; }).join('') + '</div>' : '<p class="note">小物は まだ 持っていない。おみせで 買えるよ。</p>'),
      { wear: function (v) { wear(S, S.cur, v); save(); dressSheet(); } });
  }
  function startEdit() { editing = true; editSel = null; drawEdit(); render(); say('家具を えらんでから、置きたい場所を タップ', 5000); }
  function drawEdit() {
    const own = ITEMS.filter(function (it) { return it.cat === 'furn' && S.owned[it.id]; });
    $('pedit').innerHTML = '<div class="chips">' + (own.length ? own.map(function (it) { const pl = S.room.placed.some(function (p) { return p.id === it.id; }); return '<button data-e="' + it.id + '" class="' + (editSel === it.id ? 'sel' : '') + (pl ? '' : ' off') + '">' + itemIcon(it.id) + '</button>'; }).join('') : '<span class="note">家具は まだ 持っていない。おみせで 買えるよ。</span>') + '</div>' +
      '<div class="row"><button data-e="!away"' + (editSel && S.room.placed.some(function (p) { return p.id === editSel; }) ? '' : ' disabled') + '>しまう</button><button class="big" data-e="!done">おわる</button></div>';
  }
  $('pedit').onclick = function (e) {
    const b = e.target.closest('[data-e]'); if (!b) return; const v = b.getAttribute('data-e'); snd('tap');
    if (v === '!done') { editing = false; editSel = null; save(); render(); return; }
    if (v === '!away') { unplace(S, editSel); editSel = null; }
    else { editSel = v; if (!S.room.placed.some(function (p) { return p.id === v; })) { const it = itemOf(v); place(S, v, 150, it.on === 'wall' ? 70 : 205); } }
    save(); drawEdit(); render();
  };
  $('proom').addEventListener('click', function (e) {
    if (!editing) return;
    const fg = e.target.closest('.furn'), r = $('proomsvg').getBoundingClientRect(), x = (e.clientX - r.left) / r.width * ROOM.w, y = (e.clientY - r.top) / r.height * ROOM.h;
    if (fg && fg.getAttribute('data-id') !== editSel && !(editSel && itemOf(fg.getAttribute('data-id')).flat)) editSel = fg.getAttribute('data-id');
    else if (editSel) { const it = itemOf(editSel); place(S, editSel, x, y + (it.on === 'wall' || it.flat ? it.h / 2 : 0)); snd('pop'); }
    else return;
    save(); drawEdit(); render();
  });

  /* ---------- メニュー(カレンダー・写真・きろく・設定・記録のことば)---------- */
  function menuSheet() {
    sheet('メニュー', '<div class="col"><button class="big" data-a="cal">カレンダー(スタンプ)</button><button class="big" data-a="photo">写真モード</button><button class="big" data-a="rec">きろく(単元ごとの 正解)</button>' +
      '<button class="big" data-a="snd">音: ' + (api.soundOn() ? 'オン' : 'オフ') + '</button><button class="big" data-a="fig">図の問題: ' + (S.figChoice ? 'えらぶ(4つの図から)' : 'かく') + '</button>' +
      '<button class="big" data-a="pw">記録のことば(機種変更・ひっこし)</button>' + (adoptInfo(S).can ? '<button class="big gold" data-a="adopt">あたらしい なかまを むかえる</button>' : '') +
      '<a class="big link" href="index.html?course=' + course.id + '">この範囲の RPG で あそぶ</a><a class="big link" href="pet.html">コースを えらびなおす</a><button class="big sub danger" data-a="reset">はじめから やり直す</button></div><p class="note">' + esc(course.title.replace('クエスト', '')) + ' / 記録は この端末に 自動で 保存されます。</p>',
      { cal: function () { calSheet(0); }, photo: photoSheet, rec: recSheet, snd: function () { setSound(!api.soundOn()); menuSheet(); }, fig: function () { S.figChoice = !S.figChoice; save(); menuSheet(); }, pw: pwSheet, adopt: adoptFlow, reset: function () { resetSheet(1); } });
  }
  /* はじめから やり直す: 1回目は 記録のことばを 控える案内、2回目は 最後の確認。消すのは このコースの ペットの記録だけ */
  function resetSheet(step) {
    const pw = S.pets.length ? pwEncode(course, S) : '', show = (pw.match(/.{1,5}/g) || []).join(' ');
    if (step === 1) {
      sheet('はじめから やり直す(1/2)', '<p class="note">いまの なかま(' + S.pets.map(function (p) { return esc(p.name); }).join('・') + ')・コイン・部屋・ずかん・称号・カレンダーの スタンプが すべて 消えて、キャラクター選びから やり直しになります。</p>' +
        '<p class="note"><b>消す前に、下の「記録のことば」を メモか スクリーンショットで 控えておこう。</b>控えておけば、メニューの「記録のことば」から いつでも もとに もどせます。</p>' +
        (pw ? '<div class="pw">' + show + '</div><button class="big sub" data-a="copy">記録のことばを コピーする</button>' : '') +
        '<p class="note">消えるのは この端末の「' + esc(course.title.replace('クエスト', '')) + '」の ペットの記録だけです。RPG の記録や、ほかのコースの ペットは そのまま。</p>' +
        '<div class="col"><button class="big sub" data-a="close">やめる</button><button class="big danger" data-a="next">控えたので 次へ</button></div>',
        { copy: function () { try { navigator.clipboard.writeText(pw); toast('コピーした'); } catch (e) { toast('コピーできなかった。メモしてね'); } }, next: function () { resetSheet(2); }, close: menuSheet });
    } else {
      sheet('はじめから やり直す(2/2)', '<div class="pvs">' + S.pets.slice(0, 3).map(function (p) { return '<div><div class="pv">' + petSVG(p, { mood: 'lonely' }) + '</div></div>'; }).join('') + '</div>' +
        '<p class="note" style="text-align:center"><b>ほんとうに 消して いいですか?</b><br>この操作は もとに もどせません(記録のことばが あれば もどせます)。</p>' +
        '<div class="col"><button class="big" data-a="close">やめる(このまま 遊ぶ)</button><button class="big danger" data-a="wipe">消して はじめから やり直す</button></div>',
        { wipe: doReset, close: menuSheet });
    }
  }
  function doReset() {
    if (DEV) { S = newState(course.id); posX.length = 0; closeSheet(); toast('(開発用表示なので 保存は さわらない)'); return; }
    try { wipeSave(localStorage, course.id); } catch (e) { /* 保存できない端末 */ }
    S = null; location.reload();                                                   // 記録が ない状態で 開き直す → キャラクター選びから
  }
  function calSheet(back) {
    const t = now(), d0 = new Date(t.getFullYear(), t.getMonth() - back, 1), y = d0.getFullYear(), m = d0.getMonth(), n = new Date(y, m + 1, 0).getDate(), today = dayKey(t);
    let cells = ''; for (let i = 0; i < d0.getDay(); i++) cells += '<i></i>';
    for (let d = 1; d <= n; d++) { const k = y + '-' + (m + 1) + '-' + d, on = S.days.stamps.indexOf(k) >= 0; cells += '<i class="' + (on ? 'on' : '') + (k === today ? ' today' : '') + '">' + d + (on ? '<b></b>' : '') + '</i>'; }
    sheet('カレンダー', '<div class="calh"><button data-a="prev">◀</button><b>' + y + '年 ' + (m + 1) + '月</b><button data-a="next"' + (back ? '' : ' disabled') + '>▶</button></div><div class="cal"><u>日</u><u>月</u><u>火</u><u>水</u><u>木</u><u>金</u><u>土</u>' + cells + '</div>' +
      '<div class="stat3"><div><b>' + S.days.streak + '</b>日<small>れんぞく</small></div><div><b>' + S.days.best + '</b>日<small>さいこう記録</small></div><div><b>' + S.days.total + '</b>日<small>ごうけい</small></div></div>' +
      '<p class="note">れんぞくの ごほうび: ' + STREAK_REWARDS.map(function (r) { return r.days + '日' + (S.rewards[r.days] ? '✓' : ''); }).join(' / ') + '。1日 あいても、合計と 成長は そのまま。</p>',
      { prev: function () { calSheet(back + 1); }, next: function () { calSheet(Math.max(0, back - 1)); } });
  }
  function photoSheet() {
    const p = pet(), t = now();
    sheet('写真モード', '<div class="photo"><div class="phbg">' + petSVG(p, { mood: 'happy' }) + '</div><div class="phn">' + esc(p.name) + '</div><div class="phs">' + esc(kindOf(p.kind).name) + '・' + esc(stageOf(p) >= 4 ? formName(p.kind, p.branch, p.legend) : stageName(p)) + '</div>' +
      (S.title ? '<div class="pht">『' + esc(titleName(S.title)) + '』</div>' : '') + '<div class="stat3"><div><b>' + S.days.streak + '</b>日<small>れんぞく</small></div><div><b>' + S.days.total + '</b>日<small>ごうけい</small></div><div><b>' + zukanCount(S) + '</b>/15<small>ずかん</small></div></div>' +
      '<div class="phf">' + esc(course.title.replace('クエスト', '')) + '・すうがくペット ' + t.getFullYear() + '.' + (t.getMonth() + 1) + '.' + t.getDate() + '</div></div><p class="note">スクリーンショットで 保存して、友だちと 見せ合おう。</p>');
  }
  function recSheet() {
    const rows = units.map(function (u) { const s = S.stats.units[u.id] || [0, 0], n = s[0] + s[1]; return { u: u, n: n, ok: s[0], rate: n ? s[0] / n : null }; });
    const weak = rows.filter(function (r) { return r.n >= 5; }).sort(function (a, b) { return a.rate - b.rate; })[0], p = pet(), lead = units[decideBranch(p, units)];
    const types = Object.keys(S.stats.types).map(function (id) { const s = S.stats.types[id]; return { id: id, n: s[0] + s[1], rate: s[0] / Math.max(1, s[0] + s[1]) }; }).filter(function (x) { return x.n >= 3 && x.rate < 0.7 && course.types[x.id]; }).sort(function (a, b) { return a.rate - b.rate; }).slice(0, 3);
    sheet('きろく', '<div class="stat3"><div><b>' + S.stats.correct + '</b>問<small>正解</small></div><div><b>' + S.stats.maxCombo + '</b>問<small>さいこう連続</small></div><div><b>' + S.days.total + '</b>日<small>ごはんの日</small></div></div><div class="lab">単元ごとの 正解</div>' +
      rows.map(function (r) { return '<div class="urow"><span>' + U.mathHTML(r.u.name) + '</span><div class="bar"><b style="width:' + (r.rate === null ? 0 : Math.round(r.rate * 100)) + '%"></b></div><small>' + (r.n ? r.ok + '/' + r.n + '問(' + Math.round(r.rate * 100) + '%)' : 'まだ') + '</small></div>'; }).join('') +
      (weak && weak.rate < 0.8 ? '<p class="note">苦手かも:〈' + U.mathHTML(weak.u.name) + '〉。おやつの「基本」で 少しずつ ならそう。</p>' : '') +
      (types.length ? '<div class="lab">もう一度 ためしたい型</div>' + types.map(function (x) { return '<p class="note">・' + U.mathHTML(course.types[x.id].name) + '(' + Math.round(x.rate * 100) + '%)</p>'; }).join('') : '') +
      (stageOf(p) < 4 && lead ? '<p class="note">' + esc(p.name) + 'が いちばん よく解いているのは〈' + U.mathHTML(lead.name) + '〉。このままだと「' + esc(formName(p.kind, lead.index, false)) + '」に なりそう。</p>' : ''));
  }
  function pwSheet() {
    const pw = S.pets.length ? pwEncode(course, S) : '', show = (pw.match(/.{1,5}/g) || []).join(' ');
    sheet('記録のことば', (pw ? '<p class="note">この ことばを メモして おくと、ほかの端末でも つづきから 遊べる(なかま・コイン・ずかん・れんぞく日数。家具の 置き場所は 引きつがれない)。</p><div class="pw">' + show + '</div><button class="big" data-a="copy">コピーする</button>' : '') +
      '<div class="lab">記録のことばを 入れる</div><textarea id="ppw" rows="3" placeholder="ここに 入力"></textarea><div class="err" id="ppwe"></div><button class="big" data-a="load">この ことばで つづきから</button><p class="note">入れると、この端末の いまの記録と 入れかわる。</p>',
      { copy: function () { try { navigator.clipboard.writeText(pw); toast('コピーした'); } catch (e) { toast('コピーできなかった。メモしてね'); } },
        load: function () { const st = pwDecode(course, $('ppw').value, now()); if (!st) { $('ppwe').textContent = 'ことばが ちがうようだ。もう一度 たしかめよう'; return; } st.sound = S.sound; st.figChoice = S.figChoice; S = st; posX.length = 0; save(); closeSheet(); say('おかえり! つづきから 遊べるよ', 4500); } });
  }
  $('pnav').onclick = function (e) {
    const b = e.target.closest('[data-n]'); if (!b || !S || !S.pets.length || quizOn) return; snd('tap');
    if (editing) { editing = false; editSel = null; }
    ({ feed: feedSheet, shop: shopSheet, zukan: zukanSheet, room: roomSheet, menu: menuSheet })[b.getAttribute('data-n')]();
  };
  $('pname').onclick = function () { if (S && S.pets.length && !quizOn) photoSheet(); };

  /* ---------- 進行 ---------- */
  async function main() {
    S = load();
    if (!S || !S.pets.length) {
      const keep = S; S = keep || newState(course.id);
      await new Promise(function (res) {
        sheet('すうがくペット', '<div class="welcome"><div class="pvs">' + KINDS.map(function (k, i) { const t = newPet(k.id, [i, i + 1, 2, i, i + 2], ''); return '<div><div class="pv">' + petSVG(t, { stage: 3, mood: 'happy' }) + '</div></div>'; }).join('') + '</div><h2>' + esc(course.title.replace('クエスト', '')) + '</h2>' +
          '<p>毎日 5問、ごはんを あげるように 数学を とこう。<br>放っておいても いなくならないし、もとに もどらない。<br>じぶんの ペースで 育てよう。</p><div class="col"><button class="big" data-a="go">はじめる</button><button class="big sub" data-a="pw">記録のことばで つづきから</button></div></div>',
          { go: function () { res('new'); }, pw: function () { res('pw'); }, close: function () {} });
        $('psheet').querySelector('[data-a="close"]').style.display = 'none';
      }).then(async function (a) {
        if (a === 'pw') { await new Promise(function (res) { pwSheet(); const iv = setInterval(function () { if ($('psheet').className !== 'on') { clearInterval(iv); res(); } }, 200); }); }
        while (!S.pets.length) { const r = await createScreen('new'); adopt(S, r.kind, r.look, r.name, now()); }
      });
      save(); render(); say(pet().name + 'が やってきた! 下の「ごはん」から 5問 といてみよう', 6000);
    }
    setSound(!!S.sound); greet(touch(S, now())); save(); render();
  }
  /* 開発用: ?debug=room | gallery | items | quiz:型ID:種 | feed | shop | zukan | menu | photo | cal | rec | create | evo | auto(セーブはしない)
     &kind=animal &st=1〜5 &br=0〜3 &look=1,2,3,4 &all=1(品物を 全部 持つ)&done=1(今日のごはん ずみ)*/
  async function debugMain() {
    const a = debug.split(':'), kd = params.get('kind') || 'mystic', stg = parseInt(params.get('st') || '3', 10);
    S = newState(course.id);
    const mk = function (kind, st, br, look, name) { const p = newPet(kind, look, name, now()); p.gp = [0, 5, 15, 35, 35][st - 1]; if (st >= 4) p.branch = br; if (st >= 5) { p.legend = true; p.lg = LEGEND_NEED; } S.pets.push(p); return p; };
    mk(kd, stg, parseInt(params.get('br') || '0', 10), (params.get('look') || '0,1,2,1,1').split(',').map(Number), 'もこ');
    S.coins = 345; S.days = { last: null, streak: 6, best: 9, total: 12, stamps: [] };
    for (let i = 1; i <= 6; i++) S.days.stamps.push(dayKey(new Date(now().getTime() - i * 86400000)));
    S.days.last = S.days.stamps[0]; touch(S, now());
    if (params.get('done') === '1') { S.today.fed = MEAL; S.today.done = true; S.days.last = dayKey(now()); }
    if (params.get('all') === '1') { ITEMS.forEach(function (it) { S.owned[it.id] = 1; }); [['f_bed', 230, 200], ['f_shelf', 120, 172], ['f_plant', 284, 180], ['f_rug', 110, 232], ['f_clock', 150, 50], ['f_garland', 220, 40], ['f_lamp', 30, 190], ['f_board', 180, 176]].forEach(function (p) { place(S, p[0], p[1], p[2]); }); S.pets[0].acc = { head: 'a_mugi', neck: 'a_ribbon' }; mk('animal', 4, 1, [0, 4, 0, 3], 'こむぎ'); mk('human', 4, 3, [3, 2, 0, 2, 1], 'ルナ'); S.room.wall = params.get('wall') || 'w_haru'; S.room.floor = params.get('floor') || 'y_wood'; checkTitles(S); S.pets.forEach(function (p) { registerZukan(S, p); }); }
    render();
    if (a[0] === 'gallery') {
      let h = ''; KINDS.forEach(function (k, ki) {
        h += '<div class="lab">' + k.name + '(段階 1〜4)</div><div class="grid g5">'; for (let st = 1; st <= 4; st++) for (let v = 0; v < 5; v++) { const lk = k.parts.map(function (pt, pi) { return (v + pi * (pi + 1) + (pi === 0 ? 0 : st)) % pt.opts.length; }); const p = newPet(k.id, lk, ''); p.branch = v % 4; h += '<div class="card own">' + petSVG(p, { stage: st, mood: ['fine', 'hungry', 'happy', 'lonely', 'sleep'][v] }) + '</div>'; }
        h += '</div><div class="lab">' + k.name + '(分かれ道 4通り と 伝説)</div><div class="grid g5">'; for (let v = 0; v < 5; v++) { const p = newPet(k.id, k.parts.map(function (pt, pi) { return (ki + v + pi) % pt.opts.length; }), ''); p.branch = v % 4; h += '<div class="card own">' + petSVG(p, { stage: v === 4 ? 5 : 4, branch: v === 4 ? 1 : v }) + '</div>'; }
        h += '</div><div class="lab">' + k.name + '(小物)</div><div class="grid g5">'; ['a_mugi', 'a_tongari', 'a_beret', 'a_hana', 'a_knit', 'a_crown', 'l_kin', 'a_megane', 'a_hoshimegane', 'a_muffler'].forEach(function (id, v) { const p = newPet(k.id, k.parts.map(function (pt, pi) { return (v + pi * 2) % pt.opts.length; }), ''); p.branch = v % 4; const it = itemOf(id); p.acc[it.slot] = id; if (v % 2) p.acc.neck = ['a_ribbon', 'a_suzu', 'a_tie', 'l_niji', 'a_muffler'][(v >> 1) % 5]; h += '<div class="card own">' + petSVG(p, { stage: [2, 3, 4, 1, 4][v % 5] }) + '</div>'; });
        h += '</div>';
      }); sheet('見た目の 一覧', h);
    } else if (a[0] === 'items') {
      sheet('品物の 一覧', '<div class="grid g5">' + ITEMS.map(function (it) { return '<div class="card own">' + itemIcon(it.id) + '<span>' + esc(it.name) + '</span></div>'; }).join('') + '</div>' + ITEMS.filter(function (it) { return it.cat === 'wall'; }).map(function (w, i) { const T = newState('x'); T.room.wall = w.id; T.room.floor = ['y_wood', 'y_check', 'y_shiba', 'y_tile'][i % 4]; return '<div class="lab">' + w.name + '</div>' + roomSVG(T, { hour: i % 2 ? 21 : 12 }); }).join(''));
    } else if (a[0] === 'quiz') {
      quizOn = true; app.classList.add('quiz');
      const q = M.buildQuestion(course, a[1] || Object.keys(course.types)[0], U.makeRng(parseInt(a[2] || '1', 10)));
      if (params.get('wrong') === '1') { qhead('meal', 'fine', 'おしい! だいじょうぶ、何も へらないよ。' + (q.mistakes[0] ? '\n💡 ' + q.mistakes[0].msg : '')); api.explain(q); }
      else { S.today.fed = 2; qhead('meal', 'hungry', 'あと 3問で ごはん 完了!'); api.ask(q, { hints: 1 }, q.answers); if (q.input !== 'form' && params.get('fill') !== '0') api.dev().fill(); }
    } else if (a[0] === 'evo') { const p = pet(); showEvents({ stageFrom: stageOf(p) - 1, stageTo: stageOf(p), legend: p.legend, rewards: [], titles: [] }); }
    else if (a[0] === 'reward') showEvents({ stageFrom: 1, stageTo: 1, rewards: [STREAK_REWARDS[1]], titles: [] });
    else if (a[0] === 'create') { S.pets = []; createScreen('new'); }
    else if (a[0] === 'edit') { startEdit(); editSel = 'f_bed'; drawEdit(); render(); }
    else if (a[0] === 'reset') resetSheet(a[1] === '2' ? 2 : 1);
    else if (a[0] === 'auto') autoTest();
    else if ({ feed: 1, shop: 1, zukan: 1, menu: 1, photo: 1, cal: 1, rec: 1, pw: 1, room2: 1, dress: 1 }[a[0]]) { if (a[1]) shopTab = a[1]; ({ feed: feedSheet, shop: shopSheet, zukan: zukanSheet, menu: menuSheet, photo: photoSheet, cal: function () { calSheet(0); }, rec: recSheet, pw: pwSheet, room2: roomSheet, dress: dressSheet })[a[0]](); }
  }
  /* 自動プレイ(動作確認用): 本物の入力画面で ごはん 5問 → おやつ → まちがい → 進化 → 買い物 → 記録のことば。結果を 画面に出す */
  async function autoTest() {
    const log = []; let wrongNext = false; const seenTypes = [];
    window.addEventListener('error', function (e) { log.push('ERROR ' + e.message); });
    window.addEventListener('unhandledrejection', function (e) { log.push('REJECT ' + (e.reason && e.reason.stack || e.reason)); });
    const iv = setInterval(function () { const b = $('pfx').querySelector('button'); if (b) b.click(); api.tap(); }, 5);
    let budget = 0;
    auto = function (q, pr) {
      seenTypes.push(q.type + (wrongNext ? '(×)' : ''));
      if (++budget > 0 && budget > auto.max) { api.key('Escape'); return pr; }
      if (wrongNext) { wrongNext = false; api.key('Escape'); return pr.then(function () { return { judge: M.judgeAny(q, M.wrongInput(q)) }; }); }
      api.dev().fill(); api.key('Enter'); return Promise.race([pr, wait(300).then(function () { log.push('入力画面で 止まった: ' + q.type); api.key('Escape'); return null; })]);
    };
    try {
      S = newState(course.id); adopt(S, 'mystic', [1, 2, 3, 4], 'てすと', now()); touch(S, now()); render();
      log.push('単元: ' + units.map(function (u) { return u.id + '(基本' + u.basic.length + '/標準' + u.standard.length + '/応用' + u.advanced.length + ')'; }).join(' ') + ' 発展 ' + legendPool(course).length);
      auto.max = 99; budget = 0; wrongNext = true; await runQuiz('meal');
      log.push('ごはん: 出た型 ' + seenTypes.join(' → ')); log.push('ごはん 5問 → fed=' + S.today.fed + ' done=' + S.today.done + ' 成長=' + pet().gp + ' 段階=' + stageOf(pet()) + '(' + stageName(pet()) + ') コイン=' + S.coins + ' れんぞく=' + S.days.streak + ' スタンプ=' + S.days.stamps.length + ' まちがい=' + S.stats.wrong);
      const gp0 = pet().gp, c0 = S.coins; for (const tier of ['basic', 'standard', 'advanced']) { auto.max = 3; budget = 0; await runQuiz('snack', tier); }
      log.push('おやつ 9問(基本・標準・応用)→ 成長=' + pet().gp + '(かわらない=' + (pet().gp === gp0) + ') コイン ' + c0 + ' → ' + S.coins);
      /* 全部の単元の 基本・標準・応用・発展を、本物の入力画面で 1問ずつ */
      let n = 0; const before = S.stats.correct;
      for (const u of units) for (const tier of ['basic', 'standard', 'advanced']) for (const ref of u[tier]) { const q = M.safeQuestion(course, [ref], ref, seed); if (!q) { log.push('作れない型: ' + tid(ref)); continue; } n++; budget = 0; auto.max = 99; const r = await auto(q, api.ask(q, { hints: 1 })); if (r && r.judge.result === 'correct') S.stats.correct++; else log.push('正解に ならない: ' + q.type); }
      log.push('全部の型を 入力画面で 正解 → ' + (S.stats.correct - before) + '/' + n + ' 問'); S.stats.correct = before;
      /* 日を進めて 育てる(日付だけ 進めて 同じ手順で 記録)*/
      const day = function (k) { return new Date(now().getTime() + k * 86400000); }, feedDay = function (k) { let ev = null; for (let i = 0; i < MEAL; i++) ev = record(S, units, { mode: 'meal', type: tid(units[k % 4].basic[0]), unit: units[2].id }, true, null, day(k)); return ev; };
      const marks = []; for (let k = 1; k <= 7; k++) { const ev = feedDay(k); marks.push(k + '日後:段階' + stageOf(pet()) + (ev.rewards.length ? '🎁' + ev.rewards[0].days : '')); }
      log.push('7日ぶん: ' + marks.join(' ') + ' / 分かれ道=' + pet().branch + '(' + formName(pet().kind, pet().branch, false) + ') ずかん=' + zukanCount(S) + ' 称号=' + S.titles.join(','));
      await showEvents({ stageFrom: 3, stageTo: 4, legend: false, rewards: [STREAK_REWARDS[0]], titles: [TITLES[0]] }); log.push('進化・ごほうび・称号の 画面 OK');
      const t30 = touch(S, day(40)); log.push('33日 放置 → away=' + t30.away + ' 気分=' + mood(S, day(40)) + ' 成長=' + pet().gp + ' 段階=' + stageOf(pet()) + ' れんぞく=' + S.days.streak + ' 合計=' + S.days.total + ' なかま=' + S.pets.length);
      S.today = { date: dayKey(now()), fed: MEAL, done: true, snack: 0 }; S.days.last = dayKey(now());
      auto.max = LEGEND_NEED; budget = 0; await runQuiz('legend'); log.push('伝説への挑戦 → lg=' + pet().lg + ' 伝説=' + pet().legend + ' ずかん=' + zukanCount(S));
      S.coins = 500; shopTab = 'acc'; shopSheet(); $('psheet').querySelector('[data-a="buy"]').click(); shopTab = 'furn'; shopSheet(); $('psheet').querySelector('[data-a="buy"]').click(); shopTab = 'wall'; shopSheet(); $('psheet').querySelector('[data-a="buy"]').click(); closeSheet();
      log.push('買い物 → コイン=' + S.coins + ' 小物=' + JSON.stringify(pet().acc) + ' 家具=' + JSON.stringify(S.room.placed) + ' 壁=' + S.room.wall);
      startEdit(); $('pedit').querySelector('[data-e]').click(); const rr = $('proomsvg').getBoundingClientRect(); $('proom').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rr.left + rr.width * 0.7, clientY: rr.top + rr.height * 0.85 })); $('pedit').querySelector('[data-e="!done"]').click();
      log.push('もようがえ → ' + JSON.stringify(S.room.placed));
      const r2 = await Promise.race([createScreen('adopt'), wait(50).then(function () { $('pnm').value = 'にごう'; $('psheet').querySelector('[data-a="ok"]').click(); return wait(50).then(function () { return 'x'; }); })]); adopt(S, 'animal', [2, 1, 0, 3], 'にごう', now()); render();
      log.push('2人目 → なかま=' + S.pets.map(function (p) { return p.name + ':' + p.kind; }).join(',') + ' おせわ中=' + pet().name);
      for (const f2 of [feedSheet, zukanSheet, roomSheet, dressSheet, menuSheet, photoSheet, recSheet, pwSheet, function () { calSheet(0); }]) { f2(); closeSheet(); } log.push('全部の画面を ひらいて とじた');
      menuSheet(); $('psheet').querySelector('[data-a="reset"]').click(); const rs1 = $('psheet').querySelector('.shh b').textContent; $('psheet').querySelector('[data-a="close"]').click();
      const kept = S.pets.length; $('psheet').querySelector('[data-a="reset"]').click(); $('psheet').querySelector('[data-a="next"]').click(); const rs2 = $('psheet').querySelector('.shh b').textContent; $('psheet').querySelector('[data-a="close"]').click();
      const kept2 = S.pets.length; $('psheet').querySelector('[data-a="reset"]').click(); $('psheet').querySelector('[data-a="next"]').click(); $('psheet').querySelector('[data-a="wipe"]').click();
      log.push('はじめから やり直す: 1回目「' + rs1 + '」→ やめる なかま=' + kept + ' / 2回目「' + rs2 + '」→ やめる なかま=' + kept2 + ' / 消す → なかま=' + S.pets.length + ' コイン=' + S.coins);
      S = P.restore(JSON.stringify(Object.assign(newState(course.id), { pets: [newPet('animal', [0], 'にごう')] })), course.id); render();
      const pw = pwEncode(course, S), back = pwDecode(course, pw, now()); log.push('記録のことば(' + Array.from(pw).length + '文字)→ ' + (back ? back.pets.map(function (p) { return p.name + ' 段階' + stageOf(p); }).join(',') + ' コイン=' + back.coins + ' ずかん=' + zukanCount(back) : '読めない'));
      const again = restore(JSON.stringify(S), course.id); log.push('保存 → 読み直し: ' + (JSON.stringify(again) === JSON.stringify(restore(JSON.stringify(again), course.id)) && again.pets.length === S.pets.length && again.coins === S.coins ? '同じ' : 'ちがう') + ' / 完了');
    } catch (e) { log.push('EXCEPTION ' + (e.stack || e)); }
    clearInterval(iv); auto = null;
    sheet('自動プレイの 結果', '<div style="font-size:11px;line-height:1.6;word-break:break-all">' + log.map(esc).join('<br>') + '</div>');
  }
  (DEV ? debugMain() : main()).catch(function (e) { console.error(e); });
};

if (typeof module !== 'undefined' && module.exports) module.exports = P;
root.MathPet = P;
})(typeof globalThis !== 'undefined' ? globalThis : this);

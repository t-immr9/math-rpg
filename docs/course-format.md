# コースファイルの書き方

コースは `courses/<コースID>.js` の1ファイル。最後に `MathRPG.registerCourse({...})` で登録する。
手本は `courses/suu2-2gakki-kimatsu.js`。書いたら `node tests/check.js` で検査する。

```js
(function () {
const M = (typeof MathRPG !== 'undefined') ? MathRPG : require('../engine.js');   // ブラウザでもテストでも動く書き出し
const U = M.util;
const types = {}, sprites = {}, enemies = {}, maps = {}, dungeons = {};
// …ここに中身…
M.registerCourse({ id: 'コースID', title: 'タイトル', subtitle: '範囲', start: { map: 'town', x: 7, y: 9 },
  intro: ['はじめのメッセージ。{n} は主人公の名前'], levelCap: { base: 30, extended: 40, extendFlag: 'boss:maou' },
  zones: {...}, maps: maps, dungeons: dungeons, enemies: enemies, sprites: sprites, types: types, titles: {...} });
})();
```

## 1. 数式のマークアップ

問題文・式・解説・ヒント・ひとことは、すべてこの書き方の文字列。画面ではノートの形(縦の分数・上付きの指数・根号)になる。

| 書き方 | 表示 | 例 |
| --- | --- | --- |
| `{a/b}` | 縦の分数 | `{√6 + √2/4}`、`-{1/2}` |
| `^2` `^{…}` | 上付き(指数) | `2^3`、`2^{-3}`、`8^{{2/3}}`、`8^{-{2/3}}` |
| `_2` `_{…}` | 下付き(対数の底) | `log_2 8`、`log_{10} 2`、`log_{{1/2}} x` |
| `√3` `√{…}` | 根号 | `√{a^2 + b^2}`(数字1かたまり・1文字なら `{}` は不要) |
| `[3]√{27}` | 累乗根 | `[4]√{81}` |
| `□` | 空欄(`form` の中で使う) | `□ sin(θ □ □)`、`{√□ □ √□/□}` |
| `\n` | 改行 | |

- `-` は自動で `−` になる。2文字以上を上付き・下付きにするときは必ず `{}` で囲む。
- `{}` の中に `/` があると分数になる。分数にしたくない `/` は `{}` の外に書く。

## 2. 答えの書き方

答え(`answers`)は空欄1つにつき文字列1つ。**最も簡単な形で書く**(テストで検査される)。

| 例 | 意味 |
| --- | --- |
| `'7'` `'-2'` `'0'` | 整数 |
| `'3/2'` `'-1/8'` | 分数(分母は `/` のあと。負の符号は先頭) |
| `'√3/2'` `'2√3'` `'-√2/2'` | 根号(係数 → √ の順。分母に √ は書かない) |
| `'π/6'` `'5π/6'` `'2π'` | π(係数 → π の順) |
| `'+'` `'-'` `'<'` `'>'` | 符号・不等号を答えさせる空欄 |

- 便利な関数:`U.fracStr(6, 4)` → `'3/2'`、`U.piStr(5, 6)` → `'5π/6'`、`U.am('-√3/2')` → マークアップ `'-{√3/2}'`(解説に答えを書くとき)。
- 生徒が約分・有理化していない同じ値(`2/4`、`1/√3`)を入れたときは、不正解にせず「最も簡単な形に直そう」と出して入れ直させる。

## 3. 問題の型(`types`)

```js
types['exp-neg'] = {
  name: '0・負の指数',        // 一覧用の名前
  level: 1,                   // 難易度 0:草原 1:1階 2:2階 3:ボス 4:魔王の城 5:発展
  // noNum: true,             // 公式の穴うめなど、数値の検算ができない型だけ
  gen: function (R, opt) {    // R: 乱数。opt: 敵から渡すオプション
    const a = R.pick([2, 3, 5]), n = R.int(1, 3), big = Math.pow(a, n), ans = U.fracStr(1, big);
    return {
      text: 'つぎの値を求めよ。',          // 問題文(省略すると この文になる)
      expr: a + '^{-' + n + '}',           // 大きく出す式(なくてもよい)
      form: '□',                           // 答えの形。□ が空欄
      answers: [ans],                      // 空欄の順に正解
      keys: ['分数'],                      // 追加キー。'√' 'π' '分数' '+' '<' '>' から4つまで
      num: [Math.pow(a, -n)],              // 検算用の数値(空欄の順。符号・不等号の空欄は null)
      hint: 'a^{-n} = {1/a^n}',            // 「ひらめき」。答えは見せず、公式や最初の一歩だけ
      explain: ['a^{-n} = {1/a^n}', a + '^{-' + n + '} = {1/' + a + '^' + n + '}', '= ' + U.am(ans)],   // 2〜3行
      mistakes: U.mistakes([ans], [        // よくある誤答 → ひとこと
        { answers: [String(-big)], tag: 'neg-exp', msg: 'マイナス乗は 負の数ではなく 分数にして答えよう' }
      ])
    };
  }
};
```

**乱数 `R`**:`R.int(1, 6)`(1〜6 の整数)、`R.pick(配列)`、`R.chance(0.5)`、`R.shuffle(配列)`。`Math.random` は使わない(テストで同じ問題を再現するため)。

**検算**:`num` か `verify` のどちらかが必要。答えの文字列を作った計算とは**別の方法**(`Math.sin`、`Math.pow`、代入など)で書く。

```js
verify: function (vals, raws) { return Math.abs(Math.pow(4, vals[0]) - 8) < 1e-9; }   // vals: 数値、raws: 入力そのまま('+' など)
```

**順不同**:`unordered: [[0, 1]]` で、空欄0と1は入れかわっても正解(例:`θ = □, □`、`√6 + √2`)。

**よくある誤答 `mistakes`**:

- `answers` は空欄の数だけ書く。どの値でもよい空欄は `'*'`。
- `tag` は間違いの種類の名前(セーブデータに回数が記録される。同じ原因なら型をまたいで同じ tag にする)。`msg` は解説の前に出すひとこと。
- `U.mistakes(正解, 候補, 順不同)` に通すと、正解と同じ値・重複・書けない候補(`null` も可)が取りのぞかれる。数値によっては誤答が正解と重なるので、必ず通す。
- 誤答ごとに順不同を変えたいときは、その誤答に `unordered` を付ける。
- 候補は上から順に調べ、最初に当てはまったひとことを出す。どれにも当てはまらなければ、ふつうの解説だけになる。

**この型で使っている tag の例**:`quadrant-sign`(象限の符号)、`sincos-swap`、`cos-sign` / `sin-sign` / `tan-sign`(加法定理の符号)、`double-2`(2倍角の2)、`gousei-quadrant` / `gousei-swap`(合成の角)、`neg-exp`(負の指数)、`rat-exp-swap`、`pow-mult`、`log-add` / `log-sub` / `log-coef`(対数の性質)、`log-swap`、`log-domain`(真数条件)、`ineq-flip`(不等号の向き)、`sub-back`(置き換えを戻し忘れ)。

## 4. 敵(`enemies`)と絵(`sprites`)

```js
enemies.risu = { name: 'マイナスじょうリス', sprite: 'risu', level: 3, hp: 1, atk: 1, types: ['exp-neg'] };
enemies.expo = { name: '森の主 エクスポネンタ', sprite: 'b_forest', boss: true, level: 6, hp: 6, atk: 1.2,
  line: '指数の森は 急に 深くなるぞ……!', types: ['exp-neg', 'exp-rational', 'exp-eq'] };
```

| 項目 | 意味 |
| --- | --- |
| `level` | 強さの目安レベル(反撃の強さ・経験値のもと) |
| `hp` | 目安レベルで何問正解すれば倒せるか。草原 0.5、ザコ 1〜1.4(テストは 1〜2 問)、ボス 5〜8 |
| `atk` | 反撃の倍率。草原 0.6、ふつう 1、ボス 1.2 |
| `types` | 出す型。`'型ID'` または `{ type: '型ID', opt: {…} }`(`gen` の第2引数に渡る) |
| `swap` | 色ちがい(上位種)。`{ l: 'r', L: 'R' }` のように色の文字を置きかえる |
| `boss` `line` | ボスの印と、登場のひとこと |
| `phase2` | 体力が半分で変身:`{ name, line, swap, types }` |
| `xp` `gold` | 省略すると level と hp から自動で決まる |

**絵**:1文字 = 1ドット、`.` は透明。ザコは 16×16、ボスは 24×24。`mirror: true` にすると左半分だけ書けば左右対称になる(行の長さを数えまちがえにくい)。

```js
sprites.kaeru = { mirror: true, rows: ['........', '..lll...', /* … 16行、各8文字 … */ ] };
```

色の文字(`engine.js` の `PAL`):`K`黒 `W`白 `G`/`g`灰 `R`/`r`赤 `O`橙 `Y`/`y`黄 `L`/`l`/`d`緑 `C`/`B`/`b`青 `P`桃 `p`/`V`/`v`紫 `S`/`s`肌 `N`/`n`茶 `T`/`t`水色 `M`赤紫 `E`/`e`砂色。
確認は `index.html?course=<ID>&debug=sprites`。

## 5. マップ(`maps`)と草原(`zones`)

マップは文字の表。全部の行を同じ長さにする。

```js
maps.world = { bgm: 'field', rows: ['^^^^^', '^e=w^', '^eHw^', '^^^^^'],
  legend: {
    e: { tile: 'grass', zone: 'east' },                                   // 敵が出る草原
    H: { tile: 'i_town', event: { type: 'map', map: 'town', x: 7, y: 10 } },
    C: { tile: 'i_cave', event: { type: 'dungeon', id: 'cave' } },
    s: { tile: 'sign', solid: true, event: { type: 'sign', text: '看板の文' } }
  } };
zones: { east: { enemies: ['puchisin', 'nezumi'] } }
```

- はじめから使える文字:`.` 草 `,` 草(明るい) `=` 道 `T` 木 `~` 水 `^` 山 `h` 家(木・水・山・家は通れない)。
- `legend` の項目:`tile`(絵の名前)、`solid`(通れない)、`zone`(出る敵の組)、`npc: { pal: {1:'R', 2:'N', h:'y'} }`(人を立たせる。1=服 2=ズボン h=髪)、`event`。
- `event.type`:`map`(別のマップへ)、`dungeon`(ダンジョンの入口。看板と確認が自動で出る)、`sign`、`talk`(`lines` を順に話す)、`inn`(宿屋・すがたの変更)、`shop`(道具屋)、`church`(セーブ・記録のことば)。
- 入口の絵:`i_town` `i_cave` `i_tower` `i_forest` `i_castle`。ほかのタイルは `engine.js` の `TILES`。コース独自のタイルは `tiles: { 名前: {rows, mirror, under} }` で足せる。
- BGM:`town` `field` `dungeon` `battle` `boss`。コースで曲を変えるなら `music: { field: { tempo, lead, bass } }`(音符は `C4:2` = ド を 8分音符2つぶん、`-:2` は休み)。

## 6. ダンジョン(`dungeons`)

各階の形は入るたびに自動で作られる(部屋と通路、下り/上り階段、宝箱1〜2個)。書くのは中身だけ。

```js
dungeons.cave = {
  name: '加法定理の洞窟', unit: '加法定理・2倍角', level: 3,      // 入口の看板に出る
  theme: 'cave',                                                  // cave tower forest castle meikyu abyss
  floors: [{ enemies: ['kani', 'kahoubat'] }, { enemies: ['kahoubat', 'hebi'] }],   // 1〜3階。深いほど難しい敵に
  boss: 'kahou',                                                  // 最後は ボス部屋(毎回同じ形)
  // need: ['boss:a', 'boss:b'], needText: '入れないときの説明', openText: '開いたときの知らせ',   // 入る条件
  // hidden: { need: ['boss:maou'], to: 'meikyu', openText: '…' },   // ボス部屋の奥の隠し通路
  // extra: true                                                  // 「考査範囲外(発展)」の注意を出す
};
```

- ボスを倒すとフラグ `boss:<敵ID>` が立つ。`need` と `hidden.need` はこのフラグで書く。
- 隠しダンジョンはマップに入口を置かず、ほかのダンジョンの `hidden.to` からつなぐ。
- 階の中の敵の `level` は、ダンジョンの `level` 以上・ボスの `level` 以下にする。

## 7. 称号(`titles`)

```js
titles: {
  level: [{ lv: 1, name: '見習い計算工' }, { lv: 5, name: '角度の旅人' }],        // レベルで自動的に変わる
  special: [
    { id: 'cave', name: '洞窟の主を倒しし者', cond: { boss: 'kahou' } },          // ボス撃破
    { id: 'combo10', name: '十連撃の達人', cond: { combo: 10 } },                 // 連続正解
    { id: 'streak7', name: '毎日の求道者', cond: { streak: 7 } }                  // 連続プレイ日数
  ] }
```

言い回し(`name`)はいつ変えてもよい。**`id` と並び順は公開後に変えない**(記録のことばが壊れる)。足すときは末尾に。特別称号は16個、ボスは12体まで。

## 8. 確かめ方

```
node tests/check.js
```

- すべての型を 400 問ずつ作り、正解の値(検算)・最も簡単な形か・キーで入力できるか・表示が崩れないか・誤答が正解と重ならないかを調べる。
- ダンジョンを 1200 回 × 3 階作り、階段と宝箱にたどり着けるか、隠し通路の条件を調べる。
- マップの行の長さ、入口まで歩けるか、開放条件のつながり、敵・絵・称号のデータ、強さのバランスを調べる。

画面での確認は `index.html?course=<ID>&debug=ask:<型ID>:1`(数字を変えると別の問題)など。一覧は `CLAUDE.md` の「開発用の表示」。

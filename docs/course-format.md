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

**`□` は `form` だけ**:問題文(`text`)・式(`expr`)・ヒント・解説に `□` を書かない。穴うめ問題の問題文は「空欄に入る数を答えよ。」のように書く。(入力画面は `form` の `□` の数と `answers` の数が同じである前提で動く。テストで検査される。)

**数値の引き直しは `pickUntil`**:条件に合うまで乱数を引き直すときは、上限のない `do…while` を書かず、コースファイルの `pickUntil` を使う。200 回で打ち切り、3つ目の引数(必ず条件に合う安全な値)になる。

```js
const v = pickUntil(function () { return [R.int(2, 9), R.int(2, 9)]; },      // 作る
                    function (v) { return v[0] + v[1] !== v[0] * v[1]; },    // 条件
                    [3, 5]);                                                 // 上限に達したときの 安全な値
const m = v[0], n = v[1];
```

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

## 3b. 図・選ぶ・並べ替え・小数・不等式(数学I・数学A 向け)

見本は `courses/tameshi-suu1a.js`(試しのコース。`index.html?course=tameshi-suu1a` で開く)。
入力の種類は、`gen` が返すものの中身で自動的に決まる。

| 返すもの | 入力の種類 | 生徒の操作 |
| --- | --- | --- |
| `form` と `answers` | 空欄(これまでの形) | 空欄をタップして数を入れる |
| `choices` | 選ぶ | 選択肢をタップして「けってい」 |
| `order` | 並べ替え | 正しい順にタップして「けってい」 |
| `sol` | 不等式 | 答えの形をえらび、空欄をうめる |

どの種類でも `text`・`hint`・`explain`(2〜3行)は必要。`expr`・`fig` は自由。まちがえたら、どの種類でも反撃を受ける。

### 図(`fig`)

問題に `fig: { type: … }` を付けると、問題文の下に図が出る。**図は数値から描く**ので、乱数で数値を変えても図が合う。図の中の文字はふつうの文字(マークアップは使えない)。

**`geo`:円・接線・弦・三角形・グラフ**(座標は y が上向き。大きさは自動で合わせる)

```js
const G = M.geo, O = [0, 0], r = 5, A = G.on(O, r, 270), B = G.on(O, r, 30), tl = G.tangentAt(O, A, 6);
fig: { type: 'geo', items: [
  { t: 'circle', c: O, r: r },                                   // 円
  { t: 'seg', a: tl[0], b: tl[1] },                              // 線分(dash:true で破線、label で 長さなどの文字、side:-1 で 文字を反対側へ)
  { t: 'line', a: A, b: B },                                     // 直線(図の はしまで のびる)
  { t: 'poly', pts: [A, B, O], fill: true },                     // 多角形(三角形など)
  { t: 'angle', at: A, a: tl[1], b: B, label: 'x', color: 'acc' },   // 角の印と 文字
  { t: 'right', at: A, a: O, b: tl[1] },                         // 直角の印
  { t: 'point', p: A, label: 'A', pos: 's' },                    // 点と名前。pos: n s e w ne nw se sw / away: [x, y](その点から 遠ざかる向き)/ dot:false で 点を かかない
  { t: 'text', p: [0, 1], s: 'ℓ' },                              // 文字
  { t: 'axis', x: [-3, 5], y: [-4, 6] },                         // 座標軸
  { t: 'curve', pts: G.parabola(1, -2, -3, -3, 5), color: 'acc' } ] }   // 曲線(放物線 y = x² − 2x − 3)
```

色は `color: 'acc'`(黄)`'acc2'`(水色)`'dim'`(うすい色)。計算の道具(`M.geo`):

| 関数 | もどり値 |
| --- | --- |
| `G.on(中心, 半径, 角度)` | 円周上の点 |
| `G.tangentAt(中心, 接点, 長さ1, 長さ2)` | 接点での接線の両はし `[点, 点]` |
| `G.tangentFrom(中心, 半径, 外の点)` | 2つの接点 `[点, 点]`(外の点でなければ `null`) |
| `G.circum(a, b, c)` | 3点を通る円 `{ c, r }` |
| `G.meet(a, b, c, d)` / `G.foot(p, a, b)` | 2直線の交点 / 垂線の足 |
| `G.mid(a, b)` / `G.lerp(a, b, t)` / `G.dist(a, b)` | 中点 / 内分点 / 距離 |
| `G.angleDeg(頂点, a, b)` | 角の大きさ(度)。検算の `num` に使える |
| `G.parabola(a, b, c, x0, x1)` | 放物線の点の列 |

**`solid`:空間図形の見取り図**(かくれた辺は自動で破線になる)

```js
const cube = M.solids.cuboid(4, 4, 4);            // 直方体 ABCD-EFGH(ABCD が上の面、A の真下が E)
fig: Object.assign({}, cube, { mark: ['AE'],      // 強調する辺
                               shade: [['A', 'B', 'C', 'D']],   // うすく ぬる面
                               segs: [['A', 'G']] })            // 対角線など(破線)
// M.solids.prism(3, 3, 5) … 三角柱 ABC-DEF     M.solids.pyramid(4, 3, 5) … 四角錐 O-ABCD
// cube.verts(頂点の座標)・cube.edges(辺)・cube.faces(面)は 検算にも使える
```

**`boxplot` / `scatter` / `hist` / `table`**

```js
fig: { type: 'boxplot', rows: [{ label: 'A組', v: [最小, Q1, 中央, Q3, 最大], out: [外れ値] }], axis: [0, 100, 10], minor: 5, unit: '(点)' }
fig: { type: 'scatter', pts: [[x, y], …], xr: [0, 10, 2], yr: [0, 10, 2], xl: 'x', yl: 'y' }     // xr・yr を省くと 自動
fig: { type: 'hist', start: 40, width: 10, freqs: [2, 5, 9, 6, 3], xl: '(点)', yl: '(人)' }
fig: { type: 'table', head: ['階級(点)', '度数(人)'], rows: [['40以上 50未満', 2], …] }
```

読み取らせる値は、目盛りの上か、その中間(`minor`)に置く。

### 選ぶ(`choices`)

```js
choices: [
  { text: '3辺の垂直二等分線の交点', ok: true },
  { text: '3つの内角の二等分線の交点', tag: 'center-naishin', msg: 'それは 内心だよ' },   // tag と msg を付けると、これを選んだときに ひとことが出る
  '3本の中線の交点' ],                                                                    // 文字列だけでもよい
// ok を1つも付けなければ、1つ目が正解。ok が2つ以上なら「すべて選ぶ」になる(足りないと「まだ ほかにも あるよ」)。
cols: 4,                                    // 選択肢を 横に並べる数(辺の名前など 短いとき)
verify: function () { return …; }           // (あれば)正解の選択肢を 別の計算で確かめる
```

- **選択肢は毎回 並べ替えて出る**(並べ方は書かない)。「1つ えらんで けってい」なので、押しまちがいでは決まらない。
- 選択肢は 2〜12 個。文は重ならないこと。

### 並べ替え(`order`)

```js
order: ['2点 A、B を それぞれ中心として、等しい半径の円をかく', '2つの円の交点を P、Q とする', '直線 PQ を引く'],   // 正しい順に書く
mistakes: [{ order: [0, 2, 1], tag: 'order-line-first', msg: '交点を とるのが 先だよ' }]   // その順に並べたときの ひとこと(番号は 0 から)
```

- 3〜8 個。画面では ア・イ・ウ… の札になり、**毎回ちがう順**で出る(はじめから正しい順では出ない)。
- 最後にタップした札は、もう一度タップするか「1つ もどす」で取り消せる。

### 小数

答えに小数を書くだけでよい(`answers: ['7.5']`、`'-0.87'`)。`keys` に `'.'` を入れる。

- `7.50` は `7.5` と同じ値として正解。`0.5` と `1/2` も同じ値。
- 小数に √・π・分数は組み合わせない。四捨五入させる問題は、問題文に「小数第2位まで」と書き、答えをその桁で書く。

### 不等式の答え(`sol`)

```js
sol: { kind: 'outside', eq: false, a: '1', b: '3' },      // x < 1, 3 < x
inside: function (x) { return x * x - 4 * x + 3 > 0; },   // 検算用: もとの不等式に x を代入して 成り立つか
solVar: 'm',                                              // 文字(省くと x)
mistakes: [{ sol: { kind: 'between', a: '1', b: '3' }, tag: 'ineq-inout', msg: '＞0 は 外側だよ' },     // eq を省くと 等号の有無は 問わない
           { sol: { kind: 'outside', eq: true, a: '1', b: '3' }, tag: 'ineq-eq', msg: '等号は つかないよ' }]
```

| `kind` | 答え | 使う値 |
| --- | --- | --- |
| `between` | a ＜ x ＜ b | `a` `b`(a < b) |
| `outside` | x ＜ a, b ＜ x | `a` `b`(a < b) |
| `gt` / `lt` | x ＞ a / x ＜ a | `a` |
| `point` | x ＝ a | `a` |
| `except` | a 以外の すべての実数 | `a` |
| `all` / `none` | すべての実数 / 解なし | なし |

- `eq: true` で ≦・≧ になる。生徒は答えの形をえらび、空欄に数を入れ、「＜⇄≦」キーで等号を切りかえる。
- 値は分数・根号も書ける(`a: '-1/2'`、`'2-√7'` のような和・差は書けない)。`keys` は 3 つまで(1つは「＜⇄≦」が使う)。
- 同じ範囲の別の書き方(`x < 2, 2 < x` と「2 以外のすべての実数」)は、どちらも正解になる。
- 出す形をしぼるときは `shapes: ['between', 'outside', 'all', 'none']`。
- テストは、`inside(x)` に境界の前後の数を代入して、`sol` の範囲と合うかを調べる。

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

- 最初に、すべての型を 20000 問ずつ・すべての階を 2000 回ずつ別プロセスで作り、例外・終わらないループ・時間のかかりすぎがないかを調べる(止まったら、その型・階の名前が出る)。
- 図は、タグの対応・計算できない数・枠の外へのはみ出しを調べる。選ぶ問題は「正解だけが正解になる・並びが毎回変わる」、並べ替えは「正しい順だけが正解」、不等式は「数を代入して範囲が合う・ほかの形は不正解」を調べる。
- すべての型を 400 問ずつ作り、正解の値(検算)・最も簡単な形か・キーで入力できるか・表示が崩れないか・誤答が正解と重ならないかを調べる。
- ダンジョンを 1200 回 × 3 階作り、階段と宝箱にたどり着けるか、隠し通路の条件を調べる。
- マップの行の長さ、入口まで歩けるか、開放条件のつながり、敵・絵・称号のデータ、強さのバランスを調べる。

画面での確認は `index.html?course=<ID>&debug=ask:<型ID>:1`(数字を変えると別の問題)など。一覧は `CLAUDE.md` の「開発用の表示」。

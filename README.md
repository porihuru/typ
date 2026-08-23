# typ

IE11互換モード（Edge IE modeを含む）で動作するSharePoint連携型タイピングゲームです。

## ファイル

- `index.html` : 画面
- `style.css` : デザイン
- `app.js` : アプリ全体・通常ゲーム・公式大会
- `typing.js` : タイピング判定、スコア、EXP、ランク
- `romaji.js` : かな→ローマ字候補、複数入力方式
- `settings.js` : Cookie設定、プレイヤーコード
- `csv.js` : `config.txt` とCSVの読込
- `sp.js` : SharePoint REST API共通処理・小文字列名変換
- `config.txt` : SharePoint接続先・リスト名など
- `typing.csv` : 通常ゲーム問題
- `official.csv` : 公式スプリント固定問題

## SharePoint命名規則

このアプリで作成するSharePointの **リスト名とカスタム列の内部名は、すべて英小文字** に統一します。

SharePoint標準の `ID` / `Id` と `Title` はシステム列なので例外です。利用者が作成する業務用の列では `Title` を使わず、代わりに `key` を使用します。

`sp.js` がアプリ内部の従来フィールド名を小文字の内部名へ自動変換します。また、追加・更新時は `key` とSharePoint標準 `Title` の両方へ同じ値を書き込むため、標準 `Title` が必須のリストでも動作できます。

## config.txt

```text
WEB_ROOT=AUTO
TYPING_CSV=typing.csv
OFFICIAL_CSV=official.csv
PLAYER_LIST=players
NORMAL_RECORD_LIST=normalrecords
OFFICIAL_RECORD_LIST=officialrecords
TOURNAMENT_LIST=tournament
COUNTER_LIST=accesscounter
NORMAL_SECONDS=60
COOKIE_DAYS=365
TOURNAMENT_ID=official01
OFFICIAL_WORDS_VERSION=1
```

`WEB_ROOT` はSharePoint Webのパスを明示することもできます。

```text
WEB_ROOT=/sites/typing
```

`AUTO` の場合は現在URLから自動判定します。

## SharePointリスト設計

### 1. players

プレイヤーの成長情報を保持します。

| 内部名 | 種類 | 用途 |
|---|---|---|
| key | 1行テキスト | PlayerCode（例 `123-AB`） |
| clientid | 1行テキスト | Cookieで保持する端末識別子 |
| exp | 数値 | 累計EXP |
| rank | 数値 | 現在ランク |
| plays | 数値 | 通常ゲーム回数 |
| bestscore | 数値 | 最高スコア |

### 2. normalrecords

通常タイピングの1プレイごとの記録です。

| 内部名 | 種類 |
|---|---|
| key | 1行テキスト |
| clientid | 1行テキスト |
| score | 数値 |
| exp | 数値 |
| accuracy | 数値 |
| correctkeys | 数値 |
| misskeys | 数値 |
| completed | 数値 |
| maxcombo | 数値 |
| mode | 1行テキスト |
| playdate | 日付と時刻 |

### 3. officialrecords

公式スプリントの完走記録です。

| 内部名 | 種類 |
|---|---|
| key | 1行テキスト（PlayerCode） |
| clientid | 1行テキスト |
| tournamentid | 1行テキスト |
| courseversion | 数値 |
| timems | 数値 |
| miss | 数値 |
| correctkeys | 数値 |
| accuracy | 数値 |
| playdate | 日付と時刻 |

### 4. tournament

大会設定と参加者を同じリストで管理します。

| 内部名 | 種類 | CONFIG行 | PARTICIPANT行 |
|---|---|---|---|
| key | 1行テキスト | `official01` | `123-AB` |
| recordtype | 1行テキスト | `CONFIG` | `PARTICIPANT` |
| tournamentid | 1行テキスト | `official01` | `official01` |
| courseversion | 数値 | `1` | 空欄可 |
| entrypassword | 1行テキスト | 大会パスワード | 空欄 |
| active | はい/いいえ | はい | はい |
| playercode | 1行テキスト | 空欄 | `123-AB` |

大会ごとに有効な `CONFIG` 行は1件にします。公式大会への挑戦回数は無制限です。

### 5. accesscounter

アクセス数を保持します。

| 内部名 | 種類 |
|---|---|
| key | 1行テキスト |
| count | 数値 |

`key=total` の行を1件使用します。存在しない場合はアプリが作成を試みます。

## プレイヤーコード

`3桁数字 + 英字2文字` の形式です。

例: `123-AB`

通常ゲームでは同じ表示コードを使うことを許容します。成長情報はCookieで生成した `clientid` と組み合わせて識別します。

公式大会では `tournament` リストに `PARTICIPANT` 行として参加者コードを登録します。同一大会・同一PlayerCodeが複数登録されている場合は入場を拒否します。

## 問題CSV

基本形式は次の3列です。

```csv
ID,漢字,ひらがな
1,商品,しょうひん
2,会計,かいけい
```

任意で `レベル` または `Level` 列を追加できます。未指定の場合は、ひらがなの長さ・促音・拗音などからレベル1～5を自動判定します。

## 通常ゲーム

- 60秒（`config.txt` の `NORMAL_SECONDS` で変更可）
- 正打1キー = 10点
- 1問完成 = 100点
- ミスは直接減点しない
- ミスするとコンボが0になる
- 完成問題数・正打・正確率・最大コンボからEXPを獲得
- EXPに応じてランクアップ
- ランクが上がると高難度問題が出題対象になる

ランク:

1. ビギナー
2. ルーキー
3. ブロンズ
4. シルバー
5. ゴールド
6. プラチナ
7. ダイヤモンド
8. マスター
9. エキスパート
10. タイピングマスター

## 公式タイピング

- `official.csv` の単語は固定
- 出題順だけ毎回ランダム
- 全問題を打ち切るまでの時間をミリ秒単位で計測
- 挑戦回数は無制限
- 中止した競技は記録しない
- `tournamentid` と `courseversion` ごとに記録を分離
- 最速タイムでランキング
- 入場には参加者登録と大会パスワードの両方が必要

大会パスワードはクライアントJavaScript上の入口制御です。強いアクセス制御が必要な場合は、SharePointページやリスト自体の閲覧権限も大会参加者に限定してください。

## ローマ字設定

複数入力方法があるものを一覧から選択し、Cookieへ保存します。

例:

- `し`: `shi` / `si`
- `ち`: `chi` / `ti`
- `つ`: `tsu` / `tu`
- `しゃ`: `sha` / `sya`
- `ちゃ`: `cha` / `tya` / `cya`
- `ん`: `n` / `nn` / `n'`
- `っ`: 子音重ね / `xtu` / `ltu`

## IE11互換方針

JavaScriptはES5で記述し、次を使用していません。

- `let` / `const`
- アロー関数
- `fetch`
- `Promise`
- `async/await`
- `class`
- ES Modules

通信は `XMLHttpRequest`、SharePoint RESTは `application/json;odata=verbose` を使用します。

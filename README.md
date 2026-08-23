# typ

IE11互換モード（Edge IE modeを含む）で動作する、SharePoint連携型タイピングゲームです。

## フォルダ構成

```text
typ/
├─ index.html
├─ js/
│  ├─ app.js
│  ├─ csv.js
│  ├─ romaji.js
│  ├─ settings.js
│  ├─ typing.js
│  └─ sp.js
├─ css/
│  └─ style.css
├─ csv/
│  ├─ typing.csv
│  └─ official.csv
├─ config/
│  └─ config.txt
└─ README.md
```

`index.html` だけをルートに置き、JavaScript・CSS・CSV・設定ファイルは種類ごとのフォルダに分けています。

## 各ファイル

- `index.html` : 画面本体
- `js/app.js` : アプリ全体・通常ゲーム・公式大会
- `js/typing.js` : タイピング判定、スコア、EXP、ランク
- `js/romaji.js` : かな→ローマ字候補、複数入力方式
- `js/settings.js` : Cookie設定、プレイヤーコード
- `js/csv.js` : `config/config.txt` とCSVの読込
- `js/sp.js` : SharePoint REST API共通処理
- `css/style.css` : デザイン
- `config/config.txt` : SharePoint接続先・リスト名・CSVパスなど
- `csv/typing.csv` : 通常ゲーム問題
- `csv/official.csv` : 公式スプリント固定問題

## プレイヤーコード

`3桁数字 + 英字2文字` の形式です。

例: `123-AB`

通常ゲームでは同じ表示コードを使うことを許容します。成長情報はCookieで生成した `ClientId` と組み合わせてSharePoint側で識別します。

公式大会では `tournament` リストに参加者コードを1件だけ登録してください。同一大会・同一PlayerCodeが複数ある場合は入場を拒否します。

## 問題CSV

基本形式は次の3列です。

```csv
ID,漢字,ひらがな
1,商品,しょうひん
2,会計,かいけい
```

任意で `レベル` または `Level` 列を追加できます。未指定の場合は、ひらがなの長さ・促音・拗音などからレベル1～5を自動判定します。

## 通常ゲーム

- 60秒（`config/config.txt` の `NORMAL_SECONDS` で変更可）
- 正打1キー = 10点
- 1問完成 = 100点
- ミスは直接減点しない
- ミスするとコンボが0になる
- 完成問題数・正打・正確率・最大コンボからEXPを獲得
- EXPに応じてランクアップ
- ランクが上がると高難度問題が出題対象になる

ランクは、ビギナー、ルーキー、ブロンズ、シルバー、ゴールド、プラチナ、ダイヤモンド、マスター、エキスパート、タイピングマスターの10段階です。

## 公式タイピング

- `csv/official.csv` の単語は固定
- 出題順だけ毎回ランダム
- 全問題を打ち切るまでの時間をミリ秒単位で計測
- 挑戦回数は無制限
- 中止した競技は記録しない
- 大会ID・問題バージョンごとに記録を分離
- 最速タイムでランキング
- 入場には参加者登録と大会パスワードが必要

クライアントJavaScriptだけではパスワードを完全な秘密情報として保護できないため、強いアクセス制御が必要な場合はSharePoint側の閲覧権限も大会参加者に限定してください。

## config/config.txt

```text
WEB_ROOT=AUTO
TYPING_CSV=csv/typing.csv
OFFICIAL_CSV=csv/official.csv
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

`WEB_ROOT` は可能ならSharePoint Webのパスを明示してください。

例:

```text
WEB_ROOT=/sites/typing
```

## SharePointリスト

カスタム列の内部名は英小文字で統一します。SharePoint標準の `ID` と `Title` はシステム列のため例外です。アプリ用の主キーは `key` を使用します。

### players

| 内部名 | 種類 |
|---|---|
| key | 1行テキスト |
| clientid | 1行テキスト |
| exp | 数値 |
| rank | 数値 |
| plays | 数値 |
| bestscore | 数値 |

### normalrecords

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

### officialrecords

| 内部名 | 種類 |
|---|---|
| key | 1行テキスト |
| clientid | 1行テキスト |
| tournamentid | 1行テキスト |
| courseversion | 数値 |
| timems | 数値 |
| miss | 数値 |
| correctkeys | 数値 |
| accuracy | 数値 |
| playdate | 日付と時刻 |

### tournament

| 内部名 | 種類 |
|---|---|
| key | 1行テキスト |
| recordtype | 1行テキスト |
| tournamentid | 1行テキスト |
| courseversion | 数値 |
| entrypassword | 1行テキスト |
| active | はい/いいえ |
| playercode | 1行テキスト |

大会設定行は `recordtype=CONFIG`、参加者行は `recordtype=PARTICIPANT` とします。

### accesscounter

| 内部名 | 種類 |
|---|---|
| key | 1行テキスト |
| count | 数値 |

`key=Total` 相当の1行をアクセス総数として使用します。

## IE11互換方針

JavaScriptはES5で記述し、`let` / `const`、アロー関数、`fetch`、`Promise`、`async/await`、`class`、ES Modulesは使用しません。通信は `XMLHttpRequest`、SharePoint RESTは `application/json;odata=verbose` を使用します。

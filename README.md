# typ

IE11互換モード（Edge IE modeを含む）で動作する、SharePoint連携型タイピングゲームです。

## ファイル

- `index.html` : 画面
- `style.css` : デザイン
- `app.js` : アプリ全体・通常ゲーム・公式大会
- `typing.js` : タイピング判定、スコア、EXP、ランク
- `romaji.js` : かな→ローマ字候補、複数入力方式
- `settings.js` : Cookie設定、プレイヤーコード
- `csv.js` : `config.txt` とCSVの読込
- `sp.js` : SharePoint REST API共通処理
- `config.txt` : SharePoint接続先・リスト名など
- `typing.csv` : 通常ゲーム問題
- `official.csv` : 公式スプリント固定問題

## プレイヤーコード

`3桁数字 + 英字2文字` の形式です。

例: `123-AB`

通常ゲームでは同じ表示コードを使うことを許容します。通常ゲームの成長情報はCookieで生成した `ClientId` と組み合わせてSharePoint側で識別します。

公式大会では `公式大会設定参加者` リストに参加者コードを1件だけ登録してください。同一大会・同一PlayerCodeが複数ある場合は入場を拒否します。

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
- 大会ID・問題バージョンごとに記録を分離
- 最速タイムでランキング

公式大会の入場には次の両方が必要です。

1. `公式大会設定参加者` リストへの参加者登録
2. 大会パスワード

### 大会パスワードの注意

このアプリはIE11で動くクライアントJavaScriptだけで構成されるため、パスワード入力は「大会入口のゲート」です。強いアクセス制御が必要な場合は、SharePointページ・リスト自体の閲覧権限を大会参加者グループに限定してください。

## config.txt

```text
WEB_ROOT=AUTO
TYPING_CSV=typing.csv
OFFICIAL_CSV=official.csv
PLAYER_LIST=プレイヤー情報
NORMAL_RECORD_LIST=通常タイピング記録
OFFICIAL_RECORD_LIST=公式タイピング記録
TOURNAMENT_LIST=公式大会設定参加者
COUNTER_LIST=アクセスカウンター
NORMAL_SECONDS=60
COOKIE_DAYS=365
TOURNAMENT_ID=OFFICIAL-01
OFFICIAL_WORDS_VERSION=1
```

`WEB_ROOT` は、できればSharePoint Webのパスを明示してください。

例:

```text
WEB_ROOT=/sites/typing
```

`AUTO` は既存環境向けの自動判定です。

## SharePointリスト

リスト表示名は `config.txt` で変更できます。カスタム列は以下の **内部名（Internal Name）** で作成してください。

### 1. プレイヤー情報

| 内部名 | 種類 | 用途 |
|---|---|---|
| Title | 1行テキスト | PlayerCode |
| ClientId | 1行テキスト | ローカル識別子 |
| EXP | 数値 | 累計EXP |
| Rank | 数値 | 現在ランク |
| Plays | 数値 | 通常ゲーム回数 |
| BestScore | 数値 | 最高スコア |

### 2. 通常タイピング記録

| 内部名 | 種類 |
|---|---|
| Title | 1行テキスト |
| ClientId | 1行テキスト |
| Score | 数値 |
| EXP | 数値 |
| Accuracy | 数値 |
| CorrectKeys | 数値 |
| MissKeys | 数値 |
| Completed | 数値 |
| MaxCombo | 数値 |
| Mode | 1行テキスト |
| PlayDate | 日付と時刻 |

### 3. 公式タイピング記録

| 内部名 | 種類 |
|---|---|
| Title | 1行テキスト（PlayerCode） |
| ClientId | 1行テキスト |
| TournamentId | 1行テキスト |
| CourseVersion | 数値 |
| TimeMs | 数値 |
| Miss | 数値 |
| CorrectKeys | 数値 |
| Accuracy | 数値 |
| PlayDate | 日付と時刻 |

### 4. 公式大会設定参加者

| 内部名 | 種類 | CONFIG行 | PARTICIPANT行 |
|---|---|---|---|
| Title | 1行テキスト | 大会名 | 任意 |
| RecordType | 1行テキスト | `CONFIG` | `PARTICIPANT` |
| TournamentId | 1行テキスト | `OFFICIAL-01` | `OFFICIAL-01` |
| CourseVersion | 数値 | `1` | 空欄可 |
| EntryPassword | 1行テキスト | 大会パスワード | 空欄 |
| Active | はい/いいえ | はい | はい |
| PlayerCode | 1行テキスト | 空欄 | `123-AB` |

CONFIG行は大会ごとに有効なものを1件にしてください。

### 5. アクセスカウンター

| 内部名 | 種類 |
|---|---|
| Title | 1行テキスト |
| Count | 数値 |

`Title=Total` の行を1件使用します。存在しない場合はアプリが作成を試みます。

## ローマ字設定

複数入力方法があるものを一覧からチェックできます。設定はCookieへ保存します。

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

通信は `XMLHttpRequest`、SharePoint RESTは `application/json;odata=verbose` を使用しています。

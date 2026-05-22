# Hikone Cloud Score App

滋賀県彦根市での天体撮影判断を補助する、フロントエンドのみの Open-Meteo ビューアです。

これは気象予報業務ではなく、公開予報データを用いた個人用の天体撮影判断補助ツールです。

## 使い方

`index.html` をブラウザで開くと、Open-Meteo から今夜 18:00 から翌朝 06:00 までの hourly 予報を取得します。

- 地点: 彦根市固定
- 取得モデル: Open-Meteo Best Match、JMA、GFS
- 表示: A-E 総合判定、おすすめ時間帯、モデル別スコア、雲量折れ線グラフ、時系列テーブル
- 取得項目: `cloud_cover`, `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high`, `temperature_2m`, `relative_humidity_2m`, `dew_point_2m`, `precipitation`

## 構成

- `js/config.js`: 固定地点、取得項目、モデル設定
- `js/api.js`: Open-Meteo 取得、今夜枠の切り出し
- `js/scoring.js`: `calculateCloudScore(hourlyData)`、時間別スコア、モデル別スコア、夜間総合判定
- `js/ui.js`: サマリー、グラフ、テーブル描画
- `js/app.js`: 起動処理と再取得ボタン

この分割は、将来 `api.js` の取得先を FastAPI に差し替え、FastAPI 側で Open-Meteo レスポンスや SQLite 保存を担当できるようにしてあります。

## スコアの考え方

スコアは気象予報ではなく、撮影可否を見比べるためのヒューリスティックです。

- 雲量を中心に減点し、低層雲をやや重く扱う
- 降水がある時間は強く減点する
- 高湿度は結露や霞みの注意材料として軽く減点する
- A-E 判定は夜間のモデル平均スコアから作る
- おすすめ時間帯はモデル平均スコアが高い連続区間から選ぶ
- 高層雲が多い時間は `薄雲注意`、湿度が高く気温と露点の差が小さい時間は `結露注意` を出す
- 露点差は結露注意の表示材料に使うが、初版ではスコア減点に直接は使わない

## 次の拡張候補

1. FastAPI に `GET /forecast/night` を追加して Open-Meteo 取得をサーバー側へ移す
2. SQLite に取得時刻、モデル、地点、hourly 値、スコアを保存する
3. 複数地点、過去取得比較、月齢や薄明情報を追加する

# Hikone Cloud Score App

滋賀県彦根市での天体撮影判断を補助する、フロントエンドのみの Open-Meteo ビューアです。

このアプリは個人用の天体撮影判断補助であり、気象予報業務ではありません。

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

Best Match は画面上の参考値です。総合スコア、A-E 判定、モデル不一致度、おすすめ時間帯の集計は `ensembleModels = ["jma", "gfs"]` に従い JMA と GFS で行います。

## スコアの考え方

スコアは気象予報ではなく、撮影可否を見比べるためのヒューリスティックです。

- 雲量を中心に減点し、低層雲をやや重く扱う
- 降水がある時間は強く減点する
- 高湿度は結露や霞みの注意材料として軽く減点する
- A-E 判定は夜間の JMA/GFS 平均スコアから作る
- おすすめ時間帯は JMA/GFS 平均スコアが 70 点以上の連続区間から選び、D/E 判定なら出さない
- 高層雲が多い時間は `薄雲注意`、湿度が高く気温と露点の差が小さい時間は `結露注意` を出す
- 露点差は結露注意の表示材料に使うが、初版ではスコア減点に直接は使わない
- 同時刻の JMA と GFS の総雲量差が 30% 以上なら `予報割れ`、50% 以上なら `予報大きく不一致` とする

モデル不一致が大きい場合は、現地の空や衛星画像も確認してから撮影判断してください。

## 次の拡張候補

1. FastAPI に `GET /forecast/night` を追加して Open-Meteo 取得をサーバー側へ移す
2. SQLite に取得時刻、モデル、地点、hourly 値、スコアを保存する
3. 複数地点、過去取得比較、月齢や薄明情報を追加する

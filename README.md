# Hikone Cloud Score App

滋賀県彦根市での天体撮影判断を補助する、フロントエンドのみの Open-Meteo ビューアです。

このアプリは個人用の天体撮影判断補助であり、気象予報業務ではありません。

## 使い方

`index.html` をブラウザで開くと、Open-Meteo から今夜 18:00 から翌朝 06:00 までの hourly 予報を取得します。

- 地点: 彦根市、多賀町、米原市、長浜市、余呉、鈴鹿山麓候補地から選択
- 取得モデル: Open-Meteo Best Match、JMA、GFS
- 表示: A-E 総合判定、おすすめ時間帯、賭け候補時間帯、モデル別スコア、雲量折れ線グラフ、時系列テーブル
- 取得項目: `cloud_cover`, `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high`, `temperature_2m`, `relative_humidity_2m`, `dew_point_2m`, `precipitation`

## iPhone で確認

同じ Wi-Fi 上の iPhone から見る場合は、Windows 側でこのフォルダを配信し、Windows の IP アドレスを iPhone Safari で開きます。

1. Windows で `ipconfig` を実行し、Wi-Fi の IPv4 アドレスを確認する
2. `hikone_cloud_score_app` フォルダで `python -m http.server 8000` を実行する
3. iPhone Safari で `http://<WindowsのIPv4アドレス>:8000/` を開く

外出先から見たい場合は、静的ファイル一式を GitHub Pages で公開して Safari から開く方法もあります。公開する場合は Open-Meteo へブラウザから直接アクセスする構成であることを確認して運用してください。

## iPhone のホーム画面へ追加

GitHub Pages で公開した URL を iPhone Safari で開くと、ホーム画面からアプリ風に起動できます。

1. Safari で公開 URL を開く
2. 共有ボタンを押す
3. `ホーム画面に追加` を選ぶ
4. 表示名を確認して `追加` を押す

この初版 PWA は `manifest.json` と iPhone 用メタ情報だけを追加した静的構成です。Service Worker はまだ入れていないため、オフライン起動や予報データのキャッシュは後続拡張です。

## 構成

- `js/config.js`: 地点配列、取得項目、モデル設定
- `js/api.js`: Open-Meteo 取得、今夜枠の切り出し
- `js/scoring.js`: `calculateCloudScore(hourlyData)`、時間別スコア、モデル別スコア、夜間総合判定
- `js/ui.js`: サマリー、グラフ、テーブル描画
- `js/app.js`: 起動処理と再取得ボタン

この分割は、将来 `api.js` の取得先を FastAPI に差し替え、FastAPI 側で Open-Meteo レスポンスや SQLite 保存を担当できるようにしてあります。

Best Match は上部カードとグラフで見る参考表示です。判断主軸は JMA/GFS 比較であり、総合スコア、A-E 判定、モデル不一致度、おすすめ時間帯、詳細テーブルは `ensembleModels = ["jma", "gfs"]` に従い JMA と GFS で行います。

## 地点を追加

地点は `js/config.js` の `locations` 配列で管理します。追加時は次の形式で 1 件足してください。

```js
{
  id: "new-site",
  name: "新しい候補地",
  latitude: 35.0,
  longitude: 136.0
}
```

最後に選んだ地点 ID はブラウザの `localStorage` に保存され、次回起動時に復元されます。

## スコアの考え方

スコアは気象予報ではなく、撮影可否を見比べるためのヒューリスティックです。

- 雲量を中心に減点し、低層雲をやや重く扱う
- 降水がある時間は強く減点する
- 高湿度は結露や霞みの注意材料として軽く減点する
- A-E 判定は夜間の JMA/GFS 平均スコアから作る
- おすすめ時間帯は JMA/GFS 平均スコアが高い時間帯で、平均スコアが 70 点以上の連続区間から選び、D/E 判定なら出さない
- 賭け候補は JMA または GFS の片方のモデルだけ良い時間帯を表示する
- 高層雲が多い時間は `薄雲注意`、湿度が高く気温と露点の差が小さい時間は `結露注意` を出す
- 露点差は結露注意の表示材料に使うが、初版ではスコア減点に直接は使わない
- 同時刻の JMA と GFS の総雲量差を詳細テーブルへ集約し、`安定`、`やや不一致`、`予報割れ`、`大きく不一致` で読む

予報割れが大きい場合は、衛星画像と現地の空確認が必須です。

## 次の拡張候補

1. FastAPI に `GET /forecast/night` を追加して Open-Meteo 取得をサーバー側へ移す
2. SQLite に取得時刻、モデル、地点、hourly 値、スコアを保存する
3. 複数地点、過去取得比較、月齢や薄明情報を追加する

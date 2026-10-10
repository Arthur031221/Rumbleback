<p align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback">
</p>

<h1 align="center">Rumbleback</h1>

<p align="center"><strong>重播任何一次地震，算出你有幾秒。</strong></p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

<p align="center">
  <img src="assets/demo.gif" alt="重播 2024 年花蓮 M7.4 地震：藍色的 P 波圈與橙色的 S 波圈掃過臺灣，地震儀與強震儀在波到達時亮起，臺北的圖釘顯示 P 波 20 秒、S 波 36 秒抵達" width="100%">
</p>

**用 14 次地震、3,933 筆真實的 P 波到時比對，中位誤差 0.66 秒。**
<sub>觀測到時減去 iasp91 的首達 P 波，測站距離不超過 95 度，到時是 USGS 用來定位各地震的資料（M6.8 到 M9.1）。用 `npm run validate` 重現，細節見 [docs/ACCURACY.md](docs/ACCURACY.md)。</sub>

- **不是動畫。** 每個點都是 USGS 提供的真實儀器、到時或有感回報。兩個圈來自公開的地球模型，我用 ObsPy 在 600 個隨機點驗證，並在每個地震上和真實到時比對。
- **不是地圖上的一個規模數字。** 在家的位置放個圖釘，就能讀到你自己的數字：P 波幾秒到、S 波幾秒到、搖得多強，以及在任何時間點發出警報會給你幾秒。
- **不是伺服器。** 這是靜態網頁，沒有帳號、沒有分析追蹤，圖釘不會離開你的瀏覽器。

## 試試看

打開 **[線上頁面](https://arthur031221.github.io/Rumbleback/)**，它會從 2024 年花蓮地震開始自動播放。點一下地圖，在你家放個圖釘。

<details>
<summary><strong>在本機執行（需要 Node 22.18 以上）</strong></summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

http://127.0.0.1:4173/

</details>

## 功能

- **震波**：地表上的首達 P 波與 S 波波前，考慮震源深度，所以深層地震在波浮出地表前不會有圈。
- **地震儀**：分析師在真實測站挑出 P 波到時的那一刻，該測站亮起。
- **ShakeMap**：跟在 S 波後面展開的震度圖。
- **真實地震波形**：時間軸上方畫出附近測站的真實垂直向波形，並標出模型的 P 波與 S 波到時和分析師挑出的 P 波到時。
- **強震儀與有感回報**：依實測或回報的震度上色。
- **預警盲區**：依你選的警報時間，S 波比警報更早到的範圍。
- **你的幾秒**：圖釘卡片給出 P 波與 S 波的到達時間、兩者差距、這個位置的 ShakeMap 震度，以及警報時間滑桿。這是用模型算的結果，不是任何真實警報的紀錄。
- **分享**：連結、方形圖卡、限時動態圖卡與錄製影片。連結預設不含你的圖釘，圖卡只顯示城市名稱。
- **九種語言**，包含地圖上的地名。

## 準確度

這些數字說明模型能重現真實儀器記錄到的結果，並不代表它能預測沒看過的地震，因為 USGS 的到時與發震時間來自同一批資料。USGS 的 S 波到時很少，所以 S 波圈只來自模型，頁面會在每個地震上說明這點。

## 常用指令

`npm run build`, `npm run serve`, `npm test`, `npm run test:e2e`, `npm run validate`

完整說明請看英文版文件：[README.md](README.md), [docs/](docs/INSTALL.md), [CONTRIBUTING.md](CONTRIBUTING.md)

## 致謝

地震資料、到時、ShakeMap 與有感回報來自 [USGS](https://earthquake.usgs.gov)。走時來自 iasp91 模型，透過 [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html) 計算。地圖圖磚來自 [OpenFreeMap](https://openfreemap.org)，資料來自 OpenStreetMap 貢獻者，由 [MapLibre GL JS](https://maplibre.org) 繪製。海岸線與城市名稱來自 [Natural Earth](https://www.naturalearthdata.com)。完整清單見 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 授權

[MIT](LICENSE)

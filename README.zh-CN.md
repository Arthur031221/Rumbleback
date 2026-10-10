<p align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback">
</p>

<h1 align="center">Rumbleback</h1>

<p align="center"><strong>重播任何一次地震，算出你有几秒。</strong></p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

<p align="center">
  <a href="https://arthur031221.github.io/Rumbleback/"><img src="assets/demo.gif" alt="重播 2024 年花莲 M7.4 地震：蓝色的 P 波圈与橙色的 S 波圈扫过台湾，地震仪与强震仪在波到达时亮起，台北的图钉显示 P 波 20 秒、S 波 36 秒到达" width="100%"></a>
</p>

**用 14 次地震、3,933 条真实的 P 波到时比对，中位误差 0.66 秒。**
<sub>观测到时减去 iasp91 的首达 P 波，台站距离不超过 95 度，到时是 USGS 用来定位各地震的数据（M6.8 到 M9.1）。用 `npm run validate` 复现，细节见 [docs/ACCURACY.md](docs/ACCURACY.md)。</sub>

- **不是动画。** 每个点都是 USGS 提供的真实仪器、到时或有感报告。两个圈来自公开的地球模型，我用 ObsPy 在 600 个随机点验证，并在每个地震上和真实到时比对。
- **不是地图上的一个震级数字。** 在家的位置放个图钉，就能读到你自己的数字：P 波几秒到、S 波几秒到、震得多强，以及在任何时间点发出预警会给你几秒。
- **不是服务器。** 这是静态网页，没有账号、没有统计追踪，图钉不会离开你的浏览器。

## 挑一个故事

每个链接都会在线上页面打开一次地震，图钉已经放在一座城市上，重播会自己开始。P 波和 S 波的时间来自模型，震动程度来自 USGS 的 ShakeMap，都和图钉卡片上看到的一样。

| 地震 | 图钉 | P 波 | S 波 | 那里的震动 |
|---|---|---:|---:|---|
| [2011 东日本大地震（日本）](https://arthur031221.github.io/Rumbleback/?event=official20110311054624120_30#pin=35.69,139.75)，M9.1 | 东京，372 公里 | 50 秒 | 90 秒 | MMI 6.8 |
| [2025 曼德勒（缅甸）](https://arthur031221.github.io/Rumbleback/?event=us7000pn9s#pin=13.75,100.5)，M7.7 | 曼谷，1,038 公里 | 135 秒 | 241 秒 | MMI 4.6 |
| [2010 毛莱（智利）](https://arthur031221.github.io/Rumbleback/?event=official20100227063411530_30#pin=-33.45,-70.67)，M8.8 | 圣地亚哥，360 公里 | 49 秒 | 88 秒 | MMI 7.5 |
| [2024 花莲（台湾）](https://arthur031221.github.io/Rumbleback/?event=us7000m9g4#pin=25.03,121.56)，M7.4 | 台北，133 公里 | 20 秒 | 36 秒 | MMI 5.9 |

## 试试看

打开 **[在线页面](https://arthur031221.github.io/Rumbleback/)**，它会从 2024 年花莲地震开始自动播放。点一下地图，在你家放个图钉。

<details>
<summary><strong>在本机运行（需要 Node 22.18 以上）</strong></summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

http://127.0.0.1:4173/

</details>

## 功能

- **震波**：地表上的首达 P 波与 S 波波前，考虑震源深度，所以深层地震在波露出地表前不会有圈。
- **地震仪**：分析人员在真实台站拾取 P 波到时的那一刻，该台站亮起。
- **查看圆点**：鼠标停在已亮起的圆点上，台站会显示分析人员的拾取时间与模型时间的对照，强震仪显示烈度与峰值，有感报告显示报告数量。与真实数据比对的卡片也以表格列出十个台站，键盘和触屏都能读到。
- **ShakeMap**：跟在 S 波后面展开的烈度图。
- **真实地震波形**：时间轴上方画出附近台站的真实垂直向波形，并标出模型的 P 波与 S 波到时和分析人员拾取的 P 波到时。
- **强震仪与有感报告**：按实测或上报的烈度上色。地震卡片里有一条色阶说明。
- **预警盲区**：按你选的预警时间，S 波比预警更早到的范围。
- **你的几秒**：图钉卡片给出 P 波与 S 波的到达时间、两者差距、这个位置的 ShakeMap 烈度，以及预警时间滑块。这是用模型算出的结果，不是任何真实预警的记录。有个按钮可以从波到达图钉前一刻重播。
- **分享**：链接、方形图卡、竖版图卡与录制视频（浏览器支持时保存为 MP4，iPhone 和社交应用都能播放）。链接默认不含你的图钉，图卡只显示城市名称。
- **任何地震**：14 次精选地震无需调用 USGS 即可播放。"最近"和"搜索"标签读取 USGS 实时目录，"链接"标签可以粘贴 USGS 事件页面的网址或事件编号，有 EarthScope 波形时也会一并载入。
- **手机和键盘**：在手机上面板变成底部抽屉，波形条仍在时间轴上方，图卡会打开系统分享菜单。用键盘时，空格键播放或暂停，方向键逐秒前进，加减号缩放地图。新放的图钉会把抽屉滚动到它的数字，横放手机时面板留在左侧，地图不被遮住，屏幕阅读器会在 P 波、S 波和预警到达图钉时朗读。
- **你的时区**：地震卡片除了 UTC，也给出你所在时区的时间。
- **九种语言**，包含地图上的地名。

## 准确度

这些数字说明模型能重现真实仪器记录到的结果，并不代表它能预测没见过的地震，因为 USGS 的到时与发震时刻来自同一批数据。USGS 的 S 波到时很少，所以 S 波圈只来自模型，页面会在每个地震上说明这点。

## 常用命令

`npm run build`, `npm run serve`, `npm test`, `npm run test:e2e`, `npm run validate`

完整说明请看英文版文档：[README.md](README.md), [docs/](docs/INSTALL.md), [CONTRIBUTING.md](CONTRIBUTING.md)

## 致谢

地震数据、到时、ShakeMap 与有感报告来自 [USGS](https://earthquake.usgs.gov)。走时来自 iasp91 模型，通过 [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html) 计算。地图瓦片来自 [OpenFreeMap](https://openfreemap.org)，数据来自 OpenStreetMap 贡献者，由 [MapLibre GL JS](https://maplibre.org) 绘制。海岸线与城市名称来自 [Natural Earth](https://www.naturalearthdata.com)。完整清单见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 许可证

[MIT](LICENSE)

Assisted by Claude/Codex.

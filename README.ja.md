<p align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback">
</p>

<h1 align="center">Rumbleback</h1>

<p align="center"><strong>どんな地震も再生。自分に何秒あったかがわかる。</strong></p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

<p align="center">
  <img src="assets/demo.gif" alt="2024年花蓮 M7.4 地震の再生。青いP波と橙のS波の輪が台湾を広がり、地震計と強震計が波の到達で点灯し、台北のピンにはP波まで20秒、S波まで36秒と表示される" width="100%">
</p>

**14の地震、実際のP波の読み取り3,933件との照合で、誤差の中央値は0.66秒。**
<sub>観測された到達時刻からiasp91の初動P波を引いた値。観測点は震央から95度以内、読み取りはUSGSが各地震の位置決定に使ったもの（M6.8からM9.1）。`npm run validate` で再現できます。詳細は [docs/ACCURACY.md](docs/ACCURACY.md) を参照。</sub>

- **アニメーションではありません。** 点はすべてUSGSが公開している実際の観測機器、読み取り、体感報告です。2つの輪は公開された地球モデルから計算し、ObsPyと600のランダムな点で照合し、各地震で実際の読み取りとも照合しています。
- **地図の上のマグニチュードだけではありません。** 自宅にピンを立てると、P波とS波がいつ届いたか、どれくらい強かったか、好きな時刻に警報が出ていたら何秒あったかが自分の数字で読めます。
- **サーバーではありません。** 静的なページです。アカウントも解析もなく、ピンはブラウザの外に出ません。

## 試す

**[ライブページ](https://arthur031221.github.io/Rumbleback/)** を開くと、2024年の花蓮地震から自動で再生が始まります。地図をタップして自宅にピンを立ててください。

<details>
<summary><strong>ローカルで実行（Node 22.18 以上）</strong></summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

http://127.0.0.1:4173/

</details>

## できること

- **地震波**：地表での初動P波とS波の波面。震源の深さを考慮するので、深い地震では波が地表に届くまで輪が出ません。
- **地震計**：実際の観測点でP波の到達が読み取られた瞬間に点灯します。
- **点の確認**：点灯した点にマウスを置くと、観測点は解析者の読み取り時刻とモデルの時刻の比較、強震計は震度とピーク値、体感報告は件数を表示します。
- **ShakeMap**：S波の後ろに広がる震度分布。
- **実際の地震波形**：タイムラインの上に近くの観測点の上下動の実波形を描き、モデルのP波・S波の到達と解析者のP波読み取りを重ねます。
- **強震計と体感報告**：測定または報告された震度で色分けします。
- **警報が間に合わない範囲**：選んだ警報時刻より先にS波が届いた範囲。
- **あなたの何秒**：ピンのカードに、P波とS波の到達時刻、その差、その場所のShakeMap震度、警報時刻のスライダーが出ます。モデルによる計算で、実際の警報の記録ではありません。
- **共有**：リンク、正方形カード、縦型カード、動画の録画（ブラウザが対応していれば MP4 で保存され、iPhone や SNS でも再生できます）。リンクは既定でピンを含まず、カードには都市名だけが入ります。
- **どの地震でも**：注目の 14 件は USGS を呼ばずに再生できます。「最近」と「検索」タブは USGS のライブカタログを読み、「リンク」タブには USGS のイベントページのアドレスかイベント ID を貼り付けられます。EarthScope に波形があれば一緒に読み込みます。
- **スマートフォンとキーボード**：スマートフォンではパネルが下から出るシートになり、波形ストリップはタイムラインの上に残り、カードはシステムの共有シートを開きます。キーボードでは、スペースで再生と一時停止、矢印キーで 1 秒ずつ進み、プラスとマイナスで地図を拡大縮小します。新しいピンを置くとシートがその数字までスクロールし、スクリーンリーダーにはP波、S波、警報がピンに届いたことが読み上げられます。
- **あなたのタイムゾーン**：地震カードには UTC に加えて、あなたのタイムゾーンの時刻が出ます。
- **9言語**、地図の地名も含みます。

## 精度

この数字は、モデルが実際の観測機器の記録を再現できることを示すもので、未知の地震を予測できることを示すものではありません。USGSの読み取りと発震時刻は同じデータから来ているためです。USGSのS波の読み取りはほとんどないので、S波の輪はモデルだけで、ページは各地震でそのことを表示します。

## よく使うコマンド

`npm run build`, `npm run serve`, `npm test`, `npm run test:e2e`, `npm run validate`

詳しくは英語のドキュメントを参照してください：[README.md](README.md), [docs/](docs/INSTALL.md), [CONTRIBUTING.md](CONTRIBUTING.md)

## クレジット

地震データ、読み取り、ShakeMap、体感報告は [USGS](https://earthquake.usgs.gov)。走時はiasp91モデルを [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html) で計算。地図タイルは [OpenFreeMap](https://openfreemap.org)（データはOpenStreetMapの貢献者）、描画は [MapLibre GL JS](https://maplibre.org)。海岸線と都市名は [Natural Earth](https://www.naturalearthdata.com)。全一覧は [THIRD_PARTY.md](THIRD_PARTY.md)。

## ライセンス

[MIT](LICENSE)

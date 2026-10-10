<p align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback">
</p>

<h1 align="center">Rumbleback</h1>

<p align="center"><strong>어떤 지진이든 다시 재생하고, 내게 몇 초가 있었는지 확인하세요.</strong></p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

<p align="center">
  <img src="assets/demo.gif" alt="2024년 화롄 M7.4 지진 재생: 파란 P파와 주황 S파 고리가 대만을 가로지르고, 지진계와 강진계가 파가 도착하는 순간 켜지며, 타이베이의 핀에는 P파 20초, S파 36초가 표시된다" width="100%">
</p>

**지진 14건, 실제 P파 판독 3,933건과 비교한 오차 중앙값은 0.66초입니다.**
<sub>관측된 도착 시각에서 iasp91의 첫 P파를 뺀 값입니다. 관측소는 진앙에서 95도 이내이고, 판독은 USGS가 각 지진의 위치를 정하는 데 쓴 것입니다(M6.8부터 M9.1). `npm run validate`로 재현할 수 있고, 자세한 내용은 [docs/ACCURACY.md](docs/ACCURACY.md)에 있습니다.</sub>

- **애니메이션이 아닙니다.** 모든 점은 USGS가 제공한 실제 관측 장비, 판독, 체감 보고입니다. 두 고리는 공개된 지구 모델로 계산하고, ObsPy와 600개의 무작위 지점에서 대조하며, 모든 지진에서 실제 판독과도 비교합니다.
- **지도 위의 규모 숫자가 아닙니다.** 집에 핀을 꽂으면 P파와 S파가 언제 도착했는지, 얼마나 강했는지, 원하는 시점에 경보가 나갔다면 몇 초가 있었는지 내 숫자로 볼 수 있습니다.
- **서버가 아닙니다.** 정적 페이지입니다. 계정도 분석도 없고, 핀은 브라우저 밖으로 나가지 않습니다.

## 사용해 보기

**[라이브 페이지](https://arthur031221.github.io/Rumbleback/)**를 열면 2024년 화롄 지진부터 자동으로 재생됩니다. 지도를 눌러 집에 핀을 꽂아 보세요.

<details>
<summary><strong>로컬에서 실행(Node 22.18 이상 필요)</strong></summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

http://127.0.0.1:4173/

</details>

## 기능

- **지진파**: 지표에서의 첫 P파와 S파 파면입니다. 진원 깊이를 반영하므로 깊은 지진은 파가 지표에 올라오기 전까지 고리가 나타나지 않습니다.
- **지진계**: 실제 관측소에서 분석가가 P파 도착을 판독한 순간에 켜집니다.
- **ShakeMap**: S파 뒤로 펼쳐지는 진도 분포입니다.
- **실제 지진 파형**: 타임라인 위에 가까운 관측소의 수직 지반 운동 실제 파형을 그리고, 모델의 P파·S파 도착과 분석가가 판독한 P파 도착을 겹쳐 표시합니다.
- **강진계와 체감 보고**: 측정되거나 보고된 진도로 색을 입힙니다.
- **경보 사각지대**: 선택한 경보 시각보다 S파가 먼저 도착한 범위입니다.
- **나의 몇 초**: 핀 카드에 P파와 S파의 도착 시각, 둘의 차이, 그 위치의 ShakeMap 진도, 경보 시각 슬라이더가 나옵니다. 모델로 계산한 값이며 실제 경보의 기록이 아닙니다.
- **공유**: 링크, 정사각형 카드, 세로형 카드, 영상 녹화. 링크에는 기본적으로 핀이 들어가지 않고, 카드에는 도시 이름만 표시됩니다.
- **9개 언어**, 지도의 지명 포함.

## 정확도

이 숫자는 모델이 실제 관측 장비의 기록을 재현한다는 뜻이지, 보지 못한 지진을 예측한다는 뜻이 아닙니다. USGS의 판독과 발생 시각이 같은 데이터에서 나오기 때문입니다. USGS의 S파 판독은 거의 없어서 S파 고리는 모델만 사용하며, 페이지는 모든 지진에서 이를 알려 줍니다.

## 자주 쓰는 명령

`npm run build`, `npm run serve`, `npm test`, `npm run test:e2e`, `npm run validate`

자세한 내용은 영어 문서를 참고하세요: [README.md](README.md), [docs/](docs/INSTALL.md), [CONTRIBUTING.md](CONTRIBUTING.md)

## 출처

지진 데이터, 판독, ShakeMap, 체감 보고는 [USGS](https://earthquake.usgs.gov)에서 가져옵니다. 주시는 iasp91 모델을 [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html)로 계산했습니다. 지도 타일은 [OpenFreeMap](https://openfreemap.org)(데이터는 OpenStreetMap 기여자)이고 [MapLibre GL JS](https://maplibre.org)로 그립니다. 해안선과 도시 이름은 [Natural Earth](https://www.naturalearthdata.com)입니다. 전체 목록은 [THIRD_PARTY.md](THIRD_PARTY.md)에 있습니다.

## 라이선스

[MIT](LICENSE)

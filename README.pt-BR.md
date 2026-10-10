<p align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback">
</p>

<h1 align="center">Rumbleback</h1>

<p align="center"><strong>Reveja qualquer terremoto. Veja os seus segundos.</strong></p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

<p align="center">
  <img src="assets/demo.gif" alt="O terremoto de Hualien de 2024 (M7,4) reproduzido: um anel azul da onda P e um laranja da onda S cruzam Taiwan, sismômetros e acelerógrafos acendem quando as ondas chegam, e um marcador em Taipé mostra 20 segundos até a onda P e 36 até a onda S" width="100%">
</p>

**0,66 s de erro mediano contra 3.933 leituras reais da onda P de 14 terremotos.**
<sub>Chegada observada menos a primeira chegada P do iasp91, estações até 95 graus de distância, com as leituras que o USGS usou para localizar cada terremoto (M6,8 a M9,1). Reproduza com `npm run validate`. Detalhes em [docs/ACCURACY.md](docs/ACCURACY.md).</sub>

- **Não é uma animação.** Cada ponto é um instrumento, uma leitura ou um relato de sensação reais do USGS. Os dois anéis vêm de um modelo da Terra publicado que comparo com o ObsPy em 600 pontos aleatórios e com leituras reais em cada terremoto.
- **Não é uma magnitude num mapa.** Coloque um marcador na sua casa e leia os seus próprios números: quando a onda P chegou, quando a S chegou, a força do tremor e quantos segundos um alerta emitido em qualquer momento teria dado a você.
- **Não é um servidor.** Uma página estática. Sem conta, sem análise, e o seu marcador nunca sai do navegador.

## Experimente

Abra a **[página ao vivo](https://arthur031221.github.io/Rumbleback/)**. Ela começa no terremoto de Hualien de 2024 e toca sozinha. Toque no mapa para colocar um marcador na sua casa.

<details>
<summary><strong>Rodar localmente (Node 22.18 ou mais novo)</strong></summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

http://127.0.0.1:4173/

</details>

## O que você recebe

- **Ondas**: as primeiras frentes P e S na superfície, considerando a profundidade, então um terremoto profundo não mostra anel até a onda chegar à superfície.
- **Sismômetros**: um ponto que acende no momento em que um analista marcou a chegada P numa estação real.
- **Inspecionar um ponto**: pare o mouse sobre um ponto aceso. Uma estação mostra a marca ao lado do tempo do modelo, um instrumento a intensidade e os valores máximos, e um relato de sensação a quantidade.
- **ShakeMap**: o mapa de intensidade, revelado atrás da onda S.
- **Sismograma real**: sobre a linha do tempo, o movimento vertical real de uma estação próxima, com a chegada modelada de P e S e a chegada de P marcada por um analista.
- **Movimento forte e relatos de sensação**: coloridos pela intensidade medida ou relatada.
- **Zona cega**: a área onde a onda S chegou antes de um alerta emitido no momento que você escolher.
- **Seus segundos**: o cartão do marcador mostra a chegada de P e S, a diferença, a intensidade do ShakeMap ali e um controle para a hora do alerta. É aritmética sobre o modelo, não o registro de um alerta real.
- **Compartilhar**: um link, um cartão quadrado, um cartão vertical e um vídeo gravado, salvo como MP4 quando o navegador consegue, para tocar no iPhone e nos apps sociais. O link deixa o seu marcador de fora por padrão e os cartões mostram o nome de uma cidade.
- **Qualquer terremoto**: os 14 em destaque rodam sem consultar o USGS. As abas Recentes e Buscar leem o catálogo ao vivo do USGS, a aba Link abre o endereço de uma página de evento do USGS ou um id que você colar, e o sismograma do EarthScope é carregado quando existe.
- **Celular e teclado**: no celular o painel vira uma folha inferior, a faixa do sismograma fica sob o mapa e os cartões abrem o menu de compartilhamento do sistema. Com teclado, a barra de espaço toca e pausa, as setas avançam um segundo e mais e menos aproximam ou afastam o mapa. Um marcador novo leva a folha até os seus números. Com o celular na horizontal o painel fica ao lado e o mapa mantém o seu espaço. Um leitor de tela é avisado quando a onda P, a onda S e o alerta chegam ao marcador.
- **Seu fuso horário**: o cartão do terremoto mostra a hora em UTC e também no seu fuso horário.
- **Nove idiomas**, inclusive os nomes no mapa.

## Precisão

Estes números mostram que o modelo reproduz o que instrumentos reais registraram. Não mostram que ele preveja um terremoto que não viu, porque as leituras e a hora de origem do USGS vêm dos mesmos dados. O USGS publica quase nenhuma leitura da onda S, então o anel S vem só do modelo, e a página avisa isso em cada terremoto.

## Comandos comuns

`npm run build`, `npm run serve`, `npm test`, `npm run test:e2e`, `npm run validate`

Para os detalhes, veja a documentação em inglês: [README.md](README.md), [docs/](docs/INSTALL.md), [CONTRIBUTING.md](CONTRIBUTING.md)

## Créditos

Dados de terremotos, leituras, ShakeMap e relatos de sensação do [USGS](https://earthquake.usgs.gov). Tempos de percurso do modelo iasp91 via [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html). Blocos de mapa do [OpenFreeMap](https://openfreemap.org) com dados dos colaboradores do OpenStreetMap, desenhados pelo [MapLibre GL JS](https://maplibre.org). Costas e nomes de cidades do [Natural Earth](https://www.naturalearthdata.com). Lista completa em [THIRD_PARTY.md](THIRD_PARTY.md).

## Licença

[MIT](LICENSE)

Assisted by Claude/Codex.

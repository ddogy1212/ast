# 🌌 Orbit Keepsake · 허블 생일 포토카드

NASA 허블 우주망원경이 **선택한 월·일에 관측한** 천체 사진을 불러와 포토카드로 만드는 작은 한국어 웹사이트입니다. 사용자가 직접 꾸미고 PNG로 저장할 수 있습니다.

## 바로 실행하기

**Node.js 18 이상**이 설치된 컴퓨터에서:

```bash
node server.js
```

브라우저에서 **http://localhost:3000** 을 여세요. 외부 npm 패키지를 설치할 필요가 없습니다.

- 생일의 월·일을 선택하면 NASA 2026 확장판 공개 CSV에서 해당 날짜의 사진 **최대 5장**을 불러옵니다. 2월 29일도 지원합니다.
- 비율: 54 × 86 mm 포토카드(기본), 1:1, 3:4, 4:3, 9:16.
- 개인 사진(JPG, PNG, WEBP), 텍스트, 색상, 스티커, 레이어 이동·크기·회전.
- **자동 누끼**: 사진 가장자리의 배경색을 기준으로 연결된 유사 색상을 지우는 **단색 배경용 알고리즘**입니다. AI 인물 분할 모델이 아니므로 복잡한 사진에서는 수동 지우개와 복원 브러시를 사용하세요.
- PNG 다운로드 후 제작한 기억 CD/포토카드 키링의 홍보 모달, [TapMoment Shop](https://tapmoment-shop.ddogy503.chatgpt.site/) 링크, 닫으면 처음으로 초기화.

## GitHub에 올리기

1. GitHub에서 새 저장소를 만들고 이 ZIP **내부의 파일**을 압축 해제해서 업로드합니다 (`server.js`, `app.js`, `index.html`, `styles.css`, `assets/`, `README.md` 등).
2. 로컬에서는 `node server.js`를 실행합니다.
3. 인터넷 공개 배포는 **Node.js 서버 호스팅**이 가능한 Render, Railway, VPS 등의 서비스를 연결해 GitHub 저장소에서 실행하세요. 시작 명령어는 `node server.js`, 포트는 `process.env.PORT`를 사용합니다.
4. **GitHub Pages만으로는 실행되지 않습니다.** 이 프로젝트는 NASA의 CSV 데이터를 서버에서 읽어 오는 `/api/hubble` API를 사용하기 때문입니다. 정적 GitHub Pages 배포가 꼭 필요하다면 서버리스 API 또는 미리 저장한 자료를 별도로 구성해야 합니다.

## 폴더 구성

- `server.js`: NASA CSV 조회/파싱 및 Node.js 내장 HTTP 서버 (외부 의존성 0)
- `index.html`: 사용자 화면, 편집기, 누끼 스튜디오, 홍보 모달
- `app.js`: HTML Canvas 편집기, 이미지 레이어, 브라우저 내 배경 제거, PNG 저장
- `styles.css`: 데스크톱/모바일 반응형 스타일
- `assets/promo.svg`: 기억 CD와 포토카드 키링용 직접 제작한 오리지널 홍보 일러스트

## 데이터 및 정확성

- NASA 원본: https://science.nasa.gov/mission/hubble/multimedia/what-did-hubble-see-on-your-birthday/
- 데이터: `https://science.nasa.gov/specials/apps/what-did-hubble-see-on-your-birthday/data/data.csv?v=2026-06-22_B`
- 이미지: NASA의 `share_images` 공개 파일을 크로스 오리진 허용 설정으로 불러옵니다. NASA 자료 서버의 정책 변경, 장애나 데이터 주소 변경 시 갱신이 필요할 수 있습니다.
- **출생한 정확한 연도에 촬영한 사진을 찾는 기능이 아닙니다.** 같은 월·일에 촬영한 허블 관측 사진을 소개합니다. 복수 날짜에 걸쳐 수집된 이미지도 있습니다. 사진별 관측 연도를 표시합니다.
- 사용자 사진은 서버로 전송되지 않고 브라우저 메모리에서 처리됩니다. 생일의 **월·일**만 NASA 데이터 조회용 자체 서버 API로 전달합니다.

## NASA 이미지 사용 주의

본 프로젝트는 NASA, ESA, STScI와 무관한 독립 제작물이며 해당 기관의 후원/보증을 받지 않습니다. NASA를 이미지 출처로 명시하되 승인받은 공식 상품처럼 광고하지 마세요. 특히 **허블 사진을 이용한 실물 키링 등 상업용 굿즈**를 만들 계획이라면 개별 이미지의 권리와 NASA 상품·광고 지침을 확인해야 합니다. NASA에서 게시한 자료에도 제3자 권리가 포함될 수 있습니다.

- NASA 미디어 이용 안내: https://www.nasa.gov/nasa-brand-center/images-and-media/
- NASA 광고 지침: https://www.nasa.gov/nasa-brand-center/advertising-guidelines/

## 작업/개선 포인트

- 자동 누끼 품질 향상이 필요하다면 브라우저 내 AI 모델(예: 온디바이스 세그멘테이션)로 교체할 수 있습니다.
- 현재는 편집 작업을 브라우저 메모리에만 저장하며 로그인을 요구하지 않습니다. 페이지 새로고침 시 현재 작업은 사라집니다.
- 별도 자동화된 통합 테스트와 실사용 브라우저/모바일 회귀 테스트를 권장합니다.

© 2026 Orbit Keepsake — 독립 제작물. NASA/ESA 이미지의 권리는 각 출처 정책을 따릅니다.

# HFK 와인 소사이어티 시음 기록

매달 HFK 멤버들과 시음한 와인을 기록하고, 멤버 각자가 시음 노트를 남길 수 있는 웹 페이지입니다.

**권한 분리**
- **관리자**: 세션·와인 등록/수정/삭제 (관리자 비밀번호로 로그인)
- **멤버**: 등록된 와인에 자신의 시음 노트를 작성/수정/삭제 (본인이 쓴 노트만)

**주요 기능**
- 와인 카드 그리드 + 평균 ★ 점수 표시
- 검색 / 국가 · 품종 · 빈티지 필터 / 정렬 (시음일 · 평균점수 · 노트 수)
- 세션 단위 묶기 ("5월 와인회" 같은 한 모임의 여러 와인)
- 작성자 본인만 자신의 노트 수정/삭제 (브라우저 토큰 기반)

## 구조

- `index.html` — 단일 페이지 앱 (와인 갤러리 · 세션 보기 · 노트 작성)
- `wine-society.gs` — Google Apps Script 백엔드 (Sheets 읽기/쓰기)

데이터 흐름: 정적 HTML(GitHub Pages) → Apps Script 웹앱 → Google Sheets

## 1. Google Sheets 준비

새 스프레드시트를 만듭니다. **탭과 헤더는 Apps Script 가 자동으로 생성**해 주므로 빈 시트만 있으면 됩니다.

자동 생성될 탭과 컬럼은 아래 참고:

### 탭 `Sessions`

```
session_id | name | session_date | location | theme | host | description | created_at
```

### 탭 `Wines`

```
wine_id | session_id | name_ko | name_original | vintage | country | region | variety | producer | price_range | tasted_at | tasted_place | image_url | added_by | created_at
```

### 탭 `Notes`

```
note_id | wine_id | author | author_token | score | aroma | palate | comment | pairing | created_at | updated_at
```

스프레드시트 URL `https://docs.google.com/spreadsheets/d/{ID}/edit` 의 ID 부분을 복사해 두세요.

> 기존 시트에 컬럼이 부족한 경우(예: `session_id`, `author_token` 등) Apps Script 가 첫 호출 때 자동으로 누락 컬럼을 추가합니다.

## 2. Apps Script 배포

1. [script.google.com](https://script.google.com) 접속 → 새 프로젝트 → 이름 "HFK Wine Society"
2. 기본 `Code.gs` 전부 지우고 `wine-society.gs` 내용 붙여넣기
3. 좌측 톱니바퀴 (프로젝트 설정) → **스크립트 속성** → 추가:
   - `SHEET_ID` = 위에서 복사한 스프레드시트 ID
   - `ADMIN_PASSWORD` = 관리자(와인·세션 등록 권한) 비밀번호. 운영자만 아는 값
4. 우측 상단 **배포** → **새 배포** → 유형 **웹 앱**:
   - 실행 계정: 본인
   - 액세스 권한: **모든 사용자**
5. 첫 배포 시 권한 승인 → 발급된 **웹 앱 URL** 복사

> 코드 수정 후에는 **배포 → 배포 관리 → 편집(연필) → 새 버전** 으로 재배포해야 변경이 반영됩니다.

## 3. 프론트엔드 연결

`index.html` 상단:

```js
const API_URL = "https://script.google.com/macros/s/.../exec";
```

이 값을 위에서 받은 웹 앱 URL로 교체합니다.

## 4. GitHub Pages 배포

1. 새 GitHub 저장소 생성 (예: `hfk-wine-society`)
2. `index.html` 을 저장소 루트에 푸시
3. 저장소 **Settings → Pages**:
   - Source: `Deploy from a branch`
   - Branch: `main` / `(root)`
4. 1–2분 뒤 `https://{사용자명}.github.io/hfk-wine-society/` 에서 접속

## 인증 / 보안 모델

- **공유 시크릿** `SHARED_SECRET = "hfk1004"` — 모든 요청에 포함. 프론트엔드에 박혀 있어 사실상 멤버 비공개 채널 공유 가정.
- **관리자 비밀번호** `ADMIN_PASSWORD` (스크립트 속성) — 와인/세션 등록·수정·삭제 시에만 검증. 프론트엔드에 박지 않고 관리자가 직접 입력. 로그인 후 브라우저 localStorage 에 저장.
- **노트 작성자 토큰** — 노트 작성 시 서버가 UUID 토큰 발급 → 응답으로 클라이언트에 전달 → 브라우저 localStorage 에 저장. 수정/삭제 시 토큰 일치 검증.
  - 다른 브라우저/기기에서 노트를 작성한 경우, 그 노트는 그 브라우저에서만 수정/삭제 가능 (관리자는 모두 가능).

## 사용 흐름

**관리자 (운영자)**
1. 페이지 우측 상단 "관리자" 링크 클릭 → 비밀번호 입력
2. "+ 세션 등록" → 모임 정보 등록 (5월 와인회 등)
3. "+ 와인 등록" → 와인 정보 입력, 필요 시 세션 선택
4. 와인/세션 카드 클릭 → 우상단 [수정] [삭제] 로 운영

**멤버**
1. 와인 카드 클릭 → 모달에서 자신의 노트 작성 (이름, 향, 맛, 코멘트, 점수, 페어링)
2. 자신이 쓴 노트는 [수정] [삭제] 가능 (작성한 브라우저에서만)
3. 상단 검색·필터·정렬로 누적된 와인 탐색

## 데이터 메모

| 시트 | 컬럼 | 메모 |
|------|------|------|
| Sessions | session_id | `s-{ts}-{rand}` 자동 |
| Sessions | name / session_date | 필수 |
| Wines | wine_id | `w-{ts}-{rand}` 자동 |
| Wines | session_id | Sessions.session_id 참조, 비워둬도 됨 |
| Wines | name_ko / name_original | 둘 중 하나 이상 필수 |
| Wines | tasted_at | `YYYY-MM-DD` 필수 |
| Notes | note_id | `n-{ts}-{rand}` 자동 |
| Notes | wine_id | Wines.wine_id 참조 |
| Notes | author_token | API 응답에서는 제외됨 (서버 내부 검증용) |
| Notes | score | 1–5 (선택) |

## 운영 팁

- 와인 라벨 사진은 R2 또는 imgur 같은 공개 호스팅에 올린 뒤 URL 만 시트에 넣으면 카드에 자동으로 표시됩니다.
- 시트에서 직접 행을 편집/추가하면 즉시 페이지에 반영됩니다 (다음 새로고침부터).
- 사용자 이름과 관리자 로그인은 브라우저 localStorage 에 저장돼서 다음 방문 때 자동으로 채워집니다.
- 와인을 삭제하면 그 와인의 모든 노트가 함께 삭제됩니다.
- 세션을 삭제하면 세션은 사라지지만 그 안의 와인들은 ‘세션 없음’ 상태로 유지됩니다.

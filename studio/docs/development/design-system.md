---
kind: reference
description: "Studio Client UI의 토큰, 공용 부품, 레이아웃, 상태 표시, 피드백, 문구 규칙과 자동 검사."
---

# Studio 디자인 시스템

## 요약

Studio 화면은 DSH 기본 디자인 시스템의 톤을 따른다. 색·선·배경은 DSH 토큰을 `--studio-*` 별칭으로만 쓰고, 컨트롤은 DSH primitives를 먼저 쓰며, 지원 범위를 숨기지 않고 표시한다. 새 UI는 이 문서의 공용 부품 위에 만들고, 부품이 없을 때만 공용 모듈에 추가한다. 일부 규칙은 [디자인 규칙 테스트](../../test/design-rules.test.mjs)와 [스타일 격리 테스트](../../test/design-system.test.mjs)가 강제한다.

## 목차

- [원칙](#원칙)
- [토큰](#토큰)
- [모듈과 부품](#모듈과-부품)
- [레이아웃](#레이아웃)
- [상태 표시](#상태-표시)
- [피드백](#피드백)
- [문구](#문구)
- [새 UI 체크리스트](#새-ui-체크리스트)
- [자동 검사](#자동-검사)

## 원칙

1. DSH와 같은 화면처럼 보인다. 기준 화면은 DSH Plugins 페이지와 사이드바이며, 같은 토큰·크기·굵기·선을 쓴다.
2. 기능을 부풀리지 않는다. 지원하지 않거나 일부만 지원하는 설정은 숨기지 않고 비활성 상태와 사유로 보여준다.
3. 모델에 무엇이 전달되는지 보여준다. 구성 요소마다 기본 동작 대비 변화와 한계를 같은 위치에 둔다.
4. 같은 편집 대상은 같은 부품으로 편집한다. 워크플로우 역할과 독립 에이전트는 같은 컴포넌트 카드를 쓴다.
5. 장식을 더하지 않는다. Studio 스타일에는 애니메이션, 그림자, 역할별 장식 색이 없다. primitives가 가진 전환 효과는 그대로 둔다.

## 토큰

호스트 토큰은 [ui-styles.ts](../../src/ui-styles.ts) 맨 앞의 `.studio-ui` 어댑터에서만 참조한다. 기능 스타일은 아래 별칭만 쓴다.

| 별칭 | DSH 토큰 | 용도 |
| --- | --- | --- |
| `--studio-bg` | `bg-base` | 페이지·입력 배경 |
| `--studio-surface` | `bg-layer-1` | 카드 배경 |
| `--studio-inset` | `bg-layer-2` | 코드·타이머 같은 안쪽 영역 |
| `--studio-ink` | `label-primary` | 본문, 선택된 탭 |
| `--studio-muted` | `label-secondary` | 보조 설명 |
| `--studio-subtle` | `label-tertiary` | 비선택 탭, 묶음 제목 |
| `--studio-line` | `border-l2` | 카드·구분선 |
| `--studio-control-line` | `border-l3` | 버튼·입력 테두리 |
| `--studio-hover` | `interactive-bg-hover` | 호버, 선택된 메뉴, 사유 상자, 안내 띠 |
| `--studio-pressed` | `interactive-bg-active` | 버튼 누름 |
| `--studio-primary-fill` / `--studio-primary-hover` / `--studio-on-primary` | `button-primary-*`, `label-primary-foreground` | 주 버튼 |
| `--studio-focus` | `focus-ring-color` | 키보드 포커스 |
| `--studio-error` | `state-error-primary` | 화면 안 알림 |
| `--studio-success` / `--studio-warn` / `--studio-info` / `--studio-neutral-fill` | `state-success-primary`, `state-warn-primary`, `state-business-primary`, `bg-module-platform` | `Badge` 톤 |
| `--studio-control-radius` / `--studio-small-radius` | `radius-md` / `radius-sm` | 컨트롤 모서리 |

크기와 굵기는 기존 단계만 쓴다. 본문과 행은 13px, 보조 문구는 12px, 카드 제목은 14px, 패널 제목은 15px, 페이지 제목은 18px이다. 굵기는 500을 넘기지 않는다. `--studio-bg`과 `--studio-inset`은 라이트 모드에서 같은 흰색이 될 수 있으므로, 선택·호버처럼 구분이 필요한 상태에는 `--studio-hover`를 쓴다. 토큰 이름이 바뀌면 어댑터만 고친다. 새 색이 필요하면 리터럴 대신 DSH 토큰을 별칭으로 추가한다.

## 모듈과 부품

| 모듈 | 내용 | 조건 |
| --- | --- | --- |
| [ui-styles.ts](../../src/ui-styles.ts) | 토큰 어댑터와 `.studio-ui` 범위 스타일 | 모든 규칙은 `.studio-ui`로 시작 |
| [ui.tsx](../../src/ui.tsx) | Studio 소유 부품 | primitives를 import하지 않음. Node 단위 테스트에서 불러도 됨 |
| [ui-host.tsx](../../src/ui-host.tsx) | primitives 재수출과 primitives 기반 부품 | primitives를 직접 import하는 유일한 모듈. Node 테스트가 불러오면 안 됨 |

primitives는 CSS 모듈을 함께 불러오므로 Node 단위 테스트에서 로드할 수 없다. 그래서 기능 모듈은 primitives를 `ui-host.tsx`에서 가져오고, 테스트 대상 모듈은 `ui-host.tsx`에 닿지 않는다. 런타임에서는 셸이 primitives를 플랫폼 모듈로 공유하고 Client 번들은 이를 외부 모듈로 둔다.

### ui.tsx 부품

| 부품 | 쓰는 곳 |
| --- | --- |
| `StudioSurface` | 마운트된 Studio 화면의 최상위. 스타일시트를 함께 넣고 마운트 해제 시 제거한다 |
| `ItemPicker` ([item-picker.tsx](../../src/item-picker.tsx)) | 도구·Config 선택. 한 목록에서 행의 체크로 켜고 끄며, 켠 행은 자리를 옮기지 않고 강조된다. 검색과 전체/선택됨/변경됨 필터로 좁혀 본다. 켠 행에만 `설정`이 있으며 `DetailDialog`로 연다. `lockedReason`을 준 행은 켜진 채로 잠기고 이유를 설명으로 보여 준다(예: 프리셋 기본값에서 온 Tool Filter 도구). 두 열 이동 방식은 쓰지 않는다 |
| `Button` | 모든 버튼 동작. 기본은 DSH outline, `primary`는 채운 주 버튼, `small`은 카드·행 안의 보조 동작 |
| `PageHead` | 섹션당 하나의 제목·설명·우측 동작. 상태줄은 children으로 넣는다 |
| `SectionHead` | 페이지 안의 제목 행과 우측 동작. 입력 필드를 담을 때 `field` |
| `ChangeIndicator` | 도구·Config 카드의 원본 대비 변경 표시. 값이 원본과 같거나 초기화되면 숨김 |
| `Note` | 페이지 범위 안내 띠 (목업·미리보기 표시 등) |
| `Notice` | 화면에 묶인 문제와 복구 동작. 상태가 풀릴 때까지 유지 |
| `TabBar`, `TabPanel` | 고정 밑줄 탭과 탭 내용. 탭을 바꿔도 탭 줄이 보이는 위치에 남는다 |
| `MasterDetail`, `ListItem`, `ListGroup` | 왼쪽 목록과 오른쪽 상세. 본문이 좁으면 위아래로 쌓인다 |
| `Tile` | 그리드 안의 요약 카드. 누르면 상세로 이동 |
| `PickOption` | 대화상자·설정 화면의 선택지. `checked`를 주면 라디오로 동작. 예: Pixie 설정의 컨텍스트 모드와 스레드별 모델 |
| `IconButton` | 아이콘만 있는 작은 버튼. 문구는 `label`(툴팁·접근 이름)로만 준다. 톤은 `info`·`success`·`error`. 예: 메뉴 하단 버전 옆 업데이트 |
| `Badge` | 카드 제목 옆 상태 캡슐. DSH `Tag`와 같은 모양이며 Node 테스트 대상 모듈에서도 쓸 수 있다. 톤은 `success`(반영됨), `warning`(재반영 필요), `info`(기본 제공), `outline`(읽기 전용·실행 방식), `neutral`(미반영) |
| `DetailDialog` | 한 항목의 설정을 여는 모달. `wide`는 프롬프트 미리보기처럼 본문과 오른쪽 목록을 함께 보여줄 때 쓴다. 머리(제목·보조 문구·닫기), 스크롤되는 본문, 선택적 하단 동작으로 구성한다. 닫으면 연 버튼으로 포커스를 돌려준다. 페이지 안에서 카드를 펼쳐 편집하지 않고 이 모달을 쓴다 |
| `SplitButton` | 주 동작과 관련 보조 동작을 한 컨트롤로 묶는다. 예: `DSH에 다시 반영` + 메뉴의 `반영 해제` |
| `Disclosure` | 고급 설정처럼 평소 접어 두는 블록. 컴포넌트 카드와 같은 테두리·제목 행을 쓴다 |

### ui-host.tsx 부품

| 부품 | 쓰는 곳 |
| --- | --- |
| `Checkbox`, `Menu`, `MenuItemButton`, `Modal`, `SegmentedControl`, `StateDot`, `Tag`, `Toast` | DSH primitives 재수출 |
| `ComponentCard` | 구성 요소 하나의 접이식 카드. 펼친 순서는 사유 → 편집 폼 → 모델에 전달되는 변화 → 카드 동작으로 고정 |
| `SupportTag`, `SUPPORT_DOT` | 지원 상태 태그와 상태 점 매핑 |
| `DialogBody`, `DialogFooter` | Modal 내용과 버튼 줄. Modal은 문서 body로 포털되므로 Studio 스타일 범위를 다시 연다 |

## 레이아웃

[ServiceLayout](../../src/service-layout.tsx)은 등록된 서비스의 상단 탐색과 화면 표시를 담당한다. 메뉴는 좁은 폭에서 가로로 스크롤하고 선택하지 않은 화면도 마운트를 유지한다. 서비스 내용은 960px 최대 폭과 공통 여백을 사용한다. `feat/lean-agent`에서는 기존 기능과 네 목업을 제거하고, 동일한 내부 탐색 골격인 `DetailLayout`과 공용 부품·스타일을 유지한다. 등록과 수명은 [서비스 탐색 구조](../reference/service-navigation.md)를 따른다.

- Studio 메뉴 맨 아래 `studio-nav-footer`에는 [VersionFooter](../../src/update-indicator.tsx)가 `v0.2.7`만 표시한다. 설치할 수 있는 버전이 있을 때만 `IconButton` 하나를 붙이며, 설명은 툴팁과 접근 이름으로만 준다. 같은 상태에서 사이드바의 DSH Studio 행 오른쪽에 업데이트 아이콘(접힌 사이드바는 아이콘 모서리 점)을 둔다. 이 표시는 사이드바 행 안에 포털로 넣으므로 `sidebarMarkStyles`를 따로 싣는다. 설치 후에는 사이드바 표시를 지우고 버전 옆 아이콘만 완료(재시작 필요)로 바꾼다.
- Studio 페이지는 왼쪽 메뉴와 본문이 따로 스크롤된다. 섹션을 바꾸면 새 섹션은 맨 위에서 시작하고 메뉴는 움직이지 않는다.
- 본문 최대 너비는 960px이고, 섹션 안의 블록은 16px 간격으로 쌓는다.
- 숨긴 섹션은 마운트 상태를 유지해 편집 중인 값을 잃지 않는다.
- 반응형 기준은 화면 너비가 아니라 Studio 영역과 본문 열의 너비다. Studio 영역이 760px 이하면 메뉴가 상단 가로줄로 바뀌고, 본문이 640px 이하면 목록·상세가 위아래로 쌓인다.
- 탭 내용은 최소 높이를 가져, 짧은 탭으로 바꿔도 고정된 탭 줄이 튀지 않는다. 본문 스크롤 영역은 `scrollbar-gutter: stable`로 스크롤바 유무와 관계없이 좌우 위치를 고정한다.
- 좌측 메뉴는 `DetailLayout`의 `title`·`subtitle`과 페이지별 `group`으로 구성한다. 현재 구성은 DSH Studio(에이전트 프리셋 편집기) › 프리셋(목록·만들기) · 도구(도구 제공자)이다.
- 편집 화면의 섹션은 `studio-form-section`(12px 간격), 탭 본문은 `studio-tab-body`(24px 간격)로 쌓고 단락·필드의 기본 여백에 기대지 않는다. 필드 제목 행에 `원본 사용`·`덮어쓰기 초기화` 같은 보조 동작을 둘 때는 `studio-field-head`를 쓴다.
- 프리셋 목록과 서브에이전트 역할은 두 열 카드(`studio-card-pair`)이며 본문이 560px 이하이면 한 열이 된다. 프리셋 카드 하단 왼쪽에는 편집·복사·삭제, 오른쪽에는 반영 `SplitButton`을 둔다. 반영되지 않았거나 다시 반영해야 하는 프리셋만 반영 버튼을 `primary`로 강조한다. 읽기 전용 프리셋은 동작 대신 이유를 한 줄로 쓴다.

## 상태 표시

| 상태 | 표시 | 규칙 |
| --- | --- | --- |
| 지원 | 표시 없음 | 기본값 |
| 조건부 | 파란 `Tag` + 사유 | 편집은 가능하지만 범위 제한을 한 줄로 설명 |
| 미지원 | 회색 `Tag`, 비활성 컨트롤 + 사유 | 숨기지 않는다 |
| 누락 | 주황 `Tag` + 보존 안내 | 등록 해제된 구성 요소의 데이터를 지우지 않는다 |

상태 점은 초록(정상), 주황(일부·주의), 빨강(누락·실패), 회색(제공 안 함)이다. 저장·적용·활성화 결과는 각각 따로 표시하며, 결과를 확인하지 못한 상태를 성공으로 보여주지 않는다.

## 피드백

| 상황 | 표시 |
| --- | --- |
| 작업 결과 (저장, 복사, 템플릿 저장) | `Toast`. 성공과 실패만 알리고 진행 중 상태는 버튼 비활성으로 표시 |
| 화면에 묶인 상태 (활성화 실패, 결과 불명, 충돌) | `Notice`. 복구 동작을 함께 두고, 데이터는 그대로 둔다 |
| 적용 전 검사 | `Modal` 안의 체크리스트와 확인 체크박스 |
| 필드 검증 | 해당 필드 옆 |

DSH 규칙상 토스트는 결과를 낸 화면보다 오래 사는 호스트(`shell.overlay`)에서 그린다. 셸 전용 브랜치에는 토스트를 띄우는 기능이 없으며 새 기능에서 이 원칙을 따른다.

## 문구

- 화면 문구는 locale 사전(ko·en·zh)으로 관리하고 부품은 문구를 props로 받는다.
- 짧은 평서문으로 쓴다. 알림은 두 문장 이내이며, 중국어 두 문장 이내 알림은 끝의 `。`를 뺀다.
- 기능을 과장하지 않는다. "보장", "자동으로 모두" 같은 표현 대신 실제 동작과 한계를 쓴다.
- "Fork"는 보조 문구로만 쓰고 주 문구는 "부모 대화 이어받기 / 새 대화"로 쓴다.
- 한국어 동사는 통일한다: 반영 / 반영 해제 / 저장 / 추가 / 제거 / 원래대로 / 완료. 변경 표시는 "변경됨", 상속 값은 "기본값"이다.
- 내부 용어(Host API, assemble/render, 마스터, 스폰)는 화면 문구에 쓰지 않는다.
- 구성 요소 카드의 "모델에 전달되는 변화"는 항상 같은 위치에 둔다.

## 새 UI 체크리스트

1. DSH primitives와 위 부품 목록에서 맞는 것을 먼저 찾는다.
2. 없으면 공용 모듈에 추가한다. primitives를 쓰면 `ui-host.tsx`, 아니면 `ui.tsx`에 두고 이 문서의 부품 표를 갱신한다.
3. 색·모서리·간격은 `--studio-*` 별칭과 기존 클래스만 쓴다. 인라인 `style`과 색 리터럴은 쓰지 않는다.
4. 지원 범위가 제한되면 상태 표시 규칙을 따른다.
5. 라이트·다크 모드, 좁은 본문 폭(640px 이하), 키보드 포커스를 확인한다.
6. 셸 전용 브랜치에는 역할 UI 스냅샷이 없다. 스타일을 바꾸면 해당 공용 부품 테스트와 새 기능의 UI 스냅샷을 갱신한다.

## 자동 검사

`pnpm --dir studio test`가 다음을 검사한다.

| 검사 | 위치 |
| --- | --- |
| 모든 CSS 규칙이 `.studio-ui`로 시작하고, 호스트 토큰은 어댑터에서만 `var(--dsw-*)` 형태로 참조 | [design-system.test.mjs](../../test/design-system.test.mjs) |
| 색 리터럴 없음, 굵기 500 이하 | [design-rules.test.mjs](../../test/design-rules.test.mjs) |
| primitives 직접 import는 `ui-host.tsx`만 | 같은 파일 |
| Node 테스트가 불러오는 모듈은 `ui-host.tsx`에 닿지 않음 | 같은 파일 |
| 기능 모듈에 인라인 `style`, 색 리터럴, `studio-button` 클래스 직접 사용 없음 | 같은 파일 |

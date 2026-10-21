---
kind: reference
description: "#38 플러그인 탭 이후 보류한 개선 후보. 이슈로 등록하지 않은 내부 메모이며, 지금 기능으로 워크플로우 설정은 할 수 있다."
---

# 플러그인 탭 후속 후보 (보류)

## 요약

[#38](../issues/38-installed-plugins.md)을 0.6.3으로 마무리하면서 범위 밖으로 미룬 항목이다. **2026-10-20 사용자 결정에 따라 GitHub 이슈로 등록하지 않는다.** 지금 기능만으로도 워크플로우 관련 설정을 할 수 있기 때문이다: 공급자 선택과 직접 입력, 카테고리별 프로필 설정, 프로필 등록. 필요해지면 이 문서에서 골라 이슈를 만든다.

## 기능 후보

| ID | 후보 | 내용 | 미룬 이유 | 착수 조건 |
| --- | --- | --- | --- | --- |
| F1 | Exa `/contents` 가져오기 공급자 → [#39](../issues/39-exa-contents-fetch.md)에서 진행 | Exa API `POST /contents`로 `web_fetch`를 처리하는 공급자 플러그인을 만들어 `fetchProvider: exa`를 쓸 수 있게 한다. `ctx.web.registerFetchProvider()`만 쓴다. 확인할 것: 응답 형식, 크기 제한, 리다이렉트 거부(DSH web 패키지 규칙), 비용 | DSH에 패키지가 없고 Studio 밖의 별도 기능이다. 지금은 `http`나 `deepseek-fetch-api`로 가져오기를 할 수 있다 | 기존 가져오기 공급자로 처리하지 못하는 페이지가 실제로 문제가 될 때. 패키지 위치를 먼저 정한다 |
| F2 | 서비스 그룹 확장 | `speechToText`·`terminals`는 웹처럼 선택 드롭다운, `sessionTitle`은 하나만 켜는 화면, `llm`은 묶어서 보여 주기만 한다. [service-groups.ts](../../src/service-groups.ts)에 정의를 더한다 | 이번 범위는 워크플로우 카테고리 7개로 합의했다 | 해당 서비스의 공급자를 실제로 바꿔 쓰게 될 때 |
| F3 | 가져오기 공급자 키 따로 저장 | `web-deepseek-api`의 `apiKeyEnv`를 다른 이름으로 바꾸면 그 키를 저장할 화면이 없다(DSH 웹 검색 페이지는 `web-search-deepseek`의 키 이름만 다룬다). 프로필 설정의 `credential-ref` 행에서 `ctx.credentials.set`으로 저장하게 한다 | D6에서 자격 증명 저장소를 1순위로 정했지만 이번에는 상태 표시까지만 했다. 지금은 검색·가져오기가 같은 `DEEPSEEK_API_KEY`를 쓴다 | 검색과 가져오기에 다른 DeepSeek 키가 필요할 때 |

## 검증 후보

| ID | 항목 | 현재 근거 | 남은 것 |
| --- | --- | --- | --- |
| V1 | 에이전트 기능 플러그인 실제 포함 흐름 | DOM 테스트, Master 수명 테스트, `check-master-runtime`의 확장 경로 | 실제 제3자 패키지로 `설정하고 포함` → 프리셋 반영을 독립 설치에서 확인([#38 S7](../issues/38-installed-plugins.md)) |
| V2 | 프로필 등록 실패 시 되돌리기 | 단위 테스트(파일 복원, 복원 재적용 실패 보고) | 실제 런타임에서 활성화에 실패하는 패키지로 확인 |

## 관련 문서

- [#38 명세](../issues/38-installed-plugins.md): 결정, 단계, 검증 기록
- [사용 가이드: 플러그인 (프로필 공용 설정)](../../release/docs/guide.ko.md#플러그인-프로필-공용-설정)

---
kind: implementation-spec
status: draft
---

# #29 세션별 서브에이전트 역할 덮어쓰기

## 요약

프리셋에 정한 서브에이전트 역할을 세션 단위로 덮어쓰고, 프리셋에 없는 역할을 그 세션에서만 임시로 추가한다. 세션 화면의 Chat / Trajectory 옆 **Subagents** 탭에서 보고 편집한다. 게이트의 세션별 끄기(#27)와 같은 저장 방식을 따른다.

- GitHub 이슈: [#29](https://github.com/jammer-droid/deepseek-harness/issues/29)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `b288fc95fa`
- 대상 DSH: `0.2.0-rc.2`. 본체 수정 없음
- 관련: [#27](27-jev-decision-engine.md)의 세션별 게이트 끄기, `src/role-settings.ts`, `src/host/role-tool.ts`

## 가능 여부

- `subagent_role` 도구는 Studio 소유(`host/role-tool.ts`)다. 호출 시점에 `exec.agent`의 세션 덮어쓰기를 읽어 프리셋 역할과 합치면 된다. 따라서 **임시 역할 추가도 가능**하다.
- 탭은 공개 슬롯 `conversation.view`(Chat `order 0`, Trajectory가 쓰는 슬롯)에 Studio 보기를 등록한다. Trajectory는 개발자 도구가 켜져 있을 때만 보이며, Studio 탭은 항상 보인다.

## 범위

**포함**

- 세션 덮어쓰기 저장: `<profile>/studio-data/` 아래 세션별 파일. 루트 세션 단위로 저장하고 그 세션의 하위 에이전트 호출에도 적용한다.
- 덮어쓰기 대상: 프리셋 역할의 `model`, `reasoning`, `spawn`, `persona`, `toolFilter`, 사용 끄기. 임시 역할은 `StudioRole` 전체.
- `subagent_role`의 `list`·`call`이 합쳐진 역할 목록을 쓴다. 덮어쓰기 표시(출처: 프리셋/세션)를 `list` 결과에 포함한다.
- Subagents 탭: 프리셋 역할 목록, 항목별 덮어쓰기 편집·되돌리기, 임시 역할 추가·삭제. 기존 `role-editor.tsx` 부품을 재사용한다.

**제외**

- 프리셋 자체 변경(세션 값을 프리셋으로 저장하기는 후속 후보)
- Studio 프리셋이 아닌 세션(역할 도구가 없는 세션)에서의 동작 — 탭은 "이 세션에는 역할 도구가 없음"을 표시한다

## 결정

- **D1 덮어쓰기 범위:** 임시 역할 추가 포함(가능하므로).
- **D2 적용 시점:** 미결정. 추천: 다음 `subagent_role` 호출부터 적용. 이미 시작된 자식은 바꾸지 않는다.
- **D3 모델 검증:** 저장 시 `validateRoleModel`로 검사하고, 호출 시 다시 검사한다(프로바이더가 사라질 수 있음).
- **D4 하위 에이전트:** 미결정. 추천: 자식 에이전트의 `subagent_role` 호출도 루트 세션의 덮어쓰기를 따른다.

## 단계

| ID | 결과 | 선행 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 덮어쓰기 계약과 합치기 함수(순수 모듈) | — | 단위 테스트: 필드 덮어쓰기, 끄기, 임시 역할, 이름 충돌 거절 |
| S2 | 세션 저장소와 Remote(읽기·저장) | S1 | 잘못된 파일 거절, 세션 간 격리 테스트 |
| S3 | `subagent_role`이 세션 덮어쓰기 사용 | S1, S2 | 실제 `ToolRuntime` 테스트: 덮어쓴 모델·지침으로 자식 시작 |
| S4 | Subagents 탭(`conversation.view`), ko·en·zh 문구 | S2 | UI 스냅샷, 라이트·다크·좁은 폭 |
| S5 | 독립 설치 검증 | 모두 | 수정하지 않은 rc.2 + 패키징 Studio, 실세션에서 덮어쓴 역할로 위임 확인 |

현재 단계: S1. 미결정 D2·D4가 남아 있어 `draft`.

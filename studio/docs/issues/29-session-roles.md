---
kind: implementation-spec
status: ready
---

# #29 세션별 서브에이전트 역할

## 요약

프리셋에 정한 서브에이전트 역할의 모델·추론 레벨·지침을 세션 단위로 바꾸고, 프리셋에 없는 역할을 그 세션에서만 추가한다. 세션 역할은 프리셋과 독립된 복사본이라 이후 프리셋 변경의 영향을 받지 않는다. 세션 화면의 Chat / Trajectory 옆 **Subagents** 탭에서 보고 편집한다.

- GitHub 이슈: [#29](https://github.com/jammer-droid/deepseek-harness/issues/29)
- 기준 브랜치·시작 커밋: `studio/feat/workflow` @ `2475d6e802`
- 작업 위치: worktree `../deepseek-harness-29`, 브랜치 `studio/feat/29-session-roles`
- 대상 DSH: `0.2.0-rc.2`. 본체 수정 없음
- 관련: [#27](27-jev-decision-engine.md)의 세션별 게이트 끄기, `src/role-settings.ts`, `src/host/role-tool.ts`, `src/host/pixie-service.ts`(세션 파일 정리)

## 가능 여부 (rc.2 공개 API)

- `subagent_role` 도구는 Studio 소유(`host/role-tool.ts`)다. 지금은 `apply` 때 역할을 확정하지만, `execute`의 `exec.agent`로 호출마다 세션 역할을 읽어 합칠 수 있다.
- 루트 세션 찾기: 자식 세션 헤더에 `parentSession`과 `origin: 'subagent'`가 있다(rc.2 `subagent/child-agent.ts`). 실행 Agent의 `session.header`로 읽는다.
- 탭: 공개 슬롯 `conversation.view`(rc.2 `ConvViewOwnerProps` 동일). Chat은 `order 0`, Trajectory는 `order 10`이며 개발자 도구가 켜졌을 때만 등록된다. 탭 줄은 view가 2개 이상일 때만 보인다(rc.2 `ConversationSession.tsx`).
- 세션 삭제 추적: Pixie가 쓰는 `sessionController.list` 기반 정리 방식([pixie-service.ts](../../src/host/pixie-service.ts))을 재사용한다.

## 범위

**포함**

- **세션 역할:** 세션이 소유하는 `StudioRole` 전체 복사본.
  - 프리셋 역할을 처음 편집하면 그 시점의 역할 전체를 복사하고, 이후 `model`, `reasoning`, `persona`만 편집한다.
  - 임시 역할은 이름·역할 id·`model`·`reasoning`·`persona`를 입력한다. `spawn`은 `fresh`, 도구 필터는 없음(프리셋 기본 필터 적용).
- **합치기:** 세션 역할이 같은 역할 id의 프리셋 역할보다 우선한다. 세션에 없는 역할만 현재 프리셋에서 가져온다. 프리셋에서 역할이 지워지거나 바뀌어도 세션 역할은 그대로 동작한다.
- **되돌리기:** 세션 복사본 삭제. 이후 그때의 프리셋 값을 쓴다. 임시 역할은 삭제된다.
- **`subagent_role`:** `list`·`call`이 합친 목록을 쓴다. `list` 결과에 출처(`preset`/`session`)를 포함한다.
- **Subagents 탭:** 합친 역할 목록, 항목별 편집·되돌리기, 임시 역할 추가·삭제. 기존 `role-editor.tsx` 부품을 재사용한다. ko·en·zh 문구.
- **저장:** `<profile>/studio-data/session-roles/<rootSessionId>.json`. 세션 수명을 따른다(보관된 세션은 유지, 삭제된 세션은 정리).

**제외**

- 세션에서 `spawn`·도구 필터 편집, 역할 끄기
- 프리셋 자체 변경(세션 값을 프리셋으로 저장하기는 후속 후보)
- 포크한 세션으로 세션 역할 복사
- Studio 역할 도구가 없는 세션에서 실행. 탭은 "이 세션에는 역할 도구가 없음"을 표시하고, 저장된 값은 남지만 쓰이지 않는다.

## 결정

- **D1 임시 역할:** 포함.
- **D2 적용 시점:** 다음 `subagent_role` 호출부터 적용한다. 이미 시작된 자식의 설정은 바꾸지 않는다.
- **D3 모델 검증:** 저장할 때 `validateRoleModel`로 검사하고, 호출할 때 다시 검사한다(프로바이더가 사라질 수 있음).
- **D4 하위 에이전트:** 자식·손자의 `subagent_role` 호출도 루트 세션의 세션 역할을 따른다.
  - 루트 찾기: `header.origin === 'subagent'`인 동안 `parentSession`을 따라 올라간다.
  - 사용자가 포크한 세션은 `origin`이 없으므로 자기 자신이 루트다.
  - 부모 세션을 찾지 못하면 그 시점의 세션을 루트로 본다.
  - 자식 세션의 Subagents 탭은 루트 값을 읽기 전용으로 보여주고 루트에서 편집하라고 안내한다.
- **D5 독립성:** 세션 역할은 필드 덮어쓰기가 아니라 역할 전체 복사본이다. 그래서 프리셋 변경·삭제나 같은 역할 id의 추가와 충돌하지 않는다.
- **D6 편집 필드:** `model`, `reasoning`, `persona`만 편집한다. 복사한 역할의 `spawn`·도구 필터는 복사 시점 값으로 고정한다.
- **D7 도구 설명:** 모델이 보는 `subagent_role` 설명과 `role` 파라미터 설명을 세션과 무관한 하나의 문구로 바꾼다. "`list`로 역할 확인, 역할이 없으면 부모와 같은 설정으로 위임"이라는 뜻이다.
  - 합친 결과 역할이 0개이면 지금처럼 부모와 같은 설정의 역할(`PARENT_ROLE`)로 위임한다.
  - 기존 프리셋에서도 모델이 보는 문구가 바뀌므로, 새 문구를 테스트로 고정한다.
- **D8 탭 표시:** 항상 등록한다. 개발자 도구가 꺼진 세션에도 Chat / Subagents 탭 줄이 새로 생긴다.
- **D9 저장 수명:** Pixie와 같은 정책을 쓴다. 보관된 세션은 유지하고, 삭제된 세션은 시작 시와 주기적으로 정리한다. 목록 조회에 실패하면 지우지 않는다. 파일은 루트 세션에만 생긴다.

## 단계

| ID | 결과 | 선행 | 수용 조건·검증 |
| --- | --- | --- | --- |
| S1 | 세션 역할 계약과 합치기 함수(순수 모듈) | — | 단위 테스트: 복사 우선, 프리셋 삭제·변경 후 유지, 임시 역할, 세션 내 역할 id 중복 거절, 편집 불가 필드 무시, 0개일 때 부모 역할 |
| S2 | 세션 저장소, 루트 찾기, Remote(읽기·저장·되돌리기·구독), 삭제 세션 정리 | S1 | 잘못된 파일 거절, 세션 간 격리, 자식→루트 해석, 포크 세션 분리, 삭제·보관 정리 테스트 |
| S3 | `subagent_role`이 세션 역할 사용, 세션 무관 도구 설명 | S1, S2 | 실제 `ToolRuntime` 테스트: 세션 역할의 모델·지침으로 자식 시작, 자식 호출도 루트 값 사용, 고정 문구 스냅샷 |
| S4 | Subagents 탭(`conversation.view`), ko·en·zh 문구 | S2 | UI 스냅샷, 라이트·다크·좁은 폭, 자식 세션 읽기 전용 |
| S5 | 독립 설치 검증 | 모두 | 수정하지 않은 rc.2 + 패키징 Studio, 실세션에서 세션 역할로 위임 확인 |

## 진행

- **S1 완료:** [session-roles.ts](../../src/session-roles.ts), [테스트](../../test/session-roles.test.mjs) 8개.
- **S2 완료:** [session-role-store.ts](../../src/host/session-role-store.ts), [session-root.ts](../../src/host/session-root.ts), Remote `studioSessionRoles`([session-role-service.ts](../../src/host/session-role-service.ts)). 저장·되돌리기·구독·정리와 루트 해석 [테스트](../../test/session-role-store.test.mjs) 9개.
- **S3 완료:** [role-tool.ts](../../src/host/role-tool.ts)가 호출마다 루트 세션 역할을 읽어 합친다. 실제 `ToolRuntime` [테스트](../../test/role-tool-session.test.mjs) 5개.
- **S4 완료:** [session-roles-tab.tsx](../../src/session-roles-tab.tsx), [session-roles-client.tsx](../../src/session-roles-client.tsx), [문구](../../src/session-roles-locale.ts). UI [테스트](../../test/session-roles-tab.test.mjs) 8개(카드 스냅샷 포함).
- **S5 완료:** 수정하지 않은 rc.2 격리 프로필에 패키징 Studio를 설치했다. Remote 흐름, 탭 화면(라이트·다크·520), 실세션 위임(로컬 스크립트 응답 서버)으로 세션 복사본·되돌리기·GUI 편집이 다음 자식의 모델·추론·지침에 반영되는 것, 자식 세션 탭의 읽기 전용 표시를 확인했다. [검증 기록](../verification/session-roles-29/README.md). 실제 모델 응답 위임과 손자 위임 실세션, `0.2.1-alpha.2`는 미검증.
- S5 중 발견: 읽기 전용 탭이 모델 이름 대신 경로 id를 보임 → 수정.
- Studio 전체: 타입 검사·빌드·테스트 559개 통과.

현재 단계: 구현 단계 완료. 남은 일: 사용자 문서·CHANGELOG, 검수, 통합.

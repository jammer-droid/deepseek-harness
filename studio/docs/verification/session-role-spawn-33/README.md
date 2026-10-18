# #33 세션 역할 시작 방식 검증

## 대상과 범위

- 검증일: 2026-10-18 (Asia/Seoul)
- 순정 런타임: 설치된 `/usr/local/bin/dsh`, **0.2.1-rc.2**. 이전 명세의 0.2.0-rc.2는 로컬에 없어 사용자 승인으로 기준을 변경했다.
- 패키지: `matamt-dbg-dsh-studio-0.6.2.tgz`, SHA-256 `0f07a213385c2f95e1a7969360a0b76b3e7631860257348669ba8209b16eca62`.
- 격리 home: `studio/dist/e2e/33/home`, profile: `issue33`, 서버 포트: 19410, mock 포트: 19411.
- 코어 수정·재빌드, 사용자 앱·프로필 교체, 실제 모델 자격 증명 복사는 하지 않았다.
- 설치 경고: 패키지 peer dependency 경고가 있었으나 설치와 플러그인 로딩은 성공했다.
- [설치 metadata](install-state.json)는 원본 state에서 인증 URL을 제거해 보관했다.
- [초기 UI fixture 실패와 L1 복구 기록](ui-repair-note.md)은 성공 결과와 구분해 남긴다.

## 실행한 검사

| 검사 | 결과 |
| --- | --- |
| Studio 전체 Node 테스트 | 761/761 통과, [전체 로그](unit-tests.log) |
| Host/Client 타입 검사 | 통과 |
| Studio 빌드·패키징·격리 설치 | 통과 |
| 기존 브라우저 smoke | 12/12, light-1440 / dark-1440 / light-480, page/plugin 오류 없음 |
| 시작 방식·기존 자식 continuation | 9/9, [실행 결과](runtime-result.json) |
| 기능 UI E2E | 54/54, [브라우저 결과](ui-result.json), light-1440 / dark-1440 / light-520, page/plugin 오류 없음 |
| UI 저장→새 자식 실행 | 10/10, [실행 결과](ui-agent-result.json), 세 뷰에서 Fresh/Fork 총 6개 자식 이력 확인 |

[실행 시나리오](../../../scripts/e2e/agent-session-role-spawn.mjs)는 프리셋 Fork를 세션 Fresh로 바꾼 뒤 새 자식을 생성하고, 다시 Fork로 바꾼 뒤 새 자식을 생성한다. 완료된 이전 부모 턴의 표식이 Fresh에는 없고 Fork에는 있음을 확인했다. 임시 Fork 역할도 검증했다. 기존 Fresh 자식의 ID로 `send_message`를 실행했을 때 자식 수·ID·원래 정책·persona·wire model이 유지됨을 확인했다.

## 재현 명령

저장소 루트에서 실행한다. 새 격리 home을 사용하며 `--with-secrets`와 `--with-desktop-plugins`는 사용하지 않는다.

```sh
export STUDIO_DSH_BIN=/usr/local/bin/dsh
export STUDIO_E2E_HOME="$PWD/studio/dist/e2e/33/home"
export STUDIO_E2E_PROFILE=issue33
node studio/scripts/e2e/server.mjs up --mock-llm
node studio/scripts/e2e/smoke.mjs
node studio/scripts/e2e/agent-session-role-spawn.mjs
node studio/scripts/e2e/session-role-spawn-ui.mjs
# 모든 확인 후
node studio/scripts/e2e/server.mjs down
```

## 증거의 한계

- 모델 응답은 로컬 mock이며, 실제 LLM의 답변 품질이나 KV 캐시 성능은 검증하지 않았다.
- 기존 자식의 wire model 유지와 새 Fork 자식의 이력 상속을 검증했다. 서로 다른 실제 모델 간 전환이나 reasoning wire 옵션까지 검증한 것은 아니다. provider 전환과 명시적 모델 옵션 전달은 ToolRuntime 회귀 테스트로 별도 확인했다.
- 콜드 재시작 후 continuation과 다른 DSH 버전은 이번 검증 범위가 아니다.
- UI는 영어 locale에서 확인했다. ko/en/zh 문구는 소스·DOM 및 의미 검토로 확인했으며 세 locale 전체 브라우저 매트릭스는 실행하지 않았다.

## UI 완료와 정리

[UI 시나리오](../../../scripts/e2e/session-role-spawn-ui.mjs)는 기존 Fork 초기값·신규 Fresh 기본값, 실제 Fresh 수정/Fork 추가, 새로고침 후 카드·저장 상태, 이후 실제 생성한 자식의 이력 포함 여부를 확인했다. 세 뷰에서 편집 dialog의 viewport 경계·가로 overflow·Save 버튼 접근성 검사를 통과했다.

대표 화면: [좁은 편집](edit-fresh.light-520.png), [좁은 추가](add-fork.light-520.png), [다크 추가](add-fork.dark-1440.png), [라이트 저장 카드](persisted-cards.light-1440.png). 최종 결과의 `repairedSelectors: 1`은 이전 복구 map 로드 수이며, 최종 소스는 올바른 Save 셀렉터를 직접 사용한다.

검증 후 격리 서버를 종료했다: `ok: true`, `stopped: true`, `portFree: true` (19410). 사용자 GUI·프로필은 수정하지 않았다.

## 독립 검토

Reviewer가 변경 소스·locale·명세·실행 시나리오를 읽고 관련 4개 테스트 파일을 독립 실행했다(32/32 통과). 저장한 runtime-result.json과 설치 metadata의 버전·해시를 확인했고 구현 및 mock 실행 증거에 actionable finding 없이 PASS로 판단했다. 추가로 UI 시나리오의 실제 저장→reload→자식 실행 연결을 검토했으며, Save 셀렉터 수정 외 추가 finding은 없었다. 라이트 저장 카드·다크 추가 폼·520px 편집/추가 폼 네 대표 이미지도 독립 확인해 시각적 finding 없이 PASS로 판단했다. 최종 54/54 UI·10/10 UI-to-runtime 결과와 일치하는 세션 ID, 수정한 소스를 재확인해 최종 L2 PASS를 기록했다. Actionable finding 없음.

L1 judge는 UI가 아직 남았다는 중간 보고와 mock 증거의 주장 범위를 별도로 확인했다(정확한 범위라는 판단 0.92). ko/en/zh 시작 방식 안내가 같은 계약을 전달하는지도 확인했다(0.88). 이 확률은 실행 증거나 UI 완료의 대체물이 아니다.

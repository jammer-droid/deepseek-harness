# #29 세션별 서브에이전트 역할 설치 검증

수정하지 않은 DSH에 패키징한 Studio를 설치해 세션 역할 Remote와 Subagents 탭을 확인한 기록이다. 모델 호출은 하지 않았다.

## 환경

- DSH 런타임: `dsh --version` = `0.2.0-rc.2`(설치 앱 `/Applications/DeepSeek Harness.app`). 본체 수정 없음.
- Studio: worktree `../deepseek-harness-29`(브랜치 `studio/feat/29-session-roles`)에서 `node studio/start-web.mjs`로 pack한 `matamt-dbg-dsh-studio-0.5.0.tgz`를 설치했다.
- 프로필: 격리 `studio/.dsh-home` / `lean-agent-web`, `STUDIO_WEB_PORT=19393`. 사용자 GUI(19387), 기존 프리뷰(19388, 19390)와 `~/.dsh/profiles`는 건드리지 않았다.
- 모델 키: 격리 프로필에 없음. 위임(자식 시작)은 실행하지 않았다.
- 화면: Playwright 1.57(Python)과 설치된 Chrome headless. 브라우저 로캘이 한국어라 화면 문구는 ko다.

## Host 확인

`node studio/scripts/check-session-roles-runtime.mjs '<preview URL>'`

1. 임시 Studio 프리셋(`subagent_role`, 역할 `review`)을 저장·반영했다.
2. 그 프리셋으로 세션을 만들고 `studioSessionRoles/view`가 `available: true`, 역할 `review`(출처 `preset`)를 돌려줬다.
3. `editRole`로 지침을 바꾸자 출처가 `session`이 되고 `spawn: fork`는 유지됐다.
4. `addRole`로 임시 역할 `scout`(`spawn: fresh`)을 추가했다.
5. 프리셋에 저장된 역할 지침은 바뀌지 않았다.
6. 같은 프리셋의 다른 세션에서는 `review`가 `preset` 그대로였다(세션 간 격리).

결과: 통과. Loader가 패키징한 Studio의 `studioSessionRoles` 서비스를 실제 `sessionController`·`agentPresets`와 함께 시작했다.

## 화면 확인

세션 화면 탭 줄에 `Chat`, `Trajectory`, `Subagents`가 보였다. 콘솔 오류 0.

| 화면 | 파일 |
| --- | --- |
| 라이트 1440: 변경한 프리셋 역할(`이 세션에서 변경됨`, `프리셋 값 사용`)과 임시 역할(`이 세션`, `제거`) | [tab-light-1440](tab-light-1440.png) |
| 다크 1440 | [tab-dark-1440](tab-dark-1440.png) |
| 편집 대화상자: 모델·추론·지침만 편집, 복사 안내 | [edit-light-1440](edit-light-1440.png), [edit-dark-1440](edit-dark-1440.png) |
| 라이트·다크 520: 카드 한 열, 동작 버튼은 제목 아래로 | [tab-light-520](tab-light-520.png), [tab-dark-520](tab-dark-520.png) |

## 실세션 위임

모델 키 대신 로컬 스크립트 응답 서버를 썼다. 격리 프로필의 `cordis.patch.yml`에 DSH 공개 `dsh-llm-pi-ai` 설정으로 OpenAI 호환 경로 `fake29`(모델 `parent-model`, `session-model`)를 잠시 추가하고 기본 모델을 `fake29/parent-model`로 바꿨다. 서버(`127.0.0.1:19395`)는 사용자 메시지에 `DELEGATE-NOW`가 있으면 `subagent_role` 호출(`role: review`)을 돌려주고, 나머지에는 짧은 텍스트로 답하며 받은 요청을 기록한다. Studio나 DSH 코드는 바꾸지 않았다. 확인이 끝난 뒤 패치를 원래대로 되돌리고 임시 프리셋을 지웠다.

세션 `Delegation check`, 프리셋 역할 `review`(`inherit`, 추론 `inherit`, `fork`, 지침 `Preset persona.`).

| 순서 | 조작 | 자식 요청(서버 기록·자식 세션 로그) | 결과 |
| --- | --- | --- | --- |
| 1 | Remote로 세션 복사본: `fake29/session-model`, `high`, 지침 `SESSION-PERSONA-29` | `session-model`, `reasoning_effort: high`, 자식 로그에 `SESSION-PERSONA-29` | 통과. 부모는 계속 `parent-model` |
| 2 | 자식 세션의 Subagents 탭 | 루트 값, 읽기 전용 안내, 동작 없음 | 통과 [delegation-child-tab-light-1440](delegation-child-tab-light-1440.png) |
| 3 | `프리셋 값 사용`(되돌리기) 후 다시 위임 | `parent-model`(inherit), 자식 로그에 `Preset persona.` | 통과 |
| 4 | 탭에서 GUI로 편집: 추론 `Low`, 지침 `GUI-PERSONA-29` | `session-model`, `reasoning_effort: low`, 자식 로그에 `GUI-PERSONA-29` | 통과. 다음 호출부터 적용 |
| 5 | GUI `역할 추가`: `Scout`/`scout` | 카드 추가, 출처 `이 세션` | 통과 [gui-edit-result-light-1440](gui-edit-result-light-1440.png) |
| 6 | GUI `역할 추가`: 이미 있는 id `review` | 대화상자 유지, 오류 `Role identifier already exists: review` | 통과 [gui-duplicate-error-light-1440](gui-duplicate-error-light-1440.png) |

- 자식이 다시 `subagent_role`을 호출한 요청은 `subagent depth 2 exceeds maxDepth 1`로 DSH가 거절했다. 이 프로필의 위임 깊이 제한이며 손자 위임은 실세션에서 확인하지 못했다. 손자가 루트 값을 따르는 것은 단위 테스트로 확인했다.
- 발견한 문제: 자식 세션 탭(읽기 전용)이 모델 목록을 불러오지 않아 모델을 경로 id(`fake29/session-model`)로 보였다. 읽기 전용에서도 목록을 불러오도록 고쳤고, 재설치 후 `Fake 29 · Session Model`로 보이는 것을 확인했다.
- 콘솔 오류 0.

## 미검증

- 실제 DeepSeek 모델 응답으로 한 위임. 위임 경로와 자식 설정은 스크립트 응답 서버로 확인했고, 모델이 스스로 역할을 골라 호출하는지는 확인하지 않았다.
- 손자(깊이 2) 위임의 실세션 확인. 프로필 `maxDepth 1`로 막힘.
- `0.2.1-alpha.2` 설치 검증은 하지 않았다.

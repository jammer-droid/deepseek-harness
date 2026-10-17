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

## 미검증

- 실제 위임: 세션 역할의 모델·지침으로 자식이 시작되는지는 실제 `ToolRuntime` 단위 테스트([role-tool-session.test.mjs](../../../test/role-tool-session.test.mjs))로만 확인했다. 모델 키가 없어 실세션 위임은 하지 않았다.
- 자식 세션 탭의 읽기 전용 표시는 단위 테스트로만 확인했다(실제 자식 세션 없음).
- `0.2.1-alpha.2` 설치 검증은 하지 않았다.

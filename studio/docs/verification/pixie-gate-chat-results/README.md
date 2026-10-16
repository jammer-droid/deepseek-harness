# Pixie Gate 결과 대화 표시 실동작 검증

Pixie Gate 결과를 검사 대상(메시지·도구 호출·답변) 바로 아래에 표시하는 기능의 실세션 검증 기록이다. 게이트 설정 **결과를 대화에 표시**(`advanced.showInChat`, 기본 켜짐)가 표시 여부를 정하며, 결과는 세션 로그에 쓰지 않는다.

## 환경

- DSH 런타임: `dsh --version` = `0.2.0-rc.2`(설치 앱 `/Applications/DeepSeek Harness.app`). 본체 수정 없음.
- 프로필: 격리 `studio/.dsh-home` / `lean-agent-web`. `node studio/start-web.mjs`로 pack한 Studio tarball을 설치하고 `127.0.0.1:19388`에서 실행했다. 사용자 GUI(19387)와 `~/.dsh/profiles`는 건드리지 않았다.
- 모델: 세션과 Pixie 모두 `deepseek-official / deepseek-flash / low`.
- 프리셋: `Optimized Copy`(`studio-user-ea6a5a1e-…`). 기존 게이트와 시점이 겹치지 않는 프리셋을 골랐다.
- 작업 공간: `/private/tmp/pixie-28/workspace`(`notes.txt` 3줄, `scratch.txt`).
- 화면: Playwright 1.61.1과 설치된 Chrome headless로 캡처했다.

## 준비물

| 파일 | 설명 |
| --- | --- |
| [definitions.json](definitions.json) | 시점별 게이트 5개. 모두 `showInChat: true` |
| [v28-tool-guard.sh](v28-tool-guard.sh) | 도구 실행 전. `bash`의 `rm` 명령을 exit 11 stop으로 막고, 나머지는 exit 10 |
| [v28-tool-digest.sh](v28-tool-digest.sh) | 도구 실행 후. `read` 결과를 `pixie ask`로 요약해 note로 남김 |
| [v28-translate.sh](v28-translate.sh) | 턴 종료. 한글이 없는 답변을 `pixie ask`로 번역해 note로 남김 |

입력·서브에이전트 메시지 게이트는 스크립트 없이 Pixie가 note를 쓴다.

## 결과

세션 `session-d1f12e0c-…`(루트)와 자식 `6f7c8b3d-…`에서 4개 턴을 실행했다.

| 시점 | 실행 기록 | 화면 위치 | 근거 |
| --- | --- | --- | --- |
| 사용자 지시 | 턴마다 `done`, `messageId` 기록 | 사용자 메시지 바로 아래, 접힌 턴 밖 | [root-light-1440](root-light-1440.png) |
| 서브에이전트 메시지 | 자식 세션에 `done`, `messageId` 기록 | 자식 대화의 `Task message received` 아래 | [child-light-1440](child-light-1440.png) |
| 도구 실행 전 | `bash rm` → `denied`(스크립트 결론) | 해당 Bash 호출 아래, 턴을 펼치면 보임. 판정 배지 `막음`과 사유 | [s1-open](s1-open.png) |
| 도구 실행 후 | `read notes.txt` → note(스크립트 결론) | 해당 Read 호출 아래 | [s1-open](s1-open.png) |
| 턴 종료 | 영어 답변 → `[한국어 번역]` note | 답변 아래 | [root-light-1440](root-light-1440.png) |

- **설정 기준 표시:** 사용자 지시·턴 종료 게이트를 `showInChat: false`로 바꾼 뒤 보낸 4번째 턴은 실행 기록에 `showInChat: false`가 남았고, 화면에는 블록이 생기지 않았다. 설정을 되돌려도 지난 턴은 다시 나타나지 않는다(시작 시점 설정 보존).
- **건너뜀:** 대상이 아닌 도구에서 exit 10으로 끝난 실행은 표시되지 않았다.
- **세션 로그:** 루트와 자식 세션 로그(`session.v4.jsonl.zstd`)를 풀어 확인했다. `요청 요약`, `읽은 파일 요약`, `한국어 번역`, `삭제 명령 차단`, `studio-pixie-gate`는 하나도 없었다.
- **화면:** 라이트·다크 1440과 라이트 520에서 콘솔 오류 0. 좁은 폭에서는 버튼이 다음 줄로 넘어간다([root-light-520-open](root-light-520-open.png), [root-dark-1440-open](root-dark-1440-open.png)).

## 검증 중 발견해 고친 결함

- **rc.2는 Definition `match` 표 형식을 받지 않는다.** 처음에는 이벤트 종류별 표(`{ 'tool/result': fn }`)로 등록했는데, 0.2.0-rc.2 클라이언트에서 `definition.match is not a function`이 나며 세션 이벤트 피드가 멈췄다. workspace 소스는 표 형식을 받지만 배포 런타임은 받지 않는다. 기본 플러그인 `ui-user-questions`처럼 함수 형식으로 바꿨다.
- **도구 결과 이벤트의 호출 id 위치.** `tool/result`의 호출 id는 `data.message.toolCallId`에 있다. 처음 가정한 `data.callId`에서는 도구 블록이 생기지 않았다.
- **접힌 턴에 가려지는 메시지 결과.** 메시지 결과를 메시지 이벤트의 위치(턴·단계)에 두면 완료된 턴의 접힌 단계 안에 들어가 보이지 않았다. 메시지 결과는 세션 위치로 두어 메시지 바로 아래, 접힘 밖에 표시한다. 도구 결과는 도구 호출과 함께 접힌다.
- **검증 스크립트의 한글 판별(Studio 결함 아님).** macOS `grep '[가-힣]'`이 em dash(`—`)에도 일치해 영어 답변을 한국어로 보고 건너뛰었다. `perl -CS`의 `\p{Hangul}`로 바꿨다.

## 미검증

- 수정하지 않은 DSH 0.2.0-rc.2에 pack한 Studio를 격리 프로필로 설치해 실행했다. 0.2.1-alpha.2, 사용자 desktop 프로필, macOS 이외 OS는 확인하지 않았다.
- 거부된 사용자 지시는 대화에 메시지가 남지 않아 블록 위치가 없다. 이 경우는 Pixie 탭에만 남는다(설계대로이며 이번에 실행하지 않았다).
- 블록의 **이 세션에서 끄기** 버튼은 이번에 다시 누르지 않았다(턴 종료 블록에서 이전에 확인함, 단위 테스트 있음).

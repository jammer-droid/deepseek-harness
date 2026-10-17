---
kind: reference
description: "SettingsX 서비스: Studio 단축키 명령과 정의 파일로 등록하는 사용자 프로바이더의 동작·저장 위치·제약."
---

# SettingsX

SettingsX는 DSH 기본 설정을 확장하는 Studio 서비스다. **DSH Studio → SettingsX**에 **단축키**와 **프로바이더** 두 페이지가 있다. 결정과 구현 단계는 [#28 명세](../issues/28-settingsx.md)에 있다.

## 단축키

Studio는 DSH에 없는 명령만 DSH 단축키 서비스에 등록한다. 키 지정·충돌 검사·기본값 복원은 DSH 설정 → 단축키가 맡고, SettingsX 페이지는 명령 목록·현재 키·기본 키·다른 하네스의 참고 키를 보여 주며 명령별로 켜고 끈다. 끈 명령은 DSH 단축키 목록에서도 빠진다. 켜기·끄기는 이 브라우저(`localStorage`의 `studio.settingsx.disabledCommands.v1`)에만 저장된다.

| 명령 ID | 동작 | 기본 키 |
| --- | --- | --- |
| `studio.session-cycle.previous` / `.next` | 사이드바 순서의 이전/다음 세션. 끝에서 반대쪽으로 순환 | macOS 데스크톱 ⌘⇧[ / ⌘⇧] |
| `studio.settingsx.session-1` … `-9` | 사이드바 n번째 세션 | 없음 |
| `studio.settingsx.copy-cwd` | 현재 세션의 작업 폴더 경로 복사 | 없음 |
| `studio.settingsx.fullscreen` | 브라우저 전체 화면 전환(`requestFullscreen`) | 없음 |

- 세션 명령은 고정·수동 정렬·폴더 트리를 포함한 사이드바 순서를 따르며, 접힌 그룹과 "더 보기" 제한은 무시한다. 순서는 DSH 내부 저장값 `dsh.workspace.view.v5`를 읽어 계산한다(사용자 승인 비공개 의존). 목록이 로딩 중이거나 저장값 형식을 알 수 없으면, 또는 대화상자가 열려 있으면 이동하지 않는다.
- 별도 `@local/dsh-session-cycle` 플러그인과 기본 키가 같아 함께 설치하면 등록이 실패한다. 하나만 쓴다.
- 웹에는 기본 키가 없다. Chrome이 ⌘⇧[ / ]를 탭 전환에 먼저 쓰므로 웹에서는 ⌃⇧[ / ] 같은 다른 키를 지정한다.
- 전체 화면은 페이지 전체 화면이다. 데스크톱 창 전체 화면과 같은지는 확인하지 않았다.

## 프로바이더

`<profile>/studio-data/providers/*.json`의 정의 파일을 읽어 DSH 모델 경로로 등록한다. 올바른 파일의 모델은 DSH 모델 선택·Pixie·역할 모델 목록에 프로바이더 이름 아래로 나온다. 파일을 바꾼 뒤 **다시 읽기**를 누르면 폴더를 다시 읽어 등록 경로를 한 번에 교체한다. 형식과 예시는 `studio-provider-guide` 스킬([SKILL.md](../../release/docs/appendix/studio-provider-guide/SKILL.md), [examples.md](../../release/docs/appendix/studio-provider-guide/examples.md))에 있으며, Studio 시작 시 `<DSH home>/skills`에 설치된다(사용자가 고친 파일은 덮어쓰지 않는다).

| 표시 | 의미 |
| --- | --- |
| 등록됨 | 경로가 DSH에 등록됨. 자격 증명 상태와 동작이 함께 표시됨 |
| 잘못됨 | 검증 실패. 필드 경로별 문제를 모두 표시 |
| 등록 안 됨 | 경로 ID가 다른 어댑터나 앞선 파일과 겹침 |

자격 증명 종류와 저장 위치:

| 종류 | 화면 동작 | 비밀값 위치 |
| --- | --- | --- |
| `none` | — | 없음 |
| `credential` | 키 붙여 넣기·저장·삭제. 값은 다시 표시하지 않음 | DSH 자격 증명(`ref` 이름) |
| `command` | 명령 이름 표시 | Studio가 저장하지 않음. Host 메모리에 만료까지 캐시 |
| `oauth` | 로그인·다시 로그인·로그아웃, 진행 중이면 로그인 페이지 열기·취소 | DSH 자격 증명 레코드 `studio-providers/<id>` |

- 프로토콜: `openai-chat`(Chat Completions), `openai-responses`(Responses, `store: false`). 모든 요청에 DSH 속성 헤더(`attributionHeaders()`)를 붙인다. 요청은 텍스트만 보낸다.
- OAuth는 PKCE와 `http://localhost:<redirectPort><redirectPath>` 리디렉션을 쓴다. 브라우저와 DSH Host가 같은 기기에 있어야 하고 포트가 비어 있어야 한다. 토큰이 만료되면 갱신 토큰으로 갱신하며 DSH 자격 증명의 레코드 잠금 안에서 바꾼다. HTTP 401이면 OAuth·명령 토큰을 한 번 새로 받아 다시 보낸다.
- HTTP 429·5xx는 DSH 재시도 정책으로, 401·403은 인증 실패로 보고한다. 오류 메시지에 토큰·키를 넣지 않는다.
- 구독·무료 등급을 그 앱 밖에서 쓰면 프로바이더 약관에 어긋날 수 있다. 판단과 책임은 사용자에게 있다. Studio는 클라이언트 위장 같은 접근 제한 우회를 지원하지 않는다.

## 검증 경계

계약 검증·스트림 변환·자격 증명(PKCE 로그인, 저장, 갱신, 401 재시도)·다시 읽기·페이지 렌더링은 단위 테스트가 가짜 서버로 확인한다. 수정하지 않은 DSH `0.2.0-rc.2`에 패키징한 Studio를 격리 설치해 화면·모델 선택 표시를 확인한 기록은 명세에 있다. 실제 프로바이더(구독 포함)와의 대화는 사용자 계정이 필요해 자동 검증하지 않는다.

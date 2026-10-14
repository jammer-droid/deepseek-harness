# 서브에이전트 Tool Filter 동작 확인 절차

이 문서를 받은 에이전트는 아래 절차대로 Studio 서브에이전트 동작을 직접 확인하고 [보고 양식](#보고-양식)으로 결과를 보고한다. 사용자가 이 문서를 세션에 참조로 걸고, Studio 프리셋을 지정해 세션을 시작한 상태를 전제로 한다.

## 전제

- 현재 세션은 사용자가 지정한 Studio 프리셋으로 실행 중이다. 이 프리셋에는 `subagent_role`이 선택되어 있고, 서브에이전트 탭에 다음 두 역할이 있다.

  | 역할 ID | 시작 방식 | Tool Filter |
  |---|---|---|
  | `worker` | Continue parent (Fork) | 프리셋 기본값 사용 |
  | `reviewer` | New conversation (Fresh) | 이 역할만 따로 설정 |

- 사용자가 프리셋 기본 Tool Filter와 `reviewer`의 목록을 정해 두었다. 에이전트는 값을 추측하지 않는다. [1단계](#1-설정-확인)에서 `subagent_role` `action: list`로 역할을 확인하고, 실제로 적용된 목록은 [4단계](#4-세션-기록으로-확인)의 기록에서 읽는다.
- 프리셋 설정이 위와 다르면(역할이 없음, 시작 방식이 다름, `subagent_role` 없음) 위임을 시작하지 말고 다른 점을 보고한 뒤 멈춘다.

## 지켜야 할 범위

- 확인만 한다. 파일·프리셋·프로필·Studio 설정을 바꾸지 않는다. 서브에이전트에게 주는 작업도 읽기 전용으로 한정한다.
- 서브에이전트에게 사용자 질문(`ask_user_question`)이나 화면 표시(`present`)를 요구하지 않는다. 그런 도구가 서브에이전트에 있는지는 서브에이전트의 자기 보고와 세션 기록으로만 확인한다.
- 자식이 끝나기 전에 결과를 판정하지 않는다. 시작한 서브에이전트의 결과를 모두 받은 뒤 4단계로 넘어간다.

## 1. 설정 확인

1. 부모(현재 세션)에게 보이는 도구 목록을 기록한다. 이 목록이 기준이다.
2. `subagent_role`을 `action: list`로 호출해 역할 ID와 시작 방식이 위 표와 같은지 확인한다.
3. 현재 세션 ID를 확인한다. 세션 ID를 알 수 없으면 사용자에게 묻지 말고 4단계에서 가장 최근 세션을 찾는다고 보고서에 적는다.

## 2. 서브에이전트 시작

두 역할을 각각 한 번씩 호출한다. 두 작업은 서로 독립이므로 함께 시작해도 된다. 작업 문구는 아래를 그대로 쓴다.

**`worker` (Fork)**

```text
Report, without calling any tool except as stated, exactly which tools you can call.
1. List every tool name available to you, sorted, one per line.
2. Say whether ask_user_question, present, bash, write and edit are in that list.
3. Quote any sentence in your system prompt that tells you how to use bash, background jobs, or workflow. Write "none" if there is none.
4. Call the read tool once on the file README.md in the working directory (first 5 lines) and report whether it succeeded.
Do not modify anything.
```

**`reviewer` (Fresh)**

같은 문구를 쓰되 4번을 다음으로 바꾼다.

```text
4. Try to call the write tool to create a file named tool-filter-probe.txt with the text "probe". If the tool is not available or the call is rejected, report the exact error and do not try any other way to create the file.
```

`reviewer`의 4번은 Tool Filter가 실행 단계에서도 막는지 보는 확인이다. `write`가 `reviewer` 목록에 없는 경우에는 파일이 만들어질 수 있으므로, 1단계에서 이 위험을 보고서에 적고 4번을 생략한다. 판단할 수 없으면 생략한다.

## 3. 결과 수집

두 서브에이전트가 보고를 마칠 때까지 기다린다. 각 보고에서 다음을 기록한다.

- 서브에이전트가 말한 도구 목록과 개수
- 지정한 다섯 도구의 포함 여부
- 인용한 사용 지침 문장
- 4번 결과(성공 여부, 오류 문구)

서브에이전트가 오류로 끝나면 오류 문구 전체를 기록한다. `Studio preset policy could not be installed`나 `Studio policy selected tools unavailable`은 정책 설치 실패이므로 그대로 보고한다.

## 4. 세션 기록으로 확인

서브에이전트의 자기 보고는 틀릴 수 있다. 실제로 모델에 전달된 도구와 DSH가 기록한 Tool Filter를 세션 기록에서 확인한다. 저장소 루트에서 실행한다.

```sh
node studio/scripts/agents/subagent-report.mjs <현재 세션 ID>
```

- 세션 ID는 `session-` 접두어를 붙여도, 빼도 된다.
- 세션 ID를 모르면 `ls -t ~/.dsh/sessions/*/ | head` 로 가장 최근 `session-*` 를 찾고, 찾은 방법을 보고서에 적는다.
- 스크립트는 읽기만 한다. 부모와 이 세션이 시작한 모든 서브에이전트에 대해 다음을 출력한다.
  - `provider`: `fork` 또는 `spawn`(Fresh)
  - `toolFilter (recorded by DSH)`: DSH가 자식에게 실제로 적용하고 기록한 목록
  - `tools`: 첫 모델 요청에 실린 도구 목록
  - `usage instructions present`: 첫 시스템 프롬프트에 남아 있는 대표 사용 지침 섹션
  - `policy rejections`: Studio 정책이 거절한 호출

## 5. 판정 기준

각 항목을 **통과 / 실패 / 확인 불가**로 판정한다. 근거는 4단계 출력 값으로 적는다.

| # | 항목 | 통과 조건 |
|---|---|---|
| 1 | 부모 도구 유지 | 부모 `tools`에 서브에이전트 Tool Filter의 도구가 모두 남아 있다 |
| 2 | Fork 기본값 적용 | `worker`(`provider=fork`)의 `toolFilter`가 프리셋 기본 목록과 같다 |
| 3 | Fresh 역할별 적용 | `reviewer`(`provider=spawn`)의 `toolFilter`가 `reviewer` 목록과 같고, 프리셋 기본값과 다르면 기본값이 아니라 `reviewer` 목록을 따른다 |
| 4 | 도구 목록에서 제외 | 각 서브에이전트의 `tools`에 자기 `toolFilter` 도구가 하나도 없다 |
| 5 | 나머지 도구 유지 | 각 서브에이전트의 `tools` = 부모 `tools` − 자기 `toolFilter` |
| 6 | 사용 지침 제거 | 서브에이전트 `toolFilter`에 `bash`가 있으면 `tool:bash`가 없다. `job_list`·`job_output`·`job_kill`이 모두 있으면 `tool:jobs`, `workflow`가 있으면 `tool:workflow`가 없다. 해당 도구가 목록에 없으면 이 항목은 "해당 없음" |
| 7 | 부모 사용 지침 유지 | 부모의 `usage instructions present`에 6번에서 사라진 섹션이 남아 있다 |
| 8 | 실행 차단 | `reviewer`의 4번이 거절되고, `tool-filter-probe.txt`가 생기지 않았다. 생략했으면 "확인 불가" |
| 9 | 정책 설치 | 어느 세션에도 `policy rejections`가 없다. 단, 8번의 거절 1건은 예상된 결과다 |
| 10 | 자기 보고 일치 | 서브에이전트가 말한 도구 목록이 4단계 `tools`와 같다. 다르면 차이를 적는다 |

판정 메모:
- `worker`와 `reviewer`가 같은 목록을 받았는데 사용자가 두 목록을 다르게 정했다면 3번은 실패다.
- 첫 모델 요청 이후에 도구가 바뀌었을 수 있다. 4단계 `tools`는 첫 요청 기준이므로, 자기 보고와 다르면 두 값을 모두 적는다.
- `tool-filter-probe.txt`가 만들어졌다면 지우지 말고 경로를 보고한다. 정리는 사용자가 정한다.

## 보고 양식

```markdown
## 서브에이전트 Tool Filter 확인 결과

- 세션: <부모 세션 ID> (찾은 방법: <직접 확인 / 최근 세션>)
- 프리셋: <preset>
- Studio 버전: <확인했다면 기재, 모르면 "미확인">

| 세션 | 역할 | 시작 방식 | DSH 기록 toolFilter | 도구 수 |
|---|---|---|---|---|
| <부모> | (부모) | - | - | <n> |
| <worker 세션> | worker | fork | <목록> | <n> |
| <reviewer 세션> | reviewer | spawn | <목록> | <n> |

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 부모 도구 유지 | 통과/실패/확인 불가 | <값> |
| … | … | … | … |

### 차이와 이상
- <실패·확인 불가 항목의 실제 값, 자기 보고와 기록의 차이, 오류 문구>

### 실행하지 않은 것
- <생략한 단계와 이유>
```

결과가 모두 통과여도 표는 모두 채운다. 확인하지 못한 항목을 통과로 적지 않는다.

# Pixie Loop 가이드

[English](pixie-loop.md) | 한국어

Pixie Loop는 같은 기준으로 판정할 항목이 많을 때 **작업 → 판정 → 고쳐서 다시 하기**를 메인 에이전트의 대화 밖에서 반복하는 기능입니다. 에이전트는 `pixie_loop` 도구에 루프 명세 하나를 넘기고, 통과 수·결과 파일·끝내 통과하지 못한 항목만 돌려받습니다. 항목마다 어떤 시도와 판정이 있었는지는 대화에 남지 않고 **Pixie 탭 → 루프**에서 봅니다.

- [언제 쓰나](#언제-쓰나)
- [준비](#준비)
- [동작 방식](#동작-방식)
- [명세 필드](#명세-필드)
- [기준 쓰는 법](#기준-쓰는-법)
- [calibration 예시](#calibration-예시)
- [코드 검사](#코드-검사)
- [상한과 결과](#상한과-결과)
- [예시 명세](#예시-명세)
- [실행 기록 보기](#실행-기록-보기)
- [할 수 없는 일](#할-수-없는-일)
- [에이전트 스킬](#에이전트-스킬)

## 언제 쓰나

| 상황 | 쓸 것 |
| --- | --- |
| 서로 독립인 항목이 많고, 모두 같은 기준으로 판정한다 (번역 검수, 문구 교정, 파일별 감사) | `pixie_loop` |
| 판정 한 번이면 된다 | `judge` 도구 |
| 파일을 찾아 읽고 판단하며 여러 단계로 일해야 한다 | `subagent_role` |
| 조건 분기나 여러 에이전트를 묶은 복잡한 흐름이 필요하다 | DSH `workflow` 도구 |
| 에이전트가 일하는 특정 순간에 자동으로 검사한다 | [Pixie Gate](pixie-gate.ko.md) |

## 준비

- **Studio → Pixie → 설정**에서 Pixie 모델을 정합니다. 작업·기준 변환·피드백은 모두 이 모델이 합니다.
- **Studio → Pixie → 게이트 → 결정 엔진**에서 판정 엔진(LLM 또는 TypeSafe Jev)을 고릅니다. Jev는 API 키가 필요합니다.
- 프리셋에 `pixie_loop` 도구가 있어야 합니다. Studio Master에는 들어 있습니다.

항목 내용은 Pixie 모델 공급자와 결정 엔진(Jev를 고르면 TypeSafe)으로 전송됩니다.

## 동작 방식

1. **기준 준비 (한 번):** `criteria`를 Pixie가 결정 엔진 질문과 통과 규칙으로 바꿉니다. `checks`를 직접 주면 이 단계를 건너뜁니다.
2. **calibration (한 번):** 통과해야 할 예시는 모두 통과하고 떨어져야 할 예시는 모두 떨어져야 합니다. 아니면 루프를 시작하지 않고 오류를 돌려줍니다. 통과하면 확인 없이 바로 시작합니다.
3. **항목마다:**
   - Pixie가 `work.instruction`과 `shared`를 보고 출력을 만듭니다.
   - 코드 검사(`codeChecks`)를 먼저 돌립니다. 하나라도 실패하면 결정 엔진은 부르지 않습니다.
   - 결정 엔진이 고정된 질문으로 판정하고, 통과 규칙으로 통과 여부를 정합니다.
   - 실패하면 Pixie가 무엇을 고칠지 짧게 적고, 같은 항목을 다시 시도합니다.
4. **끝:** 결과 파일을 쓰고 요약을 돌려줍니다.

컨텍스트 규칙:

- 항목끼리는 서로를 보지 못합니다. 메인 대화도 들어가지 않습니다.
- 같은 항목의 재시도에는 그 항목의 이전 출력과 피드백이 쌓입니다.
- 기준 준비와 피드백 작성은 매번 새 대화로 합니다.

통과 여부는 코드 검사와 결정 엔진 결과만으로 정합니다. Pixie의 피드백은 다음 시도에 쓰는 참고일 뿐이며 판정을 바꾸지 않습니다. 결정 엔진은 이유를 말하지 않으므로, 피드백의 이유는 Pixie의 추정입니다.

## 명세 필드

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `items` | 예 | `{ "inline": [{ "id", "input" }] }` 또는 `{ "path": "work/items.jsonl" }`. 파일은 한 줄에 `{"id","input"}` 하나. id는 겹치면 안 됩니다. 최대 2000개, 입력 하나 32,000자 |
| `work.instruction` | 예 | 항목 하나로 무엇을 할지. 작업자에게는 도구가 없습니다 |
| `shared` | | 모든 항목이 똑같이 보는 고정 자료(용어집, 스타일 가이드). 최대 64,000자 |
| `criteria` | 둘 중 하나 | 판정 기준을 평문으로 |
| `checks` | 둘 중 하나 | 질문과 통과 규칙을 직접. [아래](#checks를-직접-줄-때) 참고 |
| `codeChecks` | | 결정 엔진 전에 돌리는 정확한 검사. [코드 검사](#코드-검사) |
| `calibration` | 예 | `{ "pass": [{ "input", "output" }], "fail": [...] }`. 각각 1–10개 |
| `maxAttempts` | | 항목당 시도 횟수. 기본 3, 최대 10 |
| `concurrency` | | 동시에 처리할 항목 수. 기본 4, 최대 8 |
| `limits` | 예 | `{ "tokens", "timeMs" }`. 둘 중 하나에 닿으면 멈추고 남은 항목은 건너뜀으로 보고합니다 |
| `output` | | 결과 JSONL 경로 |
| `run_in_background` | | `true`면 job id를 바로 돌려줍니다. `job_output`으로 요약을 받고 `job_kill`로 멈춥니다 |

## 기준 쓰는 법

결정 엔진은 `input`(항목 입력)과 `output`(작업자 출력)이 든 상태를 판정합니다.

- **한 문장에 한 가지만.** "의미가 같고 존댓말이며 용어집을 지킨다"보다 세 문장으로 나눕니다. Pixie가 질문을 하나씩 만들기 쉽습니다.
- **실패 유형에 이름을 붙입니다.** "문제가 있으면 오역·용어·어조·누락 중 무엇인지"라고 쓰면 choice 질문이 생기고, 피드백이 구체적이 됩니다.
- **정확한 검사는 기준에 넣지 않습니다.** 자리표시자 보존, JSON 형식, 특정 문자 포함은 [코드 검사](#코드-검사)로 돌립니다. 결정 엔진은 확률을 내므로 이런 검사에 맞지 않습니다.
- 결정 엔진은 영어 질문에서 가장 정확합니다. 기준을 영어로 쓰면 더 안정적입니다.

### checks를 직접 줄 때

```json
{
  "questions": {
    "faithful": { "type": "noul", "instructions": "Does `output` keep the full meaning of `input`?" },
    "issue": { "type": "choice", "instructions": "What is the main problem in `output`?",
      "criteria": { "ok": "no problem", "mistranslation": "meaning changed", "terminology": "glossary not followed", "tone": "not polite 해요체" } },
    "natural": { "type": "score", "instructions": "How natural is `output` as Korean UI text?", "criteria": ["awkward", "understandable", "natural"] }
  },
  "pass": { "faithful": { "min": 0.7 }, "issue": { "accept": ["ok"] }, "natural": { "min": 1.5 } }
}
```

- `noul`: 예일 확률. `min`(0 초과 1 이하) 이상이면 통과. "예"가 좋은 쪽이 되게 씁니다.
- `choice`: `accept`에 든 선택지면 통과. 실패하는 선택지가 하나 이상 남아야 합니다.
- `score`: 단계 번호(0부터). `min` 이상이면 통과.
- 질문은 1–10개. 질문 id는 엔진에 전달되지 않으므로 `instructions`만으로 뜻이 통해야 합니다.

## calibration 예시

calibration은 기준이 실제로 좋은 출력과 나쁜 출력을 가르는지 미리 확인합니다. 잘못된 기준으로 항목 수백 개를 돌리는 일을 막습니다.

- **pass:** 실제로 받아들일 출력. 가장 흔한 형태 하나와 애매하지만 괜찮은 것 하나가 좋습니다.
- **fail:** 실제로 나올 법한 실수. 기준마다 하나씩 걸리는 예를 넣습니다(뜻이 바뀐 번역, 반말, 자리표시자 빠짐).
- 너무 뻔한 예(빈 문자열, 다른 언어)만 넣으면 확인 효과가 약합니다.

시작이 거부되면 오류 메시지에 어느 예시가 어떤 값으로 반대로 판정됐는지 나옵니다. 그 질문의 문장을 고치거나 `checks`로 직접 주고 다시 실행합니다.

## 코드 검사

| 검사 | 옵션 | 실패 조건 |
| --- | --- | --- |
| `{"type":"placeholders"}` | | 입력의 `{name}`, `{{count}}`, `%s`·`%1$d`, `<b>`·`</b>` 같은 자리표시자와 태그가 출력에 같은 수만큼 없거나, 입력에 없는 것이 생김 |
| `{"type":"regex","pattern":"[가-힣]","expect":"match"}` | `flags`: `i` `m` `s` `u` | `match`면 출력이 패턴에 맞지 않을 때, `no-match`면 맞을 때 |
| `{"type":"json","keys":["title"]}` | `keys` 선택 | 출력이 JSON이 아니거나, 객체에 지정한 키가 없음 |

코드 검사가 실패하면 그 실패 내용이 다음 시도에 그대로 전달됩니다.

## 상한과 결과

- `limits.tokens`는 Pixie와 결정 엔진의 입력·출력 토큰 합입니다. 대략 `항목 수 × 시도 횟수 × (입력+출력 길이 + 공통 자료)`로 잡고 여유를 둡니다.
- 멈추면 상태가 `stopped`이고 남은 항목은 `skipped`입니다. 결과 파일에 없는 id만 골라 다시 실행하면 이어서 할 수 있습니다.
- 결과 파일의 각 줄: `{"id","status","output"?,"attempts","error"?}`. `status`는 `passed`·`escalated`·`error`·`cancelled`.
- 에이전트가 받는 요약: 통과 수, `escalated`(시도를 다 쓰고도 통과하지 못한 항목: id·시도 수·실패한 검사·마지막 피드백), `errors`(엔진 오류 등), 건너뛴 수, 결과 파일, 사용량. 통과한 출력은 요약에 들어가지 않습니다.
- `escalated` 항목은 메인 에이전트가 직접 고치거나 사람에게 묻습니다.
- 결정 엔진 오류는 실패로 바꾸지 않고 항목 `error`로 남깁니다.

## 예시 명세

### 번역 검수

```json
{
  "items": { "path": "work/ko-pending.jsonl" },
  "shared": "Glossary: session → 세션, preset → 프리셋, tool → 도구. UI copy uses polite 해요체 and no trailing period on buttons.",
  "work": { "instruction": "Translate the English UI string to natural Korean. Keep placeholders and tags exactly." },
  "criteria": "The Korean keeps the full meaning of the English. It follows the glossary in shared context. It uses polite 해요체. If there is a problem, say whether it is a mistranslation, terminology, tone, or omission.",
  "codeChecks": [{ "type": "placeholders" }, { "type": "regex", "pattern": "[가-힣]", "expect": "match" }],
  "calibration": {
    "pass": [{ "input": "Save {name}", "output": "{name} 저장" }, { "input": "Open the session", "output": "세션 열기" }],
    "fail": [{ "input": "Do not retry on 4xx", "output": "4xx에서도 재시도" }, { "input": "Open the session", "output": "세션을 열어라" }]
  },
  "maxAttempts": 3, "concurrency": 4,
  "limits": { "tokens": 2000000, "timeMs": 3600000 },
  "output": "work/ko-done.jsonl",
  "run_in_background": true
}
```

### 문서 교정

```json
{
  "items": { "inline": [{ "id": "intro", "input": "Studio let you build preset and apply it to session." }] },
  "work": { "instruction": "Fix grammar and clarity. Keep the meaning, terms, and Markdown. Reply with the corrected paragraph only." },
  "criteria": "The output keeps the meaning of the input. The output has no grammar errors. The output does not add new claims.",
  "calibration": {
    "pass": [{ "input": "It work fine.", "output": "It works fine." }],
    "fail": [{ "input": "It work fine.", "output": "It works perfectly and is the fastest option." }]
  },
  "limits": { "tokens": 200000, "timeMs": 600000 }
}
```

### 파일별 감사 (항목 = 파일 내용)

에이전트가 파일 내용을 읽어 `items`에 넣거나 JSONL로 만든 뒤 실행합니다. 작업자는 파일을 직접 읽지 못합니다.

```json
{
  "items": { "path": "work/handlers.jsonl" },
  "work": { "instruction": "List every place in this source file where user input reaches a shell command or SQL string without escaping. Reply with JSON: {\"findings\": [{\"line\": number, \"why\": string}]}. Use an empty list when there are none." },
  "criteria": "Every finding in output points to real unescaped user input in input. No real case in input is missing from output.",
  "codeChecks": [{ "type": "json", "keys": ["findings"] }],
  "calibration": {
    "pass": [{ "input": "exec(`ls ${req.query.dir}`)", "output": "{\"findings\":[{\"line\":1,\"why\":\"query param in shell command\"}]}" }],
    "fail": [{ "input": "exec(`ls ${req.query.dir}`)", "output": "{\"findings\":[]}" }]
  },
  "maxAttempts": 2,
  "limits": { "tokens": 1500000, "timeMs": 1800000 },
  "output": "work/audit.jsonl"
}
```

## 실행 기록 보기

세션 오른쪽 사이드바 **Pixie 탭 → 루프**에서 실행 목록을 봅니다. 실행을 고르면 다음이 보입니다.

- 상태와 진행(`3/10개 항목`), 통과·넘김·오류 수, 사용한 토큰, 결과 파일
- 검사: 질문, 통과 조건, 기준을 Pixie가 바꿨는지 명세에 직접 줬는지
- 항목을 누르면 시도마다 출력, 실패한 코드 검사, 결정 엔진 값, Pixie 피드백

진행 중에는 2초마다 새로 읽습니다. DSH가 다시 시작되면 진행 중이던 실행은 이어지지 않고 잠시 뒤 `취소됨`으로 표시됩니다.

## 할 수 없는 일

- 작업자가 도구를 쓰거나 파일을 읽는 일. 필요한 자료는 `items`나 `shared`에 넣습니다.
- 항목끼리 참조하거나 실행 중에 용어집을 늘리는 일. 끝난 뒤 전체 결과로 일관성 검사를 한 번 더 돌립니다.
- 실행 중에 기준이나 항목 바꾸기. 멈추고 다시 시작합니다.
- 단계별로 다른 모델 쓰기. 모두 기본 Pixie 모델입니다.
- 이미지 판정, 실시간 조작.
- 코드 검사 세 종 밖의 정확한 검사(글자 수, 외부 실행 결과).
- DSH 재시작 뒤 이어서 실행하기.
- 결정 엔진을 LLM으로 두고 Pixie와 같은 모델을 쓰면 생성한 쪽이 스스로 채점하게 됩니다. 가능하면 Jev나 다른 모델을 씁니다.

## 에이전트 스킬

Studio는 시작할 때 `<DSH 홈>/skills/studio-pixie-loop-guide/`에 이 가이드를 담은 스킬을 설치합니다. 에이전트에게 "이 문자열들을 pixie_loop로 번역 검수해 줘"처럼 요청하면 스킬을 읽고 명세를 씁니다. 직접 고친 파일은 업데이트 때 덮어쓰지 않습니다. Studio 버전으로 되돌리려면 그 파일을 지우고 DSH를 다시 시작하세요.

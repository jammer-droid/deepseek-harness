# L1 셀렉터 복구

L0 시나리오의 `app.step()`이 셀렉터를 찾지 못하면 하네스가 실패 시점의 DOM과 접근성 스냅샷을 남기고, 복구 항목을 만든다. 검증자는 아래 명세로 `pixie_loop`을 한 번 실행하고, 통과한 셀렉터를 적용해 L0을 다시 실행한다. 검증자는 스냅샷·스크린샷을 읽지 않는다.

```text
L0 실패 (summary.repair.items) → pixie_loop (이 명세) → apply-repairs.mjs → L0 재실행
```

## 1. L0 실패 출력

```json
"repair": { "items": "studio/dist/e2e/shots/<name>/repair-items.jsonl", "failDir": "studio/dist/e2e/shots/<name>/fail", "count": 1 }
```

- `repair-items.jsonl`: 셀렉터마다 한 항목. 입력은 목표(`goal`), 실패 셀렉터, 오류, 실패 시점 접근성 스냅샷(최대 20,000자)이다.
- `fail/<id>.html`: 실패 시점 DOM. [probe.mjs](probe.mjs)가 스크립트·네트워크를 끈 채 열어 후보 셀렉터를 실행한다. 서버 상태를 바꾸지 않으므로 반복해도 안전하다.
- `repair-map.json`: 항목 id → 원래 셀렉터.

`step()`의 `goal`이 복구 지시문이 된다. 요소를 말로 정확히 적는다(예: "Studio 패널 상단의 프리셋 탭 버튼").

## 2. 명세

`<ROOT>`는 저장소 절대 경로, `<name>`은 시나리오 이름이다. 판정 기준·calibration은 바꾸지 않는다.

```json
{
  "items": { "path": "<ROOT>/studio/dist/e2e/shots/<name>/repair-items.jsonl" },
  "work": { "instruction": "The input describes one UI step of an end-to-end test whose Playwright selector no longer matches, plus an accessibility snapshot of the page at the failure. Write one replacement Playwright selector that matches exactly one element: the element described by Goal. Prefer role selectors built from names in the snapshot, e.g. role=button[name=\"Save\"], and scope with >> to a named landmark (navigation, region, dialog) when a name is not unique. Use exact accessible names from the snapshot. Reply with the selector only, no quotes around it and no explanation." },
  "act": { "tool": "bash", "command": "node <ROOT>/studio/scripts/e2e/probe.mjs <ROOT>/studio/dist/e2e/shots/<name>/fail {{id}} {{output}}", "safeToRepeat": true, "isolated": true, "timeoutMs": 30000, "maxObservationChars": 2000 },
  "checks": {
    "questions": {
      "unique": { "type": "noul", "instructions": "Does `observation` contain the line `matches: 1` (exactly one element matched, no error line)?" },
      "target": { "type": "noul", "instructions": "`input` states a Goal element. `observation` describes the element(s) a selector matched. Is the single matched element in `observation` the element described by Goal in `input` (same control, same visible text or label)?" }
    },
    "pass": { "unique": { "min": 0.7 }, "target": { "min": 0.7 } }
  },
  "codeChecks": [
    { "type": "regex", "pattern": "^\\S.*\\S$", "expect": "match" },
    { "type": "regex", "pattern": "\\n", "expect": "no-match" }
  ],
  "calibration": {
    "pass": [
      { "input": "Goal: The Save button in the settings dialog footer\nFailed selector: #save-btn", "output": "role=dialog[name=\"Settings\"] >> role=button[name=\"Save\"]", "observation": "selector: role=dialog[name=\"Settings\"] >> role=button[name=\"Save\"]\nmatches: 1\n#1: <button> text=\"Save\"" }
    ],
    "fail": [
      { "input": "Goal: The Save button in the settings dialog footer\nFailed selector: #save-btn", "output": "button", "observation": "selector: button\nmatches: 42\n#1: <button> aria-label=\"New session\" text=\"\"\n… 37 more" },
      { "input": "Goal: The Save button in the settings dialog footer\nFailed selector: #save-btn", "output": "role=button[name=\"Cancel\"]", "observation": "selector: role=button[name=\"Cancel\"]\nmatches: 1\n#1: <button> text=\"Cancel\"" },
      { "input": "Goal: The Save button in the settings dialog footer\nFailed selector: #save-btn", "output": "#save-btn", "observation": "selector: #save-btn\nmatches: 0" }
    ]
  },
  "maxAttempts": 3,
  "concurrency": 2,
  "limits": { "tokens": 200000, "timeMs": 600000 },
  "output": "<ROOT>/studio/dist/e2e/shots/<name>/repair-done.jsonl"
}
```

- 명세를 바꿀 때는 먼저 `studio-pixie-loop-guide` 스킬([SKILL.md](../../release/docs/appendix/studio-pixie-loop-guide/SKILL.md))을 불러오고, `act` 계약은 [상세 가이드의 act 절](../../release/docs/appendix/pixie-loop.md#run-and-judge-act)을 따른다.
- 판정 질문은 둘이다. `unique`는 정확히 하나가 잡혔는지, `target`은 잡힌 요소가 목표인지다. 하나만 잡혔어도 다른 버튼이면 실패한다.
- 항목이 많거나 오래 걸리면 `run_in_background: true`로 실행하고 완료 알림을 기다린다.
- 입력(접근성 스냅샷의 화면 문구)과 관찰은 Pixie 제공자·결정 엔진으로 전송된다. 격리 프로필의 테스트 데이터만 넣는다.

## 3. 적용과 재실행

```sh
node studio/scripts/e2e/apply-repairs.mjs <name> <pixie_loop 요약의 results 경로>
<L0 실패 때와 같은 시나리오 명령>   # 같은 run({ name })이면 repairs.json을 읽어 복구 셀렉터로 실행
```

- `<name>`은 시나리오의 `run({ name })` 값이다(`smoke.mjs`는 `--name`으로 바꿀 수 있고, 다른 시나리오는 파일에 고정). 복구 파일은 이름별 폴더에 있으므로 재실행은 **처음과 같은 명령·이름**으로 한다.
- 결과 파일은 `pixie_loop` 요약에 나온 `results` 경로를 쓴다. 요약에 경로가 없거나 파일이 없으면(모든 항목 skipped, 쓰기 실패) `apply-repairs.mjs`는 exit 2로 멈춘다. 이 경우 원인을 기록하고 셀렉터 단계는 `환경 차단`이다.
- `passed` 항목만 `dist/e2e/shots/<name>/repairs.json`에 합친다. `escalated`·`error`는 `unresolved`로 출력되며 L2(검증자)가 판단한다. error는 `환경 차단`이다.
- 대기열의 **모든 항목**을 결과와 대조한다. exit 0은 모든 항목이 새 셀렉터로 적용됨, exit 1은 하나 이상 `unresolved`(결과에 없음·통과 못함·셀렉터 그대로·알 수 없는 id; 통과분은 적용됨), exit 2는 결과 파일 없음, 또는 `repair-map.json`·결과 파일·기존 `repairs.json` 중 읽을 수 없는 JSON이다. `unresolved[].reason`을 보고서에 옮긴다. exit 1을 성공으로 적지 않는다.
- 재실행 L0이 통과해야 원래 단계를 통과로 적는다. 결과에 `repairedSelectors` 수가 나온다.
- 시나리오 원본의 셀렉터는 그대로다. 복구가 맞으면 메인 세션이 원본을 고쳐 커밋한다(검증자는 고치지 않는다).

## 실측 (2026-10-17, DSH 0.2.1-rc.2)

`STUDIO_E2E_STALE=1 node studio/scripts/e2e/smoke.mjs --name smoke-stale`로 낡은 셀렉터 `[role="tab"]:has-text("프리셋")`를 넣어 L0 실패 1건을 만들었다.

| 단계 | 결과 |
| --- | --- |
| L0 실패 | 1건, 15초. 복구 항목 1개(2.2KB) |
| L1 `pixie_loop` (위 명세 그대로) | 1회 시도에 통과: `role=navigation[name="Studio 서비스"] >> role=button[name="프리셋"]`. Pixie 172/83, Jev 2,738/180 토큰 |
| L0 재실행 | 라이트·다크·480px 12/12 통과 |

같은 화면의 실제 사례를 calibration으로 쓴 첫 실행도 1회에 같은 셀렉터로 통과했다(Pixie 812/197, Jev 2,910/180). 검증자 컨텍스트에 들어온 것은 L0 요약, 루프 요약 한 줄, 적용 결과뿐이다. probe 1회는 2–4초다. 항목 1개로 확인한 결과이며, 여러 항목·복잡한 화면에서의 통과율은 아직 측정하지 않았다.

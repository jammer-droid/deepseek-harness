# Studio 0.6.1 E3·E4 재실행 지침

[0.6.1 E2E 절차](release-0.6.1-e2e.md)의 E3(문서 사실 검증)와 E4(한국어 문체 교정)만 다시 실행한다. 명세·판정 기준은 기준 절차를 그대로 따르고, 이 문서는 바뀐 대상과 경로만 정한다.

## 전제

- 대상 커밋: `25128406f2` 이후 HEAD. 첫 실행(`39b485f4a2`) 뒤 E3 발견 A·B 수정, E2 후보 반영이 `8d2bfaf793`에 들어갔다.
- 도구 `pixie_loop`이 있어야 한다. 없으면 두 단계 모두 `환경 차단`으로 적고 멈춘다. `judge`·번역 스킬로 대신하지 않는다.
- Pixie 모델은 `deepseek-flash`로 바뀌었다. 첫 E4는 이전 제공자(OpenCode 무료 티어)의 403으로 전부 error였다.
- 쓰는 위치는 `studio/dist/e2e/0.6.1/r2/` 하나다. tracked 파일·사용자 프로필은 바꾸지 않고 커밋하지 않는다.
- 항목이 Pixie 모델 제공자와 TypeSafe Jev로 전송된다는 것을 시작 전에 사용자에게 한 줄로 알린다.

## 0. 시작 확인

```sh
git status --short          # studio/scripts/agents/ 아래 변경 말고 없어야 한다
git log --oneline -3
```

`E3_TARGET=$(git rev-parse --short HEAD)`를 기록한다. 이후 줄 번호는 이 커밋 기준이다.

## E3. 문서 사실 검증

1. **항목:** `studio/dist/e2e/0.6.1/build-facts.mjs`를 `r2/build-facts.mjs`로 복사하고 `TARGET`을 `E3_TARGET`으로, 출력 경로를 `r2/facts-items.jsonl`로 바꿔 실행한다.
2. **근거(`shared`):** 기준 절차 E3.2의 원문을 요약 없이 붙인다. 이번에는 아래 둘을 더한다.
   - `studio/dist/e2e/0.6.1/r2/e5-rerun.md` (반영 커밋의 rc.2 설치·RPC 결과)
   - npm 공개 이력: `npm view @matamt-dbg/dsh-studio versions --json`과 `gh release view v0.6.0 -R matamt-dbg/dsh-studio --json tagName,publishedAt` 출력
3. **실행:** 기준 절차 E3.3 명세를 그대로 `pixie_loop`에 넘긴다(`output`: `studio/dist/e2e/0.6.1/r2/facts-done.jsonl`, `run_in_background: true`).
4. **인용 재확인:** 결과의 모든 `quote`가 2번 원문에 있는지 스크립트로 대조한다(첫 실행의 `build-e3.mjs` 참고). 없는 인용이 있는 통과 항목은 `인용 불일치`로 강등한다.
5. **이전 발견 확인:** 첫 실행의 A(rc.2 역할 자식 과장 8곳), B(npm 이력 4곳)가 사라졌는지 `e3.md`와 비교해 항목별로 적는다.

**완료 기준:** `r2/e3.md`에 항목별 `supported / no_claims / 발견`, A·B 해소 여부가 있다.

## E4. 한국어 문체 교정

1. **항목:** `r2/ko-polish.jsonl`(40항목)이 이미 있다. `E3_TARGET`이 `25128406f2`가 아니면 `node studio/dist/e2e/0.6.1/r2/build-polish.mjs`로 다시 만든다(`studio/`에서 실행).
2. **실행:** [완료·배포 절차](../../docs/release-workflow.md) "4. 한국어 문체 교정"의 명세를 경로만 바꿔 쓴다.
   - `items.path` → `studio/dist/e2e/0.6.1/r2/ko-polish.jsonl`
   - `output` → `studio/dist/e2e/0.6.1/r2/ko-polish-done.jsonl`
3. **반영하지 않는다.** 입력과 출력이 다른 항목만 `r2/ko-polish-diff.md`에 `파일:줄 / 원문 / 교정안`으로 적는다. 같은 절차의 거름 규칙(목록·제목 기호 손실, 용어 변경, 명사구를 문장으로 바꿈)에 걸린 교정안에는 표시를 단다.
4. `errors`가 403 같은 제공자 차단이면 재시도하지 말고 `환경 차단`으로 적는다. 일시 오류면 그 id만 한 번 다시 실행한다.

**완료 기준:** `r2/ko-polish-diff.md`와 통과·escalated·error 수가 있다.

## 보고

```markdown
## 0.6.1 E3·E4 재실행 결과

- E3_TARGET / Pixie 모델 / job id / 토큰
| 단계 | 판정 | 근거 |
| --- | --- | --- |
| E3 사실 검증 | … | 발견 n, A·B 해소 여부 |
| E4 문체 교정 | … | 교정안 n / 거른 것 n |
- 결정 필요:
```

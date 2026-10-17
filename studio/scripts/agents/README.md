# 에이전트 E2E 검증 지침

이 디렉터리에는 에이전트가 새 세션에서 받아 실행하는 검증 지침을 둔다. 사용자가 "`<파일>`을 읽고 진행해"라고 지시하면 에이전트는 그 문서만으로 검증을 끝내고 보고한다. 이전 대화는 필요 없다.

## 이름과 위치

- 이슈 검증: `<이슈 번호>-<주제>-e2e.md` (예: `31-pixie-loop-e2e.md`)
- 이슈 없는 배포 검증: `release-<버전>-e2e.md`
- 산출물: `studio/dist/e2e/<이슈 번호 또는 버전>/`(Git 제외). 결론으로 남길 기록은 메인 세션이 `studio/docs/verification/`에 옮긴다.

## 지침서에 들어갈 것

1. **범위:** 쓰는 위치, 바꾸지 않을 파일·프로필, 외부로 전송되는 내용. 검증자는 제품을 고치지 않고 후보와 기록만 남긴다.
2. **시작 확인:** 대상 커밋·런타임 버전, 필요한 도구, 단계별 실행 조건. 조건이 안 되면 그 단계는 `대기`로 남긴다.
3. **단계:** 각 단계의 명령, 기준선(알려진 기대값), 완료 기준. 결과가 정해진 검사는 스크립트로, 같은 기준으로 판정할 항목이 여럿이면 `pixie_loop`으로 한다. 명세의 판정 질문과 calibration은 실제 데이터로 정한다.
4. **보고 양식:** `통과 / 실패 / 발견 / 대기 / 미실행 / 환경 차단`. workspace 테스트, 설치 검증, 실제 모델 실행은 서로 대신하지 않는다.

이미 다른 문서에 있는 절차(배포 절차의 문체 교정, 개발 문서의 matrix 검증)는 옮겨 적지 않고 링크한다.

## 목록

| 문서 | 대상 |
| --- | --- |
| [release-0.6.1-e2e.md](release-0.6.1-e2e.md) | Studio 0.6.1 (DSH 0.2.1-rc.1·rc.2 호환) 배포 검증 |
| [dsh-rc1-compat-check.md](dsh-rc1-compat-check.md) | rc.1 역할 persona·Tool Filter·자식 정책 복원 |
| [jev-decision-engine-check.md](jev-decision-engine-check.md) | #27 Jev 결정 엔진 실사용 |
| [subagent-tool-filter-check.md](subagent-tool-filter-check.md) | 서브에이전트 Tool Filter |
| [dsh-ko-sequential.md](dsh-ko-sequential.md) | #30 한국어 번역 진행(검증이 아닌 작업 지침) |

이 규칙 전에 만든 문서는 이름이 다르다. 새로 고칠 때 이름을 바꾸지 않아도 된다.

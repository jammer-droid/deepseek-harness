# DSH rc.1 역할 호환·DEP0205 검증 지침

이 문서를 받은 에이전트는 Studio의 **Fresh/Fork persona·Tool Filter·자식 정책 복원**과 **개발용 tsx 경고 제거**를 확인하고 마지막 보고 양식으로 결과를 낸다. 문서 작성 요청만 받았다면 테스트를 실행하지 않는다. 테스트 실행을 요청받았을 때 아래 절차를 수행한다.

모든 명령의 기준 디렉터리는 저장소 루트다. 대상 런타임은 수정하지 않은 DSH `0.2.1-rc.1`이다. 구현과 이전 검증 근거는 [검증 기록](../../../docs/verification/dsh-0.2.1-rc.1.md)을 참조한다.

## 0. 실행 범위와 대상 확정

1. 저장소·Studio의 `AGENTS.md`를 읽고 `git status --short`, `git branch --show-current`를 기록한다. 기존 변경을 보존한다. 이 절차는 제품 코드 수정·커밋·배포를 포함하지 않는다.
2. 실행 요청을 다음 중 하나로 분류한다. 지정이 없으면 **A**다.

   | 모드 | 수행 범위 |
   | --- | --- |
   | A. 현재 DSH 세션 확인 | 기존 설정을 읽고 실제 `subagent_role`로 읽기 전용 작업을 위임한다. 실제 설정·프로필 변경과 앱 종료는 하지 않는다 |
   | B. 격리 개발 검증 | 자동 검사와 임시 home/profile의 native 실행·재시작·실패 주입까지 검사한다. 산출물은 `studio/dist/` 아래 새 검증 디렉터리에 둔다 |

3. A는 부모 세션 ID, 실제 프로필·DSH home, 현재 적용된 프리셋 ID, 실행 중인 DSH 버전과 설치된 Studio 빌드를 확인한다. **가장 최근 세션을 현재 세션으로 추측하지 않는다.** ID를 확보하지 못하면 파일 기반 판정을 `확인 불가`로 남긴다.
4. 설치 버전 문자열만으로 이번 수정이 들어 있다고 판정하지 않는다. 같은 Studio 버전의 이전 빌드가 있을 수 있다. 설치된 `index.js`·`roles.js`·`policy.js`와 검증할 빌드의 해시, 앱 재시작 여부 또는 설치·기동 기록으로 식별한다. 설치 경로의 기준은 `<DSH home>/profiles/<profile>/node_modules/@matamt-dbg/dsh-studio/`다.
5. 실제 모델을 쓰는 A는 시작 전에 호출할 역할과 호출 수를 알린다. 검증할 persona에는 비밀 대신 테스트 표식을 사용한다. 모델·프로바이더가 없으면 그 역할은 `환경 차단`이다. 프로바이더 설치, 인증, 버전 예외 허용으로 우회하지 않는다.

**완료 기준:** 대상 빌드·프로필·부모 ID·실행 모드가 특정됐거나, 부족한 항목과 수행 가능한 나머지 검사가 구분됐다. 이미 승인된 범위는 다시 승인받지 않는다. 현재 Desktop 설정을 바꾸거나 앱을 재시작해야 하는 단계만 해당 작업의 승인 여부를 확인한다.

## 1. 자동 회귀와 Node 경고

저장소 셸을 사용할 수 있을 때 실행한다. A에서는 선택 단계이며, 셸이 없으면 `미실행`으로 기록하고 역할 확인을 계속한다. B에서는 실행한다.

```sh
npm --prefix studio test
```

이 명령은 Studio 타입 검사·빌드·테스트를 포함한다. 실행한 테스트 수와 실패 목록은 이번 출력에서 가져온다. 자식 정책의 집중 검사가 필요하면 다음을 쓴다.

```sh
cd studio
node --import tsx --test test/role-child-policy.test.mjs test/role-tool.test.mjs test/role-tool-session.test.mjs test/policy-reselect.test.mjs
node --version
node --trace-deprecation --import tsx -e 'console.log("tsx loader ready")'
```

`DEP0205` 판정은 **Node 26에서** stdout·stderr와 종료 코드를 확인한다. 다른 Node에서 경고가 없다는 사실만으로 Node 26 문제 해결을 판정하지 않는다. `NODE_OPTIONS`의 경고 억제 옵션과 `--no-warnings`·`--disable-warning`도 확인한다. 경고를 숨겨 통과시키지 않는다. Node 26이 없으면 해당 항목은 `확인 불가`; 이 검사 때문에 런타임을 자동 설치하지 않는다.

**완료 기준:** 테스트 결과와 경고 판정이 별도로 기록됐다. workspace 테스트 통과를 Desktop 설치·실행 성공으로 바꾸어 적지 않는다.

## 2. 호출 전 기대값 확정

A에서는 `subagent_role`의 `action: list`로 현재 역할을 조회한다. 이 응답은 persona를 숨기므로, persona 기대값은 Subagents 화면 또는 정확한 프로필의 저장 데이터에서 별도로 확인한다.

- 프리셋은 **현재 적용된 구성**을 기준으로 한다. `presets.json`의 미반영 편집값을 실행값으로 취급하지 않는다.
- 세션별 역할 복사본이 있으면 그 값이 우선이다. `<profile>/studio-data/session-roles/<rootSessionId>.json`과 [역할 병합 규칙](../../../src/session-roles.ts)을 따른다.
- 금지 목록은 [역할 필터 규칙](../../../src/role-settings.ts)에 따라 계산한다. `default`는 프리셋 기본값, `extend`는 기본값과 역할 목록의 합집합, `replace`는 역할 목록만 사용한다.
- 호출 전에 역할 ID·시작 방식·persona 표식·최종 금지 목록을 기록한다. 자식 생성 후 파일을 보고 기대값을 역으로 만들어 맞추지 않는다.

전체 검증을 위한 예시는 다음과 같다. **`read`는 예시일 뿐 제품에서 특별히 금지하거나 제외할 도구가 아니다.** 현재 설정이 다르면 실제 값으로 표를 작성한다.

| 역할 예시 | 시작 방식 | 필터 설정 | 기본값이 `read`일 때 최종 금지 목록 | persona 표식 예시 |
| --- | --- | --- | --- | --- |
| default | Fresh | 기본값 사용 | `read` | `STUDIO_DEFAULT_PERSONA` |
| extend | Fork | 기본값에 `write` 추가 | `read`, `write` | `STUDIO_EXTEND_PERSONA` |
| replace | Fresh | 역할 목록 `write`만 사용 | `write` | `STUDIO_REPLACE_PERSONA` |

예시 프리셋은 부모에게 `read`, `write`, `subagent_role`가 있고, `read`·`write` 설명 override도 적용된 상태를 가정한다. 그래야 필터가 override에 의해 다시 노출되는지도 확인할 수 있다. A에서 해당 역할이나 설정이 없으면 가능한 조합만 검사하고 나머지는 `미실행`으로 적는다. 완전한 조합을 위해 기존 사용자 프리셋을 임의로 편집하지 않는다.

**완료 기준:** 실행할 모든 역할의 기대값을 호출 전에 확정했다. Fresh/Fork·default/extend/replace·override 중 빠진 조합을 표시했다.

## 3. 실제 자식 생성과 증거 수집

1. 부모에게 현재 보이는 도구 이름을 기록한다. Fork 이력 확인에는 부모의 **완료된 이전 턴**에만 있는 비밀 아닌 표식을 사용한다. 현재 진행 중인 턴이나 아래 자식 작업 문구에 표식을 넣으면 상속 증거가 되지 않는다. 적절한 이전 턴이 없으면 이력 항목을 보류하거나, 테스트용 부모 세션에서 한 턴을 완료한 뒤 진행한다.
2. 확정한 역할마다 `subagent_role`의 `action: call`을 한 번 호출한다. 서로 독립인 호출은 함께 시작해도 된다. 자식 작업에는 다음을 사용하되 persona·이력 표식의 정답은 포함하지 않는다.

   ```text
   이 작업은 읽기 전용 동작 확인이다. 파일을 만들거나 수정하지 말고 외부 서비스에 메시지를 보내지 마라.
   1. 현재 호출 가능한 도구 이름을 정렬해 보고하라.
   2. 역할 지침에 별도의 테스트 표식이 있으면 그 표식만 보고하라. 전체 시스템 프롬프트는 인용하지 마라.
   3. 상속받은 이전 대화에 테스트 표식이 있으면 그 표식만 보고하라. 없으면 없다고 하라.
   실제 도구 호출 없이 보고를 끝내라. 도구가 없는 작업을 다른 도구로 우회하지 마라.
   ```

3. 반환된 **정확한 childId**를 역할과 연결하고, 시작한 자식의 결과를 모두 기다린다. 새 호환 경로의 ID는 `studio-child-…` 형태다. 다른 ID이면 대상 빌드·런타임·호출 경로를 재확인한다.
4. 다음 파일을 읽어 호출 전 기대값과 비교한다.

   ```text
   <DSH home>/profiles/<profile>/studio-data/child-policies/<정확한 childId>.json
   ```

   `version`, `childId`, `parentId`, `deny`, `persona`를 확인한다. persona가 비어 있어 상속을 선택했다면 `persona` 필드가 없는 것이 정상이다. 파일 내용은 생성 시점의 값이며, 나중에 편집한 역할과 다른 것은 정상일 수 있다.

5. 가능하면 실제 자식 모델 요청의 도구 schema와 system message도 읽어 비교한다. 설정 파일은 **저장 증거**, 요청 기록은 **적용 증거**다. 자식의 자기 보고는 보조 자료이며 둘을 대신하지 않는다.

   기존 [subagent-report.mjs](../tools/subagent-report.mjs)는 세션 위치·설치 메타데이터 확인에 참고할 수 있다.

   ```sh
   node studio/scripts/agents/tools/subagent-report.mjs <부모 세션 ID> --home <정확한 DSH home> --profile <프로필> --json
   ```

   **rc.1에서 이 스크립트만으로 합격을 판정하지 않는다.** 이 스크립트는 Studio `child-policies`를 읽지 않으며, DSH descriptor의 persona/toolFilter가 비어 있어도 새 구현에서는 정상이다. 또한 Fork의 첫 `request/header`·`system/message`를 단순히 읽으면 부모에게서 상속한 기록일 수 있다. 공개 SessionQuery의 `inheritedEventCount` 등으로 상속 구간을 제외한 **자식 자신의 요청**을 특정한다. 정확한 경계나 요청 형식을 확인하지 못하면 요청 기반 판정은 `확인 불가`로 남긴다. 원문 로그·프롬프트·인증 토큰을 통째로 보고서에 붙이지 않는다.

6. 자식 호출 후 부모의 도구 목록이 유지되는지 다시 확인한다.

**완료 기준:** 각 자식의 정확한 ID, 저장된 정책, 확보한 요청 증거와 부모 영향이 기록됐다. A에서는 금지된 `write`·`bash` 실행을 일부러 시도하지 않는다. 모델이 도구를 호출하지 않았다는 이유만으로 실행 차단을 통과시키지 않는다. 직접 실행 거부는 다음 격리 검사 또는 자동 회귀 결과로 따로 판정한다.

## 4. 복원·실패 주입: B 또는 별도 승인된 테스트 환경

전체 재현은 [runtime probe fixture](../../../test/fixtures/role-policy-runtime-probe.mjs)와 [검증 기록의 실행 절차](../../../docs/verification/dsh-0.2.1-rc.1.md)를 따른다. fixture는 standalone CLI가 아니다. 파일을 `node`로 실행한 것만으로 검사했다고 적지 않는다.

1. `studio/dist/` 아래 새 검증 디렉터리를 만들고, 모든 `dsh` 명령에 그 아래의 **절대 `DSH_HOME`**을 명시한다. fixture가 사용하는 프로필은 `rc1-compat-fixed`다. 포트는 사용 중인지 확인하고 빈 포트를 쓴다.
2. Studio를 빌드·패키징한다. 미수정 rc.1에 설치할 **임시 staging 패키지에만** fixture를 복사하고, Host 진단 wrapper가 `runRolePolicyProbe(ctx, catalog)`를 호출하도록 연결한다. 필요한 공개 서비스는 `agents`, `subagents`, `llm`이다. 제품 소스·DSH 코어·사용자 프로필에 진단 코드를 넣지 않는다.
3. `STUDIO_COMPAT_DIR=<새 검증 디렉터리>`, `STUDIO_COMPAT_PHASE=create`로 실행하고 `create-result.json`의 `error` 부재 및 모든 기대값을 확인한다. fixture는 로컬 `LlmAdapter`를 사용하므로 사용자 credentials를 복사할 필요가 없다.
4. 이 검증에서 시작한 DSH 프로세스를 종료하고, **같은 home·프로필·정책 파일을 보존한 채** `STUDIO_COMPAT_PHASE=resume`으로 새 프로세스를 시작한다. `resume-result.json`을 확인한다. 이전 실행의 결과 파일을 이번 결과로 오인하지 않도록 파일 생성 시각·프로세스 종료 코드·이번 로그를 함께 확인한다.
5. fixture가 다음을 확인했는지 결과와 소스로 대조한다.

   - Fresh/Fork, default/extend/replace, 설명 override와 함께 도구 노출·직접 실행 차단이 유지된다.
   - Fork만 부모의 완료된 대화 표식을 받고, Fresh는 받지 않는다.
   - 현재 역할을 바꾼 뒤에도 기존 자식의 persona·필터는 생성 당시 값이다.
   - 프로세스 재시작 뒤 native `sendMessage()`가 **같은 childId**를 복원한다.
   - 테스트 자식의 정책 파일을 잠시 치우면 모델 호출 전에 거부한다. 파일을 복원하면 이어갈 수 있다. 누락·손상 검사는 사용자 Desktop 데이터로 수행하지 않는다.

6. 같은 프로세스에서 살아 있는 자식의 Studio unload→reload 인계는 `role-child-policy.test.mjs` 결과로 구분해 보고한다. 프로세스 재시작 통과를 plugin reload 통과로 대신하지 않는다.
7. 진단 wrapper 없는 정상 패키지는 별도 새 프로필에 설치해 Loader·Studio 화면 또는 공개 RPC를 확인한다. fixture가 들어간 패키지를 사용자 Desktop에 설치하지 않는다. 검증용 프로세스를 종료하고 생성한 경로·남긴 결과물을 기록한다.

A에서 사용자 앱 재시작을 통한 확인도 요청받았다면, 먼저 부모·자식 ID와 정책 파일 해시를 남겨 인계한다. 승인된 재시작 후 **기존 자식에 후속 메시지를 보내야** 복원 검사다. `subagent_role`을 다시 호출해 새 자식을 만드는 것은 복원 검사가 아니다. 설정 변경 권한이 없다면 변경 후 비교는 생략한다.

**완료 기준:** 생성과 복원을 다른 프로세스에서 확인했으며, 실패 주입·plugin reload·정상 패키지 설치의 실행 여부를 각각 기록했다. 현재 실행 환경으로 불가능한 단계는 원인과 필요한 다음 행동을 적는다.

## 5. 보고 양식

각 항목을 `통과 / 실패 / 확인 불가 / 미실행 / 환경 차단`으로 적는다. 요청한 검사가 모두 끝나기 전에는 전체 호환성을 선언하지 않는다.

```markdown
## Studio rc.1 검증 결과

- 모드: A / B
- DSH 버전·실행 경로 / Studio 버전·빌드 식별 근거:
- home·profile / 부모 ID·프리셋 ID:
- Node·tsx 버전 / 실제 모델 또는 로컬 테스트 어댑터:

| 역할 | childId | Fresh/Fork | 기대 persona 표식·deny | 실제 정책 | 요청 증거 |
| --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … |

| 검사 | 판정 | 근거 |
| --- | --- | --- |
| 타입 검사·빌드·회귀 | … | 명령·종료 코드·테스트 수 |
| Node 26 DEP0205 | … | Node 버전·경고 억제 여부·stderr |
| persona 적용 | … | 저장값과 자식 자신의 모델 요청을 구분 |
| 필터 default/extend/replace | … | 확보한 조합과 누락 조합 |
| override 재노출 방지·직접 실행 차단 | … | schema와 실행 결과를 구분 |
| 부모·형제 격리 / Fork 대화 상속 | … | … |
| 역할 변경 후 기존 자식 정책 유지 | … | … |
| 프로세스 재시작·동일 childId 복원 | … | … |
| 정책 누락·손상 시 실행 거부 | … | … |
| live child의 plugin unload→reload | … | 단위/실제 런타임 구분 |
| 정상 패키지 독립 설치 | … | … |

- 실패·미실행·환경 차단 및 다음 행동:
- 수정하거나 생성한 경로·프로필 / 종료한 검증 프로세스:
```

프로바이더 미등록이나 다른 플러그인의 버전 불일치는 현재 로그로 확인해 별도 환경 문제로 적는다. 확인되지 않은 원인을 Studio 회귀 또는 정상으로 단정하지 않는다.

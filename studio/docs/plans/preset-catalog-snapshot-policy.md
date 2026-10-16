# DSH 기본 동작을 보존하는 프리셋 덮어쓰기 — #26 이후 구현 계획

- 계획 준비 상태: **draft**. S0에서 도구 정책 결정은 닫았다([16절](#16-s0-기록--26-이후-기준과-도구-정책-결정)). 13절의 저장 형식·스냅샷 결정은 S1·S3 착수 시 닫는다.
- 구현 상태: P1·P2, S0, S1, S2, S3, S4a, S5 구현 완료(로컬 테스트). own-scope 차단 해소는 사용자가 설치 앱에서 확인했다. 남은 단계는 **S6**(독립 설치 검증)이다. 이 문서는 구현·배포 승인이 아니다([17절](#17-s1s5-구현-기록)).

## 상태와 재개 위치

- 상태: 대화에서 합의한 제품 방향 기록. **미구현이며 구현 검증 완료를 의미하지 않는다.**
- 착수 시점: **현재 진행 중인 26 Pixie Gate 작업을 마친 뒤** 사용자 승인으로 재개한다. 번호 26은 현재 로컬 작업 식별자이며 트래커 등록을 의미하지 않는다. 진행 중인 구현을 이 계획에 맞춰 선제 수정하지 않는다.
- 재개 기준: #26 완료·통합 결과와 남은 제한을 확인하고, 승인된 최신 기준 커밋·Studio 버전·지원 DSH 버전을 S0에서 기록한다. 과거 catalog-scope 코드를 그대로 구현 기준으로 삼거나 자동 병합하지 않는다.
- 브랜치: `studio/research/catalog-scope`.
- 워크트리: `/Users/home/playground/vibecoding/deepseek-harness-catalog-scope`.
- 조사 당시 기준 커밋: `01c454732a`. 다른 작업이 진행 중이므로 재개 시 최신 Studio와 차이를 확인한다.
- 선행 근거: [기본 tool·Config 카탈로그와 Master 생성·갱신 조사](<../research/catalog-master-lifecycle.md>).
- 변경 범위: Studio만. DSH 코어·사용자 앱·프로필을 임의로 수정하거나 비공개 런타임 구조에 의존하지 않는다.

## 1. 문제와 목표

예약 플러그인을 활성화했을 때 도구가 보이지만 Studio 허용 정책이 호출을 거부했고, 이후 Agent own-scope 도구를 지원하지 않는다는 정책 설치 오류가 발생하여 일반 도구 호출까지 막혔다. 플러그인을 끄자 일반 도구 실행은 복구됐다.

관측한 오류 전문은 다음과 같다. 이 상태에서 `skill`과 `bash` 호출이 실패했고, 플러그인을 끈 뒤 `bash`와 `glob` 호출이 성공했다.

```text
Studio preset policy could not be installed:
Studio policy does not support own-scope tools:
schedule_create, schedule_list, schedule_delete, schedule_update;
register providers in an ancestor preset scope.
Public API cannot hide late own-scope schemas;
dynamic own-scope providers are unsupported
```

차단 원인 도구는 위 네 개로 확인됐다. 미확인 사항은 이 도구들이 Agent own-scope에 등록된 경로다. 로컬 소스에서 `tool-schedule`은 `standard`·`ptc`·`cordis` 프리셋에만 선언되며 Studio Master에는 제공자 행이 없다. 프리셋은 Agent의 상위 스코프에 마운트되므로 정상 경로의 프리셋 선언은 Agent에서 상속 도구로 보인다. S0에서 플러그인 ON 상태의 레이어별 도구 등록과 해당 프리셋 선언 원문을 확인한다.

Studio는 YAML을 직접 편집하지 않고 프리셋의 기능·도구·설정을 편집하고 등록하는 역할을 계속 담당한다. 다만 DSH의 정상적인 동적 도구 등록과 모델 전달을 별도 엄격한 전체 allowlist로 가로막지 않는다.

목표는 다음 두 가지다.

1. 현재 활성 제공자의 정보를 바탕으로 Master와 편집 후보 목록을 갱신한다.
2. 프리셋의 기본 구성·덮어쓰기를 적용하되, 실행 중 도구 추가·제거는 DSH 기본 흐름을 따른다.

## 2. 확정: 실행 정책

이 방향은 대화에서 고정했다. 구현 단계에서 전체 도구 동결이나 엄격한 allowlist 유지 여부를 다시 선택하는 문제로 되돌리지 않는다.

- 세션 시작 시 Studio 프리셋의 기본 도구 구성과 설정 덮어쓰기를 적용한다.
- 이후 외부에서 등록·해제되는 도구의 가용성, 모델 전달 및 실행은 DSH 기본 동작을 따른다.
- 새 도구가 초기 프리셋 선택 목록에 없다는 이유만으로 Studio가 실행을 거절하지 않는다.
- Agent own-scope 등록이 있다는 이유로 정책 설치에 실패하여 모든 호출을 차단하는 현재 처리를 변경한다.
- 프리셋의 선택은 기본 구성을 정하는 것이며, 외부에서 이후 들어오는 모든 도구를 봉쇄하는 전역 보안 allowlist가 아니다. Optimized도 같다.
- 프리셋에서 선택 해제한 도구도 이후 외부 제공자가 등록하여 해당 Agent에서 보이게 되면, Studio는 과거 선택 해제를 이유로 차단하지 않는다. 선택 해제는 기본 구성에서의 제외이며 해당 이름의 영구 deny가 아니다.
- 이 계약을 충족하는 구현 방식(restrict·guard 사용 여부와 형태)은 S0–S2에서 정한다. [Optimized 도구 목록 JSDoc](<../../src/optimized-preset.ts#L5-L12>)의 "추가 도구가 프리셋을 늘리면 안 된다"는 서술은 이 계약과 충돌하므로 S2에서 수정한다.
- DSH의 승인·파일 접근·서브에이전트 제한 등 독립적인 안전 정책을 우회하거나 완화하지 않는다.
- Config 덮어쓰기 적용과 전역 Config 변경 권한은 별개다. 이 작업에서 Config까지 통제하는 새 접근 제어 체계를 만들지 않는다.

단순히 오류 검사만 삭제하는 것으로 완료하지 않는다. 기존 도구 설명·입력 설명·실행 기본값·Config 덮어쓰기와 필요한 역할 동작을 보존하면서 차단 책임을 정리해야 한다.

### 모델 전달은 DSH 책임

플러그인은 도구 이름·설명·입력 스키마를 레지스트리에 등록한다. DSH는 각 스텝에서 보이는 도구를 수집하고 정확한 모델/API 경로의 어댑터가 선언한 `toolUpdate`에 따라 전달한다.

- 기본 경로: 현재 전체 도구 선언을 요청에 전달.
- 지원 경로: 도구 선언과 구조화된 추가·제거 메시지를 조합.
- 스키마 등록과 모델 전달 방식은 별개이며, Studio가 이를 구현하거나 선택하지 않는다.
- 대화 압축 이후의 도구 선언·변경 이력 재구성도 DSH에 맡긴다.
- 새 플러그인의 스키마는 최초 등록 전부터 선언돼 있던 것이 아니다. 동적 전달이 신규 스키마 추가의 캐시 손실을 없앤다고 설명하지 않는다.

근거: [도구 수집과 요청 구성](<../../../packages/core/agent-loop/src/agent.ts#L616-L702>), [업데이트 모드 계약](<../../../packages/llm/llm/src/types.ts#L390-L407>), [요청별 변환](<../../../packages/llm/llm/src/content.ts#L424-L490>).

## 3. 확정: Master와 Optimized

### Master

- 최초 Studio 설치·로드 시, 현재 로드되어 제공 가능한 플러그인의 도구·Config 정보를 수집하여 Master를 구성한다.
- 이후 DSH 재시작 또는 Studio 리로드 때 다시 수집한다.
- 새 제공자는 이 수집 시점에 Master와 편집 후보 목록에 반영한다.
- 단순히 설치된 비활성 패키지까지 실행하거나, 모든 Host 서비스를 Master 안에 복제한다는 뜻은 아니다.
- 도구 이름뿐 아니라 제공자 출처·설정 대상의 식별 정보를 유지해야 한다. 정확한 수집 API와 식별 방식은 구현 전 확인 사항이다.

### Optimized

- 현재 합의한 **22개 도구와 Config 설정 1개**를 템플릿 기준으로 고정한다.
- 신규 플러그인 추가 때문에 Optimized의 기본 선택을 자동 확대하지 않는다.
- 현재 기준은 [Optimized 정의](<../../src/optimized-preset.ts#L13-L41>)의 도구 집합과 `spill-policy.maxInlineTokens = 2500`이다. 기존 설명·실행 기본값 등의 다른 덮어쓰기를 이 문구를 이유로 삭제하지 않는다.
- Master가 갱신되면 공통 편집 후보 목록도 갱신한다. Optimized 자체의 기존 잠금/복사 편집 UX를 이 합의만으로 해제하지 않는다.
- 고정 항목이 일시적으로 사라져도 템플릿 정의를 영구 축소하지 않는다. 현재 가용성/실효 항목과 고정 템플릿을 구분한다. 누락 시 신규 적용의 정확한 오류·경고 처리는 구현 전에 정한다.

### 실행 설정: 기본 전체 반영, 편집값 덮어쓰기, 명시적 제외

프리셋 실행 설정(Config와 압축·프롬프트 provider 등 비도구 실행 기능)은 다음 규칙으로 확정했다. 도구 선택은 이 절이 아니라 앞의 실행 정책과 Optimized 규칙을 따른다.

- **기본:** Master에 수집된 DSH 실행 구성과 각 제공자의 기본값을 전부 반영한다. 선택·편집하지 않은 항목도 포함된다.
- **편집:** 사용자가 편집한 필드만 덮어쓴다. 편집하지 않은 필드는 DSH 기본값을 따른다.
- **제외:** 특정 기능을 빼려면 덮어쓰기와 별개인 명시적 제외 설정을 사용한다. 덮어쓰기 해제는 제외가 아니라 기본값 복귀다.
- 새로 수집된 실행 구성 항목은 제외 설정이 없으므로 기본 반영된다.
- 기존 프리셋 이전: 기존 `providers` 목록에 없던 항목은 제외로 변환하지 않고 기본 반영한다. Optimized 템플릿과 사용자 복사본 모두 같다. 이 결과 기존 Optimized 계열에서 빠져 있던 `agent-instructions`, `time-context`, `skill-filesystem`, `compaction-basic`, `command-compact`, `compaction-tool-result-pruner`가 다음 적용부터 포함된다. 기존 세션에는 자동 재적용하지 않는다.
- 프롬프트에 주는 영향은 편집 화면에서 확인·조정할 수 있어야 한다. `agent-instructions`와 `time-context`는 시스템 프롬프트 섹션이 아니라 `agent/pre-step`에서 세션 메시지로 주입하므로([지침](<../../../packages/context/agent-instructions/src/index.ts#L334-L360>), [시각](<../../../packages/context/time-context/src/index.ts#L185-L200>)) 현재 [프롬프트 미리보기](<../../src/host/prompt-preview.ts>)의 `systemPrompt.assemble()` 결과에는 나타나지 않는다. 표시 방식과 편집 범위(Config 필드 편집, 주입 내용 미리보기)는 S4에서 정한다. 주입 내용은 실행 시점의 파일·시각으로 생성되므로 렌더링된 텍스트를 고정 저장하는 방식으로 편집하지 않는다.

현재 구현은 이와 다르다. 선택한 provider만 포함하고 선택하지 않은 prompt provider를 조합에서 제거한다([조합](<../../src/host/composition-plan.ts#L76>), [provider 제거](<../../src/prompt-composition.ts#L58-L65>)).

### 추가 범위: 압축 등 비도구 실행 기능의 보존

이번 작업에서 **Optimized와 사용자 복사 프리셋의 압축 기능 누락**도 함께 다룬다. 동적 도구 호출 차단과는 직접 원인이 다르므로, 카탈로그 수정의 부수 효과로 해결된다고 가정하지 않고 별도 구현·검증 단위로 둔다.

#### 조사에서 확인한 문제

- 조사한 Optimized Creator 사용자 프리셋은 `providers`에 persona만 선택되어 있었고, 저장된 실행 선언의 압축 그룹은 비어 있었다. 해당 Opus 세션은 압축 이벤트 없이 입력 한도를 초과했다.
- 원인은 Optimized 템플릿 정의다. [Optimized 요청](<../../src/optimized-preset.ts#L29>)은 `providers`에 persona만 지정하고, 조합은 선택하지 않은 prompt provider와 `command-compact`를 제거한다. 그 결과 Optimized 생성 구성에는 Master 선언 중 `agent-instructions`, `time-context`, `skill-filesystem`, `compaction-basic`, `command-compact`, `compaction-tool-result-pruner`가 없고 `compaction` isolate 그룹은 빈 채로 남는다. 이는 도구 정책 차단과 별개인 기존 문제다.
- Master 소스 선언에는 `compaction-basic`, `command-compact`, `compaction-tool-result-pruner`가 있지만, provider 선택·조합 과정에서 제외될 수 있다. 선언에 존재하는 것과 대상 세션에서 활성화되어 있는 것은 별도로 검증해야 한다.
- 같은 사용자 프리셋의 GPT 세션에서도 압축 기록은 없었으나, 당시 모델 한도와 압축 임계값을 넘었는지는 확인하지 않았다. 이를 모델별 압축 장애의 비교 실증으로 사용하지 않는다.

#### 도구 스키마와 구분

- `compaction-basic`은 런타임의 자동 압축 구현이며 모델 호출 도구가 아니다.
- `command-compact`는 사용자의 `/compact` 슬래시 명령이며 모델용 도구 스키마가 아니다.
- `compaction-tool-result-pruner`도 도구 결과를 줄이는 실행 기능이지 모델 호출 도구가 아니다.
- 따라서 도구 목록에 압축 항목이 없는 것은 정상일 수 있다. 도구 스키마의 존재 여부로 압축 가용성을 판정하거나, 표시를 위해 새 모델용 압축 도구를 만드는 방향으로 해결하지 않는다.

#### 후속 구현 방향

1. Master → Optimized → 사용자 복사 프리셋의 비도구 실행 기능에 앞 절의 기본 전체 반영 규칙을 적용한다. 기존 사용자의 명시적인 비활성화와 의도치 않은 누락을 구분하는 기준은 구현 전에 정한다.
2. 위의 **22개 도구와 Config 덮어쓰기 1개**는 비도구 실행 기능 전체의 열거가 아니다. 압축 보존을 이유로 고정 도구 목록을 자동 확대하지 않는다.
3. persona 등 프롬프트 provider 선택만으로 압축 구현이 조용히 제거되지 않도록 조합 경계를 검토한다. 자동 압축과 수동 명령의 의존성·서비스 범위를 함께 검증한다.
4. 편집 화면에서 도구 목록과 별도로 압축 구현의 포함 여부, 자동 압축 ON/OFF, 수동 명령 포함 여부를 확인할 수 있게 한다. 프리셋 선언 상태와 실제 세션의 활성 상태를 혼동하지 않으며, 공개 API로 확인할 수 없는 상태는 미확인으로 표시한다.
5. 기존 저장 프리셋의 누락 탐지와 명시적인 복구·재저장 경로를 마련한다. 카탈로그 갱신만으로 기존 사용자 선택을 일괄 덮어쓰지 않는다. 의도를 판별할 수 없는 기존 데이터는 사용자 확인 없이 활성화하지 않는다.
6. 압축 알고리즘·토큰 판정은 기존 DSH 구현에 맡긴다. Studio는 구성 보존·설정·진단을 담당하며 코어나 비공개 런타임 접근으로 우회하지 않는다.
7. 이미 한도에 도달한 세션의 복구는 별도 운영 조치다. 프리셋 수정이 기존 세션에 자동 적용되거나 즉시 압축을 가능하게 한다고 약속하지 않는다. 아래 기존 세션 정책을 유지한다.

## 4. 확정: 다른 프리셋과 삭제 규칙

Master 갱신 후 프리셋 편집 화면은 최신 관리 가능 도구·Config 목록을 사용한다. 기존 사용자 프리셋 전체를 새 Master 값으로 덮어쓰지 않는다.

| 변화 | 편집 목록 | 저장한 선택·덮어쓰기 |
| --- | --- | --- |
| 항목 추가 | 후보로 추가 | 기존 값 유지. 도구는 기본 선택에 자동 추가하지 않음. 실행 설정 항목은 제외 설정이 없으므로 DSH 기본값으로 반영 |
| 항목 유지 | 계속 표시 | 기존 덮어쓰기 보존 |
| 항목 제거 | 후보에서 제거 | 해당 항목의 선택·관련 덮어쓰기 삭제 |
| 제거 후 재등장 | 신규 후보로 표시 | 과거 삭제된 사용자 덮어쓰기는 복원하지 않음 |
| 스키마 변경 | 최신 정의 사용 | 관련 덮어쓰기 유효성 검사 필요 |

**삭제 규칙은 사용자가 동의했다.** OFF로 제거가 확정되면 해당 사용자 설정은 정리하며, ON 후 자동 복원하는 비활성 보관 모델을 채택하지 않는다. Optimized의 고정 템플릿 정의는 앞 절의 별도 규칙을 따른다.

한 제공자가 사라졌다는 이유로 무관한 Config나 다른 제공자의 같은 이름 도구 설정을 지우지 않도록 출처를 식별해야 한다. 설명·파라미터 덮어쓰기·실행 기본값 등 제거 도구를 참조하는 관련 데이터의 정리 범위를 재개 시 조사한다.

수집 실패·부분 실패·아직 활성화 중인 상태를 정상적인 제거로 판정해서는 안 된다. 완전하고 유효한 수집을 확인하지 못하면 마지막 정상 기준을 보존하고 실패를 알린다.

## 5. 확정: 스냅샷과 변경 안내

실시간 감시 대신 **DSH 재시작 또는 Studio 리로드 시 수집**을 이번 기준으로 한다. ON/OFF 직후 모달이 즉시 뜬다는 약속은 하지 않는다.

1. 최초 정상 수집이면 Master와 기준 스냅샷을 만든다.
2. 저장된 기준이 있다면 이번 정상 수집 결과와 비교한다.
3. 차이가 있으면 모달 또는 팝업으로 추가(`+`)·제거(`-`) 내역을 안내한다.
4. 제거로 정리되는 프리셋 선택·덮어쓰기의 영향도 함께 보여 준다.
5. 정상 반영 완료 후 이번 결과를 다음 비교의 기준으로 저장한다.
6. 같은 변경을 매 재시작마다 반복 안내하지 않는다.

여기서 기준은 영구적인 최초 스냅샷이 아니라 **마지막으로 정상 반영한 스냅샷 하나**다. 스키마 수정 같은 변경(`~`)의 비교·표시, 알림 확인 시점과 저장의 순서, 창이 없는 부팅 때의 알림 보관 방식은 후속 세부 설계로 남긴다. 안내가 별도의 승인 절차인지도 아직 정하지 않았다.

스냅샷은 프로필별로 분리하고, 도구·Config 식별 및 비교에 필요한 메타데이터를 중심으로 구성한다. 자격 증명 등 원문 설정을 불필요하게 복제하거나 변경 안내에 노출하지 않는다.

## 6. 확정: 기존 세션에 대한 의미

“기존 세션은 영향 없음”은 다음처럼 한정한다.

- Studio 편집 목록 갱신과 저장된 프리셋 정리를 기존 세션에 자동 재적용하지 않는다.
- DSH에서 실제 플러그인을 ON/OFF하면 기존 세션의 도구 가용성도 DSH 규칙에 따라 달라질 수 있다.
- 제거된 도구는 다음 모델 요청에서 제거가 반영될 수 있다. 이미 전송된 요청은 이전 목록을 사용했으므로 제거 직후의 호출이 실패할 수 있다.
- 실행 중 도구와 서비스 종료의 상호작용은 해당 제공자의 수명 관리에 따른다.
- 이 실패가 Studio 때문에 무관한 일반 도구의 일괄 차단으로 번져서는 안 된다.
- DSH 전체 재시작 후 과거 세션의 플러그인·도구 버전을 영구 재현하는 보장은 이번 범위가 아니다.

Master 재등록이나 Studio 리로드가 실행 중 세션의 제공자를 불필요하게 해제하지 않는지는 구현 전 확인해야 한다. 편집용 목록 갱신과 실행 등록 해제를 혼동하지 않는다.

## 7. 구현 전에 확인할 사항 — 방향을 뒤집는 재논의가 아니라 구현 제약 확인

1. 공개 API로 현재 제공자의 도구·Config·출처·활성 상태를 얼마나 정확히 수집할 수 있는가?
2. 단순 조회로 얻는 정보와 프리셋에 실제로 포함할 수 있는 구성을 어떻게 연결하는가? 모든 플러그인을 실행하며 탐색하지 않는다.
3. Host 공용 설정과 프리셋 내부에서 덮어쓸 수 있는 설정을 어떻게 구분하는가? 공용 서비스를 프리셋마다 중복 생성하지 않는다.
4. 기존 정책의 제한·guard·도구 래퍼를 정리하면서 설명과 실행 기본값을 어떻게 보존하는가? 같은 이름의 동적 등록과의 충돌도 검사한다.
5. Master 갱신·Studio 리로드 시 기존 세션이 참조하는 실행 등록의 수명은 어떻게 유지되는가?
6. 제거 항목이 사용자 초안·마지막 적용본·역할 필터 등에 남지 않도록 어느 저장 데이터를 정리해야 하는가?
7. Optimized 고정 항목 누락과 Config 스키마 변경 시 신규 적용을 어떻게 진단할 것인가?
8. 스냅샷 저장 형식·버전·비교 식별자·원자적 반영·알림 상태는 어떻게 구성할 것인가?
9. 압축 같은 비도구 실행 기능의 선언·설정·세션 활성 상태를 공개 API로 어디까지 구분할 수 있는가? 프리셋 조합 시 자동 압축 구현과 수동 명령의 의존성·서비스 범위를 어떻게 보존하는가?
10. 기존 프리셋에서 압축 누락과 명시적 비활성화를 어떤 저장 근거로 구분하며, 구분할 수 없을 때 어떤 확인·복구 흐름을 제공하는가?

지원 DSH 공개 API에서 막히면 제한과 대안을 보고한다. 이를 통과시키려고 코어 수정이나 비공개 registry 접근을 추가하지 않는다.

## 8. 후속 구현의 수용 조건

- 기존 일반 도구가 정상인 세션에서 예약 제공자를 켜도 Studio own-scope 오류로 전체 호출이 막히지 않는다.
- 초기 목록에 없던 도구가 등록되면 DSH의 정상 경로로 사용 가능해지고, OFF 시 제거가 반영된다.
- 플러그인 제거 후에도 무관한 도구는 정상 실행된다.
- 재시작/Studio 리로드 후 Master와 편집 후보가 최신 상태를 반영한다.
- Optimized의 고정 선택은 외부 도구 추가로 늘어나지 않는다.
- 유지된 도구·Config의 사용자 덮어쓰기는 보존된다.
- 정상적으로 제거된 항목의 사용자 선택·관련 덮어쓰기는 삭제되고, 재등장 시 복원되지 않는다.
- 부분 수집 실패는 대량 삭제나 새 기준 저장으로 이어지지 않는다.
- 변경 안내는 추가·제거 및 프리셋 정리 영향을 보여 주며 동일 변경을 반복 알리지 않는다.
- Config/알림/스냅샷에 민감한 값이 불필요하게 노출되지 않는다.
- 기존 세션에 편집 변경을 자동 재적용하지 않는다. 리로드에 따른 실행 수명과 재시작 후 재개는 각각 검증한다.
- Master·Optimized·사용자 복사 프리셋에서 압축의 기본 포함 정책이 생성된 실행 선언에 반영된다. persona만 선택한 구성에서도 의도치 않은 압축 누락이 재발하지 않는 회귀 테스트를 둔다.
- 도구 스키마에 압축이 없어도 압축 기능 상태를 별도로 확인할 수 있다. 구현 누락·자동 압축 OFF·자동 압축 ON 및 수동 명령의 포함 여부를 혼동하지 않는다.
- 기존 압축 누락 프리셋은 탐지·복구 안내 대상이 되며, 명시적 비활성화 또는 의도 미확인 데이터를 사용자 확인 없이 활성화하지 않는다.
- 지원 DSH의 실제 세션에서 자동 압축의 `compaction/start → compaction/summary → compaction/end`와 요약의 대화 반영을 검증한다. 수동 `/compact` 경로도 별도로 확인한다. 모델·컨텍스트 한도·임계값·프리셋을 기록하고, 긴 대화를 나눴다는 사실이나 압축 0회만으로 성공·실패를 판단하지 않는다.
- 수정하지 않은 지원 DSH에 Studio만 설치하여 검증한다. 로컬 단위 테스트와 설치 검증 결과를 구분한다.

## 9. 범용 구성 계약 — 압축 전용 예외가 아닌 기본 동작 보존

### 9.1 책임과 적용 순서

Studio는 DSH 위에서 프리셋의 **명시적 차이**를 관리한다. DSH의 승인·보안, 서비스 의존성·격리·수명, 도구의 동적 등록·모델 전달, 압축 실행을 재구현하지 않는다.

```text
DSH Host에서 제공되는 공용 기능 (복제하지 않음)
  + 승인된 기준 프리셋의 기본 실행 구성
  + 명시적인 프리셋 기능 구성 변경
  + 해당 프리셋이 소유하는 Config 덮어쓰기
  + 도구 설명·파라미터 설명·실행 기본값 등 명시적 덮어쓰기
  → 검증된 실행 구성 등록
  → 각 세션의 실행은 DSH 기본 흐름 사용
```

- **미설정/덮어쓰기 체크 해제:** 해당 override만 제거하고 기준 구성으로 돌아간다. 기능 제거 또는 `false`로 해석하지 않는다.
- **명시적 값:** `false`, `0`, 빈 문자열 등 스키마가 허용하는 값은 저장된 의도로 존중한다. truthy 검사로 상속 처리하지 않는다.
- **기능 비활성화:** Config 덮어쓰기 여부와 별개의 의도다. 제공자가 지원하는 설정 또는 명시적 제외 설정으로만 표현한다. `auto: false`와 압축 구현 제외는 같은 상태가 아니다.
- **기준값:** Host 설정, 기준 프리셋의 선언값, 제공자의 스키마/런타임 기본값을 구분한다. 프리셋 내부에 선언된 값은 유지하며, 선언되지 않은 값의 기본 적용은 제공자에게 맡긴다. 표시용 기본값을 모두 override로 저장하지 않는다.
- **병합:** 중첩 객체는 변경한 필드만 병합하고 배열·스칼라·허용된 null은 교체한다. override 제거는 저장 키 제거로 표현하며 null을 삭제 표식으로 쓰지 않는다. 제공자 스키마와 충돌하면 적용 전에 진단한다.
- **기본 도구 선택:** Optimized의 고정 선택은 유지한다. 도구를 제외하기 위해 공유 제공자나 비도구 기능까지 통째로 제거하지 않는다. 공개 API로 선택적 구성이 불가능하면 제한을 표시하고 기능을 몰래 제거하지 않는다.
- **외부 도구:** 초기 선택에 없던 외부 동적 도구를 봉쇄하는 전역 allowlist는 만들지 않는다. 이는 Optimized의 저장된 기본 도구 선택을 자동 확대한다는 뜻이 아니다.
- **기준 갱신:** 정상 수집된 후보 목록과 명시적 실행 구성을 구별한다. 신규 제공자를 발견했다는 이유만으로 기존 사용자 프리셋에 채택하거나 기존 세션을 재구성하지 않는다.

### 9.2 조회와 채택의 경계

카탈로그는 가용 정보를 보여 주는 읽기 모델이며, Master 실행 구성의 무조건적인 복제 원본이 아니다. 설정은 `Host 공용`, `프리셋 소유`, `소유권 미확인`으로 구분하고 Host 공용·미확인 설정을 프리셋 override로 편집하지 않는다. 출처·수명·의존성이 확인된 제공자만 프리셋 구성에 채택한다.

공개 `ToolSchema`에는 제공자 식별 정보가 없다. 알려진 구성의 출처는 Studio가 보존할 수 있으나 임의 외부 도구의 정확한 소유자를 이름만으로 추정하지 않는다. 출처가 불명확하거나 충돌한 항목은 진단 대상으로 남기고, 무관한 제공자의 설정 삭제·복제를 수행하지 않는다. 확실히 식별된 항목의 제거에는 4절의 삭제 정책을 적용한다.

### 9.3 UI와 저장 의도

- 실행 설정 체크박스는 **Config 덮어쓰기 편집**만 의미한다. 체크 해제는 플러그인 OFF가 아니다. 현재 UI의 "선택한 것 중 편집한 것을 덮어쓴다" 설명은 기본 전체 반영 규칙에 맞게 바꾼다.
- 실행 설정 항목은 **기본값 사용 / 덮어쓰기 / 제외** 세 상태를 구분해 표시한다.
- 기능 포함 여부, 자동 실행 설정, 수동 명령 가용성, 설정 덮어쓰기 여부를 구분한다. 스키마를 편집할 수 없다는 이유로 기능을 비활성으로 표시하지 않는다.
- 선언된 상태와 실제 세션에서 관측한 상태를 따로 표시한다. 확인 불가능한 상태는 미확인으로 남긴다.
- 새 저장 형식에는 기준/형식 버전과 명시적인 변경 의도를 남긴다. 정확한 필드·타입·파일명은 S0–S1에서 최신 저장 구조와 맞춘다.
- 기존 `providers` 누락을 기능 비활성화 의도로 자동 변환하지 않는다. 과거 의도 확인이 불가능하면 영향 미리보기와 사용자 확인을 거친다.

## 10. 공개 DSH 계약과 지원 경계

아래는 조사 시점의 Host Inspect 계약 및 로컬 소스에 근거한 후보이며, 대상 버전의 실제 동작 검증 완료를 의미하지 않는다. Inspect는 개발용 읽기 도구다. 제품 코드가 Inspect를 business Service처럼 호출하는 설계를 하지 않는다.

| 목적 | 공개 계약 후보 | 주의점 |
| --- | --- | --- |
| 유효 도구 목록 | `tools.schemas(scope)`, `get(name, scope)` | scope별 effective view이며 제공자 출처 manifest가 아님 |
| 프리셋 구성·진단 | `agentPresets.readDocument`, `compositionInventory`, `list/resolve` | 선언·활성 상태·실제 세션 상태를 구분 |
| 프리셋 등록·조회 수명 | `register`, `acquireScope` 및 disposer | 등록은 활성화를 수반하며 무부작용 탐색이 아님; 동일 ID 교체·실패 복구는 별도 설계 |
| 세션의 격리 서비스 | `agentPresets.serviceFor(agent, name)` | 최신 프리셋 목록이 아닌 실제 세션을 대상으로 조회 |
| 수동 명령 | `commands.list/find` | 도구 스키마와 별개; 압축은 `compact` 명령으로 확인 |
| 자동 압축 | 기본 압축 구현의 `auto` 및 정책 Config | 추상 compaction 서비스에 범용 자동 실행 상태 조회 계약이 있다고 가정하지 않음 |
| 수동 압축 | `compaction.compactNow` 및 명령 실행 계약 | idle/busy·안전한 범위·취소 등의 DSH 제약 준수 |
| 프로필 설정·스키마 | `configEditor.entries/configuration`, 공개 Loader entry·모듈 Config | 읽기 가능성이 전역 수정 권한을 뜻하지 않음; 미활성 모듈을 탐색 목적으로 실행하지 않음 |
| 준비 상태 | `loader.await()`와 각 entry의 상태 | 정착은 성공이 아님; 자기 activation 안에서 대기해 순환하지 않음 |
| 저장 | 지원 DSH storage 또는 기존 Studio의 프로필별 저장 경계 | 스냅샷·프리셋·알림 전체의 원자적 반영은 자동 보장되지 않음 |

프리셋 revision 유지 기반은 있으나 Studio 리로드의 전체 수명 보장을 대신하지 않는다. 실행 중 세션의 임의 재구성은 범위 밖이다. 범용 제공자 자동 복제, 모든 scope의 완전한 출처 열거, 과거 사용자 의도 복구를 지원 API 없이 약속하지 않는다.

## 11. 의존 순서별 구현 단계

현재 진행: **S0–S5 완료 / S6 남음**([16절](#16-s0-기록--26-이후-기준과-도구-정책-결정), [17절](#17-s1s5-구현-기록)). 단, S2의 "프롬프트 provider 선택에 따른 비도구 기능 일괄 제거 제거"와 S5의 Optimized 템플릿 재정렬 일부는 [15절](#15-선행-처리-압축-누락-긴급-수정)에서 먼저 처리했다. 해당 단계 착수 시 15절 결과를 기준으로 남은 범위만 진행한다. 단계 ID는 코드가 바뀌어도 유지하며 파일·함수명은 착수 시 다시 매핑한다. 선행 단계의 검증을 통과한 후 다음 단계로 진행한다.

### S0 — #26 이후 기준 재확인과 지원 경계 확정

- 선행: #26 Pixie Gate 작업 종료 및 승인된 통합 기준 확보.
- 결과: 최신 구성·저장·도구 정책·게이트 연결·역할 필터의 책임 지도, 대상 DSH/Studio 버전, 공개 API 확인표.
- 작업: 현재 계획과 #26 최종 구현의 차이를 기록한다. 게이트의 사용자 지정 판정/차단과 잘못된 전체 allowlist를 구분한다. 이 계획을 이유로 정상 게이트나 안전 제한을 제거하지 않는다.
- 수용/검증: 지원 런타임에서 필요한 공개 계약 존재를 확인하고, 비공개 접근 없이 가능한 범위를 확정한다. 아래 미결정 사항을 정리한 후 ready로 전환한다. 지원 불가 항목은 제한·대안을 명시하며 코어 변경으로 우회하지 않는다.

### S1 — 명시적 변경 의도와 기본 구성의 계약

- 선행: S0.
- 결과: 기본 구성, 기능 구성 변경, Config override, 도구 편집 데이터가 분리된 입력 계약과 순수 구성 계산 경계.
- 작업: 기본값 전체를 저장하지 않고 변경분만 보존한다. Host 공용/프리셋 소유 설정과 출처 충돌 처리, 병합·초기화 의미를 확정한다. 버전 필드는 추가하되 기존 데이터 일괄 변환은 S5에서 수행한다.
- 수용/검증: override 없음→기준 유지, 단일 필드 변경→나머지 유지, override 삭제→기준 복귀, 명시적 false/0 보존, 배열/null 스키마 검증을 단위 테스트한다. 압축뿐 아니라 프롬프트 기능·도구 제공자 Config에도 동일 계약을 적용한다.

### S2 — 프리셋 조합과 DSH 실행 경로 정리

- 선행: S1.
- 결과: Master/Optimized/사용자 프리셋에 공통 계약을 적용하며 불필요한 실행 차단을 제거한다.
- 작업: 프롬프트 provider 선택에 따른 비도구 기능 일괄 제거를 없애고 명시적 구성 변경만 반영한다. 공유 제공자·서비스 격리·명령 의존성을 보존한다. 도구 설명·실행 기본값·역할 제한·#26 게이트를 유지하며 잘못된 restrict/guard/래퍼 책임을 정리한다.
- 수용/검증: 빈 override와 persona 편집에서도 기본 기능이 유지된다. 도구의 신규 등록·해제와 own-scope 등록이 일반 도구 전체 차단으로 번지지 않는다. 동명 도구의 shadowing, 기존 승인 거절 및 게이트 거절이 보존된다. 실제 Loader/scope 통합 테스트를 포함한다.

### S3 — 출처를 보존하는 카탈로그와 스냅샷 갱신

- 선행: S2.
- 결과: 읽기 후보 목록과 실행 구성을 분리하고 프로필별 마지막 정상 스냅샷을 관리한다.
- 작업: 초기 로드·리로드 시 정착/성공 여부를 검증하고 완전한 결과만 반영한다. 식별 가능한 제거 항목의 관련 데이터만 정리한다. 등록 실패·저장 실패·중단 후 재시작 시 복구 순서를 설계한다. Master 교체 시 기존 revision의 수명을 보존한다.
- 수용/검증: 추가/제거/재등장, schema 변경, 동일 이름의 다른 출처, 부분 실패, 중복 갱신, 저장 실패·재시작을 검증한다. 실패 결과가 대량 삭제나 새 정상 기준으로 저장되지 않는다. 사용자 확장·Host 서비스가 중복 실행되지 않는다.

### S4 — 상태·덮어쓰기·변경 영향을 구분하는 UI

- 선행: S3.
- 결과: 기본값 사용과 설정 덮어쓰기, 기능 상태, 가용성 미확인을 구분한 편집·미리보기·변경 안내.
- 작업: Config 체크를 기능 토글로 해석하지 않도록 문구와 데이터 흐름을 맞춘다. 기준값/변경값과 적용 후 영향을 보여 준다. 변경 안내의 확인/저장 순서, 창 없는 부팅의 알림 보관을 구현한다.
- 작업(프롬프트 미리보기 편집): 프롬프트 미리보기와 실행 설정은 같은 Config 덮어쓰기 저장값을 사용한다. 미리보기에서 바꾼 값은 해당 provider의 덮어쓰기로 저장되어 실행 설정에 "덮어쓰기" 상태로 표시되고, 실행 설정의 변경도 미리보기에 반영된다. "원래대로"는 덮어쓰기만 지우고 DSH 기본값으로 돌아간다. 기존 persona `prefix`와 도구 사용 지침 `sections` 편집이 같은 방식이다.
- 작업(편집 단위): 미리보기에서 편집하는 대상은 렌더링된 텍스트가 아니라 그 텍스트를 만드는 Config 필드다. 각 섹션 옆에 해당 필드 컨트롤을 둔다. 예: `time-context`의 `timeZone`·`refreshIntervalMs`, `agent-instructions`의 `maxBytes`·파일 후보. Config 필드가 없는 본문(AGENTS.md 내용, 시각 문장, 지침 안내 문구)은 편집 불가 사유를 표시한다. 프롬프트에 나타나지 않는 압축 기능은 실행 설정에서만 편집한다.
- 작업(주입 컨텍스트 표시): `agent/pre-step`에서 세션 메시지로 주입되는 `agent-instructions`·`time-context` 내용을 미리보기의 별도 영역에 표시한다. 위 편집 컨트롤의 선행 작업이다.
- 수용/검증: 미리보기 편집이 실행 설정에 같은 덮어쓰기로 나타나고 반대 방향도 일치한다. 원래대로 복귀 후 저장값에 해당 키가 남지 않는다. 기본값 복귀, 스키마 없는 기능, 출처 미확인, 활성화 실패를 UI 테스트한다. 추가·제거·설정 정리 안내가 중복되지 않으며 민감값을 노출하지 않는다. ko/en/zh, 라이트/다크와 좁은 화면을 검증한다.

### S5 — 기존 프리셋의 명시적 복구와 호환성

- 선행: S4.
- 결과: 기존 저장 데이터의 버전별 해석, 비파괴 영향 미리보기, 확인 후 재생성·저장 경로.
- 작업: Optimized 템플릿 갱신과 사용자 복사본 복구를 구분한다. 확인되지 않은 누락 의도를 자동 OFF/ON으로 변환하지 않는다. 기존 덮어쓰기·역할·Pixie Gate 연결·ID를 보존하고, 실패 시 마지막 정상 적용본을 유지한다. 승인 전에는 기존 자료를 변경하지 않는다.
- 수용/검증: 압축 그룹이 빈 레거시 프리셋, 명시적 auto:false, 부분 Config override, 연결된 게이트, 손상 데이터, 중복 복구, 저장/등록 실패를 검증한다. 복구는 멱등적이며 기존 실행 세션에 자동 재적용되지 않는다.

### S6 — 독립 설치 및 종단간 회귀 검증

- 선행: S5.
- 결과: 수정하지 않은 지원 DSH + 패키징된 Studio의 검증 기록과 공개 제한.
- 작업: 격리 프로필에서 Master/Optimized/사용자 복사 흐름을 검증하고 Studio 리로드·DSH 재시작·기존 세션 재개를 구분한다. #26의 게이트 연결·실행·설정 보존도 검사한다.
- 수용/검증: 아래 검증표와 8절을 충족한다. 압축은 실제 임계값을 확인한 자동 압축 및 수동 명령을 각각 검증한다. 라이브 모델 검증과 replay/mock 결과를 구별한다. Studio 범위 검사·타입 검사·빌드·관련 테스트 및 독립 설치 결과를 기록하며 미검증을 완료로 표시하지 않는다.

## 12. 필수 회귀 검증표

| 입력/상황 | 기대 결과 |
| --- | --- |
| Config 덮어쓰기 없음 | 기준 실행 기능 유지; 제공자 기본값 사용 |
| 일부 값 변경 후 덮어쓰기 해제 | 해당 override만 제거; 기본 기능은 유지 |
| 명시적 false/0 또는 기능 비활성화 | 의도 보존; 미설정과 구분 |
| persona만 편집 | 압축 등 무관한 비도구 기능 유지 |
| 도구 선택 변경 | 비도구 기능·공유 의존성의 암묵적 제거 없음 |
| 외부 도구 ON/OFF 및 own-scope 등록 | DSH 정상 경로로 가용성 반영; 무관한 도구 차단 없음 |
| 승인·파일 접근·역할 제한·Pixie Gate 거절 | 기존 안전/사용자 정책 보존; 범용 허용으로 우회하지 않음 |
| 동명 도구 제공자 변경/출처 미확인 | 이름만으로 덮어쓰기 이전·삭제하지 않음 |
| 수집 실패/준비 중/부분 결과 | 이전 정상 기준 보존; 대량 삭제 없음 |
| 정상 제거 후 재등장 | 확인된 관련 선택 정리; 삭제된 사용자 override 자동 복원 없음 |
| 압축 기본값/임계값 override/auto:false | 각각 실제 자동 실행·변경 정책·자동 비활성 확인; 수동 경로 별도 확인 |
| 기존 프리셋 복구·Studio 리로드 | 게이트 연결과 override 보존; 기존 세션 임의 재구성 없음 |
| 프로세스 중단 후 재시작 | 스냅샷·프리셋·알림 상태의 불일치 감지 및 정상 기준 복구 |

## 13. S0에서 닫을 구현 결정과 비목표

- 대상 DSH 버전별 Loader/Config/프리셋 수명 계약 및 지원할 제공자의 범위.
- 신규 필드의 정확한 저장 스키마, 원자적 저장 단위, 기존 형식 버전 판별과 복구 승인 UX.
- 출처를 확인하지 못한 도구의 표시·편집 제한, 공유 제공자의 일부 도구를 선택하는 지원 범위.
- Optimized 고정 항목 부재 시 적용 오류/경고 기준과 실행 설정 제외 UI의 범위.
- 제외 설정의 저장 형식.
- 스냅샷 변경 안내와 승인 여부, 알림 없는 부팅의 처리, Master 교체 중 신규 세션 생성의 직렬화·실패 복구.

이 결정들은 기본값 보존/명시적 덮어쓰기/DSH 실행 흐름 준수라는 제품 방향을 다시 뒤집는 항목이 아니다. 정확한 파일 경로·기존 줄 번호는 조사 단서일 뿐 구현 지시가 아니며 #26 이후 최신 코드에서 다시 확인한다.

비목표: DSH 코어 수정, 범용 플러그인 자동 복제, 새 압축 엔진·모델용 압축 도구, 보안 정책 완화, 실행 중 세션 강제 재구성, 과거 세션의 완전한 버전 재현, 현재 한도 초과 세션의 자동 복구.

## 14. 이번 문서화에서 하지 않은 것

코드 수정, 사용자 설정·플러그인 ON/OFF, 앱 재시작·리로드, 빌드·배포, 새 회귀 테스트 실행, 커밋·병합은 하지 않았다. 이번 변경은 #26 이후 구현을 위한 계획이며, 착수 시 S0부터 최신 상태를 검증한다.

## 15. 선행 처리: 압축 누락 긴급 수정

사용 중인 세션에서 압축을 쓸 수 없어 S0보다 먼저 처리했다. 3절 "실행 설정: 기본 전체 반영" 규칙 중 **조합 경계**만 구현했으며, 제외 설정·상태 UI·스냅샷은 포함하지 않는다.

### 15.1 변경

| 단위 | 내용 | 파일 |
| --- | --- | --- |
| P1 | 선택하지 않은 prompt provider를 기본 구성에서 제거하던 처리를 없앴다. 미선택은 제외가 아니라 기본값 사용이다. 선택한 provider는 원래 그룹·위치에서 Config만 바꾼다(persona 중복·hoist 없음). 그 결과 `compaction` 그룹의 `isolate`, `command-compact`, `tool-result-pruner`와 `agent-instructions`·`time-context`·`skill-filesystem`이 유지된다. 기준 선언에 없는 provider(다른 기본 프리셋에서 가져온 것)만 기존처럼 hoist하고 `studio-compaction` 격리 그룹으로 감싼다. | [composition-plan.ts](<../../src/host/composition-plan.ts>) |
| P2 | Optimized는 request가 같아도 반영된 구성이 현재 코드의 구성과 다르면 시작 시 다시 구성·반영한다. 기준 구성을 만들 수 없으면 마지막 반영본을 유지한다. 사용자 복사 프리셋은 자동 재반영하지 않는다(사용자가 "DSH에 다시 반영"). | [preset-store.ts](<../../src/host/preset-store.ts>) |
| 테스트 | persona만 편집해도 압축 그룹 3종·`isolate`·압축 Config 덮어쓰기·context provider가 유지되는 회귀 테스트, 압축 그룹이 빈 예전 Optimized 반영본의 재구성 테스트. 기존 "미선택 provider 제외" 기대를 새 규칙으로 갱신. | [composition-plan.test.mjs](<../../test/composition-plan.test.mjs>), [optimized-preset.test.mjs](<../../test/optimized-preset.test.mjs>) |

`selectPromptProviders`([prompt-composition.ts](<../../src/prompt-composition.ts>))는 조합 경로에서 더 이상 쓰지 않지만 테스트가 참조하므로 남겼다. S2에서 정리 여부를 정한다.

### 15.2 검증

- 로컬: `npm --prefix studio test` 415개 통과, `git diff --check` 통과.
- 설치: 앱 종료 후 `DSH_HOME="$HOME/.dsh" npm --prefix studio run dev:desktop`으로 desktop 프로필(DSH `0.2.0-rc.2`, Studio `0.2.9` 로컬 빌드)에 설치했다. 재시작 후 Optimized는 자동 재구성되었고, Optimized Copy·Optimized Creator는 사용자가 다시 반영했다. 세 프리셋의 `applied` 구성에 `compaction-basic`·`command-compact`·`tool-result-pruner`·`agent-instructions`·`time-context`·`skill-filesystem`이 모두 포함됨을 `presets.json`에서 확인했다.
- 사용자가 새 세션에서 `/compact` 명령 노출을 확인했다.
- 미검증: 자동 압축의 `compaction/start → summary → end` 실제 발생(임계값 도달 필요), `/compact` 실행 결과, 8절의 다른 수용 조건.

### 15.3 알려진 사항과 주의

- 설치 시 `~/.zshrc`의 `export DSH_HOME="$PWD/studio/.dsh-home"` 때문에 `dev:desktop`이 격리 경로를 찾아 실패했다. desktop 설치는 `DSH_HOME="$HOME/.dsh"`를 명시한다. 셸 설정은 사용자 소관이라 수정하지 않았다.
- 압축 Config 덮어쓰기 체크는 기능 ON 스위치가 아니다. 체크하지 않아도 DSH 기본값으로 포함된다. Optimized Creator의 빈 `compaction/*` 덮어쓰기는 기본값과 동일하게 동작한다.
- 이미 열린 세션에는 적용되지 않는다(6절).

### 15.4 다음 세션 재개 지점

1. **S0**부터 시작한다. 15절 변경을 #26 이후 기준에 포함된 것으로 기록한다.
2. S2 착수 시: own-scope 도구 차단([preset-policy.ts](<../../src/host/preset-policy.ts>)의 `installPolicy` 탐침과 전역 `guard`)과 [Optimized JSDoc](<../../src/optimized-preset.ts#L5-L12>) 수정이 남은 핵심이다. 조합 경계(P1)는 완료되었다.
3. S4·S5: 압축 포함·자동 ON/OFF·`/compact` 표시, 명시적 제외 설정과 저장 형식, 기존 사용자 프리셋의 누락 탐지·복구 안내가 남아 있다.

## 16. S0 기록 — #26 이후 기준과 도구 정책 결정

### 16.1 기준

- 기준 브랜치·커밋: `studio/feat/workflow` `49cfd6a996`(#26 완료 기록 `e8a0552cd5`와 15절 수정 포함). `studio/research/catalog-scope`는 이 커밋의 조상으로 병합되어 있고, 계획에 적힌 별도 worktree는 더 이상 없다. 작업은 메인 checkout에서 진행했다.
- Studio `0.2.9`, peer 범위 `0.2.0-rc.2 || 0.2.1-alpha.2`. 설치 앱 런타임은 `0.2.0-rc.2`(`~/.dsh/dsh-runtimes/dsh-primary-runtime/runtime.json`), workspace 소스는 `0.2.1-alpha.2`다.
- #26 Pixie Gate는 `tools/pre-execute`·`agent/pre-step`·`agent/turn-stopping` 리스너와 `agentPresets.composedPreset`으로 프리셋을 판별한다([pixie-service.ts](<../../src/host/pixie-service.ts>)). 프리셋 정책의 restrict·guard와 독립이므로 이번 정책 변경의 영향을 받지 않는다.

### 16.2 own-scope 차단 원인 — 설치 런타임과 workspace 소스의 차이

1절의 미확인 사항을 설치 앱 `app.asar`의 `0.2.0-rc.2` 산출물에서 확인했다(읽기만 함).

- 설치 런타임에는 `@deepseek-ai/dsh-tool-schedule` 패키지가 없다. `@deepseek-ai/dsh-schedule` 서비스가 `agent/created` 때 **root Agent마다 `agent.ctx`로 네 도구를 등록**한다(`registerScheduleTools(rootCtx, agent.ctx, agent)`). 즉 Agent own-scope 등록이 이 버전의 정상 경로다.
- workspace 소스(`0.2.1-alpha.2`)는 이를 `tool-schedule` 플러그인으로 분리해 `standard`·`ptc`·`cordis` 프리셋 scope(Agent의 상위)에 등록한다. 로컬 소스만 보고 "프리셋 선언이라 상속 도구로 보인다"고 판단했던 것이 설치 런타임과 맞지 않았다.
- 따라서 예약 플러그인을 켜면 모든 root Agent에 own-scope 도구가 생기고, 이전 정책의 own-scope 탐침이 매 설치를 거절하여 `block` guard가 전체 호출을 막았다. 지원하는 두 런타임 모두에서 own-scope 등록은 정상 DSH 동작으로 취급해야 한다.

### 16.3 공개 API 확인표

설치 `0.2.0-rc.2` 산출물에서 존재를 확인했다. workspace 소스와 같은 의미다.

| 계약 | 확인 결과 |
| --- | --- |
| `tools.restrict({ allow/deny })` | 상속 도구만 가린다. own-scope 등록은 가리지 않는다. 등록 시점에 알려진 상속 이름만 받는다(미지 이름은 오류). |
| `tools.guard` | 모든 실행 이름에 적용되는 단조 거절. 동적 도구까지 막으므로 기본 구성 용도로 쓰지 않는다. |
| `tools.schemas/get(scope)` | scope별 실효 목록. 제공자 출처 없음. |
| `agentPresets.register/resolve/readDocument/acquireScope/composeFrom/serviceFor/recompose/select/compositionInventory` | 모두 존재. |
| 하위 Agent `toolFilter` | `applyChildComposition`이 child scope에 `restrict(toolFilter)`를 건다. 기존 role 필터 경로는 그대로다. |
| `dsh-compaction`·`dsh-commands`·`dsh-config-editor`·`dsh-compaction-basic` | 설치 산출물에 존재. S4에서 상태 표시 계약을 다시 읽는다. |

### 16.4 결정 (사용자 확인)

| 항목 | 결정 |
| --- | --- |
| 기본 도구 선택의 적용 | **설치 시점 deny 스냅샷.** 정책 설치 때 보이는 상속 도구 중 미선택 이름만 `restrict({ deny })`로 가린다. 이후 새 이름으로 등록되는 도구와 Agent own-scope 도구는 DSH 기본 흐름을 따른다. `restrict({ allow })`와 전역 실행 guard는 쓰지 않는다. |
| 알려진 한계 | 설치 시 가린 이름이 같은 Agent 수명 중 해제 후 재등록되면 계속 가려진다. own-scope 도구는 같은 layer에서 덮어쓸 수 없으므로 설명·실행 기본값 덮어쓰기를 적용하지 못하고 경고만 남긴다. 미선택 own-scope 도구도 가리지 않는다(2절의 "선택 해제는 영구 deny가 아님"과 같은 방향). |
| 선택한 도구가 없을 때 | **경고 후 계속.** 없는 도구는 건너뛰고 나머지 정책을 적용한다. `DSH에 다시 반영`과 시작 시 복원은 `applyWarning`으로, 실행 중 Agent 설치는 Host 로그 경고로 알린다. |
| 여전히 차단하는 경우 | 정책 데이터 자체가 잘못된 경우(알 수 없는 파라미터 경로, PTC 표시, 프롬프트 섹션 충돌)만 기존처럼 이유를 담아 해당 Agent의 호출을 막는다. 덮어쓰기가 반쯤 적용된 상태로 실행하지 않기 위해서다. |

### 16.5 S2 진행 — own-scope 차단 해소

| 변경 | 파일 |
| --- | --- |
| own-scope 탐침 거절·누락 도구 거절·전역 실행 guard 제거, 설치 시점 deny 스냅샷과 `warn` 콜백 도입 | [preset-policy.ts](<../../src/host/preset-policy.ts>) |
| 반영·복원 경고를 `applyWarning`으로 표시, 누락 도구로 반영 실패하지 않음 | [preset-store.ts](<../../src/host/preset-store.ts>) |
| 미리보기는 미설치 선택 도구를 건너뛰고, 미선택 도구가 보이면만 실패 | [prompt-preview.ts](<../../src/host/prompt-preview.ts>) |
| Optimized JSDoc을 "고정 시작 선택이며 실행 allowlist가 아님"으로 수정 | [optimized-preset.ts](<../../src/optimized-preset.ts>) |
| 회귀 테스트: 늦게 등록된 상속·own-scope 도구 실행, 제거 반영과 무관 도구 정상, root Agent의 예약 도구 4종, own-scope 도구가 있어도 정책 적용, 잘못된 정책만 차단, 누락 도구 경고 | [preset-policy.test.mjs](<../../test/preset-policy.test.mjs>), [policy-reselect.test.mjs](<../../test/policy-reselect.test.mjs>), [preset-store.test.mjs](<../../test/preset-store.test.mjs>), [execution-defaults.test.mjs](<../../test/execution-defaults.test.mjs>) |

검증: `npm --prefix studio test`(타입 검사·빌드 포함) 417개 통과. **미검증:** 설치 앱(`0.2.0-rc.2`)에 패키징한 Studio를 넣어 예약 플러그인 ON 상태에서 `bash`·`skill` 호출과 `schedule_*` 호출을 확인하는 것. 실제 Loader/scope 통합 테스트(S2 수용 조건)도 남아 있다. [정책 정렬 검증 기록](<../verification/policy-alignment.md>)의 "외부 제공자는 ancestor scope 등록을 사용해야 한다"는 이번 변경 이전의 제약이다.

S2에 남은 것: `selectPromptProviders` 정리 여부, 실제 Loader 통합 테스트, 설치 검증.

### 16.6 다음 세션 재개 지점

1. (완료 — 사용자 확인) 설치 검증을 먼저 한다: 앱 종료 후 `DSH_HOME="$HOME/.dsh" npm --prefix studio run dev:desktop`(15.3 주의), 예약 플러그인 ON, Optimized·사용자 복사 프리셋의 새 세션에서 일반 도구와 `schedule_list` 호출을 확인한다.
2. 이어서 **S1**(변경 의도·기본 구성 계약)을 시작한다.

## 17. S1–S5 구현 기록

### 17.1 결정 (사용자 확인)

| 항목 | 결정 |
| --- | --- |
| 실행 설정 계약 | Studio Master의 실행 설정 항목은 **모두 기본 반영**한다. 값을 바꾸면 그 필드만 **덮어쓰고**, 덮어쓰기 해제는 기본값 복귀다. 특정 항목은 **반영에서 제외**할 수 있다. |
| 제외 대상 | 도구 외 실행 기능 6개(`agent-instructions`, `time-context`, `skill-filesystem`, `compaction-basic`, `command-compact`, `tool-result-pruner`). 도구 제공자는 도구 선택으로만 관리해 선택한 도구가 사라지는 충돌을 막는다. |
| 변경 안내 | 재시작 후 차이가 있으면 안내하고, **사용자가 확인해야** 정리하고 새 기준을 저장한다. 확인 전에는 저장 데이터를 바꾸지 않는다. |
| S4 범위 | **S4a**(포함 스위치·3상태·압축 상태·변경 안내)만 구현했다. 11절 S4의 미리보기 편집·편집 단위·주입 컨텍스트 표시는 **S4b**로 나눴다. |
| 복구 | 프리셋별 `복구` 버튼 → 추가될 기능 미리보기 → 확인 후 다시 반영. |

### 17.2 단계별 변경

| 단계 | 결과 | 파일 |
| --- | --- | --- |
| S1 | 저장 필드 `configExclusions`(Master Config 항목 id)를 추가했다. 조합 순서는 기준 선언 → 필드 덮어쓰기 → 제외다. 알 수 없는 id, 도구 제공자 제외, 덮어쓰기와 제외 동시 지정, 제외한 prompt provider를 편집 선택한 경우는 오류다. `command-compact`는 `compaction-basic`과 함께 빠진다(`CONFIG_REQUIRES`). 빈 목록은 저장하지 않으므로 기존 데이터는 모두 기본 반영으로 해석된다. | [config-overrides.ts](<../../src/config-overrides.ts>), [composition-plan.ts](<../../src/host/composition-plan.ts>), [prompt-composition.ts](<../../src/prompt-composition.ts>) |
| S2 잔여 | 쓰이지 않던 `selectPromptProviders`를 제거했다. | [prompt-composition.ts](<../../src/prompt-composition.ts>) |
| S3 | 프로필별 `studio-data/catalog-snapshot.json`에 도구 이름·정규화한 파라미터 스키마와 Config id·패키지 이름만 저장한다. Config 값은 저장하지 않는다. Config 항목 하나라도 로드 오류가 있으면 스냅샷을 만들지 않아 기준 교체나 삭제가 일어나지 않는다. 첫 정상 수집은 기준만 저장한다. 같은 id가 다른 패키지를 가리키면 제거+추가로 다룬다. 확인하면 Optimized를 뺀 사용자 프리셋에서 해당 도구 선택·설명·실행 기본값·batch·서브에이전트/역할 필터와 Config 덮어쓰기·제외만 지우고, 반영된 프리셋은 `다시 반영 필요`로 표시한다. 반영된 등록은 다시 만들지 않는다. 반복 확인은 저장 없이 끝난다. | [master-snapshot.ts](<../../src/master-snapshot.ts>), [catalog-baseline.ts](<../../src/host/catalog-baseline.ts>), [shell.ts](<../../src/host/shell.ts>), [preset-store.ts](<../../src/host/preset-store.ts>) |
| S4a | 실행 설정 탭 위쪽에 포함 스위치(기본값/덮어쓰기/제외 배지), 자동 압축 ON/OFF 표시, "선언 기준이며 실행 중 세션 상태가 아님" 안내를 두었다. 제외한 항목은 아래 Config 편집 목록에서 숨긴다. 탭 설명 문구를 기본 반영 규칙으로 바꿨다. 프리셋 목록에 변경 안내(`+`/`-`/`~`, 정리될 프리셋 설정)를 추가했다. | [feature-inclusion.tsx](<../../src/feature-inclusion.tsx>), [master-change-notice.tsx](<../../src/master-change-notice.tsx>), [optimization-prototype.tsx](<../../src/optimization-prototype.tsx>), [preset-manager.tsx](<../../src/preset-manager.tsx>) |
| S5 | 반영본에 없는데 제외하지도 않은 기능을 `missingFeatures`로 보고한다. 레거시 데이터의 부재는 의도로 해석하지 않고 자동으로 켜지도 않는다. `복구`는 확인 후 기존 `apply`를 호출하므로 덮어쓰기·역할·Pixie Gate 연결·ID가 보존되고, 실패하면 이전 반영본이 유지된다. 현재 desktop 프로필의 세 프리셋은 15절 재반영 이후라 누락이 없음을 읽기 전용으로 확인했다. | [preset-store.ts](<../../src/host/preset-store.ts>), [preset-manager.tsx](<../../src/preset-manager.tsx>) |

### 17.3 검증

- 로컬: `npm --prefix studio test`(Host·Client 타입 검사와 빌드 포함) 430개 통과, `git diff --check` 통과.
- 새 테스트: [composition-plan.test.mjs](<../../test/composition-plan.test.mjs>)(기본 반영·덮어쓰기·제외·의존 정리·오류), [master-snapshot.test.mjs](<../../test/master-snapshot.test.mjs>)(부분 수집 거부, 추가/제거/스키마 변경, 출처 변경, 정리 범위·멱등, 기준 파일 손상 보존), [preset-store.test.mjs](<../../test/preset-store.test.mjs>)(확인 후 정리, 반영 등록 유지), [feature-inclusion.test.mjs](<../../test/feature-inclusion.test.mjs>)(3상태 UI, 의존 잠금, 누락 탐지, 복구 확인, 확인 전 무변경).
- 화면: 새 부품을 DSH 토큰 CSS와 Studio 스타일로 정적 렌더링해 라이트·다크, ko/en/zh, 340px 폭을 확인했다. 실제 Studio 화면 안의 배치는 설치 검증에서 확인한다.
- **미검증:** 설치 앱에서의 변경 안내·제외·복구 흐름, 실제 Loader 통합 테스트, 자동 압축(`compaction/start → summary → end`)과 `/compact` 실행. 독립 배포 검증(S6)은 하지 않았다.

### 17.4 남은 작업

1. **S4b** — 프롬프트 미리보기에 `agent-instructions`·`time-context` 주입 내용을 표시하고, 미리보기에서 Config 필드를 편집한다(실행 설정과 같은 덮어쓰기 저장값 공유).
2. **S6** — 수정하지 않은 DSH에 패키징한 Studio만 설치해 Master/Optimized/사용자 복사 흐름, 리로드·재시작·세션 재개, 압축 자동·수동 실행을 검증한다.
3. S2 수용 조건의 실제 Loader/scope 통합 테스트(S6과 함께).

## 18. 포함 대상 확대와 도구 제공자 탭 통합

### 18.1 결정 (사용자 확인)

- **A 방식:** Studio 기준 구성의 모든 플러그인을 제외할 수 있다. 6개로 고정한 목록은 없앴다. 서브에이전트 플러그인만 예외로, 반영할 때 `subagent_role`로 바뀌므로 서브에이전트 탭이 관리한다. 6개 목록은 이전 빌드의 누락 탐지(S5)에만 쓴다(`LEGACY_DROPPED_PACKAGES`).
- **반영 검사:** 선택한 도구를 제공하는 플러그인을 빼면 `DSH에 반영`이 실패하고 이전 반영본을 유지한다. DSH 재시작 후 복원은 16.4 결정대로 경고만 남긴다.
- **도구 제공자 탭 제거:** Master에 없는 플러그인 추가는 `포함할 플러그인`의 `플러그인 추가` 대화상자로 옮겼다. 후보는 DSH 기본 프리셋(`standard`·`ptc`·`minimal`·`cordis`)에 선언됐지만 Master에 없는 플러그인이고, 패키지 이름을 직접 입력할 수도 있다. 프리셋 선언의 config가 JSON이면 함께 가져오고, 아니면 config 없이 추가해 덮어쓰기로 편집한다. 저장 위치는 기존 `master-extensions.json`이며 추가 전 활성화 검사와 실패 복구도 기존 흐름을 그대로 쓴다.
- **UI 통일:** 포함 목록은 Config 편집과 같은 검색·스크롤 목록을 쓴다. Config 편집의 필터에서 `켜짐`을 빼고 `전체/변경됨`만 남겼다. 체크는 덮어쓰기 대상 선택이라 `켜짐`이 플러그인 활성화로 읽히기 때문이다.

### 18.2 검증

- `npm --prefix studio test` 432개 통과. 포함 목록의 검색·필터·상태·의존 잠금, 플러그인 추가·제거 호출, 엄격한 반영 검사(이전 반영본 유지) 테스트를 추가했다.
- 화면: 포함 목록을 DSH 토큰 CSS로 정적 렌더링해 라이트·다크를 확인했다.
- **미검증:** 설치 앱에서 `플러그인 추가`로 실제 플러그인(예: `tool-schedule`)을 추가해 도구 목록에 나타나는지, 추가 후 활성화 실패 시 복구되는지.

### 18.3 플러그인 추가 수정

- `addMasterPlugin`의 Host 매개변수 이름이 Client descriptor(`payload`)와 달라 게이트웨이가 거절했다. 이름을 맞추고 모든 `studioCatalog` 메서드의 이름 일치를 검사하는 [remote-signatures.test.mjs](<../../test/remote-signatures.test.mjs>)를 추가했다.
- `terminal-bash`를 단독으로 추가하면 같은 그룹의 `dsh-terminal`(격리된 `terminals` 서비스)이 없어 `waiting for terminals`로 활성화되지 않았다. 이제 DSH 프리셋에서 그룹 안에 선언된 플러그인은 **그 그룹 전체(격리 설정과 형제 플러그인)** 를 함께 추가한다. 후보 설명에 함께 추가될 플러그인을 표시한다.
- `!!js` 비활성 조건은 DSH 프리셋이 쓰는 `process.platform ===/!== '<os>'` 형태만 평가하고, 그 밖의 식은 꺼진 것으로 보고 후보와 추가 대상에서 뺀다. 이 플랫폼에서 꺼진 변형(macOS의 pwsh 계열 등)은 더 이상 후보에 나오지 않는다.
- 남은 제한: 함께 추가된 그룹이 Master에 이미 있는 도구와 같은 이름을 등록하면(예: `tool-bash-persistent`의 `bash`와 Master의 `tool-bash`) 추가 전 활성화 검사가 실패하고 이전 상태로 되돌린다. 이 충돌은 활성화해 보기 전에는 공개 API로 알 수 없다.

## 19. Master를 DSH standard 기준으로 재구성

### 19.1 결정 (사용자 확인)

손으로 고정한 Master가 standard와 비슷하지만 같지 않아 생기는 혼란(예: `terminal-bash` 추가 시 `waiting for terminals`, 대체 구현의 도구 이름 충돌, 버전별 차이)을 없애기 위해 출처가 보이는 4층으로 바꿨다.

| 층 | 내용 | 표시 |
| --- | --- | --- |
| DSH standard | 실행 중인 DSH의 `standard` 선언을 캡처할 때마다 읽는다. 읽지 못하면 Studio에 들어 있는 사본을 쓰고 안내한다. 플랫폼 조건은 이 Host 기준으로 풀어 비활성 행은 뺀다. | 배지 `standard` |
| Studio 추가 | `spill-policy`, `read_batch`(`studio-batch`), `tool-cordis`, `plugin-manager/tools`. standard가 이미 제공하는 패키지는 중복으로 넣지 않는다. | 배지 `Studio` |
| Studio 대체 | standard의 `subagent`·`subagent_fork` → `subagent_role`. 역할 플러그인은 standard의 delegation 그룹에 들어가 같은 워크플로 엔진을 쓴다. | 포함 목록에 나오지 않고 서브에이전트 탭이 안내 |
| 사용자 추가 | `플러그인 추가`에서 패키지 이름으로만 추가(`studio-added/…`). 다른 DSH 프리셋에서 가져오는 후보 목록은 대체 구현과 충돌하므로 없앴다. | 배지 `추가함` |

### 19.2 변경과 영향

- [master-composition.ts](<../../src/host/master-composition.ts>): `masterComposition(standard, added)`, `pluginOrigins`, `disabledHere`/`enabledRows`, 사본 `standardFallback`. standard 행의 id와 그룹을 그대로 쓰므로 기존 Config 덮어쓰기 id(`tool-fs`, `compaction/compaction-basic` 등)와 Studio 추가 항목 id(`spill-policy`, `studio-batch`)가 유지된다.
- Master에만 있던 설정 차이(짧은 plan-mode 문구, 서브에이전트 `toolFilter`)는 standard 값으로 바뀐다. Optimized의 덮어쓰기에는 넣지 않았다. standard를 따르기로 한 결정의 결과다.
- standard가 바뀌면 Master가 따라 바뀌고, 변화는 17절의 변경 안내(`+`/`-`/`~`)로 확인 후 반영된다. 설치된 0.2.0-rc.2와 0.2.1-alpha.2의 standard는 `time-context`, `tool-schedule`, plan-mode 문구, 서브에이전트 설정이 다르다.
- 검증: `npm --prefix studio test` 437개 통과. standard 실제 선언으로 Master를 만들어 id 유지·플랫폼 조건 해소·역할 플러그인 위치·출처 판정을 검사한다([master-addition.test.mjs](<../../test/master-addition.test.mjs>)). 포함 목록의 출처 배지를 정적 렌더링으로 확인했다.
- **미검증:** 설치 앱에서 standard를 실제로 읽어 Master가 구성되는지, 첫 재시작 때 변경 안내에 나오는 차이(이전 Master 대비), Optimized 재구성 결과.

## 20. S4b — 턴 시작 주입 내용 미리보기와 편집

- 미리보기 대화상자 아래에 **턴 시작에 들어가는 내용** 영역을 두었다([turn-injection-panel.tsx](<../../src/turn-injection-panel.tsx>)). 포함된 플러그인만 나오므로 제외하면 사라진다.
  - `agent-instructions`: 설치된 DSH의 공개 export `loadBaselineInstructions`를 `ctx.loader`로 불러 현재 덮어쓰기가 반영된 Config로 실제 렌더링한다([turn-injections.ts](<../../src/host/turn-injections.ts>)). Studio Host의 작업 폴더 기준이라 세션 폴더와 다를 수 있어 `예시`로 표시한다. export가 없거나 실패하면 이유를 적고 미리보기는 계속된다.
  - `time-context`: 패키지가 형식 함수를 export하지 않아 같은 형식(턴 1·스텝 1, 브라우저 시간대 없음)을 Studio가 그대로 만든다. 설정한 `timeZone`이 반영된다.
  - `skill-filesystem`: 설치 스킬과 세션 폴더에 따라 달라 내용은 보여 주지 않고 이유만 표시한다.
- 각 영역 아래 Config 필드(`timeZone`, `refreshIntervalMs`, `maxBytes`, 지침 파일 후보, `customSkillDirs`)를 편집한다. 실행 설정 탭과 **같은 Config 덮어쓰기 값**을 쓰므로 양쪽이 같은 상태(`기본값`/`덮어쓰기`)를 보이고, `원래대로`는 그 키만 지운다. 명시적 `0`은 그대로 저장한다. 바꾼 뒤에는 기존 "설정이 바뀌었습니다. 다시 실행" 안내가 뜬다.
- 본문(AGENTS.md 내용, 시각 문장, 스킬 목록)은 편집할 수 없고 그 이유를 표시한다. 렌더링된 텍스트를 저장하지 않는다(3절).
- 검증: `npm --prefix studio test` 440개 통과. 실제 `@deepseek-ai/dsh-agent-instructions` 소스로 렌더링해 이 저장소의 AGENTS.md 블록이 나오는 것을 확인했다. 라이트·다크 정적 렌더링 확인.
- **미검증:** 설치 앱(0.2.0-rc.2)에서 `loadBaselineInstructions` export와 결과(설치 산출물에 export가 있음은 16절 조사 때 확인).

## 21. 웹 확인 후 수정

- **복구 후에도 `기능 누락`이 남던 문제:** 누락 판정이 실행 중인 Master가 아니라 Studio에 들어 있는 standard 사본과 비교했다. 사본에는 `time-context`가 있지만 0.2.0-rc.2 standard에는 없어서, 복구해도 계속 누락으로 보였다. 이제 캡처한 Master와 비교한다(`PresetStore.setMaster`).
- **미리보기 가독성:** 턴 시작 내용을 프롬프트·도구 영역 아래에 붙이지 않고, 미리보기 위쪽의 `시스템 프롬프트·도구 / 턴 시작 내용` 전환으로 따로 보여 준다.
- **플러그인 제목:** 포함 목록과 Config 목록이 같은 제목·용도 표([plugin-labels.ts](<../../src/plugin-labels.ts>), ko/en/zh)를 쓴다. 표에 없는 패키지는 패키지 이름을 제목으로 쓴다. 검색은 제목에도 걸린다.
- 검증: `npm --prefix studio test` 441개 통과.

## 22. 미리보기의 주입 종류 구분과 세션 전용 도구 안내

- 미리보기 전환을 `시스템 프롬프트·도구 / 런타임 컨텍스트 / 턴 시작 내용` 셋으로 나눴다. 런타임 컨텍스트는 공개 `renderContextSections`(0.2.0-rc.2 산출물에서 export 확인)로 기여자별로 보여 준다. 실행 중에만 생기는 도구 결과 뒤 안내(하위 폴더 AGENTS.md)와 압축 요약은 미리보기에 없다는 안내를 붙였다.
- 예약 작업처럼 DSH가 세션의 Agent마다 직접(own-scope) 등록하는 도구는 Studio 도구 목록에 나오지 않는다는 안내를 도구 목록에 추가했다. 사용자가 자동화 작업을 껐다 켰을 때 세션에는 도구가 붙고 프리셋 도구 목록에는 나오지 않음을 확인했다(웹, 0.2.0-rc.2). 이는 의도된 동작이다: 이 도구들은 프리셋 선택 대상이 아니며 16절 정책상 Studio가 가리지 않는다.
- 검증: `npm --prefix studio test` 442개 통과.

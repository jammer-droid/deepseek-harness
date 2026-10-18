# Optimized와 기본 도구

- Studio 목록 순서는 Master, Optimized, 사용자 프리셋이다.
- Master는 읽기 전용이다. Optimized는 최초 실행 시 Studio 기본값(템플릿)으로 만들고 반영한다. 마지막으로 맞춘 템플릿의 해시(`templateHash`)를 함께 저장한다.
- Optimized는 일반 프리셋처럼 편집·저장·반영·반영 해제·사본 만들기를 지원한다. 삭제만 UI와 Host 양쪽에서 금지한다. **기본값으로 복구**는 현재 설치된 도구로 만든 템플릿의 요청과 서브에이전트 역할로 덮어쓰고 바로 반영한다(`restoreOptimized`). 사본(`studio-user-*`)은 독립적인 사용자 프리셋이며 시작 시 정렬 대상이 아니다.
- 프리셋은 정의한 도구가 모두 있어야 실행된다. 반영 시 기준 구성에 없는 도구는 `does not supply tools`로, 세션 시작·재개 시 없는 도구는 `Studio policy selected tools unavailable`로 실패한다. 없는 도구를 빼고 실행하지 않는다(`aa083f17`의 건너뛰기 동작은 `48430309`에서 되돌림). 프로필 플러그인 도구(`load_workspace_dependencies` 등)를 고른 사본은 그 도구를 제공하는 프로필에서만 동작한다.
- 제공 도구 토글은 standard, ptc, minimal, cordis의 실제 카탈로그를 사용한다.
- read_batch는 Studio shell 패키지의 /batch 제공자로 포함되고 Master에 등록된다. 별도 실험 플러그인 설치가 필요 없다. task_run 제공자(/tasks)는 패키지에 남아 있지만 현재 Master에서 제외되어 도구 목록에 나타나지 않으며, 저장된 프리셋의 task_run 선택은 편집·반영 시 자동으로 빠진다.
- read_batch는 기본으로 최대 8개의 read/grep/glob 읽기를 순서대로 수행하고 첫 오류에서 멈춘다. read는 최대 200줄이다. Optimized는 `studio-batch` Config로 줄 상한을 없애고(`maxLines: null`, 각 read가 자체 상한 사용) 결과를 spill에서 뺀다(`noSpill: true`).
- edit_batch는 Studio shell 패키지의 /edit-batch 제공자로 Master에 등록된다. 한 파일에 수정 1~50개를 순서대로 적용하고 한 번에 쓰며, 하나라도 맞지 않으면 파일을 바꾸지 않는다. 도구 목록에서 선택하고 설명을 편집할 수 있다. Config는 없다.
- edit_batch의 한계: 대화 화면에 diff 카드가 없고 샌드박스 권한 확장 인자(`sandbox_permissions`)가 없다. DSH가 도구 이름(`edit`/`write`)으로 하는 처리, 즉 하위 폴더 AGENTS.md를 읽는 계기와 스킬 파일 수정 즉시 반영에서 빠진다.
- `studio-batch`, `studio-edit-batch`는 Config 스키마를 내보내지 않아 Config 화면에서 편집할 수 없다. 값이 들어 있는 항목은 켜진 채 잠기고, 프리셋을 기본값으로 복구할 때만 바뀐다고 안내한다.
- task_run은 같은 세션의 기존 task_run 성공 작업만 의존성으로 허용한다. 내부 bash가 백그라운드로 승격되어 종료 코드를 확인할 수 없으면 unknown_exit로 처리하여 후속 의존 작업을 실행하지 않는다. native jobs와 도구 실행 정책을 사용한다.
- 도구 카드의 설명·인자 설명·공유 프롬프트 섹션이 원본과 다르면 수정됨 표시를 붙인다. Config 카드는 중첩 값과 공개 schema 기본값을 비교한다. 선택만 하거나 원본으로 복원하면 표시하지 않는다.

## Optimized 기본 정책

값의 근거와 측정 기록은 [#34 명세](../issues/34-optimized-worker-tuning.md)에 있다.

- Optimized는 도구 27개를 allowlist(`OPTIMIZED_TOOLS`)로 고정한다. 목록에 없는 도구는 런타임에 존재해도 선택하지 않으므로, 프로필 플러그인이 등록한 `x_search`·`image_generate`·`video_generate`·`load_workspace_dependencies`와 Goal/Todo·task_run·plugin_manager가 새어 들어오지 않는다. 메인 에이전트는 위임 도구와 `judge`·`pixie_loop`·`cordis_inspect_*`를 가진다.
- 기본 Worker 역할 1개를 넣는다. 모델·추론은 `inherit`, 시작 방식은 `fresh`, persona는 "질문하지 말고, 위임하지 말고, 끝까지 검증한 뒤 짧게 보고"다. Tool Filter(`replace`)로 위임·질문·계획 모드·`present`·`judge`·`pixie_loop`·`cordis_inspect_*`를 뺀다. 설치되지 않아 선택에서 빠진 도구는 Tool Filter에서도 뺀다. Worker는 공통 지침·실행 기본값·도구 설명·섹션·Config를 메인과 똑같이 물려받는다.
- spill-policy.maxInlineTokens는 2500이다. 초과 판정과 반환 미리보기 예산이 같으며, 문자 기준 앞뒤 512자 정책은 사용하지 않는다.
- bash.timeoutMs 생략 시 120000ms, job_output.timeout_ms 생략 시 120000ms를 요청한다. 실제 대기는 native 런타임 상한을 따른다. 명시한 인자는 변경하지 않는다. bash와 read의 인자 설명, `tool:read` 섹션을 이 동작에 맞게 덮어쓴다.
- 공통 지침은 한 번에 전체 읽기, 큰 출력은 grep 후 범위 읽기, 독립 호출 묶기, 한 파일 수정은 edit_batch 한 번, 긴 명령은 백그라운드 작업으로 수집, 위임, 최소 충분 검증 후 종료의 7줄이다. 템플릿을 만들 때 선택되지 않은 `read_batch`·`edit_batch`를 언급하는 문장은 뺀다. 사용자가 편집해 도구를 끄면 지침은 자동으로 바뀌지 않는다.
- 시작할 때 Optimized를 템플릿과 맞춘다. 저장된 요청·역할이 마지막 템플릿 해시와 같으면(편집하지 않았으면) 새 템플릿으로 갱신하고, 반영 중이면 다시 반영한다. 편집했으면 그대로 두고 카드에 **직접 편집함**을, 그 뒤 템플릿이 바뀌었으면 **새 기본값**을 표시한다. 해시가 없는 이전 버전 행은 편집할 수 없던 시절의 것이므로 편집하지 않은 것으로 본다. 정렬 반영이 실패하면 이전 스냅샷을 유지하고 경고에 남긴다.
- 반영은 사용자 프리셋과 같은 경로(`apply`)를 쓴다. 섹션, 역할, `childToolFilter`가 함께 반영된다.

## 서브에이전트 Tool Filter

- 프리셋 기본값은 요청의 `subagentToolFilter.deny`, 역할별 목록은 역할의 `toolFilter`(`mode`, `deny`)에 저장한다. 역할에 `toolFilter`가 없으면 기본값, `extend`면 기본값 ∪ `deny`, `replace`면 `deny`만 쓴다(`roleToolFilter`). `extend`는 이후 기본값 변경을 따른다. 0.2.6에서 `mode` 없이 저장된 역할 목록은 `replace`로 읽는다. 역할이 없을 때의 기본 자식은 기본값을 쓴다.
- 프롬프트·도구 탭에서 선택한 도구만 넣을 수 있다. 편집기는 선택하지 않은 도구를 목록과 저장값에서 뺀다. 반영 시에도 모든 목록을 검사한다(`Subagent Tool Filter may only list tools selected in this preset`). DSH는 자식 필터에 상속받을 수 없는 이름이 있으면 시작을 거절하므로 반영 단계에서 실패하게 했다. `subagent_role`을 선택하지 않은 프리셋에서는 편집할 수 없다.
- 반영하면 roles 플러그인 `toolFilter`에 기본값을, 역할 설정에 역할 목록을 넣는다. policy 플러그인 `childToolFilter`에는 기본값과 모든 역할의 실제 목록(모드 적용 후)의 합집합(숨길 수 있는 도구)을 넣는다. `subagent_role`은 호출한 역할의 목록을 fresh·fork 요청의 `toolFilter`로 넘기고, DSH가 `tools.restrict()`로 자식을 제한하며 재개를 위해 기록한다. `dsh-tool-subagent`의 `toolFilter` Config와 같은 경로다.
- 자식은 부모 프리셋에 붙어 같은 policy를 받는다. policy는 숨길 수 있는 도구 중 **이 자식에게 보이지 않고 프리셋은 여전히 제공하는 도구**만 빼서 자식용 policy를 설치한다. 역할마다 다른 목록을 policy가 따로 알 필요가 없다. 숨길 수 있는 도구가 아닌데 빠진 도구, 또는 프리셋 자체가 잃은 도구는 그대로 남아 `selected tools unavailable`로 실패한다.
- 자식용 policy는 뺀 도구만 쓰던 사용 지침 섹션(`tool:bash`, `tool:jobs`, `tool:goal`, `tool:workflow` 등)을 빈 문자열로 덮는다. 같은 섹션을 쓰는 도구가 하나라도 남으면 유지한다. 덮어쓰기는 자식 scope에만 등록되어 부모 프롬프트와 편집한 사용 지침은 바뀌지 않는다. DSH는 빈 섹션을 조립에서 뺀다(0.2.0-rc.2 확인). Studio 추가 지침(`studio:additional`)은 자유 텍스트라 그대로 들어간다.
- 실행 설정에서 `@deepseek-ai/dsh-tool-subagent`와 roles 플러그인 Config는 비활성화한다. 반영 시 그 행을 지우므로 효과가 없었다. 이미 켠 값은 끌 수만 있다.
- 최대 재귀 깊이와 동시 실행 수는 DSH 설정 Built-in plugins → Subagent(`@deepseek-ai/dsh-subagent`의 `maxDepth`, `maxActiveSubagents`)를 그대로 따른다. `subagent_role`은 `resolveMaxDepth()`로 깊이를 읽고, 동시 실행 수는 DSH가 자식 생성 시 직접 검사한다. 모델 선택 토글은 `subagent` 도구에만 적용되며 Studio 프리셋에서는 역할 설정이 우선한다.

## 편집 UI

실행 설정은 플러그인 이름·ID와 중첩 schema 필드명·설명으로 검색한다. 도구도 이름·설명·인자 schema로 검색하며 실행 설정과 같은 사용 가능/선택됨 2열 카드, 개별 추가·제외, 카드 내 상세 편집을 사용한다. 검색은 사용 가능 목록에 적용하고 선택된 편집 카드와 수정값은 유지한다. Persona와 Studio 지침 입력은 상단에 유지한다.

## 검증

이번 변경에서도 전체 54개 테스트·Host/Client 타입 검사·빌드를 통과했다. 통합 검사 중 optional 경고 필드 타입 오류를 수정 후 재검사했다. 새 패키지를 19388에 설치하고 저장된 Optimized를 명시적으로 반영하여 제외 도구 5개, task_run 지침 부재, 대기 인자 기본값과 Master의 기존 도구 유지, 재시작 후 정책 보존을 확인했다. 조립된 프롬프트는 5972자에서 6018자, 도구 schema JSON은 25378자에서 21926자로 변했다. 실제 모델 토큰 수는 측정하지 않았다.

Studio 타입 검사·빌드, 54개 테스트와 diff 공백 검사를 통과했다. 수정하지 않은 DSH 0.2.0-rc.2의 격리된 19388 프리뷰에서 패키지를 설치하여 목록 순서, Optimized 삭제 차단·편집·반영·반영 해제·사본 반영, 기본 4개 카탈로그, Master의 두 도구 schema 등록 및 파생 프리셋 조립을 확인했다.

실제 LLM을 통한 새 도구 실행, runtime sandbox·취소·승격 작업 회수, 라이트·다크·좁은 화면 시각 검증은 수행하지 않았다. 도구 정책 전달과 의존성 실패·소유권 처리는 단위 테스트에서 확인했다. 설치 과정의 기존 peer/deprecation 경고는 남아 있다. 현재 사용자 앱 19387은 변경하지 않았다.

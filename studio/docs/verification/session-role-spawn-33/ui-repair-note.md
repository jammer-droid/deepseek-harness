# UI 시나리오 초기 실패와 복구 기록

초기 브라우저 시나리오는 역할 폼까지 진입하지 못했다. 첫 시도는 잘못 추정한 hash route, 다음 시도는 이름을 붙인 빈 테스트 세션이 sidebar에 보인다는 잘못된 fixture 가정이었다. 제품 기능 실패나 성공으로 해석하지 않는다.

- L0: 라이트·다크·520px 세 뷰에서 이름으로 세션을 여는 단계 실패.
- L1: 기존 selector-repair 명세로 pixie_loop를 실행했다. 0 passed / 3 escalated / 0 errors. 목표 세션 항목이 없었으며 일부 대안은 New Session을 잘못 가리켜 거절됐다.
- apply-repairs: exit 1, applied `{}`, unresolved 3개 모두 `not passed`. 실패를 성공으로 간주하거나 잘못된 셀렉터를 적용하지 않았다.
- 소스 확인: 클라이언트 workspace tree는 현재 선택하지 않은 빈 세션을 숨긴다. rename만으로 일반 세션이 되지 않는다. mock 응답으로 첫 턴을 완료해야 sidebar에 표시되며, 이 턴은 Fresh/Fork 이력 검증의 기준 표식으로도 사용한다.
- 첫 fixture 수정 후에도 행 탐색이 실패했다. 추가 소스 확인에서 세션의 Ungrouped 그룹이 접혀 있다는 누락된 선행 조건을 찾았다. 테스트에 그룹 펼치기 단계를 추가하며, 목표 세션 대신 다른 항목을 클릭하는 셀렉터 교체로 우회하지 않는다.
- 절차상 제한: worker가 첫 실패 때 출력한 화면 텍스트 진단을 L1 안내 전에 읽었다. 이후 selector-repair 절차로 전환했고 이 사실을 숨기지 않는다.

수정한 fixture로 세 뷰 모두 폼 진입·Fresh 선택까지 성공했다. 다음 L0 실행은 Save 셀렉터의 지원되지 않는 `[exact=true]` 속성에서 실패했다(18 passed / 3 failed). 이 셀렉터 한 건은 L1 probe·judge 검증을 거쳐 `role=button[name="Save"]`로 복구했다(1 passed / 0 escalated, apply-repairs exit 0). 도구의 줄 길이 제한 때문에 입력의 목표·오류 앞부분과 dialog 끝부분만 남겨 축약했으며, 원본 실패 DOM에 대한 probe 검사는 그대로 수행했다.

복구한 셀렉터를 소스에 반영하고 초기 선택 검사를 추가한 최종 재실행은 브라우저 54/54, UI 저장→자식 실행 10/10을 통과했다. 최종 결과는 [검증 기록](README.md)과 저장된 JSON을 따른다. 앞선 실패는 테스트 fixture·셀렉터 수정 이력으로 남기며 성공 결과에 섞지 않는다.

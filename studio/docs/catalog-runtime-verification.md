# Loader Config 카탈로그 검증

## 반영한 범위

- 프리셋 scope를 열지 않고 공개 Loader entries / owning tree import / unwrapExports를 사용해 Config 스키마 수집.
- Studio activation 반환 체인과 분리된 작업에서 loader.await() 후 수집. RPC는 동일한 snapshot Promise를 기다린다.
- 공개 app-boot projector로 JSON Schema 생성. 비공개 runtime Map과 Inspect provider 호출을 사용하지 않는다.
- 실행 설정 화면에 읽기 전용 스키마 목록 추가. 실제 프로필 Config에는 비밀값이 포함될 수 있어 원시 값 전체를 RPC로 반환하지 않는다.

## 검증

- Studio 테스트 34개 통과, Host/Client 타입 검사와 빌드 통과.
- 수정하지 않은 DSH 0.2.0-rc.2에 패키징된 Studio를 격리 프로필로 설치, 포트 19388에서 RPC 검증.
- 실제 Loader 항목 187개, Config 스키마 103개, 수집 오류 0개.
- 반복 RPC 결과 동일, 원시 config 미노출 확인.
- 설치 시 pnpm peer dependency 경고 발생. 실행 시 Studio 로드 및 위 RPC는 성공.

## 미완료 범위

- 공통 tools.schemas()는 여전히 0개. 전체 scope 도구/프롬프트 열거 기능이 생긴 것은 아니다.
- Config 카탈로그는 읽기 전용이다. 스키마 기반 편집, 프리셋별 Config override 저장·적용, 기존 실행 어댑터/표시 제거는 아직 완료하지 않았다.
- Loader settlement는 모든 항목 활성화 성공을 보장하지 않는다. Config 존재를 활성화 상태로 표시하지 않는다.
- 사용자 시각 검증 미실시. 기존 사용자 앱(19387)에는 배포하지 않았다.

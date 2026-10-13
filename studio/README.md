# DSH Studio — lean-agent 기반

`studio/feat/workflow`의 `89883feb29`에서 분리한 `feat/lean-agent` 브랜치다. 기존 workflow 작업은 원래 브랜치에 보존하며, 이 브랜치는 신규 기능을 넣기 위한 Studio 셸만 제공한다. 신규 기능은 아직 구현하지 않았다.

## 남긴 것

- DSH Studio 사이드바 진입점과 `local.dsh-studio.services` 서비스 등록 슬롯
- 기존 상단 탐색 `ServiceLayout`과 좌측 메뉴·본문 골격 `DetailLayout`
- [디자인 시스템](docs/design-system.md), 공용 UI 부품, 기존 토큰·스타일
- 셸 Host/Client 패키지와 셸만 등록하는 번들
- 공용 UI·서비스 수명·기능 제거·커밋 범위 테스트

서비스가 등록되지 않은 현재 화면에는 사용 가능한 서비스가 없다는 안내만 표시한다. 허위 버튼이나 신규 기능 목업은 넣지 않는다.

## 제거한 것

Preset Builder, DSH 설정, 역할 설정, workflow 편집·적용·위임, 실험 기능, 하위 에이전트 카탈로그, 디자인 미리보기 목업 및 전용 locale·테스트·생성기·Desktop 호환 코드. 번들은 더 이상 Studio managed preset이나 도구를 등록하지 않는다. 구형 배포 스크립트도 제거했다.

기존 기획·조사·이슈 기록은 이력 자료 표시와 함께 보존한다. 현재 구현·지원 기능으로 해석하지 않는다. 사용자 프로필, 저장 데이터, 설치된 Studio는 변경하지 않는다. 이 번들로 업데이트하더라도 기존 사용자 데이터 삭제·마이그레이션을 수행하지 않는다.

## 개발과 검증

```sh
npm --prefix studio run typecheck
npm --prefix studio test
npm --prefix studio run pack:bundle
```

`test`는 Studio 타입 검사·빌드 후 테스트를 실행한다. `watch`는 Studio 번들만 재생성한다. 루트 빌드나 현재 앱 설치는 실행하지 않는다.

자세한 환경·배포 제약은 [개발 안내](development.ko.md)를 참조한다. 패키징 성공은 수정하지 않은 DSH에서의 독립 설치 검증을 대신하지 않는다.

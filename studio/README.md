# DSH Studio — lean-agent 기반

수정하지 않은 DSH에 설치하는 Studio 플러그인이다. `studio/feat/workflow`의 `89883feb29`에서 셸을 분리한 뒤 프리셋·역할 편집 기능을 구현했다. 현재 기능과 과거 workflow 이력은 [목적별 문서 목차](docs/README.md)에서 구분한다. 다음 개선 작업은 [UI·UX 개선 백로그](docs/plans/ui-ux-backlog.md)를 따른다.

## 현재 구현

- DSH Studio 사이드바 진입점과 `local.dsh-studio.services` 서비스 등록 슬롯
- 기존 상단 탐색 `ServiceLayout`과 좌측 메뉴·본문 골격 `DetailLayout`
- [디자인 시스템](docs/development/design-system.md), 공용 UI 부품, 기존 토큰·스타일
- 읽기 전용 Master, Optimized 및 사용자 프리셋의 편집·저장·적용
- 도구·프롬프트·Config 편집과 프로필별 영속화
- 역할의 모델·reasoning·fresh/fork·persona 설정과 네이티브 서브에이전트 호출
- 적용·호출 전 런타임 모델 검증과 Optimized 도구 정책
- [SettingsX](docs/reference/settingsx.md): DSH에 없는 단축키 명령(세션 이동 등)과 정의 파일로 등록하는 사용자 프로바이더(키 없음·API 키·OAuth 로그인·토큰 명령)
- Host/Client 패키지, 설치 번들과 Studio 범위 회귀 테스트

기능 기준 커밋은 `4f42345dd8`이다. Desktop DSH `0.2.0-rc.2` 설치 후 사용자가 반영을 확인했다. 이 결과는 모든 화면·접근성·세션 수명 검증을 의미하지 않는다.

## 이력과 현재 기능 구분

분기 당시 제거한 workflow 편집·실험 기능의 기획·조사·이슈 기록은 이력으로 보존한다. 이를 이후 구현한 프리셋·역할 기능과 혼동하지 않는다. 문서 정리는 사용자 프로필·저장 데이터·설치된 Studio를 변경하지 않는다.

## 개발과 검증

```sh
npm --prefix studio run typecheck
npm --prefix studio test
npm --prefix studio run pack:bundle
```

`test`는 Studio 타입 검사·빌드 후 테스트를 실행한다. `watch`는 Studio 번들만 재생성한다. 루트 빌드나 현재 앱 설치는 실행하지 않는다.

개발 환경은 [개발 안내](development.ko.md), 공개 레포 동기화·npm 공개·업데이트 절차는 [배포 가이드](docs/release.md)를 참조한다. 패키징 성공은 수정하지 않은 DSH에서의 독립 설치 검증을 대신하지 않는다.

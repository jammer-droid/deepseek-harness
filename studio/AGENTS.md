# Studio 작업 지침

## 문서 언어

`studio/` 문서는 각 파일의 기존 언어로 유지하며, 새 작업 가이드는 한국어로 작성한다. 이 하위 트리에는 저장소의 영문·중문 문서 페어링 규칙을 적용하지 않는다. 사용자가 명시적으로 요청하지 않는 한 `.zh.md` 번역본과 `.i18n.yaml` 페어링 기록을 생성하거나 복원하지 않는다. 문서 삭제 시 해당 문서의 링크와 페어링 기록도 함께 정리한다. 이 예외는 Studio 문서에만 적용하며 제품 UI의 locale 규칙은 유지한다.

## Client UI

Studio Client UI를 추가하거나 바꾸기 전에 [디자인 시스템](docs/design-system.md)을 읽는다. 새 컨트롤은 DSH primitives와 공용 부품([ui.tsx](src/ui.tsx), [ui-host.tsx](src/ui-host.tsx))에서 먼저 찾고, 없을 때만 공용 모듈에 추가한 뒤 디자인 시스템 문서의 부품 표를 갱신한다. primitives는 `ui-host.tsx`를 통해서만 가져오고, Node 단위 테스트가 불러오는 모듈은 `ui-host.tsx`에 의존하지 않는다. 기능 모듈에서 인라인 `style`, 색 리터럴, `--dsw-*` 토큰을 직접 쓰지 않는다. 화면 문구는 ko·en·zh locale 사전으로 관리한다. 스타일을 바꾸면 `test/roles-ui.expected.html`을 다시 생성하고, GUI 변경은 Web에 배포해 라이트·다크 모드와 좁은 폭에서 확인한다.

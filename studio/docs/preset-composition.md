# Studio 프리셋 구성과 내보내기

## 편집 순서

1. 프롬프트·도구 화면에서 런타임 카탈로그를 불러온다. minimal persona를 출발점으로 사용한다.
2. 제공자와 도구를 각각 투 컬럼에서 선택한다. 카드는 선택을, 상세 버튼은 설정 편집을 담당한다.
3. persona 본문, 제공자 공개 설정, 도구 설명·인자 설명, jobs 지침 중 필요한 부분만 수정한다. 수정하지 않은 값은 상속한다. 원본 사용은 override를 제거하며 빈 문자열과 다르다.
4. 최하단 추가 지침을 입력하고 모델 표시 이름을 지정해 실제 조립 미리보기를 요청한다. 모델 호출은 하지 않는다.
5. 검증된 구성을 내보낸다. 브라우저 다중 다운로드를 허용하고 내려받은 파일들을 같은 디렉터리에 보관한다.

현재 편집 상태는 메모리에만 있다. 페이지를 닫기 전에 내보내야 하며, 내보낸 파일을 편집 화면으로 다시 불러오는 기능은 아직 없다.

## 배포 산출물

내보내기는 package.json, cordis.patch.yml, README.ko.md를 생성한다. package의 DSH bundle 선언은 patch를 가리키고, patch는 studio-custom preset에 원본 제공자 구성과 Studio policy 플러그인을 연결한다. 설명 변경은 policy 설정에만 있으며 원본 파일은 수정하지 않는다. Loader의 플랫폼 조건식도 보존한다.

필수 의존성 `@local/dsh-studio-shell@0.1.1`은 현재 공개 npm 배포물이 아니다. Studio pack으로 생성한 shell tarball을 대상 환경에 제공하고 내보낸 package의 의존성을 접근 가능한 `file:` 경로나 사설 registry 버전으로 연결해야 한다. 원본 제공자 패키지도 대상 DSH에 있어야 한다. 본체 내장 패키지는 런타임이 제공한다. 누락된 플러그인을 Studio가 자동 설치하지 않는다.

```sh
# Studio 개발 디렉터리에서 패키징
node pack.mjs
# 내보낸 디렉터리의 shell 의존성을 제공한 tarball 경로로 연결한 후,
# 반드시 별도의 검증용 DSH_HOME/profile에 설치한다.
DSH_HOME=/absolute/isolated-home dsh plugin --profile studio-check add /absolute/export-directory
```

설치 후 해당 프로필을 재시작하고 studio-custom으로 **새 세션**을 만든다. 기존 세션에 소급 적용하지 않는다. 사용 중인 사용자 프로필에 설치할 때는 별도 승인이 필요하다. 같은 ID의 복수 내보내기를 동시에 설치하지 않는다.

## 지원 경계

- 검증 런타임: 수정하지 않은 DSH 0.2.0-rc.2. Studio만 빌드·설치한다.
- 제공자: persona, agent-instructions, time-context. 자동 환경 섹션은 선택 목록으로 만들지 않는다.
- 도구는 실행 중인 서버의 카탈로그 기준이다. 다른 Desktop 서버의 구독 도구를 자동 공유하지 않는다.
- 전역 도구 우선, 필요하면 하나의 호환 preset 구성에서 도구 제공자를 보존한다. 동명 구현 선택 및 서로 호환되지 않는 여러 preset의 도구 합성은 지원하지 않는다.
- 실제 조립 미리보기와 모델의 pre-step 메시지는 다르다. 미리보기의 cwd는 서버 작업 디렉터리이며 실제 세션 cwd와 다를 수 있다.
- UI는 최상위 인자 설명과 jobs 섹션을 편집한다. 도구 실행 함수·타입·필수 여부·권한은 편집 대상이 아니다.
- 별도 새 Agent 생성은 검증했으나 라이브 모델 호출과 그 Agent의 실도구 실행은 검증하지 않았다.

구현·검증의 상세 기록은 [이슈 24](issues/24-preset-composition.md)를 참고한다.

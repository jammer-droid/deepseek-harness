---
kind: reference
description: "Studio와 따로 배포하는 플러그인(studio/plugins/)의 구조, 빌드·배포 명령과 규칙."
---

# 별도 플러그인 배포 가이드

## 요약

`studio/plugins/<이름>/`의 플러그인은 Studio 패키지와 따로 버전을 관리하고 따로 npm에 게시한다. Studio 배포([release.md](release.md))와 섞지 않는다. 공개 레포에는 Studio 스냅샷에 `plugins/` 아래로 함께 나간다. 단 배포 스크립트 `plugins/release.mjs`는 fork에만 둔다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `plugins/<이름>/package.json` | npm 이름·버전·peer 의존성. 버전은 플러그인마다 따로 올린다 |
| `plugins/<이름>/src/` | 소스. 진입점은 `src/index.ts` (`name`·`inject`·`Config`·`apply` export, default export 없음) |
| `plugins/<이름>/test/` | 플러그인 자체 테스트 |
| `plugins/<이름>/CHANGELOG.md` | 영어 변경 내역. `## <버전> — <날짜>` 섹션이 없으면 게시하지 않는다 |
| `plugins/<이름>/README.md` | npm 페이지용 영어 README |
| `plugins/<이름>/cordis.patch.yml` | bundle 패치. 설치하면 들어가는 행. `package.json`의 `dsh.bundle.patch`가 가리킨다 |
| `plugins/release.mjs` | 빌드·패키징·게시 스크립트 (fork 전용) |

- 플러그인은 pnpm workspace 밖에 있다. 타입 검사와 테스트는 Studio 개발 패키지(`studio/package.json`)가 연결한 DSH 패키지를 쓴다. 새 플러그인이 다른 DSH 패키지를 쓰면 Studio `devDependencies`에 추가한다.
- Studio가 플러그인을 알아보는 정보(설치 범위 표 `COMPATIBILITY`, 공급자 표 `KNOWN_PROVIDERS`)는 Studio 소스에 두고, 그 검사는 `test/<이름>-integration.test.mjs`에 둔다.

## 설치 가능한 형태와 설치 안내

- DSH **플러그인 → 플러그인 추가**(GUI)는 `package.json`에 `dsh.bundle`을 선언한 패키지만 받는다. 선언이 없으면 "declares no dsh.bundle"로 거부한다. CLI `dsh plugin add`는 경고만 내고 일반 의존성으로 설치하므로, CLI만으로 확인하면 이 차이를 놓친다(0.1.0이 이렇게 배포됐다).
- 그래서 플러그인은 `cordis.patch.yml`(자기 행 `insert`)과 `dsh.bundle.patch`를 갖춘다. 행을 넣기만 하고 선택(`fetchProvider` 등)은 바꾸지 않는다. 사용자가 고르기 전까지 기존 동작이 유지돼야 한다.
- npm 패키지 페이지는 오른쪽에 `npm i <패키지>`를 항상 보여 준다. 사용자가 그대로 따라 하지 않도록 README의 설치 절 맨 위에 "`npm i`로는 DSH에 설치되지 않는다"를 적고, GUI와 `dsh plugin --profile <프로필> add` 방법을 함께 적는다.
- 배포 전 검증에는 GUI 설치를 넣는다: [plugins-exa-contents-gui-install.mjs](../scripts/e2e/plugins-exa-contents-gui-install.mjs)처럼 격리 서버에서 **플러그인 추가**에 tarball 경로를 넣어 설치한다.

## 명령

```sh
node studio/plugins/release.mjs <이름> build              # 타입 검사, 테스트, dist/index.js
node studio/plugins/release.mjs <이름> pack               # build 후 dist/*.tgz
node studio/plugins/release.mjs <이름> publish --dry-run  # 게시 전 확인
node studio/plugins/release.mjs <이름> publish            # npm 게시 (브라우저 2차 인증)
```

`publish`의 동작:

1. 플러그인 폴더에 커밋하지 않은 변경이 있거나, `files`에 적힌 파일이나 `dsh.bundle.patch`가 패키지에 빠졌거나, CHANGELOG에 현재 버전 섹션이 없거나, npm 계정이 `release/config.json`의 `publisher.npm`과 다르거나, 같은 버전이 이미 있으면 멈춘다.
2. 패키징 후 `npm publish`, 레지스트리 `dist.shasum`을 다시 읽어 tarball과 비교한다.
3. fork에 태그 `dsh-plugin-<이름>-v<버전>`을 단다.

OTP·토큰은 채팅·문서에 남기지 않는다. 대화형 터미널에서 직접 실행하는 것이 기본이다.

## 버전

| 변경 | 올릴 자리 |
| --- | --- |
| 버그 수정, 문구 | patch |
| 설정 추가, 동작 변경 | minor |

DSH 지원 버전은 `peerDependencies`에 적는다. Studio 지원 버전이 바뀌면 플러그인도 함께 확인한다.

# Studio 0.6.0 — 구버전 DSH Web 설치·RPC 검증

## 결론

2026-10-17(Asia/Seoul), 수정하지 않은 DSH **0.2.0-rc.2**와 **0.2.1-alpha.2**에 **동일한 정상 패키징 Studio 0.6.0**을 각각 신규 설치했다. 격리 Web 기동 및 기존 핵심 RPC 검사 **각 4개, 총 8개가 모두 통과**했다. 이번 범위에서 제품 호환 실패는 발견하지 않았다.

이는 신규 설치와 Web Host RPC의 결과다. **브라우저 렌더링·화면 조작, 실제 역할 자식 실행, native persona/toolFilter 적용, 0.5→0.6 데이터 업그레이드의 성공을 뜻하지 않는다.**

## 환경·동일성

- 전용 worktree: `/Users/home/playground/vibecoding/deepseek-harness-older-dsh-web`
- 브랜치: `studio/verify/older-dsh-web`
- Studio 소스 HEAD: `b3c992d54ff948ab1a07a7a179d4a59847141598`
- 실행 Node: `v26.10.0`, macOS.
- 런타임은 npm registry의 `@deepseek-ai/dsh`를 정확한 버전으로 각각 설치했다. checkout의 코어 소스·빌드 결과로 대체하지 않았다. 실제 두 CLI의 `--version` 출력도 아래 버전과 일치했다.

| 항목 | rc.2 | alpha.2 |
| --- | --- | --- |
| npm 버전 | `0.2.0-rc.2` | `0.2.1-alpha.2` |
| npm tarball SHA1 | `dfc8f7e09cfa96b854d6f0cf3a973ce7f2948925` | `7acc898e09c4cd0678ab8bf5ee1029ee9c25a026` |
| 로컬 참조 태그의 해시 | `639ed015397290b3745d163aafe02ffee4aa3f84` | `6851e496285b2c9670066fdd142e7e46da586649` |
| 격리 생성물 하위 디렉터리 | `rc2` | `alpha2` |

태그 해시는 `git rev-parse dsh-v0.2.0-rc.2 dsh-v0.2.1-alpha.2`의 출력이며, 이번 실행물은 태그 소스를 빌드한 것이 아니다. npm 설치의 resolved URL·SHA512 integrity·전이 의존성은 각 격리 디렉터리의 package-lock에 보존했다.

패키지는 [pack.mjs](../../pack.mjs)로 한 번 생성하여 양쪽에 그대로 설치했다. 진단 wrapper, manifest 수정, 지원 버전 예외 허용, probe는 없다.

- 패키지: [matamt-dbg-dsh-studio-0.6.0.tgz](../../dist/older-web/release/matamt-dbg-dsh-studio-0.6.0.tgz)
- SHA256: `6fa9aab1172dcbf25fbc613d8b565d88e68750323172e18024ddb0a0772e9b4b`
- 이 해시는 [rc.1 검증 기록](dsh-0.2.1-rc.1.md)의 최종 정상 패키지와도 같다.

## 준비·실행 절차

[dev.mjs](../../dev.mjs)와 [start-web.mjs](../../start-web.mjs)의 지원 버전·정상 tarball 설치 절차를 참고했다. 기존 앱을 변경하는 옵션은 사용하지 않고, 아래 작업을 전용 worktree에서 수행했다.

1. `studio/dist/older-web/{rc2,alpha2}` 각각에 `npm install --prefix ... --no-audit --no-fund @deepseek-ai/dsh@<정확한 버전>`을 실행했다. npm cache도 `studio/dist/older-web/npm-cache`로 지정했다.
2. 원본 checkout의 Studio·루트 node_modules를 읽기 전용 링크로 재사용했다. 링크 및 생성물은 새 worktree의 `studio/` 아래에만 두었다.
3. `npm --prefix studio run build`: Host/Client 타입 검사와 Studio 번들 빌드 통과.
4. `STUDIO_PACK_DIST=dist/older-web/release node studio/pack.mjs`: 정상 패키지 생성.
5. 각 버전에서 `DSH_HOME=<각 격리 디렉터리>/home`을 지정하고 `--profile verify --from-default-profile web --dump-config`로 새 프로필 생성, `plugin --profile verify add <동일 tgz>`로 설치.
6. `--profile verify --host 127.0.0.1 --port 19388 --no-open`으로 순차 기동. 각 서버가 출력한 별도 인증 URL을 네 검사에 전달했다. 검사 스크립트가 포트 19388을 요구하므로 첫 서버 종료 후 다음 서버를 실행했다.

서버는 managed background job으로 실행했으며 rc.2 `bash-6c6b865cdfb9425f`, alpha.2 `bash-69fb383ee8e94f6b` 모두 SIGTERM 종료 요청 후 결과를 회수했다. 최종 `lsof -nP -iTCP:19388 -sTCP:LISTEN`은 listener 없음(exit 1)을 확인했다. 기존 GUI `127.0.0.1:60250`과 사용자 프로필은 변경하지 않았다.

## 실행 결과

두 버전 모두 인증 cookie 획득 후 실제 Web HTTP RPC를 사용했다. mock RPC나 workspace Host를 사용한 결과가 아니다.

| 검사 | 0.2.0-rc.2 | 0.2.1-alpha.2 | 확인 범위 |
| --- | --- | --- | --- |
| [check-master-runtime.mjs](../../scripts/check-master-runtime.mjs) | 통과, 33 tools | 통과, 38 tools | Master 읽기 전용 보호, 파생 프리뷰·도구 설명·설정 override, 적용, 확장 추가·원복 |
| [check-optimized-runtime.mjs](../../scripts/check-optimized-runtime.mjs) | 통과 | 통과 | Master 우선 순서, Optimized 삭제 보호·복사 적용, 기본 catalog·프리뷰 |
| [check-session-roles-runtime.mjs](../../scripts/check-session-roles-runtime.mjs) | 통과 | 통과 | 실제 세션 생성, 역할 보기·편집·추가, 프리셋 불변, 세션 간 격리 |
| [check-role-runtime.mjs](../../scripts/check-role-runtime.mjs) | 통과 | 통과 | 역할 저장·편집·재적용·해제·복원, 모델 catalog |

기본 catalog의 도구 수는 rc.2에서 standard/ptc/minimal/cordis = **25/25/1/28**, alpha.2에서 **30/30/2/33**이었다. 각 런타임이 노출한 결과를 기록한 것이며 버전 사이 도구 수가 같다는 조건은 검증하지 않았다. 모델 catalog는 양쪽 모두 1 provider·2 models였으며 외부 모델을 호출하지 않았다.

역할 검사 두 개는 **LLM 자식을 시작하지 않는다**. 따라서 역할 설정 저장과 세션 편집은 확인했지만, rc.2의 `startContinuable` 및 alpha.2의 `startActivation`으로 실제 실행할 때 persona·toolFilter가 적용되는지는 이번에 확인하지 않았다.

## 실패 이력·미검증

- 첫 빌드는 원본 Studio node_modules만 링크했을 때 `zod`를 찾지 못해 TS2307 및 연쇄 타입 오류로 실패했다. 새 worktree의 Studio 전용 node_modules에 원본 루트 의존성 링크도 추가한 뒤 동일 빌드가 통과했다. 이는 검증 준비의 의존성 탐색 실패이며 제품 코드 수정은 하지 않았다. [초기 로그](../../dist/older-web/logs/build.log), [재시도 로그](../../dist/older-web/logs/build-retry.log).
- 런타임 설치·프로필 생성·플러그인 설치·Web 기동·8개 RPC 검사에서 실패는 없었다. 다만 설치는 무경고가 아니다. 양쪽 npm 로그에 `node-domexception@1.0.0` deprecated 경고와 5개 의존성(`dsh-subprocess-local`, `koffi`, `node-pty`, `@google/genai`, `protobufjs`)의 install scripts 미승인 경고가 있었다. 별도 승인·native 재빌드는 하지 않았으며 subprocess/PTY 실제 실행은 검증하지 않았다. [rc.2 설치 로그](../../dist/older-web/logs/install-rc2.log), [alpha.2 설치 로그](../../dist/older-web/logs/install-alpha2.log).
- 양쪽 `dsh plugin add`의 pnpm 로그에는 Studio의 런타임 peer 8개가 profile 의존성에서 missing이라는 경고가 있었다(`dsh-app-boot`, `dsh-typert-protocol`, `dsh-scope`, `dsh-system-prompt`, `dsh-tools`, `dsh-jobs`, `dsh-llm`, `cordis-plugin-include`). 설치 exit 0 및 이후 Web/RPC 통과를 함께 기록하며, 경고를 제거하기 위한 peer 추가 설치나 manifest 수정은 하지 않았다. [rc.2 플러그인 로그](../../dist/older-web/logs/plugin-rc2.log), [alpha.2 플러그인 로그](../../dist/older-web/logs/plugin-alpha2.log).
- 실제 브라우저 실행, Client bundle 평가·렌더링, 시각적 UI, 라이트·다크·좁은 화면 및 클릭 흐름은 미검증이다. 인증 URL 접근과 RPC 성공을 GUI 검증으로 표현하지 않는다. 별도 HTML 문서·정적 client bundle 응답 검사도 실행하지 않았다.
- Fresh/Fork 자식 실제 실행, persona·toolFilter enforcement, 부모 대화 상속, 프로세스 재시작 뒤 자식 cold resume은 미검증이다. 별도 plugin probe를 작성하지 않았다.
- 0.5→0.6 업그레이드, 기존 사용자 데이터 마이그레이션, 실제 사용자 프로필, 외부 DeepSeek/Jev 호출, Pixie Loop 전체 흐름, macOS 이외 OS는 미검증이다.
- 전체 단위 테스트를 다시 실행하지 않았다. 수행한 빌드 검사와 독립 런타임 RPC 검사를 구분한다. 기존 rc.1 문서의 전체 테스트 결과를 이번 실행 결과로 재사용하지 않는다.
- 코어 수정·전체 빌드·코드 수정·커밋·푸시·배포는 하지 않았다. 원본의 기존 untracked 문서는 보존했다.

## 로컬 증거

아래 생성물은 `studio/dist`의 Git 제외 대상이며 최종 배포물이 아니다. 서버 로그에는 종료된 테스트 서버의 인증 token이 있으므로 공유 시 제거한다.

- 런타임 잠금: [rc.2 package-lock](../../dist/older-web/rc2/package-lock.json), [alpha.2 package-lock](../../dist/older-web/alpha2/package-lock.json)
- RPC 로그: [rc.2 Master](../../dist/older-web/logs/rc2-master.log), [Optimized](../../dist/older-web/logs/rc2-optimized.log), [세션 역할](../../dist/older-web/logs/rc2-session-roles.log), [역할](../../dist/older-web/logs/rc2-role.log)
- RPC 로그: [alpha.2 Master](../../dist/older-web/logs/alpha2-master.log), [Optimized](../../dist/older-web/logs/alpha2-optimized.log), [세션 역할](../../dist/older-web/logs/alpha2-session-roles.log), [역할](../../dist/older-web/logs/alpha2-role.log)

최종 문서 이외 tracked 소스 변경은 없으며 `git diff --check`를 통과했다.

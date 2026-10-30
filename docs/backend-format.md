# Java 포맷 규칙과 실행 방법

Java 소스는 Spotless 8.10.4와 google-java-format 1.24.0의 AOSP 스타일로 통일한다. 들여쓰기는 공백 4칸이며 줄바꿈·중괄호·import 순서는 포맷터 결과를 따른다. 사용하지 않는 import, 줄 끝 공백, 파일 끝 개행도 정리한다. 버전과 규칙은 backend/build.gradle에 고정한다.

## 명령

저장소 루트에서 실행한다. Java 21이 필요하며 포맷 작업에는 Docker가 필요 없다.

| 명령 | 동작 |
| --- | --- |
| `pnpm backend:format:check` | src 아래 Java 파일 검사. 원본을 고치지 않으며 위반 시 실패 |
| `pnpm backend:format` | 같은 Java 파일의 포맷 자동 수정 |
| `pnpm check` | backend 변경 시 포맷 검사 후 DB 테스트. Docker 중단이어도 포맷 검사는 먼저 수행 |
| `pnpm check:all` | 전체 검사에 백엔드 포맷 포함 |

Gradle의 check/build에도 spotlessCheck가 연결되므로 기존 GitLab backend build 잡에서도 포맷 위반을 잡는다. 검사는 코드를 자동 수정하지 않는다. IDE 포맷 설정이 달라도 커밋 전 위 명령의 결과로 맞춘다.

대상은 backend/src/**/*.java이며 Gradle·SQL·YAML·생성된 build 디렉터리는 이번 포맷 범위에 포함하지 않는다. 기존 Java 파일도 같은 규칙으로 한 번 정리했다. 편집할 때마다 모든 Java 파일을 고치는 훅은 추가하지 않고 명시적인 수정 명령을 사용한다.

## 위반 시

오류에 나온 파일을 확인하고 `pnpm backend:format` → `pnpm backend:format:check`를 실행한다. 형식만 바뀐 diff인지 검토한다. 구조 작업 등 다른 브랜치와 같은 Java 파일을 병합한 경우에도 같은 순서로 포맷을 확인한다.

참고: [Spotless Gradle 문서](https://github.com/diffplug/spotless/blob/main/plugin-gradle/README.md), [Gradle 플러그인](https://plugins.gradle.org/plugin/com.diffplug.spotless/8.10.4).

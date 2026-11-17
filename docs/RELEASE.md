# 버전과 릴리즈

기능 추가는 minor, 수정은 patch 버전을 올립니다. 아직 0.x 단계입니다.

1. 배포 대상으로 검증한 변경만 CHANGELOG.md의 날짜가 있는 새 버전 섹션으로 옮깁니다. 미병합 PR은 제외합니다. 날짜는 실제 달력 날짜의 `YYYY-MM-DD` 형식이며, 제목·주석만 남기지 말고 실제 변경 내용을 기록합니다. `node scripts/release-notes.mjs`로 게시 전 검증할 수 있습니다.
2. package.json과 package-lock.json 루트 버전을 함께 갱신합니다. npm publish는 하지 않습니다.
3. PR에서 lint, typecheck, npm test, build 및 변경 범위에 맞는 QA를 검증합니다.
4. 승인된 버전 PR을 main에 머지하면 Release workflow가 검증을 다시 실행하고 해당 커밋의 버전 태그와 GitHub Release를 게시합니다.
5. Release 본문은 CHANGELOG의 해당 버전만 사용합니다. 기존 Release는 수정하거나 기존 태그를 이동하지 않습니다.
6. 태그와 Release, 워크플로 결과를 확인합니다. 실패 시 같은 커밋의 실패 워크플로를 재실행할 수 있으며 새 버전을 임의로 만들지 않습니다.

v0.1.0은 기존 문서에 기록만 남은 초기 코드이며 당시 태그나 Release는 없었습니다. 과거 게시일이나 검증 결과를 소급해 만들지 않습니다. v0.2.0부터 검증된 버전별 태그와 게시물을 관리합니다.

운영 배포 성공과 전체 기능 검증은 별개입니다. 모바일 실기기, 한글 앱, PDF 인쇄 등 수행하지 않은 QA와 알려진 제한은 각 버전 노트에 기록합니다.

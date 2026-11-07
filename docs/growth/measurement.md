# 검색 유입 개선 측정

## 확인한 기준선과 한계

기존 운영 홈·robots.txt·sitemap.xml은 공개 HTTP 확인에서 200이었고, title·description·Open Graph·www canonical·GA4 계측은 이미 있었다. 사이트맵은 홈 URL 한 개였다. 이는 검색 색인 상태나 방문자 수를 뜻하지 않는다. www/non-www 모두 200이며 IndexedDB가 origin별이므로 데이터 이전 없이 강제 리디렉션하지 않는다.

실제 방문자·검색 노출 보고서는 확보하지 못했다. GitHub 별 수나 HTTP 성공, 검색 결과 부재로 트래픽 또는 미색인을 추정하지 않는다. 작업별 실용 가이드가 검색 유입과 사용 시작을 높일 것이라는 가설을 검증한다. 증가율을 보장하지 않는다.

## 기존 GA4에서 비교

배포 전후 연속 7일을 같은 시간대로 비교한다. 사용자·세션, organic search/direct/referral을 구분하고 랜딩 페이지 `/`, `/guides`, `/guides/*`를 확인한다.

- `editor_start`: 고정 `entry_action`(new/sample/import-hwp/import-markdown), 고정 `entry_source`(home/direct/guide slug)
- 기존 `import` + `event_label`(hwp/markdown)
- 기존 `export` + `event_label`(hwp/markdown)

새 추적 서비스는 없다. 파일명·본문·임의 query 값은 새 이벤트에 포함하지 않는다. `editor_start`는 의도/진입이며 변환 성공이 아니다. HWPX export는 생성 완료 시 발생한다. PDF 저장 성공 여부는 브라우저가 알려주지 않으므로 성공으로 계측하지 않는다. 광고 차단 등으로 누락될 수 있다.

## 검색 보고서와 배포 확인

Search Console 또는 기존 검색 관리자 접근이 있을 때만 노출·클릭·CTR·평균 위치·색인·sitemap 상태를 확인한다. 접근 확대 없이 측정 한계를 보고한다. 단기 사용 시작과 변환 오류를 먼저 확인하고 검색 유입은 색인 지연을 고려한다.

배포 시 정확한 commit/CI, 운영 가이드 5개와 sitemap의 HTTP/고유 metadata/링크, 문서 유지·취소·새로고침·뒤로가기 흐름을 검증한다. 문서 콘텐츠는 테스트 전용 예제를 사용한다.

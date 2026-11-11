# 배포 설정

`main` 머지는 Vercel의 운영 배포를 시작합니다. PR preview와 CI를 먼저 확인합니다.

## 단일 리전

`vercel.json`의 `regions: ["icn1"]`은 서울 리전 하나를 지정합니다. 여러 함수 리전을 지정하면 Pro 또는 Enterprise 요금제가 필요하므로 무료 플랜에서도 배포할 수 있도록 저장소에 명시합니다. 기존 실패 배포에는 `iad1`과 `icn1`이 함께 지정되어 `upgrade_required` 오류가 발생했습니다.

이 설정은 함수 실행 리전에만 적용됩니다. 정적으로 생성하는 홈·가이드와 정적 파일의 CDN 제공, 브라우저 안에서 처리하는 변환과 IndexedDB 저장은 바꾸지 않습니다. 서버에서 실행하는 경로는 서울 리전을 사용하므로 먼 지역에서는 지연이 늘 수 있습니다. 다중 리전 장애 대응은 제공하지 않습니다.

요금제, 도메인, Deployment Protection 및 팀 권한은 이 변경으로 수정하지 않습니다. www/non-www 강제 이동도 추가하지 않습니다. 사용자 로컬 문서는 origin별이므로 별도 이전 계획 없이 도메인 이동을 강제하면 안 됩니다.

참고: https://vercel.com/docs/functions/configuring-functions/region

## 배포 확인

1. PR의 정확한 commit SHA에서 lint, typecheck, tests, build가 통과하는지 확인합니다.
2. 같은 SHA의 Vercel preview가 Ready인지 확인하고 실제 화면·문서 작업을 검증합니다.
3. Squash merge 후 운영 배포가 Ready인지와 mdview.kr의 홈·가이드·사이트맵을 확인합니다.
4. 실패 시 원인을 기록하고 배포 완료로 보고하지 않습니다. 보호 설정 완화나 유료 업그레이드를 자동으로 적용하지 않습니다.

# 보안 정책

MDView의 보안을 진지하게 다루고 있습니다. 취약점을 발견하셨다면 책임 있는 공개(responsible disclosure)에 협력해 주시기 바랍니다.

## 지원 버전

현재 0.x 개발 단계로, 최신 minor 버전만 지원합니다.

| 버전 | 지원 |
|------|------|
| 0.1.x | ✅ 보안 패치 제공 |
| < 0.1 | ❌ 미지원 |

1.0 정식 릴리즈 이후부터는 최신 메이저와 그 직전 메이저 1개를 지원할 예정입니다.

## 취약점 신고

### 🔒 공개 이슈로 신고하지 마세요

보안 취약점은 패치가 배포되기 전까지 공개되면 사용자에게 위험이 됩니다. 다음 비공개 채널 중 하나를 사용해 주세요.

### 권장 채널 (선호)

**GitHub Private Vulnerability Reporting**:
👉 [https://github.com/revfactory/mdview/security/advisories/new](https://github.com/revfactory/mdview/security/advisories/new)

GitHub 계정으로 비공개 신고가 가능합니다. 메인테이너만 볼 수 있으며, 패치와 공개 일정 협의가 같은 화면에서 이루어집니다.

### 신고 시 포함할 정보

가능한 한 다음을 포함해 주세요. 일부만 있어도 OK 입니다:

- **취약점 종류** (XSS, CSRF, 인증 우회, 의존성 취약점 등)
- **영향 받는 컴포넌트/파일 경로**
- **재현 절차** (단계별 + 가능하면 PoC)
- **영향도** (어떤 사용자에게 어떤 피해)
- **제안하는 완화 방안** (선택)

## 응답 SLA

| 단계 | 응답 시간 |
|------|----------|
| 접수 확인 | 영업일 기준 **3일** 이내 |
| 영향 평가 + 분류 | **14일** 이내 |
| 패치 릴리즈 | 영향도에 따라 **30~90일** |

영향도가 높은(critical) 취약점은 우선 처리합니다. 패치 일정이 지연될 경우 신고자에게 진행 상황을 공유합니다.

## 책임 있는 공개

다음에 협력해 주시기 바랍니다:

1. 패치가 릴리즈되기 전까지 취약점을 **비공개** 로 유지
2. 사용자가 업데이트할 시간을 위해 공개를 협의된 시점까지 유보
3. 신고자가 원할 경우 [GitHub Security Advisory](https://github.com/revfactory/mdview/security/advisories) 에 **credit** 됩니다

## 보안 모범 사례 (사용자용)

MDView는 로컬-우선(local-first) 앱으로 모든 데이터가 브라우저 IndexedDB에 저장됩니다. 다음 사항을 권장합니다:

- **항상 최신 버전 사용** — 보안 패치는 latest minor 에 우선 제공됩니다
- **신뢰할 수 있는 HWP/MD 파일만 임포트** — HWP 파서는 알려진 포맷에 한해 안전합니다
- **자체 호스팅 시** — HTTPS 사용 권장, CSP 헤더 설정 고려
- **PWA 사용 시** — 브라우저 보안 설정을 변경하지 마세요

## 의존성 보안

- [Dependabot](https://github.com/dependabot) 으로 주간 의존성 업데이트 모니터링
- [CodeQL](https://codeql.github.com/) 정적 분석을 매주 실행
- 알려진 취약 의존성(`npm audit` 결과 high/critical)은 우선순위로 처리

## English Summary

Please **do not report security vulnerabilities through public GitHub issues**. Use [GitHub Private Vulnerability Reporting](https://github.com/revfactory/mdview/security/advisories/new) instead.

We aim to acknowledge reports within **3 business days**, assess impact within **14 days**, and release patches within **30~90 days** based on severity. Reporters can be credited in the published advisory if they wish.

Thank you for helping keep MDView and its users safe.

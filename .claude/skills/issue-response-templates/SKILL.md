---
name: issue-response-templates
description: GitHub Issues 응답 코멘트 작성 템플릿 스킬. 분류 통보, 추가 정보 요청, 질문 답변, 기능 요청 검토 의견, PR 진행 알림, 종료(duplicate/wontfix) 사유 등 6가지 한국어 응답 템플릿을 제공한다. 트리거 - 이슈 응답 작성, 코멘트 템플릿, 트리아지 응답, 추가 정보 요청, 기능 검토 답변, close 사유 코멘트.
---

# Issue Response Templates — 한국어 응답 템플릿

issue-responder 가 사용하는 표준 응답 템플릿 모음. 톤은 친절·명확·다음 단계 명시.

## 공통 원칙

1. **감사 인사로 시작** — 신고/제안에 대한 감사
2. **분류·이해 확인** — "어떤 카테고리로 이해했다"
3. **다음 단계 명시** — "그래서 이 이슈는 앞으로 어떻게 되나?"
4. **링크** — 관련 코드/이슈/PR/문서
5. **약속하지 않기** — 일정·기능 보장은 신중하게

영어 사용자에게는 같은 골격으로 영어 응답. 본문 한국어 + 짧은 영어 요약도 가능.

## 템플릿 1: 분류 완료 통보 (트리아지 직후)

```markdown
보고해 주셔서 감사합니다! 🙏

이 이슈를 다음과 같이 분류했습니다:
- 카테고리: **{bug | enhancement | question | ...}**
- 영역: `{area:hwp}`
- 우선순위: `{priority:medium}`

{다음 단계 한 문단}

진행 상황은 이 이슈에 계속 업데이트 드리겠습니다.
```

**다음 단계 예시:**
- bug + 재현 시도: "현재 재현을 시도하고 있습니다. 결과가 나오는 대로 공유드리겠습니다."
- enhancement + 검토 대기: "[MDVIEW_SPEC.md](../MDVIEW_SPEC.md) 범위와 우선순위를 검토한 뒤 다음 주 내로 의견 드리겠습니다."
- question + 답변 작성 예고: "사용법 답변을 별도 코멘트로 정리해 드리겠습니다."

---

## 템플릿 2: 추가 정보 요청 (needs-info)

```markdown
보고해 주셔서 감사합니다! 🙏

문제를 재현해 보려고 시도했는데, 다음 정보가 더 필요합니다:

- [ ] 사용 중인 브라우저와 버전 (예: Chrome 130, Safari 17)
- [ ] OS 와 버전 (예: macOS 14.5, Windows 11)
- [ ] MDView 버전 또는 commit hash
- [ ] {이슈별 특화 요청 - 예: 문제가 발생한 HWP 파일, 콘솔 로그 등}

가능한 한 자세히 알려주시면 빠르게 원인을 찾을 수 있습니다. 30일 동안 추가 정보가 없으면 자동으로 close 될 수 있으니, 시간이 되실 때 답변 부탁드립니다.
```

영문 버전:
```markdown
Thanks for the report! 🙏

I tried to reproduce this but need a bit more info:

- [ ] Browser + version
- [ ] OS + version
- [ ] MDView version or commit
- [ ] {issue-specific: file attachment, console log, ...}

The more detail you can provide, the faster we can investigate. This issue may auto-close after 30 days of inactivity, so please reply when you have a moment.
```

---

## 템플릿 3: 질문 답변

```markdown
좋은 질문 감사합니다! 

{답변 본문 - 핵심 먼저, 배경 다음}

관련 코드: [`src/path/to/file.ts:42`](../blob/main/src/path/to/file.ts#L42)
관련 문서: [`docs/{...}`](../{...})

더 궁금한 점이 있으시면 같은 이슈에 추가 코멘트 부탁드립니다.
```

**Do:**
- 핵심 답을 첫 줄에
- 코드 위치 / 문서 / 관련 이슈 링크
- 사용자 후속 질문 환영 톤

**Don't:**
- "음... 그건 ~한 것 같은데요" 같은 모호한 답
- 코드 덤프 (요점만, 자세한 건 링크)

---

## 템플릿 4: 기능 요청 검토 의견

```markdown
제안 감사합니다! 💡

이 기능을 검토해 봤습니다:

**스펙 부합도**: {MDVIEW_SPEC.md 의 in_scope / future_considerations / out_of_scope 중 어디인지}

**예상 영향**: {긍정 / 우려 사항}

**의견**:
{채택 / 채택 보류 / 추가 논의 필요 - 사유와 함께}

**다음 단계**:
- {예: 0.2.0 마일스톤에 포함 검토 → `gh issue edit --milestone v0.2.0`}
- {또는: 디자인 토론 필요 → 이슈에서 계속}
- {또는: `good first issue` 라벨 부여, 외부 기여 환영}

직접 PR을 작성하실 의향이 있으시면 [CONTRIBUTING.md](../CONTRIBUTING.md) 를 참고해 주세요. 메인테이너와 협업해서 진행하는 것도 환영입니다.
```

---

## 템플릿 5: PR 진행 알림

```markdown
이 이슈를 수정하는 PR을 작성했습니다: #{PR-NUMBER}

**변경 요약**: {한 문장}

**검증**: lint / typecheck / build 통과, 수동 시나리오 확인

리뷰 후 머지되면 이 이슈는 자동으로 close 됩니다. 다음 릴리즈({version})에 포함될 예정입니다.

PR에서 함께 리뷰해주시면 감사하겠습니다.
```

---

## 템플릿 6: 종료 사유

### 6a. duplicate

```markdown
보고 감사합니다. 

이 이슈는 #{원본-N} 와 동일한 문제로 보여 중복 처리하겠습니다. 진행 상황은 원본 이슈에서 추적해 주세요.

원본 이슈의 진행 상황을 받아보시려면 #{원본-N} 페이지 우측 상단의 "Subscribe" 를 눌러주세요.
```

### 6b. wontfix

```markdown
제안 감사합니다.

검토 결과, 이 요청은 다음 이유로 현재 채택이 어렵습니다:

{사유 - 예: 스펙 범위 외 / 다른 기능과 상충 / 유지보수 비용 과대}

대안:
- {예: 비슷한 동작을 가진 기존 기능 X}
- {예: 추후 1.0 이후 재검토 - `future_considerations` 참조}

다른 형태의 제안이나 사용 사례 공유는 언제든 환영합니다.
```

### 6c. completed (PR 머지 후 자동 close 가 아닌 경우)

```markdown
{이 이슈의 핵심 변경 요약}이 #{PR-N} 에서 머지되었습니다.

다음 릴리즈({version}) 에 포함될 예정입니다. 사용해 보시고 추가 이슈가 있으면 새 이슈로 보고해 주세요.

기여해 주셔서 감사합니다! 🎉
```

---

## 톤 가이드

| 상황 | 톤 키워드 |
|------|----------|
| 첫 응답 | 감사·환영 |
| 추가 정보 요청 | 부드럽게, 부담 줄이기 |
| 기능 거절(wontfix) | 정중·대안 제시 |
| 패치 진행 | 진행 상황 투명 공유 |
| 머지/종료 | 축하·감사 |

## 자주 하는 실수

- "곧 고칠게요" → 일정 약속 회피
- 너무 사무적("확인했음") → 친근하게
- 답만 있고 다음 단계 없음 → 사용자 혼란
- 코드 덤프 → 링크와 요점만
- 한국어 이슈에 영어 답 → 신고자 언어에 맞춤

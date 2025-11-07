# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a nurse scheduling application built with React 19, TypeScript, and Vite. The project is in its early stages with a minimal Vite + React setup.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server with HMR
npm run preview      # Preview production build locally
```

### Building
```bash
npm run build        # Type-check with TypeScript and build for production
```

The build process runs `tsc -b` for type checking before `vite build`. Both must pass for a successful build.

### Code Quality
```bash
npm run lint         # Run ESLint on all TypeScript/TSX files
```

## TypeScript Configuration

The project uses TypeScript project references with two separate configs:
- `tsconfig.app.json`: Application code in `src/` (strict mode enabled)
- `tsconfig.node.json`: Build tooling and configuration files

The main `tsconfig.json` orchestrates these references. When type-checking, both configs are validated.

TypeScript strict mode is enabled with additional strict linting rules:
- `noUnusedLocals`
- `noUnusedParameters`
- `noFallthroughCasesInSwitch`
- `noUncheckedSideEffectImports`
- `erasableSyntaxOnly`

## ESLint Configuration

Uses flat config format (`eslint.config.js`) with:
- `@typescript-eslint/eslint-plugin` for TypeScript rules
- `eslint-plugin-react-hooks` for React Hooks rules
- `eslint-plugin-react-refresh` for Vite Fast Refresh compatibility

The configuration targets `**/*.{ts,tsx}` files and ignores the `dist` directory.

## Architecture

### Entry Point
- `src/main.tsx`: Application entry point that renders the root `<App />` component wrapped in `<StrictMode>`

### Module System
- Uses ES modules (`type: "module"` in package.json)
- Vite handles bundling with React plugin for Fast Refresh
- TSX files use `jsx: "react-jsx"` transform (no React import needed)

### Development Philosophy
This is a nurse scheduling application that automatically generates 4-week schedules while respecting complex constraints. The system handles:
- Schedule management components
- Nurse shift assignment logic with constraint validation
- Calendar/timeline visualizations
- Automatic schedule generation algorithms

---

## 🎨 Working Style Guidelines

### Communication
- **언어**: 한국어로 대화하고 코드 주석도 한국어로 작성
- **설명 스타일**: 구현 내용을 체계적으로 정리하여 번호 매기고 설명
- **파일 위치 표기**: 수정한 코드의 위치를 파일경로:라인번호 형식으로 표기 (예: `src/utils/scheduler.ts:77-90`)

### Task Management
- **TodoWrite 도구 적극 활용**
  - 작업 시작 전: 할 일 목록 작성
  - 작업 중: 현재 진행 중인 작업 상태 업데이트
  - 작업 완료 후: 즉시 완료 처리 (배치 처리 금지)
- **한 번에 하나의 작업만 in_progress 상태로 유지**

### Documentation
- **SPEC.md 업데이트 필수**
  - 중요한 기능 구현 후 항상 SPEC.md에 내용 정리
  - 완료된 기능은 ✅로, 진행 중인 기능은 🚧로 표시
  - 알고리즘 순서, 함수 설명, 파일 구조 등 상세 기록
- **CLAUDE.md가 컨텍스트 유지의 핵심**
  - 새 세션 시작 시 SPEC.md와 CLAUDE.md를 읽고 프로젝트 상황 파악

### Development Process
1. **요구사항 확인**: 사용자 요청을 정확히 이해
2. **계획 수립**: TodoWrite로 작업 계획 작성
3. **점진적 구현**: 한 번에 하나씩 구현
4. **즉시 테스트**: 구현 후 즉시 동작 확인
5. **문서화**: SPEC.md 업데이트
6. **사용자 피드백**: 테스트 방법 제시하고 확인 요청

### Coding Standards
- **주석**: 모든 주석은 한국어로 작성
- **함수 문서화**: 복잡한 함수는 상단에 역할 설명 주석 추가
- **타입 안전성**: TypeScript strict mode 준수
- **검증과 구현 동시 진행**: 새 기능 구현 시 validator.ts에 검증 로직도 함께 추가

### Constraint Implementation Strategy
이 프로젝트는 **하드 제약 조건**을 하나씩 확실하게 구현하는 것이 핵심입니다.

#### 접근 방식
1. **검증 먼저**: validator.ts에 제약 조건 검증 로직 구현
2. **생성 로직 개선**: scheduler.ts에 제약 조건을 만족하도록 생성 로직 수정
3. **시각적 피드백**: UI에서 위반 사항을 빨간 테두리로 표시
4. **테스트 철저히**: 각 제약 조건이 정말 만족되는지 확인 후 다음으로 진행

#### 구현 순서
- 간단한 것부터: UI 기능 → 기본 제약 → 복잡한 제약
- 예: 고정 셀 기능 → 주간 휴식 규칙 → 나이트 근무 규칙

#### ⚠️ 중요: AND 조건
**모든 하드 제약 조건은 AND 조건으로 동시에 만족해야 합니다.**
- ❌ 잘못된 접근: 한 제약을 만족하기 위해 다른 제약을 완화
- ❌ 잘못된 접근: 2단계 할당 (엄격한 규칙 → 완화된 규칙)
- ✅ 올바른 접근: 모든 제약을 동시에 만족하는 할당 조건 설계

예시: M과 E 근무 할당 시
- 일일 필수 인원을 채우기 위해 근무 순서 규칙을 완화하면 안 됨
- 대신 "휴일 후 순서 초기화" 규칙을 정확히 구현해야 함
- 휴일(OFF, WEEK_OFF, ANNUAL, MENSTRUAL) 후에는 어떤 근무든 시작 가능

### Code Organization Principles
- **관심사 분리**
  - `types.ts`: 타입 정의만
  - `constants.ts`: 상수만
  - `scheduler.ts`: 스케줄 생성 알고리즘만
  - `validator.ts`: 제약 조건 검증만
  - Components: UI 렌더링과 이벤트 처리만

- **함수는 단일 책임**
  - 각 검증 함수는 하나의 제약 조건만 체크
  - 함수명으로 역할이 명확히 드러나도록

### Testing Approach
구현 완료 후 항상 다음 형식으로 테스트 방법 제시:

```
## 🧪 테스트 방법

1. [어디서] - [무엇을] 확인
2. [어떤 결과]를 기대
3. [문제가 있다면] 어떻게 확인
```

### File Reference Format
코드 수정 설명 시 항상 파일 위치 표기:
- ✅ 좋은 예: "주휴일 배정 로직 추가 (src/utils/scheduler.ts:77-90)"
- ❌ 나쁜 예: "scheduler 파일에 코드 추가했어요"

---

## 📂 Project Structure

```
src/
├── types.ts                    # 타입 정의 (ShiftType, Nurse, ScheduleCell 등)
├── constants.ts                # 상수 정의 (일일 필요 인원, 근무 순서 등)
├── App.tsx                     # 메인 앱 (탭 관리)
├── components/
│   ├── NurseManagement.tsx     # 간호사 관리 UI (인라인 편집)
│   └── ScheduleView.tsx        # 스케줄 뷰 UI (셀 클릭, 자동 생성)
├── utils/
│   ├── scheduler.ts            # 스케줄 생성 알고리즘
│   └── validator.ts            # 제약 조건 검증
└── styles/
    ├── NurseManagement.css
    └── ScheduleView.css
```

## 🔍 Key Concepts

### Week Definition
**1주는 일요일부터 토요일까지입니다.**
- 주 시작: 일요일 (SUN)
- 주 종료: 토요일 (SAT)
- 주휴일: 각 간호사가 지정한 요일 (SUN~SAT 중 1일)

### Shift Order Rule
근무는 정해진 순서를 따라야 하며 역순 불가:
- 허용: D → M → E → N → 휴일
- 같은 근무 연속 가능: D → D → D
- 건너뛰기 가능: D → E, M → N
- ❌ 역순 불가: E → D, N → E, E → M

### Fixed Cells
- 주휴일(WEEK_OFF)은 자동으로 고정 (isFixed: true)
- 고정된 셀은 검은 테두리로 표시
- 클릭해도 변경 불가
- 자동 생성 시 고정 셀은 유지

### Constraint Types
- 🔴 **하드 제약**: 반드시 지켜야 함 (위반 시 빨간 테두리)
- 🟡 **소프트 제약**: 권장 사항 (위반해도 경고만)

---

## 💡 Implementation Notes

### Current Status
자세한 구현 상태는 `SPEC.md` 참조. 주요 완료 항목:
- ✅ 일일 필수 인원 충족 (D:3, M:1, E:3, N:2)
- ✅ 근무 순서 규칙 준수 (D→M→E→N)
- ✅ 연속 근무일 제한 (최대 5일)
- ✅ 주휴일 자동 배정 및 고정
- ✅ 실시간 제약 조건 검증
- ✅ 셀 레이블 표시 개선 (OFF, WO, A, 생휴)
- ✅ 주 구분선 (일요일 왼쪽 굵은 세로선)
- ✅ 재생성 버튼 (여러 번 클릭 가능)
- ✅ 휴일 후 근무 순서 초기화
- ✅ UI 색상 개선 (색약 고려)
- ✅ 필수 인원 미충족/초과 시 강조 표시

### Remaining Tasks
- 🚧 나이트 근무 규칙 (2-3일 연속, 2일 휴식, 2주 연속 금지)
- 🚧 주간 최소 휴일 검증 (주휴 1일 + OFF 1일 이상)
- 🚧 우클릭 고정/해제 기능

### Recent Bug Fixes & Lessons Learned

#### 1. 셀 레이블 개선 (src/types.ts:59-68)
- **문제**: OFF, 주휴, 연차 등이 빈칸이나 한 글자로 표시되어 가독성 저하
- **해결**: SHIFT_TYPE_SHORT_LABELS 추가 (OFF, WO, A, 생휴)
- **참고**: src/components/ScheduleView.tsx:252에서 사용

#### 2. 주 구분선 추가 (src/styles/ScheduleView.css:185-188)
- **기능**: 일요일 왼쪽에 굵은 세로선으로 1주 단위 구분
- **구현**: .week-start 클래스 (border-left: 3px solid #000000)
- **적용**: 헤더, 본문, 푸터 모든 일요일 셀에 적용

#### 3. 푸터 카운트 표시 버그 (src/components/ScheduleView.tsx:276, 291, 306, 321)
- **문제**: `{count || ''}` 로직으로 0이 빈칸으로 표시됨
- **해결**: `{count}` 로 변경하여 0도 정상 표시
- **교훈**: falsy 값 처리 시 0을 고려해야 함

#### 4. 재생성 버튼 (src/components/ScheduleView.tsx:169)
- **요구사항**: 여러 번 스케줄 생성해서 테스트하고 싶음
- **해결**: 버튼 텍스트를 조건부로 변경 (schedule.length > 0 ? '재생성' : '자동 생성')
- **추가**: 랜덤 정렬로 매번 다른 스케줄 생성 (src/utils/scheduler.ts:64)

#### 5. 필수 인원 미충족 문제 (src/utils/scheduler.ts:147-150, 172-175)
- **문제**: M과 E 근무가 충분히 할당되지 않아 필수 인원 미충족
- **원인**: M과 E 할당 조건이 너무 엄격 (휴일 후 근무 순서 초기화 규칙 누락)
- **해결**: 휴일(OFF, WEEK_OFF, ANNUAL, MENSTRUAL) 후에는 M, E도 시작 가능하도록 조건 추가
- **교훈**: SPEC의 "휴일 후 순서 초기화" 규칙을 정확히 구현해야 모든 제약 동시 만족

#### 6. AND 조건 오해 방지
- **잘못된 시도**: 2단계 할당 (엄격한 규칙 → 완화된 규칙)으로 필수 인원 채우기
- **사용자 피드백**: "하드 제약 조건은 and조건이야. 하나만 만족하고 다른 것은 만족하지 않으면 안돼"
- **올바른 해결**: 할당 조건을 수정하여 모든 제약을 동시에 만족하도록 구현

#### 7. UI 색상 개선 - 색약 고려 (src/constants.ts:37-46)
- **요구사항**: 색약 사용자를 위한 명확한 색상 구분
- **문제**: 이브닝(파란색)과 나이트 색상이 구분 어려움
- **해결**:
  - D: 밝은 노란색 (#fbbf24)
  - M: 진한 분홍색 (#ec4899)
  - E: 진한 파란색 (#3b82f6)
  - N: 진한 자주색 (#9333ea) - 파란색과 명확히 구분
  - 모든 휴무: 진한 주황색 (#f97316) 통일
- **교훈**: 접근성 고려는 필수, 색상 대비 최대화

#### 8. 필수 인원 카운트 표시 강조 (src/styles/ScheduleView.css:230-264)
- **요구사항**: 미충족/초과 시 더 눈에 띄게 강조
- **문제**: 기존 색상이 너무 연해서 주의를 끌지 못함
- **해결**:
  - error(부족): 진한 빨간색 배경 + 흰색 텍스트 + 두꺼운 테두리 + 맥동 애니메이션
  - warning(초과): 진한 주황색 배경 + 흰색 텍스트 + 두꺼운 테두리 + 맥동 애니메이션
  - 2초 주기 맥동 효과로 자연스럽게 주의 환기
- **교훈**: 중요한 정보는 애니메이션으로 지속적인 주의 환기

### When Starting a New Session
1. Read `SPEC.md` to understand project requirements and current implementation status
2. Read `CLAUDE.md` (this file) to understand working style
3. Ask user where to continue from
4. Update `SPEC.md` after completing significant features

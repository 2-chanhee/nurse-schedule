// 근무 타입 정의
export type ShiftType = 'D' | 'M' | 'E' | 'N' | 'OFF' | 'WEEK_OFF' | 'ANNUAL' | 'MENSTRUAL';

// 요일 타입 (일~토)
export type DayOfWeek = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

// 간호사 인터페이스
export interface Nurse {
  id: string;
  name: string;
  weekOffDay: DayOfWeek; // 주휴일 (일~토 중 1일)
}

// 스케줄 셀 인터페이스
export interface ScheduleCell {
  nurseId: string;
  date: string; // YYYY-MM-DD 형식
  shiftType: ShiftType;
  isFixed: boolean; // 고정 여부 (우클릭으로 설정)
}

// 일일 근무 인원 카운트
export interface DailyShiftCount {
  date: string;
  D: number;
  M: number;
  E: number;
  N: number;
}

// 제약 조건 위반 정보
export interface Violation {
  type: 'HARD' | 'SOFT';
  nurseId: string;
  nurseName: string;
  date: string;
  message: string;
}

// 검증 결과
export interface ValidationResult {
  isValid: boolean;
  violations: Violation[];
}

// 근무 타입 한글명 매핑
export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  D: '데이',
  M: '중간',
  E: '이브닝',
  N: '나이트',
  OFF: '오프',
  WEEK_OFF: '주휴',
  ANNUAL: '연차',
  MENSTRUAL: '생휴',
};

// 스케줄 표 셀에 표시할 짧은 레이블
export const SHIFT_TYPE_SHORT_LABELS: Record<ShiftType, string> = {
  D: 'D',
  M: 'M',
  E: 'E',
  N: 'N',
  OFF: 'OFF',
  WEEK_OFF: 'WO',
  ANNUAL: 'A',
  MENSTRUAL: '생휴',
};

// 요일 한글명 매핑
export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  SUN: '일',
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
};

// 요일 배열 (일~토 순서)
export const DAYS_OF_WEEK: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

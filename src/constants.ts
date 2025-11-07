import type { ShiftType } from './types';

// 일일 필수 인원
export const DAILY_REQUIRED_STAFF: Record<ShiftType, number> = {
  D: 3,          // 데이: 3명
  M: 1,          // 중간: 1명
  E: 3,          // 이브닝: 3명
  N: 2,          // 나이트: 2명
  OFF: 0,        // 오프: 제한 없음
  WEEK_OFF: 0,   // 주휴: 제한 없음
  ANNUAL: 0,     // 연차: 제한 없음
  MENSTRUAL: 0,  // 생휴: 제한 없음
};

// 총 필수 근무 인원 (D + M + E + N)
export const TOTAL_REQUIRED_STAFF = 9;

// 나이트 근무 규칙
export const NIGHT_SHIFT_MIN_DAYS = 2; // 나이트 최소 연속 일수
export const NIGHT_SHIFT_MAX_DAYS = 3; // 나이트 최대 연속 일수
export const NIGHT_SHIFT_REST_DAYS = 2; // 나이트 후 필수 휴식 일수

// 연속 근무 제한
export const MAX_CONSECUTIVE_WORK_DAYS = 5; // 최대 연속 근무일

// 주간 휴식 규칙
export const WEEKLY_MIN_REST_DAYS = 2; // 주당 최소 휴일 (주휴 1일 + OFF 1일)
export const WEEKLY_WEEK_OFF_DAYS = 1; // 주당 주휴일 (정확히 1일)

// 근무 순서 (정방향만 가능, 역순 불가)
export const SHIFT_ORDER: ShiftType[] = ['D', 'M', 'E', 'N'];

// 셀 클릭 시 순환 순서
export const SHIFT_CYCLE: ShiftType[] = ['D', 'M', 'E', 'N', 'OFF', 'WEEK_OFF', 'ANNUAL'];

// 근무 타입 색상 (CSS class명)
export const SHIFT_COLORS: Record<ShiftType, string> = {
  D: '#4ade80',      // 초록 (데이)
  M: '#fb7185',      // 분홍 (중간)
  E: '#60a5fa',      // 파랑 (이브닝)
  N: '#4b5563',      // 회색 (나이트)
  OFF: '#e5e7eb',    // 연한 회색 (오프)
  WEEK_OFF: '#fbbf24', // 노란 (주휴)
  ANNUAL: '#f59e0b', // 주황 (연차)
  MENSTRUAL: '#ec4899', // 핑크 (생휴)
};

// 기본 간호사 수
export const DEFAULT_NURSE_COUNT = 15;

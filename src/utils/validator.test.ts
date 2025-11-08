import { describe, it, expect } from 'vitest';
import {
  validateDailyStaffRequirement,
  validateShiftOrder,
  validateConsecutiveWorkDays,
  validateSchedule,
} from './validator';
import type { ScheduleCell, Nurse } from '../types';

// 테스트 기본 세팅 (scheduler.test.ts와 동일)
const DEFAULT_NURSE_COUNT = 15;  // 기본 간호사 수
const DEFAULT_START_DATE = '2024-01-01';  // 기본 시작일 (월요일)
const DEFAULT_END_DATE = '2024-01-28';  // 기본 종료일 (4주)

// 테스트용 간호사 데이터 (단위 테스트용 - 최소 3명)
const testNurses: Nurse[] = [
  { id: 'nurse-1', name: '간호사1', weekOffDay: 'SUN' },
  { id: 'nurse-2', name: '간호사2', weekOffDay: 'MON' },
  { id: 'nurse-3', name: '간호사3', weekOffDay: 'TUE' },
];

describe('validator.ts - validateDailyStaffRequirement', () => {
  it('필수 인원 충족 시 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      // D: 3명
      { nurseId: 'n1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n2', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n3', date: '2024-01-01', shiftType: 'D', isFixed: false },
      // M: 1명
      { nurseId: 'n4', date: '2024-01-01', shiftType: 'M', isFixed: false },
      // E: 3명
      { nurseId: 'n5', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n6', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n7', date: '2024-01-01', shiftType: 'E', isFixed: false },
      // N: 2명
      { nurseId: 'n8', date: '2024-01-01', shiftType: 'N', isFixed: false },
      { nurseId: 'n9', date: '2024-01-01', shiftType: 'N', isFixed: false },
    ];

    const violations = validateDailyStaffRequirement('2024-01-01', schedule);
    expect(violations).toHaveLength(0);
  });

  it('D 근무 부족 시 위반 발생', () => {
    const schedule: ScheduleCell[] = [
      // D: 2명만 (부족)
      { nurseId: 'n1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n2', date: '2024-01-01', shiftType: 'D', isFixed: false },
      // M: 1명
      { nurseId: 'n4', date: '2024-01-01', shiftType: 'M', isFixed: false },
      // E: 3명
      { nurseId: 'n5', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n6', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n7', date: '2024-01-01', shiftType: 'E', isFixed: false },
      // N: 2명
      { nurseId: 'n8', date: '2024-01-01', shiftType: 'N', isFixed: false },
      { nurseId: 'n9', date: '2024-01-01', shiftType: 'N', isFixed: false },
    ];

    const violations = validateDailyStaffRequirement('2024-01-01', schedule);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('D 근무 부족');
  });

  it('여러 근무 타입 부족 시 각각 위반 발생', () => {
    const schedule: ScheduleCell[] = [
      // D: 1명만 (부족)
      { nurseId: 'n1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      // M: 0명 (부족)
      // E: 1명만 (부족)
      { nurseId: 'n5', date: '2024-01-01', shiftType: 'E', isFixed: false },
      // N: 1명만 (부족)
      { nurseId: 'n8', date: '2024-01-01', shiftType: 'N', isFixed: false },
    ];

    const violations = validateDailyStaffRequirement('2024-01-01', schedule);
    expect(violations.length).toBeGreaterThanOrEqual(4); // D, M, E, N 모두 부족
  });
});

describe('validator.ts - validateShiftOrder', () => {
  it('정상적인 근무 순서 (D → M → E → N) - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'M', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'E', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'OFF', isFixed: false },
    ];

    const violations = validateShiftOrder('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(0);
  });

  it('역순 근무 (E → D) - 위반 발생', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'D', isFixed: false },
    ];

    const violations = validateShiftOrder('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('근무 순서 위반');
    expect(violations[0].message).toContain('E → D');
  });

  it('역순 근무 (N → E) - 위반 발생', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'E', isFixed: false },
    ];

    const violations = validateShiftOrder('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('N → E');
  });

  it('같은 근무 연속 (D → D) - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'D', isFixed: false },
    ];

    const violations = validateShiftOrder('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(0);
  });

  it('건너뛰기 (D → E) - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'E', isFixed: false },
    ];

    const violations = validateShiftOrder('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(0);
  });

  it('휴일 후 근무 (OFF → D, OFF → M, OFF → E) - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'M', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'E', isFixed: false },
    ];

    const violations = validateShiftOrder('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(0);
  });

  it('휴일 후 순서 초기화 (E → OFF → D) - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'D', isFixed: false },
    ];

    const violations = validateShiftOrder('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(0);
  });
});

describe('validator.ts - validateConsecutiveWorkDays', () => {
  it('5일 연속 근무 - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'OFF', isFixed: false },
    ];

    const violations = validateConsecutiveWorkDays('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(0);
  });

  it('6일 연속 근무 - 위반 발생', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'OFF', isFixed: false },
    ];

    const violations = validateConsecutiveWorkDays('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('연속 근무일 초과');
    expect(violations[0].message).toContain('6일 연속');
  });

  it('7일 연속 근무 - 2개 위반 발생 (6일째, 7일째)', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'D', isFixed: false },
    ];

    const violations = validateConsecutiveWorkDays('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(2); // 6일째와 7일째
  });

  it('휴일로 연속 근무 리셋 - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'OFF', isFixed: false }, // 휴일로 리셋
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'D', isFixed: false },
    ];

    const violations = validateConsecutiveWorkDays('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(0);
  });

  it('주휴일로 연속 근무 리셋 - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'WEEK_OFF', isFixed: true }, // 주휴일로 리셋
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'D', isFixed: false },
    ];

    const violations = validateConsecutiveWorkDays('nurse-1', '간호사1', schedule);
    expect(violations).toHaveLength(0);
  });
});

describe('validator.ts - validateSchedule', () => {
  it('정상적인 스케줄 - 위반 없음', () => {
    const schedule: ScheduleCell[] = [
      // 2024-01-01 - D:3, M:1, E:3, N:2
      { nurseId: 'n1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n2', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n3', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n4', date: '2024-01-01', shiftType: 'M', isFixed: false },
      { nurseId: 'n5', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n6', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n7', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n8', date: '2024-01-01', shiftType: 'N', isFixed: false },
      { nurseId: 'n9', date: '2024-01-01', shiftType: 'N', isFixed: false },
    ];

    const nurses = [
      { id: 'n1', name: '간호사1' },
      { id: 'n2', name: '간호사2' },
      { id: 'n3', name: '간호사3' },
      { id: 'n4', name: '간호사4' },
      { id: 'n5', name: '간호사5' },
      { id: 'n6', name: '간호사6' },
      { id: 'n7', name: '간호사7' },
      { id: 'n8', name: '간호사8' },
      { id: 'n9', name: '간호사9' },
    ];

    const { violations, dailyStaffStatus } = validateSchedule(schedule, nurses);
    expect(violations).toHaveLength(0);
    expect(dailyStaffStatus['2024-01-01'].D).toBe('ok');
    expect(dailyStaffStatus['2024-01-01'].M).toBe('ok');
    expect(dailyStaffStatus['2024-01-01'].E).toBe('ok');
    expect(dailyStaffStatus['2024-01-01'].N).toBe('ok');
  });

  it('복합 위반 - 일일 필수 인원 + 근무 순서', () => {
    const schedule: ScheduleCell[] = [
      // 2024-01-01 - D:1 (부족), M:0 (부족), E:1 (부족), N:1 (부족)
      { nurseId: 'n1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n2', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n3', date: '2024-01-01', shiftType: 'N', isFixed: false },
      // n1: E → D (역순)
      { nurseId: 'n1', date: '2024-01-02', shiftType: 'E', isFixed: false },
      { nurseId: 'n1', date: '2024-01-03', shiftType: 'D', isFixed: false },
    ];

    const nurses = [
      { id: 'n1', name: '간호사1' },
      { id: 'n2', name: '간호사2' },
      { id: 'n3', name: '간호사3' },
    ];

    const { violations, dailyStaffStatus } = validateSchedule(schedule, nurses);

    // 일일 필수 인원 위반 (D, M, E, N 부족) + 근무 순서 위반 (E → D)
    expect(violations.length).toBeGreaterThan(0);

    // 일일 상태 확인
    expect(dailyStaffStatus['2024-01-01'].D).toBe('error');
    expect(dailyStaffStatus['2024-01-01'].M).toBe('error');
    expect(dailyStaffStatus['2024-01-01'].E).toBe('error');
    expect(dailyStaffStatus['2024-01-01'].N).toBe('error');
  });

  it('필수 인원 초과 시 warning', () => {
    const schedule: ScheduleCell[] = [
      // D: 4명 (초과)
      { nurseId: 'n1', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n2', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n3', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'n4', date: '2024-01-01', shiftType: 'D', isFixed: false },
      // M: 1명 (정상)
      { nurseId: 'n5', date: '2024-01-01', shiftType: 'M', isFixed: false },
      // E: 3명 (정상)
      { nurseId: 'n6', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n7', date: '2024-01-01', shiftType: 'E', isFixed: false },
      { nurseId: 'n8', date: '2024-01-01', shiftType: 'E', isFixed: false },
      // N: 2명 (정상)
      { nurseId: 'n9', date: '2024-01-01', shiftType: 'N', isFixed: false },
      { nurseId: 'n10', date: '2024-01-01', shiftType: 'N', isFixed: false },
    ];

    const nurses = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i + 1}`,
      name: `간호사${i + 1}`,
    }));

    const { violations, dailyStaffStatus } = validateSchedule(schedule, nurses);

    // 일일 필수 인원은 충족되므로 위반 없음 (초과는 경고만)
    expect(violations).toHaveLength(0);

    // D는 초과이므로 warning
    expect(dailyStaffStatus['2024-01-01'].D).toBe('warning');
    expect(dailyStaffStatus['2024-01-01'].M).toBe('ok');
    expect(dailyStaffStatus['2024-01-01'].E).toBe('ok');
    expect(dailyStaffStatus['2024-01-01'].N).toBe('ok');
  });
});

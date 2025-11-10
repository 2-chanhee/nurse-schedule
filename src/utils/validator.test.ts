import { describe, it, expect } from 'vitest';
import {
  validateDailyStaffRequirement,
  validateShiftOrder,
  validateConsecutiveWorkDays,
  validateSchedule,
  validateWeeklyRest,
  validateNightRestDays,
  validateNightTwoWeekLimit,
  validateAnnualWeekOffConflict,
  validateOffDayBalance,
} from './validator';
import type { ScheduleCell, Nurse } from '../types';

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
      // M: 0명 (권장이지만 필수 아님)
      // E: 1명만 (부족)
      { nurseId: 'n5', date: '2024-01-01', shiftType: 'E', isFixed: false },
      // N: 1명만 (부족)
      { nurseId: 'n8', date: '2024-01-01', shiftType: 'N', isFixed: false },
    ];

    const violations = validateDailyStaffRequirement('2024-01-01', schedule);
    expect(violations.length).toBeGreaterThanOrEqual(3); // D, E, N 부족 (M은 필수 아님)
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
      // 2024-01-02 - N 2일차 (나이트는 최소 2일 연속)
      { nurseId: 'n8', date: '2024-01-02', shiftType: 'N', isFixed: false },
      { nurseId: 'n9', date: '2024-01-02', shiftType: 'N', isFixed: false },
      { nurseId: 'n1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'n2', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'n3', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'n4', date: '2024-01-02', shiftType: 'M', isFixed: false },
      { nurseId: 'n5', date: '2024-01-02', shiftType: 'E', isFixed: false },
      { nurseId: 'n6', date: '2024-01-02', shiftType: 'E', isFixed: false },
      { nurseId: 'n7', date: '2024-01-02', shiftType: 'E', isFixed: false },
    ];

    const nurses: Nurse[] = [
      { id: 'n1', name: '간호사1', weekOffDay: 'SUN', annualLeaveDates: [] },
      { id: 'n2', name: '간호사2', weekOffDay: 'MON', annualLeaveDates: [] },
      { id: 'n3', name: '간호사3', weekOffDay: 'TUE', annualLeaveDates: [] },
      { id: 'n4', name: '간호사4', weekOffDay: 'WED', annualLeaveDates: [] },
      { id: 'n5', name: '간호사5', weekOffDay: 'THU', annualLeaveDates: [] },
      { id: 'n6', name: '간호사6', weekOffDay: 'FRI', annualLeaveDates: [] },
      { id: 'n7', name: '간호사7', weekOffDay: 'SAT', annualLeaveDates: [] },
      { id: 'n8', name: '간호사8', weekOffDay: 'SUN', annualLeaveDates: [] },
      { id: 'n9', name: '간호사9', weekOffDay: 'MON', annualLeaveDates: [] },
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

    const nurses: Nurse[] = [
      { id: 'n1', name: '간호사1', weekOffDay: 'SUN', annualLeaveDates: [] },
      { id: 'n2', name: '간호사2', weekOffDay: 'MON', annualLeaveDates: [] },
      { id: 'n3', name: '간호사3', weekOffDay: 'TUE', annualLeaveDates: [] },
    ];

    const { violations, dailyStaffStatus } = validateSchedule(schedule, nurses);

    // 일일 필수 인원 위반 (D, E, N 부족, M은 권장) + 근무 순서 위반 (E → D)
    expect(violations.length).toBeGreaterThan(0);

    // 일일 상태 확인
    expect(dailyStaffStatus['2024-01-01'].D).toBe('error');
    expect(dailyStaffStatus['2024-01-01'].M).toBe('warning'); // M은 필수 아님
    expect(dailyStaffStatus['2024-01-01'].E).toBe('error');
    expect(dailyStaffStatus['2024-01-01'].N).toBe('error');
  });

  it('필수 인원 초과 시 warning', () => {
    const schedule: ScheduleCell[] = [
      // 2024-01-01
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
      // 2024-01-02 - N 2일차 (나이트는 최소 2일 연속)
      { nurseId: 'n9', date: '2024-01-02', shiftType: 'N', isFixed: false },
      { nurseId: 'n10', date: '2024-01-02', shiftType: 'N', isFixed: false },
      { nurseId: 'n1', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'n2', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'n3', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'n5', date: '2024-01-02', shiftType: 'M', isFixed: false },
      { nurseId: 'n6', date: '2024-01-02', shiftType: 'E', isFixed: false },
      { nurseId: 'n7', date: '2024-01-02', shiftType: 'E', isFixed: false },
      { nurseId: 'n8', date: '2024-01-02', shiftType: 'E', isFixed: false },
    ];

    const nurses: Nurse[] = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i + 1}`,
      name: `간호사${i + 1}`,
      weekOffDay: (['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const)[i % 7],
      annualLeaveDates: [],
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

describe('validator.ts - validateWeeklyRest', () => {
  it('정상 케이스: 주휴 1일 + OFF 1일 = 2일', () => {
    // 2024-01-07 (일) ~ 2024-01-13 (토) 1주 (완전한 주)
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true }, // 일: 주휴
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'OFF', isFixed: false }, // 목: OFF
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
    ];

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('위반 케이스: 주휴 1일 + 연차 1일 (OFF 없음)', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'ANNUAL', isFixed: false }, // 연차 (OFF 대체 불가)
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
    ];

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('OFF가 0일');
  });

  it('위반 케이스: 주휴 1일 + 생휴 1일 (OFF 없음)', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'MENSTRUAL', isFixed: false }, // 생휴 (OFF 대체 불가)
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
    ];

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('OFF가 0일');
  });

  it('SOFT 위반 케이스: 주휴 1일 + OFF 2일 (나이트 후 휴식 등으로 허용)', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
    ];

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    // OFF 2개는 SOFT 위반 (불가피한 경우 허용)
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('SOFT');
    expect(violations[0].message).toContain('OFF가 2일');
    expect(violations[0].message).toContain('2-3일 허용');
  });

  it('위반 케이스: 주휴만 있고 OFF 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true }, // 주휴만
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
    ];

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('OFF가 0일');
  });

  it('위반 케이스: OFF만 있고 주휴 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
    ];

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('주휴일이 0일');
  });

  it('정상 케이스: 주휴 1일 + OFF 1일 + 연차 1일 = 3일', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'ANNUAL', isFixed: false }, // 연차 추가
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
    ];

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('정상 케이스: 주휴 1일 + OFF 1일 + 생휴 1일 = 3일', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'MENSTRUAL', isFixed: false }, // 생휴 추가
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
    ];

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('4주 전체 검증: 각 주마다 주휴 + OFF 최소 1일', () => {
    // 4주 스케줄 (2024-01-07(일) ~ 2024-02-03(토)) - 완전한 4주
    const schedule: ScheduleCell[] = [];

    // 1주차: 2024-01-07(일) ~ 01-13(토), 주휴(일) + OFF(목)
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'OFF', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false });

    // 2주차: 2024-01-14(일) ~ 01-20(토), 주휴(일) + OFF(화) + 연차(수)
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-14', shiftType: 'WEEK_OFF', isFixed: true });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-15', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-16', shiftType: 'OFF', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-17', shiftType: 'ANNUAL', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-18', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-19', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-20', shiftType: 'D', isFixed: false });

    // 3주차: 2024-01-21(일) ~ 01-27(토), 주휴(일) + OFF(화) + 생휴(목)
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-21', shiftType: 'WEEK_OFF', isFixed: true });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-22', shiftType: 'OFF', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-23', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-24', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-25', shiftType: 'MENSTRUAL', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-26', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-27', shiftType: 'D', isFixed: false });

    // 4주차: 2024-01-28(일) ~ 02-03(토), 주휴(일) + OFF 2일(화, 금)
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-28', shiftType: 'WEEK_OFF', isFixed: true });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-29', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-30', shiftType: 'OFF', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-31', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-02-01', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-02-02', shiftType: 'OFF', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-02-03', shiftType: 'D', isFixed: false });

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    // 4주차에 OFF 2개로 인한 SOFT 위반 1개
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('SOFT');
    expect(violations[0].message).toContain('OFF가 2일');
    expect(violations[0].date).toBe('2024-01-28'); // 4주차 일요일
  });

  it('4주 중 1개 주만 위반 시 해당 주만 위반', () => {
    // 4주 스케줄 (2024-01-07(일) ~ 2024-02-03(토)) - 완전한 4주
    const schedule: ScheduleCell[] = [];

    // 1주차: 2024-01-07(일) ~ 01-13(토), 주휴(일) + OFF(목) - 정상
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'OFF', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false });

    // 2주차: 2024-01-14(일) ~ 01-20(토), 주휴(일)만 - 위반!
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-14', shiftType: 'WEEK_OFF', isFixed: true });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-15', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-16', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-17', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-18', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-19', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-20', shiftType: 'D', isFixed: false });

    // 3주차: 2024-01-21(일) ~ 01-27(토), 주휴(일) + OFF(목) - 정상
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-21', shiftType: 'WEEK_OFF', isFixed: true });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-22', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-23', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-24', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-25', shiftType: 'OFF', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-26', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-27', shiftType: 'D', isFixed: false });

    // 4주차: 2024-01-28(일) ~ 02-03(토), 주휴(일) + OFF(금) - 정상
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-28', shiftType: 'WEEK_OFF', isFixed: true });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-29', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-30', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-01-31', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-02-01', shiftType: 'D', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-02-02', shiftType: 'OFF', isFixed: false });
    schedule.push({ nurseId: 'nurse-1', date: '2024-02-03', shiftType: 'D', isFixed: false });

    const violations = validateWeeklyRest('nurse-1', '간호사1', schedule);

    // 2주차만 위반 (2024-01-14가 일요일)
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('OFF가 0일');
  });
});

describe('validator.ts - validateNightRestDays', () => {
  it('정상 케이스: 나이트 2일 후 2일 휴식', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'N', isFixed: false }, // 나이트 1일차
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'N', isFixed: false }, // 나이트 2일차
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'OFF', isFixed: false }, // 휴식 1일차
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'OFF', isFixed: false }, // 휴식 2일차
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightRestDays('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('정상 케이스: 나이트 3일 후 2일 휴식', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'N', isFixed: false }, // 나이트 1일차
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'N', isFixed: false }, // 나이트 2일차
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'N', isFixed: false }, // 나이트 3일차
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'WEEK_OFF', isFixed: true }, // 휴식 1일차 (주휴)
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'OFF', isFixed: false }, // 휴식 2일차
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightRestDays('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('위반 케이스: 나이트 2일 후 1일만 휴식', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'N', isFixed: false }, // 나이트 1일차
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'N', isFixed: false }, // 나이트 2일차
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'OFF', isFixed: false }, // 휴식 1일만
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'D', isFixed: false }, // 바로 근무 -> 위반
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightRestDays('nurse-1', '간호사1', schedule);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('나이트 종료 후 1일 휴식');
  });

  it('위반 케이스: 나이트 3일 후 1일만 휴식', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'N', isFixed: false }, // 나이트 1일차
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'N', isFixed: false }, // 나이트 2일차
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'N', isFixed: false }, // 나이트 3일차
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'OFF', isFixed: false }, // 휴식 1일만
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false }, // 바로 근무 -> 위반
    ];

    const violations = validateNightRestDays('nurse-1', '간호사1', schedule);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('나이트 종료 후 1일 휴식');
  });

  it('위반 케이스: 나이트 종료 후 바로 근무', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'N', isFixed: false }, // 나이트 1일차
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'N', isFixed: false }, // 나이트 2일차
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'D', isFixed: false }, // 바로 근무 -> 위반
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'D', isFixed: false }, // 추가 날짜 (마지막 2일 제외 방지)
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false }, // 추가 날짜
    ];

    const violations = validateNightRestDays('nurse-1', '간호사1', schedule);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('나이트 종료 후 0일 휴식');
  });

  it('정상 케이스: 나이트 후 연차 2일', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'N', isFixed: false }, // 나이트 1일차
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'N', isFixed: false }, // 나이트 2일차
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'ANNUAL', isFixed: false }, // 연차 1일차
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'ANNUAL', isFixed: false }, // 연차 2일차
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightRestDays('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('정상 케이스: 나이트 후 주휴+OFF', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'N', isFixed: false }, // 나이트 1일차 (금)
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'N', isFixed: false }, // 나이트 2일차 (토)
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true }, // 주휴 (일)
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'OFF', isFixed: false }, // OFF (월)
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightRestDays('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('정상 케이스: 나이트 후 생휴+OFF', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'N', isFixed: false }, // 나이트 1일차
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'N', isFixed: false }, // 나이트 2일차
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'N', isFixed: false }, // 나이트 3일차
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'MENSTRUAL', isFixed: false }, // 생휴
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'OFF', isFixed: false }, // OFF
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightRestDays('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });
});

describe('validator.ts - validateNightTwoWeekLimit', () => {
  it('정상 케이스: 1주만 나이트 근무', () => {
    const schedule: ScheduleCell[] = [
      // 1주차 (2024-01-07 일 ~ 2024-01-13 토): 나이트 있음
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
      // 2주차 (2024-01-14 일 ~ 2024-01-20 토): 나이트 없음
      { nurseId: 'nurse-1', date: '2024-01-14', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-15', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-16', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-17', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-18', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-19', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-20', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightTwoWeekLimit('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('위반 케이스: 2주 연속 나이트 근무 (SOFT)', () => {
    const schedule: ScheduleCell[] = [
      // 1주차 (2024-01-07 일 ~ 2024-01-13 토): 나이트 있음
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
      // 2주차 (2024-01-14 일 ~ 2024-01-20 토): 나이트 있음 -> 2주 연속!
      { nurseId: 'nurse-1', date: '2024-01-14', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-15', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-16', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-17', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-18', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-19', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-20', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightTwoWeekLimit('nurse-1', '간호사1', schedule);

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('SOFT'); // 소프트 제약
    expect(violations[0].message).toContain('2주 연속 나이트 근무');
  });

  it('위반 케이스: 3주 연속 나이트 근무 (2개 SOFT 위반)', () => {
    const schedule: ScheduleCell[] = [
      // 1주차: 나이트 있음
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
      // 2주차: 나이트 있음 -> 1-2주차 연속!
      { nurseId: 'nurse-1', date: '2024-01-14', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-15', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-16', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-17', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-18', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-19', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-20', shiftType: 'D', isFixed: false },
      // 3주차: 나이트 있음 -> 2-3주차 연속!
      { nurseId: 'nurse-1', date: '2024-01-21', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-22', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-23', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-24', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-25', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-26', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-27', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightTwoWeekLimit('nurse-1', '간호사1', schedule);

    expect(violations.length).toBe(2); // 1-2주차, 2-3주차 총 2개 위반
    expect(violations[0].type).toBe('SOFT');
    expect(violations[1].type).toBe('SOFT');
  });

  it('정상 케이스: 1주 건너뛰고 나이트 근무', () => {
    const schedule: ScheduleCell[] = [
      // 1주차: 나이트 있음
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-11', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-12', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-13', shiftType: 'D', isFixed: false },
      // 2주차: 나이트 없음
      { nurseId: 'nurse-1', date: '2024-01-14', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-15', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-16', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-17', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-18', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-19', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-20', shiftType: 'D', isFixed: false },
      // 3주차: 나이트 있음 (1주차와 연속 아님)
      { nurseId: 'nurse-1', date: '2024-01-21', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-22', shiftType: 'N', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-23', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-24', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-25', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-26', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-27', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightTwoWeekLimit('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });

  it('정상 케이스: 나이트 근무 없음', () => {
    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'D', isFixed: false },
    ];

    const violations = validateNightTwoWeekLimit('nurse-1', '간호사1', schedule);

    expect(violations).toHaveLength(0);
  });
});

describe('validator.ts - validateAnnualWeekOffConflict', () => {
  it('정상 케이스: 주휴일과 연차가 다른 요일', () => {
    const nurse: Nurse = {
      id: 'nurse-1',
      name: '간호사1',
      weekOffDay: 'SUN', // 일요일 주휴
      annualLeaveDates: ['2024-01-08', '2024-01-15'], // 월요일 연차
    };

    const violations = validateAnnualWeekOffConflict(nurse);

    expect(violations).toHaveLength(0);
  });

  it('위반 케이스: 주휴일과 연차가 같은 요일 (일요일)', () => {
    const nurse: Nurse = {
      id: 'nurse-1',
      name: '간호사1',
      weekOffDay: 'SUN', // 일요일 주휴
      annualLeaveDates: ['2024-01-07', '2024-01-14'], // 일요일 연차 - 겹침!
    };

    const violations = validateAnnualWeekOffConflict(nurse);

    expect(violations).toHaveLength(2); // 2개 위반
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].date).toBe('2024-01-07');
    expect(violations[0].message).toContain('주휴일과 연차가 겹칩니다');
    expect(violations[0].message).toContain('일요일');
  });

  it('위반 케이스: 주휴일과 연차가 같은 요일 (화요일)', () => {
    const nurse: Nurse = {
      id: 'nurse-2',
      name: '간호사2',
      weekOffDay: 'TUE', // 화요일 주휴
      annualLeaveDates: ['2024-01-09', '2024-01-16'], // 화요일 연차 - 겹침!
    };

    const violations = validateAnnualWeekOffConflict(nurse);

    expect(violations).toHaveLength(2);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('화요일');
  });

  it('정상 케이스: 연차 없음', () => {
    const nurse: Nurse = {
      id: 'nurse-3',
      name: '간호사3',
      weekOffDay: 'MON',
      annualLeaveDates: [],
    };

    const violations = validateAnnualWeekOffConflict(nurse);

    expect(violations).toHaveLength(0);
  });

  it('정상 케이스: 일부만 겹침 (1개 정상, 1개 위반)', () => {
    const nurse: Nurse = {
      id: 'nurse-4',
      name: '간호사4',
      weekOffDay: 'WED', // 수요일 주휴
      annualLeaveDates: ['2024-01-10', '2024-01-11'], // 수요일, 목요일
    };

    const violations = validateAnnualWeekOffConflict(nurse);

    expect(violations).toHaveLength(1); // 수요일만 위반
    expect(violations[0].date).toBe('2024-01-10');
  });
});

describe('validator.ts - validateOffDayBalance', () => {
  it('정상 케이스: 휴일 차이가 2일 이하', () => {
    const nurses: Nurse[] = [
      { id: 'nurse-1', name: '간호사1', weekOffDay: 'SUN', annualLeaveDates: [] },
      { id: 'nurse-2', name: '간호사2', weekOffDay: 'MON', annualLeaveDates: [] },
      { id: 'nurse-3', name: '간호사3', weekOffDay: 'TUE', annualLeaveDates: [] },
    ];

    const schedule: ScheduleCell[] = [
      // 간호사1: 8일 휴일
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'ANNUAL', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'MENSTRUAL', isFixed: false },
      // 간호사2: 7일 휴일
      { nurseId: 'nurse-2', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-02', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-04', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-06', shiftType: 'ANNUAL', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-07', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-08', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-09', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-10', shiftType: 'MENSTRUAL', isFixed: false },
      // 간호사3: 6일 휴일 (차이 2일)
      { nurseId: 'nurse-3', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-3', date: '2024-01-02', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-3', date: '2024-01-03', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-3', date: '2024-01-04', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-3', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-3', date: '2024-01-06', shiftType: 'ANNUAL', isFixed: true },
      { nurseId: 'nurse-3', date: '2024-01-07', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-3', date: '2024-01-08', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-3', date: '2024-01-09', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-3', date: '2024-01-10', shiftType: 'D', isFixed: false },
    ];

    const violations = validateOffDayBalance(schedule, nurses);

    expect(violations).toHaveLength(0); // 차이 2일은 정상
  });

  it('위반 케이스: 휴일 차이가 3일 (HARD 위반)', () => {
    const nurses: Nurse[] = [
      { id: 'nurse-1', name: '간호사1', weekOffDay: 'SUN', annualLeaveDates: [] },
      { id: 'nurse-2', name: '간호사2', weekOffDay: 'MON', annualLeaveDates: [] },
    ];

    const schedule: ScheduleCell[] = [
      // 간호사1: 8일 휴일
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'ANNUAL', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'MENSTRUAL', isFixed: false },
      // 간호사2: 5일 휴일 (차이 3일)
      { nurseId: 'nurse-2', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-02', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-04', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-06', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-08', shiftType: 'OFF', isFixed: false },
    ];

    const violations = validateOffDayBalance(schedule, nurses);

    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('휴일 공평 분배 위반');
    expect(violations[0].message).toContain('차이 3일');
    expect(violations[0].message).toContain('간호사1'); // 최대
    expect(violations[0].message).toContain('간호사2'); // 최소
  });

  it('위반 케이스: 휴일 차이가 4일 이상', () => {
    const nurses: Nurse[] = [
      { id: 'nurse-1', name: '간호사1', weekOffDay: 'SUN', annualLeaveDates: [] },
      { id: 'nurse-2', name: '간호사2', weekOffDay: 'MON', annualLeaveDates: [] },
    ];

    const schedule: ScheduleCell[] = [
      // 간호사1: 10일 휴일
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'ANNUAL', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-08', shiftType: 'MENSTRUAL', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-09', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-10', shiftType: 'OFF', isFixed: false },
      // 간호사2: 5일 휴일 (차이 5일)
      { nurseId: 'nurse-2', date: '2024-01-01', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-02', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-04', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-05', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-06', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-07', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-08', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-09', shiftType: 'D', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-10', shiftType: 'D', isFixed: false },
    ];

    const violations = validateOffDayBalance(schedule, nurses);

    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('HARD');
    expect(violations[0].message).toContain('차이 5일');
  });

  it('정상 케이스: 모든 간호사가 동일한 휴일 수', () => {
    const nurses: Nurse[] = [
      { id: 'nurse-1', name: '간호사1', weekOffDay: 'SUN', annualLeaveDates: [] },
      { id: 'nurse-2', name: '간호사2', weekOffDay: 'MON', annualLeaveDates: [] },
    ];

    const schedule: ScheduleCell[] = [
      // 간호사1: 6일 휴일
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-04', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-1', date: '2024-01-05', shiftType: 'ANNUAL', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-06', shiftType: 'MENSTRUAL', isFixed: false },
      // 간호사2: 6일 휴일 (차이 0일)
      { nurseId: 'nurse-2', date: '2024-01-01', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-02', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-03', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-04', shiftType: 'OFF', isFixed: false },
      { nurseId: 'nurse-2', date: '2024-01-05', shiftType: 'ANNUAL', isFixed: true },
      { nurseId: 'nurse-2', date: '2024-01-06', shiftType: 'MENSTRUAL', isFixed: false },
    ];

    const violations = validateOffDayBalance(schedule, nurses);

    expect(violations).toHaveLength(0); // 차이 0일은 정상
  });

  it('엣지 케이스: 간호사 1명', () => {
    const nurses: Nurse[] = [
      { id: 'nurse-1', name: '간호사1', weekOffDay: 'SUN', annualLeaveDates: [] },
    ];

    const schedule: ScheduleCell[] = [
      { nurseId: 'nurse-1', date: '2024-01-01', shiftType: 'WEEK_OFF', isFixed: true },
      { nurseId: 'nurse-1', date: '2024-01-02', shiftType: 'OFF', isFixed: false },
    ];

    const violations = validateOffDayBalance(schedule, nurses);

    expect(violations).toHaveLength(0); // 1명이면 차이가 0이므로 위반 없음
  });

  it('엣지 케이스: 빈 스케줄', () => {
    const nurses: Nurse[] = [
      { id: 'nurse-1', name: '간호사1', weekOffDay: 'SUN', annualLeaveDates: [] },
      { id: 'nurse-2', name: '간호사2', weekOffDay: 'MON', annualLeaveDates: [] },
    ];

    const schedule: ScheduleCell[] = [];

    const violations = validateOffDayBalance(schedule, nurses);

    expect(violations).toHaveLength(0); // 빈 스케줄이면 모두 0일이므로 위반 없음
  });
});

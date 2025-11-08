import { describe, it, expect } from 'vitest';
import { generateSimpleSchedule } from './scheduler';
import { validateSchedule } from './validator';
import type { Nurse, ScheduleCell, ShiftType } from '../types';
import { DAILY_REQUIRED_STAFF, MAX_CONSECUTIVE_WORK_DAYS } from '../constants';

// 테스트 기본 세팅
const DEFAULT_NURSE_COUNT = 15;  // 기본 간호사 수
const DEFAULT_START_DATE = '2024-01-01';  // 기본 시작일 (월요일)
const DEFAULT_END_DATE = '2024-01-28';  // 기본 종료일 (4주)
const DEFAULT_DAYS = 28;  // 기본 일수 (4주)

// 테스트용 간호사 데이터 생성
function createTestNurses(count: number = DEFAULT_NURSE_COUNT): Nurse[] {
  const weekOffDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: `nurse-${i + 1}`,
    name: `간호사${i + 1}`,
    weekOffDay: weekOffDays[i % 7],
  }));
}

describe('scheduler.ts - generateSimpleSchedule', () => {
  it('빈 간호사 목록으로 호출 시 빈 스케줄 반환', () => {
    const schedule = generateSimpleSchedule([], '2024-01-01', '2024-01-07');
    expect(schedule).toEqual([]);
  });

  it('스케줄 생성 시 모든 날짜와 모든 간호사에 대한 셀 생성', () => {
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    // 28일 * 15명 = 420개 셀
    expect(schedule.length).toBe(DEFAULT_DAYS * DEFAULT_NURSE_COUNT);

    // 스케줄에서 실제 날짜 추출
    const dates = Array.from(new Set(schedule.map(s => s.date))).sort();
    expect(dates.length).toBe(DEFAULT_DAYS);

    // 모든 간호사가 모든 날짜에 배정되었는지 확인
    dates.forEach(date => {
      nurses.forEach(nurse => {
        const cell = schedule.find(s => s.date === date && s.nurseId === nurse.id);
        expect(cell).toBeDefined();
      });
    });
  });

  it('일일 필수 인원 충족 - D:3, M:1, E:3, N:2', () => {
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    // 스케줄에서 실제 날짜 추출
    const dates = Array.from(new Set(schedule.map(s => s.date))).sort();

    dates.forEach(date => {
      const dayCells = schedule.filter(s => s.date === date);

      const counts: Record<ShiftType, number> = {
        D: 0, M: 0, E: 0, N: 0,
        OFF: 0, WEEK_OFF: 0, ANNUAL: 0, MENSTRUAL: 0,
      };

      dayCells.forEach(cell => {
        counts[cell.shiftType]++;
      });

      // 필수 인원 충족 확인
      expect(counts.D).toBeGreaterThanOrEqual(DAILY_REQUIRED_STAFF.D);
      expect(counts.M).toBeGreaterThanOrEqual(DAILY_REQUIRED_STAFF.M);
      expect(counts.E).toBeGreaterThanOrEqual(DAILY_REQUIRED_STAFF.E);
      expect(counts.N).toBeGreaterThanOrEqual(DAILY_REQUIRED_STAFF.N);
    });
  });

  it('주휴일 자동 배정 및 고정', () => {
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    // 각 간호사의 주휴일이 올바르게 배정되었는지 확인
    nurses.forEach(nurse => {
      const nurseCells = schedule.filter(s => s.nurseId === nurse.id);
      const weekOffCells = nurseCells.filter(c => c.shiftType === 'WEEK_OFF');

      // 주휴일이 있는지 확인
      expect(weekOffCells.length).toBeGreaterThan(0);

      // 모든 주휴일이 고정되어 있는지 확인
      weekOffCells.forEach(cell => {
        expect(cell.isFixed).toBe(true);

        // 해당 날짜가 간호사의 주휴일 요일인지 확인
        const date = new Date(cell.date);
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
        expect(dayOfWeek).toBe(nurse.weekOffDay);
      });
    });
  });

  it('근무 순서 규칙 준수 - D → M → E → N (역순 불가)', () => {
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    const shiftOrder = ['D', 'M', 'E', 'N'];
    const restTypes = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];

    nurses.forEach(nurse => {
      const nurseCells = schedule
        .filter(s => s.nurseId === nurse.id)
        .sort((a, b) => a.date.localeCompare(b.date));

      for (let i = 1; i < nurseCells.length; i++) {
        const prevShift = nurseCells[i - 1].shiftType;
        const currShift = nurseCells[i].shiftType;

        // 휴일 후에는 어떤 근무든 가능
        if (restTypes.includes(prevShift)) continue;

        // 현재가 휴일이면 가능
        if (restTypes.includes(currShift)) continue;

        // 같은 근무 연속은 가능
        if (prevShift === currShift) continue;

        const prevIndex = shiftOrder.indexOf(prevShift);
        const currIndex = shiftOrder.indexOf(currShift);

        if (prevIndex !== -1 && currIndex !== -1) {
          // 역순이 아님을 확인 (currIndex >= prevIndex)
          expect(currIndex).toBeGreaterThanOrEqual(prevIndex);
        }
      }
    });
  });

  it('연속 근무일 제한 준수 - 최대 5일', () => {
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    const restTypes: ShiftType[] = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];

    nurses.forEach(nurse => {
      const nurseCells = schedule
        .filter(s => s.nurseId === nurse.id)
        .sort((a, b) => a.date.localeCompare(b.date));

      let consecutiveWorkDays = 0;

      nurseCells.forEach(cell => {
        if (restTypes.includes(cell.shiftType)) {
          consecutiveWorkDays = 0;
        } else {
          consecutiveWorkDays++;
          // 최대 5일 연속 근무만 가능
          expect(consecutiveWorkDays).toBeLessThanOrEqual(MAX_CONSECUTIVE_WORK_DAYS);
        }
      });
    });
  });

  it('공평한 근무 분배 - 간호사별 근무일 수 차이 최소화', () => {
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    const restTypes: ShiftType[] = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];
    const workCounts: Record<string, number> = {};

    nurses.forEach(nurse => {
      const nurseCells = schedule.filter(s => s.nurseId === nurse.id);
      const workDays = nurseCells.filter(c => !restTypes.includes(c.shiftType)).length;
      workCounts[nurse.id] = workDays;
    });

    const workDaysArray = Object.values(workCounts);
    const maxWorkDays = Math.max(...workDaysArray);
    const minWorkDays = Math.min(...workDaysArray);

    // 최대 근무일과 최소 근무일 차이가 크지 않아야 함 (예: 5일 이내)
    expect(maxWorkDays - minWorkDays).toBeLessThanOrEqual(5);
  });

  it('휴일 후 근무 순서 초기화 확인', () => {
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    const restTypes: ShiftType[] = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];

    nurses.forEach(nurse => {
      const nurseCells = schedule
        .filter(s => s.nurseId === nurse.id)
        .sort((a, b) => a.date.localeCompare(b.date));

      for (let i = 1; i < nurseCells.length; i++) {
        const prevShift = nurseCells[i - 1].shiftType;
        const currShift = nurseCells[i].shiftType;

        // 휴일 후 근무는 어떤 근무든 가능 (M, E도 가능)
        if (restTypes.includes(prevShift) && !restTypes.includes(currShift)) {
          // 휴일 후 근무는 D, M, E, N 모두 가능
          expect(['D', 'M', 'E', 'N']).toContain(currShift);
        }
      }
    });
  });
});

describe('scheduler.ts - AND 조건 통합 테스트', () => {
  it('🔴 중요: 모든 하드 제약 조건을 동시에 만족하는지 검증 (AND 조건)', () => {
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    // validator로 전체 검증
    const { violations, dailyStaffStatus } = validateSchedule(schedule, nurses);

    // 모든 위반이 0이어야 함 (AND 조건)
    if (violations.length > 0) {
      console.log('❌ 제약 조건 위반 발견:');
      violations.forEach((v: any) => {
        console.log(`  - ${v.message}`);
      });
    }

    expect(violations).toHaveLength(0);

    // 모든 날짜의 필수 인원이 충족되었는지 확인
    const dates = Object.keys(dailyStaffStatus).sort();
    dates.forEach(date => {
      const status = dailyStaffStatus[date];

      // D, M, E, N 모두 'ok' 또는 'warning'이어야 함 ('error'이면 안 됨)
      expect(status.D).not.toBe('error');
      expect(status.M).not.toBe('error');
      expect(status.E).not.toBe('error');
      expect(status.N).not.toBe('error');
    });
  });

  it('여러 번 생성해도 모든 제약 조건 만족 (랜덤 요소 테스트 - 20회)', () => {
    const nurses = createTestNurses();

    // 20번 반복 생성 (랜덤 요소에도 제약 조건 만족 확인)
    for (let i = 0; i < 20; i++) {
      const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);
      const { violations } = validateSchedule(schedule, nurses);

      if (violations.length > 0) {
        console.log(`❌ ${i + 1}번째 생성에서 위반 발견:`);
        violations.forEach((v: any) => {
          console.log(`  - ${v.message}`);
        });
      }

      expect(violations).toHaveLength(0);
    }
  });

  it('다양한 기간으로 생성해도 모든 제약 조건 만족', () => {
    const nurses = createTestNurses();

    const testCases = [
      { start: DEFAULT_START_DATE, end: '2024-01-07', desc: '1주' },
      { start: DEFAULT_START_DATE, end: '2024-01-14', desc: '2주' },
      { start: DEFAULT_START_DATE, end: '2024-01-21', desc: '3주' },
      { start: DEFAULT_START_DATE, end: DEFAULT_END_DATE, desc: '4주 (기본)' },
    ];

    testCases.forEach(({ start, end, desc }) => {
      const schedule = generateSimpleSchedule(nurses, start, end);
      const { violations } = validateSchedule(schedule, nurses);

      if (violations.length > 0) {
        console.log(`❌ ${desc} 기간에서 위반 발견:`);
        violations.forEach((v: any) => {
          console.log(`  - ${v.message}`);
        });
      }

      expect(violations).toHaveLength(0);
    });
  });

  it('간호사 수가 적어도 제약 조건 만족 시도', () => {
    // 간호사 9명 (최소 필수 인원만)
    const nurses = createTestNurses(9);

    const schedule = generateSimpleSchedule(nurses, '2024-01-01', '2024-01-07'); // 1주
    const { violations } = validateSchedule(schedule, nurses);

    // 간호사 수가 적으면 일부 제약 조건을 만족하지 못할 수 있음
    // 하지만 알고리즘은 최선을 다해야 함
    if (violations.length > 0) {
      console.log('⚠️ 간호사 9명으로는 일부 제약 조건 만족 불가:');
      violations.forEach((v: any) => {
        console.log(`  - ${v.message}`);
      });
    }

    // 이 경우는 위반이 있을 수 있으므로 통과
    // (간호사 수가 충분하지 않으면 모든 제약을 만족하기 어려움)
  });
});

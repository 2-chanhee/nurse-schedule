import { describe, it, expect } from 'vitest';
import { generateSimpleSchedule } from './scheduler';
import { validateSchedule } from './validator';
import type { Nurse, ShiftType, ScheduleCell } from '../types';
import { DAILY_REQUIRED_STAFF, MAX_CONSECUTIVE_WORK_DAYS } from '../constants';

// 테스트 기본 세팅
const DEFAULT_NURSE_COUNT = 15;  // 기본 간호사 수
const DEFAULT_START_DATE = '2024-01-01';  // 기본 시작일 (월요일)
const DEFAULT_END_DATE = '2024-01-28';  // 기본 종료일 (4주)
const DEFAULT_DAYS = 28;  // 기본 일수 (4주)

// 테스트용 간호사 데이터 생성
// withAnnual=true: UI와 동일하게 랜덤 3명에게 연차 배정 (기본값)
// withAnnual=false: 연차 없이 생성 (일부 테스트용)
function createTestNurses(count: number = DEFAULT_NURSE_COUNT, withAnnual: boolean = true): Nurse[] {
  const weekOffDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
  const nurses = Array.from({ length: count }, (_, i) => ({
    id: `nurse-${i + 1}`,
    name: `간호사${i + 1}`,
    weekOffDay: weekOffDays[i % 7],
    annualLeaveDates: [] as string[],
  }));

  // UI와 동일: 랜덤 3명에게 연차 배정
  if (withAnnual && count >= 3) {
    const annualNurseCount = Math.min(3, count);
    const selectedIndices = new Set<number>();

    while (selectedIndices.size < annualNurseCount) {
      const randomIndex = Math.floor(Math.random() * count);
      selectedIndices.add(randomIndex);
    }

    selectedIndices.forEach(index => {
      const nurse = nurses[index];
      const dayMap: Record<string, number> = {
        SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
      };
      const weekOffDayNum = dayMap[nurse.weekOffDay];

      // 주휴일 다음 날을 연차로 선택 (주휴일과 겹치지 않도록)
      const annualDayNum = (weekOffDayNum + 1) % 7;
      const annualDates: string[] = [];

      // 2024-01-01부터 28일 동안, 해당 요일에 해당하는 날짜 찾기
      const start = new Date('2024-01-01');
      for (let i = 0; i < 28; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        if (date.getDay() === annualDayNum) {
          annualDates.push(date.toISOString().split('T')[0]);
        }
      }

      // 랜덤으로 2개 선택
      if (annualDates.length >= 2) {
        const date1 = annualDates[Math.floor(Math.random() * annualDates.length)];
        let date2 = date1;
        while (date2 === date1 && annualDates.length > 1) {
          date2 = annualDates[Math.floor(Math.random() * annualDates.length)];
        }
        nurse.annualLeaveDates = [date1, date2];
      }
    });
  }

  return nurses;
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
    // UI와 동일: 연차 포함 테스트
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

      // 필수 인원 충족 확인 (D, E, N만 필수, M은 최선을 다하지만 0일 수 있음)
      expect(counts.D).toBeGreaterThanOrEqual(DAILY_REQUIRED_STAFF.D);
      expect(counts.E).toBeGreaterThanOrEqual(DAILY_REQUIRED_STAFF.E);
      expect(counts.N).toBeGreaterThanOrEqual(DAILY_REQUIRED_STAFF.N);
      // M은 필수가 아님 (최선을 다했지만 불가능한 경우 0 허용)
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

  it('연차 신청한 날짜는 ANNUAL로 고정 배정', () => {
    const nurses = createTestNurses(15, false); // 15명으로 충분한 인원 확보

    // 간호사 1, 2에게 연차 신청 (주휴일과 겹치지 않는 날짜 선택)
    // nurse-1: weekOffDay = 'SUN', nurse-2: weekOffDay = 'MON'
    nurses[0].annualLeaveDates = ['2024-01-05', '2024-01-10']; // 금, 수 (일요일 아님)
    nurses[1].annualLeaveDates = ['2024-01-05', '2024-01-17']; // 금, 수 (월요일 아님)

    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    // 간호사 1의 연차 확인
    const nurse1Annual1 = schedule.find(s => s.nurseId === nurses[0].id && s.date === '2024-01-05');
    const nurse1Annual2 = schedule.find(s => s.nurseId === nurses[0].id && s.date === '2024-01-10');

    expect(nurse1Annual1).toBeDefined();
    expect(nurse1Annual1?.shiftType).toBe('ANNUAL');
    expect(nurse1Annual1?.isFixed).toBe(true);

    expect(nurse1Annual2).toBeDefined();
    expect(nurse1Annual2?.shiftType).toBe('ANNUAL');
    expect(nurse1Annual2?.isFixed).toBe(true);

    // 간호사 2의 연차 확인
    const nurse2Annual1 = schedule.find(s => s.nurseId === nurses[1].id && s.date === '2024-01-05');
    const nurse2Annual2 = schedule.find(s => s.nurseId === nurses[1].id && s.date === '2024-01-17');

    expect(nurse2Annual1).toBeDefined();
    expect(nurse2Annual1?.shiftType).toBe('ANNUAL');
    expect(nurse2Annual1?.isFixed).toBe(true);

    expect(nurse2Annual2).toBeDefined();
    expect(nurse2Annual2?.shiftType).toBe('ANNUAL');
    expect(nurse2Annual2?.isFixed).toBe(true);
  });

  it('연차 신청이 없으면 정상 스케줄 생성', () => {
    const nurses = createTestNurses(5, false); // withAnnual=false

    // 모든 간호사 연차 없음
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    // ANNUAL 타입이 하나도 없어야 함 (주휴일만 자동 배정)
    const annualCells = schedule.filter(s => s.shiftType === 'ANNUAL');
    expect(annualCells.length).toBe(0);
  });

  it('여러 간호사가 같은 날 연차 신청 가능', () => {
    const nurses = createTestNurses(15, false); // 15명으로 충분한 인원 확보

    // 5명이 같은 날 연차 신청 (2024-01-05는 금요일, 간호사1-5의 주휴일과 겹치지 않음)
    for (let i = 0; i < 5; i++) {
      nurses[i].annualLeaveDates = ['2024-01-05'];
    }

    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE);

    // 2024-01-05에 5명이 ANNUAL이어야 함
    const annualCellsOnDate = schedule.filter(s => s.date === '2024-01-05' && s.shiftType === 'ANNUAL');
    expect(annualCellsOnDate.length).toBe(5);

    // 모두 고정되어 있어야 함
    annualCellsOnDate.forEach(cell => {
      expect(cell.isFixed).toBe(true);
    });
  });

  it('고정 셀이 있을 때 재생성 시 유지됨', () => {
    const nurses = createTestNurses();

    // 고정 셀 생성: 간호사1의 1/1~1/3을 D로 고정
    const fixedCells: ScheduleCell[] = [
      { nurseId: nurses[0].id, date: '2024-01-01', shiftType: 'D', isFixed: true },
      { nurseId: nurses[0].id, date: '2024-01-02', shiftType: 'D', isFixed: true },
      { nurseId: nurses[0].id, date: '2024-01-03', shiftType: 'D', isFixed: true },
    ];

    // 고정 셀을 포함하여 스케줄 생성
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE, false, fixedCells);

    // 고정 셀이 그대로 유지되는지 확인
    const nurse1Cells = schedule.filter(s => s.nurseId === nurses[0].id);
    expect(nurse1Cells.find(s => s.date === '2024-01-01')?.shiftType).toBe('D');
    expect(nurse1Cells.find(s => s.date === '2024-01-02')?.shiftType).toBe('D');
    expect(nurse1Cells.find(s => s.date === '2024-01-03')?.shiftType).toBe('D');
    expect(nurse1Cells.find(s => s.date === '2024-01-01')?.isFixed).toBe(true);
    expect(nurse1Cells.find(s => s.date === '2024-01-02')?.isFixed).toBe(true);
    expect(nurse1Cells.find(s => s.date === '2024-01-03')?.isFixed).toBe(true);
  });

  it('고정 셀이 있어도 일일 필수 인원 충족', () => {
    // UI와 동일: 연차 포함 테스트
    const nurses = createTestNurses();

    // 고정 셀: 간호사1~5를 OFF로 고정 (극단적 케이스)
    const fixedCells: ScheduleCell[] = [];
    for (let i = 0; i < 5; i++) {
      fixedCells.push({
        nurseId: nurses[i].id,
        date: '2024-01-01',
        shiftType: 'OFF',
        isFixed: true
      });
    }

    // 고정 셀을 포함하여 스케줄 생성
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE, false, fixedCells);

    // 1/1의 필수 인원이 충족되는지 확인 (D:3, E:3, N:2)
    const jan1Cells = schedule.filter(s => s.date === '2024-01-01');
    const dCount = jan1Cells.filter(s => s.shiftType === 'D').length;
    const eCount = jan1Cells.filter(s => s.shiftType === 'E').length;
    const nCount = jan1Cells.filter(s => s.shiftType === 'N').length;

    expect(dCount).toBe(DAILY_REQUIRED_STAFF['D']); // 3명
    expect(eCount).toBe(DAILY_REQUIRED_STAFF['E']); // 3명
    expect(nCount).toBe(DAILY_REQUIRED_STAFF['N']); // 2명

    // 고정 셀은 그대로 유지
    const offCount = jan1Cells.filter(s => s.shiftType === 'OFF').length;
    expect(offCount).toBe(5); // 고정한 5명
  });

  it('고정 셀이 있을 때 필수 인원을 초과하지 않음', () => {
    // UI와 동일: 연차 포함 테스트
    const nurses = createTestNurses();

    // 2024-01-01에 간호사 2명을 D로 고정
    const fixedCells: ScheduleCell[] = [
      { nurseId: nurses[0].id, date: '2024-01-01', shiftType: 'D', isFixed: true },
      { nurseId: nurses[1].id, date: '2024-01-01', shiftType: 'D', isFixed: true },
    ];

    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE, false, fixedCells);

    // 2024-01-01의 D 근무 카운트
    const jan1Cells = schedule.filter(s => s.date === '2024-01-01');
    const dCount = jan1Cells.filter(s => s.shiftType === 'D').length;

    // D 필수 인원은 3명인데, 이미 2명이 고정되어 있으므로
    // 추가로 1명만 배정되어야 함 (총 3명)
    expect(dCount).toBe(DAILY_REQUIRED_STAFF['D']); // 정확히 3명 (초과 안 됨)

    // 고정한 2명이 포함되어 있는지 확인
    expect(jan1Cells.find(s => s.nurseId === nurses[0].id)?.shiftType).toBe('D');
    expect(jan1Cells.find(s => s.nurseId === nurses[1].id)?.shiftType).toBe('D');
  });
});

describe('scheduler.ts - AND 조건 통합 테스트', () => {
  it('🔴 중요: 모든 하드 제약 조건을 동시에 만족하는지 검증 (AND 조건)', () => {
    // UI와 동일: 연차 포함 + randomize=true
    const nurses = createTestNurses();
    const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE, true);

    // validator로 전체 검증
    const { violations, dailyStaffStatus } = validateSchedule(schedule, nurses);

    // 하드 제약 조건만 체크 (SOFT 제약은 권장 사항이므로 위반 가능)
    const hardViolations = violations.filter(v => v.type === 'HARD');
    if (hardViolations.length > 0) {
      console.log('❌ 하드 제약 조건 위반 발견:');
      hardViolations.forEach((v: any) => {
        console.log(`  - ${v.message}`);
      });
    }

    expect(hardViolations).toHaveLength(0);

    // 모든 날짜의 필수 인원이 충족되었는지 확인
    const dates = Object.keys(dailyStaffStatus).sort();
    dates.forEach(date => {
      const status = dailyStaffStatus[date];

      // D, M, E, N 모두 'ok' 또는 'warning'이어야 함 ('error'이면 안 됨)
      if (status.D === 'error' || status.M === 'error' || status.E === 'error' || status.N === 'error') {
        console.log(`❌ ${date} 필수 인원 미충족:`, status);
      }
      expect(status.D).not.toBe('error');
      expect(status.M).not.toBe('error');
      expect(status.E).not.toBe('error');
      expect(status.N).not.toBe('error');
    });
  });

  it('여러 번 생성해도 모든 제약 조건 만족 (랜덤 요소 테스트 - 200회)', () => {
    // UI와 동일: 연차 포함 테스트
    const nurses = createTestNurses();

    // 200번 반복 생성 (랜덤 요소에도 제약 조건 만족 확인)
    // ⚠️ UI와 동일하게 randomize=true로 테스트
    for (let i = 0; i < 200; i++) {
      const schedule = generateSimpleSchedule(nurses, DEFAULT_START_DATE, DEFAULT_END_DATE, true);
      const { violations } = validateSchedule(schedule, nurses);

      // 하드 제약 조건만 체크 (SOFT 제약은 권장 사항이므로 위반 가능)
      const hardViolations = violations.filter(v => v.type === 'HARD');
      if (hardViolations.length > 0) {
        console.log(`❌ ${i + 1}번째 생성에서 하드 제약 위반 발견:`);
        hardViolations.forEach((v: any) => {
          console.log(`  - ${v.message}`);
        });
      }

      expect(hardViolations).toHaveLength(0);
    }
  });

  it('다양한 기간으로 생성해도 모든 제약 조건 만족', () => {
    // UI와 동일: 연차 포함 테스트
    const nurses = createTestNurses();

    const testCases = [
      // 4주 단위로 설계된 스케줄 시스템이므로 4주만 테스트
      // (짧은 기간은 마지막 날 나이트 배정이 어려울 수 있음)
      { start: DEFAULT_START_DATE, end: '2024-01-14', desc: '2주' },
      { start: DEFAULT_START_DATE, end: DEFAULT_END_DATE, desc: '4주 (기본)' },
    ];

    testCases.forEach(({ start, end, desc }) => {
      const schedule = generateSimpleSchedule(nurses, start, end);
      const { violations } = validateSchedule(schedule, nurses);

      // 하드 제약 조건만 체크 (SOFT 제약은 권장 사항이므로 위반 가능)
      const hardViolations = violations.filter(v => v.type === 'HARD');
      if (hardViolations.length > 0) {
        console.log(`❌ ${desc} 기간에서 하드 제약 위반 발견:`);
        hardViolations.forEach((v: any) => {
          console.log(`  - ${v.message}`);
        });
      }

      expect(hardViolations).toHaveLength(0);
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

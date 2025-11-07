import type { ScheduleCell, ShiftType, Violation } from '../types';
import { DAILY_REQUIRED_STAFF, SHIFT_ORDER, MAX_CONSECUTIVE_WORK_DAYS } from '../constants';

/**
 * 1. 일일 필수 인원 검증
 * D: 3명, M: 1명, E: 3명, N: 2명 필수
 */
export function validateDailyStaffRequirement(
  date: string,
  schedule: ScheduleCell[]
): Violation[] {
  const violations: Violation[] = [];
  const dayCells = schedule.filter((s) => s.date === date);

  // 각 근무 타입별 카운트
  const counts: Record<ShiftType, number> = {
    D: 0,
    M: 0,
    E: 0,
    N: 0,
    OFF: 0,
    WEEK_OFF: 0,
    ANNUAL: 0,
    MENSTRUAL: 0,
  };

  dayCells.forEach((cell) => {
    counts[cell.shiftType]++;
  });

  // 필수 인원 체크
  const requiredShifts: ShiftType[] = ['D', 'M', 'E', 'N'];
  requiredShifts.forEach((shiftType) => {
    const required = DAILY_REQUIRED_STAFF[shiftType];
    const actual = counts[shiftType];

    if (actual < required) {
      violations.push({
        type: 'HARD',
        nurseId: '',
        nurseName: '',
        date,
        message: `${date} - ${shiftType} 근무 부족: ${actual}명 (필요: ${required}명)`,
      });
    }
  });

  return violations;
}

/**
 * 2. 근무 순서 규칙 검증
 * D → M → E → N → 휴일 순서만 가능, 역순 불가
 */
export function validateShiftOrder(
  nurseId: string,
  nurseName: string,
  schedule: ScheduleCell[]
): Violation[] {
  const violations: Violation[] = [];

  // 해당 간호사의 스케줄만 필터링하고 날짜순 정렬
  const nurseCells = schedule
    .filter((s) => s.nurseId === nurseId)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 1; i < nurseCells.length; i++) {
    const prevCell = nurseCells[i - 1];
    const currCell = nurseCells[i];

    const prevShift = prevCell.shiftType;
    const currShift = currCell.shiftType;

    // 휴일 타입들
    const restTypes: ShiftType[] = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];

    // 이전이 휴일이면 현재는 어떤 근무든 가능 (처음부터 시작)
    if (restTypes.includes(prevShift)) {
      continue;
    }

    // 현재가 휴일이면 항상 가능
    if (restTypes.includes(currShift)) {
      continue;
    }

    // 같은 근무 연속은 가능
    if (prevShift === currShift) {
      continue;
    }

    // 근무 순서 확인: D(0) → M(1) → E(2) → N(3)
    const prevIndex = SHIFT_ORDER.indexOf(prevShift);
    const currIndex = SHIFT_ORDER.indexOf(currShift);

    if (prevIndex === -1 || currIndex === -1) {
      continue;
    }

    // 역순 체크: 현재가 이전보다 작으면 역순
    if (currIndex < prevIndex) {
      violations.push({
        type: 'HARD',
        nurseId,
        nurseName,
        date: currCell.date,
        message: `${nurseName} - ${currCell.date}: 근무 순서 위반 (${prevShift} → ${currShift})`,
      });
    }
  }

  return violations;
}

/**
 * 3. 연속 근무일 제한 검증
 * 최대 5일 연속 근무까지만 가능, 6일 이상 불가
 */
export function validateConsecutiveWorkDays(
  nurseId: string,
  nurseName: string,
  schedule: ScheduleCell[]
): Violation[] {
  const violations: Violation[] = [];

  // 해당 간호사의 스케줄만 필터링하고 날짜순 정렬
  const nurseCells = schedule
    .filter((s) => s.nurseId === nurseId)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 휴일 타입들
  const restTypes: ShiftType[] = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];

  let consecutiveWorkDays = 0;
  let workStartDate = '';

  for (let i = 0; i < nurseCells.length; i++) {
    const cell = nurseCells[i];
    const shiftType = cell.shiftType;

    // 휴일이면 연속 근무 리셋
    if (restTypes.includes(shiftType)) {
      consecutiveWorkDays = 0;
      workStartDate = '';
    } else {
      // 근무일이면 카운트 증가
      if (consecutiveWorkDays === 0) {
        workStartDate = cell.date;
      }
      consecutiveWorkDays++;

      // 6일 이상 연속 근무 시 위반
      if (consecutiveWorkDays > MAX_CONSECUTIVE_WORK_DAYS) {
        violations.push({
          type: 'HARD',
          nurseId,
          nurseName,
          date: cell.date,
          message: `${nurseName} - ${cell.date}: 연속 근무일 초과 (${consecutiveWorkDays}일 연속, 최대 ${MAX_CONSECUTIVE_WORK_DAYS}일)`,
        });
      }
    }
  }

  return violations;
}

/**
 * 전체 스케줄 검증
 */
export function validateSchedule(
  schedule: ScheduleCell[],
  nurses: { id: string; name: string }[]
): {
  violations: Violation[];
  dailyStaffStatus: Record<string, Record<ShiftType, 'ok' | 'warning' | 'error'>>;
} {
  const violations: Violation[] = [];

  // 날짜 목록 추출
  const dates = Array.from(new Set(schedule.map((s) => s.date))).sort();

  // 일일 필수 인원 검증
  const dailyStaffStatus: Record<string, Record<ShiftType, 'ok' | 'warning' | 'error'>> = {};

  dates.forEach((date) => {
    const dateViolations = validateDailyStaffRequirement(date, schedule);
    violations.push(...dateViolations);

    // 상태 계산
    const dayCells = schedule.filter((s) => s.date === date);
    const counts: Record<ShiftType, number> = {
      D: 0,
      M: 0,
      E: 0,
      N: 0,
      OFF: 0,
      WEEK_OFF: 0,
      ANNUAL: 0,
      MENSTRUAL: 0,
    };

    dayCells.forEach((cell) => {
      counts[cell.shiftType]++;
    });

    dailyStaffStatus[date] = {} as Record<ShiftType, 'ok' | 'warning' | 'error'>;
    const requiredShifts: ShiftType[] = ['D', 'M', 'E', 'N'];
    requiredShifts.forEach((shiftType) => {
      const required = DAILY_REQUIRED_STAFF[shiftType];
      const actual = counts[shiftType];

      if (actual < required) {
        dailyStaffStatus[date][shiftType] = 'error';
      } else if (actual > required) {
        dailyStaffStatus[date][shiftType] = 'warning';
      } else {
        dailyStaffStatus[date][shiftType] = 'ok';
      }
    });
  });

  // 근무 순서 규칙 검증
  nurses.forEach((nurse) => {
    const orderViolations = validateShiftOrder(nurse.id, nurse.name, schedule);
    violations.push(...orderViolations);
  });

  // 연속 근무일 제한 검증
  nurses.forEach((nurse) => {
    const consecutiveViolations = validateConsecutiveWorkDays(nurse.id, nurse.name, schedule);
    violations.push(...consecutiveViolations);
  });

  return { violations, dailyStaffStatus };
}

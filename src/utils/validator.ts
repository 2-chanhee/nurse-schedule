import type { ScheduleCell, ShiftType, Violation } from '../types';
import { DAILY_REQUIRED_STAFF, SHIFT_ORDER, MAX_CONSECUTIVE_WORK_DAYS } from '../constants';

/**
 * 1. 일일 필수 인원 검증
 * D: 3명, E: 3명, N: 2명 필수
 * M: 1명 권장 (최선을 다하지만 불가능하면 0명 허용)
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

  // 필수 인원 체크 (D, E, N만 필수, M은 제외)
  const requiredShifts: ShiftType[] = ['D', 'E', 'N'];
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
 * 3. 주간 휴식 규칙 검증 (일~토 기준)
 * 각 주마다: 주휴 1일 + OFF/연차/생휴 최소 1일 = 총 2일 이상
 */
export function validateWeeklyRest(
  nurseId: string,
  nurseName: string,
  schedule: ScheduleCell[]
): Violation[] {
  const violations: Violation[] = [];

  // 해당 간호사의 스케줄만 필터링하고 날짜순 정렬
  const nurseCells = schedule
    .filter((s) => s.nurseId === nurseId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (nurseCells.length === 0) {
    return violations;
  }

  // 날짜를 주 단위로 그룹화 (일요일 시작)
  const weekGroups: Map<string, ScheduleCell[]> = new Map();

  nurseCells.forEach((cell) => {
    const date = new Date(cell.date);
    // 해당 주의 일요일 날짜를 키로 사용
    const dayOfWeek = date.getDay(); // 0 = 일요일
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - dayOfWeek);
    const weekKey = sunday.toISOString().split('T')[0];

    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(cell);
  });

  // 각 주마다 검증 (단, 완전한 주만 - 7일인 경우)
  weekGroups.forEach((weekCells, weekStartDate) => {
    // 불완전한 주는 검증하지 않음 (스케줄의 시작/끝이 주 중간인 경우)
    if (weekCells.length < 7) {
      return; // 이 주는 건너뜀
    }

    const restTypes: ShiftType[] = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];

    // 휴일별 카운트
    let weekOffCount = 0;
    let offCount = 0; // OFF만 카운트 (필수)
    let annualOrMenstrualCount = 0; // 연차/생휴 (추가 옵션)

    weekCells.forEach((cell) => {
      if (cell.shiftType === 'WEEK_OFF') {
        weekOffCount++;
      } else if (cell.shiftType === 'OFF') {
        offCount++;
      } else if (cell.shiftType === 'ANNUAL' || cell.shiftType === 'MENSTRUAL') {
        annualOrMenstrualCount++;
      }
    });

    const totalRestDays = weekOffCount + offCount + annualOrMenstrualCount;

    // 주휴일이 정확히 1일이 아닌 경우
    if (weekOffCount !== 1) {
      violations.push({
        type: 'HARD',
        nurseId,
        nurseName,
        date: weekStartDate,
        message: `${nurseName} - ${weekStartDate} 주: 주휴일이 ${weekOffCount}일 (정확히 1일 필요)`,
      });
    }

    // OFF가 최소 1일 미만인 경우
    if (offCount < 1) {
      violations.push({
        type: 'HARD',
        nurseId,
        nurseName,
        date: weekStartDate,
        message: `${nurseName} - ${weekStartDate} 주: OFF가 ${offCount}일 (최소 1일 필요)`,
      });
    }

    // 총 휴일이 2일 미만인 경우 (이중 검증)
    if (totalRestDays < 2) {
      violations.push({
        type: 'HARD',
        nurseId,
        nurseName,
        date: weekStartDate,
        message: `${nurseName} - ${weekStartDate} 주: 총 휴일이 ${totalRestDays}일 (최소 2일 필요)`,
      });
    }
  });

  return violations;
}

/**
 * 4. 나이트 근무 2-3일 연속 규칙 검증
 * - 나이트는 2일 또는 3일 연속만 가능
 * - 1일만 근무 불가
 * - 4일 이상 연속 불가
 */
export function validateNightBlockLength(
  nurseId: string,
  nurseName: string,
  schedule: ScheduleCell[]
): Violation[] {
  const violations: Violation[] = [];

  // 전체 스케줄의 마지막 날짜 계산
  const allDates = schedule.map((s) => s.date).sort();
  const lastDate = allDates.length > 0 ? allDates[allDates.length - 1] : '';

  // 해당 간호사의 스케줄만 필터링하고 날짜순 정렬
  const nurseCells = schedule
    .filter((s) => s.nurseId === nurseId)
    .sort((a, b) => a.date.localeCompare(b.date));

  let consecutiveNightDays = 0;
  let nightStartDate = '';

  for (let i = 0; i < nurseCells.length; i++) {
    const cell = nurseCells[i];
    const shiftType = cell.shiftType;

    if (shiftType === 'N') {
      // 나이트 근무일
      if (consecutiveNightDays === 0) {
        nightStartDate = cell.date; // 나이트 블록 시작
      }
      consecutiveNightDays++;

      // 4일 이상 연속 나이트 시 위반
      if (consecutiveNightDays > 3) {
        violations.push({
          type: 'HARD',
          nurseId,
          nurseName,
          date: cell.date,
          message: `${nurseName} - ${cell.date}: 나이트 연속 근무일 초과 (${consecutiveNightDays}일 연속, 최대 3일)`,
        });
      }
    } else {
      // 나이트가 아닌 날
      if (consecutiveNightDays > 0) {
        // 나이트 블록이 끝남 -> 길이 체크
        if (consecutiveNightDays === 1) {
          // 1일만 나이트 근무 시 위반 (단, 마지막 날 예외)
          const isLastDayNight = nightStartDate === lastDate;
          if (!isLastDayNight) {
            violations.push({
              type: 'HARD',
              nurseId,
              nurseName,
              date: nightStartDate,
              message: `${nurseName} - ${nightStartDate}: 나이트 1일만 근무 (최소 2일 연속 필요)`,
            });
          }
        }
        // 2일 또는 3일은 정상
        consecutiveNightDays = 0;
        nightStartDate = '';
      }
    }
  }

  // 마지막이 나이트로 끝나는 경우는 검증하지 않음
  // (다음 4주 스케줄로 이어질 수 있으므로 현재 스케줄만으로는 판단 불가)

  return violations;
}

/**
 * 5. 나이트 후 2일 휴식 규칙 검증
 * 나이트 근무 종료 후 최소 2일 연속 휴식 필요
 */
export function validateNightRestDays(
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

  let consecutiveNightDays = 0;
  let nightEndDate = '';

  for (let i = 0; i < nurseCells.length; i++) {
    const cell = nurseCells[i];
    const shiftType = cell.shiftType;

    if (shiftType === 'N') {
      // 나이트 근무일
      consecutiveNightDays++;
    } else {
      // 나이트가 아닌 날
      if (consecutiveNightDays > 0) {
        // 나이트 블록이 끝남 -> 이전 셀이 나이트 종료일
        nightEndDate = nurseCells[i - 1].date;

        // 나이트 종료 후 2일 연속 휴식 확인
        // 향후 2일 확인 (스케줄 끝까지만)
        let restDaysAfterNight = 0;
        for (let j = i; j < nurseCells.length && j < i + 2; j++) {
          if (restTypes.includes(nurseCells[j].shiftType)) {
            restDaysAfterNight++;
          } else {
            // 근무일이 나오면 중단
            break;
          }
        }

        // 2일 연속 휴식이 아닌 경우 위반
        if (restDaysAfterNight < 2) {
          violations.push({
            type: 'HARD',
            nurseId,
            nurseName,
            date: nightEndDate,
            message: `${nurseName} - ${nightEndDate}: 나이트 종료 후 ${restDaysAfterNight}일 휴식 (최소 2일 연속 휴식 필요)`,
          });
        }

        consecutiveNightDays = 0;
        nightEndDate = '';
      }
    }
  }

  return violations;
}

/**
 * 6. 나이트 2주 연속 제한 검증 (소프트 제약)
 * 연속된 2주에 모두 나이트 근무가 있으면 권장하지 않음
 * (인력 부족 시 불가피하므로 SOFT 위반)
 */
export function validateNightTwoWeekLimit(
  nurseId: string,
  nurseName: string,
  schedule: ScheduleCell[]
): Violation[] {
  const violations: Violation[] = [];

  // 해당 간호사의 스케줄만 필터링하고 날짜순 정렬
  const nurseCells = schedule
    .filter((s) => s.nurseId === nurseId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (nurseCells.length === 0) {
    return violations;
  }

  // 날짜를 주 단위로 그룹화 (일요일 시작)
  const weekGroups: Map<string, ScheduleCell[]> = new Map();

  nurseCells.forEach((cell) => {
    const date = new Date(cell.date);
    // 해당 주의 일요일 날짜를 키로 사용
    const dayOfWeek = date.getDay(); // 0 = 일요일
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - dayOfWeek);
    const weekKey = sunday.toISOString().split('T')[0];

    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(cell);
  });

  // 주 단위로 나이트 근무 여부 확인
  const weeksWithNight: string[] = [];
  weekGroups.forEach((weekCells, weekStartDate) => {
    const hasNight = weekCells.some((cell) => cell.shiftType === 'N');
    if (hasNight) {
      weeksWithNight.push(weekStartDate);
    }
  });

  // 연속된 2주에 나이트가 있는지 확인
  weeksWithNight.sort(); // 날짜순 정렬
  for (let i = 0; i < weeksWithNight.length - 1; i++) {
    const currentWeek = new Date(weeksWithNight[i]);
    const nextWeek = new Date(weeksWithNight[i + 1]);

    // 다음 주가 정확히 7일 후인지 확인 (연속된 주)
    const daysDiff = (nextWeek.getTime() - currentWeek.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff === 7) {
      violations.push({
        type: 'SOFT',
        nurseId,
        nurseName,
        date: weeksWithNight[i + 1],
        message: `${nurseName} - ${weeksWithNight[i + 1]} 주: 2주 연속 나이트 근무 (권장하지 않음)`,
      });
    }
  }

  return violations;
}

/**
 * 7. 연속 근무일 제한 검증
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
 * 주휴일과 연차 겹침 검증
 * 간호사의 연차 신청 날짜와 주휴일이 같은 요일인지 확인
 */
export function validateAnnualWeekOffConflict(nurse: Nurse): Violation[] {
  const violations: Violation[] = [];

  if (!nurse.annualLeaveDates || nurse.annualLeaveDates.length === 0) {
    return violations;
  }

  // 주휴일 요일을 숫자로 변환
  const dayMap: Record<DayOfWeek, number> = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
  };
  const weekOffDayNum = dayMap[nurse.weekOffDay];

  // 각 연차 날짜의 요일 확인
  nurse.annualLeaveDates.forEach((annualDate) => {
    const date = new Date(annualDate);
    const annualDayNum = date.getDay();

    if (annualDayNum === weekOffDayNum) {
      violations.push({
        type: 'HARD',
        nurseId: nurse.id,
        nurseName: nurse.name,
        date: annualDate,
        message: `${nurse.name} - ${annualDate}: 주휴일과 연차가 겹칩니다 (둘 다 ${['일', '월', '화', '수', '목', '금', '토'][weekOffDayNum]}요일)`,
      });
    }
  });

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

    // D, E, N은 필수 (부족하면 error)
    const requiredShifts: ShiftType[] = ['D', 'E', 'N'];
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

    // M은 권장 (부족해도 warning)
    const actualM = counts['M'];
    const requiredM = DAILY_REQUIRED_STAFF['M'];
    if (actualM < requiredM) {
      dailyStaffStatus[date]['M'] = 'warning'; // error가 아닌 warning
    } else if (actualM > requiredM) {
      dailyStaffStatus[date]['M'] = 'warning';
    } else {
      dailyStaffStatus[date]['M'] = 'ok';
    }
  });

  // 근무 순서 규칙 검증
  nurses.forEach((nurse) => {
    const orderViolations = validateShiftOrder(nurse.id, nurse.name, schedule);
    violations.push(...orderViolations);
  });

  // 주간 휴식 규칙 검증
  nurses.forEach((nurse) => {
    const weeklyRestViolations = validateWeeklyRest(nurse.id, nurse.name, schedule);
    violations.push(...weeklyRestViolations);
  });

  // 연속 근무일 제한 검증
  nurses.forEach((nurse) => {
    const consecutiveViolations = validateConsecutiveWorkDays(nurse.id, nurse.name, schedule);
    violations.push(...consecutiveViolations);
  });

  // 나이트 2-3일 연속 규칙 검증
  nurses.forEach((nurse) => {
    const nightBlockViolations = validateNightBlockLength(nurse.id, nurse.name, schedule);
    violations.push(...nightBlockViolations);
  });

  // 나이트 후 2일 휴식 규칙 검증
  nurses.forEach((nurse) => {
    const nightRestViolations = validateNightRestDays(nurse.id, nurse.name, schedule);
    violations.push(...nightRestViolations);
  });

  // 나이트 2주 연속 제한 검증 (소프트 제약)
  nurses.forEach((nurse) => {
    const nightTwoWeekViolations = validateNightTwoWeekLimit(nurse.id, nurse.name, schedule);
    violations.push(...nightTwoWeekViolations);
  });

  // 주휴일과 연차 겹침 검증
  nurses.forEach((nurse) => {
    const annualWeekOffConflict = validateAnnualWeekOffConflict(nurse);
    violations.push(...annualWeekOffConflict);
  });

  return { violations, dailyStaffStatus };
}

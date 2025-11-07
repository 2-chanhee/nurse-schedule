import type { Nurse, ScheduleCell, ShiftType, DayOfWeek } from '../types';
import { DAILY_REQUIRED_STAFF, SHIFT_ORDER, MAX_CONSECUTIVE_WORK_DAYS } from '../constants';

/**
 * Date 객체의 getDay() 결과를 DayOfWeek 타입으로 변환
 * getDay(): 0(일) ~ 6(토)
 */
function getDayOfWeek(date: Date): DayOfWeek {
  const dayMap: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return dayMap[date.getDay()];
}

/**
 * 간단한 자동 스케줄 생성
 * 기본 규칙:
 * 1. 일일 필수 인원 충족 (D: 3, M: 1, E: 3, N: 2)
 * 2. 근무 순서 준수 (D → M → E → N)
 * 3. 공평한 근무 분배
 */
export function generateSimpleSchedule(
  nurses: Nurse[],
  startDate: string,
  endDate: string
): ScheduleCell[] {
  const schedule: ScheduleCell[] = [];

  if (nurses.length === 0) {
    return schedule;
  }

  // 날짜 배열 생성
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  // 각 간호사의 근무 카운트 추적
  const workCount: Record<string, number> = {};
  nurses.forEach((nurse) => {
    workCount[nurse.id] = 0;
  });

  // 각 간호사의 마지막 근무 타입 추적
  const lastShift: Record<string, ShiftType> = {};

  // 각 간호사의 연속 근무일 추적
  const consecutiveWorkDays: Record<string, number> = {};
  nurses.forEach((nurse) => {
    consecutiveWorkDays[nurse.id] = 0;
  });

  // 각 날짜별로 스케줄 생성
  dates.forEach((date, dateIndex) => {
    const dayOfWeek = new Date(date).getDay(); // 0 = 일요일

    // 사용 가능한 간호사 목록 (근무 카운트로 정렬 + 랜덤 섞기)
    const availableNurses = [...nurses].sort((a, b) => {
      const countDiff = workCount[a.id] - workCount[b.id];
      // 근무 카운트가 같으면 랜덤하게 (매번 다른 스케줄)
      if (countDiff === 0) {
        return Math.random() - 0.5;
      }
      return countDiff;
    });

    const assignedNurses = new Set<string>();
    const todayShift: Record<string, ShiftType> = {}; // 오늘 배정된 근무 임시 저장

    // 연속 근무일 체크: 이미 5일 연속 근무한 간호사는 제외
    const canWork = (nurseId: string): boolean => {
      return consecutiveWorkDays[nurseId] < MAX_CONSECUTIVE_WORK_DAYS;
    };

    // 0. 주휴일 배정 (최우선)
    const todayDayOfWeek = getDayOfWeek(new Date(date));
    for (const nurse of nurses) {
      if (nurse.weekOffDay === todayDayOfWeek) {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'WEEK_OFF',
          isFixed: true, // 주휴일은 고정
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = 'WEEK_OFF';
      }
    }

    // 1. 나이트 근무 배정 (2명)
    let nightCount = 0;
    for (const nurse of availableNurses) {
      if (nightCount >= DAILY_REQUIRED_STAFF.N) break;
      if (assignedNurses.has(nurse.id)) continue;
      if (!canWork(nurse.id)) continue;

      const last = lastShift[nurse.id];
      if (!last || last === 'OFF' || last === 'WEEK_OFF' ||
          last === 'ANNUAL' || last === 'MENSTRUAL' ||
          last === 'E' || last === 'N') {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'N',
          isFixed: false,
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = 'N';
        workCount[nurse.id]++;
        nightCount++;
      }
    }

    // 2. 데이 근무 배정 (3명)
    let dayCount = 0;
    for (const nurse of availableNurses) {
      if (dayCount >= DAILY_REQUIRED_STAFF.D) break;
      if (assignedNurses.has(nurse.id)) continue;
      if (!canWork(nurse.id)) continue;

      const last = lastShift[nurse.id];
      if (!last || last === 'OFF' || last === 'WEEK_OFF' ||
          last === 'ANNUAL' || last === 'MENSTRUAL' || last === 'D') {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'D',
          isFixed: false,
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = 'D';
        workCount[nurse.id]++;
        dayCount++;
      }
    }

    // 3. 중간 근무 배정 (1명)
    let middleCount = 0;
    for (const nurse of availableNurses) {
      if (middleCount >= DAILY_REQUIRED_STAFF.M) break;
      if (assignedNurses.has(nurse.id)) continue;
      if (!canWork(nurse.id)) continue;

      const last = lastShift[nurse.id];
      // M은 휴일 후, D, M 다음 가능
      if (!last || last === 'OFF' || last === 'WEEK_OFF' ||
          last === 'ANNUAL' || last === 'MENSTRUAL' ||
          last === 'D' || last === 'M') {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'M',
          isFixed: false,
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = 'M';
        workCount[nurse.id]++;
        middleCount++;
      }
    }

    // 4. 이브닝 근무 배정 (3명)
    let eveningCount = 0;
    for (const nurse of availableNurses) {
      if (eveningCount >= DAILY_REQUIRED_STAFF.E) break;
      if (assignedNurses.has(nurse.id)) continue;
      if (!canWork(nurse.id)) continue;

      const last = lastShift[nurse.id];
      // E는 휴일 후, D, M, E 다음 가능
      if (!last || last === 'OFF' || last === 'WEEK_OFF' ||
          last === 'ANNUAL' || last === 'MENSTRUAL' ||
          last === 'D' || last === 'M' || last === 'E') {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'E',
          isFixed: false,
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = 'E';
        workCount[nurse.id]++;
        eveningCount++;
      }
    }

    // 5. 나머지는 OFF 배정
    for (const nurse of nurses) {
      if (!assignedNurses.has(nurse.id)) {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'OFF',
          isFixed: false,
        });
        todayShift[nurse.id] = 'OFF';
      }
    }

    // 6. 오늘 배정이 완료되면 lastShift와 연속 근무일 업데이트
    for (const nurseId in todayShift) {
      lastShift[nurseId] = todayShift[nurseId];

      // 연속 근무일 업데이트
      const shiftType = todayShift[nurseId];
      const restTypes: ShiftType[] = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];

      if (restTypes.includes(shiftType)) {
        // 휴일이면 연속 근무일 리셋
        consecutiveWorkDays[nurseId] = 0;
      } else {
        // 근무일이면 연속 근무일 증가
        consecutiveWorkDays[nurseId]++;
      }
    }
  });

  return schedule;
}

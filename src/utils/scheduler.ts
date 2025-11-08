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
 *
 * @param randomize - true일 경우 매번 다른 스케줄 생성 (UI용), false일 경우 동일한 결과 (테스트용, 기본값)
 */
export function generateSimpleSchedule(
  nurses: Nurse[],
  startDate: string,
  endDate: string,
  randomize: boolean = false
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

  // 각 간호사의 현재 주 OFF 카운트 (필수)
  const weeklyOffCount: Record<string, number> = {};
  nurses.forEach((nurse) => {
    weeklyOffCount[nurse.id] = 0;
  });

  // 각 간호사의 나이트 블록 진행 상태 (0: 나이트 아님, 1: 1일차, 2: 2일차, 3: 3일차)
  const nightBlockStatus: Record<string, number> = {};
  nurses.forEach((nurse) => {
    nightBlockStatus[nurse.id] = 0;
  });

  // 각 날짜별로 스케줄 생성
  dates.forEach((date, dateIndex) => {
    const dayOfWeek = new Date(date).getDay(); // 0 = 일요일

    // 일요일이면 주간 OFF 카운트 리셋
    if (dayOfWeek === 0) {
      nurses.forEach((nurse) => {
        weeklyOffCount[nurse.id] = 0;
      });
    }

    // 사용 가능한 간호사 목록을 반환하는 함수 (근무 카운트순 정렬)
    const getAvailableNurses = () => {
      return [...nurses].sort((a, b) => {
        const countDiff = workCount[a.id] - workCount[b.id];
        // 근무 카운트가 같을 때
        if (countDiff === 0) {
          // randomize가 true이면 랜덤 정렬 (UI용, 매번 다른 스케줄)
          if (randomize) {
            return Math.random() - 0.5;
          }
          // false이면 ID순 정렬 (테스트용, 안정적인 결과)
          return a.id.localeCompare(b.id);
        }
        return countDiff;
      });
    };

    const assignedNurses = new Set<string>();
    const todayShift: Record<string, ShiftType> = {}; // 오늘 배정된 근무 임시 저장

    // 연속 근무일 체크: 이미 5일 연속 근무한 간호사는 제외
    // 토요일(6)에는 주간 OFF가 0인 간호사는 근무 불가
    const canWork = (nurseId: string): boolean => {
      if (consecutiveWorkDays[nurseId] >= MAX_CONSECUTIVE_WORK_DAYS) {
        return false;
      }
      // 토요일이면서 주간 OFF가 아직 0인 경우 근무 불가 (OFF 강제)
      if (dayOfWeek === 6 && weeklyOffCount[nurseId] === 0) {
        return false;
      }
      return true;
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

    // 0-1. 연차 배정 (고정)
    for (const nurse of nurses) {
      if (nurse.annualLeaveDates && nurse.annualLeaveDates.includes(date)) {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'ANNUAL',
          isFixed: true, // 연차는 고정
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = 'ANNUAL';
      }
    }

    // 1. 데이 근무 배정 (3명) - 최우선 배정
    let dayCount = 0;
    for (const nurse of getAvailableNurses()) {
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

    // 2. 중간 근무 배정 (1명) - D 직후 배정 (선택지가 많을 때 할당하여 성공률 극대화)
    // M은 "D 다음 또는 M 다음"에만 가능하므로, D 직후에 배정하면 최적
    // 토요일 OFF 강제 조건도 완화하여 최대한 M=0 방지
    let middleCount = 0;
    for (const nurse of getAvailableNurses()) {
      if (middleCount >= DAILY_REQUIRED_STAFF.M) break;
      if (assignedNurses.has(nurse.id)) continue;

      // M은 연속 근무일만 체크 (토요일 OFF 강제 제외)
      if (consecutiveWorkDays[nurse.id] >= MAX_CONSECUTIVE_WORK_DAYS) {
        continue;
      }

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

    // 3. 나이트 근무 배정 (2명) - 나이트 블록 관리 (2-3일 연속)
    let nightCount = 0;

    // 3-1. 이미 나이트 중인 간호사 우선 처리 (연속성 유지)
    for (const nurse of nurses) {
      if (nightCount >= DAILY_REQUIRED_STAFF.N) break;
      if (assignedNurses.has(nurse.id)) continue;

      const status = nightBlockStatus[nurse.id];

      if (status === 1) {
        // 나이트 1일차 -> 반드시 2일차 계속
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
        nightBlockStatus[nurse.id] = 2; // 2일차로 전환
      } else if (status === 2) {
        // 나이트 2일차 -> 마지막 날이거나 N이 부족하면 무조건 3일차, 아니면 70% 확률로 3일차
        const isLastDay = dateIndex === dates.length - 1;
        const needMoreNight = nightCount < DAILY_REQUIRED_STAFF.N;
        const continueToDay3 = isLastDay || needMoreNight || (randomize ? Math.random() < 0.7 : true);
        if (continueToDay3) {
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
          nightBlockStatus[nurse.id] = 3; // 3일차로 전환
        } else {
          nightBlockStatus[nurse.id] = 0; // 나이트 종료
        }
      }
      // status === 3이면 반드시 종료 (아무것도 안 함, 아래서 0으로 리셋됨)
    }

    // 3-2. 부족한 만큼 새로운 나이트 시작 (1일차)
    // 단, 최소 2일이 남아있어야 나이트 시작 가능
    // 예외: 마지막 날에 N이 부족하면 1일 나이트도 허용 (긴급 조치)
    const daysRemaining = dates.length - dateIndex;
    const isLastDay = dateIndex === dates.length - 1;
    const canStartNewNight = daysRemaining >= 2 || (isLastDay && nightCount < DAILY_REQUIRED_STAFF.N);

    if (canStartNewNight) {
      for (const nurse of getAvailableNurses()) {
        if (nightCount >= DAILY_REQUIRED_STAFF.N) break;
        if (assignedNurses.has(nurse.id)) continue;
        if (!canWork(nurse.id)) continue;
        if (nightBlockStatus[nurse.id] !== 0) continue; // 이미 나이트 중이면 스킵

        // 나이트 시작 전 체크: 향후 2일 동안 주휴일이 없는지 확인
        // (나이트는 최소 2일 연속이므로)
        let hasWeekOffInNext2Days = false;
        for (let i = 0; i < 2 && dateIndex + i < dates.length; i++) {
          const futureDate = dates[dateIndex + i];
          const futureDateObj = new Date(futureDate);
          const futureDayOfWeek = getDayOfWeek(futureDateObj);
          if (nurse.weekOffDay === futureDayOfWeek) {
            hasWeekOffInNext2Days = true;
            break;
          }
        }

        if (hasWeekOffInNext2Days) continue; // 주휴일 충돌 방지

        const last = lastShift[nurse.id];
        // N은 휴일 후, E, N 다음 가능
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
          nightBlockStatus[nurse.id] = 1; // 나이트 1일차 시작
        }
      }
    }

    // 4. 이브닝 근무 배정 (3명) - 최후 배정 (조건이 가장 유연하므로 마지막)
    let eveningCount = 0;
    for (const nurse of getAvailableNurses()) {
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
    // 주 후반(수~토)에는 주간 OFF가 0인 간호사에게 우선 OFF 배정
    const needsOff: Nurse[] = [];
    const others: Nurse[] = [];

    for (const nurse of nurses) {
      if (!assignedNurses.has(nurse.id)) {
        // 주간 OFF가 0인지 체크
        if (weeklyOffCount[nurse.id] === 0 && dayOfWeek >= 3) { // 수요일(3)부터
          needsOff.push(nurse);
        } else {
          others.push(nurse);
        }
      }
    }

    // 주간 OFF 필요한 사람 우선 OFF 배정
    for (const nurse of needsOff) {
      schedule.push({
        nurseId: nurse.id,
        date,
        shiftType: 'OFF',
        isFixed: false,
      });
      todayShift[nurse.id] = 'OFF';
      weeklyOffCount[nurse.id]++;
    }

    // 나머지도 OFF 배정
    for (const nurse of others) {
      schedule.push({
        nurseId: nurse.id,
        date,
        shiftType: 'OFF',
        isFixed: false,
      });
      todayShift[nurse.id] = 'OFF';
      weeklyOffCount[nurse.id]++;
    }

    // 6. 오늘 배정이 완료되면 lastShift, 연속 근무일, 나이트 블록 상태 업데이트
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

      // 나이트 블록 상태 업데이트
      if (shiftType !== 'N') {
        // 나이트가 아닌 근무나 휴일이면 나이트 블록 종료
        nightBlockStatus[nurseId] = 0;
      }
      // 나이트 3일차이면 다음 날 자동으로 0이 됨 (위에서 처리)
    }
  });

  return schedule;
}

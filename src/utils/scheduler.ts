import type { Nurse, ScheduleCell, ShiftType, DayOfWeek, PreviousScheduleInfo } from '../types';
import { DAILY_REQUIRED_STAFF, MAX_CONSECUTIVE_WORK_DAYS } from '../constants';
import { validateSchedule } from './validator';

/**
 * Date 객체의 getDay() 결과를 DayOfWeek 타입으로 변환
 * getDay(): 0(일) ~ 6(토)
 */
function getDayOfWeek(date: Date): DayOfWeek {
  const dayMap: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return dayMap[date.getDay()];
}

/**
 * 내부 스케줄 생성 함수 (그리디 알고리즘)
 * 백트래킹 래퍼에서 호출됨
 */
function generateSimpleScheduleInternal(
  nurses: Nurse[],
  startDate: string,
  endDate: string,
  randomize: boolean = false,
  fixedCells: ScheduleCell[] = [],
  previousScheduleInfo?: PreviousScheduleInfo,
  approvedAnnualLeaves?: Record<string, string[]>
): ScheduleCell[] {
  // 고정된 셀로 시작
  const schedule: ScheduleCell[] = [...fixedCells];

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

  // 각 간호사의 총 휴일 수 (OFF + WEEK_OFF + ANNUAL + MENSTRUAL) - 휴일 공평 분배용
  const totalOffDays: Record<string, number> = {};
  nurses.forEach((nurse) => {
    totalOffDays[nurse.id] = 0;
  });

  // 각 간호사의 나이트 블록 진행 상태 (0: 나이트 아님, 1: 1일차, 2: 2일차, 3: 3일차)
  const nightBlockStatus: Record<string, number> = {};
  nurses.forEach((nurse) => {
    nightBlockStatus[nurse.id] = 0;
  });

  // 각 간호사의 나이트 후 남은 휴식일 수 (0: 휴식 필요 없음, 1: 1일 남음, 2: 2일 남음)
  const nightRestDaysRemaining: Record<string, number> = {};
  nurses.forEach((nurse) => {
    nightRestDaysRemaining[nurse.id] = 0;
  });

  // 각 간호사의 월별 생휴 사용 횟수 (달력 월 기준: '2024-11' → 11월에 1회)
  const menstrualByMonth: Record<string, Record<string, number>> = {};
  nurses.forEach((nurse) => {
    menstrualByMonth[nurse.id] = {};
  });

  // 🔴 중요: 고정 셀에서 생휴를 먼저 카운트 (같은 달에 2회 배정 방지)
  fixedCells.forEach((cell) => {
    if (cell.shiftType === 'MENSTRUAL') {
      const yearMonth = cell.date.substring(0, 7); // '2025-11-16' → '2025-11'
      if (!menstrualByMonth[cell.nurseId][yearMonth]) {
        menstrualByMonth[cell.nurseId][yearMonth] = 0;
      }
      menstrualByMonth[cell.nurseId][yearMonth]++;
    }
  });

  // 🔴 중요: 승인된 연차가 실제로는 생휴일 수 있으므로 체크 (없음, ANNUAL만 승인됨)
  // 승인된 연차는 ANNUAL 타입이므로 생휴 카운트 불필요

  // 이전 4일 스케줄 정보를 사용하여 초기 상태 설정
  if (previousScheduleInfo) {
    const restTypes: ShiftType[] = ['OFF', 'WEEK_OFF', 'ANNUAL', 'MENSTRUAL'];

    for (const nurse of nurses) {
      const nursePrevSchedule = previousScheduleInfo.schedules[nurse.id] || [];

      // 날짜순 정렬 (오래된 것부터: -4, -3, -2, -1)
      const sortedSchedule = [...nursePrevSchedule].sort((a, b) => a.date.localeCompare(b.date));

      if (sortedSchedule.length > 0) {
        // 1. lastShift: 가장 최근 날짜 (-1일)의 shift type
        lastShift[nurse.id] = sortedSchedule[sortedSchedule.length - 1].shiftType;

        // 2. consecutiveWorkDays: 역순으로 순회하면서 연속 근무일 계산
        let consecutiveDays = 0;
        for (let i = sortedSchedule.length - 1; i >= 0; i--) {
          const shiftType = sortedSchedule[i].shiftType;
          if (restTypes.includes(shiftType)) {
            break; // 휴일 만나면 중단
          }
          consecutiveDays++;
        }
        consecutiveWorkDays[nurse.id] = consecutiveDays;

        // 3. nightBlockStatus: 역순으로 순회하면서 N의 연속 횟수 파악
        let nightDays = 0;
        for (let i = sortedSchedule.length - 1; i >= 0; i--) {
          const shiftType = sortedSchedule[i].shiftType;
          if (shiftType === 'N') {
            nightDays++;
          } else {
            break; // N이 아니면 중단
          }
        }
        // 나이트 블록이 계속 진행 중이면 상태 설정 (최대 3일)
        if (nightDays > 0) {
          nightBlockStatus[nurse.id] = Math.min(nightDays, 3);
        }

        // 4. nightRestDaysRemaining: 나이트 블록 종료 후 경과일 계산
        // 마지막 날부터 역순으로 순회하면서:
        // 1) 먼저 연속된 휴일 개수를 세기
        // 2) 그 이전에 N 블록이 있으면 nightRestDaysRemaining 설정
        if (nightBlockStatus[nurse.id] === 0) {
          // 나이트 블록이 진행 중이 아닐 때만 휴식일 계산
          let restDaysCount = 0;
          let foundNight = false;

          // 마지막 날부터 역순으로 확인
          for (let i = sortedSchedule.length - 1; i >= 0; i--) {
            const shiftType = sortedSchedule[i].shiftType;

            if (!foundNight && restTypes.includes(shiftType)) {
              // 아직 N을 찾지 못했고, 휴일이면 카운트
              restDaysCount++;
            } else if (!foundNight && shiftType === 'N') {
              // 휴일 이후 N 발견
              foundNight = true;
            } else if (foundNight && shiftType !== 'N') {
              // N 블록이 끝남
              break;
            }
          }

          // N 블록 직후 휴일이 2일 미만이면 nightRestDaysRemaining 설정
          if (foundNight && restDaysCount > 0 && restDaysCount < 2) {
            nightRestDaysRemaining[nurse.id] = 2 - restDaysCount;
          }
        }
      }
    }
  }

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

    // 고정된 셀의 간호사 ID를 assignedNurses에 추가
    schedule
      .filter((cell) => cell.date === date && cell.isFixed)
      .forEach((cell) => {
        assignedNurses.add(cell.nurseId);
        todayShift[cell.nurseId] = cell.shiftType;
      });

    // 0. 주휴일 배정 (최우선)
    const todayDayOfWeek = getDayOfWeek(new Date(date));
    for (const nurse of nurses) {
      // 이미 고정 셀이 있으면 스킵 (중복 배정 방지)
      if (nurse.weekOffDay === todayDayOfWeek && !assignedNurses.has(nurse.id)) {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'WEEK_OFF',
          isFixed: true, // 주휴일은 고정
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = 'WEEK_OFF';
        totalOffDays[nurse.id]++; // 휴일 카운트 증가
      }
    }

    // 0-1. 연차 배정 (승인된 연차만 고정)
    // approvedAnnualLeaves가 제공되면 승인된 연차만 배정
    // 제공되지 않으면 모든 연차를 배정 (이전 동작 유지)
    for (const nurse of nurses) {
      if (assignedNurses.has(nurse.id)) continue; // 이미 배정됨

      // 승인된 연차 목록 확인
      const approvedDates = approvedAnnualLeaves
        ? (approvedAnnualLeaves[nurse.id] || [])
        : (nurse.annualLeaveDates || []);

      if (approvedDates.includes(date)) {
        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType: 'ANNUAL',
          isFixed: true, // 연차는 고정
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = 'ANNUAL';
        totalOffDays[nurse.id]++; // 휴일 카운트 증가
      }
    }

    // 0-2. 강제 OFF 배정 (제약 조건 만족을 위해 근무 배정 전에 처리)
    // 주간 OFF 정확히 1개 규칙: 주휴OFF 1개 + 일반 OFF 1개 = 총 2개 휴일
    // 조건: 1) 5일 연속 근무 완료, 2) 나이트 후 휴식 필요 (최우선), 3) 토요일에 주간 OFF 0일
    // 조건 4) 나이트 후 휴식 2일 필요 + 내일이 주휴일 → 오늘 OFF 배정 (현직 간호사 조언)
    // 단, 나이트 진행 중이면 강제 OFF 제외 (나이트 블록 유지)
    const isSaturday = dayOfWeek === 6; // 토요일 체크
    for (const nurse of nurses) {
      if (assignedNurses.has(nurse.id)) continue; // 이미 배정됨
      if (nightBlockStatus[nurse.id] !== 0) continue; // 나이트 진행 중이면 강제 OFF 제외

      // 나이트 후 휴식은 최우선 (주간 OFF 개수 무시)
      const needsNightRest = nightRestDaysRemaining[nurse.id] > 0;

      // 추가: 나이트 종료 직후(휴식 2일 필요) + 내일이 주휴일 → 오늘 OFF 강제 배정
      // 예: N→N→OFF→주휴OFF 패턴 자동 생성
      let needsOffBeforeWeekOff = false;
      if (nightRestDaysRemaining[nurse.id] === 2 && dateIndex < dates.length - 1) {
        const tomorrowDate = new Date(dates[dateIndex + 1]);
        const tomorrowDayOfWeek = getDayOfWeek(tomorrowDate);
        if (nurse.weekOffDay === tomorrowDayOfWeek) {
          needsOffBeforeWeekOff = true; // 내일이 주휴일이면 오늘 OFF 강제 배정
        }
      }

      // 주간 OFF가 이미 1개 이상이면 추가 OFF 배정 안 함 (단, 나이트 후 휴식은 예외)
      const hasWeeklyOff = weeklyOffCount[nurse.id] >= 1;

      let needsForceOff = false;
      if (needsNightRest || needsOffBeforeWeekOff) {
        // 나이트 후 휴식은 주간 OFF 개수 무시하고 강제 배정
        needsForceOff = true;
      } else if (!hasWeeklyOff) {
        // 주간 OFF가 없을 때만 다른 조건 체크
        needsForceOff =
          consecutiveWorkDays[nurse.id] >= MAX_CONSECUTIVE_WORK_DAYS || // 5일 연속 근무 완료
          (isSaturday && weeklyOffCount[nurse.id] === 0); // 토요일에 주간 OFF 0일 (주간 OFF 규칙 강제)
      }

      if (needsForceOff) {
        // 주간 OFF 개수에 따라 휴일 타입 결정
        let shiftType: ShiftType;
        if (weeklyOffCount[nurse.id] === 0) {
          // 주간 OFF 0개 → OFF 배정
          shiftType = 'OFF';
          weeklyOffCount[nurse.id]++;
        } else {
          // 주간 OFF 1개 이상 → 생휴 또는 연차 배정
          const yearMonth = date.substring(0, 7);
          // 🔴 중요: schedule에서 직접 카운트 (menstrualByMonth 변수 대신)
          let menstrualCount = schedule.filter(
            s => s.nurseId === nurse.id &&
                 s.shiftType === 'MENSTRUAL' &&
                 s.date.substring(0, 7) === yearMonth
          ).length;

          // 🔴 중요: 이전 5일 근무에서도 생휴 카운트 (달력 월 기준)
          if (previousScheduleInfo) {
            const previousCells = previousScheduleInfo.schedules[nurse.id] || [];
            menstrualCount += previousCells.filter(
              s => s.shiftType === 'MENSTRUAL' &&
                   s.date.substring(0, 7) === yearMonth
            ).length;
          }

          if (menstrualCount === 0) {
            shiftType = 'MENSTRUAL';
          } else {
            shiftType = 'ANNUAL';
          }
        }

        schedule.push({
          nurseId: nurse.id,
          date,
          shiftType,
          isFixed: false,
        });
        assignedNurses.add(nurse.id);
        todayShift[nurse.id] = shiftType;
        totalOffDays[nurse.id]++; // 휴일 카운트 증가
      }
    }

    // 1. 나이트 근무 배정 (2명) - 최우선 배정 (현직 간호사 조언 반영)
    // 나이트를 먼저 배정하면 주휴일을 자연스럽게 휴식 2일에 활용 가능
    // 예: N→N→주휴OFF→OFF, N→N→N→OFF→주휴
    // 고정된 셀에서 이미 N이 몇 명 할당되었는지 카운트
    let nightCount = Object.values(todayShift).filter(shift => shift === 'N').length;

    // 1-1. 이미 나이트 중인 간호사 우선 처리 (연속성 유지)
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
        // 나이트 2일차 -> 마지막 2일 이내이거나 N이 부족하면 무조건 3일차, 아니면 70% 확률로 3일차
        // 마지막 2일 이내: 나이트 종료 후 2일 휴식을 확보할 수 없으므로 3일차로 계속 (다음 4주로 연결)
        const isLastTwoDays = dateIndex >= dates.length - 2;
        const needMoreNight = nightCount < DAILY_REQUIRED_STAFF.N;
        const continueToDay3 = isLastTwoDays || needMoreNight || (randomize ? Math.random() < 0.7 : true);
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
          nightBlockStatus[nurse.id] = 0; // 나이트 종료 (배정 업데이트에서 nightRestDaysRemaining 설정)
        }
      }
      // status === 3이면 반드시 종료 (배정 업데이트에서 nightRestDaysRemaining 설정)
    }

    // 1-2. 부족한 만큼 새로운 나이트 시작 (1일차)
    // 단, 최소 2일이 남아있어야 나이트 시작 가능
    // 예외 1: 스케줄 초반(처음 2일)은 이전 스케줄과 연결될 수 있으므로 제한 없음
    // 예외 2: 마지막 날에 N이 부족하면 1일 나이트도 허용 (긴급 조치)
    const daysRemaining = dates.length - dateIndex;
    const isLastDay = dateIndex === dates.length - 1;
    const isStartPeriod = dateIndex < 2; // 처음 2일은 이전 스케줄과 연결 가능
    const canStartNewNight = daysRemaining >= 2 || isStartPeriod || (isLastDay && nightCount < DAILY_REQUIRED_STAFF.N);

    if (canStartNewNight) {
      for (const nurse of getAvailableNurses()) {
        if (nightCount >= DAILY_REQUIRED_STAFF.N) break;
        if (assignedNurses.has(nurse.id)) continue;
        if (nightBlockStatus[nurse.id] !== 0) continue; // 이미 나이트 중이면 스킵

        // N은 필수 인원이므로 토요일 체크 제외 (필수 인원 충족 우선)
        // N은 필수 인원이므로 연속 근무일만 체크
        if (consecutiveWorkDays[nurse.id] >= MAX_CONSECUTIVE_WORK_DAYS) {
          continue;
        }

        // 나이트 시작 전 연속 근무일 체크: 최대 2일 이하만 나이트 시작 가능
        // (나이트 최대 3일 + 연속 근무일 2일 = 총 5일로 제한 준수)
        if (consecutiveWorkDays[nurse.id] > 2) continue;

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

    // 2. 데이 근무 배정 (3명)
    // 고정된 셀에서 이미 D가 몇 명 할당되었는지 카운트
    let dayCount = Object.values(todayShift).filter(shift => shift === 'D').length;
    for (const nurse of getAvailableNurses()) {
      if (dayCount >= DAILY_REQUIRED_STAFF.D) break;
      if (assignedNurses.has(nurse.id)) continue;

      // D는 필수 인원이므로 연속 근무일만 체크
      if (consecutiveWorkDays[nurse.id] >= MAX_CONSECUTIVE_WORK_DAYS) {
        continue;
      }

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

    // 3. 중간 근무 배정 (1명) - D 직후 배정 (선택지가 많을 때 할당하여 성공률 극대화)
    // M은 "D 다음 또는 M 다음"에만 가능하므로, D 직후에 배정하면 최적
    // 고정된 셀에서 이미 M이 몇 명 할당되었는지 카운트
    let middleCount = Object.values(todayShift).filter(shift => shift === 'M').length;
    for (const nurse of getAvailableNurses()) {
      if (middleCount >= DAILY_REQUIRED_STAFF.M) break;
      if (assignedNurses.has(nurse.id)) continue;

      // M은 연속 근무일만 체크
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

    // 4. 이브닝 근무 배정 (3명) - 최후 배정 (조건이 가장 유연하므로 마지막)
    // 고정된 셀에서 이미 E가 몇 명 할당되었는지 카운트
    let eveningCount = Object.values(todayShift).filter(shift => shift === 'E').length;
    for (const nurse of getAvailableNurses()) {
      if (eveningCount >= DAILY_REQUIRED_STAFF.E) break;
      if (assignedNurses.has(nurse.id)) continue;

      // E는 필수 인원이므로 연속 근무일만 체크
      if (consecutiveWorkDays[nurse.id] >= MAX_CONSECUTIVE_WORK_DAYS) {
        continue;
      }

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
    // 주간 OFF가 0인 간호사에게 우선 OFF 배정 (항상 적용)
    // 추가: 휴일 공평 분배를 위해 totalOffDays 적은 사람 우선
    const needsOff: Nurse[] = [];
    const others: Nurse[] = [];

    for (const nurse of nurses) {
      if (!assignedNurses.has(nurse.id)) {
        // 주간 OFF가 0인지 체크
        if (weeklyOffCount[nurse.id] === 0) {
          needsOff.push(nurse);
        } else {
          others.push(nurse);
        }
      }
    }

    // 휴일 공평 분배: others 그룹만 totalOffDays 기준으로 정렬
    // needsOff 그룹은 주간 OFF 규칙 준수를 위해 정렬하지 않음 (우선순위 최고)
    others.sort((a, b) => totalOffDays[a.id] - totalOffDays[b.id]);

    // 주간 OFF 필요한 사람 우선 OFF 배정 (weeklyOffCount === 0)
    for (const nurse of needsOff) {
      schedule.push({
        nurseId: nurse.id,
        date,
        shiftType: 'OFF',
        isFixed: false,
      });
      todayShift[nurse.id] = 'OFF';
      weeklyOffCount[nurse.id]++;
      totalOffDays[nurse.id]++; // 휴일 카운트 증가
    }

    // 나머지 간호사는 생휴 또는 연차 배정 (weeklyOffCount >= 1)
    // 주휴1일+OFF1일을 이미 받았으므로, 추가 휴일은 생휴 → 연차 순서로 처리
    for (const nurse of others) {
      const yearMonth = date.substring(0, 7); // '2024-11-16' → '2024-11'
      // 🔴 중요: schedule에서 직접 카운트 (menstrualByMonth 변수 대신)
      let menstrualCount = schedule.filter(
        s => s.nurseId === nurse.id &&
             s.shiftType === 'MENSTRUAL' &&
             s.date.substring(0, 7) === yearMonth
      ).length;

      // 🔴 중요: 이전 5일 근무에서도 생휴 카운트 (달력 월 기준)
      if (previousScheduleInfo) {
        const previousCells = previousScheduleInfo.schedules[nurse.id] || [];
        menstrualCount += previousCells.filter(
          s => s.shiftType === 'MENSTRUAL' &&
               s.date.substring(0, 7) === yearMonth
        ).length;
      }

      let shiftType: ShiftType;
      if (menstrualCount === 0) {
        // 이번 달 생휴 미사용 → 생휴 배정
        shiftType = 'MENSTRUAL';
      } else {
        // 이번 달 생휴 이미 사용 → 연차 배정
        shiftType = 'ANNUAL';
      }

      schedule.push({
        nurseId: nurse.id,
        date,
        shiftType,
        isFixed: false, // 🔴 수정: 동적 배정 휴가는 재생성 시 새로 계산되어야 함
      });
      todayShift[nurse.id] = shiftType;
      totalOffDays[nurse.id]++; // 휴일 카운트 증가
      // weeklyOffCount는 증가하지 않음 (MENSTRUAL, ANNUAL은 OFF가 아님)
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
        // 나이트 2일차 또는 3일차 종료 시 2일 휴식 필요
        if (nightBlockStatus[nurseId] === 2 || nightBlockStatus[nurseId] === 3) {
          nightRestDaysRemaining[nurseId] = 2;
        }
        nightBlockStatus[nurseId] = 0;
      }
      // 나이트 3일차이면 다음 날 자동으로 0이 됨 (위에서 처리)

      // 나이트 후 휴식일 카운트 감소
      if (restTypes.includes(shiftType) && nightRestDaysRemaining[nurseId] > 0) {
        nightRestDaysRemaining[nurseId]--;
      }
    }
  });

  return schedule;
}

/**
 * 이전 5일 스케줄 자동 생성
 * 메인 스케줄의 시작일 기준으로 이전 5일 (startDate - 5일 ~ startDate - 1일)을 생성합니다.
 * 모든 제약조건을 만족하도록 생성됩니다.
 *
 * @param nurses - 간호사 목록
 * @param mainStartDate - 메인 스케줄의 시작일 (YYYY-MM-DD)
 * @param randomize - true일 경우 매번 다른 스케줄 생성 (UI용), false일 경우 동일한 결과 (테스트용)
 * @returns 이전 5일 스케줄 셀 배열
 */
export function generatePreviousSchedule(
  nurses: Nurse[],
  mainStartDate: string,
  randomize: boolean = false
): ScheduleCell[] {
  if (nurses.length === 0) {
    return [];
  }

  // 메인 스케줄 시작일에서 5일 전 계산
  const mainStart = new Date(mainStartDate);
  const previousStart = new Date(mainStart);
  previousStart.setDate(mainStart.getDate() - 5);

  // 메인 스케줄 시작일에서 1일 전 계산
  const previousEnd = new Date(mainStart);
  previousEnd.setDate(mainStart.getDate() - 1);

  const previousStartStr = previousStart.toISOString().split('T')[0];
  const previousEndStr = previousEnd.toISOString().split('T')[0];

  // 이전 스케줄 정보 없이 5일 생성 (previousScheduleInfo = undefined)
  // 고정 셀도 없음 (fixedCells = [])
  // 연차도 없음 (approvedAnnualLeaves = {})
  return generateSimpleSchedule(
    nurses,
    previousStartStr,
    previousEndStr,
    randomize,
    [], // 고정 셀 없음
    undefined, // 이전 스케줄 정보 없음
    {} // 연차 없음 (이전 5일에는 연차 배정 안 함)
  );
}

/**
 * 백트래킹을 활용한 스케줄 생성 (공개 API)
 * 모든 하드 제약 조건을 만족할 때까지 여러 번 시도
 *
 * @param randomize - true일 경우 매번 다른 스케줄 생성 (UI용), false일 경우 동일한 결과 (테스트용, 기본값)
 * @param fixedCells - 고정된 셀 목록 (재생성 시 유지됨)
 * @param previousScheduleInfo - 이전 4일 스케줄 정보 (제약 조건 검증에 사용)
 * @param approvedAnnualLeaves - 승인된 연차 목록 (nurseId -> 날짜 배열), undefined이면 모든 연차 포함
 * @param maxAttempts - 최대 시도 횟수 (기본값: 150, OFF ≤ 2 제약으로 난이도 증가)
 */
export function generateSimpleSchedule(
  nurses: Nurse[],
  startDate: string,
  endDate: string,
  randomize: boolean = false,
  fixedCells: ScheduleCell[] = [],
  previousScheduleInfo?: PreviousScheduleInfo,
  approvedAnnualLeaves?: Record<string, string[]>,
  maxAttempts: number = 200 // 백트래킹 횟수를 200회로 증가하여 성공률 향상
): ScheduleCell[] {
  // 백트래킹: 하드 제약 조건을 모두 만족할 때까지 여러 번 시도
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 각 시도마다 랜덤 정렬 사용 (다른 배정 순서 시도)
    const useRandomize = randomize || attempt > 1; // 첫 시도는 원래 randomize 값, 그 이후는 강제 randomize

    const schedule = generateSimpleScheduleInternal(
      nurses,
      startDate,
      endDate,
      useRandomize,
      fixedCells,
      previousScheduleInfo,
      approvedAnnualLeaves
    );

    // 하드 제약 조건 검증
    const { violations } = validateSchedule(schedule, nurses, previousScheduleInfo?.schedules ? Object.values(previousScheduleInfo.schedules).flat() : []);
    const hardViolations = violations.filter(v => v.type === 'HARD');

    // 하드 제약 위반이 없으면 성공
    if (hardViolations.length === 0) {
      if (attempt > 1) {
        console.log(`✅ 백트래킹 성공: ${attempt}번째 시도에서 모든 하드 제약 만족`);
      }
      return schedule;
    }

    // 마지막 시도에서 실패하면 경고 출력
    if (attempt === maxAttempts) {
      console.warn(`⚠️ 백트래킹 실패: ${maxAttempts}회 시도 후에도 하드 제약 ${hardViolations.length}개 위반`);
      hardViolations.forEach(v => {
        console.warn(`  - ${v.message}`);
      });
    }
  }

  // 최대 시도 횟수를 초과하면 마지막 시도 결과 반환 (하드 제약 위반 가능)
  return generateSimpleScheduleInternal(
    nurses,
    startDate,
    endDate,
    true, // 강제 randomize
    fixedCells,
    previousScheduleInfo,
    approvedAnnualLeaves
  );
}

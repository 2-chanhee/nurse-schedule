import { useState, useMemo } from 'react';
import type { Nurse, ScheduleCell, ShiftType } from '../types';
import { SHIFT_TYPE_LABELS, SHIFT_TYPE_SHORT_LABELS, DAY_OF_WEEK_LABELS } from '../types';
import { SHIFT_COLORS, SHIFT_CYCLE } from '../constants';
import { validateSchedule } from '../utils/validator';
import { generateSimpleSchedule } from '../utils/scheduler';
import '../styles/ScheduleView.css';

interface ScheduleViewProps {
  nurses: Nurse[];
}

export default function ScheduleView({ nurses }: ScheduleViewProps) {
  // 날짜 범위 설정
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return nextMonth.toISOString().split('T')[0];
  });

  // 스케줄 데이터
  const [schedule, setSchedule] = useState<ScheduleCell[]>([]);

  // 날짜 배열 생성
  const dateList = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    return dates;
  }, [startDate, endDate]);

  // 검증 결과 계산
  const validationResult = useMemo(() => {
    return validateSchedule(schedule, nurses);
  }, [schedule, nurses]);

  // 특정 셀의 근무 타입 가져오기
  const getShiftType = (nurseId: string, date: string): ShiftType => {
    const cell = schedule.find(
      (s) => s.nurseId === nurseId && s.date === date
    );
    return cell?.shiftType || 'OFF';
  };

  // 셀 클릭 핸들러 (근무 타입 순환)
  const handleCellClick = (nurseId: string, date: string) => {
    const existingCell = schedule.find(
      (s) => s.nurseId === nurseId && s.date === date
    );

    // 고정된 셀은 변경 불가
    if (existingCell?.isFixed) {
      return;
    }

    const currentType = getShiftType(nurseId, date);
    const currentIndex = SHIFT_CYCLE.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % SHIFT_CYCLE.length;
    const nextType = SHIFT_CYCLE[nextIndex];

    if (existingCell) {
      setSchedule(
        schedule.map((s) =>
          s.nurseId === nurseId && s.date === date
            ? { ...s, shiftType: nextType }
            : s
        )
      );
    } else {
      setSchedule([
        ...schedule,
        { nurseId, date, shiftType: nextType, isFixed: false },
      ]);
    }
  };

  // 날짜별 각 근무 타입 카운트
  const getDailyCount = (date: string, shiftType: ShiftType): number => {
    return schedule.filter(
      (s) => s.date === date && s.shiftType === shiftType
    ).length;
  };

  // 간호사별 각 근무 타입 카운트
  const getNurseShiftCount = (nurseId: string, shiftType: ShiftType): number => {
    return schedule.filter(
      (s) => s.nurseId === nurseId && s.shiftType === shiftType
    ).length;
  };

  // 자동 생성 핸들러
  const handleAutoGenerate = () => {
    if (nurses.length === 0) {
      alert('먼저 간호사를 등록해주세요.');
      return;
    }

    if (!startDate || !endDate) {
      alert('시작일과 종료일을 설정해주세요.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('시작일이 종료일보다 늦습니다.');
      return;
    }

    const generatedSchedule = generateSimpleSchedule(nurses, startDate, endDate);
    setSchedule(generatedSchedule);
  };

  // 요일 가져오기
  const getDayOfWeek = (date: Date): string => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[date.getDay()];
  };

  // 주말 여부
  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  if (nurses.length === 0) {
    return (
      <div className="schedule-view">
        <div className="empty-message">
          먼저 간호사를 등록해주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <h2>스케줄 관리</h2>
        <div className="date-range">
          <div className="date-input-group">
            <label>시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="date-input-group">
            <label>종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="date-info">
            총 {dateList.length}일
          </div>
          <button onClick={handleAutoGenerate} className="btn-auto-generate">
            {schedule.length > 0 ? '재생성' : '자동 생성'}
          </button>
        </div>
      </div>

      <div className="schedule-table-container">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="nurse-name-header">이름</th>
              {dateList.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayOfWeek = getDayOfWeek(date);
                const isWE = isWeekend(date);
                const isWeekStart = date.getDay() === 0; // 일요일

                return (
                  <th key={dateStr} className={`${isWE ? 'weekend' : ''} ${isWeekStart ? 'week-start' : ''}`}>
                    <div className="date-cell">
                      <div className="date-number">{date.getDate()}</div>
                      <div className="date-day">{DAY_OF_WEEK_LABELS[dayOfWeek as keyof typeof DAY_OF_WEEK_LABELS]}</div>
                    </div>
                  </th>
                );
              })}
              <th className="stats-header" colSpan={6}>통계</th>
            </tr>
            <tr>
              <th></th>
              {dateList.map((date) => {
                const isWeekStart = date.getDay() === 0; // 일요일
                return (
                  <th key={date.toISOString().split('T')[0]} className={isWeekStart ? 'week-start' : ''}></th>
                );
              })}
              <th className="stat-label">D</th>
              <th className="stat-label">E</th>
              <th className="stat-label">N</th>
              <th className="stat-label">O</th>
              <th className="stat-label">A</th>
              <th className="stat-label">WO</th>
            </tr>
          </thead>
          <tbody>
            {nurses.map((nurse) => {
              // 해당 간호사의 근무 순서 위반 목록
              const nurseViolations = validationResult.violations.filter(
                (v) => v.nurseId === nurse.id
              );

              return (
                <tr key={nurse.id}>
                  <td className="nurse-name">{nurse.name}</td>
                  {dateList.map((date) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const shiftType = getShiftType(nurse.id, dateStr);

                    // 이 셀에 위반이 있는지 확인
                    const hasViolation = nurseViolations.some((v) => v.date === dateStr);

                    // 고정된 셀인지 확인
                    const cell = schedule.find(
                      (s) => s.nurseId === nurse.id && s.date === dateStr
                    );
                    const isFixed = cell?.isFixed || false;

                    // 주 구분선 (일요일이면 왼쪽에 굵은 선)
                    const isWeekStart = date.getDay() === 0; // 0 = 일요일

                    return (
                      <td
                        key={dateStr}
                        className={`shift-cell ${hasViolation ? 'violation' : ''} ${isFixed ? 'fixed' : ''} ${isWeekStart ? 'week-start' : ''}`}
                        style={{ backgroundColor: SHIFT_COLORS[shiftType] }}
                        onClick={() => handleCellClick(nurse.id, dateStr)}
                        title={
                          hasViolation
                            ? nurseViolations.find((v) => v.date === dateStr)?.message
                            : isFixed
                            ? `${SHIFT_TYPE_LABELS[shiftType]} (고정)`
                            : SHIFT_TYPE_LABELS[shiftType]
                        }
                      >
                        {SHIFT_TYPE_SHORT_LABELS[shiftType]}
                      </td>
                    );
                  })}
                  <td className="stat-cell">{getNurseShiftCount(nurse.id, 'D')}</td>
                  <td className="stat-cell">{getNurseShiftCount(nurse.id, 'E')}</td>
                  <td className="stat-cell">{getNurseShiftCount(nurse.id, 'N')}</td>
                  <td className="stat-cell">{getNurseShiftCount(nurse.id, 'OFF')}</td>
                  <td className="stat-cell">{getNurseShiftCount(nurse.id, 'ANNUAL')}</td>
                  <td className="stat-cell">{getNurseShiftCount(nurse.id, 'WEEK_OFF')}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="footer-label">D</td>
              {dateList.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const count = getDailyCount(dateStr, 'D');
                const status = validationResult.dailyStaffStatus[dateStr]?.['D'] || 'ok';
                const isWeekStart = date.getDay() === 0; // 일요일
                return (
                  <td key={dateStr} className={`daily-count status-${status} ${isWeekStart ? 'week-start' : ''}`}>
                    {count}
                  </td>
                );
              })}
              <td colSpan={6}></td>
            </tr>
            <tr>
              <td className="footer-label">M</td>
              {dateList.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const count = getDailyCount(dateStr, 'M');
                const status = validationResult.dailyStaffStatus[dateStr]?.['M'] || 'ok';
                const isWeekStart = date.getDay() === 0; // 일요일
                return (
                  <td key={dateStr} className={`daily-count status-${status} ${isWeekStart ? 'week-start' : ''}`}>
                    {count}
                  </td>
                );
              })}
              <td colSpan={6}></td>
            </tr>
            <tr>
              <td className="footer-label">E</td>
              {dateList.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const count = getDailyCount(dateStr, 'E');
                const status = validationResult.dailyStaffStatus[dateStr]?.['E'] || 'ok';
                const isWeekStart = date.getDay() === 0; // 일요일
                return (
                  <td key={dateStr} className={`daily-count status-${status} ${isWeekStart ? 'week-start' : ''}`}>
                    {count}
                  </td>
                );
              })}
              <td colSpan={6}></td>
            </tr>
            <tr>
              <td className="footer-label">N</td>
              {dateList.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const count = getDailyCount(dateStr, 'N');
                const status = validationResult.dailyStaffStatus[dateStr]?.['N'] || 'ok';
                const isWeekStart = date.getDay() === 0; // 일요일
                return (
                  <td key={dateStr} className={`daily-count status-${status} ${isWeekStart ? 'week-start' : ''}`}>
                    {count}
                  </td>
                );
              })}
              <td colSpan={6}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import type { Nurse, ScheduleCell, ShiftType } from '../types';
import { SHIFT_TYPE_LABELS, SHIFT_TYPE_SHORT_LABELS, DAY_OF_WEEK_LABELS } from '../types';
import { SHIFT_COLORS, SHIFT_CYCLE } from '../constants';
import { validateSchedule } from '../utils/validator';
import { generateSimpleSchedule, generatePreviousSchedule } from '../utils/scheduler';
import '../styles/ScheduleView.css';

interface ScheduleViewProps {
  nurses: Nurse[];
}

export default function ScheduleView({ nurses }: ScheduleViewProps) {
  // 날짜 범위 설정: 현재 날 이후의 가장 빠른 일요일부터 4주(28일)
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = 일요일

    // 현재 날 이후의 가장 빠른 일요일 계산
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);

    // 로컬 날짜를 YYYY-MM-DD 형식으로 변환 (타임존 문제 방지)
    const year = nextSunday.getFullYear();
    const month = String(nextSunday.getMonth() + 1).padStart(2, '0');
    const day = String(nextSunday.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = 일요일

    // 현재 날 이후의 가장 빠른 일요일 계산
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);

    // 4주 후 토요일 (시작일 + 27일 = 28일)
    const endSaturday = new Date(nextSunday);
    endSaturday.setDate(nextSunday.getDate() + 27);

    // 로컬 날짜를 YYYY-MM-DD 형식으로 변환 (타임존 문제 방지)
    const year = endSaturday.getFullYear();
    const month = String(endSaturday.getMonth() + 1).padStart(2, '0');
    const day = String(endSaturday.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  });

  // 스케줄 데이터
  const [schedule, setSchedule] = useState<ScheduleCell[]>([]);

  // 이전 5일 스케줄 (간호사별)
  const [previousSchedule, setPreviousSchedule] = useState<Record<string, ScheduleCell[]>>(() => {
    // 초기값: 각 간호사별로 빈 5일 생성
    const initial: Record<string, ScheduleCell[]> = {};
    nurses.forEach(nurse => {
      initial[nurse.id] = [];
    });
    return initial;
  });

  // 반려된 연차 목록
  interface RejectedAnnualLeave {
    nurseId: string;
    nurseName: string;
    date: string;
    reason: string;
  }
  const [rejectedAnnualLeaves, setRejectedAnnualLeaves] = useState<RejectedAnnualLeave[]>([]);

  // 로딩 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    current: 0,
    total: 0,
    bestApproved: 0,
    totalAnnual: 0,
  });

  // 이전 5일 날짜 배열 생성 (스케줄 시작일 기준 -5, -4, -3, -2, -1)
  const previousDateList = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(startDate);

    for (let i = 5; i >= 1; i--) {
      const prevDate = new Date(start);
      prevDate.setDate(start.getDate() - i);
      const year = prevDate.getFullYear();
      const month = String(prevDate.getMonth() + 1).padStart(2, '0');
      const day = String(prevDate.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    return dates;
  }, [startDate]);

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

  // 검증 결과 계산 (이전 스케줄 포함)
  const validationResult = useMemo(() => {
    // previousSchedule을 1차원 배열로 변환
    const previousCells: ScheduleCell[] = Object.values(previousSchedule).flatMap(cells => cells);
    return validateSchedule(schedule, nurses, previousCells);
  }, [schedule, nurses, previousSchedule]);

  // 특정 셀의 근무 타입 가져오기
  const getShiftType = (nurseId: string, date: string): ShiftType => {
    const cell = schedule.find(
      (s) => s.nurseId === nurseId && s.date === date
    );
    return cell?.shiftType || 'OFF';
  };

  // 이전 스케줄의 특정 셀 근무 타입 가져오기
  const getPreviousShiftType = (nurseId: string, date: string): ShiftType => {
    const nursePrevSchedule = previousSchedule[nurseId] || [];
    const cell = nursePrevSchedule.find((s) => s.date === date);
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

  // 우클릭 핸들러 (고정/해제 토글)
  const handleRightClick = (e: React.MouseEvent, nurseId: string, date: string) => {
    e.preventDefault(); // 브라우저 기본 컨텍스트 메뉴 방지

    const existingCell = schedule.find(
      (s) => s.nurseId === nurseId && s.date === date
    );

    if (existingCell) {
      // 셀이 있으면 고정 토글
      setSchedule(
        schedule.map((s) =>
          s.nurseId === nurseId && s.date === date
            ? { ...s, isFixed: !s.isFixed }
            : s
        )
      );
    } else {
      // 셀이 없으면 OFF로 생성하고 고정
      setSchedule([
        ...schedule,
        { nurseId, date, shiftType: 'OFF', isFixed: true },
      ]);
    }
  };

  // 이전 스케줄 셀 클릭 핸들러 (근무 타입 순환, 항상 고정)
  const handlePreviousCellClick = (nurseId: string, date: string) => {
    const nursePrevSchedule = previousSchedule[nurseId] || [];
    const existingCell = nursePrevSchedule.find((s) => s.date === date);

    const currentType = getPreviousShiftType(nurseId, date);
    const currentIndex = SHIFT_CYCLE.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % SHIFT_CYCLE.length;
    const nextType = SHIFT_CYCLE[nextIndex];

    if (existingCell) {
      // 기존 셀 업데이트
      setPreviousSchedule({
        ...previousSchedule,
        [nurseId]: nursePrevSchedule.map((s) =>
          s.date === date ? { ...s, shiftType: nextType } : s
        ),
      });
    } else {
      // 새 셀 추가 (항상 고정)
      setPreviousSchedule({
        ...previousSchedule,
        [nurseId]: [
          ...nursePrevSchedule,
          { nurseId, date, shiftType: nextType, isFixed: true },
        ],
      });
    }
  };

  // 날짜별 각 근무 타입 카운트
  const getDailyCount = (date: string, shiftType: ShiftType): number => {
    return schedule.filter(
      (s) => s.date === date && s.shiftType === shiftType
    ).length;
  };

  // 이전 스케줄의 날짜별 각 근무 타입 카운트
  const getPreviousDailyCount = (date: string, shiftType: ShiftType): number => {
    let count = 0;
    for (const nurseId in previousSchedule) {
      const nurseCells = previousSchedule[nurseId] || [];
      count += nurseCells.filter(cell => cell.date === date && cell.shiftType === shiftType).length;
    }
    return count;
  };

  // 간호사별 각 근무 타입 카운트
  const getNurseShiftCount = (nurseId: string, shiftType: ShiftType): number => {
    return schedule.filter(
      (s) => s.nurseId === nurseId && s.shiftType === shiftType
    ).length;
  };

  // 자동 생성 핸들러
  const handleAutoGenerate = async () => {
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

    // 로딩 시작
    setIsGenerating(true);

    // 하드 제약 위반 없으면서 연차 승인을 최대화하는 스케줄 생성 (최대 1000회 시도)
    const MAX_ATTEMPTS = 1000;
    let attempt = 0;
    let bestSchedule: ScheduleCell[] = [];
    let bestPreviousSchedule: Record<string, ScheduleCell[]> = {};
    let bestRejectedList: RejectedAnnualLeave[] = [];
    let bestApprovedCount = -1; // 최고 승인 연차 개수
    let totalAnnualLeaves = 0; // 전체 연차 개수

    // 진행 상황 초기화
    setGenerationProgress({
      current: 0,
      total: MAX_ATTEMPTS,
      bestApproved: 0,
      totalAnnual: 0,
    });

    console.log('🔄 하드 제약 만족하면서 연차 승인을 최대화하는 스케줄 생성 시작...');

    // UI 업데이트를 위해 약간의 지연 추가
    await new Promise(resolve => setTimeout(resolve, 100));

    while (attempt < MAX_ATTEMPTS) {
      attempt++;

      // 1. 이전 5일 스케줄 생성 (제약조건 만족)
      // randomize=true로 생성하여 매번 다른 이전 스케줄 생성 (테스트용)
      const generatedPreviousSchedule = generatePreviousSchedule(nurses, startDate, true);

      // 2. 간호사별로 정리
      const previousScheduleByNurse: Record<string, ScheduleCell[]> = {};
      nurses.forEach(nurse => {
        previousScheduleByNurse[nurse.id] = generatedPreviousSchedule.filter(cell => cell.nurseId === nurse.id);
      });

      // 3. 이전 5일 정보 (연차 검증과 최종 생성 모두 동일한 이전 스케줄 사용)
      const previousScheduleInfo = {
        schedules: previousScheduleByNurse,
      };

      // 4. 기존 스케줄에서 고정된 셀 추출 (주휴일 등)
      const fixedCells = schedule.filter(cell => cell.isFixed && cell.shiftType !== 'ANNUAL');

      // 5. 연차 승인/반려 로직
      const approvedAnnualLeaves: Record<string, string[]> = {};
      const currentRejectedList: RejectedAnnualLeave[] = [];

      // 모든 연차를 수집 (첫 시도에서만)
      interface AnnualLeaveRequest {
        nurseId: string;
        nurseName: string;
        date: string;
      }
      const allAnnualLeaves: AnnualLeaveRequest[] = [];
      nurses.forEach(nurse => {
        if (nurse.annualLeaveDates && nurse.annualLeaveDates.length > 0) {
          nurse.annualLeaveDates.forEach(date => {
            allAnnualLeaves.push({ nurseId: nurse.id, nurseName: nurse.name, date });
          });
        }
      });

      // 첫 시도에서 전체 연차 개수 저장
      if (attempt === 1) {
        totalAnnualLeaves = allAnnualLeaves.length;
        setGenerationProgress(prev => ({
          ...prev,
          totalAnnual: totalAnnualLeaves,
        }));
        console.log(`📋 총 연차 신청: ${totalAnnualLeaves}개`);
      }

      // 진행 상황 업데이트 (매 시도마다)
      if (attempt % 10 === 0) {
        setGenerationProgress(prev => ({
          ...prev,
          current: attempt,
        }));
        // UI 업데이트를 위해 약간의 지연
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // 각 연차를 하나씩 검증
      for (const annual of allAnnualLeaves) {
        // 임시로 이 연차를 승인 목록에 추가
        const tempApproved: Record<string, string[]> = {};
        for (const nurseId in approvedAnnualLeaves) {
          tempApproved[nurseId] = [...approvedAnnualLeaves[nurseId]];
        }
        if (!tempApproved[annual.nurseId]) {
          tempApproved[annual.nurseId] = [];
        }
        tempApproved[annual.nurseId].push(annual.date);

        // 임시 스케줄 생성 (검증용)
        const tempSchedule = generateSimpleSchedule(
          nurses,
          startDate,
          endDate,
          false, // 검증용이므로 randomize=false
          fixedCells,
          previousScheduleInfo,
          tempApproved
        );

        // 제약조건 검증 (하드 제약만 체크, 이전 스케줄 포함)
        const previousCellArrays: ScheduleCell[][] = Object.values(previousScheduleInfo.schedules);
        const previousCells: ScheduleCell[] = [];
        for (const cells of previousCellArrays) {
          previousCells.push(...cells);
        }
        const validation = validateSchedule(tempSchedule, nurses, previousCells);
        const hardViolations = validation.violations.filter(v => v.type === 'HARD');

        if (hardViolations.length === 0) {
          // 승인 (소프트 제약 위반은 허용)
          if (!approvedAnnualLeaves[annual.nurseId]) {
            approvedAnnualLeaves[annual.nurseId] = [];
          }
          approvedAnnualLeaves[annual.nurseId].push(annual.date);
        } else {
          // 반려 (하드 제약 위반 사유만 추출)
          const relatedViolations = hardViolations.filter(
            v => v.date === annual.date || v.nurseId === annual.nurseId
          );
          const reasons = relatedViolations.length > 0
            ? relatedViolations.map(v => v.message).join(', ')
            : '하드 제약조건 위반';

          currentRejectedList.push({
            nurseId: annual.nurseId,
            nurseName: annual.nurseName,
            date: annual.date,
            reason: reasons,
          });
        }
      }

      // 6. 최종 스케줄 생성 (승인된 연차만 포함)
      const generatedSchedule = generateSimpleSchedule(
        nurses,
        startDate,
        endDate,
        true, // UI용이므로 randomize=true
        fixedCells,
        previousScheduleInfo,
        approvedAnnualLeaves
      );

      // 7. 최종 스케줄 검증 (이전 스케줄 포함)
      const previousCellArraysFinal: ScheduleCell[][] = Object.values(previousScheduleInfo.schedules);
      const previousCellsFinal: ScheduleCell[] = [];
      for (const cells of previousCellArraysFinal) {
        previousCellsFinal.push(...cells);
      }
      const finalValidation = validateSchedule(generatedSchedule, nurses, previousCellsFinal);
      const finalHardViolations = finalValidation.violations.filter(v => v.type === 'HARD');

      // 8. 하드 제약 위반 체크 및 최적 스케줄 추적
      if (finalHardViolations.length === 0) {
        // 하드 제약 만족! 연차 승인 개수 확인
        const approvedCount = Object.values(approvedAnnualLeaves).flat().length;

        // 최고 기록 갱신 시 업데이트
        if (approvedCount > bestApprovedCount) {
          bestApprovedCount = approvedCount;
          bestSchedule = generatedSchedule;
          bestPreviousSchedule = previousScheduleByNurse;
          bestRejectedList = currentRejectedList;

          // 진행 상황 업데이트
          setGenerationProgress(prev => ({
            ...prev,
            bestApproved: approvedCount,
          }));

          console.log(`✅ ${attempt}번째 시도: 연차 승인 ${approvedCount}/${totalAnnualLeaves}개 (최고 기록 갱신)`);
        }
      } else if (attempt % 100 === 0) {
        // 100번마다 진행상황 로그
        const currentBest = bestApprovedCount >= 0 ? `최고: ${bestApprovedCount}/${totalAnnualLeaves}개 연차 승인` : '아직 성공 없음';
        console.log(`⏳ ${attempt}번째 시도 중... (${currentBest})`);
      }
    }

    // 루프 종료 후 최적 스케줄 적용
    if (bestApprovedCount >= 0) {
      console.log(`🎉 ${MAX_ATTEMPTS}번 시도 완료! 최고 스케줄: ${bestApprovedCount}/${totalAnnualLeaves}개 연차 승인`);
      setPreviousSchedule(bestPreviousSchedule);
      setSchedule(bestSchedule);
      setRejectedAnnualLeaves(bestRejectedList);
    } else {
      console.log(`❌ ${MAX_ATTEMPTS}번 시도했지만 하드 제약 위반 없는 스케줄을 생성하지 못했습니다.`);
      alert(`${MAX_ATTEMPTS}번 시도했지만 모든 하드 제약을 만족하는 스케줄을 생성하지 못했습니다. 간호사 수나 제약 조건을 조정해주세요.`);
    }

    // 로딩 종료
    setIsGenerating(false);
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
      {/* 로딩 모달 */}
      {isGenerating && (
        <div className="loading-modal-overlay">
          <div className="loading-modal">
            <div className="loading-spinner"></div>
            <h3>⏳ 스케줄 생성 중...</h3>
            <div className="loading-progress">
              <div className="progress-text">
                {generationProgress.current} / {generationProgress.total} 시도 중...
              </div>
              {generationProgress.totalAnnual > 0 && (
                <div className="progress-detail">
                  최고: {generationProgress.bestApproved} / {generationProgress.totalAnnual}개 연차 승인
                </div>
              )}
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{
                    width: `${(generationProgress.current / generationProgress.total) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* 제약 위반 사항 표시 */}
      {schedule.length > 0 && (
        <div className="violations-container">
          <div className="violations-section hard-violations">
            <h3>🔴 하드 제약 위반</h3>
            {validationResult.violations.filter(v => v.type === 'HARD').length === 0 ? (
              <div className="no-violations">위반 사항 없음</div>
            ) : (
              <ul className="violations-list">
                {validationResult.violations
                  .filter(v => v.type === 'HARD')
                  .map((violation, index) => (
                    <li key={index} className="violation-item">
                      {violation.message}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="violations-section soft-violations">
            <h3>🟡 소프트 제약 위반</h3>
            {validationResult.violations.filter(v => v.type === 'SOFT').length === 0 ? (
              <div className="no-violations">위반 사항 없음</div>
            ) : (
              <ul className="violations-list">
                {validationResult.violations
                  .filter(v => v.type === 'SOFT')
                  .map((violation, index) => (
                    <li key={index} className="violation-item">
                      {violation.message}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 반려된 연차 목록 */}
      {rejectedAnnualLeaves.length > 0 && (
        <div className="rejected-annual-section">
          <h3>❌ 반려된 연차</h3>
          <p className="section-description">
            제약조건을 만족하지 못하여 반려된 연차 신청 목록입니다.
          </p>
          <ul className="rejected-annual-list">
            {rejectedAnnualLeaves.map((rejected, index) => (
              <li key={index} className="rejected-annual-item">
                <strong>{rejected.nurseName}</strong> - {rejected.date}: {rejected.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="schedule-table-container">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="nurse-name-header">이름</th>
              {/* 이전 4일 컬럼 */}
              {previousDateList.map((dateStr, index) => {
                const date = new Date(dateStr);
                const dayOfWeek = getDayOfWeek(date);
                const isWE = isWeekend(date);
                const isWeekStart = date.getDay() === 0;
                const isLastPreviousDay = index === previousDateList.length - 1;

                return (
                  <th key={`prev-${dateStr}`} className={`previous-header ${isWE ? 'weekend' : ''} ${isWeekStart ? 'week-start' : ''} ${isLastPreviousDay ? 'previous-divider' : ''}`}>
                    <div className="date-cell">
                      <div className="date-number">{date.getDate()}</div>
                      <div className="date-day">{DAY_OF_WEEK_LABELS[dayOfWeek as keyof typeof DAY_OF_WEEK_LABELS]}</div>
                    </div>
                  </th>
                );
              })}
              {/* 메인 스케줄 컬럼 */}
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
              {/* 이전 4일 라벨 */}
              <th colSpan={previousDateList.length} className="previous-label">
                이전 근무
              </th>
              {/* 메인 스케줄 빈 셀 */}
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
                  {/* 이전 4일 셀 */}
                  {previousDateList.map((dateStr, index) => {
                    const date = new Date(dateStr);
                    const shiftType = getPreviousShiftType(nurse.id, dateStr);
                    const isWeekStart = date.getDay() === 0;
                    const isLastPreviousDay = index === previousDateList.length - 1;

                    return (
                      <td
                        key={`prev-${dateStr}`}
                        className={`shift-cell previous-cell ${isWeekStart ? 'week-start' : ''} ${isLastPreviousDay ? 'previous-divider' : ''}`}
                        style={{ backgroundColor: SHIFT_COLORS[shiftType] }}
                        onClick={() => handlePreviousCellClick(nurse.id, dateStr)}
                        title={`이전 근무: ${SHIFT_TYPE_LABELS[shiftType]} (클릭하여 변경)`}
                      >
                        {SHIFT_TYPE_SHORT_LABELS[shiftType]}
                      </td>
                    );
                  })}
                  {/* 메인 스케줄 셀 */}
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
                        onContextMenu={(e) => handleRightClick(e, nurse.id, dateStr)}
                        title={
                          hasViolation
                            ? nurseViolations.find((v) => v.date === dateStr)?.message
                            : isFixed
                            ? `${SHIFT_TYPE_LABELS[shiftType]} (고정 - 우클릭으로 해제)`
                            : `${SHIFT_TYPE_LABELS[shiftType]} (우클릭으로 고정)`
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
              {/* 이전 5일 카운트 */}
              {previousDateList.map((dateStr, index) => {
                const count = getPreviousDailyCount(dateStr, 'D');
                const date = new Date(dateStr);
                const isWeekStart = date.getDay() === 0;
                const isLastPreviousDay = index === previousDateList.length - 1;
                return (
                  <td key={`prev-d-${dateStr}`} className={`previous-footer daily-count ${isWeekStart ? 'week-start' : ''} ${isLastPreviousDay ? 'previous-divider' : ''}`}>
                    {count}
                  </td>
                );
              })}
              {/* 메인 스케줄 카운트 */}
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
              {/* 이전 5일 카운트 */}
              {previousDateList.map((dateStr, index) => {
                const count = getPreviousDailyCount(dateStr, 'M');
                const date = new Date(dateStr);
                const isWeekStart = date.getDay() === 0;
                const isLastPreviousDay = index === previousDateList.length - 1;
                return (
                  <td key={`prev-m-${dateStr}`} className={`previous-footer daily-count ${isWeekStart ? 'week-start' : ''} ${isLastPreviousDay ? 'previous-divider' : ''}`}>
                    {count}
                  </td>
                );
              })}
              {/* 메인 스케줄 카운트 */}
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
              {/* 이전 5일 카운트 */}
              {previousDateList.map((dateStr, index) => {
                const count = getPreviousDailyCount(dateStr, 'E');
                const date = new Date(dateStr);
                const isWeekStart = date.getDay() === 0;
                const isLastPreviousDay = index === previousDateList.length - 1;
                return (
                  <td key={`prev-e-${dateStr}`} className={`previous-footer daily-count ${isWeekStart ? 'week-start' : ''} ${isLastPreviousDay ? 'previous-divider' : ''}`}>
                    {count}
                  </td>
                );
              })}
              {/* 메인 스케줄 카운트 */}
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
              {/* 이전 5일 카운트 */}
              {previousDateList.map((dateStr, index) => {
                const count = getPreviousDailyCount(dateStr, 'N');
                const date = new Date(dateStr);
                const isWeekStart = date.getDay() === 0;
                const isLastPreviousDay = index === previousDateList.length - 1;
                return (
                  <td key={`prev-n-${dateStr}`} className={`previous-footer daily-count ${isWeekStart ? 'week-start' : ''} ${isLastPreviousDay ? 'previous-divider' : ''}`}>
                    {count}
                  </td>
                );
              })}
              {/* 메인 스케줄 카운트 */}
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

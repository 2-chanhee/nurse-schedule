import { useState, useEffect } from 'react';
import type { Nurse, DayOfWeek, ShiftRestriction } from '../types';
import { DAYS_OF_WEEK, DAY_OF_WEEK_LABELS } from '../types';
import { DEFAULT_NURSE_COUNT, SHIFT_RESTRICTION_LABELS } from '../constants';
import { clearAllStorage, DateRangeStorage } from '../utils/storage';
import '../styles/NurseManagement.css';

interface NurseManagementProps {
  nurses: Nurse[];
  onNursesChange: (nurses: Nurse[]) => void;
}

export default function NurseManagement({ nurses, onNursesChange }: NurseManagementProps) {
  const [name, setName] = useState('');
  const [weekOffDay, setWeekOffDay] = useState<DayOfWeek>('SUN');

  // 각 간호사별 선택한 날짜 임시 저장
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({});

  // 스케줄 날짜 범위 (localStorage에서 읽기)
  const [scheduleDateRange, setScheduleDateRange] = useState<{ start: string; end: string } | null>(null);

  // 컴포넌트 마운트 시 스케줄 날짜 범위 로드
  useEffect(() => {
    const start = DateRangeStorage.loadStart('');
    const end = DateRangeStorage.loadEnd('');
    if (start && end) {
      setScheduleDateRange({ start, end });
    }
  }, []);

  // 기본 15명 초기화 (주휴일 라운드로빈)
  const initializeDefaultNurses = () => {
    const defaultNurses: Nurse[] = [];
    for (let i = 0; i < DEFAULT_NURSE_COUNT; i++) {
      const weekOffDay = DAYS_OF_WEEK[i % DAYS_OF_WEEK.length];

      defaultNurses.push({
        id: `nurse-${i + 1}`,
        name: `간호사 ${i + 1}`,
        weekOffDay,
        requestedOffDates: [], // 빈 배열로 시작
        restrictedShift: 'NONE', // 제한 없음
      });
    }
    onNursesChange(defaultNurses);
  };

  // 모든 데이터 초기화 (간호사 + 스케줄)
  const handleReset = () => {
    if (window.confirm('모든 데이터를 초기화하시겠습니까?\n간호사 정보와 스케줄이 모두 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.')) {
      onNursesChange([]);
      clearAllStorage();
    }
  };

  const handleAdd = () => {
    if (!name.trim()) {
      alert('간호사 이름을 입력해주세요.');
      return;
    }

    const newNurse: Nurse = {
      id: `nurse-${Date.now()}`,
      name: name.trim(),
      weekOffDay,
      requestedOffDates: [], // 쉬는날 신청 초기화
      restrictedShift: 'NONE', // 제한 없음
    };

    onNursesChange([...nurses, newNurse]);
    setName('');
    setWeekOffDay('SUN');
  };

  const handleDelete = (id: string) => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      onNursesChange(nurses.filter((nurse) => nurse.id !== id));
    }
  };

  const handleWeekOffChange = (id: string, newWeekOffDay: DayOfWeek) => {
    const updatedNurses = nurses.map((nurse) =>
      nurse.id === id ? { ...nurse, weekOffDay: newWeekOffDay } : nurse
    );
    onNursesChange(updatedNurses);
  };

  const handleNameChange = (id: string, newName: string) => {
    const updatedNurses = nurses.map((nurse) =>
      nurse.id === id ? { ...nurse, name: newName } : nurse
    );
    onNursesChange(updatedNurses);
  };

  const handleAddRequestedOff = (id: string, date: string) => {
    if (!date) return;

    // 해당 간호사 찾기
    const nurse = nurses.find((n) => n.id === id);
    if (!nurse) return;

    // 스케줄 날짜 범위 검증
    if (scheduleDateRange) {
      if (date < scheduleDateRange.start || date > scheduleDateRange.end) {
        alert(`❌ 쉬는날은 스케줄 범위(${scheduleDateRange.start} ~ ${scheduleDateRange.end}) 내에서만 신청 가능합니다.`);
        return;
      }
    }

    // 이미 신청한 날짜인지 확인 (기존 데이터 호환성 고려)
    const existingDates = (nurse.requestedOffDates || []).map((item: any) =>
      typeof item === 'string' ? item : item.date
    );
    if (existingDates.includes(date)) {
      alert('❌ 이미 신청한 날짜입니다.');
      return;
    }

    // 날짜만 추가 (타입은 스케줄 생성 시 자동 결정)
    const updatedNurses = nurses.map((n) =>
      n.id === id
        ? {
            ...n,
            requestedOffDates: [
              ...(n.requestedOffDates || []).map((item: any) =>
                typeof item === 'string' ? item : item.date
              ),
              date
            ].sort(),
          }
        : n
    );
    onNursesChange(updatedNurses);
  };

  const handleRemoveRequestedOff = (id: string, date: string) => {
    const updatedNurses = nurses.map((nurse) =>
      nurse.id === id
        ? {
            ...nurse,
            requestedOffDates: (nurse.requestedOffDates || [])
              .map((item: any) => (typeof item === 'string' ? item : item.date))
              .filter((d) => d !== date)
          }
        : nurse
    );
    onNursesChange(updatedNurses);
  };

  const handleShiftRestrictionChange = (id: string, restriction: ShiftRestriction) => {
    const updatedNurses = nurses.map((nurse) =>
      nurse.id === id ? { ...nurse, restrictedShift: restriction } : nurse
    );
    onNursesChange(updatedNurses);
  };

  return (
    <div className="nurse-management">
      <div className="nurse-management-header">
        <h2>간호사 관리</h2>
        <div className="header-buttons">
          {nurses.length === 0 && (
            <button onClick={initializeDefaultNurses} className="btn-init">
              기본 15명 세팅
            </button>
          )}
          {nurses.length > 0 && (
            <button onClick={handleReset} className="btn-reset">
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="nurse-form">
        <div className="form-group">
          <label>이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="간호사 이름"
          />
        </div>

        <div className="form-group">
          <label>주휴일</label>
          <select value={weekOffDay} onChange={(e) => setWeekOffDay(e.target.value as DayOfWeek)}>
            {DAYS_OF_WEEK.map((day) => (
              <option key={day} value={day}>
                {DAY_OF_WEEK_LABELS[day]}요일
              </option>
            ))}
          </select>
        </div>

        <div className="form-actions">
          <button onClick={handleAdd} className="btn-add">
            추가
          </button>
        </div>
      </div>

      <div className="nurse-list">
        <h3>간호사 목록 ({nurses.length}명)</h3>
        {nurses.length === 0 ? (
          <p className="empty-message">등록된 간호사가 없습니다. 기본 15명을 세팅하거나 직접 추가해주세요.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>번호</th>
                <th>이름</th>
                <th>주휴일</th>
                <th>쉬는날 신청</th>
                <th>근무 제한</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {nurses.map((nurse, index) => (
                <tr key={nurse.id}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      type="text"
                      value={nurse.name}
                      onChange={(e) => handleNameChange(nurse.id, e.target.value)}
                      className="name-input"
                    />
                  </td>
                  <td>
                    <select
                      value={nurse.weekOffDay}
                      onChange={(e) => handleWeekOffChange(nurse.id, e.target.value as DayOfWeek)}
                      className="weekoff-select"
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day} value={day}>
                          {DAY_OF_WEEK_LABELS[day]}요일
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="requested-off-section">
                      <div className="requested-off-input">
                        <input
                          type="date"
                          value={selectedDates[nurse.id] || ''}
                          min={scheduleDateRange?.start || undefined}
                          max={scheduleDateRange?.end || undefined}
                          onChange={(e) => {
                            setSelectedDates({
                              ...selectedDates,
                              [nurse.id]: e.target.value,
                            });
                          }}
                          className="date-input"
                        />
                        <button
                          onClick={() => {
                            const date = selectedDates[nurse.id];
                            if (date) {
                              handleAddRequestedOff(nurse.id, date);
                              // 추가 성공 후 input 초기화
                              setSelectedDates({
                                ...selectedDates,
                                [nurse.id]: '',
                              });
                            }
                          }}
                          className="btn-add-date"
                        >
                          추가
                        </button>
                      </div>
                      {(nurse.requestedOffDates || []).length > 0 && (
                        <div className="requested-off-list">
                          {(nurse.requestedOffDates || []).map((item) => {
                            // 기존 localStorage 데이터 호환성: {date, type} 객체 → 문자열 변환
                            const date = typeof item === 'string' ? item : (item as any).date;
                            return (
                              <div key={date} className="requested-off-item">
                                <span className="off-date">{date}</span>
                                <button
                                  onClick={() => handleRemoveRequestedOff(nurse.id, date)}
                                  className="btn-remove-date"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <select
                      value={nurse.restrictedShift || 'NONE'}
                      onChange={(e) => handleShiftRestrictionChange(nurse.id, e.target.value as ShiftRestriction)}
                      className="shift-restriction-select"
                    >
                      {Object.entries(SHIFT_RESTRICTION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button onClick={() => handleDelete(nurse.id)} className="btn-delete">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

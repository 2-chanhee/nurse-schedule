import { useState, useEffect } from 'react';
import type { Nurse, DayOfWeek } from '../types';
import { DAYS_OF_WEEK, DAY_OF_WEEK_LABELS } from '../types';
import { DEFAULT_NURSE_COUNT } from '../constants';
import { clearAllStorage, DateRangeStorage } from '../utils/storage';
import '../styles/NurseManagement.css';

interface NurseManagementProps {
  nurses: Nurse[];
  onNursesChange: (nurses: Nurse[]) => void;
}

export default function NurseManagement({ nurses, onNursesChange }: NurseManagementProps) {
  const [name, setName] = useState('');
  const [weekOffDay, setWeekOffDay] = useState<DayOfWeek>('SUN');

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

      // 연차는 자동 배정하지 않음 (사용자가 직접 신청하거나, 시스템이 강제 배정)
      defaultNurses.push({
        id: `nurse-${i + 1}`,
        name: `간호사 ${i + 1}`,
        weekOffDay,
        annualLeaveDates: [], // 빈 배열로 시작
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
      annualLeaveDates: [], // 연차 날짜 초기화
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

  const handleAddAnnualLeave = (id: string, date: string) => {
    if (!date) return;

    // 해당 간호사 찾기
    const nurse = nurses.find((n) => n.id === id);
    if (!nurse) return;

    // 스케줄 날짜 범위 검증
    if (scheduleDateRange) {
      if (date < scheduleDateRange.start || date > scheduleDateRange.end) {
        alert(`❌ 연차는 스케줄 범위(${scheduleDateRange.start} ~ ${scheduleDateRange.end}) 내에서만 신청 가능합니다.`);
        return;
      }
    }

    // 선택한 날짜의 요일 계산
    const selectedDate = new Date(date);
    const dayMap: Record<number, DayOfWeek> = {
      0: 'SUN',
      1: 'MON',
      2: 'TUE',
      3: 'WED',
      4: 'THU',
      5: 'FRI',
      6: 'SAT',
    };
    const selectedDayOfWeek = dayMap[selectedDate.getDay()];

    // 주휴일과 겹치는지 확인
    if (selectedDayOfWeek === nurse.weekOffDay) {
      alert(`❌ 주휴일(${DAY_OF_WEEK_LABELS[nurse.weekOffDay]}요일)과 연차는 겹칠 수 없습니다.\n다른 요일을 선택해주세요.`);
      return;
    }

    const updatedNurses = nurses.map((n) =>
      n.id === id
        ? { ...n, annualLeaveDates: [...n.annualLeaveDates, date].sort() }
        : n
    );
    onNursesChange(updatedNurses);
  };

  const handleRemoveAnnualLeave = (id: string, date: string) => {
    const updatedNurses = nurses.map((nurse) =>
      nurse.id === id
        ? { ...nurse, annualLeaveDates: nurse.annualLeaveDates.filter((d) => d !== date) }
        : nurse
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
                <th>연차 신청</th>
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
                    <div className="annual-leave-section">
                      <div className="annual-leave-input">
                        <input
                          type="date"
                          key={`${nurse.id}-${nurse.annualLeaveDates.length}`}
                          min={scheduleDateRange?.start || undefined}
                          max={scheduleDateRange?.end || undefined}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddAnnualLeave(nurse.id, e.target.value);
                            }
                          }}
                          className="date-input"
                        />
                      </div>
                      {nurse.annualLeaveDates.length > 0 && (
                        <div className="annual-leave-list">
                          {nurse.annualLeaveDates.map((date) => (
                            <div key={date} className="annual-leave-item">
                              <span>{date}</span>
                              <button
                                onClick={() => handleRemoveAnnualLeave(nurse.id, date)}
                                className="btn-remove-date"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

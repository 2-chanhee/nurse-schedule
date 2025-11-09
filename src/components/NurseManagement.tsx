import { useState } from 'react';
import type { Nurse, DayOfWeek } from '../types';
import { DAYS_OF_WEEK, DAY_OF_WEEK_LABELS } from '../types';
import { DEFAULT_NURSE_COUNT } from '../constants';
import { clearAllStorage } from '../utils/storage';
import '../styles/NurseManagement.css';

interface NurseManagementProps {
  nurses: Nurse[];
  onNursesChange: (nurses: Nurse[]) => void;
}

export default function NurseManagement({ nurses, onNursesChange }: NurseManagementProps) {
  const [name, setName] = useState('');
  const [weekOffDay, setWeekOffDay] = useState<DayOfWeek>('SUN');

  // 스케줄 시작일 계산 (ScheduleView와 동일한 로직)
  const getScheduleStartDate = (): Date => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = 일요일
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return nextSunday;
  };

  // 특정 요일의 날짜들을 스케줄 범위 내에서 찾기 (주휴일 제외)
  const getDatesForWeekDay = (startDate: Date, weekOffDay: DayOfWeek): string[] => {
    const dayMap: Record<DayOfWeek, number> = {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };

    // 주휴일이 아닌 다음 요일을 연차 요일로 선택
    const weekOffDayNum = dayMap[weekOffDay];
    const annualDayNum = (weekOffDayNum + 1) % 7; // 주휴일 다음날

    const dates: string[] = [];

    // 4주 범위 내에서 해당 요일 찾기
    for (let i = 0; i < 28; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      if (date.getDay() === annualDayNum) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
      }
    }
    return dates;
  };

  // 기본 15명 초기화 (주휴일 라운드로빈)
  const initializeDefaultNurses = () => {
    const scheduleStartDate = getScheduleStartDate();

    // 랜덤하게 3명 선택
    const randomIndices: number[] = [];
    while (randomIndices.length < 3) {
      const randomIndex = Math.floor(Math.random() * DEFAULT_NURSE_COUNT);
      if (!randomIndices.includes(randomIndex)) {
        randomIndices.push(randomIndex);
      }
    }

    const defaultNurses: Nurse[] = [];
    for (let i = 0; i < DEFAULT_NURSE_COUNT; i++) {
      const weekOffDay = DAYS_OF_WEEK[i % DAYS_OF_WEEK.length];

      // 랜덤 3명에게 주휴일과 같은 요일에 연차 미리 배정
      let annualLeaveDates: string[] = [];
      if (randomIndices.includes(i)) {
        const availableDates = getDatesForWeekDay(scheduleStartDate, weekOffDay);
        // 가능한 날짜 중 2개 선택 (첫 번째와 세 번째 주)
        if (availableDates.length >= 2) {
          annualLeaveDates = [availableDates[0], availableDates[2]];
        }
      }

      defaultNurses.push({
        id: `nurse-${i + 1}`,
        name: `간호사 ${i + 1}`,
        weekOffDay,
        annualLeaveDates,
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

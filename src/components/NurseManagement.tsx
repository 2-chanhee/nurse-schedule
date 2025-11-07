import { useState } from 'react';
import type { Nurse, DayOfWeek } from '../types';
import { DAYS_OF_WEEK, DAY_OF_WEEK_LABELS } from '../types';
import { DEFAULT_NURSE_COUNT } from '../constants';
import '../styles/NurseManagement.css';

interface NurseManagementProps {
  nurses: Nurse[];
  onNursesChange: (nurses: Nurse[]) => void;
}

export default function NurseManagement({ nurses, onNursesChange }: NurseManagementProps) {
  const [name, setName] = useState('');
  const [weekOffDay, setWeekOffDay] = useState<DayOfWeek>('SUN');

  // 기본 15명 초기화 (주휴일 라운드로빈)
  const initializeDefaultNurses = () => {
    const defaultNurses: Nurse[] = [];
    for (let i = 0; i < DEFAULT_NURSE_COUNT; i++) {
      defaultNurses.push({
        id: `nurse-${i + 1}`,
        name: `간호사 ${i + 1}`,
        weekOffDay: DAYS_OF_WEEK[i % DAYS_OF_WEEK.length], // 라운드로빈
      });
    }
    onNursesChange(defaultNurses);
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

  return (
    <div className="nurse-management">
      <div className="nurse-management-header">
        <h2>간호사 관리</h2>
        {nurses.length === 0 && (
          <button onClick={initializeDefaultNurses} className="btn-init">
            기본 15명 세팅
          </button>
        )}
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

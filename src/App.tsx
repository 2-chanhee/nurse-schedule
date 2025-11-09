import { useState, useEffect } from 'react';
import NurseManagement from './components/NurseManagement';
import ScheduleView from './components/ScheduleView';
import type { Nurse } from './types';
import { NurseStorage } from './utils/storage';
import './App.css';

type Tab = 'nurses' | 'schedule';

function App() {
  // localStorage에서 간호사 데이터 로드
  const [nurses, setNurses] = useState<Nurse[]>(() => {
    return NurseStorage.load<Nurse[]>([]);
  });
  const [activeTab, setActiveTab] = useState<Tab>('nurses');

  // nurses가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    NurseStorage.save(nurses);
  }, [nurses]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>간호사 번표 자동 작성 프로그램</h1>
        <nav className="app-tabs">
          <button
            className={`tab-button ${activeTab === 'nurses' ? 'active' : ''}`}
            onClick={() => setActiveTab('nurses')}
          >
            간호사 관리
          </button>
          <button
            className={`tab-button ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            스케줄 관리
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'nurses' && (
          <NurseManagement nurses={nurses} onNursesChange={setNurses} />
        )}
        {activeTab === 'schedule' && <ScheduleView nurses={nurses} />}
      </main>
    </div>
  );
}

export default App;

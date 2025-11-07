import { useState } from 'react';
import NurseManagement from './components/NurseManagement';
import ScheduleView from './components/ScheduleView';
import type { Nurse } from './types';
import './App.css';

type Tab = 'nurses' | 'schedule';

function App() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('nurses');

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

import { generateSimpleSchedule } from './src/utils/scheduler';
import type { Nurse, ScheduleCell } from './src/types';

const DEFAULT_NURSE_COUNT = 15;
const DEFAULT_START_DATE = '2024-01-01';
const DEFAULT_END_DATE = '2024-01-28';

// 기본 15명 간호사 생성
function createTestNurses(): Nurse[] {
  const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
  const nurses: Nurse[] = [];
  for (let i = 0; i < DEFAULT_NURSE_COUNT; i++) {
    nurses.push({
      id: `nurse-${i + 1}`,
      name: `간호사 ${i + 1}`,
      weekOffDay: DAYS_OF_WEEK[i % DAYS_OF_WEEK.length],
      annualLeaveDates: [],
    });
  }
  return nurses;
}

// 고정 셀 생성 (한 사람이 4주 내내 D 고정)
function createFixedCells(): ScheduleCell[] {
  const fixedCells: ScheduleCell[] = [];
  const dates: string[] = [];
  const start = new Date(DEFAULT_START_DATE);
  const end = new Date(DEFAULT_END_DATE);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  // 간호사 1번이 모든 날짜에 D 고정
  dates.forEach(date => {
    fixedCells.push({
      nurseId: 'nurse-1',
      date,
      shiftType: 'D',
      isFixed: true,
    });
  });

  return fixedCells;
}

async function measurePerformance() {
  console.log('🔍 백트래킹 성능 측정 시작\n');

  const nurses = createTestNurses();

  // 1. 고정 셀 없이 1000번 생성
  console.log('📊 테스트 1: 고정 셀 없이 1000번 생성');
  const start1 = Date.now();
  let successCount1 = 0;

  for (let i = 0; i < 1000; i++) {
    const result = generateSimpleSchedule(
      nurses,
      DEFAULT_START_DATE,
      DEFAULT_END_DATE,
      true, // randomize
      [], // 고정 셀 없음
      undefined,
      {},
      100 // maxAttempts
    );
    if (result.length > 0) successCount1++;
    if ((i + 1) % 100 === 0) {
      console.log(`  진행: ${i + 1}/1000 (${Math.round((i + 1) / 10)}%)`);
    }
  }

  const end1 = Date.now();
  const duration1 = (end1 - start1) / 1000; // 초 단위

  console.log(`✅ 완료: ${successCount1}/1000 성공`);
  console.log(`⏱️  총 소요 시간: ${duration1.toFixed(2)}초 (${(duration1 / 60).toFixed(2)}분)`);
  console.log(`⏱️  평균 소요 시간: ${(duration1 / 1000 * 1000).toFixed(2)}ms/회\n`);

  // 2. 고정 셀 많을 때 100번 생성 (시간이 오래 걸릴 수 있어서 100번만)
  console.log('📊 테스트 2: 고정 셀 많을 때 100번 생성 (한 사람이 4주 D 고정)');
  const fixedCells = createFixedCells();
  const start2 = Date.now();
  let successCount2 = 0;

  for (let i = 0; i < 100; i++) {
    const result = generateSimpleSchedule(
      nurses,
      DEFAULT_START_DATE,
      DEFAULT_END_DATE,
      true,
      fixedCells,
      undefined,
      {},
      100
    );
    if (result.length > 0) successCount2++;
    if ((i + 1) % 10 === 0) {
      console.log(`  진행: ${i + 1}/100 (${i + 1}%)`);
    }
  }

  const end2 = Date.now();
  const duration2 = (end2 - start2) / 1000;

  console.log(`✅ 완료: ${successCount2}/100 성공`);
  console.log(`⏱️  총 소요 시간: ${duration2.toFixed(2)}초 (${(duration2 / 60).toFixed(2)}분)`);
  console.log(`⏱️  평균 소요 시간: ${(duration2 / 100 * 1000).toFixed(2)}ms/회`);
  console.log(`⏱️  1000번 예상 시간: ${(duration2 * 10).toFixed(2)}초 (${(duration2 * 10 / 60).toFixed(2)}분)\n`);

  // 결과 요약
  console.log('📈 결과 요약:');
  console.log('┌─────────────────────────────┬───────────────┬───────────────┐');
  console.log('│ 테스트 케이스                │ 1회 평균 시간  │ 1000회 예상    │');
  console.log('├─────────────────────────────┼───────────────┼───────────────┤');
  console.log(`│ 고정 셀 없음                 │ ${(duration1 / 1000 * 1000).toFixed(2).padStart(8)} ms   │ ${(duration1 / 60).toFixed(2).padStart(8)} 분   │`);
  console.log(`│ 고정 셀 많음 (4주 D 고정)    │ ${(duration2 / 100 * 1000).toFixed(2).padStart(8)} ms   │ ${(duration2 * 10 / 60).toFixed(2).padStart(8)} 분   │`);
  console.log('└─────────────────────────────┴───────────────┴───────────────┘');
}

measurePerformance().catch(console.error);

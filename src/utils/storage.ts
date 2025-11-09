// localStorage 유틸리티 함수

const STORAGE_KEYS = {
  NURSES: 'nurse-schedule-nurses',
  SCHEDULE: 'nurse-schedule-schedule',
  PREVIOUS_SCHEDULE: 'nurse-schedule-previous',
  REJECTED_ANNUAL: 'nurse-schedule-rejected-annual',
  START_DATE: 'nurse-schedule-start-date',
  END_DATE: 'nurse-schedule-end-date',
};

/**
 * localStorage에 데이터 저장
 */
export function saveToStorage<T>(key: string, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error('localStorage 저장 실패:', error);
  }
}

/**
 * localStorage에서 데이터 로드
 */
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const serialized = localStorage.getItem(key);
    if (serialized === null) {
      return defaultValue;
    }
    return JSON.parse(serialized) as T;
  } catch (error) {
    console.error('localStorage 로드 실패:', error);
    return defaultValue;
  }
}

/**
 * localStorage에서 특정 키 삭제
 */
export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('localStorage 삭제 실패:', error);
  }
}

/**
 * 모든 앱 데이터 초기화
 */
export function clearAllStorage(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('localStorage 초기화 실패:', error);
  }
}

// 간호사 데이터 관련
export const NurseStorage = {
  save: (data: unknown) => saveToStorage(STORAGE_KEYS.NURSES, data),
  load: <T>(defaultValue: T) => loadFromStorage(STORAGE_KEYS.NURSES, defaultValue),
  clear: () => removeFromStorage(STORAGE_KEYS.NURSES),
};

// 스케줄 데이터 관련
export const ScheduleStorage = {
  save: (data: unknown) => saveToStorage(STORAGE_KEYS.SCHEDULE, data),
  load: <T>(defaultValue: T) => loadFromStorage(STORAGE_KEYS.SCHEDULE, defaultValue),
  clear: () => removeFromStorage(STORAGE_KEYS.SCHEDULE),
};

// 이전 스케줄 데이터 관련
export const PreviousScheduleStorage = {
  save: (data: unknown) => saveToStorage(STORAGE_KEYS.PREVIOUS_SCHEDULE, data),
  load: <T>(defaultValue: T) => loadFromStorage(STORAGE_KEYS.PREVIOUS_SCHEDULE, defaultValue),
  clear: () => removeFromStorage(STORAGE_KEYS.PREVIOUS_SCHEDULE),
};

// 반려된 연차 데이터 관련
export const RejectedAnnualStorage = {
  save: (data: unknown) => saveToStorage(STORAGE_KEYS.REJECTED_ANNUAL, data),
  load: <T>(defaultValue: T) => loadFromStorage(STORAGE_KEYS.REJECTED_ANNUAL, defaultValue),
  clear: () => removeFromStorage(STORAGE_KEYS.REJECTED_ANNUAL),
};

// 날짜 범위 데이터 관련
export const DateRangeStorage = {
  saveStart: (date: string) => saveToStorage(STORAGE_KEYS.START_DATE, date),
  saveEnd: (date: string) => saveToStorage(STORAGE_KEYS.END_DATE, date),
  loadStart: (defaultValue: string) => loadFromStorage(STORAGE_KEYS.START_DATE, defaultValue),
  loadEnd: (defaultValue: string) => loadFromStorage(STORAGE_KEYS.END_DATE, defaultValue),
  clear: () => {
    removeFromStorage(STORAGE_KEYS.START_DATE);
    removeFromStorage(STORAGE_KEYS.END_DATE);
  },
};

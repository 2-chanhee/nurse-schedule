import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  NurseStorage,
  ScheduleStorage,
  PreviousScheduleStorage,
  RejectedAnnualStorage,
  DateRangeStorage,
} from './storage';
import type { Nurse, ScheduleCell } from '../types';

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// localStorage를 mock으로 교체
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Storage Utilities', () => {
  beforeEach(() => {
    // 각 테스트 전에 localStorage 초기화
    localStorage.clear();
  });

  describe('saveToStorage', () => {
    it('문자열 데이터를 저장할 수 있어야 함', () => {
      saveToStorage('test-key', 'test-value');
      const saved = localStorage.getItem('test-key');
      expect(saved).toBe('"test-value"');
    });

    it('객체 데이터를 저장할 수 있어야 함', () => {
      const testObject = { name: '간호사1', id: '1' };
      saveToStorage('test-key', testObject);
      const saved = localStorage.getItem('test-key');
      expect(saved).toBe(JSON.stringify(testObject));
    });

    it('배열 데이터를 저장할 수 있어야 함', () => {
      const testArray = [1, 2, 3, 4, 5];
      saveToStorage('test-key', testArray);
      const saved = localStorage.getItem('test-key');
      expect(saved).toBe(JSON.stringify(testArray));
    });

    it('null 값도 저장할 수 있어야 함', () => {
      saveToStorage('test-key', null);
      const saved = localStorage.getItem('test-key');
      expect(saved).toBe('null');
    });
  });

  describe('loadFromStorage', () => {
    it('저장된 문자열 데이터를 로드할 수 있어야 함', () => {
      localStorage.setItem('test-key', '"test-value"');
      const loaded = loadFromStorage('test-key', '');
      expect(loaded).toBe('test-value');
    });

    it('저장된 객체 데이터를 로드할 수 있어야 함', () => {
      const testObject = { name: '간호사1', id: '1' };
      localStorage.setItem('test-key', JSON.stringify(testObject));
      const loaded = loadFromStorage('test-key', {});
      expect(loaded).toEqual(testObject);
    });

    it('저장된 배열 데이터를 로드할 수 있어야 함', () => {
      const testArray = [1, 2, 3, 4, 5];
      localStorage.setItem('test-key', JSON.stringify(testArray));
      const loaded = loadFromStorage('test-key', []);
      expect(loaded).toEqual(testArray);
    });

    it('키가 없으면 기본값을 반환해야 함', () => {
      const defaultValue = { default: true };
      const loaded = loadFromStorage('non-existing-key', defaultValue);
      expect(loaded).toEqual(defaultValue);
    });

    it('파싱 에러 발생 시 기본값을 반환해야 함', () => {
      localStorage.setItem('test-key', 'invalid-json{');
      const defaultValue = { default: true };
      const loaded = loadFromStorage('test-key', defaultValue);
      expect(loaded).toEqual(defaultValue);
    });
  });

  describe('removeFromStorage', () => {
    it('특정 키를 삭제할 수 있어야 함', () => {
      localStorage.setItem('test-key', '"test-value"');
      expect(localStorage.getItem('test-key')).not.toBeNull();

      removeFromStorage('test-key');
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('존재하지 않는 키를 삭제해도 에러가 발생하지 않아야 함', () => {
      expect(() => removeFromStorage('non-existing-key')).not.toThrow();
    });
  });

  describe('NurseStorage', () => {
    it('간호사 데이터를 저장하고 로드할 수 있어야 함', () => {
      const nurses: Nurse[] = [
        {
          id: 'nurse-1',
          name: '간호사1',
          weekOffDay: 'SUN',
          requestedOffDates: ['2024-01-15'],
          restrictedShift: 'NONE',
        },
        {
          id: 'nurse-2',
          name: '간호사2',
          weekOffDay: 'MON',
          requestedOffDates: [],
          restrictedShift: 'NONE',
        },
      ];

      NurseStorage.save(nurses);
      const loaded = NurseStorage.load<Nurse[]>([]);
      expect(loaded).toEqual(nurses);
    });

    it('간호사 데이터가 없으면 기본값을 반환해야 함', () => {
      const defaultNurses: Nurse[] = [];
      const loaded = NurseStorage.load<Nurse[]>(defaultNurses);
      expect(loaded).toEqual(defaultNurses);
    });

    it('간호사 데이터를 삭제할 수 있어야 함', () => {
      const nurses: Nurse[] = [
        {
          id: 'nurse-1',
          name: '간호사1',
          weekOffDay: 'SUN',
          requestedOffDates: [],
          restrictedShift: 'NONE',
        },
      ];

      NurseStorage.save(nurses);
      expect(NurseStorage.load<Nurse[]>([])).toEqual(nurses);

      NurseStorage.clear();
      expect(NurseStorage.load<Nurse[]>([])).toEqual([]);
    });
  });

  describe('ScheduleStorage', () => {
    it('스케줄 데이터를 저장하고 로드할 수 있어야 함', () => {
      const schedule: ScheduleCell[] = [
        {
          nurseId: 'nurse-1',
          date: '2024-01-01',
          shiftType: 'D',
          isFixed: false,
        },
        {
          nurseId: 'nurse-2',
          date: '2024-01-01',
          shiftType: 'E',
          isFixed: false,
        },
      ];

      ScheduleStorage.save(schedule);
      const loaded = ScheduleStorage.load<ScheduleCell[]>([]);
      expect(loaded).toEqual(schedule);
    });

    it('스케줄 데이터를 삭제할 수 있어야 함', () => {
      const schedule: ScheduleCell[] = [
        {
          nurseId: 'nurse-1',
          date: '2024-01-01',
          shiftType: 'D',
          isFixed: false,
        },
      ];

      ScheduleStorage.save(schedule);
      ScheduleStorage.clear();
      expect(ScheduleStorage.load<ScheduleCell[]>([])).toEqual([]);
    });
  });

  describe('PreviousScheduleStorage', () => {
    it('이전 스케줄 데이터를 저장하고 로드할 수 있어야 함', () => {
      const previousSchedule: Record<string, ScheduleCell[]> = {
        'nurse-1': [
          {
            nurseId: 'nurse-1',
            date: '2023-12-27',
            shiftType: 'D',
            isFixed: false,
          },
        ],
        'nurse-2': [],
      };

      PreviousScheduleStorage.save(previousSchedule);
      const loaded = PreviousScheduleStorage.load<Record<string, ScheduleCell[]>>({});
      expect(loaded).toEqual(previousSchedule);
    });

    it('이전 스케줄 데이터를 삭제할 수 있어야 함', () => {
      const previousSchedule = { 'nurse-1': [] };

      PreviousScheduleStorage.save(previousSchedule);
      PreviousScheduleStorage.clear();
      expect(PreviousScheduleStorage.load<Record<string, ScheduleCell[]>>({})).toEqual({});
    });
  });

  describe('RejectedAnnualStorage', () => {
    it('반려된 연차 데이터를 저장하고 로드할 수 있어야 함', () => {
      interface RejectedAnnualLeave {
        nurseId: string;
        nurseName: string;
        date: string;
        reason: string;
      }

      const rejectedAnnual: RejectedAnnualLeave[] = [
        {
          nurseId: 'nurse-1',
          nurseName: '간호사1',
          date: '2024-01-15',
          reason: '필수 인원 부족',
        },
      ];

      RejectedAnnualStorage.save(rejectedAnnual);
      const loaded = RejectedAnnualStorage.load<RejectedAnnualLeave[]>([]);
      expect(loaded).toEqual(rejectedAnnual);
    });

    it('반려된 연차 데이터를 삭제할 수 있어야 함', () => {
      const rejectedAnnual = [
        {
          nurseId: 'nurse-1',
          nurseName: '간호사1',
          date: '2024-01-15',
          reason: '필수 인원 부족',
        },
      ];

      RejectedAnnualStorage.save(rejectedAnnual);
      RejectedAnnualStorage.clear();
      expect(RejectedAnnualStorage.load([])).toEqual([]);
    });
  });

  describe('DateRangeStorage', () => {
    it('시작일과 종료일을 저장하고 로드할 수 있어야 함', () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-28';

      DateRangeStorage.saveStart(startDate);
      DateRangeStorage.saveEnd(endDate);

      const loadedStart = DateRangeStorage.loadStart('');
      const loadedEnd = DateRangeStorage.loadEnd('');

      expect(loadedStart).toBe(startDate);
      expect(loadedEnd).toBe(endDate);
    });

    it('날짜 범위를 삭제할 수 있어야 함', () => {
      DateRangeStorage.saveStart('2024-01-01');
      DateRangeStorage.saveEnd('2024-01-28');

      DateRangeStorage.clear();

      expect(DateRangeStorage.loadStart('')).toBe('');
      expect(DateRangeStorage.loadEnd('')).toBe('');
    });

    it('저장된 날짜가 없으면 기본값을 반환해야 함', () => {
      const defaultStart = '2024-01-01';
      const defaultEnd = '2024-01-28';

      const loadedStart = DateRangeStorage.loadStart(defaultStart);
      const loadedEnd = DateRangeStorage.loadEnd(defaultEnd);

      expect(loadedStart).toBe(defaultStart);
      expect(loadedEnd).toBe(defaultEnd);
    });
  });

  describe('Error Handling', () => {
    it('localStorage.setItem 에러 발생 시 예외를 던지지 않아야 함', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 원래 setItem 메서드 저장
      const originalSetItem = localStorage.setItem;

      // setItem을 에러를 던지도록 변경
      localStorage.setItem = () => {
        throw new Error('Quota exceeded');
      };

      expect(() => saveToStorage('test-key', 'test-value')).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('localStorage 저장 실패:', expect.any(Error));

      // 원래 메서드 복원
      localStorage.setItem = originalSetItem;
      consoleErrorSpy.mockRestore();
    });

    it('localStorage.getItem 에러 발생 시 기본값을 반환해야 함', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 원래 getItem 메서드 저장
      const originalGetItem = localStorage.getItem;

      // getItem을 에러를 던지도록 변경
      localStorage.getItem = () => {
        throw new Error('Access denied');
      };

      const defaultValue = { default: true };
      const loaded = loadFromStorage('test-key', defaultValue);

      expect(loaded).toEqual(defaultValue);
      expect(consoleErrorSpy).toHaveBeenCalledWith('localStorage 로드 실패:', expect.any(Error));

      // 원래 메서드 복원
      localStorage.getItem = originalGetItem;
      consoleErrorSpy.mockRestore();
    });

    it('localStorage.removeItem 에러 발생 시 예외를 던지지 않아야 함', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 원래 removeItem 메서드 저장
      const originalRemoveItem = localStorage.removeItem;

      // removeItem을 에러를 던지도록 변경
      localStorage.removeItem = () => {
        throw new Error('Access denied');
      };

      expect(() => removeFromStorage('test-key')).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('localStorage 삭제 실패:', expect.any(Error));

      // 원래 메서드 복원
      localStorage.removeItem = originalRemoveItem;
      consoleErrorSpy.mockRestore();
    });
  });
});

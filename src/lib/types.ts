export type DayType = 'work' | 'off' | 'holiday' | 'dsr' | 'leave';

export interface ShiftTime {
  startTime: string;       // "HH:mm" ou ""
  breakStartTime: string;  // "HH:mm" ou ""
  breakEndTime: string;    // "HH:mm" ou ""
  endTime: string;         // "HH:mm" ou ""
}

export interface ScheduleDay extends ShiftTime {
  date: string;            // "YYYY-MM-DD"
  dayOfWeek: number;       // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  dayType: DayType;
  notes?: string;
  isCustom?: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  workedOnHoliday?: boolean; // Sinalizado pelo usuário que irá trabalhar no feriado
}

export interface DayCalculation {
  workedMinutes: number;
  breakMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  formattedWorked: string;
  formattedBalance: string;
  isOvertime: boolean;
  isDeficit: boolean;
  isHolidayWork: boolean;
}

export interface MonthSummary {
  totalWorkedMinutes: number;
  totalExpectedMinutes: number;
  totalBalanceMinutes: number;
  workDaysCount: number;
  offDaysCount: number;
  holidayDaysCount: number;
  holidayWorkedMinutes: number;
  formattedTotalWorked: string;
  formattedExpected: string;
  formattedBalance: string;
  formattedHolidayWorked: string;
}

export interface AiRuleResponse {
  formula: string;
  explanation: string;
  weeklyTargetHours: number;
  dailyTargetHours: number;
  rules: {
    dayOfWeek: number; // 0 = Domingo, 1 = Seg, ..., 6 = Sáb. Ou -1 para todos os dias úteis
    dayType: DayType;
    startTime: string;
    breakStartTime: string;
    breakEndTime: string;
    endTime: string;
  }[];
}

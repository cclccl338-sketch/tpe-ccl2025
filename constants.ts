import { DayPlan } from "./types";

export const START_DATE = "2025-12-15";
export const END_DATE = "2026-01-05";
export const LOCATION = "Taipei, Taiwan";
export const DEFAULT_EXCHANGE_RATE = 0.15; // 1 TWD = 0.15 MYR (Approx)

// Helper to generate the initial itinerary array
export const generateInitialItinerary = (): DayPlan[] => {
  const plans: DayPlan[] = [];
  const start = new Date(START_DATE);
  const end = new Date(END_DATE);
  let current = new Date(start);
  let dayNum = 1;

  while (current <= end) {
    plans.push({
      date: current.toISOString().split('T')[0],
      dayNumber: dayNum,
      activities: [],
      dailySummary: ''
    });
    current.setDate(current.getDate() + 1);
    dayNum++;
  }
  return plans;
};

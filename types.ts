

export enum ActivityCategory {
  Sightseeing = 'Sightseeing',
  Food = 'Food',
  Transport = 'Transport',
  Other = 'Other'
}

export enum MealType {
  Breakfast = 'Breakfast',
  Brunch = 'Brunch',
  Lunch = 'Lunch',
  HighTea = 'High Tea',
  Dinner = 'Dinner',
  Supper = 'Supper',
  Snack = 'Snack',
  StreetFood = 'Street Food',
  Drink = 'Drink',
  Other = 'Other'
}

export enum TransportType {
  MRT = 'MRT',
  Bus = 'Bus',
  TaxiUber = 'Taxi/Uber',
  HSR = 'HSR',
  TRA = 'Train',
  Walking = 'Walking',
  YouBike = 'YouBike',
  PrivateCharter = 'Charter',
  Ferry = 'Ferry',
  Shuttle = 'Shuttle',
  Other = 'Other'
}

export interface Expense {
  amountTWD: number;
  description: string;
}

export interface Activity {
  id: string;
  time: string;
  category: ActivityCategory;
  description: string;
  locationName: string;
  locationAddress?: string;
  googleMapsUrl?: string;
  
  // For standalone Transport activity
  transportType?: TransportType;
  transportCostTWD?: number;
  
  // For Food activity
  mealType?: MealType;
  mealCostTWD?: number;
  
  // For Sightseeing: How to get there?
  arrivalTransport?: TransportType;
  arrivalCostTWD?: number;
  
  notes?: string;
  ticketCostTWD?: number; // Entrance fees, shopping, etc.
}

export interface DayPlan {
  date: string; // ISO string
  dayNumber: number; // 1 to X
  activities: Activity[];
  dailySummary?: string;
}

export interface PackingItem {
  id: string;
  name: string;
  category: 'Clothing' | 'Electronics' | 'Toiletries' | 'Documents' | 'Misc';
  isPacked: boolean;
}

export interface ShortlistItem {
  id: string;
  name: string;
  notes?: string;
  mapUrl?: string;
  address?: string;
  isLoading?: boolean;
}

export interface WeatherCardData {
  date: string;
  dayName: string; // e.g., "Monday"
  condition: string;
  temp: string;
  rainChance: string;
  advice: string;
}

export interface TransportLeg {
  id: string;
  label: string;
  method: string;
  cost: number;
  currency: 'TWD' | 'MYR';
}

export interface PreDepartureDetails {
  flightInfo: string;
  flightCostMYR: number; // Strictly MYR
  returnFlightInfo: string;
  returnFlightCostMYR: number; // Strictly MYR
  
  transfers: TransportLeg[];

  notes: string;
}

export interface AppState {
  shortlist: ShortlistItem[];
  packingList: PackingItem[];
  itinerary: DayPlan[];
  exchangeRate: number; // 1 TWD = X MYR
  displayCurrency: 'TWD' | 'MYR'; // For viewing totals
  budgetLimitMYR: number;
  weatherCache?: WeatherCardData[];
  preDeparture: PreDepartureDetails;
}
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, AppState, DayPlan, MealType, PackingItem, ShortlistItem, TransportType, ActivityCategory, TransportLeg } from './types';
import { generateInitialItinerary, START_DATE, END_DATE, DEFAULT_EXCHANGE_RATE } from './constants';
import { IconCalendar, IconList, IconWeather, IconPlus, IconTrash, IconMap, IconCheck, IconFlight, IconSearch, IconExternal, IconShare, IconPencil, IconCar } from './components/Icons';
import { searchPlace, getWeatherAdvice } from './services/geminiService';

// --- Utility Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ children, className = '', variant = 'primary', ...props }) => {
  const baseStyle = "px-5 py-3 rounded-xl font-sans font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm";
  const variants = {
    primary: "bg-brand-dark text-white hover:bg-black",
    secondary: "bg-white text-brand-dark border border-brand-border hover:bg-brand-light",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    ghost: "bg-transparent text-brand-secondary hover:bg-brand-light hover:text-brand-dark",
  };
  return <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

// Scaled up font-size to text-base (16px) to prevent iOS Zoom
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`w-full bg-white border border-brand-border text-brand-dark px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-medium placeholder-brand-secondary/50 text-base ${props.className || ''}`} />
);

const Chip: React.FC<{ label: string; selected: boolean; onClick: () => void; colorClass?: string }> = ({ label, selected, onClick, colorClass = "bg-brand-dark text-white" }) => (
    <button 
        type="button"
        onClick={onClick}
        className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all flex items-center gap-1.5 border ${
            selected 
            ? `${colorClass} shadow-sm border-transparent` 
            : 'bg-white text-brand-secondary border-brand-border hover:border-brand-dark/20'
        }`}
    >
        {label}
    </button>
);

const CurrencyToggle: React.FC<{ value: 'TWD' | 'MYR'; onChange: (v: 'TWD' | 'MYR') => void }> = ({ value, onChange }) => (
  <div className="flex bg-brand-light p-1 rounded-lg border border-brand-border">
    <button onClick={() => onChange('TWD')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${value === 'TWD' ? 'bg-white shadow-sm text-brand-dark' : 'text-brand-secondary'}`}>TWD</button>
    <button onClick={() => onChange('MYR')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${value === 'MYR' ? 'bg-white shadow-sm text-brand-dark' : 'text-brand-secondary'}`}>MYR</button>
  </div>
);

// --- Sections ---

// 1. Voyage Tab (Dashboard, Logistics, Budget)
const VoyageDashboard: React.FC<{
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}> = ({ appState, setAppState }) => {
  
  const today = new Date();
  const start = new Date(START_DATE);
  const diffTime = start.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const totalBudgetTWD = useMemo(() => {
    // 1. Sum Itinerary Costs
    const itineraryCost = appState.itinerary.reduce((sum, day) => {
        return sum + day.activities.reduce((dSum, act) => {
            return dSum + (act.transportCostTWD || 0) + (act.mealCostTWD || 0) + (act.ticketCostTWD || 0) + (act.arrivalCostTWD || 0);
        }, 0);
    }, 0);

    // 2. Pre-Departure Costs
    const flightCostMYR = (appState.preDeparture.flightCostMYR || 0) + (appState.preDeparture.returnFlightCostMYR || 0);
    const flightCostTWD = flightCostMYR / appState.exchangeRate;

    // 3. Transfers Cost
    const transfersCostTWD = appState.preDeparture.transfers.reduce((sum, t) => {
        if (t.currency === 'MYR') return sum + (t.cost / appState.exchangeRate);
        return sum + t.cost;
    }, 0);

    return itineraryCost + flightCostTWD + transfersCostTWD;
  }, [appState.itinerary, appState.preDeparture, appState.exchangeRate]);

  const updatePreDeparture = (field: keyof typeof appState.preDeparture, value: any) => {
    setAppState(prev => ({
        ...prev,
        preDeparture: { ...prev.preDeparture, [field]: value }
    }));
  }

  const updateTransfer = (id: string, field: keyof TransportLeg, value: any) => {
      setAppState(prev => ({
          ...prev,
          preDeparture: {
              ...prev.preDeparture,
              transfers: prev.preDeparture.transfers.map(t => t.id === id ? { ...t, [field]: value } : t)
          }
      }));
  };

  const addTransfer = () => {
      setAppState(prev => ({
          ...prev,
          preDeparture: {
              ...prev.preDeparture,
              transfers: [
                  ...prev.preDeparture.transfers,
                  { id: Date.now().toString(), label: 'New Transfer', method: '', cost: 0, currency: 'TWD' }
              ]
          }
      }));
  };

  const removeTransfer = (id: string) => {
      setAppState(prev => ({
          ...prev,
          preDeparture: {
              ...prev.preDeparture,
              transfers: prev.preDeparture.transfers.filter(t => t.id !== id)
          }
      }));
  };

  const toggleCurrency = (val: 'TWD' | 'MYR') => {
      setAppState(prev => ({ ...prev, displayCurrency: val }));
  }

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      {/* Hero / Countdown */}
      <div className="bg-brand-dark p-8 rounded-2xl shadow-float text-center text-white relative overflow-hidden">
        <div className="relative z-10">
            <h2 className="text-brand-primary font-sans font-bold text-xs uppercase tracking-widest mb-3">Adventure Begins In</h2>
            <h1 className="text-6xl font-display font-bold mb-3 tracking-tight text-white">
            {daysLeft > 0 ? `${daysLeft}` : "0"}
            </h1>
            <p className="text-brand-secondary/80 font-medium text-sm">Days until departure</p>
        </div>
        {/* Subtle abstract background */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-primary rounded-full blur-[100px] opacity-20"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-primary rounded-full blur-[100px] opacity-10"></div>
      </div>

      {/* Pre-Departure Logistics */}
      <div className="bg-white p-6 rounded-2xl shadow-clean border border-brand-border">
          <h3 className="text-lg font-display font-bold text-brand-dark mb-5 flex items-center gap-2">
            <span className="p-2 bg-brand-light text-brand-dark rounded-lg"><IconFlight className="w-4 h-4"/></span>
            Flights
          </h3>
          
          <div className="space-y-4">
              {/* Flights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="bg-brand-light/50 p-4 rounded-xl border border-brand-border">
                    <label className="text-[10px] text-brand-secondary font-bold uppercase tracking-wider mb-2 block">Departure</label>
                    <input 
                        className="w-full bg-white border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-dark mb-2 text-base focus:ring-1 focus:ring-brand-primary focus:outline-none"
                        placeholder="TR898 - 10:30 AM"
                        value={appState.preDeparture.flightInfo}
                        onChange={(e) => updatePreDeparture('flightInfo', e.target.value)}
                    />
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-secondary w-6">RM</span>
                        <input 
                            type="number" 
                            className="w-full bg-white border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-dark text-base focus:ring-1 focus:ring-brand-primary focus:outline-none"
                            placeholder="0"
                            value={appState.preDeparture.flightCostMYR || ''}
                            onChange={(e) => updatePreDeparture('flightCostMYR', parseFloat(e.target.value))}
                        />
                    </div>
                 </div>
                 <div className="bg-brand-light/50 p-4 rounded-xl border border-brand-border">
                    <label className="text-[10px] text-brand-secondary font-bold uppercase tracking-wider mb-2 block">Return</label>
                    <input 
                        className="w-full bg-white border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-dark mb-2 text-base focus:ring-1 focus:ring-brand-primary focus:outline-none"
                        placeholder="TR899 - 3:00 PM"
                        value={appState.preDeparture.returnFlightInfo}
                        onChange={(e) => updatePreDeparture('returnFlightInfo', e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-secondary w-6">RM</span>
                        <input 
                            type="number" 
                            className="w-full bg-white border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-dark text-base focus:ring-1 focus:ring-brand-primary focus:outline-none"
                            placeholder="0"
                            value={appState.preDeparture.returnFlightCostMYR || ''}
                            onChange={(e) => updatePreDeparture('returnFlightCostMYR', parseFloat(e.target.value))}
                        />
                    </div>
                 </div>
              </div>
          </div>

          <div className="mt-8">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-display font-bold text-brand-dark flex items-center gap-2">
                    <span className="p-2 bg-brand-light text-brand-dark rounded-lg"><IconCar className="w-4 h-4"/></span>
                    Logistics / Transfers
                  </h3>
                  <Button variant="ghost" onClick={addTransfer} className="text-xs px-2 py-1 h-auto"><IconPlus className="w-4 h-4"/> Add</Button>
               </div>
               
               <div className="space-y-3">
                   {appState.preDeparture.transfers.map((leg) => (
                       <div key={leg.id} className="bg-brand-light/30 p-4 rounded-xl border border-brand-border flex flex-col gap-3">
                           <div className="flex justify-between items-start gap-2">
                               <input 
                                   className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-brand-dark focus:ring-0 placeholder-brand-secondary"
                                   placeholder="Route Name (e.g. Home -> KLIA)"
                                   value={leg.label}
                                   onChange={(e) => updateTransfer(leg.id, 'label', e.target.value)}
                               />
                               <button onClick={() => removeTransfer(leg.id)} className="text-brand-secondary hover:text-red-500"><IconTrash className="w-4 h-4"/></button>
                           </div>
                           <div className="flex gap-2">
                               <div className="flex-1">
                                   <input 
                                        className="w-full bg-white border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-dark text-base focus:ring-1 focus:ring-brand-primary focus:outline-none"
                                        placeholder="Transport Method (e.g. Grab)"
                                        value={leg.method}
                                        onChange={(e) => updateTransfer(leg.id, 'method', e.target.value)}
                                   />
                               </div>
                               <div className="w-32 relative">
                                    <input 
                                        type="number" 
                                        placeholder="0"
                                        className="w-full bg-white border border-brand-border rounded-lg pl-3 pr-14 py-2 text-sm text-brand-dark text-base focus:ring-1 focus:ring-brand-primary focus:outline-none"
                                        value={leg.cost || ''}
                                        onChange={(e) => updateTransfer(leg.id, 'cost', parseFloat(e.target.value))}
                                    />
                                    <button 
                                        onClick={() => updateTransfer(leg.id, 'currency', leg.currency === 'TWD' ? 'MYR' : 'TWD')} 
                                        className="absolute right-1 top-1 bottom-1 px-2 text-[10px] font-bold rounded-md bg-brand-light text-brand-dark hover:bg-brand-border transition-colors flex items-center justify-center w-12"
                                    >
                                        {leg.currency === 'TWD' ? 'NT$' : 'RM'}
                                    </button>
                               </div>
                           </div>
                       </div>
                   ))}
               </div>
          </div>
      </div>

      {/* Budget */}
      <div className="bg-white p-6 rounded-2xl shadow-clean border border-brand-border">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-display font-bold text-brand-dark">Trip Budget</h3>
            <div className="scale-90 origin-right">
                <CurrencyToggle value={appState.displayCurrency} onChange={toggleCurrency} />
            </div>
        </div>
        
        <div className="bg-brand-light p-6 rounded-xl border border-brand-border flex flex-col items-center justify-center text-center">
             <p className="text-xs text-brand-secondary font-bold uppercase tracking-wider mb-1">Estimated Total</p>
             <p className="text-4xl font-display font-bold text-brand-dark tracking-tight">
                 {appState.displayCurrency === 'TWD' 
                    ? `NT$ ${totalBudgetTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : `RM ${(totalBudgetTWD * appState.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                 }
             </p>
        </div>
        
        <div className="mt-4 flex items-center justify-between text-sm text-brand-secondary bg-brand-light/50 px-5 py-3 rounded-xl">
            <span>Exchange Rate (1 TWD)</span>
            <div className="flex items-center gap-2">
                <span className="font-bold text-brand-dark">RM</span>
                <input 
                    type="number" 
                    step="0.001"
                    value={appState.exchangeRate} 
                    onChange={(e) => setAppState(prev => ({...prev, exchangeRate: parseFloat(e.target.value) || 0}))}
                    className="w-16 bg-white border border-brand-border px-2 py-1 rounded text-center text-brand-dark font-bold focus:outline-none focus:ring-1 focus:ring-brand-primary text-base"
                />
            </div>
        </div>
      </div>
    </div>
  );
};

// 2. Essentials Tab
const Essentials: React.FC<{
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}> = ({ appState, setAppState }) => {
  const [newShortlist, setNewShortlist] = useState('');
  const [newPacking, setNewPacking] = useState('');
  const [loadingWeather, setLoadingWeather] = useState(false);

  const hasWeatherData = !!appState.weatherCache && appState.weatherCache.length > 0;
  
  const fetchWeather = async () => {
      setLoadingWeather(true);
      // Generate the first 7 days of the trip
      const dates = [];
      const start = new Date(START_DATE);
      for(let i=0; i<7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        // Format YYYY-MM-DD
        dates.push(d.toISOString().split('T')[0]);
      }

      try {
          const result = await getWeatherAdvice(dates);
          setAppState(prev => ({ ...prev, weatherCache: result }));
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingWeather(false);
      }
  };

  useEffect(() => {
      if (!hasWeatherData) fetchWeather();
  }, []);

  const openMapSearch = (query: string) => {
    if(!query) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ' Taiwan')}`;
    window.open(url, '_blank');
  };

  const addShortlist = async () => {
    if (!newShortlist.trim()) return;
    const tempId = Date.now().toString();
    const newItem: ShortlistItem = { id: tempId, name: newShortlist, isLoading: true };
    setAppState(prev => ({ ...prev, shortlist: [newItem, ...prev.shortlist] }));
    setNewShortlist('');
    try {
        const details = await searchPlace(newItem.name);
        setAppState(prev => ({
            ...prev,
            shortlist: prev.shortlist.map(item => item.id === tempId ? { ...item, mapUrl: details.mapUrl, address: details.address, isLoading: false } : item)
        }));
    } catch (e) {
        setAppState(prev => ({ ...prev, shortlist: prev.shortlist.map(item => item.id === tempId ? { ...item, isLoading: false } : item) }));
    }
  };
  const removeShortlist = (id: string) => setAppState(prev => ({ ...prev, shortlist: prev.shortlist.filter(i => i.id !== id) }));

  const addPacking = () => {
    if (!newPacking.trim()) return;
    setAppState(prev => ({
      ...prev,
      packingList: [{ id: Date.now().toString(), name: newPacking, category: 'Misc', isPacked: false }, ...prev.packingList]
    }));
    setNewPacking('');
  };
  const togglePacked = (id: string) => setAppState(prev => ({
      ...prev,
      packingList: prev.packingList.map(item => item.id === id ? { ...item, isPacked: !item.isPacked } : item)
  }));
  const removePacking = (id: string) => setAppState(prev => ({ ...prev, packingList: prev.packingList.filter(i => i.id !== id) }));

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
        {/* Weather */}
        <div className="bg-white p-6 rounded-2xl shadow-clean border border-brand-border">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold text-brand-dark flex items-center gap-2">
                    <IconWeather className="w-5 h-5 text-brand-primary" /> Forecast (7 Days)
                </h3>
                <Button variant="ghost" onClick={fetchWeather} disabled={loadingWeather} className="text-xs h-8 px-3 rounded-lg">
                    {loadingWeather ? '...' : 'Refresh'}
                </Button>
            </div>
            {loadingWeather && !hasWeatherData ? (
                <div className="py-8 text-center text-brand-secondary">
                    <p className="text-xs font-semibold animate-pulse">Checking forecast...</p>
                </div>
            ) : (
                <div className="space-y-3">
                        {appState.weatherCache && appState.weatherCache.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {appState.weatherCache.map((day, idx) => (
                                    <div key={idx} className="bg-brand-light/50 p-4 rounded-xl border border-brand-border flex flex-col gap-1">
                                        <div className="flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-brand-secondary uppercase tracking-wider">{day.dayName}</span>
                                                <span className="text-sm font-bold text-brand-dark">{day.date}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-brand-primary bg-white px-2 py-1 rounded-md border border-brand-border shadow-sm">{day.rainChance} Rain</span>
                                        </div>
                                        <div className="mt-2">
                                            <p className="text-lg font-bold text-brand-dark">{day.temp}</p>
                                            <p className="text-sm font-medium text-brand-secondary">{day.condition}</p>
                                        </div>
                                        <p className="text-xs text-brand-secondary mt-2 border-t border-brand-border pt-2">Tip: {day.advice}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-brand-secondary italic text-sm text-center py-4">No forecast data available.</p>
                        )}
                </div>
            )}
        </div>

        {/* Wishlist */}
        <div className="bg-white p-6 rounded-2xl shadow-clean border border-brand-border">
            <h3 className="text-lg font-display font-bold text-brand-dark mb-4">Places to Visit</h3>
            <div className="flex gap-2 mb-6">
                <div className="flex-1 relative">
                    <Input placeholder="Place name..." value={newShortlist} onChange={(e) => setNewShortlist(e.target.value)} onKeyDown={e => e.key === 'Enter' && addShortlist()} className="pr-12 text-base" />
                    <button onClick={() => openMapSearch(newShortlist)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-brand-secondary hover:text-brand-primary transition-colors bg-white rounded-lg hover:bg-brand-light"><IconSearch className="w-4 h-4" /></button>
                </div>
                <Button onClick={addShortlist} className="rounded-xl aspect-square p-0 w-[50px] flex-shrink-0 bg-brand-dark"><IconPlus className="w-5 h-5" /></Button>
            </div>
            <div className="space-y-3">
                {appState.shortlist.map(item => (
                <div key={item.id} className="bg-brand-light/30 p-4 rounded-xl flex flex-col gap-2 relative transition-all border border-brand-border hover:border-brand-primary/30">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                            <span className="font-semibold text-brand-dark text-base">{item.name}</span>
                            {item.address && <p className="text-xs text-brand-secondary mt-1 leading-relaxed">{item.address}</p>}
                        </div>
                        <button onClick={() => removeShortlist(item.id)} className="text-brand-secondary hover:text-red-500 p-1"><IconTrash className="w-4 h-4" /></button>
                    </div>
                    {item.isLoading ? <div className="text-xs text-brand-secondary animate-pulse font-semibold mt-1">Finding details...</div> : (
                        <a href={item.mapUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-brand-primary text-xs font-semibold hover:underline w-fit mt-1 bg-white px-3 py-1.5 rounded-lg border border-brand-border shadow-sm"><IconMap className="w-3 h-3" /> Check Map</a>
                    )}
                </div>
                ))}
            </div>
        </div>

        {/* Packing */}
        <div className="bg-white p-6 rounded-2xl shadow-clean border border-brand-border">
            <h3 className="text-lg font-display font-bold text-brand-dark mb-4">Packing List</h3>
            <div className="flex gap-2 mb-4">
                <Input placeholder="Add item..." value={newPacking} onChange={(e) => setNewPacking(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPacking()}/>
                <Button onClick={addPacking} className="rounded-xl aspect-square p-0 w-[50px] flex-shrink-0 bg-brand-primary"><IconPlus className="w-5 h-5" /></Button>
            </div>
            <ul className="space-y-2">
                {appState.packingList.map(item => (
                <li key={item.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border border-transparent ${item.isPacked ? 'opacity-50 bg-brand-light' : 'bg-white hover:border-brand-border shadow-sm border-brand-border/50'}`} onClick={() => togglePacked(item.id)}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${item.isPacked ? 'bg-brand-success border-brand-success' : 'border-brand-border bg-white'}`}>
                    {item.isPacked && <IconCheck className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`flex-1 font-semibold ${item.isPacked ? 'line-through text-brand-secondary' : 'text-brand-dark'}`}>{item.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); removePacking(item.id); }} className="text-brand-secondary hover:text-red-500"><IconTrash className="w-4 h-4" /></button>
                </li>
                ))}
            </ul>
        </div>
    </div>
  );
};

// 3. Itinerary Section
const Itinerary: React.FC<{
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}> = ({ appState, setAppState }) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dayRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const categoryStyles: Record<ActivityCategory, string> = {
      [ActivityCategory.Sightseeing]: "bg-emerald-50 border-emerald-100 text-emerald-900",
      [ActivityCategory.Food]: "bg-orange-50 border-orange-100 text-orange-900",
      [ActivityCategory.Transport]: "bg-blue-50 border-blue-100 text-blue-900",
      [ActivityCategory.Other]: "bg-purple-50 border-purple-100 text-purple-900",
  };
  const categoryChipStyles: Record<ActivityCategory, string> = {
      [ActivityCategory.Sightseeing]: "bg-emerald-600 text-white",
      [ActivityCategory.Food]: "bg-orange-500 text-white",
      [ActivityCategory.Transport]: "bg-blue-600 text-white",
      [ActivityCategory.Other]: "bg-purple-600 text-white",
  };

  const defaultForm: Partial<Activity> = {
      time: '09:00',
      category: ActivityCategory.Sightseeing,
      transportType: undefined,
      mealType: undefined,
      transportCostTWD: 0,
      mealCostTWD: 0,
      ticketCostTWD: 0,
      arrivalCostTWD: 0,
      arrivalTransport: undefined,
      notes: '',
      locationName: ''
  };

  const [formData, setFormData] = useState<Partial<Activity>>(defaultForm);
  const [formCost, setFormCost] = useState<string>('');
  const [arrivalCost, setArrivalCost] = useState<string>('');
  const [exportMode, setExportMode] = useState<'day' | 'all' | null>(null);

  const selectedDay = appState.itinerary[selectedDayIndex];

  useEffect(() => {
    dayRefs.current[selectedDayIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedDayIndex]);

  const updateDay = (updatedDay: DayPlan) => {
    setAppState(prev => ({ ...prev, itinerary: prev.itinerary.map((d, i) => i === selectedDayIndex ? updatedDay : d) }));
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateVal = e.target.value;
    if (!dateVal) return;
    if (dateVal < START_DATE || dateVal > END_DATE) {
        alert(`Please select a date between ${START_DATE} and ${END_DATE}.`);
        return;
    }
    const existingIndex = appState.itinerary.findIndex(d => d.date === dateVal);
    if (existingIndex !== -1) {
        setSelectedDayIndex(existingIndex);
    } else {
        const dayDiff = Math.floor((new Date(dateVal).getTime() - new Date(START_DATE).getTime()) / (1000 * 60 * 60 * 24));
        const newDay: DayPlan = { date: dateVal, dayNumber: dayDiff + 1, activities: [], dailySummary: '' };
        setAppState(prev => {
            const updated = [...prev.itinerary, newDay].sort((a, b) => a.date.localeCompare(b.date));
            return { ...prev, itinerary: updated };
        });
        const newIndex = appState.itinerary.filter(d => d.date < dateVal).length;
        setSelectedDayIndex(newIndex);
    }
  };

  const openEdit = (act: Activity) => {
      setEditingId(act.id);
      setFormData(act);
      // Determine which cost to show in main input
      let mainCost = 0;
      if (act.category === ActivityCategory.Transport) mainCost = act.transportCostTWD || 0;
      else if (act.category === ActivityCategory.Food) mainCost = act.mealCostTWD || 0;
      else mainCost = act.ticketCostTWD || 0;
      
      setFormCost(mainCost > 0 ? mainCost.toString() : '');
      setArrivalCost(act.arrivalCostTWD && act.arrivalCostTWD > 0 ? act.arrivalCostTWD.toString() : '');
      setIsAdding(true);
  };

  const openNew = () => {
      setEditingId(null);
      setFormData(defaultForm);
      setFormCost('');
      setArrivalCost('');
      setIsAdding(true);
  };

  const handleSaveActivity = () => {
    if (!formData.locationName) return; 
    let finalData = { ...formData };
    if (!finalData.googleMapsUrl) {
         finalData.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(finalData.locationName + ' Taiwan')}`;
    }
    const costValue = parseFloat(formCost) || 0;
    const arrivalCostValue = parseFloat(arrivalCost) || 0;

    finalData.transportCostTWD = 0;
    finalData.mealCostTWD = 0;
    finalData.ticketCostTWD = 0;
    finalData.arrivalCostTWD = 0;

    if (finalData.category === ActivityCategory.Transport) finalData.transportCostTWD = costValue;
    else if (finalData.category === ActivityCategory.Food) finalData.mealCostTWD = costValue;
    else {
        finalData.ticketCostTWD = costValue;
        if (finalData.category === ActivityCategory.Sightseeing) finalData.arrivalCostTWD = arrivalCostValue;
    }

    if (editingId) {
        // Update existing
        const updatedActivities = selectedDay.activities.map(a => a.id === editingId ? { ...finalData, id: editingId } as Activity : a).sort((a, b) => a.time.localeCompare(b.time));
        updateDay({ ...selectedDay, activities: updatedActivities });
    } else {
        // Create new
        const newActivity = { ...finalData, id: Date.now().toString(), time: finalData.time || '09:00' } as Activity;
        updateDay({ ...selectedDay, activities: [...selectedDay.activities, newActivity].sort((a, b) => a.time.localeCompare(b.time)) });
    }
    setIsAdding(false);
  };

  const handleExport = (mode: 'day' | 'all') => {
      setExportMode(null);
      
      const content = `
        <html>
            <head>
                <title>Taipei Journey</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #0f172a; }
                    h1, h2 { color: #0f172a; }
                    .day { margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; page-break-inside: avoid; }
                    .date { font-size: 1.2em; font-weight: bold; color: #0ea5e9; }
                    .activity { margin: 10px 0; padding-left: 15px; border-left: 3px solid #e2e8f0; }
                    .time { font-weight: bold; margin-right: 10px; }
                    .meta { font-size: 0.9em; color: #64748b; font-style: italic; }
                    .note { font-size: 0.9em; margin-top: 4px; color: #334155; }
                </style>
            </head>
            <body>
                <h1>Taipei Journey Itinerary</h1>
                ${(mode === 'day' ? [selectedDay] : appState.itinerary)
                    .filter(d => d.activities.length > 0)
                    .map(d => `
                        <div class="day">
                            <div class="date">${new Date(d.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                            ${d.activities.map(a => `
                                <div class="activity">
                                    <div><span class="time">${a.time}</span> <b>${a.locationName}</b> <span style="font-size:0.8em; border:1px solid #ccc; padding:1px 4px; border-radius:4px;">${a.category}</span></div>
                                    <div class="meta">
                                        ${a.arrivalTransport ? `Via ${a.arrivalTransport}` : ''} 
                                        ${a.mealType ? `• ${a.mealType}` : ''}
                                        ${a.transportType ? `• ${a.transportType}` : ''}
                                    </div>
                                    ${a.notes ? `<div class="note">"${a.notes}"</div>` : ''}
                                </div>
                            `).join('')}
                            ${d.dailySummary ? `<p><i>Note: ${d.dailySummary}</i></p>` : ''}
                        </div>
                    `).join('')}
                <script>window.print();</script>
            </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
          printWindow.document.write(content);
          printWindow.document.close();
      }
  };

  const dayCostTWD = selectedDay.activities.reduce((sum, act) => sum + (act.transportCostTWD || 0) + (act.mealCostTWD || 0) + (act.ticketCostTWD || 0) + (act.arrivalCostTWD || 0), 0);

  return (
    <div className="pb-24 h-full flex flex-col">
      {/* Day Selector */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-4 px-4 sticky top-0 bg-brand-bg/95 backdrop-blur z-10 pt-safe">
        <label className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl transition-all border bg-white text-brand-secondary border-brand-border hover:bg-brand-light cursor-pointer relative shadow-sm">
            <IconCalendar className="w-5 h-5 mb-1 text-brand-dark" />
            <span className="text-[8px] font-bold uppercase tracking-wider text-brand-secondary">Jump</span>
            <input type="date" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={handleDateSelect} min={START_DATE} max={END_DATE} />
        </label>
        {appState.itinerary.map((day, idx) => {
            const dateObj = new Date(day.date);
            const isSelected = idx === selectedDayIndex;
            return (
                <button 
                    key={day.date}
                    ref={el => { dayRefs.current[idx] = el }}
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl transition-all border ${
                        isSelected ? 'bg-brand-dark text-white border-brand-dark shadow-md scale-105' : 'bg-white text-brand-secondary border-brand-border hover:border-brand-primary/30'
                    }`}
                >
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Day {day.dayNumber}</span>
                    <span className="text-lg font-bold leading-none mt-1">{dateObj.getDate()}</span>
                </button>
            )
        })}
      </div>

      {/* Header Info */}
      <div className="px-6 mb-6 flex justify-between items-end">
         <div>
             <h2 className="text-2xl font-display font-bold text-brand-dark tracking-tight">
                {new Date(selectedDay.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
             </h2>
             <p className="text-brand-secondary text-sm mt-1 font-medium">{selectedDay.activities.length} activities</p>
         </div>
         <div className="flex flex-col items-end gap-2">
             <div className="relative">
                <Button variant="secondary" className="px-3 py-1.5 text-xs h-8 rounded-lg" onClick={() => setExportMode('day')}>
                    <IconShare className="w-4 h-4" /> Export
                </Button>
                {exportMode && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-brand-border p-2 z-50 w-36 flex flex-col gap-1">
                        <button onClick={() => handleExport('day')} className="text-left px-3 py-2 hover:bg-brand-light rounded-lg text-xs font-semibold text-brand-dark">Current Day</button>
                        <button onClick={() => handleExport('all')} className="text-left px-3 py-2 hover:bg-brand-light rounded-lg text-xs font-semibold text-brand-dark">Full Journey</button>
                        <div className="h-px bg-brand-border my-1"></div>
                        <button onClick={() => setExportMode(null)} className="text-left px-3 py-2 hover:bg-red-50 rounded-lg text-xs font-semibold text-red-500">Cancel</button>
                    </div>
                )}
             </div>
             <p className="text-xl font-bold text-brand-dark leading-none">
                 NT$ {dayCostTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
             </p>
         </div>
      </div>

      {/* Activities List */}
      <div className="space-y-4 px-4 flex-1">
          {selectedDay.activities.length === 0 && (
              <div className="text-center py-12 text-brand-secondary/60 bg-white rounded-2xl border-2 border-dashed border-brand-border/50">
                  <p className="font-medium">No activities planned.</p>
                  <Button variant="ghost" className="mx-auto mt-2 text-brand-primary hover:bg-blue-50" onClick={openNew}>Start Planning</Button>
              </div>
          )}
          
          {selectedDay.activities.map((act) => {
              const themeClass = categoryStyles[act.category] || "bg-white border-brand-border text-brand-dark";
              const costTWD = (act.transportCostTWD || 0) + (act.mealCostTWD || 0) + (act.ticketCostTWD || 0) + (act.arrivalCostTWD || 0);

              return (
                <div key={act.id} onClick={() => openEdit(act)} className={`rounded-2xl p-5 shadow-sm border flex gap-4 relative group cursor-pointer transition-transform active:scale-[0.99] ${themeClass}`}>
                    <div className="flex flex-col items-center gap-1 min-w-[50px] shrink-0">
                        <span className="font-bold opacity-70 text-sm">{act.time}</span>
                        <div className="h-full w-px bg-current opacity-20 mt-1"></div>
                    </div>
                    <div className="flex-1 pb-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/50 mb-2 border border-black/5">
                                {act.category}
                            </span>
                            <IconPencil className="w-4 h-4 opacity-30" />
                        </div>
                        <h4 className="font-bold text-lg leading-tight truncate">{act.locationName}</h4>
                        <div className="flex flex-wrap gap-3 mt-3 text-xs font-semibold opacity-80">
                            {act.category === ActivityCategory.Sightseeing && act.arrivalTransport && <span className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded text-current">📍 Reach via {act.arrivalTransport}</span>}
                            {act.transportType && <span className="flex items-center gap-1">🚌 {act.transportType}</span>}
                            {act.mealType && <span className="flex items-center gap-1">🍴 {act.mealType}</span>}
                            {costTWD > 0 && <span className="flex items-center gap-1">💰 NT${costTWD}</span>}
                        </div>
                        {act.notes && <p className="mt-3 text-sm italic opacity-70 border-l-2 border-current pl-3 py-1 line-clamp-2">"{act.notes}"</p>}
                    </div>
                </div>
              );
          })}

            {/* Daily Reflection */}
            <div className="pt-8 pb-4">
                <div className="bg-white rounded-2xl p-5 shadow-clean border border-brand-border relative overflow-hidden">
                    <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wide mb-3 flex items-center gap-2 relative z-10">
                        Daily Notes
                    </h3>
                    <textarea 
                        className="w-full bg-brand-light rounded-xl p-4 text-sm text-brand-dark placeholder-brand-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/10 resize-none transition-colors border border-transparent focus:border-brand-primary/20 relative z-10 text-base"
                        placeholder="What did you discover today?"
                        rows={3}
                        value={selectedDay.dailySummary || ''}
                        onChange={(e) => updateDay({ ...selectedDay, dailySummary: e.target.value })}
                    />
                </div>
            </div>
          
          <div className="sticky bottom-24 pb-safe flex justify-center mt-6 pointer-events-none">
              <button onClick={openNew} className="pointer-events-auto bg-brand-primary text-white rounded-full px-6 py-3 shadow-float hover:scale-105 active:scale-95 transition-all font-semibold flex items-center gap-2 text-base border-4 border-brand-bg">
                  <IconPlus className="w-5 h-5" /> New Memory
              </button>
          </div>
      </div>

      {/* New Memory Modal */}
      {isAdding && (
          <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto pb-safe">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-display font-bold text-brand-dark">{editingId ? 'Edit Activity' : 'New Activity'}</h3>
                      <button onClick={() => setIsAdding(false)} className="p-2 bg-brand-light rounded-full hover:bg-brand-secondary/10 text-brand-secondary"><IconPlus className="w-6 h-6 rotate-45"/></button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                          <div className="w-full sm:w-1/3">
                              <label className="text-xs font-bold text-brand-secondary uppercase tracking-wide mb-2 block">Time</label>
                              <Input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="text-center font-semibold" />
                          </div>
                          <div className="w-full sm:w-2/3">
                              <label className="text-xs font-bold text-brand-secondary uppercase tracking-wide mb-2 block">Cost (TWD)</label>
                              <Input type="number" placeholder="0" value={formCost} onChange={e => setFormCost(e.target.value)} />
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-brand-secondary uppercase tracking-wide mb-3 block">Category</label>
                          <div className="flex gap-2 w-full overflow-x-auto no-scrollbar pb-1">
                              {Object.values(ActivityCategory).map(cat => (
                                  <Chip key={cat} label={cat} selected={formData.category === cat} onClick={() => setFormData(prev => ({ ...prev, category: cat, mealType: undefined, transportType: undefined }))} colorClass={categoryChipStyles[cat]} />
                              ))}
                          </div>
                      </div>

                      {formData.category === ActivityCategory.Sightseeing && (
                          <div className="bg-brand-light/50 p-5 rounded-xl border border-brand-border animate-fade-in">
                               <label className="text-xs font-bold text-brand-dark uppercase tracking-wide mb-3 block flex items-center gap-2">
                                   <IconMap className="w-4 h-4 text-emerald-600" />
                                   How to get there?
                               </label>
                               <div className="space-y-3">
                                   <div className="flex flex-wrap gap-2">
                                        {Object.values(TransportType).map(t => (
                                            <Chip key={t} label={t} selected={formData.arrivalTransport === t} onClick={() => setFormData(prev => ({...prev, arrivalTransport: t}))} colorClass="bg-emerald-600 text-white" />
                                        ))}
                                   </div>
                                   <div className="flex items-center gap-3 pt-2">
                                        <span className="text-xs font-bold text-brand-secondary">Transport Cost (TWD)</span>
                                        <input 
                                            type="number" 
                                            placeholder="0" 
                                            value={arrivalCost}
                                            onChange={(e) => setArrivalCost(e.target.value)}
                                            className="w-24 bg-white border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-dark focus:outline-none focus:ring-1 focus:ring-emerald-500 text-base"
                                        />
                                   </div>
                               </div>
                          </div>
                      )}

                      {formData.category === ActivityCategory.Transport && (
                          <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 animate-fade-in">
                              <label className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 block">Transport Mode</label>
                              <div className="flex flex-wrap gap-2">
                                  {Object.values(TransportType).map(t => (
                                      <Chip key={t} label={t} selected={formData.transportType === t} onClick={() => setFormData(prev => ({...prev, transportType: t}))} colorClass="bg-blue-600 text-white border-blue-600" />
                                  ))}
                              </div>
                          </div>
                      )}

                      {formData.category === ActivityCategory.Food && (
                           <div className="bg-orange-50 p-5 rounded-xl border border-orange-100 animate-fade-in">
                               <label className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-3 block">Meal Type</label>
                               <div className="flex flex-wrap gap-2">
                                   {Object.values(MealType).map(m => (
                                       <Chip key={m} label={m} selected={formData.mealType === m} onClick={() => setFormData(prev => ({...prev, mealType: m}))} colorClass="bg-orange-500 text-white border-orange-500" />
                                   ))}
                               </div>
                           </div>
                       )}

                      <div>
                          <label className="text-xs font-bold text-brand-secondary uppercase tracking-wide mb-2 block">Location</label>
                          <div className="relative flex gap-2">
                            <div className="relative flex-1">
                                <Input placeholder="Where to?" value={formData.locationName} onChange={e => setFormData({...formData, locationName: e.target.value})} className="pl-11" />
                                <div className="absolute left-4 top-3.5 text-brand-secondary/50"><IconMap className="w-5 h-5" /></div>
                            </div>
                            <button 
                                onClick={() => { if(formData.locationName) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.locationName + ' Taiwan')}`, '_blank'); }}
                                disabled={!formData.locationName}
                                className="bg-white hover:bg-brand-light text-brand-secondary hover:text-brand-primary px-4 rounded-xl transition-colors border border-brand-border disabled:opacity-50 shadow-sm"
                            >
                                <IconSearch className="w-5 h-5" />
                            </button>
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-brand-secondary uppercase tracking-wide mb-2 block">Notes</label>
                          <textarea className="w-full bg-white border border-brand-border text-brand-dark px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all resize-none font-medium placeholder-brand-secondary/50 text-base" rows={2} placeholder="Any specific details?" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
                      </div>

                      <div className="pt-4 flex gap-3">
                          {editingId && (
                               <Button onClick={() => { updateDay({ ...selectedDay, activities: selectedDay.activities.filter(a => a.id !== editingId) }); setIsAdding(false); }} variant="danger" className="w-16 rounded-xl"><IconTrash className="w-5 h-5" /></Button>
                          )}
                          <Button onClick={handleSaveActivity} disabled={!formData.locationName} className="flex-1 py-3.5 text-base bg-brand-primary hover:bg-sky-600 shadow-float rounded-xl">Save Activity</Button>
                      </div>
                      <p className="text-center text-[10px] text-brand-secondary/50 mt-1 font-bold uppercase tracking-widest">Only Location Name is required</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

const App = () => {
    const [activeTab, setActiveTab] = useState<'voyage' | 'essentials' | 'itinerary'>('voyage');
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    
    // Initialize state from local storage or defaults
    const [appState, setAppState] = useState<AppState>(() => {
      try {
          const saved = localStorage.getItem('trip_state_v1');
          if (saved) {
              const parsed = JSON.parse(saved);
              // Simple migration/check to ensure itinerary exists
              if (!parsed.itinerary || parsed.itinerary.length === 0) {
                   parsed.itinerary = generateInitialItinerary();
              }
              return parsed;
          }
      } catch (e) {
          console.error("Failed to load state", e);
      }
      
      return {
          shortlist: [],
          packingList: [],
          itinerary: generateInitialItinerary(),
          exchangeRate: DEFAULT_EXCHANGE_RATE,
          displayCurrency: 'TWD',
          budgetLimitMYR: 5000,
          weatherCache: [],
          preDeparture: {
              flightInfo: '',
              flightCostMYR: 0,
              returnFlightInfo: '',
              returnFlightCostMYR: 0,
              transfers: [],
              notes: ''
          }
      };
    });
  
    // Save to local storage
    useEffect(() => {
      localStorage.setItem('trip_state_v1', JSON.stringify(appState));
    }, [appState]);

    // Offline listener
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        }
    }, []);
  
    return (
      <div className="bg-brand-bg min-h-screen text-brand-dark font-sans selection:bg-brand-primary/30 pb-20 sm:pb-0">
          <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative flex flex-col overflow-hidden border-x border-brand-border">
              {isOffline && <div className="bg-brand-secondary text-white text-[10px] font-bold uppercase tracking-widest text-center py-1">Offline Mode • Changes Saved Locally</div>}
              
              {/* Render Active Section */}
              <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                  {activeTab === 'voyage' && <VoyageDashboard appState={appState} setAppState={setAppState} />}
                  {activeTab === 'essentials' && <Essentials appState={appState} setAppState={setAppState} />}
                  {activeTab === 'itinerary' && <Itinerary appState={appState} setAppState={setAppState} />}
              </main>
  
              {/* Bottom Navigation */}
              <nav className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-brand-border px-6 py-4 flex justify-between items-center z-50 pb-safe">
                  <button 
                      onClick={() => setActiveTab('voyage')} 
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'voyage' ? 'text-brand-dark scale-105' : 'text-brand-secondary hover:text-brand-dark'}`}
                  >
                      <IconFlight className={`w-6 h-6 ${activeTab === 'voyage' ? 'fill-current' : ''}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Voyage</span>
                  </button>
                  <button 
                      onClick={() => setActiveTab('itinerary')} 
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'itinerary' ? 'text-brand-dark scale-105' : 'text-brand-secondary hover:text-brand-dark'}`}
                  >
                      <IconList className={`w-6 h-6 ${activeTab === 'itinerary' ? 'fill-current' : ''}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Plan</span>
                  </button>
                  <button 
                      onClick={() => setActiveTab('essentials')} 
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'essentials' ? 'text-brand-dark scale-105' : 'text-brand-secondary hover:text-brand-dark'}`}
                  >
                      <IconCheck className={`w-6 h-6 ${activeTab === 'essentials' ? 'fill-current' : ''}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Items</span>
                  </button>
              </nav>
          </div>
      </div>
    );
  };
  
  export default App;
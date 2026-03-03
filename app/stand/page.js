"use client";
import { useState, useEffect, useMemo } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { 
  Clock, Monitor, Zap, User, CheckCircle2, XCircle, CircleDashed, 
  ChevronRight, Filter, MinusCircle, Search, RefreshCw, BarChart2 
} from 'lucide-react';

// Подключаемся к базе
const supabase = createClient(
  "https://ykmvlughekjnqgdyddmp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbXZsdWdoZWtqbnFnZHlkZG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzQ3OTAsImV4cCI6MjA4NTE1MDc5MH0.ZaPeruXSJ6EQJ21nk4VPdvzQFMxoLUSxewQVK4EOE8Y"
);

const WAREHOUSE_NAMES = {
  "SKLAD_CENTRAL": "Центральный склад",
  "SKLAD_ZAP": "Запчасти",
  "SKLAD_GSM": "ГСМ / Семена",
  "SKLAD_STOL": "Столовая",
  "SKLAD_MTF": "МТФ",
  "SKLAD_ZNKI": "ЗНКИ",
  "SKLAD_MEHTOK": "Мехток"
};

// === 1. ГЕНЕРАТОР ЦЕПОЧКИ ===
const generateSteps = (r) => {
  let s = { 
    dir: 'wait', skl: 'wait', com: 'wait', fdir: 'wait', 
    law1: 'wait', fin1: 'wait', law2: 'wait', 
    acc1: 'wait', fin2: 'wait', acc2: 'wait' 
  };

  if (r.step_director === 1) s.dir = 'done';
  else if (r.step_director === 0) { s.dir = 'reject'; return s; }
  else { s.dir = 'pending'; return s; }

  if (r.request_type === 'service') {
    s.skl = 'skip';
  } else {
    if (r.step_sklad === 1) { 
        s.skl = 'done'; 
        return { ...s, com:'skip', fdir:'skip', law1:'skip', fin1:'skip', law2:'skip', acc1:'skip', fin2:'skip', acc2:'skip' }; 
    }
    else if (r.step_sklad === 0 || r.step_sklad === 2) { s.skl = 'buy'; }
    else if (r.step_komer != null) { s.skl = 'skip'; } 
    else { s.skl = 'pending'; return s; }
  }

  if (r.step_komer === 1) s.com = 'done';
  else if (r.step_komer === 0) { s.com = 'reject'; return s; }
  else { s.com = 'pending'; return s; }

  if (r.step_findir === 1) s.fdir = 'done';
  else if (r.step_findir === 0) { s.fdir = 'reject'; return s; }
  else { s.fdir = 'pending'; return s; }

  if (r.step_lawyer_draft === 1) s.law1 = 'done';
  else if (r.step_lawyer_draft === 0) { s.law1 = 'reject'; return s; }
  else { s.law1 = 'pending'; return s; }

  if (r.step_finance_review === 1) s.fin1 = 'done';
  else if (r.step_finance_review === 0) { s.fin1 = 'reject'; return s; }
  else { s.fin1 = 'pending'; return s; }

  if (r.step_lawyer_final === 1) s.law2 = 'done';
  else if (r.step_lawyer_final === 0) { s.law2 = 'reject'; return s; }
  else { s.law2 = 'pending'; return s; }

  if (r.step_accountant_req === 1) s.acc1 = 'done';
  else if (r.step_accountant_req === 0) { s.acc1 = 'reject'; return s; }
  else { s.acc1 = 'pending'; return s; }

  if (r.step_finance_pay === 1) s.fin2 = 'done';
  else if (r.step_finance_pay === 0) { s.fin2 = 'reject'; return s; }
  else { s.fin2 = 'pending'; return s; }

  if (r.step_accountant_done === 1) s.acc2 = 'done';
  else if (r.step_accountant_done === 0) { s.acc2 = 'reject'; return s; }
  else { s.acc2 = 'pending'; return s; }

  return s;
};

const isRequestRejected = (req) => {
    return req.status?.toUpperCase().includes('ОТК') || 
           req.status?.toUpperCase().includes('ОТМЕН') || 
           [req.step_director, req.step_komer, req.step_findir, req.step_lawyer_draft, req.step_finance_review, req.step_lawyer_final, req.step_accountant_req, req.step_finance_pay, req.step_accountant_done].includes(0);
};

// === 2. ТЕКСТОВЫЙ СТАТУС ===
const getCurrentStatus = (req) => {
    if (req.step_director === 0) return { text: '❌ ОТКАЗ (Директор)', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.step_komer === 0) return { text: '❌ ОТКАЗ (Ком. Директор)', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.step_findir === 0) return { text: '❌ ОТКАЗ (Фин. Директор)', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.step_lawyer_draft === 0) return { text: '❌ ОТКАЗ (Юрист - Проект)', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.step_finance_review === 0) return { text: '❌ ОТКАЗ (Финансист)', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.step_lawyer_final === 0) return { text: '❌ ОТКАЗ (Юрист - Скан)', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.step_accountant_req === 0) return { text: '❌ ОТКАЗ (Бухгалтер)', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.step_finance_pay === 0) return { text: '❌ ОТКАЗ (Финансист - Оплата)', color: 'text-red-500 border-red-500/30 bg-red-500/10' };

    if (req.status?.toUpperCase().includes('ОТМЕН')) return { text: '🚫 ОТМЕНЕНО ИНИЦИАТОРОМ', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.status?.toUpperCase().includes('ОТК')) return { text: '❌ ОТКАЗ', color: 'text-red-500 border-red-500/30 bg-red-500/10' };
    if (req.step_accountant_done === 1 || req.status?.toUpperCase() === 'ОПЛАЧЕНО') return { text: '✅ ОПЛАЧЕНО', color: 'text-green-500 border-green-500/30 bg-green-500/10' };
    
    if (req.step_director !== 1) return { text: '👔 Директор', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' };
    
    if (req.request_type !== 'service') {
        if (req.step_sklad === 1) return { text: '✅ ВЫДАНО СО СКЛАДА', color: 'text-green-500 border-green-500/30 bg-green-500/10' }; 
        if (req.step_sklad == null && req.step_komer == null) {
            const wName = WAREHOUSE_NAMES[req.target_warehouse_code] || 'Склад';
            return { text: `📦 ${wName}`, color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' };
        }
    }
    
    if (req.step_komer !== 1) return { text: '📝 Ком. Директор', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' };
    if (req.step_findir !== 1) return { text: '🏦 Фин. Директор', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' };
    if (req.step_lawyer_draft !== 1) return { text: '⚖️ Юрист (Проект)', color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' };
    if (req.step_finance_review !== 1) return { text: '💰 Финансист (Согласование)', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' };
    if (req.step_lawyer_final !== 1) return { text: '✍️ Юрист (Скан)', color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' };
    if (req.step_accountant_req !== 1) return { text: '🧮 Бухг. (Запрос счета в 1С)', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' };
    if (req.step_finance_pay !== 1) return { text: '💎 Финансист (Апрув оплаты)', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' };
    
    return { text: '💸 Бухгалтер (Ждет оплаты)', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' };
};

// === 3. КОМПОНЕНТЫ ===
const StepIndicator = ({ status, label }) => {
  let icon, color, bg;
  switch (status) {
    case 'done': case 'buy': icon = <CheckCircle2 size={16} />; color = 'text-green-500'; bg = 'bg-green-500/10 border-green-500/20'; break;
    case 'pending': icon = <Clock size={16} className="animate-pulse" />; color = 'text-blue-400'; bg = 'bg-blue-500/10 border-blue-500/30'; break;
    case 'reject': icon = <XCircle size={16} />; color = 'text-red-500'; bg = 'bg-red-500/10 border-red-500/20'; break;
    case 'skip': icon = <MinusCircle size={16} />; color = 'text-gray-600'; bg = 'bg-transparent border-transparent'; break;
    default: icon = <CircleDashed size={16} />; color = 'text-gray-700'; bg = 'bg-transparent border-transparent'; break;
  }
  return (
    <div className={`flex flex-col items-center justify-center p-1.5 rounded border ${bg} ${color} min-w-[3rem] md:w-16`} title={label}>
      {icon}
      <span className="text-[9px] font-black uppercase mt-1 hidden md:block tracking-tighter">{label}</span>
    </div>
  );
};

const WorkflowTrack = ({ steps }) => (
  <div className="flex items-center gap-1 md:gap-1.5 w-full overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
    <StepIndicator status={steps.dir} label="Дир" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.skl} label="Склад" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.com} label="Ком" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.fdir} label="Фин.Д" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.law1} label="Юр(Пр)" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.fin1} label="Фин(Сг)" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.law2} label="Юр(Ск)" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.acc1} label="Бух(1С)" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.fin2} label="Фин(Оп)" /> <ChevronRight size={14} className="text-gray-700 flex-shrink-0"/>
    <StepIndicator status={steps.acc2} label="Оплата" />
  </div>
);

export default function StandPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDept, setSelectedDept] = useState("ВСЕ");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchStandData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('requests').select('*').order('req_number', { ascending: false }).limit(1000); 
    if (!error && data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStandData();
    const channel = supabase.channel('stand-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, fetchStandData).subscribe();
    const interval = setInterval(fetchStandData, 300000); // авто-обновление каждые 5 мин
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  const departments = useMemo(() => {
    const fixedList = ["АУП", "МТФ", "ЗНКИ", "ГАРАЖ", "МЕХТОК", "СТОЛОВАЯ", "БРИГАДА", "СТРОЙ ЦЕХ", "НАУКА", "ЭНЕРГОЦЕХ", "СБ", "МТМ", "ЦЕНТРАЛЬНЫЙ СКЛАД"];
    const dbDepts = requests.map(r => r.target_department || r.target_dept_service).filter(Boolean);
    return [...new Set([...fixedList, ...dbDepts])].sort();
  }, [requests]);

  // === ВЫЧИСЛЕНИЕ "УЗКИХ ГОРЛЫШЕК" ===
  const bottleneckStats = useMemo(() => {
      const stats = { director: 0, komer: 0, findir: 0, lawyer: 0, finance: 0, accountant: 0, warehouses: {} };

      requests.forEach(req => {
          if (isRequestRejected(req)) return; // Пропускаем отмененные
          if (req.step_accountant_done === 1 || req.status?.toUpperCase() === 'ОПЛАЧЕНО') return; // Пропускаем завершенные

          if (req.step_director !== 1) { stats.director++; return; }
          
          if (req.request_type !== 'service' && req.step_sklad == null && req.step_komer == null) {
              const wCode = req.target_warehouse_code || 'Неизвестно';
              stats.warehouses[wCode] = (stats.warehouses[wCode] || 0) + 1;
              return;
          }

          if (req.step_komer !== 1) { stats.komer++; return; }
          if (req.step_findir !== 1) { stats.findir++; return; }
          
          if (req.step_lawyer_draft !== 1) { stats.lawyer++; return; }
          if (req.step_finance_review !== 1) { stats.finance++; return; }
          if (req.step_lawyer_final !== 1) { stats.lawyer++; return; }
          
          if (req.step_accountant_req !== 1) { stats.accountant++; return; }
          if (req.step_finance_pay !== 1) { stats.finance++; return; }
          
          stats.accountant++; // Ждет факта оплаты
      });
      return stats;
  }, [requests]);

  const displayedRequests = useMemo(() => {
    let filtered = requests;
    if (selectedDept !== "ВСЕ") {
        filtered = filtered.filter(r => (r.target_department === selectedDept || r.target_dept_service === selectedDept));
    }
    if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(r => {
            const title = r.request_type === 'service' ? (r.service_name || r.item_name) : r.item_name;
            const init = r.initiator || "";
            return (
                r.req_number?.toString().includes(q) ||
                (title && title.toLowerCase().includes(q)) ||
                init.toLowerCase().includes(q)
            );
        });
    }
    return filtered;
  }, [requests, selectedDept, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans p-2 md:p-8 pb-20">
      
      {/* === ШАПКА === */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-800 pb-4 gap-4">
          <div>
              <h1 className="text-2xl md:text-4xl font-black text-blue-500 tracking-widest flex items-center gap-3">
                  <Monitor className="text-blue-500 hidden md:block" size={36}/> 
                  ТАБЛО СЭД
              </h1>
              <p className="text-gray-500 mt-1 text-xs md:text-sm flex items-center gap-2">
                  <Zap size={14} className="text-yellow-500"/> Все документы (Архив + В работе)
              </p>
          </div>
          
          <div className="flex flex-col md:flex-row w-full md:w-auto gap-3 items-center">
              {/* Поиск */}
              <div className="flex items-center bg-[#161b22] border border-gray-800 p-2 rounded-xl w-full md:w-64">
                  <Search size={18} className="text-gray-500 ml-2"/>
                  <input 
                      type="text"
                      placeholder="Поиск (№, Название, ФИО)..."
                      className="bg-transparent text-white font-bold text-sm outline-none w-full ml-2"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-gray-500 hover:text-white mr-2"><XCircle size={16}/></button>
                  )}
              </div>

              {/* Отдел */}
              <div className="flex items-center bg-[#161b22] border border-gray-800 p-2 rounded-xl w-full md:w-auto">
                  <Filter size={18} className="text-gray-500 ml-2"/>
                  <select 
                      className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer p-1 w-full md:w-48 appearance-none ml-1"
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                  >
                      <option value="ВСЕ">Все подразделения</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
              </div>

              {/* КНОПКА ОБНОВЛЕНИЯ */}
              <button 
                  onClick={fetchStandData} 
                  className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl transition shadow-lg w-full md:w-auto flex justify-center items-center gap-2"
                  title="Обновить данные"
              >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
                  <span className="md:hidden font-bold text-sm">ОБНОВИТЬ</span>
              </button>
          </div>
      </div>

      {/* === БЛОК СТАТИСТИКИ === */}
      {!loading && requests.length > 0 && (
          <div className="mb-6 bg-[#161b22] border border-gray-800 rounded-xl p-4">
              <h3 className="text-gray-400 text-xs font-bold uppercase mb-3 flex items-center gap-2">
                  <BarChart2 size={16} className="text-orange-500"/> 🔥 Ожидают действия (Узкие горлышки)
              </h3>
              <div className="flex flex-wrap gap-2">
                  {bottleneckStats.director > 0 && <span className="bg-blue-900/20 border border-blue-800 text-blue-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">👔 Директор <b className="bg-blue-600 text-white px-1.5 py-0.5 rounded">{bottleneckStats.director}</b></span>}
                  
                  {Object.entries(bottleneckStats.warehouses).map(([code, count]) => (
                      <span key={code} className="bg-orange-900/20 border border-orange-800 text-orange-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">📦 {WAREHOUSE_NAMES[code] || 'Склад'} <b className="bg-orange-600 text-white px-1.5 py-0.5 rounded">{count}</b></span>
                  ))}
                  
                  {bottleneckStats.komer > 0 && <span className="bg-purple-900/20 border border-purple-800 text-purple-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">📝 Ком. Дир <b className="bg-purple-600 text-white px-1.5 py-0.5 rounded">{bottleneckStats.komer}</b></span>}
                  {bottleneckStats.findir > 0 && <span className="bg-yellow-900/20 border border-yellow-800 text-yellow-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">🏦 Фин. Дир <b className="bg-yellow-600 text-white px-1.5 py-0.5 rounded">{bottleneckStats.findir}</b></span>}
                  {bottleneckStats.lawyer > 0 && <span className="bg-indigo-900/20 border border-indigo-800 text-indigo-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">⚖️ Юристы <b className="bg-indigo-600 text-white px-1.5 py-0.5 rounded">{bottleneckStats.lawyer}</b></span>}
                  {bottleneckStats.finance > 0 && <span className="bg-yellow-900/20 border border-yellow-800 text-yellow-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">💰 Финансисты <b className="bg-yellow-600 text-white px-1.5 py-0.5 rounded">{bottleneckStats.finance}</b></span>}
                  {bottleneckStats.accountant > 0 && <span className="bg-cyan-900/20 border border-cyan-800 text-cyan-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">🧮 Бухгалтерия <b className="bg-cyan-600 text-white px-1.5 py-0.5 rounded">{bottleneckStats.accountant}</b></span>}
                  
                  {/* Если ни у кого нет долгов */}
                  {Object.values(bottleneckStats).every(v => typeof v === 'number' ? v === 0 : Object.keys(v).length === 0) && (
                      <span className="text-green-500 text-xs italic">Все заявки обработаны или отменены 🎉</span>
                  )}
              </div>
          </div>
      )}

      {loading ? (
          <div className="flex justify-center items-center py-20 animate-pulse text-blue-500 text-xl font-bold">Загрузка данных...</div>
      ) : (
          <div className="space-y-6">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="text-orange-500"/> НАЙДЕНО ДОКУМЕНТОВ: {displayedRequests.length}
              </h2>

              {displayedRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-[#161b22] rounded-xl border border-gray-800">Нет совпадений</div>
              ) : (
                  <>
                      {/* ДЕСКТОП */}
                      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800 shadow-2xl">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="bg-[#161b22] text-gray-400 text-xs uppercase font-bold">
                                  <tr>
                                      <th className="px-4 py-4 w-32">№ / Дата</th>
                                      <th className="px-4 py-4 w-1/4">Предмет / Отдел</th>
                                      <th className="px-4 py-4">Инициатор</th>
                                      <th className="px-4 py-4">Статус и Прогресс</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/50 bg-[#0d1117]">
                                  {displayedRequests.map(req => {
                                      const title = req.request_type === 'service' ? (req.service_name || req.item_name) : req.item_name;
                                      const isUrgent = (req.urgency || "").toLowerCase().trim() === "срочно";
                                      const dept = req.target_department || req.target_dept_service || "—";
                                      
                                      const steps = generateSteps(req);
                                      const currentStat = getCurrentStatus(req); 

                                      let rowBg = "hover:bg-gray-800/30";
                                      if (isRequestRejected(req)) rowBg = "bg-red-900/10 hover:bg-red-900/20";
                                      else if (req.step_accountant_done === 1 || req.status?.toUpperCase() === 'ОПЛАЧЕНО') rowBg = "bg-green-900/5 hover:bg-green-900/10";

                                      return (
                                          <tr key={req.id} className={`${rowBg} transition`}>
                                              <td className="px-4 py-4 font-bold text-white">
                                                  <div className="flex items-center gap-2">
                                                      <span>#{req.req_number}</span>
                                                      {isUrgent && <span className="bg-red-600/20 text-red-500 border border-red-500/50 text-[9px] px-1.5 py-0.5 rounded uppercase font-black animate-pulse">Срочно</span>}
                                                  </div>
                                                  <div className="text-[10px] text-gray-500 font-normal mt-1">
                                                      {new Date(req.created_at).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                                                  </div>
                                              </td>
                                              <td className="px-4 py-4">
                                                  <div className="font-bold text-white truncate max-w-[250px]" title={title}>{title || 'Без названия'}</div>
                                                  <div className="text-[10px] font-black uppercase text-blue-500 mt-1 tracking-wider">{dept}</div>
                                              </td>
                                              <td className="px-4 py-4 text-gray-400 flex items-center gap-2 mt-2">
                                                  <User size={14} className="opacity-50"/> {req.initiator || '-'}
                                              </td>
                                              <td className="px-4 py-4">
                                                  <div className="mb-2">
                                                      <span className={`px-2 py-1 text-[10px] uppercase font-black rounded border ${currentStat.color}`}>
                                                          {currentStat.text}
                                                      </span>
                                                  </div>
                                                  <WorkflowTrack steps={steps} />
                                              </td>
                                          </tr>
                                      )
                                  })}
                              </tbody>
                          </table>
                      </div>

                      {/* МОБИЛКА */}
                      <div className="grid grid-cols-1 gap-4 md:hidden">
                          {displayedRequests.map(req => {
                              const title = req.request_type === 'service' ? (req.service_name || req.item_name) : req.item_name;
                              const isUrgent = (req.urgency || "").toLowerCase().trim() === "срочно";
                              const dept = req.target_department || req.target_dept_service || "—";
                              
                              const steps = generateSteps(req);
                              const currentStat = getCurrentStatus(req); 
                              
                              let cardBorder = "border-gray-800";
                              if (isRequestRejected(req)) cardBorder = "border-red-900/50";
                              else if (req.step_accountant_done === 1 || req.status?.toUpperCase() === 'ОПЛАЧЕНО') cardBorder = "border-green-900/30";

                              return (
                                  <div key={req.id} className={`bg-[#161b22] border ${cardBorder} rounded-xl p-4 shadow-lg flex flex-col gap-2 relative overflow-hidden`}>
                                      {isUrgent && <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">Срочно</div>}
                                      
                                      <div className="flex justify-between items-start">
                                          <div className="font-black text-blue-400 text-sm">#{req.req_number}</div>
                                          <div className="text-[10px] text-gray-500 bg-[#0d1117] px-2 py-1 rounded">{dept}</div>
                                      </div>
                                      
                                      <div className="font-bold text-white text-base leading-tight mt-1">
                                          {title || 'Без названия'}
                                      </div>
                                      
                                      <div className="text-xs text-gray-400 flex items-center gap-2 mb-1">
                                          <User size={14} className="opacity-50"/> {req.initiator || '-'}
                                      </div>
                                      
                                      <div className="pt-3 border-t border-gray-800/50">
                                          <div className={`px-2 py-1.5 text-[10px] text-center uppercase font-black rounded border ${currentStat.color} mb-3`}>
                                              {currentStat.text}
                                          </div>
                                          <WorkflowTrack steps={steps} />
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </>
              )}
          </div>
      )}
    </div>
  );
}


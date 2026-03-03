"use client";
import { useState, useEffect, useMemo } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { Clock, Monitor, Zap, User, CheckCircle2, XCircle, CircleDashed, ChevronRight, Filter, MinusCircle } from 'lucide-react';

// Подключаемся к базе
const supabase = createClient(
  "https://ykmvlughekjnqgdyddmp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbXZsdWdoZWtqbnFnZHlkZG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzQ3OTAsImV4cCI6MjA4NTE1MDc5MH0.ZaPeruXSJ6EQJ21nk4VPdvzQFMxoLUSxewQVK4EOE8Y"
);

// === 1. ГЕНЕРАТОР ЦЕПОЧКИ (Точный порт твоего алгоритма из Code.gs) ===
const generateSteps = (r) => {
  let s = { dir: 'wait', skl: 'wait', com: 'wait', fdir: 'wait', law: 'wait', fin: 'wait', acc: 'wait' };

  // Директор
  if (r.step_director === 1) s.dir = 'done';
  else if (r.step_director === 0) s.dir = 'reject';
  else { s.dir = 'pending'; return s; }

  // Склад
  if (r.request_type === 'service') {
    s.skl = 'skip';
  } else {
    if (r.step_sklad === 1) s.skl = 'done'; // Есть на складе (выдано)
    else if (r.step_sklad === 0) s.skl = 'reject';
    else if (r.step_sklad === 2) s.skl = 'buy'; // Нет на складе, покупаем (идем дальше)
    else { s.skl = 'pending'; return s; }
  }

  // Если выдали со склада - конец маршрута
  if (s.skl === 'done') {
     s.com = 'skip'; s.fdir = 'skip'; s.law = 'skip'; s.fin = 'skip'; s.acc = 'skip';
     return s; 
  }

  // Ком. Директор
  if (r.step_komer === 1) s.com = 'done';
  else if (r.step_komer === 0) s.com = 'reject';
  else { s.com = 'pending'; return s; }

  // Фин. Директор
  if (r.step_findir === 1) s.fdir = 'done';
  else if (r.step_findir === 0) s.fdir = 'reject';
  else { s.fdir = 'pending'; return s; }

  // Юрист
  if (r.step_lawyer_final === 1) s.law = 'done';
  else if (r.step_lawyer_draft === 1) { s.law = 'pending'; return s; }
  else if (r.step_lawyer_draft === 0 || r.step_lawyer_final === 0) { s.law = 'reject'; return s; }
  else { s.law = 'pending'; return s; }

  // Финансист
  if (r.step_finance_pay === 1) s.fin = 'done';
  else if (r.step_finance_review === 1) { s.fin = 'pending'; return s; }
  else if (r.step_finance_review === 0 || r.step_finance_pay === 0) { s.fin = 'reject'; return s; }
  else { s.fin = 'pending'; return s; }

  // Бухгалтерия
  if (r.step_accountant_done === 1) s.acc = 'done';
  else if (r.step_accountant_req === 1) { s.acc = 'pending'; return s; }
  else if (r.step_accountant_req === 0 || r.step_accountant_done === 0) { s.acc = 'reject'; return s; }
  else { s.acc = 'pending'; return s; }

  return s;
};

// === 2. КОМПОНЕНТ ОТРИСОВКИ ШАГОВ ===
const StepIndicator = ({ status, label }) => {
  let icon, color, bg;
  
  switch (status) {
    case 'done': case 'buy':
      icon = <CheckCircle2 size={16} />; color = 'text-green-500'; bg = 'bg-green-500/10 border-green-500/20'; break;
    case 'pending':
      icon = <Clock size={16} className="animate-pulse" />; color = 'text-blue-400'; bg = 'bg-blue-500/10 border-blue-500/30'; break;
    case 'reject':
      icon = <XCircle size={16} />; color = 'text-red-500'; bg = 'bg-red-500/10 border-red-500/20'; break;
    case 'skip':
      icon = <MinusCircle size={16} />; color = 'text-gray-600'; bg = 'bg-transparent border-transparent'; break;
    default: // wait
      icon = <CircleDashed size={16} />; color = 'text-gray-700'; bg = 'bg-transparent border-transparent'; break;
  }

  return (
    <div className={`flex flex-col items-center justify-center p-1.5 rounded border ${bg} ${color} w-12 md:w-16`} title={label}>
      {icon}
      <span className="text-[9px] font-black uppercase mt-1 hidden md:block tracking-tighter">{label}</span>
    </div>
  );
};

const WorkflowTrack = ({ steps }) => (
  <div className="flex items-center justify-between md:justify-start gap-1 md:gap-2 w-full">
    <StepIndicator status={steps.dir} label="Дир" /> <ChevronRight size={14} className="text-gray-700 hidden md:block"/>
    <StepIndicator status={steps.skl} label="Склад" /> <ChevronRight size={14} className="text-gray-700 hidden md:block"/>
    <StepIndicator status={steps.com} label="Ком" /> <ChevronRight size={14} className="text-gray-700 hidden md:block"/>
    <StepIndicator status={steps.fdir} label="Фин.Д" /> <ChevronRight size={14} className="text-gray-700 hidden md:block"/>
    <StepIndicator status={steps.law} label="Юрист" /> <ChevronRight size={14} className="text-gray-700 hidden md:block"/>
    <StepIndicator status={steps.fin} label="Фин" /> <ChevronRight size={14} className="text-gray-700 hidden md:block"/>
    <StepIndicator status={steps.acc} label="Бух" />
  </div>
);


export default function StandPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState("ВСЕ");

  const fetchStandData = async () => {
    const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('req_number', { ascending: false })
        .limit(200); // Берем запас для фильтрации

    if (!error && data) {
        setRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStandData();
    const channel = supabase.channel('stand-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, fetchStandData)
      .subscribe();
    const interval = setInterval(fetchStandData, 300000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  // === 3. ДИНАМИЧЕСКИЙ СПИСОК ОТДЕЛОВ ===
  const departments = useMemo(() => {
    const fixedList = ["АУП", "МТФ", "ЗНКИ", "ГАРАЖ", "МЕХТОК", "СТОЛОВАЯ", "БРИГАДА", "СТРОЙ ЦЕХ", "НАУКА", "ЭНЕРГОЦЕХ", "СБ", "МТМ", "ЦЕНТРАЛЬНЫЙ СКЛАД"];
    const dbDepts = requests.map(r => r.target_department || r.target_dept_service).filter(Boolean);
    return [...new Set([...fixedList, ...dbDepts])].sort();
  }, [requests]);

  // Фильтрация и очистка активных
  const activeRequests = useMemo(() => {
    let filtered = requests.filter(r => r.step_accountant_done !== 1 && !r.status?.toUpperCase().includes('ОТК'));
    if (selectedDept !== "ВСЕ") {
        filtered = filtered.filter(r => (r.target_department === selectedDept || r.target_dept_service === selectedDept));
    }
    return filtered;
  }, [requests, selectedDept]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans p-2 md:p-8 pb-20">
      
      {/* === ШАПКА И ФИЛЬТР === */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 border-b border-gray-800 pb-4 gap-4">
          <div>
              <h1 className="text-2xl md:text-4xl font-black text-blue-500 tracking-widest flex items-center gap-3">
                  <Monitor className="text-blue-500 hidden md:block" size={36}/> 
                  ТАБЛО СЭД
              </h1>
              <p className="text-gray-500 mt-1 text-xs md:text-sm flex items-center gap-2">
                  <Zap size={14} className="text-yellow-500"/> Прямое подключение
              </p>
          </div>
          
          {/* Фильтр подразделений */}
          <div className="w-full md:w-auto flex items-center gap-2 bg-[#161b22] border border-gray-800 p-2 rounded-xl">
              <Filter size={18} className="text-gray-500 ml-2"/>
              <select 
                  className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer p-1 w-full md:w-48 appearance-none"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
              >
                  <option value="ВСЕ">Все подразделения</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
          </div>
      </div>

      {loading ? (
          <div className="flex justify-center items-center py-20 animate-pulse text-blue-500 text-xl font-bold">Загрузка данных...</div>
      ) : (
          <div className="space-y-6">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="text-orange-500"/> В РАБОТЕ ({activeRequests.length})
              </h2>

              {activeRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-[#161b22] rounded-xl border border-gray-800">Нет активных заявок</div>
              ) : (
                  <>
                      {/* === ДЕСКТОП (Таблица) === */}
                      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800 shadow-2xl">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="bg-[#161b22] text-gray-400 text-xs uppercase font-bold">
                                  <tr>
                                      <th className="px-4 py-4 w-32">№ / Дата</th>
                                      <th className="px-4 py-4 w-1/4">Предмет / Отдел</th>
                                      <th className="px-4 py-4">Инициатор</th>
                                      <th className="px-4 py-4">Прогресс согласования</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/50 bg-[#0d1117]">
                                  {activeRequests.map(req => {
                                      const title = req.request_type === 'service' ? (req.service_name || req.item_name) : req.item_name;
                                      const isUrgent = (req.urgency || "").toLowerCase().trim() === "срочно";
                                      const dept = req.target_department || req.target_dept_service || "—";
                                      const steps = generateSteps(req);

                                      return (
                                          <tr key={req.id} className="hover:bg-gray-800/30 transition">
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
                                                  {/* РЕНДЕР ЦЕПОЧКИ ШАГОВ */}
                                                  <WorkflowTrack steps={steps} />
                                              </td>
                                          </tr>
                                      )
                                  })}
                              </tbody>
                          </table>
                      </div>

                      {/* === МОБИЛКА (Карточки) === */}
                      <div className="grid grid-cols-1 gap-4 md:hidden">
                          {activeRequests.map(req => {
                              const title = req.request_type === 'service' ? (req.service_name || req.item_name) : req.item_name;
                              const isUrgent = (req.urgency || "").toLowerCase().trim() === "срочно";
                              const dept = req.target_department || req.target_dept_service || "—";
                              const steps = generateSteps(req);

                              return (
                                  <div key={req.id} className="bg-[#161b22] border border-gray-800 rounded-xl p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden">
                                      {isUrgent && <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">Срочно</div>}
                                      
                                      <div className="flex justify-between items-start">
                                          <div className="font-black text-blue-400 text-sm">#{req.req_number}</div>
                                          <div className="text-[10px] text-gray-500 bg-[#0d1117] px-2 py-1 rounded">{dept}</div>
                                      </div>
                                      
                                      <div className="font-bold text-white text-base leading-tight">
                                          {title || 'Без названия'}
                                      </div>
                                      
                                      <div className="text-xs text-gray-400 flex items-center gap-2">
                                          <User size={14} className="opacity-50"/> {req.initiator || '-'}
                                      </div>
                                      
                                      {/* РЕНДЕР ЦЕПОЧКИ ШАГОВ НА МОБИЛКЕ */}
                                      <div className="pt-3 border-t border-gray-800/50 mt-1">
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

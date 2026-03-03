"use client";
import { useState, useEffect } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { Clock, CheckCircle, XCircle, AlertCircle, Monitor, Zap, User } from 'lucide-react';

// Подключаемся к базе
const supabase = createClient(
  "https://ykmvlughekjnqgdyddmp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbXZsdWdoZWtqbnFnZHlkZG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzQ3OTAsImV4cCI6MjA4NTE1MDc5MH0.ZaPeruXSJ6EQJ21nk4VPdvzQFMxoLUSxewQVK4EOE8Y"
);

// === ЖЕЛЕЗОБЕТОННАЯ ЛОГИКА ЦЕПОЧКИ СОГЛАСОВАНИЯ ===
const getCurrentStatus = (req) => {
    // 1. Проверяем отказы и отмены (Красный свет)
    if (req.status?.toUpperCase().includes('ОТКАЗ') || req.status?.toUpperCase().includes('ОТМЕН')) {
        return { text: '❌ ОТКАЗ / ОТМЕНА', color: 'text-red-500 bg-red-900/20 border-red-900' };
    }
    // 2. Проверяем финиш (Зеленый свет)
    if (req.step_accountant_done === 1 || req.status?.toUpperCase() === 'ОПЛАЧЕНО') {
        return { text: '✅ ОПЛАЧЕНО', color: 'text-green-500 bg-green-900/20 border-green-900' };
    }
    
    // 3. Строгий водопад (Ищем, кто еще НЕ поставил 1)
    if (req.step_director !== 1) return { text: '👔 Директор', color: 'text-blue-400 bg-blue-900/20 border-blue-800' };
    if (req.step_komer !== 1) return { text: '📝 Ком. Директор', color: 'text-purple-400 bg-purple-900/20 border-purple-800' };
    if (req.step_findir !== 1) return { text: '🏦 Фин. Директор', color: 'text-orange-400 bg-orange-900/20 border-orange-800' };
    
    // Юристы и Финансисты
    if (req.step_lawyer_draft !== 1) return { text: '⚖️ Юрист (Проект)', color: 'text-indigo-400 bg-indigo-900/20 border-indigo-800' };
    if (req.step_finance_review !== 1) return { text: '💰 Финансист (Проверка)', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' };
    if (req.step_lawyer_final !== 1) return { text: '✍️ Юрист (Скан)', color: 'text-indigo-400 bg-indigo-900/20 border-indigo-800' };
    
    // Бухгалтерия и Оплата
    if (req.step_accountant_req !== 1) return { text: '🧮 Бухгалтер (Счет в 1С)', color: 'text-cyan-400 bg-cyan-900/20 border-cyan-800' };
    if (req.step_finance_pay !== 1) return { text: '💎 Финансист (Апрув на оплату)', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' };
    
    // Если всё пройдено, но галка step_accountant_done еще не стоит
    return { text: '💸 Ждет оплаты банком', color: 'text-cyan-400 bg-cyan-900/20 border-cyan-800' };
};

export default function StandPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStandData = async () => {
    const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('req_number', { ascending: false })
        .limit(100); 

    if (!error && data) {
        setRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStandData();

    // Real-time подписка
    const channel = supabase
      .channel('stand-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
          fetchStandData();
      })
      .subscribe();

    const interval = setInterval(fetchStandData, 300000);

    return () => { 
        supabase.removeChannel(channel); 
        clearInterval(interval);
    };
  }, []);

  const activeRequests = requests.filter(r => r.step_accountant_done !== 1 && !r.status?.toUpperCase().includes('ОТК'));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans p-4 md:p-8">
      {/* ШАПКА ТАБЛО */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 border-b border-gray-800 pb-4 gap-4">
          <div>
              <h1 className="text-2xl md:text-4xl font-black text-blue-500 tracking-widest flex items-center gap-3">
                  <Monitor className="text-blue-500 hidden md:block" size={36}/> 
                  LIVE ТАБЛО СЭД
              </h1>
              <p className="text-gray-500 mt-1 text-xs md:text-sm flex items-center gap-2">
                  <Zap size={14} className="text-yellow-500"/> Прямое подключение к серверу
              </p>
          </div>
          <div className="text-left md:text-right">
              <div className="text-xl md:text-2xl font-bold text-white">{new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
              <div className="text-xs text-gray-500">{new Date().toLocaleDateString('ru-RU')}</div>
          </div>
      </div>

      {loading ? (
          <div className="flex justify-center items-center py-20 animate-pulse text-blue-500 text-xl font-bold">Подключение к БД...</div>
      ) : (
          <div className="space-y-6">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="text-orange-500"/> В РАБОТЕ ({activeRequests.length})
              </h2>

              {activeRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-[#161b22] rounded-xl border border-gray-800">Нет активных заявок</div>
              ) : (
                  <>
                      {/* === ДЕСКТОПНАЯ ВЕРСИЯ (Таблица) === */}
                      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800 shadow-2xl">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="bg-[#161b22] text-gray-400 text-xs uppercase font-bold">
                                  <tr>
                                      <th className="px-4 py-4 w-32">№ / Срочность</th>
                                      <th className="px-4 py-4">Предмет закупки</th>
                                      <th className="px-4 py-4">Инициатор</th>
                                      <th className="px-4 py-4 text-center">Статус (У кого сейчас)</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/50 bg-[#0d1117]">
                                  {activeRequests.map(req => {
                                      const title = req.request_type === 'service' ? (req.service_name || req.item_name) : req.item_name;
                                      const isUrgent = (req.urgency || "").toLowerCase().trim() === "срочно";
                                      const currentStat = getCurrentStatus(req);

                                      return (
                                          <tr key={req.id} className="hover:bg-gray-800/30 transition">
                                              <td className="px-4 py-4 font-bold text-white">
                                                  <div className="flex items-center gap-2">
                                                      <span>#{req.req_number}</span>
                                                      {isUrgent && <span className="bg-red-600/20 text-red-500 border border-red-500/50 text-[9px] px-1.5 py-0.5 rounded uppercase font-black animate-pulse">Срочно</span>}
                                                  </div>
                                              </td>
                                              <td className="px-4 py-4 truncate max-w-[350px] font-medium" title={title}>{title || 'Без названия'}</td>
                                              <td className="px-4 py-4 text-gray-400 flex items-center gap-2">
                                                  <User size={14} className="opacity-50"/> {req.initiator || '-'}
                                              </td>
                                              <td className="px-4 py-4 text-center">
                                                  <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${currentStat.color} inline-block w-full max-w-[200px] text-center`}>
                                                      {currentStat.text}
                                                  </span>
                                              </td>
                                          </tr>
                                      )
                                  })}
                              </tbody>
                          </table>
                      </div>

                      {/* === МОБИЛЬНАЯ ВЕРСИЯ (Карточки) === */}
                      <div className="grid grid-cols-1 gap-4 md:hidden">
                          {activeRequests.map(req => {
                              const title = req.request_type === 'service' ? (req.service_name || req.item_name) : req.item_name;
                              const isUrgent = (req.urgency || "").toLowerCase().trim() === "срочно";
                              const currentStat = getCurrentStatus(req);

                              return (
                                  <div key={req.id} className="bg-[#161b22] border border-gray-800 rounded-xl p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden">
                                      {isUrgent && <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">Срочно</div>}
                                      
                                      <div className="flex justify-between items-start">
                                          <div className="font-black text-blue-400 text-sm">#{req.req_number}</div>
                                      </div>
                                      
                                      <div className="font-bold text-white text-base leading-tight">
                                          {title || 'Без названия'}
                                      </div>
                                      
                                      <div className="text-xs text-gray-400 flex items-center gap-2">
                                          <User size={14} className="opacity-50"/> {req.initiator || '-'}
                                      </div>
                                      
                                      <div className="pt-2 border-t border-gray-800/50 mt-1">
                                          <div className={`px-3 py-2 rounded-lg text-xs font-bold border ${currentStat.color} flex justify-center w-full`}>
                                              {currentStat.text}
                                          </div>
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

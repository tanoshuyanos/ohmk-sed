"use client";
import { useState, useEffect } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { Clock, CheckCircle, XCircle, AlertCircle, Monitor, Zap } from 'lucide-react';

// Подключаемся к базе
const supabase = createClient(
  "https://ykmvlughekjnqgdyddmp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbXZsdWdoZWtqbnFnZHlkZG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzQ3OTAsImV4cCI6MjA4NTE1MDc5MH0.ZaPeruXSJ6EQJ21nk4VPdvzQFMxoLUSxewQVK4EOE8Y"
);

const formatMoney = (val) => {
    if (!val) return '-';
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('ru-RU').format(num);
};

// Функция для определения, У КОГО СЕЙЧАС ВИСИТ ЗАЯВКА
const getCurrentStatus = (req) => {
    if (req.status?.includes('ОТКАЗ') || req.status?.includes('ОТМЕН')) return { text: '❌ ОТМЕНЕНО', color: 'text-red-500 bg-red-900/20 border-red-900' };
    if (req.step_accountant_done === 1 || req.status === 'ОПЛАЧЕНО') return { text: '✅ ОПЛАЧЕНО', color: 'text-green-500 bg-green-900/20 border-green-900' };
    
    if (req.step_director == null) return { text: '👔 Директор', color: 'text-blue-400 bg-blue-900/20 border-blue-800' };
    if (req.step_komer == null) return { text: '📝 Ком. Директор', color: 'text-purple-400 bg-purple-900/20 border-purple-800' };
    if (req.step_findir == null) return { text: '🏦 Фин. Директор', color: 'text-orange-400 bg-orange-900/20 border-orange-800' };
    if (req.step_lawyer_draft == null) return { text: '⚖️ Юрист (Проект)', color: 'text-indigo-400 bg-indigo-900/20 border-indigo-800' };
    if (req.step_finance_review == null) return { text: '💰 Финансист (Согласование)', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' };
    if (req.step_lawyer_final == null) return { text: '✍️ Юрист (Скан)', color: 'text-indigo-400 bg-indigo-900/20 border-indigo-800' };
    if (req.step_accountant_req == null) return { text: '🧮 Бухгалтер (Запрос)', color: 'text-cyan-400 bg-cyan-900/20 border-cyan-800' };
    if (req.step_finance_pay == null) return { text: '💎 Финансист (Апрув оплаты)', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' };
    if (req.step_accountant_done == null) return { text: '💸 Бухгалтер (Оплата)', color: 'text-cyan-400 bg-cyan-900/20 border-cyan-800' };
    
    return { text: '🔄 В процессе', color: 'text-gray-400 bg-gray-800 border-gray-700' };
};

export default function StandPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStandData = async () => {
    // Грузим заявки, сортируем от новых к старым
    const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('req_number', { ascending: false })
        .limit(100); // Показываем 100 последних для скорости

    if (!error && data) {
        setRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStandData();

    // === REALTIME ПОДПИСКА ===
    // Табло будет само обновляться в ту же секунду, когда кто-то нажал кнопку в СЭД
    const channel = supabase
      .channel('stand-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
          fetchStandData();
      })
      .subscribe();

    // Авто-рефреш раз в 5 минут для надежности (чтобы телевизор не заснул)
    const interval = setInterval(fetchStandData, 300000);

    return () => { 
        supabase.removeChannel(channel); 
        clearInterval(interval);
    };
  }, []);

  // Разделяем на "В работе" и "Завершенные/Отмененные"
  const activeRequests = requests.filter(r => r.step_accountant_done !== 1 && !r.status?.includes('ОТК'));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans p-4 md:p-8">
      {/* ШАПКА ТАБЛО */}
      <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div>
              <h1 className="text-3xl md:text-4xl font-black text-blue-500 tracking-widest flex items-center gap-3">
                  <Monitor className="text-blue-500" size={36}/> LIVE ТАБЛО СЭД
              </h1>
              <p className="text-gray-500 mt-1 text-sm flex items-center gap-2">
                  <Zap size={14} className="text-yellow-500"/> Прямое подключение к серверу (Real-time)
              </p>
          </div>
          <div className="text-right hidden md:block">
              <div className="text-2xl font-bold text-white">{new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>
              <div className="text-xs text-gray-500">{new Date().toLocaleDateString('ru-RU')}</div>
          </div>
      </div>

      {loading ? (
          <div className="flex justify-center items-center py-20 animate-pulse text-blue-500 text-xl">Подключение к БД...</div>
      ) : (
          <div className="space-y-8">
              
              {/* === СЕКЦИЯ: В РАБОТЕ === */}
              <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Clock className="text-orange-500"/> В РАБОТЕ ({activeRequests.length})
                  </h2>
                  <div className="overflow-x-auto rounded-xl border border-gray-800 shadow-2xl">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-[#161b22] text-gray-400 text-xs uppercase font-bold">
                              <tr>
                                  <th className="px-4 py-4">№ / Срочность</th>
                                  <th className="px-4 py-4">Предмет</th>
                                  <th className="px-4 py-4">Инициатор</th>
                                  <th className="px-4 py-4 text-right">Сумма (KZT)</th>
                                  <th className="px-4 py-4 text-center">Статус (У кого сейчас)</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/50 bg-[#0d1117]">
                              {activeRequests.length === 0 ? (
                                  <tr><td colSpan="5" className="text-center py-8 text-gray-500">Нет активных заявок</td></tr>
                              ) : (
                                  activeRequests.map(req => {
                                      const title = req.request_type === 'service' ? (req.service_name || req.item_name) : req.item_name;
                                      const isUrgent = (req.urgency || "").toLowerCase().trim() === "срочно";
                                      const currentStat = getCurrentStatus(req);
                                      const amount = req.payment_sum || req.contract_sum || req.legal_info?.total;

                                      return (
                                          <tr key={req.id} className="hover:bg-gray-800/30 transition">
                                              <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                                                  #{req.req_number}
                                                  {isUrgent && <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded animate-pulse">СРОЧНО</span>}
                                              </td>
                                              <td className="px-4 py-3 truncate max-w-[250px]" title={title}>{title}</td>
                                              <td className="px-4 py-3 text-gray-400">{req.initiator || '-'}</td>
                                              <td className="px-4 py-3 text-right font-mono font-bold text-green-400">{amount ? `${formatMoney(amount)} ₸` : '-'}</td>
                                              <td className="px-4 py-3 text-center">
                                                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${currentStat.color}`}>
                                                      {currentStat.text}
                                                  </span>
                                              </td>
                                          </tr>
                                      )
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>

          </div>
      )}
    </div>
  );
}

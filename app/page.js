"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { RefreshCw, LogOut, Phone, MessageCircle, Archive, Zap, Search, FileText, CheckCircle } from 'lucide-react';

// --- КОНФИГУРАЦИЯ ---
const STAND_URL = "https://script.google.com/macros/s/AKfycbwKPGj8wyddHpkZmbZl5PSAmAklqUoL5lcT26c7_iGOnFEVY97fhO_RmFP8vxxE3QMp/exec"; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SED() {
  const [role, setRole] = useState(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // viewMode: 'active' (только задачи) или 'history' (все заявки, включая отказы)
  const [viewMode, setViewMode] = useState('active'); 

  // ПАРОЛИ И РОЛИ (Из твоего Google Script)
  const ROLES = {
    "2223": "DIRECTOR", 
    "0500": "KOMER", 
    "777": "FIN_DIR", 
    "333": "LAWYER", 
    "444": "FINANCE", 
    "222": "ACCOUNTANT",
    // Склады
    "2014": "SKLAD_CENTRAL", 
    "2525": "SKLAD_ZAP", 
    "197": "SKLAD_STOL",
    "504": "SKLAD_MTF",
    "505": "SKLAD_MEHTOK",
    "506": "SKLAD_ZNKI",
    "507": "SKLAD_BUH",
    "508": "SKLAD_GSM"
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (ROLES[pin]) {
      setRole(ROLES[pin]);
      setViewMode('active'); // При входе всегда показываем "Активные"
      fetchRequests(ROLES[pin], 'active');
    } else {
      alert("НЕВЕРНЫЙ ПИН");
      setPin('');
    }
  };

  // --- ПОЛУЧЕНИЕ ДАННЫХ ---
  const fetchRequests = async (userRole, mode) => {
    setLoading(true);
    const currentMode = mode || viewMode;
    
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });

    // === РЕЖИМ ИСТОРИИ (Видим всё) ===
    if (currentMode === 'history') {
        // Ограничиваем кол-во, чтобы не зависло
        query = query.limit(150); 
    } 
    // === РЕЖИМ "В РАБОТЕ" (Фильтры) ===
    else {
        if (userRole === "FIN_DIR") {
            // Видит: Статус "ДОГОВОР" И еще не принял решение (ни ОК, ни Отказ)
            // ИЛИ если он сам вернул "НА ДОРАБОТКУ" (чтобы видеть, исправили или нет)
            query = query.eq('status', 'ДОГОВОР')
                         .neq('fin_dir_status', 'ОДОБРЕНО')
                         .neq('fin_dir_status', 'ОТКАЗ');
        }
        else if (userRole === "KOMER") {
            // Видит: Одобрено директором ИЛИ ФинДир вернул на правки
            query = query.or('status.eq.ОДОБРЕНО,fin_dir_status.eq.НА ДОРАБОТКУ');
        }
        else if (userRole && userRole.includes("SKLAD")) {
            query = query.eq('status', 'ОДОБРЕНО');
        }
        else if (userRole === "LAWYER") {
            // Юрист видит только после одобрения Фин. Дира
            query = query.eq('fin_dir_status', 'ОДОБРЕНО');
        }
        else if (userRole === "FINANCE") {
            // Финансист видит, когда Юрист начал работу или загрузил финал
            query = query.or('status.eq.В работе,status.eq.Договор подписан');
        }
        else if (userRole === "ACCOUNTANT") {
            query = query.eq('status', 'ОДОБРЕНО К ОПЛАТЕ');
        }
        else if (userRole === "DIRECTOR") {
            query = query.eq('current_step', 'DIRECTOR_CHECK');
        }
    }

    const { data, error } = await query;
    if (error) { console.error(error); setLoading(false); return; }

    let filtered = data || [];

    // === ДОП. ФИЛЬТРАЦИЯ (JS) ===
    if (currentMode === 'active') {
        // 1. Фильтр КОМЕРА (Скрыть товары, пока Склад не ответит)
        if (userRole === "KOMER") {
            filtered = filtered.filter(req => {
                // Если вернули на доработку - приоритет
                if (req.fin_dir_status === "НА ДОРАБОТКУ") return true;
                
                // Если статус не Одобрено (значит уже ушло дальше), скрываем
                if (req.status !== "ОДОБРЕНО") return false;

                const isService = (req.item_name || "").toLowerCase().includes("услуг");
                if (isService) return true; // Услуги видим сразу

                // Товары видим, только если Склад ответил
                const wh = req.warehouse_status;
                return (wh === "Частично" || wh === "Отсутствует" || wh === "ОТСУТСТВУЕТ");
            });
        }
        
        // 2. Фильтр СКЛАДОВ (Только свои категории)
        if (userRole && userRole.includes("SKLAD")) {
            filtered = filtered.filter(req => {
                const isService = (req.item_name || "").toLowerCase().includes("услуг");
                if (isService) return false; // Склад услуги не видит

                const wId = req.warehouse_id || "central";
                
                // Распределение по складам
                if (userRole === "SKLAD_CENTRAL" && wId !== "central") return false;
                if (userRole === "SKLAD_ZAP"     && wId !== "parts") return false;
                if (userRole === "SKLAD_STOL"    && wId !== "canteen") return false;
                if (userRole === "SKLAD_MTF"     && wId !== "dairy_farm") return false;
                if (userRole === "SKLAD_ZNKI"    && wId !== "factory") return false;
                if ((userRole === "SKLAD_GSM" || userRole === "SKLAD_MEHTOK") && wId !== "special") return false;

                // Склад видит только новые задачи (без статуса)
                return !req.warehouse_status || req.warehouse_status === "ВЫБРАТЬ";
            });
        }

        // 3. Финансист не видит то, что уже одобрил
        if (userRole === "FINANCE") {
            filtered = filtered.filter(req => req.status !== "ОДОБРЕНО К ОПЛАТЕ");
        }
        
        // 4. Юрист не видит уже подписанные и оплаченные (если вдруг попали)
        if (userRole === "LAWYER") {
             filtered = filtered.filter(req => req.status !== "ОПЛАЧЕНО" && req.status !== "ОДОБРЕНО К ОПЛАТЕ");
        }
    }

    setRequests(filtered);
    setLoading(false);
  };

  const switchMode = (mode) => {
      setViewMode(mode);
      fetchRequests(role, mode);
  };

  // --- ОБНОВЛЕНИЕ СТАТУСА ---
  const updateStatus = async (req, action, extraUpdates = {}) => {
    if (!confirm(`Выполнить действие: ${action}?`)) return;
    setLoading(true);

    let updates = { ...extraUpdates, last_role: role };
    let newStatus = req.status; 
    let nextStep = req.current_step;

    // ЛОГИКА ПЕРЕХОДОВ
    if (role === 'DIRECTOR') {
        if (action === 'ОДОБРЕНО') {
            newStatus = "ОДОБРЕНО";
            const isService = (req.item_name || "").toLowerCase().includes("услуг");
            nextStep = isService ? "KOMER_WORK" : "SKLAD_CHECK";
        } else {
            newStatus = "ОТКЛОНЕНО";
            nextStep = "CLOSED_REJECTED";
        }
    }
    else if (role.includes('SKLAD')) {
        updates.warehouse_status = action;
        nextStep = (action.toUpperCase() === 'ЕСТЬ') ? "CLOSED_SUCCESS" : "KOMER_WORK";
    }
    else if (role === 'KOMER') {
        if (action === 'ОТКАЗ') {
             newStatus = "ОТКАЗ";
             nextStep = "CLOSED_REJECTED";
        } else {
             newStatus = "ДОГОВОР";
             nextStep = "FIN_DIR_CHECK";
             updates.fin_dir_status = "НА ПРОВЕРКЕ"; 
             updates.fix_comment = null;
        }
    }
    else if (role === 'FIN_DIR') {
        updates.fin_dir_status = action;
        if (action === 'ОДОБРЕНО') {
             nextStep = "LAWYER_PROJECT"; 
        } else if (action === 'НА ДОРАБОТКУ') {
             nextStep = "KOMER_FIX"; 
             newStatus = "ОДОБРЕНО"; // Возвращаем статус Одобрено, чтобы Комер увидел
        } else {
             newStatus = "ОТКАЗ ФИН.ДИР";
             nextStep = "CLOSED_REJECTED";
        }
    }
    else if (role === 'LAWYER') {
        if (action === 'ЗАГРУЖЕН ПРОЕКТ') { newStatus = "В работе"; nextStep = "FINANCE_REVIEW"; }
        else if (action === 'ЗАГРУЖЕН ФИНАЛ') { newStatus = "Договор подписан"; nextStep = "FINANCE_DEAL"; }
    }
    else if (role === 'FINANCE') {
        if (action === 'ПРОЕКТ СОГЛАСОВАН') nextStep = "LAWYER_FINAL";
        else if (action === 'ОДОБРЕНО') { newStatus = "ОДОБРЕНО К ОПЛАТЕ"; nextStep = "ACCOUNTANT_PAY"; }
        else if (action === 'НА ДОРАБОТКУ') nextStep = "LAWYER_FIX"; 
        else if (action === 'ОТКЛОНЕНО') { newStatus = "ОТКЛОНЕНО ФИН"; nextStep = "CLOSED_REJECTED"; }
    }
    else if (role === 'ACCOUNTANT') {
        if (action === 'ОПЛАЧЕНО') { newStatus = "ОПЛАЧЕНО"; nextStep = "FINISH"; }
        else { newStatus = "ОТКАЗ БУХ"; nextStep = "CLOSED_REJECTED"; }
    }

    const { error } = await supabase.from('requests').update({
       status: newStatus,
       current_step: nextStep,
       ...updates
    }).eq('id', req.id);

    if (error) alert("Ошибка: " + error.message);
    else fetchRequests(role, viewMode);
    setLoading(false);
  };

  // --- КАРТОЧКА ЗАЯВКИ ---
  const RequestCard = ({ req }) => {
    const [formData, setFormData] = useState(req.legal_info || {
       seller: '', buyer: 'ТОО ОХМК', subject: req.item_name, qty: req.qty,
       price: '', total: '', payment: 'Постоплата', delivery: 'Склад ОХМК', 
       term: '10 рабочих дней', quality: 'Новое', warranty: '12 мес', person: req.initiator
    });
    const [paySum, setPaySum] = useState('');

    const calcTotal = (price) => {
        const q = parseFloat(formData.qty) || 0;
        setFormData({ ...formData, price: price, total: (price * q).toFixed(2) });
    };

    // Цвета для истории
    let borderColor = 'border-[#30363d]';
    let stripColor = 'bg-blue-600';
    if (req.status.includes('ОТКАЗ') || req.status.includes('ОТКЛОНЕНО')) {
        borderColor = 'border-red-900'; stripColor = 'bg-red-600';
    } else if (req.status === 'ОПЛАЧЕНО' || req.status.includes('ЕСТЬ')) {
        borderColor = 'border-green-900'; stripColor = 'bg-green-600';
    } else if (role === 'KOMER') stripColor = 'bg-pink-500';
    else if (role === 'FIN_DIR') stripColor = 'bg-purple-500';

    return (
      <div className={`bg-[#161b22] border ${borderColor} rounded-xl p-5 mb-6 shadow-xl relative overflow-hidden group`}>
         <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripColor}`}></div>

         {/* ЗАГОЛОВОК */}
         <div className="flex justify-between items-start mb-4 pl-3">
            <div>
               <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                 #{req.req_number}
                 {req.fix_comment && viewMode === 'active' && <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded">ПРАВКИ</span>}
               </h3>
               <div className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</div>
               {viewMode === 'history' && (
                   <div className="text-[10px] text-gray-500 mt-1">Этап: {req.current_step} / {req.last_role}</div>
               )}
            </div>
            <div className="text-right">
               <div className="bg-gray-800 text-gray-400 px-2 py-1 rounded text-xs border border-gray-700">{req.status}</div>
            </div>
         </div>

         {/* ИНФО */}
         <div className="text-sm pl-3 mb-4 space-y-1 text-gray-300">
            <div className="flex border-b border-gray-800 pb-1"><span className="w-24 text-gray-500 text-[10px] uppercase font-bold">Товар:</span> <span>{req.item_name}</span></div>
            <div className="flex border-b border-gray-800 pb-1"><span className="w-24 text-gray-500 text-[10px] uppercase font-bold">Объект:</span> <span>{req.dept}</span></div>
            <div className="flex border-b border-gray-800 pb-1"><span className="w-24 text-gray-500 text-[10px] uppercase font-bold">Кол-во:</span> <span className="font-bold text-white">{req.qty}</span></div>
            <div className="flex"><span className="w-24 text-gray-500 text-[10px] uppercase font-bold">Инициатор:</span> <span>{req.initiator}</span></div>
            
            {/* Кнопки звонка (если есть телефон в legal_info) */}
            {req.legal_info?.phone && (
               <div className="flex gap-2 mt-2 pt-2">
                  <a href={`tel:${req.legal_info.phone}`} className="flex items-center gap-1 bg-blue-900/40 text-blue-400 px-2 py-1 rounded text-xs hover:bg-blue-900"><Phone size={12}/> Звонок</a>
                  <a href={`https://wa.me/${req.legal_info.phone.replace(/\D/g,'')}`} target="_blank" className="flex items-center gap-1 bg-green-900/40 text-green-400 px-2 py-1 rounded text-xs hover:bg-green-900"><MessageCircle size={12}/> WA</a>
               </div>
            )}
         </div>

         {/* --- ФОРМА КОММЕРЧЕСКОГО --- */}
         {role === 'KOMER' && viewMode === 'active' && (
            <div className="pl-3 bg-pink-900/10 border-l-2 border-pink-500 p-3 rounded mb-3">
               {req.fix_comment && <div className="text-red-300 text-xs mb-3 p-2 bg-red-900/20 border border-red-800 rounded">💬 <b>ФИН.ДИР:</b> {req.fix_comment}</div>}
               
               <div className="space-y-2">
                   <input className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Поставщик" value={formData.seller} onChange={e=>setFormData({...formData, seller: e.target.value})}/>
                   <div className="flex gap-2">
                       <input className="w-1/2 bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Цена за ед." type="number" value={formData.price} onChange={e=>calcTotal(e.target.value)}/>
                       <div className="w-1/2 p-2 text-right text-pink-400 font-bold text-sm">{formData.total} ₸</div>
                   </div>
                   {/* Скрытые поля (можно раскрыть при желании) */}
                   <input className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Условия оплаты" value={formData.payment} onChange={e=>setFormData({...formData, payment: e.target.value})}/>
               </div>

               <div className="flex gap-2 mt-3">
                  <button onClick={()=>updateStatus(req, "ОТКАЗ")} className="flex-1 bg-red-900/40 text-red-300 py-2 rounded text-xs border border-red-900">ОТКАЗ</button>
                  <button onClick={()=>updateStatus(req, "ОДОБРЕНО", {legal_info: formData})} className="flex-[2] bg-green-600 text-white py-2 rounded text-xs font-bold shadow-lg shadow-green-900/20">
                      {req.fix_comment ? "ИСПРАВИТЬ" : "НА ДОГОВОР"}
                  </button>
               </div>
            </div>
         )}

         {/* --- ПРОСМОТР АНКЕТЫ (КРОМЕ КОМЕРА ИЛИ В ИСТОРИИ) --- */}
         {(role !== 'KOMER' || viewMode === 'history') && req.legal_info && (
             <div className="pl-3 mb-3 p-3 bg-gray-800/40 rounded border border-gray-700 text-xs space-y-1">
                 <div className="flex justify-between"><span className="text-gray-500">Поставщик:</span> <b className="text-white">{req.legal_info.seller}</b></div>
                 <div className="flex justify-between"><span className="text-gray-500">Условия:</span> <span className="text-gray-300">{req.legal_info.payment}</span></div>
                 <div className="flex justify-between border-t border-gray-700 pt-1 mt-1"><span className="text-gray-500">Итого:</span> <b className="text-[#3fb950] text-sm">{req.legal_info.total}</b></div>
             </div>
         )}

         {/* --- КНОПКИ ДЕЙСТВИЙ (ТОЛЬКО ACTIVE) --- */}
         {viewMode === 'active' && (
             <div className="pl-3 flex flex-wrap gap-2">
                 {role === 'FIN_DIR' && (
                     <>
                       <button onClick={()=>updateStatus(req, "ОДОБРЕНО")} className="flex-1 bg-green-600 py-2 rounded text-white text-xs font-bold">УТВЕРДИТЬ</button>
                       <button onClick={()=>{const r=prompt("Комментарий:"); if(r) updateStatus(req, "НА ДОРАБОТКУ", {fix_comment: r})}} className="flex-1 bg-orange-600 py-2 rounded text-white text-xs font-bold">НА ПРАВКИ</button>
                       <button onClick={()=>updateStatus(req, "ОТКАЗ")} className="w-full bg-red-900/50 border border-red-800 text-red-300 py-2 rounded text-xs">ОТКАЗАТЬ</button>
                     </>
                 )}
                 
                 {role && role.includes("SKLAD") && (
                     <>
                       <button onClick={()=>updateStatus(req, "Есть")} className="flex-1 border border-green-600 text-green-500 py-2 rounded text-xs font-bold hover:bg-green-600/10">ЕСТЬ</button>
                       <button onClick={()=>updateStatus(req, "Частично")} className="flex-1 border border-orange-500 text-orange-500 py-2 rounded text-xs font-bold hover:bg-orange-500/10">ЧАСТИЧНО</button>
                       <button onClick={()=>updateStatus(req, "Отсутствует")} className="flex-1 border border-red-500 text-red-500 py-2 rounded text-xs font-bold hover:bg-red-500/10">НЕТ</button>
                     </>
                 )}

                 {role === 'LAWYER' && req.current_step === "LAWYER_PROJECT" && (
                     <div className="flex w-full gap-2">
                         <input id={`d-${req.id}`} className="flex-1 bg-[#0d1117] border border-gray-700 p-1 text-white text-xs rounded" placeholder="Ссылка на проект..."/>
                         <button onClick={()=>{const v=document.getElementById(`d-${req.id}`).value; if(v) updateStatus(req, "ЗАГРУЖЕН ПРОЕКТ", {draft_url: v})}} className="bg-blue-600 px-3 rounded text-white text-xs font-bold">ОК</button>
                     </div>
                 )}
                 {role === 'LAWYER' && (req.current_step === "LAWYER_FINAL" || req.status === "Договор подписан") && !req.contract_url && (
                     <div className="flex w-full gap-2">
                         <input id={`f-${req.id}`} className="flex-1 bg-[#0d1117] border border-gray-700 p-1 text-white text-xs rounded" placeholder="Ссылка на СКАН..."/>
                         <button onClick={()=>{const v=document.getElementById(`f-${req.id}`).value; if(v) updateStatus(req, "ЗАГРУЖЕН ФИНАЛ", {contract_url: v})}} className="bg-green-600 px-3 rounded text-white text-xs font-bold">ОК</button>
                     </div>
                 )}

                 {role === 'FINANCE' && (
                    <>
                       <button onClick={()=>updateStatus(req, req.current_step==="FINANCE_REVIEW" ? "ПРОЕКТ СОГЛАСОВАН" : "ОДОБРЕНО")} className="flex-1 bg-green-600 py-2 rounded text-white text-xs font-bold">ОДОБРИТЬ</button>
                       <button onClick={()=>updateStatus(req, "НА ДОРАБОТКУ")} className="flex-1 bg-orange-600 py-2 rounded text-white text-xs font-bold">НА ПРАВКИ</button>
                       <button onClick={()=>updateStatus(req, "ОТКЛОНЕНО")} className="flex-1 bg-red-600 py-2 rounded text-white text-xs font-bold">ОТКАЗ</button>
                    </>
                 )}

                 {role === 'ACCOUNTANT' && (
                     <div className="w-full">
                         <input type="number" placeholder="Сумма оплаты" className="w-full bg-[#0d1117] mb-2 p-2 border border-gray-700 rounded text-xs text-white" value={paySum} onChange={e=>setPaySum(e.target.value)}/>
                         <div className="flex gap-2">
                             <button onClick={()=>{if(!paySum)return alert("Сумма?"); updateStatus(req, "ОПЛАЧЕНО", {payment_sum:paySum})}} className="flex-1 bg-green-600 py-2 rounded text-white text-xs font-bold">ОПЛАТИТЬ</button>
                             <button onClick={()=>updateStatus(req, "ОТКАЗ")} className="flex-1 bg-red-600 py-2 rounded text-white text-xs font-bold">ОТКАЗ</button>
                         </div>
                     </div>
                 )}
             </div>
         )}
         
         {/* ССЫЛКИ НА ДОКУМЕНТЫ */}
         <div className="pl-3 mt-3 space-y-2">
             {req.draft_url && (
                 <a href={req.draft_url} target="_blank" className="flex items-center gap-2 text-blue-400 text-xs hover:text-white transition bg-blue-900/20 p-2 rounded border border-blue-900/50">
                    <FileText size={14}/> Проект договора
                 </a>
             )}
             {req.contract_url && (
                 <a href={req.contract_url} target="_blank" className="flex items-center gap-2 text-green-400 text-xs hover:text-white transition bg-green-900/20 p-2 rounded border border-green-900/50">
                    <CheckCircle size={14}/> Подписанный скан
                 </a>
             )}
         </div>

      </div>
    );
  };

  // --- ЭКРАН ВХОДА ---
  if (!role) return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-500 tracking-widest">ОХМК СЭД</h1>
          <p className="text-gray-500 text-xs mt-2">CORPORATE SYSTEM</p>
      </div>
      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-64">
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} 
            className="bg-[#161b22] border-2 border-[#30363d] text-white text-4xl text-center p-4 rounded-2xl outline-none focus:border-blue-500 transition" placeholder="••••" autoFocus />
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-lg shadow-lg shadow-blue-900/20 transition transform active:scale-95">ВОЙТИ</button>
        <a href={STAND_URL} target="_blank" className="flex justify-center items-center gap-2 py-3 rounded-xl border border-gray-700 text-gray-400 text-xs font-bold hover:bg-gray-800 transition">
            <Zap size={14}/> МОНИТОРИНГ
        </a>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-300 pb-20 p-2 max-w-xl mx-auto font-sans">
      {/* ШАПКА */}
      <div className="sticky top-0 z-20 bg-[#0d1117]/80 backdrop-blur pb-2">
          <div className="flex flex-col gap-3 mb-2 p-3 bg-[#161b22] border border-gray-700 rounded-xl shadow-lg">
             <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-1">
                 <div className="flex items-center gap-2">
                     <b className="text-blue-400">{role}</b>
                     {loading && <RefreshCw className="animate-spin text-gray-500" size={14}/>}
                 </div>
                 <button onClick={() => setRole(null)} className="text-[10px] text-red-400 border border-red-900/30 px-2 py-1 rounded bg-red-900/10">ВЫХОД</button>
             </div>
             
             {/* ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ */}
             <div className="flex bg-[#0d1117] p-1 rounded-lg border border-gray-700">
                 <button onClick={() => switchMode('active')} 
                    className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center items-center gap-1 transition ${viewMode==='active' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                    <Zap size={12}/> В РАБОТЕ
                 </button>
                 <button onClick={() => switchMode('history')} 
                    className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center items-center gap-1 transition ${viewMode==='history' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                    <Archive size={12}/> АРХИВ
                 </button>
             </div>
          </div>

          <div className="relative">
             <Search className="absolute left-3 top-3 text-gray-500" size={16}/>
             <input type="text" placeholder="Поиск по номеру..." className="w-full bg-[#161b22] border border-gray-700 rounded-xl p-2.5 pl-10 text-white text-sm outline-none focus:border-blue-500 transition" 
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
      </div>
      
      {/* СПИСОК */}
      {loading && requests.length === 0 ? (
          <div className="text-center py-20 text-gray-500 animate-pulse">Загрузка...</div>
      ) : (
          requests
            .filter(r => searchQuery ? String(r.req_number).includes(searchQuery) : true)
            .map(req => <RequestCard key={req.id} req={req} />)
      )}

      {!loading && requests.length === 0 && (
          <div className="text-center py-20 opacity-30 flex flex-col items-center">
              <Archive size={48} className="mb-2"/>
              <div>Пусто</div>
          </div>
      )}
    </div>
  );
}
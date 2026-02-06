"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { RefreshCw, LogOut, ExternalLink, FileText, CheckCircle, DollarSign, Truck, Calendar, User, Shield } from 'lucide-react';

// --- НАСТРОЙКИ ---
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

  // ПАРОЛИ
  const ROLES = {
    "2223": "DIRECTOR", "0500": "KOMER", "777": "FIN_DIR",
    "333": "LAWYER", "444": "FINANCE", "222": "ACCOUNTANT",
    "2014": "SKLAD_CENTRAL", "2525": "SKLAD_ZAP", "197": "SKLAD_STOL"
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (ROLES[pin]) {
      setRole(ROLES[pin]);
      fetchRequests(ROLES[pin]);
    } else {
      alert("Неверный пароль");
    }
  };

  const fetchRequests = async (userRole) => {
    setLoading(true);
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });

    // Фильтры видимости
    if (userRole === "FIN_DIR") {
       query = query.or('current_step.eq.FIN_DIR_CHECK,fin_dir_status.eq.НА ДОРАБОТКУ');
    }
    else if (userRole === "KOMER") {
       query = query.or('status.eq.ОДОБРЕНО,fin_dir_status.eq.НА ДОРАБОТКУ');
    }
    else if (userRole === "LAWYER") {
       query = query.eq('fin_dir_status', 'ОДОБРЕНО');
    }
    else if (userRole && userRole.includes("SKLAD")) {
       query = query.eq('status', 'ОДОБРЕНО');
    }

    const { data, error } = await query;
    if (error) console.error(error);
    else setRequests(data || []);
    setLoading(false);
  };

  const updateStatus = async (req, action, extraData = {}) => {
    if (!confirm(`Выполнить: ${action}?`)) return;
    setLoading(true);

    let newStatus = req.status;
    let nextStep = req.current_step;
    let updates = { ...extraData, last_role: role };

    // РОУТИНГ
    if (role === "DIRECTOR") {
       newStatus = action;
       if (action === "ОДОБРЕНО") {
          const isService = (req.item_name || "").toLowerCase().includes("услуг");
          nextStep = isService ? "KOMER_WORK" : "SKLAD_CHECK";
       } else nextStep = "CLOSED_REJECTED";
    }
    else if (role.includes("SKLAD")) {
       if (action === "ЕСТЬ") nextStep = "CLOSED_SUCCESS";
       else nextStep = "KOMER_WORK";
    }
    else if (role === "KOMER") {
       if (action === "ОТКАЗ") { newStatus = "ОТКАЗ"; nextStep = "CLOSED_REJECTED"; }
       else { newStatus = "ДОГОВОР"; nextStep = "FIN_DIR_CHECK"; updates.fin_dir_status = "НА ПРОВЕРКЕ"; }
    }
    else if (role === "FIN_DIR") {
       updates.fin_dir_status = action;
       if (action === "ОДОБРЕНО") nextStep = "LAWYER_PROJECT";
       else if (action === "НА ДОРАБОТКУ") nextStep = "KOMER_FIX";
    }
    else if (role === "LAWYER") {
       if (action === "ЗАГРУЖЕН ПРОЕКТ") { newStatus = "В работе"; nextStep = "FINANCE_REVIEW"; }
       else if (action === "ПОДПИСАН") { newStatus = "Договор подписан"; nextStep = "FINANCE_DEAL"; }
    }
    else if (role === "FINANCE") {
       if (action === "СОГЛАСОВАН") nextStep = "LAWYER_FINAL";
       else if (action === "ОДОБРЕНО") { newStatus = "ОДОБРЕНО"; nextStep = "ACCOUNTANT_PAY"; }
       else if (action === "НА ДОРАБОТКУ") nextStep = req.status === "В работе" ? "LAWYER_FIX" : "KOMER_FIX";
    }
    else if (role === "ACCOUNTANT") {
       if (action === "ОПЛАЧЕНО") { newStatus = "ОПЛАЧЕНО"; nextStep = "FINISH"; }
    }

    const { error } = await supabase.from('requests').update({
       status: newStatus, current_step: nextStep, ...updates
    }).eq('id', req.id);

    if (error) alert("Ошибка: " + error.message);
    else fetchRequests(role);
    setLoading(false);
  };

  // --- КОМПОНЕНТ КАРТОЧКИ ---
  const RequestCard = ({ req }) => {
    // Полная форма для Комера
    const [formData, setFormData] = useState(req.legal_info || {
       seller: '', buyer: 'ТОО ОХМК', subject: req.item_name,
       qty: req.qty, price: '', total: '', payment: 'Постоплата 100%',
       delivery: 'г. Усть-Каменогорск', term: '', warranty: '12 мес', person: ''
    });

    const saveKomerData = () => {
       if(!formData.seller || !formData.price || !formData.total) {
          alert("Заполните главные поля (Поставщик, Цена, Сумма)");
          return;
       }
       updateStatus(req, "ОДОБРЕНО", { legal_info: formData });
    };

    return (
      <div className={`bg-[#161b22] border border-[#30363d] rounded-xl p-5 mb-6 shadow-xl relative overflow-hidden group`}>
         <div className={`absolute left-0 top-0 bottom-0 w-1 ${role==='KOMER' ? 'bg-pink-500' : role==='FIN_DIR' ? 'bg-purple-500' : 'bg-blue-600'}`}></div>

         {/* ЗАГОЛОВОК */}
         <div className="flex justify-between items-start mb-4 pl-3">
            <div>
               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  #{req.req_number}
                  {req.fin_dir_status === 'НА ДОРАБОТКУ' && <span className="text-xs bg-red-900 text-red-200 px-2 py-0.5 rounded animate-pulse">❗ ПРАВКИ</span>}
               </h3>
               <div className="text-xs text-gray-500 mt-1">{new Date(req.created_at).toLocaleString('ru-RU')}</div>
            </div>
            <div className="text-right">
               <div className="bg-gray-800 text-orange-400 px-3 py-1 rounded text-xs font-bold border border-gray-700 mb-1 inline-block">
                  {req.status}
               </div>
            </div>
         </div>

         {/* ТЕЛО ЗАЯВКИ */}
         <div className="grid grid-cols-2 gap-4 text-sm pl-3 mb-5">
            <div className="col-span-2 bg-[#0d1117]/50 p-3 rounded border border-[#30363d]">
               <span className="text-gray-500 text-[10px] uppercase font-bold">Товар / Услуга</span>
               <div className="text-white text-lg font-medium">{req.item_name}</div>
               <div className="text-gray-400 text-xs mt-1">{req.spec}</div>
            </div>
            <div>
               <span className="text-gray-500 text-[10px] uppercase font-bold">Инициатор</span>
               <div className="text-gray-300">{req.initiator}</div>
               <div className="text-gray-500 text-[10px]">{req.dept}</div>
            </div>
            <div>
               <span className="text-gray-500 text-[10px] uppercase font-bold">Количество</span>
               <div className="text-white font-bold text-lg">{req.qty}</div>
            </div>
            {req.fix_comment && (
               <div className="col-span-2 bg-red-900/20 border border-red-500/30 p-3 rounded text-red-200 text-xs italic">
                  " {req.fix_comment} "
               </div>
            )}
         </div>

         {/* --- ПОЛНАЯ ФОРМА КОММЕРЧЕСКОГО --- */}
         {role === 'KOMER' && (
            <div className="pl-3 bg-[#0d1117] p-4 rounded border border-pink-500/30 mb-4">
               <div className="text-pink-400 text-xs font-bold uppercase mb-3 border-b border-pink-900/30 pb-2">Данные для Договора</div>
               
               <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="col-span-2">
                     <span className="text-gray-500 text-[10px] uppercase">Поставщик (Юр. лицо)</span>
                     <input type="text" className="w-full bg-[#161b22] border border-gray-700 p-2 rounded text-white text-sm"
                        value={formData.seller || ''} onChange={e => setFormData({...formData, seller: e.target.value})} placeholder="Название поставщика" />
                  </div>
                  <div>
                     <span className="text-gray-500 text-[10px] uppercase">Цена за ед.</span>
                     <input type="number" className="w-full bg-[#161b22] border border-gray-700 p-2 rounded text-white text-sm"
                        value={formData.price || ''} onChange={e => setFormData({...formData, price: e.target.value})} />
                  </div>
                  <div>
                     <span className="text-gray-500 text-[10px] uppercase text-pink-400 font-bold">ИТОГО СУММА</span>
                     <input type="number" className="w-full bg-[#161b22] border border-pink-900/50 text-pink-400 font-bold p-2 rounded text-sm"
                        value={formData.total || ''} onChange={e => setFormData({...formData, total: e.target.value})} />
                  </div>
               </div>

               <div className="space-y-3">
                  <div>
                     <span className="text-gray-500 text-[10px] uppercase">Условия оплаты</span>
                     <input type="text" className="w-full bg-[#161b22] border border-gray-700 p-2 rounded text-white text-sm"
                        value={formData.payment || ''} onChange={e => setFormData({...formData, payment: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                         <span className="text-gray-500 text-[10px] uppercase">Срок поставки</span>
                         <input type="text" className="w-full bg-[#161b22] border border-gray-700 p-2 rounded text-white text-sm"
                           value={formData.term || ''} onChange={e => setFormData({...formData, term: e.target.value})} placeholder="Например: 10 раб. дней"/>
                      </div>
                      <div>
                         <span className="text-gray-500 text-[10px] uppercase">Гарантия</span>
                         <input type="text" className="w-full bg-[#161b22] border border-gray-700 p-2 rounded text-white text-sm"
                           value={formData.warranty || ''} onChange={e => setFormData({...formData, warranty: e.target.value})} placeholder="Например: 12 мес"/>
                      </div>
                  </div>
                  <div>
                     <span className="text-gray-500 text-[10px] uppercase">Контактное лицо / Телефон</span>
                     <input type="text" className="w-full bg-[#161b22] border border-gray-700 p-2 rounded text-white text-sm"
                        value={formData.person || ''} onChange={e => setFormData({...formData, person: e.target.value})} />
                  </div>
               </div>

               <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800">
                  <button onClick={saveKomerData} className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded text-white font-bold text-sm">ОТПРАВИТЬ ФИН.ДИРУ</button>
                  <button onClick={() => updateStatus(req, "ОТКАЗ")} className="bg-red-900/50 hover:bg-red-800 text-red-200 px-4 py-2 rounded text-sm">ОТКАЗ</button>
               </div>
            </div>
         )}

         {/* --- ПОЛНЫЙ ПРОСМОТР ДЛЯ ФИН. ДИРЕКТОРА --- */}
         {role === 'FIN_DIR' && req.legal_info && (
            <div className="pl-3 bg-[#0d1117] p-4 rounded border border-purple-500/30 mb-4">
               <div className="text-purple-400 text-xs font-bold uppercase mb-3 flex items-center gap-2"><DollarSign size={14}/> ДАННЫЕ ЗАКУПА (ПРОВЕРКА)</div>
               
               <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                  <div className="col-span-2 pb-2 border-b border-gray-800 mb-2">
                     <span className="text-gray-500 text-[10px]">ПОСТАВЩИК</span>
                     <div className="text-white font-bold text-lg">{req.legal_info.seller}</div>
                  </div>
                  
                  <div>
                     <span className="text-gray-500 text-[10px]">ЦЕНА</span>
                     <div className="text-white">{req.legal_info.price}</div>
                  </div>
                  <div>
                     <span className="text-gray-500 text-[10px]">ИТОГО</span>
                     <div className="text-purple-400 font-bold text-lg">{req.legal_info.total}</div>
                  </div>
                  
                  <div className="col-span-2 pt-2 border-t border-gray-800 mt-1">
                     <div className="flex items-start gap-2 mb-1">
                        <DollarSign size={14} className="text-gray-500 mt-0.5"/>
                        <div><span className="text-gray-500 text-[10px]">УСЛОВИЯ ОПЛАТЫ:</span> <span className="text-gray-300">{req.legal_info.payment}</span></div>
                     </div>
                     <div className="flex items-start gap-2 mb-1">
                        <Calendar size={14} className="text-gray-500 mt-0.5"/>
                        <div><span className="text-gray-500 text-[10px]">СРОК:</span> <span className="text-gray-300">{req.legal_info.term}</span></div>
                     </div>
                     <div className="flex items-start gap-2 mb-1">
                        <Shield size={14} className="text-gray-500 mt-0.5"/>
                        <div><span className="text-gray-500 text-[10px]">ГАРАНТИЯ:</span> <span className="text-gray-300">{req.legal_info.warranty}</span></div>
                     </div>
                     <div className="flex items-start gap-2">
                        <User size={14} className="text-gray-500 mt-0.5"/>
                        <div><span className="text-gray-500 text-[10px]">КОНТАКТ:</span> <span className="text-gray-300">{req.legal_info.person}</span></div>
                     </div>
                  </div>
               </div>

               <div className="flex gap-2">
                  <button onClick={() => updateStatus(req, "ОДОБРЕНО", {fin_dir_status: "ОДОБРЕНО"})} className="flex-1 bg-green-600 py-2 rounded text-white font-bold text-sm">УТВЕРДИТЬ</button>
                  <button onClick={() => {const r = prompt("Что исправить?"); if(r) updateStatus(req, "НА ДОРАБОТКУ", {fin_dir_status: "НА ДОРАБОТКУ", fix_comment: r})}} className="flex-1 bg-red-600 py-2 rounded text-white font-bold text-sm">НА ПРАВКИ</button>
               </div>
            </div>
         )}

         {/* ССЫЛКИ ДЛЯ ЮРИСТА */}
         {role === 'LAWYER' && (
            <div className="pl-3 mt-4 space-y-2">
               {req.current_step === "LAWYER_PROJECT" && (
                  <div className="flex gap-2">
                     <input type="text" id={`draft-${req.id}`} placeholder="Ссылка на Draft..." className="flex-1 bg-[#0d1117] border border-gray-700 p-2 rounded text-xs text-white"/>
                     <button onClick={() => { const val = document.getElementById(`draft-${req.id}`).value; if(val) updateStatus(req, "ЗАГРУЖЕН ПРОЕКТ", {draft_url: val}) }} className="bg-blue-600 px-3 rounded text-white text-xs font-bold">OK</button>
                  </div>
               )}
               {req.current_step.includes("FINAL") && (
                  <div className="flex gap-2">
                     <input type="text" id={`final-${req.id}`} placeholder="Ссылка на Скан..." className="flex-1 bg-[#0d1117] border border-gray-700 p-2 rounded text-xs text-white"/>
                     <button onClick={() => { const val = document.getElementById(`final-${req.id}`).value; if(val) updateStatus(req, "ПОДПИСАН", {contract_url: val}) }} className="bg-green-600 px-3 rounded text-white text-xs font-bold">OK</button>
                  </div>
               )}
            </div>
         )}

         {/* ФАЙЛЫ */}
         <div className="flex gap-2 pl-3 mt-4">
            {req.draft_url && <a href={req.draft_url} target="_blank" className="flex items-center gap-1 px-3 py-1.5 bg-blue-900/20 text-blue-400 rounded border border-blue-800 text-xs font-bold hover:bg-blue-900/40"><FileText size={12}/> ПРОЕКТ</a>}
            {req.contract_url && <a href={req.contract_url} target="_blank" className="flex items-center gap-1 px-3 py-1.5 bg-green-900/20 text-green-400 rounded border border-green-800 text-xs font-bold hover:bg-green-900/40"><CheckCircle size={12}/> СКАН</a>}
         </div>
         
         {/* КНОПКИ СКЛАДА */}
         {role && role.includes("SKLAD") && (
            <div className="flex gap-2 mt-4 pl-3">
               <button onClick={() => updateStatus(req, "ЕСТЬ")} className="flex-1 bg-green-600/20 text-green-400 border border-green-600 py-2 rounded text-xs font-bold hover:bg-green-600 hover:text-white transition">ЕСТЬ НА СКЛАДЕ</button>
               <button onClick={() => updateStatus(req, "ОТСУТСТВУЕТ")} className="flex-1 bg-orange-600/20 text-orange-400 border border-orange-600 py-2 rounded text-xs font-bold hover:bg-orange-600 hover:text-white transition">ЗАКУПИТЬ</button>
            </div>
         )}
      </div>
    );
  };

  if (!role) return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
         <h1 className="text-5xl font-bold text-blue-500 tracking-widest mb-2">ОХМК <span className="text-white">СЭД</span></h1>
         <p className="text-gray-500 text-sm">WEB VERSION 2.0</p>
      </div>
      <form onSubmit={handleLogin} className="flex flex-col gap-4 items-center">
        <input type="password" value={pin} onChange={e => setPin(e.target.value)}
          className="bg-[#161b22] border border-[#30363d] text-white text-4xl text-center p-4 rounded-2xl outline-none focus:border-blue-500 w-64 shadow-2xl placeholder-gray-700" placeholder="••••" autoFocus />
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-10 rounded-xl text-lg transition shadow-lg shadow-blue-900/20">ВОЙТИ</button>
        <a href={STAND_URL} target="_blank" className="mt-6 text-gray-500 text-xs hover:text-white flex items-center gap-1 transition"><ExternalLink size={12}/> МОНИТОРИНГ (СТЕНД)</a>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] font-sans pb-20">
      <div className="sticky top-0 z-20 bg-[#161b22]/80 backdrop-blur-md border-b border-[#30363d] px-4 py-3 mb-6">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3"><div className="font-bold text-lg text-white">{role}</div>{loading && <RefreshCw className="animate-spin text-blue-500" size={16}/>}</div>
          <div className="flex gap-3">
             <a href={STAND_URL} target="_blank" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-gray-600 rounded-lg text-xs font-bold hover:bg-gray-700 transition"><ExternalLink size={14}/> СТЕНД</a>
             <button onClick={() => fetchRequests(role)} className="p-2 bg-[#21262d] rounded-lg hover:bg-gray-700 text-white border border-gray-600"><RefreshCw size={18}/></button>
             <button onClick={() => setRole(null)} className="p-2 bg-red-900/20 rounded-lg hover:bg-red-900/40 text-red-400 border border-red-900/30"><LogOut size={18}/></button>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4">
        {!loading && requests.length === 0 && (<div className="text-center py-20 opacity-50"><div className="text-6xl mb-4">📭</div><div>Задач пока нет</div></div>)}
        {requests.map(req => <RequestCard key={req.id} req={req} />)}
      </div>
    </div>
  );
}
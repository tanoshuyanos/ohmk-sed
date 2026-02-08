"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { RefreshCw, Archive, Zap, Search, FileText, CheckCircle, UploadCloud, X, Loader2, ExternalLink, AlertTriangle, Table, Truck, Wrench } from 'lucide-react';

const APP_VERSION = "v1.4 (Smart Forms)"; 
// ВАЖНО: Ваша ссылка на скрипт (doPost)
const STAND_URL = "https://script.google.com/macros/s/AKfycbwPVrrM4BuRPhbJXyFCmMY88QHQaI12Pbhj9Db9Ru0ke5a3blJV8luSONKao-DD6SNN/exec"; 
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Bf...ВАША_ССЫЛКА.../edit"; 

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
  const [viewMode, setViewMode] = useState('active'); 

  // --- ОКНО ЗАГРУЗКИ ---
  const [modal, setModal] = useState({ open: false, req: null, type: '' });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const ROLES = {
    "2223": "DIRECTOR", "0500": "KOMER", "777": "FIN_DIR", 
    "333": "LAWYER", "444": "FINANCE", "222": "ACCOUNTANT",
    "2014": "SKLAD_CENTRAL", "2525": "SKLAD_ZAP", "197": "SKLAD_STOL",
    "504": "SKLAD_MTF", "505": "SKLAD_MEHTOK", "506": "SKLAD_ZNKI",
    "507": "SKLAD_BUH", "508": "SKLAD_GSM"
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (ROLES[pin]) {
      setRole(ROLES[pin]);
      setViewMode('active');
      fetchRequests(ROLES[pin], 'active');
    } else { alert("НЕВЕРНЫЙ ПИН"); setPin(''); }
  };

  const fetchRequests = async (userRole, mode) => {
    setLoading(true);
    const currentMode = mode || viewMode;
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });

    if (currentMode === 'history') query = query.limit(100);
    else {
        if (userRole === "FIN_DIR") query = query.eq('status', 'ДОГОВОР').neq('fin_dir_status', 'ОДОБРЕНО').neq('fin_dir_status', 'ОТКАЗ');
        else if (userRole === "KOMER") query = query.or('status.eq.ОДОБРЕНО,fin_dir_status.eq.НА ДОРАБОТКУ');
        else if (userRole && userRole.includes("SKLAD")) query = query.eq('status', 'ОДОБРЕНО');
        else if (userRole === "LAWYER") query = query.eq('fin_dir_status', 'ОДОБРЕНО');
        else if (userRole === "FINANCE") query = query.or('status.eq.В работе,status.eq.Договор подписан,status.eq.ИСПРАВЛЕНО,status.eq.НА ДОРАБОТКУ');
        else if (userRole === "ACCOUNTANT") query = query.eq('status', 'ОДОБРЕНО К ОПЛАТЕ');
        else if (userRole === "DIRECTOR") query = query.eq('current_step', 'DIRECTOR_CHECK');
    }

    const { data } = await query;
    let filtered = data || [];

    if (currentMode === 'active') {
        if (userRole === "KOMER") {
            filtered = filtered.filter(req => {
                if (req.fin_dir_status === "НА ДОРАБОТКУ") return true;
                if (req.status !== "ОДОБРЕНО") return false;
                if ((req.item_name || "").toLowerCase().includes("услуг")) return true; 
                return (req.warehouse_status === "Частично" || req.warehouse_status === "Отсутствует" || req.warehouse_status === "ОТСУТСТВУЕТ");
            });
        }
        if (userRole && userRole.includes("SKLAD")) {
            filtered = filtered.filter(req => {
                if ((req.item_name || "").toLowerCase().includes("услуг")) return false; 
                const wId = req.warehouse_id || "central";
                if (userRole === "SKLAD_CENTRAL" && wId !== "central") return false;
                if (userRole === "SKLAD_ZAP" && wId !== "parts") return false;
                if ((userRole === "SKLAD_GSM" || userRole === "SKLAD_MEHTOK") && wId !== "special") return false;
                return !req.warehouse_status || req.warehouse_status === "ВЫБРАТЬ";
            });
        }
        if (userRole === "FINANCE") filtered = filtered.filter(req => req.status !== "ОДОБРЕНО К ОПЛАТЕ");
        if (userRole === "LAWYER") filtered = filtered.filter(req => req.status !== "ОПЛАЧЕНО" && req.status !== "ОДОБРЕНО К ОПЛАТЕ");
    }
    setRequests(filtered);
    setLoading(false);
  };

  const switchMode = (mode) => { setViewMode(mode); fetchRequests(role, mode); };

  const updateStatus = async (req, action, extraUpdates = {}) => {
    if (role !== 'LAWYER' && !confirm(`Выполнить: ${action}?`)) return;
    setLoading(true);

    let updates = { ...extraUpdates, last_role: role };
    let newStatus = req.status; 
    let nextStep = req.current_step;

    if (role === 'DIRECTOR') {
        if (action === 'ОДОБРЕНО') { newStatus = "ОДОБРЕНО"; nextStep = (req.item_name||"").toLowerCase().includes("услуг") ? "KOMER_WORK" : "SKLAD_CHECK"; } 
        else { newStatus = "ОТКЛОНЕНО"; nextStep = "CLOSED_REJECTED"; }
    }
    else if (role.includes('SKLAD')) {
        updates.warehouse_status = action;
        nextStep = (action.toUpperCase() === 'ЕСТЬ') ? "CLOSED_SUCCESS" : "KOMER_WORK";
    }
    else if (role === 'KOMER') {
        if (action === 'ОТКАЗ') { newStatus = "ОТКАЗ"; nextStep = "CLOSED_REJECTED"; }
        else { newStatus = "ДОГОВОР"; nextStep = "FIN_DIR_CHECK"; updates.fin_dir_status = "НА ПРОВЕРКЕ"; updates.fix_comment = null; }
    }
    else if (role === 'FIN_DIR') {
        updates.fin_dir_status = action;
        if (action === 'ОДОБРЕНО') nextStep = "LAWYER_PROJECT";
        else if (action === 'НА ДОРАБОТКУ') { nextStep = "KOMER_FIX"; newStatus = "ОДОБРЕНО"; }
        else { newStatus = "ОТКАЗ ФИН.ДИР"; nextStep = "CLOSED_REJECTED"; }
    }
    else if (role === 'LAWYER') {
        if (action === 'ЗАГРУЖЕН ПРОЕКТ') { newStatus = "ИСПРАВЛЕНО"; nextStep = "FINANCE_REVIEW"; }
        else if (action === 'ЗАГРУЖЕН ФИНАЛ') { newStatus = "Договор подписан"; nextStep = "FINANCE_DEAL"; }
    }
    else if (role === 'FINANCE') {
        if (action === 'ПРОЕКТ СОГЛАСОВАН') nextStep = "LAWYER_FINAL";
        else if (action === 'ОДОБРЕНО') { newStatus = "ОДОБРЕНО К ОПЛАТЕ"; nextStep = "ACCOUNTANT_PAY"; }
        else if (action === 'НА ДОРАБОТКУ') { newStatus = "НА ДОРАБОТКУ"; nextStep = "LAWYER_FIX"; }
        else if (action === 'ОТКЛОНЕНО') { newStatus = "ОТКЛОНЕНО ФИН"; nextStep = "CLOSED_REJECTED"; }
    }
    else if (role === 'ACCOUNTANT') {
        if (action === 'ОПЛАЧЕНО') { newStatus = "ОПЛАЧЕНО"; nextStep = "FINISH"; }
        else { newStatus = "ОТКАЗ БУХ"; nextStep = "CLOSED_REJECTED"; }
    }

    const { error } = await supabase.from('requests').update({ status: newStatus, current_step: nextStep, ...updates }).eq('id', req.id);
    if (!error) fetchRequests(role, viewMode);
    setLoading(false);
  };

  const handleUpload = async () => {
      const fileInput = document.getElementById('file-upload');
      const contractNum = document.getElementById('contract-num')?.value || '';
      const amount = document.getElementById('contract-amount')?.value || '';

      if (!fileInput.files[0]) return alert("Выберите файл!");
      if (modal.type === 'FINAL' && (!contractNum || !amount)) return alert("Заполните номер договора и сумму!");

      const file = fileInput.files[0];
      setUploadStatus('uploading');
      
      let progress = 0;
      const interval = setInterval(() => {
          progress += 5;
          if (progress > 90) progress = 90;
          setUploadProgress(progress);
      }, 500);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async function() {
          const base64 = reader.result;
          try {
              // ОТПРАВЛЯЕМ В ГУГЛ
              await fetch(STAND_URL, {
                  method: 'POST',
                  mode: 'no-cors',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      file: base64,
                      fileName: file.name,
                      reqNum: modal.req.req_number,
                      reqId: modal.req.id,
                      contractNum: contractNum,
                      amount: amount,
                      type: modal.type
                  })
              });

              clearInterval(interval);
              setUploadProgress(100);
              setUploadStatus('success');

              setTimeout(async () => {
                  setModal({ open: false, req: null, type: '' });
                  setUploadStatus('');
                  setUploadProgress(0);
                  fetchRequests(role, viewMode);
              }, 4000);

          } catch (e) {
              clearInterval(interval);
              setUploadStatus('error');
              alert("Ошибка загрузки: " + e.message);
          }
      };
  };

  const RequestCard = ({ req }) => {
    const [formData, setFormData] = useState(req.legal_info || {});
    const [paySum, setPaySum] = useState('');
    const isService = (req.item_name || "").toLowerCase().includes("услуг");

    let borderColor = 'border-[#30363d]';
    let stripColor = 'bg-blue-600';
    if (req.status.includes('ОТКАЗ')) { borderColor = 'border-red-900'; stripColor = 'bg-red-600'; }
    else if (req.status === 'ОПЛАЧЕНО') { borderColor = 'border-green-900'; stripColor = 'bg-green-600'; }
    else if (req.status === 'НА ДОРАБОТКУ') { borderColor = 'border-orange-800'; stripColor = 'bg-orange-500'; }
    else if (role === 'KOMER') stripColor = 'bg-pink-500';
    else if (role === 'FIN_DIR') stripColor = 'bg-purple-500';

    return (
      <div className={`bg-[#161b22] border ${borderColor} rounded-xl p-5 shadow-xl relative overflow-hidden group flex flex-col h-full`}>
         <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripColor}`}></div>
         
         <div className="flex justify-between items-start mb-4 pl-3">
            <div>
               <h3 className="text-xl font-bold flex items-center gap-2 text-white">#{req.req_number}</h3>
               <div className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</div>
            </div>
            <div className="text-right">
                <div className={`px-2 py-1 rounded text-xs border font-bold ${req.status === 'НА ДОРАБОТКУ' ? 'bg-orange-900/40 text-orange-400 border-orange-800' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                    {req.status}
                </div>
            </div>
         </div>

         {/* --- ПОЛНЫЕ ДАННЫЕ О ЗАЯВКЕ --- */}
         <div className="text-sm pl-3 mb-4 space-y-2 text-gray-300 flex-grow">
            <div className="flex items-start gap-2">
                {isService ? <Wrench className="text-purple-400 shrink-0" size={18}/> : <Truck className="text-blue-400 shrink-0" size={18}/>}
                <div>
                    <b className={`${isService ? 'text-purple-400' : 'text-blue-400'} text-[10px] uppercase block mb-1`}>
                        {isService ? 'Услуга / Работа' : 'Товар'}
                    </b>
                    <span className="text-white text-base font-bold leading-tight block">{req.item_name}</span>
                </div>
            </div>
            
            <div className="bg-[#0d1117] p-3 rounded border border-gray-800 mt-2">
                <span className="text-gray-300 text-xs whitespace-pre-wrap">{req.spec || "Нет описания"}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-gray-800 pt-3 mt-2">
                <div><span className="text-[10px] text-gray-500 block">ОБЪЕКТ</span><span className="text-xs text-white font-medium">{req.dept}</span></div>
                <div className="text-right"><span className="text-[10px] text-gray-500 block">ИНИЦИАТОР</span><span className="text-xs text-white font-medium">{req.initiator}</span></div>
            </div>
            {!isService && (
                 <div className="pt-2 border-t border-gray-800 mt-1"><span className="text-[10px] text-gray-500">КОЛИЧЕСТВО:</span> <span className="text-white font-bold ml-2 text-sm">{req.qty}</span></div>
            )}
         </div>

         {/* --- ДОКУМЕНТЫ (ССЫЛКИ) --- */}
         {(req.draft_url || req.contract_url) && (
             <div className="pl-3 mb-4 space-y-2">
                 {req.draft_url && (
                     <a href={req.draft_url} target="_blank" className="flex items-center gap-2 bg-blue-900/20 text-blue-400 p-2 rounded border border-blue-900/50 hover:bg-blue-900/40 transition">
                         <FileText size={16}/> <span className="text-xs font-bold">Проект договора</span> <ExternalLink size={12} className="ml-auto"/>
                     </a>
                 )}
                 {req.contract_url && (
                     <a href={req.contract_url} target="_blank" className="flex items-center gap-2 bg-green-900/20 text-green-400 p-2 rounded border border-green-900/50 hover:bg-green-900/40 transition">
                         <CheckCircle size={16}/> <span className="text-xs font-bold">Подписанный скан</span> <ExternalLink size={12} className="ml-auto"/>
                     </a>
                 )}
             </div>
         )}

         {/* --- ПРАВКИ --- */}
         {role === 'LAWYER' && req.fix_comment && req.status === "НА ДОРАБОТКУ" && (
             <div className="pl-3 mb-3 p-3 bg-orange-900/20 border border-orange-800 rounded flex gap-2 items-start text-orange-200 text-xs">
                 <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
                 <div><b>ПРАВКИ:</b> {req.fix_comment}</div>
             </div>
         )}

         {/* --- ФОРМА КОМЕРА (АДАПТИВНАЯ) --- */}
         {role === 'KOMER' && viewMode === 'active' && (
            <div className="pl-3 bg-pink-900/10 border-l-2 border-pink-500 p-3 rounded mb-3">
               <div className="flex items-center gap-2 mb-2">
                   <span className="text-[10px] bg-pink-500 text-white px-1.5 py-0.5 rounded font-bold">КОММЕРЧЕСКИЙ</span>
               </div>
               <div className="space-y-3">
                   {/* ПОСТАВЩИК */}
                   <div>
                       <label className="text-[10px] text-gray-400 block mb-1">Поставщик</label>
                       <input className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs focus:border-pink-500 outline-none" 
                           placeholder="Название..." value={formData.seller||''} onChange={e=>setFormData({...formData, seller: e.target.value})}/>
                   </div>

                   {/* ЦЕНА И СУММА */}
                   <div className="flex gap-2">
                       <div className="flex-1">
                           <label className="text-[10px] text-gray-400 block mb-1">Цена {isService ? '(общая)' : 'за ед.'}</label>
                           <input className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs focus:border-pink-500 outline-none" type="number" 
                               placeholder="0.00" value={formData.price||''} 
                               onChange={e=>{
                                   const val=e.target.value; 
                                   // Если услуга - сумма равна цене. Если товар - умножаем на qty
                                   const qty = isService ? 1 : (parseFloat(req.qty) || 1);
                                   setFormData({...formData, price: val, total: (val*qty).toFixed(2)})
                               }}/>
                       </div>
                       <div className="flex-1">
                           <label className="text-[10px] text-gray-400 block mb-1">Итого (с НДС)</label>
                           <div className="w-full p-2 text-right text-pink-400 font-bold text-sm bg-[#0d1117]/50 rounded border border-pink-900/30">
                               {formData.total || '0.00'} ₸
                           </div>
                       </div>
                   </div>

                   {/* УСЛОВИЯ */}
                   <div>
                       <label className="text-[10px] text-gray-400 block mb-1">Условия оплаты</label>
                       <input className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs focus:border-pink-500 outline-none" 
                           placeholder="Напр: 100% постоплата" value={formData.payment||''} onChange={e=>setFormData({...formData, payment: e.target.value})}/>
                   </div>
                   
                   <div>
                       <label className="text-[10px] text-gray-400 block mb-1">Срок {isService ? 'выполнения' : 'поставки'}</label>
                       <input className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs focus:border-pink-500 outline-none" 
                           placeholder="Дней..." value={formData.term||''} onChange={e=>setFormData({...formData, term: e.target.value})}/>
                   </div>

                   {/* ГАРАНТИЯ (ТОЛЬКО ДЛЯ ТОВАРОВ) */}
                   {!isService && (
                       <div>
                           <label className="text-[10px] text-gray-400 block mb-1">Гарантия</label>
                           <input className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs focus:border-pink-500 outline-none" 
                               placeholder="Месяцев..." value={formData.warranty||''} onChange={e=>setFormData({...formData, warranty: e.target.value})}/>
                       </div>
                   )}
               </div>

               <div className="flex gap-2 mt-4 pt-2 border-t border-pink-900/30">
                  <button onClick={()=>updateStatus(req, "ОТКАЗ")} className="flex-1 bg-red-900/20 text-red-300 py-2 rounded text-xs border border-red-900 hover:bg-red-900 hover:text-white transition">ОТКАЗ</button>
                  <button onClick={()=>updateStatus(req, "ОДОБРЕНО", { legal_info: formData })} className="flex-[2] bg-gradient-to-r from-green-700 to-green-600 text-white py-2 rounded text-xs font-bold shadow-lg shadow-green-900/20 hover:from-green-600 hover:to-green-500 transform active:scale-95 transition">ОТПРАВИТЬ ➜</button>
               </div>
            </div>
         )}

         {/* --- КНОПКИ ДЕЙСТВИЙ (ОСТАЛЬНЫЕ РОЛИ) --- */}
         {viewMode === 'active' && (
             <div className="pl-3 flex flex-wrap gap-2 mt-auto">
                 {role === 'FIN_DIR' && (
                     <>
                       <button onClick={()=>updateStatus(req, "ОДОБРЕНО")} className="flex-1 bg-green-600 py-2 rounded text-white text-xs font-bold">УТВЕРДИТЬ</button>
                       <button onClick={()=>{const r=prompt("Комментарий:"); if(r) updateStatus(req, "НА ДОРАБОТКУ", {fix_comment: r})}} className="flex-1 bg-orange-600 py-2 rounded text-white text-xs font-bold">ПРАВКИ</button>
                       <button onClick={()=>updateStatus(req, "ОТКАЗ")} className="w-full bg-red-900/50 border border-red-800 text-red-300 py-2 rounded text-xs">ОТКАЗАТЬ</button>
                     </>
                 )}
                 {role && role.includes("SKLAD") && (
                     <>
                       <button onClick={()=>updateStatus(req, "Есть")} className="flex-1 border border-green-600 text-green-500 py-2 rounded text-xs font-bold">ЕСТЬ</button>
                       <button onClick={()=>updateStatus(req, "Частично")} className="flex-1 border border-orange-500 text-orange-500 py-2 rounded text-xs font-bold">ЧАСТИЧНО</button>
                       <button onClick={()=>updateStatus(req, "Отсутствует")} className="flex-1 border border-red-500 text-red-500 py-2 rounded text-xs font-bold">НЕТ</button>
                     </>
                 )}
                 {role === 'LAWYER' && (req.current_step === "LAWYER_PROJECT" || req.current_step === "LAWYER_FIX") && (
                     <button onClick={() => setModal({ open: true, req: req, type: 'DRAFT' })} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2">
                        <UploadCloud size={18}/> {req.current_step === "LAWYER_FIX" ? "ОБНОВИТЬ" : "ЗАГРУЗИТЬ"}
                     </button>
                 )}
                 {role === 'LAWYER' && (req.current_step === "LAWYER_FINAL" || req.status === "Договор подписан") && !req.contract_url && (
                     <button onClick={() => setModal({ open: true, req: req, type: 'FINAL' })} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2"><UploadCloud size={18}/> ФИНАЛ</button>
                 )}
                 {role === 'FINANCE' && (
                    <>
                       <button onClick={()=>updateStatus(req, req.current_step==="FINANCE_REVIEW" ? "ПРОЕКТ СОГЛАСОВАН" : "ОДОБРЕНО")} className="flex-1 bg-green-600 py-2 rounded text-white text-xs font-bold">ОК</button>
                       <button onClick={()=>{const r=prompt("Что исправить?"); if(r) updateStatus(req, "НА ДОРАБОТКУ", {fix_comment: r})}} className="flex-1 bg-orange-600 py-2 rounded text-white text-xs font-bold">ПРАВКИ</button>
                       <button onClick={()=>updateStatus(req, "ОТКЛОНЕНО")} className="flex-1 bg-red-600 py-2 rounded text-white text-xs font-bold">ОТКАЗ</button>
                    </>
                 )}
                 {role === 'ACCOUNTANT' && (
                     <div className="w-full flex gap-2">
                         <input type="number" placeholder="Сумма" className="w-1/3 bg-[#0d1117] border border-gray-700 rounded text-xs text-white p-2" value={paySum} onChange={e=>setPaySum(e.target.value)}/>
                         <button onClick={()=>{if(!paySum)return alert("Сумма?"); updateStatus(req, "ОПЛАЧЕНО", {payment_sum:paySum})}} className="flex-1 bg-green-600 py-2 rounded text-white text-xs font-bold">ОПЛАТИТЬ</button>
                         <button onClick={()=>updateStatus(req, "ОТКАЗ")} className="bg-red-600 py-2 px-3 rounded text-white text-xs font-bold">Х</button>
                     </div>
                 )}
             </div>
         )}
      </div>
    );
  };

  if (!role) return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4 relative">
      <div className="text-center mb-8"><h1 className="text-4xl font-bold text-blue-500 tracking-widest">ОХМК СЭД</h1><p className="text-gray-500 text-xs mt-2">CORPORATE SYSTEM</p></div>
      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-64">
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} className="bg-[#161b22] border-2 border-[#30363d] text-white text-4xl text-center p-4 rounded-2xl outline-none focus:border-blue-500 transition" placeholder="••••" autoFocus />
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-lg shadow-lg shadow-blue-900/20 transition transform active:scale-95">ВОЙТИ</button>
      </form>
      <div className="absolute bottom-5 text-gray-700 text-[10px]">{APP_VERSION}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-300 pb-20 font-sans flex flex-col">
      {modal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><UploadCloud className="text-blue-500"/> {modal.type === 'DRAFT' ? 'Проект' : 'Финал'}</h3>
                      <button onClick={()=>setModal({...modal, open:false})}><X className="text-gray-500 hover:text-white"/></button>
                  </div>
                  {uploadStatus === 'success' ? (
                      <div className="text-center py-6"><CheckCircle size={48} className="text-green-500 mx-auto mb-2"/><p className="text-white font-bold">Загружено!</p></div>
                  ) : (
                      <div className="space-y-4">
                          <div className="bg-[#0d1117] border border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 transition relative">
                              <input type="file" id="file-upload" className="absolute inset-0 opacity-0 cursor-pointer"/>
                              <div className="text-gray-400 text-sm">Выбрать файл<br/>(PDF, DOCX)</div>
                          </div>
                          {modal.type === 'FINAL' && (
                              <div className="space-y-2">
                                  <input id="contract-num" className="w-full bg-[#0d1117] border border-gray-700 rounded p-3 text-white text-sm" placeholder="№ Договора"/>
                                  <input id="contract-amount" type="number" className="w-full bg-[#0d1117] border border-gray-700 rounded p-3 text-white text-sm" placeholder="Сумма договора"/>
                              </div>
                          )}
                          {uploadStatus === 'uploading' && (
                              <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden"><div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{width: `${uploadProgress}%`}}></div></div>
                          )}
                          <button onClick={handleUpload} disabled={uploadStatus === 'uploading'} className={`w-full py-3 rounded-xl font-bold text-white transition ${uploadStatus==='uploading' ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>{uploadStatus === 'uploading' ? `...` : 'ОТПРАВИТЬ'}</button>
                      </div>
                  )}
              </div>
          </div>
      )}
      
      {/* --- ШАПКА --- */}
      <div className="sticky top-0 z-20 bg-[#0d1117]/90 backdrop-blur border-b border-gray-800">
          <div className="max-w-7xl mx-auto p-3">
             <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-3">
                     <div className="flex flex-col">
                         <span className="text-xs text-gray-500 font-bold">РОЛЬ</span>
                         <div className="flex items-center gap-2"><b className="text-blue-400 text-lg">{role}</b>{loading && <Loader2 className="animate-spin text-gray-500" size={14}/>}</div>
                     </div>
                 </div>
                 <div className="flex gap-2">
                     <a href={SHEET_URL} target="_blank" className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-2 rounded-lg text-xs font-bold transition">
                         <Table size={14}/> <span className="hidden sm:inline">ТАБЛИЦА</span>
                     </a>
                     <button onClick={() => setRole(null)} className="text-[10px] text-red-400 border border-red-900/30 px-3 py-2 rounded-lg bg-red-900/10 hover:bg-red-900/20">ВЫХОД</button>
                 </div>
             </div>
             
             <div className="flex gap-2">
                 <div className="flex-1 flex bg-[#161b22] p-1 rounded-lg border border-gray-700">
                     <button onClick={() => switchMode('active')} className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center items-center gap-1 transition ${viewMode==='active' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><Zap size={14}/> <span className="hidden sm:inline">В РАБОТЕ</span></button>
                     <button onClick={() => switchMode('history')} className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center items-center gap-1 transition ${viewMode==='history' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><Archive size={14}/> <span className="hidden sm:inline">АРХИВ</span></button>
                 </div>
                 <div className="relative w-1/3">
                     <Search className="absolute left-3 top-2 text-gray-500" size={14}/>
                     <input type="text" placeholder="Поиск..." className="w-full h-full bg-[#161b22] border border-gray-700 rounded-lg pl-9 text-white text-xs outline-none focus:border-blue-500 transition" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 </div>
             </div>
          </div>
      </div>
      
      {/* --- СЕТКА (GRID) КОНТЕНТА --- */}
      <div className="max-w-7xl mx-auto w-full p-4 flex-grow">
          {loading && requests.length === 0 ? (
              <div className="text-center py-20 text-gray-500 animate-pulse">Загрузка данных...</div> 
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {requests.filter(r => searchQuery ? String(r.req_number).includes(searchQuery) : true).map(req => (
                      <RequestCard key={req.id} req={req} />
                  ))}
              </div>
          )}
          
          {!loading && requests.length === 0 && (
              <div className="text-center py-20 opacity-30 flex flex-col items-center">
                  <Archive size={48} className="mb-2"/>
                  <div>Список пуст</div>
              </div>
          )}
      </div>

      <div className="text-center py-4 text-gray-800 text-[10px]">{APP_VERSION}</div>
    </div>
  );
}

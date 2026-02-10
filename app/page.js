"use client";
import { useState, useEffect, useRef } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { 
  RefreshCw, Archive, Zap, Search, FileText, CheckCircle, UploadCloud, X, Loader2, 
  ExternalLink, AlertTriangle, Table, Truck, Wrench, Info, DollarSign, Calendar, 
  MapPin, Eye, Clock, BarChart3, Phone, User, Factory, AlertCircle, Briefcase, FileSignature, 
  Package, Scale, ShieldCheck, Keyboard, History, GitMerge, Settings, ChevronRight
} from 'lucide-react';

const APP_VERSION = "v6.0 (Stable Matrix)"; 
const STAND_URL = "https://script.google.com/macros/s/AKfycbwPVrrM4BuRPhbJXyFCmMY88QHQaI12Pbhj9Db9Ru0ke5a3blJV8luSONKao-DD6SNN/exec"; 
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Bf...ВАША_ССЫЛКА.../edit"; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// =================================================================================
// 🛠 ПУЛЬТ УПРАВЛЕНИЯ (МАТРИЦА ДВИЖЕНИЯ)
// =================================================================================
const WORKFLOW_RULES = {
    "DIRECTOR_CHECK": {
        role: "DIRECTOR",
        description: "Ждет одобрения Директора",
        buttons: [
            { label: "ОДОБРИТЬ", action: "ОДОБРЕНО", style: "green", 
              next_step: (req) => req.request_type === 'service' ? "KOMER_WORK" : "SKLAD_CHECK" 
            },
            { label: "ОТКЛОНИТЬ", action: "ОТКЛОНЕНО", style: "red", next_step: "CLOSED_REJECTED" }
        ]
    },
    "SKLAD_CHECK": {
        role: "SKLAD",
        description: "Проверка наличия на складе",
        buttons: [
            { label: "ЕСТЬ", action: "ЕСТЬ", style: "green-outline", next_step: "CLOSED_SUCCESS" },
            { label: "ЧАСТИЧНО", action: "Частично", style: "orange-outline", next_step: "KOMER_WORK", ask_comment: true },
            { label: "НЕТ", action: "Отсутствует", style: "red-outline", next_step: "KOMER_WORK" }
        ]
    },
    "KOMER_WORK": {
        role: "KOMER",
        parallel_role: "ECONOMIST",
        description: "Поиск поставщика / Бюджет",
        form: "commercial",
        buttons: [
            { label: "ОТПРАВИТЬ ЮРИСТУ", action: "ОДОБРЕНО", style: "pink-gradient", next_step: "FIN_DIR_CHECK", require_form: true },
            { label: "ОТКАЗ", action: "ОТКАЗ", style: "red", next_step: "CLOSED_REJECTED" }
        ]
    },
    "FIN_DIR_CHECK": {
        role: "FIN_DIR",
        description: "Согласование условий Фин.Директором",
        buttons: [
            { label: "УТВЕРДИТЬ", action: "ОДОБРЕНО", style: "green-gradient", next_step: "LAWYER_PROJECT" },
            { label: "ПРАВКИ", action: "НА ДОРАБОТКУ", style: "orange", next_step: "KOMER_FIX", ask_comment: true },
            { label: "ОТКАЗ", action: "ОТКАЗ", style: "red-outline", next_step: "CLOSED_REJECTED" }
        ]
    },
    "KOMER_FIX": {
        role: "KOMER",
        description: "Исправление замечаний",
        form: "commercial",
        buttons: [
            { label: "ИСПРАВЛЕНО -> ФИН.ДИР", action: "ИСПРАВЛЕНО", style: "blue", next_step: "FIN_DIR_CHECK", require_form: true }
        ]
    },
    "LAWYER_PROJECT": {
        role: "LAWYER",
        description: "Юрист готовит/загружает договор",
        buttons: [
            { label: "ЗАГРУЗИТЬ ПРОЕКТ", action: "upload_draft", style: "blue" },
            { label: "ОТПРАВИТЬ ФИНАНСИСТУ", action: "НА СОГЛАСОВАНИЕ", style: "indigo", next_step: "FINANCE_REVIEW", require_draft: true }
        ]
    },
    "FINANCE_REVIEW": {
        role: "FINANCE",
        description: "Финансист проверяет проект договора",
        buttons: [
            { label: "✅ СОГЛАСОВАТЬ ПРОЕКТ", action: "ПРОЕКТ СОГЛАСОВАН", style: "green", next_step: "LAWYER_FINAL" },
            { label: "ПРАВКИ", action: "НА ДОРАБОТКУ", style: "orange", next_step: "LAWYER_FIX", ask_comment: true },
            { label: "ОТКАЗ", action: "ОТКЛОНЕНО", style: "red", next_step: "CLOSED_REJECTED" }
        ]
    },
    "LAWYER_FIX": {
        role: "LAWYER",
        description: "Юрист вносит правки в проект",
        buttons: [
            { label: "ЗАГРУЗИТЬ НОВЫЙ ПРОЕКТ", action: "upload_draft", style: "blue" },
            { label: "ПОВТОРНО ФИНАНСИСТУ", action: "НА СОГЛАСОВАНИЕ", style: "indigo", next_step: "FINANCE_REVIEW", require_draft: true }
        ]
    },
    "LAWYER_FINAL": {
        role: "LAWYER",
        description: "Подписание оригинала",
        buttons: [
            { label: "ЗАГРУЗИТЬ СКАН", action: "upload_final", style: "green" },
            { label: "✔ ПОДТВЕРДИТЬ ПОДПИСАНИЕ", action: "Договор подписан", style: "green-outline", next_step: "FINANCE_DEAL", require_contract: true }
        ]
    },
    "FINANCE_DEAL": {
        role: "FINANCE",
        description: "Договор подписан. Ждет оплаты.",
        buttons: [
             { label: "ПЕРЕДАТЬ НА ОПЛАТУ", action: "СОГЛАСОВАНО НА ОПЛАТУ", style: "green", next_step: "ACCOUNTANT_EXECUTE" }
        ]
    },
    "ACCOUNTANT_EXECUTE": {
        role: "ACCOUNTANT",
        description: "Проведение оплаты",
        form: "payment",
        buttons: [
            { label: "ОТПРАВИТЬ НА СОГЛАСОВАНИЕ", action: "НА СОГЛАСОВАНИЕ", style: "blue", next_step: "FINANCE_PAY_APPROVE", require_payment_data: true }
        ]
    },
    "FINANCE_PAY_APPROVE": {
        role: "FINANCE",
        description: "Финальное добро на платеж",
        buttons: [
            { label: "✔ ОДОБРИТЬ", action: "ОДОБРЕНО К ОПЛАТЕ", style: "green", next_step: "ACCOUNTANT_FINAL" },
            { label: "ВЕРНУТЬ", action: "НА ДОРАБОТКУ", style: "orange", next_step: "ACCOUNTANT_EXECUTE" }
        ]
    },
    "ACCOUNTANT_FINAL": {
        role: "ACCOUNTANT",
        description: "Проведение платежа и закрытие",
        buttons: [
            { label: "В GOOGLE CALENDAR", action: "calendar", style: "blue-outline" },
            { label: "✅ ПРОВЕДЕНО (ЗАКРЫТЬ)", action: "ОПЛАЧЕНО", style: "green", next_step: "CLOSED_SUCCESS" }
        ]
    }
};

export default function SED() {
  const [role, setRole] = useState(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('active'); 
  const [modal, setModal] = useState({ open: false, req: null, type: '' }); 
  const [historyModal, setHistoryModal] = useState({ open: false, req: null });
  const [schemeModal, setSchemeModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const pinInputRef = useRef(null);

  const ROLES = {
    "2223": "DIRECTOR", "0500": "KOMER", "777": "FIN_DIR", "333": "LAWYER", "444": "FINANCE", 
    "222": "ACCOUNTANT", "111": "ECONOMIST", "2014": "SKLAD_CENTRAL", "2525": "SKLAD_ZAP", 
    "197": "SKLAD_STOL", "504": "SKLAD_MTF", "505": "SKLAD_MEHTOK", "506": "SKLAD_ZNKI",
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
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });

    if (mode === 'history') query = query.limit(100);
    else {
        let stepsForRole = [];
        for (const [stepKey, config] of Object.entries(WORKFLOW_RULES)) {
            if (config.role === userRole || config.role.includes(userRole) || 
               (userRole.includes("SKLAD") && config.role === "SKLAD") ||
               config.parallel_role === userRole) {
                stepsForRole.push(stepKey);
            }
        }
        if (userRole === "DIRECTOR") {
             query = query.or(`current_step.in.(${stepsForRole.join(',')}),status.eq.new,status.eq.В ОБРАБОТКЕ`);
        } else if (userRole.includes("SKLAD")) {
             query = query.eq('current_step', 'SKLAD_CHECK');
        } else {
             if (stepsForRole.length > 0) query = query.in('current_step', stepsForRole);
             else query = query.eq('id', 0); 
        }
        if (userRole === "ECONOMIST") query = query.or('current_step.eq.KOMER_WORK,current_step.eq.KOMER_FIX');
    }

    const { data } = await query;
    let filtered = data || [];

    if (mode === 'active') {
        if (userRole && userRole.includes("SKLAD")) {
            filtered = filtered.filter(req => {
                if (req.request_type === 'service') return false;
                const wId = req.target_warehouse_code;
                if (!wId || wId === "central") return userRole === "SKLAD_CENTRAL";
                if (wId === "parts") return userRole === "SKLAD_ZAP";
                return userRole === "SKLAD_CENTRAL";
            });
        }
        if (userRole === "LAWYER") filtered = filtered.filter(req => req.status !== "ОПЛАЧЕНО");
    }
    setRequests(filtered);
    setLoading(false);
  };

  const switchMode = (mode) => { setViewMode(mode); fetchRequests(role, mode); };

  const handleAction = async (req, btn) => {
      if (btn.ask_comment) {
          const c = prompt("Комментарий:");
          if (!c) return;
          req.temp_comment = c;
      }
      if (btn.action === 'upload_draft') { setModal({open:true, req:req, type:'DRAFT'}); return; }
      if (btn.action === 'upload_final') { setModal({open:true, req:req, type:'FINAL'}); return; }
      if (btn.action === 'calendar') { 
          const title = encodeURIComponent(`Оплата: ${req.item_name} (${req.final_pay_sum} ₸)`);
          const details = encodeURIComponent(`Заявка №${req.req_number}\nПоставщик: ${req.legal_info?.seller}`);
          const dateStr = req.payment_date ? req.payment_date.replace(/-/g, '') : '';
          window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}/${dateStr}`, '_blank');
          return; 
      }

      if (btn.require_form && (!req.legal_info?.seller || !req.legal_info?.total)) return alert("Заполните форму!");
      if (btn.require_draft && !req.draft_url) return alert("Сначала загрузите проект!");
      if (btn.require_contract && !req.contract_url) return alert("Сначала загрузите скан!");
      if (btn.require_payment_data && (!req.final_pay_sum || !req.payment_date)) return alert("Заполните сумму и дату!");

      if (!confirm(`Выполнить: ${btn.label}?`)) return;

      let nextStep = btn.next_step;
      if (typeof nextStep === 'function') nextStep = nextStep(req);

      let updates = { status: btn.action, last_role: role };
      if (role === 'ECONOMIST') updates.economist_status = btn.label;
      else updates.current_step = nextStep;

      if (role.includes('SKLAD')) updates.warehouse_status = btn.action;
      if (role === 'KOMER' && req.temp_legal_info) updates.legal_info = req.temp_legal_info;
      if (role === 'FIN_DIR') updates.fin_dir_status = btn.action;
      if (req.temp_comment) updates.fix_comment = req.temp_comment;
      if (req.temp_pay_sum) updates.final_pay_sum = req.temp_pay_sum;
      if (req.temp_pay_date) updates.payment_date = req.temp_pay_date;

      const history = req.history || [];
      updates.history = [...history, { role: role, action: btn.label, date: new Date().toLocaleString("ru-RU"), comment: req.temp_comment }];

      setRequests(prev => prev.filter(r => r.id !== req.id));
      if (role === 'ECONOMIST') setRequests(prev => prev.map(r => r.id === req.id ? { ...r, economist_status: btn.label } : r));

      await supabase.from('requests').update(updates).eq('id', req.id);
      fetchRequests(role, viewMode);
  };

  const handleUpload = async () => {
      const fileInput = document.getElementById('file-upload');
      const contractNum = document.getElementById('contract-num')?.value || '';
      const amount = document.getElementById('contract-amount')?.value || '';
      if (!fileInput.files[0]) return alert("Выберите файл!");
      if (modal.type === 'FINAL' && (!contractNum || !amount)) return alert("Заполните данные!");

      const file = fileInput.files[0];
      setUploadStatus('uploading');
      let progress = 0;
      const interval = setInterval(() => { progress += 10; if (progress > 90) progress = 90; setUploadProgress(progress); }, 300);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async function() {
          try {
              await fetch(STAND_URL, {
                  method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file: reader.result, fileName: file.name, reqNum: modal.req.req_number, reqId: modal.req.id, contractNum: contractNum, amount: amount, type: modal.type })
              });
              clearInterval(interval); setUploadProgress(100); setUploadStatus('success');
              setTimeout(async () => { setModal({ open: false, req: null, type: '' }); setUploadStatus(''); fetchRequests(role, viewMode); }, 2000); 
          } catch (e) { clearInterval(interval); setUploadStatus('error'); alert("Ошибка: " + e.message); }
      };
  };

  const RequestCard = ({ req }) => {
    const currentConfig = WORKFLOW_RULES[req.current_step] || { buttons: [] };
    let showButtons = false;
    if (role === 'ECONOMIST' && currentConfig.parallel_role === 'ECONOMIST') showButtons = true;
    else if (role.includes('SKLAD') && currentConfig.role === 'SKLAD') showButtons = true;
    else if (currentConfig.role === role) showButtons = true;

    const [formData, setFormData] = useState(req.legal_info || {
        seller: '', buyer: 'ТОО ОХМК', subject: req.item_name, qty: req.quantity || '1', price_unit: '', total: '', payment_terms: 'Постоплата', 
        delivery_place: 'Мира 2А', pickup: 'ДА', delivery_date: '', quality: 'Новое', warranty: '12 месяцев', initiator: req.initiator, vat: 'ДА'
    });
    const [paySum, setPaySum] = useState(req.final_pay_sum || '');
    const [payDate, setPayDate] = useState(req.payment_date || '');

    useEffect(() => {
        if(formData.qty && formData.price_unit) {
            const sum = (parseFloat(formData.qty) * parseFloat(formData.price_unit)).toFixed(2);
            setFormData(prev => ({...prev, total: sum}));
            req.temp_legal_info = {...formData, total: sum};
        } else { req.temp_legal_info = formData; }
    }, [formData]);
    useEffect(() => { req.temp_pay_sum = paySum; req.temp_pay_date = payDate; }, [paySum, payDate]);

    const isService = req.request_type === 'service';
    const isUrgent = (req.urgency || "").toLowerCase().includes("срочно");
    let borderColor = 'border-[#30363d]';
    if (req.status.includes('ОТКАЗ') || req.status.includes('ОТКЛОНЕНО')) borderColor = 'border-red-900';
    else if (req.status === 'ОПЛАЧЕНО') borderColor = 'border-green-900';
    if (isUrgent) borderColor = 'border-red-500';

    return (
      <div className={`bg-[#161b22] border ${borderColor} rounded-xl p-5 shadow-xl relative overflow-hidden group flex flex-col h-full`}>
         <div className="flex justify-between items-start mb-2 pl-3">
            <div><h3 className="text-xl font-bold flex items-center gap-2 text-white">#{req.req_number}</h3><div className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</div></div>
            <div className="flex flex-col items-end gap-1">
                <div className={`px-2 py-1 rounded text-xs border font-bold ${req.status.includes('ОТКАЗ') ? 'bg-red-900/40 text-red-400' : 'bg-gray-800 text-gray-400'}`}>{req.status}</div>
                <button onClick={() => setHistoryModal({open: true, req: req})} className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition"><History size={10}/> История</button>
                {isUrgent && <div className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded animate-pulse font-bold flex items-center gap-1"><AlertCircle size={10}/> СРОЧНО</div>}
            </div>
         </div>
         <div className="pl-3 mb-3 flex items-center gap-3 bg-[#0d1117] p-2 rounded border border-gray-800">
             <div className="bg-gray-800 p-1.5 rounded-full"><User size={14} className="text-gray-400"/></div>
             <div className="flex-1"><div className="text-[10px] text-gray-500">Инициатор</div><div className="text-xs text-gray-300 font-medium truncate">{req.initiator || "Неизвестно"}</div></div>
             {req.phone && (<a href={`tel:${req.phone}`} className="bg-green-900/30 p-2 rounded-full text-green-400 hover:bg-green-900/50 border border-green-900/50"><Phone size={14}/></a>)}
         </div>
         <div className="text-sm pl-3 mb-4 space-y-2 text-gray-300 flex-grow">
            <div className="flex items-start gap-2">
                {isService ? <Wrench className="text-purple-400 shrink-0" size={18}/> : <Truck className="text-blue-400 shrink-0" size={18}/>}
                <div>
                    <b className={`${isService ? 'text-purple-400' : 'text-blue-400'} text-[10px] uppercase block mb-1`}>{isService ? 'Услуга / Работа' : 'Товар'}</b>
                    <span className="text-white text-base font-bold leading-tight block">{req.item_name}</span>
                    {req.manufacturer && !isService && <div className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Factory size={10}/> {req.manufacturer}</div>}
                    {req.service_type && isService && <div className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Info size={10}/> {req.service_type}</div>}
                </div>
            </div>
            {req.purpose && <div className="bg-[#0d1117] p-2 rounded border border-gray-800 mt-2"><div className="text-[10px] text-gray-500 mb-0.5">Цель приобретения:</div><span className="text-gray-300 text-xs italic">"{req.purpose}"</span></div>}
            {req.warehouse_status && !isService && (<div className="pt-2 border-t border-gray-800 mt-1 flex justify-between items-center"><span className="text-[10px] text-gray-500">СКЛАД:</span> <span className={`text-xs font-bold ${req.warehouse_status==='ЕСТЬ'?'text-green-400':'text-red-400'}`}>{req.warehouse_status.toUpperCase()}</span></div>)}
            {req.economist_status ? (<div className={`pt-2 border-t border-gray-800 mt-1 flex justify-between items-center ${req.economist_status==='ПО ПЛАНУ' ? 'text-green-500' : 'text-orange-500'}`}><span className="text-[10px] font-bold flex items-center gap-1"><BarChart3 size={12}/> БЮДЖЕТ:</span> <span className="text-xs font-bold bg-[#0d1117] px-2 py-0.5 rounded border border-current">{req.economist_status}</span></div>) : ((role === 'KOMER' || role === 'FIN_DIR' || role === 'LAWYER') && (<div className="pt-2 border-t border-gray-800 mt-1 flex justify-between items-center text-gray-600"><span className="text-[10px] font-bold flex items-center gap-1"><BarChart3 size={12}/> БЮДЖЕТ:</span> <span className="text-[10px] italic">Ожидание...</span></div>))}
         </div>
         {(req.draft_url || req.contract_url) && (
             <div className="pl-3 mb-4 space-y-2">
                 {req.draft_url && <a href={req.draft_url} target="_blank" className="flex items-center gap-2 bg-blue-900/20 text-blue-400 p-2 rounded border border-blue-900/50 hover:bg-blue-900/40 transition"><FileText size={16}/> <span className="text-xs font-bold">Проект договора</span> <ExternalLink size={12} className="ml-auto"/></a>}
                 {req.contract_url && <a href={req.contract_url} target="_blank" className="flex items-center gap-2 bg-green-900/20 text-green-400 p-2 rounded border border-green-900/50 hover:bg-green-900/40 transition"><CheckCircle size={16}/> <span className="text-xs font-bold">Подписанный скан</span> <ExternalLink size={12} className="ml-auto"/></a>}
             </div>
         )}
         {showButtons && currentConfig.form === 'commercial' && (
             <div className="pl-3 bg-pink-900/10 border-l-2 border-pink-500 p-3 rounded mb-3 w-full text-xs">
                 <div className="flex items-center gap-2 mb-3"><Briefcase size={14} className="text-pink-500"/><span className="text-xs font-bold text-pink-400">ПОДГОТОВКА ДОГОВОРА</span></div>
                 <div className="space-y-2 mb-2">
                     <div className="grid grid-cols-2 gap-1"><input className="bg-[#0d1117] border border-gray-700 p-1.5 rounded text-white" placeholder="Продавец" value={formData.seller} onChange={e=>setFormData({...formData, seller: e.target.value})}/><input className="bg-[#0d1117] border border-gray-700 p-1.5 rounded text-white" placeholder="Покупатель" value={formData.buyer} onChange={e=>setFormData({...formData, buyer: e.target.value})}/></div>
                     <div className="grid grid-cols-3 gap-1"><input type="number" className="bg-gray-800 border border-gray-700 p-1.5 rounded text-white" placeholder="Кол-во" value={formData.qty} onChange={e=>setFormData({...formData, qty: e.target.value})}/><input type="number" className="bg-gray-800 border border-gray-700 p-1.5 rounded text-white" placeholder="Цена" value={formData.price_unit} onChange={e=>setFormData({...formData, price_unit: e.target.value})}/><input className="bg-transparent text-right font-bold text-green-400 p-1.5" value={formData.total} readOnly/></div>
                     <div className="grid grid-cols-2 gap-1"><input className="bg-[#0d1117] border border-gray-700 p-1.5 rounded text-white" placeholder="Место" value={formData.delivery_place} onChange={e=>setFormData({...formData, delivery_place: e.target.value})}/><input className="bg-[#0d1117] border border-gray-700 p-1.5 rounded text-white" placeholder="Срок" value={formData.delivery_date} onChange={e=>setFormData({...formData, delivery_date: e.target.value})}/></div>
                     <input className="w-full bg-[#0d1117] border border-gray-700 p-1.5 rounded text-white" placeholder="Оплата" value={formData.payment_terms} onChange={e=>setFormData({...formData, payment_terms: e.target.value})}/>
                 </div>
             </div>
         )}
         {showButtons && currentConfig.form === 'payment' && (
             <div className="flex gap-2 mb-2"><input type="number" placeholder="Сумма" className="w-1/2 bg-[#0d1117] border border-gray-700 rounded text-xs text-white p-2" value={paySum} onChange={e=>setPaySum(e.target.value)}/><input type="date" className="w-1/2 bg-[#0d1117] border border-gray-700 rounded text-xs text-white p-2" value={payDate} onChange={e=>setPayDate(e.target.value)}/></div>
         )}
         {viewMode === 'active' && showButtons && (
             <div className="pl-3 flex flex-wrap gap-2 mt-auto">
                 {currentConfig.buttons.map((btn, idx) => {
                     let btnClass = "flex-1 py-2.5 rounded text-xs font-bold transition flex items-center justify-center gap-2 ";
                     if (btn.style.includes('green')) btnClass += "bg-green-600 text-white hover:bg-green-500 ";
                     else if (btn.style.includes('red')) btnClass += "bg-red-900/50 border border-red-800 text-red-300 hover:bg-red-900 ";
                     else if (btn.style.includes('blue')) btnClass += "bg-blue-600 text-white hover:bg-blue-500 ";
                     else if (btn.style.includes('orange')) btnClass += "bg-orange-600 text-white hover:bg-orange-500 ";
                     else if (btn.style.includes('indigo')) btnClass += "bg-indigo-600 text-white hover:bg-indigo-500 ";
                     else if (btn.style.includes('pink')) btnClass += "bg-gradient-to-r from-pink-700 to-pink-600 text-white hover:from-pink-600 hover:to-pink-500 shadow-lg shadow-pink-900/20 ";
                     else btnClass += "bg-gray-700 text-white ";
                     return <button key={idx} onClick={() => handleAction(req, btn)} className={btnClass}>{btn.label}</button>;
                 })}
             </div>
         )}
      </div>
    );
  };
  
  if (!role) return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4 relative">
      <div className="text-center mb-8"><h1 className="text-4xl font-bold text-blue-500 tracking-widest">ОХМК СЭД</h1><p className="text-gray-500 text-xs mt-2">CORPORATE SYSTEM</p></div>
      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-64">
        <div className="relative">
            <input ref={pinInputRef} type="password" inputMode="numeric" pattern="[0-9]*" value={pin} onChange={e => setPin(e.target.value)} className="bg-[#161b22] border-2 border-[#30363d] text-white text-4xl text-center p-4 rounded-2xl outline-none focus:border-blue-500 transition w-full" placeholder="••••" autoFocus />
            <button type="button" onClick={() => pinInputRef.current?.focus()} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 p-2"><Keyboard size={20}/></button>
        </div>
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-lg shadow-lg shadow-blue-900/20 transition transform active:scale-95">ВОЙТИ</button>
      </form>
      <div className="absolute bottom-5 text-gray-700 text-[10px]">{APP_VERSION}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-300 pb-20 font-sans flex flex-col">
      {schemeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-auto">
              <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl relative">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2"><GitMerge className="text-blue-500"/> КАРТА МАРШРУТОВ</h3>
                      <button onClick={()=>setSchemeModal(false)}><X className="text-gray-500 hover:text-white"/></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(WORKFLOW_RULES).map(([key, rule]) => (
                          <div key={key} className="bg-[#0d1117] border border-gray-700 rounded p-3 text-xs">
                              <div className="font-bold text-blue-400 mb-1">{key}</div>
                              <div className="text-gray-500 mb-2">{rule.description}</div>
                              <div className="space-y-1">{rule.buttons.map((b, i) => (<div key={i} className="flex items-center gap-2"><div className={`px-2 py-0.5 rounded text-[10px] bg-gray-800 text-white`}>{b.label}</div><ChevronRight size={10} className="text-gray-600"/><div className="text-[10px] text-gray-400">{typeof b.next_step === 'function' ? 'АВТО-ВЫБОР' : (b.next_step || 'Без перехода')}</div></div>))}</div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
      {historyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock size={20} className="text-blue-500"/> История заявки</h3>
                 <button onClick={()=>setHistoryModal({open:false, req:null})}><X className="text-gray-500 hover:text-white"/></button>
              </div>
              <div className="overflow-y-auto pr-2 space-y-4">
                  {(!historyModal.req.history || historyModal.req.history.length === 0) ? (
                      <div className="text-center text-gray-500 text-xs py-10">История пуста</div>
                  ) : (
                      [...historyModal.req.history].reverse().map((step, idx) => (
                          <div key={idx} className="relative pl-6 border-l-2 border-gray-800 last:border-0 pb-4">
                              <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-[#161b22]"></div>
                              <div className="text-xs text-gray-500 mb-0.5">{step.date}</div>
                              <div className="text-sm font-bold text-white mb-1">{step.role}</div>
                              <div className="text-xs text-gray-300 bg-gray-800 px-2 py-0.5 rounded inline-block border border-gray-700">{step.action}</div>
                              {step.comment && <div className="mt-2 bg-[#0d1117] p-2 rounded border border-gray-800 text-xs text-gray-400 italic">"{step.comment}"</div>}
                          </div>
                      ))
                  )}
              </div>
           </div>
        </div>
      )}
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
                          {uploadStatus === 'uploading' && <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden"><div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{width: `${uploadProgress}%`}}></div></div>}
                          <button onClick={handleUpload} disabled={uploadStatus === 'uploading'} className={`w-full py-3 rounded-xl font-bold text-white transition ${uploadStatus==='uploading' ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>{uploadStatus === 'uploading' ? `...` : 'ОТПРАВИТЬ'}</button>
                      </div>
                  )}
              </div>
          </div>
      )}
      <div className="sticky top-0 z-20 bg-[#0d1117]/90 backdrop-blur border-b border-gray-800">
          <div className="max-w-7xl mx-auto p-3">
             <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-3"><div className="flex flex-col"><span className="text-xs text-gray-500 font-bold">РОЛЬ</span><div className="flex items-center gap-2"><b className="text-blue-400 text-lg">{role}</b>{loading && <Loader2 className="animate-spin text-gray-500" size={14}/>}</div></div></div>
                 <div className="flex gap-2">
                     <button onClick={() => setSchemeModal(true)} className="flex items-center gap-1 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-500/30 text-blue-300 px-3 py-2 rounded-lg text-xs font-bold transition"><Settings size={14}/> СХЕМА</button>
                     <a href={SHEET_URL} target="_blank" className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-2 rounded-lg text-xs font-bold transition"><Table size={14}/> <span className="hidden sm:inline">ТАБЛИЦА</span></a>
                     <button onClick={() => setRole(null)} className="text-[10px] text-red-400 border border-red-900/30 px-3 py-2 rounded-lg bg-red-900/10 hover:bg-red-900/20">ВЫХОД</button>
                 </div>
             </div>
             <div className="flex gap-2">
                 <div className="flex-1 flex bg-[#161b22] p-1 rounded-lg border border-gray-700">
                     <button onClick={() => switchMode('active')} className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center items-center gap-1 transition ${viewMode==='active' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><Zap size={14}/> <span className="hidden sm:inline">В РАБОТЕ</span></button>
                     <button onClick={() => switchMode('history')} className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center items-center gap-1 transition ${viewMode==='history' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><Archive size={14}/> <span className="hidden sm:inline">АРХИВ</span></button>
                 </div>
                 <div className="relative w-1/3"><Search className="absolute left-3 top-2 text-gray-500" size={14}/><input type="text" placeholder="Поиск..." className="w-full h-full bg-[#161b22] border border-gray-700 rounded-lg pl-9 text-white text-xs outline-none focus:border-blue-500 transition" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
             </div>
          </div>
      </div>
      <div className="max-w-7xl mx-auto w-full p-4 flex-grow">
          {loading && requests.length === 0 ? (<div className="text-center py-20 text-gray-500 animate-pulse">Загрузка данных...</div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{requests.filter(r => searchQuery ? String(r.req_number).includes(searchQuery) : true).map(req => (<RequestCard key={req.id} req={req} />))}</div>)}
          {!loading && requests.length === 0 && <div className="text-center py-20 opacity-30 flex flex-col items-center"><Archive size={48} className="mb-2"/><div>Список пуст</div></div>}
      </div>
      <div className="text-center py-4 text-gray-800 text-[10px]">{APP_VERSION}</div>
    </div>
  );
}

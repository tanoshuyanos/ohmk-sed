"use client";
import { useState, useEffect, useRef } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { 
  RefreshCw, Archive, Zap, Search, FileText, CheckCircle, UploadCloud, X, Loader2, 
  ExternalLink, AlertTriangle, Table, Truck, Wrench, Info, DollarSign, Calendar, 
  MapPin, Eye, Clock, BarChart3, Phone, User, Factory, AlertCircle, Briefcase, FileSignature, 
  Package, Scale, ShieldCheck, Keyboard, History, GitMerge, Settings, ChevronRight
} from 'lucide-react';

const APP_VERSION = "v7.0 (Stable Monolith + Routes)"; 
const STAND_URL = "https://script.google.com/macros/s/AKfycbwPVrrM4BuRPhbJXyFCmMY88QHQaI12Pbhj9Db9Ru0ke5a3blJV8luSONKao-DD6SNN/exec"; 
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Bf...ВАША_ССЫЛКА.../edit"; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
// --- НОВАЯ ЛОГИКА: ПИШЕМ В ИСТОРИЮ, БАЗА САМА ОБНОВЛЯЕТ СТАТУС ---
  const handleAction = async (req, btn) => {
      if (btn.ask_comment) {
          const c = prompt("Комментарий:");
          if (!c) return;
          req.temp_comment = c;
      }
      // Спец. действия (загрузка, календарь) - без изменений
      if (btn.action === 'upload_draft') { setModal({open:true, req:req, type:'DRAFT'}); return; }
      if (btn.action === 'upload_final') { setModal({open:true, req:req, type:'FINAL'}); return; }
      if (btn.action === 'calendar') { 
          const title = encodeURIComponent(`Оплата: ${req.item_name} (${req.final_pay_sum} ₸)`);
          const details = encodeURIComponent(`Заявка №${req.req_number}\nПоставщик: ${req.legal_info?.seller}`);
          const dateStr = req.payment_date ? req.payment_date.replace(/-/g, '') : '';
          window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}/${dateStr}`, '_blank');
          return; 
      }

      // Валидация форм
      if (btn.require_form && (!req.legal_info?.seller || !req.legal_info?.total)) return alert("Заполните форму!");
      if (btn.require_draft && !req.draft_url) return alert("Сначала загрузите проект!");
      if (btn.require_contract && !req.contract_url) return alert("Сначала загрузите скан!");
      if (btn.require_payment_data && (!req.final_pay_sum || !req.payment_date)) return alert("Заполните сумму и дату!");

      if (!confirm(`Выполнить: ${btn.label}?`)) return;

      // 1. Вычисляем следующий шаг (по Матрице)
      let nextStep = btn.next_step;
      if (typeof nextStep === 'function') nextStep = nextStep(req);
      
      // Если это Экономист (параллельно) - шаг не меняем, берем текущий
      if (role === 'ECONOMIST') nextStep = req.current_step;

      // 2. Сначала обновляем ДАННЫЕ в заявке (цены, ссылки, комментарии)
      // Это не меняет статус, только инфу.
      let dataUpdates = { last_role: role };
      if (role.includes('SKLAD')) dataUpdates.warehouse_status = btn.action;
      if (role === 'KOMER' && req.temp_legal_info) dataUpdates.legal_info = req.temp_legal_info;
      if (role === 'FIN_DIR') dataUpdates.fin_dir_status = btn.action;
      if (role === 'ECONOMIST') dataUpdates.economist_status = btn.label;
      if (req.temp_comment) dataUpdates.fix_comment = req.temp_comment;
      if (req.temp_pay_sum) dataUpdates.final_pay_sum = req.temp_pay_sum;
      if (req.temp_pay_date) dataUpdates.payment_date = req.temp_pay_date;

      await supabase.from('requests').update(dataUpdates).eq('id', req.id);

      // 3. САМОЕ ВАЖНОЕ: Добавляем запись в request_moves
      // Именно это действие запустит Триггер в базе, который обновит статус и шаг
      const { error } = await supabase.from('request_moves').insert({
          request_id: req.id,
          role: role,
          action: btn.label, // Название кнопки (Одобрить)
          status: btn.action, // Статус (ОДОБРЕНО)
          step: nextStep,     // Технический шаг (KOMER_WORK)
          comment: req.temp_comment || null
      });

      if (error) {
          alert("Ошибка движения: " + error.message);
      } else {
          // Убираем заявку с экрана (оптимистично), так как она ушла на другой этап
          if (role !== 'ECONOMIST') {
              setRequests(prev => prev.filter(r => r.id !== req.id));
          } else {
              // Экономист остается на странице
              fetchRequests(role, viewMode);
          }
      }
  };
// =================================================================================
// 🛠 НАСТРОЙКА ПУТЕЙ (ROUTES)
// Менять путь движения заявок ЗДЕСЬ. Это безопасно.
// =================================================================================
const ROUTES = {
    // Куда идет УСЛУГА после Директора?
    AFTER_DIRECTOR_SERVICE: "KOMER_WORK", 
    
    // Куда идет ТОВАР после Директора?
    AFTER_DIRECTOR_GOODS: "SKLAD_CHECK",

    // Куда идет ТОВАР, если его НЕТ на складе?
    AFTER_SKLAD_MISSING: "KOMER_WORK",

    // Куда идет заявка после Экономиста? (В данной схеме Экономист параллелен, шаг не меняет)
    AFTER_ECONOMIST: "KOMER_WORK", 

    // Куда идет заявка после Коммерческого?
    AFTER_KOMER: "FIN_DIR_CHECK",

    // Куда идет заявка после Фин.Директора?
    AFTER_FIN_DIR: "LAWYER_PROJECT",

    // Куда идет заявка после Юриста (проект готов)?
    AFTER_LAWYER_DRAFT: "FINANCE_REVIEW",

    // Куда идет заявка после Финансиста (проект ок)?
    AFTER_FINANCE_APPROVE: "LAWYER_FINAL",

    // Куда идет заявка после Юриста (подписано)?
    AFTER_LAWYER_SIGNED: "FINANCE_DEAL",

    // Куда идет заявка после Финансиста (на оплату)?
    AFTER_FINANCE_DEAL: "ACCOUNTANT_EXECUTE",

    // Куда идет заявка после Бухгалтера (согласование)?
    AFTER_ACCOUNTANT_EXECUTE: "FINANCE_PAY_APPROVE",

    // Куда идет заявка после Финансиста (финал оплаты)?
    AFTER_FINANCE_FINAL: "ACCOUNTANT_FINAL",

    // Финиш
    DONE: "CLOSED_SUCCESS",
    REJECT: "CLOSED_REJECTED"
};
// =================================================================================

export default function SED() {
  const [role, setRole] = useState(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('active'); 
  
  // Модальные окна
  const [modal, setModal] = useState({ open: false, req: null, type: '' }); 
  const [historyModal, setHistoryModal] = useState({ open: false, req: null });
  const [schemeModal, setSchemeModal] = useState(false);
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const pinInputRef = useRef(null);

  const ROLES = {
    "2223": "DIRECTOR", "0500": "KOMER", "777": "FIN_DIR", 
    "333": "LAWYER", "444": "FINANCE", "222": "ACCOUNTANT",
    "111": "ECONOMIST", 
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
        // --- ЛОГИКА ФИЛЬТРАЦИИ (КТО ЧТО ВИДИТ) ---
        if (userRole === "DIRECTOR") {
            query = query.or('current_step.eq.DIRECTOR_CHECK,status.eq.В ОБРАБОТКЕ,status.eq.new,status.eq.director_review');
        }
        else if (userRole === "FIN_DIR") {
            query = query.eq('status', 'ДОГОВОР').neq('fin_dir_status', 'ОДОБРЕНО').neq('fin_dir_status', 'ОТКАЗ');
        }
        else if (userRole === "ECONOMIST") {
            // Видит то, что у Комера (Параллельно)
            query = query.or('current_step.eq.KOMER_WORK,current_step.eq.KOMER_FIX');
        }
        else if (userRole === "KOMER") {
            query = query.or('status.eq.ОДОБРЕНО,fin_dir_status.eq.НА ДОРАБОТКУ').or('current_step.eq.KOMER_WORK,current_step.eq.KOMER_FIX');
        }
        else if (userRole && userRole.includes("SKLAD")) {
            query = query.eq('current_step', 'SKLAD_CHECK');
        }
        else if (userRole === "LAWYER") {
            query = query.or('current_step.eq.LAWYER_PROJECT,current_step.eq.LAWYER_FINAL,current_step.eq.LAWYER_FIX,status.eq.ПРОЕКТ СОГЛАСОВАН');
        }
        else if (userRole === "FINANCE") {
            query = query.or('current_step.eq.FINANCE_REVIEW,current_step.eq.FINANCE_DEAL,status.eq.В РАБОТЕ,status.eq.Договор подписан,status.eq.НА СОГЛАСОВАНИИ ОПЛАТЫ');
        }
        else if (userRole === "ACCOUNTANT") {
            query = query.or('current_step.eq.ACCOUNTANT_PAY,current_step.eq.ACCOUNTANT_EXECUTE,status.eq.СОГЛАСОВАНО НА ОПЛАТУ').neq('status', 'ОПЛАЧЕНО');
        }
    }

    const { data } = await query;
    let filtered = data || [];

    // Клиентские фильтры
    if (currentMode === 'active') {
        if (userRole && userRole.includes("SKLAD")) {
            filtered = filtered.filter(req => {
                if (req.request_type === 'service') return false; 
                const wId = req.target_warehouse_code;
                if (!wId || wId === "central") return userRole === "SKLAD_CENTRAL";
                if (wId === "parts") return userRole === "SKLAD_ZAP";
                return userRole === "SKLAD_CENTRAL";
            });
        }
        if (userRole === "LAWYER") filtered = filtered.filter(req => req.status !== "ОПЛАЧЕНО" && req.status !== "ОДОБРЕНО К ОПЛАТЕ");
    }
    setRequests(filtered);
    setLoading(false);
  };

  const switchMode = (mode) => { setViewMode(mode); fetchRequests(role, mode); };

  const openGoogleCalendar = (req) => {
    const title = encodeURIComponent(`Оплата: ${req.item_name} (${req.final_pay_sum} ₸)`);
    const details = encodeURIComponent(`Заявка №${req.req_number}\nПоставщик: ${req.legal_info?.seller || ''}\nСумма: ${req.final_pay_sum}`);
    const dateStr = req.payment_date ? req.payment_date.replace(/-/g, '') : '';
    const dates = `${dateStr}/${dateStr}`; 
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`, '_blank');
  };

  // --- ЛОГИКА ОБНОВЛЕНИЯ СТАТУСОВ (С ИСТОРИЕЙ) ---
  const updateStatus = async (req, action, extraUpdates = {}) => {
    if (role !== 'LAWYER' && role !== 'ECONOMIST' && !confirm(`Выполнить: ${action}?`)) return;
    
    let comments = null;
    if (role.includes('SKLAD') && action === 'Частично') {
        comments = prompt("Напишите, ЧТО ИМЕННО есть на складе:");
        if (!comments) return; 
    }

    // Оптимистичное удаление из списка (кроме Экономиста)
    if (role !== 'LAWYER' && role !== 'ECONOMIST') setRequests(prev => prev.filter(r => r.id !== req.id));
    if (role === 'ECONOMIST') setRequests(prev => prev.map(r => r.id === req.id ? { ...r, economist_status: action } : r));

    let updates = { ...extraUpdates, last_role: role };
    if (comments) updates.fix_comment = "СКЛАД: " + comments; 

    // Запись в историю
    const currentHistory = req.history || [];
    updates.history = [...currentHistory, {
        role: role,
        action: action,
        date: new Date().toLocaleString("ru-RU", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        comment: comments || extraUpdates.fix_comment || null
    }];

    let newStatus = req.status; 
    let nextStep = req.current_step;

    // --- ПРИМЕНЕНИЕ ROUTES (МАРШРУТОВ) ---
    if (role === 'DIRECTOR') {
        if (action === 'ОДОБРЕНО') { 
            newStatus = "ОДОБРЕНО"; 
            if (req.request_type === 'service') nextStep = ROUTES.AFTER_DIRECTOR_SERVICE;
            else nextStep = ROUTES.AFTER_DIRECTOR_GOODS;
        } else { 
            newStatus = "ОТКЛОНЕНО"; nextStep = ROUTES.REJECT; 
        }
    }
    else if (role.includes('SKLAD')) {
        updates.warehouse_status = action;
        if (action.toUpperCase() === 'ЕСТЬ') nextStep = ROUTES.DONE;
        else nextStep = ROUTES.AFTER_SKLAD_MISSING;
    }
    else if (role === 'ECONOMIST') {
        updates.economist_status = action;
        nextStep = req.current_step; // Не меняет шаг
    }
    else if (role === 'KOMER') {
        if (action === 'ОТКАЗ') { newStatus = "ОТКАЗ"; nextStep = ROUTES.REJECT; }
        else { 
            newStatus = "ДОГОВОР"; 
            nextStep = ROUTES.AFTER_KOMER; 
            updates.fin_dir_status = "НА ПРОВЕРКЕ"; 
        }
    }
    else if (role === 'FIN_DIR') {
        updates.fin_dir_status = action;
        if (action === 'ОДОБРЕНО') nextStep = ROUTES.AFTER_FIN_DIR;
        else if (action === 'НА ДОРАБОТКУ') { nextStep = "KOMER_FIX"; newStatus = "ОДОБРЕНО"; }
        else { newStatus = "ОТКАЗ ФИН.ДИР"; nextStep = ROUTES.REJECT; }
    }
    else if (role === 'LAWYER') {
        if (action === 'НА СОГЛАСОВАНИЕ') { newStatus = "НА СОГЛАСОВАНИИ У ФИН"; nextStep = ROUTES.AFTER_LAWYER_DRAFT; }
        else if (action === 'Договор подписан') { newStatus = "Договор подписан"; nextStep = ROUTES.AFTER_LAWYER_SIGNED; }
    }
    else if (role === 'FINANCE') {
        if (action === 'ПРОЕКТ СОГЛАСОВАН') { newStatus = "ПРОЕКТ СОГЛАСОВАН"; nextStep = ROUTES.AFTER_FINANCE_APPROVE; }
        else if (action === 'НА ДОРАБОТКУ') { newStatus = "НА ДОРАБОТКУ"; nextStep = "LAWYER_FIX"; }
        else if (action === 'ОПЛАТА СОГЛАСОВАНА') { newStatus = "СОГЛАСОВАНО НА ОПЛАТУ"; nextStep = ROUTES.AFTER_FINANCE_DEAL; }
        else if (action === 'ОТКЛОНЕНО') { newStatus = "ОТКЛОНЕНО ФИН"; nextStep = ROUTES.REJECT; }
    }
    else if (role === 'ACCOUNTANT') {
        if (action === 'НА СОГЛАСОВАНИЕ') { newStatus = "НА СОГЛАСОВАНИИ ОПЛАТЫ"; nextStep = ROUTES.AFTER_ACCOUNTANT_EXECUTE; }
        else if (action === 'ОПЛАЧЕНО') { newStatus = "ОПЛАЧЕНО"; nextStep = ROUTES.DONE; }
        else { newStatus = "ОТКАЗ БУХ"; nextStep = ROUTES.REJECT; }
    }

    const { error } = await supabase.from('requests').update({ status: newStatus, current_step: nextStep, ...updates }).eq('id', req.id);
    if (error) { alert("Ошибка сохранения!"); fetchRequests(role, viewMode); }
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
      const interval = setInterval(() => { progress += 5; if (progress > 90) progress = 90; setUploadProgress(progress); }, 500);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async function() {
          try {
              await fetch(STAND_URL, {
                  method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file: reader.result, fileName: file.name, reqNum: modal.req.req_number, reqId: modal.req.id, contractNum: contractNum, amount: amount, type: modal.type })
              });
              clearInterval(interval); setUploadProgress(100); setUploadStatus('success');
              setTimeout(async () => { setModal({ open: false, req: null, type: '' }); setUploadStatus(''); setUploadProgress(0); fetchRequests(role, viewMode); }, 4000); 
          } catch (e) { clearInterval(interval); setUploadStatus('error'); alert("Ошибка загрузки: " + e.message); }
      };
  };

  const RequestCard = ({ req }) => {
    // --- ДАННЫЕ ДЛЯ ФОРМЫ (С дефолтами) ---
    const [formData, setFormData] = useState({
        seller: req.legal_info?.seller || '',
        buyer: req.legal_info?.buyer || 'ТОО ОХМК', 
        subject: req.legal_info?.subject || req.item_name || '', 
        qty: req.legal_info?.qty || req.quantity || '1',
        price_unit: req.legal_info?.price_unit || '',
        total: req.legal_info?.total || '',
        payment_terms: req.legal_info?.payment_terms || 'Постоплата', 
        delivery_place: req.legal_info?.delivery_place || 'Мира 2А', 
        pickup: req.legal_info?.pickup || 'ДА', 
        delivery_date: req.legal_info?.delivery_date || '', 
        quality: req.legal_info?.quality || 'Новое', 
        warranty: req.legal_info?.warranty || '12 месяцев', 
        initiator: req.legal_info?.initiator || req.initiator || '', 
        vat: req.legal_info?.vat || 'ДА'
    });

    const [paySum, setPaySum] = useState(req.final_pay_sum || '');
    const [payDate, setPayDate] = useState(req.payment_date || '');

    const isService = req.request_type === 'service';
    const isUrgent = (req.urgency || "").toLowerCase().includes("срочно");

    // Авто-расчет
    useEffect(() => {
        if(role === 'KOMER' && formData.qty && formData.price_unit) {
            const sum = (parseFloat(formData.qty) * parseFloat(formData.price_unit)).toFixed(2);
            setFormData(prev => ({...prev, total: sum}));
        }
    }, [formData.qty, formData.price_unit]);

    let borderColor = 'border-[#30363d]';
    let stripColor = 'bg-blue-600';
    if (req.status.includes('ОТКАЗ') || req.status.includes('ОТКЛОНЕНО')) { borderColor = 'border-red-900'; stripColor = 'bg-red-600'; }
    else if (req.status === 'ОПЛАЧЕНО') { borderColor = 'border-green-900'; stripColor = 'bg-green-600'; }
    else if (req.status === 'НА СОГЛАСОВАНИИ ОПЛАТЫ') { borderColor = 'border-purple-800'; stripColor = 'bg-purple-500'; }
    if (isUrgent) borderColor = 'border-red-500';

    const DealInfoBlock = () => (
        <div className="w-full bg-[#0d1117] border border-gray-700/50 rounded-lg p-3 mb-3 mt-2 text-xs">
           <div className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-wider flex items-center gap-2 border-b border-gray-800 pb-1"><FileText size={12}/> Детали Договора</div>
           <div className="grid grid-cols-2 gap-2 text-gray-300">
               <div><span className="text-gray-500 block text-[9px]">Продавец</span>{req.legal_info?.seller}</div>
               <div><span className="text-gray-500 block text-[9px]">Сумма</span><span className="text-green-400 font-bold">{req.legal_info?.total} ₸</span></div>
               <div><span className="text-gray-500 block text-[9px]">Оплата</span>{req.legal_info?.payment_terms}</div>
               <div><span className="text-gray-500 block text-[9px]">Срок</span>{req.legal_info?.delivery_date}</div>
               <div className="col-span-2 border-t border-gray-800 pt-1 mt-1 flex justify-between">
                   <span><span className="text-gray-500">НДС:</span> {req.legal_info?.vat}</span>
                   <span><span className="text-gray-500">Гарантия:</span> {req.legal_info?.warranty}</span>
               </div>
           </div>
        </div>
    );

    return (
      <div className={`bg-[#161b22] border ${borderColor} rounded-xl p-5 shadow-xl relative overflow-hidden group flex flex-col h-full`}>
         <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripColor}`}></div>
         
         <div className="flex justify-between items-start mb-2 pl-3">
            <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">#{req.req_number}</h3>
                <div className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <div className={`px-2 py-1 rounded text-xs border font-bold ${req.status.includes('ОТКАЗ') ? 'bg-red-900/40 text-red-400 border-red-800' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>{req.status}</div>
                <button onClick={() => setHistoryModal({open: true, req: req})} className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition"><History size={10}/> История</button>
                {isUrgent && <div className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded animate-pulse font-bold flex items-center gap-1"><AlertCircle size={10}/> СРОЧНО</div>}
            </div>
         </div>

         {/* ИНИЦИАТОР И ДАННЫЕ */}
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

         { (role === 'FIN_DIR' || role === 'LAWYER' || role === 'FINANCE' || role === 'ACCOUNTANT' || role === 'KOMER' || role === 'ECONOMIST') && req.legal_info && (<div className="pl-3 mb-3"><DealInfoBlock/></div>)}

         {(req.draft_url || req.contract_url) && (
             <div className="pl-3 mb-4 space-y-2">
                 {req.draft_url && <a href={req.draft_url} target="_blank" className="flex items-center gap-2 bg-blue-900/20 text-blue-400 p-2 rounded border border-blue-900/50 hover:bg-blue-900/40 transition"><FileText size={16}/> <span className="text-xs font-bold">Проект договора</span> <ExternalLink size={12} className="ml-auto"/></a>}
                 {req.contract_url && <a href={req.contract_url} target="_blank" className="flex items-center gap-2 bg-green-900/20 text-green-400 p-2 rounded border border-green-900/50 hover:bg-green-900/40 transition"><CheckCircle size={16}/> <span className="text-xs font-bold">Подписанный скан</span> <ExternalLink size={12} className="ml-auto"/></a>}
             </div>
         )}

         {/* --- ПАНЕЛЬ ДЕЙСТВИЙ (ВСЕ КНОПКИ ВЕРНУЛ КАК БЫЛО) --- */}
         {viewMode === 'active' && (
             <div className="pl-3 flex flex-wrap gap-2 mt-auto">
                 {/* КНОПКИ ЮРИСТА */}
                 {role === 'LAWYER' && (
                     <div className="flex flex-col gap-2 w-full">
                         {!req.draft_url && req.status !== "ПРОЕКТ СОГЛАСОВАН" && (
                             <button onClick={()=>setModal({ open:true, req:req, type:'DRAFT' })} className="w-full bg-blue-600 py-3 rounded text-white text-xs font-bold flex items-center justify-center gap-2">
                                 <UploadCloud size={14}/> ЗАГРУЗИТЬ ПРОЕКТ
                             </button>
                         )}
                         {req.draft_url && req.status !== "НА СОГЛАСОВАНИИ У ФИН" && req.status !== "ПРОЕКТ СОГЛАСОВАН" && (
                             <button onClick={()=>updateStatus(req, "НА СОГЛАСОВАНИЕ")} className="w-full bg-indigo-600 py-3 rounded text-white text-xs font-bold flex items-center justify-center gap-2">
                                 <Briefcase size={14}/> ОТПРАВИТЬ ФИНАНСИСТУ
                             </button>
                         )}
                         {req.status === "ПРОЕКТ СОГЛАСОВАН" && (
                             <>
                                <div className="bg-green-900/20 border border-green-600/50 p-2 rounded text-center mb-1"><div className="text-[10px] text-green-500 font-bold">ФИНАНСИСТ ОДОБРИЛ ПРОЕКТ</div></div>
                                <button onClick={()=>setModal({ open:true, req:req, type:'FINAL' })} className="w-full bg-green-600 py-3 rounded text-white text-xs font-bold flex items-center justify-center gap-2">
                                    <FileSignature size={14}/> ЗАГРУЗИТЬ ПОДПИСАННЫЙ СКАН
                                </button>
                             </>
                         )}
                         {req.contract_url && req.status !== "Договор подписан" && (
                             <button onClick={()=>updateStatus(req, "Договор подписан")} className="w-full border border-green-600 text-green-400 py-3 rounded text-xs font-bold mt-1">✔ ПОДТВЕРДИТЬ ПОДПИСАНИЕ</button>
                         )}
                     </div>
                 )}

                 {role === 'ECONOMIST' && (
                     <>
                        <div className="w-full text-center text-gray-500 text-[10px] mb-2 bg-[#0d1117] p-1 rounded">Проверьте бюджет (Параллельно)</div>
                        <div className="flex gap-2 w-full">
                           <button onClick={()=>updateStatus(req, "ПО ПЛАНУ")} className={`flex-1 py-3 rounded text-white text-xs font-bold transition ${req.economist_status==='ПО ПЛАНУ' ? 'bg-green-600' : 'bg-gray-700 hover:bg-green-600'}`}>✅ ПО ПЛАНУ</button>
                           <button onClick={()=>updateStatus(req, "ВНЕ ПЛАНА")} className={`flex-1 py-3 rounded text-white text-xs font-bold transition ${req.economist_status==='ВНЕ ПЛАНА' ? 'bg-orange-600' : 'bg-gray-700 hover:bg-orange-600'}`}>⚠️ ВНЕ ПЛАНА</button>
                        </div>
                     </>
                 )}

                 {role === 'DIRECTOR' && (
                     <>
                       <button onClick={()=>updateStatus(req, "ОДОБРЕНО")} className="flex-1 bg-green-600 py-2 rounded text-white text-xs font-bold">ОДОБРИТЬ</button>
                       <button onClick={()=>updateStatus(req, "ОТКЛОНЕНО")} className="flex-1 bg-red-600 py-2 rounded text-white text-xs font-bold">ОТКЛОНИТЬ</button>
                     </>
                 )}
                 {role === 'FIN_DIR' && (
                     <>
                       <div className="flex gap-2">
                           <button onClick={()=>updateStatus(req, "ОДОБРЕНО")} className="flex-[2] bg-gradient-to-r from-green-600 to-green-500 py-3 rounded-lg text-white text-xs font-bold shadow-lg shadow-green-900/20 transform active:scale-95 transition">УТВЕРДИТЬ</button>
                           <button onClick={()=>{const r=prompt("Комментарий:"); if(r) updateStatus(req, "НА ДОРАБОТКУ", {fix_comment: r})}} className="flex-1 bg-orange-600 py-3 rounded-lg text-white text-xs font-bold transform active:scale-95 transition">ПРАВКИ</button>
                           <button onClick={()=>updateStatus(req, "ОТКАЗ")} className="flex-1 bg-red-900/50 border border-red-800 text-red-300 py-3 rounded-lg text-xs font-bold transform active:scale-95 transition">ОТКАЗ</button>
                       </div>
                     </>
                 )}
                 {role && role.includes("SKLAD") && (
                     <>
                       <button onClick={()=>updateStatus(req, "Есть")} className="flex-1 border border-green-600 text-green-500 py-2 rounded text-xs font-bold">ЕСТЬ</button>
                       <button onClick={()=>updateStatus(req, "Частично")} className="flex-1 border border-orange-500 text-orange-500 py-2 rounded text-xs font-bold">ЧАСТИЧНО</button>
                       <button onClick={()=>updateStatus(req, "Отсутствует")} className="flex-1 border border-red-500 text-red-500 py-2 rounded text-xs font-bold">НЕТ</button>
                     </>
                 )}
                 
                 {role === 'KOMER' && (
                    <div className="pl-3 bg-pink-900/10 border-l-2 border-pink-500 p-3 rounded mb-3 w-full">
                        <div className="flex items-center gap-2 mb-3"><Briefcase size={14} className="text-pink-500"/><span className="text-xs font-bold text-pink-400">ПОДГОТОВКА ДОГОВОРА</span></div>
                        <div className="space-y-3 mb-4">
                            <div className="grid grid-cols-2 gap-2"><input className="bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Продавец" value={formData.seller} onChange={e=>setFormData({...formData, seller: e.target.value})}/><input className="bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Покупатель" value={formData.buyer} onChange={e=>setFormData({...formData, buyer: e.target.value})}/></div>
                            <div className="space-y-2 bg-[#0d1117] p-2 rounded border border-gray-700/50">
                                <input className="w-full bg-transparent border-b border-gray-700 p-1 text-white text-xs" placeholder="Предмет договора" value={formData.subject} onChange={e=>setFormData({...formData, subject: e.target.value})}/>
                                <div className="grid grid-cols-3 gap-2"><input type="number" className="bg-gray-800 border border-gray-700 p-1 rounded text-white text-xs" placeholder="Кол-во" value={formData.qty} onChange={e=>setFormData({...formData, qty: e.target.value})}/><input type="number" className="bg-gray-800 border border-gray-700 p-1 rounded text-white text-xs" placeholder="Цена за ед." value={formData.price_unit} onChange={e=>setFormData({...formData, price_unit: e.target.value})}/><select className="bg-gray-800 border border-gray-700 p-1 rounded text-white text-xs" value={formData.vat} onChange={e=>setFormData({...formData, vat: e.target.value})}><option value="ДА">С НДС</option><option value="НЕТ">Без НДС</option></select></div>
                                <div className="flex justify-between items-center pt-1"><span className="text-[10px] text-gray-500">Общая сумма:</span><input className="bg-transparent text-right font-bold text-green-400 text-sm outline-none w-1/2" placeholder="0.00" value={formData.total} onChange={e=>setFormData({...formData, total: e.target.value})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2"><input className="bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Место поставки" value={formData.delivery_place} onChange={e=>setFormData({...formData, delivery_place: e.target.value})}/><select className="bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" value={formData.pickup} onChange={e=>setFormData({...formData, pickup: e.target.value})}><option value="НЕТ">Доставка</option><option value="ДА">Самовывоз</option></select><input className="bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Срок (недель)" value={formData.delivery_date} onChange={e=>setFormData({...formData, delivery_date: e.target.value})}/><input className="bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Гарантия (мес)" value={formData.warranty} onChange={e=>setFormData({...formData, warranty: e.target.value})}/></div>
                            <div className="grid grid-cols-1 gap-2"><input className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="Порядок оплаты" value={formData.payment_terms} onChange={e=>setFormData({...formData, payment_terms: e.target.value})}/><div className="grid grid-cols-2 gap-2"><select className="bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" value={formData.quality} onChange={e=>setFormData({...formData, quality: e.target.value})}><option value="Новое">Товар: НОВЫЙ</option><option value="Б/У">Товар: Б/У</option></select><input className="bg-[#0d1117] border border-gray-700 p-2 rounded text-white text-xs" placeholder="ФИО Инициатора" value={formData.initiator} onChange={e=>setFormData({...formData, initiator: e.target.value})}/></div></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={()=>updateStatus(req, "ОТКАЗ")} className="flex-1 bg-red-900/20 text-red-300 py-2.5 rounded text-xs border border-red-900 hover:bg-red-900 hover:text-white transition font-bold">ОТКАЗ</button>
                            <button onClick={()=>{ if(!formData.seller || !formData.total) return alert("Заполните Поставщика и Сумму!"); updateStatus(req, "ОДОБРЕНО", { legal_info: formData }); }} className="flex-[2] bg-gradient-to-r from-pink-700 to-pink-600 text-white py-2.5 rounded text-xs font-bold hover:from-pink-600 hover:to-pink-500 flex items-center justify-center gap-2 shadow-lg shadow-pink-900/20"><FileSignature size={14}/> ОТПРАВИТЬ ЮРИСТУ</button>
                        </div>
                    </div>
                 )}
                 
                 {role === 'FINANCE' && req.status !== "НА СОГЛАСОВАНИИ ОПЛАТЫ" && (
                    <>
                       <button onClick={()=>updateStatus(req, "ПРОЕКТ СОГЛАСОВАН")} className="w-full bg-green-600 py-3 rounded-lg text-white text-xs font-bold mb-2">✅ СОГЛАСОВАТЬ ПРОЕКТ</button>
                       <div className="flex gap-2"><button onClick={()=>{const r=prompt("Что исправить?"); if(r) updateStatus(req, "НА ДОРАБОТКУ", {fix_comment: r})}} className="flex-1 bg-orange-600 py-2 rounded text-white text-xs font-bold">ПРАВКИ</button><button onClick={()=>updateStatus(req, "ОТКЛОНЕНО")} className="flex-1 bg-red-600 py-2 rounded text-white text-xs font-bold">ОТКАЗ</button></div>
                    </>
                 )}
                 
                 {role === 'ACCOUNTANT' && (
                     <div className="w-full flex flex-col gap-2">
                         {req.status === "ОДОБРЕНО К ОПЛАТЕ" || req.status === "ОДОБРЕНО" ? (
                             <>
                                 <div className="flex gap-2"><input type="number" placeholder="Сумма (₸)" className="w-1/2 bg-[#0d1117] border border-gray-700 rounded text-xs text-white p-2" value={paySum} onChange={e=>setPaySum(e.target.value)}/><input type="date" className="w-1/2 bg-[#0d1117] border border-gray-700 rounded text-xs text-white p-2" value={payDate} onChange={e=>setPayDate(e.target.value)}/></div>
                                 <button onClick={()=>{if(!paySum || !payDate)return alert("Заполните Сумму и Дату!"); updateStatus(req, "НА СОГЛАСОВАНИЕ", {final_pay_sum:paySum, payment_date: payDate})}} className="w-full bg-blue-600 py-3 rounded text-white text-xs font-bold">ОТПРАВИТЬ НА СОГЛАСОВАНИЕ</button>
                             </>
                         ) : req.status === "СОГЛАСОВАНО НА ОПЛАТУ" ? (
                             <>
                                 <div className="bg-yellow-900/20 border border-yellow-500/50 p-2 rounded text-center mb-2"><div className="text-[10px] text-yellow-500">ОДОБРЕНО ФИНАНСИСТОМ</div><div className="text-white font-bold">{req.payment_date} / {req.final_pay_sum} ₸</div></div>
                                 <button onClick={()=>openGoogleCalendar(req)} className="w-full border border-blue-600 text-blue-400 py-2 rounded flex items-center justify-center gap-2 hover:bg-blue-900/30 transition mb-1"><Calendar size={14}/> В GOOGLE CALENDAR</button>
                                 <button onClick={()=>updateStatus(req, "ОПЛАЧЕНО")} className="w-full bg-green-600 py-3 rounded text-white text-xs font-bold">✅ ПРОВЕДЕНО (ЗАКРЫТЬ)</button>
                             </>
                         ) : (<div className="text-center text-gray-500 text-xs">Ждет действий...</div>)}
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
      {/* СХЕМА ДВИЖЕНИЯ (ИЗ ROUTES) */}
      {schemeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-auto">
              <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white flex items-center gap-2"><GitMerge className="text-blue-500"/> КАРТА МАРШРУТОВ</h3><button onClick={()=>setSchemeModal(false)}><X className="text-gray-500 hover:text-white"/></button></div>
                  <div className="space-y-2 text-xs font-mono text-gray-300">
                      {Object.entries(ROUTES).map(([key, val]) => (
                          <div key={key} className="flex justify-between border-b border-gray-800 pb-1"><span>{key}</span><span className="text-blue-400">➜ {val}</span></div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* ИСТОРИЯ */}
      {historyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Clock size={20} className="text-blue-500"/> История заявки</h3><button onClick={()=>setHistoryModal({open:false, req:null})}><X className="text-gray-500 hover:text-white"/></button></div>
              <div className="overflow-y-auto pr-2 space-y-4">
                  {(!historyModal.req.history || historyModal.req.history.length === 0) ? (<div className="text-center text-gray-500 text-xs py-10">История пуста</div>) : ([...historyModal.req.history].reverse().map((step, idx) => (
                      <div key={idx} className="relative pl-6 border-l-2 border-gray-800 last:border-0 pb-4"><div className="absolute -left-[5px] top-0 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-[#161b22]"></div><div className="text-xs text-gray-500 mb-0.5">{step.date}</div><div className="text-sm font-bold text-white mb-1">{step.role}</div><div className="text-xs text-gray-300 bg-gray-800 px-2 py-0.5 rounded inline-block border border-gray-700">{step.action}</div>{step.comment && <div className="mt-2 bg-[#0d1117] p-2 rounded border border-gray-800 text-xs text-gray-400 italic">"{step.comment}"</div>}</div>
                  )))}
              </div>
           </div>
        </div>
      )}

      {/* МОДАЛКА ЗАГРУЗКИ */}
      {modal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-white flex items-center gap-2"><UploadCloud className="text-blue-500"/> {modal.type === 'DRAFT' ? 'Проект' : 'Финал'}</h3><button onClick={()=>setModal({...modal, open:false})}><X className="text-gray-500 hover:text-white"/></button></div>
                  {uploadStatus === 'success' ? (<div className="text-center py-6"><CheckCircle size={48} className="text-green-500 mx-auto mb-2"/><p className="text-white font-bold">Загружено!</p></div>) : (
                      <div className="space-y-4"><div className="bg-[#0d1117] border border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 transition relative"><input type="file" id="file-upload" className="absolute inset-0 opacity-0 cursor-pointer"/><div className="text-gray-400 text-sm">Выбрать файл<br/>(PDF, DOCX)</div></div>
                          {modal.type === 'FINAL' && (<div className="space-y-2"><input id="contract-num" className="w-full bg-[#0d1117] border border-gray-700 rounded p-3 text-white text-sm" placeholder="№ Договора"/><input id="contract-amount" type="number" className="w-full bg-[#0d1117] border border-gray-700 rounded p-3 text-white text-sm" placeholder="Сумма договора"/></div>)}
                          {uploadStatus === 'uploading' && <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden"><div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{width: `${uploadProgress}%`}}></div></div>}
                          <button onClick={handleUpload} disabled={uploadStatus === 'uploading'} className={`w-full py-3 rounded-xl font-bold text-white transition ${uploadStatus==='uploading' ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>{uploadStatus === 'uploading' ? `...` : 'ОТПРАВИТЬ'}</button>
                      </div>
                  )}
              </div>
          </div>
      )}
      
      {/* HEADER */}
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
      
      {/* CARD GRID */}
      <div className="max-w-7xl mx-auto w-full p-4 flex-grow">
          {loading && requests.length === 0 ? (<div className="text-center py-20 text-gray-500 animate-pulse">Загрузка данных...</div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{requests.filter(r => searchQuery ? String(r.req_number).includes(searchQuery) : true).map(req => (<RequestCard key={req.id} req={req} />))}</div>)}
          {!loading && requests.length === 0 && <div className="text-center py-20 opacity-30 flex flex-col items-center"><Archive size={48} className="mb-2"/><div>Список пуст</div></div>}
      </div>

      <div className="text-center py-4 text-gray-800 text-[10px]">{APP_VERSION}</div>
    </div>
  );
}

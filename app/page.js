"use client";
import { useState, useEffect, useRef } from 'react'; 
import { createClient } from '@supabase/supabase-js';
import { 
  RefreshCw, Archive, Zap, Search, FileText, CheckCircle, UploadCloud, X, Loader2, 
  ExternalLink, AlertTriangle, Table, Truck, Wrench, Info, DollarSign, Calendar, 
  MapPin, Eye, Clock, BarChart3, Phone, User, Factory, AlertCircle, Briefcase, FileSignature, 
  Package, Scale, ShieldCheck, Keyboard, History, GitMerge, Settings, ChevronRight
} from 'lucide-react';

const APP_VERSION = "v9.0 (Smart Warehouses + Flags)"; 
// Вставь свои ссылки:
const STAND_URL = "https://script.google.com/macros/s/AKfycbwPVrrM4BuRPhbJXyFCmMY88QHQaI12Pbhj9Db9Ru0ke5a3blJV8luSONKao-DD6SNN/exec"; 
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Bf...ВАША_ССЫЛКА.../edit"; 

const supabase = createClient(
  https://ykmvlughekjnqgdyddmp.supabase.co/rest/v1/SED,
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbXZsdWdoZWtqbnFnZHlkZG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzQ3OTAsImV4cCI6MjA4NTE1MDc5MH0.ZaPeruXSJ6EQJ21nk4VPdvzQFMxoLUSxewQVK4EOE8Y
);

// СЛОВАРЬ СКЛАДОВ (Для красивого отображения)
const WAREHOUSE_NAMES = {
  "SKLAD_CENTRAL": "Центральный склад (ТМЦ)",
  "SKLAD_ZAP": "Склад Запчастей",
  "SKLAD_GSM": "Спецсклад (ГСМ/Семена)",
  "SKLAD_STOL": "Склад Столовой",
  "SKLAD_MTF": "Склад МТФ (Вет)",
  "SKLAD_ZNKI": "Склад ЗНКИ (Корма)",
  "SKLAD_MEHTOK": "Мехток"
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
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const pinInputRef = useRef(null);

  // ПИН-КОДЫ (Сверяем с твоей структурой)
  const ROLES = {
    "2223": "DIRECTOR", 
    "0500": "KOMER", 
    "777": "FIN_DIR", 
    "333": "LAWYER", 
    "444": "FINANCE", 
    "222": "ACCOUNTANT",
    "111": "ECONOMIST", 
    // СКЛАДЫ
    "2014": "SKLAD_CENTRAL", 
    "2525": "SKLAD_ZAP", 
    "197":  "SKLAD_STOL",
    "504":  "SKLAD_MTF",
    "506":  "SKLAD_ZNKI",
    "508":  "SKLAD_GSM"
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
        // --- ГЛАВНЫЙ ФИЛЬТР ВИДИМОСТИ (ФЛАГИ 1/0/NULL) ---
        
        if (userRole === "DIRECTOR") {
            // Видит всё, где еще не принял решение
            query = query.is('step_director', null);
        }
        else if (userRole === "FIN_DIR") {
            // Видит то, что прошел Комер, но сам еще не решил
            query = query.eq('step_komer', 1).is('step_findir', null);
        }
        else if (userRole === "ECONOMIST") {
            // Видит всё одобренное директором
            query = query.eq('step_director', 1);
        }
        else if (userRole === "KOMER") {
            // Видит одобренное директором, но еще не сделанное собой
            query = query.eq('step_director', 1).is('step_komer', null); 
        }
        else if (userRole && userRole.includes("SKLAD")) {
            // Склады видят одобренное директором, где шаг склада NULL
            // И ВАЖНО: Только Тип "Товар" (Goods), Услуги отсекаем сразу
            query = query.eq('step_director', 1).is('step_sklad', null).neq('request_type', 'service');
        }
        else if (userRole === "LAWYER") {
            // Два этапа: 1. После ФинДира (Проект) 2. После ФинПроверки (Скан)
            query = query.or('and(step_findir.eq.1,step_lawyer_draft.is.null),and(step_finance_review.eq.1,step_lawyer_final.is.null)');
        }
        else if (userRole === "FINANCE") {
            // Два этапа: 1. После Проекта (Ревью) 2. После БухЗапроса (Оплата)
            query = query.or('and(step_lawyer_draft.eq.1,step_finance_review.is.null),and(step_accountant_req.eq.1,step_finance_pay.is.null)');
        }
        else if (userRole === "ACCOUNTANT") {
            // Два этапа: 1. После Подписания (Запрос) 2. После ОдобренияОплаты (Проведение)
            query = query.or('and(step_lawyer_final.eq.1,step_accountant_req.is.null),and(step_finance_pay.eq.1,step_accountant_done.is.null)');
        }
    }

    const { data } = await query;
    let filtered = data || [];

    // --- КЛИЕНТСКИЕ ФИЛЬТРЫ (ТОНКАЯ НАСТРОЙКА) ---
    if (mode === 'active') {
        
        // 1. КОММЕРЧЕСКИЙ: Видит Услуги СРАЗУ, Товары - ТОЛЬКО если Склад=0 или 2
        if (userRole === "KOMER") {
            filtered = filtered.filter(req => {
                if (req.request_type === 'service') return true; // Услуга -> Вижу
                if (req.step_sklad === 0 || req.step_sklad === 2) return true; // Нет на складе -> Вижу
                // Если step_sklad === null (Склад еще не смотрел) -> НЕ ВИЖУ
                return false; 
            });
        }

        // 2. СКЛАДЫ: Видят ТОЛЬКО свой код (SKLAD_MTF видит только SKLAD_MTF)
        if (userRole && userRole.includes("SKLAD")) {
            filtered = filtered.filter(req => {
                // Берем целевой код из заявки (его поставил SQL-робот)
                const target = req.target_warehouse_code;
                if (!target) return userRole === "SKLAD_CENTRAL"; // Если кода нет - летит на Центральный
                return userRole === target;
            });
        }
        
        // 3. ЮРИСТ: Не видит уже оплаченные (на всякий случай)
        if (userRole === "LAWYER") filtered = filtered.filter(req => req.status !== "ОПЛАЧЕНО");
    }
    setRequests(filtered);
    setLoading(false);
  };

  const switchMode = (mode) => { setViewMode(mode); fetchRequests(role, mode); };

  const openGoogleCalendar = (req) => {
    const title = encodeURIComponent(`Оплата: ${req.item_name} (${req.payment_sum} ₸)`);
    const details = encodeURIComponent(`Заявка №${req.req_number}\nПоставщик: ${req.legal_info?.seller}`);
    const dateStr = req.payment_date ? req.payment_date.replace(/-/g, '') : '';
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}/${dateStr}`, '_blank');
  };

  const handleAction = async (req, actionType, payload = {}) => {
      // Валидация полей
      if (payload.require_form && (!req.legal_info?.seller || !req.legal_info?.total)) return alert("Заполните форму!");
      if (payload.require_draft && !req.draft_url) return alert("Загрузите проект!");
      if (payload.require_scan && !req.contract_url) return alert("Загрузите скан!");
      if (payload.require_contract_sum && !req.contract_sum) return alert("Укажите сумму договора!");
      if (payload.require_pay_data && (!req.payment_sum || !req.payment_date)) return alert("Укажите сумму и дату!");

      if (!confirm("Выполнить действие?")) return;

      let updates = { last_role: role };
      let comments = payload.comment || null;

      // --- ЛОГИКА ИЗМЕНЕНИЯ ФЛАГОВ ---
      
      // ДИРЕКТОР
      if (role === 'DIRECTOR') {
          if (actionType === 'APPROVE') updates.step_director = 1;
          if (actionType === 'REJECT') updates.step_director = 0;
      }
      
      // СКЛАДЫ
      else if (role.includes('SKLAD')) {
          if (actionType === 'YES') { updates.step_sklad = 1; updates.warehouse_status = 'ЕСТЬ'; }
          if (actionType === 'NO') { updates.step_sklad = 0; updates.warehouse_status = 'НЕТ'; }
          if (actionType === 'PARTIAL') { 
              const c = prompt("Что именно есть на складе?");
              if (!c) return;
              updates.step_sklad = 2; 
              updates.warehouse_status = 'ЧАСТИЧНО';
              updates.warehouse_comment = c;
          }
      }

      // ЭКОНОМИСТ
      else if (role === 'ECONOMIST') {
          updates.step_economist = 1; 
          updates.economist_status = actionType === 'PLAN' ? 'ПО ПЛАНУ' : 'ВНЕ ПЛАНА';
      }

      // КОММЕРЧЕСКИЙ
      else if (role === 'KOMER') {
          if (actionType === 'SEND') { 
              updates.step_komer = 1; 
              updates.fix_comment = null;
              if (req.temp_legal_info) updates.legal_info = req.temp_legal_info;
          }
          // ОТМЕНА ЗАЯВКИ
          if (actionType === 'REJECT') {
              const reason = prompt("Укажите причину отмены/отказа:");
              if (!reason) return; 
              
              updates.step_komer = 0;
              updates.status = "ОТМЕНЕНО КОМЕРОМ";
              comments = "Причина отказа: " + reason;
          }
      }

      // ФИН. ДИРЕКТОР (Может вернуть назад Комеру)
      else if (role === 'FIN_DIR') {
          if (actionType === 'APPROVE') updates.step_findir = 1;
          if (actionType === 'FIX') {
              const c = prompt("Причина возврата:");
              if (!c) return;
              updates.step_komer = null; // <-- СТИРАЕМ ФЛАГ КОМЕРА (ОТКАТ)
              updates.fix_comment = "Фин.Дир: " + c;
          }
          if (actionType === 'REJECT') updates.step_findir = 0;
      }

      // ЮРИСТ
      else if (role === 'LAWYER') {
          if (actionType === 'SEND_DRAFT') updates.step_lawyer_draft = 1;
          if (actionType === 'SIGN') { 
              updates.step_lawyer_final = 1; 
              // Пишем Сумму Договора в БД
              if (req.temp_contract_sum) updates.contract_sum = req.temp_contract_sum;
          }
      }

      // ФИНАНСИСТ
      else if (role === 'FINANCE') {
          if (actionType === 'REVIEW_OK') { updates.step_finance_review = 1; updates.fix_comment = null; }
          if (actionType === 'REVIEW_FIX') {
              const c = prompt("Правки к договору:");
              if (!c) return;
              updates.step_lawyer_draft = null; // Откат Юристу
              updates.fix_comment = "Фин (Договор): " + c;
          }
          if (actionType === 'PAY_OK') { updates.step_finance_pay = 1; updates.fix_comment = null; }
          if (actionType === 'PAY_FIX') {
              const c = prompt("Правка по оплате:");
              if (!c) return;
              updates.step_accountant_req = null; // Откат Бухгалтеру
              updates.fix_comment = "Фин (Оплата): " + c;
          }
          if (actionType === 'REJECT') updates.step_finance_review = 0;
      }

      // БУХГАЛТЕР
      else if (role === 'ACCOUNTANT') {
          if (actionType === 'REQ_PAY') {
              updates.step_accountant_req = 1;
              if (req.temp_pay_sum) updates.payment_sum = req.temp_pay_sum;
              if (req.temp_pay_date) updates.payment_date = req.temp_pay_date;
              updates.fix_comment = null;
          }
          if (actionType === 'DONE') {
              updates.step_accountant_done = 1;
              updates.status = "ОПЛАЧЕНО";
          }
      }

      // Оптимистичное обновление UI
      if (role !== 'ECONOMIST') setRequests(prev => prev.filter(r => r.id !== req.id));
      
      // История действий
      if (comments) {
          const currentHistory = req.history || [];
          updates.history = [...currentHistory, {
              role: role,
              action: "КОММЕНТАРИЙ / ОТКАЗ",
              date: new Date().toLocaleString("ru-RU"),
              comment: comments
          }];
      }

      const { error } = await supabase.from('requests').update(updates).eq('id', req.id);
      if (error) alert("Ошибка: " + error.message);
      else fetchRequests(role, viewMode);
  };

  const handleUpload = async () => {
      const fileInput = document.getElementById('file-upload');
      if (!fileInput.files[0]) return alert("Выберите файл!");
      const file = fileInput.files[0];
      setUploadStatus('uploading');
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async function() {
          try {
              await fetch(STAND_URL, {
                  method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file: reader.result, fileName: file.name, reqNum: modal.req.req_number, reqId: modal.req.id, type: modal.type })
              });
              setUploadStatus('success');
              setTimeout(async () => { setModal({ open: false, req: null, type: '' }); setUploadStatus(''); fetchRequests(role, viewMode); }, 2000); 
          } catch (e) { setUploadStatus('error'); alert("Ошибка: " + e.message); }
      };
  };

  // КАРТОЧКА ЗАЯВКИ
  const RequestCard = ({ req }) => {
    const [formData, setFormData] = useState(req.legal_info || { seller: '', buyer: 'ТОО ОХМК', subject: req.item_name, qty: req.quantity || '1', price_unit: '', total: '', payment_terms: 'Постоплата', delivery_place: 'Мира 2А', pickup: 'ДА', delivery_date: '', quality: 'Новое', warranty: '12 месяцев', initiator: req.initiator, vat: 'ДА' });
    const [contractSum, setContractSum] = useState(req.contract_sum || '');
    const [paySum, setPaySum] = useState(req.payment_sum || '');
    const [payDate, setPayDate] = useState(req.payment_date || '');

    useEffect(() => {
        if(formData.qty && formData.price_unit) {
            const sum = (parseFloat(formData.qty) * parseFloat(formData.price_unit)).toFixed(2);
            setFormData(prev => ({...prev, total: sum}));
            req.temp_legal_info = {...formData, total: sum};
        } else { req.temp_legal_info = formData; }
    }, [formData]);

    useEffect(() => { req.temp_pay_sum = paySum; req.temp_pay_date = payDate; req.temp_contract_sum = contractSum; }, [paySum, payDate, contractSum]);

    const isUrgent = (req.urgency || "").toLowerCase().includes("срочно");
    let borderColor = 'border-[#30363d]';
    if (req.fix_comment) borderColor = 'border-orange-500'; 
    if (isUrgent) borderColor = 'border-red-500';

    // Функция для очистки номера (превращает 8777... в 7777...)
    const getCleanPhone = (phoneStr) => {
        if (!phoneStr) return null;
        // Оставляем только цифры
        let p = phoneStr.replace(/\D/g, '');
        // Если начинается с 8 (Казахстан), меняем на 7
        if (p.startsWith('8')) p = '7' + p.slice(1);
        return p;
    };
    
    const cleanPhone = getCleanPhone(req.phone);
    return (
      <div className={`bg-[#161b22] border ${borderColor} rounded-xl p-5 shadow-xl flex flex-col h-full`}>
         <div className="flex justify-between items-start mb-2">
            <div><h3 className="text-xl font-bold text-white">#{req.req_number}</h3><div className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</div></div>
            {isUrgent && <div className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded animate-pulse font-bold">СРОЧНО</div>}
         </div>

         {/* Сообщение о правках */}
         {req.fix_comment && <div className="bg-orange-900/30 border border-orange-600 p-2 rounded mb-3 text-xs text-orange-200"><b className="block mb-1">⚠️ ТРЕБУЮТСЯ ПРАВКИ:</b>{req.fix_comment}</div>}

         {/* Основная инфо */}
         <div className="text-sm space-y-2 text-gray-300 flex-grow mb-4">
             <div className="font-bold text-white text-lg">{req.item_name}</div>
             <div className="text-xs text-gray-400">Категория: {req.cost_category || "Не указана"}</div>
             {/* Блок Инициатора с кнопками связи */}
             <div className="flex justify-between items-center border-t border-gray-700 pt-2 mt-2">
                 <div className="flex flex-col">
                     <span className="text-[10px] text-gray-500 font-bold">ИНИЦИАТОР</span>
                     <span className="text-xs text-gray-300">{req.initiator}</span>
                 </div>
                 
                 {cleanPhone && (
                     <div className="flex gap-2">
                         {/* Кнопка WhatsApp */}
                         <a href={`https://wa.me/${cleanPhone}`} target="_blank" rel="noreferrer" 
                            className="bg-green-600 hover:bg-green-500 text-white p-1.5 rounded-lg transition"
                            title="Написать в WhatsApp">
                             <Phone size={14} className="rotate-0" /> {/* Или иконка MessageCircle если есть */}
                         </a>
                         
                         {/* Кнопка Позвонить */}
                         <a href={`tel:+${cleanPhone}`} 
                            className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-lg transition"
                            title="Позвонить">
                             <Phone size={14} />
                         </a>
                     </div>
                 )}
             </div>
             
             {/* Отображение статуса Склада */}
             {req.target_warehouse_code && (
                <div className="mt-2 text-xs">
                    <span className="text-gray-500 block mb-0.5">{WAREHOUSE_NAMES[req.target_warehouse_code] || "Неизвестный склад"}:</span>
                    {req.step_sklad === 1 && <span className="text-green-400 font-bold border border-green-600 px-1 rounded">ЕСТЬ НА СКЛАДЕ</span>}
                    {req.step_sklad === 0 && <span className="text-red-400 font-bold border border-red-600 px-1 rounded">НЕТ НА СКЛАДЕ</span>}
                    {req.step_sklad === 2 && <span className="text-orange-400 font-bold border border-orange-600 px-1 rounded">ЧАСТИЧНО ({req.warehouse_comment})</span>}
                    {req.step_sklad === null && <span className="text-gray-400 italic">Ожидает проверки...</span>}
                </div>
             )}
         </div>

         {/* --- КНОПКИ УПРАВЛЕНИЯ --- */}
         <div className="mt-auto space-y-2">
             {role === 'DIRECTOR' && (
                 <div className="flex gap-2">
                     <button onClick={()=>handleAction(req, 'APPROVE')} className="flex-1 bg-green-600 py-2 rounded text-xs font-bold text-white">ОДОБРИТЬ (1)</button>
                     <button onClick={()=>handleAction(req, 'REJECT')} className="flex-1 bg-red-600 py-2 rounded text-xs font-bold text-white">ОТКАЗ (0)</button>
                 </div>
             )}
             {role.includes('SKLAD') && (
                 <div className="flex gap-2">
                     <button onClick={()=>handleAction(req, 'YES')} className="flex-1 border border-green-600 text-green-500 py-2 rounded text-xs font-bold">ЕСТЬ (1)</button>
                     <button onClick={()=>handleAction(req, 'PARTIAL')} className="flex-1 border border-orange-500 text-orange-500 py-2 rounded text-xs font-bold">ЧАСТИЧНО (2)</button>
                     <button onClick={()=>handleAction(req, 'NO')} className="flex-1 border border-red-500 text-red-500 py-2 rounded text-xs font-bold">НЕТ (0)</button>
                 </div>
             )}
             {role === 'KOMER' && (
                 <div className="bg-[#0d1117] p-2 rounded border border-gray-700">
                     <input className="w-full bg-gray-800 border border-gray-600 p-1.5 rounded text-white text-xs mb-2" placeholder="Продавец" value={formData.seller} onChange={e=>setFormData({...formData, seller: e.target.value})}/>
                     <div className="flex gap-2 mb-2">
                         <input type="number" className="w-1/2 bg-gray-800 border border-gray-600 p-1.5 rounded text-white text-xs" placeholder="Цена" value={formData.price_unit} onChange={e=>setFormData({...formData, price_unit: e.target.value})}/>
                         <div className="w-1/2 text-right text-green-400 font-bold text-xs pt-2">{formData.total}</div>
                     </div>
                     <button onClick={()=>handleAction(req, 'SEND', {require_form: true})} className="w-full bg-pink-700 py-2 rounded text-xs font-bold text-white mb-2">ОТПРАВИТЬ ЮРИСТУ (1)</button>
                     <button onClick={()=>handleAction(req, 'REJECT')} className="w-full border border-red-600 text-red-400 py-1.5 rounded text-xs hover:bg-red-900/20">❌ ОТКАЗ (ОТМЕНА)</button>
                 </div>
             )}
             {role === 'FIN_DIR' && (
                 <div className="flex gap-2">
                     <button onClick={()=>handleAction(req, 'APPROVE')} className="flex-[2] bg-green-600 py-2 rounded text-xs font-bold text-white">УТВЕРДИТЬ (1)</button>
                     <button onClick={()=>handleAction(req, 'FIX')} className="flex-1 bg-orange-600 py-2 rounded text-xs font-bold text-white">ПРАВКИ</button>
                     <button onClick={()=>handleAction(req, 'REJECT')} className="flex-1 bg-red-900 py-2 rounded text-xs font-bold text-white">ОТКАЗ</button>
                 </div>
             )}
             {role === 'LAWYER' && !req.step_lawyer_draft && (
                 <>
                     {!req.draft_url && <button onClick={()=>setModal({open:true, req:req, type:'DRAFT'})} className="w-full bg-blue-600 py-2 rounded text-xs text-white mb-2">ЗАГРУЗИТЬ ПРОЕКТ</button>}
                     <button onClick={()=>handleAction(req, 'SEND_DRAFT', {require_draft: true})} className="w-full bg-indigo-600 py-2 rounded text-xs font-bold text-white">ОТПРАВИТЬ ФИНАНСИСТУ (1)</button>
                 </>
             )}
             {role === 'LAWYER' && req.step_finance_review === 1 && (
                 <div className="bg-[#0d1117] p-2 rounded border border-gray-700">
                     <div className="text-green-500 text-[10px] mb-1 font-bold">СОГЛАСОВАНО. ПОДПИСАНИЕ:</div>
                     <input type="number" className="w-full bg-gray-800 border border-gray-600 p-1.5 rounded text-white text-xs mb-2" placeholder="Сумма договора (Итоговая)" value={contractSum} onChange={e=>setContractSum(e.target.value)}/>
                     <button onClick={()=>setModal({open:true, req:req, type:'FINAL'})} className="w-full bg-gray-700 py-1.5 rounded text-xs text-white mb-2">Загрузить скан</button>
                     <button onClick={()=>handleAction(req, 'SIGN', {require_scan: true, require_contract_sum: true})} className="w-full bg-green-600 py-2 rounded text-xs font-bold text-white">✔ ПОДПИСАНО (1)</button>
                 </div>
             )}
             {role === 'FINANCE' && !req.step_finance_review && (
                 <div className="flex gap-2">
                     <button onClick={()=>handleAction(req, 'REVIEW_OK')} className="flex-[2] bg-green-600 py-2 rounded text-xs font-bold text-white">СОГЛАСОВАТЬ (1)</button>
                     <button onClick={()=>handleAction(req, 'REVIEW_FIX')} className="flex-1 bg-orange-600 py-2 rounded text-xs font-bold text-white">ПРАВКИ</button>
                 </div>
             )}
             {role === 'FINANCE' && req.step_accountant_req === 1 && (
                 <div className="bg-purple-900/30 p-2 rounded border border-purple-600">
                     <div className="text-white text-xs mb-1">Запрос на оплату: <b>{req.payment_sum}</b> ({req.payment_date})</div>
                     <div className="flex gap-2">
                         <button onClick={()=>handleAction(req, 'PAY_OK')} className="flex-[2] bg-green-600 py-2 rounded text-xs font-bold text-white">ОДОБРИТЬ (1)</button>
                         <button onClick={()=>handleAction(req, 'PAY_FIX')} className="flex-1 bg-orange-600 py-2 rounded text-xs font-bold text-white">ПРАВКИ</button>
                     </div>
                 </div>
             )}
             {role === 'ACCOUNTANT' && !req.step_accountant_req && (
                 <div className="bg-[#0d1117] p-2 rounded border border-gray-700">
                     <div className="flex gap-2 mb-2"><input type="number" placeholder="Сумма" className="w-1/2 bg-gray-800 p-1.5 rounded text-white text-xs" value={paySum} onChange={e=>setPaySum(e.target.value)}/><input type="date" className="w-1/2 bg-gray-800 p-1.5 rounded text-white text-xs" value={payDate} onChange={e=>setPayDate(e.target.value)}/></div>
                     <button onClick={()=>handleAction(req, 'REQ_PAY', {require_pay_data: true})} className="w-full bg-blue-600 py-2 rounded text-xs font-bold text-white">НА СОГЛАСОВАНИЕ (1)</button>
                 </div>
             )}
             {role === 'ACCOUNTANT' && req.step_finance_pay === 1 && (
                 <div className="bg-green-900/20 p-2 rounded border border-green-600">
                     <div className="text-green-400 text-[10px] font-bold mb-2">ОДОБРЕНО ФИНАНСИСТОМ</div>
                     <button onClick={()=>openGoogleCalendar(req)} className="w-full border border-blue-500 text-blue-400 py-1.5 rounded text-xs mb-2">GOOGLE CALENDAR</button>
                     <button onClick={()=>handleAction(req, 'DONE')} className="w-full bg-green-600 py-2 rounded text-xs font-bold text-white">✅ ПРОВЕДЕНО (ФИНИШ)</button>
                 </div>
             )}
             {role === 'ECONOMIST' && (
                 <div className="flex gap-2">
                     <button onClick={()=>handleAction(req, 'PLAN')} className={`flex-1 py-2 rounded text-xs font-bold text-white ${req.economist_status==='ПО ПЛАНУ'?'bg-green-600':'bg-gray-700'}`}>ПО ПЛАНУ</button>
                     <button onClick={()=>handleAction(req, 'UNPLANNED')} className={`flex-1 py-2 rounded text-xs font-bold text-white ${req.economist_status==='ВНЕ ПЛАНА'?'bg-orange-600':'bg-gray-700'}`}>ВНЕ ПЛАНА</button>
                 </div>
             )}
         </div>
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
      <div className="sticky top-0 z-20 bg-[#0d1117]/90 backdrop-blur border-b border-gray-800">
          <div className="max-w-7xl mx-auto p-3">
             <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-3"><div className="flex flex-col"><span className="text-xs text-gray-500 font-bold">РОЛЬ</span><div className="flex items-center gap-2"><b className="text-blue-400 text-lg">{role}</b>{loading && <Loader2 className="animate-spin text-gray-500" size={14}/>}</div></div></div>
                 <div className="flex gap-2">
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

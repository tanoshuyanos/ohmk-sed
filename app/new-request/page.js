// ==========================================
// ФАЙЛ №2: ЗАЯВКА (С ЭКРАНОМ УСПЕХА, ФАЙЛАМИ И БАЗОЙ ТЕХНИКИ)
// ПУТЬ К ФАЙЛУ: app/new-request/page.js
// ==========================================

"use client";
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Plus, Trash2, FileText, User, X, Flame, AlertTriangle, Calendar, Lock, CheckCircle, Loader2, Send, ChevronDown } from "lucide-react";

// --- ВСТАВЬ СВОИ ДАННЫЕ ИЗ АДМИНКИ ---
const supabaseUrl = "https://ykmvlughekjnqgdyddmp.supabase.co"; 
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbXZsdWdoZWtqbnFnZHlkZG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzQ3OTAsImV4cCI6MjA4NTE1MDc5MH0.ZaPeruXSJ6EQJ21nk4VPdvzQFMxoLUSxewQVK4EOE8Y";
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_COMPANY_ID = "a32814de-7f0e-4109-87ee-555e1a4f0509"; 

export default function NewRequest() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false); 
  const [submittedId, setSubmittedId] = useState(null);

  const [employeesDB, setEmployeesDB] = useState([]);
  const [vehicles, setVehicles] = useState([]);     
  const [agriMachinery, setAgriMachinery] = useState([]); 

  const step2Ref = useRef(null);
  const step3Ref = useRef(null);
  const suggestionRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
        // Загружаем только активных сотрудников
        const { data: emp } = await supabase.from("v2_employees").select("*").eq("is_active", true).order("name");
        if (emp) setEmployeesDB(emp);

        // Загружаем только активную технику
        const { data: veh } = await supabase.from("v2_equipment").select("*").eq("is_active", true).order("name");
        if (veh) {
            // Умный фильтр для АВТОТРАНСПОРТА (Гараж, Легковые, Грузовые)
            setVehicles(veh.filter(v => 
                (v.department && v.department.toUpperCase() === "ГАРАЖ") || 
                (v.type && (v.type.toLowerCase().includes("легк") || v.type.toLowerCase().includes("груз") || v.type.toLowerCase().includes("авто")))
            ));
            
            // Умный фильтр для СЕЛЬХОЗТЕХНИКИ (МТМ, Спецтехника, Трактора, Комбайны)
            setAgriMachinery(veh.filter(v => 
                (v.department && v.department.toUpperCase() === "МТМ") || 
                (v.type && (v.type.toLowerCase().includes("спец") || v.type.toLowerCase().includes("тракт") || v.type.toLowerCase().includes("комбайн") || v.type.toLowerCase().includes("с/х"))) ||
                // Если тип не указан, но это не гараж, кидаем в С/Х на всякий случай
                (!v.type && v.department !== "ГАРАЖ")
            ));
        }
        setLoading(false);
    };
    loadData();
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState(false); 
  const [inputPassword, setInputPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [type, setType] = useState("goods");
  const [costType, setCostType] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [serviceName, setServiceName] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState([{ id: 1, name: "", qty: "", unit: "", binding: "" }]);
  
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [initiator, setInitiator] = useState(""); 
  const [selectedEmp, setSelectedEmp] = useState(null); 
  const [dept, setDept] = useState("");

  const departments = [ "АУП", "МТФ", "ЗНКИ", "ГАРАЖ", "МЕХТОК", "СТОЛОВАЯ", "БРИГАДА", "СТРОЙ ЦЕХ", "НАУКА", "ЭНЕРГОЦЕХ", "СБ", "МТМ", "ЦЕНТРАЛЬНЫЙ СКЛАД" ];
  const costCategories = [ "ТМЦ", "ТМЦ-Строительные", "Запчасть с/х техники", "Запчасть автотранспорта", "Запчасть оборудования", "СЗР", "Удобрение", "ГСМ", "Продукты питания", "Вет препарат/медикамент", "Семена", "Семя", "Корма и добавки", "Основные средства", "Хоз.товар", "Прочее", "Протравители" ];
  const serviceTypes = ["Аренда техники", "Перевозка", "Ремонт/Монтаж", "Анализы", "Страхование", "Прочее"];
  const units = ["шт", "кг", "л", "м", "м²", "м³", "компл", "уп", "рулон", "тн", "пог.м", "час", "рейс"];

  const filteredEmployees = employeesDB.filter(emp => emp.name && emp.name.toLowerCase().includes(initiator.toLowerCase()));

  useEffect(() => {
    const handleClickOutside = (event) => { 
        if (suggestionRef.current && !suggestionRef.current.contains(event.target)) setShowSuggestions(false); 
    };
    document.addEventListener("mousedown", handleClickOutside); 
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
      if (isAuthenticated && step2Ref.current) setTimeout(() => step2Ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [isAuthenticated]);

  useEffect(() => {
      if (costType && step3Ref.current) setTimeout(() => step3Ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }, [costType]);

  const handleSelectEmployee = (emp) => { setInitiator(emp.name); setSelectedEmp(emp); setIsAuthenticated(false); setInputPassword(""); setPasswordError(false); setShowSuggestions(false); };
  const checkPassword = () => { const dbPin = String(selectedEmp.pin_code || selectedEmp.password || ""); if (selectedEmp && inputPassword === dbPin) { setIsAuthenticated(true); setDept(selectedEmp.department); setPasswordError(false); } else { setPasswordError(true); } };
  const handleClearEmployee = () => { setInitiator(""); setSelectedEmp(null); setIsAuthenticated(false); setDept(""); setInputPassword(""); };
  const addItem = () => setItems([...items, { id: Date.now(), name: "", qty: "", unit: "", binding: "" }]);
  const removeItem = (id) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id, field, value) => setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  
  const handleFileChange = (e) => {
      setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)]);
  };
  const removeFile = (index) => {
      setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const sendRequest = async () => {
    if (!costType || !selectedEmp) return;

    if (type === "goods") {
        const hasInvalidItems = items.some(item => !item.name.trim() || !item.qty || !item.unit);
        if (hasInvalidItems) {
            alert("⚠️ ОШИБКА: Пожалуйста, укажите Наименование, Количество и обязательно выберите Единицу измерения для всех добавленных товаров!");
            return;
        }
    } else if (type === "service") {
        if (!serviceName.trim()) {
            alert("⚠️ ОШИБКА: Пожалуйста, укажите название услуги!");
            return;
        }
    }

    setSending(true);

    // === ЗАГРУЗКА ФАЙЛОВ ===
    let finalAttachmentUrls = "";
    if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach(file => formData.append("files", file));

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (data.urls && data.urls.length > 0) {
                finalAttachmentUrls = data.urls.join(', ');
            } else if (data.error) {
                alert("Ошибка загрузки файла на сервер: " + data.error);
                setSending(false);
                return;
            }
        } catch (e) {
            alert("Сбой сети при загрузке файлов: " + e.message);
            setSending(false);
            return;
        }
    }

    // === СОХРАНЯЕМ ШАПКУ ===
    const requestData = {
        initiator_id: selectedEmp.id, 
        initiator: selectedEmp.name,  
        department: dept,              
        type: type,                    
        category: costType,            
        urgency: urgency === "urgent" ? "срочно" : "normal",
        target_date: reqDate,
        description: description,
        attachment_url: finalAttachmentUrls,
        status_text: "Новая",
        current_step: 1
    };

    const { data: reqResult, error: reqError } = await supabase.from("v2_requests").insert([requestData]).select();

    if (reqError) {
        setSending(false);
        return alert("ОШИБКА СОЗДАНИЯ ЗАЯВКИ: " + reqError.message);
    }

    const newRequestId = reqResult[0].id;
    const newReqNumber = reqResult[0].req_number || reqResult[0].id; 

    // === СОХРАНЯЕМ ТОВАРЫ ===
    if (type === "goods" && items.length > 0) {
        const itemsToInsert = items.map(item => ({
            request_id: newRequestId,
            name: item.name,
            qty: parseFloat(String(item.qty).replace(',', '.')) || 0, 
            unit: item.unit,
            binding: item.binding
        }));

        const { error: itemsError } = await supabase.from("v2_request_items").insert(itemsToInsert);

        if (itemsError) {
            alert("ВНИМАНИЕ! БАЗА ОТКЛОНИЛА ТОВАРЫ:\n" + JSON.stringify(itemsError, null, 2));
            console.error("Ошибка сохранения товаров:", itemsError);
        }
    }

    setSending(false);
    setSubmittedId(newReqNumber); 
  };

  const getBindingPlaceholder = () => costType.includes("авто") ? "Выберите авто..." : costType.includes("с/х") ? "Выберите технику..." : "Для кого/чего?";
  const setQuickDate = (offsetType) => { const date = new Date(); if (offsetType === "tomorrow") date.setDate(date.getDate() + 1); if (offsetType === "week") date.setDate(date.getDate() + 7); if (offsetType === "month") date.setMonth(date.getMonth() + 1); setReqDate(date.toISOString().split('T')[0]); };

  if (submittedId) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4 font-sans">
            <div className="bg-white p-8 md:p-12 rounded-[32px] text-center max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300 border border-emerald-100">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <CheckCircle size={48} />
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-2 leading-tight">Заявка успешно<br/>отправлена!</h1>
                <p className="text-slate-500 font-medium mb-6">Ей присвоен уникальный номер:</p>
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl py-6 mb-8">
                    <div className="text-5xl font-black text-emerald-600 tracking-tighter">#{submittedId}</div>
                </div>
                <a href="/new-request" className="block w-full py-5 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-lg hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 active:scale-[0.98]">
                    Создать новую
                </a>
            </div>
        </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 gap-2"><Loader2 className="animate-spin"/> Загрузка справочников...</div>;

  return (
    <div className={`min-h-screen font-sans transition-all duration-500 overflow-x-hidden ${urgency === "urgent" ? "bg-red-50" : "bg-slate-50"}`}>
      
      {urgency === "urgent" && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
             <div className="absolute top-[15%] left-2 animate-bounce duration-1000"><div className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] uppercase -rotate-12 shadow-lg">📞 Тебе позвонят!</div></div>
        </div>
      )}

      <div className={`p-4 shadow-sm border-b flex items-center justify-between sticky top-0 z-20 transition-colors duration-500 ${urgency === "urgent" ? "bg-red-600 border-red-700 text-white" : "bg-white border-slate-100 text-slate-800"}`}>
        <a href="/" className={`hover:opacity-70 ${urgency === "urgent" ? "text-white" : "text-slate-400"}`}><ArrowLeft size={24} /></a>
        <div className="flex items-center gap-2">
            {urgency === "urgent" && <Flame className="animate-pulse" fill="white" size={20}/>}
            <h1 className="text-lg font-black uppercase">Новая заявка</h1>
        </div>
        <div className="w-6"></div>
      </div>

      <main className="max-w-3xl mx-auto p-4 md:p-8 pb-24 relative z-10">
        <form className={`space-y-6 transition-all duration-300 ${urgency === "urgent" ? "scale-[1.02]" : ""}`}>

            {/* ШАГ 1: КТО? */}
            <div className={`bg-white rounded-[24px] shadow-sm border p-6 space-y-5 relative transition-all duration-500 ${!isAuthenticated ? "border-blue-300 ring-4 ring-blue-50" : "border-slate-100"}`}>
                <div className={`absolute top-0 left-0 w-1.5 h-full rounded-l-2xl transition-colors ${!isAuthenticated ? "bg-blue-500" : "bg-green-500"}`}></div>
                <div className="flex justify-between items-center pl-2">
                    <h2 className="text-sm font-black uppercase text-slate-400">1. Инициатор</h2>
                    {isAuthenticated && <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center gap-1"><CheckCircle size={12}/> Подтверждено</span>}
                </div>

                <div className="relative" ref={suggestionRef}>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">ФИО Сотрудника</label>
                    {!selectedEmp ? (
                        <>
                            <div className="relative">
                                <User className="absolute left-4 top-4 text-slate-400" size={20} />
                                <input type="text" value={initiator} onChange={(e) => { setInitiator(e.target.value); setShowSuggestions(true); setIsAuthenticated(false); setInputPassword(""); }} onFocus={() => setShowSuggestions(true)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Начните вводить фамилию..." />
                            </div>
                            {showSuggestions && initiator.length > 0 && (
                                <ul className="absolute z-50 w-full bg-white border border-slate-300 rounded-xl mt-2 shadow-2xl max-h-60 overflow-y-auto ring-4 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                                    {filteredEmployees.map((emp) => (
                                        <li key={emp.id} onClick={() => handleSelectEmployee(emp)} className="p-4 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 flex flex-col">
                                            <span className="font-black text-slate-800 text-sm">{emp.name}</span>
                                            <span className="text-xs text-slate-500 font-bold uppercase">{emp.position} • {emp.department}</span>
                                        </li>
                                    ))}
                                    {filteredEmployees.length === 0 && <li className="p-4 text-xs text-slate-400 text-center font-bold">Сотрудник не найден</li>}
                                </ul>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="w-full bg-blue-50 border border-blue-100 rounded-2xl py-4 pl-4 pr-4 flex justify-between items-center">
                                <span className="font-bold text-slate-800">{initiator}</span>
                                <button type="button" onClick={handleClearEmployee} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
                            </div>
                            {!isAuthenticated && (
                                <div className="flex gap-2">
                                    <div className="relative flex-grow">
                                        <Lock className="absolute left-4 top-4 text-slate-400" size={18} />
                                        <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkPassword()} className={`w-full bg-white border rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 ${passwordError ? "border-red-500 ring-2 ring-red-100" : "border-slate-200"}`} placeholder="PIN Код" autoFocus />
                                    </div>
                                    <button type="button" onClick={checkPassword} className="bg-blue-600 text-white px-6 rounded-2xl font-black text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-200">OK</button>
                                </div>
                            )}
                            {passwordError && <p className="text-xs text-red-500 font-bold ml-2">Неверный ПИН-код!</p>}
                        </div>
                    )}
                </div>
                {isAuthenticated && (
                    <div className="animate-in fade-in slide-in-from-top-4">
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Отдел</label>
                        <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full border rounded-2xl p-4 font-bold text-slate-700 bg-slate-50 border-slate-200 cursor-pointer appearance-none">
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* ШАГ 2: ПАРАМЕТРЫ */}
            {isAuthenticated && (
                <div ref={step2Ref} className={`bg-white rounded-[24px] shadow-sm border p-6 space-y-5 relative overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 ${urgency === "urgent" ? "border-red-500 ring-4 ring-red-100" : "border-slate-100"}`}>
                    <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-500 ${urgency === "urgent" ? "bg-red-600" : "bg-emerald-500"}`}></div>
                    <h2 className="text-sm font-black uppercase text-slate-400 pl-2">2. Параметры</h2>
                    <div>
                        <div className="flex bg-slate-100 p-1 rounded-2xl mb-4">
                            <button type="button" onClick={() => { setType("goods"); setCostType(""); }} className={`flex-1 py-4 rounded-xl text-xs font-black uppercase transition ${type === "goods" ? "bg-white shadow text-emerald-600" : "text-slate-500"}`}>Товар</button>
                            <button type="button" onClick={() => { setType("service"); setCostType(""); }} className={`flex-1 py-4 rounded-xl text-xs font-black uppercase transition ${type === "service" ? "bg-white shadow text-emerald-600" : "text-slate-500"}`}>Услуга</button>
                        </div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">{type === "goods" ? "Категория" : "Тип услуги"}</label>
                        <select value={costType} onChange={(e) => setCostType(e.target.value)} className={`w-full border rounded-2xl p-4 font-bold text-slate-700 cursor-pointer appearance-none transition-all ${costType === "" ? "bg-blue-50 border-blue-400 animate-pulse" : "bg-slate-50 border-slate-200"}`}>
                            <option value="" disabled>👇 Выберите {type === "goods" ? "категорию" : "тип услуги"}</option>
                            {type === "goods" ? costCategories.map(c => <option key={c}>{c}</option>) : serviceTypes.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={`text-[10px] font-bold uppercase block mb-2 ${urgency === "urgent" ? "text-red-600 animate-pulse" : "text-slate-400"}`}>
                            {urgency === "urgent" ? "🔥 УРОВЕНЬ СРОЧНОСТИ 🔥" : "Срочность"}
                        </label>
                        <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={`w-full border rounded-2xl p-4 font-black uppercase text-xs cursor-pointer appearance-none transition-all duration-300 ${urgency === "urgent" ? "bg-red-600 text-white border-red-600 scale-105" : "bg-slate-50 border-slate-200 text-slate-900"}`}>
                            <option value="normal">Не срочно</option>
                            <option value="urgent">🔥 СРОЧНО (ПОЗВОНЯТ) 🔥</option>
                        </select>
                    </div>
                </div>
            )}

            {/* ШАГ 3: ДЕТАЛИ И ТОВАРЫ */}
            {isAuthenticated && costType && (
                <div ref={step3Ref} className="space-y-6">
                    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 space-y-5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                        <h2 className="text-sm font-black uppercase text-slate-400 pl-2">3. Детали</h2>
                        {type === "service" && (
                            <div className="animate-in fade-in"><label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Название услуги</label><input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold" placeholder="Ремонт..." /></div>
                        )}
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-2">Дата {type === "goods" ? "поставки" : "выполнения"}</label>
                            <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                                <button type="button" onClick={() => setQuickDate("tomorrow")} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black uppercase whitespace-nowrap hover:bg-purple-100 transition">Завтра</button>
                                <button type="button" onClick={() => setQuickDate("week")} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black uppercase whitespace-nowrap hover:bg-purple-100 transition">+Неделя</button>
                                <button type="button" onClick={() => setQuickDate("month")} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black uppercase whitespace-nowrap hover:bg-purple-100 transition">+Месяц</button>
                            </div>
                            <div className="relative"><Calendar className="absolute left-4 top-4 text-slate-400" size={20} /><input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-600" /></div>
                        </div>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="4" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-purple-500" placeholder="Подробное описание..."></textarea>
                    </div>

                    {type === "goods" && (
                        <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 space-y-5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
                            <div className="flex justify-between items-center pl-2">
                                <h2 className="text-sm font-black uppercase text-slate-400">4. Товары</h2>
                                <button type="button" onClick={addItem} className="px-3 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black border border-orange-100 flex items-center gap-1"><Plus size={14} /> ДОБАВИТЬ</button>
                            </div>
                            
                            <div className="space-y-4">
                                {items.map((item, index) => (
                                    <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
                                        <div className="absolute top-2 right-2 text-[10px] font-black text-slate-300">#{index + 1}</div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="col-span-4"><input type="text" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold" placeholder="Наименование" /></div>
                                            <div className="col-span-1">
                                                <input type="text" inputMode="decimal" value={item.qty} onChange={(e) => updateItem(item.id, "qty", e.target.value.replace(/[^0-9.,]/g, ''))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-center font-bold" placeholder="Кол-во" />
                                            </div>
                                            <div className="col-span-2"><select value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)} className={`w-full border rounded-xl p-3 text-xs font-bold cursor-pointer appearance-none transition-all ${item.unit === "" ? "bg-blue-50 border-blue-400 text-blue-600" : "bg-white border-slate-200 text-slate-600"}`}><option value="" disabled>Ед.изм</option>{units.map(u => <option key={u}>{u}</option>)}</select></div>
                                            <div className="col-span-1 flex justify-center"><button type="button" onClick={() => removeItem(item.id)} className="p-2 text-red-300 hover:bg-white hover:text-red-500 rounded-full"><Trash2 size={20} /></button></div>
                                            
                                            <div className="col-span-4">
                                                {(costType.includes("авто") || costType.includes("с/х")) ? (
                                                    <div className="relative">
                                                        <select value={item.binding} onChange={(e) => updateItem(item.id, "binding", e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 pr-8 text-xs font-bold text-blue-700 cursor-pointer appearance-none">
                                                            <option value="" disabled>{getBindingPlaceholder()}</option>
                                                            {(costType.includes("авто") ? vehicles : agriMachinery).map(v => (
                                                                <option key={v.id} value={`${v.name} | ${v.inventory_number || ''}`}>{v.name} {v.inventory_number ? `(${v.inventory_number})` : ''}</option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
                                                    </div>
                                                ) : (
                                                    <input type="text" value={item.binding} onChange={(e) => updateItem(item.id, "binding", e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-blue-700" placeholder={getBindingPlaceholder()} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* РАБОЧИЙ БЛОК ЗАГРУЗКИ ФАЙЛОВ */}
                    <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 space-y-5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400"></div>
                        <h2 className="text-sm font-black uppercase text-slate-400 pl-2">Файлы (Опционально)</h2>
                        
                        {/* СПИСОК ВЫБРАННЫХ ФАЙЛОВ */}
                        {selectedFiles.length > 0 && (
                            <div className="space-y-2 mb-4">
                                {selectedFiles.map((file, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                                        <span className="truncate pr-2">{file.name}</span>
                                        <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-[24px] cursor-pointer bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition group">
                            <FileText size={32} className="text-slate-300 mb-2 group-hover:text-blue-400 transition" />
                            <p className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-blue-500 transition">Добавить фото/скан</p>
                            <input type="file" multiple onChange={handleFileChange} className="hidden" />
                        </label>
                    </div>

                    <button 
                        type="button" 
                        disabled={!costType || sending} 
                        onClick={sendRequest} 
                        className={`w-full py-5 rounded-[24px] font-black text-lg shadow-xl flex items-center justify-center gap-3 transition-all sticky bottom-4 z-10 
                        ${sending 
                            ? "bg-slate-300 text-slate-500 cursor-wait"
                            : !costType 
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                                : urgency === "urgent"
                                    ? "bg-red-600 text-white shadow-red-300 hover:bg-red-700 animate-pulse scale-[1.02]"
                                    : "bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700 active:scale-[0.98]"
                        }`}
                    >
                        {sending ? <Loader2 className="animate-spin" /> : (urgency === "urgent" ? <AlertTriangle size={24} className="animate-bounce" /> : <Send size={24} />)}
                        {sending ? "ИДЕТ ОТПРАВКА..." : (urgency === "urgent" ? "ОТПРАВИТЬ СРОЧНО" : "ОТПРАВИТЬ ЗАЯВКУ")}
                    </button>
                </div>
            )}
        </form>
      </main>
    </div>
  );
}

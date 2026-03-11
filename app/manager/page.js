// ==========================================
// ФАЙЛ №3: КАБИНЕТ РУКОВОДИТЕЛЯ (С ДАШБОРДОМ БЮДЖЕТОВ)
// ПУТЬ: app/manager/page.js
// ==========================================

"use client";
import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, User, CheckCircle, Loader2, Wallet, ChevronDown, ChevronUp, X, Paperclip, Download, FileText, PieChart, TrendingDown } from "lucide-react";

// Подключаем наш умный моторчик маршрутов!
import { getNextStep } from "../utils/workflow";

// Берем ключи из .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; 
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [employeesDB, setEmployeesDB] = useState([]);
  const [initiator, setInitiator] = useState(""); 
  const [selectedEmp, setSelectedEmp] = useState(null); 
  const [inputPassword, setInputPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false); 
  const [allRequests, setAllRequests] = useState([]); 
  const [requestItems, setRequestItems] = useState({});
  const [budgets, setBudgets] = useState([]);
  const [viewMode, setViewMode] = useState("active"); 
  const [expandedReq, setExpandedReq] = useState(null); 
  const [selectedDept, setSelectedDept] = useState({}); 
  const [selectedBudget, setSelectedBudget] = useState({}); 
  const [processingId, setProcessingId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const loadEmployees = async () => {
        const { data: emp } = await supabase.from("v2_employees").select("*").order("name");
        if (emp) setEmployeesDB(emp);
        setLoading(false);
    };
    loadEmployees();
  }, []);

  const checkPassword = async () => {
    const dbPin = String(selectedEmp.pin_code || selectedEmp.password || "");
    if (selectedEmp && inputPassword === dbPin) {
        setIsAuthenticated(true);
        setPasswordError(false);
        await loadManagerData(selectedEmp.department);
    } else {
        setPasswordError(true);
    }
  };

  const loadManagerData = async (department) => {
      setLoading(true);
      // Если это Дирекция, грузим все заявки, иначе только своего отдела
      let query = supabase.from("v2_requests").select("*").order("created_at", { ascending: false });
      if (department !== "Дирекция" && department !== "Руководство") {
          query = query.eq("department", department);
      }
      
      const { data: reqs } = await query;
      if (reqs) setAllRequests(reqs);

      if (reqs && reqs.length > 0) {
          const reqIds = reqs.map(r => r.id);
          const { data: items } = await supabase.from("v2_request_items").select("*").in("request_id", reqIds);
          if (items) {
              const grouped = items.reduce((acc, item) => {
                  if (!acc[item.request_id]) acc[item.request_id] = [];
                  acc[item.request_id].push(item);
                  return acc;
              }, {});
              setRequestItems(grouped);
          }
      }
      // Всегда грузим все бюджеты компании для сводки
      const { data: bgs } = await supabase.from("v2_budgets").select("*").order("item_name");
      if (bgs) setBudgets(bgs);
      setLoading(false);
  };

  // 🧠 УМНЫЙ КАЛЬКУЛЯТОР БЮДЖЕТОВ
  const budgetStats = useMemo(() => {
      const stats = {};
      let grandTotal = 0;
      let grandSpent = 0;

      // 1. Считаем общие лимиты (из таблицы v2_budgets)
      budgets.forEach(b => {
          const dept = b.department || "Общие";
          if (!stats[dept]) stats[dept] = { total: 0, spent: 0 };
          
          const total = Number(b.amount) || 0;
          // Если в базе уже есть колонка spent, берем её. Иначе 0.
          const spent = Number(b.spent) || 0; 

          stats[dept].total += total;
          stats[dept].spent += spent;
          
          grandTotal += total;
          grandSpent += spent;
      });

      // 2. Симуляция: прибавляем к расходам одобренные заявки с экрана
      // (Чтобы шкала заполнялась в реальном времени даже без колонки spent в базе)
      allRequests.forEach(req => {
          if (req.current_step > 1 && req.budget_id) {
              const b = budgets.find(bg => bg.id === req.budget_id);
              if (b && !b.spent) { // Считаем только если база сама не отдает spent
                  const dept = b.department || "Общие";
                  // Берем сумму (пока условную, если нет точной суммы договора)
                  const reqSum = Number(req.contract_sum) || Number(req.payment_sum) || 15000; 
                  if (stats[dept]) {
                      stats[dept].spent += reqSum;
                      grandSpent += reqSum;
                  }
              }
          }
      });

      return { departments: stats, grandTotal, grandSpent };
  }, [budgets, allRequests]);

  const handleApprove = async (reqId) => {
      const req = allRequests.find(r => r.id === reqId);
      const selectedBudgetId = selectedBudget[reqId];
      if (!selectedBudgetId) return alert("⚠️ Пожалуйста, выберите статью бюджета!");
      const budgetObj = budgets.find(b => b.id === selectedBudgetId);
      
      setProcessingId(reqId);

      // ⚙️ МОТОРЧИК: Спрашиваем маршрут у админки
      const nextStep = await getNextStep(req.current_step || 1, req);

      const { error } = await supabase.from("v2_requests").update({ 
          current_step: nextStep, 
          status_text: `В работе (Этап ${nextStep})`, 
          budget_id: budgetObj.id, 
          budget_category: budgetObj.item_name 
      }).eq("id", reqId);

      if (error) { alert("ОШИБКА: " + error.message); setProcessingId(null); return; }
      
      setAllRequests(allRequests.map(r => r.id === reqId ? { 
          ...r, 
          current_step: nextStep, 
          status_text: `В работе (Этап ${nextStep})`, 
          budget_id: budgetObj.id, 
          budget_category: budgetObj.item_name 
      } : r));
      
      setProcessingId(null);
      setExpandedReq(null);
  };

  const formatMoney = (amount) => { if (!amount) return "0"; return Number(amount).toLocaleString('ru-RU'); };
  const isImage = (url) => url.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?$/i);
  const isPdf = (url) => url.match(/\.(pdf)(\?.*)?$/i);
  const isDoc = (url) => url.match(/\.(doc|docx|xls|xlsx|ppt|pptx|rtf)(\?.*)?$/i);

  const activeRequests = allRequests.filter(r => r.current_step === 1);
  const historyRequests = allRequests.filter(r => r.current_step > 1);
  const displayedRequests = viewMode === "active" ? activeRequests : historyRequests;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10 relative text-slate-900">
      
      {/* МОДАЛКА ПРОСМОТРА */}
      {previewUrl && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/90 backdrop-blur-sm p-0 md:p-4">
              <div className="bg-white w-full max-w-5xl h-[92vh] md:h-[85vh] rounded-t-[32px] md:rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-full duration-300">
                  <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                      <div className="flex items-center gap-2">
                          <button onClick={() => setPreviewUrl(null)} className="p-2 -ml-2 text-slate-400 md:hidden"><ArrowLeft/></button>
                          <h3 className="font-black text-slate-800 text-sm">Просмотр документа</h3>
                      </div>
                      <div className="flex gap-2">
                          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Download size={20}/></a>
                          <button onClick={() => setPreviewUrl(null)} className="hidden md:block p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><X size={20}/></button>
                      </div>
                  </div>
                  <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto relative">
                      {isImage(previewUrl) ? (
                          <img src={previewUrl} className="max-w-full max-h-full object-contain p-2" alt="Файл" />
                      ) : isPdf(previewUrl) ? (
                          <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-none bg-white"/>
                      ) : isDoc(previewUrl) ? (
                          <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} className="w-full h-full border-none bg-white"/>
                      ) : (
                          <div className="text-center p-10">
                              <FileText size={48} className="mx-auto text-slate-300 mb-4"/>
                              <p className="text-slate-500 font-bold mb-4">Предпросмотр недоступен</p>
                              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">Открыть / Скачать</a>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* ШАПКА */}
      <div className="p-4 flex items-center justify-between sticky top-0 z-20 bg-indigo-600 text-white shadow-md">
        <a href="/" className="p-2 -ml-2"><ArrowLeft size={24} /></a>
        <h1 className="text-sm font-black uppercase tracking-widest">Кабинет руководителя</h1>
        <div className="w-10"></div>
      </div>

      <main className="max-w-xl mx-auto p-4 md:p-8">
        {!isAuthenticated ? (
            /* ВХОД */
            <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 p-6 space-y-6">
                <div className="text-center space-y-1">
                    <h2 className="text-xl font-black text-slate-800">СЭД v2.0</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Вход для руководителей</p>
                </div>
                {!selectedEmp ? (
                    <div className="relative">
                        <User className="absolute left-4 top-4 text-slate-300" size={20} />
                        <input type="text" value={initiator} onChange={(e) => setInitiator(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 font-bold outline-none" placeholder="Фамилия..." />
                        {initiator.length > 0 && (
                            <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-2xl mt-2 shadow-2xl max-h-60 overflow-y-auto p-2">
                                {employeesDB.filter(e => e.name.toLowerCase().includes(initiator.toLowerCase())).map((emp) => (
                                    <li key={emp.id} onClick={() => { setSelectedEmp(emp); setInitiator(emp.name); }} className="p-4 hover:bg-indigo-50 rounded-xl font-black text-slate-800 border-b last:border-0">{emp.name}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex justify-between items-center">
                            <span className="font-black text-indigo-700">{selectedEmp.name}</span>
                            <button onClick={() => {setSelectedEmp(null); setInputPassword("");}} className="text-indigo-300"><X size={20}/></button>
                        </div>
                        <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkPassword()} className="w-full bg-white border border-slate-200 rounded-2xl py-4 text-center text-2xl font-black tracking-[0.5em]" placeholder="PIN" autoFocus />
                        <button onClick={checkPassword} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg shadow-indigo-100">Войти</button>
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-6">
                
                {/* КАРТОЧКА ПРОФИЛЯ */}
                <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black">{selectedEmp.name[0]}</div>
                        <div>
                            <h2 className="text-sm font-black text-slate-800 leading-none">{selectedEmp.name}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{selectedEmp.department}</p>
                        </div>
                    </div>
                </div>

                {/* 📊 ДАШБОРД БЮДЖЕТОВ (ШКАЛЫ) */}
                {Object.keys(budgetStats.departments).length > 0 && (
                    <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <PieChart className="text-indigo-600" size={20}/>
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Бюджет компании</h3>
                        </div>
                        
                        {/* ОБЩИЙ БЮДЖЕТ (Только если есть права или грузятся все бюджеты) */}
                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                            <div className="flex justify-between text-xs font-black mb-2 text-indigo-900">
                                <span className="uppercase">Всего израсходовано</span>
                                <span>{formatMoney(budgetStats.grandSpent)} / {formatMoney(budgetStats.grandTotal)} ₸</span>
                            </div>
                            <div className="w-full bg-indigo-200/50 rounded-full h-3 overflow-hidden">
                                <div className="bg-indigo-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${Math.min((budgetStats.grandSpent / (budgetStats.grandTotal || 1)) * 100, 100)}%` }}></div>
                            </div>
                        </div>

                        {/* ШКАЛЫ ПО ОТДЕЛАМ */}
                        <div className="space-y-4 pt-2">
                            {Object.entries(budgetStats.departments).map(([dept, data]) => {
                                const percent = Math.min((data.spent / (data.total || 1)) * 100, 100);
                                // Динамический цвет: Зеленый -> Желтый -> Красный
                                let barColor = "bg-emerald-500";
                                if (percent > 60) barColor = "bg-amber-500";
                                if (percent > 90) barColor = "bg-red-500";

                                return (
                                    <div key={dept} className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold">
                                            <span className="text-slate-600 uppercase flex items-center gap-1"><TrendingDown size={12} className="text-slate-400"/> {dept}</span>
                                            <span className="text-slate-500">{formatMoney(data.spent)} / <span className="text-slate-800">{formatMoney(data.total)}</span> ₸</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <div className={`${barColor} h-2 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ПЕРЕКЛЮЧАТЕЛЬ ВКЛАДОК */}
                <div className="flex gap-2 bg-slate-200/50 p-1 rounded-2xl">
                    <button onClick={() => setViewMode('active')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${viewMode === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Ожидают ({activeRequests.length})</button>
                    <button onClick={() => setViewMode('history')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${viewMode === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>История ({historyRequests.length})</button>
                </div>

                {/* СПИСОК ЗАЯВОК */}
                <div className="space-y-4">
                    {displayedRequests.map(req => (
                        <div key={req.id} className={`bg-white rounded-[28px] shadow-sm border ${expandedReq === req.id ? "border-indigo-300 ring-4 ring-indigo-50" : "border-slate-100"}`}>
                            <div onClick={() => { setExpandedReq(expandedReq === req.id ? null : req.id); if (expandedReq !== req.id && !selectedDept[req.id]) setSelectedDept({...selectedDept, [req.id]: req.department}); }} className="p-5 cursor-pointer flex justify-between items-center">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded">#{req.req_number || 'B/N'}</span>
                                        {req.urgency === "срочно" && <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase">Срочно</span>}
                                        {/* Если заявка обработана, показываем её текущий статус из Умного Маршрутизатора */}
                                        {req.current_step > 1 && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase">{req.status_text || "В работе"}</span>}
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{req.category}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">От: {req.initiator}</p>
                                </div>
                                <div className="text-slate-300">{expandedReq === req.id ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}</div>
                            </div>

                            {expandedReq === req.id && (
                                <div className="p-5 border-t border-slate-50 space-y-6">
                                    {req.description && (
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <p className="text-xs text-slate-600 italic">"{req.description}"</p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {requestItems[req.id]?.map((item) => (
                                            <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-200 flex justify-between items-center">
                                                <p className="text-sm font-black text-slate-800">{item.name}</p>
                                                <div className="bg-slate-100 px-3 py-1 rounded-xl font-black text-xs text-slate-700">{item.quantity} {item.unit}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {req.attachment_url && (
                                        <div className="flex flex-wrap gap-2">
                                            {req.attachment_url.split(',').map((url, idx) => (
                                                <button key={idx} onClick={() => setPreviewUrl(url.trim())} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-3 rounded-2xl text-[10px] font-black border border-indigo-100 shadow-sm"><Paperclip size={14}/> ФАЙЛ {idx + 1}</button>
                                            ))}
                                        </div>
                                    )}

                                    {viewMode === "active" ? (
                                        <div className="space-y-3 pt-2">
                                            <div className="bg-indigo-600 rounded-3xl p-4">
                                                <select value={selectedDept[req.id] || ""} onChange={(e) => { setSelectedDept({...selectedDept, [req.id]: e.target.value}); setSelectedBudget({...selectedBudget, [req.id]: ""}); }} className="w-full bg-indigo-500 text-white rounded-xl p-4 font-black text-sm outline-none mb-3 border-none">
                                                    <option value="" disabled>ВЫБРАТЬ ОТДЕЛ...</option>
                                                    {[...new Set(budgets.map(b => b.department))].sort().map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                                </select>
                                                <select value={selectedBudget[req.id] || ""} onChange={(e) => setSelectedBudget({...selectedBudget, [req.id]: e.target.value})} disabled={!selectedDept[req.id]} className="w-full bg-white text-slate-800 rounded-xl p-4 font-black text-sm border-none outline-none">
                                                    <option value="" disabled>ВЫБРАТЬ СТАТЬЮ...</option>
                                                    {budgets.filter(b => b.department === selectedDept[req.id]).map(b => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.item_name} | {formatMoney(b.amount)} ₸ {b.priority ? `(Приоритет: ${b.priority})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button onClick={() => handleApprove(req.id)} disabled={processingId === req.id} className="w-full py-5 bg-emerald-500 text-white rounded-3xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2">
                                                {processingId === req.id ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                                                Одобрить и Отправить 
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                                            <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><Wallet size={16}/></div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Списано со статьи:</p>
                                                <p className="text-xs font-black text-slate-800">{req.budget_category}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

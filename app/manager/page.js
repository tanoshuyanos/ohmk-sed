// ==========================================
// ФАЙЛ: КАБИНЕТ РУКОВОДИТЕЛЯ (DARK MODE + ОБЩИЙ ВЕЕР)
// ПУТЬ: app/manager/page.js
// ==========================================

"use client";
import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, User, CheckCircle, Loader2, Wallet, ChevronDown, Paperclip, Download, FileText, PieChart, Calendar, Receipt, CreditCard, ChevronRight, X, Layers, Moon, Sun } from "lucide-react";

import { getNextStep } from "../utils/workflow";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; 
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Бронебойный очиститель чисел
const cleanNumber = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return Number(String(val).replace(/[^0-9.-]+/g, "")) || 0;
};

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
  const [expandedDept, setExpandedDept] = useState(null);
  
  // Анимация стопки
  const [isStackExpanded, setIsStackExpanded] = useState(false);

  // ТЕМНАЯ / СВЕТЛАЯ ТЕМА (По умолчанию темная)
  const [isDark, setIsDark] = useState(true);

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
      const { data: bgs } = await supabase.from("v2_budgets").select("*").order("item_name");
      if (bgs) setBudgets(bgs);
      setLoading(false);
  };

  const budgetStats = useMemo(() => {
      const stats = {};
      let grandTotal = 0;
      let grandSpent = 0;

      budgets.forEach(b => {
          const dept = b.department || "Общие";
          if (!stats[dept]) stats[dept] = { total: 0, spent: 0, history: [] };
          
          const total = cleanNumber(b.amount);
          const spent = cleanNumber(b.spent); 

          stats[dept].total += total;
          stats[dept].spent += spent;
          grandTotal += total;
          grandSpent += spent;
      });

      allRequests.forEach(req => {
          if (req.current_step > 1 && req.budget_id) {
              const b = budgets.find(bg => bg.id === req.budget_id);
              if (b) {
                  const dept = b.department || "Общие";
                  const reqSum = cleanNumber(req.amount) || cleanNumber(req.contract_sum) || cleanNumber(req.payment_sum) || cleanNumber(req.sum) || 0;
                  
                  if (stats[dept]) {
                      if (!b.spent && reqSum > 0) {
                          stats[dept].spent += reqSum;
                          grandSpent += reqSum;
                      }
                      stats[dept].history.push({
                          id: req.id,
                          num: req.req_number || 'B/N',
                          date: req.created_at,
                          category: req.budget_category || req.category,
                          sum: reqSum,
                          initiator: req.initiator
                      });
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
  const formatDate = (dateStr) => { if(!dateStr) return ""; return new Date(dateStr).toLocaleDateString('ru-RU', {day: '2-digit', month: 'short'}); };
  
  const activeRequests = allRequests.filter(r => r.current_step === 1);
  const historyRequests = allRequests.filter(r => r.current_step > 1);
  const displayedRequests = viewMode === "active" ? activeRequests : historyRequests;

  // СОБИРАЕМ ВСЕ КАРТЫ В ОДИН МАССИВ ДЛЯ ВЕЕРА
  const stackCards = useMemo(() => {
      const cards = [];
      // 1. Главная карта (Общий бюджет)
      cards.push({
          id: 'grandTotal',
          isTotal: true,
          title: 'Компания (Общий)',
          spent: budgetStats.grandSpent,
          total: budgetStats.grandTotal,
          history: [] // Для общей не выводим историю, чтобы не дублировать
      });
      // 2. Карты отделов
      Object.entries(budgetStats.departments).forEach(([dept, data]) => {
          cards.push({
              id: dept,
              isTotal: false,
              title: dept,
              spent: data.spent,
              total: data.total,
              history: data.history
          });
      });
      return cards;
  }, [budgetStats]);

  // Цветовые константы для темы
  const theme = {
      bgMain: isDark ? "bg-[#0B1121]" : "bg-[#f4f6f8]",
      textMain: isDark ? "text-slate-100" : "text-slate-900",
      textMuted: isDark ? "text-slate-400" : "text-slate-500",
      cardBg: isDark ? "bg-[#1E293B]" : "bg-white",
      cardBorder: isDark ? "border-[#334155]" : "border-slate-100",
      cardHover: isDark ? "hover:border-indigo-500/50" : "hover:border-slate-300",
      cardShadow: isDark ? "shadow-[0_10px_40px_rgba(0,0,0,0.5)]" : "shadow-[0_8px_30px_rgba(0,0,0,0.04)]",
      inputBg: isDark ? "bg-[#0B1121]/50" : "bg-slate-100/50",
      inputBorder: isDark ? "border-[#334155]" : "border-transparent",
      toggleBg: isDark ? "bg-[#0B1121]" : "bg-slate-200/50",
      tabActiveBg: isDark ? "bg-[#1E293B] text-white" : "bg-white text-slate-900",
      tabInactiveText: isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500",
      innerBg: isDark ? "bg-[#0F172A]" : "bg-slate-50",
  };

  return (
    <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans pb-20 relative transition-colors duration-500`}>
      
      {/* ПРЕВЬЮ ФАЙЛОВ */}
      {previewUrl && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md p-0 md:p-4 transition-all">
              <div className="bg-[#1E293B] border border-slate-700 w-full max-w-5xl h-[92vh] md:h-[85vh] rounded-t-[32px] md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-full duration-300">
                  <div className="p-5 flex justify-between items-center bg-[#1E293B] border-b border-slate-700 z-10">
                      <div className="flex items-center gap-3">
                          <button onClick={() => setPreviewUrl(null)} className="md:hidden bg-slate-800 text-white p-2 rounded-full"><ArrowLeft size={18}/></button>
                          <h3 className="font-bold text-white text-sm">Документ</h3>
                      </div>
                      <div className="flex gap-2">
                          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-indigo-500/20 text-indigo-400 rounded-full hover:bg-indigo-500/40 transition"><Download size={18}/></a>
                          <button onClick={() => setPreviewUrl(null)} className="hidden md:block p-3 bg-slate-800 text-slate-400 rounded-full hover:bg-slate-700 transition"><X size={18}/></button>
                      </div>
                  </div>
                  <div className="flex-1 bg-black/50 flex items-center justify-center overflow-auto relative p-4">
                      {previewUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?$/i) ? (
                          <img src={previewUrl} className="max-w-full max-h-full rounded-xl shadow-sm" alt="Файл" />
                      ) : (
                          <iframe src={previewUrl.match(/\.(pdf)(\?.*)?$/i) ? `${previewUrl}#toolbar=0` : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} className="w-full h-full border-none bg-white rounded-xl shadow-sm"/>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* ШАПКА */}
      <div className={`bg-gradient-to-r ${isDark ? 'from-[#0F172A] to-[#1E293B]' : 'from-slate-900 to-slate-800'} text-white p-5 sticky top-0 z-20 shadow-xl shadow-black/20 rounded-b-[32px] md:rounded-none transition-colors duration-500`}>
        <div className="max-w-xl mx-auto flex items-center justify-between">
            <a href="/" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition backdrop-blur-md"><ArrowLeft size={20} /></a>
            <div className="text-center">
                <h1 className="text-sm font-black tracking-widest uppercase text-white">Управление</h1>
                {isAuthenticated && <p className="text-[10px] text-indigo-300 font-bold tracking-wide mt-0.5">{selectedEmp.department}</p>}
            </div>
            <div className="flex items-center gap-3">
                {/* Переключатель темы */}
                <button onClick={() => setIsDark(!isDark)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition text-yellow-300">
                    {isDark ? <Sun size={18}/> : <Moon size={18} className="text-slate-200"/>}
                </button>
                <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-black shadow-inner shadow-black/50 border border-white/10">
                    {isAuthenticated ? selectedEmp.name[0] : <User size={16}/>}
                </div>
            </div>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-4 md:p-6 mt-2">
        {!isAuthenticated ? (
            /* ЭКРАН ВХОДА */
            <div className={`${theme.cardBg} border ${theme.cardBorder} ${theme.cardShadow} backdrop-blur-xl rounded-[32px] p-8 mt-6 transition-all`}>
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-indigo-500/30"><User className="text-white" size={28}/></div>
                    <h2 className={`text-2xl font-black ${theme.textMain} tracking-tight`}>Вход в систему</h2>
                </div>
                {!selectedEmp ? (
                    <div className="relative">
                        <input type="text" value={initiator} onChange={(e) => setInitiator(e.target.value)} className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-2xl py-4 px-6 font-bold ${theme.textMain} placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 transition outline-none`} placeholder="Ваша фамилия..." />
                        {initiator.length > 0 && (
                            <ul className={`absolute z-50 w-full ${theme.cardBg} border ${theme.cardBorder} rounded-2xl mt-2 shadow-2xl overflow-hidden p-1`}>
                                {employeesDB.filter(e => e.name.toLowerCase().includes(initiator.toLowerCase())).map((emp) => (
                                    <li key={emp.id} onClick={() => { setSelectedEmp(emp); setInitiator(emp.name); }} className={`p-4 hover:bg-indigo-500/10 rounded-xl font-bold ${theme.textMain} cursor-pointer transition`}>{emp.name}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className={`w-full ${isDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'} border rounded-2xl p-4 flex justify-between items-center`}>
                            <span className="font-bold text-indigo-500">{selectedEmp.name}</span>
                            <button onClick={() => {setSelectedEmp(null); setInputPassword("");}} className={`p-1.5 rounded-full ${isDark ? 'bg-[#0B1121] text-slate-400' : 'bg-white text-slate-400'} shadow-sm`}><X size={14}/></button>
                        </div>
                        <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkPassword()} className={`w-full ${theme.inputBg} border ${theme.inputBorder} rounded-2xl py-4 text-center text-2xl font-black tracking-[0.5em] ${theme.textMain} focus:ring-2 focus:ring-indigo-500 transition outline-none`} placeholder="PIN" autoFocus />
                        <button onClick={checkPassword} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold tracking-wide shadow-xl shadow-indigo-600/20 transition">Подтвердить</button>
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-6 mt-2">
                
                {stackCards.length > 0 && (
                    <div className="space-y-4">
                        
                        {/* ЗАГОЛОВОК СТОПКИ */}
                        <div className="flex justify-between items-center px-2 cursor-pointer group" onClick={() => { setIsStackExpanded(!isStackExpanded); if (isStackExpanded) setExpandedDept(null); }}>
                            <div className="flex items-center gap-2">
                                <Layers className="text-indigo-500" size={18}/>
                                <h3 className={`font-bold ${theme.textMuted} text-xs uppercase tracking-widest`}>Кошелек</h3>
                            </div>
                            <div className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full flex items-center gap-1 transition-all ${isStackExpanded ? (isDark ? 'bg-[#1E293B] text-slate-300' : 'bg-slate-200 text-slate-600') : 'bg-indigo-500/20 text-indigo-400 shadow-sm shadow-indigo-500/10'}`}>
                                {isStackExpanded ? "Свернуть" : `Веер (${stackCards.length})`}
                                {isStackExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            </div>
                        </div>

                        {/* АНИМИРОВАННАЯ СТОПКА КАРТ (ТЕПЕРЬ С ОБЩЕЙ СУММОЙ) */}
                        <div className="flex flex-col relative pb-4">
                            {stackCards.map((card, i) => {
                                const percent = Math.min((card.spent / (card.total || 1)) * 100, 100);
                                
                                // Цвета шкалы
                                let gradient = "from-emerald-400 to-emerald-500";
                                if (percent > 60) gradient = "from-amber-400 to-amber-500";
                                if (percent > 90) gradient = "from-red-400 to-red-500";
                                
                                const isCardExpanded = expandedDept === card.id;
                                const isStacked = !isStackExpanded;

                                // Настройка отображения карты "Всего"
                                const cardBgClass = card.isTotal 
                                    ? (isDark ? "bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-[#334155]" : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-transparent")
                                    : `${theme.cardBg} border ${theme.cardBorder}`;
                                
                                const titleColor = card.isTotal ? (isDark ? "text-indigo-400" : "text-white") : theme.textMain;
                                const amountColor = card.isTotal ? (isDark ? "text-white" : "text-white") : theme.textMain;
                                const subtitleColor = card.isTotal ? (isDark ? "text-slate-400" : "text-indigo-200") : theme.textMuted;
                                const barBg = card.isTotal && !isDark ? "bg-black/20" : (isDark ? "bg-[#0F172A]" : "bg-slate-100");

                                // Логика анимации позиции
                                let mt = "0px";
                                let scale = 1;
                                let opacity = 1;
                                
                                if (isStacked) {
                                    if (i === 0) { scale = 1; mt = "0px"; } 
                                    else if (i === 1) { scale = 0.95; mt = "-70px"; } 
                                    else if (i === 2) { scale = 0.90; mt = "-80px"; } 
                                    else { scale = 0.85; mt = "-100px"; opacity = 0; }
                                } else {
                                    mt = i === 0 ? "0px" : "12px"; 
                                }

                                const cardStyle = {
                                    zIndex: 50 - i,
                                    marginTop: mt,
                                    transform: `scale(${scale})`,
                                    transformOrigin: 'top center',
                                    opacity: opacity,
                                    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                    pointerEvents: isStacked && i > 0 ? 'none' : 'auto'
                                };

                                return (
                                    <div key={card.id} style={cardStyle} className={`${cardBgClass} rounded-3xl relative border ${theme.cardShadow} ${!isStacked && theme.cardHover} transition-colors overflow-hidden`}>
                                        
                                        {/* Если это общая карта в темной теме, добавим свечение */}
                                        {card.isTotal && isDark && <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>}

                                        <div className="p-5 cursor-pointer relative z-10" onClick={() => {
                                            if (isStacked) setIsStackExpanded(true);
                                            else if (!card.isTotal) setExpandedDept(isCardExpanded ? null : card.id);
                                        }}>
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${card.isTotal ? (isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/20 text-white') : (isDark ? 'bg-[#0F172A] text-slate-400' : 'bg-slate-50 text-slate-400')}`}>
                                                        {card.isTotal ? <PieChart size={14}/> : <Wallet size={14}/>}
                                                    </div>
                                                    <span className={`text-sm font-bold ${titleColor}`}>{card.title}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-sm font-black ${amountColor}`}>{formatMoney(card.spent)} ₸</span>
                                                    <p className={`text-[10px] font-medium mt-0.5 ${subtitleColor}`}>из {formatMoney(card.total)}</p>
                                                </div>
                                            </div>
                                            <div className={`w-full ${barBg} rounded-full h-2 overflow-hidden`}>
                                                <div className={`${card.isTotal && !isDark ? 'bg-white' : `bg-gradient-to-r ${gradient}`} h-2 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
                                            </div>
                                        </div>

                                        {/* ИСТОРИЯ ВНУТРИ ОТДЕЛА */}
                                        {isCardExpanded && !isStacked && !card.isTotal && (
                                            <div className={`px-5 pb-5 pt-2 border-t ${isDark ? 'border-[#334155]' : 'border-slate-50'} animate-in slide-in-from-top-2 relative z-10`}>
                                                {card.history.length === 0 ? (
                                                    <div className="text-center py-6">
                                                        <p className={`text-xs ${theme.textMuted} font-medium`}>Списаний пока нет</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3 mt-2">
                                                        {card.history.map((r, idx) => (
                                                            <div key={idx} className={`flex justify-between items-center ${theme.innerBg} p-3.5 rounded-2xl transition`}>
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className={`${isDark ? 'bg-[#1E293B] border border-[#334155] text-slate-400' : 'bg-white border border-slate-100 text-slate-400'} p-2 rounded-xl shadow-sm`}><Receipt size={14}/></div>
                                                                    <div className="min-w-0">
                                                                        <p className={`text-xs font-bold ${theme.textMain} truncate`}>{r.category}</p>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className={`text-[9px] font-bold ${theme.textMuted}`}>#{r.num}</span>
                                                                            <span className={`text-[9px] font-medium ${theme.textMuted}`}>{formatDate(r.date)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className={`text-xs font-black ${theme.textMain}`}>-{formatMoney(r.sum)} ₸</p>
                                                                    <p className={`text-[9px] ${theme.textMuted} mt-1 uppercase`}>{r.initiator.split(' ')[0]}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ПЕРЕКЛЮЧАТЕЛЬ ЗАЯВОК */}
                <div className={`flex gap-2 ${theme.toggleBg} p-1.5 rounded-2xl mt-8 shadow-inner`}>
                    <button onClick={() => setViewMode('active')} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${viewMode === 'active' ? `${theme.tabActiveBg} shadow-md` : theme.tabInactiveText}`}>Ожидают ({activeRequests.length})</button>
                    <button onClick={() => setViewMode('history')} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${viewMode === 'history' ? `${theme.tabActiveBg} shadow-md` : theme.tabInactiveText}`}>В работе ({historyRequests.length})</button>
                </div>

                {/* СПИСОК ЗАЯВОК */}
                <div className="space-y-4">
                    {displayedRequests.map(req => (
                        <div key={req.id} className={`${theme.cardBg} rounded-3xl transition-all duration-300 border ${expandedReq === req.id ? (isDark ? "border-indigo-500/50 shadow-2xl shadow-indigo-500/10" : "border-indigo-300 shadow-2xl shadow-indigo-500/10") : `${theme.cardBorder} ${theme.cardShadow}`}`}>
                            <div onClick={() => { setExpandedReq(expandedReq === req.id ? null : req.id); if (expandedReq !== req.id && !selectedDept[req.id]) setSelectedDept({...selectedDept, [req.id]: req.department}); }} className="p-5 cursor-pointer flex justify-between items-center">
                                <div className="flex-1 pr-4">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className={`text-[10px] font-black ${isDark ? 'bg-[#0F172A] text-slate-400' : 'bg-slate-100 text-slate-500'} px-2 py-1 rounded-md`}>#{req.req_number || 'B/N'}</span>
                                        <span className={`text-[10px] font-bold ${theme.textMuted} flex items-center gap-1`}><Calendar size={10}/> {formatDate(req.created_at)}</span>
                                        {req.urgency === "срочно" && <span className="text-[9px] font-black bg-rose-500 text-white px-2 py-1 rounded-md uppercase shadow-sm shadow-rose-500/30">Срочно</span>}
                                        {req.current_step > 1 && <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded-md uppercase">{req.status_text || "В работе"}</span>}
                                    </div>
                                    <h4 className={`font-bold ${theme.textMain} text-sm leading-tight`}>{req.category}</h4>
                                    <p className={`text-[11px] font-medium ${theme.textMuted} mt-1.5`}>{req.initiator}</p>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expandedReq === req.id ? (isDark ? 'bg-indigo-500/20 text-indigo-400 rotate-90' : 'bg-indigo-50 text-indigo-600 rotate-90') : (isDark ? 'bg-[#0F172A] text-slate-500' : 'bg-slate-50 text-slate-400')} shrink-0`}><ChevronRight size={18}/></div>
                            </div>

                            {expandedReq === req.id && (
                                <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                                    <div className={`pt-4 border-t ${isDark ? 'border-[#334155]' : 'border-slate-100'} space-y-5`}>
                                        
                                        {req.description && (
                                            <div className={`${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'} p-4 rounded-2xl border`}>
                                                <p className={`text-xs ${isDark ? 'text-amber-200/80' : 'text-amber-900/70'} font-medium`}>"{req.description}"</p>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            {requestItems[req.id]?.map((item) => (
                                                <div key={item.id} className={`${theme.innerBg} p-3.5 rounded-2xl flex justify-between items-center`}>
                                                    <p className={`text-sm font-bold ${theme.textMain}`}>{item.name}</p>
                                                    <div className={`${theme.cardBg} px-3 py-1.5 rounded-xl shadow-sm text-xs font-black ${theme.textMain}`}>{item.quantity} {item.unit}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {req.attachment_url && (
                                            <div className="flex flex-wrap gap-2">
                                                {req.attachment_url.split(',').map((url, idx) => (
                                                    <button key={idx} onClick={() => setPreviewUrl(url.trim())} className={`flex items-center gap-2 ${isDark ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'} px-4 py-3 rounded-2xl text-[11px] font-bold transition`}><Paperclip size={14}/> Файл {idx + 1}</button>
                                                ))}
                                            </div>
                                        )}

                                        {viewMode === "active" ? (
                                            <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#334155] rounded-[28px] p-5 shadow-2xl shadow-black/40">
                                                <h4 className="text-white font-bold text-xs mb-4 flex items-center gap-2"><CreditCard size={14} className="text-indigo-400"/> Финансирование</h4>
                                                
                                                <select value={selectedDept[req.id] || ""} onChange={(e) => { setSelectedDept({...selectedDept, [req.id]: e.target.value}); setSelectedBudget({...selectedBudget, [req.id]: ""}); }} className="w-full bg-[#0B1121] border border-[#334155] text-white rounded-2xl p-4 font-bold text-sm mb-3 focus:ring-2 focus:ring-indigo-500 appearance-none outline-none">
                                                    <option value="" disabled className="text-slate-500">Выбрать отдел...</option>
                                                    {[...new Set(budgets.map(b => b.department))].sort().map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                                </select>
                                                
                                                <select value={selectedBudget[req.id] || ""} onChange={(e) => setSelectedBudget({...selectedBudget, [req.id]: e.target.value})} disabled={!selectedDept[req.id]} className="w-full bg-[#0B1121] border border-[#334155] text-white rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-500 appearance-none mb-4 outline-none disabled:opacity-50">
                                                    <option value="" disabled>Статья расходов...</option>
                                                    {budgets.filter(b => b.department === selectedDept[req.id]).map(b => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.item_name} | Ост: {formatMoney(b.amount)} ₸
                                                        </option>
                                                    ))}
                                                </select>
                                                
                                                <button onClick={() => handleApprove(req.id)} disabled={processingId === req.id} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-wide text-xs shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition">
                                                    {processingId === req.id ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                                                    Утвердить заявку
                                                </button>
                                            </div>
                                        ) : (
                                            <div className={`${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'} border p-4 rounded-2xl flex items-center gap-3`}>
                                                <div className={`w-10 h-10 ${isDark ? 'bg-[#0F172A]' : 'bg-white'} shadow-sm text-emerald-500 rounded-full flex items-center justify-center`}><Wallet size={16}/></div>
                                                <div>
                                                    <p className={`text-[10px] ${isDark ? 'text-emerald-500/70' : 'text-slate-400'} font-medium`}>Статья расходов:</p>
                                                    <p className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-slate-800'} mt-0.5`}>{req.budget_category}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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

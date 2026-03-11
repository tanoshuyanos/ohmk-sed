// ==========================================
// ФАЙЛ: КАБИНЕТ РУКОВОДИТЕЛЯ (PREMIUM DESIGN + УМНЫЙ КАЛЬКУЛЯТОР)
// ПУТЬ: app/manager/page.js
// ==========================================

"use client";
import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, User, CheckCircle, Loader2, Wallet, ChevronDown, Paperclip, Download, FileText, PieChart, Calendar, Receipt, CreditCard, ChevronRight } from "lucide-react";

import { getNextStep } from "../utils/workflow";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; 
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Бронебойный очиститель чисел (убирает пробелы, буквы, запятые)
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
                  // Ищем сумму везде, где она может быть спрятана
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

  return (
    <div className="min-h-screen bg-[#f4f6f8] font-sans pb-20 relative text-slate-900">
      
      {/* ПРЕВЬЮ ФАЙЛОВ */}
      {previewUrl && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 md:p-4 transition-all">
              <div className="bg-white w-full max-w-5xl h-[92vh] md:h-[85vh] rounded-t-[32px] md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-full duration-300">
                  <div className="p-5 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-slate-100 z-10">
                      <div className="flex items-center gap-3">
                          <button onClick={() => setPreviewUrl(null)} className="md:hidden bg-slate-100 p-2 rounded-full"><ArrowLeft size={18}/></button>
                          <h3 className="font-bold text-slate-800 text-sm">Документ</h3>
                      </div>
                      <div className="flex gap-2">
                          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition"><Download size={18}/></a>
                          <button onClick={() => setPreviewUrl(null)} className="hidden md:block p-3 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition"><X size={18}/></button>
                      </div>
                  </div>
                  <div className="flex-1 bg-slate-50 flex items-center justify-center overflow-auto relative p-4">
                      {previewUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?$/i) ? (
                          <img src={previewUrl} className="max-w-full max-h-full rounded-xl shadow-sm" alt="Файл" />
                      ) : (
                          <iframe src={previewUrl.match(/\.(pdf)(\?.*)?$/i) ? `${previewUrl}#toolbar=0` : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} className="w-full h-full border-none bg-white rounded-xl shadow-sm"/>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* ШАПКА PREMIUM */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 sticky top-0 z-20 shadow-lg shadow-slate-900/10 rounded-b-[32px] md:rounded-none">
        <div className="max-w-xl mx-auto flex items-center justify-between">
            <a href="/" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition backdrop-blur-md"><ArrowLeft size={20} /></a>
            <div className="text-center">
                <h1 className="text-sm font-black tracking-widest uppercase">Панель управления</h1>
                {isAuthenticated && <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">{selectedEmp.department}</p>}
            </div>
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-black shadow-inner">
                {isAuthenticated ? selectedEmp.name[0] : <User size={16}/>}
            </div>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-4 md:p-6 -mt-2">
        {!isAuthenticated ? (
            /* ЭКРАН ВХОДА */
            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl shadow-slate-200/50 border border-white p-8 mt-10">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"><User className="text-white" size={28}/></div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Вход в систему</h2>
                </div>
                {!selectedEmp ? (
                    <div className="relative">
                        <input type="text" value={initiator} onChange={(e) => setInitiator(e.target.value)} className="w-full bg-slate-100/50 border-0 rounded-2xl py-4 px-6 font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 transition" placeholder="Ваша фамилия..." />
                        {initiator.length > 0 && (
                            <ul className="absolute z-50 w-full bg-white/90 backdrop-blur-xl border border-slate-100 rounded-2xl mt-2 shadow-2xl overflow-hidden p-1">
                                {employeesDB.filter(e => e.name.toLowerCase().includes(initiator.toLowerCase())).map((emp) => (
                                    <li key={emp.id} onClick={() => { setSelectedEmp(emp); setInitiator(emp.name); }} className="p-4 hover:bg-indigo-50 rounded-xl font-bold text-slate-700 cursor-pointer transition">{emp.name}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="w-full bg-indigo-50/50 rounded-2xl p-4 flex justify-between items-center border border-indigo-100/50">
                            <span className="font-bold text-indigo-900">{selectedEmp.name}</span>
                            <button onClick={() => {setSelectedEmp(null); setInputPassword("");}} className="bg-white p-1.5 rounded-full text-slate-400 shadow-sm"><X size={14}/></button>
                        </div>
                        <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkPassword()} className="w-full bg-slate-100/50 border-0 rounded-2xl py-4 text-center text-2xl font-black tracking-[0.5em] focus:ring-2 focus:ring-indigo-500 transition" placeholder="PIN" autoFocus />
                        <button onClick={checkPassword} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold tracking-wide shadow-xl shadow-slate-900/20 transition">Подтвердить</button>
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-6 mt-4">
                
                {/* 📊 ФИНАНСОВЫЙ ДАШБОРД */}
                {Object.keys(budgetStats.departments).length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <PieChart className="text-slate-400" size={18}/>
                            <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest">Бюджеты отделов</h3>
                        </div>
                        
                        {/* ОБЩИЙ СВОД */}
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">Всего израсходовано</p>
                            <div className="flex items-end gap-2 mb-4">
                                <h2 className="text-3xl font-black tracking-tight">{formatMoney(budgetStats.grandSpent)} ₸</h2>
                                <p className="text-indigo-200 text-sm font-medium mb-1">/ {formatMoney(budgetStats.grandTotal)}</p>
                            </div>
                            <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-white h-1.5 rounded-full transition-all duration-1000 relative" style={{ width: `${Math.min((budgetStats.grandSpent / (budgetStats.grandTotal || 1)) * 100, 100)}%` }}></div>
                            </div>
                        </div>

                        {/* ШКАЛЫ ПО ОТДЕЛАМ */}
                        <div className="grid grid-cols-1 gap-3">
                            {Object.entries(budgetStats.departments).map(([dept, data]) => {
                                const percent = Math.min((data.spent / (data.total || 1)) * 100, 100);
                                let gradient = "from-emerald-400 to-emerald-500";
                                if (percent > 60) gradient = "from-amber-400 to-amber-500";
                                if (percent > 90) gradient = "from-red-400 to-red-500";
                                
                                const isExpanded = expandedDept === dept;

                                return (
                                    <div key={dept} className={`bg-white rounded-3xl transition-all duration-300 border ${isExpanded ? 'shadow-xl shadow-slate-200/50 border-transparent' : 'shadow-sm border-slate-100 hover:border-slate-200'}`}>
                                        
                                        <div className="p-5 cursor-pointer" onClick={() => setExpandedDept(isExpanded ? null : dept)}>
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                                                        <Wallet size={14}/>
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-800">{dept}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-black text-slate-900">{formatMoney(data.spent)} ₸</span>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">из {formatMoney(data.total)}</p>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div className={`bg-gradient-to-r ${gradient} h-2 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-5 pb-5 pt-2 border-t border-slate-50 animate-in slide-in-from-top-2">
                                                {data.history.length === 0 ? (
                                                    <div className="text-center py-6">
                                                        <p className="text-xs text-slate-400 font-medium">Списаний пока нет</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3 mt-2">
                                                        {data.history.map((r, i) => (
                                                            <div key={i} className="flex justify-between items-center bg-slate-50/50 p-3.5 rounded-2xl hover:bg-slate-50 transition">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 text-slate-400"><Receipt size={14}/></div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold text-slate-700 truncate">{r.category}</p>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className="text-[9px] font-bold text-slate-400">#{r.num}</span>
                                                                            <span className="text-[9px] font-medium text-slate-400">{formatDate(r.date)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-xs font-black text-slate-900">-{formatMoney(r.sum)} ₸</p>
                                                                    <p className="text-[9px] text-slate-400 mt-1 uppercase">{r.initiator.split(' ')[0]}</p>
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

                {/* ПЕРЕКЛЮЧАТЕЛЬ */}
                <div className="flex gap-2 bg-slate-200/50 p-1.5 rounded-2xl mt-8">
                    <button onClick={() => setViewMode('active')} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${viewMode === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Ожидают ({activeRequests.length})</button>
                    <button onClick={() => setViewMode('history')} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${viewMode === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>В работе ({historyRequests.length})</button>
                </div>

                {/* СПИСОК ЗАЯВОК */}
                <div className="space-y-4">
                    {displayedRequests.map(req => (
                        <div key={req.id} className={`bg-white rounded-3xl transition-all duration-300 ${expandedReq === req.id ? "shadow-2xl shadow-indigo-500/10 ring-2 ring-indigo-500/20" : "shadow-sm border border-slate-100 hover:shadow-md"}`}>
                            <div onClick={() => { setExpandedReq(expandedReq === req.id ? null : req.id); if (expandedReq !== req.id && !selectedDept[req.id]) setSelectedDept({...selectedDept, [req.id]: req.department}); }} className="p-5 cursor-pointer flex justify-between items-center">
                                <div className="flex-1 pr-4">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md">#{req.req_number || 'B/N'}</span>
                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10}/> {formatDate(req.created_at)}</span>
                                        {req.urgency === "срочно" && <span className="text-[9px] font-black bg-rose-500 text-white px-2 py-1 rounded-md uppercase shadow-sm shadow-rose-200">Срочно</span>}
                                        {req.current_step > 1 && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md uppercase">{req.status_text || "В работе"}</span>}
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{req.category}</h4>
                                    <p className="text-[11px] font-medium text-slate-400 mt-1.5">{req.initiator}</p>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expandedReq === req.id ? 'bg-indigo-50 text-indigo-600 rotate-90' : 'bg-slate-50 text-slate-400'} shrink-0`}><ChevronRight size={18}/></div>
                            </div>

                            {/* РАСКРЫТАЯ ЧАСТЬ */}
                            {expandedReq === req.id && (
                                <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                                    <div className="pt-4 border-t border-slate-100 space-y-5">
                                        
                                        {req.description && (
                                            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50">
                                                <p className="text-xs text-amber-900/70 font-medium">"{req.description}"</p>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            {requestItems[req.id]?.map((item) => (
                                                <div key={item.id} className="bg-slate-50 p-3.5 rounded-2xl flex justify-between items-center">
                                                    <p className="text-sm font-bold text-slate-700">{item.name}</p>
                                                    <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm text-xs font-black text-slate-800">{item.quantity} {item.unit}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {req.attachment_url && (
                                            <div className="flex flex-wrap gap-2">
                                                {req.attachment_url.split(',').map((url, idx) => (
                                                    <button key={idx} onClick={() => setPreviewUrl(url.trim())} className="flex items-center gap-2 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-600 px-4 py-3 rounded-2xl text-[11px] font-bold transition"><Paperclip size={14}/> Файл {idx + 1}</button>
                                                ))}
                                            </div>
                                        )}

                                        {viewMode === "active" ? (
                                            <div className="bg-slate-900 rounded-[28px] p-5 shadow-2xl shadow-slate-900/20">
                                                <h4 className="text-white font-bold text-xs mb-4 flex items-center gap-2"><CreditCard size={14} className="text-indigo-400"/> Финансирование</h4>
                                                
                                                <select value={selectedDept[req.id] || ""} onChange={(e) => { setSelectedDept({...selectedDept, [req.id]: e.target.value}); setSelectedBudget({...selectedBudget, [req.id]: ""}); }} className="w-full bg-white/10 text-white border-0 rounded-2xl p-4 font-bold text-sm mb-3 focus:ring-2 focus:ring-indigo-500 appearance-none">
                                                    <option value="" disabled className="text-slate-900">Выбрать отдел...</option>
                                                    {[...new Set(budgets.map(b => b.department))].sort().map(dept => <option key={dept} value={dept} className="text-slate-900">{dept}</option>)}
                                                </select>
                                                
                                                <select value={selectedBudget[req.id] || ""} onChange={(e) => setSelectedBudget({...selectedBudget, [req.id]: e.target.value})} disabled={!selectedDept[req.id]} className="w-full bg-white text-slate-900 border-0 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-500 appearance-none mb-4">
                                                    <option value="" disabled>Статья расходов...</option>
                                                    {budgets.filter(b => b.department === selectedDept[req.id]).map(b => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.item_name} | Ост: {formatMoney(b.amount)} ₸
                                                        </option>
                                                    ))}
                                                </select>
                                                
                                                <button onClick={() => handleApprove(req.id)} disabled={processingId === req.id} className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl font-black uppercase tracking-wide text-xs shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 transition">
                                                    {processingId === req.id ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                                                    Утвердить заявку
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-50/50 p-4 rounded-2xl flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white shadow-sm text-emerald-500 rounded-full flex items-center justify-center"><Wallet size={16}/></div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-medium">Статья расходов:</p>
                                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{req.budget_category}</p>
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

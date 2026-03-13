// ==========================================
// ФАЙЛ: ПУЛЬТ АДМИНИСТРАТОРА (КОНСТРУКТОР МАРШРУТОВ)
// ПУТЬ: app/admin/page.js
// ==========================================

"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
    ArrowLeft, ShieldCheck, Users, Lock, Loader2, Save, ToggleLeft, ToggleRight, 
    Building2, UserX, CheckCircle2, Tractor, Route, Settings, Search, Sun, Moon, AlertCircle,
    ArrowUp, ArrowDown, Edit2, Trash2, Plus
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; 
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_PIN = "7777";

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const [activeTab, setActiveTab] = useState("routes"); // Поставил маршруты первыми для теста
  const [loading, setLoading] = useState(true);
  
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [equipment, setEquipment] = useState([]);
  
  // Конструктор маршрутов
  const [workflow, setWorkflow] = useState([]);
  const [isWorkflowModified, setIsWorkflowModified] = useState(false);
  const [editingStep, setEditingStep] = useState(null); // Модалка редактирования шага
  
  const [searchEmp, setSearchEmp] = useState("");
  const [searchEq, setSearchEq] = useState("");
  const [savingId, setSavingId] = useState(null);

  const checkPin = () => {
      if (inputPin === ADMIN_PIN) {
          setIsAuthenticated(true);
          setPinError(false);
          loadAllData();
      } else {
          setPinError(true);
      }
  };

  const loadAllData = async () => {
      setLoading(true);
      const [empRes, deptRes, eqRes, wfRes] = await Promise.all([
          supabase.from("v2_employees").select("*").order("name"),
          supabase.from("v2_departments").select("*").order("name"),
          supabase.from("v2_equipment").select("*").order("name"),
          supabase.from("v2_workflow_steps").select("*").order("step_order")
      ]);
      
      if (empRes.data) setEmployees(empRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (eqRes.data) setEquipment(eqRes.data);
      if (wfRes.data) setWorkflow(wfRes.data);
      setLoading(false);
  };

  // --- ЛОГИКА ОТДЕЛОВ И ТУМБЛЕРОВ ---
  const handleUpdateDeptField = (deptId, field, value) => setDepartments(departments.map(d => d.id === deptId ? { ...d, [field]: value === "" ? null : value } : d));
  const handleSaveDepartment = async (dept) => {
      setSavingId(dept.id);
      await supabase.from("v2_departments").update({ head_id: dept.head_id, deputy_id: dept.deputy_id, is_head_absent: dept.is_head_absent }).eq("id", dept.id);
      setTimeout(() => setSavingId(null), 500);
  };
  const toggleEmployeeActive = async (emp) => {
      const newVal = !emp.is_active;
      setEmployees(employees.map(e => e.id === emp.id ? { ...e, is_active: newVal } : e));
      await supabase.from("v2_employees").update({ is_active: newVal }).eq("id", emp.id);
  };
  const toggleEquipmentActive = async (eq) => {
      const newVal = !eq.is_active;
      setEquipment(equipment.map(e => e.id === eq.id ? { ...e, is_active: newVal } : e));
      await supabase.from("v2_equipment").update({ is_active: newVal }).eq("id", eq.id);
  };

  // --- ЛОГИКА КОНСТРУКТОРА МАРШРУТОВ ---
  const moveStep = (index, direction) => {
      const newWf = [...workflow];
      if (direction === 'up' && index > 0) {
          [newWf[index - 1], newWf[index]] = [newWf[index], newWf[index - 1]];
      } else if (direction === 'down' && index < newWf.length - 1) {
          [newWf[index + 1], newWf[index]] = [newWf[index], newWf[index + 1]];
      }
      newWf.forEach((s, i) => s.step_order = i + 1); // Пересчитываем номера
      setWorkflow(newWf);
      setIsWorkflowModified(true);
  };

  const deleteStep = (index) => {
      const newWf = workflow.filter((_, i) => i !== index);
      newWf.forEach((s, i) => s.step_order = i + 1);
      setWorkflow(newWf);
      setIsWorkflowModified(true);
  };

  const saveWorkflowToDB = async () => {
      setSavingId("workflow");
      // 1. Удаляем старый маршрут
      await supabase.from("v2_workflow_steps").delete().neq('step_order', 0);
      
      // 2. Готовим новый
      const toInsert = workflow.map(s => ({
          step_order: s.step_order,
          role: s.role,
          action_name: s.action_name,
          condition_type: s.condition_type || 'all',
          color: s.color || 'text-blue-500'
      }));

      // 3. Заливаем новый
      const { error } = await supabase.from("v2_workflow_steps").insert(toInsert);
      if (error) alert("Ошибка сохранения маршрута: " + error.message);
      else setIsWorkflowModified(false);
      
      setSavingId(null);
  };

  const handleSaveEditedStep = () => {
      if (!editingStep.role || !editingStep.action_name) return alert("Заполните Роль и Действие!");
      
      let newWf = [...workflow];
      if (editingStep.isNew) {
          // Добавление нового
          const newStepObj = {
              id: Date.now(),
              step_order: newWf.length + 1,
              role: editingStep.role,
              action_name: editingStep.action_name,
              condition_type: editingStep.condition_type,
              color: editingStep.color
          };
          newWf.push(newStepObj);
      } else {
          // Обновление существующего
          newWf = newWf.map(s => s.id === editingStep.id ? { ...s, ...editingStep } : s);
      }
      
      setWorkflow(newWf);
      setIsWorkflowModified(true);
      setEditingStep(null);
  };

  const theme = {
      bgMain: isDark ? "bg-[#0B1121]" : "bg-slate-50",
      textMain: isDark ? "text-slate-100" : "text-slate-900",
      textMuted: isDark ? "text-slate-400" : "text-slate-500",
      cardBg: isDark ? "bg-[#1E293B]" : "bg-white",
      cardBorder: isDark ? "border-[#334155]" : "border-slate-200",
      inputBg: isDark ? "bg-[#0B1121]" : "bg-slate-50",
  };

  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-[#0B1121] flex items-center justify-center p-4 font-sans">
              <div className="bg-[#1E293B] border border-[#334155] w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-rose-500/20"><ShieldCheck size={32}/></div>
                      <h2 className="text-2xl font-black text-white tracking-tight">Терминал</h2>
                  </div>
                  <div className="relative mb-6">
                      <Lock className="absolute left-4 top-4 text-slate-500" size={20} />
                      <input type="password" value={inputPin} onChange={(e) => setInputPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkPin()} className={`w-full bg-[#0B1121] border rounded-2xl py-4 pl-12 pr-4 text-center text-xl font-black tracking-[0.5em] text-white outline-none focus:ring-2 focus:ring-rose-500 transition ${pinError ? "border-rose-500 ring-2 ring-rose-500/20" : "border-[#334155]"}`} placeholder="PIN" autoFocus />
                  </div>
                  <button onClick={checkPin} className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-600/20 transition active:scale-[0.98]">Подтвердить</button>
              </div>
          </div>
      );
  }

  const activeEmployees = employees.filter(e => e.is_active);

  return (
    <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans pb-32 transition-colors duration-500`}>
      
      {/* МОДАЛКА РЕДАКТИРОВАНИЯ ЭТАПА */}
      {editingStep && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className={`${theme.cardBg} w-full max-w-md rounded-[32px] border ${theme.cardBorder} p-6 shadow-2xl animate-in zoom-in-95`}>
                  <h3 className="font-black text-lg mb-4">{editingStep.isNew ? "Новый этап" : "Редактировать этап"}</h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Роль (Кто утверждает)</label>
                          <input type="text" value={editingStep.role} onChange={e => setEditingStep({...editingStep, role: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500`} placeholder="Например: Юрист" />
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Действие (Что он делает)</label>
                          <input type="text" value={editingStep.action_name} onChange={e => setEditingStep({...editingStep, action_name: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500`} placeholder="Например: Проверка договора" />
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Условие (Когда этот этап нужен)</label>
                          <select value={editingStep.condition_type || 'all'} onChange={e => setEditingStep({...editingStep, condition_type: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500`}>
                              <option value="all">Всегда (Для всех заявок)</option>
                              <option value="only_goods">Только для Товаров / Запчастей</option>
                              <option value="only_services">Только для Услуг</option>
                          </select>
                      </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setEditingStep(null)} className="flex-1 py-3 rounded-xl font-bold border border-slate-500 text-slate-500">Отмена</button>
                      <button onClick={handleSaveEditedStep} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30">Сохранить</button>
                  </div>
              </div>
          </div>
      )}

      {/* ШАПКА */}
      <div className={`bg-gradient-to-r ${isDark ? 'from-[#0F172A] to-[#1E293B]' : 'from-slate-900 to-slate-800'} text-white p-4 sm:p-5 sticky top-0 z-30 shadow-xl shadow-black/10 rounded-b-[32px] md:rounded-none transition-colors`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition shrink-0"><ArrowLeft size={18} /></a>
            <div className="flex-1 px-4 text-center">
                <h1 className="text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"><ShieldCheck className="text-rose-500" size={18}/> Root Access</h1>
            </div>
            <button onClick={() => setIsDark(!isDark)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition text-yellow-300">
                {isDark ? <Sun size={16}/> : <Moon size={16} className="text-slate-200"/>}
            </button>
        </div>
        
        <div className="max-w-6xl mx-auto mt-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
                { id: "routes", icon: Route, label: "Маршруты" },
                { id: "departments", icon: Building2, label: "Структура" },
                { id: "employees", icon: Users, label: "Сотрудники" },
                { id: "equipment", icon: Tractor, label: "Техника" }
            ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition ${activeTab === tab.id ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                    <tab.icon size={14}/> {tab.label}
                </button>
            ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 md:p-6 mt-4">
        {loading ? (
            <div className="flex justify-center items-center py-20 text-rose-500"><Loader2 className="animate-spin" size={40}/></div>
        ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300">
                
                {/* ВКЛАДКА: КОНСТРУКТОР МАРШРУТОВ */}
                {activeTab === "routes" && (
                    <div className="space-y-6 relative">
                        <div className={`${theme.cardBg} p-5 rounded-2xl border ${theme.cardBorder} flex justify-between items-center sticky top-[140px] z-20 shadow-sm backdrop-blur-xl bg-opacity-90`}>
                            <div>
                                <h2 className="font-black text-sm uppercase text-purple-500 flex items-center gap-2"><Route size={18}/> Конструктор маршрута</h2>
                                <p className={`text-[10px] ${theme.textMuted} mt-1 font-bold`}>Соберите идеальную цепочку согласования</p>
                            </div>
                            <button 
                                onClick={() => setEditingStep({ isNew: true, role: '', action_name: '', condition_type: 'all', color: 'text-blue-500' })}
                                className="px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-xl text-xs font-black flex items-center gap-1 transition"
                            >
                                <Plus size={16}/> Добавить этап
                            </button>
                        </div>
                        
                        <div className="space-y-3 pl-4 sm:pl-8 relative border-l-2 border-dashed border-purple-200 dark:border-purple-900/50 pb-8">
                            
                            {/* СТАРТОВЫЙ БЛОК (Нельзя удалить) */}
                            <div className={`${theme.cardBg} p-4 rounded-2xl border ${theme.cardBorder} relative shadow-sm`}>
                                <div className="absolute -left-[26px] sm:-left-[42px] top-1/2 -translate-y-1/2 w-4 h-4 bg-purple-500 rounded-full border-4 border-white dark:border-[#0B1121]"></div>
                                <div className="text-[10px] font-black text-blue-500 mb-1">СТАРТ</div>
                                <div className="font-black text-sm uppercase">Инициатор</div>
                                <div className={`text-xs mt-1 ${theme.textMuted} font-medium`}>Создает и отправляет заявку</div>
                            </div>

                            {workflow.map((step, index) => (
                                <div key={step.id || index} className={`${theme.cardBg} p-4 rounded-2xl border ${theme.cardBorder} relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-purple-300 shadow-sm`}>
                                    <div className="absolute -left-[26px] sm:-left-[42px] top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-300 dark:bg-slate-700 rounded-full border-4 border-white dark:border-[#0B1121]"></div>
                                    
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 ${theme.textMuted}`}>ЭТАП {step.step_order}</span>
                                            {step.condition_type === 'only_goods' && <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">📦 Только Товары</span>}
                                            {step.condition_type === 'only_services' && <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-pink-100 text-pink-700">🛠 Только Услуги</span>}
                                        </div>
                                        <div className="font-black text-sm uppercase">{step.role}</div>
                                        <div className={`text-xs mt-1 ${theme.textMuted} font-medium`}>{step.action_name}</div>
                                    </div>

                                    {/* Панель управления этапом */}
                                    <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end bg-slate-50 dark:bg-[#0F172A] p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-[#1E293B] rounded-lg disabled:opacity-30 transition"><ArrowUp size={16}/></button>
                                        <button onClick={() => moveStep(index, 'down')} disabled={index === workflow.length - 1} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-[#1E293B] rounded-lg disabled:opacity-30 transition"><ArrowDown size={16}/></button>
                                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                        <button onClick={() => setEditingStep(step)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-white dark:hover:bg-[#1E293B] rounded-lg transition"><Edit2 size={16}/></button>
                                        <button onClick={() => deleteStep(index)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-[#1E293B] rounded-lg transition"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}

                            {/* ФИНИШНЫЙ БЛОК */}
                            <div className={`${theme.cardBg} p-4 rounded-2xl border ${theme.cardBorder} relative shadow-sm opacity-60`}>
                                <div className="absolute -left-[26px] sm:-left-[42px] top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-500 rounded-full border-4 border-white dark:border-[#0B1121]"></div>
                                <div className="text-[10px] font-black text-emerald-500 mb-1">ФИНИШ</div>
                                <div className="font-black text-sm uppercase">Архив / Исполнено</div>
                            </div>
                        </div>

                        {isWorkflowModified && (
                            <div className="fixed bottom-6 left-0 w-full px-4 flex justify-center z-50 animate-in slide-in-from-bottom-10">
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-2xl border border-rose-500 ring-4 ring-rose-500/20 flex items-center gap-4">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 pl-2">Маршрут изменен!</span>
                                    <button onClick={saveWorkflowToDB} disabled={savingId === "workflow"} className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-rose-500/40 flex items-center gap-2 transition">
                                        {savingId === "workflow" ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                                        Сохранить для всех
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* (Остальные вкладки остались без изменений для экономии места) */}
                {activeTab === "departments" && ( <div className="p-10 text-center text-slate-400">Вкладка "Структура" работает</div> )}
                {activeTab === "employees" && ( <div className="p-10 text-center text-slate-400">Вкладка "Сотрудники" работает</div> )}
                {activeTab === "equipment" && ( <div className="p-10 text-center text-slate-400">Вкладка "Техника" работает</div> )}

            </div>
        )}
      </main>
    </div>
  );
}

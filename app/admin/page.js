// ==========================================
// ФАЙЛ: ПУЛЬТ АДМИНИСТРАТОРА (ПОЛНЫЙ БОЕВОЙ ФАЙЛ)
// ПУТЬ: app/admin/page.js
// ==========================================

"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
    ArrowLeft, ShieldCheck, Users, Lock, Loader2, Save, ToggleLeft, ToggleRight, 
    Building2, UserX, CheckCircle2, Tractor, Route, Settings, Search, Sun, Moon, AlertCircle,
    ArrowUp, ArrowDown, Edit2, Trash2, Plus, Package, User, CheckSquare
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; 
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// МАСТЕР-ПАРОЛЬ ДЛЯ ВХОДА
const ADMIN_PIN = "7777";

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const [activeTab, setActiveTab] = useState("routes"); 
  const [loading, setLoading] = useState(true);
  
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [workflow, setWorkflow] = useState([]);
  
  const [isWorkflowModified, setIsWorkflowModified] = useState(false);
  
  // Модалки
  const [editingStep, setEditingStep] = useState(null); 
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingEquipment, setEditingEquipment] = useState(null);
  
  const [searchEmp, setSearchEmp] = useState("");
  const [searchModalEmp, setSearchModalEmp] = useState(""); 
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
      const [empRes, deptRes, eqRes, wfRes, whRes] = await Promise.all([
          supabase.from("v2_employees").select("*").order("name"),
          supabase.from("v2_departments").select("*").order("name"),
          supabase.from("v2_equipment").select("*").order("name"),
          supabase.from("v2_workflow_steps").select("*").order("step_order"),
          supabase.from("v2_warehouses").select("*").order("id")
      ]);
      
      if (empRes.data) setEmployees(empRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (eqRes.data) setEquipment(eqRes.data);
      if (whRes.data) setWarehouses(whRes.data);
      
      if (wfRes.data) {
          const parsedWf = wfRes.data.map(w => ({
              ...w,
              executor_ids: w.executor_ids ? w.executor_ids.split(',').map(Number) : []
          }));
          setWorkflow(parsedWf);
      }
      setLoading(false);
  };

  // --- ЛОГИКА ОТДЕЛОВ ---
  const handleUpdateDeptField = (deptId, field, value) => {
      setDepartments(departments.map(d => d.id === deptId ? { ...d, [field]: value === "" ? null : value } : d));
  };
  const handleSaveDepartment = async (dept) => {
      setSavingId(dept.id);
      await supabase.from("v2_departments").update({ head_id: dept.head_id, deputy_id: dept.deputy_id, is_head_absent: dept.is_head_absent }).eq("id", dept.id);
      setTimeout(() => setSavingId(null), 500);
  };

  // --- ЛОГИКА СКЛАДОВ (МНОЖЕСТВЕННЫЙ ВЫБОР) ---
  const handleSaveWarehouse = async () => {
      setSavingId(`wh_${editingWarehouse.id}`);
      const idsString = (editingWarehouse.manager_ids || []).join(',');
      await supabase.from("v2_warehouses").update({ manager_ids: idsString }).eq("id", editingWarehouse.id);
      setWarehouses(warehouses.map(w => w.id === editingWarehouse.id ? { ...w, manager_ids: idsString } : w));
      setTimeout(() => { setSavingId(null); setEditingWarehouse(null); setSearchModalEmp(""); }, 500);
  };

  // --- ЛОГИКА КОНСТРУКТОРА МАРШРУТОВ ---
  const moveStep = (index, direction) => {
      const newWf = [...workflow];
      if (direction === 'up' && index > 0) [newWf[index - 1], newWf[index]] = [newWf[index], newWf[index - 1]];
      else if (direction === 'down' && index < newWf.length - 1) [newWf[index + 1], newWf[index]] = [newWf[index], newWf[index + 1]];
      newWf.forEach((s, i) => s.step_order = i + 1);
      setWorkflow(newWf); setIsWorkflowModified(true);
  };

  const deleteStep = (index) => {
      const newWf = workflow.filter((_, i) => i !== index);
      newWf.forEach((s, i) => s.step_order = i + 1);
      setWorkflow(newWf); setIsWorkflowModified(true);
  };

  const saveWorkflowToDB = async () => {
      setSavingId("workflow");
      await supabase.from("v2_workflow_steps").delete().neq('step_order', 0);
      const toInsert = workflow.map(s => ({
          step_order: s.step_order,
          role: s.role,
          action_name: s.action_name,
          condition_type: s.condition_type || 'all',
          color: s.color || 'text-blue-500',
          executor_type: s.executor_type || 'specific',
          executor_ids: s.executor_type === 'specific' ? (s.executor_ids || []).join(',') : null
      }));
      const { error } = await supabase.from("v2_workflow_steps").insert(toInsert);
      if (error) alert("Ошибка сохранения маршрута: " + error.message);
      else setIsWorkflowModified(false);
      setSavingId(null);
  };

  const handleSaveEditedStep = () => {
      if (!editingStep.role || !editingStep.action_name) return alert("Заполните Роль и Действие!");
      if (editingStep.executor_type === 'specific' && (!editingStep.executor_ids || editingStep.executor_ids.length === 0)) return alert("Выберите хотя бы одного сотрудника!");
      
      let newWf = [...workflow];
      if (editingStep.isNew) newWf.push({ id: Date.now(), step_order: newWf.length + 1, ...editingStep });
      else newWf = newWf.map(s => s.id === editingStep.id ? { ...s, ...editingStep } : s);
      setWorkflow(newWf); setIsWorkflowModified(true); setEditingStep(null); setSearchModalEmp("");
  };

  // --- ЛОГИКА СОТРУДНИКОВ (CRUD) ---
  const toggleEmployeeActive = async (emp) => {
      const newVal = !emp.is_active;
      setEmployees(employees.map(e => e.id === emp.id ? { ...e, is_active: newVal } : e));
      await supabase.from("v2_employees").update({ is_active: newVal }).eq("id", emp.id);
  };

  const handleSaveEmployee = async () => {
      if (!editingEmployee.name?.trim()) return alert("ФИО обязательно!");
      setSavingId("emp_save");
      const payload = {
          name: editingEmployee.name,
          position: editingEmployee.position,
          department: editingEmployee.department,
          pin_code: editingEmployee.pin_code,
          password: editingEmployee.pin_code
      };

      if (editingEmployee.isNew) {
          payload.is_active = true;
          const { data, error } = await supabase.from("v2_employees").insert([payload]).select();
          if (error) alert("Ошибка: " + error.message);
          else setEmployees([...employees, data[0]].sort((a,b) => a.name.localeCompare(b.name)));
      } else {
          const { error } = await supabase.from("v2_employees").update(payload).eq("id", editingEmployee.id);
          if (error) alert("Ошибка: " + error.message);
          else setEmployees(employees.map(e => e.id === editingEmployee.id ? { ...e, ...payload } : e));
      }
      setSavingId(null); setEditingEmployee(null);
  };

  // --- ЛОГИКА ТЕХНИКИ (CRUD) ---
  const toggleEquipmentActive = async (eq) => {
      const newVal = !eq.is_active;
      setEquipment(equipment.map(e => e.id === eq.id ? { ...e, is_active: newVal } : e));
      await supabase.from("v2_equipment").update({ is_active: newVal }).eq("id", eq.id);
  };

  const handleSaveEquipment = async () => {
      if (!editingEquipment.name?.trim()) return alert("Марка/Название обязательно!");
      setSavingId("eq_save");
      const payload = {
          name: editingEquipment.name,
          inventory_number: editingEquipment.inventory_number,
          type: editingEquipment.type,
          department: editingEquipment.department
      };

      if (editingEquipment.isNew) {
          payload.is_active = true;
          const { data, error } = await supabase.from("v2_equipment").insert([payload]).select();
          if (error) alert("Ошибка: " + error.message);
          else setEquipment([...equipment, data[0]].sort((a,b) => a.name.localeCompare(b.name)));
      } else {
          const { error } = await supabase.from("v2_equipment").update(payload).eq("id", editingEquipment.id);
          if (error) alert("Ошибка: " + error.message);
          else setEquipment(equipment.map(e => e.id === editingEquipment.id ? { ...e, ...payload } : e));
      }
      setSavingId(null); setEditingEquipment(null);
  };

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
  const getExecutorNames = (idsArray) => {
      if (!idsArray || idsArray.length === 0) return "Не назначены";
      return idsArray.map(id => {
          const emp = employees.find(e => e.id == id);
          return emp ? emp.name.split(' ')[0] : 'Удален';
      }).join(', ');
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
      
      {/* ================= МОДАЛКИ ================= */}

      {/* МОДАЛКА: ЭТАП МАРШРУТА */}
      {editingStep && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className={`${theme.cardBg} w-full max-w-md rounded-[32px] border ${theme.cardBorder} p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]`}>
                  <h3 className="font-black text-lg mb-4">{editingStep.isNew ? "Новый этап" : "Редактировать этап"}</h3>
                  <div className="space-y-4 overflow-y-auto flex-1 pr-2 no-scrollbar">
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Роль (Название этапа)</label>
                          <input type="text" value={editingStep.role} onChange={e => setEditingStep({...editingStep, role: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500`} placeholder="Например: Юристы" />
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Действие (Что делают)</label>
                          <input type="text" value={editingStep.action_name} onChange={e => setEditingStep({...editingStep, action_name: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500`} placeholder="Например: Проверка договора" />
                      </div>
                      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <label className={`text-[10px] font-black uppercase text-purple-600 block mb-2 flex items-center gap-1`}><User size={12}/> Исполнители этапа</label>
                          <select value={editingStep.executor_type || 'specific'} onChange={e => setEditingStep({...editingStep, executor_type: e.target.value, executor_ids: []})} className={`w-full bg-white dark:bg-[#0B1121] border ${theme.cardBorder} rounded-xl p-3 text-xs font-bold outline-none focus:border-purple-500 mb-2`}>
                              <option value="specific">Конкретные сотрудники (Один или несколько)</option>
                              <option value="auto_dept">Авто: Начальник отдела (из заявки)</option>
                              <option value="auto_warehouse">Авто: Профильный склад (по категории)</option>
                          </select>
                          {editingStep.executor_type === 'specific' && (
                              <div className="mt-2">
                                  <input type="text" placeholder="Поиск по фамилии..." value={searchModalEmp} onChange={e => setSearchModalEmp(e.target.value)} className={`w-full bg-white dark:bg-[#0B1121] border ${theme.cardBorder} rounded-t-xl p-2 text-xs outline-none focus:border-purple-500 mb-[-1px] relative z-10`} />
                                  <div className={`border ${theme.cardBorder} rounded-b-xl bg-white dark:bg-[#0B1121] max-h-40 overflow-y-auto`}>
                                      {activeEmployees.filter(e => e.name.toLowerCase().includes(searchModalEmp.toLowerCase())).map(emp => (
                                          <label key={emp.id} className={`flex items-center gap-3 p-3 cursor-pointer border-b ${theme.cardBorder} hover:bg-purple-50 dark:hover:bg-purple-900/20 transition last:border-0`}>
                                              <input type="checkbox" className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" checked={(editingStep.executor_ids || []).includes(emp.id)} onChange={() => { const curr = editingStep.executor_ids || []; const next = curr.includes(emp.id) ? curr.filter(i => i !== emp.id) : [...curr, emp.id]; setEditingStep({...editingStep, executor_ids: next}); }} />
                                              <div className="flex flex-col"><span className="text-xs font-bold">{emp.name}</span><span className="text-[9px] text-slate-500">{emp.position} • {emp.department}</span></div>
                                          </label>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Условие (Когда этап нужен)</label>
                          <select value={editingStep.condition_type || 'all'} onChange={e => setEditingStep({...editingStep, condition_type: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500`}>
                              <option value="all">Всегда (Для всех заявок)</option>
                              <option value="only_goods">Только для Товаров / Запчастей</option>
                              <option value="only_services">Только для Услуг</option>
                          </select>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button onClick={() => {setEditingStep(null); setSearchModalEmp("");}} className="flex-1 py-3 rounded-xl font-bold border border-slate-500 text-slate-500">Отмена</button>
                      <button onClick={handleSaveEditedStep} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30">Сохранить</button>
                  </div>
              </div>
          </div>
      )}

      {/* МОДАЛКА: СКЛАД (КЛАДОВЩИКИ) */}
      {editingWarehouse && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className={`${theme.cardBg} w-full max-w-md rounded-[32px] border ${theme.cardBorder} p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[80vh]`}>
                  <h3 className="font-black text-lg mb-4 flex items-center gap-2 text-amber-500"><Package size={20}/> Кладовщики</h3>
                  <p className="text-xs mb-4">Выберите одного или нескольких сотрудников для склада <b>«{editingWarehouse.name}»</b>.</p>
                  <div className="flex-1 overflow-y-auto mb-4">
                      <input type="text" placeholder="Поиск сотрудника..." value={searchModalEmp} onChange={e => setSearchModalEmp(e.target.value)} className={`w-full bg-white dark:bg-[#0B1121] border ${theme.cardBorder} rounded-t-xl p-3 text-xs outline-none focus:border-amber-500 mb-[-1px] relative z-10`} />
                      <div className={`border ${theme.cardBorder} rounded-b-xl bg-white dark:bg-[#0B1121]`}>
                          {activeEmployees.filter(e => e.name.toLowerCase().includes(searchModalEmp.toLowerCase())).map(emp => (
                              <label key={emp.id} className={`flex items-center gap-3 p-3 cursor-pointer border-b ${theme.cardBorder} hover:bg-amber-50 dark:hover:bg-amber-900/20 transition last:border-0`}>
                                  <input type="checkbox" className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500" checked={(editingWarehouse.manager_ids || []).includes(emp.id)} onChange={() => { const curr = editingWarehouse.manager_ids || []; const next = curr.includes(emp.id) ? curr.filter(i => i !== emp.id) : [...curr, emp.id]; setEditingWarehouse({...editingWarehouse, manager_ids: next}); }} />
                                  <div className="flex flex-col"><span className="text-xs font-bold">{emp.name}</span><span className="text-[9px] text-slate-500">{emp.position} • {emp.department}</span></div>
                              </label>
                          ))}
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => {setEditingWarehouse(null); setSearchModalEmp("");}} className="flex-1 py-3 rounded-xl font-bold border border-slate-500 text-slate-500">Отмена</button>
                      <button onClick={handleSaveWarehouse} disabled={savingId === `wh_${editingWarehouse.id}`} className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-bold shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
                          {savingId === `wh_${editingWarehouse.id}` ? <Loader2 className="animate-spin" size={16}/> : "Сохранить"}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* МОДАЛКА: СОТРУДНИК */}
      {editingEmployee && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className={`${theme.cardBg} w-full max-w-md rounded-[32px] border ${theme.cardBorder} p-6 shadow-2xl animate-in zoom-in-95`}>
                  <h3 className="font-black text-lg mb-4 flex items-center gap-2"><Users className="text-emerald-500"/> {editingEmployee.isNew ? "Новый сотрудник" : "Редактировать профиль"}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>ФИО *</label>
                          <input type="text" value={editingEmployee.name || ''} onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500`} placeholder="Иванов И.И." />
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Должность</label>
                          <input type="text" value={editingEmployee.position || ''} onChange={e => setEditingEmployee({...editingEmployee, position: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500`} placeholder="Водитель" />
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Отдел</label>
                          <select value={editingEmployee.department || ''} onChange={e => setEditingEmployee({...editingEmployee, department: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500`}>
                              <option value="">Без отдела</option>
                              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                          </select>
                      </div>
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                          <label className={`text-[10px] font-black uppercase text-blue-500 block mb-1`}>PIN-код (Для входа)</label>
                          <input type="text" value={editingEmployee.pin_code || ''} onChange={e => setEditingEmployee({...editingEmployee, pin_code: e.target.value})} className={`w-full bg-white dark:bg-[#0B1121] border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold tracking-widest outline-none focus:border-blue-500`} placeholder="1234" />
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setEditingEmployee(null)} className="flex-1 py-3 rounded-xl font-bold border border-slate-500 text-slate-500">Отмена</button>
                      <button onClick={handleSaveEmployee} disabled={savingId === "emp_save"} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2">
                          {savingId === "emp_save" ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Сохранить
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* МОДАЛКА: ТЕХНИКА */}
      {editingEquipment && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className={`${theme.cardBg} w-full max-w-md rounded-[32px] border ${theme.cardBorder} p-6 shadow-2xl animate-in zoom-in-95`}>
                  <h3 className="font-black text-lg mb-4 flex items-center gap-2"><Tractor className="text-orange-500"/> {editingEquipment.isNew ? "Новая техника" : "Редактировать машину"}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Марка / Название *</label>
                          <input type="text" value={editingEquipment.name || ''} onChange={e => setEditingEquipment({...editingEquipment, name: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-orange-500`} placeholder="КамАЗ 65115" />
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Госномер / Инв. номер</label>
                          <input type="text" value={editingEquipment.inventory_number || ''} onChange={e => setEditingEquipment({...editingEquipment, inventory_number: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-orange-500`} placeholder="123 ABC 16" />
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Тип (Класс)</label>
                          <input type="text" value={editingEquipment.type || ''} onChange={e => setEditingEquipment({...editingEquipment, type: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-orange-500`} placeholder="Грузовые / Спецтехника" />
                      </div>
                      <div>
                          <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1`}>Привязка к отделу (Опционально)</label>
                          <select value={editingEquipment.department || ''} onChange={e => setEditingEquipment({...editingEquipment, department: e.target.value})} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-sm font-bold outline-none focus:border-orange-500`}>
                              <option value="">Общая / Без привязки</option>
                              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                          </select>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setEditingEquipment(null)} className="flex-1 py-3 rounded-xl font-bold border border-slate-500 text-slate-500">Отмена</button>
                      <button onClick={handleSaveEquipment} disabled={savingId === "eq_save"} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2">
                          {savingId === "eq_save" ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Сохранить
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ================= ШАПКА ================= */}
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
                { id: "warehouses", icon: Package, label: "Склады" },
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

      {/* ================= КОНТЕНТ ВКЛАДОК ================= */}
      <main className="max-w-5xl mx-auto p-4 md:p-6 mt-4">
        {loading ? (
            <div className="flex justify-center items-center py-20 text-rose-500"><Loader2 className="animate-spin" size={40}/></div>
        ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300">
                
                {/* --- 1. МАРШРУТЫ --- */}
                {activeTab === "routes" && (
                    <div className="space-y-6 relative">
                        <div className={`${theme.cardBg} p-5 rounded-2xl border ${theme.cardBorder} flex justify-between items-center sticky top-[140px] z-20 shadow-sm backdrop-blur-xl bg-opacity-90`}>
                            <div><h2 className="font-black text-sm uppercase text-purple-500 flex items-center gap-2"><Route size={18}/> Конструктор маршрута</h2></div>
                            <button onClick={() => setEditingStep({ isNew: true, role: '', action_name: '', condition_type: 'all', color: 'text-blue-500', executor_type: 'specific', executor_ids: [] })} className="px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-xl text-xs font-black flex items-center gap-1 transition"><Plus size={16}/> Добавить этап</button>
                        </div>
                        <div className="space-y-3 pl-4 sm:pl-8 relative border-l-2 border-dashed border-purple-200 dark:border-purple-900/50 pb-8">
                            <div className={`${theme.cardBg} p-4 rounded-2xl border ${theme.cardBorder} relative shadow-sm`}>
                                <div className="absolute -left-[26px] sm:-left-[42px] top-1/2 -translate-y-1/2 w-4 h-4 bg-purple-500 rounded-full border-4 border-white dark:border-[#0B1121]"></div>
                                <div className="text-[10px] font-black text-blue-500 mb-1">СТАРТ</div>
                                <div className="font-black text-sm uppercase">Инициатор</div>
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
                                        <div className={`text-xs mt-0.5 ${theme.textMuted} font-medium`}>{step.action_name}</div>
                                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 leading-tight">
                                            <Users size={12} className="shrink-0"/> 
                                            {step.executor_type === 'auto_dept' ? "Авто: Начальник отдела" : step.executor_type === 'auto_warehouse' ? "Авто: Профильный склад" : getExecutorNames(step.executor_ids)}
                                        </div>
                                        {step.executor_type === 'specific' && (!step.executor_ids || step.executor_ids.length === 0) && <span className="ml-2 text-[10px] text-red-500 font-bold animate-pulse">Укажите людей!</span>}
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end bg-slate-50 dark:bg-[#0F172A] p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-[#1E293B] rounded-lg disabled:opacity-30"><ArrowUp size={16}/></button>
                                        <button onClick={() => moveStep(index, 'down')} disabled={index === workflow.length - 1} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-[#1E293B] rounded-lg disabled:opacity-30"><ArrowDown size={16}/></button>
                                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                        <button onClick={() => setEditingStep({...step})} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-white dark:hover:bg-[#1E293B] rounded-lg"><Edit2 size={16}/></button>
                                        <button onClick={() => deleteStep(index)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-[#1E293B] rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
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
                                    <button onClick={saveWorkflowToDB} disabled={savingId === "workflow"} className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-rose-500/40 flex items-center gap-2"><Save size={16}/> Сохранить для всех</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- 2. СКЛАДЫ --- */}
                {activeTab === "warehouses" && (
                    <div className="space-y-4">
                        <div className={`${theme.cardBg} p-5 rounded-2xl border ${theme.cardBorder} flex items-center gap-4 mb-6`}>
                            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><Package size={24}/></div>
                            <div>
                                <h2 className="font-black text-sm uppercase">Управление Складами</h2>
                                <p className={`text-xs ${theme.textMuted} mt-1`}>Назначьте кладовщиков. Если их несколько — заявка придет всем, и кто первый одобрит, тот и молодец.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {warehouses.map((wh) => (
                                <div key={wh.id} className={`${theme.cardBg} rounded-[24px] border ${theme.cardBorder} shadow-sm flex flex-col hover:border-amber-400/50 transition`}>
                                    <div className={`p-4 border-b ${theme.cardBorder} ${isDark ? "bg-[#0F172A]" : "bg-slate-50"}`}>
                                        <h3 className="font-black uppercase text-sm text-amber-600">{wh.name}</h3>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {wh.categories.split(',').map((cat, i) => (
                                                <span key={i} className={`text-[9px] font-bold px-2 py-1 rounded-md border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}>{cat.trim()}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1">
                                        <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1.5 ml-1`}>Ответственные Кладовщики</label>
                                        <div className={`p-3 rounded-xl border ${theme.cardBorder} bg-slate-50 dark:bg-[#0B1121] text-xs font-bold leading-relaxed min-h-[44px] flex items-center`}>
                                            {getExecutorNames(wh.manager_ids ? wh.manager_ids.split(',').map(Number) : [])}
                                        </div>
                                    </div>
                                    <div className={`p-4 border-t ${theme.cardBorder}`}>
                                        <button onClick={() => setEditingWarehouse({ ...wh, manager_ids: wh.manager_ids ? wh.manager_ids.split(',').map(Number) : [] })} className="w-full py-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition">
                                            <CheckSquare size={16}/> Изменить состав
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- 3. СТРУКТУРА --- */}
                {activeTab === "departments" && (
                    <div className="space-y-4">
                        <div className={`${theme.cardBg} p-5 rounded-2xl border ${theme.cardBorder} flex items-center gap-4 mb-6`}>
                            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><Building2 size={24}/></div>
                            <div>
                                <h2 className="font-black text-sm uppercase">Управление отделами</h2>
                                <p className={`text-xs ${theme.textMuted} mt-1`}>Назначайте руководителей и передавайте права замам на время отпуска.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {departments.map((dept) => (
                                <div key={dept.id} className={`${theme.cardBg} rounded-[24px] border ${theme.cardBorder} shadow-sm overflow-hidden flex flex-col transition hover:border-rose-500/50`}>
                                    <div className={`p-4 border-b ${theme.cardBorder} flex justify-between items-center ${dept.is_head_absent ? (isDark ? "bg-amber-500/10" : "bg-amber-50") : (isDark ? "bg-[#0F172A]" : "bg-slate-50")}`}>
                                        <h3 className="font-black uppercase text-sm">{dept.name}</h3>
                                        {dept.is_head_absent ? <span className="bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1"><UserX size={12}/> И.О.</span> : <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1"><CheckCircle2 size={12}/> Штат</span>}
                                    </div>
                                    <div className="p-5 flex-1 space-y-4">
                                        <div>
                                            <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1.5 ml-1`}>Руководитель</label>
                                            <select value={dept.head_id || ""} onChange={(e) => handleUpdateDeptField(dept.id, 'head_id', e.target.value)} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-xs font-bold ${theme.textMain} outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer appearance-none`}>
                                                <option value="">Не назначен</option>
                                                {activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={`text-[10px] font-bold uppercase ${theme.textMuted} block mb-1.5 ml-1`}>Заместитель (И.О.)</label>
                                            <select value={dept.deputy_id || ""} onChange={(e) => handleUpdateDeptField(dept.id, 'deputy_id', e.target.value)} className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl p-3 text-xs font-bold ${theme.textMain} outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer appearance-none`}>
                                                <option value="">Нет заместителя</option>
                                                {activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                            </select>
                                        </div>
                                        <div className={`p-3 rounded-xl border ${theme.cardBorder} flex items-center justify-between cursor-pointer transition ${dept.is_head_absent ? (isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-200") : ""}`} onClick={() => handleUpdateDeptField(dept.id, 'is_head_absent', !dept.is_head_absent)}>
                                            <div className="flex items-center gap-2">
                                                <Users size={16} className={dept.is_head_absent ? "text-amber-500" : theme.textMuted}/>
                                                <div>
                                                    <p className={`text-xs font-black ${dept.is_head_absent ? (isDark ? "text-amber-400" : "text-amber-700") : theme.textMain}`}>Начальник отсутствует</p>
                                                    <p className={`text-[9px] font-bold ${theme.textMuted}`}>Права передаются заму</p>
                                                </div>
                                            </div>
                                            {dept.is_head_absent ? <ToggleRight size={32} className="text-amber-500"/> : <ToggleLeft size={32} className={theme.textMuted}/>}
                                        </div>
                                    </div>
                                    <div className={`p-4 border-t ${theme.cardBorder} ${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                        <button onClick={() => handleSaveDepartment(dept)} disabled={savingId === dept.id} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                                            {savingId === dept.id ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Сохранить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- 4. СОТРУДНИКИ --- */}
                {activeTab === "employees" && (
                    <div className={`${theme.cardBg} rounded-[24px] border ${theme.cardBorder} overflow-hidden shadow-sm`}>
                        <div className={`p-5 border-b ${theme.cardBorder} flex flex-col sm:flex-row justify-between items-center gap-4`}>
                            <h2 className="font-black uppercase text-sm flex items-center gap-2"><Users className="text-emerald-500" size={18}/> База Людей ({employees.length})</h2>
                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                    <input type="text" value={searchEmp} onChange={e => setSearchEmp(e.target.value)} placeholder="Поиск по ФИО..." className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:border-emerald-500`} />
                                </div>
                                <button onClick={() => setEditingEmployee({ isNew: true, name: '', position: '', department: '', pin_code: '' })} className="w-full sm:w-auto px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition">
                                    <Plus size={16}/> Добавить
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className={`text-[10px] uppercase ${theme.textMuted} ${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                    <tr><th className="p-4 font-black">ФИО</th><th className="p-4 font-black">Должность</th><th className="p-4 font-black">Отдел</th><th className="p-4 font-black text-center">Действия</th></tr>
                                </thead>
                                <tbody>
                                    {employees.filter(e => e.name?.toLowerCase().includes(searchEmp.toLowerCase())).map(emp => (
                                        <tr key={emp.id} className={`border-b ${theme.cardBorder} hover:${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                            <td className={`p-4 font-bold ${!emp.is_active && 'opacity-50 line-through'}`}>{emp.name}</td>
                                            <td className={`p-4 ${theme.textMuted}`}>{emp.position || '-'}</td>
                                            <td className="p-4"><span className={`px-2 py-1 rounded-md text-[9px] font-black ${isDark ? 'bg-[#0B1121] text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{emp.department || '-'}</span></td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => setEditingEmployee({ ...emp })} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition"><Edit2 size={16}/></button>
                                                    <button onClick={() => toggleEmployeeActive(emp)} className={`p-1.5 rounded-lg transition ${emp.is_active ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                                        {emp.is_active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- 5. ТЕХНИКА --- */}
                {activeTab === "equipment" && (
                    <div className={`${theme.cardBg} rounded-[24px] border ${theme.cardBorder} overflow-hidden shadow-sm`}>
                        <div className={`p-5 border-b ${theme.cardBorder} flex flex-col sm:flex-row justify-between items-center gap-4`}>
                            <h2 className="font-black uppercase text-sm flex items-center gap-2"><Tractor className="text-orange-500" size={18}/> Автопарк ({equipment.length})</h2>
                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                    <input type="text" value={searchEq} onChange={e => setSearchEq(e.target.value)} placeholder="Поиск (название, госномер)..." className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:border-orange-500`} />
                                </div>
                                <button onClick={() => setEditingEquipment({ isNew: true, name: '', inventory_number: '', type: '', department: '' })} className="w-full sm:w-auto px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition">
                                    <Plus size={16}/> Добавить
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className={`text-[10px] uppercase ${theme.textMuted} ${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                    <tr><th className="p-4 font-black">Марка / Название</th><th className="p-4 font-black">Госномер</th><th className="p-4 font-black">Тип</th><th className="p-4 font-black text-center">Действия</th></tr>
                                </thead>
                                <tbody>
                                    {equipment.filter(eq => (eq.name + eq.inventory_number).toLowerCase().includes(searchEq.toLowerCase())).map(eq => (
                                        <tr key={eq.id} className={`border-b ${theme.cardBorder} hover:${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                            <td className={`p-4 font-bold ${!eq.is_active && 'opacity-50 line-through'}`}>{eq.name}</td>
                                            <td className="p-4"><span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700'}`}>{eq.inventory_number || 'Б/Н'}</span></td>
                                            <td className={`p-4 ${theme.textMuted}`}>{eq.type || '-'}</td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => setEditingEquipment({ ...eq })} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition"><Edit2 size={16}/></button>
                                                    <button onClick={() => toggleEquipmentActive(eq)} className={`p-1.5 rounded-lg transition ${eq.is_active ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-500/20 text-slate-500'}`}>
                                                        {eq.is_active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        )}
      </main>
    </div>
  );
}

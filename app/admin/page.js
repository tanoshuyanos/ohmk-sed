// ==========================================
// ФАЙЛ: ПУЛЬТ АДМИНИСТРАТОРА (С ПРАВИЛЬНЫМ МАРШРУТОМ)
// ПУТЬ: app/admin/page.js
// ==========================================

"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
    ArrowLeft, ShieldCheck, Users, Lock, Loader2, Save, ToggleLeft, ToggleRight, 
    Building2, UserX, CheckCircle2, Tractor, Route, Settings, Search, Sun, Moon, AlertCircle
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

  const [activeTab, setActiveTab] = useState("departments");
  const [loading, setLoading] = useState(true);
  
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [equipment, setEquipment] = useState([]);
  
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
      const [empRes, deptRes, eqRes] = await Promise.all([
          supabase.from("v2_employees").select("*").order("name"),
          supabase.from("v2_departments").select("*").order("name"),
          supabase.from("v2_equipment").select("*").order("name")
      ]);
      
      if (empRes.data) setEmployees(empRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (eqRes.data) setEquipment(eqRes.data);
      setLoading(false);
  };

  // --- ЛОГИКА ОТДЕЛОВ ---
  const handleUpdateDeptField = (deptId, field, value) => {
      setDepartments(departments.map(d => d.id === deptId ? { ...d, [field]: value === "" ? null : value } : d));
  };

  const handleSaveDepartment = async (dept) => {
      setSavingId(dept.id);
      const { error } = await supabase.from("v2_departments").update({ head_id: dept.head_id, deputy_id: dept.deputy_id, is_head_absent: dept.is_head_absent }).eq("id", dept.id);
      if (error) alert("Ошибка: " + error.message);
      setTimeout(() => setSavingId(null), 500);
  };

  // --- ЛОГИКА СОТРУДНИКОВ И ТЕХНИКИ (Активация/Деактивация) ---
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

  // --- ТЕМАТИКА ---
  const theme = {
      bgMain: isDark ? "bg-[#0B1121]" : "bg-slate-50",
      textMain: isDark ? "text-slate-100" : "text-slate-900",
      textMuted: isDark ? "text-slate-400" : "text-slate-500",
      cardBg: isDark ? "bg-[#1E293B]" : "bg-white",
      cardBorder: isDark ? "border-[#334155]" : "border-slate-200",
      inputBg: isDark ? "bg-[#0B1121]" : "bg-slate-50",
      tabActive: isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700",
      tabInactive: isDark ? "text-slate-400 hover:bg-[#1E293B]" : "text-slate-600 hover:bg-slate-100",
  };

  // --- ЭТАПЫ МАРШРУТА ---
  const workflowSteps = [
    { stage: 0, role: "Инициатор", action: "Создание заявки", color: "text-blue-500" },
    { stage: 1, role: "Начальник отдела", action: "Бюджет и Утверждение", color: "text-indigo-500" },
    { stage: 2, role: "Директор", action: "Одобрение и Срочность", color: "text-indigo-500" },
    { stage: 3, role: "Склад", action: "Проверка наличия ТМЦ", color: "text-amber-500" },
    { stage: 4, role: "Ком. Директор", action: "Условия и Контрагент", color: "text-orange-500" },
    { stage: 5, role: "Экономист", action: "Подтверждение плана", color: "text-rose-500" },
    { stage: 6, role: "Фин. Директор", action: "Утверждение расходов", color: "text-purple-500" },
    { stage: 7, role: "Юрист", action: "Загрузка проекта договора", color: "text-slate-400" },
    { stage: 8, role: "Финансист", action: "Проверка проекта договора", color: "text-purple-500" },
    { stage: 9, role: "Юрист", action: "Подписанный скан", color: "text-slate-400" },
    { stage: 10, role: "Бухгалтерия", action: "Запрос на оплату", color: "text-emerald-500" },
    { stage: 11, role: "Финансист", action: "Одобрение к оплате", color: "text-purple-500" },
    { stage: 12, role: "Бухгалтерия", action: "Проведение платежа", color: "text-emerald-600" }
  ];

  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-[#0B1121] flex items-center justify-center p-4 font-sans">
              <div className="bg-[#1E293B] border border-[#334155] w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-rose-500/20"><ShieldCheck size={32}/></div>
                      <h2 className="text-2xl font-black text-white tracking-tight">Терминал</h2>
                      <p className="text-xs text-slate-400 mt-2 font-medium">Только для администратора</p>
                  </div>
                  <div className="relative mb-6">
                      <Lock className="absolute left-4 top-4 text-slate-500" size={20} />
                      <input type="password" value={inputPin} onChange={(e) => setInputPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkPin()} className={`w-full bg-[#0B1121] border rounded-2xl py-4 pl-12 pr-4 text-center text-xl font-black tracking-[0.5em] text-white outline-none focus:ring-2 focus:ring-rose-500 transition ${pinError ? "border-rose-500 ring-2 ring-rose-500/20" : "border-[#334155]"}`} placeholder="PIN" autoFocus />
                  </div>
                  <button onClick={checkPin} className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-600/20 transition active:scale-[0.98]">Подтвердить</button>
                  <a href="/" className="block text-center text-xs font-bold text-slate-500 mt-6 hover:text-white transition">← На главную</a>
              </div>
          </div>
      );
  }

  const activeEmployees = employees.filter(e => e.is_active);

  return (
    <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans pb-20 transition-colors duration-500`}>
      
      {/* ШАПКА АДМИНКИ */}
      <div className={`bg-gradient-to-r ${isDark ? 'from-[#0F172A] to-[#1E293B]' : 'from-slate-900 to-slate-800'} text-white p-4 sm:p-5 sticky top-0 z-30 shadow-xl shadow-black/10 rounded-b-[32px] md:rounded-none transition-colors`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition shrink-0"><ArrowLeft size={18} /></a>
            <div className="flex-1 px-4 text-center">
                <h1 className="text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"><ShieldCheck className="text-rose-500" size={18}/> Root Access</h1>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Панель управления системой</p>
            </div>
            <button onClick={() => setIsDark(!isDark)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition text-yellow-300">
                {isDark ? <Sun size={16}/> : <Moon size={16} className="text-slate-200"/>}
            </button>
        </div>
        
        {/* НАВИГАЦИЯ ПО ВКЛАДКАМ */}
        <div className="max-w-6xl mx-auto mt-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
                { id: "departments", icon: Building2, label: "Структура" },
                { id: "employees", icon: Users, label: "Сотрудники" },
                { id: "equipment", icon: Tractor, label: "Техника" },
                { id: "routes", icon: Route, label: "Маршруты" },
                { id: "settings", icon: Settings, label: "Настройки" }
            ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition ${activeTab === tab.id ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                    <tab.icon size={14}/> {tab.label}
                </button>
            ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-6 mt-4">
        {loading ? (
            <div className="flex justify-center items-center py-20 text-rose-500"><Loader2 className="animate-spin" size={40}/></div>
        ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300">
                
                {/* ВКЛАДКА 1: СТРУКТУРА (ОТДЕЛЫ И ЗАМЫ) */}
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
                                        {dept.is_head_absent ? (
                                            <span className="bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 shadow-sm"><UserX size={12}/> И.О.</span>
                                        ) : (
                                            <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 shadow-sm"><CheckCircle2 size={12}/> Штат</span>
                                        )}
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
                                            {savingId === dept.id ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} {savingId === dept.id ? "Сохранение..." : "Сохранить"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ВКЛАДКА 2: БД СОТРУДНИКОВ */}
                {activeTab === "employees" && (
                    <div className={`${theme.cardBg} rounded-[24px] border ${theme.cardBorder} overflow-hidden shadow-sm`}>
                        <div className={`p-5 border-b ${theme.cardBorder} flex flex-col sm:flex-row justify-between items-center gap-4`}>
                            <h2 className="font-black uppercase text-sm flex items-center gap-2"><Users className="text-emerald-500" size={18}/> База Людей ({employees.length})</h2>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                <input type="text" value={searchEmp} onChange={e => setSearchEmp(e.target.value)} placeholder="Поиск по ФИО..." className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:border-emerald-500`} />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className={`text-[10px] uppercase ${theme.textMuted} ${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                    <tr><th className="p-4 font-black">ФИО</th><th className="p-4 font-black">Должность</th><th className="p-4 font-black">Отдел</th><th className="p-4 font-black text-center">Доступ (Активен)</th></tr>
                                </thead>
                                <tbody>
                                    {employees.filter(e => e.name?.toLowerCase().includes(searchEmp.toLowerCase())).map(emp => (
                                        <tr key={emp.id} className={`border-b ${theme.cardBorder} hover:${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                            <td className={`p-4 font-bold ${!emp.is_active && 'opacity-50 line-through'}`}>{emp.name}</td>
                                            <td className={`p-4 ${theme.textMuted}`}>{emp.position || '-'}</td>
                                            <td className="p-4"><span className={`px-2 py-1 rounded-md text-[9px] font-black ${isDark ? 'bg-[#0B1121] text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{emp.department || '-'}</span></td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => toggleEmployeeActive(emp)} className={`p-1.5 rounded-lg transition ${emp.is_active ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`} title={emp.is_active ? "Отключить доступ (Уволен/Декрет)" : "Включить доступ"}>
                                                    {emp.is_active ? <ToggleRight size={20}/> : <ToggleLeft size={20}/>}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ВКЛАДКА 3: БД ТЕХНИКИ */}
                {activeTab === "equipment" && (
                    <div className={`${theme.cardBg} rounded-[24px] border ${theme.cardBorder} overflow-hidden shadow-sm`}>
                        <div className={`p-5 border-b ${theme.cardBorder} flex flex-col sm:flex-row justify-between items-center gap-4`}>
                            <h2 className="font-black uppercase text-sm flex items-center gap-2"><Tractor className="text-orange-500" size={18}/> Автопарк ({equipment.length})</h2>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                <input type="text" value={searchEq} onChange={e => setSearchEq(e.target.value)} placeholder="Поиск (название, госномер)..." className={`w-full ${theme.inputBg} border ${theme.cardBorder} rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:border-orange-500`} />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className={`text-[10px] uppercase ${theme.textMuted} ${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                    <tr><th className="p-4 font-black">Марка / Название</th><th className="p-4 font-black">Госномер</th><th className="p-4 font-black">Тип</th><th className="p-4 font-black text-center">Статус (В строю)</th></tr>
                                </thead>
                                <tbody>
                                    {equipment.filter(eq => (eq.name + eq.inventory_number).toLowerCase().includes(searchEq.toLowerCase())).map(eq => (
                                        <tr key={eq.id} className={`border-b ${theme.cardBorder} hover:${isDark ? 'bg-[#0F172A]' : 'bg-slate-50'}`}>
                                            <td className={`p-4 font-bold ${!eq.is_active && 'opacity-50 line-through'}`}>{eq.name}</td>
                                            <td className="p-4"><span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700'}`}>{eq.inventory_number || 'Б/Н'}</span></td>
                                            <td className={`p-4 ${theme.textMuted}`}>{eq.type || '-'}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => toggleEquipmentActive(eq)} className={`p-1.5 rounded-lg transition ${eq.is_active ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-500/20 text-slate-500'}`} title={eq.is_active ? "Списать / В ремонт" : "Вернуть в строй"}>
                                                    {eq.is_active ? <ToggleRight size={20}/> : <ToggleLeft size={20}/>}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ВКЛАДКА 4: МАРШРУТЫ (Визуализация) */}
                {activeTab === "routes" && (
                    <div className="space-y-4">
                        <div className={`${theme.cardBg} p-6 rounded-3xl border ${theme.cardBorder} text-center shadow-sm`}>
                            <Route size={40} className="mx-auto text-purple-500 mb-4"/>
                            <h2 className="text-lg font-black uppercase">Утвержденный маршрут</h2>
                            <p className={`text-xs ${theme.textMuted} mt-2 max-w-xl mx-auto`}>Полная цепочка согласования заявок (12 этапов). Обратите внимание: заявки на услуги автоматически минуют этап Склада.</p>
                            
                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-left relative">
                                {workflowSteps.map((step, i) => (
                                    <div key={i} className={`p-4 rounded-2xl border relative ${
                                        step.stage === 0 ? (isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200') : 
                                        step.stage === 12 ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') : 
                                        (isDark ? 'bg-[#0F172A] border-[#334155]' : 'bg-white border-slate-200 shadow-sm')
                                    }`}>
                                        <div className={`text-[10px] font-black mb-1 ${step.color}`}>{step.stage === 0 ? "СТАРТ" : `ЭТАП ${step.stage}`}</div>
                                        <div className={`font-black text-sm uppercase leading-tight ${theme.textMain}`}>{step.role}</div>
                                        <div className={`text-[10px] mt-1.5 font-bold ${theme.textMuted}`}>{step.action}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ВКЛАДКА 5: НАСТРОЙКИ */}
                {activeTab === "settings" && (
                    <div className={`${theme.cardBg} p-6 rounded-3xl border ${theme.cardBorder} max-w-md mx-auto text-center`}>
                        <Settings size={40} className="mx-auto text-slate-400 mb-4"/>
                        <h2 className="text-lg font-black uppercase">Системные настройки</h2>
                        <div className={`mt-6 p-4 rounded-2xl border ${theme.cardBorder} flex items-center justify-between text-left`}>
                            <div>
                                <h3 className="font-bold text-sm">Сменить PIN-код Admin</h3>
                                <p className={`text-[10px] ${theme.textMuted} mt-1`}>Текущий пин: {ADMIN_PIN}</p>
                            </div>
                            <button className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-xl text-xs font-black uppercase">Изменить (в коде)</button>
                        </div>
                        <div className={`mt-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 flex items-start gap-3 text-left`}>
                            <AlertCircle size={20} className="shrink-0 mt-0.5"/>
                            <p className="text-[10px] font-bold leading-relaxed">Любые изменения в базах Людей и Техники применяются мгновенно у всех пользователей системы.</p>
                        </div>
                    </div>
                )}

            </div>
        )}
      </main>
    </div>
  );
}

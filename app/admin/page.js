// ==========================================
// ФАЙЛ: ПАНЕЛЬ АДМИНИСТРАТОРА (КОМАНДНЫЙ ЦЕНТР)
// ПУТЬ: app/admin/page.js
// ==========================================

"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, ShieldCheck, Users, Lock, Loader2, Save, ToggleLeft, ToggleRight, Building2, UserX, CheckCircle2 } from "lucide-react";

// Подключение к БД
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; 
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔒 МАСТЕР-ПАРОЛЬ АДМИНА (Можешь поменять на любой другой)
const ADMIN_PIN = "7777";

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [savingId, setSavingId] = useState(null);

  // Проверка админского пароля
  const checkPin = () => {
      if (inputPin === ADMIN_PIN) {
          setIsAuthenticated(true);
          setPinError(false);
          loadData();
      } else {
          setPinError(true);
      }
  };

  const loadData = async () => {
      setLoading(true);
      
      // Грузим всех активных сотрудников для выпадающих списков
      const { data: emp } = await supabase.from("v2_employees").select("id, name, position, department").eq("is_active", true).order("name");
      if (emp) setEmployees(emp);

      // Грузим все отделы
      const { data: depts } = await supabase.from("v2_departments").select("*").order("name");
      if (depts) setDepartments(depts);

      setLoading(false);
  };

  // Обновление значения в локальном стейте перед сохранением
  const handleUpdateField = (deptId, field, value) => {
      setDepartments(departments.map(d => 
          d.id === deptId ? { ...d, [field]: value === "" ? null : value } : d
      ));
  };

  // Сохранение отдела в базу
  const handleSaveDepartment = async (dept) => {
      setSavingId(dept.id);

      const { error } = await supabase
          .from("v2_departments")
          .update({
              head_id: dept.head_id,
              deputy_id: dept.deputy_id,
              is_head_absent: dept.is_head_absent
          })
          .eq("id", dept.id);

      if (error) {
          alert("Ошибка сохранения: " + error.message);
      } else {
          // Маленькая визуальная задержка для красоты
          setTimeout(() => setSavingId(null), 500);
      }
  };

  // 1. ЭКРАН ВХОДА ДЛЯ АДМИНА
  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
              <div className="bg-slate-800 border border-slate-700 w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-rose-500/20"><ShieldCheck size={32}/></div>
                      <h2 className="text-2xl font-black text-white tracking-tight">Доступ закрыт</h2>
                      <p className="text-xs text-slate-400 mt-2 font-medium">Только для системного администратора</p>
                  </div>
                  
                  <div className="relative mb-6">
                      <Lock className="absolute left-4 top-4 text-slate-500" size={20} />
                      <input 
                          type="password" 
                          value={inputPin} 
                          onChange={(e) => setInputPin(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && checkPin()}
                          className={`w-full bg-slate-900/50 border rounded-2xl py-4 pl-12 pr-4 text-center text-xl font-black tracking-[0.5em] text-white outline-none focus:ring-2 focus:ring-rose-500 transition ${pinError ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-700"}`} 
                          placeholder="PIN" 
                          autoFocus 
                      />
                      {pinError && <p className="text-xs text-rose-400 font-bold mt-2 text-center">Неверный пароль!</p>}
                  </div>
                  <button onClick={checkPin} className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-600/20 transition active:scale-[0.98]">
                      Войти в систему
                  </button>
                  <a href="/" className="block text-center text-xs font-bold text-slate-500 mt-6 hover:text-white transition">← Вернуться на главную</a>
              </div>
          </div>
      );
  }

  // 2. ГЛАВНЫЙ ЭКРАН АДМИНКИ
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* Шапка */}
      <div className="bg-slate-900 text-white p-5 sticky top-0 z-20 shadow-xl shadow-slate-900/10 rounded-b-[32px] md:rounded-none">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
            <a href="/" className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition shrink-0"><ArrowLeft size={18} /></a>
            <div className="flex-1 px-4 text-center">
                <h1 className="text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"><ShieldCheck className="text-rose-500" size={18}/> Командный центр</h1>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Управление структурой</p>
            </div>
            <div className="w-9 h-9"></div> {/* Пустой блок для баланса шапки */}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 md:p-8 mt-4">
        
        <div className="mb-6 flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0"><Building2 size={20}/></div>
            <div>
                <h2 className="text-sm font-black text-slate-800 uppercase">Подразделения компании</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Назначайте руководителей и управляйте делегированием полномочий</p>
            </div>
        </div>

        {loading ? (
            <div className="flex justify-center items-center py-20 text-slate-400"><Loader2 className="animate-spin" size={32}/></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {departments.map((dept) => (
                    <div key={dept.id} className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col transition hover:shadow-md hover:border-slate-300">
                        
                        {/* Заголовок карточки отдела */}
                        <div className={`p-4 border-b flex justify-between items-center ${dept.is_head_absent ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
                            <h3 className="font-black text-slate-800 uppercase text-sm">{dept.name}</h3>
                            {dept.is_head_absent ? (
                                <span className="bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 shadow-sm shadow-amber-500/20"><UserX size={12}/> И.О. Заместитель</span>
                            ) : (
                                <span className="bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 shadow-sm shadow-emerald-500/20"><CheckCircle2 size={12}/> Штатный режим</span>
                            )}
                        </div>

                        {/* Настройки */}
                        <div className="p-5 flex-1 space-y-4">
                            
                            {/* Выбор Начальника */}
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5 ml-1">Руководитель (Утверждает заявки)</label>
                                <select 
                                    value={dept.head_id || ""} 
                                    onChange={(e) => handleUpdateField(dept.id, 'head_id', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                                >
                                    <option value="">Не назначен</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.position || 'Должность не указана'})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Выбор Заместителя */}
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5 ml-1">Заместитель (И.О. на время отсутствия)</label>
                                <select 
                                    value={dept.deputy_id || ""} 
                                    onChange={(e) => handleUpdateField(dept.id, 'deputy_id', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                                >
                                    <option value="">Нет заместителя</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Переключатель Отсутствия */}
                            <div className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${dept.is_head_absent ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200 hover:bg-slate-50"}`} onClick={() => handleUpdateField(dept.id, 'is_head_absent', !dept.is_head_absent)}>
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${dept.is_head_absent ? "bg-amber-200 text-amber-700" : "bg-slate-100 text-slate-400"}`}>
                                        <Users size={16}/>
                                    </div>
                                    <div>
                                        <p className={`text-xs font-black ${dept.is_head_absent ? "text-amber-900" : "text-slate-700"}`}>Начальник отсутствует</p>
                                        <p className={`text-[9px] font-bold ${dept.is_head_absent ? "text-amber-700/70" : "text-slate-400"}`}>Права переданы заместителю</p>
                                    </div>
                                </div>
                                <div>
                                    {dept.is_head_absent ? <ToggleRight size={32} className="text-amber-500"/> : <ToggleLeft size={32} className="text-slate-300"/>}
                                </div>
                            </div>

                        </div>

                        {/* Кнопка сохранения */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                            <button 
                                onClick={() => handleSaveDepartment(dept)}
                                disabled={savingId === dept.id}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2"
                            >
                                {savingId === dept.id ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                                {savingId === dept.id ? "Сохранение..." : "Сохранить настройки"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>
    </div>
  );
}

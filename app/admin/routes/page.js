// ==========================================
// ФАЙЛ: КОНСТРУКТОР МАРШРУТОВ (АДМИНКА)
// ПУТЬ: app/admin/routes/page.js
// ==========================================

"use client";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, GitMerge, Plus, Trash2, Loader2, Settings, AlertCircle } from "lucide-react";

// Берем ключи из .env (мы же их уже спрятали!)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Справочник наших шагов (чтобы админ видел текст, а база - цифры)
const STEPS = {
    1: "1. Руководитель (Согласование)",
    2: "2. Снабжение (Поиск поставщика)",
    3: "3. Ком. Директор (Одобрение суммы)",
    4: "4. Фин. Директор (Утверждение)",
    5: "5. Юрист (Договор)",
    6: "6. Финансист (Сверка)",
    7: "7. Бухгалтерия (Оплата)",
    100: "✅ ФИНИШ (Оплачено/Выдано)",
    "-1": "❌ ОТКАЗ (Возврат)"
};

const CONDITIONS = {
    "always": "Без условий (Всегда)",
    "request_type": "Тип заявки (ТМЦ / Услуга)",
    "amount": "Сумма (В тенге)",
    "urgency": "Срочность"
};

export default function WorkflowAdmin() {
    const [loading, setLoading] = useState(true);
    const [rules, setRules] = useState([]);

    // Состояния формы добавления
    const [stepFrom, setStepFrom] = useState("1");
    const [condField, setCondField] = useState("always");
    const [condOp, setCondOp] = useState("=");
    const [condValue, setCondValue] = useState("");
    const [stepTo, setStepTo] = useState("2");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("v2_workflow_rules")
            .select("*")
            .order("step_from", { ascending: true })
            .order("id", { ascending: true });
        
        if (data) setRules(data);
        setLoading(false);
    };

    const handleAddRule = async () => {
        if (condField !== "always" && !condValue) {
            return alert("Введите значение для условия!");
        }

        setIsSaving(true);
        const { error } = await supabase.from("v2_workflow_rules").insert([{
            step_from: parseInt(stepFrom),
            condition_field: condField,
            condition_operator: condField === "always" ? null : condOp,
            condition_value: condField === "always" ? null : condValue,
            step_to: parseInt(stepTo)
        }]);

        if (error) {
            alert("Ошибка сохранения: " + error.message);
        } else {
            // Сброс формы (кроме шага "Откуда")
            setCondField("always");
            setCondValue("");
            await loadRules();
        }
        setIsSaving(false);
    };

    const handleDelete = async (id) => {
        if (!confirm("Точно удалить это правило?")) return;
        await supabase.from("v2_workflow_rules").delete().eq("id", id);
        loadRules();
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-900">
            {/* Шапка */}
            <div className="p-4 shadow-sm border-b flex items-center justify-between sticky top-0 z-20 bg-slate-900 text-white">
                <a href="/" className="hover:opacity-70 text-white"><ArrowLeft size={24} /></a>
                <div className="flex items-center gap-2">
                    <Settings size={20} className="text-indigo-400"/>
                    <h1 className="text-sm font-black uppercase tracking-widest">Конструктор маршрутов</h1>
                </div>
                <div className="w-6"></div>
            </div>

            <main className="max-w-4xl mx-auto p-4 md:p-8 mt-4">
                
                {/* Блок добавления нового правила */}
                <div className="bg-white p-6 rounded-[24px] shadow-lg border border-indigo-100 mb-8">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
                        <GitMerge className="text-indigo-600"/> Создать новое правило
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-indigo-50/50 p-4 rounded-xl border border-indigo-50">
                        {/* 1. Откуда */}
                        <div className="md:col-span-3">
                            <label className="text-[10px] font-black uppercase text-indigo-600 mb-1 block">Если заявка на шаге:</label>
                            <select value={stepFrom} onChange={(e) => setStepFrom(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold bg-white">
                                {Object.entries(STEPS).filter(([k]) => parseInt(k) > 0 && parseInt(k) < 100).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Условие */}
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black uppercase text-indigo-600 mb-1 block">Условие:</label>
                            <select value={condField} onChange={(e) => setCondField(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold bg-white">
                                {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>

                        {/* 3. Оператор и Значение (показываем, если есть условие) */}
                        {condField !== "always" ? (
                            <>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Оператор:</label>
                                    <select value={condOp} onChange={(e) => setCondOp(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold bg-white">
                                        <option value="=">Равно (=)</option>
                                        <option value=">">Больше (&gt;)</option>
                                        <option value="<">Меньше (&lt;)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Значение:</label>
                                    <input type="text" placeholder="Услуга / 500000" value={condValue} onChange={(e) => setCondValue(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold bg-white"/>
                                </div>
                            </>
                        ) : (
                            <div className="md:col-span-4 flex items-center justify-center text-slate-400 text-xs font-bold bg-slate-100 rounded-xl h-[46px] border border-dashed border-slate-200">
                                Применяется ко всем заявкам
                            </div>
                        )}

                        {/* 4. Куда */}
                        <div className="md:col-span-3">
                            <label className="text-[10px] font-black uppercase text-emerald-600 mb-1 block">То отправить на:</label>
                            <select value={stepTo} onChange={(e) => setStepTo(e.target.value)} className="w-full p-3 rounded-xl border border-emerald-200 text-sm font-bold bg-emerald-50 text-emerald-800">
                                {Object.entries(STEPS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button onClick={handleAddRule} disabled={isSaving} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition w-full md:w-auto ml-auto shadow-lg shadow-indigo-200">
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Plus size={18}/>}
                        Добавить правило
                    </button>
                </div>

                {/* Список текущих правил */}
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Текущие активные маршруты</h2>
                
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600"/></div>
                ) : rules.length === 0 ? (
                    <div className="bg-slate-100 rounded-2xl p-10 text-center text-slate-500 font-bold border border-dashed border-slate-300">
                        <AlertCircle className="mx-auto mb-2 text-slate-400" size={32}/>
                        Нет ни одного правила. Заявки никуда не пойдут!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rules.map((rule) => (
                            <div key={rule.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-indigo-200 transition">
                                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm font-bold text-slate-700">
                                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg whitespace-nowrap">
                                        {STEPS[rule.step_from]}
                                    </span>
                                    
                                    <span className="text-slate-400">➡️</span>
                                    
                                    {rule.condition_field === "always" ? (
                                        <span className="text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">Без условий</span>
                                    ) : (
                                        <span className="text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                                            Если {CONDITIONS[rule.condition_field]} <b>{rule.condition_operator}</b> {rule.condition_value}
                                        </span>
                                    )}

                                    <span className="text-slate-400">➡️</span>

                                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg whitespace-nowrap">
                                        {STEPS[rule.step_to]}
                                    </span>
                                </div>
                                <button onClick={() => handleDelete(rule.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition self-end md:self-auto">
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

            </main>
        </div>
    );
}

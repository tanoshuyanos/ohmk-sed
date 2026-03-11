// ==========================================
// ДВИЖОК МАРШРУТОВ (УМНЫЙ МОТОРЧИК)
// Файл: app/utils/workflow.js
// ==========================================

import { createClient } from "@supabase/supabase-js";

// Берем ключи из защищенного хранилища Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getNextStep(currentStep, requestData) {
    // Запрашиваем из базы все правила для текущего шага
    const { data: rules } = await supabase
        .from("v2_workflow_rules")
        .select("*")
        .eq("step_from", currentStep);

    // Если в админке не настроено ни одного правила для этого шага,
    // просто перекидываем на следующий по порядку (+1)
    if (!rules || rules.length === 0) {
        return currentStep + 1; 
    }

    // СОРТИРОВКА: Сначала проверяем жесткие условия (Услуга, Сумма), 
    // а правило "Без условий" (всегда) проверяем в самом конце.
    rules.sort((a, b) => (a.condition_field === "always" ? 1 : -1));

    for (const rule of rules) {
        // Если дошли до правила "Без условий", применяем его
        if (rule.condition_field === "always") {
            return rule.step_to;
        }

        // Берем реальное значение из заявки (например, тип "услуга" или сумму)
        const actualValue = requestData[rule.condition_field];
        const targetValue = rule.condition_value;

        // Проверяем условия
        if (rule.condition_operator === "=" && String(actualValue).toLowerCase().trim() === String(targetValue).toLowerCase().trim()) {
            return rule.step_to;
        }
        if (rule.condition_operator === ">" && Number(actualValue) > Number(targetValue)) {
            return rule.step_to;
        }
        if (rule.condition_operator === "<" && Number(actualValue) < Number(targetValue)) {
            return rule.step_to;
        }
    }

    // Резервный вариант, если ни одно правило не сработало
    return currentStep + 1; 
}

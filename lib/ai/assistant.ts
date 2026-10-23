import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { CurrentEmployee } from "@/lib/session";
import { formatDate, kyivToday, ROLE_LABEL, type LeaveType } from "@/lib/format";

// ІІ-асистент (spec §5.10): Claude Haiku 5.5 з інструментами, що читають дані з правами користувача.
// У базу асистент нічого не пише — prepare_request лише повертає чернетку для форми.

const MODEL = "claude-haiku-5-5";
const MAX_STEPS = 5;
const TYPES: LeaveType[] = ["annual", "unpaid", "sick"];

export type ChatMessage = { role: "user" | "assistant"; text: string };
export type Draft = {
  type: LeaveType;
  start: string;
  end: string;
  comment: string;
  days: number;
  available: number | null;
  colleagues: string[];
};

export const assistantEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// ---------- Інструменти ----------

const dateField = (description: string) => ({ type: "string", description: `${description}, формат YYYY-MM-DD` });
const noInput = { type: "object" as const, properties: {}, required: [], additionalProperties: false };

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_my_balance",
    description: "Баланс щорічної відпустки користувача на сьогодні: накопичено, використано, на розгляді, доступно зараз.",
    strict: true,
    input_schema: noInput,
  },
  {
    name: "get_my_requests",
    description: "Заявки й лікарняні користувача зі статусами та коментарями адміністратора.",
    strict: true,
    input_schema: noInput,
  },
  {
    name: "get_absences",
    description: "Хто з колег по всій компанії відсутній у період (лише погоджені відпустки й зареєстровані лікарняні): ПІБ, відділ, тип, дати.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { from: dateField("Початок періоду"), to: dateField("Кінець періоду") },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "get_holidays",
    description: "Державні свята в період (вони не входять у тривалість щорічної відпустки).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { from: dateField("Початок періоду"), to: dateField("Кінець періоду") },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "check_dates",
    description:
      "Перевіряє варіант відпустки за правилами компанії: скільки днів спишеться, скільки доступно, хто з відділу тоді відсутній і чи є перешкоди. Викликай для кожного варіанта, перш ніж його пропонувати.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: TYPES, description: "annual — щорічна, unpaid — без збереження, sick — лікарняний" },
        start: dateField("Перший день"),
        end: dateField("Останній день"),
      },
      required: ["type", "start", "end"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_request",
    description:
      "Готує чернетку заявки, коли користувач погодився на конкретні дати. Заявку НЕ подає: користувач побачить кнопку «Заповнити форму» і надішле сам.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: TYPES, description: "annual — щорічна, unpaid — без збереження, sick — лікарняний" },
        start: dateField("Перший день"),
        end: dateField("Останній день"),
        comment: { type: "string", description: "Коментар для адміністратора; порожній рядок, якщо немає" },
      },
      required: ["type", "start", "end", "comment"],
      additionalProperties: false,
    },
  },
];

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Ctx = { supabase: Supabase; employee: CurrentEmployee; today: string };
type ToolOutput = { result: unknown; draft?: Draft };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function period(input: Record<string, unknown>) {
  const from = String(input.from ?? "");
  const to = String(input.to ?? "");
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || to < from) throw new Error("Невірний період: потрібні дати YYYY-MM-DD, кінець не раніше початку");
  return { from, to };
}

// Підказки за правилами spec §5.1–5.2; остаточно їх однаково перевірить submit_request під час надсилання.
async function checkDates(ctx: Ctx, input: Record<string, unknown>) {
  const type = input.type as LeaveType;
  const start = String(input.start ?? "");
  const end = String(input.end ?? "");
  if (!TYPES.includes(type) || !ISO_DATE.test(start) || !ISO_DATE.test(end)) throw new Error("Невірні тип або дати");

  const problems: string[] = [];
  if (end < start) problems.push("кінець раніше за початок");
  if (start.slice(0, 4) !== end.slice(0, 4)) problems.push("дати мають бути в межах одного року");
  if (type !== "sick" && start < ctx.today) problems.push("відпустку можна почати лише сьогодні або пізніше");

  const [{ data: preview, error }, { data: own }] = await Promise.all([
    ctx.supabase.rpc("preview_request", { p_type: type, p_start: start, p_end: end }),
    ctx.supabase
      .from("leave_requests")
      .select("start_date, end_date")
      .eq("employee_id", ctx.employee.id)
      .in("status", ["pending", "approved", "registered"])
      .lte("start_date", end)
      .gte("end_date", start),
  ]);
  if (error) throw new Error(error.message);
  const row = (preview as { days: number; available: number | null; colleagues: string[] }[] | null)?.[0];
  const days = row?.days ?? 0;
  const available = row?.available ?? null;
  if ((own ?? []).length > 0) problems.push("на ці дати вже є ваша заявка");
  if (days === 0 && problems.length === 0) problems.push("у вибраних датах лише державні свята");
  if (type === "annual" && available !== null && days > available) {
    problems.push(`недостатньо днів: доступно ${Math.max(available, 0)}, потрібно ${days}`);
  }

  return {
    type, start, end,
    calendar_days: end >= start ? (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1 : 0,
    days_charged: days,
    available_in_start_month: available,
    department_colleagues_absent: row?.colleagues ?? [],
    problems,
    ok: problems.length === 0,
  };
}

async function runTool(name: string, input: Record<string, unknown>, ctx: Ctx): Promise<ToolOutput> {
  const { supabase, employee } = ctx;
  switch (name) {
    case "get_my_balance": {
      const { data, error } = await supabase.rpc("get_balances");
      if (error) throw new Error(error.message);
      const own = (data as { employee_id: string; accrued: number; used: number; reserved: number; available: number }[] | null)
        ?.find((r) => r.employee_id === employee.id);
      return { result: own ? { accrued: own.accrued, used: own.used, pending: own.reserved, available_now: Math.max(own.available, 0) } : null };
    }
    case "get_my_requests": {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("type, start_date, end_date, days, status, employee_comment, decision_comment")
        .eq("employee_id", employee.id)
        .order("start_date", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return { result: data };
    }
    case "get_absences": {
      const { from, to } = period(input);
      const { data, error } = await supabase.rpc("get_colleague_absences", { p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      type Absence = { full_name: string; department: string; type: LeaveType; start_date: string; end_date: string };
      const rows = ((data as Absence[] | null) ?? []).slice(0, 100);
      return { result: rows.map((r) => ({ full_name: r.full_name, department: r.department, type: r.type, start_date: r.start_date, end_date: r.end_date })) };
    }
    case "get_holidays": {
      const { from, to } = period(input);
      const { data, error } = await supabase.from("holidays").select("date, name").gte("date", from).lte("date", to).order("date");
      if (error) throw new Error(error.message);
      return { result: data };
    }
    case "check_dates":
      return { result: await checkDates(ctx, input) };
    case "prepare_request": {
      const check = await checkDates(ctx, input);
      if (!check.ok) return { result: { prepared: false, problems: check.problems } };
      const draft: Draft = {
        type: check.type,
        start: check.start,
        end: check.end,
        comment: String(input.comment ?? "").slice(0, 500),
        days: check.days_charged,
        available: check.available_in_start_month,
        colleagues: check.department_colleagues_absent,
      };
      return { result: { prepared: true, note: "Чернетку показано користувачу з кнопкою «Заповнити форму»; надішле він сам." }, draft };
    }
    default:
      throw new Error(`Невідомий інструмент ${name}`);
  }
}

// ---------- Системний промпт ----------

function systemPrompt(employee: CurrentEmployee, today: string) {
  return `Ти — асистент з відпусток і лікарняних у системі EQLab. Допомагаєш користувачу: ${employee.full_name}, ${ROLE_LABEL[employee.role].toLowerCase()}, ${employee.position}, відділ «${employee.department}».
Сьогодні ${formatDate(today)} (${today}), часовий пояс — Київ.

Правила компанії:
- Щорічна відпустка — 24 календарні дні на рік: по 2 дні нараховуються 1-го числа кожного місяця, з січня або з місяця прийому. Залишок на наступний рік не переноситься. Доступно на дату = накопичено на місяць початку відпустки − погоджені − на розгляді.
- Державні свята не входять у тривалість щорічної відпустки. Під час воєнного стану свята не є вихідними, але в цій системі діє загальне правило.
- Щорічну й «без збереження» можна почати сьогодні або пізніше; лікарняний — і на минулі дати. Дати мають бути в межах одного календарного року; заявки однієї людини не перетинаються.
- Щорічну й «без збереження» погоджує адміністратор (HR); лікарняний реєструється одразу.

Як працювати:
- Цифри й дати бери лише з інструментів, нічого не вигадуй. Ти бачиш лише те, що користувач і так бачить у системі; чужих балансів і заявок у тебе немає — так і скажи.
- Підбираючи дати, перевір кожен варіант через check_dates і пропонуй лише варіанти без перешкод: 1–3 варіанти з кількістю днів, що спишуться, і хто з відділу тоді відсутній. Свята поруч дають більше вільних днів — це варто підказати.
- Коли користувач погоджується на конкретні дати, виклич prepare_request: з'явиться кнопка «Заповнити форму». Сам ти заявки не подаєш, не погоджуєш і не скасовуєш; якщо просять — поясни, що це робить людина в інтерфейсі.
- Відповідай українською, коротко: до 6 речень або короткий список. Дати — у форматі дд.мм.рррр. Без Markdown-заголовків, таблиць і жирного шрифту.
- На питання не про відпустки, лікарняні й відсутності ввічливо відмов.`;
}

// ---------- Цикл ----------

export async function runAssistant(history: ChatMessage[], employee: CurrentEmployee): Promise<{ reply: string; draft: Draft | null }> {
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const ctx: Ctx = { supabase: await createClient(), employee, today: kyivToday() };
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.text }));
  let draft: Draft | null = null;

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt(employee, ctx.today),
      tools: TOOLS,
      output_config: { effort: "low" },
      messages,
    });

    if (response.stop_reason === "refusal") return { reply: "Не можу допомогти з цим запитом.", draft };
    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text || "Не вдалося сформулювати відповідь — спробуйте перепитати.", draft };
    }

    // Повертаємо відповідь повністю (разом із блоками мислення), потім результати всіх інструментів одним повідомленням.
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const out = await runTool(block.name, block.input as Record<string, unknown>, ctx);
        if (out.draft) draft = out.draft;
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out.result) });
      } catch (error) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: (error as Error).message, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return { reply: "Не встиг відповісти — спробуйте сформулювати питання коротше.", draft };
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function fmt(ts: string | null) {
  if (!ts) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ts));
}

function chicagoParts(ts: string) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ts)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function chicagoWallClockToUtc(year: number, month: number, day: number, hour: number, minute: number) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const guessParts = chicagoParts(new Date(guess).toISOString());
  const displayedAsUtc = Date.UTC(
    Number(guessParts.year), Number(guessParts.month) - 1, Number(guessParts.day),
    Number(guessParts.hour), Number(guessParts.minute), Number(guessParts.second),
  );
  return new Date(guess - (displayedAsUtc - guess));
}

function icsUtc(value: string | Date) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(value: unknown) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function calendarInvite(row: {
  id: string;
  confirmed_start: string;
  confirmed_end: string;
  math_class: string | null;
  topic: string | null;
  assigned_tutor: string | null;
}) {
  const local = chicagoParts(row.confirmed_start);
  const eventDayUtc = new Date(Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day)));
  eventDayUtc.setUTCDate(eventDayUtc.getUTCDate() - 1);
  const alert = chicagoWallClockToUtc(
    eventDayUtc.getUTCFullYear(), eventDayUtc.getUTCMonth() + 1, eventDayUtc.getUTCDate(), 17, 0,
  );
  const details = [row.math_class || "Math tutoring", row.topic, row.assigned_tutor ? `Tutor: ${row.assigned_tutor}` : null]
    .filter(Boolean).join(" — ");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BVSW Math NHS//Tutoring//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:tutoring-${icsEscape(row.id)}@bvsw-math-nhs`,
    `DTSTAMP:${icsUtc(new Date())}`,
    `DTSTART:${icsUtc(row.confirmed_start)}`,
    `DTEND:${icsUtc(row.confirmed_end)}`,
    "SUMMARY:BVSW Math NHS Tutoring",
    `DESCRIPTION:${icsEscape(details)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tutoring is tomorrow",
    `TRIGGER;VALUE=DATE-TIME:${icsUtc(alert)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

async function sendBrevo(
  apiKey: string,
  senderEmail: string,
  senderName: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachment?: { content: string; name: string },
) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      ...(attachment ? { attachment: [attachment] } : {}),
    }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Brevo ${response.status}: ${body}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: jsonHeaders });
    }

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: jsonHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    const { data: officer, error: officerErr } = await userClient
      .from("officers")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (officerErr || !officer) {
      return new Response(JSON.stringify({ error: "Officer access required" }), { status: 403, headers: jsonHeaders });
    }

    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id required" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: row, error } = await admin
      .from("tutoring_requests")
      .select("id,name,email,grade,math_class,topic,status,confirmed_start,confirmed_end,assigned_tutor,confirmation_sent_at")
      .eq("id", request_id)
      .single();
    if (error || !row) {
      return new Response(JSON.stringify({ error: error?.message || "Request not found" }), { status: 404, headers: jsonHeaders });
    }
    if (row.status !== "confirmed" || !row.confirmed_start || !row.confirmed_end) {
      return new Response(JSON.stringify({ error: "Request is not fully confirmed" }), { status: 409, headers: jsonHeaders });
    }
    if (row.confirmation_sent_at) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_sent" }), { headers: jsonHeaders });
    }

    const apiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
    const officerEmail = Deno.env.get("TUTORING_NOTIFICATION_EMAIL");
    const senderName = Deno.env.get("BREVO_SENDER_NAME") || "BVSW Math NHS";
    const missing = [
      !apiKey && "BREVO_API_KEY",
      !senderEmail && "BREVO_SENDER_EMAIL",
      !officerEmail && "TUTORING_NOTIFICATION_EMAIL",
    ].filter(Boolean);
    if (missing.length) {
      return new Response(JSON.stringify({ error: `Missing function secret(s): ${missing.join(", ")}` }), { status: 500, headers: jsonHeaders });
    }

    const when = fmt(row.confirmed_start);
    const invite = calendarInvite(row);
    const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") || "https://bvsw-math-nhs.alibkhan127.chatgpt.site").replace(/\/$/, "");
    const reminderUrl = new URL(`${publicSiteUrl}/reminder.html`);
    reminderUrl.searchParams.set("start", row.confirmed_start);
    reminderUrl.searchParams.set("end", row.confirmed_end);
    reminderUrl.searchParams.set("class", row.math_class || "Math tutoring");
    if (row.topic) reminderUrl.searchParams.set("topic", row.topic);
    if (row.assigned_tutor) reminderUrl.searchParams.set("tutor", row.assigned_tutor);
    const studentSubject = "BVSW Math NHS tutoring confirmed";
    const studentText = `Hi ${row.name},\n\nYour BVSW Math NHS tutoring session is confirmed for ${when}.\n${row.math_class || "Math tutoring"}${row.topic ? ` — ${row.topic}` : ""}\n${row.assigned_tutor ? `Tutor: ${row.assigned_tutor}\n` : ""}\nAdd a phone reminder: ${reminderUrl.toString()}\n\nThe attached calendar event also includes a 5:00 PM reminder for the day before.`;
    const studentHtml = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937"><h2>BVSW Math NHS Tutoring</h2><p>Hi ${esc(row.name)},</p><p>Your tutoring session is <strong>confirmed</strong>.</p><p><strong>When:</strong> ${esc(when)}<br><strong>Class:</strong> ${esc(row.math_class || "Math tutoring")}${row.topic ? `<br><strong>Topic:</strong> ${esc(row.topic)}` : ""}${row.assigned_tutor ? `<br><strong>Tutor:</strong> ${esc(row.assigned_tutor)}` : ""}</p><p><a href="${esc(reminderUrl.toString())}" style="display:inline-block;background:#0b5132;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;">Add phone reminder</a></p><p>On iPhone, choose Reminders from the share sheet. On Android, choose your preferred task or reminder app. The attached calendar event also includes an automatic <strong>5:00 PM reminder the day before</strong>.</p></body></html>`;
    await sendBrevo(apiKey!, senderEmail!, senderName, row.email, studentSubject, studentHtml, studentText, {
      content: base64Utf8(invite),
      name: "bvsw-math-nhs-tutoring.ics",
    });

    const officerSubject = `Tutoring confirmed: ${row.name} — ${row.math_class || "Math"}`;
    const officerText = `Confirmed tutoring session\nStudent: ${row.name}\nEmail: ${row.email}\nGrade: ${row.grade || ""}\nClass: ${row.math_class || ""}\nTopic: ${row.topic || ""}\nWhen: ${when}\nTutor: ${row.assigned_tutor || "Unassigned"}`;
    const officerHtml = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937"><h2>Confirmed tutoring session</h2><p><strong>Student:</strong> ${esc(row.name)}<br><strong>Email:</strong> ${esc(row.email)}<br><strong>Grade:</strong> ${esc(row.grade || "")}<br><strong>Class:</strong> ${esc(row.math_class || "")}<br><strong>Topic:</strong> ${esc(row.topic || "")}<br><strong>When:</strong> ${esc(when)}<br><strong>Tutor:</strong> ${esc(row.assigned_tutor || "Unassigned")}</p></body></html>`;
    await sendBrevo(apiKey!, senderEmail!, senderName, officerEmail!, officerSubject, officerHtml, officerText);

    const { error: updateError } = await admin
      .from("tutoring_requests")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) throw updateError;
    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});

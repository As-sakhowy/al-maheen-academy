const { createClient } = require("@supabase/supabase-js");

const TABLES = {
  students: {
    table: "students",
    select:
      "id,first_name,last_name,country,status,created_at,guardian_id,guardians(full_name,email,phone)",
  },
  guardians: {
    table: "guardians",
    select: "id,full_name,email,phone,country,created_at",
  },
  trials: {
    table: "free_trials",
    select:
      "id,trial_reference,student_id,guardian_id,student_timezone,academy_timezone,preferred_local_datetime,duration_minutes,status,admin_notes,reviewed_at,created_at,updated_at,guardian_relationship,student_level,notes,consent,consent_at,students(first_name,last_name,age_group,country,timezone,status),guardians(full_name,email,phone,whatsapp_phone,country),free_trial_courses!free_trial_courses_free_trial_id_fkey(course_id,courses!free_trial_courses_course_id_fkey(name))",
  },
  registrations: {
    table: "registration_requests",
    select:
      "*,students(first_name,last_name,age_group,country,timezone,status),guardians(full_name,email,phone,whatsapp_phone,country),registration_request_courses(course_id,courses(name))",
  },
  classes: {
    table: "recurring_classes",
    select:
      "id,class_name,course_id,weekday,local_start_time,schedule_timezone,duration_minutes,starts_on,ends_on,status,courses(name)",
  },
  teachers: {
    table: "teachers",
    select:
      "id,full_name,email,phone,country,timezone,status,qualifications,created_at",
  },
  payments: {
    table: "payments",
    select:
      "id,invoice_id,amount,currency,payment_method,transaction_reference,status,paid_at,created_at,invoices(invoice_number)",
  },
  invoices: { table: "invoice_balances", select: "*" },
  courses: {
    table: "courses",
    select: "id,name,description,is_active,created_at",
  },
  enrollments: { table: "student_enrollment_overview", select: "*" },
};

function response(res, status, body) {
  return res.status(status).json(body);
}

function partsAt(date, zone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function offsetAt(date, zone) {
  const part = partsAt(date, zone);
  return Date.UTC(
    part.year,
    part.month - 1,
    part.day,
    part.hour,
    part.minute,
    part.second,
  ) - date.getTime();
}

function resolveLocalTime(dateText, timeText, zone) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateText) ||
    !/^\d{2}:\d{2}$/.test(timeText)
  ) {
    throw new Error("Enter a valid date and time.");
  }

  const [year, month, day] = dateText.split("-").map(Number);
  const [hour, minute] = timeText.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const check = new Date(naive);

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new Error("The selected date or time is invalid.");
  }

  const offsets = new Set();
  for (let delta = -36; delta <= 36; delta += 6) {
    offsets.add(offsetAt(new Date(naive + delta * 3600000), zone));
  }

  const matches = [];
  for (const offset of offsets) {
    const candidate = new Date(naive - offset);
    const part = partsAt(candidate, zone);
    if (
      part.year === year && part.month === month && part.day === day &&
      part.hour === hour && part.minute === minute
    ) {
      matches.push(candidate);
    }
  }

  const unique = [...new Map(matches.map((value) => [value.getTime(), value])).values()];
  if (!unique.length) {
    throw new Error("This local time does not exist because of a daylight-saving change. Choose another time.");
  }
  if (unique.length > 1) {
    throw new Error("This local time occurs twice because of a daylight-saving change. Choose another time.");
  }
  return unique[0];
}


function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function formatTrialTime(value, zone) {
  if (!value) return "To be arranged";
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: zone || "Africa/Lagos",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toISOString();
  }
}

async function sendTrialNotification(db, trial, eventType) {
  // Temporary environment diagnostic. Keep commented unless troubleshooting:
  // console.log("RESEND DIAGNOSTIC:", {
  //   apiKeyLoaded: Boolean(process.env.RESEND_API_KEY),
  //   senderLoaded: Boolean(process.env.EMAIL_FROM),
  // });
  const guardian = trial.guardians || {};
  const recipient = String(guardian.email || "").trim();
  const student = trial.students || {};
  const studentName = [student.first_name, student.last_name].filter(Boolean).join(" ") || "your learner";
  const reference = trial.trial_reference || "Not available";
  const studentZone = trial.student_timezone || student.timezone || "Africa/Lagos";
  const academyZone = trial.academy_timezone || "Africa/Lagos";
  const studentTime = formatTrialTime(trial.preferred_local_datetime, studentZone);
  const academyTime = formatTrialTime(trial.preferred_local_datetime, academyZone);
  const courses = (trial.free_trial_courses || [])
    .map((item) => item.courses?.name)
    .filter(Boolean);
  const courseText = courses.length ? courses.join(", ") : "Your selected programme";
  const messages = {
    approved: {
      subject: "Your free trial request has been accepted | Al-Maheen Academy",
      heading: "Your free trial request has been accepted",
      intro: `We are pleased to let you know that the free trial request for ${studentName} has been accepted. The requested time is shown below. Please contact us to finalise the arrangement.`,
    },
    rejected: {
      subject: "Update on your free trial request | Al-Maheen Academy",
      heading: "An update on your free trial request",
      intro: `Thank you for considering Al-Maheen Academy. After reviewing the request for ${studentName}, we are unable to proceed with this free trial request at this time. Please contact us if you would like to discuss other possibilities.`,
    },
    rescheduled: {
      subject: "A new suggested time for your free trial | Al-Maheen Academy",
      heading: "A new time has been suggested",
      intro: `We would like to suggest a different time for ${studentName}'s free trial. Please reply to confirm whether the proposed time works for you. The trial is not booked until the arrangement is confirmed.`,
    },
    booked: {
      subject: "Your free trial is confirmed | Al-Maheen Academy",
      heading: "Your free trial is confirmed",
      intro: `Your free trial for ${studentName} has been marked as confirmed by Al-Maheen Academy. We look forward to welcoming you.`,
    },
  };
  const message = messages[eventType];
  if (!message) return { status: "skipped", sent: false, reason: "No email is required for this update." };

  let status = "skipped";
  let providerMessageId = null;
  let errorMessage = null;
  if (!recipient) {
    errorMessage = "No parent or guardian email address is saved for this trial.";
  } else if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    errorMessage = "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in the server environment.";
  } else {
    const detailsRows = [
      ["Student", studentName],
      ["Trial reference", reference],
      ["Programme", courseText],
      ["Student local time", studentTime],
      ["Academy time (Africa/Lagos)", academyTime],
      ["Duration", `${trial.duration_minutes || "—"} minutes`],
    ];
    const details = detailsRows.map(([label, value]) => `
      <tr>
        <td style="padding:11px 12px;border-bottom:1px solid #e8ece8;color:#64736b;font-size:13px;width:38%;vertical-align:top">${escapeHtml(label)}</td>
        <td style="padding:11px 12px;border-bottom:1px solid #e8ece8;color:#20352b;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(value)}</td>
      </tr>`).join("");
    const nextStep = {
      approved: "Please reply to this email or contact us on WhatsApp so we can finalise the trial arrangement. Your trial is not confirmed until the time has been agreed.",
      rejected: "If you would like to discuss another suitable option, please reply to this email. We will be glad to hear from you.",
      rescheduled: "Please reply to let us know whether this suggested time works for your family. The trial is not booked until you and the Academy confirm the arrangement.",
      booked: "Your trial time has been confirmed. Please keep this email for your reference and contact us if you need any assistance before the session.",
    }[eventType];
    const websiteUrl = "https://al-maheen-academy.vercel.app/";
    const logoUrl = "https://al-maheen-academy.vercel.app/assets/logo-tree.png";
    const html = `
      <!doctype html>
      <html lang="en">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f3f5f1;font-family:Arial,Helvetica,sans-serif;color:#26372f">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(message.heading)} | Al-Maheen Academy</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f5f1;padding:28px 12px">
          <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4e9e2;border-radius:12px;overflow:hidden">
              <tr><td style="height:6px;background:#c9a84c;font-size:0;line-height:0">&nbsp;</td></tr>
              <tr><td align="center" style="padding:26px 28px 20px;background:#ffffff">
                <img src="${logoUrl}" width="76" height="86" alt="Al-Maheen Academy tree logo" style="display:block;width:76px;height:auto;max-width:76px;border:0;margin:0 auto 10px">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.2;font-weight:bold;color:#0b3d2e">Al-Maheen Academy</div>
                <div style="margin-top:7px;font-size:10px;line-height:1.5;letter-spacing:2px;font-weight:bold;color:#9a7b2f">EMBARK ON A JOURNEY OF LEARNING.</div>
              </td></tr>
              <tr><td style="padding:0 28px"><div style="height:1px;background:#e8ece6"></div></td></tr>
              <tr><td style="padding:28px">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7">Assalamu Alaikum${guardian.full_name ? ` ${escapeHtml(guardian.full_name)}` : ""},</p>
                <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;color:#0b3d2e">${escapeHtml(message.heading)}</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.75;color:#4d5d53">${escapeHtml(message.intro)}</p>
                <div style="margin:0 0 22px;padding:16px 18px;background:#f7f8f4;border-left:4px solid #c9a84c;border-radius:6px">
                  <div style="margin:0 0 10px;font-size:11px;letter-spacing:1.2px;font-weight:bold;color:#8a702f;text-transform:uppercase">Your free trial details</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${details}</table>
                </div>
                <p style="margin:0 0 22px;font-size:14px;line-height:1.75;color:#4d5d53">${escapeHtml(nextStep)}</p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#4d5d53">Jazakumullahu Khairan,<br><strong style="color:#0b3d2e">Al-Maheen Academy</strong></p>
              </td></tr>
              <tr><td style="padding:18px 28px;background:#0b3d2e;text-align:center">
                <a href="${websiteUrl}" style="color:#f0d88f;font-size:13px;font-weight:bold;text-decoration:none">Visit Al-Maheen Academy</a>
                <div style="margin-top:9px;color:#d6e0d8;font-size:11px;line-height:1.6">Qur’an · Arabic · Islamic Studies</div>
                <div style="margin-top:5px;color:#b9c9be;font-size:10px">This email concerns your free trial request with Al-Maheen Academy.</div>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>`;
    const textBody = [
      "AL-MAHEEN ACADEMY",
      "EMBARK ON A JOURNEY OF LEARNING.",
      "",
      `Assalamu Alaikum${guardian.full_name ? ` ${guardian.full_name}` : ""},`,
      "",
      message.heading,
      message.intro,
      "",
      "YOUR FREE TRIAL DETAILS",
      ...detailsRows.map(([label, value]) => `${label}: ${value}`),
      "",
      nextStep,
      "",
      "Jazakumullahu Khairan,",
      "Al-Maheen Academy",
      websiteUrl,
    ].join("\n");
    try {
      const providerResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [recipient],
          subject: message.subject,
          html,
          text: textBody,
        }),
      });
      const payload = await providerResponse.json().catch(() => ({}));
      if (!providerResponse.ok) {
        status = "failed";
        errorMessage = `Email provider returned HTTP ${providerResponse.status}.`;
        console.error("Trial email provider error:", providerResponse.status, payload.message || payload.name || "Unknown error");
      } else {
        status = "sent";
        providerMessageId = payload.id || null;
      }
    } catch (error) {
      status = "failed";
      errorMessage = "The email provider could not be reached.";
      console.error("Trial email request failed:", error.message || error);
    }
  }

  try {
    const { error: logError } = await db.from("notification_logs").insert({
      free_trial_id: trial.id,
      recipient: recipient || null,
      channel: "email",
      event_type: eventType,
      subject: message.subject,
      status,
      provider: "resend",
      provider_message_id: providerMessageId,
      error_message: errorMessage,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    });
    if (logError) console.error("Could not write notification log:", logError.message);
  } catch (error) {
    console.error("Could not write notification log:", error.message || error);
  }

  return {
    sent: status === "sent",
    status,
    reason: errorMessage,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Authorization");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return response(res, 405, { error: "Method not allowed." });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return response(res, 503, {
      error:
        "Admin API is not configured. Add the Supabase server environment variables in Vercel.",
    });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return response(res, 401, { error: "Please sign in again." });

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);
    if (authError || !authData.user)
      return response(res, 401, {
        error: "Your session is invalid or expired. Please sign in again.",
      });
    const { data: admin, error: adminError } = await db
      .from("admin_users")
      .select("user_id,full_name")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (adminError || !admin)
      return response(res, 403, {
        error: "This account is not authorised as an Academy administrator.",
      });

    const input =
      req.method === "POST"
        ? typeof req.body === "string"
          ? JSON.parse(req.body)
          : req.body || {}
        : req.query;
    const action = String(input.action || "overview");

    if (req.method === "GET" && action === "overview") {
      const counts = await Promise.all([
        db.from("students").select("id", { count: "exact", head: true }),
        db
          .from("free_trials")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        db
          .from("recurring_classes")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        db
          .from("teachers")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        db
          .from("invoice_balances")
          .select(
            "invoice_id,total_amount,amount_paid,outstanding_balance,currency,status",
          )
          .limit(500),
      ]);
      const failed = counts.find((x) => x.error);
      if (failed) throw failed.error;
      const invoices = counts[4].data || [];
      const outstanding = invoices.reduce(
        (sum, row) => sum + Number(row.outstanding_balance || 0),
        0,
      );
      const paid = invoices.reduce(
        (sum, row) => sum + Number(row.amount_paid || 0),
        0,
      );
      const { data: recentTrials, error: trialError } = await db
        .from("free_trials")
        .select(TABLES.trials.select)
        .order("created_at", { ascending: false })
        .limit(6);
      if (trialError) throw trialError;
      return response(res, 200, {
        admin: admin.full_name,
        stats: {
          students: counts[0].count || 0,
          pendingTrials: counts[1].count || 0,
          activeClasses: counts[2].count || 0,
          activeTeachers: counts[3].count || 0,
          collected: paid,
          outstanding,
          currency: "USD",
        },
        recentTrials: recentTrials || [],
      });
    }

    if (req.method === "GET" && action === "list") {
      const key = String(input.resource || "students");
      const config = TABLES[key];
      if (!config)
        return response(res, 400, { error: "Unknown dashboard section." });
      const limit = Math.min(Math.max(Number(input.limit) || 100, 1), 250);
      let query = db
        .from(config.table)
        .select(config.select)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (key === "invoices" || key === "enrollments")
        query = db.from(config.table).select(config.select).limit(limit);
      if (
        input.search &&
        ["students", "guardians", "teachers", "courses"].includes(key)
      ) {
        const term = String(input.search)
          .replace(/[,%()]/g, " ")
          .trim()
          .slice(0, 80);
        if (term) {
          const field =
            key === "students"
              ? "first_name"
              : key === "courses"
                ? "name"
                : "full_name";
          query = query.ilike(field, `%${term}%`);
        }
      }
      if (
        input.status &&
        ["trials", "students", "teachers", "classes", "payments"].includes(key)
      )
        query = query.eq("status", String(input.status));
      const { data, error } = await query;
      if (error) throw error;
      return response(res, 200, { data: data || [] });
    }

    if (req.method === "POST" && action === "update_trial") {
      const { id, status, admin_notes } = input;
      const allowedStatuses = ["approved", "rejected", "booked", "completed", "cancelled"];
      const hasStatus = status !== undefined && status !== null && status !== "";
      const hasNotes = Object.prototype.hasOwnProperty.call(input, "admin_notes");

      if (!id || (!hasStatus && !hasNotes)) {
        return response(res, 400, { error: "A trial ID and an update are required." });
      }
      if (hasStatus && !allowedStatuses.includes(status)) {
        return response(res, 400, { error: "Choose a valid trial status." });
      }

      const { data: previous, error: previousError } = await db
        .from("free_trials")
        .select("id,status")
        .eq("id", id)
        .maybeSingle();
      if (previousError) throw previousError;
      if (!previous) return response(res, 404, { error: "Trial record not found." });

      const update = { updated_at: new Date().toISOString() };
      if (hasStatus) {
        update.status = status;
        update.reviewed_at = new Date().toISOString();
      }
      if (hasNotes) update.admin_notes = String(admin_notes || "").slice(0, 1500) || null;

      const { data, error } = await db
        .from("free_trials")
        .update(update)
        .eq("id", id)
        .select(TABLES.trials.select)
        .single();
      if (error) throw error;

      let notification = null;
      if (hasStatus && previous.status !== status && ["approved", "rejected", "booked"].includes(status)) {
        notification = await sendTrialNotification(db, data, status);
      }
      return response(res, 200, { success: true, data, notification });
    }

    if (req.method === "POST" && action === "reschedule_trial") {
      const { id, date, time, admin_notes } = input;
      if (!id || !date || !time) {
        return response(res, 400, { error: "Choose a new trial date and time." });
      }

      const { data: existing, error: lookupError } = await db
        .from("free_trials")
        .select("id,student_timezone,preferred_local_datetime")
        .eq("id", id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) return response(res, 404, { error: "Trial record not found." });

      const zone = existing.student_timezone || "Africa/Lagos";
      let proposedInstant;
      try {
        proposedInstant = resolveLocalTime(String(date), String(time), zone);
      } catch (error) {
        return response(res, 400, { error: error.message });
      }
      if (proposedInstant.getTime() <= Date.now()) {
        return response(res, 400, { error: "Choose a future date and time." });
      }

      const update = {
        preferred_local_datetime: proposedInstant.toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (Object.prototype.hasOwnProperty.call(input, "admin_notes")) {
        update.admin_notes = String(admin_notes || "").slice(0, 1500) || null;
      }

      const { data, error } = await db
        .from("free_trials")
        .update(update)
        .eq("id", id)
        .select(TABLES.trials.select)
        .single();
      if (error) throw error;

      const changed = new Date(existing.preferred_local_datetime).getTime() !== proposedInstant.getTime();
      const notification = changed
        ? await sendTrialNotification(db, data, "rescheduled")
        : { sent: false, status: "skipped", reason: "The suggested time was unchanged." };
      return response(res, 200, { success: true, data, notification });
    }

    if (req.method === "POST" && action === "create_student") {
      const guardian = input.guardian || {};
      const student = input.student || {};
      if (!guardian.full_name || !student.first_name || !student.last_name)
        return response(res, 400, {
          error: "Guardian name and student first and last names are required.",
        });
      const { data: g, error: ge } = await db
        .from("guardians")
        .insert({
          full_name: String(guardian.full_name).slice(0, 140),
          email: String(guardian.email || "").slice(0, 160) || null,
          phone: String(guardian.phone || "").slice(0, 40) || null,
          country: String(guardian.country || "").slice(0, 80) || null,
        })
        .select("id")
        .single();
      if (ge) throw ge;
      const { data: s, error: se } = await db
        .from("students")
        .insert({
          guardian_id: g.id,
          first_name: String(student.first_name).slice(0, 70),
          last_name: String(student.last_name).slice(0, 70),
          age_group: String(student.age_group || "").slice(0, 40) || null,
          country:
            String(student.country || guardian.country || "").slice(0, 80) ||
            null,
          timezone: String(student.timezone || "").slice(0, 80) || null,
          status: "active",
        })
        .select("*")
        .single();
      if (se) throw se;
      return response(res, 201, { success: true, data: s });
    }

    if (req.method === "POST" && action === "create_teacher") {
      const t = input.teacher || {};
      if (!t.full_name)
        return response(res, 400, { error: "Teacher name is required." });
      const { data, error } = await db
        .from("teachers")
        .insert({
          full_name: String(t.full_name).slice(0, 140),
          email: String(t.email || "").slice(0, 160) || null,
          phone: String(t.phone || "").slice(0, 40) || null,
          country: String(t.country || "").slice(0, 80) || null,
          timezone: String(t.timezone || "").slice(0, 80) || null,
          qualifications: String(t.qualifications || "").slice(0, 1000) || null,
          status: "active",
        })
        .select("*")
        .single();
      if (error) throw error;
      return response(res, 201, { success: true, data });
    }

    if (req.method === "POST" && action === "update_teacher") {
  const t = input.teacher || {};

  if (!t.id) {
    return response(res, 400, { error: "Teacher ID is required." });
  }

  if (!t.full_name) {
    return response(res, 400, { error: "Teacher name is required." });
  }

  const { data, error } = await db
    .from("teachers")
    .update({
      full_name: String(t.full_name).slice(0, 140),
      email: String(t.email || "").slice(0, 160) || null,
      phone: String(t.phone || "").slice(0, 40) || null,
      country: String(t.country || "").slice(0, 80) || null,
      timezone: String(t.timezone || "").slice(0, 80) || null,
      qualifications: String(t.qualifications || "").slice(0, 1000) || null,
    })
    .eq("id", t.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return response(res, 404, { error: "Teacher not found." });
  }

  return response(res, 200, { success: true, data });
}

    if (req.method === "POST" && action === "create_course") {
      const c = input.course || {};

      const name = String(c.name || "").trim();
      const description = String(c.description || "").trim();

      if (!name) {
        return response(res, 400, { error: "Course name is required." });
      }

      if (name.length > 140) {
        return response(res, 400, { error: "Course name is too long." });
      }

      if (description.length > 1000) {
        return response(res, 400, { error: "Course description is too long." });
      }

      const { data, error } = await db
        .from("courses")
        .insert({
          name,
          description: description || null,
          is_active: true,
        })
        .select("*")
        .single();

      if (error) throw error;

      return response(res, 201, { success: true, data });
    }

    if (req.method === "POST" && action === "update_course") {
      const c = input.course || {};

      const id = String(c.id || "").trim();
      const name = String(c.name || "").trim();
      const description = String(c.description || "").trim();

      if (!id) {
        return response(res, 400, { error: "Course ID is required." });
      }

      if (!name) {
        return response(res, 400, { error: "Course name is required." });
      }

      if (name.length > 140) {
        return response(res, 400, { error: "Course name is too long." });
      }

      if (description.length > 1000) {
        return response(res, 400, { error: "Course description is too long." });
      }

      const { data, error } = await db
        .from("courses")
        .update({
          name,
          description: description || null,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      return response(res, 200, { success: true, data });
    }

    if (req.method === "POST" && action === "update_status") {
      const allowed = {
        students: ["active", "inactive", "completed"],
        teachers: ["active", "inactive"],
        courses: ["active", "inactive"],
        classes: ["active", "paused", "completed", "cancelled"],
        payments: ["pending", "successful", "failed", "refunded"],
        invoices: [
          "draft",
          "issued",
          "partially_paid",
          "paid",
          "overdue",
          "cancelled",
        ],
      };
      const resource = String(input.resource || "");
      if (
        !allowed[resource] ||
        !input.id ||
        !allowed[resource].includes(input.status)
      )
        return response(res, 400, { error: "Invalid status update." });
      const table = resource === "classes" ? "recurring_classes" : resource;

      const update =
        resource === "courses"
          ? { is_active: input.status === "active" }
          : { status: input.status };

      const selectedColumns =
        resource === "courses" ? "id,is_active" : "id,status";

      const { data, error } = await db
        .from(table)
        .update(update)
        .eq("id", input.id)
        .select(selectedColumns)
        .single();
      if (error) throw error;
      return response(res, 200, { success: true, data });
    }

    return response(res, 400, { error: "Unsupported dashboard action." });
  } catch (error) {
    console.error("Admin API error:", error.message || error);
    return response(res, 500, {
      error:
        "The dashboard could not complete that request. Check the database setup and try again.",
    });
  }
};

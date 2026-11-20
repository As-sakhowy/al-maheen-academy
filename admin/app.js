(() => {
  const client = window.amaSupabase;
  if (!client) {
    window.location.href = "login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);
  let session = null,
    currentResource = "students",
    currentView = "overview";
  const labels = {
    students: ["Students", "Manage student profiles and guardian details."],
    trials: [
      "Free trial requests",
      "Review applications, contact families and manage trial schedules.",
    ],
    registrations: [
      "Registration requests",
      "Review each learner's registration details and selected programmes.",
    ],
    classes: ["Recurring classes", "Review weekly lesson schedules."],
    teachers: ["Teachers", "Manage Academy teacher records."],
    payments: ["Payments", "Review recorded transactions and their statuses."],
    invoices: ["Invoices", "Review billed amounts and outstanding balances."],
    courses: ["Courses", "View the Academy programmes."],
    enrollments: [
      "Enrolments",
      "See which students are enrolled in each course.",
    ],
  };
  const columns = {
    students: [
      ["Student", (r) => `${r.first_name || ""} ${r.last_name || ""}`],
      ["Guardian", (r) => r.guardians?.full_name || "—"],
      ["Country", (r) => r.country || "—"],
      ["Status", (r) => statusSelect("students", r)],
      ["Created", (r) => date(r.created_at)],
    ],
    trials: [
      ["Reference", (r) => r.trial_reference],
      [
        "Student",
        (r) => `${r.students?.first_name || ""} ${r.students?.last_name || ""}`,
      ],
      ["Guardian", (r) => r.guardians?.full_name || "—"],
      [
        "Courses",
        (r) =>
          (r.free_trial_courses || [])
            .map((item) => item.courses?.name)
            .filter(Boolean)
            .join(", ") || "—",
      ],
      ["Preferred time", (r) => date(r.preferred_local_datetime)],
      ["Duration", (r) => `${r.duration_minutes} min`],
      ["Status", (r) => statusPill(r.status)],
      ["Action", (r) => trialAction(r)],
    ],
    registrations: [
      ["Reference", (r) => r.registration_reference || r.registration_id || r.reference || r.id],
      ["Student", (r) => `${r.students?.first_name || r.student_first_name || ""} ${r.students?.last_name || r.student_last_name || ""}`.trim() || "—"],
      ["Guardian", (r) => r.guardians?.full_name || "—"],
      ["Courses", (r) => (r.registration_request_courses || []).map((item) => item.courses?.name).filter(Boolean).join(", ") || "—"],
      ["Monthly fee", (r) => money(r.monthly_fee ?? r.estimated_monthly_fee)],
      ["Status", (r) => statusPill(r.status)],
      ["Action", (r) => registrationAction(r)],
    ],
    classes: [
      ["Class", (r) => r.class_name],
      ["Course", (r) => r.courses?.name || "—"],
      [
        "Day",
        (r) =>
          [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ][r.weekday] || "—",
      ],
      [
        "Local time",
        (r) => `${r.local_start_time || ""} (${r.schedule_timezone || ""})`,
      ],
      ["Duration", (r) => `${r.duration_minutes} min`],
      ["Status", (r) => statusSelect("classes", r)],
    ],
    teachers: [
      ["Teacher", (r) => r.full_name],
      ["Email", (r) => r.email || "—"],
      ["Phone", (r) => r.phone || "—"],
      ["Country", (r) => r.country || "—"],
      ["Time zone", (r) => r.timezone || "—"],
      ["Qualifications", (r) => r.qualifications || "—"],
      ["Status", (r) => statusSelect("teachers", r)],
      ["Actions", (r) => teacherActions(r)],
    ],
    payments: [
      ["Invoice", (r) => r.invoices?.invoice_number || r.invoice_id],
      ["Amount", (r) => money(r.amount, r.currency)],
      ["Method", (r) => r.payment_method || "—"],
      ["Reference", (r) => r.transaction_reference || "—"],
      ["Paid at", (r) => date(r.paid_at)],
      ["Status", (r) => statusSelect("payments", r)],
    ],
    invoices: [
      ["Invoice", (r) => r.invoice_number],
      ["Total", (r) => money(r.total_amount, r.currency)],
      ["Paid", (r) => money(r.amount_paid, r.currency)],
      ["Outstanding", (r) => money(r.outstanding_balance, r.currency)],
      ["Due date", (r) => date(r.due_date)],
      ["Status", (r) => statusSelect("students", r)],
    ],
    courses: [
      ["Course", (r) => r.name],
      ["Description", (r) => r.description || "—"],
      ["Actions", (r) => courseActions(r)],
    ],
    enrollments: [
      ["Student", (r) => `${r.first_name || ""} ${r.last_name || ""}`],
      ["Course", (r) => r.course_name || "—"],
      ["Guardian", (r) => r.guardian_name || "—"],
      ["Status", (r) => r.enrollment_status || "—"],
      ["Start date", (r) => date(r.start_date)],
    ],
  };
  function date(value) {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  function localDateTimeInputs(value, zone) {
    if (!value) return { date: "", time: "" };
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone || "Africa/Lagos",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(new Date(value));
      const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
      return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}`,
      };
    } catch {
      return { date: "", time: "" };
    }
  }

  function statusPill(status) {
    return `<span class="status-pill">${esc(status || "pending")}</span>`;
  }

  function trialAction(row) {
    return `<button class="small-action" type="button" data-trial-details="${esc(row.id)}" aria-label="View trial details" title="View trial details">⋮</button>`;
  }

  function registrationAction(row) {
    return `<button class="small-action" type="button" data-registration-details="${esc(row.id)}" aria-label="View registration details" title="View registration details">⋮</button>`;
  }

  function contactLinks(guardian) {
    const email = guardian.email || "";
    const phone = guardian.phone || "";
    const whatsapp = guardian.whatsapp_phone || phone;
    return `
      <p><strong>Email:</strong> ${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "—"}</p>
      <p><strong>Phone:</strong> ${phone ? `<a href="tel:${esc(phone)}">${esc(phone)}</a>` : "—"}</p>
      <p><strong>WhatsApp:</strong> ${whatsapp ? `<a href="https://wa.me/${encodeURIComponent(whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>` : "—"}</p>
    `;
  }

  function renderTrialDetails(trial) {
    const student = trial.students || {};
    const guardian = trial.guardians || {};
    const courses = (trial.free_trial_courses || []).map((item) => item.courses?.name).filter(Boolean);
    const zone = trial.student_timezone || student.timezone || "Africa/Lagos";
    const local = localDateTimeInputs(trial.preferred_local_datetime, zone);
    const academyLocal = localDateTimeInputs(trial.preferred_local_datetime, trial.academy_timezone || "Africa/Lagos");

    return `
      <div class="record-details-grid">
        <section class="details-section"><h3>Trial information</h3>
          <p><strong>Reference:</strong> ${esc(trial.trial_reference || "—")}</p>
          <p><strong>Status:</strong> ${statusPill(trial.status)}</p>
          <p><strong>Submitted:</strong> ${esc(date(trial.created_at))}</p>
          <p><strong>Duration:</strong> ${esc(trial.duration_minutes)} minutes</p>
        </section>
        <section class="details-section"><h3>Student</h3>
          <p><strong>Name:</strong> ${esc(`${student.first_name || ""} ${student.last_name || ""}`.trim() || "—")}</p>
          <p><strong>Age group:</strong> ${esc(student.age_group || "—")}</p>
          <p><strong>Country:</strong> ${esc(student.country || "—")}</p>
          <p><strong>Level:</strong> ${esc(trial.student_level || "—")}</p>
          <p><strong>Timezone:</strong> ${esc(zone)}</p>
        </section>
        <section class="details-section"><h3>Parent / guardian</h3>
          <p><strong>Name:</strong> ${esc(guardian.full_name || "—")}</p>
          <p><strong>Relationship:</strong> ${esc(trial.guardian_relationship || "—")}</p>
          ${contactLinks(guardian)}
          <p><strong>Country:</strong> ${esc(guardian.country || "—")}</p>
        </section>
        <section class="details-section"><h3>Selected courses</h3>
          ${courses.length ? `<ul>${courses.map((course) => `<li>${esc(course)}</li>`).join("")}</ul>` : "—"}
        </section>
        <section class="details-section"><h3>Preferred schedule</h3>
          <p><strong>Student local time:</strong> ${esc(local.date && local.time ? `${local.date} ${local.time}` : date(trial.preferred_local_datetime))}</p>
          <p><strong>Student timezone:</strong> ${esc(zone)}</p>
          <p><strong>Academy local time:</strong> ${esc(academyLocal.date && academyLocal.time ? `${academyLocal.date} ${academyLocal.time}` : "—")}</p>
          <p><strong>Academy timezone:</strong> ${esc(trial.academy_timezone || "Africa/Lagos")}</p>
        </section>
        <section class="details-section"><h3>Additional information</h3>
          <p><strong>Parent's notes:</strong> ${esc(trial.notes || "—")}</p>
          <p><strong>Consent:</strong> ${trial.consent ? "Provided" : "Not provided"}</p>
        </section>
      </div>
      <section class="details-section management-panel">
        <h3>Manage this free trial</h3>
        <label for="trialAdminNotes">Internal admin notes</label>
        <textarea id="trialAdminNotes" rows="3" maxlength="1500" placeholder="Record your conversation, decision or follow-up">${esc(trial.admin_notes || "")}</textarea>
        <div class="management-actions">
          <button type="button" class="primary-btn" data-trial-manage="approved" data-id="${esc(trial.id)}">Accept trial</button>
          <button type="button" class="danger-btn" data-trial-manage="rejected" data-id="${esc(trial.id)}">Reject trial</button>
          <button type="button" class="outline-btn" data-trial-manage="booked" data-id="${esc(trial.id)}">Mark as booked</button>
          <button type="button" class="outline-btn" data-trial-save-notes data-id="${esc(trial.id)}">Save notes</button>
        </div>
      </section>
      <section class="details-section reschedule-panel">
        <h3>Suggest a different date and time</h3>
        <p class="muted">The date and time are entered in the student's timezone. Rescheduling does not automatically confirm the booking.</p>
        <div class="reschedule-fields">
          <label for="trialNewDate">New date<input id="trialNewDate" type="date" value="${esc(local.date)}" required></label>
          <label for="trialNewTime">New time<input id="trialNewTime" type="time" value="${esc(local.time)}" required></label>
        </div>
        <p class="muted">Timezone: ${esc(zone)}</p>
        <button type="button" class="primary-btn" data-trial-reschedule data-id="${esc(trial.id)}">Save new suggested time</button>
      </section>
    `;
  }

  function renderRegistrationDetails(registration) {
    const student = registration.students || {};
    const guardianRecord = registration.guardians || {};
    const guardian = {
      ...guardianRecord,
      email: guardianRecord.email || registration.guardian_email,
      phone: guardianRecord.phone || registration.guardian_phone,
      whatsapp_phone: guardianRecord.whatsapp_phone || registration.guardian_phone,
    };
    const courses = (registration.registration_request_courses || []).map((item) => item.courses?.name).filter(Boolean);
    const reference = registration.registration_reference || registration.registration_id || registration.reference || registration.id;
    const studentName = `${student.first_name || registration.student_first_name || ""} ${student.last_name || registration.student_last_name || ""}`.trim() || "—";
    const days = Array.isArray(registration.preferred_days) ? registration.preferred_days.join(", ") : registration.preferred_days || "—";
    const times = Array.isArray(registration.preferred_times) ? registration.preferred_times.join(", ") : registration.preferred_times || "—";

    return `
      <div class="record-details-grid">
        <section class="details-section"><h3>Registration</h3>
          <p><strong>Reference:</strong> ${esc(reference)}</p>
          <p><strong>Status:</strong> ${statusPill(registration.status)}</p>
          <p><strong>Submitted:</strong> ${esc(date(registration.created_at))}</p>
          <p><strong>Registering for:</strong> ${esc(registration.learner_type || registration.registering_for || "—")}</p>
          <p><strong>Consent:</strong> ${registration.consent ? "Provided" : "Not provided"}</p>
        </section>
        <section class="details-section"><h3>Student</h3>
          <p><strong>Name:</strong> ${esc(studentName)}</p>
          <p><strong>Age group:</strong> ${esc(student.age_group || registration.age_group || "—")}</p>
          <p><strong>Country:</strong> ${esc(student.country || registration.country || "—")}</p>
          <p><strong>Timezone:</strong> ${esc(student.timezone || registration.student_timezone || "—")}</p>
          <p><strong>Current level:</strong> ${esc(registration.learning_level || registration.level || "—")}</p>
        </section>
        <section class="details-section"><h3>Parent / guardian</h3>
          <p><strong>Name:</strong> ${esc(guardian.full_name || [registration.guardian_first_name, registration.guardian_last_name].filter(Boolean).join(" ") || "—")}</p>
          ${contactLinks(guardian)}
          <p><strong>Country:</strong> ${esc(guardian.country || registration.country || "—")}</p>
        </section>
        <section class="details-section"><h3>Selected courses</h3>
          ${courses.length ? `<ul>${courses.map((course) => `<li>${esc(course)}</li>`).join("")}</ul>` : "—"}
        </section>
        <section class="details-section"><h3>Learning preferences</h3>
          <p><strong>Class format:</strong> ${esc(registration.class_format || "—")}</p>
          <p><strong>Preferred days:</strong> ${esc(days)}</p>
          <p><strong>Preferred times:</strong> ${esc(times)}</p>
          <p><strong>Preferred local schedule:</strong> ${esc([registration.preferred_schedule_date, registration.preferred_schedule_time].filter(Boolean).join(" ") || "—")}</p>
          <p><strong>Academy equivalent:</strong> ${esc(registration.academy_equivalent_local || "—")}</p>
        </section>
        <section class="details-section"><h3>Plan and pricing</h3>
          <p><strong>Session duration:</strong> ${esc(registration.session_duration || "—")} minutes</p>
          <p><strong>Lessons per week:</strong> ${esc(registration.lessons_per_week || "—")}</p>
          <p><strong>Estimated monthly fee:</strong> ${registration.monthly_fee == null ? "—" : esc(money(registration.monthly_fee))}</p>
        </section>
        <section class="details-section"><h3>Additional notes</h3>
          <p>${esc(registration.notes || "—")}</p>
        </section>
      </div>
    `;
  }

  function money(value, currency = "USD") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(Number(value || 0));
  }
  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  async function api(path, options = {}) {
    const token = session?.access_token;
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      await client.auth.signOut();
      window.location.href = "login.html";
    }
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }
  function toast(message, error = false) {
    const el = $("toast");
    el.textContent = message;
    el.className = `toast show${error ? " error" : ""}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3600);
  }
  function statusSelect(resource, row) {
    const values =
      {
        students: ["active", "inactive", "completed"],
        teachers: ["active", "inactive"],
        classes: ["active", "paused", "completed", "cancelled"],
        payments: ["pending", "successful", "failed", "refunded"],
      }[resource] || [];

    return `
    <select
      class="inline-status"
      data-resource="${resource}"
      data-id="${esc(row.id)}"
    >
      ${values
        .map(
          (value) => `
        <option value="${value}" ${row.status === value ? "selected" : ""}>
          ${value.charAt(0).toUpperCase() + value.slice(1)}
        </option>
      `,
        )
        .join("")}
    </select>
  `;
  }

  function courseActions(row) {
    return `
    <button
      class="small-action"
      data-course-edit="${esc(row.id)}"
    >Edit</button>

    <select
      class="inline-status"
      data-resource="courses"
      data-id="${esc(row.id)}"
    >
      <option value="active" ${row.is_active ? "selected" : ""}>Active</option>
      <option value="inactive" ${!row.is_active ? "selected" : ""}>Inactive</option>
    </select>
  `;
  }
  function teacherActions(row) {
    return `
    <button
      class="btn btn-secondary"
      type="button"
      data-teacher-edit="${esc(row.id)}"
    >
      Edit
    </button>
  `;
  }

  function showView(view) {
    currentView = view;
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.remove("active"));
    document
      .querySelectorAll(".nav-item")
      .forEach((v) => v.classList.toggle("active", v.dataset.view === view));
    if (view === "overview") {
      $("overviewView").classList.add("active");
      $("pageTitle").textContent = "Overview";
      loadOverview();
    } else if (view === "reports") {
      $("reportsView").classList.add("active");
      $("pageTitle").textContent = "Reports";
      loadReports();
    } else {
      $("dataView").classList.add("active");
      currentResource = view;
      $("pageTitle").textContent = labels[view][0];
      $("sectionHeading").textContent = labels[view][0];
      $("sectionDescription").textContent = labels[view][1];
      $("addRecordButton").hidden = ![
        "students",
        "teachers",
        "courses",
      ].includes(view);
      $("tableSearch").hidden = !["students", "teachers", "courses"].includes(
        view,
      );
      $("tableSearch").value = "";
      loadTable();
    }
    $("sidebar").classList.remove("open");
  }
  async function loadOverview() {
    $("recentTrials").innerHTML = '<p class="empty-state">Loading…</p>';
    try {
      const data = await api("../api/admin?action=overview");
      $("adminName").textContent = data.admin || "Administrator";
      $("statStudents").textContent = data.stats.students;
      $("statTrials").textContent = data.stats.pendingTrials;
      $("statClasses").textContent = data.stats.activeClasses;
      $("statTeachers").textContent = data.stats.activeTeachers;
      $("statCollected").textContent = money(data.stats.collected);
      $("statOutstanding").textContent = money(data.stats.outstanding);
      $("trialBadge").hidden = !data.stats.pendingTrials;
      $("trialBadge").textContent = data.stats.pendingTrials;
      const rows = data.recentTrials || [];
      $("recentTrials").innerHTML = rows.length
        ? `<table><thead><tr><th>Reference</th><th>Student</th><th>Requested</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.trial_reference)}</td><td>${esc((r.students?.first_name || "") + " " + (r.students?.last_name || ""))}</td><td>${esc(date(r.preferred_local_datetime))}</td><td><span class="status-pill">${esc(r.status)}</span></td></tr>`).join("")}</tbody></table>`
        : '<p class="empty-state">No trial applications have been recorded yet.</p>';
    } catch (error) {
      $("recentTrials").innerHTML =
        `<p class="empty-state error-text">${esc(error.message)}</p>`;
      toast(error.message, true);
    }
  }
  let currentRows = [];
  async function loadTable() {
    $("dataTable").innerHTML = '<p class="empty-state">Loading records…</p>';
    try {
      const search = $("tableSearch").value.trim();
      const data = await api(
        `../api/admin?action=list&resource=${encodeURIComponent(currentResource)}&limit=150${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      );
      currentRows = data.data;
      const defs = columns[currentResource];
      $("dataTable").innerHTML = data.data.length
        ? `<table><thead><tr>${defs.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${data.data.map((row) => `<tr>${defs.map((c) => `<td>${c[1](row)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
        : '<p class="empty-state">No records found in this section yet.</p>';
    } catch (error) {
      $("dataTable").innerHTML =
        `<p class="empty-state error-text">${esc(error.message)}</p>`;
    }
  }
  async function loadReports() {
    try {
      const [enrollments, invoices, payments] = await Promise.all(
        ["enrollments", "invoices", "payments"].map((resource) =>
          api(`../api/admin?action=list&resource=${resource}&limit=250`),
        ),
      );
      const revenue = payments.data
        .filter((p) => p.status === "successful")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const balance = invoices.data.reduce(
        (sum, i) => sum + Number(i.outstanding_balance || 0),
        0,
      );
      $("reportEnrollments").textContent = enrollments.data.length;
      $("reportRevenue").textContent = money(revenue);
      $("reportBalance").textContent = money(balance);
    } catch (error) {
      toast(error.message, true);
    }
  }

  function openModal(kind, record = null) {
    const fields =
      kind === "students"
        ? [
            ["guardian_name", "Parent/guardian full name", "text", true],
            ["guardian_email", "Parent/guardian email", "email", false],
            ["guardian_phone", "Phone / WhatsApp", "tel", false],
            ["guardian_country", "Country", "text", false],
            ["first_name", "Student first name", "text", true],
            ["last_name", "Student last name", "text", true],
            ["age_group", "Age group", "text", false],
            ["timezone", "Student time zone (IANA)", "text", false],
          ]
        : kind === "teachers"
          ? [
              ["full_name", "Teacher full name", "text", true],
              ["email", "Email", "email", false],
              ["phone", "Phone", "tel", false],
              ["country", "Country", "text", false],
              ["timezone", "Time zone (IANA)", "text", false],
              ["qualifications", "Qualifications / experience", "text", false],
            ]
          : [
              ["name", "Course name", "text", true],
              ["description", "Course description", "text", true],
            ];

    const isEditing = Boolean(record);

    $("modalTitle").textContent = isEditing
      ? kind === "teachers"
        ? "Edit teacher"
        : "Edit course"
      : kind === "students"
        ? "Add a student"
        : kind === "teachers"
          ? "Add a teacher"
          : "Add a course";

    $("modalFields").innerHTML = fields
      .map(([name, label, type, required]) => {
        const value = record?.[name] ?? "";

        return `
        <label>
          ${label}
          <input
            name="${name}"
            type="${type}"
            value="${esc(value)}"
            ${required ? "required" : ""}
          >
        </label>
      `;
      })
      .join("");

    $("modalMessage").textContent = "";
    $("modalBackdrop").hidden = false;

    $("recordForm").dataset.kind = kind;
    $("recordForm").dataset.action = isEditing ? "update" : "create";

    $("recordForm").dataset.recordId = record?.id || "";
  }

  function closeModal() {
    $("modalBackdrop").hidden = true;
    $("recordForm").reset();
  }

  async function saveRecord(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());

    const kind = event.currentTarget.dataset.kind;
    const action = event.currentTarget.dataset.action || "create";
    const recordId = event.currentTarget.dataset.recordId;

    const button = $("saveRecord");

    button.disabled = true;
    button.textContent = action === "update" ? "Updating…" : "Saving…";

    try {
      if (kind === "students") {
        await api("../api/admin", {
          method: "POST",
          body: JSON.stringify({
            action: "create_student",
            guardian: {
              full_name: values.guardian_name,
              email: values.guardian_email,
              phone: values.guardian_phone,
              country: values.guardian_country,
            },
            student: {
              first_name: values.first_name,
              last_name: values.last_name,
              age_group: values.age_group,
              timezone: values.timezone,
              country: values.guardian_country,
            },
          }),
        });
      } else if (kind === "courses") {
        await api("../api/admin", {
          method: "POST",
          body: JSON.stringify({
            action: action === "update" ? "update_course" : "create_course",
            course: {
              id: recordId,
              name: values.name,
              description: values.description,
            },
          }),
        });
      } else if (kind === "teachers") {
        await api("../api/admin", {
          method: "POST",
          body: JSON.stringify({
            action: action === "update" ? "update_teacher" : "create_teacher",
            teacher: {
              ...values,
              id: recordId,
            },
          }),
        });
      }

      closeModal();

      toast(
        action === "update"
          ? `${kind === "teachers" ? "Teacher" : "Course"} updated successfully.`
          : "Record saved successfully.",
      );

      loadTable();
    } catch (error) {
      $("modalMessage").textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Save record";
    }
  }

  document
    .querySelectorAll(".nav-item")
    .forEach((button) =>
      button.addEventListener("click", () => showView(button.dataset.view)),
    );
  document
    .querySelectorAll("[data-open-view]")
    .forEach((button) =>
      button.addEventListener("click", () => showView(button.dataset.openView)),
    );
  $("refreshOverview").addEventListener("click", loadOverview);
  $("refreshTable").addEventListener("click", loadTable);
  $("refreshReports").addEventListener("click", loadReports);
  $("tableSearch").addEventListener("input", () => {
    clearTimeout(loadTable.timer);
    loadTable.timer = setTimeout(loadTable, 250);
  });
  $("addRecordButton").addEventListener("click", () =>
    openModal(currentResource),
  );
  $("closeModal").addEventListener("click", closeModal);
  $("cancelModal").addEventListener("click", closeModal);
  $("recordForm").addEventListener("submit", saveRecord);
  $("modalBackdrop").addEventListener("click", (e) => {
    if (e.target === $("modalBackdrop")) closeModal();
  });
  $("mobileMenu").addEventListener("click", () =>
    $("sidebar").classList.toggle("open"),
  );
  $("logoutButton").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "login.html";
  });

  $("dataTable").addEventListener("click", async (event) => {
    
  const trialDetailsButton = event.target.closest("[data-trial-details]");

  if (trialDetailsButton) {
    const trialId = trialDetailsButton.dataset.trialDetails;
    const trial = currentRows.find((row) => row.id === trialId);

    if (!trial) {
      toast("Trial record not found.", true);
      return;
    }

    $("trialDetailsBody").innerHTML = renderTrialDetails(trial);
    $("trialDetailsModal").hidden = false;

    return;
  }
  
    const registrationDetailsButton = event.target.closest("[data-registration-details]");
    if (registrationDetailsButton) {
      const registration = currentRows.find((row) => row.id === registrationDetailsButton.dataset.registrationDetails);
      if (!registration) {
        toast("Registration record not found.", true);
        return;
      }
      $("registrationDetailsBody").innerHTML = renderRegistrationDetails(registration);
      $("registrationDetailsModal").hidden = false;
      return;
    }

    // Handle editing a course
    const editButton = event.target.closest("[data-course-edit]");

    if (editButton) {
      const courseId = editButton.dataset.courseEdit;

      const course = currentRows.find((row) => row.id === courseId);

      if (!course) {
        toast("Course not found.", true);
        return;
      }

      openModal("courses", course);
      return;
    }
    const teacherEditButton = event.target.closest("[data-teacher-edit]");

    if (teacherEditButton) {
      const teacherId = teacherEditButton.dataset.teacherEdit;
      const teacher = currentRows.find((row) => row.id === teacherId);

      if (!teacher) {
        toast("Teacher not found.", true);
        return;
      }

      openModal("teachers", teacher);
      return;
    }
    return;
  });

  $("dataTable").addEventListener("change", async (event) => {
    const select = event.target.closest("[data-resource]");
    if (!select) return;
    select.disabled = true;
    try {
      await api("../api/admin", {
        method: "POST",
        body: JSON.stringify({
          action: "update_status",
          resource: select.dataset.resource,
          id: select.dataset.id,
          status: select.value,
        }),
      });
      toast("Status updated.");
    } catch (error) {
      toast(error.message, true);
    } finally {
      select.disabled = false;
    }
  });
  function trialNotificationMessage(label, result) {
    if (!result) return `${label} saved.`;
    if (result.sent) return `${label} Parent notification email sent.`;
    if (result.status === "skipped") return `${label} saved, but no email was sent. ${result.reason || "Check the email settings."}`;
    return `${label} saved, but the notification email failed. ${result.reason || "Please contact the parent manually."}`;
  }

  async function refreshTrialDetails(trialId) {
    await loadTable();
    const updated = currentRows.find((row) => row.id === trialId);
    if (updated) $("trialDetailsBody").innerHTML = renderTrialDetails(updated);
  }

  $("trialDetailsBody").addEventListener("click", async (event) => {
    const statusButton = event.target.closest("[data-trial-manage]");
    const notesButton = event.target.closest("[data-trial-save-notes]");
    const rescheduleButton = event.target.closest("[data-trial-reschedule]");
    const button = statusButton || notesButton || rescheduleButton;
    if (!button) return;

    const trialId = button.dataset.id;
    const notes = $("trialAdminNotes")?.value || "";
    button.disabled = true;

    try {
      if (statusButton) {
        const status = statusButton.dataset.trialManage;
        const prompts = {
          approved: "Accept this free trial request and email the parent?",
          rejected: "Reject this free trial request and email the parent?",
          booked: "Mark this free trial as confirmed and email the parent?",
        };
        const confirmed = window.confirm(prompts[status] || "Update this free trial?");
        if (!confirmed) return;
        const result = await api("../api/admin", {
          method: "POST",
          body: JSON.stringify({ action: "update_trial", id: trialId, status, admin_notes: notes }),
        });
        const labels = { approved: "Free trial accepted.", rejected: "Free trial rejected.", booked: "Free trial marked as booked." };
        toast(trialNotificationMessage(labels[status] || "Free trial updated.", result.notification), !result.notification?.sent && Boolean(result.notification?.reason));
      } else if (notesButton) {
        await api("../api/admin", {
          method: "POST",
          body: JSON.stringify({ action: "update_trial", id: trialId, admin_notes: notes }),
        });
        toast("Admin notes saved.");
      } else {
        const dateValue = $("trialNewDate").value;
        const timeValue = $("trialNewTime").value;
        if (!dateValue || !timeValue) throw new Error("Choose both a new date and time.");
        const result = await api("../api/admin", {
          method: "POST",
          body: JSON.stringify({ action: "reschedule_trial", id: trialId, date: dateValue, time: timeValue, admin_notes: notes }),
        });
        toast(trialNotificationMessage("Suggested trial time updated.", result.notification), !result.notification?.sent && Boolean(result.notification?.reason));
      }
      await refreshTrialDetails(trialId);
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  $("closeTrialDetails").addEventListener("click", () => {
    $("trialDetailsModal").hidden = true;
  });

  $("trialDetailsModal").addEventListener("click", (event) => {
    if (event.target === $("trialDetailsModal")) {
      $("trialDetailsModal").hidden = true;
    }
  });
  $("closeRegistrationDetails").addEventListener("click", () => {
    $("registrationDetailsModal").hidden = true;
  });
  $("registrationDetailsModal").addEventListener("click", (event) => {
    if (event.target === $("registrationDetailsModal")) {
      $("registrationDetailsModal").hidden = true;
    }
  });

  client.auth.onAuthStateChange((_event, nextSession) => {
    if (!nextSession) window.location.href = "login.html";
  });
  window.amaAuthReady.then(async (current) => {
    if (!current) {
      window.location.href = "login.html";
      return;
    }
    session = current;
    await loadOverview();
  });
})();

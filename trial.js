const ACADEMY_WHATSAPP = '2348143160876';
const MAX_COURSES = 4;
const ACADEMY_ZONE = 'Africa/Lagos';
const form = document.getElementById('trialForm');
const relationshipSelect = document.getElementById('trialRelationship');
const studentNameFields = document.getElementById('trialStudentNameFields');
const studentFirstInput = document.getElementById('trialStudentFirstName');
const studentLastInput = document.getElementById('trialStudentLastName');
function syncTrialLearnerFields() {
  const self = relationshipSelect.value === 'Self';
  studentNameFields.hidden = self || !relationshipSelect.value;
  studentFirstInput.required = !self && Boolean(relationshipSelect.value);
  studentLastInput.required = !self && Boolean(relationshipSelect.value);
  if (self) { studentFirstInput.value = form.elements.guardianFirstName.value; studentLastInput.value = form.elements.guardianLastName.value; }
}
relationshipSelect.addEventListener('change', syncTrialLearnerFields);
syncTrialLearnerFields();
[form.elements.guardianFirstName, form.elements.guardianLastName].forEach(el => el.addEventListener('input', () => { if (relationshipSelect.value === 'Self') syncTrialLearnerFields(); }));
const courseInputs = [...document.querySelectorAll('input[name="courses"]')];
const courseCount = document.getElementById('courseCount');
const counterFill = document.getElementById('counterFill');
const courseError = document.getElementById('courseError');
const zoneSelect = document.getElementById('studentTimeZone');
const dateInput = document.getElementById('trialDate');
const timeInput = document.getElementById('trialTime');
const studentTimeDisplay = document.getElementById('studentTimeDisplay');
const studentZoneDisplay = document.getElementById('studentZoneDisplay');
const academyTimeDisplay = document.getElementById('academyTimeDisplay');
const timeNotice = document.getElementById('timeNotice');
const formMessage = document.getElementById('formMessage');
const submitButton = document.getElementById('submitButton');
const successPanel = document.getElementById('successPanel');
const registrationIdEl = document.getElementById('registrationId');
const whatsappContinue = document.getElementById('whatsappContinue');
const today = new Date();
const todayLocal = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
dateInput.min = todayLocal;
function setMinimumTrialDate() {
  if (!zoneSelect.value) return;
  const nowParts = partsAt(new Date(), zoneSelect.value);
  dateInput.min = `${nowParts.year}-${String(nowParts.month).padStart(2,'0')}-${String(nowParts.day).padStart(2,'0')}`;
}


function allTimeZones() {
  try { return Intl.supportedValuesOf('timeZone'); }
  catch { return ['Africa/Lagos','Europe/London','Europe/Berlin','Europe/Paris','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Asia/Dubai','Asia/Riyadh','Asia/Karachi','Asia/Dhaka','Asia/Kolkata','Asia/Kuala_Lumpur','Asia/Singapore','Asia/Tokyo','Australia/Sydney','Pacific/Auckland']; }
}
const zones = allTimeZones();
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
zoneSelect.innerHTML = `<option value="">Select student time zone</option>` + zones.map(zone => `<option value="${zone}">${zone.replaceAll('_',' ')}</option>`).join('');
zoneSelect.value = zones.includes(browserZone) ? browserZone : 'Africa/Lagos';
setMinimumTrialDate();

function selectedCourses() { return courseInputs.filter(input => input.checked).map(input => input.value); }
function updateCourseSelection(changed) {
  if (selectedCourses().length > MAX_COURSES && changed) changed.checked = false;
  const count = selectedCourses().length;
  courseCount.textContent = `${count} of ${MAX_COURSES} selected`;
  counterFill.style.width = `${count / MAX_COURSES * 100}%`;
  courseInputs.forEach(input => { input.closest('.course-card').setAttribute('aria-checked', String(input.checked)); input.disabled = count >= MAX_COURSES && !input.checked; });
  courseError.hidden = count > 0 && count <= MAX_COURSES;
}
courseInputs.forEach(input => input.addEventListener('change', () => updateCourseSelection(input)));
updateCourseSelection();

function partsAt(date, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
function offsetAt(date, zone) {
  const p = partsAt(date, zone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}
function localDateTimeToInstants(dateText, timeText, zone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}$/.test(timeText)) return [];
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsets = new Set();
  for (let delta = -36; delta <= 36; delta += 6) offsets.add(offsetAt(new Date(naive + delta * 3600000), zone));
  const matches = [];
  for (const offset of offsets) {
    const candidate = new Date(naive - offset);
    const p = partsAt(candidate, zone);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) matches.push(candidate);
  }
  return [...new Map(matches.map(d => [d.getTime(), d])).values()].sort((a,b) => a-b);
}
function pretty(date, zone) {
  return new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short' }).format(date);
}
function updateTimePreview() {
  const zone = zoneSelect.value;
  studentZoneDisplay.textContent = zone || 'Choose a time zone';
  if (!zone || !dateInput.value || !timeInput.value) {
    studentTimeDisplay.textContent = 'Select a date and time'; academyTimeDisplay.textContent = 'Waiting for selection';
    timeNotice.className = 'time-notice'; timeNotice.textContent = 'Both times update when you change the date, time or time zone. This is a preferred time request, not a confirmed booking.'; return;
  }
  const matches = localDateTimeToInstants(dateInput.value, timeInput.value, zone);
  if (!matches.length) {
    studentTimeDisplay.textContent = `${dateInput.value} ${timeInput.value}`; academyTimeDisplay.textContent = 'Time does not exist';
    timeNotice.className = 'time-notice error'; timeNotice.textContent = 'This local time may fall inside a daylight-saving clock change and does not exist. Please choose another time.'; return;
  }
  if (matches.length > 1) {
    studentTimeDisplay.textContent = `${dateInput.value} ${timeInput.value}`; academyTimeDisplay.textContent = 'Ambiguous local time';
    timeNotice.className = 'time-notice warning'; timeNotice.textContent = 'This time occurs twice because clocks move backwards. Please choose another time to avoid a scheduling mistake.'; return;
  }
  studentTimeDisplay.textContent = pretty(matches[0], zone);
  academyTimeDisplay.textContent = pretty(matches[0], ACADEMY_ZONE);
  timeNotice.className = 'time-notice'; timeNotice.textContent = 'Equivalent times are calculated for the selected date, including daylight-saving changes. Your request remains pending until the academy approves it.';
}
zoneSelect.addEventListener('change', () => { setMinimumTrialDate(); updateTimePreview(); });
[dateInput, timeInput].forEach(el => el.addEventListener('change', updateTimePreview));
updateTimePreview();

function showMessage(message, type='error') { formMessage.textContent = message; formMessage.className = `form-message ${type}`; formMessage.hidden = false; }
function getTimeData() {
  const matches = localDateTimeToInstants(dateInput.value, timeInput.value, zoneSelect.value);
  if (matches.length !== 1) throw new Error(matches.length ? 'This time is ambiguous because of a daylight-saving clock change. Please choose another time.' : 'This local time is invalid or falls inside a daylight-saving clock change. Please choose another time.');
  const instant = matches[0];
  const p = partsAt(instant, ACADEMY_ZONE);
  const academyLocal = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')} ${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
  return { trialUtc: instant.toISOString(), academyDateTime: academyLocal };
}
function buildWhatsApp(data, id) {
  return ['Assalamu Alaikum wa Rahmatullahi wa Barakatuh.','','I have requested a free trial with Al-Maheen Academy.',`Student reference ID: ${id}`,`Student: ${data.studentFirstName} ${data.studentLastName}`,`Contact person: ${data.guardianFirstName} ${data.guardianLastName}`,`Country: ${data.country}`,`Programmes: ${data.courses.join(', ')}`,`Preferred student time: ${data.trialDate} ${data.trialTime} (${data.studentTimeZone})`,`Equivalent Academy time: ${data.academyDateTime} WAT`,`Trial duration: ${data.trialDuration} minutes`,'','I understand this request is pending approval. Please contact me to confirm or suggest another time.','Jazakumullahu Khairan.'].join('\n');
}
form.addEventListener('submit', async event => {
  event.preventDefault(); formMessage.hidden = true; successPanel.hidden = true;
  if (!form.reportValidity()) return;
  if (selectedCourses().length < 1 || selectedCourses().length > MAX_COURSES) { courseError.hidden = false; courseError.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  let timeData;
  try { timeData = getTimeData(); if (Date.parse(timeData.trialUtc) <= Date.now()) throw new Error('Please choose a future trial date and time in the student’s time zone.'); } catch (error) { showMessage(error.message); return; }
  const data = Object.fromEntries(new FormData(form).entries());
  data.courses = selectedCourses(); if (data.relationship === 'Self') { data.studentFirstName = data.guardianFirstName; data.studentLastName = data.guardianLastName; } Object.assign(data, timeData);
  submitButton.disabled = true; submitButton.textContent = 'Sending trial request…';
  showMessage('Please wait while we securely save your trial request. It will not be confirmed automatically.', 'info');
  try {
    const response = await fetch('/api/trial', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success || !result.registrationId) throw new Error(result.error || 'We could not save your request. Please try again.');
    registrationIdEl.textContent = result.registrationId;
    const whatsappUrl = `https://wa.me/${ACADEMY_WHATSAPP}?text=${encodeURIComponent(buildWhatsApp(data, result.registrationId))}`;
    whatsappContinue.href = whatsappUrl;
    successPanel.hidden = false; submitButton.hidden = true; formMessage.hidden = true; successPanel.scrollIntoView({behavior:'smooth',block:'center'});
    window.location.assign(whatsappUrl);
  } catch (error) { showMessage(error.message || 'Something went wrong. Your request has not been confirmed as saved.'); }
  finally { submitButton.disabled = false; submitButton.innerHTML = 'Request Free Trial <span aria-hidden="true">→</span>'; }
});

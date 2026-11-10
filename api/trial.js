const { google } = require('googleapis');
const { randomUUID } = require('crypto');

const ALLOWED_COURSES = new Set(['Quran Reading','Quran Memorisation','Tajweed','Arabic Language','Islamic Studies','Islamic Manners and Character','Duas and Hadith']);
const ALLOWED_AGE_GROUPS = new Set(['Child (4–12)','Teenager (13–17)','Adult (18+)']);
const ALLOWED_LEVELS = new Set(['Complete beginner','Recognises Arabic letters, learning to join them','Can read words but needs practice','Reads Quran and wants to improve Tajweed','Reads fluently and wants memorisation support','Not applicable / interested in another course']);
const ALLOWED_RELATIONSHIPS = new Set(['Parent','Guardian','Self','Other family member']);
const ACADEMY_ZONE = 'Africa/Lagos';

function clean(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160; }
function safeCell(value) { const s = String(value ?? '').slice(0, 1500); return /^[=+@\-]/.test(s) ? `'${s}` : s; }
function partsAt(date, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
function offsetAt(date, zone) {
  const p = partsAt(date, zone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}
function resolveLocalTime(dateText, timeText, zone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}$/.test(timeText)) throw new Error('Please provide a valid preferred trial date and time.');
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error('The preferred trial date or time is invalid.');
  const offsets = new Set();
  for (let delta = -36; delta <= 36; delta += 6) offsets.add(offsetAt(new Date(naive + delta * 3600000), zone));
  const matches = [];
  for (const offset of offsets) {
    const candidate = new Date(naive - offset);
    const p = partsAt(candidate, zone);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) matches.push(candidate);
  }
  const unique = [...new Map(matches.map(d => [d.getTime(), d])).values()];
  if (!unique.length) throw new Error('That local time does not exist because of a daylight-saving clock change. Please choose another time.');
  if (unique.length > 1) throw new Error('That local time occurs twice because of a daylight-saving clock change. Please choose another time.');
  return unique[0];
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ success:false, error:'Method not allowed.' }); }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (clean(body.website, 200)) return res.status(400).json({ success:false, error:'Unable to process this request.' });
    const guardianFirstName = clean(body.guardianFirstName, 70);
    const guardianLastName = clean(body.guardianLastName, 70);
    const guardianEmail = clean(body.guardianEmail, 160).toLowerCase();
    const guardianPhone = clean(body.guardianPhone, 30);
    const country = clean(body.country, 80);
    const relationship = clean(body.relationship, 40);
    const studentFirstName = clean(body.studentFirstName, 70);
    const studentLastName = clean(body.studentLastName, 70);
    const ageGroup = clean(body.ageGroup, 40);
    const level = clean(body.level, 100);
    const timeZone = clean(body.studentTimeZone, 80);
    const trialDate = clean(body.trialDate, 10);
    const trialTime = clean(body.trialTime, 5);
    const trialDuration = clean(body.trialDuration, 2);
    const notes = clean(body.notes, 1000);
    const courses = Array.isArray(body.courses) ? [...new Set(body.courses.filter(v => typeof v === 'string'))] : [];
    const consent = body.consent === true || body.consent === 'true' || body.consent === 'on';

    if (!guardianFirstName || !guardianLastName || !validEmail(guardianEmail) || guardianPhone.replace(/\D/g, '').length < 7 || !country ||
      !ALLOWED_RELATIONSHIPS.has(relationship) || !studentFirstName || !studentLastName ||
      !ALLOWED_AGE_GROUPS.has(ageGroup) || !ALLOWED_LEVELS.has(level) || !timeZone || !trialDate || !trialTime || !['20','30'].includes(trialDuration) ||
      courses.length < 1 || courses.length > 4 || courses.some(c => !ALLOWED_COURSES.has(c)) || !consent) {
      return res.status(400).json({ success:false, error:'Please check all required fields and select between one and four programmes.' });
    }
    try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date()); }
    catch { return res.status(400).json({ success:false, error:'Please choose a valid student time zone.' }); }

    const trialInstant = resolveLocalTime(trialDate, trialTime, timeZone);
    if (trialInstant.getTime() <= Date.now()) return res.status(400).json({ success:false, error:'Please choose a future trial date and time.' });
    const academyParts = partsAt(trialInstant, ACADEMY_ZONE);
    const academyDateTime = `${academyParts.year}-${String(academyParts.month).padStart(2,'0')}-${String(academyParts.day).padStart(2,'0')} ${String(academyParts.hour).padStart(2,'0')}:${String(academyParts.minute).padStart(2,'0')}`;

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!spreadsheetId || !serviceEmail || !privateKey) {
      console.error('Trial storage is missing Google Sheets environment variables.');
      return res.status(503).json({ success:false, error:'Trial request storage is not configured yet. Please contact the academy.' });
    }
    const auth = new google.auth.JWT({ email:serviceEmail, key:privateKey.replace(/\\n/g,'\n'), scopes:['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version:'v4', auth });

    // Check prior trial requests by student name and parent/guardian email to reduce duplicate bookings.
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range:'Registrations!T:W' });
    const targetName = `${studentFirstName} ${studentLastName}`.trim().toLocaleLowerCase().replace(/\s+/g,' ');
    const duplicate = (existing.data.values || []).some(row => {
      if (row[0] !== 'Free Trial') return false;
      const name = `${row[1] || ''} ${row[2] || ''}`.trim().toLocaleLowerCase().replace(/\s+/g,' ');
      return name === targetName && String(row[3] || '').trim().toLowerCase() === guardianEmail;
    });
    if (duplicate) return res.status(409).json({ success:false, error:'Our records show that this student has already requested a free trial. Please contact the academy if you need help.' });

    const registrationId = `AMA-STU-${new Date().getUTCFullYear()}-${randomUUID().replace(/-/g,'').slice(0,8).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const row = [
      registrationId, timestamp, guardianFirstName, guardianLastName, guardianEmail, guardianPhone, country, relationship,
      ageGroup, courses.join(', '), level, 'Free trial request', `${trialDate} ${trialTime} (${timeZone})`, notes,
      'Pending Trial Approval', 'Yes', '', '', '',
      'Free Trial', studentFirstName, studentLastName, guardianEmail, timeZone, trialDate, trialTime,
      trialInstant.toISOString(), academyDateTime, trialDuration, 'Pending Approval', registrationId, ''
    ].map(safeCell);
    await sheets.spreadsheets.values.append({ spreadsheetId, range:'Registrations!A:AF', valueInputOption:'RAW', insertDataOption:'INSERT_ROWS', requestBody:{ values:[row] } });
    return res.status(200).json({ success:true, registrationId, status:'Pending Approval', academyDateTime, academyTimeZone:ACADEMY_ZONE });
  } catch (error) {
    if (error && error.message && /daylight-saving|local time|valid preferred trial/.test(error.message)) return res.status(400).json({ success:false, error:error.message });
    console.error('Trial request failed:', error && error.message ? error.message : 'Unknown error');
    return res.status(500).json({ success:false, error:'We could not save your trial request right now. Please try again later.' });
  }
};

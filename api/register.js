const { google } = require('googleapis');
const { randomUUID } = require('crypto');

const ALLOWED_COURSES = new Set([
  'Quran Reading', 'Quran Memorisation', 'Tajweed', 'Arabic Language',
  'Islamic Studies', 'Islamic Manners and Character', 'Duas and Hadith'
]);
const ALLOWED_AGE_GROUPS = new Set(['Child (4–12)', 'Teenager (13–17)', 'Adult (18+)']);
const ALLOWED_LEARNER_TYPES = new Set(['Myself', 'My child', 'Another family member']);
const ALLOWED_FORMATS = new Set(['One-on-one classes', 'Family classes', 'Small group classes', "I'd like advice before choosing"]);
const ALLOWED_LEVELS = new Set([
  'Complete beginner', 'Recognises Arabic letters, learning to join them',
  'Can read words but needs practice', 'Reads Quran and wants to improve Tajweed',
  'Reads fluently and wants memorisation support', 'Not applicable / interested in another course'
]);
const ALLOWED_TIMES = new Set(['Morning', 'Afternoon', 'Evening', 'Flexible']);
const ALLOWED_DAYS = new Set(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']);

function cleanString(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}
function hasAny(value, set) { return typeof value === 'string' && set.has(value); }
function safeCell(value) {
  const str = String(value ?? '').slice(0, 1500);
  // Avoid spreadsheet formula injection from user-entered values.
  return /^[=+@\-]/.test(str) ? `'${str}` : str;
}

const ACADEMY_ZONE = 'Africa/Lagos';
function partsAt(date, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function offsetAt(date, zone) { const p=partsAt(date,zone); return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-date.getTime(); }
function resolveLocalTime(dateText,timeText,zone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)||!/^\d{2}:\d{2}$/.test(timeText)) throw new Error('Please enter a valid preferred class date and time.');
  const [y,m,d]=dateText.split('-').map(Number),[h,min]=timeText.split(':').map(Number),naive=Date.UTC(y,m-1,d,h,min,0),check=new Date(naive);
  if(check.getUTCFullYear()!==y||check.getUTCMonth()+1!==m||check.getUTCDate()!==d||h>23||min>59)throw new Error('The preferred class date or time is invalid.');
  const offsets=new Set();for(let delta=-36;delta<=36;delta+=6)offsets.add(offsetAt(new Date(naive+delta*3600000),zone));
  const matches=[];for(const offset of offsets){const candidate=new Date(naive-offset),p=partsAt(candidate,zone);if(p.year===y&&p.month===m&&p.day===d&&p.hour===h&&p.minute===min)matches.push(candidate);}
  return [...new Map(matches.map(date=>[date.getTime(),date])).values()];
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    // Quiet bot trap. A real visitor should leave this field blank.
    if (cleanString(body.website, 200)) return res.status(400).json({ success: false, error: 'Unable to process this registration.' });

    const firstName = cleanString(body.firstName, 70);
    const lastName = cleanString(body.lastName, 70);
    const email = cleanString(body.email, 160).toLowerCase();
    const phone = cleanString(body.phone, 30);
    const country = cleanString(body.country, 80);
    const learnerType = cleanString(body.learnerType, 60);
    const studentFirstName = cleanString(body.studentFirstName, 70);
    const studentLastName = cleanString(body.studentLastName, 70);
    const studentTimeZone = cleanString(body.studentTimeZone, 80);
    const preferredScheduleDate = cleanString(body.preferredScheduleDate, 10);
    const preferredScheduleTime = cleanString(body.preferredScheduleTime, 5);
    const preferredDays = Array.isArray(body.preferredDays) ? [...new Set(body.preferredDays.filter(v => typeof v === 'string'))] : [];
    const ageGroup = cleanString(body.ageGroup, 40);
    const level = cleanString(body.level, 100);
    const classFormat = cleanString(body.classFormat, 80);
    const notes = cleanString(body.notes, 1000);
    const sessionDuration = cleanString(body.sessionDuration, 3);
    const lessonsPerWeek = cleanString(body.lessonsPerWeek, 1);
    const validDuration = ['30', '45', '60'].includes(sessionDuration);
    const validFrequency = ['2', '3'].includes(lessonsPerWeek);
    const monthlyFee = validDuration && validFrequency
      ? String(8 * (Number(sessionDuration) / 60) * Number(lessonsPerWeek) * 4)
      : '';
    const courses = Array.isArray(body.courses) ? [...new Set(body.courses.filter(c => typeof c === 'string'))] : [];
    const times = Array.isArray(body.times) ? [...new Set(body.times.filter(t => typeof t === 'string'))] : [];
    const consent = body.consent === true || body.consent === 'true' || body.consent === 'on';

    if (!firstName || !lastName || !validEmail(email) || phone.replace(/\D/g, '').length < 7 || !country ||
        !hasAny(learnerType, ALLOWED_LEARNER_TYPES) || !hasAny(ageGroup, ALLOWED_AGE_GROUPS) ||
        !studentFirstName || !studentLastName || !studentTimeZone || preferredDays.some(day => !ALLOWED_DAYS.has(day)) ||
        !hasAny(level, ALLOWED_LEVELS) || !hasAny(classFormat, ALLOWED_FORMATS) || !validDuration || !validFrequency || !consent ||
        courses.length < 1 || courses.length > 4 || courses.some(course => !ALLOWED_COURSES.has(course)) ||
        times.some(time => !ALLOWED_TIMES.has(time)) || Boolean(preferredScheduleDate) !== Boolean(preferredScheduleTime)) {
      return res.status(400).json({ success: false, error: 'Please check the required fields and choose between one and four valid courses.' });
    }

    try { new Intl.DateTimeFormat('en-US', { timeZone:studentTimeZone }).format(new Date()); }
    catch { return res.status(400).json({ success:false, error:'Please choose a valid student time zone.' }); }
    let academyEquivalent = '';
    if (preferredScheduleDate && preferredScheduleTime) {
      const instants = resolveLocalTime(preferredScheduleDate, preferredScheduleTime, studentTimeZone);
      if (instants.length !== 1) return res.status(400).json({ success:false, error:instants.length ? 'That local time occurs twice because of a daylight-saving change. Please choose another time.' : 'That local time does not exist because of a daylight-saving change. Please choose another time.' });
      if (instants[0].getTime() <= Date.now()) return res.status(400).json({ success:false, error:'Please choose a future preferred class date and time.' });
      const p = partsAt(instants[0], ACADEMY_ZONE);
      academyEquivalent = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')} ${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!spreadsheetId || !serviceEmail || !privateKey) {
      console.error('Registration integration is missing one or more Google Sheets environment variables.');
      return res.status(503).json({ success: false, error: 'Registration storage is not configured yet. Please contact the academy directly.' });
    }

    const auth = new google.auth.JWT({
      email: serviceEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const registrationId = `AMA-${new Date().getUTCFullYear()}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const row = [
      registrationId, timestamp, firstName, lastName, email, phone, country, learnerType,
      ageGroup, courses.join(', '), level, classFormat, times.join(', '), notes, 'New', consent ? 'Yes' : 'No', `${sessionDuration} minutes`, `${lessonsPerWeek} lessons/week`, monthlyFee,
      '', '', '', '', '', '', '', '', '', '', '', '', '',
      studentFirstName, studentLastName, studentTimeZone, preferredDays.join(', '), preferredScheduleDate, preferredScheduleTime, academyEquivalent
    ].map(safeCell);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Registrations!A:AM',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });

    return res.status(200).json({ success: true, registrationId });
  } catch (error) {
    console.error('Registration submission failed:', error && error.message ? error.message : 'Unknown error');
    return res.status(500).json({ success: false, error: 'We could not save your registration right now. Please try again later.' });
  }
};


const { createClient } = require('@supabase/supabase-js');

const ALLOWED_COURSES = new Set([
  'Quran Reading',
  'Quran Memorisation',
  'Tajweed',
  'Arabic Language',
  'Islamic Studies',
  'Islamic Manners and Character',
  'Duas and Hadith'
]);

const ALLOWED_AGE_GROUPS = new Set([
  'Child (4–12)',
  'Teenager (13–17)',
  'Adult (18+)'
]);

const ALLOWED_LEVELS = new Set([
  'Complete beginner',
  'Recognises Arabic letters, learning to join them',
  'Can read words but needs practice',
  'Reads Quran and wants to improve Tajweed',
  'Reads fluently and wants memorisation support',
  'Not applicable / interested in another course'
]);

const ALLOWED_RELATIONSHIPS = new Set([
  'Parent',
  'Guardian',
  'Self',
  'Other family member'
]);

const ACADEMY_ZONE = 'Africa/Lagos';

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

function partsAt(date, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)])
  );
}

function offsetAt(date, zone) {
  const p = partsAt(date, zone);

  return Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  ) - date.getTime();
}

function resolveLocalTime(dateText, timeText, zone) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateText) ||
    !/^\d{2}:\d{2}$/.test(timeText)
  ) {
    throw new Error('Please provide a valid preferred trial date and time.');
  }

  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);

  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const check = new Date(naive);

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new Error('The preferred trial date or time is invalid.');
  }

  const offsets = new Set();

  for (let delta = -36; delta <= 36; delta += 6) {
    offsets.add(offsetAt(new Date(naive + delta * 3600000), zone));
  }

  const matches = [];

  for (const offset of offsets) {
    const candidate = new Date(naive - offset);
    const p = partsAt(candidate, zone);

    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    ) {
      matches.push(candidate);
    }
  }

  const unique = [
    ...new Map(matches.map(d => [d.getTime(), d])).values()
  ];

  if (!unique.length) {
    throw new Error(
      'That local time does not exist because of a daylight-saving clock change. Please choose another time.'
    );
  }

  if (unique.length > 1) {
    throw new Error(
      'That local time occurs twice because of a daylight-saving clock change. Please choose another time.'
    );
  }

  return unique[0];
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      success: false,
      error: 'Method not allowed.'
    });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

    // Bot protection field.
    if (clean(body.website, 200)) {
      return res.status(400).json({
        success: false,
        error: 'Unable to process this request.'
      });
    }

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

    const courses = Array.isArray(body.courses)
      ? [...new Set(body.courses.filter(v => typeof v === 'string'))]
      : [];

    const consent =
      body.consent === true ||
      body.consent === 'true' ||
      body.consent === 'on';

    // Validate required fields.
    if (
      !guardianFirstName ||
      !guardianLastName ||
      !validEmail(guardianEmail) ||
      guardianPhone.replace(/\D/g, '').length < 7 ||
      !country ||
      !ALLOWED_RELATIONSHIPS.has(relationship) ||
      !studentFirstName ||
      !studentLastName ||
      !ALLOWED_AGE_GROUPS.has(ageGroup) ||
      !ALLOWED_LEVELS.has(level) ||
      !timeZone ||
      !trialDate ||
      !trialTime ||
      !['20', '30'].includes(trialDuration) ||
      courses.length < 1 ||
      courses.length > 4 ||
      courses.some(course => !ALLOWED_COURSES.has(course)) ||
      !consent
    ) {
      return res.status(400).json({
        success: false,
        error: 'Please check all required fields and select between one and four programmes.'
      });
    }

    // Validate the student's time zone.
    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone
      }).format(new Date());
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Please choose a valid student time zone.'
      });
    }

    // Convert the student's local trial time into an exact instant.
    const trialInstant = resolveLocalTime(
      trialDate,
      trialTime,
      timeZone
    );

    if (trialInstant.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'Please choose a future trial date and time.'
      });
    }

    const academyParts = partsAt(trialInstant, ACADEMY_ZONE);

    const academyDateTime =
      `${academyParts.year}-${String(academyParts.month).padStart(2, '0')}-` +
      `${String(academyParts.day).padStart(2, '0')} ` +
      `${String(academyParts.hour).padStart(2, '0')}:` +
      `${String(academyParts.minute).padStart(2, '0')}`;

    // Connect securely to Supabase.
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error('Trial storage is missing Supabase environment variables.');

      return res.status(503).json({
        success: false,
        error: 'Trial request storage is not configured yet. Please contact the academy.'
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Submit everything through one database transaction.
    const { data, error } = await supabase.rpc('submit_free_trial', {
      p_guardian_first_name: guardianFirstName,
      p_guardian_last_name: guardianLastName,
      p_guardian_email: guardianEmail,
      p_guardian_phone: guardianPhone,
      p_country: country,
      p_relationship: relationship,
      p_student_first_name: studentFirstName,
      p_student_last_name: studentLastName,
      p_age_group: ageGroup,
      p_student_level: level,
      p_student_timezone: timeZone,
      p_trial_datetime: trialInstant.toISOString(),
      p_trial_duration: Number(trialDuration),
      p_notes: notes || null,
      p_course_names: courses,
      p_consent: consent
    });

    if (error) {
      if (error.message?.includes('DUPLICATE_FREE_TRIAL')) {
        return res.status(409).json({
          success: false,
          error: 'Our records show that this student has already requested a free trial. Please contact the academy if you need help.'
        });
      }

      console.error('Supabase free trial submission failed:', error.message);

      return res.status(500).json({
        success: false,
        error: 'We could not save your trial request right now. Please try again later.'
      });
    }

    if (!data || data.success !== true || !data.registrationId) {
      console.error('Supabase returned an unexpected free trial response.');

      return res.status(500).json({
        success: false,
        error: 'We could not save your trial request right now. Please try again later.'
      });
    }

    return res.status(200).json({
      success: true,
      registrationId: data.registrationId,
      status: data.status,
      academyDateTime: data.academyDateTime || academyDateTime,
      academyTimeZone: data.academyTimeZone || ACADEMY_ZONE
    });

  } catch (error) {
    if (
      error &&
      error.message &&
      /daylight-saving|local time|valid preferred trial|preferred trial date or time is invalid/i.test(error.message)
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    console.error(
      'Trial request failed:',
      error && error.message ? error.message : 'Unknown error'
    );

    return res.status(500).json({
      success: false,
      error: 'We could not save your trial request right now. Please try again later.'
    });
  }
};

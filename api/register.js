
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

const ALLOWED_LEARNER_TYPES = new Set([
  'Myself',
  'My child',
  'Another family member'
]);

const ALLOWED_FORMATS = new Set([
  'One-on-one classes',
  'Family classes',
  'Small group classes',
  "I'd like advice before choosing"
]);

const ALLOWED_LEVELS = new Set([
  'Complete beginner',
  'Recognises Arabic letters, learning to join them',
  'Can read words but needs practice',
  'Reads Quran and wants to improve Tajweed',
  'Reads fluently and wants memorisation support',
  'Not applicable / interested in another course'
]);

const ALLOWED_TIMES = new Set([
  'Morning',
  'Afternoon',
  'Evening',
  'Flexible'
]);

const ALLOWED_DAYS = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
]);

const ACADEMY_ZONE = 'Africa/Lagos';

function cleanString(value, maxLength = 200) {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    value.length <= 160;
}

function hasAny(value, set) {
  return typeof value === 'string' && set.has(value);
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
    parts
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, Number(p.value)])
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
    throw new Error(
      'Please enter a valid preferred class date and time.'
    );
  }

  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);

  const naive = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0
  );

  const check = new Date(naive);

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new Error(
      'The preferred class date or time is invalid.'
    );
  }

  const offsets = new Set();

  for (let delta = -36; delta <= 36; delta += 6) {
    offsets.add(
      offsetAt(new Date(naive + delta * 3600000), zone)
    );
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

  return [
    ...new Map(matches.map(date => [date.getTime(), date])).values()
  ];
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

    // Bot protection.
    if (cleanString(body.website, 200)) {
      return res.status(400).json({
        success: false,
        error: 'Unable to process this registration.'
      });
    }

    const firstName = cleanString(body.firstName, 70);
    const lastName = cleanString(body.lastName, 70);
    const email = cleanString(body.email, 160).toLowerCase();
    const phone = cleanString(body.phone, 30);
    const country = cleanString(body.country, 80);
    const learnerType = cleanString(body.learnerType, 60);

    const studentFirstName = cleanString(body.studentFirstName, 70);
    const studentLastName = cleanString(body.studentLastName, 70);
    const studentTimeZone = cleanString(body.studentTimeZone, 80);

    const preferredScheduleDate = cleanString(
      body.preferredScheduleDate,
      10
    );

    const preferredScheduleTime = cleanString(
      body.preferredScheduleTime,
      5
    );

    const preferredDays = Array.isArray(body.preferredDays)
      ? [...new Set(body.preferredDays.filter(v => typeof v === 'string'))]
      : [];

    const ageGroup = cleanString(body.ageGroup, 40);
    const level = cleanString(body.level, 100);
    const classFormat = cleanString(body.classFormat, 80);
    const notes = cleanString(body.notes, 1000);

    const sessionDuration = cleanString(body.sessionDuration, 3);
    const lessonsPerWeek = cleanString(body.lessonsPerWeek, 1);

    const validDuration = ['30', '45', '60'].includes(sessionDuration);
    const validFrequency = ['2', '3'].includes(lessonsPerWeek);

    const monthlyFee = validDuration && validFrequency
      ? 8 * (Number(sessionDuration) / 60) *
        Number(lessonsPerWeek) * 4
      : null;

    const courses = Array.isArray(body.courses)
      ? [...new Set(body.courses.filter(c => typeof c === 'string'))]
      : [];

    const times = Array.isArray(body.times)
      ? [...new Set(body.times.filter(t => typeof t === 'string'))]
      : [];

    const consent =
      body.consent === true ||
      body.consent === 'true' ||
      body.consent === 'on';

    // Validate submitted information.
    if (
      !firstName ||
      !lastName ||
      !validEmail(email) ||
      phone.replace(/\D/g, '').length < 7 ||
      !country ||
      !hasAny(learnerType, ALLOWED_LEARNER_TYPES) ||
      !hasAny(ageGroup, ALLOWED_AGE_GROUPS) ||
      !studentFirstName ||
      !studentLastName ||
      !studentTimeZone ||
      preferredDays.some(day => !ALLOWED_DAYS.has(day)) ||
      !hasAny(level, ALLOWED_LEVELS) ||
      !hasAny(classFormat, ALLOWED_FORMATS) ||
      !validDuration ||
      !validFrequency ||
      !consent ||
      courses.length < 1 ||
      courses.length > 4 ||
      courses.some(course => !ALLOWED_COURSES.has(course)) ||
      times.some(time => !ALLOWED_TIMES.has(time)) ||
      Boolean(preferredScheduleDate) !== Boolean(preferredScheduleTime)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Please check the required fields and choose between one and four valid courses.'
      });
    }

    // Validate student timezone.
    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: studentTimeZone
      }).format(new Date());
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Please choose a valid student time zone.'
      });
    }

    // Convert the preferred local schedule into academy time.
    let academyEquivalent = null;

    if (preferredScheduleDate && preferredScheduleTime) {
      const instants = resolveLocalTime(
        preferredScheduleDate,
        preferredScheduleTime,
        studentTimeZone
      );

      if (instants.length !== 1) {
        return res.status(400).json({
          success: false,
          error: instants.length
            ? 'That local time occurs twice because of a daylight-saving change. Please choose another time.'
            : 'That local time does not exist because of a daylight-saving change. Please choose another time.'
        });
      }

      if (instants[0].getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          error: 'Please choose a future preferred class date and time.'
        });
      }

      const p = partsAt(instants[0], ACADEMY_ZONE);

      academyEquivalent =
        `${p.year}-${String(p.month).padStart(2, '0')}-` +
        `${String(p.day).padStart(2, '0')} ` +
        `${String(p.hour).padStart(2, '0')}:` +
        `${String(p.minute).padStart(2, '0')}`;
    }

    // Connect securely to Supabase.
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error(
        'Registration integration is missing Supabase environment variables.'
      );

      return res.status(503).json({
        success: false,
        error: 'Registration storage is not configured yet. Please contact the academy directly.'
      });
    }

    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Submit the registration through one database transaction.
    const { data, error } = await supabase.rpc(
      'submit_registration',
      {
        p_guardian_first_name: firstName,
        p_guardian_last_name: lastName,
        p_guardian_email: email,
        p_guardian_phone: phone,
        p_country: country,
        p_learner_type: learnerType,
        p_student_first_name: studentFirstName,
        p_student_last_name: studentLastName,
        p_age_group: ageGroup,
        p_learning_level: level,
        p_class_format: classFormat,
        p_preferred_times: times,
        p_preferred_days: preferredDays,
        p_notes: notes || null,
        p_session_duration: Number(sessionDuration),
        p_lessons_per_week: Number(lessonsPerWeek),
        p_monthly_fee: monthlyFee,
        p_consent: consent,
        p_student_timezone: studentTimeZone,
        p_preferred_schedule_date: preferredScheduleDate || null,
        p_preferred_schedule_time: preferredScheduleTime || null,
        p_academy_equivalent_local: academyEquivalent
          ? `${academyEquivalent}:00`
          : null,
        p_course_names: courses
      }
    );

    if (error) {
      console.error(
        'Supabase registration submission failed:',
        error.message
      );

      return res.status(500).json({
        success: false,
        error: 'We could not save your registration right now. Please try again later.'
      });
    }

    if (
      !data ||
      data.success !== true ||
      !data.registrationId
    ) {
      console.error(
        'Supabase returned an unexpected registration response.'
      );

      return res.status(500).json({
        success: false,
        error: 'We could not save your registration right now. Please try again later.'
      });
    }

    return res.status(200).json({
      success: true,
      registrationId: data.registrationId
    });

  } catch (error) {
    if (
      error &&
      error.message &&
      /daylight-saving|local time|preferred class date or time/i.test(
        error.message
      )
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    console.error(
      'Registration submission failed:',
      error && error.message ? error.message : 'Unknown error'
    );

    return res.status(500).json({
      success: false,
      error: 'We could not save your registration right now. Please try again later.'
    });
  }
};

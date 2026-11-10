(() => {
  const ACADEMY_ZONE = 'Africa/Lagos';
  function allTimeZones() {
    try { return Intl.supportedValuesOf('timeZone'); }
    catch { return ['Africa/Lagos','Europe/London','Europe/Berlin','Europe/Paris','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Asia/Dubai','Asia/Riyadh','Asia/Karachi','Asia/Dhaka','Asia/Kolkata','Asia/Kuala_Lumpur','Asia/Singapore','Asia/Tokyo','Australia/Sydney','Pacific/Auckland']; }
  }
  function partsAt(date, zone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date);
    return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  }
  function offsetAt(date, zone) {
    const p = partsAt(date, zone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
  }
  function localDateTimeToInstants(dateText, timeText, zone) {
    if (!dateText || !timeText || !zone) return [];
    const [year, month, day] = dateText.split('-').map(Number);
    const [hour, minute] = timeText.split(':').map(Number);
    const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
    const check = new Date(naive);
    if (check.getUTCFullYear() !== year || check.getUTCMonth()+1 !== month || check.getUTCDate() !== day || hour > 23 || minute > 59) return [];
    const offsets = new Set();
    for (let delta=-36; delta<=36; delta+=6) offsets.add(offsetAt(new Date(naive + delta*3600000), zone));
    const matches=[];
    for (const offset of offsets) {
      const candidate=new Date(naive-offset), p=partsAt(candidate,zone);
      if (p.year===year && p.month===month && p.day===day && p.hour===hour && p.minute===minute) matches.push(candidate);
    }
    return [...new Map(matches.map(date=>[date.getTime(),date])).values()];
  }
  function formatDateTime(date, zone) {
    return new Intl.DateTimeFormat(undefined, { timeZone:zone, weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true, timeZoneName:'short' }).format(date);
  }
  window.AMA_TIME = { ACADEMY_ZONE, allTimeZones, partsAt, localDateTimeToInstants, formatDateTime };
})();

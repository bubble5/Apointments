// Central place for all scheduling rules/config, driven by env vars so the
// business can tune capacity without touching code.

export function getConfig() {
  const numTellers = parseInt(process.env.NUM_TELLERS || "3", 10);
  const tellerNames = (process.env.TELLER_NAMES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const names =
    tellerNames.length === numTellers
      ? tellerNames
      : Array.from({ length: numTellers }, (_, i) => `Teller ${i + 1}`);

  // Weekends default to OPEN with shorter hours (9am-1pm). Set
  // ENABLE_WEEKENDS=false to close Saturday/Sunday entirely instead.
  const enableWeekendsEnv = process.env.ENABLE_WEEKENDS;
  const skipWeekendsEnv = process.env.SKIP_WEEKENDS; // legacy var, still honored
  let enableWeekends;
  if (enableWeekendsEnv !== undefined) {
    enableWeekends = enableWeekendsEnv.toLowerCase() === "true";
  } else if (skipWeekendsEnv !== undefined) {
    enableWeekends = skipWeekendsEnv.toLowerCase() !== "true";
  } else {
    enableWeekends = true;
  }

  return {
    numTellers,
    tellerNames: names,
    slotMinutes: parseInt(process.env.SLOT_MINUTES || "5", 10),
    businessStart: process.env.BUSINESS_START || "08:00",
    businessEnd: process.env.BUSINESS_END || "17:00",
    enableWeekends,
    weekendStart: process.env.WEEKEND_START || "09:00",
    weekendEnd: process.env.WEEKEND_END || "13:00",
    orgName: process.env.ORG_NAME || "ID Pickup",
    // Vercel's servers run in UTC regardless of where your users are, so
    // "now" is computed against this timezone rather than the server's raw
    // clock — otherwise "today"/"current time" would drift by up to ~2
    // hours around midnight in Kigali (UTC+2).
    timeZone: process.env.ORG_TIMEZONE || "Africa/Kigali",
  };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function dateKey(date) {
  // YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parses a "YYYY-MM-DD" string as a local-time Date (avoids UTC off-by-one
// issues you'd get from `new Date("YYYY-MM-DD")`).
export function parseDateKey(dateKeyStr) {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Returns { dateKey, hhmm } for right now, computed in config.timeZone
// rather than the server's raw clock (Vercel runs in UTC).
function getNowInConfigZone(config) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    hhmm: `${get("hour")}:${get("minute")}`,
  };
}

// "Today" in the org's timezone — use this instead of dateKey(new Date()).
export function getTodayKey(config) {
  return getNowInConfigZone(config).dateKey;
}

// True if the given date+time slot is today (in the org's timezone) and
// already at or before the current time — i.e. too late to book.
export function isPastSlot(config, dateStr, time) {
  const now = getNowInConfigZone(config);
  if (dateStr !== now.dateKey) return false;
  return toMinutes(time) <= toMinutes(now.hhmm);
}

function isWeekendDate(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Returns { start, end } business hours for the given date, or null if
// that date isn't bookable at all (weekend with weekends disabled).
export function getHoursForDate(config, date) {
  if (isWeekendDate(date)) {
    if (!config.enableWeekends) return null;
    return { start: config.weekendStart, end: config.weekendEnd };
  }
  return { start: config.businessStart, end: config.businessEnd };
}

export function isBusinessDay(config, date) {
  return getHoursForDate(config, date) !== null;
}

// All bookable time-of-day slots for the given date (weekday and weekend
// hours differ), e.g. ["08:00", "08:05", ...] or [] if that date is closed.
export function listTimeSlots(config, date = new Date()) {
  const hours = getHoursForDate(config, date);
  if (!hours) return [];
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  const slots = [];
  for (let m = start; m + config.slotMinutes <= end; m += config.slotMinutes) {
    slots.push(toHHMM(m));
  }
  return slots;
}

// Total appointment capacity for the given date (varies between weekday
// and weekend since they can have different hours), or 0 if closed.
export function dailyCapacityForDate(config, date) {
  return listTimeSlots(config, date).length * config.numTellers;
}

export function generateAppointmentNumber(dateKeyStr, sequence) {
  const compact = dateKeyStr.replace(/-/g, "");
  return `MKUR-${compact}-${sequence.toString().padStart(3, "0")}`;
}

// Next `count` bookable calendar dates (closed weekends skipped if
// ENABLE_WEEKENDS=false), starting today (in the org's timezone), as
// "YYYY-MM-DD" strings.
export function listUpcomingBusinessDates(config, count, startDate = parseDateKey(getTodayKey(config))) {
  const dates = [];
  let date = new Date(startDate);
  let guard = 0;
  while (dates.length < count && guard < 120) {
    if (isBusinessDay(config, date)) {
      dates.push(dateKey(date));
    }
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    guard++;
  }
  return dates;
}

// Given the {time, teller} pairs already booked for one specific date,
// returns each time slot's remaining capacity out of numTellers. Pass the
// actual Date object (not just the key) so weekday/weekend hours apply.
export function getDayAvailability(config, date, bookedForDate) {
  const bookedByTime = new Map();
  for (const b of bookedForDate) {
    if (!bookedByTime.has(b.time)) bookedByTime.set(b.time, new Set());
    bookedByTime.get(b.time).add(b.teller);
  }
  return listTimeSlots(config, date).map((time) => {
    const bookedTellers = bookedByTime.get(time) || new Set();
    const remaining = Math.max(0, config.numTellers - bookedTellers.size);
    return { time, total: config.numTellers, remaining, full: remaining <= 0 };
  });
}

// Given the teller names already booked at one exact date+time, returns the
// first still-free teller name, or null if every teller is taken then.
export function assignTellerForSlot(config, bookedTellerNamesAtSlot) {
  const bookedSet = new Set(bookedTellerNamesAtSlot);
  return config.tellerNames.find((name) => !bookedSet.has(name)) || null;
}

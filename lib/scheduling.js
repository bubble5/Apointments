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

  return {
    numTellers,
    tellerNames: names,
    slotMinutes: parseInt(process.env.SLOT_MINUTES || "5", 10),
    businessStart: process.env.BUSINESS_START || "08:00",
    businessEnd: process.env.BUSINESS_END || "17:00",
    skipWeekends: (process.env.SKIP_WEEKENDS || "true").toLowerCase() === "true",
    orgName: process.env.ORG_NAME || "ID Pickup",
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

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function slotsPerDay(config) {
  const totalMinutes = toMinutes(config.businessEnd) - toMinutes(config.businessStart);
  return Math.floor(totalMinutes / config.slotMinutes);
}

export function dailyCapacity(config) {
  return slotsPerDay(config) * config.numTellers;
}

// Given how many appointments already exist for a given date, returns the
// next available {time, teller, tellerIndex} slot, or null if that day is full.
export function nextSlotForDate(config, existingCountForDate) {
  const capacity = dailyCapacity(config);
  if (existingCountForDate >= capacity) return null;

  const slotIndex = Math.floor(existingCountForDate / config.numTellers);
  const tellerIndex = existingCountForDate % config.numTellers;

  const startMinutes = toMinutes(config.businessStart) + slotIndex * config.slotMinutes;
  return {
    time: toHHMM(startMinutes),
    teller: config.tellerNames[tellerIndex],
    tellerIndex,
  };
}

// Finds the next date (today or later) that isn't full, given a function
// that returns how many appointments already exist for a date key.
export async function findNextAvailableDate(config, countForDateFn, startDate = new Date()) {
  let date = new Date(startDate);
  for (let attempts = 0; attempts < 60; attempts++) {
    if (!config.skipWeekends || !isWeekend(date)) {
      const key = dateKey(date);
      const count = await countForDateFn(key);
      const slot = nextSlotForDate(config, count);
      if (slot) {
        return { dateKey: key, count, ...slot };
      }
    }
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
  throw new Error("No available slots found in the next 60 days");
}

export function generateAppointmentNumber(dateKeyStr, sequence) {
  const compact = dateKeyStr.replace(/-/g, "");
  return `MKUR-${compact}-${sequence.toString().padStart(3, "0")}`;
}

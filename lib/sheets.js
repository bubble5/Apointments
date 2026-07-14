import { google } from "googleapis";

const HEADER = [
  "Timestamp",
  "Appointment Number",
  "Reg Number",
  "Phone",
  "Email",
  "Date",
  "Time",
  "Teller",
];

function getSheetName() {
  return process.env.GOOGLE_SHEET_NAME || "Appointments";
}

function getCredentials() {
  // Preferred: paste the entire service account JSON file as one env var.
  // This sidesteps private-key escaping bugs entirely, since the \n
  // sequences inside a JSON string are already correctly formed.
  const blob = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (blob) {
    let parsed;
    try {
      parsed = JSON.parse(blob);
    } catch (err) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the full contents of the service account key file, unmodified."
      );
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key."
      );
    }
    return { email: parsed.client_email, key: parsed.private_key };
  }

  // Fallback: two separate env vars (legacy / manual setup).
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (email && key) {
    return { email, key };
  }

  return null;
}

async function getClient() {
  const creds = getCredentials();

  if (!creds || !process.env.GOOGLE_SHEET_ID) {
    throw new Error(
      "Missing Google Sheets configuration. Set GOOGLE_SERVICE_ACCOUNT_JSON (recommended) or both GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, plus GOOGLE_SHEET_ID."
    );
  }

  const auth = new google.auth.JWT({
    email: creds.email,
    key: creds.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

// Ensures the target tab exists and has a header row.
export async function ensureSheetReady() {
  const sheets = await getClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = getSheetName();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some((s) => s.properties.title === sheetName);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
  }

  const headerRange = `${sheetName}!A1:H1`;
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange,
  });

  if (!current.data.values || current.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }

  return { sheets, spreadsheetId, sheetName };
}

// Returns all appointment rows as objects.
export async function getAllAppointments() {
  const { sheets, spreadsheetId, sheetName } = await ensureSheetReady();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:H`,
  });

  const rows = res.data.values || [];
  return rows.map((r) => ({
    timestamp: r[0] || "",
    appointmentNumber: r[1] || "",
    regNumber: r[2] || "",
    phone: r[3] || "",
    email: r[4] || "",
    date: r[5] || "",
    time: r[6] || "",
    teller: r[7] || "",
  }));
}

export async function countAppointmentsForDate(dateKeyStr) {
  const all = await getAllAppointments();
  return all.filter((a) => a.date === dateKeyStr).length;
}

export async function appendAppointment(row) {
  const { sheets, spreadsheetId, sheetName } = await ensureSheetReady();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A2:H`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          row.timestamp,
          row.appointmentNumber,
          row.regNumber,
          row.phone,
          row.email,
          row.date,
          row.time,
          row.teller,
        ],
      ],
    },
  });
}

export async function findAppointmentByNumber(appointmentNumber) {
  const all = await getAllAppointments();
  return all.find((a) => a.appointmentNumber === appointmentNumber) || null;
}

// Normalizes a value for duplicate comparisons: trims whitespace and
// lowercases (safe for reg numbers, emails; phone numbers are also stripped
// of common formatting characters so "078 123 4567" === "0781234567").
export function normalize(value, { isPhone = false } = {}) {
  const trimmed = (value || "").trim().toLowerCase();
  return isPhone ? trimmed.replace(/[\s\-()]/g, "") : trimmed;
}

// Given an in-memory list of appointments (from getAllAppointments) and a
// candidate date, returns the first existing appointment on that date whose
// reg number, phone, or email matches — or null if there's no conflict.
export function findDuplicateForDate(allAppointments, dateKeyStr, candidate) {
  const regNumber = normalize(candidate.regNumber);
  const phone = normalize(candidate.phone, { isPhone: true });
  const email = normalize(candidate.email);

  return (
    allAppointments.find((a) => {
      if (a.date !== dateKeyStr) return false;
      return (
        normalize(a.regNumber) === regNumber ||
        normalize(a.phone, { isPhone: true }) === phone ||
        normalize(a.email) === email
      );
    }) || null
  );
}

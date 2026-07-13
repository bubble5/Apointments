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

async function getClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!email || !key || !process.env.GOOGLE_SHEET_ID) {
    throw new Error(
      "Missing Google Sheets configuration. Check GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_SHEET_ID."
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
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

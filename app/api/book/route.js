import { NextResponse } from "next/server";
import { getConfig, findNextAvailableDate, generateAppointmentNumber } from "@/lib/scheduling";
import { appendAppointment, getAllAppointments, findDuplicateForDate } from "@/lib/sheets";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

export async function POST(request) {
  try {
    const body = await request.json();
    const regNumber = (body.regNumber || "").trim();
    const phone = (body.phone || "").trim();
    const email = (body.email || "").trim();

    if (!regNumber || !phone || !email) {
      return NextResponse.json(
        { error: "Reg number, phone, and email are all required." },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }

    const config = getConfig();

    // Fetch the sheet once and reuse it both for finding the next open slot
    // (which may need to check several candidate days) and for the same-day
    // duplicate check below — avoids hammering the Sheets API repeatedly.
    const allAppointments = await getAllAppointments();
    const countForDateFn = async (dateKeyStr) =>
      allAppointments.filter((a) => a.date === dateKeyStr).length;

    const slot = await findNextAvailableDate(config, countForDateFn);

    const duplicate = findDuplicateForDate(allAppointments, slot.dateKey, {
      regNumber,
      phone,
      email,
    });

    if (duplicate) {
      const field =
        duplicate.regNumber.trim().toLowerCase() === regNumber.trim().toLowerCase()
          ? "reg number"
          : duplicate.phone.replace(/[\s\-()]/g, "") === phone.replace(/[\s\-()]/g, "")
          ? "phone number"
          : "email";

      return NextResponse.json(
        {
          error: `This ${field} already has an appointment on ${duplicate.date} (appointment ${duplicate.appointmentNumber}, ${duplicate.time} with ${duplicate.teller}). Only one appointment per person per day is allowed.`,
        },
        { status: 409 }
      );
    }

    // Sequence number for the day = how many appointments existed before this one + 1
    const appointmentNumber = generateAppointmentNumber(slot.dateKey, slot.count + 1);

    const row = {
      timestamp: new Date().toISOString(),
      appointmentNumber,
      regNumber,
      phone,
      email,
      date: slot.dateKey,
      time: slot.time,
      teller: slot.teller,
    };

    await appendAppointment(row);

    return NextResponse.json({
      appointmentNumber,
      date: slot.dateKey,
      time: slot.time,
      teller: slot.teller,
      orgName: config.orgName,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Something went wrong while booking." },
      { status: 500 }
    );
  }
}

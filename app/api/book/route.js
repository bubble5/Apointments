import { NextResponse } from "next/server";
import { getConfig, findNextAvailableDate, generateAppointmentNumber } from "@/lib/scheduling";
import { appendAppointment, countAppointmentsForDate } from "@/lib/sheets";

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
    const slot = await findNextAvailableDate(config, countAppointmentsForDate);

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

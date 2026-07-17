import { NextResponse } from "next/server";
import {
  getConfig,
  listTimeSlots,
  assignTellerForSlot,
  generateAppointmentNumber,
  dateKey,
  isBusinessDay,
} from "@/lib/scheduling";
import { appendAppointment, getAllAppointments, findDuplicateForDate } from "@/lib/sheets";
import { emailError, phoneError } from "@/lib/validate";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request) {
  try {
    const body = await request.json();
    const regNumber = (body.regNumber || "").trim();
    const phone = (body.phone || "").trim();
    const email = (body.email || "").trim();
    const date = (body.date || "").trim();
    const time = (body.time || "").trim();

    if (!regNumber) {
      return NextResponse.json({ error: "Reg number is required." }, { status: 400 });
    }
    const phoneErr = phoneError(phone);
    if (phoneErr) {
      return NextResponse.json({ error: phoneErr }, { status: 400 });
    }
    const emailErr = emailError(email);
    if (emailErr) {
      return NextResponse.json({ error: emailErr }, { status: 400 });
    }

    const config = getConfig();

    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: "Select a valid date." }, { status: 400 });
    }
    const todayKey = dateKey(new Date());
    if (date < todayKey) {
      return NextResponse.json(
        { error: "That date has already passed. Please pick an upcoming date." },
        { status: 400 }
      );
    }
    // Parse the date safely as local time (avoids UTC off-by-one issues).
    const [y, m, d] = date.split("-").map(Number);
    if (!isBusinessDay(config, new Date(y, m - 1, d))) {
      return NextResponse.json(
        { error: "That date isn't available for booking (weekend or closed)." },
        { status: 400 }
      );
    }
    if (!listTimeSlots(config).includes(time)) {
      return NextResponse.json({ error: "Select a valid time slot." }, { status: 400 });
    }

    // Fetch the sheet once and reuse it for the duplicate check and the
    // slot-availability check below — avoids hammering the Sheets API.
    const allAppointments = await getAllAppointments();

    const duplicate = findDuplicateForDate(allAppointments, date, {
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

    const bookedTellersAtSlot = allAppointments
      .filter((a) => a.date === date && a.time === time)
      .map((a) => a.teller);
    const teller = assignTellerForSlot(config, bookedTellersAtSlot);

    if (!teller) {
      return NextResponse.json(
        { error: "That slot was just taken by someone else. Please pick another time." },
        { status: 409 }
      );
    }

    const countForDay = allAppointments.filter((a) => a.date === date).length;
    const appointmentNumber = generateAppointmentNumber(date, countForDay + 1);

    const row = {
      timestamp: new Date().toISOString(),
      appointmentNumber,
      regNumber,
      phone,
      email,
      date,
      time,
      teller,
    };

    await appendAppointment(row);

    return NextResponse.json({
      appointmentNumber,
      date,
      time,
      teller,
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


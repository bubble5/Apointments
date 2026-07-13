import { NextResponse } from "next/server";
import { findAppointmentByNumber } from "@/lib/sheets";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const appointmentNumber = (searchParams.get("appointmentNumber") || "").trim();

    if (!appointmentNumber) {
      return NextResponse.json({ error: "appointmentNumber is required." }, { status: 400 });
    }

    const appointment = await findAppointmentByNumber(appointmentNumber);
    if (!appointment) {
      return NextResponse.json({ error: "No appointment found with that number." }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Something went wrong during lookup." },
      { status: 500 }
    );
  }
}

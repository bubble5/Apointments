import { NextResponse } from "next/server";
import {
  getConfig,
  listUpcomingBusinessDates,
  dailyCapacity,
  getDayAvailability,
  dateKey,
} from "@/lib/scheduling";
import { getAllAppointments } from "@/lib/sheets";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const daysParam = parseInt(searchParams.get("days") || "14", 10);

    const config = getConfig();
    const allAppointments = await getAllAppointments();

    // Slot-level availability for one specific day.
    if (dateParam) {
      if (!DATE_RE.test(dateParam)) {
        return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
      }
      const bookedForDate = allAppointments
        .filter((a) => a.date === dateParam)
        .map((a) => ({ time: a.time, teller: a.teller }));
      const slots = getDayAvailability(config, bookedForDate);
      return NextResponse.json({ date: dateParam, slots });
    }

    // Day-level availability for the next N bookable days.
    const upcoming = listUpcomingBusinessDates(config, Math.min(daysParam, 60));
    const capacity = dailyCapacity(config);
    const todayKey = dateKey(new Date());

    const days = upcoming.map((d) => {
      const count = allAppointments.filter((a) => a.date === d).length;
      const remaining = Math.max(0, capacity - count);
      return {
        date: d,
        remaining,
        total: capacity,
        full: remaining <= 0,
        isToday: d === todayKey,
      };
    });

    return NextResponse.json({ days, slotMinutes: config.slotMinutes });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to load availability." },
      { status: 500 }
    );
  }
}

"use client";

import { useEffect, useState } from "react";
import { emailError, phoneError } from "@/lib/validate";

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Page() {
  const [days, setDays] = useState(null);
  const [daysError, setDaysError] = useState("");

  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState(null);
  const [slotsError, setSlotsError] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [selectedTime, setSelectedTime] = useState(null);

  const [form, setForm] = useState({ regNumber: "", phone: "", email: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch("/api/availability?days=14")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setDaysError(data.error);
        } else {
          setDays(data.days);
        }
      })
      .catch(() => setDaysError("Couldn't load available dates. Refresh to try again."));
  }, []);

  function pickDate(dateStr) {
    setSelectedDate(dateStr);
    setSelectedTime(null);
    setSlots(null);
    setSlotsError("");
    setLoadingSlots(true);
    fetch(`/api/availability?date=${dateStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setSlotsError(data.error);
        } else {
          setSlots(data.slots);
        }
      })
      .catch(() => setSlotsError("Couldn't load time slots. Try picking the date again."))
      .finally(() => setLoadingSlots(false));
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((fe) => ({ ...fe, [field]: null }));
  }

  function validateField(field, value) {
    let msg = null;
    if (field === "regNumber" && !value.trim()) msg = "Reg number is required.";
    if (field === "phone") msg = phoneError(value);
    if (field === "email") msg = emailError(value);
    setFieldErrors((fe) => ({ ...fe, [field]: msg }));
    return msg;
  }

  function validateAll() {
    const regMsg = form.regNumber.trim() ? null : "Reg number is required.";
    const phoneMsg = phoneError(form.phone);
    const emailMsg = emailError(form.email);
    setFieldErrors({ regNumber: regMsg, phone: phoneMsg, email: emailMsg });
    return !regMsg && !phoneMsg && !emailMsg;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!selectedDate || !selectedTime) {
      setError("Pick a date and time first.");
      return;
    }
    if (!validateAll()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date: selectedDate, time: selectedTime }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed. Try again.");
        // The slot may have just been taken — refresh availability for this date.
        if (res.status === 409 && selectedDate) pickDate(selectedDate);
        return;
      }
      setResult(data);
    } catch (err) {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ regNumber: "", phone: "", email: "" });
    setFieldErrors({});
    setResult(null);
    setError("");
    setSelectedDate(null);
    setSelectedTime(null);
    setSlots(null);
  }

  return (
    <div className="stage">
      <div className="masthead">
        <p className="eyebrow">ID Collection Desk</p>
        <h1>Book your ID pickup slot</h1>
      </div>

      <div className="ticket">
        {!result ? (
          <div className="ticket-top">
            <p className="office">Appointment Request</p>
            <p className="service">CHOOSE A DATE, THEN A TIME</p>

            {/* Step 1: date picker */}
            <div className="field">
              <label>Date</label>
              {daysError && <p className="field-error">{daysError}</p>}
              {!days && !daysError && <p className="loading-note">Loading available dates…</p>}
              {days && (
                <div className="day-grid">
                  {days.map((d) => (
                    <button
                      type="button"
                      key={d.date}
                      className={`day-chip${selectedDate === d.date ? " selected" : ""}${
                        d.full ? " disabled" : ""
                      }`}
                      disabled={d.full}
                      onClick={() => pickDate(d.date)}
                    >
                      <span className="day-chip-label">{formatDateLabel(d.date)}</span>
                      <span className="day-chip-sub">{d.full ? "Full" : `${d.remaining} open`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: time picker, once a date is chosen */}
            {selectedDate && (
              <div className="field">
                <label>Time</label>
                {loadingSlots && <p className="loading-note">Loading time slots…</p>}
                {slotsError && <p className="field-error">{slotsError}</p>}
                {slots && (
                  <div className="time-grid">
                    {slots.map((s) => (
                      <button
                        type="button"
                        key={s.time}
                        className={`time-chip${selectedTime === s.time ? " selected" : ""}${
                          s.full ? " disabled" : ""
                        }`}
                        disabled={s.full}
                        onClick={() => setSelectedTime(s.time)}
                        title={s.full ? "Full" : `${s.remaining} of ${s.total} open`}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: details form, once date + time are chosen */}
            {selectedDate && selectedTime && (
              <form onSubmit={handleSubmit} noValidate>
                <div className="selection-summary">
                  Booking for <strong>{formatDateLabel(selectedDate)}</strong> at{" "}
                  <strong>{selectedTime}</strong>
                </div>

                <div className="field">
                  <label htmlFor="regNumber">Reg Number</label>
                  <input
                    id="regNumber"
                    type="text"
                    placeholder="e.g. 2023/BSC/0142"
                    value={form.regNumber}
                    onChange={(e) => update("regNumber", e.target.value)}
                    onBlur={(e) => validateField("regNumber", e.target.value)}
                  />
                  {fieldErrors.regNumber && <p className="field-error">{fieldErrors.regNumber}</p>}
                </div>

                <div className="field">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="e.g. 078 123 4567"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    onBlur={(e) => validateField("phone", e.target.value)}
                  />
                  {fieldErrors.phone && <p className="field-error">{fieldErrors.phone}</p>}
                </div>

                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="e.g. you@mkur.ac.rw"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={(e) => validateField("email", e.target.value)}
                  />
                  {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
                </div>

                {error && <p className="error-msg">{error}</p>}

                <button className="submit-btn" type="submit" disabled={loading}>
                  {loading ? "Booking..." : "Book appointment"}
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="ticket-top">
              <p className="office">{result.orgName || "ID Collection Desk"}</p>
              <p className="service">APPOINTMENT CONFIRMED</p>
            </div>
            <div className="perforation" />
            <div className="ticket-stub">
              <p className="stub-label">Appointment Number</p>
              <p className="stub-number">{result.appointmentNumber}</p>
              <div className="stub-grid">
                <div className="stub-item">
                  <p className="k">Date</p>
                  <p className="v">{result.date}</p>
                </div>
                <div className="stub-item">
                  <p className="k">Time</p>
                  <p className="v">{result.time}</p>
                </div>
                <div className="stub-item">
                  <p className="k">Teller</p>
                  <p className="v">{result.teller}</p>
                </div>
              </div>
              <button className="new-booking" onClick={resetForm}>
                Book another appointment
              </button>
            </div>
          </>
        )}
      </div>

      <p className="footnote">Keep your appointment number — you'll need it at the counter.</p>
    </div>
  );
}

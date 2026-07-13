"use client";

import { useState } from "react";

export default function Page() {
  const [form, setForm] = useState({ regNumber: "", phone: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed. Try again.");
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
    setResult(null);
    setError("");
  }

  return (
    <div className="stage">
      <div className="masthead">
        <p className="eyebrow">ID Collection Desk</p>
        <h1>Book your ID pickup slot</h1>
      </div>

      <div className="ticket">
        {!result ? (
          <form className="ticket-top" onSubmit={handleSubmit}>
            <p className="office">{"Appointment Request"}</p>
            <p className="service">FILL IN YOUR DETAILS BELOW</p>

            <div className="field">
              <label htmlFor="regNumber">Reg Number</label>
              <input
                id="regNumber"
                type="text"
                placeholder="e.g. 2023/BSC/0142"
                value={form.regNumber}
                onChange={(e) => update("regNumber", e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                placeholder="e.g. 078 123 4567"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="e.g. you@mkur.ac.rw"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? "Booking..." : "Book appointment"}
            </button>
          </form>
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

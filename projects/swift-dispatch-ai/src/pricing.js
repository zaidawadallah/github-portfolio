// Deterministic quote engine. The AI only extracts facts; prices are always
// computed here so a model can never invent a number for a customer.
// Rates below are SAMPLE demo rates, not a published price list.

export const RATES = {
  tow: { base: 95, perMile: 4, freeMiles: 5 },
  accident_recovery: { base: 250, perMile: 5, freeMiles: 5 },
  jump_start: { base: 75 },
  lockout: { base: 75 },
  tire_change: { base: 85 },
  fuel_delivery: { base: 80, fuelFee: 15 },
  winch_out: { base: 150 },
};

export const CLASS_MULTIPLIER = { light_duty: 1.0, motorcycle: 1.15, medium_duty: 1.6 };
export const NIGHT_SURCHARGE = 35; // 9 PM - 6 AM
export const HIGHWAY_SURCHARGE = 25;

export function isNight(date) {
  const h = date.getHours();
  return h >= 21 || h < 6;
}

const round2 = (n) => Math.round(n * 100) / 100;

export function quote(job, now = new Date()) {
  const rate = RATES[job.service_type];
  if (!rate) return { ok: false, reason: "Service type not identified yet", lines: [], total: null };

  const cls = job.vehicle?.vehicle_class || "light_duty";
  const mult = CLASS_MULTIPLIER[cls] ?? 1;
  const lines = [];

  lines.push({ label: `Base (${job.service_type.replace(/_/g, " ")})`, amount: rate.base });

  if (rate.perMile) {
    if (job.estimated_miles == null) {
      lines.push({ label: `Mileage: $${rate.perMile}/mi after ${rate.freeMiles} mi (distance TBD)`, amount: 0 });
    } else {
      const billable = Math.max(0, job.estimated_miles - rate.freeMiles);
      lines.push({ label: `Mileage: ${billable} billable mi × $${rate.perMile}`, amount: round2(billable * rate.perMile) });
    }
  }
  if (rate.fuelFee) lines.push({ label: "Fuel (2 gal)", amount: rate.fuelFee });

  let subtotal = lines.reduce((s, l) => s + l.amount, 0);
  if (mult !== 1) {
    const extra = round2(subtotal * (mult - 1));
    lines.push({ label: `${cls.replace(/_/g, " ")} vehicle (×${mult})`, amount: extra });
    subtotal += extra;
  }
  if (job.safety_flags?.includes("on_highway")) {
    lines.push({ label: "Highway / shoulder response", amount: HIGHWAY_SURCHARGE });
    subtotal += HIGHWAY_SURCHARGE;
  }
  if (isNight(now)) {
    lines.push({ label: "After-hours (9 PM–6 AM)", amount: NIGHT_SURCHARGE });
    subtotal += NIGHT_SURCHARGE;
  }

  const total = round2(subtotal);
  const pending = rate.perMile && job.estimated_miles == null;
  return { ok: true, lines, total, isEstimateOnly: pending };
}

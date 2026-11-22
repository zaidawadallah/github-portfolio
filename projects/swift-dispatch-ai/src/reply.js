// Builds the SMS reply a dispatcher can send back to the customer.

export function draftReply(job, q, companyName = "Swift Towing") {
  const parts = [`Hi, this is ${companyName}. We got your request.`];

  if (job.safety_flags?.includes("possible_injury") || job.safety_flags?.includes("hazard")) {
    parts.push("If anyone is hurt or there is smoke or fire, please call 911 first.");
  }
  if (job.safety_flags?.includes("on_highway")) {
    parts.push("Please stay in your vehicle with your seatbelt on and hazards flashing, or stand well away from traffic.");
  }

  if (q.ok) {
    const price = `$${q.total.toFixed(2)}`;
    parts.push(q.isEstimateOnly
      ? `Our starting price is ${price} plus mileage once we confirm the drop-off distance.`
      : `Your estimated price is ${price}.`);
  }

  const qs = job.missing_info_questions || [];
  if (qs.length) {
    parts.push("To dispatch a truck, please reply with:");
    qs.slice(0, 3).forEach((x, i) => parts.push(`${i + 1}) ${x}`));
  } else {
    parts.push("A driver is being assigned now and we'll text you the ETA shortly.");
  }
  return parts.join(" ");
}

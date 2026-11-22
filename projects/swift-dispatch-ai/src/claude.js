// Claude engine: sends the customer message to the Anthropic Messages API and forces
// a structured tool call so the response always matches JOB_SCHEMA.
// The API key is typed in by the user, kept in memory only, and sent only to api.anthropic.com.

import { SERVICE_TYPES } from "./extract.js";

export const JOB_SCHEMA = {
  type: "object",
  properties: {
    service_type: { type: ["string", "null"], enum: [...SERVICE_TYPES, null] },
    vehicle: {
      type: "object",
      properties: {
        year: { type: ["integer", "null"] },
        make: { type: ["string", "null"] },
        model: { type: ["string", "null"] },
        vehicle_class: { type: "string", enum: ["light_duty", "medium_duty", "motorcycle"] },
      },
      required: ["year", "make", "model", "vehicle_class"],
    },
    pickup_location: { type: ["string", "null"] },
    destination: { type: ["string", "null"] },
    estimated_miles: { type: ["number", "null"], description: "Only if the customer states a distance" },
    urgency: { type: "string", enum: ["normal", "high", "emergency"] },
    safety_flags: {
      type: "array",
      items: { type: "string", enum: ["on_highway", "children_present", "unsafe_conditions", "possible_injury", "hazard"] },
    },
    callback_phone: { type: ["string", "null"] },
    missing_info_questions: { type: "array", items: { type: "string" } },
    summary: { type: "string", description: "One-line dispatcher summary" },
  },
  required: ["service_type", "vehicle", "pickup_location", "destination", "estimated_miles",
    "urgency", "safety_flags", "callback_phone", "missing_info_questions", "summary"],
};

export const SYSTEM_PROMPT = `You are the intake assistant for a towing and roadside-assistance dispatcher in the Houston, Texas area.
Read the customer's message and record the job with the record_tow_request tool.
Rules:
- Extract only what the customer actually said. Use null for anything not stated. Never guess a distance.
- vehicle_class is medium_duty for 3/4-ton and larger pickups, vans, box trucks and RVs; motorcycle for bikes; otherwise light_duty.
- Add on_highway if the vehicle is on a highway, interstate, feeder road or shoulder.
- urgency is emergency for injuries, smoke, fire or fuel leaks; high for any other safety flag; otherwise normal.
- missing_info_questions: short questions a dispatcher must ask before sending a truck (exact location, vehicle, destination for tows, callback number). Max 4.
- Do not produce prices. Pricing is calculated separately.`;

export async function extractWithClaude(text, apiKey, model = "claude-sonnet-5-5") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [{ name: "record_tow_request", description: "Record a structured tow/roadside job", input_schema: JOB_SCHEMA }],
      tool_choice: { type: "tool", name: "record_tow_request" },
      messages: [{ role: "user", content: text }],
    }),
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { msg = (await res.json()).error?.message || msg; } catch { /* keep status text */ }
    throw new Error(`Claude API error: ${msg}`);
  }
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "tool_use");
  if (!block) throw new Error("Claude did not return a structured job");
  return normalize(block.input);
}

// Defensive normalization so the UI and pricing never break on a partial response.
export function normalize(j) {
  const v = j.vehicle || {};
  return {
    service_type: SERVICE_TYPES.includes(j.service_type) ? j.service_type : null,
    vehicle: {
      year: Number.isInteger(v.year) ? v.year : null,
      make: v.make || null,
      model: v.model || null,
      vehicle_class: ["light_duty", "medium_duty", "motorcycle"].includes(v.vehicle_class) ? v.vehicle_class : "light_duty",
    },
    pickup_location: j.pickup_location || null,
    destination: j.destination || null,
    estimated_miles: typeof j.estimated_miles === "number" ? j.estimated_miles : null,
    urgency: ["normal", "high", "emergency"].includes(j.urgency) ? j.urgency : "normal",
    safety_flags: Array.isArray(j.safety_flags) ? j.safety_flags : [],
    callback_phone: j.callback_phone || null,
    missing_info_questions: Array.isArray(j.missing_info_questions) ? j.missing_info_questions.slice(0, 4) : [],
    summary: j.summary || "",
  };
}

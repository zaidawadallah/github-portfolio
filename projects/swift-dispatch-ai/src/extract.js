// Offline (rule-based) extractor for tow / roadside requests.
// Used as the no-API-key demo engine and as a fallback when the AI call fails.
// Output shape matches the schema the Claude engine is asked to fill (see schema.js).

export const SERVICE_TYPES = [
  "tow",
  "jump_start",
  "lockout",
  "tire_change",
  "fuel_delivery",
  "winch_out",
  "accident_recovery",
];

const MAKES = [
  "acura", "audi", "bmw", "buick", "cadillac", "chevy", "chevrolet", "chrysler",
  "dodge", "ford", "gmc", "honda", "hyundai", "infiniti", "jeep", "kia", "lexus",
  "lincoln", "mazda", "mercedes", "nissan", "ram", "subaru", "tesla", "toyota",
  "volkswagen", "vw", "volvo", "mitsubishi", "genesis", "land rover", "mini",
];

const MEDIUM_DUTY = /\b(f-?[2-5]50|[2-5]500\b|super duty|dually|box truck|rv\b|motorhome|cargo van|sprinter|u-?haul)/i;
const MOTORCYCLE = /\b(motorcycle|harley|motorbike|scooter)\b/i;
const HIGHWAY = /\b(i-?\s?\d{1,3}|interstate|highway|hwy|freeway|beltway\s?8?|tollway|feeder|frontage|shoulder|sh[-\s]?\d{2,3}|us[-\s]?\d{2,3}|fm[-\s]?\d{3,4}|288|610|59|45|10)\b/i;

const SERVICE_RULES = [
  { type: "accident_recovery", re: /\b(accident|crash|wreck|collision|hit (by|a)|rear[- ]ended|totaled)\b/i },
  { type: "winch_out", re: /\b(stuck|ditch|mud|sand|winch|slid off|off the road)\b/i },
  { type: "lockout", re: /\b(locked (my )?keys|keys? (locked )?in(side)? the (car|truck)|lock(ed)? out|lockout)\b/i },
  { type: "fuel_delivery", re: /\b(out of (gas|fuel)|ran out of (gas|fuel)|empty tank|no gas)\b/i },
  { type: "tire_change", re: /\b(flat( tire)?|blowout|blew a tire|tire (is )?(flat|blown)|spare)\b/i },
  { type: "jump_start", re: /\b(jump|dead battery|battery (is )?dead|battery died|clicking)\b/i },
  { type: "tow", re: /\b(tow|towed|haul|transport|won'?t start|broke down|broken down|overheat|engine (died|blew)|transmission)\b/i },
];

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function detectService(text) {
  const explicitTow = /\b(tow|towed|need (a )?tow|tow truck)\b/i.test(text);
  for (const rule of SERVICE_RULES) {
    if (rule.re.test(text)) {
      // An explicit tow request wins over lighter services (e.g. "won't start, need a tow").
      if (explicitTow && ["jump_start", "tire_change", "fuel_delivery"].includes(rule.type)) return "tow";
      return rule.type;
    }
  }
  return null;
}

export function detectVehicle(text) {
  const out = { year: null, make: null, model: null, vehicle_class: "light_duty" };
  const yearMatch = text.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (yearMatch) out.year = Number(yearMatch[1]);
  const lower = text.toLowerCase();
  for (const make of MAKES) {
    const idx = lower.search(new RegExp(`\\b${make}\\b`));
    if (idx !== -1) {
      out.make = make === "chevy" ? "Chevrolet" : make === "vw" ? "Volkswagen" : titleCase(make);
      const rest = text.slice(idx + make.length);
      const multi = rest.match(/^\s+(grand cherokee|grand caravan|grand marquis|santa fe|model [3sxy]|range rover|town (?:and|&) country|land cruiser|monte carlo)\b/i);
      if (multi) { out.model = titleCase(multi[1].toLowerCase()); break; }
      const after = rest.match(/^\s+([A-Za-z0-9-]+(?:\s(?:\d{3,4}|[A-Z]{2,3}))?)/);
      if (after && !/^(is|that|and|on|at|in|near|broke|won|has|with)$/i.test(after[1])) {
        out.model = after[1].toUpperCase() === after[1] ? after[1] : titleCase(after[1]);
      }
      break;
    }
  }
  if (MOTORCYCLE.test(text)) out.vehicle_class = "motorcycle";
  else if (MEDIUM_DUTY.test(text)) out.vehicle_class = "medium_duty";
  return out;
}

function cleanPlace(s) {
  return s
    .replace(/\s+(and|but|so|because|it|my|i|im|i'm|need|can|please)\b.*$/i, "")
    .replace(/[.,;!?]+$/, "")
    .trim();
}

export function detectLocation(text) {
  const m = text.match(/\b(?:i'?m|we'?re|it'?s|stuck|stranded|broke down|sitting|parked)?\s*(?:on|at|near|off of|off)\s+((?:the\s+)?[A-Za-z0-9 .'-]{3,60}?)(?=[,.;!?]|\s+(?:and|but|need|can|it|my)\b|$)/i);
  return m ? cleanPlace(m[1]) || null : null;
}

export function detectDestination(text) {
  const m = text.match(/\b(?:tow(?:ed)?(?: it)?|take(?: it)?|taken|bring(?: it)?|haul(?: it)?|drop(?: it)?(?: off)?|go(?:ing)?)\s+to\s+(?:the\s+)?([A-Za-z0-9 .'&-]{3,60}?)(?=[,.;!?]|\s+(?:about|around|which|that|its|it's|in about)\b|$)/i);
  return m ? cleanPlace(m[1]) || null : null;
}

export function detectMiles(text) {
  const m = text.match(/\b(\d{1,3}(?:\.\d)?)\s*(?:mi\b|miles?)/i);
  return m ? Number(m[1]) : null;
}

export function detectSafety(text, location) {
  const flags = [];
  const loc = location || "";
  if (HIGHWAY.test(loc) || /\b(shoulder|highway|freeway|interstate|feeder)\b/i.test(text)) flags.push("on_highway");
  if (/\b(kids?|child(ren)?|baby|infant)\b/i.test(text)) flags.push("children_present");
  if (/\b(dark|night|no lights|unsafe|scared|dangerous)\b/i.test(text)) flags.push("unsafe_conditions");
  if (/\b(injur(ed|y)|hurt|bleeding|ambulance)\b/i.test(text)) flags.push("possible_injury");
  if (/\b(smok(e|ing)|fire|on fire|leaking|gas smell)\b/i.test(text)) flags.push("hazard");
  return flags;
}

export function extractOffline(text) {
  const service_type = detectService(text);
  const vehicle = detectVehicle(text);
  const pickup_location = detectLocation(text);
  const destination = service_type === "tow" || service_type === "accident_recovery" ? detectDestination(text) : null;
  const estimated_miles = detectMiles(text);
  const safety_flags = detectSafety(text, pickup_location);
  const phone = (text.match(/\b(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/) || [])[1] || null;

  let urgency = "normal";
  if (safety_flags.includes("possible_injury") || safety_flags.includes("hazard")) urgency = "emergency";
  else if (safety_flags.length) urgency = "high";

  const missing = [];
  if (!service_type) missing.push("What service do you need (tow, jump start, lockout, tire change, fuel)?");
  if (!pickup_location) missing.push("What is your exact location or nearest cross street / exit?");
  if (!vehicle.make) missing.push("What is the year, make and model of the vehicle?");
  if ((service_type === "tow" || service_type === "accident_recovery") && !destination)
    missing.push("Where would you like the vehicle towed?");
  if (!phone) missing.push("What is the best callback number?");

  return {
    service_type,
    vehicle,
    pickup_location,
    destination,
    estimated_miles,
    urgency,
    safety_flags,
    callback_phone: phone,
    missing_info_questions: missing,
    summary: buildSummary({ service_type, vehicle, pickup_location, destination }),
  };
}

function buildSummary({ service_type, vehicle, pickup_location, destination }) {
  const v = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unknown vehicle";
  const s = service_type ? service_type.replace(/_/g, " ") : "unspecified service";
  let out = `${titleCase(s)} for ${v}`;
  if (pickup_location) out += ` at ${pickup_location}`;
  if (destination) out += ` → ${destination}`;
  return out;
}

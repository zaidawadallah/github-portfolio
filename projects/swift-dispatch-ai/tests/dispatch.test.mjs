// Run with: node --test projects/swift-dispatch-ai/tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractOffline, detectService, detectVehicle } from "../src/extract.js";
import { quote } from "../src/pricing.js";
import { normalize } from "../src/claude.js";
import { draftReply } from "../src/reply.js";

const DAY = new Date("2026-11-20T14:00:00");
const NIGHT = new Date("2026-11-20T23:30:00");

test("highway breakdown is a tow with destination, miles and highway flag", () => {
  const j = extractOffline("My 2015 Ford F-150 won't start, I'm on the shoulder of 288 near the Manvel exit. Need a tow to my house in Pearland, about 12 miles. Call me at 281-555-0147");
  assert.equal(j.service_type, "tow");
  assert.equal(j.vehicle.year, 2015);
  assert.equal(j.vehicle.make, "Ford");
  assert.equal(j.vehicle.model, "F-150");
  assert.equal(j.estimated_miles, 12);
  assert.ok(j.safety_flags.includes("on_highway"));
  assert.equal(j.urgency, "high");
  assert.match(j.destination, /house in Pearland/);
  assert.equal(j.callback_phone, "281-555-0147");
});

test("lockout detected and no destination asked", () => {
  const j = extractOffline("I locked my keys inside my 2019 Honda Civic at the HEB on Broadway. 832-555-0199");
  assert.equal(j.service_type, "lockout");
  assert.equal(j.destination, null);
  assert.ok(!j.missing_info_questions.some((q) => /towed/.test(q)));
});

test("smoke after accident is an emergency", () => {
  const j = extractOffline("Accident on I-45, my 2020 Toyota Camry is smoking");
  assert.equal(j.service_type, "accident_recovery");
  assert.equal(j.urgency, "emergency");
});

test("explicit tow beats jump start wording", () => {
  assert.equal(detectService("battery is dead and it won't start, I need a tow"), "tow");
  assert.equal(detectService("battery is dead, can someone jump me"), "jump_start");
});

test("heavy pickup is medium duty", () => {
  assert.equal(detectVehicle("2018 Ford F-250 super duty").vehicle_class, "medium_duty");
  assert.equal(detectVehicle("2016 Infiniti QX80").vehicle_class, "light_duty");
});

test("missing info produces questions", () => {
  const j = extractOffline("need help");
  assert.equal(j.service_type, null);
  assert.ok(j.missing_info_questions.length >= 3);
});

test("tow quote: base + billable miles + highway, daytime", () => {
  const q = quote({ service_type: "tow", vehicle: { vehicle_class: "light_duty" }, estimated_miles: 12, safety_flags: ["on_highway"] }, DAY);
  // 95 + (12-5)*4 + 25 = 148
  assert.equal(q.total, 148);
  assert.equal(q.isEstimateOnly, false);
});

test("medium duty multiplier and night surcharge", () => {
  const q = quote({ service_type: "lockout", vehicle: { vehicle_class: "medium_duty" }, safety_flags: [] }, NIGHT);
  // 75 * 1.6 = 120, + 35 night = 155
  assert.equal(q.total, 155);
});

test("unknown distance marks quote as starting price", () => {
  const q = quote({ service_type: "tow", vehicle: { vehicle_class: "light_duty" }, estimated_miles: null, safety_flags: [] }, DAY);
  assert.equal(q.total, 95);
  assert.equal(q.isEstimateOnly, true);
});

test("no service means no quote", () => {
  assert.equal(quote({ service_type: null }, DAY).ok, false);
});

test("normalize repairs a partial AI response", () => {
  const j = normalize({ service_type: "teleport", vehicle: { year: "2015" }, urgency: "panic" });
  assert.equal(j.service_type, null);
  assert.equal(j.vehicle.year, null);
  assert.equal(j.vehicle.vehicle_class, "light_duty");
  assert.equal(j.urgency, "normal");
  assert.deepEqual(j.safety_flags, []);
});

test("reply includes 911 advice for hazards and the price", () => {
  const job = extractOffline("Accident on I-45, my 2020 Toyota Camry is smoking, take it to the body shop on Edgebrook, about 6 miles");
  const r = draftReply(job, quote(job, DAY));
  assert.match(r, /911/);
  assert.match(r, /\$\d+\.\d{2}/);
});

test("two-word model and 'taken to' destination", () => {
  const j = extractOffline("Accident on I-45, my 2011 Jeep Grand Cherokee needs to be taken to the body shop on Edgebrook, about 6 miles");
  assert.equal(j.vehicle.model, "Grand Cherokee");
  assert.match(j.destination, /body shop on Edgebrook/);
  assert.equal(j.estimated_miles, 6);
});

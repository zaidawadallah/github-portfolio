# AI Prompt Log — Swift Dispatch AI

**Student:** Zaid Awadallah · **Course:** COSC 4272 Senior Seminar · **AI tool:** Claude (Anthropic), used as a pair programmer  
**Project:** Swift Dispatch AI (`projects/swift-dispatch-ai`)

This log records the main prompts used while building the project, what the AI produced, and what I kept, changed or rejected. It also contains the production prompt the app sends to the Claude API.

---

## Part A — Development prompts

### 1. Problem framing
**Prompt:**
> I run a towing company. Customers text or leave voicemails like "my truck died on 288 near Manvel need a tow to Pearland". I want a small web app that turns that message into a dispatch ticket, a price estimate and a reply text. It must run on GitHub Pages with no backend. Propose an architecture.

**AI output (summary):** A static single-page app that calls an LLM to return JSON, plus a pricing step and a reply template.  
**Decision — modified.** I accepted the static design but added two requirements the first proposal lacked: (1) the AI must **not** calculate prices, and (2) the app must still work with no API key, so graders and employers can try it.

### 2. Structured output
**Prompt:**
> How do I force Claude to always return JSON that matches a schema instead of free text? Show the Messages API request.

**AI output:** Use tool use: define a tool with an `input_schema` and set `tool_choice` to that tool, then read the `tool_use` block.  
**Decision — accepted.** Implemented in `src/claude.js` as the `record_tow_request` tool with `JOB_SCHEMA`.

### 3. Schema design
**Prompt:**
> Design the JSON schema for a tow/roadside job. Fields a dispatcher needs before sending a truck. Use enums wherever possible.

**AI output:** Service type, vehicle, pickup, destination, distance, urgency, safety flags, phone, missing-info questions, summary.  
**Decision — modified.** I added `vehicle_class` (light / medium duty / motorcycle) because truck size changes which truck we send and the price. I removed a proposed `price` field (see prompt 1).

### 4. Offline fallback engine
**Prompt:**
> Write a rule-based JavaScript extractor with the same output shape, using regular expressions for service type, year/make/model, location, destination, miles and phone. Houston highways like 288, I-45, Beltway 8, FM roads should count as highway.

**AI output:** `extract.js` with keyword rules.  
**Decision — modified after testing.** Problems I found and fixed with follow-up prompts:
- "won't start, I need a tow" was classified as a jump start → an explicit "tow" now wins over lighter services.
- "Jeep Grand Cherokee" became model "Grand" → added a list of two-word models.
- "is smoking" did not trigger the hazard flag (regex only matched "smoke") → fixed and covered by a test.
- "needs to be taken to the body shop" missed the destination → added "taken to".

### 5. Pricing engine
**Prompt:**
> Write a pure function quote(job, now) with a rate table: tow base + per-mile after free miles, flat services, a medium-duty multiplier, a highway surcharge and an after-hours surcharge from 9 PM to 6 AM. Return itemized lines.

**Decision — accepted with changes.** I set the rates (demo values), and added `isEstimateOnly` so a tow with unknown distance shows a *starting* price instead of a misleading total.

### 6. Tests
**Prompt:**
> Write node:test unit tests for the extractor, the pricing rules and normalize(). Include an AI response with invalid values.

**Decision — accepted and extended.** 13 tests; I added the tests for the bugs in prompt 4 so they cannot come back.

### 7. Security review
**Prompt:**
> Review this app for security problems. The user pastes an API key in the browser and the model's output is rendered into the page.

**AI output:** Escape all model output before inserting into HTML; never store the key in localStorage or commit it; send it only to api.anthropic.com; note that a browser-side key is acceptable for a personal demo but production needs a backend proxy.  
**Decision — accepted.** All output goes through `esc()`; the key lives only in memory; the backend proxy is listed as a next step.

### 8. Customer reply wording
**Prompt:**
> Write the SMS reply template. If the car is on a highway, tell them to stay safe. If there is smoke or an injury, tell them to call 911 first. Ask at most 3 questions.

**Decision — accepted**, with wording edited to sound like our company.

---

## Part B — Production prompt (sent by the app)

**System prompt** (`src/claude.js → SYSTEM_PROMPT`):

```
You are the intake assistant for a towing and roadside-assistance dispatcher in the Houston, Texas area.
Read the customer's message and record the job with the record_tow_request tool.
Rules:
- Extract only what the customer actually said. Use null for anything not stated. Never guess a distance.
- vehicle_class is medium_duty for 3/4-ton and larger pickups, vans, box trucks and RVs; motorcycle for bikes; otherwise light_duty.
- Add on_highway if the vehicle is on a highway, interstate, feeder road or shoulder.
- urgency is emergency for injuries, smoke, fire or fuel leaks; high for any other safety flag; otherwise normal.
- missing_info_questions: short questions a dispatcher must ask before sending a truck (exact location, vehicle, destination for tows, callback number). Max 4.
- Do not produce prices. Pricing is calculated separately.
```

**Why it is written this way**
- "Use null… never guess a distance" prevents hallucinated facts that would change the price.
- Explicit rules for `vehicle_class` and `urgency` make results consistent between runs.
- `tool_choice` forces the `record_tow_request` tool, so the response always matches the schema; `normalize()` repairs anything invalid.

---

## Part C — Reflection
- **Where AI helped most:** API usage (tool use), boilerplate, first drafts of regular expressions and tests.
- **Where I had to intervene:** business rules (who sets prices, vehicle classes, safety wording) and edge cases that only showed up when I ran real-style messages through it.
- **Main lesson:** treat AI output like a junior developer's pull request. It is fast, but it must be tested against real inputs before it is trusted.

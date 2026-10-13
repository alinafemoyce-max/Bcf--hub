# WoodmillFlow: IT Discussion Brief

**Prepared by:** Second-year boatbuilding apprentice and apprentice representative, Business Communication Forum (BCF)
**For:** Discussion with the IT Director, 15 October 2026
**Status:** Independent proof of concept. Not approved for operational use, not connected to company systems, fictional data only.

---

## 1. Identified problem

Woodmill cutting requests are currently submitted on paper forms. After speaking with a woodmill operator, I believe paper-based requests **may** create:

- avoidable administration for the woodmill,
- requests with missing or unclear information,
- limited visibility of where a job is,
- unnecessary status enquiries ("is my material ready?").

**These are hypotheses to validate, not proven findings.** I have not measured them.

## 2. Proposed concept

A **QR-code-accessible request form** that employees open on a phone, feeding a **shared digital work queue** for the woodmill operator:

1. The employee scans a QR code in the workshop and completes a structured request (clock number, department, production line, and one or more cutting items with material, dimensions, quantity, grain direction and machining requirements).
2. The request appears in the woodmill queue with a reference and an automatic date and time.
3. The operator accepts it, updates its progress, and marks it ready for collection and then collected.
4. The employee checks the status on their phone.

A working demonstration (WoodmillFlow) shows this end to end.

## 3. Potential advantages (to be tested)

- Better order visibility for employees and the woodmill
- More consistent request information (required fields, validated measurements)
- Clearer status communication, with fewer "is it ready?" enquiries
- Easier retrieval of past and completed requests
- Potential reduction in paper administration

## 4. Dependencies and considerations

| Area | Questions |
| --- | --- |
| **Existing IT systems** | Is there already a system (for example ERP/MES or a maintenance or job system) that covers this? |
| **Cybersecurity and governance** | Hosting, sign-in (for example Microsoft Entra ID), access control, security review, change approval. |
| **Device access on the shop floor** | Are personal or company phones allowed? Is there Wi-Fi or signal in the workshops? Is a shared tablet at the woodmill an option? |
| **Operator workflow** | Would the operator use a screen at the woodmill? How do they prioritise today? |
| **Data privacy** | Clock numbers and names are personal data. Retention period, who can see what, privacy assessment. |
| **User training** | A short briefing for requesters and operators; a fallback process if the system is unavailable. |
| **Integration** | Stock or material records, job and hull numbers, drawings, and notifications (Teams or email). |
| **Support and ownership** | Who would own, support and maintain it? |

## 5. Could existing platforms provide this?

I do **not** assume that custom software is the preferred solution. I would value IT's view on whether existing tools could deliver the same workflow more simply and within current governance:

- **Microsoft Power Apps:** the request form and operator screen
- **Power Automate:** notifications when a status changes
- **SharePoint / Microsoft Lists:** storing requests and history
- **Existing manufacturing or ERP software:** a work-request or job module that may already exist

## 6. How a pilot could be evaluated

If a pilot were authorised, these measures could show whether the concept helps. **None have been measured yet.**

| Measure | How it could be captured |
| --- | --- |
| Time required to submit an order | Timed sample, paper versus digital |
| Time spent processing incoming requests | Operator time sample |
| Number of incomplete requests | Count of requests needing clarification |
| Time from submission to collection | System timestamps |
| Number of order-status enquiries | Operator tally, before and during the pilot |
| Operator administrative workload | Short operator feedback survey |

## 7. Suggested next step

Review whether existing company systems could support this. If appropriate, define a small, **authorised pilot** with:

- a defined area (one shed and the woodmill),
- an agreed duration (for example four weeks),
- an IT-approved platform and sign-in,
- measurable success criteria (section 6),
- a clear fallback to the paper process.

## 8. What I am asking for

1. Your feedback on the concept.
2. Your view on which existing systems might support it.
3. Guidance on whether, and how, an authorised pilot could be explored.

# Enquiries modal: CMS capability audit

## Decision

The current CMS cannot faithfully recreate or evolve the enquiries modal.
It owns a small set of text values and two performance-context switches. The
modal's form sections, field definitions, conditional paths, validation,
submission feedback, and email payload are fixed in the public-site template
and JavaScript.

The project decision is to keep the modal outside the CMS. It is an
application-owned workflow; any future changes will be made directly in code
when a foundational change is needed.

## What is already CMS-controlled

| Capability | Current state |
| --- | --- |
| Kicker, heading, contact labels, submit and footer copy | Editable |
| Three request-path titles and descriptions | Editable; their identifiers and order are protected |
| Airflow and pressure context capture | Editable globally and per trigger |
| Open modal from a CMS button | Supported |
| Draft and publish | Supported |

## What is fixed today

| Area | Fixed implementation |
| --- | --- |
| Contact, helper, attributes, tailored-specification, and notes fields | HTML template |
| Which fields are shown for each request path | JavaScript |
| Field labels, help text, placeholders, field widths, and required rules | HTML template |
| Attribute catalogue and suggested-attribute logic | JavaScript and backend constants |
| Success copy, sending state, error fallback, close delay, and cancel label | JavaScript/template |
| Payload mapping and email formatting | JavaScript and backend |
| Modal layout and visual treatment | Template/CSS |

## Superseded CMS model proposal

The editor should manage one versioned workflow record with this shape:

```text
workflow
  presentation: kicker, heading, footer, success message, cancel/submit labels
  paths: standard, tailored, unsure
    title, description, default trigger mapping
    visible section ids
  sections
    title, help text, visibility rules, display order
    fields
      id, type, label, help, placeholder, required, width
      choices (for select, radio, checkbox)
      storage key, email label, validation rule
  context capture
    enabled catalogue/page values and their display labels
  confirmation
    success heading/body, close behaviour, next action
```

Supported field types should initially be: single-line text, email, telephone,
number, textarea, select, radio group, checkbox group, and read-only context
values. Each field needs a stable `id` and storage key so a content edit does
not lose historical enquiry meaning.

## Required safeguards

- Keep request-path identifiers (`standard`, `tailored`, `unsure`) stable while
  allowing their customer-facing copy and visible fields to change.
- Validate the workflow schema on save and again on publish.
- Keep field types, validation, conditional visibility, and payload mapping as
  a controlled declarative list. Do not allow CMS-authored JavaScript or raw
  form HTML.
- Version published workflows. Store the workflow version and submitted field
  snapshot with each enquiry so historical records remain intelligible.
- Map only configured field keys into the API, sanitise values server-side, and
  retain the honeypot, rate limiting, CSRF/proxy protections, and email-status
  handling already in place.
- Require an accessible label for every input and expose error/success states
  to assistive technology.

## Gaps that matter for the intended customer pathway

1. The CMS cannot add, remove, reorder, or make a field required.
2. It cannot show different questions for standard, tailored, and unsure
   paths.
3. It cannot configure the customer-facing confirmation or failure experience.
4. It cannot configure what submitted data appears in the recipient email.
5. It cannot support an attachment field, which is likely useful for drawings,
   photos, and fabrication briefs.
6. It has no faithful modal preview using the real conditional-path logic.

## Superseded CMS delivery proposal

1. Add the protected workflow schema, server validation, versioning, and a
   real CMS preview. Preserve the current behaviour as the seeded workflow.
2. Replace the fixed public modal markup and JavaScript with a renderer for
   that schema. Verify each of the three paths and existing CTA defaults.
3. Add a secure attachment field for approved file types and size limits.
4. Add configurable recipient routing only if the team needs different
   recipients by path or product type; otherwise retain the existing central
   notification setting.

This sequence lets the current modal be recreated exactly first, then improved
from the CMS without weakening the enquiry workflow's safety or data quality.

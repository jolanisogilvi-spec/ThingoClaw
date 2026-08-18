---
id: preinstalled-skill-integrity
title: Preinstalled Skill Integrity
type: ai-coding-rule
appliesTo:
  - plugin-lifecycle-management
requiredProfiles:
  - fast
---

Preinstalled skill collections must expand to unique top-level skill slugs, preserve source attribution and available license notices, and fail closed when a pinned Git source, local archive checksum, archive version, or `SKILL.md` is missing.

Installer staging must use `resources/preinstalled-skills`; generated skill directories must not be committed. Existing user-managed skill directories without a ThingoClaw preinstalled marker must never be overwritten.

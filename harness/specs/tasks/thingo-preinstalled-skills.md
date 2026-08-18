---
id: thingo-preinstalled-skills
title: Bundle and categorize Thingo preinstalled skills
scenario: plugin-lifecycle-management
taskType: plugin-lifecycle
intent: Bundle 36 authorized Thingo skills into the installer, surface them through a Skills-page category, and preserve non-destructive upgrade behavior.
touchedAreas:
  - resources/skills/**
  - scripts/bundle-preinstalled-skills.mjs
  - electron/utils/skill-config.ts
  - electron/services/skills/local-skill-service.ts
  - shared/types/skill.ts
  - src/stores/skills.ts
  - src/pages/Skills/index.tsx
  - shared/i18n/locales/**/skills.json
  - tests/unit/**skills**
  - tests/e2e/skills-gateway-readiness.spec.ts
expectedUserBehavior:
  - The Skills page shows Thingo before Enabled and Disabled.
  - Thingo filters all 36 categorized skills regardless of enabled state.
  - Fresh installations enable all 36 Thingo skills by default.
  - Upgrades preserve user-managed skills and user-disabled state.
requiredProfiles:
  - fast
  - e2e
requiredRules:
  - preinstalled-skill-integrity
  - docs-sync
requiredTests:
  - pnpm run typecheck
  - tests/unit/preinstalled-skills-manifest.test.ts
  - tests/unit/preinstalled-skills-bundler.test.ts
  - tests/unit/local-skill-service.test.ts
  - tests/unit/skill-config-bundled-defaults.test.ts
  - tests/unit/skills-page-gateway-readiness.test.tsx
  - tests/unit/skills-store-fetch-parallel.test.ts
  - tests/e2e/skills-gateway-readiness.spec.ts
acceptance:
  - The expanded manifest contains exactly 36 unique category=thingo outputs.
  - Qingyun and Chengfeng are pinned to the approved commits.
  - DBSkill 2.18.15 is verified by SHA-256 before safe extraction.
  - Chengfeng exposes only four top-level business skills and retains required shared scripts and notices.
  - Existing preinstalled markers can gain category metadata without skill-content replacement.
  - The packaged Windows artifact contains every generated skill directory and lock entry.
docs:
  required: true
---

Use this task spec when changing the Thingo preinstalled-skill catalog, category propagation, installer staging, or related Skills-page filtering.

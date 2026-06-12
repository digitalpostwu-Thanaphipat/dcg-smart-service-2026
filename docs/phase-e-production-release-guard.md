# Phase E Production Release Guard

Updated: 12 June 2026

Scope: backend/frontend production release safety only. This document does not approve deploy by itself.

## Current Local Status

- Phase A-D code changes are local only.
- GitHub push is not done.
- Apps Script deploy is not done.
- Vercel production is not updated from this local work.
- Current production frontend remains `https://dcg-smart-service-2026.vercel.app`.
- Current production Apps Script Web App URL remains `https://script.google.com/macros/s/AKfycbwSosmXqRi1ByBBMo5h06JkIn0Zc1x4NI9at-btDns8obmcAHuNSCwTNFUwlgpNJqiczw/exec`.

## Release Rule

Deploy only when all checks below have an explicit result recorded.

## Backend Pre-Deploy Checklist

- [ ] Confirm low-usage deployment window.
- [ ] Backup current production `backend.gs` from Apps Script UI.
- [ ] Record current active Apps Script deployment version.
- [ ] Record current active Apps Script Web App URL.
- [ ] Confirm `BACKEND_VERSION` changed with real backend change, not as standalone deploy.
- [ ] Confirm `SCHEMA_REPAIR_APPROVED` is not `true` unless doing approved schema repair.
- [ ] Confirm `ARCHIVE_COPY_APPROVED` is not `true` unless doing approved archive copy.
- [ ] Confirm `ARCHIVE_DELETE_APPROVED` is not `true` unless doing approved archive deletion.
- [ ] Run local `npm.cmd run test`.
- [ ] Run local `npm.cmd run build`.
- [ ] Run local `npm.cmd run lint`.

## Backend Post-Deploy Smoke Test

- [ ] `getHealth` returns success and expected backend version string.
- [ ] `getSchemaAudit` returns `mode: "read_only"`.
- [ ] `getSchemaAudit.status` is `ok` or any mismatch is explicitly reviewed.
- [ ] Staff OTP login works.
- [ ] Staff write flow works for one safe test transaction.
- [ ] Staff report search works for active data.
- [ ] Staff report search works for archive/cross-year data when archive sheet is configured.
- [ ] Self-service OTP login works.
- [ ] Self-service search works for active data.
- [ ] Self-service archive/cross-year search works when archive sheet is configured.
- [ ] `Tx_SelfServiceLog` receives self-service search/export log rows.
- [ ] `Tx_SelfServiceLog` receives staff archive search/export log rows.

## Frontend Pre-Deploy Checklist

- [ ] Confirm Vercel project is `dcg-smart-service-2026`.
- [ ] Confirm Vercel env `VITE_API_URL` equals active Apps Script Web App URL.
- [ ] Confirm GitHub push is intentional because Vercel auto-deploys from `main`.
- [ ] Confirm backend deploy is already smoke-tested if frontend depends on new backend actions.
- [ ] Run local `npm.cmd run build`.
- [ ] Run local `npm.cmd run lint`.

## Frontend Post-Deploy Smoke Test

- [ ] Production URL returns HTTP `200`.
- [ ] Production asset bundle changed after deploy.
- [ ] Staff login screen loads.
- [ ] Staff save flow works.
- [ ] Report page loads active data.
- [ ] Report export includes `Fiscal year` and `Data source`.
- [ ] Self-service page loads.
- [ ] Self-service export/print works.
- [ ] Browser console has no blocking API/CORS errors.

## Rollback Plan

Backend rollback:

- Reopen Apps Script Deploy > Manage deployments.
- Select previous known-good version.
- Keep same Web App URL if deployment can be updated in place.
- Verify `getHealth`, staff login, staff write, self-service search.

Frontend rollback:

- Use Vercel Instant Rollback to previous known-good deployment.
- Verify production HTTP `200`.
- Verify `VITE_API_URL` still points to active Apps Script Web App URL.

## No-Go Conditions

- No backup of current Apps Script code.
- No active deployment URL recorded.
- `getSchemaAudit` is not read-only.
- `SCHEMA_REPAIR_APPROVED=true` without explicit schema repair approval.
- Vercel `VITE_API_URL` does not match active Apps Script Web App URL.
- Local tests/build/lint fail.
- User has not approved deploy/push.

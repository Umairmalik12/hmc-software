# Hospital Management System

Hospital Management Application  for  hospital staff use as for managing Patient Data. This app provides  features like add new patient, update patient data, display a list of patients.  

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 11.0.1.

## Table of Contents

* [ Project images ](#Project-Image)
* [ Version Details ](#Version-Details)
* [ Development server](#Development-server) 
* [ Code scaffolding](#Code-scaffolding)
* [ Build](#Build)
* [ Running unit tests](#Running-unit-tests)

# Project Image 

<img src="src\assets\Frontend-Screenshots\1.PNG">
<img src="src\assets\Frontend-Screenshots\2.PNG">
<img src="src\assets\Frontend-Screenshots\3.PNG">
<img src="src\assets\Frontend-Screenshots\4.PNG">
<img src="src\assets\Frontend-Screenshots\5.PNG">
<img src="src\assets\Frontend-Screenshots\6.PNG">
<img src="src\assets\Frontend-Screenshots\7.PNG">
<img src="src\assets\Frontend-Screenshots\8.PNG">

## Version Details

*  Node: 14.15.1
*  Angular: 11.0.9
*  @angular-devkit/architect       0.1100.7
*  @angular-devkit/build-angular   0.1100.7
*  @angular-devkit/core            11.0.7
*  @angular-devkit/schematics      11.0.7
*  @angular/cdk                    11.2.10
*  @angular/cli                    11.0.7
*  @angular/material               11.2.10
*  @schematics/angular             11.0.7
*  @schematics/update              0.1100.7
*  rxjs                            6.6.7
*  typescript                      4.0.7

## Development server

Business dates and times use the shared `app-date-time-field`: Material calendars and a keyboard-accessible hour/minute/AM–PM dialog. New registrations, prescriptions, laboratory records, OT slips, expenses and payments start with empty date/time fields; users select them explicitly. Edit forms load saved values. Date-only fields retain local `YYYY-MM-DD`; selected timestamps are serialized as ISO instants without silently substituting the current clock. System audit timestamps still record actual changes. Token generation requires a selected date and time and allocates the next sequence for that date in Pakistan time. Run `supabase/migrations/20261122_manual_token_datetime.sql` on existing Supabase installations before using the updated token form; it adds an RPC without changing existing slips or counters.

The admin header includes **HMC assistant** for free local AI chat and existing medicine/patient record lookup. See [local AI setup and usage](LOCAL_AI_SETUP.md) for the one-time Ollama configuration. No new database tables or API keys are required.

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Supabase setup (shared database and authentication)

If saving a catalogue entry reports **"Record ID ... was not found in ..."**, run
[`supabase/migrations/20261119_record_upsert_fix.sql`](./supabase/migrations/20261119_record_upsert_fix.sql)
in Supabase SQL Editor. Older database functions treat `p_updates` as existing rows
only. This migration upgrades that shared function to insert missing records as
well as update existing ones, while preserving row-level security and existing data.
The application also sends single-record saves through the compatible insert/upsert
branch, so new rows and edits to unseeded starter options work on older deployments.
The catalogue-defaults migration seeds data; it does not replace the CRUD function.

To apply **all database updates in one SQL Editor run**, execute the complete
[`supabase/schema.sql`](./supabase/schema.sql). It includes the shared tables,
CRUD/ID/token functions, permissions, token-name editing and all four catalogue
seeds: 14 procedures, 4 rooms/beds, 90 prescription medicines and 70 OT medicines
and supplies. Catalogue entries use the existing `hmc_records` table. Re-running
the seeds preserves existing edits, inactive entries, removal markers and custom
records; patient histories are unchanged.

For an existing installation that already has the base tables and functions, run
[`supabase/migrations/20261118_catalogue_defaults.sql`](./supabase/migrations/20261118_catalogue_defaults.sql)
to persist all four sets of starter options. The application already supplies these
defaults, so this is an optional data seed rather than a new table requirement.
The SQL is generated from the application constants. Before first deployment,
`node scripts/generate-catalogue-sql.cjs` regenerates it; use `--check` to verify
alignment. Keep applied migration files unchanged and create a new dated migration
for future catalogue additions.

For existing installations, run
[`supabase/migrations/20261122_token_admin_mutations.sql`](./supabase/migrations/20261122_token_admin_mutations.sql)
to restrict token editing and deletion to administrators. Apply it after older token
migrations; it supersedes the earlier permissive token-name editor policy. The
complete `supabase/schema.sql` includes these same restrictions. Only the patient
name can be updated; the queue number, sequence, issue date and issue time stay
unchanged. The migration changes policies/permissions only and preserves all tokens
and daily sequences.

The **Procedures** page manages the fourteen default procedure choices plus any
custom additions. Operation, inpatient and OT forms share this catalog. Removing
or renaming a choice preserves the procedure text on existing records.

Operation patient registration requires a manually entered positive whole **MR
Number** and patient name. The existing `patientId` field stores that MR; no MR is
generated or substituted from an internal ID. New registrations use an insert that
rejects duplicate MRs instead of overwriting another patient. Gender choices are
Male and Female, and optional numeric ages remain within the existing 0–120 range.
The operation list's procedure dropdown combines the live catalogue with saved
historical procedure names, supports **All Procedures**, and works alongside MR
search and scroll pagination.

Existing Supabase installations must apply
[`20261120_manual_operation_patient_mr.sql`](./supabase/migrations/20261120_manual_operation_patient_mr.sql)
to block operation-patient ID allocation and enforce explicit valid MRs in database
writes. The full schema includes these safeguards. The migration does not renumber
existing records; other modules keep their existing allocation behavior.

OPD registration also requires an entered positive whole **MR Number** and patient
name, with Male/Female gender choices and optional Age (0-120). OPD keeps MR in
its existing `patientId` field, rejects duplicate registrations, and never allocates
an MR. The optional Procedure dropdown uses the shared catalogue and stores its
selected name in the existing JSON record. Existing OPD records need no rewrite.
The list filters actual MR numbers and procedures, including saved historical
procedure names, with **All Procedures** and scroll pagination.

For existing Supabase databases, apply
[`20261120_opd_patient_manual_mr.sql`](./supabase/migrations/20261120_opd_patient_manual_mr.sql)
after the operation-patient migration above. It blocks OPD MR allocation and
validates manually supplied MRs on inserts/updates, preserving existing records
and other modules' ID allocation. Both safeguards are included in the full schema.

Inpatient registration requires an entered positive whole **Patient ID** and
patient name. The existing `inpatientId` stores the entered value; registration
never substitutes a generated ID. Duplicate IDs cannot overwrite existing
admissions. Discharge date remains optional. The Patient ID list search updates
as you type across all records, including rows beyond the first scroll page.
The Procedure list filter loads the shared catalogue and saved historical names,
with **All Procedures**, while registration retains its catalogue dropdown.

Apply [`20261120_require_inpatient_patient_id.sql`](./supabase/migrations/20261120_require_inpatient_patient_id.sql)
after the OPD migration above to disable inpatient ID allocation and enforce
entered IDs on database writes. It preserves existing rows and IDs. The full
schema includes these safeguards; no new columns are needed.

The **Doctors & surgeons** (`/doctors`) and **Lab test catalogue** (`/lab-tests`)
admin pages provide search, preview, add/edit, active/inactive status, confirmation
before deletion, restore through editing, scroll pagination and export. Both use
the existing `hmc_records` table (`doctorCatalog` and `labTestCatalog`). Only the
name is required. Lab registration retains its separate patient test price.

Doctor/surgeon, doctor and referral inputs share the doctor dropdown across
operation patients, OPD, admissions, daily medicines, OT slips and laboratory
registration. Their lists include doctor dropdown filters; laboratory also has a
test dropdown filter. Dropdowns retain historical saved names for edits/filters,
while new selections use active catalogue entries. Lab registration supports
multiple tests from the live catalogue. Procedure and doctor/surgeon dropdowns
share an outline search field, case-insensitive word matching, keyboard selection,
clear/reset controls, wrapped option labels and panels that fit the viewport.
Typing searches without overwriting the selected value; choose an option to apply
it. List procedure filters use the same control, including All Procedures.
Renaming or deactivating an option never
rewrites saved patient details, prescriptions or print snapshots.

Apply [`20261120_shared_doctor_lab_catalogues.sql`](./supabase/migrations/20261120_shared_doctor_lab_catalogues.sql)
to seed the fifteen existing lab tests, import existing doctor/surgeon and older
test names, and add database uniqueness for catalogue names. This adds no tables
or columns. The initial historical import runs once; rerunning the migration
preserves later edits and inactive entries. The full schema includes this setup.

The admin **Staff & duties** page (`/staff`) manages staff profiles, designations,
Permanent/Intern employment type and active/inactive status. Each staff member can
have multiple duties with separate shift names and start/end times. Suggestions
include OT in-charge, counter/reception, room/ward care, patient medicines and OPD
checking; **Manage duties** in the list header opens a modal for adding, editing,
searching, removing and restoring duty options. The staff form uses searchable duty
dropdowns from this catalogue; custom shift and designation names remain supported. Overnight
duties display **next day**. Staff name is required; additional profile details and
schedules can be completed later. Once a duty row is added its duty name is required,
and a recorded start time must have a valid, different end time.

Staff CRUD uses the existing `hmc_records` table with collection `staffDetails`;
no new table, ALTER TABLE or additional migration is required on an existing HMC
database. Deletion deactivates the staff record, retaining its duties for review
or restoration through Edit. Saved payment staff/shift attribution is preserved.
The list supports preview, name/designation search, combined duty/shift filters,
employment/status filters, scroll pagination and export. Login permissions continue
to use the existing account-role system.

Duty options use collection `staffDutyCatalog` in the existing `hmc_records` table,
so no additional table, column or SQL migration is needed. The five original duties
and previously typed custom assignments are available in the manager. Removing a
duty stores an inactive option for future selections, while saved staff assignments,
timings and historical filters retain their original text. Renamed duties retain
their prior names in catalogue metadata so old assignments cannot recreate removed
options. Existing assignments remain editable, and active options refresh in the
staff form and list filter when catalogue changes are saved.

The **Expenses** page (`/expenses`) is available to admin and staff accounts and follows the supplied expense workbook:
date, description/purpose, one expense head and amount, with optional remarks and
place/location. It supports add, preview, edit, confirmed soft deletion and restore,
search, year/month/date-range/group/head/status filters and scroll pagination.
Daily, Monday-week, monthly and head summaries use integer paise for exact totals;
deleted records are excluded. The date defaults to the local PC date.

Staff can add expenses, view/search/filter records, preview monthly sheets, print
and export. Only admins can edit saved entries, delete them or restore them into
totals. Controls and handlers use the shell's existing admin permission; service
mutations recheck the authenticated role before writing. Existing-database
enforcement requires
[`supabase/migrations/20261122_expense_admin_mutations.sql`](./supabase/migrations/20261122_expense_admin_mutations.sql).
The complete schema includes the same restrictive RLS policies. These policies
also block direct API/RPC upserts and soft-delete changes by staff, allow staff
to insert only new recorded entries, and preserve permissions for other modules.
The migration does not change financial data or create new tables.

**Export workbook** reads all saved, non-deleted expenses across all years, regardless
of list filters or visible page. It generates formatted annual calendar registers,
Daily/Weekly/Monthly/Overall/Head summaries, a Head List and a **Print Month** sheet
with month/year dropdowns, recalculating formulas, complete monthly totals and an
expanding A4 landscape print area. Excel recalculation must be enabled for changing
the selectors. Calendar sheets include 2026–2030 plus any additional saved years;
leap days and multiple entries per day are retained. The app also offers an A4
landscape monthly print preview with fit-to-width, zoom and actual-size controls.
The preview and print window share one document, including the existing HAQ mark,
wrapped descriptions, repeated table headers and complete monthly totals. Each
date has one table row, with compact description/amount entries stacked inside
their original category cells. Daily totals and category/month totals use the
individual saved records; grouping does not merge or modify those records.
Busy dates can continue across printed pages without clipping their entries.
Preview and print use the same 9px entry typography, padding and printable width.
Expense filters align in responsive rows, numeric
columns align to the right, and row actions remain visible while scrolling across
the table. Shared record previews give notes and nested medicine lists a full row.
Staff eating/night meals/refreshments share one
head to reconcile the varying labels in the reference workbook. No sample financial
values are imported, and editing the exported workbook does not update the database.

Expenses use the existing `hmc_records` table with collection `expenseDetails`;
**no new table, ALTER TABLE or additional SQL migration is required** on an existing
HMC database. Saves update individual records and retain creation timestamps;
deleted entries remain available for review and restoration.

All record lists provide Excel export. Import controls are removed. Exports use
the current search/filter results. OT records support a compact one-page A4
preview and print layout.

The application stores patient, OPD, laboratory, medicine, inpatient, operation, payment,
prescription, and token records in Supabase so authenticated workstations use the same
database, with real-time updates between open workstations. Business records no longer use
IndexedDB or localStorage; Supabase Auth separately persists its sign-in session in the
browser.

Payments save the counter staff name, shift name, shift date, optional counter name,
and signed-in account with each receipt in the existing `payments` collection. New
payments require a staff name and shift. Counter staff is a searchable dropdown
loaded from **Staff & duties**, offering active staff for new selections. Account
and remembered staff names are reused only when they match an active master record;
unregistered account display names are not assigned as counter staff. Changes to
the staff master refresh the dropdown automatically, and assigned shift names are
included in shift suggestions. Older names remain available on their saved receipts
and in the searchable history filter, including inactive and renamed staff. A load
failure offers Retry and preserves the payment draft. Counter defaults are remembered per account on the device,
while payment records remain in Supabase. For overnight shifts, select the date the
shift started. The actual receipt time comes from the computer when saving.
Staff/shift/date filters, collection totals, and exports use every matching record,
including rows not yet shown by scroll pagination. Only completed payments count
as collections. Blank cash tendered means exact cash for completed payments;
pending payments do not infer cash received. Edits preserve the original recording
account and receipt time and save the updating account separately. Older receipts
without attribution remain marked as not recorded. No additional database migration
is required for these payment fields.

Daily medicines use a shared **Rooms & beds** catalogue, available to administrators
from the sidebar or daily medicine list. It starts with Room 1, Room 2, GW Bed 1 and
GW Bed 2. Add, rename, search, preview, export or remove options there; changes are
saved in the existing Supabase `rooms` collection without an additional migration.
Deleting a built-in option records its removal so it stays removed after reload.
Existing medicine records retain their original room text after catalogue changes,
and the dropdown continues to show those saved values when editing or filtering.
The daily medicine Print action previews only the selected record and prints through
the shared thermal window, with 80 mm as the default and a saved 58 mm option. Long
medicine and room labels wrap within the printable width, and the receipt includes
bottom padding and paper feed after the footer.
The receipt groups patient and room details, numbers the medicine lines and aligns
quantities in a separate column. The preview uses the same font and printable text
width as the selected thermal roll.

Prescription medicine fields use a themed, searchable autocomplete with keyboard
selection and manual medicine/dose entry. **Manage medicines** opens the catalogue
inside the prescription editor without leaving the draft; **Medicine catalogue**
in the sidebar opens the same add/edit/delete/search/preview/export list. A new name
can also be added explicitly from a no-match dropdown result. Both medicine catalogues
are visible to user accounts, including search, preview, export and adding new medicines
or strengths. Only administrators can edit, delete or reactivate existing medicines.
These permissions apply to embedded dialogs and database writes too. Existing Supabase
installations must apply `supabase/migrations/20261122_medicine_catalog_admin_mutations.sql`;
the migration protects both catalogue collections and legacy `customMedicines` data
without changing patient records or medicine history. Typing or leaving a
medicine field does not write suggestions automatically. The catalogue preserves
the existing common medicines and legacy `customMedicines` values, and saves edits
and removals as individual records in `prescriptionMedicineCatalog`. Removed default
and legacy names stay removed after reload. Saved prescriptions retain their original
medicine and dose text. The existing database schema supports the catalogue fields.
Both the main and OT medicine catalogues show case-insensitive A–Z groups followed
by a separate **#** group for numeric and special-character initials. Independent
alphabet dropdowns combine with existing searches (and OT status/category filters).
Letter counts reflect all matching records before pagination; partially loaded
sections show how many of that letter's medicines are visible. Changing filters
resets the scroll position and visible batch without fetching or writing records.
Sorting is cached per source refresh, rows retain their existing IDs and details,
and the two catalogue collections remain separate. No schema migration is required.

The **New medicine record** and **Edit medicine record** dialogs use this same
searchable catalogue for every medicine-name row, with the existing required-name
and quantity validation. Their **Manage catalogue** button opens the shared list
without discarding patient, room or quantity entries. Selecting a suggestion saves
the selected name and quantity in the daily record; it does not duplicate catalogue
entries. Historical names remain editable even if a catalogue option is removed.
The catalogue's Add/Edit medicine dialog includes an optional strength dropdown
with values such as 500 mg and 1 g, plus an Other strength option. Strength is saved
in the existing JSON record and included in medicine suggestions, selections,
previews and exports. Different strengths of the same medicine can be registered
separately. Editing catalogue strength preserves medicine text already saved in
prescriptions and daily medicine records. No SQL migration is required.

Use the **Add another strength** (+) row action to register another variant of an
existing medicine, such as **2SUM 1 g** and **2SUM 2 g**. The name is prefilled and
read-only in this mode; select a required strength and save a separate catalogue
record. Each variant has its own edit/delete controls and database ID. Duplicate
checks compare name **and** strength (ignoring spacing/case, without unit
conversion). Older records storing a bare name plus a separate strength get a
complete dropdown label without database writes. Adding a typed full label inside
a prescription automatically fills its name and strength fields.

Payment row **Print** and the optional after-save receipt action open an OPD-style
thermal preview with 58 mm / 80 mm paper, Close and Print controls. It reloads the
saved payment, freezes that receipt for matching preview/printing, and retains all
amounts, cash/change, payment status, counter staff and shift details. Paper choices
are remembered separately under `hmc.paymentPaperWidth` and closing the preview
updates the payment page's paper selector, including Escape/backdrop dismissal.
The existing 58 mm payment default and accounting rules remain unchanged.

Laboratory row **Print** opens the same size-selectable thermal modal as token
slips, with 58 mm / 80 mm, Close and Print controls. It reloads the selected saved
lab record before opening, retains the existing 80 mm default and remembers the
laboratory paper choice separately. Preview and printing share the same saved
receipt markup, printable width, bottom padding and 8 mm paper feed, including
long test names and the complete Thank You footer.

OPD slips use a dedicated thermal preview and print window with a saved 80 mm or
58 mm roll setting. Patient, doctor and follow-up text wrap within the printable
width; the footer has bottom padding and a paper feed. A single-slip action reloads
the selected saved visit. **Print matching slips** includes the full filtered list,
including rows beyond the visible scroll batch, and prints a continuous roll job
with gaps between receipts. An empty filter result does not print unrelated visits.
Patient tokens also open a thermal receipt preview with Print, Close and saved
58/80 mm paper controls. Token and OPD previews share the printer's physical paper
width, printable width, fonts, spacing and trailing feed. The token preview fits
long token numbers using the same routine as printing. New-token printing and
reprints render the saved record directly, so they cannot clone stale screen text.
The token page's **Print paper** selector sets the roll size for automatically
printed new tokens. A history row's **Print** action opens the same paper-size
preview as OPD, and closing the preview updates the page's selected roll size.
Token Edit/Delete controls and their handlers are admin-only, using the existing
authenticated admin role from the application shell. Losing that permission closes
any inline editor. Both mutation service methods recheck `hmc_is_admin()` before
writing; the token-admin migration also enforces the restriction through RLS for
direct API requests. Staff retain token generation, history/search/filter/export,
preview and printing.
OPD batch previews show the same continuous job and inter-slip gaps as printing.

The **OT medicine catalogue** is available to all users in the Pharmacy sidebar,
from **OT medicine records → Manage medicines**, or inside an OT slip. It supports
name/generic/strength search, category and status filters, scroll pagination, preview,
export, add, edit and confirmed removal. Only the medicine name is required; generic
name, category, type, strength, unit and description are optional. Changes are saved
as individual JSON records in the existing `hmc_records` table under
`otMedicineCatalog`, so no new table is needed. The permissions migration above enforces
admin-only updates and deletions. The original OT medicines
and supplies remain starter options; saved overrides, inactive status and removal
markers persist across reloads. Removal is soft deletion and never rewrites patient
records. Only active options can be newly selected on OT slips. New slips save the
catalogue ID and medicine details together; historical slips preserve their original
names, strength, unit, quantities and amounts even if the master entry changes.
Managing the catalogue from a slip preserves the patient draft and its selections.
The OT catalogue also offers **Add another strength**, carrying over the generic
name, category, type, unit and description while requiring a new strength. Same-name
strength variants have independent IDs and quantities. Legacy slip items without
catalogue IDs match by both name and strength, preserving historical snapshots.

Notifications use an app-wide toast stack that survives page navigation and appears
above dialogs. Success, error, warning and information messages have distinct icons
and restrained status colors. Each notification has its own timer and dismiss button;
hovering or focusing it pauses dismissal, and repeated visible messages are combined.
CRUD messages identify the affected module and report success only after saving.
The header bell retains the latest 100 messages with timestamps, an instant unread
badge, individual and bulk read controls, and confirmed clearing. Notifications
link to the relevant list where available. History and read state are saved per
authenticated staff account in this browser; signing out clears the visible feed.
Validation, medicine saves, account changes, report exports and print requests use
the same notification service. A print notification reports preparation, rather
than claiming the printer has physically completed a job. No database migration is
required for notification history. The HAQ browser icon matches the teal branding.
Database and account requests share a concurrent-request loading indicator, while
lists and pending action buttons show local loading states. Failed requests release
their loading state, and delete actions prevent repeated submissions while pending.

1. Create a Supabase project and open **SQL Editor**.
2. Run the complete script in [`supabase/schema.sql`](./supabase/schema.sql). It creates
   the shared record tables, row-level security policies, role lookup, ID allocation, and
   the atomic Asia/Karachi patient-token generator.
3. In **Authentication → Users**, create one account per staff member. Disable public
   sign-ups so only accounts created by an administrator can access the hospital data.
4. Copy each user's UUID from Authentication → Users, then assign roles in SQL Editor,
   for example:

   ```sql
   insert into public.hmc_user_roles (user_id, role)
   values
     ('ADMIN-USER-UUID', 'admin'),
     ('STAFF-USER-UUID', 'staff');
   ```

   Admins can delete clinical records; authenticated staff can read, add, and update them.
   The roles table is not writable by app users.
5. In Supabase **Project Settings → API**, copy the Project URL and the `anon`/publishable
   key. Put them in both `src/environments/environment.ts` and
   `src/environments/environment.prod.ts`:

   ```ts
   supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
   supabaseAnonKey: 'YOUR-PUBLIC-ANON-KEY',
   ```

   The anon key is intended for browser use and is protected by the SQL row-level security
   policies. **Never put the `service_role` key in this frontend.**
6. Build and deploy the Angular app. Log in using the email and password created in
   Supabase Authentication. On another PC, open the same deployed app and sign in to see
   the shared records.

The existing records in each browser's old IndexedDB are not uploaded automatically.
Export/import patient, OPD, medicine, and inpatient spreadsheets before removing the old
deployment if those local records must be retained. Token history, payments, operation
slips, and prescription drafts need a one-time migration before the old browser data is
cleared; Supabase does not have access to another PC's local database.

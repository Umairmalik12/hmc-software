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

If applying individual migrations instead of the complete schema, also run
[`supabase/migrations/20261117_token_patient_name_update.sql`](./supabase/migrations/20261117_token_patient_name_update.sql)
if token patient-name editing is not yet enabled. The complete `supabase/schema.sql`
already includes this permission. Only the patient name can be updated;
the queue number, sequence, issue date and issue time stay unchanged.

The **Procedures** page manages the fourteen default procedure choices plus any
custom additions. Operation, inpatient and OT forms share this catalog. Removing
or renaming a choice preserves the procedure text on existing records.

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
payments require a staff name and shift; the staff name defaults to the account's
display name or email. Counter defaults are remembered per account on the device,
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
can also be added explicitly from a no-match dropdown result. Typing or leaving a
medicine field does not write suggestions automatically. The catalogue preserves
the existing common medicines and legacy `customMedicines` values, and saves edits
and removals as individual records in `prescriptionMedicineCatalog`. Removed default
and legacy names stay removed after reload. Saved prescriptions retain their original
medicine and dose text. The existing database schema supports the catalogue fields.
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
OPD batch previews show the same continuous job and inter-slip gaps as printing.

The administrator's **OT medicine catalogue** is available in the Pharmacy sidebar,
from **OT medicine records → Manage medicines**, or inside an OT slip. It supports
name/generic/strength search, category and status filters, scroll pagination, preview,
export, add, edit and confirmed removal. Only the medicine name is required; generic
name, category, type, strength, unit and description are optional. Changes are saved
as individual JSON records in the existing `hmc_records` table under
`otMedicineCatalog`, so no new table or migration is needed. The original OT medicines
and supplies remain starter options; saved overrides, inactive status and removal
markers persist across reloads. Removal is soft deletion and never rewrites patient
records. Only active options can be newly selected on OT slips. New slips save the
catalogue ID and medicine details together; historical slips preserve their original
names, strength, unit, quantities and amounts even if the master entry changes.
Managing the catalogue from a slip preserves the patient draft and its selections.

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

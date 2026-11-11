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

The application stores patient, OPD, laboratory, medicine, inpatient, operation, payment,
prescription, and token records in Supabase so authenticated workstations use the same
database, with real-time updates between open workstations. Business records no longer use
IndexedDB or localStorage; Supabase Auth separately persists its sign-in session in the
browser.

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

CREATE TYPE "public"."cost_method_type" AS ENUM('direct', 'km', 'destination');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('Trip', 'Administrative');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('Employee', 'Manager', 'Finance', 'Admin');--> statement-breakpoint
CREATE TYPE "public"."site_type" AS ENUM('Hospital', 'Comprehensive clinic', 'Primary Clinic', 'Directory', 'Other');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('Pending Department Approval', 'Pending Project Approval', 'Pending Finance Approval', 'Approved', 'Rejected', 'Paid', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('Ticket', 'Planned', 'Urgent');--> statement-breakpoint
CREATE TYPE "public"."urgency_type" AS ENUM('Regular', 'Urgent');--> statement-breakpoint
CREATE TYPE "public"."workflow_step_status" AS ENUM('Pending', 'Approved', 'Rejected', 'Skipped');--> statement-breakpoint
CREATE TYPE "public"."workflow_step_type" AS ENUM('Department Manager', 'Second Department Manager', 'Tertiary Department Manager', 'Project Manager', 'Second Project Manager', 'Finance Approval', 'Admin Review');--> statement-breakpoint
CREATE TABLE "admin_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"attachment_path" text,
	"status" "request_status" DEFAULT 'Pending Finance Approval' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"finance_approved" boolean,
	"request_type" text NOT NULL,
	"trip_request_id" integer,
	"requested_amount" real,
	"target_type" text,
	"target_id" integer,
	"rejection_reason" text,
	"notified" boolean DEFAULT false,
	"status_history" json DEFAULT '[]'::json,
	"last_updated_by" integer,
	"last_updated_at" timestamp,
	"paid" boolean DEFAULT false,
	"paid_at" timestamp,
	"paid_by" integer
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"details" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"budget" real NOT NULL,
	"monthly_incident_budget" real DEFAULT 0 NOT NULL,
	"monthly_budget_bonus" real DEFAULT 0 NOT NULL,
	"monthly_budget_bonus_reset_date" timestamp,
	"manager_id" integer,
	"second_manager_id" integer,
	"third_manager_id" integer,
	"parent_department_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "distances" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_site_id" integer NOT NULL,
	"to_site_id" integer NOT NULL,
	"driving_distance" real NOT NULL,
	"estimated_time" integer NOT NULL,
	"route_type" text DEFAULT 'fastest' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "km_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"rate_value" real NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp DEFAULT now(),
	"created_by" integer NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "project_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_budget_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" real NOT NULL,
	"running_balance" real NOT NULL,
	"reference_id" integer,
	"reference_type" text,
	"description" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"uploader_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"document_type" text NOT NULL,
	"description" text,
	"upload_date" timestamp DEFAULT now(),
	"is_deleted" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"budget" real NOT NULL,
	"original_budget" real,
	"budget_adjustments" real DEFAULT 0 NOT NULL,
	"manager_id" integer,
	"second_manager_id" integer,
	"department_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"expiry_date" date,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"abbreviation" text NOT NULL,
	"english_name" text NOT NULL,
	"city" text NOT NULL,
	"region" text,
	"gps_lat" real NOT NULL,
	"gps_lng" real NOT NULL,
	"site_type" "site_type" DEFAULT 'Other' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sites_abbreviation_unique" UNIQUE("abbreviation")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "system_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "trip_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"department_id" integer,
	"project_id" integer,
	"trip_date" timestamp NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"purpose" text NOT NULL,
	"cost" real NOT NULL,
	"kilometers" real,
	"original_distance" real,
	"km_rate_id" integer,
	"km_rate_value" real,
	"km_rate" real,
	"cost_calculated_from_km" boolean DEFAULT false,
	"cost_method" text DEFAULT 'direct',
	"cost_updated_at" timestamp,
	"cost_updated_by" integer,
	"home_deduction_km" real,
	"is_home_trip_origin" boolean DEFAULT false,
	"is_home_trip_destination" boolean DEFAULT false,
	"original_distance_before_deduction" real,
	"user_home_gps_used" text,
	"attachment_path" text,
	"status" "request_status" DEFAULT 'Pending Department Approval' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"department_manager_approved" boolean,
	"department_second_approved" boolean,
	"project_manager_approved" boolean,
	"project_second_approved" boolean,
	"finance_approved" boolean,
	"rejection_reason" text,
	"notified" boolean DEFAULT false,
	"trip_type" "trip_type",
	"urgency_type" "urgency_type",
	"ticket_no" text,
	"attachment_required" boolean DEFAULT false,
	"status_history" json DEFAULT '[]'::json,
	"last_updated_by" integer,
	"last_updated_at" timestamp,
	"paid" boolean DEFAULT false,
	"paid_at" timestamp,
	"paid_by" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"company_number" text NOT NULL,
	"department" text NOT NULL,
	"email" text NOT NULL,
	"home_address" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" "user_role" DEFAULT 'Employee' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"direct_manager_name" text,
	"direct_cost_entry_permission" boolean DEFAULT false NOT NULL,
	"home_location" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_company_number_unique" UNIQUE("company_number"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_request_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"step_type" "workflow_step_type" NOT NULL,
	"approver_id" integer,
	"approver_name" text,
	"status" "workflow_step_status" DEFAULT 'Pending' NOT NULL,
	"approved_at" timestamp,
	"approved_by" integer,
	"rejection_reason" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_trip_request_id_trip_requests_id_fk" FOREIGN KEY ("trip_request_id") REFERENCES "public"."trip_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_requests" ADD CONSTRAINT "admin_requests_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_second_manager_id_users_id_fk" FOREIGN KEY ("second_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_third_manager_id_users_id_fk" FOREIGN KEY ("third_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distances" ADD CONSTRAINT "distances_from_site_id_sites_id_fk" FOREIGN KEY ("from_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distances" ADD CONSTRAINT "distances_to_site_id_sites_id_fk" FOREIGN KEY ("to_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "km_rates" ADD CONSTRAINT "km_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_history" ADD CONSTRAINT "project_budget_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_history" ADD CONSTRAINT "project_budget_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_second_manager_id_users_id_fk" FOREIGN KEY ("second_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_km_rate_id_km_rates_id_fk" FOREIGN KEY ("km_rate_id") REFERENCES "public"."km_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_cost_updated_by_users_id_fk" FOREIGN KEY ("cost_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_trip_request_id_trip_requests_id_fk" FOREIGN KEY ("trip_request_id") REFERENCES "public"."trip_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: enum_Campaigns_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_Campaigns_type" AS ENUM (
    'Email',
    'SMS',
    'Voice'
);


--
-- Name: enum_Contents_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_Contents_type" AS ENUM (
    'Video',
    'Quiz',
    'Certificate'
);


--
-- Name: enum_Templates_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_Templates_type" AS ENUM (
    'Email',
    'SMS',
    'Voice'
);


--
-- Name: enum_Users_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_Users_role" AS ENUM (
    'SuperAdmin',
    'OrgAdmin',
    'Employee'
);


--
-- Name: update_reconnaissance_domains_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_reconnaissance_domains_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_threat_intelligence_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_threat_intelligence_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Campaigns" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type public."enum_Campaigns_type" NOT NULL,
    status character varying(255),
    "scheduledAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "OrganizationId" integer
);


--
-- Name: Campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Campaigns_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Campaigns_id_seq" OWNED BY public."Campaigns".id;


--
-- Name: Contents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Contents" (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    type public."enum_Contents_type" NOT NULL,
    url character varying(255),
    language character varying(255) DEFAULT 'en'::character varying,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: Contents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Contents_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Contents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Contents_id_seq" OWNED BY public."Contents".id;


--
-- Name: Languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Languages" (
    id integer NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: Languages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Languages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Languages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Languages_id_seq" OWNED BY public."Languages".id;


--
-- Name: Organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Organizations" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    industry character varying(255),
    address character varying(255),
    "contactEmail" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: Organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Organizations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Organizations_id_seq" OWNED BY public."Organizations".id;


--
-- Name: Results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Results" (
    id integer NOT NULL,
    status character varying(255),
    details jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "CampaignId" integer,
    "UserId" integer,
    "ContentId" integer
);


--
-- Name: Results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Results_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Results_id_seq" OWNED BY public."Results".id;


--
-- Name: Templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Templates" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type public."enum_Templates_type" NOT NULL,
    content text,
    language character varying(255) DEFAULT 'en'::character varying,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "OrganizationId" integer
);


--
-- Name: Templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Templates_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Templates_id_seq" OWNED BY public."Templates".id;


--
-- Name: Users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Users" (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(255),
    role public."enum_Users_role" NOT NULL,
    language character varying(255) DEFAULT 'en'::character varying,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "OrganizationId" integer
);


--
-- Name: Users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Users_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Users_id_seq" OWNED BY public."Users".id;


--
-- Name: ai_pretexts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_pretexts (
    id integer NOT NULL,
    profile_id integer,
    campaign_type character varying(50) NOT NULL,
    urgency_level character varying(20) DEFAULT 'medium'::character varying,
    pretext_type character varying(50) NOT NULL,
    subject character varying(255) NOT NULL,
    email_body text NOT NULL,
    call_to_action text,
    urgency_indicators text[],
    personalization_elements text[],
    pretext_data jsonb,
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    model_used character varying(50) DEFAULT 'gemini-pro'::character varying,
    approved boolean DEFAULT false,
    used_in_campaign boolean DEFAULT false
);


--
-- Name: ai_pretexts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_pretexts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_pretexts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_pretexts_id_seq OWNED BY public.ai_pretexts.id;


--
-- Name: ai_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_profiles (
    id integer NOT NULL,
    contact_id integer,
    summary text,
    interests text[],
    work_style text,
    vulnerabilities text[],
    recommended_approach text,
    profile_data jsonb,
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    model_used character varying(50) DEFAULT 'gemini-pro'::character varying
);


--
-- Name: ai_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_profiles_id_seq OWNED BY public.ai_profiles.id;


--
-- Name: campaign_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_results (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    target_id integer NOT NULL,
    sent boolean DEFAULT false NOT NULL,
    sent_at timestamp without time zone,
    opened boolean DEFAULT false NOT NULL,
    opened_at timestamp without time zone,
    clicked boolean DEFAULT false NOT NULL,
    clicked_at timestamp without time zone,
    submitted boolean DEFAULT false NOT NULL,
    submitted_at timestamp without time zone,
    submitted_data jsonb,
    organization_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL
);


--
-- Name: campaign_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaign_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaign_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaign_results_id_seq OWNED BY public.campaign_results.id;


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id integer NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Draft'::text NOT NULL,
    target_group_id integer NOT NULL,
    smtp_profile_id integer NOT NULL,
    email_template_id integer NOT NULL,
    landing_page_id integer NOT NULL,
    scheduled_at timestamp without time zone,
    end_date timestamp without time zone,
    created_by_id integer NOT NULL,
    organization_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    reconnaissance_enabled boolean DEFAULT false,
    auto_profile_generation boolean DEFAULT false,
    ai_pretext_generation boolean DEFAULT false,
    reconnaissance_status character varying(50) DEFAULT 'not_started'::character varying,
    domains_discovered integer DEFAULT 0,
    contacts_found integer DEFAULT 0,
    profiles_generated integer DEFAULT 0
);


--
-- Name: campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaigns_id_seq OWNED BY public.campaigns.id;


--
-- Name: contact_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_sources (
    id integer NOT NULL,
    contact_id integer,
    scraped_content_id integer,
    relevance_score numeric(3,2) DEFAULT 0.5,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: contact_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contact_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contact_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contact_sources_id_seq OWNED BY public.contact_sources.id;


--
-- Name: discovered_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discovered_contacts (
    id integer NOT NULL,
    domain_id integer,
    email character varying(255),
    first_name character varying(100),
    last_name character varying(100),
    full_name character varying(255),
    title character varying(200),
    company character varying(200),
    linkedin_url text,
    source character varying(50) NOT NULL,
    confidence numeric(3,2) DEFAULT 0.5,
    verification_status character varying(50) DEFAULT 'unverified'::character varying,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: discovered_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discovered_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discovered_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discovered_contacts_id_seq OWNED BY public.discovered_contacts.id;


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id integer NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    html_content text NOT NULL,
    text_content text,
    sender_name text NOT NULL,
    sender_email text NOT NULL,
    organization_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id integer,
    type text DEFAULT 'phishing-business'::text,
    complexity text DEFAULT 'medium'::text,
    description text,
    category text
);


--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    organization_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN groups.organization_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.organization_id IS 'comment';


--
-- Name: groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- Name: landing_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_pages (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    html_content text NOT NULL,
    redirect_url text,
    page_type text NOT NULL,
    thumbnail text,
    organization_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id integer,
    capture_data boolean DEFAULT true NOT NULL,
    capture_passwords boolean DEFAULT false NOT NULL
);


--
-- Name: landing_pages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.landing_pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: landing_pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.landing_pages_id_seq OWNED BY public.landing_pages.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id integer NOT NULL,
    user_id integer,
    email_notifications boolean DEFAULT true,
    push_notifications boolean DEFAULT true,
    campaign_alerts boolean DEFAULT true,
    security_alerts boolean DEFAULT true,
    system_updates boolean DEFAULT true,
    weekly_reports boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    organization_id integer,
    type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    priority character varying(20) DEFAULT 'medium'::character varying,
    action_url character varying(500),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    read_at timestamp without time zone
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    logo_url text,
    theme jsonb,
    settings jsonb
);


--
-- Name: organization_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_settings_id_seq OWNED BY public.organization_settings.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    industry text,
    address text,
    logo_url text,
    settings jsonb
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: reconnaissance_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconnaissance_domains (
    id integer NOT NULL,
    campaign_id integer,
    domain character varying(255) NOT NULL,
    email_formats text[],
    mx_records text[],
    txt_records text[],
    subdomains text[],
    discovery_status character varying(50) DEFAULT 'pending'::character varying,
    discovered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: reconnaissance_domains_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reconnaissance_domains_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reconnaissance_domains_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reconnaissance_domains_id_seq OWNED BY public.reconnaissance_domains.id;


--
-- Name: reconnaissance_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconnaissance_jobs (
    id integer NOT NULL,
    campaign_id integer,
    job_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    target_data jsonb,
    result_data jsonb,
    progress integer DEFAULT 0,
    error_message text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: reconnaissance_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reconnaissance_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reconnaissance_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reconnaissance_jobs_id_seq OWNED BY public.reconnaissance_jobs.id;


--
-- Name: report_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_schedules (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    type character varying(50) NOT NULL,
    cadence character varying(20) NOT NULL,
    time_of_day character varying(5) NOT NULL,
    timezone character varying(50) DEFAULT 'UTC'::character varying NOT NULL,
    recipients text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    last_run_at timestamp without time zone,
    next_run_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT report_schedules_cadence_check CHECK (((cadence)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying])::text[]))),
    CONSTRAINT report_schedules_type_check CHECK (((type)::text = ANY ((ARRAY['executive'::character varying, 'detailed'::character varying, 'compliance'::character varying])::text[])))
);


--
-- Name: report_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_schedules_id_seq OWNED BY public.report_schedules.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(200),
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: scraped_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraped_content (
    id integer NOT NULL,
    url text NOT NULL,
    title character varying(500),
    content text,
    markdown_content text,
    metadata jsonb,
    extracted_emails text[],
    extracted_phones text[],
    social_links text[],
    word_count integer DEFAULT 0,
    scraped_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: scraped_content_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scraped_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scraped_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scraped_content_id_seq OWNED BY public.scraped_content.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: smtp_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smtp_profiles (
    id integer NOT NULL,
    name text NOT NULL,
    host text NOT NULL,
    port integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    from_name text NOT NULL,
    from_email text NOT NULL,
    organization_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: smtp_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.smtp_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: smtp_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.smtp_profiles_id_seq OWNED BY public.smtp_profiles.id;


--
-- Name: targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.targets (
    id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    "position" text,
    group_id integer NOT NULL,
    organization_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    department text
);


--
-- Name: targets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.targets_id_seq OWNED BY public.targets.id;


--
-- Name: threat_intelligence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threat_intelligence (
    id integer NOT NULL,
    url text,
    domain character varying(255),
    indicator text,
    indicator_type character varying(50),
    threat_type character varying(100),
    malware_family character varying(100),
    campaign_name character varying(200),
    source character varying(100) NOT NULL,
    confidence integer DEFAULT 0,
    is_active boolean DEFAULT true,
    first_seen timestamp without time zone NOT NULL,
    last_seen timestamp without time zone,
    expires_at timestamp without time zone,
    tags jsonb DEFAULT '[]'::jsonb,
    description text,
    raw_data jsonb,
    used_in_simulations boolean DEFAULT false,
    organization_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    normalized_indicator text
);


--
-- Name: TABLE threat_intelligence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.threat_intelligence IS 'Stores threat intelligence data from multiple feeds';


--
-- Name: threat_intelligence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.threat_intelligence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: threat_intelligence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.threat_intelligence_id_seq OWNED BY public.threat_intelligence.id;


--
-- Name: threat_statistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threat_statistics (
    id integer NOT NULL,
    date timestamp without time zone NOT NULL,
    source character varying(100) NOT NULL,
    threat_type character varying(100) NOT NULL,
    count integer DEFAULT 0,
    organization_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE threat_statistics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.threat_statistics IS 'Stores aggregated threat statistics for analytics';


--
-- Name: threat_statistics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.threat_statistics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: threat_statistics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.threat_statistics_id_seq OWNED BY public.threat_statistics.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id integer,
    role_id integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    profile_picture text,
    "position" text,
    bio text,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    last_failed_login timestamp without time zone,
    account_locked boolean DEFAULT false NOT NULL,
    account_locked_until timestamp without time zone,
    is_admin boolean DEFAULT false NOT NULL,
    organization_id integer NOT NULL,
    organization_name text DEFAULT 'None'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_login timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: Campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaigns" ALTER COLUMN id SET DEFAULT nextval('public."Campaigns_id_seq"'::regclass);


--
-- Name: Contents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contents" ALTER COLUMN id SET DEFAULT nextval('public."Contents_id_seq"'::regclass);


--
-- Name: Languages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Languages" ALTER COLUMN id SET DEFAULT nextval('public."Languages_id_seq"'::regclass);


--
-- Name: Organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organizations" ALTER COLUMN id SET DEFAULT nextval('public."Organizations_id_seq"'::regclass);


--
-- Name: Results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Results" ALTER COLUMN id SET DEFAULT nextval('public."Results_id_seq"'::regclass);


--
-- Name: Templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Templates" ALTER COLUMN id SET DEFAULT nextval('public."Templates_id_seq"'::regclass);


--
-- Name: Users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Users" ALTER COLUMN id SET DEFAULT nextval('public."Users_id_seq"'::regclass);


--
-- Name: ai_pretexts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_pretexts ALTER COLUMN id SET DEFAULT nextval('public.ai_pretexts_id_seq'::regclass);


--
-- Name: ai_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_profiles ALTER COLUMN id SET DEFAULT nextval('public.ai_profiles_id_seq'::regclass);


--
-- Name: campaign_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_results ALTER COLUMN id SET DEFAULT nextval('public.campaign_results_id_seq'::regclass);


--
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN id SET DEFAULT nextval('public.campaigns_id_seq'::regclass);


--
-- Name: contact_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_sources ALTER COLUMN id SET DEFAULT nextval('public.contact_sources_id_seq'::regclass);


--
-- Name: discovered_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_contacts ALTER COLUMN id SET DEFAULT nextval('public.discovered_contacts_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- Name: landing_pages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages ALTER COLUMN id SET DEFAULT nextval('public.landing_pages_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: organization_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings ALTER COLUMN id SET DEFAULT nextval('public.organization_settings_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: reconnaissance_domains id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconnaissance_domains ALTER COLUMN id SET DEFAULT nextval('public.reconnaissance_domains_id_seq'::regclass);


--
-- Name: reconnaissance_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconnaissance_jobs ALTER COLUMN id SET DEFAULT nextval('public.reconnaissance_jobs_id_seq'::regclass);


--
-- Name: report_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules ALTER COLUMN id SET DEFAULT nextval('public.report_schedules_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: scraped_content id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraped_content ALTER COLUMN id SET DEFAULT nextval('public.scraped_content_id_seq'::regclass);


--
-- Name: smtp_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_profiles ALTER COLUMN id SET DEFAULT nextval('public.smtp_profiles_id_seq'::regclass);


--
-- Name: targets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.targets ALTER COLUMN id SET DEFAULT nextval('public.targets_id_seq'::regclass);


--
-- Name: threat_intelligence id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threat_intelligence ALTER COLUMN id SET DEFAULT nextval('public.threat_intelligence_id_seq'::regclass);


--
-- Name: threat_statistics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threat_statistics ALTER COLUMN id SET DEFAULT nextval('public.threat_statistics_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: Campaigns Campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaigns"
    ADD CONSTRAINT "Campaigns_pkey" PRIMARY KEY (id);


--
-- Name: Contents Contents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Contents"
    ADD CONSTRAINT "Contents_pkey" PRIMARY KEY (id);


--
-- Name: Languages Languages_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Languages"
    ADD CONSTRAINT "Languages_code_key" UNIQUE (code);


--
-- Name: Languages Languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Languages"
    ADD CONSTRAINT "Languages_pkey" PRIMARY KEY (id);


--
-- Name: Organizations Organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organizations"
    ADD CONSTRAINT "Organizations_pkey" PRIMARY KEY (id);


--
-- Name: Results Results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Results"
    ADD CONSTRAINT "Results_pkey" PRIMARY KEY (id);


--
-- Name: Templates Templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Templates"
    ADD CONSTRAINT "Templates_pkey" PRIMARY KEY (id);


--
-- Name: Users Users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_email_key" UNIQUE (email);


--
-- Name: Users Users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_pkey" PRIMARY KEY (id);


--
-- Name: ai_pretexts ai_pretexts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_pretexts
    ADD CONSTRAINT ai_pretexts_pkey PRIMARY KEY (id);


--
-- Name: ai_profiles ai_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_profiles
    ADD CONSTRAINT ai_profiles_pkey PRIMARY KEY (id);


--
-- Name: campaign_results campaign_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_results
    ADD CONSTRAINT campaign_results_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: contact_sources contact_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_sources
    ADD CONSTRAINT contact_sources_pkey PRIMARY KEY (id);


--
-- Name: discovered_contacts discovered_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_contacts
    ADD CONSTRAINT discovered_contacts_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: landing_pages landing_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: reconnaissance_domains reconnaissance_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconnaissance_domains
    ADD CONSTRAINT reconnaissance_domains_pkey PRIMARY KEY (id);


--
-- Name: reconnaissance_jobs reconnaissance_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconnaissance_jobs
    ADD CONSTRAINT reconnaissance_jobs_pkey PRIMARY KEY (id);


--
-- Name: report_schedules report_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: scraped_content scraped_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraped_content
    ADD CONSTRAINT scraped_content_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: smtp_profiles smtp_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_profiles
    ADD CONSTRAINT smtp_profiles_pkey PRIMARY KEY (id);


--
-- Name: targets targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.targets
    ADD CONSTRAINT targets_pkey PRIMARY KEY (id);


--
-- Name: threat_intelligence threat_intelligence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threat_intelligence
    ADD CONSTRAINT threat_intelligence_pkey PRIMARY KEY (id);


--
-- Name: threat_statistics threat_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threat_statistics
    ADD CONSTRAINT threat_statistics_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_ai_pretexts_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_pretexts_profile ON public.ai_pretexts USING btree (profile_id);


--
-- Name: idx_ai_profiles_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_profiles_contact ON public.ai_profiles USING btree (contact_id);


--
-- Name: idx_campaign_results_clicked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_results_clicked ON public.campaign_results USING btree (clicked);


--
-- Name: idx_campaign_results_opened; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_results_opened ON public.campaign_results USING btree (opened);


--
-- Name: idx_campaign_results_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_results_org ON public.campaign_results USING btree (organization_id);


--
-- Name: idx_campaign_results_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_results_sent ON public.campaign_results USING btree (sent);


--
-- Name: idx_campaign_results_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_results_status ON public.campaign_results USING btree (status);


--
-- Name: idx_discovered_contacts_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discovered_contacts_domain ON public.discovered_contacts USING btree (domain_id);


--
-- Name: idx_discovered_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discovered_contacts_email ON public.discovered_contacts USING btree (email);


--
-- Name: idx_email_templates_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_name ON public.email_templates USING btree (name);


--
-- Name: idx_email_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_type ON public.email_templates USING btree (type);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_organization_id ON public.notifications USING btree (organization_id);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_reconnaissance_domains_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reconnaissance_domains_campaign ON public.reconnaissance_domains USING btree (campaign_id);


--
-- Name: idx_reconnaissance_jobs_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reconnaissance_jobs_campaign ON public.reconnaissance_jobs USING btree (campaign_id);


--
-- Name: idx_reconnaissance_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reconnaissance_jobs_status ON public.reconnaissance_jobs USING btree (status);


--
-- Name: idx_report_schedules_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_schedules_next_run ON public.report_schedules USING btree (next_run_at) WHERE (enabled = true);


--
-- Name: idx_report_schedules_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_schedules_organization_id ON public.report_schedules USING btree (organization_id);


--
-- Name: idx_scraped_content_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scraped_content_url ON public.scraped_content USING btree (url);


--
-- Name: idx_targets_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_targets_department ON public.targets USING btree (department);


--
-- Name: idx_targets_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_targets_email ON public.targets USING btree (email);


--
-- Name: idx_threat_intel_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_intel_active ON public.threat_intelligence USING btree (is_active);


--
-- Name: idx_threat_intel_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_intel_confidence ON public.threat_intelligence USING btree (confidence);


--
-- Name: idx_threat_intel_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_intel_domain ON public.threat_intelligence USING btree (domain);


--
-- Name: idx_threat_intel_first_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_intel_first_seen ON public.threat_intelligence USING btree (first_seen);


--
-- Name: idx_threat_intel_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_intel_source ON public.threat_intelligence USING btree (source);


--
-- Name: idx_threat_intel_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_intel_type ON public.threat_intelligence USING btree (threat_type);


--
-- Name: idx_threat_intel_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_intel_url ON public.threat_intelligence USING btree (url);


--
-- Name: idx_threat_stats_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_stats_date ON public.threat_statistics USING btree (date);


--
-- Name: idx_threat_stats_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_stats_source ON public.threat_statistics USING btree (source);


--
-- Name: idx_threat_stats_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threat_stats_type ON public.threat_statistics USING btree (threat_type);


--
-- Name: ix_threat_intel_first_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_threat_intel_first_seen ON public.threat_intelligence USING btree (first_seen DESC);


--
-- Name: ix_threat_intel_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_threat_intel_is_active ON public.threat_intelligence USING btree (is_active);


--
-- Name: ux_threat_intel_normalized_indicator; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_threat_intel_normalized_indicator ON public.threat_intelligence USING btree (normalized_indicator) WHERE (normalized_indicator IS NOT NULL);


--
-- Name: reconnaissance_domains trigger_update_reconnaissance_domains_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_reconnaissance_domains_updated_at BEFORE UPDATE ON public.reconnaissance_domains FOR EACH ROW EXECUTE FUNCTION public.update_reconnaissance_domains_updated_at();


--
-- Name: threat_intelligence update_threat_intelligence_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_threat_intelligence_updated_at BEFORE UPDATE ON public.threat_intelligence FOR EACH ROW EXECUTE FUNCTION public.update_threat_intelligence_updated_at();


--
-- Name: Campaigns Campaigns_OrganizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaigns"
    ADD CONSTRAINT "Campaigns_OrganizationId_fkey" FOREIGN KEY ("OrganizationId") REFERENCES public."Organizations"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Results Results_CampaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Results"
    ADD CONSTRAINT "Results_CampaignId_fkey" FOREIGN KEY ("CampaignId") REFERENCES public."Campaigns"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Results Results_ContentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Results"
    ADD CONSTRAINT "Results_ContentId_fkey" FOREIGN KEY ("ContentId") REFERENCES public."Contents"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Results Results_UserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Results"
    ADD CONSTRAINT "Results_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES public."Users"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Templates Templates_OrganizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Templates"
    ADD CONSTRAINT "Templates_OrganizationId_fkey" FOREIGN KEY ("OrganizationId") REFERENCES public."Organizations"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Users Users_OrganizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "Users_OrganizationId_fkey" FOREIGN KEY ("OrganizationId") REFERENCES public."Organizations"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ai_pretexts ai_pretexts_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_pretexts
    ADD CONSTRAINT ai_pretexts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_profiles(id) ON DELETE CASCADE;


--
-- Name: ai_profiles ai_profiles_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_profiles
    ADD CONSTRAINT ai_profiles_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.discovered_contacts(id) ON DELETE CASCADE;


--
-- Name: campaign_results campaign_results_campaign_id_campaigns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_results
    ADD CONSTRAINT campaign_results_campaign_id_campaigns_id_fk FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_results campaign_results_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_results
    ADD CONSTRAINT campaign_results_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: campaign_results campaign_results_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_results
    ADD CONSTRAINT campaign_results_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: campaign_results campaign_results_target_id_targets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_results
    ADD CONSTRAINT campaign_results_target_id_targets_id_fk FOREIGN KEY (target_id) REFERENCES public.targets(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: campaigns campaigns_email_template_id_email_templates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_email_template_id_email_templates_id_fk FOREIGN KEY (email_template_id) REFERENCES public.email_templates(id) ON DELETE RESTRICT;


--
-- Name: campaigns campaigns_landing_page_id_landing_pages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_landing_page_id_landing_pages_id_fk FOREIGN KEY (landing_page_id) REFERENCES public.landing_pages(id) ON DELETE RESTRICT;


--
-- Name: campaigns campaigns_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_smtp_profile_id_smtp_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_smtp_profile_id_smtp_profiles_id_fk FOREIGN KEY (smtp_profile_id) REFERENCES public.smtp_profiles(id) ON DELETE RESTRICT;


--
-- Name: campaigns campaigns_target_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_target_group_id_groups_id_fk FOREIGN KEY (target_group_id) REFERENCES public.groups(id) ON DELETE RESTRICT;


--
-- Name: contact_sources contact_sources_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_sources
    ADD CONSTRAINT contact_sources_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.discovered_contacts(id) ON DELETE CASCADE;


--
-- Name: contact_sources contact_sources_scraped_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_sources
    ADD CONSTRAINT contact_sources_scraped_content_id_fkey FOREIGN KEY (scraped_content_id) REFERENCES public.scraped_content(id) ON DELETE CASCADE;


--
-- Name: discovered_contacts discovered_contacts_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discovered_contacts
    ADD CONSTRAINT discovered_contacts_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.reconnaissance_domains(id) ON DELETE CASCADE;


--
-- Name: email_templates email_templates_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: email_templates email_templates_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: groups groups_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: landing_pages landing_pages_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: landing_pages landing_pages_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reconnaissance_domains reconnaissance_domains_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconnaissance_domains
    ADD CONSTRAINT reconnaissance_domains_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: reconnaissance_jobs reconnaissance_jobs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconnaissance_jobs
    ADD CONSTRAINT reconnaissance_jobs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: report_schedules report_schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: smtp_profiles smtp_profiles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smtp_profiles
    ADD CONSTRAINT smtp_profiles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: targets targets_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.targets
    ADD CONSTRAINT targets_group_id_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: targets targets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.targets
    ADD CONSTRAINT targets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: threat_intelligence threat_intelligence_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threat_intelligence
    ADD CONSTRAINT threat_intelligence_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: threat_statistics threat_statistics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threat_statistics
    ADD CONSTRAINT threat_statistics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


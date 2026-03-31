// ───────────────────────────────────────────────────────────────
// ai-projectcreation.constants.ts — Types, interfaces & config
// ───────────────────────────────────────────────────────────────

// ── Type Aliases ─────────────────────────────────────────────

export type WizardPage = 'landing' | 'wizard';

export type WizardField =
  | 'cluster'
  | 'country'
  | 'company'
  | 'client'
  | 'secondary_ask'
  | 'primary_project'
  | 'lob'
  | 'operational_lob'
  | 'confirm'
  // Tab 2 fields
  | 'transformation_type'
  | 'transformation_type_sub'
  | 'transformation_type_l3'
  | 'transformation_type_l4'
  | 'objective'
  | 'nature'
  | 'group_classification'
  | 'external_product'
  | 'project_name'
  | 'project_lead'
  | 'project_sponsor'
  | 'regional_approver'
  | 'dmaic_status'
  | 'dmaic_status_date'
  | 'transformation_status'
  | 'transformation_status_date'
  | 'project_status'
  | 'project_status_date'
  | 'urgency'
  | 'strategic_value'
  | 'deployment_duration'
  | 'payback_period'
  | 'tab2_confirm'
  // Tab 3 fields
  | 'tab3_financials'
  // Tab 4 fields
  | 'metric_group'
  | 'metric'
  | 'kpi_values'
  | 'kpi_list'
  | 'tab4_confirm'
  // Pre-flight
  | 'preflight'
  | 'nlp_preview';

export type WizardAction =
  | 'get_clusters'
  | 'get_countries'
  | 'get_companies'
  | 'get_clients'
  | 'get_lobs'
  | 'get_primary_projects'
  | 'search_operational_lob'
  | 'auto_resolve'
  | 'create_opportunity'
  | 'assistant_message'
  | 'parse_project_input'
  // Tab 2 actions
  | 'get_transformation_types'
  | 'get_transformation_type_sub_dropdown'
  | 'get_transformation_type_second_level'
  | 'get_tp_microservices_sub_level'
  | 'get_objectives'
  | 'get_natures'
  | 'get_transformation_statuses'
  | 'get_group_classification_options'
  | 'get_external_products'
  | 'get_dmaic_project_status'
  | 'get_project_statuses'
  | 'get_urgencies'
  | 'get_strategies'
  | 'search_users'
  | 'get_regional_approver'
  // Tab 4 actions
  | 'get_metric_groups'
  | 'get_metrics'
  | 'create_kpi'
  | 'get_kpis_list'
  | 'delete_kpi'
  | 'submit_project_prioritisation'
  // Backend-offloaded endpoints
  | 'resolve_cascade'
  | 'save_with_prioritisation'
  | 'validate_tab2'
  // LLM brain endpoints
  | 'smart_match';

export type MessageRole = 'assistant' | 'user' | 'status' | 'options' | 'landing';

// ── Interfaces ───────────────────────────────────────────────

export interface IdNameItem {
  id: string | null;
  name: string | null;
}

export interface ClientItem {
  id: number;
  name: string | null;
}

export interface PrimaryProjectItem {
  opportunityId: string;
  viewopportunityId: string;
  clientId: number | null;
  clientName: string | null;
  companyId: string | null;
  companyName: string | null;
  clusterId: string | null;
  clusterName: string | null;
  clusterCountryId: string | null;
  clusterCountryName: string | null;
  lineOfBusiness: string | null;
  lineOfBusiness_name: string | null;
  industryId: string | null;
  industryName: string | null;
  languageName: string | null;
  operationalLob: string | null;
  displayLabel?: string;
}

export interface UserSearchItem {
  displayName: string;
  userPrincipalName: string;
  id?: string;
  displayLabel?: string;
}

export interface KpiItem {
  metricrowid: number | null;
  metricGroupId: number | null;
  metricGroupName: string | null;
  metricId: number | null;
  metricName: string | null;
  AS_IS: string | null;
  TO_BE: string | null;
  WOULD_BE: string | null;
  lastDate: string | null;
  lastSnapshot: string | null;
  description: string | null;
  customSubMatricsName: string | null;
}

export interface KpiFormData {
  asIs: string;
  toBe: string;
  wouldBe: string;
  lastSnapshot: string;
  description: string;
  customSubMetricsName: string;
}

export interface FinancialFormData {
  expectedRevenue: string;
  expectedInternalBenefit: string;
  expectedClientBenefit: string;
  estimatedProjectCost: string;
  actualProjectCost: string;
  currency: string;
  internalBenefit: string;
  clientBenefit: string;
  recurrentRevenue: string;
  realisedBenefit: string;
  realisedRevenue: string;
  additionalInvestment: string;
}

export interface PreflightFormData {
  transformationType: string;
  objective: string;
  nature: string;
  urgency: string;
  strategicValue: string;
  transformationStatus: string;
  metricGroup: string;
  projectName: string;
  // Additional independent fields
  deploymentDuration: string;
  paybackPeriod: string;
  // Financial fields
  expectedRevenue: string;
  estimatedProjectCost: string;
  currency: string;
  // KPI fields
  asIsValue: string;
  toBeValue: string;
}

export function createInitialPreflightForm(): PreflightFormData {
  return {
    transformationType: '', objective: '', nature: '', urgency: '', strategicValue: '',
    transformationStatus: '', metricGroup: '', projectName: '',
    deploymentDuration: '', paybackPeriod: '',
    expectedRevenue: '', estimatedProjectCost: '', currency: '',
    asIsValue: '', toBeValue: '',
  };
}

export const PREFLIGHT_OPTIONS = {
  transformationTypes: ['Consulting', 'Data Analytics', 'Technology Products & Services'],
  objectives: ['Sell More', 'Deliver Better'],
  natures: ['Proof of Concept (POC)', 'Pilot', 'Production'],
  urgencies: ['Low', 'Medium', 'High'],
  strategicValues: ['Low', 'Medium', 'High'],
  transformationStatuses: [
    'Internal Proposal Submitted', 'Demo', 'Project Started', 'Solutioning',
    'Internal experimentation', 'Client Proposal Submitted', 'Cancelled by Client', 'Client lost',
    'Implementation', 'Exploration without acceptance criteria', 'POC, with defined acceptance criteria',
    'Production', 'Decommissioned by TP',
  ],
  metricGroups: ['Quality', 'Efficiency', 'People', 'Revenue', 'Business Outcome'],
} as const;

export type OptionItem = IdNameItem | ClientItem | PrimaryProjectItem | UserSearchItem;

export interface ChatMessage {
  role: MessageRole;
  text: string;
}

export interface SummaryState {
  clusterId: string | null;
  clusterName: string | null;
  clusterCountryId: string | null;
  clusterCountryName: string | null;
  companyId: string | null;
  companyName: string | null;
  clientId: number | null;
  clientName: string | null;
  lobId: string | null;
  lobName: string | null;
  operationalLob: string | null;
  industryId: string | null;
  industryName: string | null;
  languageName: string | null;
  isTpInternal: boolean;
  isSecondary: boolean;
  primaryProjectId: string | null;
  primaryProjectName: string | null;
  // Tab 2 fields
  transformationTypeId: string | null;
  transformationTypeName: string | null;
  transformationTypeFirstLevelId: string | null;
  transformationTypeFirstLevelName: string | null;
  transformationTypeSecondLevelId: string | null;
  transformationTypeSecondLevelName: string | null;
  transformationTypeThirdLevelId: string | null;
  transformationTypeThirdLevelName: string | null;
  // Branching path flags
  isConsultingPath: boolean;
  isDataAnalyticsPath: boolean;
  isTechProductsPath: boolean;
  isDmaicPath: boolean;
  isProjectStatusEnable: boolean;
  isProjectStatusEnableForWithoutPSI: boolean;
  isGroupClassificationEnable: boolean;
  showExternalProductDropdown: boolean;
  objectiveId: number | null;
  objectiveName: string | null;
  natureId: number | null;
  natureName: string | null;
  groupClassificationId: number | null;
  groupClassificationName: string | null;
  externalProductId: string | null;
  externalProductValue: string | null;
  projectName: string | null;
  projectDescription: string | null;
  projectLeadName: string | null;
  projectLeadUPN: string | null;
  projectSponsorName: string | null;
  projectSponsorUPN: string | null;
  isRegionalApprovalRequired: boolean;
  regionalApproverId: string | null;
  regionalApproverName: string | null;
  regionalApproverUPN: string | null;
  dmaicProjectStatusId: number | null;
  dmaicProjectStatusName: string | null;
  dmaicProjectStatusDate: string | null;
  transformationStatusId: number | null;
  transformationStatusName: string | null;
  transformationStatusDate: string | null;
  projectStatusId: number | null;
  projectStatusName: string | null;
  projectStatusDate: string | null;
  urgencyId: number | null;
  urgencyName: string | null;
  strategicValueId: number | null;
  strategicValueName: string | null;
  deploymentDuration: string | null;
  paybackPeriod: string | null;
  // Tab 4: KPI
  kpiMetricGroupId: number | null;
  kpiMetricGroupName: string | null;
  kpiMetricId: number | null;
  kpiMetricName: string | null;
  // Tab 3: Financials
  expectedRevenue?: string;
  expectedInternalBenefit?: string;
  expectedClientBenefit?: string;
  estimatedProjectCost?: string;
  actualProjectCost?: string;
  recurrentRevenue?: string;
  additionalInvestment?: string;
  realisedBenefit?: string;
  realisedRevenue?: string;
  internalBenefit?: string;
  clientBenefit?: string;
  currency?: string;
}

export interface ProxyResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AssistantContext {
  clusterName: string | null;
  clusterCountryName: string | null;
  companyName: string | null;
  clientName: string | null;
  lobName: string | null;
  industryName: string | null;
  languageName: string | null;
  isTpInternal: boolean;
}

export interface ParsedProjectInput {
  cluster?: string;
  country?: string;
  company?: string;
  client?: string;
  lob?: string;
  isTpInternal: boolean;
  intent: string;
  // Tab 2
  transformationType?: string;
  transformationTypeSub?: string;
  transformationTypeSecondLevel?: string;
  objective?: string;
  nature?: string;
  projectName?: string;
  projectDescription?: string;
  projectLeadName?: string;
  projectSponsorName?: string;
  isRegionalApprovalRequired?: boolean;
  regionalApproverName?: string;
  transformationStatus?: string;
  dmaicStatus?: string;
  urgency?: string;
  strategicValue?: string;
  comments?: string;
  // Dates
  transformationStatusDate?: string;
  dmaicStatusDate?: string;
  projectStatusDate?: string;
  // Prioritisation
  deploymentDuration?: string;
  paybackPeriod?: string;
  // Tab 3
  expectedRevenue?: string;
  expectedInternalBenefit?: string;
  expectedClientBenefit?: string;
  estimatedProjectCost?: string;
  actualProjectCost?: string;
  recurrentRevenue?: string;
  additionalInvestment?: string;
  realisedBenefit?: string;
  realisedRevenue?: string;
  internalBenefit?: string;
  clientBenefit?: string;
  currency?: string;
  // Tab 4
  metricGroup?: string;
  metric?: string;
  asIsValue?: string;
  toBeValue?: string;
  wouldBeValue?: string;
  lastSnapshotValue?: string;
  kpiDescription?: string;
}

export interface WizardStep {
  title: string;
  state: 'active' | 'pending' | 'completed';
}

// ── Numeric Constants ────────────────────────────────────────

// API_ENDPOINT is now derived from environment.ts — no hardcoded URLs
import { environment } from '../../environments/environment';
export const API_ENDPOINT = `${environment.aiGatewayUrl}${environment.aiGatewayEndpoint}`;
export const SCROLL_DELAY_MS = 150;
export const SCROLL_THRESHOLD_PX = 120;
export const LOADING_INTERVAL_MS = 1600;
export const FALLBACK_VALUE = 'N/A';
export const EMPTY_DISPLAY = '-';

// ── Step Definitions ─────────────────────────────────────────

export const WIZARD_STEPS: WizardStep[] = [
  { title: 'Basic Info', state: 'active' },
  { title: 'Project Details', state: 'pending' },
  { title: 'Financials', state: 'pending' },
  { title: 'KPI', state: 'pending' },
];

// ── Regex Patterns ───────────────────────────────────────────

export const PATTERNS = {
  REVERT: /\b(revert|undo|go\s*back|back|reset|start\s*over|begin\s*again|clear|restart)\b/i,
  SAVE: /^(save|yes|confirm|done|ok|submit)/i,
  SKIP: /^(skip|next|none|no|n\/a)/i,
  ADD_MORE: /^(add|more|another|new|yes)/i,
  SUBMIT: /^(submit|finish|finalize|complete|done)/i,
  TP_INTERNAL: /tp\s*internal/i,
  NEW_PRIMARY: /new|primary|fresh/i,
  SECONDARY: /secondary|link|existing/i,
} as const;

// ── Revert Map ───────────────────────────────────────────────

export const REVERT_MAP: Readonly<Record<string, string>> = {
  country: 'cluster',
  company: 'country',
  client: 'company',
  lob: 'client',
  operational_lob: 'lob',
  // Tab 2
  transformation_type_sub: 'transformation_type',
  transformation_type_l3: 'transformation_type_sub',
  transformation_type_l4: 'transformation_type_l3',
  objective: 'transformation_type',
  nature: 'objective',
  group_classification: 'nature',
  external_product: 'nature',
  project_name: 'nature',
  project_lead: 'project_name',
  project_sponsor: 'project_lead',
  regional_approver: 'project_sponsor',
  dmaic_status: 'transformation_status_date',
  dmaic_status_date: 'dmaic_status',
  transformation_status: 'project_sponsor',
  transformation_status_date: 'transformation_status',
  project_status: 'transformation_status_date',
  project_status_date: 'project_status',
  urgency: 'transformation_status',
  strategic_value: 'urgency',
  tab2_confirm: 'strategic_value',
  // Tab 4
  metric: 'metric_group',
  kpi_values: 'metric',
};

// ── Input Placeholders ───────────────────────────────────────

export const INPUT_PLACEHOLDERS: Readonly<Record<string, string>> = {
  cluster:         'Or type a cluster name...',
  country:         'Or type a country...',
  company:         'Or type a company...',
  client:          'Type a client, or "TP Internal"...',
  lob:             'Type a line of business...',
  operational_lob: 'Optional — search by keyword or type "skip" to continue...',
  confirm:         'Type "save" to confirm...',
  secondary_ask:   'Type "new" or "secondary"...',
  primary_project: 'Search by cluster, client, country...',
  // Tab 2
  transformation_type:     'Or type a transformation type...',
  transformation_type_sub: 'Or type a sub-type...',
  transformation_type_l3:  'Or type a level 3 type...',
  transformation_type_l4:  'Or type a level 4 type...',
  objective:       'Or type an objective...',
  nature:          'Or type a nature...',
  group_classification: 'Or type a group classification...',
  external_product: 'Or type an external product...',
  project_name:    'Enter your project name...',
  project_lead:    'Search for project lead by name...',
  project_sponsor: 'Search for project sponsor by name...',
  regional_approver: 'Search for regional approver by name...',
  dmaic_status:    'Or type a DMAIC status...',
  dmaic_status_date: 'Enter DMAIC status date (YYYY-MM-DD)...',
  transformation_status: 'Or type a status...',
  transformation_status_date: 'Enter transformation status date (YYYY-MM-DD)...',
  project_status:  'Or type a project status...',
  project_status_date: 'Enter project status date (YYYY-MM-DD)...',
  urgency:         'Or type an urgency level...',
  strategic_value: 'Or type a strategic value...',
  deployment_duration: 'Enter months or type "skip"...',
  payback_period:  'Enter months or type "skip"...',
  tab2_confirm:    'Type "save" to confirm Project Details...',
  tab3_financials: 'Fill in the financial form below, or type "skip" to proceed with empty values...',
  // Tab 4
  metric_group:    'Or type a metric group...',
  metric:          'Or type a metric...',
  kpi_values:      'Fill in the KPI form below and click Add KPI...',
  kpi_list:        'Type "add" for more KPIs or "submit" to finish...',
  tab4_confirm:    'Type "submit" to finalize the project...',
  default:         'Describe your project \u2014 cluster, country, company, client, LOB...',
};

// ── Options Labels ───────────────────────────────────────────

export const OPTIONS_LABELS: Readonly<Record<string, string>> = {
  cluster:         'Select a Cluster',
  country:         'Select a Country',
  company:         'Select a Company',
  client:          'Select a Client',
  lob:             'Select a Line of Business',
  operational_lob: 'Operational LOB (Optional)',
  primary_project: 'Link to Primary Project',
  secondary_ask:   'Project Type',
  // Tab 2
  transformation_type:     'Select Transformation Type',
  transformation_type_sub: 'Select Sub-Type',
  transformation_type_l3:  'Select Level 3 Type',
  transformation_type_l4:  'Select Level 4 Type',
  objective:       'Select Objective',
  nature:          'Select Nature',
  group_classification: 'Select Group Classification',
  external_product: 'Select External Product',
  project_lead:    'Select Project Lead',
  project_sponsor: 'Select Project Sponsor',
  regional_approver: 'Select Regional Approver',
  dmaic_status:    'Select DMAIC Status',
  transformation_status: 'Select Transformation Status',
  project_status:  'Select Project Status',
  urgency:         'Select Urgency',
  strategic_value: 'Select Strategic Value',
  // Tab 4
  metric_group:    'Select a Metric Group',
  metric:          'Select a Metric',
  default:         'Options',
};

// ── Loading Messages ─────────────────────────────────────────

export const loadingMessages = (context: string): string[] => [
  `Loading ${context}...`,
  'Querying TC databases...',
  `Fetching ${context} records...`,
  'Cross-referencing results...',
  'Preparing your options...',
  'Almost ready...',
];

// ── Assistant Prompts & Fallbacks ────────────────────────────

export const PROMPTS = {
  LANDING: {
    prompt:
      'The user opened TC One Click — a project generator (NOT a chatbot). Tell them to paste their project details in one message, mentioning the actual field values: cluster, country, company, client, LOB, transformation type (Consulting/Data Analytics/Technology Products), sub-type, objective (Sell More/Deliver Better), nature (POC/Pilot/Production), project name, lead, sponsor, transformation status, urgency (Low/Medium/High), strategic value, financials, and KPI (metric group, metric, as-is, to-be). Keep it short. Mention file/document attachment is also supported. End with: type "secondary" to link to an existing project.',
    fallback:
      '**TC One Click — Project Generator**\n\nPaste your project details in one message — mention the actual field values like cluster name, country, company, client, LOB, transformation type, objective, nature, project name, lead, sponsor, status, urgency, financials, and KPI.\n\nThe engine extracts everything and auto-fills all 4 tabs. Any fields you miss will be asked one by one.\n\nYou can also attach a document or type **"secondary"** to link to an existing project.',
  },
  CLUSTER: {
    prompt: 'Ask the user to pick their geographic cluster/region.',
    fallback:
      "Which cluster region does this project belong to? Pick one below and I'll load the countries for you.",
  },
  COUNTRY: {
    prompt: 'User picked a cluster. Ask them to select the country within it.',
    fallback: 'Great choice! Now select the country within this cluster.',
  },
  COMPANY: {
    prompt:
      'User selected a country. Now ask them to pick the TP company operating there.',
    fallback: 'Nice! Now pick the TP company operating in this country.',
  },
  CLIENT: {
    prompt:
      'User picked a company. Ask them to select the client, or choose TP Internal if no external client.',
    fallback:
      'Company set! Who\'s the client for this project? If it\'s an internal initiative, go with "TP Internal".',
  },
  LOB: {
    prompt:
      'User selected a client. Now ask them to pick the Line of Business. Industry and language will auto-fill after this.',
    fallback:
      "Almost there! Pick the Line of Business and I'll automatically resolve the industry and language for you.",
  },
  OPERATIONAL_LOB: {
    prompt:
      'User selected a standard LOB. The Operational LOB is optional — they can skip it to continue.',
    fallback:
      '**Operational LOB** is optional. If your project has a specific operational LOB, type a keyword to search. Otherwise, just type **"skip"** to continue.',
  },
  PRIMARY_PROJECT: {
    prompt:
      'User wants to create a secondary project. Show the list of existing primary projects to link to.',
    fallback:
      'Got it \u2014 loading existing primary projects. Select the one this secondary project belongs to.',
  },
  TP_INTERNAL: {
    prompt:
      'User chose TP Internal \u2014 no external client. LOB/Industry/Language are not needed.',
    fallback:
      "Got it \u2014 this is a TP Internal project. I've skipped LOB, industry, and language since they're not needed. Go ahead and confirm your selections!",
  },
  SAVE_SUCCESS: {
    prompt: 'Draft was saved successfully and an OpportunityId was generated. Now transitioning to Project Details tab.',
    fallback:
      'Basic Info saved! Now let\'s fill in the **Project Details**.',
  },
  // Tab 2 prompts
  TRANSFORMATION_TYPE: {
    prompt: 'Ask the user to select the transformation type for their project.',
    fallback: 'What type of transformation is this project? Select from the options below.',
  },
  TRANSFORMATION_TYPE_SUB: {
    prompt: 'User selected a transformation type. Now ask them to select the specific sub-type (e.g., Consulting, Data Analytics, or Technology Products sub-category).',
    fallback: 'Now select the specific **sub-type** for this transformation.',
  },
  TRANSFORMATION_TYPE_L3: {
    prompt: 'User selected a sub-type. Now ask them to select the next level (e.g., Problem Solving type or Product Development type).',
    fallback: 'Select the next level for this transformation path.',
  },
  TRANSFORMATION_TYPE_L4: {
    prompt: 'User selected a level 3 type. Now ask them to select the final level (e.g., Custom Development type or Microservices sub-level).',
    fallback: 'Select the final sub-level for this transformation path.',
  },
  OBJECTIVE: {
    prompt: 'User selected transformation type. Now ask them to select the objective (Revenue or Cost).',
    fallback: 'Great! What\'s the **objective** \u2014 Revenue or Cost?',
  },
  NATURE: {
    prompt: 'User selected objective. Now ask them to select the nature (New or Existing).',
    fallback: 'Is this a **New** project or an **Existing** one?',
  },
  GROUP_CLASSIFICATION: {
    prompt: 'This Data Analytics project requires a group classification. Ask the user to select one.',
    fallback: 'This path requires a **Group Classification**. Select one below.',
  },
  EXTERNAL_PRODUCT: {
    prompt: 'This Technology Products project requires an external product selection. Ask the user to pick one.',
    fallback: 'Select the **External Product** associated with this project.',
  },
  PROJECT_NAME: {
    prompt: 'User selected nature. Now ask them to enter the project name.',
    fallback: 'Now enter a **project name** for this initiative.',
  },
  PROJECT_LEAD: {
    prompt: 'User entered project name. Now ask them to search for the project lead by name.',
    fallback: 'Who\'s leading this project? Type a name to search for the **Project Lead**.',
  },
  PROJECT_SPONSOR: {
    prompt: 'User selected project lead. Now ask them to search for the project sponsor.',
    fallback: 'Almost there! Search for the **Project Sponsor** by typing their name.',
  },
  REGIONAL_APPROVER: {
    prompt: 'This project requires regional approval. Ask the user to search for the regional approver.',
    fallback: 'This project requires **Regional Approval**. Search for the approver by name.',
  },
  DMAIC_STATUS: {
    prompt: 'User is on the DMAIC path. Ask them to select the current DMAIC phase (Define, Measure, Analyze, Improve, Control).',
    fallback: 'Select the current **DMAIC phase** for this project.',
  },
  DMAIC_STATUS_DATE: {
    prompt: 'User selected a DMAIC status. Now ask them to enter the DMAIC status date.',
    fallback: 'Enter the **DMAIC status date** (YYYY-MM-DD format).',
  },
  TRANSFORMATION_STATUS: {
    prompt: 'User selected project sponsor. Now ask them to select the transformation status.',
    fallback: 'Select the **Transformation Status** for this project.',
  },
  TRANSFORMATION_STATUS_DATE: {
    prompt: 'User selected a transformation status. Now ask them to enter the transformation status date.',
    fallback: 'Enter the **Transformation Status date** (YYYY-MM-DD format).',
  },
  PROJECT_STATUS: {
    prompt: 'This Data Analytics project requires a project status. Ask the user to select one.',
    fallback: 'Select the **Project Status** for this project.',
  },
  PROJECT_STATUS_DATE: {
    prompt: 'User selected project status. Now ask them to enter the project status date.',
    fallback: 'Enter the **Project Status date** (YYYY-MM-DD format).',
  },
  URGENCY: {
    prompt: 'Ask the user to select the urgency level for this project.',
    fallback: 'How urgent is this project? Select the **Urgency** level.',
  },
  STRATEGIC_VALUE: {
    prompt: 'Ask the user to select the strategic value for this project.',
    fallback: 'What\'s the **Strategic Value** of this project? Select below.',
  },
  DEPLOYMENT_DURATION: {
    prompt: 'Ask the user to enter the deployment duration in months (optional).',
    fallback: 'Enter the **Deployment Duration** in months (optional — type "skip" to skip).',
  },
  PAYBACK_PERIOD: {
    prompt: 'Ask the user to enter the payback period in months (optional).',
    fallback: 'Enter the **Payback Period** in months (optional — type "skip" to skip).',
  },
  TAB3_FINANCIALS: {
    prompt: 'Project Details saved. Now present the Financials tab. All fields are optional. If NLP pre-filled values, mention them. Tell the user to fill in the financial form below or click Skip Financials to leave all values empty.',
    fallback: 'Great — Project Details saved! Now let\'s fill in the **Financials** (all optional).\n\nEnter any revenue, cost, or benefit values below, or click **Skip Financials** to proceed with empty values.',
  },
  TAB3_FINANCIALS_SAVE_SUCCESS: {
    prompt: 'Financials saved. Transitioning to KPI tab.',
    fallback: 'Financials saved! Now let\'s add your **KPI metrics**.',
  },
  TAB2_SAVE_SUCCESS: {
    prompt: 'Project Details tab was saved successfully. Now transitioning to KPI tab.',
    fallback: 'Project Details saved! Now let\'s add your **KPI metrics**.',
  },
  // Tab 4 prompts
  METRIC_GROUP: {
    prompt: 'Ask the user to select a metric group for their KPI.',
    fallback: 'Time to add KPI metrics! Select a **Metric Group** to get started.',
  },
  METRIC: {
    prompt: 'User selected a metric group. Now ask them to pick a specific metric.',
    fallback: 'Great choice! Now pick the specific **metric** you want to track.',
  },
  KPI_VALUES: {
    prompt: 'User selected a metric. Now ask them to fill in the KPI values: As-Is, To-Be, Would-Be, Last Snapshot, and a description.',
    fallback: 'Now fill in the KPI values below \u2014 **As-Is** (current), **To-Be** (target), and optionally **Would-Be**, **Last Snapshot**, and a description.',
  },
  KPI_ADDED: {
    prompt: 'KPI was added successfully. Ask if they want to add another KPI or submit the project.',
    fallback: 'KPI added! Want to add another metric? Type **"add"** for more, or **"submit"** to finalize the project.',
  },
  TAB4_SUBMIT_SUCCESS: {
    prompt: 'Project has been finalized and submitted successfully.',
    fallback: 'Your project has been **submitted** successfully! All tabs are complete.',
  },
} as const;

// ── Status & UI Messages ─────────────────────────────────────

export const MSG = {
  CLUSTER_CLEARED:   'Cluster selection cleared \u2014 starting over from cluster.',
  COUNTRY_CLEARED:   'Country cleared \u2014 pick a new country.',
  COMPANY_CLEARED:   'Company cleared \u2014 pick a new company.',
  CLIENT_CLEARED:    'Client cleared \u2014 pick a new client.',
  LOB_CLEARED:       'LOB cleared \u2014 pick a new line of business.',
  OP_LOB_CLEARED:    'Operational LOB cleared \u2014 search again or skip.',
  PRIMARY_CLEARED:   'Primary project cleared \u2014 pick a different one.',
  GOING_BACK:        'Going back to project type selection...',
  STARTING_OVER:     'Starting over...',
  NO_REVERT:         'Nothing to revert right now.',
  SAVING:            'Saving Basic Info draft...',
  SAVING_TAB2:       'Saving Project Details...',
  SAVING_TAB3:       'Saving Financials...',
  SAVING_TAB4:       'Submitting project...',
  ADDING_KPI:        'Adding KPI...',
  DELETING_KPI:      'Deleting KPI...',
  PARSING:           'Parsing your input...',
  AUTO_RESOLVING:    'Resolving industry and language automatically...',
  PARSE_FAIL:        'Had trouble parsing. Let me walk you through step by step.',
  CHOOSE_TYPE:       'Choose "New Primary" or "Secondary".',
  NEW_PROJECT:       'New Primary Project',
  SECONDARY_PROJECT: 'Secondary (link to existing)',
  TP_INTERNAL_LABEL: 'TP Internal',
} as const;

export const TOAST = {
  DRAFT_OK: { title: 'Success',  body: 'Basic Info draft saved successfully!' },
  TAB2_OK:  { title: 'Success',  body: 'Project Details saved successfully!' },
  TAB3_OK:  { title: 'Success',  body: 'Financials saved successfully!' },
  TAB4_OK:  { title: 'Success',  body: 'Project submitted successfully!' },
  KPI_OK:   { title: 'Success',  body: 'KPI added successfully!' },
  KPI_DEL:  { title: 'Deleted',  body: 'KPI deleted.' },
  ERROR:    { title: 'Error',    body: 'Something went wrong. Please try again.' },
  REVERTED: { title: 'Reverted', body: 'Selection has been cleared.' },
} as const;

// ── Dynamic Message Helpers ──────────────────────────────────

export const noMatchMsg = (text: string): string =>
  `No match for "${text}". Pick from the dropdown or try a different keyword.`;

export const resolvedTpMsg = (parts: string[]): string =>
  `Resolved: ${parts.join(' \u2192 ')} \u2192 TP Internal. Review and confirm!`;

export const resolvedLobMsg = (parts: string[]): string =>
  `Resolved: ${parts.join(' \u2192 ')}. Resolving industry & language...`;

export const resolvedPartialMsg = (parts: string[]): string =>
  `Resolved: ${parts.join(' \u2192 ')}. Now pick a Line of Business.`;

export const autoResolvePrompt = (
  industry: string,
  language: string,
): { prompt: string; fallback: string } => ({
  prompt: `Industry auto-resolved to ${industry} and language to ${language}. All Basic Info fields are complete.`,
  fallback: `Done! Industry is set to ${industry} and language to ${language}. Everything looks good \u2014 go ahead and confirm your selections below!`,
});

export const linkedProjectPrompt = (
  id: string,
  cluster: string,
  country: string,
  company: string,
  client: string,
  lob: string,
): { prompt: string; fallback: string } => ({
  prompt: `User linked this as secondary project to ${id}. All fields auto-populated from primary: ${cluster} \u2192 ${country} \u2192 ${company} \u2192 ${client} \u2192 ${lob}.`,
  fallback: `Linked to ${id}! All fields have been auto-populated from the primary project:\n\n\u2022 Cluster: ${cluster}\n\u2022 Country: ${country}\n\u2022 Company: ${company}\n\u2022 Client: ${client}\n\u2022 LOB: ${lob}\n\nReview below and confirm!`,
});

// ── Factory ──────────────────────────────────────────────────

export function createInitialSummary(): SummaryState {
  return {
    clusterId: null,
    clusterName: null,
    clusterCountryId: null,
    clusterCountryName: null,
    companyId: null,
    companyName: null,
    clientId: null,
    clientName: null,
    lobId: null,
    lobName: null,
    operationalLob: null,
    industryId: null,
    industryName: null,
    languageName: null,
    isTpInternal: false,
    isSecondary: false,
    primaryProjectId: null,
    primaryProjectName: null,
    // Tab 2
    transformationTypeId: null,
    transformationTypeName: null,
    transformationTypeFirstLevelId: null,
    transformationTypeFirstLevelName: null,
    transformationTypeSecondLevelId: null,
    transformationTypeSecondLevelName: null,
    transformationTypeThirdLevelId: null,
    transformationTypeThirdLevelName: null,
    // Branching path flags
    isConsultingPath: false,
    isDataAnalyticsPath: false,
    isTechProductsPath: false,
    isDmaicPath: false,
    isProjectStatusEnable: false,
    isProjectStatusEnableForWithoutPSI: false,
    isGroupClassificationEnable: false,
    showExternalProductDropdown: false,
    objectiveId: null,
    objectiveName: null,
    natureId: null,
    natureName: null,
    groupClassificationId: null,
    groupClassificationName: null,
    externalProductId: null,
    externalProductValue: null,
    projectName: null,
    projectDescription: null,
    projectLeadName: null,
    projectLeadUPN: null,
    projectSponsorName: null,
    projectSponsorUPN: null,
    isRegionalApprovalRequired: false,
    regionalApproverId: null,
    regionalApproverName: null,
    regionalApproverUPN: null,
    dmaicProjectStatusId: null,
    dmaicProjectStatusName: null,
    dmaicProjectStatusDate: null,
    transformationStatusId: null,
    transformationStatusName: null,
    transformationStatusDate: null,
    projectStatusId: null,
    projectStatusName: null,
    projectStatusDate: null,
    urgencyId: null,
    urgencyName: null,
    strategicValueId: null,
    strategicValueName: null,
    deploymentDuration: null,
    paybackPeriod: null,
    // Tab 4
    kpiMetricGroupId: null,
    kpiMetricGroupName: null,
    kpiMetricId: null,
    kpiMetricName: null,
  };
}

export function createInitialKpiForm(): KpiFormData {
  return {
    asIs: '',
    toBe: '',
    wouldBe: '',
    lastSnapshot: '',
    description: '',
    customSubMetricsName: '',
  };
}

export function createInitialFinancialForm(): FinancialFormData {
  return {
    expectedRevenue: '',
    expectedInternalBenefit: '',
    expectedClientBenefit: '',
    estimatedProjectCost: '',
    actualProjectCost: '',
    currency: '',
    internalBenefit: '',
    clientBenefit: '',
    recurrentRevenue: '',
    realisedBenefit: '',
    realisedRevenue: '',
    additionalInvestment: '',
  };
}

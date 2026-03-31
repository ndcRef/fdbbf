// ───────────────────────────────────────────────────────────────
// project-wizard-reset.ts — Cascade reset maps (programmatic)
// ───────────────────────────────────────────────────────────────

import { type SummaryState } from '../constants/project-wizard.constants';
import { MSG } from '../constants/project-wizard.constants';

type SK = keyof SummaryState;

/** Build a Partial<SummaryState> with keys → null, merged with boolean overrides. */
const nullify = (keys: SK[], over?: Partial<SummaryState>): Partial<SummaryState> => {
  const r: Record<string, unknown> = {};
  for (const k of keys) r[k] = null;
  return over ? { ...r, ...over } as Partial<SummaryState> : r as Partial<SummaryState>;
};

// ── Composable field groups ──────────────────────────────────

// Tab 2 tail
const _strat: SK[]       = ['strategicValueId', 'strategicValueName'];
const _urg: SK[]         = ['urgencyId', 'urgencyName', ..._strat];
const _xfStat: SK[]      = ['transformationStatusId', 'transformationStatusName', 'transformationStatusDate'];
const _dmaicStat: SK[]   = ['dmaicProjectStatusId', 'dmaicProjectStatusName', 'dmaicProjectStatusDate'];
const _projStat: SK[]    = ['projectStatusId', 'projectStatusName', 'projectStatusDate'];
const _allStat: SK[]     = [..._xfStat, ..._dmaicStat, ..._projStat, ..._urg];
const _regional: SK[]    = ['regionalApproverId', 'regionalApproverName', 'regionalApproverUPN'];
const _sponsor: SK[]     = ['projectSponsorName', 'projectSponsorUPN'];
const _lead: SK[]        = ['projectLeadName', 'projectLeadUPN', ..._sponsor];
const _projInfo: SK[]    = ['projectName', 'projectDescription', ..._lead];
const _extProd: SK[]     = ['externalProductId', 'externalProductValue'];
const _grpClass: SK[]    = ['groupClassificationId', 'groupClassificationName', ..._extProd];
const _nature: SK[]      = ['natureId', 'natureName', ..._grpClass];
const _obj: SK[]         = ['objectiveId', 'objectiveName', ..._nature];
const _l4: SK[]          = ['transformationTypeThirdLevelId', 'transformationTypeThirdLevelName'];
const _l3: SK[]          = ['transformationTypeSecondLevelId', 'transformationTypeSecondLevelName', ..._l4];
const _l2: SK[]          = ['transformationTypeFirstLevelId', 'transformationTypeFirstLevelName', ..._l3];
const _l1: SK[]          = ['transformationTypeId', 'transformationTypeName', ..._l2];

// Tab 1 cascade
const _industry: SK[]    = ['industryId', 'industryName', 'languageName'];
const _opLob: SK[]       = ['operationalLob', ..._industry];
const _lob: SK[]         = ['lobId', 'lobName', ..._opLob];
const _client: SK[]      = ['clientId', 'clientName', ..._lob];
const _company: SK[]     = ['companyId', 'companyName', ..._client];
const _country: SK[]     = ['clusterCountryId', 'clusterCountryName', ..._company];
const _cluster: SK[]     = ['clusterId', 'clusterName', ..._country];

// Boolean override sets
const _tp = { isTpInternal: false } as const;
const _dmaicFlags = { isDmaicPath: false, isProjectStatusEnable: false } as const;
const _allPathFlags = {
  isConsultingPath: false, isDataAnalyticsPath: false, isTechProductsPath: false,
  isDmaicPath: false, isProjectStatusEnable: false, isProjectStatusEnableForWithoutPSI: false,
  isGroupClassificationEnable: false, showExternalProductDropdown: false,
  isRegionalApprovalRequired: false,
} as const;

// ── Exports ──────────────────────────────────────────────────

export const RESET_PARTIALS: Record<string, Partial<SummaryState>> = {
  // Tab 1
  cluster:                nullify(_cluster, _tp),
  country:                nullify(_country, _tp),
  company:                nullify(_company, _tp),
  client:                 nullify(_client, _tp),
  lob:                    nullify(_lob),
  operational_lob:        nullify(_opLob),
  primary_project:        nullify(['primaryProjectId', 'primaryProjectName', ..._cluster]),
  // Tab 2 — transformation hierarchy
  transformation_type:      nullify([..._l1, ..._obj, ..._projInfo, ..._regional, ..._allStat], _allPathFlags),
  transformation_type_sub:  nullify([..._l2, ..._obj, ..._projInfo, ..._allStat], _dmaicFlags),
  transformation_type_l3:   nullify([..._l3, 'objectiveId', 'objectiveName', 'natureId', 'natureName', ..._projInfo, ..._dmaicStat, ..._xfStat, ..._urg], _dmaicFlags),
  transformation_type_l4:   nullify([..._l4, 'objectiveId', 'objectiveName', 'natureId', 'natureName', ..._projInfo, ..._xfStat, ..._urg]),
  // Tab 2 — details
  objective:                nullify([..._obj, ..._projInfo, ..._allStat]),
  nature:                   nullify([..._nature, ..._projInfo, ..._allStat]),
  group_classification:     nullify([..._grpClass, ..._projInfo, ..._xfStat, ..._projStat, ..._urg]),
  external_product:         nullify([..._extProd, ..._projInfo, ..._xfStat, ..._urg]),
  project_name:             nullify([..._projInfo, ..._allStat]),
  project_lead:             nullify([..._lead, ..._allStat]),
  project_sponsor:          nullify([..._sponsor, ..._allStat]),
  regional_approver:        nullify([..._regional, ..._xfStat, ..._urg]),
  // Tab 2 — status chain
  transformation_status:    nullify([..._xfStat, ..._dmaicStat, ..._projStat, ..._urg]),
  transformation_status_date: nullify(['transformationStatusDate' as SK, ..._dmaicStat, ..._projStat, ..._urg]),
  dmaic_status:             nullify([..._dmaicStat, ..._urg]),
  dmaic_status_date:        nullify(['dmaicProjectStatusDate', ..._urg]),
  project_status:           nullify([..._projStat, ..._urg]),
  project_status_date:      nullify(['projectStatusDate' as SK, ..._urg]),
  urgency:                  nullify(_urg),
  strategic_value:          nullify(_strat),
  // Tab 4
  metric_group:             nullify(['kpiMetricGroupId', 'kpiMetricGroupName', 'kpiMetricId', 'kpiMetricName']),
  metric:                   nullify(['kpiMetricId', 'kpiMetricName']),
};

export const RESET_STATUS_MSG: Record<string, string> = {
  cluster: MSG.CLUSTER_CLEARED, country: MSG.COUNTRY_CLEARED,
  company: MSG.COMPANY_CLEARED, client: MSG.CLIENT_CLEARED,
  lob: MSG.LOB_CLEARED, operational_lob: MSG.OP_LOB_CLEARED,
  primary_project: MSG.PRIMARY_CLEARED,
  transformation_type: 'Transformation type cleared — pick again.',
  transformation_type_sub: 'Sub-type cleared — pick again.',
  transformation_type_l3: 'Level 3 type cleared — pick again.',
  transformation_type_l4: 'Level 4 type cleared — pick again.',
  objective: 'Objective cleared — pick again.',
  nature: 'Nature cleared — pick again.',
  group_classification: 'Group classification cleared — pick again.',
  external_product: 'External product cleared — pick again.',
  project_name: 'Project name cleared — enter again.',
  project_lead: 'Project lead cleared — search again.',
  project_sponsor: 'Project sponsor cleared — search again.',
  regional_approver: 'Regional approver cleared — search again.',
  dmaic_status: 'DMAIC status cleared — pick again.',
  dmaic_status_date: 'DMAIC status date cleared — enter again.',
  transformation_status: 'Transformation status cleared — pick again.',
  transformation_status_date: 'Transformation status date cleared — enter again.',
  project_status: 'Project status cleared — pick again.',
  project_status_date: 'Project status date cleared — enter again.',
  urgency: 'Urgency cleared — pick again.',
  strategic_value: 'Strategic value cleared — pick again.',
  metric_group: 'Metric group cleared — pick again.',
  metric: 'Metric cleared — pick again.',
};

// project-wizard-nlp.ts — NLP engine: parsing, cascade, LLM smart-match, auto-select, preflight
// Standalone arrow functions (no class) to avoid circular deps

import type { ProjectWizardService } from './project-wizard.service';
import type { WizardHandlers } from './project-wizard-handlers';
import {
  type IdNameItem, type ClientItem, type UserSearchItem, type ParsedProjectInput,
  PROMPTS, MSG, OPTIONS_LABELS, resolvedTpMsg, resolvedPartialMsg,
} from '../constants/project-wizard.constants';

// ── Shared NLP field → ParsedProjectInput key map ─────────

const NLP_MAP: Record<string, keyof ParsedProjectInput> = {
  cluster: 'cluster', country: 'country', company: 'company', lob: 'lob', client: 'client',
  transformation_type: 'transformationType', transformation_type_sub: 'transformationTypeSub',
  transformation_type_l3: 'transformationTypeSecondLevel', transformation_type_l4: 'transformationTypeSecondLevel',
  objective: 'objective', nature: 'nature',
  transformation_status: 'transformationStatus', project_status: 'transformationStatus', dmaic_status: 'dmaicStatus',
  urgency: 'urgency', strategic_value: 'strategicValue', metric_group: 'metricGroup', metric: 'metric',
  project_name: 'projectName', project_lead: 'projectLeadName',
  project_sponsor: 'projectSponsorName', regional_approver: 'regionalApproverName',
  transformation_status_date: 'transformationStatusDate', dmaic_status_date: 'dmaicStatusDate', project_status_date: 'projectStatusDate',
};

const DROPDOWN_KEYS = [
  'cluster', 'country', 'company', 'lob',
  'transformation_type', 'transformation_type_sub', 'transformation_type_l3', 'transformation_type_l4',
  'objective', 'nature', 'transformation_status', 'project_status', 'dmaic_status',
  'urgency', 'strategic_value', 'metric_group', 'metric',
] as const;

// ── Fuzzy Matching ────────────────────────────────────────

export const fuzzy = (items: IdNameItem[], query: string): IdNameItem | undefined => {
  const q = query.toLowerCase().trim();
  const exact = items.find(i => i.name?.toLowerCase() === q);
  if (exact) return exact;
  const sub = items.find(i => i.name?.toLowerCase().includes(q) || q.includes(i.name?.toLowerCase() ?? '\0'));
  if (sub) return sub;
  const qWords = q.split(/\s+/).filter(w => w.length > 1);
  if (!qWords.length) return undefined;
  let best: IdNameItem | undefined, bestScore = 0;
  for (const item of items) {
    const nameWords = (item.name?.toLowerCase() ?? '').split(/\s+/).filter(w => w.length > 1);
    const hits = qWords.filter(qw => nameWords.some(nw => nw.includes(qw) || qw.includes(nw))).length;
    const score = hits / Math.max(qWords.length, nameWords.length);
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore >= 0.5 ? best : undefined;
};

export const fuzzyClient = (items: ClientItem[], query: string): ClientItem | undefined => {
  const q = query.toLowerCase();
  return items.find(i => i.name?.toLowerCase() === q)
    ?? items.find(i => i.name?.toLowerCase()?.includes(q) || q.includes(i.name?.toLowerCase() ?? '\0'));
};

export const fuzzyUser = (items: UserSearchItem[], query: string): UserSearchItem | undefined => {
  const q = query.toLowerCase().trim();
  return items.find(i => i.displayName?.toLowerCase() === q)
    ?? items.find(i => i.displayName?.toLowerCase()?.includes(q) || q.includes(i.displayName?.toLowerCase() ?? '\0'))
    ?? items[0];
};

// ── LLM Smart Match (fallback when fuzzy fails) ───────────

const smartMatch = async (
  svc: ProjectWizardService, field: string, userValue: string, options: IdNameItem[],
): Promise<IdNameItem | undefined> => {
  try {
    const optNames = options.map(o => o.name).filter(Boolean) as string[];
    if (!optNames.length) return undefined;
    const result = (await svc.request<{ matchedName: string | null; confidence: number }>(
      'smart_match', { smartMatchInput: { field, userValue, options: optNames } },
    )).data;
    if (result.matchedName && result.confidence >= 0.6) {
      const matched = options.find(o => o.name?.toLowerCase() === result.matchedName!.toLowerCase());
      if (matched) { console.log(`[SmartMatch] "${userValue}" ≈ "${matched.name}" (${(result.confidence * 100).toFixed(0)}%)`); return matched; }
    }
    console.log(`[SmartMatch] no match for "${userValue}" (${result.confidence})`);
  } catch (err) { console.log('[SmartMatch] fallback failed:', err); }
  return undefined;
};

const smartMatchClient = async (
  svc: ProjectWizardService, userValue: string, options: ClientItem[],
): Promise<ClientItem | undefined> => {
  const matched = await smartMatch(svc, 'client', userValue, options.map(c => ({ id: String(c.id), name: c.name }) as IdNameItem));
  return matched ? options.find(c => c.name?.toLowerCase() === matched.name?.toLowerCase()) : undefined;
};

// ── Generic Helpers ───────────────────────────────────────

const handleUserSearch = async (
  svc: ProjectWizardService, h: WizardHandlers, field: string, nlpName: string,
  searchFn: (name: string) => Promise<void>, selectFn: (item: UserSearchItem) => Promise<void>, label: string,
): Promise<boolean> => {
  svc.autoFilling = false;
  await searchFn(nlpName);
  const items = svc.options();
  if (items.length >= 1) {
    const match = (fuzzyUser(items as UserSearchItem[], nlpName) ?? items[0]) as UserSearchItem;
    svc.autoFilling = true;
    // Strip stale 'options' messages from the user-search so they don't
    // leak into the next field's dropdown while auto-fill continues.
    svc.messages.update(msgs => msgs.filter(m => m.role !== 'options'));
    svc.addMessage('status', `✓ ${label}: ${match.displayName} (${match.userPrincipalName})`);
    svc.requestScroll();
    await selectFn(match);
    return true;
  }
  pauseAutoFill(svc, field);
  return false;
};

const handleDateField = async (
  svc: ProjectWizardService, _h: WizardHandlers, field: string, nlpDate: string | null | undefined,
  summaryKey: string, label: string, nextStep: () => Promise<void>,
): Promise<boolean> => {
  const dateToUse = nlpDate ?? (svc.autoFilling ? new Date().toISOString().split('T')[0] : null);
  if (!dateToUse) { pauseAutoFill(svc, field); return false; }
  svc.patchSummary({ [summaryKey]: dateToUse });
  svc.addMessage('status', `✓ ${label}: ${dateToUse}${!nlpDate ? ' (auto-set today)' : ''}`);
  svc.requestScroll();
  await nextStep();
  return true;
};

const statusMsg = (text: string, svc: ProjectWizardService) => { svc.addMessage('status', text); svc.requestScroll(); };

// ── NLP Parse & Bind ──────────────────────────────────────

export const parseAndBind = async (svc: ProjectWizardService, h: WizardHandlers, text: string): Promise<void> => {
  svc.startExecutionTimer();
  svc.setLoading(true, 'understanding');
  svc.addMessage('status', MSG.PARSING);

  try {
    const parsed = (await svc.request<ParsedProjectInput>('parse_project_input', { userText: text })).data;
    const hasTab2 = !!(parsed.transformationType || parsed.objective || parsed.projectName || parsed.metricGroup);
    svc.nlpParsed.set(hasTab2 ? parsed : null);
    if (hasTab2) svc.autoFilling = true;
    console.log('[NLP] Extracted:', JSON.stringify(parsed, null, 2));

    const cr = (await svc.request<{
      clusterId?: string; clusterName?: string; clusterCountryId?: string; clusterCountryName?: string;
      companyId?: string; companyName?: string; clientId?: number; clientName?: string;
      lobId?: string; lobName?: string; isTpInternal?: boolean;
      industryId?: string; industryName?: string; languageName?: string;
      failedField?: string; failedValue?: string; availableOptions?: unknown;
    }>('resolve_cascade', {
      cascadeInput: {
        cluster: parsed.cluster ?? null, country: parsed.country ?? null, company: parsed.company ?? null,
        client: parsed.client ?? null, lob: parsed.lob ?? null, isTpInternal: parsed.isTpInternal ?? false,
      },
    })).data;

    if (cr.clusterId) svc.patchSummary({ clusterId: cr.clusterId, clusterName: cr.clusterName });
    if (cr.clusterCountryId) svc.patchSummary({ clusterCountryId: cr.clusterCountryId, clusterCountryName: cr.clusterCountryName });
    if (cr.companyId) svc.patchSummary({ companyId: cr.companyId, companyName: cr.companyName });

    if (cr.isTpInternal) {
      svc.patchSummary({ clientName: MSG.TP_INTERNAL_LABEL, isTpInternal: true });
      const resolved = [cr.clusterName, cr.clusterCountryName, cr.companyName].filter(Boolean) as string[];
      svc.activeField.set('confirm'); svc.options.set([]);
      svc.addMessage('assistant', resolvedTpMsg(resolved)); svc.requestScroll();
      return;
    }
    if (cr.clientId != null) svc.patchSummary({ clientId: cr.clientId, clientName: cr.clientName, isTpInternal: false });
    if (cr.lobId) svc.patchSummary({ lobId: cr.lobId, lobName: cr.lobName });
    if (cr.industryId !== undefined) svc.patchSummary({ industryId: cr.industryId ?? '', industryName: cr.industryName ?? 'N/A', languageName: cr.languageName ?? 'N/A' });

    if (cr.failedField) {
      const fv = cr.failedValue, ff = cr.failedField;
      const opts = cr.availableOptions as IdNameItem[] | ClientItem[] | undefined;
      svc.showOpts(ff, opts ?? [], fv
        ? `Couldn't match "${fv}". Pick ${ff === 'lob' ? 'a line of business' : `a ${ff}`}:`
        : `Pick ${ff === 'lob' ? 'a line of business' : `a ${ff}`}:`);
      return;
    }

    svc.nlpPreviewTab1.set({
      cluster: cr.clusterName ?? '', country: cr.clusterCountryName ?? '',
      company: cr.companyName ?? '', client: cr.clientName ?? '', lob: cr.lobName ?? '',
    });
    showNlpPreview(svc, h, parsed);
  } catch (error: unknown) {
    const errObj = error as Record<string, unknown> | undefined;
    const httpError = errObj?.['error'] as Record<string, unknown> | undefined;
    const backendMsg = (httpError?.['message'] as string) ?? (errObj?.['message'] as string) ?? '';
    if (backendMsg.includes('NLP_PARSE_FAILED')) {
      svc.addMessage('assistant',
        '⚠️ The AI parsing service is temporarily unavailable (rate-limited). '
        + 'Please wait a minute and **type your description again** to retry. '
        + 'Or start manually — pick a cluster below.');
      svc.toastr.warning('AI service temporarily unavailable', 'LLM Rate Limited');
    } else {
      svc.addMessage('assistant', MSG.PARSE_FAIL);
      svc.toastr.error('Something went wrong. Please try again.', 'Error');
    }
    console.error('[parseAndBind] Error:', backendMsg, error);
    if (!svc.activeField()) await h.loadClusters();
  } finally {
    svc.setLoading(false); svc.requestScroll();
  }
};

// ── NLP Blueprint ─────────────────────────────────────────

export const buildNlpBlueprint = (tab1: string[], p: ParsedProjectInput): string => {
  const lines: string[] = ['✅ **Analysis complete** — engine extracted the following:', '', `📍 **Basic Info:** ${tab1.join(' → ')}`];
  const tab2Defs: [string, string | undefined][] = [
    ['Type', p.transformationType], ['Sub', p.transformationTypeSub], ['L3', p.transformationTypeSecondLevel],
    ['Objective', p.objective], ['Nature', p.nature], ['Name', p.projectName ? `"${p.projectName}"` : undefined],
    ['Lead', p.projectLeadName], ['Sponsor', p.projectSponsorName], ['Status', p.transformationStatus],
    ['DMAIC', p.dmaicStatus], ['Urgency', p.urgency], ['Strategic Value', p.strategicValue],
  ];
  const tab2 = tab2Defs.filter(([, v]) => v).map(([k, v]) => `${k}: **${v}**`);
  lines.push(tab2.length ? `📋 **Project Details:** ${tab2.join(' · ')}` : `📋 **Project Details:** _(will ask for missing fields)_`);

  const finFields = [p.expectedRevenue, p.expectedInternalBenefit, p.expectedClientBenefit,
    p.estimatedProjectCost, p.actualProjectCost, p.currency, p.internalBenefit,
    p.clientBenefit, p.recurrentRevenue, p.realisedBenefit, p.realisedRevenue, p.additionalInvestment];
  const fin = ([['Revenue', p.expectedRevenue], ['Est. Cost', p.estimatedProjectCost], ['Currency', p.currency]] as [string, string | undefined][])
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  lines.push(finFields.some(Boolean)
    ? `💰 **Financials:** ${fin.length ? fin.join(' · ') : '_(values extracted — will auto-save)_'}`
    : `💰 **Financials:** _(optional — will auto-skip unless objective is Sell More)_`);

  const kpiDefs: [string, string | undefined][] = [['Group', p.metricGroup], ['Metric', p.metric], ['As-Is', p.asIsValue], ['To-Be', p.toBeValue]];
  const kpi = kpiDefs.filter(([, v]) => v).map(([k, v]) => `${k}: **${v}**`);
  lines.push(kpi.length ? `📊 **KPI:** ${kpi.join(' · ')}` : `📊 **KPI:** _(will ask for metric group, metric, and values)_`);
  lines.push('', '🚀 **Starting engine** — auto-filling all resolved fields...');
  return lines.join('\n');
};

// ── NLP Preview & Preflight ───────────────────────────────

export const showNlpPreview = (svc: ProjectWizardService, _h: WizardHandlers, p: ParsedProjectInput): void => {
  const hasTab2 = !!(p.transformationType || p.objective || p.projectName || p.metricGroup);
  svc.nlpParsed.set(hasTab2 ? p : null);
  if (hasTab2) svc.autoFilling = true;
  svc.activeField.set('nlp_preview'); svc.options.set([]); svc.requestScroll();
};

export const confirmNlpPreview = async (svc: ProjectWizardService, h: WizardHandlers): Promise<void> => {
  const p = svc.nlpParsed();
  if (!p) { await h.askOperationalLob(); return; }
  svc.clearMessages();
  statusMsg('✓ Preview confirmed — starting engine...', svc);
  if (preflightNeeded(p)) { showPreflightCard(svc, p); return; }
  await h.askOperationalLob();
};

export const preflightNeeded = (p: ParsedProjectInput): boolean =>
  !(p.transformationType && p.objective && p.nature && p.urgency && p.strategicValue
    && p.transformationStatus && p.metricGroup && p.projectName
    && p.deploymentDuration && p.paybackPeriod && p.asIsValue && p.toBeValue);

export const showPreflightCard = (svc: ProjectWizardService, p: ParsedProjectInput): void => {
  svc.preflightForm.set({
    transformationType: p.transformationType ?? '', objective: p.objective ?? '',
    nature: p.nature ?? '', urgency: p.urgency ?? '', strategicValue: p.strategicValue ?? '',
    transformationStatus: p.transformationStatus ?? '', metricGroup: p.metricGroup ?? '', projectName: p.projectName ?? '',
    deploymentDuration: p.deploymentDuration ?? '', paybackPeriod: p.paybackPeriod ?? '',
    expectedRevenue: p.expectedRevenue ?? '', estimatedProjectCost: p.estimatedProjectCost ?? '', currency: p.currency ?? '',
    asIsValue: p.asIsValue ?? '', toBeValue: p.toBeValue ?? '',
  });
  svc.activeField.set('preflight'); svc.options.set([]); svc.requestScroll();
};

export const submitPreflight = async (svc: ProjectWizardService, h: WizardHandlers): Promise<void> => {
  const form = svc.preflightForm(), p = svc.nlpParsed();
  if (!p) return;
  svc.nlpParsed.set({
    ...p,
    transformationType: form.transformationType || p.transformationType,
    objective: form.objective || p.objective, nature: form.nature || p.nature,
    urgency: form.urgency || p.urgency, strategicValue: form.strategicValue || p.strategicValue,
    transformationStatus: form.transformationStatus || p.transformationStatus,
    metricGroup: form.metricGroup || p.metricGroup, projectName: form.projectName || p.projectName,
    deploymentDuration: form.deploymentDuration || p.deploymentDuration,
    paybackPeriod: form.paybackPeriod || p.paybackPeriod,
    expectedRevenue: form.expectedRevenue || p.expectedRevenue,
    estimatedProjectCost: form.estimatedProjectCost || p.estimatedProjectCost,
    currency: form.currency || p.currency,
    asIsValue: form.asIsValue || p.asIsValue,
    toBeValue: form.toBeValue || p.toBeValue,
  });
  svc.clearMessages();
  statusMsg('✓ Pre-flight done — starting engine...', svc);
  await h.askOperationalLob();
};

// ── Auto-Select Engine ────────────────────────────────────
// Chains through fields using NLP values: fuzzy first → LLM smart-match fallback

export const tryAutoSelect = async (svc: ProjectWizardService, h: WizardHandlers): Promise<boolean> => {
  const p = svc.nlpParsed();
  if (!p || !svc.autoFilling) return false;
  const field = svc.activeField(), opts = svc.options();

  // Client (special: ClientItem type)
  if (field === 'client' && opts.length) {
    const nv = p.client;
    if (nv) {
      const match = fuzzyClient(opts as ClientItem[], nv) ?? await smartMatchClient(svc, nv, opts as ClientItem[]);
      if (match) { statusMsg(`✓ ${match.name}`, svc); await h.selectClient(match); return true; }
    }
    pauseAutoFill(svc, field!); return false;
  }

  // Generic dropdown fields (fuzzy → LLM fallback)
  if (field && DROPDOWN_KEYS.includes(field as typeof DROPDOWN_KEYS[number]) && NLP_MAP[field] && opts.length) {
    const nv = p[NLP_MAP[field]] as string | undefined;
    console.log(`[AutoFill] field=${field}, nlpKey=${NLP_MAP[field]}, nlpValue=${nv}, opts=${opts.length}`);
    if (nv) {
      const match = fuzzy(opts as IdNameItem[], nv) ?? await smartMatch(svc, field, nv, opts as IdNameItem[]);
      if (match) { statusMsg(`✓ ${match.name}`, svc); await h.applyMatch(match); return true; }
    }
    pauseAutoFill(svc, field!); return false;
  }

  // Fields that always pause for user input (no NLP extraction available)
  if (field === 'group_classification' || field === 'external_product' || field === 'operational_lob') { pauseAutoFill(svc, field!); return false; }

  // Confirm Tab 1
  if (field === 'confirm') { statusMsg('✓ Basic Info complete — saving...', svc); await h.saveDraft(); return true; }

  // Project Name
  if (field === 'project_name' && p.projectName) {
    svc.patchSummary({ projectName: p.projectName, projectDescription: p.projectDescription ?? null });
    statusMsg(`✓ Project: ${p.projectName}`, svc); await h.askProjectLead(); return true;
  }

  // User search fields
  if (field === 'project_lead' && p.projectLeadName)
    return handleUserSearch(svc, h, field, p.projectLeadName, n => h.searchUsers('project_lead', n), i => h.selectProjectLead(i), 'Lead');
  if (field === 'project_sponsor' && p.projectSponsorName)
    return handleUserSearch(svc, h, field, p.projectSponsorName, n => h.searchUsers('project_sponsor', n), i => h.selectProjectSponsor(i), 'Sponsor');
  if (field === 'regional_approver' && p.regionalApproverName)
    return handleUserSearch(svc, h, field, p.regionalApproverName, n => h.searchRegionalApprover(n), i => h.selectRegionalApprover(i), 'Regional Approver');

  // Date fields
  if (field === 'transformation_status_date')
    return handleDateField(svc, h, field, p.transformationStatusDate, 'transformationStatusDate', 'Transformation Status Date', async () => {
      const s = svc.summary();
      if (s.isDmaicPath && s.isProjectStatusEnable) await h.loadDmaicStatuses();
      else if (s.isDataAnalyticsPath && s.isProjectStatusEnableForWithoutPSI) await h.loadProjectStatuses();
      else await h.loadUrgencies();
    });
  if (field === 'dmaic_status_date')
    return handleDateField(svc, h, field, p.dmaicStatusDate ?? p.transformationStatusDate, 'dmaicProjectStatusDate', 'DMAIC Date', async () => {
      if (svc.summary().isProjectStatusEnable) await h.loadProjectStatuses(); else await h.loadUrgencies();
    });
  if (field === 'project_status_date')
    return handleDateField(svc, h, field, p.projectStatusDate ?? p.transformationStatusDate, 'projectStatusDate', 'Status Date', () => h.loadUrgencies());

  // Optional numeric fields
  if (field === 'deployment_duration') {
    if (p.deploymentDuration) {
      svc.patchSummary({ deploymentDuration: p.deploymentDuration });
      statusMsg(`✓ Deployment Duration: ${p.deploymentDuration} months`, svc); await h.askPaybackPeriod(); return true;
    }
    svc.autoFilling = false;
    svc.clearMessages();
    const fb = (PROMPTS as Record<string, { fallback: string }>)['DEPLOYMENT_DURATION']?.fallback;
    if (fb) svc.addMessage('assistant', fb); svc.requestScroll(); return false;
  }
  if (field === 'payback_period') {
    if (p.paybackPeriod) {
      svc.patchSummary({ paybackPeriod: p.paybackPeriod });
      statusMsg(`✓ Payback Period: ${p.paybackPeriod} months`, svc); await h.showTab2Confirm(); return true;
    }
    svc.autoFilling = false;
    svc.clearMessages();
    const fb = (PROMPTS as Record<string, { fallback: string }>)['PAYBACK_PERIOD']?.fallback;
    if (fb) svc.addMessage('assistant', fb); svc.requestScroll(); return false;
  }

  // Tab 2 Confirm (backend validate_tab2)
  if (field === 'tab2_confirm') {
    const s = svc.summary();
    const v = (await svc.request<{ valid: boolean; firstMissingField?: string; message?: string }>('validate_tab2', {
      tab2Validation: {
        objectiveId: s.objectiveId, natureId: s.natureId,
        isGroupClassificationEnable: s.isGroupClassificationEnable, groupClassificationId: s.groupClassificationId,
        showExternalProductDropdown: s.showExternalProductDropdown, externalProductId: s.externalProductId,
        projectName: s.projectName, projectLeadName: s.projectLeadName, projectSponsorName: s.projectSponsorName,
        isRegionalApprovalRequired: s.isRegionalApprovalRequired, regionalApproverId: s.regionalApproverId,
        transformationStatusId: s.transformationStatusId, transformationStatusDate: s.transformationStatusDate,
        isDmaicPath: s.isDmaicPath, dmaicProjectStatusId: s.dmaicProjectStatusId, dmaicProjectStatusDate: s.dmaicProjectStatusDate,
        isDataAnalyticsPath: s.isDataAnalyticsPath, isProjectStatusEnableForWithoutPSI: s.isProjectStatusEnableForWithoutPSI,
        projectStatusId: s.projectStatusId, projectStatusDate: s.projectStatusDate,
        urgencyId: s.urgencyId, strategicValueId: s.strategicValueId,
      },
    })).data;
    if (!v.valid && v.firstMissingField) {
      statusMsg(v.message ?? `⚠ ${v.firstMissingField} is required`, svc);
      const redir: Record<string, () => Promise<void>> = {
        objective: () => h.loadObjectives(), nature: () => h.loadNatures(),
        group_classification: () => h.loadGroupClassifications(), external_product: () => h.loadExternalProducts(),
        project_name: () => h.askProjectName(), project_lead: () => h.askProjectLead(),
        project_sponsor: () => h.askProjectSponsor(), regional_approver: () => h.askRegionalApprover(),
        transformation_status: () => h.loadTransformationStatuses(), transformation_status_date: () => h.askTransformationStatusDate(),
        dmaic_status: () => h.loadDmaicStatuses(), dmaic_status_date: () => h.askDmaicStatusDate(),
        project_status: () => h.loadProjectStatuses(), project_status_date: () => h.askProjectStatusDate(),
        urgency: () => h.loadUrgencies(), strategic_value: () => h.loadStrategicValues(),
      };
      const redirect = redir[v.firstMissingField];
      if (redirect) await redirect();
      return true;
    }
    statusMsg('✓ Project Details complete — saving...', svc); await h.saveTab2Draft(); return true;
  }

  // Tab 3 Financials
  if (field === 'tab3_financials' && svc.autoFilling) {
    if (svc.summary().objectiveName === 'Sell More' && !p.expectedRevenue?.trim()) {
      svc.autoFilling = false;
      svc.clearMessages();
      svc.addMessage('assistant', '⚠️ **Expected Revenue is required** when Objective is **Sell More**. Please fill in the Expected Revenue field in the form below.');
      svc.requestScroll(); return false;
    }
    const finFields = [p.expectedRevenue, p.expectedInternalBenefit, p.expectedClientBenefit,
      p.estimatedProjectCost, p.actualProjectCost, p.currency, p.internalBenefit,
      p.clientBenefit, p.recurrentRevenue, p.realisedBenefit, p.realisedRevenue, p.additionalInvestment];
    if (finFields.some(Boolean)) {
      svc.summary.update(s => ({
        ...s,
        expectedRevenue: p.expectedRevenue || undefined, expectedInternalBenefit: p.expectedInternalBenefit || undefined,
        expectedClientBenefit: p.expectedClientBenefit || undefined, estimatedProjectCost: p.estimatedProjectCost || undefined,
        actualProjectCost: p.actualProjectCost || undefined, currency: p.currency || undefined,
        internalBenefit: p.internalBenefit || undefined, clientBenefit: p.clientBenefit || undefined,
        recurrentRevenue: p.recurrentRevenue || undefined, realisedBenefit: p.realisedBenefit || undefined,
        realisedRevenue: p.realisedRevenue || undefined, additionalInvestment: p.additionalInvestment || undefined,
      }));
      statusMsg('✓ Financials auto-filled from description — saving...', svc); await h.saveTab3(); return true;
    }
    svc.autoFilling = false;
    svc.clearMessages();
    return false;
  }
  if (field === 'tab3_financials') return false;

  // Tab 4 KPI
  if (field === 'kpi_values') {
    if (p.asIsValue && p.toBeValue) {
      svc.kpiForm.set({
        asIs: p.asIsValue, toBe: p.toBeValue, wouldBe: p.wouldBeValue ?? '',
        lastSnapshot: p.lastSnapshotValue ?? '', description: p.kpiDescription ?? '', customSubMetricsName: '',
      });
      if (svc.autoFilling) {
        statusMsg(`✓ KPI: As-Is=${p.asIsValue}, To-Be=${p.toBeValue} — adding...`, svc); await h.addKpi(); return true;
      }
      svc.clearMessages();
      svc.addMessage('assistant', `KPI form pre-filled — **As-Is:** ${p.asIsValue}, **To-Be:** ${p.toBeValue}. Review optional fields if needed, then click **Add KPI**.`);
      svc.requestScroll();
    }
    svc.autoFilling = false; svc.clearMessages(); return false;
  }
  if (field === 'kpi_list' && svc.kpiList().length > 0) { await h.showTab4Confirm(); return true; }
  if (field === 'tab4_confirm') { statusMsg('✓ All tabs complete — submitting project...', svc); await h.saveTab4Final(); return true; }

  // Fallback
  if (field && svc.options().length > 0) pauseAutoFill(svc, field);
  return false;
};

// ── Pause Auto-Fill ───────────────────────────────────────

export const pauseAutoFill = (svc: ProjectWizardService, field: string): void => {
  const wasAutoFilling = svc.autoFilling;
  svc.autoFilling = false;
  // Clear previous history so user only sees the current step
  if (wasAutoFilling) svc.clearMessages();
  const p = svc.nlpParsed(), nlpKey = NLP_MAP[field];
  const hadValue = nlpKey && p ? (p as unknown as Record<string, unknown>)[nlpKey] : null;
  console.log(`[AutoFill] PAUSED at field="${field}", hadValue=${hadValue ? `"${hadValue}"` : 'null'}`);

  if (hadValue) {
    const available = svc.options().map(o => (o as IdNameItem).name).filter(Boolean);
    svc.addMessage('assistant', available.length
      ? `You mentioned **"${hadValue}"** but it's not among the available options: **${available.join(', ')}**. Please select the closest match below.`
      : `You mentioned **"${hadValue}"** but it couldn't be matched. Please select from the options below.`);
  } else {
    const fb = (PROMPTS as Record<string, { fallback: string }>)[field.toUpperCase()]?.fallback;
    if (fb) svc.addMessage('assistant', `This field wasn't specified in your description. ${fb}`);
  }

  if (p) {
    const pRec = p as unknown as Record<string, unknown>, s = svc.summary(), pending: string[] = [];
    if (pRec['urgency'] && !s.urgencyName) pending.push(`Urgency: ${pRec['urgency']}`);
    if (pRec['strategicValue'] && !s.strategicValueName) pending.push(`Strategic Value: ${pRec['strategicValue']}`);
    if (pRec['transformationTypeSecondLevel'] && field !== 'transformation_type_l3'
        && !s.transformationTypeSecondLevelName && !s.transformationTypeThirdLevelName)
      pending.push(`L3: ${pRec['transformationTypeSecondLevel']}`);
    if (pending.length) svc.addMessage('status', `📋 Pending from your description: ${pending.join(' | ')} — will auto-fill after this step`);
  }

  const label = (OPTIONS_LABELS as Record<string, string>)[field];
  if (label) svc.addMessage('options', label);
  svc.requestScroll();
};
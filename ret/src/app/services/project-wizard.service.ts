// ───────────────────────────────────────────────────────────────
// ai-projectcreation.service.ts — Business logic & state mgmt
// ───────────────────────────────────────────────────────────────

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

import {
  type WizardPage,
  type WizardField,
  type WizardAction,
  type MessageRole,
  type IdNameItem,
  type ClientItem,
  type PrimaryProjectItem,
  type UserSearchItem,
  type OptionItem,
  type ChatMessage,
  type SummaryState,
  type ProxyResponse,
  type AssistantContext,
  type ParsedProjectInput,
  type WizardStep,
  type KpiItem,
  type KpiFormData,
  type FinancialFormData,
  type PreflightFormData,
  API_ENDPOINT,
  SCROLL_THRESHOLD_PX,
  LOADING_INTERVAL_MS,
  FALLBACK_VALUE,
  WIZARD_STEPS,
  PATTERNS,
  REVERT_MAP,
  INPUT_PLACEHOLDERS,
  OPTIONS_LABELS,
  loadingMessages,
  PROMPTS,
  MSG,
  TOAST,
  noMatchMsg,
  resolvedTpMsg,
  resolvedLobMsg,
  resolvedPartialMsg,
  autoResolvePrompt,
  linkedProjectPrompt,
  createInitialSummary,
  createInitialKpiForm,
  createInitialFinancialForm,
  createInitialPreflightForm,
} from '../constants/project-wizard.constants';
import { RESET_PARTIALS, RESET_STATUS_MSG } from './project-wizard-reset';
import { WizardHandlers } from './project-wizard-handlers';
import { environment } from '../../environments/environment';

const CHAT_FIELDS: ReadonlySet<string> = new Set([
  'confirm', 'tab2_confirm', 'tab4_confirm', 'secondary_ask', 'primary_project',
  'project_name', 'project_lead', 'project_sponsor', 'regional_approver',
  'dmaic_status_date', 'transformation_status_date', 'project_status_date',
  'deployment_duration', 'payback_period', 'tab3_financials', 'kpi_values', 'kpi_list',
]);

const DATE_SUMMARY_KEY: Record<string, string> = {
  dmaic_status_date: 'dmaicProjectStatusDate',
  transformation_status_date: 'transformationStatusDate',
  project_status_date: 'projectStatusDate',
};

@Injectable()
export class ProjectWizardService {
  private readonly http = inject(HttpClient);
  readonly toastr = inject(ToastrService);
  private loadingInterval: ReturnType<typeof setInterval> | null = null;

  /** Delegated handlers for selection, data loading, NLP and matching */
  readonly h = new WizardHandlers(this);

  // ── State Signals ──────────────────────────────────────────

  readonly currentPage    = signal<WizardPage>('wizard');
  readonly loading        = signal(false);
  readonly typing         = signal(false);
  readonly activeField    = signal<WizardField | null>(null);
  readonly options        = signal<OptionItem[]>([]);
  readonly messages       = signal<ChatMessage[]>([]);
  readonly draftSaved     = signal(false);
  readonly opportunityRes = signal('');
  readonly loadingText    = signal('');
  readonly loadingMode    = signal<'full' | 'inline'>('full');
  readonly loadingContext  = signal('');
  readonly searchTerm     = signal('');
  readonly summary        = signal<SummaryState>(createInitialSummary());
  readonly showScrollBtn  = signal(false);
  readonly steps          = signal<WizardStep[]>(
    WIZARD_STEPS.map(s => ({ ...s })),
  );
  readonly scrollTrigger  = signal(0);
  readonly errorRetry     = signal<(() => Promise<void>) | null>(null);
  readonly opportunityId  = signal<string | null>(null);
  readonly viewOpportunityId = signal<string | null>(null);
  readonly sidebarCollapsed = signal(false);

  // ── KPI State ──────────────────────────────────────────────
  readonly kpiList = signal<KpiItem[]>([]);
  readonly kpiForm = signal<KpiFormData>(createInitialKpiForm());
  readonly financialForm = signal<FinancialFormData>(createInitialFinancialForm());
  readonly projectSubmitted = signal(false);
  readonly aiConsent = signal(false);

  // ── NLP One-Click State ────────────────────────────────────
  readonly nlpParsed = signal<ParsedProjectInput | null>(null);
  readonly preflightForm = signal<PreflightFormData>(createInitialPreflightForm());
  /** Stores resolved Tab 1 names for preview card before engine starts */
  readonly nlpPreviewTab1 = signal<{ cluster: string; country: string; company: string; client: string; lob: string } | null>(null);
  private _autoFilling = false;
  readonly autoFillActive = signal(false);
  get autoFilling(): boolean { return this._autoFilling; }
  set autoFilling(value: boolean) { this._autoFilling = value; this.autoFillActive.set(value); }

  // ── Execution Timer ────────────────────────────────────────
  private executionStart: number | null = null;
  readonly executionDuration = signal<string | null>(null);

  startExecutionTimer(): void {
    this.executionStart = performance.now();
    this.executionDuration.set(null);
  }

  stopExecutionTimer(): void {
    if (!this.executionStart) return;
    const elapsed = performance.now() - this.executionStart;
    const secs = (elapsed / 1000).toFixed(1);
    this.executionDuration.set(`${secs}s`);
    this.executionStart = null;
  }

  /** Clear only chat messages (engine area). Sidebar/summary untouched. */
  clearMessages(): void {
    this.messages.set([]);
  }

  // ── Computed ───────────────────────────────────────────────

  readonly lastOptionsIdx = computed(() => {
    const msgs = this.messages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'options') return i;
    }
    return -1;
  });

  readonly inputPlaceholder = computed(
    () => INPUT_PLACEHOLDERS[this.activeField() ?? 'default'] ?? INPUT_PLACEHOLDERS['default'],
  );

  readonly chatEnabled = computed(() => {
    if (this.loading() || this.draftSaved() || this.projectSubmitted() || !this.aiConsent()) return false;
    const field = this.activeField();
    return !field || CHAT_FIELDS.has(field);
  });

  readonly canResetCurrent = computed(() => {
    if (this.loading() || this.draftSaved() || this.projectSubmitted()) return false;
    const field = this.activeField();
    return !!field && field !== 'secondary_ask';
  });

  readonly canResetAll = computed(() => {
    if (this.loading() || this.draftSaved() || this.projectSubmitted()) return false;
    const field = this.activeField();
    if (!field || field === 'secondary_ask') return false;
    const s = this.summary();
    return !!(s.clusterName || s.isSecondary);
  });

  readonly trackProgress = computed(() => {
    const s = this.steps();
    const done = s.filter(st => st.state === 'completed').length;
    return `${(done / s.length) * 100}%`;
  });

  readonly dropdownOptions = computed<OptionItem[]>(() => {
    const field = this.activeField();
    const opts  = this.options();
    if (field === 'primary_project') {
      return (opts as PrimaryProjectItem[]).map(p => ({
        ...p,
        displayLabel: p.viewopportunityId,
      }));
    }
    if (field === 'project_lead' || field === 'project_sponsor' || field === 'regional_approver') {
      return (opts as UserSearchItem[]).map(u => ({
        ...u,
        displayLabel: `${u.displayName} (${u.userPrincipalName})`,
      }));
    }
    return opts;
  });

  // ── Lifecycle ──────────────────────────────────────────────

  async startWizard(): Promise<void> {
    this.draftSaved.set(false);
    this.opportunityRes.set('');
    this.opportunityId.set(null);
    this.viewOpportunityId.set(null);
    this.aiConsent.set(false);
    this.resetSummary();
    this.messages.set([]);
    this.steps.set(WIZARD_STEPS.map(s => ({ ...s })));
    this.activeField.set(null);
    this.options.set([]);
    this.requestScroll();
    this.addMessage('landing', '');
  }

  goBack(): void {
    this.errorRetry.set(null);
    this.messages.set([]);
    this.options.set([]);
    this.activeField.set(null);
    this.loading.set(false);
    this.draftSaved.set(false);
    this.opportunityRes.set('');
    this.viewOpportunityId.set(null);
    this.resetSummary();
    this.startWizard();
  }

  canReset(field: string): boolean {
    if (this.loading() || this.draftSaved()) return false;
    return !(this.summary().isSecondary && field !== 'primary_project');
  }

  async resetCurrent(): Promise<void> {
    this.errorRetry.set(null);
    const field = this.activeField();
    if (!field || field === 'secondary_ask') return;
    if (field === 'confirm') {
      await this.resetSelection(this.summary().isSecondary ? 'primary_project' : 'operational_lob');
      return;
    }
    if (REVERT_MAP[field]) {
      await this.resetSelection(REVERT_MAP[field]);
    } else {
      await this.resetSelection(field);
    }
  }

  async resetAll(): Promise<void> {
    if (this.loading()) return;
    // Block mid-flow reset (Tab 1 saved but not submitted) — but allow from success screen
    if (this.draftSaved() && !this.projectSubmitted()) return;
    this.projectSubmitted.set(false);
    this.draftSaved.set(false);
    this.messages.set([]);
    this.kpiList.set([]);
    this.kpiForm.set(createInitialKpiForm());
    this.financialForm.set(createInitialFinancialForm());
    this.executionDuration.set(null);
    this.errorRetry.set(null);
    this.resetSummary();
    this.activeField.set(null);
    this.options.set([]);
    this.opportunityId.set(null);
    this.viewOpportunityId.set(null);
    this.aiConsent.set(false);
    this.steps.set(WIZARD_STEPS.map(s => ({ ...s })));
    this.requestScroll();
    this.toastr.info('Starting over from scratch.', 'Reset');
    this.addMessage('landing', '');
  }

  // ── Selection Reset ────────────────────────────────────────

  async resetSelection(field: string): Promise<void> {
    if (this.loading() || this.draftSaved()) return;

    this.patchSummary(RESET_PARTIALS[field] ?? {});
    this.addMessage('status', RESET_STATUS_MSG[field] ?? '');
    this.requestScroll();
    this.toastr.info(TOAST.REVERTED.body, TOAST.REVERTED.title);

    const loaders: Record<string, () => Promise<void>> = {
      cluster:         () => this.h.loadClusters(),
      country:         () => this.h.loadCountries(),
      company:         () => this.h.loadCompanies(),
      client:          () => this.h.loadClients(),
      lob:             () => this.h.loadLobs(),
      operational_lob: () => this.h.askOperationalLob(),
      primary_project: () => this.h.loadPrimaryProjects(),
      // Tab 2
      transformation_type:   () => this.h.loadTransformationTypes(),
      transformation_type_sub: () => this.h.loadTransformationTypeSub(),
      transformation_type_l3: () => {
        const s = this.summary();
        if (s.isTechProductsPath && s.transformationTypeFirstLevelName?.toLowerCase().includes('microservice')) {
          return this.h.loadTransformationTypeL3_Microservices(s.transformationTypeFirstLevelId!);
        }
        if (s.isTechProductsPath) {
          return this.h.loadTransformationTypeL3_ProductDev(s.transformationTypeFirstLevelId!);
        }
        return this.h.loadTransformationTypeL3_ProblemSolving(s.transformationTypeFirstLevelId!);
      },
      transformation_type_l4: () => this.h.loadTransformationTypeL4(this.summary().transformationTypeSecondLevelId!),
      objective:             () => this.h.loadObjectives(),
      nature:                () => this.h.loadNatures(),
      group_classification:  () => this.h.loadGroupClassifications(),
      external_product:      () => this.h.loadExternalProducts(),
      project_name:          () => this.h.askProjectName(),
      project_lead:          () => this.h.askProjectLead(),
      project_sponsor:       () => this.h.askProjectSponsor(),
      regional_approver:     () => this.h.askRegionalApprover(),
      dmaic_status:          () => this.h.loadDmaicStatuses(),
      dmaic_status_date:     () => this.h.askDmaicStatusDate(),
      transformation_status: () => this.h.loadTransformationStatuses(),
      transformation_status_date: () => this.h.askTransformationStatusDate(),
      project_status:        () => this.h.loadProjectStatuses(),
      project_status_date:   () => this.h.askProjectStatusDate(),
      urgency:               () => this.h.loadUrgencies(),
      strategic_value:       () => this.h.loadStrategicValues(),
      // Tab 4
      metric_group:          () => this.h.loadMetricGroups(),
      metric:                () => this.h.loadMetrics(),
    };
    await loaders[field]?.();
  }

  // ── User Input Handler ─────────────────────────────────────

  async handleUserMessage(text: string): Promise<void> {
    const t = text.trim();
    if (!t || this.loading()) return;
    this.errorRetry.set(null);

    if (PATTERNS.REVERT.test(t)) {
      this.addMessage('user', t);
      this.requestScroll();
      await this.h.handleRevert();
      return;
    }

    if ((this.activeField() === 'confirm' || this.activeField() === 'tab2_confirm') && PATTERNS.SAVE.test(t)) {
      this.addMessage('user', t);
      this.requestScroll();
      if (this.activeField() === 'tab2_confirm') {
        await this.h.saveTab2Draft();
      } else {
        await this.h.saveDraft();
      }
      return;
    }

    // Tab 4 confirm — submit project
    if (this.activeField() === 'tab4_confirm' && PATTERNS.SUBMIT.test(t)) {
      this.addMessage('user', t);
      this.requestScroll();
      await this.h.saveTab4Final();
      return;
    }

    // Tab 4 KPI list — add more or submit
    if (this.activeField() === 'kpi_list') {
      this.addMessage('user', t);
      this.requestScroll();
      if (PATTERNS.SUBMIT.test(t)) {
        await this.h.showTab4Confirm();
        return;
      }
      if (PATTERNS.ADD_MORE.test(t)) {
        await this.h.loadMetricGroups();
        return;
      }
      this.addMessage('assistant', 'Type **"add"** to add another KPI, or **"submit"** to finalize the project.');
      this.requestScroll();
      return;
    }

    if (this.activeField() === 'secondary_ask') {
      this.addMessage('user', t);
      this.requestScroll();
      if (PATTERNS.NEW_PRIMARY.test(t)) { await this.chooseNewPrimary(true); return; }
      if (PATTERNS.SECONDARY.test(t))   { await this.chooseSecondary(true); return; }
      this.addMessage('assistant', MSG.CHOOSE_TYPE);
      this.addMessage('options', OPTIONS_LABELS['secondary_ask']);
      this.requestScroll();
      return;
    }

    if (this.activeField() === 'client' && PATTERNS.TP_INTERNAL.test(t)) {
      await this.chooseTpInternal();
      return;
    }

    if (this.activeField() === 'operational_lob') {
      this.addMessage('user', t);
      this.requestScroll();
      if (PATTERNS.SKIP.test(t)) {
        await this.h.skipOperationalLob();
        return;
      }
      // First check if user typed something matching current options
      if (this.options().length > 0) {
        const match = this.h.matchOption(t);
        if (match) {
          this.searchTerm.set('');
          await this.h.applyMatch(match);
          return;
        }
      }
      // Otherwise treat input as search query
      await this.h.searchOperationalLob(t);
      return;
    }

    // Tab 2: project name (free text)
    if (this.activeField() === 'project_name') {
      this.addMessage('user', t);
      this.requestScroll();
      this.patchSummary({ projectName: t });
      await this.h.askProjectLead();
      return;
    }

    // Tab 2: user search fields (lead, sponsor, approver)
    if (this.activeField() === 'project_lead' || this.activeField() === 'project_sponsor' || this.activeField() === 'regional_approver') {
      this.addMessage('user', t);
      this.requestScroll();
      if (this.options().length > 0) {
        const match = this.h.matchUserOption(t);
        if (match) { await this.h.applyMatch(match); return; }
      }
      if (this.activeField() === 'regional_approver') await this.h.searchRegionalApprover(t);
      else await this.h.searchUsers(this.activeField() as 'project_lead' | 'project_sponsor', t);
      return;
    }

    // Tab 2: Date inputs (dmaic, transformation status, project status)
    if (this.activeField() && DATE_SUMMARY_KEY[this.activeField()!]) {
      this.addMessage('user', t);
      this.requestScroll();
      const dateVal = this.parseDate(t);
      if (!dateVal) { this.addMessage('assistant', 'Please enter a valid date in YYYY-MM-DD format.'); this.requestScroll(); return; }
      this.patchSummary({ [DATE_SUMMARY_KEY[this.activeField()!]]: dateVal });
      if (this.nlpParsed() && !this.autoFilling) this.autoFilling = true;
      const s = this.summary(), f = this.activeField();
      if (f === 'transformation_status_date') {
        if (s.isDmaicPath && s.isProjectStatusEnable) { await this.h.loadDmaicStatuses(); return; }
        if (s.isDataAnalyticsPath && s.isProjectStatusEnableForWithoutPSI) { await this.h.loadProjectStatuses(); return; }
      } else if (f === 'dmaic_status_date' && s.isProjectStatusEnable) { await this.h.loadProjectStatuses(); return; }
      await this.h.loadUrgencies();
      return;
    }

    // Tab 2: Deployment Duration / Payback Period (optional free text)
    if (this.activeField() === 'deployment_duration' || this.activeField() === 'payback_period') {
      this.addMessage('user', t);
      this.requestScroll();
      const val = t.trim();
      if (val && val.toLowerCase() !== 'skip') {
        const key = this.activeField() === 'deployment_duration' ? 'deploymentDuration' : 'paybackPeriod';
        this.patchSummary({ [key]: val.replace(/[^0-9.]/g, '') || val });
      }
      if (this.nlpParsed() && !this.autoFilling) this.autoFilling = true;
      if (this.activeField() === 'deployment_duration') await this.h.askPaybackPeriod(); else await this.h.showTab2Confirm();
      return;
    }

    // Tab 3: Financials — user types "skip" to proceed with empty values
    if (this.activeField() === 'tab3_financials') {
      this.addMessage('user', t);
      this.requestScroll();
      if (PATTERNS.SKIP.test(t)) {
        await this.h.skipTab3Financials();
        return;
      }
      this.addMessage('assistant', 'Fill in the financial form below and click **Save Financials**, or type **"skip"** to proceed with empty values.');
      this.requestScroll();
      return;
    }

    if (this.activeField() && this.options().length > 0) {
      const match = this.h.matchOption(t);
      if (match) {
        this.addMessage('user', t);
        this.requestScroll();
        this.searchTerm.set('');
        await this.h.applyMatch(match);
        return;
      }
    }

    this.addMessage('user', t);
    this.requestScroll();

    if (!this.activeField() || this.activeField() === 'cluster') {
      // Detect secondary intent in free-text
      if (PATTERNS.SECONDARY.test(t) && !this.summary().clusterName) {
        await this.chooseSecondary(true);
        return;
      }
      await this.h.parseAndBind(t);
      return;
    }

    this.addMessage('assistant', noMatchMsg(t));
    this.addMessage('options', this.getOptionsLabel());
    this.requestScroll();
  }

  // ── Dropdown Selection Handler ─────────────────────────────

  async handleDropdownSelection(item: OptionItem): Promise<void> {
    this.errorRetry.set(null);
    if (!this.executionStart) this.startExecutionTimer();
    this.addMessage('user', this.getDisplayName(item));
    this.requestScroll();
    await this.h.applyMatch(item);
  }

  // ── Project Type Selection ─────────────────────────────────

  async chooseNewPrimary(skipMsg = false): Promise<void> {
    this.patchSummary({
      isSecondary: false,
      primaryProjectId: null,
      primaryProjectName: null,
    });
    if (!skipMsg) this.addMessage('user', MSG.NEW_PROJECT);
    await this.h.loadClusters();
  }

  async chooseSecondary(skipMsg = false): Promise<void> {
    this.patchSummary({ isSecondary: true });
    if (!skipMsg) this.addMessage('user', MSG.SECONDARY_PROJECT);
    this.searchTerm.set('');
    await this.h.loadPrimaryProjects();
  }

  async chooseTpInternal(): Promise<void> {
    this.patchSummary({
      clientId: null,
      clientName: MSG.TP_INTERNAL_LABEL,
      isTpInternal: true,
      lobId: null,
      lobName: null,
      operationalLob: null,
      industryId: null,
      industryName: null,
      languageName: null,
    });
    this.addMessage('user', MSG.TP_INTERNAL_LABEL);
    this.activeField.set('confirm');
    this.options.set([]);
    this.setLoading(true, 'configuring', 'inline');
    await this.pushAssistantMessage(
      'client',
      PROMPTS.TP_INTERNAL.prompt,
      PROMPTS.TP_INTERNAL.fallback,
    );
    this.setLoading(false);
    this.requestScroll();
  }

  // ── Build Full Payload ───────────────────────────────────────
  // The external CreateOpportunity API requires ALL fields in every call,
  // even when saving only Tab 1. Missing fields cause 400 validation errors.

  buildFullPayload(formTab: number, isSubmitted: boolean = false): Record<string, unknown> {
    const s = this.summary();
    const nlp = this.nlpParsed();
    return {
      opportunityId:                 this.opportunityId() || null,
      clientId:                      s.clientId,
      companyId:                     s.companyId,
      clusterId:                     s.clusterId,
      clusterCountryId:              s.clusterCountryId,
      lob:                           s.lobId ?? '',
      operationallob:                s.operationalLob ?? '',
      industryId:                    s.industryId ?? '',
      languageName:                  s.languageName ?? '',
      email:                         '',
      formTab,
      isTpInternal:                  s.isTpInternal,
      isPrimaryProject:              !s.isSecondary,
      isSecondaryToggleCheckd:       s.isSecondary,
      primaryProjectID:              s.primaryProjectId ?? null,
      isSubmitted,
      salesforceId:                  '',

      // Tab 2 fields
      transformationTypeId:            String(s.transformationTypeId ?? ''),
      transformationTypeFirstLevelId:  s.transformationTypeFirstLevelId || null,
      transformationTypeSecondLevelId: s.transformationTypeSecondLevelId || null,
      transformationTypeThirdLevelId:  s.transformationTypeThirdLevelId ?? null,
      objectiveId:                   s.objectiveId ?? null,
      natureId:                      s.natureId ?? null,
      groupClassificationIds:        s.groupClassificationId != null ? String(s.groupClassificationId) : null,
      externalProductId:             s.externalProductId ?? '',
      externalProductValue:          s.externalProductValue ?? '',
      projectName:                   s.projectName ?? '',
      projectDescription:            s.projectDescription ?? '',
      projectShortDescription:       '',
      comments:                      this.nlpParsed()?.comments ?? '',
      projectLeadName:               s.projectLeadName ?? '',
      projectLeadUPN:                s.projectLeadUPN ?? '',
      projectSponserName:            s.projectSponsorName ?? '',
      projectSponsorUPN:             s.projectSponsorUPN ?? '',
      isRegionalApprovalRequired:    s.isRegionalApprovalRequired ?? false,
      regionalApproverId:            s.regionalApproverId ? Number(s.regionalApproverId) : null,
      regionalApproverName:          s.regionalApproverName ?? '',
      regionalApproverUPN:           s.regionalApproverUPN ?? '',
      dmaiC_projectStatusId:         s.dmaicProjectStatusId != null ? String(s.dmaicProjectStatusId) : null,
      dmaiC_projectstatusDate:       s.dmaicProjectStatusDate ?? '',
      transformationStatusId:        s.transformationStatusId ?? null,
      transformationStatusDate:      s.transformationStatusDate ?? '',
      projectStatusId:               s.projectStatusId ?? null,
      projectStatusDate:             s.projectStatusDate ?? '',
      statusDate:                    '',
      projectStatusValue:            '',
      urgency:                       s.urgencyId ?? null,
      statgicValue:                  s.strategicValueId ?? null,

      // Financial fields — only populated when saving Tab 3+
      committedInternalBenefitDate:            '',
      expectedRevenue:                         formTab >= 3 ? (s.expectedRevenue ?? null) : null,
      expectedInternalBenefit:                 formTab >= 3 ? (s.expectedInternalBenefit ?? null) : null,
      expectedClientBenefit:                   formTab >= 3 ? (s.expectedClientBenefit ?? null) : null,
      estimatedProjectCost:                    formTab >= 3 ? (s.estimatedProjectCost ?? null) : null,
      actualProjectCost:                       formTab >= 3 ? (s.actualProjectCost ?? null) : null,
      currency:                                formTab >= 3 ? (s.currency ?? null) : null,
      internalBenefit:                         formTab >= 3 ? (s.internalBenefit ?? null) : null,
      clientBenefit:                           formTab >= 3 ? (s.clientBenefit ?? null) : null,
      recurrentRevenue:                        formTab >= 3 ? (s.recurrentRevenue ?? null) : null,
      commitedInternalBenefit:                 null,
      realisedBenefit:                         formTab >= 3 ? (s.realisedBenefit ?? null) : null,
      realisedRevenue:                         formTab >= 3 ? (s.realisedRevenue ?? null) : null,
      commitedInternalBenefitRepetitiveGroup:  formTab >= 3 ? (s.recurrentRevenue ?? null) : null,
      additionalInvestment:                    formTab >= 3 ? (s.additionalInvestment ?? null) : null,

      // Other defaulted fields
      transformationMagnitudeId:               null,
      businessOutcomeId:                       null,
      businessOutcomeType:                     null,
      ingestionHours:                          null,
      nofQA:                                   null,
      nofCustomerExpertInScope:                null,
      expectedInternalBenefitQualityFrom:      null,
      expectedInternalBenefitQualityTo:        null,
      expectedInternalBenefitProductivityFrom: null,
      expectedInternalBenefitProductivityTo:   null,
      expectedClientlBenefitQualityFrom:       null,
      expectedClientBenefitQualityTo:          null,
      expectedClientBenefitProductivityFrom:   null,
      expectedClientBenefitProductivityTo:     null,
      applicableRFT:                           null,
      revenueVariationPerMonth:                null,
      marginVariationPerMonth:                 null,
      improvement:                             null,
      additionalAbsoluteGmPerYear:             null,
      additionalGM:                            null,
      isadditionalinvestment:                  false,
      isProjectClosure:                        false,
      previousPageButton:                      false,
      isOnHold:                                false,
    };
  }

  // ── Scroll State ───────────────────────────────────────────

  updateScrollState(top: number, height: number, client: number): void {
    this.showScrollBtn.set(height - top - client > SCROLL_THRESHOLD_PX);
  }

  requestScroll(): void {
    this.scrollTrigger.update(v => v + 1);
  }

  // ── Private — Helpers ──────────────────────────────────────

  showOpts(field: string, items: OptionItem[], label: string): void {
    this.activeField.set(field as WizardField);
    this.options.set(items);
    this.searchTerm.set('');
    this.addMessage('options', label);
    this.requestScroll();
  }

  getOptionsLabel(): string {
    return OPTIONS_LABELS[this.activeField() ?? 'default'] ?? OPTIONS_LABELS['default'];
  }

  getDisplayName(item: OptionItem): string {
    if (this.isPrimaryProject(item)) return (item as PrimaryProjectItem).viewopportunityId;
    if ('displayName' in item) return (item as UserSearchItem).displayName;
    return 'name' in item ? String((item as IdNameItem).name ?? '') : '';
  }

  isPrimaryProject(item: OptionItem): item is PrimaryProjectItem {
    return 'viewopportunityId' in item;
  }

  addMessage(role: MessageRole, text: string): void {
    if (this.autoFilling && role === 'options') return;
    this.messages.update(msgs => [...msgs, { role, text }]);
  }

  patchSummary(partial: Partial<SummaryState>): void {
    this.summary.update(s => ({ ...s, ...partial }));
  }

  resetSummary(): void {
    this.summary.set(createInitialSummary());
    this.nlpParsed.set(null);
    this.nlpPreviewTab1.set(null);
    this.autoFilling = false;
  }

  setLoading(on: boolean, context?: string, mode: 'full' | 'inline' = 'full'): void {
    this.loading.set(on);
    this.loadingMode.set(on ? mode : 'full');
    this.loadingContext.set(on ? (context ?? '') : '');
    if (on) {
      const msgs = loadingMessages(context ?? 'data');
      let idx = 0;
      this.loadingText.set(msgs[0]);
      if (this.loadingInterval) clearInterval(this.loadingInterval);
      this.loadingInterval = setInterval(() => {
        idx = (idx + 1) % msgs.length;
        this.loadingText.set(msgs[idx]);
      }, LOADING_INTERVAL_MS);
    } else if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
  }

  private getAssistantContext(): AssistantContext {
    const s = this.summary();
    return {
      clusterName:        s.clusterName,
      clusterCountryName: s.clusterCountryName,
      companyName:        s.companyName,
      clientName:         s.clientName,
      lobName:            s.lobName,
      industryName:       s.industryName,
      languageName:       s.languageName,
      isTpInternal:       s.isTpInternal,
    };
  }

  async pushAssistantMessage(
    stage: string,
    prompt: string,
    fallback: string,
  ): Promise<void> {
    if (this.autoFilling) return;
    this.typing.set(true);
    this.requestScroll();
    try {
      const response = await this.request<{ text: string }>('assistant_message', {
        stage,
        userMessage: prompt,
        fallbackMessage: fallback,
        assistantContext: this.getAssistantContext(),
      });
      this.typing.set(false);
      this.addMessage('assistant', response.data.text || fallback);
    } catch {
      this.typing.set(false);
      this.addMessage('assistant', fallback);
    }
    this.requestScroll();
  }

  async request<T>(
    action: WizardAction,
    payload: Record<string, unknown> = {},
  ): Promise<ProxyResponse<T>> {
    console.log(`[API] → ${action}`, payload);
    const response = await firstValueFrom(
      this.http.post<ProxyResponse<T>>(API_ENDPOINT, {
        action,
        bearerToken: environment.aiAuthToken,
        userId: environment.aiUserId,
        userApiBaseUrl: environment.aiUserApiBase,
        opportunityApiBaseUrl: environment.aiOpportunityApiBase,
        apiVersion: environment.aiApiVersion,
        llmBaseUrl: environment.aiLlmUrl,
        llmChatId: environment.aiLlmChatId,
        llmUserUpn: environment.aiLlmUserUpn,
        llmChatArea: environment.aiLlmChatArea,
        llmFlowId: environment.aiLlmFlowId,
        llmProjectId: environment.aiLlmProjectId,
        llmVersionId: environment.aiLlmVersionId,
        ...payload,
      }),
    );
    console.log(`[API] ← ${action}`, { success: response.success, dataLength: Array.isArray(response.data) ? response.data.length : typeof response.data, message: response.message });
    if (!response.success) throw new Error(response.message || 'Request failed.');
    return response;
  }

  async loadOptionsData<T extends IdNameItem | ClientItem>(
    action: WizardAction,
    payload: Record<string, unknown> = {},
    retryFn?: () => Promise<void>,
  ): Promise<void> {
    this.options.set([]);
    try {
      const response = await this.request<T[]>(action, payload);
      const data = response.data ?? [];
      console.log(`[LoadOptions] action="${action}", payload=`, payload, `→ ${data.length} items`, data.length <= 10 ? data : data.slice(0, 5).concat({ id: '...', name: `(+${data.length - 5} more)` } as unknown as T));
      if (!data.length) console.warn(`[LoadOptions] ⚠ ZERO results for action="${action}"`, payload);
      this.options.set(data);
      this.errorRetry.set(null);
    } catch (error) {
      console.error(`[LoadOptions] ERROR action="${action}"`, payload, error);
      this.handleError(error, retryFn);
    }
  }

  getErrorText(error: unknown): string {
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      const inner = e['error'] as Record<string, unknown> | undefined;
      if (inner?.['message']) return inner['message'] as string;
      if (e['message']) return e['message'] as string;
    }
    return TOAST.ERROR.body;
  }

  private parseDate(text: string): string | null {
    const match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  }

  handleError(error: unknown, retryFn?: () => Promise<void>): void {
    this.addMessage('assistant', this.getErrorText(error));
    this.toastr.error(TOAST.ERROR.body, TOAST.ERROR.title);
    this.errorRetry.set(retryFn ?? null);
  }

  async retry(): Promise<void> {
    const fn = this.errorRetry();
    if (!fn) return;
    this.errorRetry.set(null);
    await fn();
  }
}

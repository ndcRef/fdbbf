// ───────────────────────────────────────────────────────────────
// project-wizard-handlers.ts — Selection handlers, data loaders,
// save logic, and matching (NLP delegated to project-wizard-nlp.ts)
// ───────────────────────────────────────────────────────────────

import type { ProjectWizardService } from './project-wizard.service';
import {
  type WizardField,
  type WizardAction,
  type IdNameItem,
  type ClientItem,
  type PrimaryProjectItem,
  type UserSearchItem,
  type OptionItem,
  type KpiItem,
  type FinancialFormData,
  FALLBACK_VALUE,
  REVERT_MAP,
  OPTIONS_LABELS,
  PROMPTS,
  MSG,
  TOAST,
  autoResolvePrompt,
  linkedProjectPrompt,
  createInitialKpiForm,
  createInitialFinancialForm,
} from '../constants/project-wizard.constants';
import {
  tryAutoSelect,
  pauseAutoFill,
  parseAndBind as nlpParseAndBind,
  confirmNlpPreview as nlpConfirmNlpPreview,
  submitPreflight as nlpSubmitPreflight,
} from './project-wizard-nlp';

export class WizardHandlers {
  constructor(readonly svc: ProjectWizardService) {}

  /** Resume auto-fill if NLP data is available */
  private resumeAuto(): void {
    if (this.svc.nlpParsed() && !this.svc.autoFilling) this.svc.autoFilling = true;
  }

  /** Shared status selection + auto-date pattern */
  private async selectStatusWithDate(
    idKey: string, nameKey: string, dateKey: string, item: IdNameItem,
    nlpDate: string | null | undefined, label: string,
    askDate: () => Promise<void>, next: () => Promise<void>,
  ): Promise<void> {
    this.svc.patchSummary({ [idKey]: Number(item.id), [nameKey]: item.name });
    this.resumeAuto();
    const dateToUse = nlpDate ?? (this.svc.autoFilling ? new Date().toISOString().split('T')[0] : null);
    if (dateToUse) {
      this.svc.patchSummary({ [dateKey]: dateToUse });
      this.svc.addMessage('status', `✓ ${label}: ${dateToUse}${!nlpDate ? ' (auto-set today)' : ''}`);
      await next(); return;
    }
    await askDate();
  }

  /** Shared user search (lead, sponsor, approver) */
  private async searchUserField(field: string, action: WizardAction, payload: Record<string, unknown>, text: string): Promise<void> {
    this.svc.setLoading(true, field.replace(/_/g, ' '), 'inline');
    try {
      const response = await this.svc.request<UserSearchItem[]>(action, payload);
      const items = (response.data ?? []).map((u: UserSearchItem) => ({ ...u, displayLabel: `${u.displayName} (${u.userPrincipalName})` }));
      this.svc.options.set(items);
      if (items.length) this.svc.addMessage('options', OPTIONS_LABELS[field]);
      else this.svc.addMessage('assistant', `No results found for "${text}". Try a different name.`);
    } catch (error) {
      this.svc.handleError(error, () => this.searchUserField(field, action, payload, text));
    } finally {
      this.svc.setLoading(false); this.svc.requestScroll();
    }
  }

  // ── Shared Loader Helpers ──────────────────────────────────

  private async loadDropdown(
    field: WizardField, loadingText: string, action: WizardAction,
    payload: Record<string, unknown>, retryFn: () => Promise<void>,
  ): Promise<void> {
    console.log(`[AutoFill] loadDropdown: field="${field}", action="${action}", autoFilling=${this.svc.autoFilling}`, payload);
    if (!this.svc.autoFilling) this.svc.clearMessages();
    const p = (PROMPTS as Record<string, { prompt: string; fallback: string }>)[field.toUpperCase()];
    this.svc.activeField.set(field);
    this.svc.setLoading(true, loadingText, 'inline');
    try {
      await Promise.all([
        this.svc.pushAssistantMessage(field, p.prompt, p.fallback),
        this.svc.loadOptionsData<IdNameItem>(action, payload, retryFn),
      ]);
    } catch (err) {
      console.error(`[AutoFill] loadDropdown ERROR for field="${field}", action="${action}":`, err);
      this.svc.setLoading(false);
      this.svc.requestScroll();
      return;
    }
    if (this.svc.options().length) this.svc.addMessage('options', OPTIONS_LABELS[field]);
    this.svc.setLoading(false);
    this.svc.requestScroll();
    // Don't auto-select if the API failed — let user hit Retry
    if (this.svc.errorRetry()) return;
    // If the API returned 0 options, log it — callers may have their own skip logic
    if (!this.svc.options().length) {
      console.warn(`[LoadDropdown] ⚠ ZERO options for field="${field}", action="${action}"`, payload);
      return;
    }
    const matched = await tryAutoSelect(this.svc, this);
    if (!matched && this.svc.autoFilling) {
      // Engine couldn't auto-fill this dropdown — pause and show dropdown
      pauseAutoFill(this.svc, field);
    }
  }

  private async askField(field: WizardField, loadingText: string): Promise<void> {
    const wasAuto = this.svc.autoFilling;
    if (!wasAuto) this.svc.clearMessages();
    const p = (PROMPTS as Record<string, { prompt: string; fallback: string }>)[field.toUpperCase()];
    this.svc.activeField.set(field);
    this.svc.options.set([]);
    this.svc.setLoading(true, loadingText, 'inline');
    await this.svc.pushAssistantMessage(field, p.prompt, p.fallback);
    this.svc.setLoading(false);
    this.svc.requestScroll();
    const matched = await tryAutoSelect(this.svc, this);
    if (!matched && wasAuto && this.svc.autoFilling) {
      // Engine couldn't auto-fill this text field — stop and show the prompt
      this.svc.autoFilling = false;
      this.svc.clearMessages();
      this.svc.addMessage('assistant', p.fallback);
      this.svc.requestScroll();
    }
  }

  // ── Tab 1: Data Loaders ────────────────────────────────────

  loadClusters = (): Promise<void> => this.loadDropdown('cluster', 'clusters', 'get_clusters', {}, () => this.loadClusters());

  loadCountries = (): Promise<void> => this.loadDropdown('country', 'countries', 'get_countries', { clusterId: this.svc.summary().clusterId }, () => this.loadCountries());

  loadCompanies = (): Promise<void> => this.loadDropdown('company', 'companies', 'get_companies', { clusterCountryId: this.svc.summary().clusterCountryId }, () => this.loadCompanies());

  loadClients = (): Promise<void> => this.loadDropdown('client', 'clients', 'get_clients', { companyId: this.svc.summary().companyId }, () => this.loadClients());

  loadLobs = (): Promise<void> => { const s = this.svc.summary(); return this.loadDropdown('lob', 'line of business', 'get_lobs', { clientId: s.clientId, companyId: s.companyId }, () => this.loadLobs()); };

  async askSecondaryProject(): Promise<void> {
    this.svc.activeField.set('secondary_ask');
    this.svc.options.set([]);
    this.svc.addMessage('options', OPTIONS_LABELS['secondary_ask']);
    this.svc.requestScroll();
  }

  async loadPrimaryProjects(): Promise<void> {
    this.svc.activeField.set('primary_project');
    this.svc.setLoading(true, 'primary projects', 'inline');
    this.svc.options.set([]);

    try {
      const [, response] = await Promise.all([
        this.svc.pushAssistantMessage(
          'primary_project',
          PROMPTS.PRIMARY_PROJECT.prompt,
          PROMPTS.PRIMARY_PROJECT.fallback,
        ),
        this.svc.request<PrimaryProjectItem[]>('get_primary_projects', {}),
      ]);
      const raw = response.data;
      this.svc.options.set(
        (Array.isArray((raw as unknown[])?.[0]) ? (raw as unknown[])[0] as PrimaryProjectItem[] : raw) ?? [],
      );
    } catch (error) {
      this.svc.handleError(error, () => this.loadPrimaryProjects());
    } finally {
      this.svc.setLoading(false);
    }

    if (this.svc.options().length) this.svc.addMessage('options', OPTIONS_LABELS['primary_project']);
    this.svc.requestScroll();
  }

  async askOperationalLob(): Promise<void> {
    if (!this.svc.autoFilling) this.svc.clearMessages();
    this.svc.activeField.set('operational_lob');
    this.svc.options.set([]);
    this.svc.setLoading(true, 'operational LOB', 'inline');
    await this.svc.pushAssistantMessage(
      'operational_lob',
      PROMPTS.OPERATIONAL_LOB.prompt,
      PROMPTS.OPERATIONAL_LOB.fallback,
    );
    this.svc.setLoading(false);
    this.svc.requestScroll();
    await tryAutoSelect(this.svc, this);
  }

  async searchOperationalLob(text: string): Promise<void> {
    this.svc.setLoading(true, 'operational LOB', 'inline');
    try {
      const response = await this.svc.request<IdNameItem[]>('search_operational_lob', {
        searchText: text,
      });
      this.svc.options.set(response.data ?? []);
      if (this.svc.options().length) {
        this.svc.addMessage('options', OPTIONS_LABELS['operational_lob']);
      } else {
        this.svc.addMessage('assistant', `No operational LOB found for "${text}". You can use it as a custom value, try another keyword, or skip.`);
      }
    } catch (error) {
      this.svc.handleError(error, () => this.searchOperationalLob(text));
    } finally {
      this.svc.setLoading(false);
      this.svc.requestScroll();
    }
  }

  async selectOperationalLob(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({ operationalLob: item.name });
    await this.autoResolve();
  }

  async skipOperationalLob(): Promise<void> {
    this.svc.patchSummary({ operationalLob: null });
    this.svc.addMessage('user', 'Skip');
    await this.autoResolve();
  }

  // ── Tab 1: Selection Handlers ──────────────────────────────

  async selectCluster(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({
      clusterId: item.id, clusterName: item.name,
      clusterCountryId: null, clusterCountryName: null,
      companyId: null, companyName: null,
      clientId: null, clientName: null,
      lobId: null, lobName: null, operationalLob: null,
      industryId: null, industryName: null, languageName: null,
    });
    this.resumeAuto();
    await this.loadCountries();
  }

  async selectCountry(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({
      clusterCountryId: item.id, clusterCountryName: item.name,
      companyId: null, companyName: null,
      clientId: null, clientName: null,
      lobId: null, lobName: null, operationalLob: null,
      industryId: null, industryName: null, languageName: null,
    });
    this.resumeAuto();
    await this.loadCompanies();
  }

  async selectCompany(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({
      companyId: item.id, companyName: item.name,
      clientId: null, clientName: null,
      lobId: null, lobName: null, operationalLob: null,
      industryId: null, industryName: null, languageName: null,
    });
    this.resumeAuto();
    await this.loadClients();
  }

  async selectClient(item: ClientItem): Promise<void> {
    this.svc.patchSummary({
      clientId: item.id, clientName: item.name,
      isTpInternal: false,
      lobId: null, lobName: null, operationalLob: null,
      industryId: null, industryName: null, languageName: null,
    });
    this.resumeAuto();
    await this.loadLobs();
  }

  async selectLob(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({ lobId: item.id, lobName: item.name });
    this.resumeAuto();
    await this.askOperationalLob();
  }

  async selectPrimaryProject(item: PrimaryProjectItem): Promise<void> {
    const fv = FALLBACK_VALUE;
    this.svc.patchSummary({
      primaryProjectId:   item.opportunityId,
      primaryProjectName: item.viewopportunityId,
      clusterId:          item.clusterId,
      clusterName:        item.clusterName || fv,
      clusterCountryId:   item.clusterCountryId,
      clusterCountryName: item.clusterCountryName || fv,
      companyId:          item.companyId,
      companyName:        item.companyName || fv,
      clientId:           item.clientId,
      clientName:         item.clientName || fv,
      lobId:              item.lineOfBusiness,
      lobName:            item.lineOfBusiness_name || fv,
      operationalLob:     item.operationalLob || null,
      industryId:         item.industryId,
      industryName:       item.industryName || fv,
      languageName:       item.languageName || fv,
      isTpInternal:       (item.clientName ?? '').toLowerCase().includes('tp internal'),
    });
    this.svc.activeField.set('confirm');
    this.svc.options.set([]);
    this.svc.searchTerm.set('');
    this.svc.setLoading(true, 'auto-populating', 'inline');

    const s = this.svc.summary();
    const p = linkedProjectPrompt(
      item.viewopportunityId,
      s.clusterName!,
      s.clusterCountryName!,
      s.companyName!,
      s.clientName!,
      s.lobName!,
    );
    await this.svc.pushAssistantMessage('primary_project', p.prompt, p.fallback);
    this.svc.setLoading(false);
    this.svc.requestScroll();
  }

  // ── Tab 2: Selection Handlers ──────────────────────────────

  async selectTransformationType(item: IdNameItem): Promise<void> {
    const id = Number(item.id);
    const isConsulting = id === 1;
    const isDataAnalytics = id === 2;
    const isTechProducts = id === 3;

    this.svc.patchSummary({
      transformationTypeId: item.id,
      transformationTypeName: item.name,
      transformationTypeFirstLevelId: null,
      transformationTypeFirstLevelName: null,
      transformationTypeSecondLevelId: null,
      transformationTypeSecondLevelName: null,
      transformationTypeThirdLevelId: null,
      transformationTypeThirdLevelName: null,
      isConsultingPath: isConsulting,
      isDataAnalyticsPath: isDataAnalytics,
      isTechProductsPath: isTechProducts,
      isDmaicPath: false,
      isProjectStatusEnable: false,
      isProjectStatusEnableForWithoutPSI: false,
      isGroupClassificationEnable: false,
      showExternalProductDropdown: false,
      groupClassificationId: null,
      groupClassificationName: null,
      externalProductId: null,
      externalProductValue: null,
      dmaicProjectStatusId: null,
      dmaicProjectStatusName: null,
      dmaicProjectStatusDate: null,
      projectStatusId: null,
      projectStatusName: null,
      projectStatusDate: null,
    });

    if (isConsulting || isDataAnalytics || isTechProducts) {
      await this.loadTransformationTypeSub();
    } else {
      await this.loadObjectives();
    }
  }

  async selectTransformationTypeSub(item: IdNameItem): Promise<void> {
    const subId = Number(item.id);
    const s = this.svc.summary();
    console.log(`[AutoFill] selectTransformationTypeSub: subId=${subId}, name="${item.name}", isConsulting=${s.isConsultingPath}, isTechProducts=${s.isTechProductsPath}, isDA=${s.isDataAnalyticsPath}`);

    this.svc.patchSummary({
      transformationTypeFirstLevelId: item.id,
      transformationTypeFirstLevelName: item.name,
      transformationTypeSecondLevelId: null,
      transformationTypeSecondLevelName: null,
      transformationTypeThirdLevelId: null,
      transformationTypeThirdLevelName: null,
    });

    // Consulting path: ID 3 = Problem Solving Initiative → load L3
    if (s.isConsultingPath && subId === 3) {
      await this.loadTransformationTypeL3_ProblemSolving(item.id!);
      return;
    }

    // Tech Products path: branch by sub-type ID
    if (s.isTechProductsPath) {
      if (subId === 6) {
        // Product Development → load second-level dropdown
        await this.loadTransformationTypeL3_ProductDev(item.id!);
        return;
      }
      if (subId === 7) {
        // Custom Development → load third-level dropdown
        await this.loadTransformationTypeL3_ProductDev(item.id!);
        return;
      }
      if (subId === 10) {
        // TP Microservices → load microservices sub-level
        await this.loadTransformationTypeL3_Microservices(item.id!);
        return;
      }
      if (subId === 8) {
        // External Products → show external product dropdown
        this.svc.patchSummary({ showExternalProductDropdown: true });
      }
    }

    // Data Analytics path: always enable Group Classification
    if (s.isDataAnalyticsPath) {
      this.svc.patchSummary({
        isGroupClassificationEnable: true,
        isProjectStatusEnableForWithoutPSI: true,
      });
    }

    await this.loadObjectives();
  }

  async selectTransformationTypeL3(item: IdNameItem): Promise<void> {
    const s = this.svc.summary();
    const parentSubId = Number(s.transformationTypeFirstLevelId);
    console.log(`[AutoFill] selectTransformationTypeL3: parentSubId=${parentSubId}, item="${item.name}" (id=${item.id}), isConsulting=${s.isConsultingPath}, isTechProducts=${s.isTechProductsPath}`);

    if (s.isConsultingPath) {
      // Consulting → Problem Solving path: store in secondLevelId, enable DMAIC
      this.svc.patchSummary({
        transformationTypeSecondLevelId: item.id,
        transformationTypeSecondLevelName: item.name,
        transformationTypeThirdLevelId: null,
        transformationTypeThirdLevelName: null,
        isDmaicPath: true,
        isProjectStatusEnable: true,
      });
      await this.loadObjectives();
      return;
    }

    if (s.isTechProductsPath) {
      if (parentSubId === 7) {
        // Custom Development path: L3 stored in secondLevelId per real Cockpit payload
        this.svc.patchSummary({
          transformationTypeSecondLevelId: item.id,
          transformationTypeSecondLevelName: item.name,
          transformationTypeThirdLevelId: null,
          transformationTypeThirdLevelName: null,
          isGroupClassificationEnable: true,
        });
        await this.loadObjectives();
        return;
      }

      if (parentSubId === 10) {
        // TP Microservices path: value stored in thirdLevelId per API spec
        this.svc.patchSummary({
          transformationTypeSecondLevelId: null,
          transformationTypeSecondLevelName: null,
          transformationTypeThirdLevelId: item.id,
          transformationTypeThirdLevelName: item.name,
        });
        await this.loadObjectives();
        return;
      }

      // Product Development (ID 6) path: value stored in secondLevelId
      this.svc.patchSummary({
        transformationTypeSecondLevelId: item.id,
        transformationTypeSecondLevelName: item.name,
        transformationTypeThirdLevelId: null,
        transformationTypeThirdLevelName: null,
      });
      await this.loadObjectives();
      return;
    }

    // Default path: store in secondLevelId
    this.svc.patchSummary({
      transformationTypeSecondLevelId: item.id,
      transformationTypeSecondLevelName: item.name,
      transformationTypeThirdLevelId: null,
      transformationTypeThirdLevelName: null,
    });
    await this.loadObjectives();
  }

  async selectTransformationTypeL4(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({
      transformationTypeThirdLevelId: item.id,
      transformationTypeThirdLevelName: item.name,
    });
    await this.loadObjectives();
  }

  async selectObjective(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({ objectiveId: Number(item.id), objectiveName: item.name });
    await this.loadNatures();
  }

  async selectNature(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({ natureId: Number(item.id), natureName: item.name });
    const s = this.svc.summary();

    if (s.isGroupClassificationEnable) {
      await this.loadGroupClassifications();
      return;
    }

    if (s.showExternalProductDropdown) {
      await this.loadExternalProducts();
      return;
    }

    await this.askProjectName();
  }

  async selectGroupClassification(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({ groupClassificationId: Number(item.id), groupClassificationName: item.name });
    this.resumeAuto();
    if (this.svc.summary().showExternalProductDropdown) { await this.loadExternalProducts(); return; }
    await this.askProjectName();
  }

  async selectExternalProduct(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({ externalProductId: item.id, externalProductValue: item.name });
    this.resumeAuto();
    await this.askProjectName();
  }

  async selectProjectLead(item: UserSearchItem): Promise<void> {
    this.svc.patchSummary({ projectLeadName: item.displayName, projectLeadUPN: item.userPrincipalName });
    this.resumeAuto();
    await this.askProjectSponsor();
  }

  async selectProjectSponsor(item: UserSearchItem): Promise<void> {
    this.svc.patchSummary({ projectSponsorName: item.displayName, projectSponsorUPN: item.userPrincipalName });
    this.resumeAuto();
    if (this.svc.nlpParsed()?.isRegionalApprovalRequired) {
      this.svc.patchSummary({ isRegionalApprovalRequired: true });
      await this.askRegionalApprover(); return;
    }
    await this.loadTransformationStatuses();
  }

  async selectRegionalApprover(item: UserSearchItem): Promise<void> {
    this.svc.patchSummary({
      regionalApproverId: item.id ?? item.userPrincipalName,
      regionalApproverName: item.displayName,
      regionalApproverUPN: item.userPrincipalName,
    });
    this.resumeAuto();
    await this.loadTransformationStatuses();
  }

  async selectTransformationStatus(item: IdNameItem): Promise<void> {
    const nlp = this.svc.nlpParsed();
    await this.selectStatusWithDate(
      'transformationStatusId', 'transformationStatusName', 'transformationStatusDate', item,
      nlp?.transformationStatusDate, 'Transformation Status Date',
      () => this.askTransformationStatusDate(),
      async () => {
        const s = this.svc.summary();
        if (s.isDmaicPath && s.isProjectStatusEnable) { await this.loadDmaicStatuses(); return; }
        if (s.isDataAnalyticsPath && s.isProjectStatusEnableForWithoutPSI) { await this.loadProjectStatuses(); return; }
        await this.loadUrgencies();
      },
    );
  }

  async selectDmaicStatus(item: IdNameItem): Promise<void> {
    const nlp = this.svc.nlpParsed();
    await this.selectStatusWithDate(
      'dmaicProjectStatusId', 'dmaicProjectStatusName', 'dmaicProjectStatusDate', item,
      nlp?.dmaicStatusDate ?? nlp?.transformationStatusDate, 'DMAIC Date',
      () => this.askDmaicStatusDate(),
      async () => { if (this.svc.summary().isProjectStatusEnable) await this.loadProjectStatuses(); else await this.loadUrgencies(); },
    );
  }

  async selectProjectStatus(item: IdNameItem): Promise<void> {
    const nlp = this.svc.nlpParsed();
    await this.selectStatusWithDate(
      'projectStatusId', 'projectStatusName', 'projectStatusDate', item,
      nlp?.projectStatusDate ?? nlp?.transformationStatusDate, 'Project Status Date',
      () => this.askProjectStatusDate(), () => this.loadUrgencies(),
    );
  }

  async selectUrgency(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({ urgencyId: Number(item.id), urgencyName: item.name });
    this.svc.addMessage('status', `✓ Urgency: ${item.name}`); this.svc.requestScroll();
    this.resumeAuto();
    await this.loadStrategicValues();
  }

  async selectStrategicValue(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({ strategicValueId: Number(item.id), strategicValueName: item.name });
    this.svc.addMessage('status', `✓ Strategic Value: ${item.name}`); this.svc.requestScroll();
    this.resumeAuto();
    await this.askDeploymentDuration();
  }

  askDeploymentDuration = () => this.askField('deployment_duration', 'deployment duration');
  askPaybackPeriod = () => this.askField('payback_period', 'payback period');

  // ── Tab 2: Data Loaders ────────────────────────────────────

  async startTab2(): Promise<void> {
    await this.loadTransformationTypes();
  }

  loadTransformationTypes = (): Promise<void> => this.loadDropdown('transformation_type', 'transformation types', 'get_transformation_types', {}, () => this.loadTransformationTypes());

  loadTransformationTypeSub = (): Promise<void> => this.loadDropdown('transformation_type_sub', 'transformation sub-types', 'get_transformation_type_sub_dropdown', { transformationTypeId: this.svc.summary().transformationTypeId }, () => this.loadTransformationTypeSub());

  loadTransformationTypeL3_ProblemSolving = (parentId: string): Promise<void> => this.loadDropdown('transformation_type_l3', 'problem solving types', 'get_transformation_type_second_level', { transformationTypeSecondLevelId: parentId }, () => this.loadTransformationTypeL3_ProblemSolving(parentId));

  loadTransformationTypeL3_ProductDev = (parentId: string): Promise<void> => this.loadDropdown('transformation_type_l3', 'product development types', 'get_transformation_type_second_level', { transformationTypeSecondLevelId: parentId }, () => this.loadTransformationTypeL3_ProductDev(parentId));

  loadTransformationTypeL3_Microservices = (parentId: string): Promise<void> => this.loadDropdown('transformation_type_l3', 'microservices types', 'get_tp_microservices_sub_level', { transformationTypeId: parentId }, () => this.loadTransformationTypeL3_Microservices(parentId));

  loadTransformationTypeL4 = (parentId: string): Promise<void> => this.loadDropdown('transformation_type_l4', 'custom development types', 'get_transformation_type_second_level', { transformationTypeSecondLevelId: parentId }, () => this.loadTransformationTypeL4(parentId));

  loadTransformationTypeL4_Microservices = (parentId: string): Promise<void> => this.loadDropdown('transformation_type_l4', 'microservices sub-types', 'get_tp_microservices_sub_level', { transformationTypeId: parentId }, () => this.loadTransformationTypeL4_Microservices(parentId));

  loadGroupClassifications = (): Promise<void> => this.loadDropdown('group_classification', 'group classifications', 'get_group_classification_options', {}, () => this.loadGroupClassifications());

  loadExternalProducts = (): Promise<void> => this.loadDropdown('external_product', 'external products', 'get_external_products', {}, () => this.loadExternalProducts());

  loadDmaicStatuses = (): Promise<void> => this.loadDropdown('dmaic_status', 'DMAIC statuses', 'get_dmaic_project_status', {}, () => this.loadDmaicStatuses());

  askDmaicStatusDate = () => this.askField('dmaic_status_date', 'DMAIC date');

  loadProjectStatuses = async (): Promise<void> => {
    const s = this.svc.summary();
    const payload = {
      transformationTypeId: String(s.transformationTypeId ?? ''),
      transformationStatusId: s.transformationStatusId ?? 0,
    };
    await this.loadDropdown('project_status', 'project statuses', 'get_project_statuses', payload, () => this.loadProjectStatuses());
    // If API returned empty (e.g. 204 for certain status combos), skip to urgencies
    if (!this.svc.options().length && !this.svc.errorRetry()) {
      this.svc.addMessage('status', '✓ No project statuses for this combination — skipping');
      this.svc.patchSummary({ isProjectStatusEnableForWithoutPSI: false });
      // Re-enable autoFilling: tryAutoSelect pauses it via fallthrough when opts are empty
      if (this.svc.nlpParsed()) this.svc.autoFilling = true;
      await this.loadUrgencies();
    }
  };

  askProjectStatusDate = () => this.askField('project_status_date', 'project status date');

  askTransformationStatusDate = () => this.askField('transformation_status_date', 'transformation status date');

  loadUrgencies = (): Promise<void> => this.loadDropdown('urgency', 'urgencies', 'get_urgencies', {}, () => this.loadUrgencies());

  loadStrategicValues = (): Promise<void> => this.loadDropdown('strategic_value', 'strategic values', 'get_strategies', {}, () => this.loadStrategicValues());

  loadObjectives = (): Promise<void> => this.loadDropdown('objective', 'objectives', 'get_objectives', {}, () => this.loadObjectives());

  loadNatures = (): Promise<void> => this.loadDropdown('nature', 'natures', 'get_natures', {}, () => this.loadNatures());

  askProjectName = () => this.askField('project_name', 'project details');
  askProjectLead = () => this.askField('project_lead', 'project lead');
  askProjectSponsor = () => this.askField('project_sponsor', 'project sponsor');

  askRegionalApprover = () => this.askField('regional_approver', 'regional approver');

  searchRegionalApprover = (text: string) => this.searchUserField('regional_approver', 'get_regional_approver', { searchText: text, opportunityId: this.svc.opportunityId() }, text);

  loadTransformationStatuses = (): Promise<void> => this.loadDropdown('transformation_status', 'transformation statuses', 'get_transformation_statuses', { transformationTypeId: String(this.svc.summary().transformationTypeId ?? ''), opportunityId: this.svc.opportunityId() }, () => this.loadTransformationStatuses());

  async showTab2Confirm(): Promise<void> {
    this.svc.activeField.set('tab2_confirm');
    this.svc.options.set([]);
    if (this.svc.nlpParsed()) this.svc.autoFilling = true;
    this.svc.requestScroll();
    await tryAutoSelect(this.svc, this);
  }

  searchUsers = (field: 'project_lead' | 'project_sponsor', text: string) => this.searchUserField(field, 'search_users', { searchText: text, opportunityId: this.svc.opportunityId() }, text);

  // ── Save Methods ───────────────────────────────────────────

  async saveDraft(): Promise<void> {
    this.svc.setLoading(true, 'opportunity');
    this.svc.addMessage('status', MSG.SAVING);

    if (!this.svc.opportunityId()) {
      this.svc.opportunityId.set(crypto.randomUUID());
    }

    try {
      const response = await this.svc.request<unknown>('create_opportunity', {
        opportunityPayload: this.svc.buildFullPayload(1),
      });

      const resData = response.data as Record<string, unknown>;
      const resultData = (resData?.['resultData'] as Array<Record<string, unknown>>)?.[0];
      if (resultData?.['OpportunityId']) {
        this.svc.opportunityId.set(resultData['OpportunityId'] as string);
      }
      if (resultData?.['newOpportunityId']) {
        this.svc.viewOpportunityId.set(resultData['newOpportunityId'] as string);
      }
      this.svc.opportunityRes.set(JSON.stringify(response.data, null, 2));

      this.svc.steps.update(steps => {
        const clone = steps.map(st => ({ ...st }));
        clone[0].state = 'completed';
        clone[1].state = 'active';
        return clone;
      });
      this.svc.toastr.success(TOAST.DRAFT_OK.body, TOAST.DRAFT_OK.title);

      await this.svc.pushAssistantMessage(
        'save',
        PROMPTS.SAVE_SUCCESS.prompt,
        PROMPTS.SAVE_SUCCESS.fallback,
      );
      this.svc.clearMessages();
      await this.startTab2();
    } catch (error) {
      this.svc.addMessage('assistant', this.svc.getErrorText(error));
      this.svc.toastr.error(TOAST.ERROR.body, TOAST.ERROR.title);
    } finally {
      this.svc.setLoading(false);
    }
  }

  async saveTab2Draft(): Promise<void> {
    this.svc.setLoading(true, 'opportunity');
    this.svc.addMessage('status', MSG.SAVING_TAB2);

    const payload = this.svc.buildFullPayload(2);
    console.log('[Tab2 Save] Payload:', JSON.stringify({
      urgency: payload['urgency'],
      statgicValue: payload['statgicValue'],
      transformationStatusId: payload['transformationStatusId'],
      transformationStatusDate: payload['transformationStatusDate'],
      transformationTypeThirdLevelId: payload['transformationTypeThirdLevelId'],
      transformationTypeSecondLevelId: payload['transformationTypeSecondLevelId'],
      transformationTypeFirstLevelId: payload['transformationTypeFirstLevelId'],
    }));

    try {
      await this.svc.request<unknown>('create_opportunity', {
        opportunityPayload: payload,
      });

      // Submit urgency/strategicValue + deployment/payback via SubmitProjectPrioritisation
      const s = this.svc.summary();
      if (s.urgencyId || s.strategicValueId || s.deploymentDuration || s.paybackPeriod) {
        try {
          await this.svc.request<unknown>('submit_project_prioritisation', {
            prioritisationPayload: {
              opportunityId: this.svc.opportunityId(),
              deploymentDuration: s.deploymentDuration ?? null,
              paybackPeriod: s.paybackPeriod ?? null,
              urgencyId: s.urgencyId ?? null,
              strategicValueId: s.strategicValueId ?? null,
            },
          });
        } catch {
          // Non-blocking — prioritisation is supplementary
        }
      }

      this.svc.draftSaved.set(false);
      this.svc.steps.update(steps => {
        const clone = steps.map(st => ({ ...st }));
        clone[1].state = 'completed';
        clone[2].state = 'active';
        return clone;
      });
      await this.svc.pushAssistantMessage(
        'save_tab2',
        PROMPTS.TAB2_SAVE_SUCCESS.prompt,
        PROMPTS.TAB2_SAVE_SUCCESS.fallback,
      );
      this.svc.toastr.success(TOAST.TAB2_OK.body, TOAST.TAB2_OK.title);
      this.svc.clearMessages();
      await this.askTab3Financials();
    } catch (error) {
      this.svc.addMessage('assistant', this.svc.getErrorText(error));
      this.svc.toastr.error(TOAST.ERROR.body, TOAST.ERROR.title);
    } finally {
      this.svc.setLoading(false);
    }
  }

  // ── Tab 3: Financials ──────────────────────────────────────

  async askTab3Financials(): Promise<void> {
    if (!this.svc.autoFilling) this.svc.clearMessages();
    // Pre-populate the financial form with any NLP-extracted values
    const nlp = this.svc.nlpParsed();
    this.svc.financialForm.set({
      expectedRevenue:           nlp?.expectedRevenue           ?? '',
      expectedInternalBenefit:   nlp?.expectedInternalBenefit   ?? '',
      expectedClientBenefit:     nlp?.expectedClientBenefit     ?? '',
      estimatedProjectCost:      nlp?.estimatedProjectCost      ?? '',
      actualProjectCost:         nlp?.actualProjectCost         ?? '',
      currency:                  nlp?.currency                  ?? '',
      internalBenefit:           nlp?.internalBenefit           ?? '',
      clientBenefit:             nlp?.clientBenefit             ?? '',
      recurrentRevenue:          nlp?.recurrentRevenue          ?? '',
      realisedBenefit:           nlp?.realisedBenefit           ?? '',
      realisedRevenue:           nlp?.realisedRevenue           ?? '',
      additionalInvestment:      nlp?.additionalInvestment      ?? '',
    });
    this.svc.activeField.set('tab3_financials');
    this.svc.options.set([]);
    this.svc.setLoading(true, 'financials');
    await this.svc.pushAssistantMessage(
      'tab3_financials',
      PROMPTS.TAB3_FINANCIALS.prompt,
      PROMPTS.TAB3_FINANCIALS.fallback,
    );
    this.svc.setLoading(false);
    this.svc.requestScroll();
    await tryAutoSelect(this.svc, this);
  }

  async skipTab3Financials(): Promise<void> {
    // Validate: cannot skip if Expected Revenue is required (Sell More objective)
    if (this.svc.summary().objectiveName === 'Sell More') {
      this.svc.addMessage('assistant', '**Expected Revenue is required** when the Objective is **Sell More**. Please fill in the Expected Revenue field — you cannot skip financials with this objective.');
      this.svc.requestScroll();
      return;
    }
    // Clear financial form and proceed with empty values
    this.svc.financialForm.set(createInitialFinancialForm());
    this.svc.addMessage('status', '↪ Financials skipped — proceeding with empty values');
    this.svc.requestScroll();
    this.resumeAuto();
    await this.saveTab3();
  }

  async saveTab3Financials(): Promise<void> {
    const form = this.svc.financialForm();
    // Validate: Expected Revenue is mandatory when objective is Sell More
    if (this.svc.summary().objectiveName === 'Sell More' && !form.expectedRevenue?.trim()) {
      this.svc.addMessage('assistant', '**Expected Revenue is required** when the Objective is **Sell More**. Please fill in the Expected Revenue field before saving.');
      this.svc.requestScroll();
      return;
    }
    this.resumeAuto();
    // Store financial form values into summary so buildFullPayload(3) picks them up
    this.svc.summary.update(s => ({
      ...s,
      expectedRevenue:         form.expectedRevenue         || undefined,
      expectedInternalBenefit: form.expectedInternalBenefit || undefined,
      expectedClientBenefit:   form.expectedClientBenefit   || undefined,
      estimatedProjectCost:    form.estimatedProjectCost    || undefined,
      actualProjectCost:       form.actualProjectCost       || undefined,
      currency:                form.currency                || undefined,
      internalBenefit:         form.internalBenefit         || undefined,
      clientBenefit:           form.clientBenefit           || undefined,
      recurrentRevenue:        form.recurrentRevenue        || undefined,
      realisedBenefit:         form.realisedBenefit         || undefined,
      realisedRevenue:         form.realisedRevenue         || undefined,
      additionalInvestment:    form.additionalInvestment    || undefined,
    }));
    await this.saveTab3();
  }

  async saveTab3(): Promise<void> {
    this.svc.setLoading(true, 'financials');
    this.svc.addMessage('status', MSG.SAVING_TAB3);

    try {
      await this.svc.request<unknown>('create_opportunity', {
        opportunityPayload: this.svc.buildFullPayload(3),
      });

      this.svc.steps.update(steps => {
        const clone = steps.map(st => ({ ...st }));
        clone[2].state = 'completed';
        clone[3].state = 'active';
        return clone;
      });
      this.svc.addMessage('status', '✓ Financials saved');
      this.svc.toastr.success(TOAST.TAB3_OK.body, TOAST.TAB3_OK.title);
      this.svc.clearMessages();
      await this.startTab4();
    } catch (error) {
      this.svc.addMessage('assistant', this.svc.getErrorText(error));
      this.svc.toastr.error(TOAST.ERROR.body, TOAST.ERROR.title);
    } finally {
      this.svc.setLoading(false);
    }
  }

  matchUserOption(text: string): OptionItem | null {
    const q = text.toLowerCase();
    const opts = this.svc.options();
    if (!opts.length) return null;
    return opts.find(o => {
      if ('displayName' in o) {
        const name = (o as UserSearchItem).displayName?.toLowerCase() ?? '';
        return name === q || name.includes(q) || q.includes(name);
      }
      return false;
    }) ?? null;
  }

  // ── Tab 4: KPI ─────────────────────────────────────────────

  async selectMetricGroup(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({
      kpiMetricGroupId: Number(item.id),
      kpiMetricGroupName: item.name,
      kpiMetricId: null,
      kpiMetricName: null,
    });
    await this.loadMetrics();
  }

  async selectMetric(item: IdNameItem): Promise<void> {
    this.svc.patchSummary({
      kpiMetricId: Number(item.id),
      kpiMetricName: item.name,
    });
    await this.askKpiValues();
  }

  async startTab4(): Promise<void> {
    this.svc.kpiForm.set(createInitialKpiForm());
    await this.loadKpisList();
  }

  async loadMetricGroups(): Promise<void> {
    this.svc.patchSummary({
      kpiMetricGroupId: null, kpiMetricGroupName: null,
      kpiMetricId: null, kpiMetricName: null,
    });
    this.svc.kpiForm.set(createInitialKpiForm());
    this.svc.activeField.set('metric_group');
    this.svc.setLoading(true, 'metric groups');
    await Promise.all([
      this.svc.pushAssistantMessage('metric_group', PROMPTS.METRIC_GROUP.prompt, PROMPTS.METRIC_GROUP.fallback),
      this.svc.loadOptionsData<IdNameItem>('get_metric_groups', {}, () => this.loadMetricGroups()),
    ]);
    if (this.svc.options().length) this.svc.addMessage('options', OPTIONS_LABELS['metric_group']);
    this.svc.setLoading(false);
    this.svc.requestScroll();
    if (this.svc.errorRetry()) return;
    await tryAutoSelect(this.svc, this);
  }

  loadMetrics = (): Promise<void> => this.loadDropdown('metric', 'metrics', 'get_metrics', { metricGroupId: this.svc.summary().kpiMetricGroupId }, () => this.loadMetrics());

  async askKpiValues(): Promise<void> {
    if (!this.svc.autoFilling) this.svc.clearMessages();
    this.svc.activeField.set('kpi_values');
    this.svc.options.set([]);
    this.svc.kpiForm.set(createInitialKpiForm());
    this.svc.setLoading(true, 'KPI form');
    await this.svc.pushAssistantMessage('kpi_values', PROMPTS.KPI_VALUES.prompt, PROMPTS.KPI_VALUES.fallback);
    this.svc.setLoading(false);
    this.svc.requestScroll();
    await tryAutoSelect(this.svc, this);
  }

  async addKpi(): Promise<void> {
    const form = this.svc.kpiForm();
    if (!form.asIs.trim() || !form.toBe.trim()) {
      this.svc.toastr.warning('As-Is and To-Be values are required.', 'Validation');
      return;
    }

    this.svc.setLoading(true, 'KPI');
    this.svc.addMessage('status', MSG.ADDING_KPI);

    try {
      const s = this.svc.summary();
      const today = new Date().toISOString().split('T')[0];
      await this.svc.request<unknown>('create_kpi', {
        kpiPayload: {
          opportunityId:      this.svc.opportunityId(),
          metricGroupId:      s.kpiMetricGroupId,
          metricId:           s.kpiMetricId,
          aS_IS:              form.asIs,
          tO_BE:              form.toBe,
          woulD_BE:           form.wouldBe || null,
          lastUpdatedDate:    today,
          lastSnapshot:       form.lastSnapshot || null,
          description:        form.description || null,
          customSubMetricsName: form.customSubMetricsName || null,
        },
      });

      this.svc.toastr.success(TOAST.KPI_OK.body, TOAST.KPI_OK.title);
      this.svc.kpiForm.set(createInitialKpiForm());
      this.svc.patchSummary({
        kpiMetricGroupId: null, kpiMetricGroupName: null,
        kpiMetricId: null, kpiMetricName: null,
      });

      this.resumeAuto();

      await this.loadKpisList();
    } catch (error) {
      this.svc.addMessage('assistant', this.svc.getErrorText(error));
      this.svc.toastr.error(TOAST.ERROR.body, TOAST.ERROR.title);
    } finally {
      this.svc.setLoading(false);
      this.svc.requestScroll();
    }
  }

  async loadKpisList(): Promise<void> {
    this.svc.setLoading(true, 'KPIs');

    try {
      const response = await this.svc.request<KpiItem[]>('get_kpis_list', {
        opportunityId: this.svc.opportunityId(),
      });
      const items = response.data ?? [];
      this.svc.kpiList.set(Array.isArray(items) ? items : []);
    } catch {
      this.svc.kpiList.set([]);
    }

    this.svc.setLoading(false);
    this.svc.activeField.set('kpi_list');
    this.svc.options.set([]);

    if (this.svc.kpiList().length > 0) {
      await this.svc.pushAssistantMessage('kpi_list', PROMPTS.KPI_ADDED.prompt, PROMPTS.KPI_ADDED.fallback);
    } else {
      await this.loadMetricGroups();
      return;
    }
    this.svc.requestScroll();
    await tryAutoSelect(this.svc, this);
  }

  async deleteKpi(metricrowId: number): Promise<void> {
    this.svc.setLoading(true, 'KPI');
    this.svc.addMessage('status', MSG.DELETING_KPI);

    try {
      await this.svc.request<unknown>('delete_kpi', {
        opportunityId: this.svc.opportunityId(),
        metricrowId,
      });
      this.svc.toastr.info(TOAST.KPI_DEL.body, TOAST.KPI_DEL.title);
      const response = await this.svc.request<KpiItem[]>('get_kpis_list', {
        opportunityId: this.svc.opportunityId(),
      });
      this.svc.kpiList.set(response.data ?? []);
    } catch (error) {
      this.svc.addMessage('assistant', this.svc.getErrorText(error));
      this.svc.toastr.error(TOAST.ERROR.body, TOAST.ERROR.title);
    } finally {
      this.svc.setLoading(false);
      this.svc.requestScroll();
    }
  }

  async showTab4Confirm(): Promise<void> {
    this.svc.activeField.set('tab4_confirm');
    this.svc.options.set([]);
    this.svc.requestScroll();
    await tryAutoSelect(this.svc, this);
  }

  async saveTab4Final(): Promise<void> {
    this.svc.setLoading(true, 'project submission');
    this.svc.addMessage('status', MSG.SAVING_TAB4);

    try {
      const response = await this.svc.request<unknown>('create_opportunity', {
        opportunityPayload: this.svc.buildFullPayload(4),
      });

      const nlp = this.svc.nlpParsed();
      const s4 = this.svc.summary();
      if (s4.urgencyId || s4.strategicValueId || nlp?.deploymentDuration || nlp?.paybackPeriod) {
        try {
          await this.svc.request<unknown>('submit_project_prioritisation', {
            prioritisationPayload: {
              opportunityId: this.svc.opportunityId(),
              deploymentDuration: s4.deploymentDuration ?? nlp?.deploymentDuration ?? null,
              paybackPeriod: s4.paybackPeriod ?? nlp?.paybackPeriod ?? null,
              urgencyId: s4.urgencyId ?? null,
              strategicValueId: s4.strategicValueId ?? null,
            },
          });
        } catch {
          // Non-blocking — prioritisation is supplementary
        }
      }

      this.svc.stopExecutionTimer();
      this.svc.projectSubmitted.set(true);
      const resData = response.data as Record<string, unknown>;
      const resultData = (resData?.['resultData'] as Array<Record<string, unknown>>)?.[0];
      if (resultData?.['newOpportunityId']) {
        this.svc.viewOpportunityId.set(resultData['newOpportunityId'] as string);
      }
      this.svc.opportunityRes.set(JSON.stringify(response.data, null, 2));
      this.svc.steps.update(steps => {
        const clone = steps.map(st => ({ ...st }));
        clone[3].state = 'completed';
        return clone;
      });
      this.svc.clearMessages();
      this.svc.toastr.success(TOAST.TAB4_OK.body, TOAST.TAB4_OK.title);
    } catch (error) {
      this.svc.addMessage('assistant', this.svc.getErrorText(error));
      this.svc.toastr.error(TOAST.ERROR.body, TOAST.ERROR.title);
    } finally {
      this.svc.setLoading(false);
      this.svc.requestScroll();
    }
  }

  // ── Auto-Resolve ───────────────────────────────────────────

  async autoResolve(): Promise<void> {
    this.svc.setLoading(true, 'dependencies');
    this.svc.options.set([]);
    this.svc.activeField.set(null);
    this.svc.addMessage('status', MSG.AUTO_RESOLVING);

    try {
      const s = this.svc.summary();
      const response = await this.svc.request<{
        industries: IdNameItem[];
        languages: IdNameItem[];
      }>('auto_resolve', {
        clusterId:        s.clusterId,
        clusterCountryId: s.clusterCountryId,
        companyId:        s.companyId,
        clientId:         s.clientId,
        lobId:            s.lobId,
      });

      const industry = response.data.industries?.[0];
      const language = response.data.languages?.[0];
      this.svc.patchSummary({
        industryId:   industry?.id ?? '',
        industryName: industry?.name ?? FALLBACK_VALUE,
        languageName: language?.name ?? FALLBACK_VALUE,
      });

      this.svc.activeField.set('confirm');
      if (this.svc.nlpParsed()) this.svc.autoFilling = true;
      const p = autoResolvePrompt(
        this.svc.summary().industryName!,
        this.svc.summary().languageName!,
      );
      await this.svc.pushAssistantMessage('resolve', p.prompt, p.fallback);
      await tryAutoSelect(this.svc, this);
    } catch (error) {
      this.svc.handleError(error, () => this.autoResolve());
    } finally {
      this.svc.setLoading(false);
    }
    this.svc.requestScroll();
  }

  // ── NLP (delegated to project-wizard-nlp.ts) ───────────────

  async parseAndBind(text: string): Promise<void> {
    return nlpParseAndBind(this.svc, this, text);
  }

  async confirmNlpPreview(): Promise<void> {
    return nlpConfirmNlpPreview(this.svc, this);
  }

  async submitPreflight(): Promise<void> {
    return nlpSubmitPreflight(this.svc, this);
  }

  // ── Revert Handler ─────────────────────────────────────────

  async handleRevert(): Promise<void> {
    const field = this.svc.activeField();

    if (field === 'confirm' && !this.svc.draftSaved()) {
      await this.svc.resetSelection(this.svc.summary().isSecondary ? 'primary_project' : 'operational_lob');
      return;
    }

    if (field === 'primary_project') {
      this.svc.patchSummary({ isSecondary: false, primaryProjectId: null, primaryProjectName: null });
      this.svc.addMessage('status', MSG.GOING_BACK);
      this.svc.requestScroll();
      await this.askSecondaryProject();
      return;
    }

    if (field === 'transformation_type') {
      this.svc.addMessage('assistant', 'Basic Info is already saved. You can pick a different transformation type from the list above.');
      this.svc.requestScroll();
      return;
    }

    // Dynamic revert: transformation_status → regional_approver (if active) or project_sponsor
    if (field === 'transformation_status' && this.svc.summary().isRegionalApprovalRequired) {
      await this.svc.resetSelection('regional_approver');
      return;
    }

    if (field && REVERT_MAP[field]) {
      await this.svc.resetSelection(REVERT_MAP[field]);
      return;
    }

    if (field === 'cluster' || field === 'secondary_ask' || field === 'nlp_preview') {
      this.svc.addMessage('status', MSG.STARTING_OVER);
      this.svc.resetSummary();
      this.svc.activeField.set(null);
      this.svc.options.set([]);
      this.svc.requestScroll();
      this.svc.addMessage('landing', '');
      return;
    }

    this.svc.addMessage('assistant', MSG.NO_REVERT);
    this.svc.requestScroll();
  }

  // ── Matching ───────────────────────────────────────────────

  matchOption(text: string): OptionItem | null {
    const q    = text.toLowerCase();
    const opts = this.svc.options();
    if (!opts.length) return null;

    if (this.svc.isPrimaryProject(opts[0])) {
      return (
        opts.find(o => {
          const p = o as PrimaryProjectItem;
          return (
            (p.viewopportunityId?.toLowerCase() ?? '') === q ||
            (p.clientName?.toLowerCase() ?? '') === q
          );
        }) ?? null
      );
    }
    return (
      opts.find(o => {
        const name = 'name' in o ? String((o as IdNameItem).name ?? '') : '';
        const lc = name.toLowerCase();
        return lc === q || lc.includes(q) || q.includes(lc);
      }) ?? null
    );
  }

  async applyMatch(item: OptionItem): Promise<void> {
    if (this.svc.nlpParsed() && !this.svc.autoFilling) {
      this.svc.autoFilling = true;
      // Strip stale 'options' messages from the paused step so they don't
      // bleed into the next field's display when the engine resumes.
      this.svc.messages.update(msgs => msgs.filter(m => m.role !== 'options'));
      console.log(`[AutoFill] Re-enabled autoFilling after manual selection at field="${this.svc.activeField()}"`);
    }
    switch (this.svc.activeField()) {
      case 'cluster':         await this.selectCluster(item as IdNameItem); break;
      case 'country':         await this.selectCountry(item as IdNameItem); break;
      case 'company':         await this.selectCompany(item as IdNameItem); break;
      case 'client':          await this.selectClient(item as ClientItem); break;
      case 'lob':             await this.selectLob(item as IdNameItem); break;
      case 'operational_lob': await this.selectOperationalLob(item as IdNameItem); break;
      case 'primary_project': await this.selectPrimaryProject(item as PrimaryProjectItem); break;
      case 'transformation_type':     await this.selectTransformationType(item as IdNameItem); break;
      case 'transformation_type_sub': await this.selectTransformationTypeSub(item as IdNameItem); break;
      case 'transformation_type_l3':  await this.selectTransformationTypeL3(item as IdNameItem); break;
      case 'transformation_type_l4':  await this.selectTransformationTypeL4(item as IdNameItem); break;
      case 'objective':               await this.selectObjective(item as IdNameItem); break;
      case 'nature':                  await this.selectNature(item as IdNameItem); break;
      case 'group_classification':    await this.selectGroupClassification(item as IdNameItem); break;
      case 'external_product':        await this.selectExternalProduct(item as IdNameItem); break;
      case 'project_lead':            await this.selectProjectLead(item as UserSearchItem); break;
      case 'project_sponsor':         await this.selectProjectSponsor(item as UserSearchItem); break;
      case 'regional_approver':       await this.selectRegionalApprover(item as UserSearchItem); break;
      case 'dmaic_status':            await this.selectDmaicStatus(item as IdNameItem); break;
      case 'transformation_status':   await this.selectTransformationStatus(item as IdNameItem); break;
      case 'project_status':          await this.selectProjectStatus(item as IdNameItem); break;
      case 'urgency':                 await this.selectUrgency(item as IdNameItem); break;
      case 'strategic_value':         await this.selectStrategicValue(item as IdNameItem); break;
      case 'metric_group':            await this.selectMetricGroup(item as IdNameItem); break;
      case 'metric':                  await this.selectMetric(item as IdNameItem); break;
    }
  }

}

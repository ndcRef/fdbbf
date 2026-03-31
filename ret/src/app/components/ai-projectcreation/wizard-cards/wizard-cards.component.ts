import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ProjectWizardService } from '../../../services/project-wizard.service';
import {
  EMPTY_DISPLAY,
  PREFLIGHT_OPTIONS,
  type KpiFormData,
  type FinancialFormData,
  type PreflightFormData,
} from '../../../constants/project-wizard.constants';

const SVG: Record<string, string> = {
  gear: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.8"/>',
  consentCheck: '<path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  successCheck: '<path class="check-path" d="M5 13l4 4L19 7" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  clipboard: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="2"/><path d="M9 14l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  barChart: '<path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  externalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

// ── Field Configs (drive template @for loops) ────────────────
type Fc = { key: string; label: string; ph: string; req?: boolean };
type Sc = { key: string; label: string; nlpKey: string; opts: readonly string[] };
type Gf = { key: string; label: string; full?: boolean; sm?: boolean; sfx?: string; always?: boolean };

const FIN_FIELDS: Fc[] = [
  { key: 'expectedRevenue', label: 'Expected Revenue', ph: 'e.g. 50000 (optional)', req: true },
  { key: 'expectedInternalBenefit', label: 'Expected Internal Benefit', ph: 'e.g. 20000 (optional)' },
  { key: 'expectedClientBenefit', label: 'Expected Client Benefit', ph: 'e.g. 30000 (optional)' },
  { key: 'estimatedProjectCost', label: 'Estimated Project Cost', ph: 'e.g. 10000 (optional)' },
  { key: 'actualProjectCost', label: 'Actual Project Cost', ph: 'e.g. 9500 (optional)' },
  { key: 'currency', label: 'Currency', ph: 'e.g. USD (optional)' },
  { key: 'internalBenefit', label: 'Internal Benefit', ph: 'e.g. 15000 (optional)' },
  { key: 'clientBenefit', label: 'Client Benefit', ph: 'e.g. 25000 (optional)' },
  { key: 'recurrentRevenue', label: 'Recurrent Revenue', ph: 'e.g. 5000 (optional)' },
  { key: 'realisedBenefit', label: 'Realised Benefit', ph: 'e.g. 18000 (optional)' },
  { key: 'realisedRevenue', label: 'Realised Revenue', ph: 'e.g. 45000 (optional)' },
  { key: 'additionalInvestment', label: 'Additional Investment', ph: 'e.g. 2000 (optional)' },
];

const KPI_FIELDS: Fc[] = [
  { key: 'asIs', label: 'As-Is', ph: 'Current state value', req: true },
  { key: 'toBe', label: 'To-Be', ph: 'Target state value', req: true },
  { key: 'wouldBe', label: 'Would-Be', ph: 'Expected state (optional)' },
  { key: 'lastSnapshot', label: 'Last Snapshot', ph: 'Last snapshot value (optional)' },
  { key: 'description', label: 'Description', ph: 'Brief description (optional)' },
  { key: 'customSubMetricsName', label: 'Custom Sub-Metrics Name', ph: 'Custom sub-metrics (optional)' },
];

const PREFLIGHT_SELECTS: Sc[] = [
  { key: 'transformationType', label: 'Transformation Type', nlpKey: 'transformationType', opts: PREFLIGHT_OPTIONS.transformationTypes },
  { key: 'objective', label: 'Objective', nlpKey: 'objective', opts: PREFLIGHT_OPTIONS.objectives },
  { key: 'nature', label: 'Nature', nlpKey: 'nature', opts: PREFLIGHT_OPTIONS.natures },
  { key: 'transformationStatus', label: 'Transformation Status', nlpKey: 'transformationStatus', opts: PREFLIGHT_OPTIONS.transformationStatuses },
  { key: 'urgency', label: 'Urgency', nlpKey: 'urgency', opts: PREFLIGHT_OPTIONS.urgencies },
  { key: 'strategicValue', label: 'Strategic Value', nlpKey: 'strategicValue', opts: PREFLIGHT_OPTIONS.strategicValues },
  { key: 'metricGroup', label: 'KPI Metric Group', nlpKey: 'metricGroup', opts: PREFLIGHT_OPTIONS.metricGroups },
];

const NLP_TAB2: Gf[] = [
  { key: 'transformationType', label: 'Transformation Type' }, { key: 'transformationTypeSub', label: 'Sub-Type' },
  { key: 'transformationTypeSecondLevel', label: 'Level 3' }, { key: 'objective', label: 'Objective' },
  { key: 'nature', label: 'Nature' }, { key: 'projectName', label: 'Project Name', full: true },
  { key: 'projectDescription', label: 'Description', full: true, sm: true },
  { key: 'projectLeadName', label: 'Project Lead' }, { key: 'projectSponsorName', label: 'Project Sponsor' },
  { key: 'transformationStatus', label: 'Transformation Status' }, { key: 'dmaicStatus', label: 'DMAIC Status' },
  { key: 'transformationStatusDate', label: 'Trans. Status Date' }, { key: 'dmaicStatusDate', label: 'DMAIC Date' },
  { key: 'urgency', label: 'Urgency' }, { key: 'strategicValue', label: 'Strategic Value' },
  { key: 'deploymentDuration', label: 'Deployment Duration', sfx: ' months' },
  { key: 'paybackPeriod', label: 'Payback Period', sfx: ' months' },
];

const NLP_TAB3: Gf[] = [
  { key: 'expectedRevenue', label: 'Expected Revenue' }, { key: 'estimatedProjectCost', label: 'Estimated Cost' },
  { key: 'expectedInternalBenefit', label: 'Internal Benefit' }, { key: 'expectedClientBenefit', label: 'Client Benefit' },
  { key: 'currency', label: 'Currency' },
];

const NLP_TAB4: Gf[] = [
  { key: 'metricGroup', label: 'Metric Group' }, { key: 'metric', label: 'Metric' },
  { key: 'asIsValue', label: 'As-Is' }, { key: 'toBeValue', label: 'To-Be' },
  { key: 'wouldBeValue', label: 'Would-Be' },
  { key: 'kpiDescription', label: 'KPI Description', full: true, sm: true },
];

const TAB2_GRID: Gf[] = [
  { key: 'transformationTypeName', label: 'Transformation Type', always: true },
  { key: 'transformationTypeFirstLevelName', label: 'Sub-Type' },
  { key: 'transformationTypeSecondLevelName', label: 'Level 3' },
  { key: 'transformationTypeThirdLevelName', label: 'Level 4' },
  { key: 'objectiveName', label: 'Objective', always: true },
  { key: 'natureName', label: 'Nature', always: true },
  { key: 'groupClassificationName', label: 'Group Classification' },
  { key: 'externalProductValue', label: 'External Product' },
  { key: 'projectName', label: 'Project Name', always: true },
  { key: 'projectLeadName', label: 'Project Lead', always: true },
  { key: 'projectSponsorName', label: 'Project Sponsor', always: true },
  { key: 'regionalApproverName', label: 'Regional Approver' },
  { key: 'transformationStatusName', label: 'Trans. Status', always: true },
  { key: 'dmaicProjectStatusName', label: 'DMAIC Status' },
  { key: 'dmaicProjectStatusDate', label: 'DMAIC Date' },
  { key: 'projectStatusName', label: 'Project Status' },
  { key: 'projectStatusDate', label: 'Status Date' },
  { key: 'urgencyName', label: 'Urgency' },
  { key: 'strategicValueName', label: 'Strategic Value' },
];

@Component({
  selector: 'wizard-cards',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './wizard-cards.component.html',
  styleUrl: './wizard-cards.component.scss',
})
export class WizardCardsComponent {
  protected readonly svc = inject(ProjectWizardService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly EMPTY = EMPTY_DISPLAY;
  protected readonly PREFLIGHT_OPTIONS = PREFLIGHT_OPTIONS;
  protected readonly FIN = FIN_FIELDS;
  protected readonly KPI = KPI_FIELDS;
  protected readonly PRE = PREFLIGHT_SELECTS;
  protected readonly NLP2 = NLP_TAB2;
  protected readonly NLP3 = NLP_TAB3;
  protected readonly NLP4 = NLP_TAB4;
  protected readonly T2G = TAB2_GRID;
  protected readonly isSellMore = computed(() => this.svc.summary().objectiveName === 'Sell More');

  protected v(obj: any, key: string): any { return obj?.[key]; }

  protected icon(key: string, size = 14, viewBox = '0 0 24 24'): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      `<svg viewBox="${viewBox}" fill="none" width="${size}" height="${size}">${SVG[key]}</svg>`
    );
  }

  protected updateKpiField(field: keyof KpiFormData, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.svc.kpiForm.update(f => ({ ...f, [field]: value }));
  }

  protected updateFinancialField(field: keyof FinancialFormData, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.svc.financialForm.update(f => ({ ...f, [field]: value }));
  }

  protected updatePreflightField(field: keyof PreflightFormData, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.svc.preflightForm.update(f => ({ ...f, [field]: value }));
  }

  protected onDeleteKpi(metricrowId: number): void {
    this.svc.h.deleteKpi(metricrowId);
  }
}

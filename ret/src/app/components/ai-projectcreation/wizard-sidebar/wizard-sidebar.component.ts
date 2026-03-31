import { Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ProjectWizardService } from '../../../services/project-wizard.service';

const SVG: Record<string, string> = {
  chevronRight: '<path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

type SumRow = { key: string; val: string; reset?: string };

@Component({
  selector: 'wizard-sidebar',
  standalone: true,
  templateUrl: './wizard-sidebar.component.html',
  styleUrl: './wizard-sidebar.component.scss',
})
export class WizardSidebarComponent {
  protected readonly svc = inject(ProjectWizardService);
  private readonly sanitizer = inject(DomSanitizer);

  protected icon(key: string, size = 14): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      `<svg viewBox="0 0 24 24" fill="none" width="${size}" height="${size}">${SVG[key]}</svg>`
    );
  }

  protected toggleSidebar(): void {
    this.svc.sidebarCollapsed.update(v => !v);
  }

  protected readonly basicInfoRows = computed(() => {
    const s = this.svc.summary(), rows: SumRow[] = [];
    const add = (k: string, v: string | null | undefined, r?: string) => { if (v) rows.push({ key: k, val: v, reset: r }); };
    add('Cluster', s.clusterName, 'cluster'); add('Country', s.clusterCountryName, 'country');
    add('Company', s.companyName, 'company'); add('Client', s.clientName, 'client');
    add('LOB', s.lobName, 'lob'); add('Industry', s.industryName); add('Language', s.languageName);
    if (s.isSecondary) rows.push({ key: 'Type', val: 'Secondary' });
    if (s.primaryProjectName) rows.push({ key: 'Primary', val: s.primaryProjectName, reset: 'primary_project' });
    return rows;
  });

  protected readonly detailRows = computed(() => {
    const s = this.svc.summary(), rows: SumRow[] = [];
    const add = (k: string, v: string | null | undefined) => { if (v) rows.push({ key: k, val: v }); };
    add('Transform.', s.transformationTypeName); add('Sub-Type', s.transformationTypeFirstLevelName);
    add('Level 3', s.transformationTypeSecondLevelName); add('Level 4', s.transformationTypeThirdLevelName);
    add('Objective', s.objectiveName); add('Nature', s.natureName);
    add('Group Class.', s.groupClassificationName); add('Ext. Product', s.externalProductValue);
    add('Project', s.projectName); add('Lead', s.projectLeadName);
    add('Sponsor', s.projectSponsorName); add('Reg. Approver', s.regionalApproverName);
    add('Trans. Status', s.transformationStatusName); add('DMAIC', s.dmaicProjectStatusName);
    add('Project Status', s.projectStatusName); add('Urgency', s.urgencyName);
    add('Strategic Val.', s.strategicValueName);
    return rows;
  });

  protected readonly financialRows = computed(() => {
    const s = this.svc.summary(), rows: SumRow[] = [];
    const add = (k: string, v: string | null | undefined) => { if (v) rows.push({ key: k, val: v }); };
    add('Exp. Revenue', s.expectedRevenue); add('Int. Benefit', s.expectedInternalBenefit);
    add('Client Benefit', s.expectedClientBenefit); add('Est. Cost', s.estimatedProjectCost);
    add('Actual Cost', s.actualProjectCost); add('Recur. Revenue', s.recurrentRevenue);
    add('Add. Investment', s.additionalInvestment); add('Realised Benefit', s.realisedBenefit);
    add('Realised Revenue', s.realisedRevenue); add('Internal Benefit', s.internalBenefit);
    add('Client Benefit (R)', s.clientBenefit); add('Currency', s.currency);
    return rows;
  });
}

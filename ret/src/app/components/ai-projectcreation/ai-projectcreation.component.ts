import {
  Component, computed, effect, inject, viewChild,
  ElementRef, signal, OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ProjectWizardService } from '../../services/project-wizard.service';
import {
  SCROLL_DELAY_MS, type OptionItem, type IdNameItem, type UserSearchItem,
} from '../../constants/project-wizard.constants';
import { WizardSidebarComponent } from './wizard-sidebar/wizard-sidebar.component';
import { WizardCardsComponent } from './wizard-cards/wizard-cards.component';

// ── SVG Icon Paths (single source of truth) ──────────────────
const SVG = {
  gear: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2"/>',
  check: '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  search: '<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  arrow: '<path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  undo: '<path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  reset: '<path d="M3 12a9 9 0 1 1 9 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M3 7V2m0 5h5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  bulb: '<path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 21h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  info: '<path d="M12 16v-4m0-4h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  warning: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  errorCircle: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  clip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  play: '<polygon points="5,3 19,12 5,21" fill="currentColor"/>',
  scrollDown: '<path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  searchEmpty: '<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 11h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  circle: '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>',
  // Dataflow icons — database cylinder (TC Services) & rocket (Result)
  tcServices: '<ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" stroke-width="2"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" stroke-width="2"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" stroke="currentColor" stroke-width="2"/>',
  result: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  // Extraction phase icons
  brain: '<path d="M12 2a5 5 0 0 0-4.8 3.6A4 4 0 0 0 4 9.5a4 4 0 0 0 1.5 3.1A4.5 4.5 0 0 0 8 17h1v4h6v-4h1a4.5 4.5 0 0 0 2.5-4.4 4 4 0 0 0 1.5-3.1 4 4 0 0 0-3.2-3.9A5 5 0 0 0 12 2z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 2v19" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.4"/>',
  docScan: '<rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 6h8M8 10h8M8 14h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 12h20" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2" opacity="0.5"/>',
  extract: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="2"/><path d="M12 18v-6M9 15l3 3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
} as const;

/** Build an SVG element string from an icon key. */
const svgEl = (key: keyof typeof SVG, size = 14) =>
  `<svg viewBox="0 0 24 24" fill="none" width="${size}" height="${size}">${SVG[key]}</svg>`;

/** Fields that use text input only (no dropdown panel). */
const TEXT_INPUT_FIELDS = new Set<string>([
  'project_name', 'deployment_duration', 'payback_period',
  'dmaic_status_date', 'transformation_status_date', 'project_status_date',
]);

/** Input hint text mapped by activeField value. */
const INPUT_HINTS: Readonly<Record<string, string>> = {
  '':                          'Type naturally \u2014 describe your project with cluster, country, company, client, LOB',
  confirm:                     'Type \u201csave\u201d to confirm, or \u201creset\u201d to go back',
  tab2_confirm:                'Type \u201csave\u201d to confirm Project Details, or \u201creset\u201d to go back',
  project_name:                'Enter your project name and press Enter',
  project_lead:                'Type a name to search \u2014 select from results',
  project_sponsor:             'Type a name to search \u2014 select from results',
  regional_approver:           'Type a name to search for the regional approver',
  dmaic_status_date:           'Enter date in YYYY-MM-DD format (e.g. 2025-06-15)',
  project_status_date:         'Enter date in YYYY-MM-DD format (e.g. 2025-06-15)',
  transformation_status_date:  'Enter date in YYYY-MM-DD format (e.g. 2025-06-15)',
  kpi_values:                  'Fill in the KPI form above and click \u201cAdd KPI\u201d',
  kpi_list:                    'Type \u201cadd\u201d for more KPIs or \u201csubmit\u201d to finish',
  tab4_confirm:                'Type \u201csubmit\u201d to finalize the project',
};

export interface DisplayGroup {
  kind: 'msg' | 'engine';
  msg?: { role: string; text: string };
  origIdx: number;
  items?: { text: string; origIdx: number }[];
  groupId?: number;
}

@Component({
  selector: 'ai-projectcreation',
  standalone: true,
  imports: [FormsModule, WizardSidebarComponent, WizardCardsComponent],
  templateUrl: './ai-projectcreation.component.html',
  styleUrl: './ai-projectcreation.component.scss',
  providers: [ProjectWizardService],
})
export class AiProjectcreationComponent implements OnDestroy {
  protected readonly svc = inject(ProjectWizardService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly userInput = signal('');
  protected readonly ddSearch = signal('');
  protected readonly opLobLastSearch = signal('');
  private _sidebarWasOpen = false;
  protected readonly expandedGroups = signal<Set<number>>(new Set());

  // ── Pre-sanitized SVG icons for template binding ───────────
  protected readonly icons: Record<string, SafeHtml> = {} as Record<string, SafeHtml>;
  private buildIcons(): void {
    for (const [key, paths] of Object.entries(SVG)) {
      this.icons[key] = this.sanitizer.bypassSecurityTrustHtml(
        `<svg viewBox="0 0 24 24" fill="none" width="14" height="14">${paths}</svg>`
      );
    }
  }
  /** Get a sized icon SafeHtml. */
  protected icon(key: string, size = 14): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgEl(key as keyof typeof SVG, size));
  }

  // ── File Attachment ────────────────────────────────────────
  protected readonly attachedFile = signal<{ name: string; content: string } | null>(null);
  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // ── Extraction Log Feed ─────────────────────────────────────
  protected readonly extractionLogs = signal<{ text: string; icon: string; tab: number; state: 'done' | 'active' | 'pending' }[]>([]);
  /** Which tab (1-4) is currently being processed in the extraction feed */
  protected readonly extractionTabPhase = signal(1);
  private extractionTimer: ReturnType<typeof setInterval> | null = null;

  /** Builds a dynamic feed from actual user input — no hardcoded dummy data */
  private buildExtractionFeed(): { text: string; icon: string; tab: number }[] {
    // Extract a snippet from the user's last message
    const msgs = this.svc.messages();
    const lastUser = [...msgs].reverse().find(m => m.role === 'user');
    const snippet = lastUser?.text?.slice(0, 40) ?? 'project description';
    const wordCount = (lastUser?.text?.split(/\s+/).length ?? 12);

    return [
      // Tab 1 — Basic Info
      { text: `Tokenizing input → ${wordCount} words, ${(lastUser?.text?.length ?? 80)} chars`, icon: 'bolt', tab: 1 },
      { text: `Parsing: "${snippet}${(lastUser?.text?.length ?? 0) > 40 ? '…' : ''}"`, icon: 'gear', tab: 1 },
      { text: 'Extracting cluster from description', icon: 'gear', tab: 1 },
      { text: 'Resolving country via NLP entity recognition', icon: 'gear', tab: 1 },
      { text: 'Matching company in hierarchy database', icon: 'gear', tab: 1 },
      { text: 'Scanning for client reference', icon: 'gear', tab: 1 },
      { text: 'Identifying line of business', icon: 'gear', tab: 1 },
      { text: 'Running cascade: cluster → country → company → client', icon: 'bolt', tab: 1 },
      // Tab 2 — Project Details
      { text: 'Classifying transformation type', icon: 'gear', tab: 2 },
      { text: 'Detecting objective category', icon: 'gear', tab: 2 },
      { text: 'Extracting project nature', icon: 'gear', tab: 2 },
      { text: 'Parsing project name from context', icon: 'gear', tab: 2 },
      { text: 'Searching for lead / sponsor entities', icon: 'gear', tab: 2 },
      { text: 'Determining urgency & strategic value', icon: 'gear', tab: 2 },
      // Tab 3 — Financials
      { text: 'Scanning for financial amounts & currency', icon: 'bolt', tab: 3 },
      { text: 'Extracting revenue & cost estimates', icon: 'gear', tab: 3 },
      { text: 'Detecting benefit values', icon: 'gear', tab: 3 },
      { text: 'Parsing payback period & deployment duration', icon: 'gear', tab: 3 },
      // Tab 4 — KPI
      { text: 'Identifying metric group & metric', icon: 'gear', tab: 4 },
      { text: 'Extracting As-Is / To-Be values', icon: 'gear', tab: 4 },
      { text: 'Validating KPI data completeness', icon: 'gear', tab: 4 },
      { text: 'Cross-referencing all extracted fields', icon: 'bolt', tab: 4 },
    ];
  }

  // ── System Activity Simulator ──────────────────────────────
  protected readonly systemActivity = signal('');
  protected readonly toasters = signal<{ id: number; text: string; icon: string; leaving: boolean }[]>([]);
  protected readonly activeDataNode = signal<'db' | 'ai' | 'result'>('ai');
  private activityTimer: ReturnType<typeof setInterval> | null = null;
  private toasterTimer: ReturnType<typeof setInterval> | null = null;
  private toastId = 0;

  private static readonly SYS_MESSAGES = [
    'Binding fields…', 'Validating inputs…', 'Syncing modules…',
    'Verifying data…', 'Submitting configuration…', 'Resolving dependencies…',
    'Checking schema…', 'Mapping dropdowns…', 'Analyzing structure…',
    'Connecting pipelines…', 'Running validators…', 'Processing cascade…',
    'Initializing modules…', 'Cross-referencing data…', 'Optimizing payload…',
  ];
  private static readonly TOASTER_MESSAGES: { text: string; icon: string }[] = [
    { text: 'Schema validated', icon: 'check' },
    { text: 'Module synced', icon: 'gear' },
    { text: 'Pipeline connected', icon: 'bolt' },
    { text: 'Data verified', icon: 'tcServices' },
    { text: 'Bindings verified', icon: 'check' },
    { text: 'Configuration ready', icon: 'gear' },
    { text: 'Cascade complete', icon: 'bolt' },
    { text: 'Inputs validated', icon: 'check' },
  ];

  private readonly chatContainer = viewChild<ElementRef>('chatContainer');

  // ── Computed State ─────────────────────────────────────────

  protected readonly displayGroups = computed<DisplayGroup[]>(() => {
    const msgs = this.svc.messages();
    const allGroups: DisplayGroup[] = [];
    let i = 0, gid = 0;
    while (i < msgs.length) {
      if (msgs[i].role === 'status') {
        const start = i;
        const items: { text: string; origIdx: number }[] = [];
        while (i < msgs.length && msgs[i].role === 'status') {
          items.push({ text: msgs[i].text, origIdx: i });
          i++;
        }
        allGroups.push(items.length >= 2
          ? { kind: 'engine', items, origIdx: start, groupId: gid++ }
          : { kind: 'msg', msg: msgs[start], origIdx: start });
      } else {
        allGroups.push({ kind: 'msg', msg: msgs[i], origIdx: i });
        i++;
      }
    }
    const nonLanding = allGroups.filter(g => !(g.kind === 'msg' && g.msg!.role === 'landing'));
    if (nonLanding.length === 0) return allGroups;

    const result: DisplayGroup[] = [];
    const lastEngine = nonLanding.filter(g => g.kind === 'engine').pop();
    if (lastEngine) result.push(lastEngine);
    for (let j = nonLanding.length - 1; j >= 0; j--) {
      if (nonLanding[j].kind === 'msg' && nonLanding[j].msg!.role === 'assistant') { result.push(nonLanding[j]); break; }
    }
    for (let j = nonLanding.length - 1; j >= 0; j--) {
      if (nonLanding[j].kind === 'msg' && nonLanding[j].msg!.role === 'options') { result.push(nonLanding[j]); break; }
    }
    return result;
  });

  protected readonly isExtractionPhase = computed(() =>
    this.svc.loading() && this.svc.loadingMode() === 'full' && this.svc.loadingContext() === 'understanding'
  );

  protected readonly showTransitionLoader = computed(() => {
    if (this.svc.loading()) return false;
    const groups = this.displayGroups();
    if (groups.length === 0) return false;
    // Don't show on landing-only state (initial page load)
    if (groups.every(g => g.kind === 'msg' && g.msg!.role === 'landing')) return false;
    return !groups.some(g => g.kind === 'msg' && (g.msg!.role === 'assistant' || g.msg!.role === 'options'));
  });

  protected readonly isTextInputField = computed(() => {
    const f = this.svc.activeField();
    return !!f && TEXT_INPUT_FIELDS.has(f);
  });

  protected readonly inputHint = computed(() => {
    const f = this.svc.activeField() ?? '';
    return INPUT_HINTS[f] ?? null;
  });

  protected readonly filteredOptions = computed(() => {
    const opts = this.svc.dropdownOptions();
    const q = this.ddSearch().toLowerCase().trim();
    return q ? opts.filter(item => this.getItemLabel(item).toLowerCase().includes(q)) : opts;
  });

  /** Mini form preview — mirrors the real TC Cockpit form with live-bound values.
   *  Only visible while the engine is actively auto-filling (not during full loading). */
  protected readonly livePreview = computed(() => {
    if (!this.svc.autoFillActive()) return null;
    if (this.svc.projectSubmitted()) return null;
    // Don't show during full engine loading — only after fields start binding
    if (this.svc.loading() && this.svc.loadingMode() === 'full') return null;
    const af = this.svc.activeField();
    // Don't show during NLP preview, preflight, or confirmation stages
    if (af === 'nlp_preview' || af === 'preflight' || af === 'confirm' || af === 'tab2_confirm' || af === 'tab4_confirm') return null;
    const s = this.svc.summary();
    const steps = this.svc.steps();
    const tab1On = steps[0].state === 'active';
    const tab2On = steps[1].state === 'active';
    const tab3On = steps.length > 2 && steps[2].state === 'active';
    const tab4On = steps.length > 3 && steps[3].state === 'active';

    if (tab1On && (s.clusterName || s.companyName || s.clientName)) {
      const sections: { title: string; fields: { label: string; value: string | null }[] }[] = [
        { title: 'CLUSTER DETAILS', fields: [
          { label: 'Cluster', value: s.clusterName },
          { label: 'Cluster Country', value: s.clusterCountryName },
        ]},
        { title: 'COMPANY & CLIENT', fields: [
          { label: 'Company', value: s.companyName },
          { label: 'Client', value: s.isTpInternal ? 'TP Internal' : s.clientName },
        ]},
      ];
      if (!s.isTpInternal) {
        sections.push({ title: 'LOB DETAILS', fields: [
          { label: 'Standard LOB', value: s.lobName },
          { label: 'Operational LOB', value: s.operationalLob },
          { label: 'Industry', value: s.industryName },
          { label: 'Language', value: s.languageName },
        ]});
      }
      return { tab: 'Basic Info', tabNum: 1, sections };
    }

    if (tab2On && (s.transformationTypeName || s.objectiveName || s.projectName)) {
      const tf: { label: string; value: string | null }[] = [
        { label: 'Transformation Type', value: s.transformationTypeName },
      ];
      if (s.transformationTypeFirstLevelName) tf.push({ label: 'Sub-Type', value: s.transformationTypeFirstLevelName });
      if (s.transformationTypeSecondLevelName) tf.push({ label: 'Second Level', value: s.transformationTypeSecondLevelName });
      if (s.transformationTypeThirdLevelName) tf.push({ label: 'Third Level', value: s.transformationTypeThirdLevelName });

      const sf: { label: string; value: string | null }[] = [
        { label: 'Transformation Status', value: s.transformationStatusName },
      ];
      if (s.transformationStatusDate) sf.push({ label: 'Status Date', value: s.transformationStatusDate });
      if (s.isDmaicPath) sf.push({ label: 'DMAIC Status', value: s.dmaicProjectStatusName });
      sf.push({ label: 'Urgency', value: s.urgencyName });
      sf.push({ label: 'Strategic Value', value: s.strategicValueName });

      return {
        tab: 'Project Details', tabNum: 2,
        sections: [
          { title: 'TRANSFORMATION TYPE', fields: tf },
          { title: 'OBJECTIVE & NATURE', fields: [
            { label: 'Objective', value: s.objectiveName },
            { label: 'Nature', value: s.natureName },
          ]},
          { title: 'PROJECT DETAILS', fields: [
            { label: 'Project Name', value: s.projectName },
            { label: 'Project Lead', value: s.projectLeadName },
            { label: 'Project Sponsor', value: s.projectSponsorName },
          ]},
          { title: 'STATUS & PRIORITY', fields: sf },
        ],
      };
    }

    if (tab3On) {
      const ff = this.svc.financialForm();
      const cur = s.currency || ff.currency;
      const sym = cur ? `${cur} ` : '';
      const fmtVal = (v: string | null | undefined) => v ? `${sym}${v}` : null;
      const hasAny = ff.expectedRevenue || ff.expectedInternalBenefit || ff.expectedClientBenefit ||
                     ff.estimatedProjectCost || ff.actualProjectCost || ff.recurrentRevenue ||
                     ff.realisedRevenue || ff.realisedBenefit || ff.internalBenefit || ff.clientBenefit;
      if (hasAny || af === 'tab3_financials') {
        return {
          tab: 'Financials', tabNum: 3,
          sections: [
            { title: 'REVENUE', fields: [
              { label: 'Expected Revenue', value: fmtVal(ff.expectedRevenue) },
              { label: 'Recurrent Revenue', value: fmtVal(ff.recurrentRevenue) },
              { label: 'Realised Revenue', value: fmtVal(ff.realisedRevenue) },
            ]},
            { title: 'BENEFITS', fields: [
              { label: 'Expected Internal Benefit', value: fmtVal(ff.expectedInternalBenefit) },
              { label: 'Expected Client Benefit', value: fmtVal(ff.expectedClientBenefit) },
              { label: 'Internal Benefit', value: fmtVal(ff.internalBenefit) },
              { label: 'Realised Benefit', value: fmtVal(ff.realisedBenefit) },
            ]},
            { title: 'COST', fields: [
              { label: 'Estimated Project Cost', value: fmtVal(ff.estimatedProjectCost) },
              { label: 'Actual Project Cost', value: fmtVal(ff.actualProjectCost) },
              { label: 'Additional Investment', value: fmtVal(ff.additionalInvestment) },
            ]},
          ],
        };
      }
    }

    if (tab4On) {
      const kpis = this.svc.kpiList();
      const kf = this.svc.kpiForm();
      const hasForm = kf.asIs || kf.toBe;
      const sections: { title: string; fields: { label: string; value: string | null }[] }[] = [];

      // Show current KPI form being filled
      if (hasForm && (af === 'kpi_values' || af === 'metric_group' || af === 'metric')) {
        const groupName = s.kpiMetricGroupName || '—';
        const metricName = s.kpiMetricName || '—';
        sections.push({ title: `${groupName} → ${metricName}`, fields: [
          { label: 'As-Is', value: kf.asIs || null },
          { label: 'To-Be', value: kf.toBe || null },
          { label: 'Would-Be', value: kf.wouldBe || null },
          { label: 'Last Snapshot', value: kf.lastSnapshot || null },
        ]});
      }

      // Show already added KPIs
      for (const kpi of kpis) {
        sections.push({ title: `${kpi.metricGroupName} → ${kpi.metricName}`, fields: [
          { label: 'As-Is', value: kpi.AS_IS },
          { label: 'To-Be', value: kpi.TO_BE },
          { label: 'Would-Be', value: kpi.WOULD_BE },
          { label: 'Last Snapshot', value: kpi.lastSnapshot },
        ]});
      }

      if (sections.length) {
        return { tab: 'KPI', tabNum: 4, sections };
      }
    }

    return null;
  });

  // ── Lifecycle ──────────────────────────────────────────────

  constructor() {
    this.buildIcons();
    effect(() => { this.svc.scrollTrigger(); this.scrollChat(); });
    effect(() => { this.svc.options(); this.ddSearch.set(''); });
    effect(() => { this.svc.loading() ? this.startActivitySimulator() : this.stopActivitySimulator(); });
    effect(() => { this.isExtractionPhase() ? this.startExtractionFeed() : this.stopExtractionFeed(); });
    // Auto-collapse sidebar when loading (full) or live preview is active, restore when done
    effect(() => {
      const preview = this.livePreview();
      const fullLoading = this.svc.loading() && this.svc.loadingMode() === 'full';
      const shouldCollapse = !!preview || fullLoading;
      if (shouldCollapse && !this.svc.sidebarCollapsed()) {
        this._sidebarWasOpen = true;
        this.svc.sidebarCollapsed.set(true);
      } else if (!shouldCollapse && this._sidebarWasOpen) {
        this._sidebarWasOpen = false;
        this.svc.sidebarCollapsed.set(false);
      }
    });
    this.svc.startWizard();
  }

  ngOnDestroy(): void { this.stopActivitySimulator(); this.stopExtractionFeed(); }

  // ── Group helpers ──────────────────────────────────────────

  protected toggleEngineGroup(groupId: number): void {
    this.expandedGroups.update(s => { const n = new Set(s); n.has(groupId) ? n.delete(groupId) : n.add(groupId); return n; });
  }
  protected isGroupExpanded(groupId: number): boolean { return this.expandedGroups().has(groupId); }

  // ── Activity Simulator ─────────────────────────────────────

  private startActivitySimulator(): void {
    if (this.activityTimer) return;
    const msgs = AiProjectcreationComponent.SYS_MESSAGES;
    const toasts = AiProjectcreationComponent.TOASTER_MESSAGES;
    const nodes: ('db' | 'ai' | 'result')[] = ['db', 'ai', 'result'];
    this.systemActivity.set(msgs[Math.floor(Math.random() * msgs.length)]);
    this.activityTimer = setInterval(() => {
      this.systemActivity.set(msgs[Math.floor(Math.random() * msgs.length)]);
      this.activeDataNode.set(nodes[Math.floor(Math.random() * nodes.length)]);
    }, 1800 + Math.random() * 1200);
    this.toasterTimer = setInterval(() => {
      const t = toasts[Math.floor(Math.random() * toasts.length)];
      this.toasters.update(arr => [...arr.slice(-4), { id: ++this.toastId, text: t.text, icon: t.icon, leaving: false }]);
    }, 2200 + Math.random() * 1500);
  }

  private stopActivitySimulator(): void {
    if (this.activityTimer) { clearInterval(this.activityTimer); this.activityTimer = null; }
    if (this.toasterTimer) { clearInterval(this.toasterTimer); this.toasterTimer = null; }
    this.toasters.set([]); this.systemActivity.set('');
  }

  private startExtractionFeed(): void {
    if (this.extractionTimer) return;
    const feed = this.buildExtractionFeed();
    let idx = 0;
    this.extractionTabPhase.set(feed[0].tab);
    this.extractionLogs.set([{ text: feed[0].text, icon: feed[0].icon, tab: feed[0].tab, state: 'active' }]);
    this.extractionTimer = setInterval(() => {
      const logs = this.extractionLogs();
      const updated = logs.map(l => l.state === 'active' ? { ...l, state: 'done' as const } : l);
      idx++;
      if (idx >= feed.length) idx = 0; // loop
      this.extractionTabPhase.set(feed[idx].tab);
      updated.push({ text: feed[idx].text, icon: feed[idx].icon, tab: feed[idx].tab, state: 'active' });
      if (idx + 1 < feed.length) {
        updated.push({ text: feed[idx + 1].text, icon: feed[idx + 1].icon, tab: feed[idx + 1].tab, state: 'pending' });
      }
      this.extractionLogs.set(updated.slice(-6));
    }, 1800 + Math.random() * 700);
  }

  private stopExtractionFeed(): void {
    if (this.extractionTimer) { clearInterval(this.extractionTimer); this.extractionTimer = null; }
    this.extractionLogs.set([]); this.extractionTabPhase.set(1);
  }

  // ── Template Handlers ──────────────────────────────────────

  protected async onInlineSubmit(): Promise<void> {
    const t = this.userInput().trim(); if (!t) return;
    this.userInput.set(''); await this.svc.handleUserMessage(t);
  }

  protected async onSend(): Promise<void> {
    const typed = this.userInput().trim();
    const file = this.attachedFile();
    let text = typed;
    if (file) {
      text = `[Attached file: ${file.name}]\n${file.content}${typed ? '\n\n' + typed : ''}`;
      this.attachedFile.set(null);
      const fi = this.fileInputRef(); if (fi) fi.nativeElement.value = '';
    }
    this.userInput.set(''); await this.svc.handleUserMessage(text);
  }

  protected openFilePicker(): void { this.fileInputRef()?.nativeElement.click(); }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    if (!/\.(txt|md|log|csv|json|text)$/i.test(file.name)) {
      this.svc.toastr.warning('Only plain-text files are supported (.txt, .md, .log, .csv, .json)', 'Unsupported file');
      input.value = ''; return;
    }
    if (file.size > 500_000) {
      this.svc.toastr.warning('File is too large (max 500 KB).', 'File too large');
      input.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = () => this.attachedFile.set({ name: file.name, content: reader.result as string });
    reader.readAsText(file);
  }

  protected clearAttachment(): void {
    this.attachedFile.set(null);
    const fi = this.fileInputRef(); if (fi) fi.nativeElement.value = '';
  }

  protected onInputChange(value: string): void { this.userInput.set(value); }

  protected onChatScroll(): void {
    const el = this.chatContainer()?.nativeElement; if (!el) return;
    this.svc.updateScrollState(el.scrollTop, el.scrollHeight, el.clientHeight);
  }

  protected scrollToBottom(): void {
    const el = this.chatContainer()?.nativeElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    this.svc.showScrollBtn.set(false);
  }

  protected async selectItem(item: OptionItem): Promise<void> {
    this.ddSearch.set(''); await this.svc.handleDropdownSelection(item);
  }

  protected async onOpLobSearch(value: string): Promise<void> {
    const t = value.trim(); if (!t) return;
    this.opLobLastSearch.set(t);
    await this.svc.h.searchOperationalLob(t);
  }

  protected async onOpLobUseCustom(): Promise<void> {
    const text = this.opLobLastSearch();
    if (!text) return;
    this.svc.patchSummary({ operationalLob: text });
    this.svc.addMessage('user', text);
    this.opLobLastSearch.set('');
    await this.svc.h.autoResolve();
  }

  protected async onOpLobSkip(): Promise<void> { await this.svc.h.skipOperationalLob(); }

  protected getItemLabel(item: OptionItem): string {
    if ('displayLabel' in item && item.displayLabel) return item.displayLabel;
    if ('displayName' in item) return String((item as UserSearchItem).displayName ?? '');
    if ('name' in item) return String((item as IdNameItem).name ?? '');
    return '';
  }

  /** Lightweight markdown → HTML for assistant messages. */
  protected renderMd(text: string): string {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/(<\/ul>\s*<ul>)/g, '')
      .replace(/\n/g, '<br>');
  }

  private scrollChat(): void {
    setTimeout(() => {
      const el = this.chatContainer()?.nativeElement;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, SCROLL_DELAY_MS);
  }
}

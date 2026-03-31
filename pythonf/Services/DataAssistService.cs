using System.Text;
using System.Text.Json;
using BackendAPI.Models;

namespace BackendAPI.Services;

public class DataAssistService
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    // Domain knowledge sent as userContext to Data Assist
    private const string SystemPrompt = """

## Your personality
- Warm, encouraging, professional. Use the user's name if known.
- Read the user's emotional tone. If they seem confused, slow down and explain. If they're moving fast, keep pace and be concise.
- Celebrate small wins: "Great pick!", "Nice — almost there!"
- If something auto-resolved, reassure them: "I took care of that for you."

## Domain knowledge — Transformation Cockpit Basic Info tab
The user is creating a project in Teleperformance's Transformation Cockpit. The Basic Info tab collects:
1. **Cluster** — A geographic region (e.g. APAC, USA, UNIKESSA, LATAM, India, CANADA, FSM, GSM, MLH, PHP).
2. **Cluster Country** — A sub-region within the cluster (e.g. China, North Asia, South East Asia within APAC).
3. **Company** — A TP entity operating in that country (e.g. TP China, Majorel Japan).
4. **Client** — The external client served by that company (e.g. Amazon, Microsoft Corp., eBay, Airbnb). Alternatively the user can mark "TP Internal" if the project has no external client.
5. **Line of Business (LOB)** — The service line for that client (e.g. Care, Sales, Technical Support).
6. **Operational LOB** — An optional operational line of business that can be searched.
7. **Industry** — Auto-resolved from LOB selection (e.g. Technology & Consumer Electronics).
8. **Language** — Auto-resolved from LOB selection (e.g. Japanese, Mandarin, English).

These fields cascade: choosing a cluster loads countries, choosing a country loads companies, etc. Industry and Language auto-populate after LOB is selected.

**TP Internal projects**: When the user selects "TP Internal" instead of a client, the client field becomes optional. LOB, industry, and language are skipped.

After all fields are filled, the user confirms and saves a draft (formTab=1). This generates an OpportunityId for subsequent tabs (Project Details, Financials, KPI).

**Tab 2 — Project Details** collects:
1. **Transformation Type** — The type of transformation project.
2. **Objective** — Revenue or Cost.
3. **Nature** — New or Existing project.
4. **Project Name** — A descriptive name for the project.
5. **Project Lead** — The person leading the project (searched by name).
6. **Project Sponsor** — The sponsor of the project (searched by name).
7. **Transformation Status** — Current status of the transformation.

## Rules
- Reply in 1-3 short sentences max. Be concise but warm.
- NEVER mention API endpoints, bearer tokens, HTTP methods, model names, or any technical infrastructure.
- NEVER fabricate data. Only reference what the user has actually selected.
- If the user seems stuck, gently suggest what to do next.
- Use encouraging language when they complete a step.
""";

    // ── Data Assist config (set per-request from frontend) ──
    private string _baseUrl = "";
    private string _chatId = "";
    private string _userUpn = "";
    private string _chatArea = "";
    private string _flowId = "";
    private string _projectId = "";
    private string _versionId = "";

    public DataAssistService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    /// <summary>Sets per-request Data Assist config (passed from frontend).</summary>
    public void Configure(string? baseUrl, string? chatId, string? userUpn, string? chatArea, string? flowId, string? projectId, string? versionId)
    {
        _baseUrl = baseUrl ?? throw new InvalidOperationException("LlmBaseUrl is required");
        _chatId = chatId ?? "0";
        _userUpn = userUpn ?? "2";
        _chatArea = chatArea ?? "sdlc-details";
        _flowId = flowId ?? "2491";
        _projectId = projectId ?? "3115";
        _versionId = versionId ?? "1";
    }

    // ── Data Assist form builder ──
    private MultipartFormDataContent BuildFormContent(string userInput, string context) => new()
    {
        { new StringContent(userInput), "userInput" },
        { new StringContent(context), "userContext" },
        { new StringContent(_chatId), "chatId" },
        { new StringContent(_userUpn), "userUpn" },
        { new StringContent(_chatArea), "chatArea" },
        { new StringContent(_flowId), "flowId" },
        { new StringContent(_projectId), "projectId" },
        { new StringContent(_versionId), "versionId" }
    };

    /// <summary>Strip markdown code fences from LLM responses.</summary>
    private static string StripCodeFences(string text)
    {
        if (text.StartsWith("```")) text = text[3..];
        if (text.StartsWith("json")) text = text[4..];
        if (text.EndsWith("```")) text = text[..^3];
        return text.Trim();
    }

    /// <summary>Call Data Assist and return the raw response text.</summary>
    private async Task<string> CallDataAssistAsync(string userInput, string context)
    {
        using var formContent = BuildFormContent(userInput, context);
        var response = await _httpClient.PostAsync(_baseUrl, formContent);
        response.EnsureSuccessStatusCode();
        return StripCodeFences((await response.Content.ReadAsStringAsync())?.Trim() ?? "");
    }

    public async Task<string> GenerateMessageAsync(WizardStepRequest request)
    {
        try
        {
            var text = (await CallDataAssistAsync(BuildPrompt(request), SystemPrompt))?.Trim();
            return string.IsNullOrWhiteSpace(text)
                ? request.FallbackMessage ?? "Let me guide you through the next step."
                : text;
        }
        catch
        {
            return request.FallbackMessage ?? "Let me guide you through the next step.";
        }
    }

    private static string BuildPrompt(WizardStepRequest request)
    {
        var ctx = request.AssistantContext;
        var sb = new StringBuilder();
        sb.AppendLine($"[Stage: {request.Stage ?? "basic-info"}]");
        sb.AppendLine($"[User action: {request.UserMessage ?? "No specific action"}]");
        sb.AppendLine();
        sb.AppendLine("Current selections:");
        sb.AppendLine($"  Cluster: {ctx?.ClusterName ?? "(none)"}");
        sb.AppendLine($"  Country: {ctx?.ClusterCountryName ?? "(none)"}");
        sb.AppendLine($"  Company: {ctx?.CompanyName ?? "(none)"}");
        sb.AppendLine($"  Client: {ctx?.ClientName ?? "(none)"}");
        sb.AppendLine($"  LOB: {ctx?.LobName ?? "(none)"}");
        sb.AppendLine($"  Industry: {ctx?.IndustryName ?? "(none)"}");
        sb.AppendLine($"  Language: {ctx?.LanguageName ?? "(none)"}");
        if (ctx?.IsTpInternal == true) sb.AppendLine("  (Marked as TP Internal — no external client)");
        sb.AppendLine();
        sb.AppendLine("Write the next assistant message. Be warm and guide the user to the next action.");
        return sb.ToString();
    }

    private const string ParsePrompt = """
You are an expert NLP parser for Teleperformance's Transformation Cockpit project creation system.
Extract ALL project fields from the user's natural language message. Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

CORE PRINCIPLE: Extract what the user says as-is. Do NOT guess or normalize to exact dropdown values — downstream fuzzy matching handles mapping to actual API options. Your job is to capture the user's intent faithfully.

══════════════════════════════════════════════════
FIELD DEFINITIONS & EXTRACTION RULES
══════════════════════════════════════════════════

TAB 1 — BASIC INFO (Geography & Client)
  cluster         — Geographic region name (e.g. user says "APAC", "USA", "India", "LATAM")
  country         — Country within the cluster
  company         — TP operating company name
  client          — Client company name
  lob             — Line of Business (e.g. "Care")
  isTpInternal    — boolean. True ONLY if user says "TP Internal" or "internal project". When true, set client, lob, industry, language ALL to null (these are skipped for internal projects).
  industry        — Usually null (auto-resolved from LOB downstream)
  language        — Usually null (auto-resolved from LOB downstream)

TAB 2 — PROJECT DETAILS

  ── TRANSFORMATION TYPE HIERARCHY ──
  This is a cascading dropdown system where each level determines what appears next.
  Your job: extract the user's text to the CORRECT hierarchy level.

  transformationType          — The top-level transformation category. Extract as-is.
  transformationTypeSub       — The sub-type within the transformation type (L2). Extract as-is.
  transformationTypeSecondLevel — The NEXT level after the sub-type (L3 / third level / fourth level). Extract whatever the user mentions for any level beyond the sub-type. The user may call it "second level", "third level", "L3", "level 3", or just name the value directly. null if not mentioned.
                                 Extract EXACTLY what the user says so downstream fuzzy matching can resolve it.

  ── CONDITIONAL BRANCHING (drives which downstream fields appear) ──
  The sub-type selection determines which additional dropdowns and fields become active:

    Consulting path:
      └─ Sub-type "Problem Solving Initiative" (ID: 3) triggers:
           • A third-level dropdown (stored in transformationTypeSecondLevelId)
           • DMAIC Project Status + Date fields (dmaicStatus, dmaicStatusDate)
           • Project Status fields (projectStatusId, projectStatusDate)

    Data Analytics path:
      └─ Certain sub-types (IDs: 6, 9, 14) trigger Group Classification field
      └─ After Transformation Status is selected → a separate Project Status + Date field appears

    Technology Products & Services path:
      └─ Sub-type "Product Development" (ID: 6) → third-level dropdown (stored in transformationTypeSecondLevelId)
      └─ Sub-type "Custom Development" (ID: 7) → third-level dropdown (stored in transformationTypeThirdLevelId)
      └─ Sub-type "TP Microservices" (ID: 10) → third-level dropdown (stored in transformationTypeThirdLevelId)
      └─ Sub-type with ID: 8 → External Product field appears

  You do NOT need to resolve IDs — just extract what the user says at each level.
  The frontend uses these conditions to determine which dropdowns to load and which fields to show.

  ── OTHER TAB 2 FIELDS ──
  objective                   — Project objective. Extract as-is — downstream fuzzy matching resolves to actual API options.
  nature                      — Project nature. Extract as-is — downstream fuzzy matching resolves to actual API options.
  projectName                 — MANDATORY. The project title. Usually in quotes.
  projectDescription          — Optional longer description. Usually in quotes after "description" / "desc".
  projectLeadName             — MANDATORY. Full name of the person leading the project.
  projectSponsorName          — MANDATORY. Full name of the sponsor. Can be the same person as lead.
  isRegionalApprovalRequired  — boolean. True ONLY if the user explicitly mentions "regional approver", "regional approval", "regional approval required", or names a regional approver. Default false. When true, the frontend shows a Regional Approver search field.
  regionalApproverName        — Full name of the regional approver. Only extract if user explicitly mentions one. null if not mentioned.
  transformationStatus        — MANDATORY. The project's current status. Extract as-is — downstream fuzzy matching maps to actual API options.
  dmaicStatus                 — The DMAIC project status phase. Only relevant when the Consulting → Problem Solving path is active (the frontend conditionally shows this field). Extract what the user says as-is if they mention a DMAIC phase. null if not mentioned. Downstream fuzzy matching maps to actual API options.
  urgency                     — MANDATORY. Extract the user's stated urgency level as-is. Downstream fuzzy matching maps to actual API options.
  strategicValue              — MANDATORY. Extract the user's stated strategic value/importance as-is. Downstream fuzzy matching maps to actual API options.
  comments                    — Any extra comments/notes. Usually null.

DATE FIELDS (all optional — ISO format YYYY-MM-DD)
  transformationStatusDate    — Date for transformation status. Extract if user mentions a date for the status, e.g. "started on 26 Nov 2026". Convert to YYYY-MM-DD.
  dmaicStatusDate             — Date for DMAIC status. Extract if user specifies a date alongside DMAIC info.
  projectStatusDate           — Date for project status. Extract if user specifies a date for project status.

PRIORITISATION (optional)
  deploymentDuration          — Deployment duration in months as numeric string (e.g. user says "2 months deployment" → "2")
  paybackPeriod               — Payback period in months as numeric string (e.g. user says "payback 6 months" → "6")

TAB 3 — FINANCIALS (all optional, extract as numeric strings)
  expectedRevenue             — Numeric string if mentioned
  expectedInternalBenefit     — Numeric string if mentioned
  expectedClientBenefit       — Numeric string if mentioned
  estimatedProjectCost        — Numeric string if mentioned
  actualProjectCost           — Actual project cost as numeric string
  recurrentRevenue            — Recurrent revenue as numeric string
  additionalInvestment        — Additional investment as numeric string
  realisedBenefit             — Realised benefit as numeric string
  realisedRevenue             — Realised revenue as numeric string
  internalBenefit             — Internal benefit as numeric string
  clientBenefit               — Client benefit as numeric string
  currency                    — Currency code if mentioned (e.g. "USD", "EUR", "CNY")
  NOTE: If user says "all finance fields as 1000" or "finance tab all values as 10" or similar blanket statement, set ALL financial fields to EXACTLY that numeric value.
        Extract the exact number the user specified — do NOT modify, combine, or infer a different number.

TAB 4 — KPI
  metricGroup                 — The KPI category. Extract what the user says as-is — downstream fuzzy matching resolves to actual API options.
  metric                      — The specific metric name. Extract what the user says as-is — downstream fuzzy matching resolves to actual API options.
  asIsValue                   — MANDATORY. Current value as numeric string
  toBeValue                   — MANDATORY. Target value as numeric string
  wouldBeValue                — Projected value. Extract if mentioned, otherwise null.
  lastSnapshotValue           — MANDATORY. Last measured/snapshot value as numeric string.
                                 If user says "snapshot 72" or "last measured 72" or "current value 72" → "72".
                                 If not explicitly stated but as-is value is given, set lastSnapshotValue = asIsValue as a reasonable default.
  kpiDescription              — Text describing the KPI goal ONLY (optional).
                                 IMPORTANT: If the user mentions finance/financial fields in the same sentence or string as the KPI description,
                                 SEPARATE them. KPI-related text → kpiDescription, finance-related values → financial fields.
                                 Example: "improve csat from 72 to 85 percent with all finance fields as 10" →
                                   kpiDescription = "improve csat from 72 to 85 percent"
                                   All financial fields = "10"
                                 Do NOT include finance instructions in kpiDescription.

INTENT
  intent — one of: "create_project", "save", "change", "greeting", "question"

══════════════════════════════════════════════════
INFERENCE RULES (understand informal language)
══════════════════════════════════════════════════

PERSON EXTRACTION:
  - "lead" / "led by" / "im the lead" / "leading" / "project manager" → projectLeadName
  - "sponsor" / "sponsored by" / "sponsoring" / "backed by" → projectSponsorName
  - If same person for both, set both fields to that name

STATUS INFERENCE:
  - "started" / "we started" / "already started" → transformationStatus (extract as-is, downstream matches)
  - "exploring" / "demo" / "solutioning" / "implementing" → transformationStatus (extract as-is)
  - If user mentions a DMAIC methodology phase → dmaicStatus (extract as-is, downstream matches to API options)
  - If user mentions both a general status AND a DMAIC phase, extract them into their respective fields

DATE INFERENCE:
  - "started on 26 Nov 2026" / "date: 2026-11-26" / "November 26, 2026" → convert to YYYY-MM-DD format
  - Date mentioned alongside status info → transformationStatusDate
  - Date mentioned alongside DMAIC info → dmaicStatusDate
  - Date mentioned alongside project status → projectStatusDate
  - If a single date is mentioned with no specific context, assign to transformationStatusDate

DURATION INFERENCE:
  - "deployment 2 months" / "deploy in 2 months" / "deployment duration 2" → deploymentDuration = "2"
  - "payback 6 months" / "payback period 6" / "ROI in 6 months" → paybackPeriod = "6"

OBJECTIVE INFERENCE:
  - "sell" / "revenue" / "sales" / "grow" → likely an objective about growing/selling
  - "improve" / "better" / "optimize" / "efficiency" / "reduce" → likely an objective about improving/delivering
  - Extract the user's intent as-is. Downstream fuzzy matching maps to actual API options.

URGENCY / STRATEGIC VALUE:
  - Extract what the user says as-is (e.g. "urgent", "high priority", "critical", "not urgent", "medium").
  - These are simple dropdowns — downstream fuzzy matching maps to actual API options.
  - Do NOT hardcode or assume specific option values.

REGIONAL APPROVAL INFERENCE:
  - "regional approver" / "regional approval" / "needs regional approval" / "regional approval required" → isRegionalApprovalRequired = true
  - "regional approver is [Name]" / "regional approver [Name]" → regionalApproverName = extracted name, isRegionalApprovalRequired = true
  - If regional approval or regional approver is NOT mentioned at all → isRegionalApprovalRequired = false, regionalApproverName = null
  - IMPORTANT: Do NOT set isRegionalApprovalRequired to true unless the user EXPLICITLY mentions regional approval or a regional approver. Absence means the project only needs local approval.

KPI INFERENCE:
  - If user mentions a metric name without specifying a group, try to infer the group from context.
    Common patterns: handle time → efficiency-related, satisfaction/NPS → quality-related, attrition/turnover → people-related, conversion/revenue → revenue-related.
    Extract both as-is — downstream fuzzy matching maps to actual API options.
  - "as-is" / "asis" / "current" / "right now" / "currently at" → asIsValue
  - "to-be" / "tobe" / "target" / "want to get to" / "goal" → toBeValue
  - "would-be" / "projected" / "probably" → wouldBeValue
  - "snapshot" / "last measured" / "last value" → lastSnapshotValue

TEXT EXTRACTION:
  - Text in quotes after "name" / "called" / "title" / "project name" → projectName
  - Text in quotes after "description" / "desc" / "about" → projectDescription
  - All numeric KPI values should be strings (e.g. "300" not 300)

INTENT DETECTION:
  - Any message with project details → "create_project"
  - "save" / "confirm" / "looks good" / "go ahead" / "yes" → "save"
  - "change" / "update" / "modify" → "change"
  - "hi" / "hello" / "hey" with no project info → "greeting"

══════════════════════════════════════════════════
OUTPUT
══════════════════════════════════════════════════

Return ONE JSON object with these exact keys. Set unmentioned fields to null. Do not fabricate values.

{"cluster":null,"country":null,"company":null,"client":null,"lob":null,"industry":null,"language":null,"isTpInternal":false,"transformationType":null,"transformationTypeSub":null,"transformationTypeSecondLevel":null,"objective":null,"nature":null,"projectName":null,"projectDescription":null,"projectLeadName":null,"projectSponsorName":null,"isRegionalApprovalRequired":false,"regionalApproverName":null,"transformationStatus":null,"dmaicStatus":null,"urgency":null,"strategicValue":null,"comments":null,"transformationStatusDate":null,"dmaicStatusDate":null,"projectStatusDate":null,"deploymentDuration":null,"paybackPeriod":null,"expectedRevenue":null,"expectedInternalBenefit":null,"expectedClientBenefit":null,"estimatedProjectCost":null,"actualProjectCost":null,"recurrentRevenue":null,"additionalInvestment":null,"realisedBenefit":null,"realisedRevenue":null,"internalBenefit":null,"clientBenefit":null,"currency":null,"metricGroup":null,"metric":null,"asIsValue":null,"toBeValue":null,"wouldBeValue":null,"lastSnapshotValue":null,"kpiDescription":null,"intent":"create_project"}
""";

    public async Task<ParsedProjectInput> ParseProjectInputAsync(string userText)
    {
        try
        {
            var text = await CallDataAssistAsync(userText, ParsePrompt);
            var parsed = JsonSerializer.Deserialize<ParsedProjectInput>(text, JsonOptions);
            Console.WriteLine($"[PARSE] OK — intent={parsed?.Intent}, name={parsed?.ProjectName ?? "null"}, cluster={parsed?.Cluster ?? "null"}");
            return parsed ?? new ParsedProjectInput { Intent = "greeting" };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PARSE] FAILED: {ex.Message}");
            throw new Exception($"NLP parse failed: {ex.Message}", ex);
        }
    }

    // ── LLM Smart Match — AI-driven fuzzy matching when basic fuzzy fails ──

    private const string SmartMatchSystemPrompt = """
You are a matching engine for Teleperformance's project creation system.
Given a list of available options and a user's value, find the BEST match.
Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

Format: {"matchedName": "exact option text from the list", "confidence": 0.0-1.0}
If no option is a reasonable match: {"matchedName": null, "confidence": 0}

Rules:
- Match by meaning, not just exact spelling
- Handle typos: "consulitng" → "Consulting", "data analyitcs" → "Data Analytics"
- Handle abbreviations: "LSS" → "Lean Six Sigma (LSS)", "POC" → "Proof of Concept (POC)"
- Handle partial names: "lean six" → "Lean Six Sigma (LSS)", "internal proposal" → "Internal Proposal Submitted"
- Handle informal language: "started the project" → "Project Started", "strategy medium" → "Medium"
- The matchedName MUST be the EXACT text from the options list — copy it character-for-character
- confidence ≥ 0.7 means strong match, 0.5-0.7 means reasonable, < 0.5 means poor
""";

    public async Task<SmartMatchResult> SmartMatchAsync(SmartMatchInput input)
    {
        var optionsList = string.Join("\n", input.Options.Select((o, i) => $"  {i + 1}. {o}"));
        var userPrompt = $"Field: {input.Field}\nUser said: \"{input.UserValue}\"\n\nAvailable options:\n{optionsList}";

        try
        {
            var text = await CallDataAssistAsync(userPrompt, SmartMatchSystemPrompt);
            var result = JsonSerializer.Deserialize<SmartMatchResult>(text, JsonOptions) ?? new SmartMatchResult();
            Console.WriteLine($"[SmartMatch] {input.Field}: \"{input.UserValue}\" → \"{result.MatchedName ?? "null"}\" ({result.Confidence:F2})");
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SmartMatch] {input.Field} failed: {ex.Message}");
            return new SmartMatchResult();
        }
    }
}
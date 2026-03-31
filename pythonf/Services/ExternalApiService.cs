using System.Text;
using System.Text.Json;
using BackendAPI.Models;

namespace BackendAPI.Services;

public class ExternalApiService
{
    private readonly HttpClient _httpClient;
    private string _userApiBase = "";
    private string _opportunityApiBase = "";
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ExternalApiService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    /// <summary>Sets per-request auth, API base URLs, and version headers (all passed from frontend).</summary>
    public void Configure(string? bearerToken, string? userId, string? userApiBaseUrl, string? opportunityApiBaseUrl, string? apiVersion)
    {
        _userApiBase = userApiBaseUrl ?? throw new InvalidOperationException("UserApiBaseUrl is required");
        _opportunityApiBase = opportunityApiBaseUrl ?? throw new InvalidOperationException("OpportunityApiBaseUrl is required");

        if (!string.IsNullOrWhiteSpace(bearerToken))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", bearerToken);
        }
        if (!string.IsNullOrWhiteSpace(userId))
        {
            _httpClient.DefaultRequestHeaders.Remove("userid");
            _httpClient.DefaultRequestHeaders.Add("userid", userId);
        }
        _httpClient.DefaultRequestHeaders.Remove("api-version");
        if (!string.IsNullOrWhiteSpace(apiVersion))
            _httpClient.DefaultRequestHeaders.Add("api-version", apiVersion);
    }

    // ── Cluster / Country / Company / Client cascade ──

    public async Task<List<IdNameItem>> GetClustersAsync()
    {
        var url = $"{_userApiBase}/user/RetrieveClusters";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetClusterCountriesAsync(string clusterId)
    {
        var url = $"{_userApiBase}/user/RetrieveClusterCountries";
        return await PostAndExtract<IdNameItem>(url, new { clusterId });
    }

    public async Task<List<IdNameItem>> GetCompaniesAsync(string clusterCountryId)
    {
        var url = $"{_userApiBase}/user/RetrieveCompaniesByClusterCountry";
        return await PostAndExtract<IdNameItem>(url, new { clusterCountryId });
    }

    public async Task<List<ClientItem>> GetClientsAsync(string companyId)
    {
        var url = $"{_userApiBase}/user/RetrieveClientsByCompany";
        return await PostAndExtract<ClientItem>(url, new { companyId });
    }

    // ── LOB / Industry / Language ──

    public async Task<List<LobItem>> GetLobsAsync(int clientId, string companyId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetLobs?clientId={clientId}&companyId={Uri.EscapeDataString(companyId)}";
        return await GetAndExtract<LobItem>(url);
    }

    public async Task<List<IdNameItem>> SearchOperationalLobAsync(string searchString)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetOptionalLob?searchstringlob={Uri.EscapeDataString(searchString)}";
        var json = JsonSerializer.Serialize(new { searchstringlob = searchString }, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new Exception($"External API error ({(int)response.StatusCode}): {responseBody[..Math.Min(200, responseBody.Length)]}");
        if (string.IsNullOrWhiteSpace(responseBody)) return new List<IdNameItem>();
        return JsonSerializer.Deserialize<List<IdNameItem>>(responseBody, JsonOpts) ?? new List<IdNameItem>();
    }

    public async Task<List<IdNameItem>> GetIndustriesAsync(string lobId, string companyId, int clientId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetIndustriesByLob";
        return await PostAndExtract<IdNameItem>(url, new { lobId, companyId, clientId });
    }

    public async Task<List<IdNameItem>> GetLanguagesAsync(string lobId, string companyId, int clientId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetLanguageByLob";
        return await PostAndExtract<IdNameItem>(url, new { lobId, companyId, clientId });
    }

    // ── Primary Projects ──

    public async Task<List<PrimaryProjectItem>> GetPrimaryProjectsAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetPrimaryProjects";
        var response = await _httpClient.GetAsync(url);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new Exception($"External API error ({(int)response.StatusCode}): {responseBody[..Math.Min(200, responseBody.Length)]}");
        if (string.IsNullOrWhiteSpace(responseBody)) return new List<PrimaryProjectItem>();
        var result = JsonSerializer.Deserialize<ExternalApiResponse<List<PrimaryProjectItem>>>(responseBody, JsonOpts);
        return result?.ResultData?.SelectMany(x => x).ToList() ?? new List<PrimaryProjectItem>();
    }

    // ── Tab 2: Project Details APIs ──

    public async Task<List<IdNameItem>> GetTransformationTypesAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetTransformationTypes";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetObjectivesAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetObjectives";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetNaturesAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetNatures";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetTransformationStatusesAsync(string? transformationTypeId = null, string? projectId = null)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetTransformationStatuses";
        return await PostAndExtract<IdNameItem>(url, new
        {
            transformationTypeId = transformationTypeId ?? "",
            dmaicId = (int?)null,
            projectId = projectId,
            isProjectSubmitted = false
        });
    }

    // User search (Lead/Sponsor/Approver) all use GetRegionalApprover endpoint — requires a valid projectId.
    public async Task<List<UserSearchItem>> SearchUsersViaRegionalApproverAsync(string projectId, string searchText)
    {
        var approvers = await GetRegionalApproverAsync(projectId, searchText);
        return approvers.Select(a => new UserSearchItem
        {
            DisplayName = a.Name ?? string.Empty,
            UserPrincipalName = a.Upn ?? string.Empty,
            Id = a.Id,
        }).ToList();
    }

    // ── Tab 2: Transformation Type Sub-Dropdowns ──

    public async Task<List<IdNameItem>> GetTransformationTypeSubDropdownAsync(string transformationtypeId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetTransformationTypewiseSubDropdown?transformationtypeId={Uri.EscapeDataString(transformationtypeId)}";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetTransformationTypeSecondLevelAsync(string secondLevelId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetTransformationTypeSecondlevel?transformationTypeSecondLevelId={Uri.EscapeDataString(secondLevelId)}";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetTpMicroServicesSubLevelAsync(string transformationtypeId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetTpMicroServicesSubLevel?transformationtypeId={Uri.EscapeDataString(transformationtypeId)}";
        return await GetAndExtract<IdNameItem>(url);
    }

    // ── Tab 2: DMAIC, Group Classification, Urgency, Strategies ──

    public async Task<List<IdNameItem>> GetDMAICProjectStatusAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetDMAICProjectStatus";
        return await PostAndExtractNested<IdNameItem>(url, new { });
    }

    public async Task<List<IdNameItem>> GetGroupClassificationOptionsAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetGroupClassificationOptions";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetUrgenciesAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetUrgencies";
        return await GetAndExtractNested<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetStrategiesAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetStratergies";
        return await GetAndExtractNested<IdNameItem>(url);
    }

    // ── Tab 2: Regional Approver ──

    public async Task<List<RegionalApproverItem>> GetRegionalApproverAsync(string projectId, string searchString)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetRegionalApprover";
        return await PostAndExtractNested<RegionalApproverItem>(url, new { projectId, searchingString = searchString });
    }

    // ── Tab 3: Financials Dropdowns ──

    public async Task<List<IdNameItem>> GetBusinessOutcomesAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetBusinessOutcomes";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetTransformationMagnitudesAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetTransformationMagnitudes";
        return await GetAndExtract<IdNameItem>(url);
    }

    // ── Tab 4: KPI APIs ──

    public async Task<List<IdNameItem>> GetMetricGroupsAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetMetricsGroup";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<List<IdNameItem>> GetMetricsAsync(int metricGroupId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetMetrics?metricGroupId={metricGroupId}";
        return await GetAndExtract<IdNameItem>(url);
    }

    public async Task<JsonElement> CreateKpiAsync(CreateKpiPayload payload)
        => await PostJsonRawAsync($"{_opportunityApiBase}/Opportunity/CreateKpi", payload);

    public async Task<List<KpiItem>> GetKpisListAsync(string opportunityId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetKpisList";
        return await PostAndExtractNested<KpiItem>(url, new
        {
            opportunityId,
            years = (int?)null,
            quaters = (int?)null,
            metricGroupId = (int?)null,
            metricId = (int?)null
        });
    }

    public async Task<JsonElement> DeleteKpiAsync(string opportunityId, int metricrowid)
        => await PostJsonRawAsync($"{_opportunityApiBase}/Opportunity/DeleteOpportunityMetricGroup", new { opportunityId, metricrowid });

    // ── Project Prioritisation ──

    public async Task<JsonElement> SubmitProjectPrioritisationAsync(SubmitPrioritisationPayload payload)
        => await PostJsonRawAsync($"{_opportunityApiBase}/Opportunity/SubmitProjectPrioritisation", payload);

    public async Task<List<PrioritisationMetrics>> GetProjectPrioritisationMetricsAsync(string projectId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetProjectPrioritisationMetrics?projectId={Uri.EscapeDataString(projectId)}";
        return await GetAndExtract<PrioritisationMetrics>(url);
    }

    // ── Quarters ──

    public async Task<List<IdNameItem>> GetQuartersAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetQuarters";
        return await GetAndExtractNested<IdNameItem>(url);
    }

    // ── Stages & Approval ──

    public async Task<List<StageItem>> GetStagesAsync(string projectId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetStages?projectId={Uri.EscapeDataString(projectId)}";
        return await PostAndExtractNested<StageItem>(url, new { projectId });
    }

    public async Task<List<ProjectApprovalDetail>> GetProjectApprovalDetailsAsync(string projectId, int currentStageId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetProjectApprovalDetails";
        return await PostAndExtract<ProjectApprovalDetail>(url, new { projectId, currentStageId });
    }

    // ── Get Opportunity By Id ──

    public async Task<List<JsonElement>> GetOpportunityByIdAsync(string opportunityId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetOpportunityById";
        return await PostAndExtract<JsonElement>(url, new { opportunityId });
    }

    // ── External Products (Tab 2 conditional) ──

    public async Task<List<IdNameItem>> GetExternalProductsAsync()
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetExternalProducts";
        return await GetAndExtract<IdNameItem>(url);
    }

    // ── Project Statuses (non-PSI, Data Analytics path) ──

    public async Task<List<IdNameItem>> GetProjectStatusAsync(string transformationTypeId, int transformationStatusId)
    {
        var url = $"{_opportunityApiBase}/Opportunity/GetProjectStatus?transformationTypeId={Uri.EscapeDataString(transformationTypeId)}&transformationStatusId={transformationStatusId}";
        return await GetAndExtractNested<IdNameItem>(url);
    }

    // ── Create Opportunity ──

    public async Task<JsonElement> CreateOpportunityAsync(CreateOpportunityPayload payload)
        => await PostJsonRawAsync($"{_opportunityApiBase}/Opportunity/CreateOpportunity", payload);

    // ── Full cascade: auto-resolve all Tab 1 data ──

    public async Task<object> AutoResolveCascadeAsync(string clusterId, string clusterCountryId,
        string companyId, int clientId, string lobId)
    {
        // Run industry + language in parallel
        var industryTask = GetIndustriesAsync(lobId, companyId, clientId);
        var languageTask = GetLanguagesAsync(lobId, companyId, clientId);

        await Task.WhenAll(industryTask, languageTask);

        return new
        {
            industries = industryTask.Result,
            languages = languageTask.Result
        };
    }

    // ── Helpers ──

    private async Task<JsonElement> PostJsonRawAsync(string url, object body)
    {
        var json = JsonSerializer.Serialize(body, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new Exception($"External API error ({(int)response.StatusCode}): {responseBody[..Math.Min(2000, responseBody.Length)]}");
        if (string.IsNullOrWhiteSpace(responseBody))
            throw new Exception("External API returned an empty response.");
        return JsonSerializer.Deserialize<JsonElement>(responseBody, JsonOpts);
    }

    private async Task<List<T>> PostAndExtract<T>(string url, object body)
    {
        var json = JsonSerializer.Serialize(body, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new Exception($"External API error ({(int)response.StatusCode}): {responseBody[..Math.Min(200, responseBody.Length)]}");
        if (string.IsNullOrWhiteSpace(responseBody))
            return new List<T>();
        var result = JsonSerializer.Deserialize<ExternalApiResponse<T>>(responseBody, JsonOpts);
        return result?.ResultData ?? new List<T>();
    }

    private async Task<List<T>> GetAndExtract<T>(string url)
    {
        var response = await _httpClient.GetAsync(url);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new Exception($"External API error ({(int)response.StatusCode}): {responseBody[..Math.Min(200, responseBody.Length)]}");
        if (string.IsNullOrWhiteSpace(responseBody))
            return new List<T>();
        var result = JsonSerializer.Deserialize<ExternalApiResponse<T>>(responseBody, JsonOpts);
        return result?.ResultData ?? new List<T>();
    }

    /// <summary>GET helper for APIs returning nested arrays: resultData: [[{...}]] — flattens automatically.</summary>
    private async Task<List<T>> GetAndExtractNested<T>(string url)
    {
        var response = await _httpClient.GetAsync(url);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new Exception($"External API error ({(int)response.StatusCode}): {responseBody[..Math.Min(200, responseBody.Length)]}");
        if (string.IsNullOrWhiteSpace(responseBody))
            return new List<T>();
        var result = JsonSerializer.Deserialize<ExternalApiResponse<List<T>>>(responseBody, JsonOpts);
        return result?.ResultData?.SelectMany(x => x).ToList() ?? new List<T>();
    }

    /// <summary>POST helper for APIs returning nested arrays: resultData: [[{...}]]</summary>
    private async Task<List<T>> PostAndExtractNested<T>(string url, object body)
    {
        var json = JsonSerializer.Serialize(body, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);
        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new Exception($"External API error ({(int)response.StatusCode}): {responseBody[..Math.Min(200, responseBody.Length)]}");
        if (string.IsNullOrWhiteSpace(responseBody))
            return new List<T>();
        var result = JsonSerializer.Deserialize<ExternalApiResponse<List<T>>>(responseBody, JsonOpts);
        return result?.ResultData?.SelectMany(x => x).ToList() ?? new List<T>();
    }

    // ── Fuzzy Matching (moved from frontend) ──

    public static IdNameItem? FuzzyMatch(List<IdNameItem> items, string query)
    {
        var q = query.ToLower().Trim();
        var exact = items.FirstOrDefault(i => i.Name?.ToLower() == q);
        if (exact != null) return exact;
        var sub = items.FirstOrDefault(i =>
            (i.Name?.ToLower()?.Contains(q) ?? false) ||
            q.Contains(i.Name?.ToLower() ?? "\0"));
        if (sub != null) return sub;
        var qWords = q.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 1).ToArray();
        if (qWords.Length == 0) return null;
        IdNameItem? best = null;
        double bestScore = 0;
        foreach (var item in items)
        {
            var name = item.Name?.ToLower() ?? "";
            var nameWords = name.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 1).ToArray();
            var hits = qWords.Count(qw =>
                nameWords.Any(nw => nw.Contains(qw) || qw.Contains(nw)));
            var score = (double)hits / Math.Max(qWords.Length, Math.Max(nameWords.Length, 1));
            if (score > bestScore) { bestScore = score; best = item; }
        }
        return bestScore >= 0.5 ? best : null;
    }

    public static ClientItem? FuzzyMatchClient(List<ClientItem> items, string query)
    {
        var q = query.ToLower().Trim();
        return items.FirstOrDefault(i => i.Name?.ToLower() == q)
            ?? items.FirstOrDefault(i =>
                (i.Name?.ToLower()?.Contains(q) ?? false) ||
                q.Contains(i.Name?.ToLower() ?? "\0"));
    }

    // ── Cascade Resolution (resolve_cascade endpoint) ──

    public async Task<CascadeResult> ResolveCascadeAsync(CascadeInput input)
    {
        var r = new CascadeResult();

        // Helper: set failure info and return current partial result
        CascadeResult Fail(string field, string? value, object? options)
        {
            r.FailedField = field; r.FailedValue = value; r.AvailableOptions = options;
            return r;
        }

        // 1. Clusters
        var clusters = await GetClustersAsync();
        if (string.IsNullOrWhiteSpace(input.Cluster)) return Fail("cluster", null, clusters);
        var cm = FuzzyMatch(clusters, input.Cluster);
        if (cm == null) return Fail("cluster", input.Cluster, clusters);
        r.ClusterId = cm.Id; r.ClusterName = cm.Name;

        // 2. Countries
        var countries = await GetClusterCountriesAsync(r.ClusterId!);
        if (string.IsNullOrWhiteSpace(input.Country)) return Fail("country", null, countries);
        var ctm = FuzzyMatch(countries, input.Country);
        if (ctm == null) return Fail("country", input.Country, countries);
        r.ClusterCountryId = ctm.Id; r.ClusterCountryName = ctm.Name;

        // 3. Companies
        var companies = await GetCompaniesAsync(r.ClusterCountryId!);
        if (string.IsNullOrWhiteSpace(input.Company)) return Fail("company", null, companies);
        var com = FuzzyMatch(companies, input.Company);
        if (com == null) return Fail("company", input.Company, companies);
        r.CompanyId = com.Id; r.CompanyName = com.Name;

        // 4. TP Internal — skip client + LOB
        if (input.IsTpInternal) { r.ClientName = "TP Internal"; r.IsTpInternal = true; return r; }

        // 5. Clients
        var clients = await GetClientsAsync(r.CompanyId!);
        if (string.IsNullOrWhiteSpace(input.Client)) return Fail("client", null, clients);
        var clientAsId = clients.Select(c => new IdNameItem { Id = c.Id.ToString(), Name = c.Name }).ToList();
        var clm = FuzzyMatch(clientAsId, input.Client);
        if (clm == null) return Fail("client", input.Client, clients);
        r.ClientId = int.Parse(clm.Id!); r.ClientName = clm.Name;

        // 6. LOBs
        var lobs = await GetLobsAsync(r.ClientId!.Value, r.CompanyId!);
        if (string.IsNullOrWhiteSpace(input.Lob)) return Fail("lob", null, lobs);
        var lobAsId = lobs.Select(l => new IdNameItem { Id = l.Id, Name = l.Name }).ToList();
        var lm = FuzzyMatch(lobAsId, input.Lob);
        if (lm == null) return Fail("lob", input.Lob, lobs);
        r.LobId = lm.Id; r.LobName = lm.Name;

        // 7. Auto-resolve industry + language in parallel
        try
        {
            var industryTask = GetIndustriesAsync(r.LobId!, r.CompanyId!, r.ClientId!.Value);
            var languageTask = GetLanguagesAsync(r.LobId!, r.CompanyId!, r.ClientId!.Value);
            await Task.WhenAll(industryTask, languageTask);
            var industry = industryTask.Result.FirstOrDefault();
            var language = languageTask.Result.FirstOrDefault();
            r.IndustryId = industry?.Id ?? "";
            r.IndustryName = industry?.Name ?? "N/A";
            r.LanguageName = language?.Name ?? "N/A";
        }
        catch { r.IndustryName = "N/A"; r.LanguageName = "N/A"; }

        return r;
    }

    // ── Tab 2 Validation (validate_tab2 endpoint) ──

    public static Tab2ValidationResult ValidateTab2(Tab2ValidationInput v)
    {
        if (v.ObjectiveId == null)
            return new Tab2ValidationResult { FirstMissingField = "objective", Message = "⚠ Objective is required" };
        if (v.NatureId == null)
            return new Tab2ValidationResult { FirstMissingField = "nature", Message = "⚠ Nature is required" };
        if (v.IsGroupClassificationEnable && v.GroupClassificationId == null)
            return new Tab2ValidationResult { FirstMissingField = "group_classification", Message = "⚠ Group Classification is required" };
        if (v.ShowExternalProductDropdown && string.IsNullOrWhiteSpace(v.ExternalProductId))
            return new Tab2ValidationResult { FirstMissingField = "external_product", Message = "⚠ External Product is required" };
        if (string.IsNullOrWhiteSpace(v.ProjectName))
            return new Tab2ValidationResult { FirstMissingField = "project_name", Message = "⚠ Project Name is required" };
        if (string.IsNullOrWhiteSpace(v.ProjectLeadName))
            return new Tab2ValidationResult { FirstMissingField = "project_lead", Message = "⚠ Project Lead is required" };
        if (string.IsNullOrWhiteSpace(v.ProjectSponsorName))
            return new Tab2ValidationResult { FirstMissingField = "project_sponsor", Message = "⚠ Project Sponsor is required" };
        if (v.IsRegionalApprovalRequired && string.IsNullOrWhiteSpace(v.RegionalApproverId))
            return new Tab2ValidationResult { FirstMissingField = "regional_approver", Message = "⚠ Regional Approver is required" };
        if (v.TransformationStatusId == null)
            return new Tab2ValidationResult { FirstMissingField = "transformation_status", Message = "⚠ Transformation Status is required" };
        if (string.IsNullOrWhiteSpace(v.TransformationStatusDate))
            return new Tab2ValidationResult { FirstMissingField = "transformation_status_date", Message = "⚠ Transformation Status Date is required" };
        if (v.IsDmaicPath && v.DmaicProjectStatusId == null)
            return new Tab2ValidationResult { FirstMissingField = "dmaic_status", Message = "⚠ DMAIC Project Status is required" };
        if (v.IsDmaicPath && string.IsNullOrWhiteSpace(v.DmaicProjectStatusDate))
            return new Tab2ValidationResult { FirstMissingField = "dmaic_status_date", Message = "⚠ DMAIC Date is required" };
        if (v.IsDataAnalyticsPath && v.IsProjectStatusEnableForWithoutPSI && v.ProjectStatusId == null)
            return new Tab2ValidationResult { FirstMissingField = "project_status", Message = "⚠ Project Status is required" };
        if (v.IsDataAnalyticsPath && v.IsProjectStatusEnableForWithoutPSI && v.ProjectStatusId != null && string.IsNullOrWhiteSpace(v.ProjectStatusDate))
            return new Tab2ValidationResult { FirstMissingField = "project_status_date", Message = "⚠ Project Status Date is required" };
        if (v.UrgencyId == null)
            return new Tab2ValidationResult { FirstMissingField = "urgency", Message = "⚠ Urgency is required" };
        if (v.StrategicValueId == null)
            return new Tab2ValidationResult { FirstMissingField = "strategic_value", Message = "⚠ Strategic Value is required" };
        return new Tab2ValidationResult { Valid = true };
    }
}

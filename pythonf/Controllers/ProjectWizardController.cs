using Microsoft.AspNetCore.Mvc;
using BackendAPI.Models;
using BackendAPI.Services;

namespace BackendAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectWizardController : ControllerBase
{
    private readonly ExternalApiService _api;
    private readonly DataAssistService _assistant;
    private readonly Dictionary<string, Func<WizardStepRequest, Task<(object? data, string msg)>>> _handlers;

    public ProjectWizardController(ExternalApiService api, DataAssistService assistant)
    {
        _api = api;
        _assistant = assistant;
        _handlers = BuildHandlers();
    }

    [HttpPost("execute")]
    public async Task<IActionResult> Execute([FromBody] WizardStepRequest request)
    {
        try
        {
            _api.Configure(request.BearerToken, request.UserId, request.UserApiBaseUrl, request.OpportunityApiBaseUrl, request.ApiVersion);
            _assistant.Configure(request.LlmBaseUrl, request.LlmChatId, request.LlmUserUpn, request.LlmChatArea, request.LlmFlowId, request.LlmProjectId, request.LlmVersionId);
            var action = request.Action?.ToLowerInvariant() ?? "";
            if (!_handlers.TryGetValue(action, out var handler))
                return BadRequest(new WizardStepResponse { Success = false, Message = $"Unknown action: {request.Action}" });

            var (data, message) = await handler(request);
            if (data is IActionResult result) return result;

            return Ok(new WizardStepResponse { Success = true, Message = message, Data = data });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new WizardStepResponse { Success = false, Message = $"Internal error: {ex.Message}" });
        }
    }

    private IActionResult Bad(string msg) =>
        BadRequest(new WizardStepResponse { Success = false, Message = msg });

    // ── Handler helpers to eliminate repetitive validation ──
    private static (object?, string) Fail(IActionResult bad) => (bad, "");

    private async Task<(object?, string)> RequireAndCall<T>(string? value, string name,
        Func<string, Task<T>> call, string msg) =>
        string.IsNullOrWhiteSpace(value) ? Fail(Bad($"{name} is required")) : (await call(value), msg);

    private Dictionary<string, Func<WizardStepRequest, Task<(object? data, string msg)>>> BuildHandlers()
    {
        var h = new Dictionary<string, Func<WizardStepRequest, Task<(object?, string)>>>();

        // Tab 1: Cascade — no-param endpoints
        h["get_clusters"] = async r => (await _api.GetClustersAsync(), "Clusters retrieved");
        h["get_primary_projects"] = async r => (await _api.GetPrimaryProjectsAsync(), "Primary projects retrieved");

        // Tab 1: Cascade — single string param endpoints
        h["get_countries"] = r => RequireAndCall(r.ClusterId, "ClusterId", _api.GetClusterCountriesAsync, "Countries retrieved");
        h["get_companies"] = r => RequireAndCall(r.ClusterCountryId, "ClusterCountryId", _api.GetCompaniesAsync, "Companies retrieved");
        h["get_clients"] = r => RequireAndCall(r.CompanyId, "CompanyId", _api.GetClientsAsync, "Clients retrieved");
        h["search_operational_lob"] = r => RequireAndCall(r.SearchText, "SearchText", _api.SearchOperationalLobAsync, "Operational LOBs retrieved");

        h["get_lobs"] = async r =>
        {
            if (r.ClientId == null || string.IsNullOrWhiteSpace(r.CompanyId)) return Fail(Bad("ClientId and CompanyId are required"));
            return (await _api.GetLobsAsync(r.ClientId.Value, r.CompanyId), "LOBs retrieved");
        };

        h["get_industries"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.LobId) || string.IsNullOrWhiteSpace(r.CompanyId) || r.ClientId == null)
                return Fail(Bad("LobId, CompanyId, and ClientId are required"));
            return (await _api.GetIndustriesAsync(r.LobId, r.CompanyId, r.ClientId.Value), "Industries retrieved");
        };

        h["get_languages"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.LobId) || string.IsNullOrWhiteSpace(r.CompanyId) || r.ClientId == null)
                return Fail(Bad("LobId, CompanyId, and ClientId are required"));
            return (await _api.GetLanguagesAsync(r.LobId, r.CompanyId, r.ClientId.Value), "Languages retrieved");
        };

        h["auto_resolve"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.ClusterId) || string.IsNullOrWhiteSpace(r.ClusterCountryId)
                || string.IsNullOrWhiteSpace(r.CompanyId) || r.ClientId == null || string.IsNullOrWhiteSpace(r.LobId))
                return Fail(Bad("All cascade IDs required for auto_resolve"));
            return (await _api.AutoResolveCascadeAsync(r.ClusterId, r.ClusterCountryId, r.CompanyId, r.ClientId.Value, r.LobId), "Industry and Language auto-resolved");
        };

        // Tab 2: Project Details — no-param endpoints
        h["get_transformation_types"] = async r => (await _api.GetTransformationTypesAsync(), "Transformation types retrieved");
        h["get_objectives"] = async r => (await _api.GetObjectivesAsync(), "Objectives retrieved");
        h["get_natures"] = async r => (await _api.GetNaturesAsync(), "Natures retrieved");
        h["get_dmaic_project_status"] = async r => (await _api.GetDMAICProjectStatusAsync(), "DMAIC project statuses retrieved");
        h["get_group_classification_options"] = async r => (await _api.GetGroupClassificationOptionsAsync(), "Group classification options retrieved");
        h["get_urgencies"] = async r => (await _api.GetUrgenciesAsync(), "Urgencies retrieved");
        h["get_strategies"] = async r => (await _api.GetStrategiesAsync(), "Strategic values retrieved");
        h["get_quarters"] = async r => (await _api.GetQuartersAsync(), "Quarters retrieved");
        h["get_external_products"] = async r => (await _api.GetExternalProductsAsync(), "External products retrieved");

        // Tab 2: Project Details — parameterized endpoints
        h["get_transformation_statuses"] = async r => (await _api.GetTransformationStatusesAsync(r.TransformationTypeId, r.OpportunityId), "Transformation statuses retrieved");
        h["get_transformation_type_sub_dropdown"] = r => RequireAndCall(r.TransformationTypeId, "TransformationTypeId", _api.GetTransformationTypeSubDropdownAsync, "Transformation type sub-dropdown retrieved");
        h["get_transformation_type_second_level"] = r => RequireAndCall(r.TransformationTypeSecondLevelId, "TransformationTypeSecondLevelId", _api.GetTransformationTypeSecondLevelAsync, "Transformation type second level retrieved");
        h["get_tp_microservices_sub_level"] = r => RequireAndCall(r.TransformationTypeId, "TransformationTypeId", _api.GetTpMicroServicesSubLevelAsync, "TP Microservices sub-level retrieved");

        h["search_users"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.SearchText)) return Fail(Bad("SearchText is required"));
            return (await _api.SearchUsersViaRegionalApproverAsync(r.OpportunityId ?? "", r.SearchText), "Users retrieved");
        };

        h["get_regional_approver"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.SearchText)) return Fail(Bad("SearchText is required"));
            return (await _api.SearchUsersViaRegionalApproverAsync(r.OpportunityId ?? "", r.SearchText), "Regional approvers retrieved");
        };

        h["get_stages"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.ProjectId)) return Fail(Bad("ProjectId is required"));
            return (await _api.GetStagesAsync(r.ProjectId), "Stages retrieved");
        };

        h["get_project_approval_details"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.ProjectId) || r.CurrentStageId == null) return Fail(Bad("ProjectId and CurrentStageId are required"));
            return (await _api.GetProjectApprovalDetailsAsync(r.ProjectId, r.CurrentStageId.Value), "Project approval details retrieved");
        };

        h["get_opportunity_by_id"] = r => RequireAndCall(r.OpportunityId, "OpportunityId", _api.GetOpportunityByIdAsync, "Opportunity retrieved");

        h["get_project_statuses"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.TransformationTypeId) || r.TransformationStatusId == null)
                return Fail(Bad("TransformationTypeId and TransformationStatusId are required"));
            return (await _api.GetProjectStatusAsync(r.TransformationTypeId, r.TransformationStatusId.Value), "Project statuses retrieved");
        };

        // Tab 3
        h["get_business_outcomes"] = async r => (await _api.GetBusinessOutcomesAsync(), "Business outcomes retrieved");
        h["get_transformation_magnitudes"] = async r => (await _api.GetTransformationMagnitudesAsync(), "Transformation magnitudes retrieved");

        // Tab 4
        h["get_metric_groups"] = async r => (await _api.GetMetricGroupsAsync(), "Metric groups retrieved");

        h["get_metrics"] = async r =>
        {
            if (r.MetricGroupId == null) return Fail(Bad("MetricGroupId is required"));
            return (await _api.GetMetricsAsync(r.MetricGroupId.Value), "Metrics retrieved");
        };

        h["create_kpi"] = async r =>
        {
            if (r.KpiPayload == null) return Fail(Bad("KpiPayload is required"));
            return (await _api.CreateKpiAsync(r.KpiPayload), "KPI created");
        };

        h["get_kpis_list"] = r => RequireAndCall(r.OpportunityId, "OpportunityId", _api.GetKpisListAsync, "KPIs retrieved");

        h["delete_kpi"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.OpportunityId) || r.MetricrowId == null) return Fail(Bad("OpportunityId and MetricrowId are required"));
            return (await _api.DeleteKpiAsync(r.OpportunityId, r.MetricrowId.Value), "KPI deleted");
        };

        h["submit_project_prioritisation"] = async r =>
        {
            if (r.PrioritisationPayload == null) return Fail(Bad("PrioritisationPayload is required"));
            return (await _api.SubmitProjectPrioritisationAsync(r.PrioritisationPayload), "Project prioritisation submitted");
        };

        h["get_project_prioritisation_metrics"] = r => RequireAndCall(r.OpportunityId, "OpportunityId",
            id => _api.GetProjectPrioritisationMetricsAsync(id), "Prioritisation metrics retrieved");

        h["create_opportunity"] = async r =>
        {
            if (r.OpportunityPayload == null) return Fail(Bad("OpportunityPayload is required"));
            return (await _api.CreateOpportunityAsync(r.OpportunityPayload), "Opportunity created");
        };

        h["assistant_message"] = async r =>
            (new { text = await _assistant.GenerateMessageAsync(r) }, "Assistant message generated");

        h["parse_project_input"] = async r =>
        {
            if (string.IsNullOrWhiteSpace(r.UserText)) return Fail(Bad("UserText is required"));
            try { return (await _assistant.ParseProjectInputAsync(r.UserText), "Input parsed"); }
            catch (Exception ex)
            {
                Console.WriteLine($"[Controller] parse_project_input failed: {ex.Message}");
                return Fail(Bad($"NLP_PARSE_FAILED: {ex.Message}"));
            }
        };

        // ── Backend-offloaded endpoints (moved from frontend) ──

        h["resolve_cascade"] = async r =>
        {
            if (r.CascadeInput == null) return Fail(Bad("CascadeInput is required"));
            return (await _api.ResolveCascadeAsync(r.CascadeInput), "Cascade resolved");
        };

        h["save_with_prioritisation"] = async r =>
        {
            if (r.OpportunityPayload == null) return Fail(Bad("OpportunityPayload is required"));
            var saveResult = await _api.CreateOpportunityAsync(r.OpportunityPayload);
            if (r.PrioritisationPayload != null)
                try { await _api.SubmitProjectPrioritisationAsync(r.PrioritisationPayload); } catch { }
            return (saveResult, "Saved with prioritisation");
        };

        h["validate_tab2"] = r =>
        {
            if (r.Tab2Validation == null)
                return Task.FromResult<(object?, string)>(Fail(Bad("Tab2Validation is required")));
            return Task.FromResult<(object?, string)>((ExternalApiService.ValidateTab2(r.Tab2Validation), "Tab 2 validated"));
        };

        h["smart_match"] = async r =>
        {
            if (r.SmartMatchInput == null) return Fail(Bad("SmartMatchInput is required"));
            return (await _assistant.SmartMatchAsync(r.SmartMatchInput), "Smart match resolved");
        };

        return h;
    }
}

using System.Text.Json;
using System.Text.Json.Serialization;

namespace BackendAPI.Models;

/// <summary>Reads both JSON strings and numbers as C# string.</summary>
public class FlexStringConverter : JsonConverter<string?>
{
    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Number => reader.TryGetInt64(out var l) ? l.ToString() : reader.GetDouble().ToString(),
            JsonTokenType.Null   => null,
            _                    => throw new JsonException($"Unexpected token {reader.TokenType} for string property")
        };
    }

    public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options)
        => writer.WriteStringValue(value);
}

// ── Incoming request from Frontend ──
public class WizardStepRequest
{
    public string Action { get; set; } = string.Empty;
    public string? BearerToken { get; set; }
    public string? UserId { get; set; }
    public string? UserApiBaseUrl { get; set; }
    public string? OpportunityApiBaseUrl { get; set; }
    public string? ApiVersion { get; set; }
    public string? LlmBaseUrl { get; set; }
    public string? LlmChatId { get; set; }
    public string? LlmUserUpn { get; set; }
    public string? LlmChatArea { get; set; }
    public string? LlmFlowId { get; set; }
    public string? LlmProjectId { get; set; }
    public string? LlmVersionId { get; set; }
    public string? ClusterId { get; set; }
    public string? ClusterCountryId { get; set; }
    public string? CompanyId { get; set; }
    public int? ClientId { get; set; }
    public string? UserText { get; set; }  // Free-text input from user for NLP parsing
    public string? LobId { get; set; }
    public string? SearchText { get; set; }
    public string? TransformationTypeId { get; set; }
    public string? OpportunityId { get; set; }
    public string? UserMessage { get; set; }
    public string? FallbackMessage { get; set; }
    public string? Stage { get; set; }
    public WizardAssistantContext? AssistantContext { get; set; }

    // Tab 2 conditional dropdowns
    public string? TransformationTypeSubId { get; set; }
    public string? TransformationTypeSecondLevelId { get; set; }
    public int? TransformationStatusId { get; set; }
    public string? DmaicId { get; set; }
    public string? ProjectId { get; set; }

    // Approval / Stages
    public int? CurrentStageId { get; set; }

    // Tab 4 KPI
    public int? MetricGroupId { get; set; }
    public int? MetricrowId { get; set; }

    // Regional approver search
    public string? SearchingString { get; set; }

    // For CreateOpportunity
    public CreateOpportunityPayload? OpportunityPayload { get; set; }

    // For CreateKpi
    public CreateKpiPayload? KpiPayload { get; set; }

    // For SubmitProjectPrioritisation
    public SubmitPrioritisationPayload? PrioritisationPayload { get; set; }

    // For resolve_cascade
    public CascadeInput? CascadeInput { get; set; }

    // For validate_tab2
    public Tab2ValidationInput? Tab2Validation { get; set; }

    // For smart_match (LLM-driven fuzzy matching)
    public SmartMatchInput? SmartMatchInput { get; set; }
}

// ── Unified response back to Frontend ──
public class WizardStepResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public object? Data { get; set; }
}

// ── External API standard response shape ──
public class ExternalApiResponse<T>
{
    public int ResultCode { get; set; }
    public List<T>? ResultData { get; set; }
    public List<string>? ResultMessages { get; set; }
}

public class IdNameItem
{
    [JsonConverter(typeof(FlexStringConverter))]
    public string? Id { get; set; }
    public string? Name { get; set; }
}

public class ClientItem
{
    public int Id { get; set; }
    public string? Name { get; set; }
}

public class LobItem
{
    public string? Id { get; set; }
    public string? Name { get; set; }
}

public class PrimaryProjectItem
{
    public string? OpportunityId { get; set; }
    public string? ViewopportunityId { get; set; }
    public string? SalesforceId { get; set; }
    public int? ClientId { get; set; }
    public string? ClientName { get; set; }
    public string? CompanyId { get; set; }
    public string? CompanyName { get; set; }
    public string? ClusterId { get; set; }
    public string? ClusterName { get; set; }
    public string? ClusterCountryId { get; set; }
    public string? ClusterCountryName { get; set; }
    public string? LineOfBusiness { get; set; }
    public string? LineOfBusiness_name { get; set; }
    public string? IndustryId { get; set; }
    public string? IndustryName { get; set; }
    public string? LanguageName { get; set; }
    public string? OperationalLob { get; set; }
}

public class ParsedProjectInput
{
    // Tab 1: Basic Info
    public string? Cluster { get; set; }
    public string? Country { get; set; }
    public string? Company { get; set; }
    public string? Client { get; set; }
    public string? Lob { get; set; }
    public string? Industry { get; set; }
    public string? Language { get; set; }
    public bool IsTpInternal { get; set; }

    // Tab 2: Project Details
    public string? TransformationType { get; set; }
    public string? TransformationTypeSub { get; set; }
    public string? TransformationTypeSecondLevel { get; set; }
    public string? Objective { get; set; }
    public string? Nature { get; set; }
    public string? ProjectName { get; set; }
    public string? ProjectDescription { get; set; }
    public string? ProjectLeadName { get; set; }
    public string? ProjectSponsorName { get; set; }
    public string? TransformationStatus { get; set; }
    public string? DmaicStatus { get; set; }
    public string? Urgency { get; set; }
    public string? StrategicValue { get; set; }
    public string? Comments { get; set; }

    // Regional Approval
    public bool IsRegionalApprovalRequired { get; set; }
    public string? RegionalApproverName { get; set; }

    // Dates
    public string? TransformationStatusDate { get; set; }
    public string? DmaicStatusDate { get; set; }
    public string? ProjectStatusDate { get; set; }

    // Prioritisation
    public string? DeploymentDuration { get; set; }
    public string? PaybackPeriod { get; set; }

    // Tab 3: Financials
    public string? ExpectedRevenue { get; set; }
    public string? ExpectedInternalBenefit { get; set; }
    public string? ExpectedClientBenefit { get; set; }
    public string? EstimatedProjectCost { get; set; }
    public string? ActualProjectCost { get; set; }
    public string? RecurrentRevenue { get; set; }
    public string? AdditionalInvestment { get; set; }
    public string? RealisedBenefit { get; set; }
    public string? RealisedRevenue { get; set; }
    public string? InternalBenefit { get; set; }
    public string? ClientBenefit { get; set; }
    public string? Currency { get; set; }

    // Tab 4: KPI
    public string? MetricGroup { get; set; }
    public string? Metric { get; set; }
    public string? AsIsValue { get; set; }
    public string? ToBeValue { get; set; }
    public string? WouldBeValue { get; set; }
    public string? LastSnapshotValue { get; set; }
    public string? KpiDescription { get; set; }

    public string Intent { get; set; } = "create_project";
}

public class UserSearchItem
{
    public string DisplayName { get; set; } = string.Empty;
    public string UserPrincipalName { get; set; } = string.Empty;
    public string? Id { get; set; }
}

public class WizardAssistantContext
{
    public string? ClusterName { get; set; }
    public string? ClusterCountryName { get; set; }
    public string? CompanyName { get; set; }
    public string? ClientName { get; set; }
    public string? LobName { get; set; }
    public string? IndustryName { get; set; }
    public string? LanguageName { get; set; }
    public bool IsTpInternal { get; set; }
}

// ── CreateOpportunity payload (Tab 1 fields) ──
public class CreateOpportunityPayload
{
    public string? OpportunityId { get; set; }
    public int? ClientId { get; set; }
    public string? CompanyId { get; set; }
    public string? ClusterId { get; set; }
    public string? ClusterCountryId { get; set; }
    public string? Lob { get; set; }
    public int? ObjectiveId { get; set; }
    public int? NatureId { get; set; }
    public int? TransformationStatusId { get; set; }
    public string? TransformationTypeId { get; set; }
    public int? TransformationMagnitudeId { get; set; }
    public int? BusinessOutcomeId { get; set; }
    public string? ExpectedRevenue { get; set; }
    public string? Email { get; set; } = "";
    public string? IndustryId { get; set; }
    public string? LanguageName { get; set; }
    public int? IngestionHours { get; set; }
    public int? NofQA { get; set; }
    public int? NofCustomerExpertInScope { get; set; }
    public int FormTab { get; set; } = 1;
    public int? ExpectedInternalBenefitQualityFrom { get; set; }
    public int? ExpectedInternalBenefitQualityTo { get; set; }
    public int? ExpectedInternalBenefitProductivityFrom { get; set; }
    public int? ExpectedInternalBenefitProductivityTo { get; set; }
    public int? ExpectedClientlBenefitQualityFrom { get; set; }
    public int? ExpectedClientBenefitQualityTo { get; set; }
    public int? ExpectedClientBenefitProductivityFrom { get; set; }
    public int? ExpectedClientBenefitProductivityTo { get; set; }
    public string? CommittedInternalBenefitDate { get; set; } = "";
    public int? ApplicableRFT { get; set; }
    public int? RevenueVariationPerMonth { get; set; }
    public int? MarginVariationPerMonth { get; set; }
    public int? Improvement { get; set; }
    public int? AdditionalAbsoluteGmPerYear { get; set; }
    public int? AdditionalGM { get; set; }
    public string? Currency { get; set; }
    public string? BusinessOutcomeType { get; set; }
    public string? InternalBenefit { get; set; }
    public string? ClientBenefit { get; set; }
    public string? RecurrentRevenue { get; set; }
    public string? CommitedInternalBenefit { get; set; }
    public string? ActualProjectCost { get; set; }
    public string? EstimatedProjectCost { get; set; }
    public string? RealisedBenefit { get; set; }
    public string? RealisedRevenue { get; set; }
    public string? TransformationTypeFirstLevelId { get; set; }
    public string? TransformationTypeSecondLevelId { get; set; }
    public string? TransformationTypeThirdLevelId { get; set; }
    public string? SalesforceId { get; set; } = "";
    public string? ExpectedInternalBenefit { get; set; }
    public string? ExpectedClientBenefit { get; set; }
    public string? CommitedInternalBenefitRepetitiveGroup { get; set; }
    public string? ProjectName { get; set; }
    public string? ProjectDescription { get; set; }
    public string? Comments { get; set; }
    public string? DmaiC_projectStatusId { get; set; }
    public string? ExternalProductId { get; set; }
    public string? GroupClassificationIds { get; set; }
    public string? DmaiC_projectstatusDate { get; set; } = "";
    public string? ProjectLeadName { get; set; }
    public string? ProjectSponserName { get; set; }
    public string? TransformationStatusDate { get; set; } = "";
    public bool IsPrimaryProject { get; set; } = true;
    public bool IsProjectClosure { get; set; } = false;
    public bool IsSecondaryToggleCheckd { get; set; } = false;
    public string? PrimaryProjectID { get; set; }
    public bool PreviousPageButton { get; set; } = false;
    public bool IsOnHold { get; set; } = false;
    public int? ProjectStatusId { get; set; }
    public string? ProjectStatusDate { get; set; } = "";
    public string? Operationallob { get; set; } = "";
    public string? AdditionalInvestment { get; set; }
    public int? RegionalApproverId { get; set; }
    public bool Isadditionalinvestment { get; set; } = false;
    public string? ProjectLeadUPN { get; set; }
    public string? ProjectSponsorUPN { get; set; }
    public bool IsRegionalApprovalRequired { get; set; } = false;
    public bool IsTpInternal { get; set; } = false;
    public bool IsSubmitted { get; set; } = false;
    public int? Urgency { get; set; }
    public int? StatgicValue { get; set; }
    public string? RegionalApproverName { get; set; }
    public string? RegionalApproverUPN { get; set; }
    public string? ExternalProductValue { get; set; }
    public string? ProjectShortDescription { get; set; }
    public string? ProjectStatusValue { get; set; }
    public string? StatusDate { get; set; } = "";
}

// ── KPI models ──
public class CreateKpiPayload
{
    [JsonPropertyName("KPIrowId")]
    public int? KpiRowId { get; set; }
    public string? OpportunityId { get; set; }
    public int? MetricGroupId { get; set; }
    [JsonPropertyName("aS_IS")]
    public string? AsIs { get; set; }
    [JsonPropertyName("tO_BE")]
    public string? ToBe { get; set; }
    [JsonPropertyName("woulD_BE")]
    public string? WouldBe { get; set; }
    public string? LastUpdatedDate { get; set; }
    public int? Metricrowid { get; set; }
    public int? MetricId { get; set; }
    public string? LastSnapshot { get; set; }
    public string? Description { get; set; }
    public string? CustomSubMetricsName { get; set; }
}

public class KpiItem
{
    public int? Metricrowid { get; set; }
    public int? MetricGroupId { get; set; }
    public string? MetricGroupName { get; set; }
    public int? MetricId { get; set; }
    public string? MetricName { get; set; }
    [JsonPropertyName("AS_IS")]
    public string? AsIs { get; set; }
    [JsonPropertyName("TO_BE")]
    public string? ToBe { get; set; }
    [JsonPropertyName("WOULD_BE")]
    public string? WouldBe { get; set; }
    public string? LastDate { get; set; }
    public string? LastSnapshot { get; set; }
    public string? Description { get; set; }
    public string? CustomSubMatricsName { get; set; }
}

// ── Project Prioritisation ──
public class SubmitPrioritisationPayload
{
    public string? OpportunityId { get; set; }
    public string? DeploymentDuration { get; set; }
    public string? PaybackPeriod { get; set; }
    public int? UrgencyId { get; set; }
    public int? StrategicValueId { get; set; }
}

public class PrioritisationMetrics
{
    public string? DeploymentDuration { get; set; }
    public string? PaybackPeriod { get; set; }
    public int? UrgencyId { get; set; }
    public string? UrgencyName { get; set; }
    public int? StrategicValueId { get; set; }
    public string? StrategicValueName { get; set; }
    public string? KpiDescription { get; set; }
    public int? PaidById { get; set; }
    public string? PaidByIdName { get; set; }
    public int? ImpactedCEs { get; set; }
}

// ── Regional Approver ──
public class RegionalApproverItem
{
    public string? Name { get; set; }
    public string? Upn { get; set; }
    public string? Id { get; set; }
}

// ── Stages ──
public class StageItem
{
    public int? CurrentStageId { get; set; }
    public int Id { get; set; }
    public string? Name { get; set; }
}

// ── Project Approval Details ──
public class ProjectApprovalDetail
{
    public string? ProjectStatus { get; set; }
    public int Sla { get; set; }
    public bool Isadditionalinvestment { get; set; }
    public bool? IsLocalApproved { get; set; }
    public string? LocalApprovalComment { get; set; }
    public bool IsRegionalApprovalRequired { get; set; }
    public string? RegionalApproverId { get; set; }
    public string? RegionalApproverName { get; set; }
    public bool? IsRegionalApproved { get; set; }
    public string? RegionalApprovalComment { get; set; }
    public int IsUserLocalApprover { get; set; }
    public int IsUserRegionalApprover { get; set; }
    public int FinalApproved { get; set; }
    public string? AdditionalInvestment { get; set; }
    public string? RejectionReasonId { get; set; }
    public string? RejectionReasonName { get; set; }
    public string? OtherRejectedReason { get; set; }
    public string? GeneralStatusName { get; set; }
    public string? ClusterName { get; set; }
    public string? ClusterCountryName { get; set; }
    public int IsgeneralStatusPending { get; set; }
}

// ── Cascade Resolution (resolve_cascade endpoint) ──

public class CascadeInput
{
    public string? Cluster { get; set; }
    public string? Country { get; set; }
    public string? Company { get; set; }
    public string? Client { get; set; }
    public string? Lob { get; set; }
    public bool IsTpInternal { get; set; }
}

public class CascadeResult
{
    public string? ClusterId { get; set; }
    public string? ClusterName { get; set; }
    public string? ClusterCountryId { get; set; }
    public string? ClusterCountryName { get; set; }
    public string? CompanyId { get; set; }
    public string? CompanyName { get; set; }
    public int? ClientId { get; set; }
    public string? ClientName { get; set; }
    public string? LobId { get; set; }
    public string? LobName { get; set; }
    public bool IsTpInternal { get; set; }
    public string? IndustryId { get; set; }
    public string? IndustryName { get; set; }
    public string? LanguageName { get; set; }
    /// <summary>Field name where fuzzy matching failed (null = all resolved).</summary>
    public string? FailedField { get; set; }
    /// <summary>The NLP value that didn't match.</summary>
    public string? FailedValue { get; set; }
    /// <summary>Available dropdown options for the failed field.</summary>
    public object? AvailableOptions { get; set; }
}

// ── Tab 2 Validation (validate_tab2 endpoint) ──

public class Tab2ValidationInput
{
    public int? ObjectiveId { get; set; }
    public int? NatureId { get; set; }
    public bool IsGroupClassificationEnable { get; set; }
    public int? GroupClassificationId { get; set; }
    public bool ShowExternalProductDropdown { get; set; }
    public string? ExternalProductId { get; set; }
    public string? ProjectName { get; set; }
    public string? ProjectLeadName { get; set; }
    public string? ProjectSponsorName { get; set; }
    public bool IsRegionalApprovalRequired { get; set; }
    public string? RegionalApproverId { get; set; }
    public int? TransformationStatusId { get; set; }
    public string? TransformationStatusDate { get; set; }
    public bool IsDmaicPath { get; set; }
    public int? DmaicProjectStatusId { get; set; }
    public string? DmaicProjectStatusDate { get; set; }
    public bool IsDataAnalyticsPath { get; set; }
    public bool IsProjectStatusEnableForWithoutPSI { get; set; }
    public int? ProjectStatusId { get; set; }
    public string? ProjectStatusDate { get; set; }
    public int? UrgencyId { get; set; }
    public int? StrategicValueId { get; set; }
}

public class Tab2ValidationResult
{
    public bool Valid { get; set; }
    public string? FirstMissingField { get; set; }
    public string? Message { get; set; }
}

// ── LLM Smart Match (AI-driven fuzzy matching) ──
public class SmartMatchInput
{
    public string Field { get; set; } = "";
    public string UserValue { get; set; } = "";
    public List<string> Options { get; set; } = new();
}

public class SmartMatchResult
{
    public string? MatchedName { get; set; }
    public double Confidence { get; set; }
}

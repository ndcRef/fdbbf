export const environment = {
  production: false,

  // ── AI Engine (backend proxy) ──
  aiGatewayUrl: 'http://localhost:5000',
  aiGatewayEndpoint: '/api/ProjectWizard/execute',

  // ── TC Platform Auth ──
  aiAuthToken: '',
  aiUserId: '5',

  // ── TC Platform APIs (used by backend proxy) ──
  aiUserApiBase: '',
  aiOpportunityApiBase: '',
  aiApiVersion: '1.0',

  
  aiLlmUrl: '',
  aiLlmChatId: '0',
  aiLlmUserUpn: '2',
  aiLlmChatArea: 'sdlc-details',
  aiLlmFlowId: '2491',
  aiLlmProjectId: '3115',
  aiLlmVersionId: '1',
};

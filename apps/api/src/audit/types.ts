export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type AnalyzerFinding = {
  title: string;
  category: string;
  severity: Severity;
  confidence: number;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
  explanation: string;
  recommendation: string;
  source: 'SLITHER' | 'MYTHRIL' | 'AST' | 'AI';
};

export type AiAuditJson = {
  executiveSummary: string;
  overallScore: number;
  vulnerabilities: Array<AnalyzerFinding & { fixedCode?: string }>;
  gasOptimizations: Array<{ title: string; impact: string; recommendation: string; code?: string }>;
  recommendations: Array<{ type: string; title: string; body: string; code?: string }>;
};

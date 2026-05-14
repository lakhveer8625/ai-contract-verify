export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type Vulnerability = {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  explanation: string;
  recommendation: string;
  file?: string;
  lineStart?: number;
  fixedCode?: string;
};

export type Audit = {
  id: string;
  title: string;
  status: string;
  overallScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  executiveSummary?: string;
  gasOptimizations?: Array<{ title: string; impact: string; recommendation: string }>;
  vulnerabilities: Vulnerability[];
  reports: Array<{ id: string; pdfPath?: string }>;
  createdAt: string;
};

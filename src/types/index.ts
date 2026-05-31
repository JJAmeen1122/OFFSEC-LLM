export interface ScanCommand {
  id: string;
  command: string;
  output: string;
  status: 'success' | 'error' | 'running';
  stage: string;
  rawOutput?: string;
  summary?: string;
  tool?: string;
  
}

export interface ScanResult {
  id: string;
  target: string;
  scanType: string;
  status: 'scanning' | 'completed' | 'error';
  progress: number;
  currentStage: string;
  startTime: string;
  endTime?: string;
  commands: ScanCommand[];
  aiAnalysis?: string;
  toolsCalled?: string[];
  vulnerabilitiesCount?: number;
  pdfUrl?: string;       // e.g. /api/report/download/pentest_report_xxx.pdf
  pdfFilename?: string;  // e.g. pentest_report_xxx.pdf
}

export interface HackingStage {
  stage: number;
  name: string;
  tool: string;
  desc: string;
  progress: number;
  icon: string;
}
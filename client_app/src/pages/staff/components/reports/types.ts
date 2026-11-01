export interface Signatory {
  name: string;
  designation: string;
  date?: string;
}

export interface SignatoriesMap {
  clerk?: Signatory;
  placement_officer?: Signatory;
  dean?: Signatory;
  vice_principal?: Signatory;
  [key: string]: Signatory | undefined;
}

export interface PlacementRegisterEntry {
  id?: number;
  report?: number;
  sr_no: number;
  branch: string;
  division?: string;
  tnp_uid: string;
  student_name: string;
  employer_visit_date: string;
  employer_category: "CAT-1" | "CAT-2" | "CAT-3";
  placement_type: "Regular" | "HackwithInfy" | "AEDP" | "PLI" | "OJT" | "Off-Campus";
  employer_name: string;
  stipend_offered: string;
  salary_lpa: number | null;
  num_offers: number | null;
  remark: string;
  dual_offer: boolean;
  campus_on_off: "ON" | "OFF";
  date_of_joining?: string | null;
}

export interface CompanyRecord {
  id?: number;
  report?: number | null;
  company_name: string;
  first_visit_year: string;
  mnc_status: string;
  criteria_yes_no: string;
  technical_yes_no: string;
  batch_data: Record<string, string>;
  notes?: string;
  is_current_batch: boolean;
}

export interface MonthData {
  companies: number;
  placed: number;
}

export interface PhaseWiseReport {
  id?: number;
  report?: number;
  phase: "I" | "II" | "III";
  total_admitted: number;
  opt_out: number;
  opted_higher_studies: number;
  interested: number;
  eligible: number;
  companies_visited: number;
  students_placed: number;
  monthly_data: Record<string, MonthData>;
  off_campus_placed: number;
  due_date?: string | null;
  completion_date?: string | null;
  reason_if_late?: string;
  sub_total?: number;
  placement_percentage?: number;
}

export interface ReportStatistics {
  students_placed: number;
  total_offers: number;
  on_campus: number;
  off_campus: number;
  cumulative_total: number;
  cumulative_pct_interested: number;
  cumulative_pct_eligible: number;
  cumulative_pct_not_eligible: number;
  super_dream_dream_count: number;
  companies_visited: number;
  salary: {
    max: number | null;
    min: number | null;
    avg: number | null;
    median: number | null;
    mode: number | null;
  };
  stipend: {
    max: number | null;
    min: number | null;
    avg: number | null;
    median: number | null;
    mode: number | null;
  };
  placement_pct_of_interested: number;
  placement_pct_of_eligible: number;
  placement_pct_of_not_eligible: number;
  avg_placement_index: number;
}

export interface Phase1Process {
  sr_no: number;
  notice_month: string;
  date_of_process: string;
  name_of_employer: string;
  employer_category: string;
  type_of_placement: string;
  salary_lpa: number | string;
  selected: number;
  appeared: number;
  pct_age?: string;
  offers_cum?: number;
  students_cum?: number;
  is_first?: boolean;
}

export interface PlacementReport {
  id?: number;
  batch: string;
  program: string;
  ref_no: string;
  report_no: string;
  revision: string;
  report_date: string | null;
  admitted_final_year: number;
  opt_out: number;
  interested: number;
  eligible: number;
  not_eligible: number;
  due_date?: string | null;
  completion_date?: string | null;
  reason_if_late?: string;
  signatories: SignatoriesMap;
  copy_to: string[];
  phase1_processes?: Phase1Process[];
  is_draft: boolean;
  register_entries?: PlacementRegisterEntry[];
  phase_reports?: PhaseWiseReport[];
  company_records?: CompanyRecord[];
  statistics?: ReportStatistics;
  created_at?: string;
  updated_at?: string;
}

// Statistical calculation helper for array of numbers
export function calculateStats(values: number[]): {
  max: number | null;
  min: number | null;
  avg: number | null;
  median: number | null;
  mode: number | null;
} {
  const filtered = values.filter((v) => v !== null && !isNaN(v));
  if (filtered.length === 0) {
    return { max: null, min: null, avg: null, median: null, mode: null };
  }

  const sorted = [...filtered].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  const sum = sorted.reduce((acc, curr) => acc + curr, 0);
  const avg = Number((sum / sorted.length).toFixed(4));

  // Median
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
      : sorted[mid];

  // Mode
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = sorted[0];
  for (const num of sorted) {
    counts[num] = (counts[num] || 0) + 1;
    if (counts[num] > maxCount) {
      maxCount = counts[num];
      mode = num;
    }
  }

  return { max, min, avg, median, mode };
}


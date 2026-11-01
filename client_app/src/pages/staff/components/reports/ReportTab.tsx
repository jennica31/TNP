import React, { useState, useMemo } from "react";
import {
  PlacementReport,
  PlacementRegisterEntry,
  PhaseWiseReport,
  Phase1Process,
  calculateStats,
} from "./types";
import {
  Edit3,
  Eye,
  Plus,
  Trash2,
} from "lucide-react";

interface Props {
  report: PlacementReport;
  entries: PlacementRegisterEntry[];
  phaseReports?: PhaseWiseReport[];
  onUpdateReport?: (updatedReport: PlacementReport) => void;
}

// Initial Phase 1 company processes from Excel reference
export const DEFAULT_PHASE1_PROCESSES: Phase1Process[] = [
  { sr_no: 1, notice_month: "April", date_of_process: "09-04-2026 & 09/09/2029", name_of_employer: "Infosys-Specialist programmer", employer_category: "CAT-1", type_of_placement: "HackwithInfy", salary_lpa: "10.00", selected: 0, appeared: 46, pct_age: "0.0%" },
  { sr_no: 1, notice_month: "", date_of_process: "", name_of_employer: "Infosys-Digital Specialist Engineer", employer_category: "CAT-2", type_of_placement: "HackwithInfy", salary_lpa: "6.25", selected: 1, appeared: 46, pct_age: "2.17%" },
  { sr_no: 2, notice_month: "June", date_of_process: "24/06/2026 & 25/06/2026", name_of_employer: "Tata Consultancy Service-Prime", employer_category: "CAT-1", type_of_placement: "Regular", salary_lpa: "11.59", selected: 0, appeared: 42, pct_age: "0.0%" },
  { sr_no: 2, notice_month: "June", date_of_process: "24/06/2026 & 25/06/2026", name_of_employer: "Tata Consultancy Service-Digital", employer_category: "CAT-2", type_of_placement: "Regular", salary_lpa: "7.39", selected: 1, appeared: 42, pct_age: "2.38%" },
  { sr_no: 2, notice_month: "June", date_of_process: "24/06/2026 & 25/06/2026", name_of_employer: "Tata Consultancy Service-Ninja", employer_category: "CAT-3", type_of_placement: "Regular", salary_lpa: "3.62", selected: 1, appeared: 42, pct_age: "2.38%" },
  { sr_no: 3, notice_month: "August", date_of_process: "—", name_of_employer: "HyperVerge", employer_category: "CAT-1", type_of_placement: "AEDP", salary_lpa: "14.00", selected: 0, appeared: 220, pct_age: "In Process" },
  { sr_no: 4, notice_month: "August", date_of_process: "26/08/2026", name_of_employer: "C2L BIZ Solutions Pvt. Ltd.", employer_category: "CAT-3", type_of_placement: "Regular", salary_lpa: "3.50", selected: 2, appeared: 71, pct_age: "In Process" },
  { sr_no: 5, notice_month: "August", date_of_process: "04/09/2026", name_of_employer: "Interactive Brokers Group, Inc.", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "6.73", selected: 0, appeared: 62, pct_age: "In Process" },
  { sr_no: 6, notice_month: "August", date_of_process: "05/09/2026", name_of_employer: "Airdawg Labs Caudal AI Labs Pvt. Ltd.", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "6.00", selected: 3, appeared: 43, pct_age: "6.98%" },
  { sr_no: 7, notice_month: "August", date_of_process: "08/09/2026", name_of_employer: "LDS infotech Pvt Ltd.", employer_category: "CAT-3", type_of_placement: "AEDP", salary_lpa: "4.80", selected: 0, appeared: 22, pct_age: "0.0%" },
  { sr_no: 8, notice_month: "August", date_of_process: "09/09/2026", name_of_employer: "WisdmLabs", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "5.00", selected: 0, appeared: 39, pct_age: "In Process" },
  { sr_no: 9, notice_month: "August", date_of_process: "10/09/2026", name_of_employer: "Real Value Infospace", employer_category: "CAT-2", type_of_placement: "PLI", salary_lpa: "3.75", selected: 0, appeared: 15, pct_age: "In Process" },
  { sr_no: 10, notice_month: "August", date_of_process: "11/09/2026", name_of_employer: "Vital Edge Technologies", employer_category: "CAT-3", type_of_placement: "AEDP", salary_lpa: "4.20", selected: 0, appeared: 61, pct_age: "In Process" },
  { sr_no: 11, notice_month: "August", date_of_process: "—", name_of_employer: "JISA Softech Pvt. Ltd.", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "5.00", selected: 0, appeared: 27, pct_age: "In Process" },
  { sr_no: 12, notice_month: "August", date_of_process: "—", name_of_employer: "Hexaware", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "6.00", selected: 0, appeared: 7, pct_age: "In Process" },
  { sr_no: 13, notice_month: "September", date_of_process: "16/09/2026", name_of_employer: "PriceLabs", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "7.50", selected: 0, appeared: 11, pct_age: "In Process" },
  { sr_no: 14, notice_month: "September", date_of_process: "—", name_of_employer: "Vistex Asia Pacific Pvt. Ltd.", employer_category: "CAT-3", type_of_placement: "PLI", salary_lpa: "4.50", selected: 0, appeared: 39, pct_age: "In Process" },
  { sr_no: 15, notice_month: "September", date_of_process: "—", name_of_employer: "Newgen Software", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "5.00", selected: 0, appeared: 28, pct_age: "In Process" },
  { sr_no: 16, notice_month: "September", date_of_process: "—", name_of_employer: "2Factor", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "5.00", selected: 0, appeared: 18, pct_age: "In Process" },
  { sr_no: 17, notice_month: "October", date_of_process: "05/10/2026 & 06/10/2026", name_of_employer: "Capgemini-dev", employer_category: "CAT-2", type_of_placement: "Regular", salary_lpa: "5.75", selected: 2, appeared: 88, pct_age: "2.27%" },
  { sr_no: 17, notice_month: "October", date_of_process: "05/10/2026 & 06/10/2026", name_of_employer: "Capgemini-spark", employer_category: "CAT-3", type_of_placement: "Regular", salary_lpa: "4.25", selected: 6, appeared: 88, pct_age: "6.82%" },
  { sr_no: 18, notice_month: "October", date_of_process: "—", name_of_employer: "Fact Wise", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "6.00", selected: 0, appeared: 22, pct_age: "In Process" },
  { sr_no: 19, notice_month: "October", date_of_process: "—", name_of_employer: "Quantum Phinance Pvt. Ltd.", employer_category: "CAT-2", type_of_placement: "AEDP", salary_lpa: "6.50", selected: 0, appeared: 14, pct_age: "In Process" },
];

export const ReportTab: React.FC<Props> = ({
  report,
  entries,
  onUpdateReport,
}) => {
  // Mode toggle: true = Editable Preparation Mode, false = Official Report View
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Active Phase-1 process records
  const processes: Phase1Process[] = useMemo(() => {
    if (report.phase1_processes && report.phase1_processes.length > 0) {
      return report.phase1_processes;
    }
    return DEFAULT_PHASE1_PROCESSES;
  }, [report.phase1_processes]);

  // Modal for adding a new company process
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newProcess, setNewProcess] = useState<Partial<Phase1Process>>({
    sr_no: processes.length + 1,
    notice_month: "October",
    date_of_process: "",
    name_of_employer: "",
    employer_category: "CAT-2",
    type_of_placement: "Regular",
    salary_lpa: "5.00",
    selected: 0,
    appeared: 50,
  });

  // Calculate live placement stats
  const stats = useMemo(() => {
    // 1. Placement salaries from register entries or fallback to process table
    const salariesFromRegister = entries
      .map((e) => e.salary_lpa)
      .filter((s): s is number => s !== null && s > 0);

    const salariesFromProcesses = processes
      .filter((p) => Number(p.selected) > 0)
      .map((p) => parseFloat(String(p.salary_lpa)))
      .filter((s) => !isNaN(s) && s > 0);

    const activeSalaries = salariesFromRegister.length > 0 ? salariesFromRegister : salariesFromProcesses;
    const salaryStats = calculateStats(activeSalaries);

    // 2. Placed counts
    const placedFromProcesses = processes.reduce((acc, curr) => acc + (Number(curr.selected) || 0), 0);
    const placedCount = entries.length > 0 ? entries.length : placedFromProcesses;

    const singleOffers = entries.length > 0 ? entries.filter((e) => !e.dual_offer).length : placedCount;
    const dualOffers = entries.length > 0 ? entries.filter((e) => e.dual_offer).length : 0;
    const onCampus = entries.length > 0 ? entries.filter((e) => e.campus_on_off === "ON").length : placedCount;
    const offCampus = entries.length > 0 ? entries.filter((e) => e.campus_on_off === "OFF").length : 0;

    const superDreamDream = entries.length > 0
      ? entries.filter((e) => e.employer_category === "CAT-1" || e.employer_category === "CAT-2").length
      : processes.filter((p) => (p.employer_category === "CAT-1" || p.employer_category === "CAT-2") && Number(p.selected) > 0)
          .reduce((acc, curr) => acc + Number(curr.selected), 0);

    const admitted = report.admitted_final_year || 125;
    const optOut = report.opt_out || 4;
    const interested = admitted - optOut;
    const eligible = report.eligible || (interested - 4);
    const notEligible = Math.max(0, interested - eligible);

    const pctInterested = interested > 0 ? ((placedCount / interested) * 100).toFixed(2) : "0.00";
    const pctEligible = eligible > 0 ? ((placedCount / eligible) * 100).toFixed(2) : "0.00";
    const pctNotEligible = notEligible > 0 ? ((offCampus / notEligible) * 100).toFixed(2) : "0.00";

    const avgPlacementIndex = admitted > 0 ? (placedCount / admitted).toFixed(2) : "0.00";
    const superDreamPct = interested > 0 ? ((superDreamDream / interested) * 100).toFixed(2) : "0.00";

    // Count distinct companies visited
    const uniqueEmployers = Array.from(new Set(processes.map((p) => p.name_of_employer.trim()))).filter(Boolean).length;

    return {
      placedCount,
      uniqueEmployers,
      totalOffers: entries.length > 0 ? entries.reduce((acc, curr) => acc + (curr.num_offers || 1), 0) : placedCount,
      singleOffers,
      dualOffers,
      onCampus,
      offCampus,
      superDreamDream,
      superDreamPct,
      admitted,
      optOut,
      interested,
      eligible,
      notEligible,
      pctInterested,
      pctEligible,
      pctNotEligible,
      avgPlacementIndex,
      salaryStats,
      companiesVisited: uniqueEmployers || 19,
    };
  }, [entries, report, processes]);

  // Handler for metadata and statistics updates
  const handleReportFieldChange = (field: keyof PlacementReport, value: any) => {
    if (!onUpdateReport) return;
    const updated = { ...report, [field]: value };
    // Auto calculate interested if admitted or opt_out changed
    if (field === "admitted_final_year" || field === "opt_out") {
      const adm = field === "admitted_final_year" ? Number(value) : (report.admitted_final_year || 0);
      const opt = field === "opt_out" ? Number(value) : (report.opt_out || 0);
      updated.interested = Math.max(0, adm - opt);
    }
    // Auto calculate not_eligible if eligible changed
    if (field === "eligible") {
      const el = Number(value);
      const intr = updated.interested || (report.admitted_final_year - report.opt_out);
      updated.not_eligible = Math.max(0, intr - el);
    }
    onUpdateReport(updated);
  };

  // Handler for signatory changes
  const handleSignatoryChange = (role: string, field: string, value: string) => {
    if (!onUpdateReport) return;
    const signatories = { ...report.signatories };
    signatories[role] = {
      ...(signatories[role] || { name: "", designation: "", date: "" }),
      [field]: value,
    };
    onUpdateReport({ ...report, signatories });
  };

  // Handler for updating a process table row inline
  const handleProcessRowChange = (index: number, field: keyof Phase1Process, value: any) => {
    if (!onUpdateReport) return;
    const updatedList = [...processes];
    const item = { ...updatedList[index], [field]: value };

    // Auto calculate % age if appeared and selected are updated
    if (field === "selected" || field === "appeared") {
      const sel = field === "selected" ? Number(value) : Number(item.selected);
      const app = field === "appeared" ? Number(value) : Number(item.appeared);
      if (app > 0 && !isNaN(sel)) {
        item.pct_age = `${((sel / app) * 100).toFixed(2)}%`;
      }
    }

    updatedList[index] = item;
    onUpdateReport({ ...report, phase1_processes: updatedList });
  };

  // Delete a process row
  const handleDeleteProcess = (index: number) => {
    if (!window.confirm("Are you sure you want to remove this placement process record?")) return;
    if (!onUpdateReport) return;
    const updatedList = processes.filter((_, i) => i !== index);
    onUpdateReport({ ...report, phase1_processes: updatedList });
  };

  // Add new process row
  const handleAddProcess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProcess.name_of_employer?.trim()) {
      alert("Please provide the Name of Employer.");
      return;
    }
    const sel = Number(newProcess.selected) || 0;
    const app = Number(newProcess.appeared) || 0;
    const pct = app > 0 ? `${((sel / app) * 100).toFixed(2)}%` : "In Process";

    const item: Phase1Process = {
      sr_no: Number(newProcess.sr_no) || processes.length + 1,
      notice_month: newProcess.notice_month || "",
      date_of_process: newProcess.date_of_process || "—",
      name_of_employer: newProcess.name_of_employer.trim(),
      employer_category: newProcess.employer_category || "CAT-2",
      type_of_placement: newProcess.type_of_placement || "Regular",
      salary_lpa: newProcess.salary_lpa || "5.00",
      selected: sel,
      appeared: app,
      pct_age: pct,
    };

    const updatedList = [...processes, item];
    if (onUpdateReport) {
      onUpdateReport({ ...report, phase1_processes: updatedList });
    }
    setShowAddModal(false);
    setNewProcess({
      sr_no: updatedList.length + 1,
      notice_month: "October",
      date_of_process: "",
      name_of_employer: "",
      employer_category: "CAT-2",
      type_of_placement: "Regular",
      salary_lpa: "5.00",
      selected: 0,
      appeared: 50,
    });
  };

  // Accreditation Mapping Matrix from Excel
  const accreditationRows = [
    { sr: "1", agency: "Institute", p1: true, p2: true, p3: true, p4: true, p5: true, p6: true, p7: true, p8: false },
    { sr: "2", agency: "NBA", p1: false, p2: true, p3: false, p4: false, p5: true, p6: true, p7: true, p8: true },
    { sr: "3", agency: "NAAC", p1: true, p2: false, p3: true, p4: false, p5: true, p6: true, p7: true, p8: false },
    { sr: "4", agency: "NIRF", p1: true, p2: false, p3: false, p4: true, p5: false, p6: true, p7: true, p8: false },
    { sr: "5", agency: "AICTE-CII", p1: true, p2: false, p3: false, p4: true, p5: false, p6: true, p7: true, p8: false },
    { sr: "6", agency: "IMC", p1: true, p2: false, p3: true, p4: true, p5: false, p6: true, p7: true, p8: false },
    { sr: "7", agency: "Other Rating and Ranking Agencies viz. Outlook, etc.", p1: false, p2: false, p3: false, p4: true, p5: true, p6: true, p7: true, p8: false },
  ];

  return (
    <div className="space-y-6 print-area">
      {/* ── Mode Switch & Clerk Action Header (Screen-only, no-print) ── */}
      <div className="no-print bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md transition-all ${
                !isEditMode
                  ? "bg-white text-blue-700 shadow-sm border border-gray-200/60 font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Official View</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md transition-all ${
                isEditMode
                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Workspace</span>
            </button>
          </div>

          <span className="text-xs text-gray-500 hidden sm:inline">
            {isEditMode
              ? "All report values, processes, admission data, and approvals are directly editable below."
              : "Showing official, printable report preview with active calculated statistics."}
          </span>
        </div>

        {isEditMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-blue-600 rounded-lg text-xs font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Company Process</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Official Institutional Document Header ── */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center">
        <h1 className="text-2xl font-bold tracking-wider text-gray-900 uppercase">
          Thakur College of Engineering and Technology (TCET)
        </h1>
        <h2 className="text-base font-semibold text-blue-900 mt-1">
          Placement Data Analysis ({report.batch} Batch) {report.program}
        </h2>

        {/* Document Metadata Bar */}
        <div className="flex flex-wrap justify-between items-center text-xs text-gray-600 mt-3 pt-3 border-t border-gray-200 px-2 font-mono gap-2">
          {isEditMode ? (
            <div className="w-full grid grid-cols-1 sm:grid-cols-4 gap-2 text-left font-sans">
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold uppercase">Form Ref No.</label>
                <input
                  type="text"
                  value={report.ref_no || ""}
                  onChange={(e) => handleReportFieldChange("ref_no", e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs border rounded bg-gray-50 border-gray-300 font-mono"
                  placeholder="TCET/TNP/FRM/IP-06/09"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold uppercase">Revision</label>
                <select
                  value={report.revision || "B"}
                  onChange={(e) => handleReportFieldChange("revision", e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs border rounded bg-gray-50 border-gray-300 font-sans"
                >
                  <option value="A">Revision A</option>
                  <option value="B">Revision B</option>
                  <option value="C">Revision C</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold uppercase">Report Dispatch Ref</label>
                <input
                  type="text"
                  value={report.report_no || ""}
                  onChange={(e) => handleReportFieldChange("report_no", e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs border rounded bg-gray-50 border-gray-300 font-mono"
                  placeholder="TCET/ T&P / REP 94 of 2026"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold uppercase">Report Date</label>
                <input
                  type="date"
                  value={report.report_date || "2026-10-16"}
                  onChange={(e) => handleReportFieldChange("report_date", e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs border rounded bg-gray-50 border-gray-300 font-mono"
                />
              </div>
            </div>
          ) : (
            <>
              <span>{report.ref_no || "TCET/TNP/FRM/IP-06/09"}</span>
              <span className="font-bold bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded font-sans">
                Revision: {report.revision || "B"}
              </span>
              <span>REF: {report.report_no || "TCET/ T&P / REP  94    of 2026"}</span>
              <span>Date: {report.report_date || "16/10/2026"}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Section A: Placement Statistics for Phase-I (01) ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3.5 px-5 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-bold tracking-wide">
              1. Placement Statistics for Phase-I (01) — {report.program}
            </h3>
            <p className="text-[11px] text-blue-200 mt-0.5">
              Individual placement drive processes and cumulative company selections
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded font-medium">
              Batch ({report.batch})
            </span>
            {isEditMode && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="no-print inline-flex items-center gap-1.5 h-7 px-3 bg-white hover:bg-gray-100 active:bg-gray-200 text-blue-900 rounded-md text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-blue-700" />
                <span>Add Process Row</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 02 & 03 Admission Summary Banner (Dynamic Live Sync) */}
        <div className="bg-blue-50/60 border-b border-blue-200 p-3 px-5 grid grid-cols-2 md:grid-cols-7 gap-2 text-center text-xs">
          <div>
            <span className="text-gray-500 block text-[10px]">Admitted (02)</span>
            {isEditMode ? (
              <input
                type="number"
                value={report.admitted_final_year || 125}
                onChange={(e) => handleReportFieldChange("admitted_final_year", Number(e.target.value))}
                className="w-16 mx-auto text-center font-extrabold text-gray-900 text-sm border rounded bg-white px-1 py-0.5"
              />
            ) : (
              <span className="font-extrabold text-gray-900 text-sm">{stats.admitted}</span>
            )}
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Opt Out (02)</span>
            {isEditMode ? (
              <input
                type="number"
                value={report.opt_out || 4}
                onChange={(e) => handleReportFieldChange("opt_out", Number(e.target.value))}
                className="w-16 mx-auto text-center font-extrabold text-gray-900 text-sm border rounded bg-white px-1 py-0.5"
              />
            ) : (
              <span className="font-extrabold text-gray-900 text-sm">{stats.optOut}</span>
            )}
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Interested (Auto)</span>
            <span className="font-extrabold text-blue-700 text-sm">{stats.interested}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Eligible (02)</span>
            {isEditMode ? (
              <input
                type="number"
                value={report.eligible || 117}
                onChange={(e) => handleReportFieldChange("eligible", Number(e.target.value))}
                className="w-16 mx-auto text-center font-extrabold text-gray-900 text-sm border rounded bg-white px-1 py-0.5"
              />
            ) : (
              <span className="font-extrabold text-gray-900 text-sm">{stats.eligible}</span>
            )}
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Not-Eligible (Auto)</span>
            <span className="font-extrabold text-gray-900 text-sm">{stats.notEligible}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Companies Visited</span>
            <span className="font-extrabold text-purple-700 text-sm">{stats.companiesVisited}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Placed (Phase-I)</span>
            <span className="font-extrabold text-emerald-700 text-sm">{stats.placedCount}</span>
          </div>
        </div>

        {/* Process Table with Editable Row Support */}
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse border border-gray-300 official-table">
            <thead className="bg-gray-100 font-bold text-gray-800 text-center">
              <tr>
                <th className="p-1.5 border border-gray-300 w-10">Sr. No.</th>
                <th className="p-1.5 border border-gray-300 w-20">Notice Month</th>
                <th className="p-1.5 border border-gray-300 w-28">Date of Process</th>
                <th className="p-1.5 border border-gray-300 min-w-[180px] text-left">Name of Employer</th>
                <th className="p-1.5 border border-gray-300 w-16">Category</th>
                <th className="p-1.5 border border-gray-300 w-20">Type</th>
                <th className="p-1.5 border border-gray-300 w-20 text-right">Salary (LPA)</th>
                <th className="p-1.5 border border-gray-300 w-14">Selected</th>
                <th className="p-1.5 border border-gray-300 w-14">Appeared</th>
                <th className="p-1.5 border border-gray-300 w-16">% age</th>
                <th className="p-1.5 border border-gray-300 bg-blue-50 text-blue-950 font-bold" colSpan={7}>
                  Admission, Consent & Eligibility Status
                </th>
                {isEditMode && <th className="p-1.5 border border-gray-300 w-12 no-print">Actions</th>}
              </tr>
              <tr className="bg-blue-50 text-blue-900 text-[10px]">
                <th colSpan={10} className="border border-gray-300 bg-gray-50 text-gray-500">
                  Process Details
                </th>
                <th className="border border-gray-300 p-1 w-14">Admitted</th>
                <th className="border border-gray-300 p-1 w-14">Opt Out</th>
                <th className="border border-gray-300 p-1 w-14">Interested</th>
                <th className="border border-gray-300 p-1 w-14">Eligible</th>
                <th className="border border-gray-300 p-1 w-14">Not Eligible</th>
                <th className="border border-gray-300 p-1 w-14">Companies</th>
                <th className="border border-gray-300 p-1 w-14">Placed</th>
                {isEditMode && <th className="border border-gray-300 p-1 no-print"></th>}
              </tr>
            </thead>
            <tbody>
              {processes.map((c, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {/* Sr. No */}
                  <td className="p-1.5 border border-gray-300 text-center font-medium text-gray-600">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={c.sr_no || ""}
                        onChange={(e) => handleProcessRowChange(idx, "sr_no", e.target.value)}
                        className="w-8 text-center border rounded p-0.5 text-[10px]"
                      />
                    ) : (
                      c.sr_no || ""
                    )}
                  </td>

                  {/* Notice Month */}
                  <td className="p-1.5 border border-gray-300 text-gray-700">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={c.notice_month || ""}
                        onChange={(e) => handleProcessRowChange(idx, "notice_month", e.target.value)}
                        className="w-16 border rounded p-0.5 text-[10px]"
                      />
                    ) : (
                      c.notice_month
                    )}
                  </td>

                  {/* Date of Process */}
                  <td className="p-1.5 border border-gray-300 font-mono text-[10px] text-gray-600">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={c.date_of_process || ""}
                        onChange={(e) => handleProcessRowChange(idx, "date_of_process", e.target.value)}
                        className="w-24 border rounded p-0.5 text-[10px]"
                      />
                    ) : (
                      c.date_of_process
                    )}
                  </td>

                  {/* Name of Employer */}
                  <td className="p-1.5 border border-gray-300 font-medium text-gray-900">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={c.name_of_employer || ""}
                        onChange={(e) => handleProcessRowChange(idx, "name_of_employer", e.target.value)}
                        className="w-full border rounded p-0.5 text-[11px] font-medium"
                      />
                    ) : (
                      c.name_of_employer
                    )}
                  </td>

                  {/* Category */}
                  <td className="p-1.5 border border-gray-300 text-center">
                    {isEditMode ? (
                      <select
                        value={c.employer_category || "CAT-2"}
                        onChange={(e) => handleProcessRowChange(idx, "employer_category", e.target.value)}
                        className="border rounded p-0.5 text-[10px]"
                      >
                        <option value="CAT-1">CAT-1</option>
                        <option value="CAT-2">CAT-2</option>
                        <option value="CAT-3">CAT-3</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          String(c.employer_category).toUpperCase().includes("CAT-1")
                            ? "bg-purple-100 text-purple-800"
                            : String(c.employer_category).toUpperCase().includes("CAT-2")
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {c.employer_category}
                      </span>
                    )}
                  </td>

                  {/* Type */}
                  <td className="p-1.5 border border-gray-300 text-gray-700">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={c.type_of_placement || ""}
                        onChange={(e) => handleProcessRowChange(idx, "type_of_placement", e.target.value)}
                        className="w-16 border rounded p-0.5 text-[10px]"
                      />
                    ) : (
                      c.type_of_placement
                    )}
                  </td>

                  {/* Salary (LPA) */}
                  <td className="p-1.5 border border-gray-300 text-right font-bold text-gray-800">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={c.salary_lpa || ""}
                        onChange={(e) => handleProcessRowChange(idx, "salary_lpa", e.target.value)}
                        className="w-14 text-right border rounded p-0.5 text-[10px] font-bold"
                      />
                    ) : (
                      c.salary_lpa
                    )}
                  </td>

                  {/* Selected */}
                  <td className="p-1.5 border border-gray-300 text-center font-bold text-emerald-700">
                    {isEditMode ? (
                      <input
                        type="number"
                        value={c.selected ?? 0}
                        onChange={(e) => handleProcessRowChange(idx, "selected", e.target.value)}
                        className="w-10 text-center border rounded p-0.5 text-[10px] font-bold text-emerald-700"
                      />
                    ) : (
                      c.selected
                    )}
                  </td>

                  {/* Appeared */}
                  <td className="p-1.5 border border-gray-300 text-center text-gray-600">
                    {isEditMode ? (
                      <input
                        type="number"
                        value={c.appeared ?? 0}
                        onChange={(e) => handleProcessRowChange(idx, "appeared", e.target.value)}
                        className="w-12 text-center border rounded p-0.5 text-[10px]"
                      />
                    ) : (
                      c.appeared
                    )}
                  </td>

                  {/* % age */}
                  <td className="p-1.5 border border-gray-300 text-center font-medium">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={c.pct_age || ""}
                        onChange={(e) => handleProcessRowChange(idx, "pct_age", e.target.value)}
                        className="w-14 text-center border rounded p-0.5 text-[10px]"
                      />
                    ) : (
                      c.pct_age
                    )}
                  </td>

                  {/* Summary columns (independent cells for clean multi-page print page-break support) */}
                  {idx === 0 ? (
                    <>
                      <td className="p-1.5 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50/70">
                        {stats.admitted}
                      </td>
                      <td className="p-1.5 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50/70">
                        {stats.optOut}
                      </td>
                      <td className="p-1.5 border border-gray-300 text-center font-bold text-blue-700 bg-gray-50/70">
                        {stats.interested}
                      </td>
                      <td className="p-1.5 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50/70">
                        {stats.eligible}
                      </td>
                      <td className="p-1.5 border border-gray-300 text-center font-bold text-gray-900 bg-gray-50/70">
                        {stats.notEligible}
                      </td>
                      <td className="p-1.5 border border-gray-300 text-center font-bold text-purple-700 bg-gray-50/70">
                        {stats.companiesVisited}
                      </td>
                      <td className="p-1.5 border border-gray-300 text-center font-bold text-emerald-700 bg-emerald-50/70">
                        {stats.placedCount}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-1.5 border border-gray-300 text-center text-gray-300 bg-gray-50/20">—</td>
                      <td className="p-1.5 border border-gray-300 text-center text-gray-300 bg-gray-50/20">—</td>
                      <td className="p-1.5 border border-gray-300 text-center text-gray-300 bg-gray-50/20">—</td>
                      <td className="p-1.5 border border-gray-300 text-center text-gray-300 bg-gray-50/20">—</td>
                      <td className="p-1.5 border border-gray-300 text-center text-gray-300 bg-gray-50/20">—</td>
                      <td className="p-1.5 border border-gray-300 text-center text-gray-300 bg-gray-50/20">—</td>
                      <td className="p-1.5 border border-gray-300 text-center text-gray-300 bg-gray-50/20">—</td>
                    </>
                  )}

                  {/* Actions column in edit mode */}
                  {isEditMode && (
                    <td className="p-1 border border-gray-300 text-center no-print">
                      <button
                        type="button"
                        onClick={() => handleDeleteProcess(idx)}
                        className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete process"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section B: Comprehensive Placement Statistics (04 to 07) ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3.5 px-5">
          <h3 className="text-sm font-bold tracking-wide">
            2. Detailed Placement Statistics & Quality Analysis (Sections 04 - 07)
          </h3>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Left Column: Admission & Placement Figures */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 border-b pb-1.5 text-xs uppercase tracking-wider text-blue-900 flex items-center justify-between">
              <span>Students Admission, Consent & Cumulative Offers</span>
              {isEditMode && <span className="text-[10px] text-blue-600 font-normal lowercase">(auto-calculated)</span>}
            </h4>
            <table className="w-full border-collapse border border-gray-300 official-table">
              <tbody>
                <tr className="bg-gray-50 font-bold">
                  <td className="p-2 border border-gray-300">Total Number of Students Placed</td>
                  <td className="p-2 border border-gray-300 text-right font-extrabold text-blue-700">
                    {stats.placedCount}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Total Offers (Single + Dual)</td>
                  <td className="p-2 border border-gray-300 text-right font-semibold">
                    {stats.totalOffers}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Single Offers (On Campus)</td>
                  <td className="p-2 border border-gray-300 text-right">{stats.singleOffers}</td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Off-Campus Offers</td>
                  <td className="p-2 border border-gray-300 text-right">{stats.offCampus}</td>
                </tr>
                <tr className="bg-blue-50/50 font-medium">
                  <td className="p-2 border border-gray-300">
                    Cumulative Figures (On + Off Campus) out of Interested
                  </td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-blue-900">
                    {stats.placedCount} ({stats.pctInterested}%)
                  </td>
                </tr>
                <tr className="bg-blue-50/50 font-medium">
                  <td className="p-2 border border-gray-300">
                    Cumulative Figures (On + Off Campus) out of Eligible
                  </td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-blue-900">
                    {stats.placedCount} ({stats.pctEligible}%)
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">
                    Cumulative Figures (On + Off Campus) out of Not-Eligible
                  </td>
                  <td className="p-2 border border-gray-300 text-right">{stats.offCampus} ({stats.pctNotEligible}%)</td>
                </tr>
                <tr className="bg-gray-100 font-bold text-gray-900">
                  <td className="p-2 border border-gray-300">Students Admitted in Final Year</td>
                  <td className="p-2 border border-gray-300 text-right font-bold">{stats.admitted}</td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Opt Out of Campus Placement</td>
                  <td className="p-2 border border-gray-300 text-right font-medium">
                    {stats.optOut} ({((stats.optOut / (stats.admitted || 1)) * 100).toFixed(1)}%)
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Students Interested in Placement</td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-indigo-700">
                    {stats.interested} ({((stats.interested / (stats.admitted || 1)) * 100).toFixed(1)}%)
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Students Eligible for Placement</td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-indigo-700">
                    {stats.eligible} ({((stats.eligible / (stats.interested || 1)) * 100).toFixed(2)}%)
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Students Not-Eligible for Placement</td>
                  <td className="p-2 border border-gray-300 text-right font-medium text-gray-600">
                    {stats.notEligible} ({((stats.notEligible / (stats.interested || 1)) * 100).toFixed(2)}%)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Column: Percentage & Quality Analysis */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 border-b pb-1.5 text-xs uppercase tracking-wider text-blue-900">
              Placement Percentage & Salary Quality (06 & 07)
            </h4>
            <table className="w-full border-collapse border border-gray-300 official-table">
              <tbody>
                <tr className="bg-emerald-50/70 font-bold">
                  <td className="p-2 border border-gray-300">% of Placement out of Interested Students</td>
                  <td className="p-2 border border-gray-300 text-right font-extrabold text-emerald-800 text-sm">
                    {stats.pctInterested}%
                  </td>
                </tr>
                <tr className="bg-emerald-50/70 font-bold">
                  <td className="p-2 border border-gray-300">% of Placement out of Eligible Students</td>
                  <td className="p-2 border border-gray-300 text-right font-extrabold text-emerald-800 text-sm">
                    {stats.pctEligible}%
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">% of Placement out of Not-Eligible</td>
                  <td className="p-2 border border-gray-300 text-right">{stats.pctNotEligible}%</td>
                </tr>
                <tr className="bg-purple-50 font-semibold">
                  <td className="p-2 border border-gray-300">No. of Super Dream / Dream Placements</td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-purple-800">
                    {stats.superDreamDream} ({stats.superDreamPct}%)
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Maximum Salary (INR - LPA)</td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
                    {stats.salaryStats.max !== null ? `${stats.salaryStats.max} LPA` : "14.00 LPA"}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Minimum Salary (INR - LPA)</td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
                    {stats.salaryStats.min !== null ? `${stats.salaryStats.min} LPA` : "3.50 LPA"}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Average Salary (INR - LPA)</td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
                    {stats.salaryStats.avg !== null ? `${stats.salaryStats.avg} LPA` : "4.80 LPA"}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Median Salary (INR - LPA)</td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
                    {stats.salaryStats.median !== null ? `${stats.salaryStats.median} LPA` : "4.25 LPA"}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-gray-300">Mode Salary (INR - LPA)</td>
                  <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
                    {stats.salaryStats.mode !== null ? `${stats.salaryStats.mode} LPA` : "4.25 LPA"}
                  </td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td className="p-2 border border-gray-300">Number of Companies Visited</td>
                  <td className="p-2 border border-gray-300 text-right font-extrabold text-indigo-700">
                    {stats.companiesVisited}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Section C: Comparative Placement Data (08) & Accreditation Mapping ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3.5 px-5">
          <h3 className="text-sm font-bold tracking-wide">
            3. Comparative Placement Data (08) & Accrediting Bodies Mapping
          </h3>
        </div>

        <div className="p-6 space-y-6 text-xs">
          {/* NBA Parameter calculation */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h4 className="font-bold text-gray-900 mb-3 text-xs uppercase tracking-wider text-blue-900">
              NBA Parameter Calculation
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-lg border">
                <span className="text-gray-500 block">Total Final Year Regular Students (N)</span>
                <span className="text-xl font-extrabold text-gray-900 mt-1 block">
                  {stats.admitted}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <span className="text-gray-500 block">No. of Students Placed (X)</span>
                <span className="text-xl font-extrabold text-blue-700 mt-1 block">
                  {stats.placedCount}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <span className="text-gray-500 block">Total Placement Index</span>
                <span className="text-xl font-extrabold text-purple-700 mt-1 block">
                  {stats.placedCount}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <span className="text-gray-500 block">(X)/N (Average Placement)</span>
                <span className="text-xl font-extrabold text-emerald-700 mt-1 block">
                  {stats.avgPlacementIndex}
                </span>
              </div>
            </div>
          </div>

          {/* Accreditation Mapping Matrix Table */}
          <div>
            <h4 className="font-bold text-gray-900 mb-2 text-xs uppercase tracking-wider text-blue-900">
              Mapping with Accrediting Bodies / Rating / Ranking Agencies
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse border border-gray-300 official-table">
                <thead className="bg-gray-100 font-bold text-gray-800">
                  <tr>
                    <th className="p-2 border border-gray-300 w-12" rowSpan={2}>
                      Sr.No.
                    </th>
                    <th className="p-2 border border-gray-300 text-left min-w-[240px]" rowSpan={2}>
                      Mapping with Accrediting Bodies / Ranking Agencies
                    </th>
                    <th className="p-1 border border-gray-300 bg-blue-50 text-blue-900" colSpan={8}>
                      Report Section Matrix Mapping
                    </th>
                  </tr>
                  <tr className="bg-gray-50 text-[10px]">
                    <th className="p-1 border border-gray-300 w-10">1</th>
                    <th className="p-1 border border-gray-300 w-10">2</th>
                    <th className="p-1 border border-gray-300 w-10">3</th>
                    <th className="p-1 border border-gray-300 w-10">4</th>
                    <th className="p-1 border border-gray-300 w-10">5</th>
                    <th className="p-1 border border-gray-300 w-10">6</th>
                    <th className="p-1 border border-gray-300 w-10">7</th>
                    <th className="p-1 border border-gray-300 w-10">8</th>
                  </tr>
                </thead>
                <tbody>
                  {accreditationRows.map((row) => (
                    <tr key={row.sr} className="hover:bg-gray-50">
                      <td className="p-2 border border-gray-300 text-gray-500 font-medium">
                        {row.sr}
                      </td>
                      <td className="p-2 border border-gray-300 text-left font-semibold text-gray-800">
                        {row.agency}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {row.p1 ? <span className="text-emerald-600 font-bold text-sm">✓</span> : "—"}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {row.p2 ? <span className="text-emerald-600 font-bold text-sm">✓</span> : "—"}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {row.p3 ? <span className="text-emerald-600 font-bold text-sm">✓</span> : "—"}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {row.p4 ? <span className="text-emerald-600 font-bold text-sm">✓</span> : "—"}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {row.p5 ? <span className="text-emerald-600 font-bold text-sm">✓</span> : "—"}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {row.p6 ? <span className="text-emerald-600 font-bold text-sm">✓</span> : "—"}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {row.p7 ? <span className="text-emerald-600 font-bold text-sm">✓</span> : "—"}
                      </td>
                      <td className="p-2 border border-gray-300">
                        {row.p8 ? <span className="text-emerald-600 font-bold text-sm">✓</span> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-gray-500 mt-2">
              <strong>Section Key:</strong> 1: Phase-I Stats | 2: Admission, Consent & Eligibility | 3: Single Offer Placements | 4: Total Placed | 5: Consent & Admission | 6: % of Placement | 7: Quality of Placement | 8: Comparative Placement Data.
            </div>
          </div>
        </div>
      </div>

      {/* ── Section D: Official Approvals, Signatures & Copy To ── */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-xs space-y-5">
        <h3 className="font-bold text-gray-900 border-b pb-2 uppercase tracking-wider text-blue-900">
          Official Approvals & Signatures
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center signatures-grid">
          {/* Clerk */}
          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50/50 sig-block text-left sm:text-center">
            {isEditMode ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={report.signatories?.clerk?.name || "Rajesh Singh"}
                  onChange={(e) => handleSignatoryChange("clerk", "name", e.target.value)}
                  className="w-full text-center font-bold text-gray-900 text-xs border rounded p-1 bg-white"
                  placeholder="Clerk Name"
                />
                <input
                  type="text"
                  value={report.signatories?.clerk?.designation || "Sr.Clerk"}
                  onChange={(e) => handleSignatoryChange("clerk", "designation", e.target.value)}
                  className="w-full text-center text-gray-600 text-[11px] border rounded p-1 bg-white"
                  placeholder="Designation"
                />
                <input
                  type="text"
                  value={report.signatories?.clerk?.date || "16/10/26"}
                  onChange={(e) => handleSignatoryChange("clerk", "date", e.target.value)}
                  className="w-full text-center text-gray-500 text-[10px] border rounded p-1 bg-white"
                  placeholder="Date"
                />
              </div>
            ) : (
              <>
                <div className="font-bold text-gray-900 text-sm">
                  {report.signatories?.clerk?.name || "(Rajesh Singh)"}
                </div>
                <div className="text-gray-600 font-medium">
                  {report.signatories?.clerk?.designation || "Sr.Clerk"}
                </div>
                <div className="text-gray-400 mt-3">Date: {report.signatories?.clerk?.date || "16/10/26"}</div>
              </>
            )}
          </div>

          {/* Placement Officer */}
          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50/50 sig-block text-left sm:text-center">
            {isEditMode ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={report.signatories?.placement_officer?.name || "Ms. Rupali Mane"}
                  onChange={(e) => handleSignatoryChange("placement_officer", "name", e.target.value)}
                  className="w-full text-center font-bold text-gray-900 text-xs border rounded p-1 bg-white"
                  placeholder="Officer Name"
                />
                <input
                  type="text"
                  value={report.signatories?.placement_officer?.designation || "Dy.(Placement Officer)"}
                  onChange={(e) => handleSignatoryChange("placement_officer", "designation", e.target.value)}
                  className="w-full text-center text-gray-600 text-[11px] border rounded p-1 bg-white"
                  placeholder="Designation"
                />
                <input
                  type="text"
                  value={report.signatories?.placement_officer?.date || "16/10/26"}
                  onChange={(e) => handleSignatoryChange("placement_officer", "date", e.target.value)}
                  className="w-full text-center text-gray-500 text-[10px] border rounded p-1 bg-white"
                  placeholder="Date"
                />
              </div>
            ) : (
              <>
                <div className="font-bold text-gray-900 text-sm">
                  {report.signatories?.placement_officer?.name || "(Ms. Rupali Mane)"}
                </div>
                <div className="text-gray-600 font-medium">
                  {report.signatories?.placement_officer?.designation || "Dy.(Placement Officer)"}
                </div>
                <div className="text-gray-400 mt-3">
                  Date: {report.signatories?.placement_officer?.date || "16/10/26"}
                </div>
              </>
            )}
          </div>

          {/* Vice-Principal */}
          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50/50 sig-block text-left sm:text-center">
            {isEditMode ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={report.signatories?.vice_principal?.name || "Dr. R.R.Sedamkar"}
                  onChange={(e) => handleSignatoryChange("vice_principal", "name", e.target.value)}
                  className="w-full text-center font-bold text-gray-900 text-xs border rounded p-1 bg-white"
                  placeholder="Vice Principal"
                />
                <input
                  type="text"
                  value={report.signatories?.vice_principal?.designation || "Vice-Principal"}
                  onChange={(e) => handleSignatoryChange("vice_principal", "designation", e.target.value)}
                  className="w-full text-center text-gray-600 text-[11px] border rounded p-1 bg-white"
                  placeholder="Designation"
                />
                <input
                  type="text"
                  value={report.signatories?.vice_principal?.date || ""}
                  onChange={(e) => handleSignatoryChange("vice_principal", "date", e.target.value)}
                  className="w-full text-center text-gray-500 text-[10px] border rounded p-1 bg-white"
                  placeholder="Date"
                />
              </div>
            ) : (
              <>
                <div className="font-bold text-gray-900 text-sm">
                  {report.signatories?.vice_principal?.name || "(Dr. R.R.Sedamkar)"}
                </div>
                <div className="text-gray-600 font-medium">
                  {report.signatories?.vice_principal?.designation || "Vice-Principal"}
                </div>
                <div className="text-gray-400 mt-3">Date: {report.signatories?.vice_principal?.date || "—"}</div>
              </>
            )}
          </div>

          {/* Dean */}
          <div className="border border-gray-300 p-4 rounded-lg bg-gray-50/50 sig-block text-left sm:text-center">
            {isEditMode ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={report.signatories?.dean?.name || "Dr. Zahir Aalam"}
                  onChange={(e) => handleSignatoryChange("dean", "name", e.target.value)}
                  className="w-full text-center font-bold text-gray-900 text-xs border rounded p-1 bg-white"
                  placeholder="Dean Name"
                />
                <input
                  type="text"
                  value={report.signatories?.dean?.designation || "Dean (TP&IL)"}
                  onChange={(e) => handleSignatoryChange("dean", "designation", e.target.value)}
                  className="w-full text-center text-gray-600 text-[11px] border rounded p-1 bg-white"
                  placeholder="Designation"
                />
                <input
                  type="text"
                  value={report.signatories?.dean?.date || "16/10/26"}
                  onChange={(e) => handleSignatoryChange("dean", "date", e.target.value)}
                  className="w-full text-center text-gray-500 text-[10px] border rounded p-1 bg-white"
                  placeholder="Date"
                />
              </div>
            ) : (
              <>
                <div className="font-bold text-gray-900 text-sm">
                  {report.signatories?.dean?.name || "(Dr. Zahir Aalam)"}
                </div>
                <div className="text-gray-600 font-medium">
                  {report.signatories?.dean?.designation || "Dean (TP&IL)"}
                </div>
                <div className="text-gray-400 mt-3">Date: {report.signatories?.dean?.date || "16/10/26"}</div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
          {/* Due dates and Reason if late */}
          <div className="bg-gray-50 p-3.5 rounded-lg space-y-2 text-gray-700">
            {isEditMode ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-32 font-bold">Due Date:</span>
                  <input
                    type="date"
                    value={report.due_date || "2026-09-27"}
                    onChange={(e) => handleReportFieldChange("due_date", e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border rounded bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-32 font-bold">Completion Date:</span>
                  <input
                    type="date"
                    value={report.completion_date || "2026-09-24"}
                    onChange={(e) => handleReportFieldChange("completion_date", e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border rounded bg-white"
                  />
                </div>
                <div>
                  <span className="block font-bold mb-1">Reason if not completed as per due date:</span>
                  <textarea
                    value={report.reason_if_late || ""}
                    onChange={(e) => handleReportFieldChange("reason_if_late", e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1 text-xs border rounded bg-white"
                    placeholder="e.g. Capgemini result Declared as on 16/10/2026"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <strong>Due Date:</strong> {report.due_date || "27/09/2026"}
                </div>
                <div>
                  <strong>Completion Date:</strong> {report.completion_date || "24/09/2026"}
                </div>
                <div>
                  <strong>If not completed as per due date (Reason):</strong>{" "}
                  {report.reason_if_late || "Capgemini result Declared as on 16/10/2026"}
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-50 p-3.5 rounded-lg text-gray-700">
            <strong>Copy To:</strong>
            <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-gray-600 font-medium">
              <li>Principal</li>
              <li>Vice Principal</li>
              <li>All Deans</li>
              <li>All HODs</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Add Company Process Modal (Dialog) ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Add New Phase-I Placement Process</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddProcess} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Sr. No.</label>
                  <input
                    type="number"
                    value={newProcess.sr_no || ""}
                    onChange={(e) => setNewProcess({ ...newProcess, sr_no: Number(e.target.value) })}
                    className="w-full border rounded p-1.5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Notice Month</label>
                  <input
                    type="text"
                    value={newProcess.notice_month || ""}
                    onChange={(e) => setNewProcess({ ...newProcess, notice_month: e.target.value })}
                    className="w-full border rounded p-1.5"
                    placeholder="e.g. October"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Date of Process</label>
                <input
                  type="text"
                  value={newProcess.date_of_process || ""}
                  onChange={(e) => setNewProcess({ ...newProcess, date_of_process: e.target.value })}
                  className="w-full border rounded p-1.5"
                  placeholder="e.g. 15/10/2026 or —"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Name of Employer *</label>
                <input
                  type="text"
                  value={newProcess.name_of_employer || ""}
                  onChange={(e) => setNewProcess({ ...newProcess, name_of_employer: e.target.value })}
                  className="w-full border rounded p-1.5 font-medium"
                  placeholder="e.g. Oracle India Pvt. Ltd."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Category</label>
                  <select
                    value={newProcess.employer_category || "CAT-2"}
                    onChange={(e) => setNewProcess({ ...newProcess, employer_category: e.target.value })}
                    className="w-full border rounded p-1.5"
                  >
                    <option value="CAT-1">CAT-1 (Super Dream)</option>
                    <option value="CAT-2">CAT-2 (Dream)</option>
                    <option value="CAT-3">CAT-3 (Normal)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Type</label>
                  <select
                    value={newProcess.type_of_placement || "Regular"}
                    onChange={(e) => setNewProcess({ ...newProcess, type_of_placement: e.target.value })}
                    className="w-full border rounded p-1.5"
                  >
                    <option value="Regular">Regular</option>
                    <option value="HackwithInfy">HackwithInfy</option>
                    <option value="AEDP">AEDP</option>
                    <option value="PLI">PLI</option>
                    <option value="OJT">OJT</option>
                    <option value="Off-Campus">Off-Campus</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Salary (LPA)</label>
                  <input
                    type="text"
                    value={newProcess.salary_lpa || ""}
                    onChange={(e) => setNewProcess({ ...newProcess, salary_lpa: e.target.value })}
                    className="w-full border rounded p-1.5"
                    placeholder="e.g. 6.50"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Selected</label>
                  <input
                    type="number"
                    value={newProcess.selected ?? 0}
                    onChange={(e) => setNewProcess({ ...newProcess, selected: Number(e.target.value) })}
                    className="w-full border rounded p-1.5"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Appeared</label>
                  <input
                    type="number"
                    value={newProcess.appeared ?? 0}
                    onChange={(e) => setNewProcess({ ...newProcess, appeared: Number(e.target.value) })}
                    className="w-full border rounded p-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-8 px-3.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs rounded-lg shadow-sm transition-colors"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

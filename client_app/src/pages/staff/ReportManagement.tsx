import React, { useState, useEffect } from "react";
import {
  PlacementReport,
  PlacementRegisterEntry,
  CompanyRecord,
  PhaseWiseReport,
} from "./components/reports/types";
import { ReportTab } from "./components/reports/ReportTab";
import { PhaseWiseTab } from "./components/reports/PhaseWiseTab";
import { ListOfCompanyTab } from "./components/reports/ListOfCompanyTab";
import { PlacementRegisterTab } from "./components/reports/PlacementRegisterTab";
import { PrintReportModal } from "./components/reports/PrintReportModal";
import "./components/reports/report.print.css";

import {
  FileBarChart2,
  Printer,
  Save,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch } from "@/lib/api";
import { getCookie } from "@/utils";

type ReportCategory = "report" | "phasewise" | "companies" | "register";

const TABS: { key: ReportCategory; label: string }[] = [
  { key: "report", label: "Report" },
  { key: "phasewise", label: "Phase-wise Report" },
  { key: "companies", label: "List of Company" },
  { key: "register", label: "Placement Register" },
];

// Fallback initial report if API is loading or network error
const initialReportData: PlacementReport = {
  batch: "2027",
  program: "MCA",
  ref_no: "TCET/TNP/FRM/IP-06/09",
  report_no: "TCET/ T&P / REP  94    of 2026",
  revision: "B",
  report_date: "2026-10-16",
  admitted_final_year: 125,
  opt_out: 4,
  interested: 121,
  eligible: 117,
  not_eligible: 4,
  due_date: "2026-09-27",
  completion_date: "2026-09-24",
  reason_if_late: "Capgemini result Declared as on 16/10/2026",
  signatories: {
    clerk: { name: "Rajesh Singh", designation: "Sr.Clerk", date: "/10/26" },
    placement_officer: { name: "Rupali Mane", designation: "Dy.(Placement Officer)", date: "/10/26" },
    dean: { name: "Dr. Zahir Aalam", designation: "Dean(TP&IL)", date: "/10/26" },
    vice_principal: { name: "Dr. R.R. Sedamkar", designation: "Vice-Principal", date: "" },
  },
  copy_to: ["Principal", "Vice Principal", "All Deans", "All HODs"],
  is_draft: false,
};

const ReportManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportCategory>("report");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Core application data
  const [report, setReport] = useState<PlacementReport>(initialReportData);
  const [entries, setEntries] = useState<PlacementRegisterEntry[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [phaseReports, setPhaseReports] = useState<PhaseWiseReport[]>([]);

  // Fetch report data on mount
  const loadReportData = async () => {
    setLoading(true);
    try {
      // 1. Fetch main report by batch & program
      const res = await apiFetch("/api/reports/reports/by-batch/?batch=2027&program=MCA");
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        if (data.register_entries) {
          setEntries(data.register_entries);
        }
        if (data.phase_reports) {
          setPhaseReports(data.phase_reports);
        }
      }

      // 2. Fetch company master records
      const compRes = await apiFetch("/api/reports/companies/");
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompanies(compData);
      }
    } catch (err) {
      console.error("Failed to load reports from API, using cached state:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  // Save current report, register entries, and phase-wise figures
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const csrfToken = getCookie("csrftoken");

      // 1. Update or create main report
      const reportEndpoint = report.id
        ? `/api/reports/reports/${report.id}/`
        : "/api/reports/reports/";
      const reportMethod = report.id ? "PUT" : "POST";

      const reportRes = await apiFetch(reportEndpoint, {
        method: reportMethod,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken || "",
        },
        body: JSON.stringify({
          ...report,
          is_draft: true,
        }),
      });

      let savedReport = report;
      if (reportRes.ok) {
        savedReport = await reportRes.json();
        setReport(savedReport);
      }

      // 2. Bulk update register entries if report id exists
      if (savedReport.id) {
        await apiFetch(`/api/reports/reports/${savedReport.id}/entries/bulk/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken || "",
          },
          body: JSON.stringify({ entries }),
        });
      }

      toast.success("Draft saved successfully!");
    } catch (err) {
      console.error("Failed to save draft:", err);
      toast.error("Could not save report draft");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#f0f4f8",
        minHeight: "100vh",
        padding: "24px 20px",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Page Title & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 no-print">
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              color: "#1a2844",
            }}
            className="flex items-center gap-2.5"
          >
            <FileBarChart2 className="w-6 h-6 text-blue-600" />
            Report Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Training & Placement Department — Official Reports, Calculations & Registers
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <Printer className="w-3.5 h-3.5 text-gray-500" />
            <span>Preview & Print</span>
          </button>

          <button
            onClick={loadReportData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Reload from server"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-gray-500 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-8 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-blue-600 rounded-lg text-xs font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save Draft"}</span>
          </button>
        </div>
      </div>

      {/* White Card Container */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
        className="no-print"
      >
        {/* Top Tab Bar */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            padding: "12px 16px 0",
            borderBottom: "1px solid #e8ecf4",
            backgroundColor: "#fafbfd",
          }}
          className="overflow-x-auto"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`report-tab-${tab.key}`}
                data-testid={`report-tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "10px 22px",
                  borderRadius: "10px 10px 0 0",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "14px",
                  transition: "all 0.2s ease",
                  color: isActive ? "#2563eb" : "#6b7a99",
                  background: isActive ? "#ffffff" : "transparent",
                  boxShadow: isActive
                    ? "0 -2px 0 #2563eb inset, 0 2px 8px rgba(37,99,235,0.08)"
                    : "none",
                  borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                  outline: "none",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
                aria-selected={isActive}
                role="tab"
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Workspace Content */}
        <div className="p-6">
          {activeTab === "report" && (
            <ReportTab
              report={report}
              entries={entries}
              phaseReports={phaseReports}
              onUpdateReport={(updated) => setReport(updated)}
            />
          )}

          {activeTab === "phasewise" && (
            <PhaseWiseTab
              report={report}
              phaseReports={phaseReports}
              onUpdatePhases={(updated) => setPhaseReports(updated)}
            />
          )}

          {activeTab === "companies" && (
            <ListOfCompanyTab
              companies={companies}
              onUpdateCompanies={(updated) => setCompanies(updated)}
            />
          )}

          {activeTab === "register" && (
            <PlacementRegisterTab
              report={report}
              entries={entries}
              companyNames={companies.map((c) => c.company_name)}
              onUpdateEntries={(updated) => setEntries(updated)}
              onSaveReport={(updated) => setReport(updated)}
            />
          )}
        </div>
      </div>

      {/* Print / PDF Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        report={report}
        entries={entries}
        companies={companies}
        phaseReports={phaseReports}
        defaultView={activeTab}
      />
    </div>
  );
};

export default ReportManagement;

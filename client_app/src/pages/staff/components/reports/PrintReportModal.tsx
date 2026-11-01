import React, { useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import {
  PlacementReport,
  PlacementRegisterEntry,
  CompanyRecord,
  PhaseWiseReport,
} from "./types";
import { ReportTab } from "./ReportTab";
import { PhaseWiseTab } from "./PhaseWiseTab";
import { ListOfCompanyTab } from "./ListOfCompanyTab";
import { PlacementRegisterTab } from "./PlacementRegisterTab";
import { Printer, X, Eye } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: PlacementReport;
  entries: PlacementRegisterEntry[];
  companies: CompanyRecord[];
  phaseReports: PhaseWiseReport[];
  defaultView?: "report" | "phasewise" | "companies" | "register";
}

export const PrintReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  report,
  entries,
  companies,
  phaseReports,
  defaultView = "report",
}) => {
  const [selectedDoc, setSelectedDoc] = useState<
    "report" | "phasewise" | "companies" | "register"
  >(defaultView);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printAreaRef,
    documentTitle: `TCET_Placement_Report_${report.batch}_${report.program}`,
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 10mm 10mm 10mm 10mm !important;
      }
      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box !important;
        }
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: "Times New Roman", Times, serif !important;
          font-size: 9.5pt !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          min-height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
        .no-print, button, .no-print * {
          display: none !important;
        }
        div, section, article, main {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
          box-shadow: none !important;
        }
        .print-area {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          border: none !important;
          overflow: visible !important;
          height: auto !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
          margin-bottom: 12px !important;
        }
        thead {
          display: table-header-group !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        tbody {
          display: table-row-group !important;
        }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: auto !important;
          break-after: auto !important;
        }
        th, td {
          border: 1px solid #000000 !important;
          padding: 3.5px 5px !important;
          color: #000000 !important;
          word-break: break-word !important;
        }
        th {
          background-color: #f0f0f0 !important;
          font-weight: bold !important;
          text-align: center !important;
        }
        .signatures-grid {
          display: flex !important;
          flex-direction: row !important;
          justify-content: space-between !important;
          gap: 8px !important;
          margin-top: 20px !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .sig-block {
          flex: 1 1 0 !important;
          text-align: center !important;
          border: 1px solid #000000 !important;
          padding: 6px !important;
          background: #ffffff !important;
        }
      }
    `,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-between overflow-hidden">
      {/* Top Floating Control Bar (Hidden on print) */}
      <div className="bg-gray-900 text-white p-3.5 px-6 flex flex-wrap items-center justify-between shadow-lg no-print">
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-sm">Official Report Print Preview</span>
        </div>

        {/* Document Selector */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setSelectedDoc("report")}
            className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${
              selectedDoc === "report" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
            }`}
          >
            Main Report
          </button>
          <button
            onClick={() => setSelectedDoc("phasewise")}
            className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${
              selectedDoc === "phasewise" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
            }`}
          >
            Phase-wise
          </button>
          <button
            onClick={() => setSelectedDoc("companies")}
            className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${
              selectedDoc === "companies" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
            }`}
          >
            List of Company
          </button>
          <button
            onClick={() => setSelectedDoc("register")}
            className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${
              selectedDoc === "register" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
            }`}
          >
            Placement Register
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrint()}
            className="inline-flex items-center gap-1.5 h-8 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Close Preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Printable Body Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100">
        <div
          ref={printAreaRef}
          className="max-w-6xl mx-auto bg-white p-8 rounded-xl shadow-md border print:border-none print:shadow-none print:p-0 print-area"
        >
          {selectedDoc === "report" && (
            <ReportTab
              report={report}
              entries={entries}
              phaseReports={phaseReports}
            />
          )}

          {selectedDoc === "phasewise" && (
            <PhaseWiseTab
              report={report}
              phaseReports={phaseReports}
              onUpdatePhases={() => {}}
            />
          )}

          {selectedDoc === "companies" && (
            <ListOfCompanyTab
              companies={companies}
              onUpdateCompanies={() => {}}
            />
          )}

          {selectedDoc === "register" && (
            <PlacementRegisterTab
              report={report}
              entries={entries}
              companyNames={companies.map((c) => c.company_name)}
              onUpdateEntries={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
};

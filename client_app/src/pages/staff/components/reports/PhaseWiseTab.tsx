import React, { useState, useMemo } from "react";
import { PhaseWiseReport, PlacementReport, MonthData } from "./types";
import { Edit3, Save } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  report: PlacementReport;
  phaseReports: PhaseWiseReport[];
  onUpdatePhases: (phases: PhaseWiseReport[]) => void;
}

type SubTab = "I" | "II" | "III" | "SUMMARY";

const PHASE_MONTHS: Record<"I" | "II" | "III", string[]> = {
  I: ["JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"],
  II: ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY"],
  III: ["JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"],
};

export const PhaseWiseTab: React.FC<Props> = ({
  report,
  phaseReports,
  onUpdatePhases,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("I");
  const [isEditing, setIsEditing] = useState(false);

  // Local state for phase reports to enable clerk editing
  const [localPhases, setLocalPhases] = useState<PhaseWiseReport[]>(phaseReports);

  // Ensure phases I, II, III exist in state
  const phaseI: PhaseWiseReport = useMemo(() => {
    return (
      localPhases.find((p) => p.phase === "I") || {
        phase: "I" as const,
        total_admitted: report.admitted_final_year || 125,
        opt_out: report.opt_out || 4,
        opted_higher_studies: 0,
        interested: report.interested || 121,
        eligible: report.eligible || 117,
        companies_visited: 19,
        students_placed: 15,
        monthly_data: {
          JUNE: { companies: 2, placed: 3 },
          JULY: { companies: 0, placed: 0 },
          AUGUST: { companies: 10, placed: 3 },
          SEPTEMBER: { companies: 4, placed: 2 },
          OCTOBER: { companies: 3, placed: 7 },
          NOVEMBER: { companies: 0, placed: 0 },
          DECEMBER: { companies: 0, placed: 0 },
        } as Record<string, MonthData>,
        off_campus_placed: 0,
      }
    );
  }, [localPhases, report]);

  const phaseII: PhaseWiseReport = useMemo(() => {
    return (
      localPhases.find((p) => p.phase === "II") || {
        phase: "II" as const,
        total_admitted: report.admitted_final_year || 125,
        opt_out: 0,
        opted_higher_studies: 0,
        interested: 0,
        eligible: 0,
        companies_visited: 0,
        students_placed: 0,
        monthly_data: {
          JANUARY: { companies: 0, placed: 0 },
          FEBRUARY: { companies: 0, placed: 0 },
          MARCH: { companies: 0, placed: 0 },
          APRIL: { companies: 0, placed: 0 },
          MAY: { companies: 0, placed: 0 },
        } as Record<string, MonthData>,
        off_campus_placed: 0,
      }
    );
  }, [localPhases, report]);

  const phaseIII: PhaseWiseReport = useMemo(() => {
    return (
      localPhases.find((p) => p.phase === "III") || {
        phase: "III" as const,
        total_admitted: report.admitted_final_year || 125,
        opt_out: 0,
        opted_higher_studies: 0,
        interested: 0,
        eligible: 0,
        companies_visited: 0,
        students_placed: 0,
        monthly_data: {
          JUNE: { companies: 0, placed: 0 },
          JULY: { companies: 0, placed: 0 },
          AUGUST: { companies: 0, placed: 0 },
          SEPTEMBER: { companies: 0, placed: 0 },
          OCTOBER: { companies: 0, placed: 0 },
          NOVEMBER: { companies: 0, placed: 0 },
          DECEMBER: { companies: 0, placed: 0 },
        } as Record<string, MonthData>,
        off_campus_placed: 0,
      }
    );
  }, [localPhases, report]);

  // Compute subtotals dynamically
  const calcSubTotal = (p: PhaseWiseReport, months: string[]) => {
    let compSum = 0;
    let placedSum = 0;
    for (const m of months) {
      compSum += p.monthly_data?.[m]?.companies || 0;
      placedSum += p.monthly_data?.[m]?.placed || 0;
    }
    const totalPlaced = placedSum + (p.off_campus_placed || 0);
    const pct = p.interested ? ((totalPlaced / p.interested) * 100).toFixed(2) : "0.00";
    return { compSum, placedSum, totalPlaced, pct };
  };

  const subI = useMemo(() => calcSubTotal(phaseI, PHASE_MONTHS.I), [phaseI]);
  const subII = useMemo(() => calcSubTotal(phaseII, PHASE_MONTHS.II), [phaseII]);
  const subIII = useMemo(() => calcSubTotal(phaseIII, PHASE_MONTHS.III), [phaseIII]);

  const grandTotalPlaced = subI.totalPlaced + subII.totalPlaced + subIII.totalPlaced;
  const grandTotalCompanies = subI.compSum + subII.compSum + subIII.compSum;
  const overallPercentage = phaseI.interested
    ? ((grandTotalPlaced / phaseI.interested) * 100).toFixed(2)
    : "0.00";

  // Handle month field change
  const handleMonthChange = (
    phaseKey: "I" | "II" | "III",
    month: string,
    field: "companies" | "placed",
    value: number
  ) => {
    const updated = localPhases.map((p) => {
      if (p.phase === phaseKey) {
        const currentMonthData = p.monthly_data?.[month] || { companies: 0, placed: 0 };
        return {
          ...p,
          monthly_data: {
            ...p.monthly_data,
            [month]: {
              ...currentMonthData,
              [field]: isNaN(value) ? 0 : value,
            },
          },
        };
      }
      return p;
    });
    setLocalPhases(updated);
  };

  // Handle general field change (admitted, interested, eligible, etc.)
  const handleFieldChange = (
    phaseKey: "I" | "II" | "III",
    field: keyof PhaseWiseReport,
    value: any
  ) => {
    const updated = localPhases.map((p) => {
      if (p.phase === phaseKey) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setLocalPhases(updated);
  };

  const handleSave = () => {
    onUpdatePhases(localPhases);
    setIsEditing(false);
    toast.success("Phase-wise data saved");
  };

  return (
    <div className="space-y-6">
      {/* Official Sheet Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center pb-3 border-b border-gray-200">
          <h2 className="text-xl font-bold tracking-wide text-gray-900">TCET</h2>
          <h3 className="text-base font-semibold text-blue-900">
            Phase wise Comparison — Number of Students Placed from Batch {report.batch} onward
          </h3>
          <div className="flex flex-wrap justify-between items-center text-xs text-gray-600 mt-2 px-4">
            <span className="font-mono">TCET/T&P/FRM/IP-06/11</span>
            <span className="font-medium bg-blue-50 text-blue-800 px-2 py-0.5 rounded">
              Revision: B
            </span>
            <span>REF: TCET/ T&P/ REP 96 of 2026</span>
            <span>Date: 16/10/2026</span>
          </div>
        </div>

        {/* Phase Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-2 no-print">
          <div className="flex gap-2">
            {[
              { id: "I", label: "Phase I (A)" },
              { id: "II", label: "Phase II (B)" },
              { id: "III", label: "Phase III (C)" },
              { id: "SUMMARY", label: "Overall Summary" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as SubTab)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeSubTab === tab.id
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Phase Data
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Phase I Tab View */}
      {activeSubTab === "I" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
              Phase I (A) — 2027 Batch
            </h3>
            <span className="text-xs bg-blue-50 text-blue-800 px-3 py-1 rounded-full font-semibold">
              Placement: {subI.pct}%
            </span>
          </div>

          {/* Key Eligibility Figures */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Total Admitted</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseI.total_admitted}
                  onChange={(e) =>
                    handleFieldChange("I", "total_admitted", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseI.total_admitted}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Opt Out of Campus</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseI.opt_out}
                  onChange={(e) =>
                    handleFieldChange("I", "opt_out", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseI.opt_out}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Interested in Placement</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseI.interested}
                  onChange={(e) =>
                    handleFieldChange("I", "interested", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseI.interested}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Eligible</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseI.eligible}
                  onChange={(e) =>
                    handleFieldChange("I", "eligible", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseI.eligible}</span>
              )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-blue-700 text-[11px] font-semibold block">Company Visited</span>
              <span className="text-lg font-bold text-blue-900">{subI.compSum}</span>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 font-bold text-gray-700">
                <tr>
                  <th className="p-2.5 text-left border-r w-1/3">Month</th>
                  <th className="p-2.5 text-center border-r w-1/3">Company Visited</th>
                  <th className="p-2.5 text-center w-1/3">Students Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {PHASE_MONTHS.I.map((m) => {
                  const mData = phaseI.monthly_data?.[m] || { companies: 0, placed: 0 };
                  return (
                    <tr key={m} className="hover:bg-gray-50">
                      <td className="p-2.5 font-semibold text-gray-800 border-r">{m}</td>
                      <td className="p-2.5 text-center border-r">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={mData.companies}
                            onChange={(e) =>
                              handleMonthChange("I", m, "companies", parseInt(e.target.value) || 0)
                            }
                            className="w-20 p-1 border rounded text-center"
                          />
                        ) : (
                          <span className="font-medium text-gray-700">{mData.companies}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={mData.placed}
                            onChange={(e) =>
                              handleMonthChange("I", m, "placed", parseInt(e.target.value) || 0)
                            }
                            className="w-20 p-1 border rounded text-center"
                          />
                        ) : (
                          <span className="font-bold text-emerald-700">{mData.placed}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-blue-50/70 border-t-2 border-blue-200 font-bold text-blue-950">
                <tr>
                  <td className="p-3 border-r">SUB TOTAL (A)</td>
                  <td className="p-3 text-center border-r">{subI.compSum}</td>
                  <td className="p-3 text-center">{subI.placedSum}</td>
                </tr>
                <tr className="bg-blue-100 text-blue-950">
                  <td className="p-2.5 border-r">% of Placement (out of Interested)</td>
                  <td colSpan={2} className="p-2.5 text-center font-extrabold text-sm">
                    {subI.pct}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Phase II Tab View */}
      {activeSubTab === "II" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
              Phase II (B) — 2027 Batch
            </h3>
            <span className="text-xs bg-purple-50 text-purple-800 px-3 py-1 rounded-full font-semibold">
              Placement: {subII.pct}%
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Total Admitted</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseII.total_admitted}
                  onChange={(e) =>
                    handleFieldChange("II", "total_admitted", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseII.total_admitted}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Opted for Higher Studies</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseII.opted_higher_studies}
                  onChange={(e) =>
                    handleFieldChange("II", "opted_higher_studies", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseII.opted_higher_studies}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Interested in Placement</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseII.interested}
                  onChange={(e) =>
                    handleFieldChange("II", "interested", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseII.interested}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Eligible</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseII.eligible}
                  onChange={(e) =>
                    handleFieldChange("II", "eligible", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseII.eligible}</span>
              )}
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <span className="text-purple-700 text-[11px] font-semibold block">Company Visited</span>
              <span className="text-lg font-bold text-purple-900">{subII.compSum}</span>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 font-bold text-gray-700">
                <tr>
                  <th className="p-2.5 text-left border-r w-1/3">Month</th>
                  <th className="p-2.5 text-center border-r w-1/3">Company Visited</th>
                  <th className="p-2.5 text-center w-1/3">Students Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {PHASE_MONTHS.II.map((m) => {
                  const mData = phaseII.monthly_data?.[m] || { companies: 0, placed: 0 };
                  return (
                    <tr key={m} className="hover:bg-gray-50">
                      <td className="p-2.5 font-semibold text-gray-800 border-r">{m}</td>
                      <td className="p-2.5 text-center border-r">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={mData.companies}
                            onChange={(e) =>
                              handleMonthChange("II", m, "companies", parseInt(e.target.value) || 0)
                            }
                            className="w-20 p-1 border rounded text-center"
                          />
                        ) : (
                          <span className="font-medium text-gray-700">{mData.companies}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={mData.placed}
                            onChange={(e) =>
                              handleMonthChange("II", m, "placed", parseInt(e.target.value) || 0)
                            }
                            className="w-20 p-1 border rounded text-center"
                          />
                        ) : (
                          <span className="font-bold text-emerald-700">{mData.placed}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-purple-50/70 border-t-2 border-purple-200 font-bold text-purple-950">
                <tr>
                  <td className="p-3 border-r">SUB TOTAL (B)</td>
                  <td className="p-3 text-center border-r">{subII.compSum}</td>
                  <td className="p-3 text-center">{subII.placedSum}</td>
                </tr>
                <tr className="bg-purple-100 text-purple-950">
                  <td className="p-2.5 border-r">% of Placement (B)</td>
                  <td colSpan={2} className="p-2.5 text-center font-extrabold text-sm">
                    {subII.pct}%
                  </td>
                </tr>
                <tr className="bg-purple-200 text-purple-950">
                  <td className="p-2.5 border-r">Total (A + B)</td>
                  <td className="p-2.5 text-center border-r">{subI.compSum + subII.compSum}</td>
                  <td className="p-2.5 text-center">{subI.totalPlaced + subII.totalPlaced}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Phase III Tab View */}
      {activeSubTab === "III" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              Phase III (C) — 2027 Batch
            </h3>
            <span className="text-xs bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full font-semibold">
              Placement: {subIII.pct}%
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Total Admitted</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseIII.total_admitted}
                  onChange={(e) =>
                    handleFieldChange("III", "total_admitted", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseIII.total_admitted}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Opted for Higher Studies</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseIII.opted_higher_studies}
                  onChange={(e) =>
                    handleFieldChange("III", "opted_higher_studies", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseIII.opted_higher_studies}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Interested in Placement</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseIII.interested}
                  onChange={(e) =>
                    handleFieldChange("III", "interested", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseIII.interested}</span>
              )}
            </div>

            <div className="p-3 bg-gray-50 border rounded-lg">
              <span className="text-gray-500 text-[11px] block">Eligible</span>
              {isEditing ? (
                <input
                  type="number"
                  value={phaseIII.eligible}
                  onChange={(e) =>
                    handleFieldChange("III", "eligible", parseInt(e.target.value) || 0)
                  }
                  className="w-full mt-1 p-1 border rounded text-sm font-bold"
                />
              ) : (
                <span className="text-lg font-bold text-gray-900">{phaseIII.eligible}</span>
              )}
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-emerald-700 text-[11px] font-semibold block">Company Visited</span>
              <span className="text-lg font-bold text-emerald-900">{subIII.compSum}</span>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 font-bold text-gray-700">
                <tr>
                  <th className="p-2.5 text-left border-r w-1/3">Month</th>
                  <th className="p-2.5 text-center border-r w-1/3">Company Visited</th>
                  <th className="p-2.5 text-center w-1/3">Students Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {PHASE_MONTHS.III.map((m) => {
                  const mData = phaseIII.monthly_data?.[m] || { companies: 0, placed: 0 };
                  return (
                    <tr key={m} className="hover:bg-gray-50">
                      <td className="p-2.5 font-semibold text-gray-800 border-r">{m}</td>
                      <td className="p-2.5 text-center border-r">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={mData.companies}
                            onChange={(e) =>
                              handleMonthChange("III", m, "companies", parseInt(e.target.value) || 0)
                            }
                            className="w-20 p-1 border rounded text-center"
                          />
                        ) : (
                          <span className="font-medium text-gray-700">{mData.companies}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={mData.placed}
                            onChange={(e) =>
                              handleMonthChange("III", m, "placed", parseInt(e.target.value) || 0)
                            }
                            className="w-20 p-1 border rounded text-center"
                          />
                        ) : (
                          <span className="font-bold text-emerald-700">{mData.placed}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-amber-50">
                  <td className="p-2.5 font-bold text-amber-900 border-r">Off-Campus</td>
                  <td className="p-2.5 text-center border-r text-gray-400">—</td>
                  <td className="p-2.5 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={phaseIII.off_campus_placed || 0}
                        onChange={(e) =>
                          handleFieldChange("III", "off_campus_placed", parseInt(e.target.value) || 0)
                        }
                        className="w-20 p-1 border rounded text-center font-bold"
                      />
                    ) : (
                      <span className="font-bold text-amber-800">{phaseIII.off_campus_placed || 0}</span>
                    )}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-emerald-50/70 border-t-2 border-emerald-200 font-bold text-emerald-950">
                <tr>
                  <td className="p-3 border-r">SUB TOTAL (C)</td>
                  <td className="p-3 text-center border-r">{subIII.compSum}</td>
                  <td className="p-3 text-center">{subIII.totalPlaced}</td>
                </tr>
                <tr className="bg-emerald-100 text-emerald-950">
                  <td className="p-2.5 border-r">% of Placement (C)</td>
                  <td colSpan={2} className="p-2.5 text-center font-extrabold text-sm">
                    {subIII.pct}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Overall Summary View */}
      {activeSubTab === "SUMMARY" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6">
          <div className="border-b pb-3">
            <h3 className="text-base font-bold text-gray-900">
              Overall Phase-wise Summary (2027 MCA Batch)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Cumulative totals across Phase I (A), Phase II (B), and Phase III (C)
            </p>
          </div>

          {/* Big Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-4 rounded-xl">
              <span className="text-xs font-semibold text-blue-800">Total Placed (A+B+C)</span>
              <div className="text-3xl font-extrabold text-blue-900 mt-1">{grandTotalPlaced}</div>
              <span className="text-[11px] text-blue-600 mt-1 block">Students placed</span>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 p-4 rounded-xl">
              <span className="text-xs font-semibold text-indigo-800">Companies Visited</span>
              <div className="text-3xl font-extrabold text-indigo-900 mt-1">{grandTotalCompanies}</div>
              <span className="text-[11px] text-indigo-600 mt-1 block">Total drive processes</span>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 p-4 rounded-xl">
              <span className="text-xs font-semibold text-emerald-800">Overall Placement %</span>
              <div className="text-3xl font-extrabold text-emerald-900 mt-1">{overallPercentage}%</div>
              <span className="text-[11px] text-emerald-600 mt-1 block">Out of interested ({phaseI.interested})</span>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 p-4 rounded-xl">
              <span className="text-xs font-semibold text-purple-800">Total Admitted</span>
              <div className="text-3xl font-extrabold text-purple-900 mt-1">{phaseI.total_admitted}</div>
              <span className="text-[11px] text-purple-600 mt-1 block">Regular students</span>
            </div>
          </div>

          {/* Breakdown Comparison Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 font-bold text-gray-700">
                <tr>
                  <th className="p-3 text-left border-r">Phase Category</th>
                  <th className="p-3 text-center border-r">Company Visited</th>
                  <th className="p-3 text-center border-r">Students Placed</th>
                  <th className="p-3 text-center">% of Placement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium">
                <tr className="hover:bg-blue-50/50">
                  <td className="p-3 border-r font-semibold text-blue-900">
                    Phase I (A) — June to December
                  </td>
                  <td className="p-3 text-center border-r">{subI.compSum}</td>
                  <td className="p-3 text-center border-r font-bold text-gray-900">{subI.totalPlaced}</td>
                  <td className="p-3 text-center font-bold text-blue-700">{subI.pct}%</td>
                </tr>
                <tr className="hover:bg-purple-50/50">
                  <td className="p-3 border-r font-semibold text-purple-900">
                    Phase II (B) — January to May
                  </td>
                  <td className="p-3 text-center border-r">{subII.compSum}</td>
                  <td className="p-3 text-center border-r font-bold text-gray-900">{subII.totalPlaced}</td>
                  <td className="p-3 text-center font-bold text-purple-700">{subII.pct}%</td>
                </tr>
                <tr className="hover:bg-emerald-50/50">
                  <td className="p-3 border-r font-semibold text-emerald-900">
                    Phase III (C) — June to December + Off-Campus
                  </td>
                  <td className="p-3 text-center border-r">{subIII.compSum}</td>
                  <td className="p-3 text-center border-r font-bold text-gray-900">{subIII.totalPlaced}</td>
                  <td className="p-3 text-center font-bold text-emerald-700">{subIII.pct}%</td>
                </tr>
              </tbody>
              <tfoot className="bg-gray-900 text-white font-bold text-sm">
                <tr>
                  <td className="p-3.5 border-r border-gray-700">Grand Total (A + B + C)</td>
                  <td className="p-3.5 text-center border-r border-gray-700">{grandTotalCompanies}</td>
                  <td className="p-3.5 text-center border-r border-gray-700 font-extrabold text-emerald-400">
                    {grandTotalPlaced}
                  </td>
                  <td className="p-3.5 text-center font-extrabold text-blue-400">{overallPercentage}%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signatories Block from Template */}
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-xs space-y-4">
            <h4 className="font-bold text-gray-800 border-b pb-2">Approval Signatories</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="bg-white border p-3 rounded text-center">
                <div className="font-bold text-gray-900">(Rajesh Singh)</div>
                <div className="text-gray-500">Sr.Clerk</div>
                <div className="text-gray-400 mt-2">Date: 16/10/2026</div>
              </div>
              <div className="bg-white border p-3 rounded text-center">
                <div className="font-bold text-gray-900">(Ms. Rupali Mane)</div>
                <div className="text-gray-500">Dy. (Placement Officer)</div>
                <div className="text-gray-400 mt-2">Date: 16/10/2026</div>
              </div>
              <div className="bg-white border p-3 rounded text-center">
                <div className="font-bold text-gray-900">(Dr. Zahir Aalam)</div>
                <div className="text-gray-500">Dean (TP&IL)</div>
                <div className="text-gray-400 mt-2">Date: 16/10/2026</div>
              </div>
              <div className="bg-white border p-3 rounded text-center">
                <div className="font-bold text-gray-900">(Dr. R.R. Sedamkar)</div>
                <div className="text-gray-500">Vice-Principal</div>
                <div className="text-gray-400 mt-2">Date: 16/10/2026</div>
              </div>
            </div>

            <div className="text-gray-600 space-y-1 pt-2">
              <div>
                <strong>Due Date:</strong> 19/10/2026
              </div>
              <div>
                <strong>Completion Date:</strong> 16/10/2026
              </div>
              <div>
                <strong>If not Completed as per the due date (Reason):</strong> Capgemini result Declared as on 16/10/2026
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

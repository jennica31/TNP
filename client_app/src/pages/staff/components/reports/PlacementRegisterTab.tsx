import React, { useState, useMemo } from "react";
import {
  PlacementRegisterEntry,
  calculateStats,
  PlacementReport,
} from "./types";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Building,
  CheckCircle,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  report: PlacementReport;
  entries: PlacementRegisterEntry[];
  companyNames: string[];
  onUpdateEntries: (entries: PlacementRegisterEntry[]) => void;
  onSaveReport?: (report: PlacementReport) => void;
}

const emptyEntry: Omit<PlacementRegisterEntry, "sr_no"> = {
  branch: "MCA-A",
  division: "",
  tnp_uid: "",
  student_name: "",
  employer_visit_date: "",
  employer_category: "CAT-3",
  placement_type: "Regular",
  employer_name: "",
  stipend_offered: "",
  salary_lpa: null,
  num_offers: 1,
  remark: "",
  dual_offer: false,
  campus_on_off: "ON",
  date_of_joining: "",
};

export const PlacementRegisterTab: React.FC<Props> = ({
  report,
  entries,
  companyNames,
  onUpdateEntries,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [campusFilter, setCampusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Modal / Editing state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<PlacementRegisterEntry, "sr_no">>(emptyEntry);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchSearch =
        searchTerm === "" ||
        e.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.tnp_uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.employer_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        categoryFilter === "ALL" || e.employer_category === categoryFilter;

      const matchCampus =
        campusFilter === "ALL" || e.campus_on_off === campusFilter;

      const matchType =
        typeFilter === "ALL" || e.placement_type === typeFilter;

      return matchSearch && matchCategory && matchCampus && matchType;
    });
  }, [entries, searchTerm, categoryFilter, campusFilter, typeFilter]);

  // Statistics calculated in real-time from active entries
  const salaryStats = useMemo(() => {
    const salaries = entries
      .map((e) => e.salary_lpa)
      .filter((s): s is number => s !== null && s > 0);
    return calculateStats(salaries);
  }, [entries]);

  const stipendStats = useMemo(() => {
    const stipends = entries
      .map((e) => parseFloat(e.stipend_offered))
      .filter((s) => !isNaN(s) && s > 0);
    return calculateStats(stipends);
  }, [entries]);

  const dualOfferCount = useMemo(() => {
    return entries.filter((e) => e.dual_offer).length;
  }, [entries]);

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingIndex(null);
    setFormData({
      ...emptyEntry,
      employer_name: companyNames.length > 0 ? companyNames[0] : "",
    });
    setIsModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (index: number) => {
    setEditingIndex(index);
    const entry = entries[index];
    setFormData({
      branch: entry.branch,
      division: entry.division || "",
      tnp_uid: entry.tnp_uid,
      student_name: entry.student_name,
      employer_visit_date: entry.employer_visit_date,
      employer_category: entry.employer_category,
      placement_type: entry.placement_type,
      employer_name: entry.employer_name,
      stipend_offered: entry.stipend_offered || "",
      salary_lpa: entry.salary_lpa,
      num_offers: entry.num_offers || 1,
      remark: entry.remark || "",
      dual_offer: entry.dual_offer,
      campus_on_off: entry.campus_on_off,
      date_of_joining: entry.date_of_joining || "",
    });
    setIsModalOpen(true);
  };

  // Submit Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_name.trim() || !formData.tnp_uid.trim() || !formData.employer_name.trim()) {
      toast.error("Please fill in Student Name, T&P UID, and Employer Name");
      return;
    }

    if (editingIndex !== null) {
      // Edit
      const updated = [...entries];
      updated[editingIndex] = {
        ...updated[editingIndex],
        ...formData,
      };
      onUpdateEntries(updated);
      toast.success("Placement entry updated");
    } else {
      // Add
      const newEntry: PlacementRegisterEntry = {
        sr_no: entries.length + 1,
        ...formData,
      };
      onUpdateEntries([...entries, newEntry]);
      toast.success("Placement entry added");
    }
    setIsModalOpen(false);
  };

  // Delete Entry
  const handleDelete = (index: number) => {
    if (window.confirm(`Are you sure you want to remove ${entries[index].student_name}?`)) {
      const updated = entries.filter((_, i) => i !== index);
      // Re-index sr_no
      const reindexed = updated.map((e, idx) => ({ ...e, sr_no: idx + 1 }));
      onUpdateEntries(reindexed);
      toast.success("Entry removed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Official Sheet Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center pb-3 border-b border-gray-200">
          <h2 className="text-xl font-bold tracking-wide text-gray-900">TCET</h2>
          <h3 className="text-base font-semibold text-blue-900">
            Students Placement Register of {report.batch} Batch ({report.program})
          </h3>
          <div className="flex flex-wrap justify-between items-center text-xs text-gray-600 mt-2 px-4">
            <span className="font-mono">{report.ref_no || "TCET/TNP/FRM/IP-06/02"}</span>
            <span className="font-medium bg-blue-50 text-blue-800 px-2 py-0.5 rounded">
              Revision: {report.revision || "B"}
            </span>
            <span>REF: {report.report_no || "TCET/ T&P/ REP 95 of 2026"}</span>
            <span>Date: {report.report_date || "16/10/2026"}</span>
          </div>
        </div>

        <div className="mt-3 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs text-amber-900 font-medium">
          <strong>Note:</strong> Employer Category <strong>Cat-1</strong> represents Super Dream Companies,{" "}
          <strong>Cat-2</strong> represents Dream Companies, and <strong>Cat-3</strong> represents Normal Companies.
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-sm">
          <div className="text-xs text-gray-500 flex items-center gap-1 font-medium">
            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
            Total Placed
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{entries.length}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Students</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm">
          <div className="text-xs text-gray-500 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Max Salary
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {salaryStats.max !== null ? `${salaryStats.max} LPA` : "—"}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Min: {salaryStats.min || "—"} LPA</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm">
          <div className="text-xs text-gray-500 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            Average Salary
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">
            {salaryStats.avg !== null ? `${salaryStats.avg} LPA` : "—"}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Median: {salaryStats.median || "—"} LPA</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-sm">
          <div className="text-xs text-gray-500 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
            Mode Salary
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-1">
            {salaryStats.mode !== null ? `${salaryStats.mode} LPA` : "—"}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Most common package</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-sm">
          <div className="text-xs text-gray-500 flex items-center gap-1 font-medium">
            <CheckCircle className="w-3.5 h-3.5 text-amber-600" />
            Dual Offers
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{dualOfferCount}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Student(s) placed twice</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-cyan-100 shadow-sm">
          <div className="text-xs text-gray-500 flex items-center gap-1 font-medium">
            <Building className="w-3.5 h-3.5 text-cyan-600" />
            Avg Stipend
          </div>
          <div className="text-2xl font-bold text-cyan-700 mt-1">
            {stipendStats.avg !== null ? `₹${stipendStats.avg}` : "—"}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">Max: ₹{stipendStats.max || "—"}</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Add Button */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-3 items-center justify-between no-print">
        <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, T&P UID, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs py-2 px-2.5 rounded-lg border border-gray-300 bg-white font-medium text-gray-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="CAT-1">CAT-1 (Super Dream)</option>
            <option value="CAT-2">CAT-2 (Dream)</option>
            <option value="CAT-3">CAT-3 (Normal)</option>
          </select>

          {/* Campus Filter */}
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            className="text-xs py-2 px-2.5 rounded-lg border border-gray-300 bg-white font-medium text-gray-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Campus</option>
            <option value="ON">ON Campus</option>
            <option value="OFF">OFF Campus</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs py-2 px-2.5 rounded-lg border border-gray-300 bg-white font-medium text-gray-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value="Regular">Regular</option>
            <option value="PLI">PLI</option>
            <option value="AEDP">AEDP</option>
            <option value="HackwithInfy">HackwithInfy</option>
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition"
        >
          <Plus className="w-4 h-4" />
          Add Placement Entry
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10 font-bold border-b border-gray-300">
              <tr>
                <th className="p-2.5 border-r border-gray-200 text-center w-12">Sr. No.</th>
                <th className="p-2.5 border-r border-gray-200 w-20">Branch</th>
                <th className="p-2.5 border-r border-gray-200 w-28">T&P (UID)</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[180px]">Student Name</th>
                <th className="p-2.5 border-r border-gray-200 w-32">Visit / Result Date</th>
                <th className="p-2.5 border-r border-gray-200 w-24 text-center">Category</th>
                <th className="p-2.5 border-r border-gray-200 w-24">Type</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[160px]">Employer Name</th>
                <th className="p-2.5 border-r border-gray-200 w-24 text-right">Stipend</th>
                <th className="p-2.5 border-r border-gray-200 w-24 text-right">Salary (LPA)</th>
                <th className="p-2.5 border-r border-gray-200 w-16 text-center">Offers</th>
                <th className="p-2.5 border-r border-gray-200 w-20 text-center">Dual Offer</th>
                <th className="p-2.5 border-r border-gray-200 w-16 text-center">Campus</th>
                <th className="p-2.5 text-center w-20 no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-gray-400">
                    No placement records found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="p-2.5 border-r border-gray-200 text-center font-medium text-gray-500">
                      {row.sr_no}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 font-semibold text-gray-800">
                      {row.branch}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 font-mono text-[11px] text-gray-600">
                      {row.tnp_uid}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 font-medium text-gray-900">
                      {row.student_name}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-gray-600 text-[11px]">
                      {row.employer_visit_date || "—"}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.employer_category === "CAT-1"
                            ? "bg-purple-100 text-purple-800"
                            : row.employer_category === "CAT-2"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {row.employer_category}
                      </span>
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-gray-700">
                      {row.placement_type}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 font-medium text-gray-800">
                      {row.employer_name}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-right text-gray-700">
                      {row.stipend_offered ? `₹${row.stipend_offered}` : "—"}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-right font-bold text-emerald-700">
                      {row.salary_lpa !== null ? `${row.salary_lpa}` : "—"}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-center text-gray-600">
                      {row.num_offers || 1}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-center">
                      {row.dual_offer ? (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold text-[10px]">
                          Yes
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-2.5 border-r border-gray-200 text-center font-medium">
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded ${
                          row.campus_on_off === "ON"
                            ? "bg-green-100 text-green-800"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {row.campus_on_off}
                      </span>
                    </td>
                    <td className="p-2.5 text-center no-print">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(entries.indexOf(row))}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          title="Edit Entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(entries.indexOf(row))}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Statistical Summary Footer in Table */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-gray-700 font-medium">
            <div>
              <span className="text-gray-500">Maximum: </span>
              <strong>{salaryStats.max !== null ? `${salaryStats.max} LPA` : "—"}</strong>
              {stipendStats.max ? ` | ₹${stipendStats.max}` : ""}
            </div>
            <div>
              <span className="text-gray-500">Minimum: </span>
              <strong>{salaryStats.min !== null ? `${salaryStats.min} LPA` : "—"}</strong>
              {stipendStats.min ? ` | ₹${stipendStats.min}` : ""}
            </div>
            <div>
              <span className="text-gray-500">Average: </span>
              <strong>{salaryStats.avg !== null ? `${salaryStats.avg} LPA` : "—"}</strong>
              {stipendStats.avg ? ` | ₹${stipendStats.avg}` : ""}
            </div>
            <div>
              <span className="text-gray-500">Median: </span>
              <strong>{salaryStats.median !== null ? `${salaryStats.median} LPA` : "—"}</strong>
            </div>
            <div>
              <span className="text-gray-500">Mode: </span>
              <strong>{salaryStats.mode !== null ? `${salaryStats.mode} LPA` : "—"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Official Signatories & Due Dates Block */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-xs space-y-4">
        <h4 className="font-bold text-gray-800 border-b pb-2">Approval and Completion Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="border border-gray-200 p-3 rounded-lg text-center">
            <div className="font-bold text-gray-900">
              {report.signatories?.clerk?.name || "(Rajesh Singh)"}
            </div>
            <div className="text-gray-500">{report.signatories?.clerk?.designation || "Sr.Clerk"}</div>
            <div className="text-gray-400 mt-2">Date: {report.signatories?.clerk?.date || "16/10/2026"}</div>
          </div>

          <div className="border border-gray-200 p-3 rounded-lg text-center">
            <div className="font-bold text-gray-900">
              {report.signatories?.placement_officer?.name || "(Ms. Rupali Mane)"}
            </div>
            <div className="text-gray-500">
              {report.signatories?.placement_officer?.designation || "Dy.(Placement Officer)"}
            </div>
            <div className="text-gray-400 mt-2">Date: {report.signatories?.placement_officer?.date || "16/10/2026"}</div>
          </div>

          <div className="border border-gray-200 p-3 rounded-lg text-center">
            <div className="font-bold text-gray-900">
              {report.signatories?.dean?.name || "(Dr. Zahir Aalam)"}
            </div>
            <div className="text-gray-500">{report.signatories?.dean?.designation || "Dean (TP&IL)"}</div>
            <div className="text-gray-400 mt-2">Date: {report.signatories?.dean?.date || "16/10/2026"}</div>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-gray-600">
          <div>
            <strong>Due Date:</strong> {report.due_date || "19/10/2026"}
          </div>
          <div>
            <strong>Completion Date:</strong> {report.completion_date || "16/10/2026"}
          </div>
          <div>
            <strong>Reason if not completed by due date:</strong>{" "}
            {report.reason_if_late || "Capgemini result Declared as on 16/10/2026"}
          </div>
        </div>
      </div>

      {/* Add / Edit Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">
              {editingIndex !== null ? "Edit Placement Entry" : "Add New Student Placement"}
            </h3>

            <form onSubmit={handleSaveModal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. YADAV ANUJ INDRABALAK URMILA"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    T&P UID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.tnp_uid}
                    onChange={(e) => setFormData({ ...formData, tnp_uid: e.target.value })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 25-MCAB50-27"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Branch / Division *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. MCA-A or MCA-B"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Employer Name *
                  </label>
                  <input
                    type="text"
                    required
                    list="company-list-suggestions"
                    value={formData.employer_name}
                    onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Select or type company name"
                  />
                  <datalist id="company-list-suggestions">
                    {companyNames.map((c, i) => (
                      <option key={i} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Employer Category
                  </label>
                  <select
                    value={formData.employer_category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employer_category: e.target.value as any,
                      })
                    }
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="CAT-1">CAT-1 (Super Dream)</option>
                    <option value="CAT-2">CAT-2 (Dream)</option>
                    <option value="CAT-3">CAT-3 (Normal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Placement Type
                  </label>
                  <select
                    value={formData.placement_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        placement_type: e.target.value as any,
                      })
                    }
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Regular">Regular</option>
                    <option value="PLI">PLI</option>
                    <option value="AEDP">AEDP</option>
                    <option value="HackwithInfy">HackwithInfy</option>
                    <option value="OJT">OJT</option>
                    <option value="Off-Campus">Off-Campus</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Salary Offered (INR-LPA)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salary_lpa ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salary_lpa: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 6.25"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Stipend Offered (₹ per month)
                  </label>
                  <input
                    type="text"
                    value={formData.stipend_offered}
                    onChange={(e) => setFormData({ ...formData, stipend_offered: e.target.value })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 7500 or 10000"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Employer Visit & Result Date
                  </label>
                  <input
                    type="text"
                    value={formData.employer_visit_date}
                    onChange={(e) => setFormData({ ...formData, employer_visit_date: e.target.value })}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 09/04/2026 & 09/09/2026"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Campus (ON / OFF)
                  </label>
                  <select
                    value={formData.campus_on_off}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        campus_on_off: e.target.value as any,
                      })
                    }
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="ON">ON Campus</option>
                    <option value="OFF">OFF Campus</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Number of Offers
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.num_offers ?? 1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        num_offers: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="dual_offer_cb"
                    checked={formData.dual_offer}
                    onChange={(e) => setFormData({ ...formData, dual_offer: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="dual_offer_cb" className="text-gray-800 font-semibold cursor-pointer">
                    Dual Offer
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow"
                >
                  {editingIndex !== null ? "Update Entry" : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

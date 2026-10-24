/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import {
  Printer,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  FolderOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch } from "@/lib/api";
import {
  DutyChartPreview,
  DutyChartFormData,
  DutyChartTableRow,
  PRINCIPAL_NAME,
  PRINCIPAL_DESIGNATION,
  PERMANENT_COPY_TO,
} from "./DutyChartPreview";
import "@/pages/DutyChart.css";

interface SavedDraftItem {
  id: number;
  srNo: string;
  subject: string;
  date: string;
  status: string;
  formData: DutyChartFormData;
  tableData: DutyChartTableRow[];
  eventDates: string[];
}

export interface FacultyUserItem {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: string;
}

const getBlankFormData = (serial: string = ""): DutyChartFormData => ({
  srNo: serial,
  date: new Date().toISOString().split("T")[0],
  to: "",
  subject: "",
  intro: "",
  eventDates: [],
  notes: [],
  signatoryName: PRINCIPAL_NAME,
  signatoryDesignation: PRINCIPAL_DESIGNATION,
  copyTo: [...PERMANENT_COPY_TO],
});

const getBlankTableRow = (sr: number = 1): DutyChartTableRow => ({
  srNo: sr,
  name: "",
  designation: "",
  department: "",
  reportingTime: "",
  dutyDates: {},
  sign: "",
  roles: "",
  roleGroupId: "",
});

export const DutyChart: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const reactPrintFn = useReactToPrint({
    contentRef,
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 0 !important;
      }
      @media print {
        body {
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedNoticeId, setSavedNoticeId] = useState<number | null>(null);

  // Notes textarea raw string — kept separate so Enter works naturally
  const [notesRaw, setNotesRaw] = useState<string>("");

  // Form and Table state — completely blank by default
  const [formData, setFormData] = useState<DutyChartFormData>(getBlankFormData());
  const [tableData, setTableData] = useState<DutyChartTableRow[]>([getBlankTableRow(1)]);

  // Backend metadata for draft management & live faculty list
  const [savedDrafts, setSavedDrafts] = useState<SavedDraftItem[]>([]);
  const [showDraftsModal, setShowDraftsModal] = useState<boolean>(false);
  const [newDateInput, setNewDateInput] = useState<string>("");
  const [facultyList, setFacultyList] = useState<FacultyUserItem[]>([]);
  const [manualNameRows, setManualNameRows] = useState<Record<number, boolean>>({});

  // Load genuine serial & metadata
  const loadInitialData = () => {
    setLoading(true);
    apiFetch("/api/staff/duty-chart/initial-data/")
      .then((res) => res.json())
      .then((data) => {
        if (data.nextSerial) {
          setFormData((prev) => ({
            ...prev,
            srNo: data.nextSerial,
            date: data.currentDate || prev.date,
          }));
        }
        if (Array.isArray(data.facultyList)) {
          setFacultyList(data.facultyList);
        }
      })
      .catch((err) => {
        console.warn("Failed fetching duty chart initial data:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Sync notesRaw → formData.notes only when losing focus, not on every keystroke,
  // so that intermediate empty lines (while typing) don't get stripped.
  const handleNotesBlur = () => {
    const lines = notesRaw.split("\n").filter((l) => l.trim().length > 0);
    setFormData((prev) => ({ ...prev, notes: lines }));
  };

  // When a draft is loaded, restore notesRaw from the loaded notes array
  const syncNotesFromFormData = (notes: string[]) => {
    setNotesRaw(notes.join("\n"));
  };

  // Fetch saved drafts
  const fetchDrafts = () => {
    apiFetch("/api/staff/duty-chart/drafts/")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSavedDrafts(data);
          setShowDraftsModal(true);
        }
      })
      .catch((err) => {
        console.error("Error loading drafts:", err);
        toast.error("Could not fetch saved drafts");
      });
  };

  // Load a selected saved draft
  const loadSavedDraft = (draft: SavedDraftItem) => {
    if (draft.formData) {
      setFormData({
        ...draft.formData,
        signatoryName: PRINCIPAL_NAME,
        signatoryDesignation: PRINCIPAL_DESIGNATION,
        copyTo: [...PERMANENT_COPY_TO],
      });
      syncNotesFromFormData(draft.formData.notes || []);
    }
    if (draft.tableData && draft.tableData.length > 0) {
      setTableData(draft.tableData);
    }
    setSavedNoticeId(draft.id);
    setShowDraftsModal(false);
    toast.success(`Loaded draft #${draft.id}: ${draft.subject || "Duty Chart"}`);
  };

  // Reset to brand new blank Duty Chart
  const handleNewBlankDutyChart = () => {
    setLoading(true);
    apiFetch("/api/staff/duty-chart/initial-data/")
      .then((res) => res.json())
      .then((data) => {
        setFormData(getBlankFormData(data.nextSerial || ""));
        setTableData([getBlankTableRow(1)]);
        setNotesRaw("");
        setSavedNoticeId(null);
        if (Array.isArray(data.facultyList)) {
          setFacultyList(data.facultyList);
        }
        toast.success("Created new blank Duty Chart");
      })
      .catch(() => {
        setFormData(getBlankFormData(""));
        setTableData([getBlankTableRow(1)]);
        setNotesRaw("");
        setSavedNoticeId(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Form input changes (single-line inputs & intro textarea only)
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Event Date column management
  const addEventDate = () => {
    const trimmed = newDateInput.trim();
    if (!trimmed) return;
    if (formData.eventDates.includes(trimmed)) {
      toast.error("Date column already exists");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      eventDates: [...prev.eventDates, trimmed],
    }));
    setNewDateInput("");
    toast.success(`Added date column "${trimmed}"`);
  };

  const removeEventDate = (dateToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      eventDates: prev.eventDates.filter((d) => d !== dateToRemove),
    }));
    toast.success(`Removed column "${dateToRemove}"`);
  };

  // Table row operations
  const handleTableCellChange = (
    index: number,
    field: keyof DutyChartTableRow,
    value: any
  ) => {
    setTableData((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  // Autofill faculty details from admin database selection
  const handleFacultySelect = (index: number, selectedName: string) => {
    if (selectedName === "__custom__") {
      setManualNameRows((prev) => ({ ...prev, [index]: true }));
      return;
    }
    if (!selectedName) {
      handleTableCellChange(index, "name", "");
      return;
    }
    const faculty = facultyList.find((f) => f.name === selectedName);
    if (faculty) {
      setTableData((prev) =>
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                name: faculty.name,
                designation: faculty.designation || row.designation,
                department: faculty.department || row.department,
              }
            : row
        )
      );
      toast.success(`Autofilled details for ${faculty.name}`);
    } else {
      handleTableCellChange(index, "name", selectedName);
    }
  };

  const toggleDutyDate = (rowIndex: number, dateHeader: string) => {
    setTableData((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        const currentDates = row.dutyDates || {};
        return {
          ...row,
          dutyDates: {
            ...currentDates,
            [dateHeader]: !currentDates[dateHeader],
          },
        };
      })
    );
  };

  const addRow = () => {
    const newSrNo = tableData.length + 1;
    const newRow = getBlankTableRow(newSrNo);
    setTableData((prev) => [...prev, newRow]);
  };

  const removeRow = (index: number) => {
    if (tableData.length <= 1) {
      setTableData([getBlankTableRow(1)]);
      return;
    }
    setTableData((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((r, i) => ({ ...r, srNo: i + 1 }));
    });
  };



  // Save draft to backend — flush notesRaw first
  const handleSaveDraft = async () => {
    setSaving(true);
    // Flush notes before saving
    const flushedNotes = notesRaw.split("\n").filter((l) => l.trim().length > 0);
    const latestFormData = {
      ...formData,
      notes: flushedNotes,
      signatoryName: PRINCIPAL_NAME,
      signatoryDesignation: PRINCIPAL_DESIGNATION,
      copyTo: [...PERMANENT_COPY_TO],
    };
    setFormData(latestFormData);
    try {
      const payload = {
        id: savedNoticeId,
        status: "DRAFT",
        formData: latestFormData,
        tableData,
        eventDates: latestFormData.eventDates,
      };
      const res = await apiFetch("/api/staff/duty-chart/drafts/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSavedNoticeId(data.id);
        toast.success(data.message || "Duty Chart saved successfully!");
      } else {
        toast.error("Failed saving Duty Chart");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  // Compute live formData with current notesRaw for the preview
  const previewFormData: DutyChartFormData = {
    ...formData,
    notes: notesRaw.split("\n").filter((l) => l.trim().length > 0),
    signatoryName: PRINCIPAL_NAME,
    signatoryDesignation: PRINCIPAL_DESIGNATION,
    copyTo: [...PERMANENT_COPY_TO],
  };

  if (loading) {
    return (
      <div className="dc-manager-container">
        <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
          Loading Duty Chart…
        </div>
      </div>
    );
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontWeight: 700,
    fontSize: "16px",
    lineHeight: 1.5,
    letterSpacing: "0.00938em",
    color: "var(--foreground, #1e293b)",
    margin: "0 0 12px 0",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const blueDotStyle: React.CSSProperties = {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#3b82f6",
    flexShrink: 0,
  };

  return (
    <div className="dc-manager-container">
      {/* ── Toolbar (replaces removed blue header) ────────────────────────── */}
      <div className="dc-toolbar dc-toolbar-top">
        <button
          onClick={handleNewBlankDutyChart}
          className="dc-btn dc-btn-secondary dc-btn-sm"
          title="Reset all variable fields to a clean blank state"
        >
          <RotateCcw size={13} /> Reset
        </button>

        <button
          onClick={fetchDrafts}
          className="dc-btn dc-btn-secondary dc-btn-sm"
          title="Open previously saved Duty Charts"
        >
          <FolderOpen size={13} /> Load Draft
        </button>

        <span style={{ marginLeft: "auto", fontSize: "12px", color: "#64748b" }}>
          Total Assignments: <strong>{tableData.length}</strong>
        </span>
      </div>

      {/* ── Form Card ─────────────────────────────────────────────────────── */}
      <div className="dc-card">
        <div className="dc-card-body">
          <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Section: Document Metadata */}
            <div>
              <h3 style={sectionTitleStyle}>
                <span style={blueDotStyle} />
                Document Metadata
              </h3>
              <div className="dc-grid-3">
                <div className="dc-form-group">
                  <input
                    type="text"
                    name="srNo"
                    value={formData.srNo}
                    onChange={handleInputChange}
                    className="dc-input"
                    placeholder="Reference Number"
                  />
                </div>
                <div className="dc-form-group">
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="dc-input"
                  />
                </div>
                <div className="dc-form-group">
                  <input
                    type="text"
                    name="to"
                    value={formData.to}
                    onChange={handleInputChange}
                    className="dc-input"
                    placeholder="To"
                  />
                </div>
              </div>
            </div>

            {/* Section: Subject & Introduction */}
            <div>
              <h3 style={sectionTitleStyle}>
                <span style={blueDotStyle} />
                Subject &amp; Introduction
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="dc-form-group">
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="dc-input"
                    placeholder="Subject"
                  />
                </div>
                <div className="dc-form-group">
                  <textarea
                    name="intro"
                    value={formData.intro}
                    onChange={handleInputChange}
                    className="dc-textarea"
                    rows={3}
                    placeholder="Introduction"
                  />
                </div>
              </div>
            </div>

            {/* Section: Event Date Columns */}
            <div>
              <h3 style={sectionTitleStyle}>
                <span style={blueDotStyle} />
                Event Date Columns
              </h3>
              <div className="dc-form-group">
                <div className="dc-dates-editor">
                  {formData.eventDates.map((d) => (
                    <span key={d} className="dc-date-tag">
                      {d}
                      <span
                        onClick={() => removeEventDate(d)}
                        className="dc-tag-close"
                        title="Remove column"
                      >
                        &times;
                      </span>
                    </span>
                  ))}
                  <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Add date (e.g. 10th Sep)"
                      value={newDateInput}
                      onChange={(e) => setNewDateInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addEventDate();
                        }
                      }}
                      className="dc-input"
                      style={{ padding: "4px 8px", width: "160px", fontSize: "12px" }}
                    />
                    <button
                      type="button"
                      onClick={addEventDate}
                      className="dc-btn dc-btn-secondary dc-btn-sm"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Duty Assignment Table Editor */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <h3 style={sectionTitleStyle}>
                  <span style={blueDotStyle} />
                  Faculty &amp; Staff Duty Roster
                </h3>
                <button
                  type="button"
                  onClick={addRow}
                  className="dc-btn dc-btn-primary dc-btn-sm"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>

              <div className="dc-table-editor-wrapper">
                <table className="dc-editor-table">
                  <colgroup>
                    <col style={{ width: "45px" }} />
                    <col style={{ width: "210px" }} />
                    <col style={{ width: "130px" }} />
                    <col style={{ width: "90px" }} />
                    <col style={{ width: "100px" }} />
                    {formData.eventDates.map((d) => (
                      <col key={d} style={{ width: "70px" }} />
                    ))}
                    <col style={{ width: "70px" }} />{/* Sign */}
                    <col style={{ width: "260px" }} />
                    <col style={{ width: "80px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ width: "45px", textAlign: "center" }}>Sr.</th>
                      <th style={{ width: "210px", textAlign: "center" }}>Faculty / Staff Name</th>
                      <th style={{ width: "130px", textAlign: "center" }}>Designation</th>
                      <th style={{ width: "90px", textAlign: "center" }}>Dept</th>
                      <th style={{ width: "100px", textAlign: "center" }}>Reporting Time</th>
                      {formData.eventDates.map((d) => (
                        <th key={d} style={{ width: "70px", textAlign: "center" }}>
                          {d} (Duty)
                        </th>
                      ))}
                      <th style={{ width: "70px", textAlign: "center" }}>Sign</th>
                      <th style={{ width: "260px", textAlign: "center" }}>Roles and Responsibilities</th>
                      <th style={{ width: "80px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, index) => (
                      <tr key={index}>
                        <td style={{ textAlign: "center", verticalAlign: "middle", fontWeight: "bold" }}>
                          {row.srNo ?? index + 1}
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          {manualNameRows[index] ? (
                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) =>
                                  handleTableCellChange(index, "name", e.target.value)
                                }
                                className="dc-editor-input"
                                style={{ textAlign: "center" }}
                                placeholder="Enter Name"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setManualNameRows((prev) => ({ ...prev, [index]: false }))
                                }
                                className="dc-btn dc-btn-secondary dc-btn-sm"
                                style={{ padding: "2px 6px", fontSize: "11px", height: "26px", whiteSpace: "nowrap" }}
                                title="Switch back to dropdown list"
                              >
                                List
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                              <select
                                value={row.name}
                                onChange={(e) => handleFacultySelect(index, e.target.value)}
                                className="dc-editor-input dc-editor-select"
                                style={{ textAlign: "left", fontSize: "12px", height: "28px", cursor: "pointer", width: "100%" }}
                              >
                                <option value="">-- Select Faculty / Staff --</option>
                                {row.name && !facultyList.some((f) => f.name === row.name) && (
                                  <option value={row.name}>{row.name} (Custom)</option>
                                )}
                                {facultyList.map((f) => (
                                  <option key={f.id} value={f.name}>
                                    {f.name} {f.department ? `(${f.department})` : ""}
                                  </option>
                                ))}
                                <option value="__custom__">+ Type Custom Name...</option>
                              </select>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <input
                            type="text"
                            value={row.designation}
                            onChange={(e) =>
                              handleTableCellChange(index, "designation", e.target.value)
                            }
                            className="dc-editor-input"
                            style={{ textAlign: "center" }}
                            placeholder="Designation"
                          />
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <input
                            type="text"
                            value={row.department}
                            onChange={(e) =>
                              handleTableCellChange(index, "department", e.target.value)
                            }
                            className="dc-editor-input"
                            style={{ textAlign: "center" }}
                            placeholder="Dept"
                          />
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <input
                            type="text"
                            value={row.reportingTime}
                            onChange={(e) =>
                              handleTableCellChange(index, "reportingTime", e.target.value)
                            }
                            className="dc-editor-input"
                            style={{ textAlign: "center" }}
                            placeholder="09.30"
                          />
                        </td>

                        {/* Event Date Duty Toggles */}
                        {formData.eventDates.map((d) => {
                          const isAssigned = row.dutyDates ? !!row.dutyDates[d] : false;
                          return (
                            <td key={d} style={{ textAlign: "center", verticalAlign: "middle" }}>
                              <button
                                type="button"
                                onClick={() => toggleDutyDate(index, d)}
                                style={{
                                  width: "28px",
                                  height: "26px",
                                  borderRadius: "4px",
                                  border: isAssigned ? "1px solid #16a34a" : "1px solid #cbd5e1",
                                  background: isAssigned ? "#dcfce7" : "#ffffff",
                                  color: isAssigned ? "#15803d" : "#94a3b8",
                                  fontWeight: "bold",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                }}
                                title={`Toggle duty mark for ${d}`}
                              >
                                {isAssigned ? "√" : "-"}
                              </button>
                            </td>
                          );
                        })}

                        {/* Sign column */}
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <input
                            type="text"
                            value={row.sign ?? ""}
                            onChange={(e) =>
                              handleTableCellChange(index, "sign", e.target.value)
                            }
                            className="dc-editor-input"
                            style={{ textAlign: "center" }}
                            placeholder="Sign"
                          />
                        </td>

                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <textarea
                            value={row.roles}
                            onChange={(e) =>
                              handleTableCellChange(index, "roles", e.target.value)
                            }
                            className="dc-editor-input"
                            rows={2}
                            style={{ textAlign: "center" }}
                            placeholder="Roles & Responsibilities"
                          />
                        </td>
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="dc-btn dc-btn-danger dc-btn-sm"
                            style={{ padding: "4px 8px" }}
                            title="Remove Row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section: Notes, Signatory & Copy To */}
            <div>
              <h3 style={sectionTitleStyle}>
                <span style={blueDotStyle} />
                Notes, Signatory &amp; Copy To
              </h3>
              <div className="dc-grid-2">
                <div className="dc-form-group">
                  {/*
                    Notes textarea uses its own raw state so Enter inserts newlines
                    naturally. We flush to formData.notes only on blur.
                  */}
                  <textarea
                    value={notesRaw}
                    onChange={(e) => setNotesRaw(e.target.value)}
                    onBlur={handleNotesBlur}
                    onKeyDown={(e) => {
                      // Allow Enter to insert a newline — do NOT submit or preventDefault
                      if (e.key === "Enter") {
                        // Let the browser handle it naturally
                        return;
                      }
                    }}
                    className="dc-textarea"
                    rows={3}
                    placeholder="Note"
                  />
                </div>

                <div className="dc-form-group">
                  <label className="dc-form-label">Copy To (Permanent)</label>
                  <div
                    className="dc-input"
                    style={{
                      backgroundColor: "#f8fafc",
                      color: "#0f172a",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      cursor: "default",
                      userSelect: "none",
                      height: "auto",
                      padding: "8px 12px",
                    }}
                  >
                    {PERMANENT_COPY_TO.map((entry) => (
                      <div key={entry}>{entry}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="dc-grid-2" style={{ marginTop: "12px" }}>
                <div className="dc-form-group">
                  <label className="dc-form-label">Principal / Signatory Name</label>
                  <div
                    className="dc-input"
                    style={{
                      backgroundColor: "#f8fafc",
                      color: "#0f172a",
                      fontWeight: 600,
                      cursor: "default",
                      userSelect: "none",
                    }}
                  >
                    {PRINCIPAL_NAME}
                  </div>
                </div>
                <div className="dc-form-group">
                  <label className="dc-form-label">Signatory Designation</label>
                  <div
                    className="dc-input"
                    style={{
                      backgroundColor: "#f8fafc",
                      color: "#0f172a",
                      fontWeight: 600,
                      cursor: "default",
                      userSelect: "none",
                    }}
                  >
                    {PRINCIPAL_DESIGNATION}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "16px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="dc-btn dc-btn-primary"
              >
                <Save size={15} /> {saving ? "Saving…" : "Save Draft"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Permanently Visible Live Preview Card ───────── */}
      <div className="dc-card">
        <div
          style={{
            padding: "12px 20px",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: "15px",
              color: "#1e3a8a",
            }}
          >
            Live Duty Chart Preview
          </span>

          <button
            type="button"
            onClick={() => reactPrintFn()}
            className="dc-btn dc-btn-primary dc-btn-sm"
            style={{ padding: "6px 16px", fontSize: "13px", fontWeight: 600 }}
          >
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>

        <div
          style={{
            backgroundColor: "#525659",
            padding: "24px",
            display: "flex",
            justifyContent: "center",
            overflowX: "auto",
          }}
        >
          <div style={{ width: "100%", maxWidth: "850px" }}>
            {/* The live document — ref attached here for react-to-print */}
            <DutyChartPreview
              formData={previewFormData}
              tableData={tableData}
              ref={contentRef}
            />
          </div>
        </div>
      </div>

      {/* Saved Drafts Modal */}
      {showDraftsModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              width: "560px",
              maxWidth: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1e3a8a" }}>Saved Duty Chart Drafts</h3>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="dc-btn dc-btn-secondary dc-btn-sm"
              >
                Close
              </button>
            </div>

            {savedDrafts.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
                No saved drafts found.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {savedDrafts.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      padding: "12px 16px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
                        {d.subject || "Untitled Duty Chart"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Sr No: {d.srNo || "N/A"} &bull; Date: {d.date} &bull; Status: {d.status}
                      </div>
                    </div>
                    <button
                      onClick={() => loadSavedDraft(d)}
                      className="dc-btn dc-btn-primary dc-btn-sm"
                    >
                      Load Draft
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DutyChart;

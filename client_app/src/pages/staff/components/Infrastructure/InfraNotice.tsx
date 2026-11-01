import React, { useState, useRef, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, Plus, Trash2, RotateCcw, FolderOpen, Save } from "lucide-react";
import toast from "react-hot-toast";
import "@/pages/DutyChart.css";
import NoticePreview from "./NoticePreview";

export interface InfraTableRow {
  particulars: string;
  requirements: string;
  remarks: string;
}

export interface InfraFormData {
  refNo: string;
  date: string;
  toName: string;
  toDesignation: string;
  toInstitution: string;
  toCity: string;
  toPin: string;
  senderName: string;
  senderDesignation: string;
  senderInstitution: string;
  senderCity: string;
  senderPin: string;
  subject: string;
  salutation: string;
  introParagraph: string;
  note: string;
  closingParagraph: string;
  thankingLine: string;
  regardsLine: string;
  signatoryName: string;
  signatoryDesignation: string;
  copyTo: string;
  tableRows: InfraTableRow[];
}

export interface InfraDraftItem {
  id: string;
  subject: string;
  refNo: string;
  date: string;
  savedAt: string;
  formData: InfraFormData;
}

const emptyRow = (): InfraTableRow => ({
  particulars: "",
  requirements: "",
  remarks: "",
});

const defaultTableRows: InfraTableRow[] = [
  { particulars: "Infrastructure", requirements: "", remarks: "" },
  { particulars: "Human Resource", requirements: "", remarks: "" },
  { particulars: "ICT", requirements: "", remarks: "" },
  { particulars: "Maintenance", requirements: "", remarks: "" },
];

const getInitialFormData = (): InfraFormData => ({
  refNo: "",
  date: new Date().toISOString().split("T")[0],
  toName: "The Principal",
  toDesignation: "",
  toInstitution: "TCET",
  toCity: "Kandivali East",
  toPin: "Mumbai – 400101",
  senderName: "Dr. Zahir Aalam",
  senderDesignation: "Dean (TP&IL)",
  senderInstitution: "TCET",
  senderCity: "Kandivali East",
  senderPin: "Mumbai – 400101",
  subject: "",
  salutation: "Respected Sir,",
  introParagraph: "",
  note: "",
  closingParagraph:
    "Please advise to the respective department about the necessary arrangements mentioned above for the smooth conduction of the Program.",
  thankingLine: "Thanking you.",
  regardsLine: "Yours Sincerely,",
  signatoryName: "Dr. Zahir Aalam",
  signatoryDesignation: "Dean (TP&IL)",
  copyTo:
    "Principal / Vice-Principal / All Deans / HODs / Section in charges / Librarian / Mr. Binay Vyas",
  tableRows: defaultTableRows.map((r) => ({ ...r })),
});

const InfrastructureBooking = () => {
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

  // User-input fields are blank by default; official institutional content is automatically populated
  const [formData, setFormData] = useState<InfraFormData>(getInitialFormData);
  const [saving, setSaving] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<InfraDraftItem[]>([]);

  useEffect(() => {
    try {
      const existingRaw = localStorage.getItem("tnp_infra_booking_drafts");
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) {
          setSavedDrafts(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleResetForm = () => {
    setFormData(getInitialFormData());
    toast.success("Infrastructure form reset to clean state");
  };

  const handleSaveDraft = () => {
    try {
      setSaving(true);
      const newDraft: InfraDraftItem = {
        id: String(Date.now()),
        subject: formData.subject.trim() || "Untitled Infrastructure Booking",
        refNo: formData.refNo.trim() || "N/A",
        date: formData.date || new Date().toISOString().split("T")[0],
        savedAt: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        formData: JSON.parse(JSON.stringify(formData)),
      };

      const existingRaw = localStorage.getItem("tnp_infra_booking_drafts");
      let draftsList: InfraDraftItem[] = [];
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          if (Array.isArray(parsed)) draftsList = parsed;
        } catch (e) {
          console.error("Failed to parse drafts:", e);
        }
      }

      draftsList = [newDraft, ...draftsList.filter((d) => d.id !== newDraft.id)].slice(0, 25);
      localStorage.setItem("tnp_infra_booking_drafts", JSON.stringify(draftsList));
      setSavedDrafts(draftsList);
      toast.success("Infrastructure draft saved successfully!");
    } catch (err) {
      console.error("Error saving draft:", err);
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDrafts = () => {
    try {
      const existingRaw = localStorage.getItem("tnp_infra_booking_drafts");
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) {
          setSavedDrafts(parsed);
        }
      } else {
        setSavedDrafts([]);
      }
    } catch (err) {
      console.error("Error reading saved drafts:", err);
      setSavedDrafts([]);
    }
    setShowDraftsModal(true);
  };

  const handleLoadDraft = (draft: InfraDraftItem) => {
    if (draft.formData) {
      setFormData(draft.formData);
      setShowDraftsModal(false);
      toast.success(`Loaded draft: ${draft.subject || "Infrastructure Notice"}`);
    }
  };

  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = savedDrafts.filter((d) => d.id !== id);
      setSavedDrafts(updated);
      localStorage.setItem("tnp_infra_booking_drafts", JSON.stringify(updated));
      toast.success("Draft deleted");
    } catch (err) {
      console.error("Error deleting draft:", err);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTableRowChange = (
    index: number,
    field: keyof InfraTableRow,
    value: string
  ) => {
    setFormData((prev) => {
      const updated = [...prev.tableRows];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, tableRows: updated };
    });
  };

  const addRow = () => {
    setFormData((prev) => ({
      ...prev,
      tableRows: [...prev.tableRows, emptyRow()],
    }));
  };

  const removeRow = (index: number) => {
    if (formData.tableRows.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      tableRows: prev.tableRows.filter((_, i) => i !== index),
    }));
  };

  const resetTable = () => {
    setFormData((prev) => ({
      ...prev,
      tableRows: defaultTableRows.map((r) => ({ ...r })),
    }));
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontWeight: 700,
    fontSize: "16px",
    lineHeight: 1.5,
    letterSpacing: "0.00938em",
    color: "#000000",
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
    <div style={{ maxWidth: "1040px", margin: "0 auto", padding: "16px", fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" }}>
      {/* ── Top Draft-Control Bar (matches Duty Chart) ────────────────── */}
      <div className="dc-toolbar dc-toolbar-top">
        <button
          type="button"
          onClick={handleResetForm}
          className="dc-btn dc-btn-secondary dc-btn-sm"
          title="Reset all variable fields to a clean blank state"
        >
          <RotateCcw size={13} /> Reset
        </button>

        <button
          type="button"
          onClick={handleOpenDrafts}
          className="dc-btn dc-btn-secondary dc-btn-sm"
          title="Open previously saved Infrastructure Notices"
        >
          <FolderOpen size={13} /> Load Draft
        </button>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving}
          className="dc-btn dc-btn-primary dc-btn-sm"
          style={{ marginLeft: "auto" }}
          title="Save current Infrastructure Notice as draft"
        >
          <Save size={13} /> {saving ? "Saving…" : "Save Draft"}
        </button>
      </div>

      {/* Form Card using Duty Chart styling */}
      <div className="dc-card infra-form-editor">
        <style>{`
          .infra-form-editor {
            font-family: "Roboto", "Helvetica", "Arial", sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          .infra-form-editor .dc-form-label {
            color: #000000;
            font-family: "Roboto", "Helvetica", "Arial", sans-serif;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.4375;
            letter-spacing: 0.02857em;
          }
          .infra-form-editor .dc-input,
          .infra-form-editor .dc-textarea,
          .infra-form-editor .dc-editor-input {
            color: #000000;
            font-family: "Roboto", "Helvetica", "Arial", sans-serif;
            font-size: 14px;
            font-weight: 400;
            line-height: 1.4375;
            letter-spacing: 0.00938em;
          }
          .infra-form-editor .dc-input::placeholder,
          .infra-form-editor .dc-textarea::placeholder,
          .infra-form-editor .dc-editor-input::placeholder {
            color: #94a3b8;
            opacity: 1;
            font-family: "Roboto", "Helvetica", "Arial", sans-serif;
            font-size: 14px;
            font-weight: 400;
          }
          .infra-form-editor .dc-editor-table {
            width: 100%;
            table-layout: fixed;
          }
          .infra-form-editor .dc-editor-table th {
            color: #000000;
            font-family: "Roboto", "Helvetica", "Arial", sans-serif;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.43;
            letter-spacing: 0.01071em;
            text-align: center;
          }
          .infra-form-editor .dc-editor-table td {
            color: #000000;
            font-family: "Roboto", "Helvetica", "Arial", sans-serif;
            font-size: 13px;
            font-weight: 400;
            line-height: 1.43;
            text-align: center;
            vertical-align: middle;
          }
          .infra-form-editor .dc-editor-table td textarea {
            width: 100% !important;
            box-sizing: border-box !important;
            display: block;
            text-align: center;
          }
          .infra-form-editor .dc-editor-table td input {
            width: 100% !important;
            box-sizing: border-box !important;
            text-align: center;
          }
          .infra-form-editor .dc-editor-table td textarea::placeholder,
          .infra-form-editor .dc-editor-table td input::placeholder {
            text-align: center;
          }
          .infra-form-editor .dc-btn {
            font-family: "Roboto", "Helvetica", "Arial", sans-serif;
            font-size: 13px;
            font-weight: 500;
            line-height: 1.75;
            letter-spacing: 0.02857em;
          }
        `}</style>
        <div className="dc-card-body">
          <form style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Section: Reference & Date */}
            <div>
              <h3 style={sectionTitleStyle}>
                <span style={blueDotStyle} />
                Reference &amp; Date
              </h3>
              <div className="dc-grid-2">
                <div className="dc-form-group">
                  <input
                    type="text"
                    name="refNo"
                    value={formData.refNo}
                    onChange={handleInputChange}
                    placeholder="Reference Number"
                    className="dc-input"
                    style={{ color: "#000000" }}
                  />
                </div>
                <div className="dc-form-group">
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="dc-input"
                    style={{ color: "#000000" }}
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
                    placeholder="Subject"
                    className="dc-input"
                    style={{ color: "#000000" }}
                  />
                </div>
                <div className="dc-form-group">
                  <textarea
                    name="introParagraph"
                    value={formData.introParagraph}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Introduction"
                    className="dc-textarea"
                    style={{ color: "#000000" }}
                  />
                </div>
              </div>
            </div>

            {/* Section: Infrastructure Details Table */}
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
                  Infrastructure Booking Requirements Table
                </h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={resetTable}
                    className="dc-btn dc-btn-secondary dc-btn-sm"
                    title="Reset table to default rows"
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                  <button
                    type="button"
                    onClick={addRow}
                    className="dc-btn dc-btn-primary dc-btn-sm"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>

              <div className="dc-table-editor-wrapper">
                <table className="dc-editor-table" style={{ width: "100%", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "46%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ width: "22%", textAlign: "center", color: "#000000" }}>
                        Particulars
                      </th>
                      <th style={{ width: "46%", textAlign: "center", color: "#000000" }}>
                        Requirements
                      </th>
                      <th style={{ width: "26%", textAlign: "center", color: "#000000" }}>
                        Remark
                      </th>
                      <th style={{ width: "6%", textAlign: "center", color: "#000000" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.tableRows.map((row, index) => (
                      <tr key={index}>
                        <td style={{ verticalAlign: "middle", textAlign: "center", color: "#000000" }}>
                          <input
                            type="text"
                            value={row.particulars}
                            onChange={(e) =>
                              handleTableRowChange(
                                index,
                                "particulars",
                                e.target.value
                              )
                            }
                            placeholder="Particulars"
                            className="dc-editor-input"
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              fontWeight: 600,
                              color: "#000000",
                              textAlign: "center",
                            }}
                          />
                        </td>
                        <td style={{ verticalAlign: "middle", textAlign: "center", color: "#000000" }}>
                          <textarea
                            value={row.requirements}
                            onChange={(e) =>
                              handleTableRowChange(
                                index,
                                "requirements",
                                e.target.value
                              )
                            }
                            rows={2}
                            placeholder="Requirements"
                            className="dc-textarea"
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              display: "block",
                              minHeight: "56px",
                              fontSize: "13px",
                              color: "#000000",
                              textAlign: "center",
                            }}
                          />
                        </td>
                        <td style={{ verticalAlign: "middle", textAlign: "center", color: "#000000" }}>
                          <textarea
                            value={row.remarks}
                            onChange={(e) =>
                              handleTableRowChange(
                                index,
                                "remarks",
                                e.target.value
                              )
                            }
                            rows={2}
                            placeholder="Remark"
                            className="dc-textarea"
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              display: "block",
                              minHeight: "56px",
                              fontSize: "13px",
                              color: "#000000",
                              textAlign: "center",
                            }}
                          />
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            disabled={formData.tableRows.length <= 1}
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

            {/* Section: Note */}
            <div>
              <h3 style={sectionTitleStyle}>
                <span style={blueDotStyle} />
                Note:
              </h3>
              <div className="dc-form-group">
                <textarea
                  name="note"
                  value={formData.note}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Note"
                  className="dc-textarea"
                  style={{ color: "#000000" }}
                />
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Permanently Visible Live Preview Card */}
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
            Live Notice Preview
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
            <NoticePreview formData={formData} ref={contentRef} />
          </div>
        </div>
      </div>

      {/* Saved Drafts Modal (matching Duty Chart) */}
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
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1e3a8a", fontWeight: 700 }}>Saved Infrastructure Drafts</h3>
              <button
                type="button"
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
                        {d.subject || "Untitled Infrastructure Booking"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Ref No: {d.refNo || "N/A"} &bull; Date: {d.date} &bull; Saved: {d.savedAt}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => handleLoadDraft(d)}
                        className="dc-btn dc-btn-primary dc-btn-sm"
                      >
                        Load Draft
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteDraft(d.id, e)}
                        className="dc-btn dc-btn-danger dc-btn-sm"
                        style={{ padding: "4px 8px" }}
                        title="Delete Draft"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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

export default InfrastructureBooking;

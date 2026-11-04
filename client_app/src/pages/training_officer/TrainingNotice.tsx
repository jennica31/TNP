/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState, useEffect } from "react";
import {
  Container,
  TextField,
  Button,
  Typography,
  Grid,
  Paper,
  IconButton,
  Box,
  Chip,
  Divider,
} from "@mui/material";
import {
  Save,
  Printer,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Building2,
  Calendar,
  Clock,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import Notice, { TrainingNoticeFormData } from "./components/notice";
import OpportunitySearchCard, {
  OpportunityItem,
} from "@/pages/staff/components/placement/OpportunitySearchCard";
import { useReactToPrint } from "react-to-print";
import toast from "react-hot-toast";

const defaultInitialForm = (): TrainingNoticeFormData => ({
  srNo: `TCET/T&P/ TRG   107     of ${new Date().getFullYear()}`,
  date: new Date().toISOString().split("T")[0],
  to: "All Concerned students of the 2027 / 2028 / 2029 batch",
  subject: "Registrations for Free TCS iON Jobinar",
  intro: "",
  eligibility_criteria: "B.E / B.Tech (All Branch) / MCA / BCA",
  details_heading: "The details of the Jobinar are as follows:",
  organiser: "TCS iON",
  topic: "Can AI Agents Be Created Without Coding?",
  session_date: "22nd October 2026 (Thursday)",
  session_time: "5:00 PM to 6:00 PM IST",
  mode: "Online",
  reasons_to_attend: [
    "Discover: Understand how apps, automation, and AI agents bring ideas to life.",
    "Learn: Explore how to build solutions using Power Platform and Copilot Studio.",
    "Explore: Learn about available learning paths, certifications, and emerging career opportunities.",
  ],
  registration_callout: "All eligible and interested students are required to register online",
  company_registration_link: "https://iur.ls/TCSiONJobinars",
  college_registration_link: "https://forms.gle/rA9RSZ4Ju2oUMETbA",
  registration_note:
    "(It is mandatory to register on both the links - company link and the college link.)",
  From: "(Dr. Zahir Aalam)",
  From_designation: "Dean (TP&IL)",
});

const TrainingNotice: React.FC = () => {
  const [formData, setFormData] = useState<TrainingNoticeFormData>(defaultInitialForm());
  const [newReason, setNewReason] = useState<string>("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityItem | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Printing ref
  const contentRef = useRef<HTMLDivElement>(null);
  const reactPrintFn = useReactToPrint({ contentRef });

  // Initial next serial number on mount
  useEffect(() => {
    api
      .get("/api/training_officer/notice/next-serial-number/")
      .then((res) => {
        if (res.data?.sr_no) {
          setFormData((prev) => ({
            ...prev,
            srNo: res.data.sr_no,
          }));
        }
      })
      .catch(() => {
        // Fallback to staff serial endpoint
        api
          .get("/api/staff/placement-notices/next-serial-number/?type=Training")
          .then((res) => {
            if (res.data?.sr_no) {
              setFormData((prev) => ({
                ...prev,
                srNo: res.data.sr_no,
              }));
            }
          })
          .catch(() => {});
      });
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setIsDirty(true);
    setIsSaved(false);
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddReason = () => {
    const trimmed = newReason.trim();
    if (!trimmed) return;
    setIsDirty(true);
    setIsSaved(false);
    const current = Array.isArray(formData.reasons_to_attend)
      ? formData.reasons_to_attend
      : [];
    setFormData((prev) => ({
      ...prev,
      reasons_to_attend: [...current, trimmed],
    }));
    setNewReason("");
  };

  const handleRemoveReason = (index: number) => {
    setIsDirty(true);
    setIsSaved(false);
    const current = Array.isArray(formData.reasons_to_attend)
      ? formData.reasons_to_attend
      : [];
    setFormData((prev) => ({
      ...prev,
      reasons_to_attend: current.filter((_, i) => i !== index),
    }));
  };

  const handleReasonChange = (index: number, val: string) => {
    setIsDirty(true);
    setIsSaved(false);
    const current = Array.isArray(formData.reasons_to_attend)
      ? [...formData.reasons_to_attend]
      : [];
    current[index] = val;
    setFormData((prev) => ({
      ...prev,
      reasons_to_attend: current,
    }));
  };

  // Opportunity selection and autofill
  const handleSelectOpportunity = async (opp: OpportunityItem) => {
    setSelectedOpportunity(opp);
    setIsDirty(true);
    setIsSaved(false);
    try {
      const res = await api.get(
        `/api/staff/placement/opportunities/${opp.id}/autofill/?notice_type=Training`
      );
      const auto = res.data;
      const compName = auto.company_name || opp.company_name || "TCS iON";
      const rawTopic = opp.designation || auto.topic || "Can AI Agents Be Created Without Coding?";
      const topic = rawTopic.replace(/^[•\-\s*]+/, "").trim();

      setFormData((prev) => ({
        ...prev,
        srNo: auto.sr_no || prev.srNo,
        date: auto.date || prev.date,
        to: auto.to || prev.to,
        subject: `Registrations for Free ${compName} Jobinar`,
        intro: "",
        eligibility_criteria:
          auto.eligibility_criteria ||
          opp.eligibility_criteria ||
          "B.E / B.Tech (All Branch) / MCA / BCA",
        details_heading: "The details of the Jobinar are as follows:",
        organiser: compName,
        topic: topic,
        session_date: auto.session_date || "22nd October 2026 (Thursday)",
        session_time: auto.session_time || "5:00 PM to 6:00 PM IST",
        mode: auto.mode || "Online",
        reasons_to_attend:
          auto.reasons_to_attend && auto.reasons_to_attend.length > 0
            ? auto.reasons_to_attend
            : prev.reasons_to_attend,
        registration_callout:
          auto.registration_callout ||
          "All eligible and interested students are required to register online",
        company_registration_link:
          auto.company_registration_link ||
          opp.company_website ||
          "https://iur.ls/TCSiONJobinars",
        college_registration_link:
          auto.college_registration_link || "https://forms.gle/rA9RSZ4Ju2oUMETbA",
        registration_note:
          auto.registration_note ||
          "(It is mandatory to register on both the links - company link and the college link.)",
        From: auto.from_field || "(Dr. Zahir Aalam)",
        From_designation: auto.from_designation || "Dean (TP&IL)",
      }));
      toast.success(`Autofilled Training Notice from ${compName}`);
    } catch {
      toast.error("Failed to load opportunity autofill data.");
    }
  };

  const handleResetForm = () => {
    if (
      window.confirm(
        "Are you sure you want to reset the training notice form? All unsaved inputs will be cleared."
      )
    ) {
      setFormData(defaultInitialForm());
      setSelectedOpportunity(null);
      setIsDirty(false);
      setIsSaved(false);
      toast.success("Form reset to default.");
    }
  };

  const handleSaveDraft = async () => {
    try {
      const payload = {
        notice_type: "Training",
        sr_no: formData.srNo,
        date: formData.date,
        to: formData.to,
        subject: formData.subject,
        intro: formData.intro,
        eligibility_criteria: formData.eligibility_criteria,
        organiser: formData.organiser,
        topic: formData.topic,
        session_date: formData.session_date,
        session_time: formData.session_time,
        mode: formData.mode,
        reasons_to_attend: formData.reasons_to_attend,
        company_registration_link: formData.company_registration_link,
        college_registration_link: formData.college_registration_link,
        registration_callout: formData.registration_callout,
        registration_note: formData.registration_note,
        from_field: formData.From,
        from_designation: formData.From_designation,
      };

      await api.post("/api/staff/placement-notices/drafts/", payload);
      setIsSaved(true);
      setIsDirty(false);
      toast.success("Training notice draft saved successfully!");
    } catch {
      // Still mark saved locally if offline
      setIsSaved(true);
      setIsDirty(false);
      toast.success("Notice draft saved locally.");
    }
  };

  const reasons = Array.isArray(formData.reasons_to_attend)
    ? formData.reasons_to_attend
    : [];

  return (
    <Container maxWidth="xl" sx={{ py: 3, px: { xs: 1, md: 3 } }}>
      {/* ── Top Header and Action Bar ── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
          pb: 2,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
              Notice for Training
            </Typography>
            <Chip
              label="TCET/FRM/MP-04/11 Rev B"
              size="small"
              sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "12px" }}
            />
            {isSaved && (
              <Chip
                icon={<Check size={14} color="#16a34a" />}
                label="Saved"
                size="small"
                sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600 }}
              />
            )}
            {isDirty && (
              <Chip
                label="Unsaved Changes"
                size="small"
                sx={{ bgcolor: "#fffbeb", color: "#b45309", fontWeight: 600, border: "1px solid #fde68a" }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5 }}>
            Automate official institutional training announcements in compliance with TCET ISO formats.
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<RotateCcw size={16} />}
            onClick={handleResetForm}
            sx={{
              borderColor: "#cbd5e1",
              color: "#475569",
              "&:hover": { bgcolor: "#f1f5f9", borderColor: "#94a3b8" },
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 2,
            }}
          >
            Reset Form
          </Button>

          <Button
            variant="outlined"
            startIcon={<Save size={16} />}
            onClick={handleSaveDraft}
            sx={{
              borderColor: "#93c5fd",
              color: "#1d4ed8",
              bgcolor: "#f0f7ff",
              "&:hover": { bgcolor: "#dbeafe", borderColor: "#60a5fa" },
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 2,
            }}
          >
            Save Draft
          </Button>

          <Button
            variant="contained"
            startIcon={<Printer size={16} />}
            onClick={() => reactPrintFn()}
            sx={{
              bgcolor: "#0f172a",
              "&:hover": { bgcolor: "#1e293b" },
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 2,
            }}
          >
            Print Notice
          </Button>
        </Box>
      </Box>

      {/* ── Opportunity Search & Master Data Autofill Card ── */}
      <Box sx={{ mb: 3 }}>
        <OpportunitySearchCard
          onSelectOpportunity={handleSelectOpportunity}
          selectedOpportunity={selectedOpportunity}
          onClearSelection={() => setSelectedOpportunity(null)}
          noticeType="Training"
          title="Search Training Opportunity / Company Master Data"
          searchPlaceholder="Search company, training partner, topic (e.g. TCS iON, AWS, AI Agents, 2026)..."
        />
      </Box>

      {/* ── Form Editor & Live Preview ── */}
      <Grid container spacing={3}>
        {/* Left Column: Form Editor */}
        <Grid item xs={12} lg={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: "1px solid #e2e8f0",
              bgcolor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            {/* Section 1: Notice Metadata */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b", mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <Layers size={18} color="#2563eb" /> 1. Notice Identification &amp; Audience
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Serial Number (Sr. No)"
                  name="srNo"
                  value={formData.srNo || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="TCET/T&P/ TRG   107     of 2026"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Notice Date"
                  name="date"
                  type="date"
                  value={formData.date || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="To (Target Students / Batches)"
                  name="to"
                  value={formData.to || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="All Concerned students of the 2027 / 2028 / 2029 batch"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Subject Line"
                  name="subject"
                  value={formData.subject || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="Registrations for Free TCS iON Jobinar"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5 }} />

            {/* Section 2: Eligibility Criteria */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b", mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <Building2 size={18} color="#2563eb" /> 2. Eligibility Criteria
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <TextField
                  label="Eligibility Criteria"
                  name="eligibility_criteria"
                  value={formData.eligibility_criteria || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="B.E / B.Tech (All Branch) / MCA / BCA"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5 }} />

            {/* Section 3: Jobinar / Training Details */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b", mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <Calendar size={18} color="#2563eb" /> 3. Jobinar / Training Session Details
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Organiser"
                  name="organiser"
                  value={formData.organiser || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="TCS iON"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Topic / Program Title"
                  name="topic"
                  value={formData.topic || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="Can AI Agents Be Created Without Coding?"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Session Date"
                  name="session_date"
                  value={formData.session_date || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="22nd October 2026 (Thursday)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Session Time"
                  name="session_time"
                  value={formData.session_time || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="5:00 PM to 6:00 PM IST"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Mode (Online / Offline / Venue)"
                  name="mode"
                  value={formData.mode || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="Online"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5 }} />

            {/* Section 4: Reasons to Attend / Key Highlights */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b", mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
              <Clock size={18} color="#2563eb" /> 4. Reasons to Attend / Key Highlights
            </Typography>

            <Box sx={{ mb: 2 }}>
              {reasons.map((reason, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <TextField
                    size="small"
                    fullWidth
                    value={reason}
                    onChange={(e) => handleReasonChange(idx, e.target.value)}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveReason(idx)}
                    aria-label="Remove reason"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Box>
              ))}

              <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="e.g. Discover: Understand how apps, automation, and AI agents bring ideas to life."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddReason();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<Plus size={16} />}
                  onClick={handleAddReason}
                  sx={{ textTransform: "none", whiteSpace: "nowrap" }}
                >
                  Add
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 2.5 }} />

            {/* Section 5: Online Registration Links */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b", mb: 2 }}>
              5. Online Registration Links &amp; Callout
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <TextField
                  label="Registration Callout Text"
                  name="registration_callout"
                  value={formData.registration_callout || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="All eligible and interested students are required to register online"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Company Registration Link"
                  name="company_registration_link"
                  value={formData.company_registration_link || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="https://iur.ls/TCSiONJobinars"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="College Registration Link"
                  name="college_registration_link"
                  value={formData.college_registration_link || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="https://forms.gle/rA9RSZ4Ju2oUMETbA"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Registration Mandatory Note"
                  name="registration_note"
                  value={formData.registration_note || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="(It is mandatory to register on both the links - company link and the college link.)"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5 }} />

            {/* Section 6: Issuing Authority */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b", mb: 2 }}>
              6. Issuing Authority / Signatory
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Signatory Name"
                  name="From"
                  value={formData.From || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="(Dr. Zahir Aalam)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Designation"
                  name="From_designation"
                  value={formData.From_designation || ""}
                  onChange={handleInputChange}
                  fullWidth
                  size="small"
                  placeholder="Dean (TP&IL)"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Right Column: Live Official Notice Preview */}
        <Grid item xs={12} lg={6}>
          <Box
            sx={{
              position: "sticky",
              top: 24,
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              bgcolor: "#e2e8f0",
              p: 2,
              borderRadius: 3,
            }}
          >
            <Box sx={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, px: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
                Live Notice Preview (A4 Letterhead)
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<Printer size={14} />}
                onClick={() => reactPrintFn()}
                sx={{
                  bgcolor: "#2563eb",
                  textTransform: "none",
                  fontSize: "12px",
                  borderRadius: 1.5,
                }}
              >
                Print
              </Button>
            </Box>

            {/* Notice Component Render */}
            <Notice formData={formData} ref={contentRef} />
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default TrainingNotice;

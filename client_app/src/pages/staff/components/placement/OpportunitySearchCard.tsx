import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  TextField,
  Typography,
  Chip,
  Paper,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Alert,
  ClickAwayListener,
} from "@mui/material";
import {
  Search as SearchIcon,
  Building2,
  X,
  RotateCcw,
  Check,
  FolderOpen,
} from "lucide-react";
import { api } from "@/lib/api";

export interface OpportunityItem {
  id: number;
  company_id: number;
  company_name: string;
  company_website?: string;
  company_description?: string;
  company_aliases?: string[];
  batch: string;
  designation: string;
  tech_nontech: string;
  placement_internship: string;
  eligibility_criteria: string;
  eligible_departments?: string[];
  department_flags?: Record<string, boolean>;
  skills?: string[];
  emolument_raw?: string;
  emolument_display: string;
  selection_process?: string;
  number_of_offers?: number;
}

interface OpportunitySearchCardProps {
  onSelectOpportunity: (opp: OpportunityItem) => void;
  selectedOpportunity?: OpportunityItem | null;
  selectedOppId?: number | null;
  onClearSelection?: () => void;
  noticeStatus?: "NEW" | "DRAFT" | "PUBLISHED";
  isDirty?: boolean;
  onOpenDrafts?: () => void;
  title?: string;
  searchPlaceholder?: string;
  noticeType?: "Placement" | "Internship" | "Training";
}

const OpportunitySearchCard: React.FC<OpportunitySearchCardProps> = ({
  onSelectOpportunity,
  selectedOpportunity,
  selectedOppId,
  onClearSelection,
  noticeStatus,
  isDirty,
  onOpenDrafts,
  title,
  searchPlaceholder,
  noticeType = "Placement",
}) => {
  const isInternship = noticeType === "Internship";
  const isTraining = noticeType === "Training";
  const [searchQuery, setSearchQuery] = useState(selectedOpportunity?.company_name || "");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [results, setResults] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external selectedOpportunity changes
  useEffect(() => {
    if (selectedOpportunity) {
      setSearchQuery(selectedOpportunity.company_name);
      setDropdownOpen(false);
      setResults([]);
      setHasSearched(false);
    } else {
      setSearchQuery("");
      setResults([]);
      setHasSearched(false);
    }
  }, [selectedOpportunity]);

  const fetchOpportunities = useCallback(
    async (query: string, batch: string, type: string) => {
      const q = query.trim();
      const b = batch.trim();
      const t = type !== "All" ? type.trim() : "";

      setLoading(true);
      setSearchError(null);
      try {
        const params: Record<string, string> = {};
        if (q) params.q = q;
        if (b) params.batch = b;
        if (t) params.type = t;
        if (!q && !b && !t) params.recent = "true";

        const res = await api.get("/api/staff/placement/opportunities/search/", { params });
        setResults(res.data || []);
        setHasSearched(true);
      } catch (err) {
        console.error("Error searching placement opportunities:", err);
        setSearchError("Unable to search placement opportunities.");
        setResults([]);
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounced search trigger (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOpportunities(searchQuery, selectedBatch, typeFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedBatch, typeFilter, fetchOpportunities]);

  const handleRetry = () => {
    fetchOpportunities(searchQuery, selectedBatch, typeFilter);
  };

  const handleInputClickOrFocus = () => {
    setDropdownOpen(true);
    fetchOpportunities(searchQuery, selectedBatch, typeFilter);
  };

  const handleClear = () => {
    setSearchQuery("");
    setResults([]);
    setHasSearched(false);
    setSelectedBatch("");
    setTypeFilter("All");
    setDropdownOpen(false);
    if (onClearSelection) {
      onClearSelection();
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSelect = (opp: OpportunityItem) => {
    setDropdownOpen(false);
    setSearchQuery(opp.company_name);
    setResults([]);
    setHasSearched(false);
    onSelectOpportunity(opp);
  };

  const effectiveSelectedId = selectedOpportunity?.id || selectedOppId;
  const showDropdown = dropdownOpen && (loading || searchError || results.length > 0 || hasSearched);

  return (
    <ClickAwayListener onClickAway={() => setDropdownOpen(false)}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          mb: 2.5,
          borderRadius: 3,
          border: "1px solid #bfdbfe",
          bgcolor: "#ffffff",
          width: "100%",
          boxSizing: "border-box",
          position: "relative",
          zIndex: dropdownOpen ? 1200 : 1,
        }}
      >
        {/*
         * 3-column CSS Grid:
         *   Col 1 (1fr)         | Col 2 (minmax 130px) | Col 3 (minmax 130px)
         *   Row 1: Heading      | Saved Draft button   | [spacer]
         *   Row 2: Search input | Batch dropdown       | All Types dropdown
         *
         * Because both rows share the same column track, the left edge of
         * "Saved Draft" (row 1, col 2) is guaranteed to match the left edge
         * of "Batch" (row 2, col 2) — no absolute positioning needed.
         */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr auto",
              md: "1fr minmax(130px, auto) minmax(130px, auto)",
            },
            gridTemplateRows: "auto auto",
            columnGap: 1.5,
            rowGap: 1.5,
            alignItems: "center",
            width: "100%",
            mb: 2,
          }}
        >
          {/* ── Row 1, Col 1 : Heading ── */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
            {title || (isTraining ? "Search Company / Training & Jobinar Opportunity" : isInternship ? "Search Company / Internship Opportunity" : "Search Company / Placement Opportunity")}
          </Typography>

          {/* ── Row 1, Col 2 : Saved Draft button (+ status chip when saved) ── */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {noticeStatus === "DRAFT" && !isDirty && (
              <Chip
                size="small"
                icon={<Check size={14} color="#15803d" />}
                label="Saved Draft"
                sx={{
                  bgcolor: "#f0fdf4",
                  color: "#15803d",
                  border: "1px solid #bbf7d0",
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              />
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<FolderOpen size={18} strokeWidth={2} />}
              onClick={onOpenDrafts}
              sx={{
                textTransform: "none",
                fontSize: "13px",
                fontWeight: 600,
                color: "#1d4ed8",
                borderColor: "#bfdbfe",
                bgcolor: "#eff6ff",
                "&:hover": { bgcolor: "#dbeafe", borderColor: "#3b82f6" },
                borderRadius: "8px",
                px: 1.5,
                py: 0.5,
                whiteSpace: "nowrap",
              }}
            >
              Saved Draft
            </Button>
          </Box>

          {/* ── Row 1, Col 3 : empty spacer (preserves All Types column width on md+) ── */}
          <Box sx={{ display: { xs: "none", md: "block" } }} />

          {/* ── Row 2, Col 1 : Search Input with absolute floating dropdown ── */}
          <Box sx={{ position: "relative" }}>
            <TextField
              inputRef={inputRef}
              size="small"
              fullWidth
              placeholder={
                searchPlaceholder ||
                (isTraining
                  ? "Search company, training provider, topic (e.g. TCS iON, AI Agents, Power Platform)..."
                  : isInternship
                  ? "Search company, role, skill, batch (e.g. TCS, Infosys, Reliance, 2026)..."
                  : "Search company, role, skill, batch (e.g. Infosys, Software, Java, 2027)...")
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onClick={handleInputClickOrFocus}
              onFocus={handleInputClickOrFocus}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#ffffff",
                  borderRadius: 2,
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#3b82f6",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#2563eb",
                    borderWidth: 2,
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={19} strokeWidth={2} color="#2563eb" />
                  </InputAdornment>
                ),
                endAdornment: (searchQuery || selectedOpportunity) ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear();
                      }}
                      sx={{ p: 0.5, color: "#64748b", "&:hover": { color: "#0f172a" } }}
                      aria-label="Clear selection and search"
                    >
                      <X size={16} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />

            {/* Absolute floating search results dropdown — does not affect layout */}
            {showDropdown && (
              <Paper
                elevation={6}
                sx={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 1300,
                  bgcolor: "#ffffff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 2,
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.06)",
                  maxHeight: 320,
                  overflowY: "auto",
                  overflowX: "hidden",
                  p: 1,
                  boxSizing: "border-box",
                }}
              >
                {loading ? (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 2.5, gap: 1.5 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" sx={{ color: "#64748b" }}>
                      Searching placement opportunities...
                    </Typography>
                  </Box>
                ) : searchError ? (
                  <Alert
                    severity="error"
                    action={
                      <Button color="inherit" size="small" startIcon={<RotateCcw size={14} />} onClick={handleRetry}>
                        Retry
                      </Button>
                    }
                    sx={{ borderRadius: 1.5 }}
                  >
                    {searchError}
                  </Alert>
                ) : results.length > 0 ? (
                  <Box sx={{ width: "100%" }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: "#64748b", display: "block", px: 1, py: 0.5 }}>
                      Search Results ({results.length})
                    </Typography>
                    {results.map((opp) => {
                      const isSelected = effectiveSelectedId === opp.id;
                      const metaParts: string[] = [];
                      if (opp.designation && opp.designation !== "Role not specified") {
                        metaParts.push(opp.designation);
                      }
                      if (opp.batch) {
                        metaParts.push(`Batch ${opp.batch}`);
                      }
                      if (opp.placement_internship) {
                        metaParts.push(opp.placement_internship);
                      }
                      const metaLine = metaParts.join(" • ");

                      const ctc =
                        opp.emolument_display && opp.emolument_display !== "Not specified"
                          ? opp.emolument_display
                          : null;

                      const depts =
                        opp.eligible_departments && opp.eligible_departments.length > 0
                          ? `Eligible: ${opp.eligible_departments.slice(0, 4).join(", ")}${
                              opp.eligible_departments.length > 4 ? ` +${opp.eligible_departments.length - 4}` : ""
                            }`
                          : null;

                      const skillsText =
                        opp.skills && opp.skills.length > 0
                          ? `Skills: ${opp.skills.slice(0, 3).join(", ")}`
                          : null;

                      return (
                        <Box
                          key={opp.id}
                          onClick={() => handleSelect(opp)}
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1.5,
                            cursor: "pointer",
                            borderLeft: isSelected ? "4px solid #2563eb" : "4px solid transparent",
                            bgcolor: isSelected ? "#eff6ff" : "transparent",
                            transition: "all 0.15s ease",
                            borderBottom: "1px solid #f1f5f9",
                            "&:hover": {
                              bgcolor: isSelected ? "#dbeafe" : "#f8fafc",
                            },
                            "&:last-child": {
                              borderBottom: "none",
                            },
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.3 }}>
                              <Building2 size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  fontWeight: 700,
                                  color: "#0f172a",
                                  fontSize: "14px",
                                }}
                              >
                                {opp.company_name}
                              </Typography>
                              {opp.company_aliases && opp.company_aliases.length > 0 && (
                                <Chip
                                  label={opp.company_aliases[0]}
                                  size="small"
                                  sx={{ height: 18, fontSize: "10px", bgcolor: "#f1f5f9", fontWeight: 600 }}
                                />
                              )}
                            </Box>

                            {metaLine && (
                              <Typography
                                variant="body2"
                                sx={{
                                  color: "#475569",
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  mb: 0.3,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {metaLine}
                              </Typography>
                            )}

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                              {ctc && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "#059669",
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    bgcolor: "#ecfdf5",
                                    px: 0.8,
                                    py: 0.2,
                                    borderRadius: 1,
                                  }}
                                >
                                  {ctc}
                                </Typography>
                              )}
                              {depts && (
                                <Typography variant="caption" sx={{ color: "#64748b", fontSize: "12px" }}>
                                  {depts}
                                </Typography>
                              )}
                              {!depts && skillsText && (
                                <Typography variant="caption" sx={{ color: "#64748b", fontSize: "12px" }}>
                                  {skillsText}
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          <Button
                            size="small"
                            variant={isSelected ? "contained" : "outlined"}
                            color="primary"
                            sx={{
                              textTransform: "none",
                              fontSize: "12px",
                              py: 0.4,
                              px: 1.5,
                              borderRadius: 1.5,
                              flexShrink: 0,
                            }}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </Button>
                        </Box>
                      );
                    })}
                  </Box>
                ) : hasSearched ? (
                  <Box sx={{ textAlign: "center", py: 2, px: 2 }}>
                    <Typography variant="body2" sx={{ color: "#475569", fontWeight: 500 }}>
                      No matching companies or placement opportunities found.
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mt: 0.5 }}>
                      Try searching by company name, role, skill, or batch.
                    </Typography>
                  </Box>
                ) : null}
              </Paper>
            )}
          </Box>

          {/* ── Row 2, Col 2 : Batch dropdown ── */}
          <FormControl size="small" sx={{ width: "100%" }}>
            <InputLabel id="batch-filter-label">Batch</InputLabel>
            <Select
              labelId="batch-filter-label"
              value={selectedBatch}
              label="Batch"
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setDropdownOpen(true);
              }}
              sx={{ bgcolor: "#ffffff", borderRadius: 2 }}
            >
              <MenuItem value="">All Batches</MenuItem>
              <MenuItem value="2028">Batch 2028</MenuItem>
              <MenuItem value="2027">Batch 2027</MenuItem>
              <MenuItem value="2026">Batch 2026</MenuItem>
              <MenuItem value="2025">Batch 2025</MenuItem>
              <MenuItem value="2024">Batch 2024</MenuItem>
            </Select>
          </FormControl>

          {/* ── Row 2, Col 3 : All Types dropdown ── */}
          <FormControl size="small" sx={{ width: "100%" }}>
            <InputLabel id="type-filter-label">Type</InputLabel>
            <Select
              labelId="type-filter-label"
              value={typeFilter}
              label="Type"
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setDropdownOpen(true);
              }}
              sx={{ bgcolor: "#ffffff", borderRadius: 2 }}
            >
              <MenuItem value="All">All Types</MenuItem>
              <MenuItem value="Placement">Placement</MenuItem>
              <MenuItem value="Internship">Internship</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Selected Opportunity Summary Banner (visible below search row when opportunity is selected) */}
        {selectedOpportunity && !showDropdown && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              bgcolor: "#eff6ff",
              border: "1px solid #bfdbfe",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: "#dbeafe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1d4ed8",
                  flexShrink: 0,
                }}
              >
                <Building2 size={20} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "#3b82f6", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>
                  Selected Opportunity
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e3a8a", lineHeight: 1.2 }}>
                  {selectedOpportunity.company_name}
                </Typography>
                <Typography variant="caption" sx={{ color: "#2563eb", fontWeight: 500, mt: 0.2, display: "block" }}>
                  {selectedOpportunity.designation} • Batch {selectedOpportunity.batch}
                  {selectedOpportunity.placement_internship ? ` • ${selectedOpportunity.placement_internship}` : ""}
                  {selectedOpportunity.emolument_display && selectedOpportunity.emolument_display !== "Not specified"
                    ? ` • ${selectedOpportunity.emolument_display}`
                    : ""}
                </Typography>
              </Box>
            </Box>
            <Chip
              label="Notice auto-filled below"
              size="small"
              sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: 600, fontSize: "11px" }}
            />
          </Box>
        )}
      </Paper>
    </ClickAwayListener>
  );
};

export default OpportunitySearchCard;

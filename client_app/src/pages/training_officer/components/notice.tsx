import { forwardRef, useMemo } from "react";
import "./notice.css";
import noticeHeader from "@/assets/tcet header.png";
import noticeFooter from "@/assets/tcet footer.png";

export interface TableRow {
  BatchNo?: string;
  Date?: string;
  Time?: string;
  Program?: string;
  TopicsToRevise?: string;
}

export interface TrainingNoticeFormData {
  srNo?: string;
  date?: string;
  to?: string;
  subject?: string;
  intro?: string;
  eligibility_criteria?: string;
  details_heading?: string;
  organiser?: string;
  topic?: string;
  session_date?: string;
  session_time?: string;
  mode?: string;
  reasons_to_attend?: string[] | string;
  registration_callout?: string;
  company_registration_link?: string;
  college_registration_link?: string;
  registration_note?: string;
  From?: string;
  From_designation?: string;
  Note?: string;
  tableData?: TableRow[];
}

interface NoticeProps {
  formData: TrainingNoticeFormData;
}

const formatNoticeDate = (dateStr?: string): string => {
  if (!dateStr) {
    const today = new Date();
    return `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${today.getFullYear()}`;
  }
  const clean = dateStr.trim();
  if (clean.includes("/") || clean.includes(".")) return clean;
  const parsed = new Date(clean);
  if (isNaN(parsed.getTime())) return clean;
  return `${parsed.getDate().toString().padStart(2, "0")}/${(parsed.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${parsed.getFullYear()}`;
};

const parseReasonsList = (data?: string[] | string): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter((d) => Boolean(d && d.trim()));
  return data
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[•\-\*\s]+/, ""))
    .filter(Boolean);
};

const Notice = forwardRef<HTMLDivElement, NoticeProps>(({ formData }, ref) => {
  const reasonsList = useMemo(
    () => parseReasonsList(formData.reasons_to_attend),
    [formData.reasons_to_attend]
  );

  const formattedDate = formatNoticeDate(formData.date);
  const serialNumber =
    formData.srNo?.trim() || `TCET/T&P/ TRG   107     of ${new Date().getFullYear()}`;

  const hasLegacyTable =
    formData.tableData &&
    formData.tableData.length > 0 &&
    Boolean(formData.tableData[0]?.BatchNo || formData.tableData[0]?.Program);

  return (
    <div className="notice-document-wrapper">
      <div className="main-notice" ref={ref}>
        {/* Multi-page table layout for printing with repeating header */}
        <table className="notice-page-table">
          <thead className="notice-page-thead">
            <tr>
              <td>
                <div className="notice-header-container">
                  <img
                    src={noticeHeader}
                    alt="Thakur College of Engineering & Technology"
                    className="header-image"
                  />
                </div>
              </td>
            </tr>
          </thead>

          <tfoot className="notice-page-tfoot">
            <tr>
              <td>
                <div className="notice-footer-spacer" />
              </td>
            </tr>
          </tfoot>

          <tbody className="notice-page-tbody">
            <tr>
              <td>
                <div className="notice-body-content">
                  {/* Institutional Top Document Header */}
                  <div className="constant-top-block">
                    <div className="top-doc-meta">
                      <span className="doc-code">TCET/FRM/MP-04/11</span>
                      <span className="doc-revision">Revision: B</span>
                    </div>
                    <div className="top-cell-title">Training and Placement Cell</div>
                  </div>

                  {/* Notice Title */}
                  <h2 className="content-header">NOTICE</h2>

                  {/* Serial Number and Date Row */}
                  <div className="flex-container metadata-row">
                    <p className="metadata-item">
                      <span className="notice-label">Sr. No:</span>
                      <span className="metadata-val">{serialNumber}</span>
                    </p>
                    <p className="metadata-item">
                      <span className="notice-label">Date:</span>
                      <span className="metadata-val">{formattedDate}</span>
                    </p>
                  </div>

                  {/* Main Notice Body */}
                  <div className="main-body text-black">
                    {/* To Field */}
                    <p className="notice-row">
                      <span className="notice-label">To:</span>
                      <span>
                        {formData.to || "All Concerned students of the 2027 / 2028 / 2029 batch"}
                      </span>
                    </p>

                    {/* Subject (Underlined, Short, No Topic/Content) */}
                    <p className="notice-row subject-row">
                      <u className="subject-underline">
                        <span className="notice-label">Sub:</span>{" "}
                        <span className="subject-text">
                          {formData.subject || "Registrations for Free TCS iON Jobinar"}
                        </span>
                      </u>
                    </p>

                    {/* Eligibility Criteria (Introduction removed per requirement) */}
                    {formData.eligibility_criteria && (
                      <p className="notice-row" style={{ marginTop: "8px" }}>
                        <span className="notice-label">Eligibility Criteria:</span>
                        <span>{formData.eligibility_criteria}</span>
                      </p>
                    )}

                    {/* Jobinar / Training Details Block (Borderless, Clean Text Key-Value) */}
                    <div className="training-details-section">
                      <div className="training-details-heading">
                        {formData.details_heading || "The details of the Jobinar are as follows:"}
                      </div>

                      <table className="training-details-table">
                        <tbody>
                          <tr>
                            <td className="training-table-label">Organiser:</td>
                            <td className="training-table-val">{formData.organiser || "TCS iON"}</td>
                          </tr>
                          <tr>
                            <td className="training-table-label">Topic:</td>
                            <td className="training-table-val">
                              {formData.topic || "Can AI Agents Be Created Without Coding?"}
                            </td>
                          </tr>
                          <tr>
                            <td className="training-table-label">Date:</td>
                            <td className="training-table-val">
                              {formData.session_date || "22nd October 2026 (Thursday)"}
                            </td>
                          </tr>
                          <tr>
                            <td className="training-table-label">Time:</td>
                            <td className="training-table-val">
                              {formData.session_time || "5:00 PM to 6:00 PM IST"}
                            </td>
                          </tr>
                          <tr>
                            <td className="training-table-label">Mode:</td>
                            <td className="training-table-val">{formData.mode || "Online"}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Reasons to Attend */}
                      {reasonsList.length > 0 && (
                        <div>
                          <div className="training-reasons-title">Reasons to Attend:</div>
                          <ul className="training-reasons-list">
                            {reasonsList.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Online Registration Links & Instructions */}
                    <div className="training-registration-block">
                      <div className="training-registration-callout">
                        {formData.registration_callout ||
                          "All eligible and interested students are required to register online"}
                      </div>

                      {formData.company_registration_link && (
                        <div className="training-reg-link-row">
                          <span className="training-reg-link-label">
                            Register on the Company Link:
                          </span>
                          <a
                            href={formData.company_registration_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="notice-link"
                          >
                            {formData.company_registration_link}
                          </a>
                        </div>
                      )}

                      {formData.college_registration_link && (
                        <div className="training-reg-link-row">
                          <span className="training-reg-link-label">
                            Register on the College Link:
                          </span>
                          <a
                            href={formData.college_registration_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="notice-link"
                          >
                            {formData.college_registration_link}
                          </a>
                        </div>
                      )}

                      {formData.registration_note && (
                        <div className="training-reg-note">{formData.registration_note}</div>
                      )}
                    </div>

                    {/* Legacy Batch Table fallback if populated */}
                    {hasLegacyTable && (
                      <div className="table-wrapper">
                        <table className="placement-details-table">
                          <thead>
                            <tr>
                              <th>Batch No</th>
                              <th>Date</th>
                              <th>Time</th>
                              <th>Program</th>
                              <th>Topics to Revise</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.tableData?.map((row, index) => (
                              <tr key={index}>
                                <td>{row.BatchNo}</td>
                                <td>{row.Date}</td>
                                <td>{row.Time}</td>
                                <td>{row.Program}</td>
                                <td>{row.TopicsToRevise}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Note if provided */}
                    {formData.Note && formData.Note.trim() && (
                      <p className="notice-row note-row">
                        <span className="notice-label">Note:</span>
                        <span>{formData.Note}</span>
                      </p>
                    )}
                  </div>

                  {/* Flexible Vertical Spacer to naturally push footer/signatory */}
                  <div className="notice-flexible-spacer" />

                  {/* Atomic Bottom Block: Issuing Authority (Right) & Copy To (Left) */}
                  <div className="notice-bottom-section notice-footer-container">
                    <div className="signature-row-wrapper">
                      <div className="fromto-signature-block signature-section">
                        <p className="sig-sd">Sd/-</p>
                        <p className="sig-name">{formData.From || "(Dr. Zahir Aalam)"}</p>
                        <p className="sig-designation">
                          {formData.From_designation || "Dean (TP&IL)"}
                        </p>
                      </div>
                    </div>

                    {/* Copy To Section */}
                    <div className="notice-copyto-block copy-to-section">
                      <div className="copyto-header">Copy to:</div>
                      <div className="copyto-grid">
                        <div className="copyto-col-items">
                          <ul className="copyto-list">
                            <li>Principal</li>
                            <li>Vice-Principal</li>
                            <li>All Deans</li>
                            <li>T&P Coordinator</li>
                            <li>Website</li>
                            <li>Notice Board of TCET</li>
                          </ul>
                        </div>
                        <div className="copyto-col-annotations">
                          <div className="annotation-tier tier-top">
                            <span className="brace-symbol">&#125;</span>
                            <span className="annotation-label">
                              For kind information please
                            </span>
                          </div>
                          <div className="annotation-tier tier-bottom">
                            <span className="brace-symbol-large">&#125;</span>
                            <span className="annotation-label">
                              For necessary communication
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Fixed Footer Image */}
        <div className="notice-footer-fixed">
          <img src={noticeFooter} alt="Footer" className="footer-image" />
        </div>
      </div>
    </div>
  );
});

export default Notice;

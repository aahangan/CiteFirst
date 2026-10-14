import type { Row } from "../sources/dol";

/** Shaped like DOL API rows (strings after toRow), trimmed to the fields we request. */
export const inspections: Row[] = [
  // Opened in the window after a complaint; no citations yet.
  { activity_nr: "1800001", estab_name: "ACME ROOFING LLC", site_address: "12 MAIN ST", site_city: "AUSTIN", site_state: "TX", site_zip: "78701", naics_code: "238160", insp_type: "B", insp_scope: "B", nr_in_estab: "40", union_status: "N", open_date: "2026-10-02" },
  // Opened long ago; cited in the window with a willful item.
  { activity_nr: "1700002", estab_name: "BIG BOX WAREHOUSE INC", site_address: "500 DOCK RD", site_city: "DALLAS", site_state: "TX", site_zip: "75201-1234", naics_code: "493110", insp_type: "A", insp_scope: "A", nr_in_estab: "300", union_status: "Y", open_date: "2026-05-14" },
  // Planned inspection, no citations: not a lead for either vertical.
  { activity_nr: "1800003", estab_name: "QUIET FACTORY", site_address: "1 ELM", site_city: "TULSA", site_state: "OK", site_zip: "74103", naics_code: "332710", insp_type: "H", insp_scope: "A", open_date: "2026-10-01" },
  // Duplicate row for the same inspection should be ignored.
  { activity_nr: "1800001", estab_name: "ACME ROOFING LLC", site_state: "TX", insp_type: "B", open_date: "2026-10-02" },
];

export const violations: Row[] = [
  { activity_nr: "1700002", citation_id: "01001", standard: "19100178 L01", viol_type: "S", issuance_date: "2026-09-29", current_penalty: "16131", initial_penalty: "16131", abate_date: "2026-11-02" },
  { activity_nr: "1700002", citation_id: "02001", standard: "19100147 C04 I", viol_type: "W", issuance_date: "2026-09-29", current_penalty: "161323", initial_penalty: "161323" },
  { activity_nr: "1700002", citation_id: "03001", standard: "19041039", viol_type: "O", issuance_date: "2026-09-29", current_penalty: "0", initial_penalty: "1000" },
  // Deleted violations don't count.
  { activity_nr: "1700002", citation_id: "04001", delete_flag: "X", standard: "19100212 A01", viol_type: "S", issuance_date: "2026-09-29", current_penalty: "9999" },
];

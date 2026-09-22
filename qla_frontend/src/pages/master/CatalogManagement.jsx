import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Code2,
  FileText,
  UploadCloud,
  Check,
  X,
  Copy,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  FileJson,
  RotateCcw,
  Maximize2,
  Minimize2,
} from "lucide-react";

// ============================================================
// INITIAL PRODUCT CATALOG DATA (Streamlined 4 core fields)
// model-code, catalog name, category, datasheet
// ============================================================
const INITIAL_CATALOG = [
  {
    id: 1,
    model_code_prefix: "MLS-100",
    display_name: "Magnetic Level Switch - Miniature Top Mounted",
    category: "LEVEL",
    doc_code: "DOC-MLS-100",
    source_pdf_name: "techtrol_miniature_level_switch.pdf",
  },
  {
    id: 2,
    model_code_prefix: "MLS-200",
    display_name: "Magnetic Level Switch - Side Mounted Heavy Duty",
    category: "LEVEL",
    doc_code: "DOC-MLS-200",
    source_pdf_name: "techtrol_side_mounted_mls.pdf",
  },
  {
    id: 3,
    model_code_prefix: "TFM-500",
    display_name: "Tuning Fork Level Switch - Liquids & Slurries",
    category: "LEVEL",
    doc_code: "DOC-TFM-500",
    source_pdf_name: "tuning_fork_level_switch.pdf",
  },
  {
    id: 4,
    model_code_prefix: "UFM-800",
    display_name: "Ultrasonic Flow Meter - Clamp-on Transit Time",
    category: "ULTRASONIC",
    doc_code: "DOC-UFM-800",
    source_pdf_name: "techtrol_ultrasonic_flowmeter.pdf",
  },
  {
    id: 5,
    model_code_prefix: "DPT-300",
    display_name: "Differential Pressure Transmitter - Flanged Diaphragm",
    category: "PRESSURE",
    doc_code: "DOC-DPT-300",
    source_pdf_name: "techtrol_differential_pressure.pdf",
  },
  {
    id: 6,
    model_code_prefix: "RDR-900",
    display_name: "Non-Contact Radar Level Transmitter - 80GHz FMCW",
    category: "LEVEL",
    doc_code: "DOC-RDR-900",
    source_pdf_name: "techtrol_80ghz_radar_level.pdf",
  },
  {
    id: 7,
    model_code_prefix: "GLS-400",
    display_name: "Reflex / Transparent Glass Level Gauge",
    category: "LEVEL",
    doc_code: "DOC-GLS-400",
    source_pdf_name: "techtrol_tubular_reflex_gauge.pdf",
  },
  {
    id: 8,
    model_code_prefix: "TT-100",
    display_name: "Head Mounted Temperature Transmitter Pt100 RTD",
    category: "TEMPERATURE",
    doc_code: "DOC-TT-100",
    source_pdf_name: "techtrol_temperature_transmitter.pdf",
  },
  {
    id: 9,
    model_code_prefix: "EMF-600",
    display_name: "Electromagnetic Flow Meter - PTFE Lined Inline",
    category: "FLOW",
    doc_code: "DOC-EMF-600",
    source_pdf_name: "techtrol_electromagnetic_flowmeter.pdf",
  },
  {
    id: 10,
    model_code_prefix: "VAM-250",
    display_name: "Variable Area Flow Meter - Metal Tube Rotameter",
    category: "FLOW",
    doc_code: "DOC-VAM-250",
    source_pdf_name: "techtrol_metal_tube_rotameter.pdf",
  },
  {
    id: 11,
    model_code_prefix: "ULT-200",
    display_name: "Ultrasonic Level Transmitter - 2-Wire Compact",
    category: "ULTRASONIC",
    doc_code: "DOC-ULT-200",
    source_pdf_name: "techtrol_ultrasonic_level_tx.pdf",
  },
  {
    id: 12,
    model_code_prefix: "PT-150",
    display_name: "Industrial Pressure Transmitter - Ceramic Sensor",
    category: "PRESSURE",
    doc_code: "DOC-PT-150",
    source_pdf_name: "techtrol_pressure_transmitter.pdf",
  },
  {
    id: 13,
    model_code_prefix: "TC-500",
    display_name: "Thermocouple Assembly Type K with Thermowell",
    category: "TEMPERATURE",
    doc_code: "DOC-TC-500",
    source_pdf_name: "techtrol_thermocouple_assembly.pdf",
  },
  {
    id: 14,
    model_code_prefix: "CLT-700",
    display_name: "Capacitance Level Transmitter - High Temperature Rod",
    category: "LEVEL",
    doc_code: "DOC-CLT-700",
    source_pdf_name: "techtrol_capacitance_level.pdf",
  },
  {
    id: 15,
    model_code_prefix: "VFM-450",
    display_name: "Vortex Flow Meter - Steam & Gas Multivariable",
    category: "FLOW",
    doc_code: "DOC-VFM-450",
    source_pdf_name: "techtrol_vortex_flowmeter.pdf",
  },
  {
    id: 16,
    model_code_prefix: "MLG-350",
    display_name: "Magnetic Level Gauge - Top & Side Chamber",
    category: "LEVEL",
    doc_code: "DOC-MLG-350",
    source_pdf_name: "techtrol_magnetic_level_gauge.pdf",
  },
  {
    id: 17,
    model_code_prefix: "DPS-220",
    display_name: "Differential Pressure Switch - Explosion Proof",
    category: "PRESSURE",
    doc_code: "DOC-DPS-220",
    source_pdf_name: "techtrol_dp_switch.pdf",
  },
  {
    id: 18,
    model_code_prefix: "TFI-110",
    display_name: "Digital Temperature Indicator & Controller",
    category: "TEMPERATURE",
    doc_code: "DOC-TFI-110",
    source_pdf_name: "techtrol_temp_indicator.pdf",
  },
];

function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

const STANDARD_CATEGORIES = ["LEVEL", "FLOW", "PRESSURE", "TEMPERATURE", "ULTRASONIC"];

export default function CatalogManagement() {
  const [catalog, setCatalog] = useState(INITIAL_CATALOG);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  // Modals state
  const [editItem, setEditItem] = useState(null); // null or item object being edited
  const [isNewItem, setIsNewItem] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null); // item to delete
  const [jsonModalItem, setJsonModalItem] = useState(null); // item whose JSON is open
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [isEditFullscreen, setIsEditFullscreen] = useState(false);
  const [isJsonFullscreen, setIsJsonFullscreen] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    id: null,
    model_code_prefix: "",
    display_name: "",
    category: "LEVEL",
    doc_code: "",
    source_pdf_name: "",
    pdf_file_size: null,
    pdf_url: null,
  });

  const fileInputRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  // Unique categories count
  const uniqueCategoriesCount = useMemo(() => {
    const set = new Set(catalog.map((c) => (c.category || "").trim().toUpperCase()).filter(Boolean));
    return set.size;
  }, [catalog]);

  // Filtered Catalog items (Search by Model Code, Catalog Name, Category, or Datasheet)
  const filteredItems = useMemo(() => {
    if (!search.trim()) return catalog;
    const q = search.toLowerCase();
    return catalog.filter((item) => {
      return (
        (item.model_code_prefix || "").toLowerCase().includes(q) ||
        (item.display_name || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q) ||
        (item.doc_code || "").toLowerCase().includes(q) ||
        (item.source_pdf_name || "").toLowerCase().includes(q)
      );
    });
  }, [catalog, search]);

  // Pagination (15 per page)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [jumpPage, setJumpPage] = useState("");

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const target = parseInt(jumpPage, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setPage(target);
      setJumpPage("");
    }
  };

  // -------------------------------------------------------------
  // Add & Edit Handlers
  // -------------------------------------------------------------
  function handleOpenAdd() {
    setIsNewItem(true);
    setIsEditFullscreen(false);
    setFormData({
      id: Date.now(),
      model_code_prefix: "",
      display_name: "",
      category: "LEVEL",
      doc_code: "",
      source_pdf_name: "",
      pdf_file_size: null,
      pdf_url: null,
    });
    setEditItem({});
  }

  function handleOpenEdit(item) {
    setIsNewItem(false);
    setIsEditFullscreen(false);
    setFormData({
      id: item.id,
      model_code_prefix: item.model_code_prefix || "",
      display_name: item.display_name || "",
      category: item.category || "LEVEL",
      doc_code: item.doc_code || "",
      source_pdf_name: item.source_pdf_name || "",
      pdf_file_size: item.pdf_file_size || null,
      pdf_url: item.pdf_url || null,
    });
    setEditItem(item);
  }

  function handleSaveForm(e) {
    e.preventDefault();
    const cleanPrefix = (formData.model_code_prefix || "").trim().toUpperCase();
    const cleanName = (formData.display_name || "").trim();
    const cleanCategory = (formData.category || "GENERAL").trim().toUpperCase();

    if (!cleanPrefix) {
      showToast("Model Code is required");
      return;
    }
    if (!cleanName) {
      showToast("Catalog Name is required");
      return;
    }

    const finalDocCode =
      formData.doc_code.trim() ||
      (formData.source_pdf_name ? `DOC-${cleanPrefix}` : "");

    if (isNewItem) {
      const newItem = {
        id: Date.now(),
        model_code_prefix: cleanPrefix,
        display_name: cleanName,
        category: cleanCategory,
        doc_code: finalDocCode,
        source_pdf_name: formData.source_pdf_name || "",
        pdf_file_size: formData.pdf_file_size || null,
        pdf_url: formData.pdf_url || null,
      };
      setCatalog([newItem, ...catalog]);
      showToast(`Model ${cleanPrefix} added to catalog`);
    } else {
      setCatalog((prev) =>
        prev.map((c) =>
          c.id === formData.id
            ? {
                ...c,
                model_code_prefix: cleanPrefix,
                display_name: cleanName,
                category: cleanCategory,
                doc_code: finalDocCode,
                source_pdf_name: formData.source_pdf_name || "",
                pdf_file_size: formData.pdf_file_size || null,
                pdf_url: formData.pdf_url || null,
              }
            : c
        )
      );
      showToast(`Model ${cleanPrefix} updated successfully`);
    }
    setEditItem(null);
  }

  // -------------------------------------------------------------
  // PDF File Upload Handler
  // -------------------------------------------------------------
  function handlePdfFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Please select a valid PDF file.");
      return;
    }

    const fileSizeStr =
      file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    const objectUrl = URL.createObjectURL(file);

    setFormData((prev) => ({
      ...prev,
      source_pdf_name: file.name,
      doc_code: prev.doc_code || `DOC-${(prev.model_code_prefix || "MODEL").toUpperCase()}`,
      pdf_file_size: fileSizeStr,
      pdf_url: objectUrl,
    }));

    showToast(`PDF "${file.name}" attached successfully`);
  }

  function handleRemovePdf() {
    setFormData((prev) => ({
      ...prev,
      source_pdf_name: "",
      doc_code: "",
      pdf_file_size: null,
      pdf_url: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // -------------------------------------------------------------
  // Delete Handler
  // -------------------------------------------------------------
  function handleDeleteConfirm() {
    if (!deleteConfirmItem) return;
    const prefix = deleteConfirmItem.model_code_prefix;
    setCatalog((prev) => prev.filter((item) => item.id !== deleteConfirmItem.id));
    showToast(`Deleted ${prefix} from catalog`);
    setDeleteConfirmItem(null);
  }

  // -------------------------------------------------------------
  // JSON Viewer & Editor Handlers
  // -------------------------------------------------------------
  function handleOpenJson(item) {
    const exportObject = {
      id: item.id,
      model_code_prefix: item.model_code_prefix,
      display_name: item.display_name,
      category: item.category,
      doc_code: item.doc_code || `DOC-${item.model_code_prefix}`,
      source_pdf_name: item.source_pdf_name || `${item.model_code_prefix.toLowerCase()}_datasheet.pdf`,
    };
    setJsonModalItem(item);
    setJsonText(JSON.stringify(exportObject, null, 2));
    setJsonError(null);
    setJsonCopied(false);
    setIsJsonFullscreen(false);
  }

  function handleJsonTextChange(val) {
    setJsonText(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  }

  function handleFormatJson() {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setJsonError(null);
      showToast("JSON formatted with 2-space indentation");
    } catch (err) {
      setJsonError(err.message);
    }
  }

  function handleCopyJson() {
    navigator.clipboard.writeText(jsonText);
    setJsonCopied(true);
    showToast("JSON copied to clipboard!");
    setTimeout(() => setJsonCopied(false), 2000);
  }

  function handleSaveJson() {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.model_code_prefix || !parsed.display_name) {
        setJsonError("Both 'model_code_prefix' and 'display_name' are required fields.");
        return;
      }

      setCatalog((prev) =>
        prev.map((c) =>
          c.id === jsonModalItem.id
            ? {
                ...c,
                ...parsed,
                id: c.id, // maintain primary key
                model_code_prefix: String(parsed.model_code_prefix).trim().toUpperCase(),
                display_name: String(parsed.display_name).trim(),
                category: String(parsed.category || c.category).trim().toUpperCase(),
                doc_code: String(parsed.doc_code || c.doc_code || ""),
                source_pdf_name: String(parsed.source_pdf_name || c.source_pdf_name || ""),
              }
            : c
        )
      );

      showToast(`JSON updated for ${parsed.model_code_prefix}`);
      setJsonModalItem(null);
    } catch (err) {
      setJsonError(`Invalid JSON: ${err.message}`);
    }
  }

  return (
    <div className="page catalog-master-page">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-notif">
          <CheckCircle2 size={16} className="toast-icon" style={{ color: "var(--brand)" }} />
          <div>
            <div className="toast-title">{toast}</div>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* 1. Page Header */}
      <div className="catalog-header">
        <div>
          <div className="catalog-title-row">
            <h1 className="page-title" style={{ margin: 0 }}>Product Catalog Master</h1>
            <span className="catalog-badge">
              <BookOpen size={13} />
              {catalog.length} Products
            </span>
          </div>
          <p className="page-sub" style={{ marginTop: 4 }}>
            Manage catalog product specifications, categories, attached datasheets, and raw JSON.
          </p>
        </div>

        <div className="catalog-header-actions">
          <button type="button" className="btn btn-approve" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>Add Catalog</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="catalog-kpi-grid">
        <div className="catalog-kpi-card">
          <div className="catalog-kpi-icon catalog-kpi-icon-brand">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="catalog-kpi-val">{catalog.length}</div>
            <div className="catalog-kpi-label">Total Catalog Models</div>
          </div>
        </div>

        <div className="catalog-kpi-card">
          <div className="catalog-kpi-icon catalog-kpi-icon-amber">
            <Layers size={18} />
          </div>
          <div>
            <div className="catalog-kpi-val">{uniqueCategoriesCount}</div>
            <div className="catalog-kpi-label">Product Categories</div>
          </div>
        </div>

        <div className="catalog-kpi-card">
          <div className="catalog-kpi-icon catalog-kpi-icon-blue">
            <FileText size={18} />
          </div>
          <div>
            <div className="catalog-kpi-val">
              {catalog.filter((c) => c.source_pdf_name || c.doc_code).length}
            </div>
            <div className="catalog-kpi-label">Datasheets Attached</div>
          </div>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="catalog-filter-bar">
        <div className="cases-search-wrapper" style={{ maxWidth: 420 }}>
          <Search size={15} className="cases-search-icon" />
          <input
            type="text"
            className="cases-search-input"
            placeholder="Search by Model Code, Catalog Name, Category, or Datasheet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="cases-search-clear"
              onClick={() => setSearch("")}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Products Table (Strictly 4 core columns + Actions) */}
      <div className="cases-table-card">
        <div className="cases-table-responsive">
          <table className="cases-modern-table">
            <thead>
              <tr>
                <th style={{ width: "160px" }}>Model Code</th>
                <th>Catalog Name</th>
                <th style={{ width: "160px" }}>Category</th>
                <th style={{ width: "240px" }}>Datasheet</th>
                <th style={{ textAlign: "right", width: "190px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="catalog-table-row">
                    {/* 1. Model Code */}
                    <td>
                      <span className="catalog-model-badge">{item.model_code_prefix}</span>
                    </td>

                    {/* 2. Catalog Name */}
                    <td>
                      <span className="catalog-display-name" style={{ fontWeight: 600, color: "var(--ink)" }}>
                        {item.display_name}
                      </span>
                    </td>

                    {/* 3. Category */}
                    <td>
                      <span className="review-category-badge">{item.category}</span>
                    </td>

                    {/* 4. Datasheet */}
                    <td>
                      {item.source_pdf_name || item.doc_code ? (
                        <div
                          className="catalog-doc-badge"
                          title={item.source_pdf_name || item.doc_code}
                          style={{
                            cursor: item.pdf_url ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (item.pdf_url) window.open(item.pdf_url, "_blank");
                          }}
                        >
                          <FileText size={13} style={{ color: "#e11d48", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.source_pdf_name || item.doc_code}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>— No PDF —</span>
                      )}
                    </td>

                    {/* Actions: Edit, JSON Edit, Delete */}
                    <td style={{ textAlign: "right" }}>
                      <div className="catalog-row-actions">
                        {/* Edit Button */}
                        <button
                          type="button"
                          className="catalog-action-btn catalog-btn-edit"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Catalog Details"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>

                        {/* JSON Edit Button */}
                        <button
                          type="button"
                          className="catalog-action-btn catalog-btn-json"
                          onClick={() => handleOpenJson(item)}
                          title="Open & Edit Raw JSON"
                        >
                          <Code2 size={13} />
                          <span>JSON</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="catalog-action-btn catalog-btn-delete"
                          onClick={() => setDeleteConfirmItem(item)}
                          title="Delete Item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="cases-empty-row" style={{ padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: "0.95rem" }}>
                      No matching catalog models found
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: 4 }}>
                      Try adjusting your search criteria or category filter.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredItems.length > 0 && (
          <div className="cases-pagination-wrap">
            <div className="cases-pagination-info">
              <span>
                Showing <span className="cases-pagination-num">{(page - 1) * pageSize + 1}</span>–
                <span className="cases-pagination-num">{Math.min(page * pageSize, filteredItems.length)}</span> of{" "}
                <span className="cases-pagination-num">{filteredItems.length}</span> items
              </span>

              {/* Interactive Page Size Selector */}
              <div className="cases-pagesize-wrap">
                <select
                  className="cases-pagesize-select"
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setPageSize(newSize);
                    setPage(1);
                  }}
                  title="Select records per page"
                >
                  <option value={10}>10 / page</option>
                  <option value={15}>15 / page (Default)</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>

            <div className="cases-pagination-controls-group">
              <div className="cases-pagination-btns">
                {/* First Page */}
                <button
                  type="button"
                  className="cases-page-btn cases-page-btn-nav"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(1)}
                  title="First page"
                  aria-label="First page"
                >
                  <ChevronsLeft size={15} />
                </button>

                {/* Previous Page */}
                <button
                  type="button"
                  className="cases-page-btn cases-page-btn-nav"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  title="Previous page"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                  <span>Prev</span>
                </button>

                {/* Page Numbers */}
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={"dots-" + i} className="cases-pagination-dots">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`cases-page-btn ${p === page ? "active" : ""}`}
                      onClick={() => handlePageChange(p)}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {p}
                    </button>
                  )
                )}

                {/* Next Page */}
                <button
                  type="button"
                  className="cases-page-btn cases-page-btn-nav"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  title="Next page"
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  className="cases-page-btn cases-page-btn-nav"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(totalPages)}
                  title="Last page"
                  aria-label="Last page"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>

              {/* Direct Jump Box */}
              {totalPages > 1 && (
                <form onSubmit={handleJumpSubmit} className="cases-page-jump-box">
                  <span>Go to</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={jumpPage}
                    onChange={(e) => setJumpPage(e.target.value)}
                    className="cases-jump-input"
                    placeholder={String(page)}
                    aria-label="Jump to page"
                  />
                  <button type="submit" className="cases-jump-btn">
                    Go
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          5. ADD / EDIT CATALOG MODAL (With PDF Upload Option)
          ============================================================ */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div
            className={`modal-panel model-modal-container ${isEditFullscreen ? "modal-fullscreen" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveForm} className="model-modal-form">
              {/* Header */}
              <div className="model-modal-header">
                <div className="model-modal-header-left">
                  <div className="model-modal-icon-badge">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="model-modal-title">
                      {isNewItem ? "Add New Catalog Model" : `Edit Catalog: ${formData.model_code_prefix}`}
                    </h3>
                    <p className="model-modal-sub">
                      Configure model code, catalog name, category, and technical datasheet PDF.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    className="model-modal-close"
                    onClick={() => setIsEditFullscreen((prev) => !prev)}
                    title={isEditFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isEditFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button type="button" className="model-modal-close" onClick={() => setEditItem(null)}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Body: Model Code, Catalog Name, Category, PDF Upload */}
              <div className="model-modal-body">
                {/* 1. Model Code */}
                <div className="model-field">
                  <label className="model-field-label">
                    Model Code <span className="model-req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MLS-100, RDR-900"
                    value={formData.model_code_prefix}
                    onChange={(e) => setFormData({ ...formData, model_code_prefix: e.target.value })}
                    className="model-field-input model-code-input"
                  />
                  <span className="model-field-hint">Unique identifier / model prefix for this product series</span>
                </div>

                {/* 2. Catalog Name */}
                <div className="model-field">
                  <label className="model-field-label">
                    Catalog Name (Display Name) <span className="model-req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Magnetic Level Switch - Miniature Top Mounted"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="model-field-input"
                  />
                  <span className="model-field-hint">Full commercial title shown in catalogs and quotations</span>
                </div>

                {/* 3. Category */}
                <div className="model-field">
                  <label className="model-field-label">
                    Category <span className="model-req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LEVEL, FLOW, PRESSURE, TEMPERATURE"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value.toUpperCase() })}
                    className="model-field-input"
                  />
                  <span className="model-field-hint">Enter category name (e.g. LEVEL, FLOW, PRESSURE, TEMPERATURE, ULTRASONIC)</span>
                </div>

                {/* 4. PDF Upload & Datasheet Option */}
                <div className="model-field">
                  <label className="model-field-label">
                    Technical Datasheet (PDF Upload Option)
                  </label>

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    style={{ display: "none" }}
                    onChange={handlePdfFileSelect}
                  />

                  {formData.source_pdf_name ? (
                    <div className="catalog-pdf-attached-card">
                      <div className="catalog-pdf-attached-left">
                        <div className="catalog-pdf-icon-wrap">
                          <FileText size={20} style={{ color: "#e11d48" }} />
                        </div>
                        <div className="catalog-pdf-info">
                          <span className="catalog-pdf-filename">{formData.source_pdf_name}</span>
                          <span className="catalog-pdf-meta">
                            {formData.pdf_file_size ? `${formData.pdf_file_size} • ` : ""}
                            Datasheet Code: <strong>{formData.doc_code || `DOC-${formData.model_code_prefix || "PDF"}`}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="catalog-pdf-actions">
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: "5px 10px", fontSize: "0.78rem" }}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Replace PDF
                        </button>
                        <button
                          type="button"
                          className="catalog-pdf-remove-btn"
                          onClick={handleRemovePdf}
                          title="Remove PDF"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="catalog-pdf-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud size={28} className="catalog-pdf-dropzone-icon" />
                      <div className="catalog-pdf-dropzone-title">
                        Click here to upload technical datasheet PDF
                      </div>
                      <div className="catalog-pdf-dropzone-sub">
                        Accepts .pdf documents (Product brochures, wiring diagrams, spec sheets)
                      </div>
                    </div>
                  )}

                  {/* Optional Datasheet Document Code override */}
                  {formData.source_pdf_name && (
                    <div style={{ marginTop: 10 }}>
                      <label className="model-field-label" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Datasheet Document Code (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DOC-MLS-100"
                        value={formData.doc_code}
                        onChange={(e) => setFormData({ ...formData, doc_code: e.target.value })}
                        className="model-field-input"
                        style={{ fontSize: "0.82rem", padding: "6px 10px" }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="model-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-approve">
                  <Check size={15} />
                  <span>{isNewItem ? "Add to Catalog" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          6. JSON VIEWER & EDITOR MODAL
          ============================================================ */}
      {jsonModalItem && (
        <div className="modal-overlay" onClick={() => setJsonModalItem(null)}>
          <div
            className={`modal-panel catalog-json-modal-container ${isJsonFullscreen ? "modal-fullscreen" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="model-modal-header">
              <div className="model-modal-header-left">
                <div className="model-modal-icon-badge" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                  <FileJson size={22} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="catalog-model-badge">{jsonModalItem.model_code_prefix}</span>
                    <span style={{ fontSize: "0.76rem", color: "#6366f1", fontWeight: 700, background: "#e0e7ff", padding: "2px 7px", borderRadius: 4 }}>
                      JSON EDIT
                    </span>
                  </div>
                  <h3 className="model-modal-title" style={{ marginTop: 3 }}>
                    JSON Viewer & Editor
                  </h3>
                  <p className="model-modal-sub">
                    Directly modify product catalog JSON object. Live validation included.
                  </p>
                </div>
              </div>

              <div className="catalog-json-header-actions">
                {/* Fullscreen Button */}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsJsonFullscreen((prev) => !prev)}
                  title={isJsonFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  style={{ padding: "6px 11px", fontSize: "0.78rem" }}
                >
                  {isJsonFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span className="btn-label-responsive">{isJsonFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                </button>

                {/* Format Button */}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleFormatJson}
                  title="Auto-format and re-indent JSON"
                  style={{ padding: "6px 11px", fontSize: "0.78rem" }}
                >
                  <RotateCcw size={13} />
                  <span className="btn-label-responsive">Format</span>
                </button>

                {/* Copy Button */}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCopyJson}
                  title="Copy JSON to clipboard"
                  style={{ padding: "6px 11px", fontSize: "0.78rem" }}
                >
                  {jsonCopied ? <Check size={13} style={{ color: "var(--brand)" }} /> : <Copy size={13} />}
                  <span className="btn-label-responsive">{jsonCopied ? "Copied!" : "Copy"}</span>
                </button>

                {/* Close */}
                <button type="button" className="model-modal-close" onClick={() => setJsonModalItem(null)} title="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="model-modal-body" style={{ padding: "16px 20px" }}>
              {/* Syntax Error Alert */}
              {jsonError && (
                <div className="catalog-json-error-banner">
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>JSON Syntax Error:</strong> {jsonError}
                  </div>
                </div>
              )}

              {/* Code Editor Textarea */}
              <div className="catalog-json-editor-wrap">
                <textarea
                  className="catalog-json-textarea"
                  value={jsonText}
                  onChange={(e) => handleJsonTextChange(e.target.value)}
                  spellCheck="false"
                  placeholder="Paste or write valid JSON here…"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)" }}>
                <span>Use valid JSON format with double quotes around property names.</span>
                <span style={{ color: jsonError ? "#ef4444" : "var(--brand)", fontWeight: 600 }}>
                  {jsonError ? "● Syntax Invalid" : "● Valid JSON"}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="model-modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setJsonModalItem(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-approve"
                disabled={Boolean(jsonError)}
                onClick={handleSaveJson}
                style={{ opacity: jsonError ? 0.5 : 1, cursor: jsonError ? "not-allowed" : "pointer" }}
              >
                <Check size={15} />
                <span>Save JSON Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          7. DELETE CONFIRMATION MODAL
          ============================================================ */}
      {deleteConfirmItem && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmItem(null)}>
          <div className="modal-panel catalog-delete-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="catalog-delete-modal-icon">
              <Trash2 size={24} />
            </div>

            <h3 className="catalog-delete-modal-title">Delete Catalog Model</h3>
            <p className="catalog-delete-modal-sub">
              Are you sure you want to delete{" "}
              <strong>{deleteConfirmItem.model_code_prefix}</strong> (
              {deleteConfirmItem.display_name})?
            </p>
            <p style={{ fontSize: "0.8rem", color: "#dc2626", margin: "8px 0 0" }}>
              This item will be permanently removed from your product catalog.
            </p>

            <div className="catalog-delete-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeleteConfirmItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={handleDeleteConfirm}
              >
                <Trash2 size={15} />
                <span>Delete Model</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

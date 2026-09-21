import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Edit2,
  Eye,
  Check,
  X,
  BookOpen,
  Filter,
  Download,
  Package,
  Layers,
  FileText,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown
} from "lucide-react";

// Mock master catalog initial items
const INITIAL_CATALOG = [
  {
    id: 1,
    model_code_prefix: "MLS-100",
    display_name: "Magnetic Level Switch - Miniature Top Mounted",
    brand_owner: "TECHTROL",
    category: "LEVEL",
    subcategory: "SWITCH",
    sensing_principle: "Magnetic Float",
    is_configurable: true,
    doc_code: "DOC-MLS-100",
    source_pdf_name: "techtrol_miniature_level_switch.pdf",
    is_active: true,
    base_price: 8500,
    uom: "NOS",
    description: "Compact reed switch actuated by magnetic float. Suitable for clean liquids, water treatment tanks, and small vessels.",
  },
  {
    id: 2,
    model_code_prefix: "MLS-200",
    display_name: "Magnetic Level Switch - Side Mounted Heavy Duty",
    brand_owner: "TECHTROL",
    category: "LEVEL",
    subcategory: "SWITCH",
    sensing_principle: "Magnetic Float",
    is_configurable: true,
    doc_code: "DOC-MLS-200",
    source_pdf_name: "techtrol_side_mounted_mls.pdf",
    is_active: true,
    base_price: 14200,
    uom: "NOS",
    description: "Heavy duty side-mounted switch with glandless design. Ideal for chemical tanks, fuel storage, and high temperature applications.",
  },
  {
    id: 3,
    model_code_prefix: "TFM-500",
    display_name: "Tuning Fork Level Switch - Liquids",
    brand_owner: "TECHTROL",
    category: "LEVEL",
    subcategory: "SWITCH",
    sensing_principle: "Piezoelectric Vibration",
    is_configurable: true,
    doc_code: "DOC-TFM-500",
    source_pdf_name: "tuning_fork_level_switch.pdf",
    is_active: true,
    base_price: 19800,
    uom: "NOS",
    description: "Vibrating fork designed for point level detection in turbulent liquids, viscous slurries, and foaming tanks.",
  },
  {
    id: 4,
    model_code_prefix: "UFM-800",
    display_name: "Ultrasonic Flow Meter - Clamp-on Transit Time",
    brand_owner: "TECHTROL",
    category: "ULTRASONIC",
    subcategory: "TRANSMITTER",
    sensing_principle: "Transit Time Ultrasonic",
    is_configurable: true,
    doc_code: "DOC-UFM-800",
    source_pdf_name: "techtrol_ultrasonic_flowmeter.pdf",
    is_active: true,
    base_price: 48000,
    uom: "SET",
    description: "Non-invasive clamp-on flow meter for pipes DN15 to DN1000. Features LCD readout, 4-20mA + RS485 Modbus output.",
  },
  {
    id: 5,
    model_code_prefix: "DPT-300",
    display_name: "Differential Pressure Transmitter - Flanged Diaphragm",
    brand_owner: "TECHTROL",
    category: "PRESSURE",
    subcategory: "TRANSMITTER",
    sensing_principle: "Piezoresistive Diaphragm",
    is_configurable: true,
    doc_code: "DOC-DPT-300",
    source_pdf_name: "techtrol_differential_pressure.pdf",
    is_active: true,
    base_price: 36500,
    uom: "NOS",
    description: "High accuracy HART compatible differential pressure transmitter for pressurized tanks, filter clogging, and flow orifice.",
  },
  {
    id: 6,
    model_code_prefix: "RDR-900",
    display_name: "Non-Contact Radar Level Transmitter - 80GHz",
    brand_owner: "TECHTROL",
    category: "LEVEL",
    subcategory: "TRANSMITTER",
    sensing_principle: "FMCW Radar 80GHz",
    is_configurable: true,
    doc_code: "DOC-RDR-900",
    source_pdf_name: "techtrol_80ghz_radar_level.pdf",
    is_active: true,
    base_price: 62000,
    uom: "NOS",
    description: "Narrow 3-degree beam non-contact radar level sensor for tanks with agitators, condensing vapor, and tall silos up to 30m.",
  },
  {
    id: 7,
    model_code_prefix: "GLS-400",
    display_name: "Reflex / Transparent Glass Level Gauge",
    brand_owner: "TECHTROL",
    category: "LEVEL",
    subcategory: "GAUGE",
    sensing_principle: "Optical Refraction",
    is_configurable: false,
    doc_code: "DOC-GLS-400",
    source_pdf_name: "techtrol_tubular_reflex_gauge.pdf",
    is_active: true,
    base_price: 11500,
    uom: "NOS",
    description: "Direct reading sight glass level gauge with borosilicate reflex glass for steam boilers and process vessels.",
  },
  {
    id: 8,
    model_code_prefix: "TT-100",
    display_name: "Head Mounted Temperature Transmitter Pt100",
    brand_owner: "TECHTROL",
    category: "TEMPERATURE",
    subcategory: "TRANSMITTER",
    sensing_principle: "RTD Pt100 3-Wire",
    is_configurable: false,
    doc_code: "DOC-TT-100",
    source_pdf_name: "techtrol_temperature_transmitter.pdf",
    is_active: false,
    base_price: 6800,
    uom: "NOS",
    description: "Compact head-mount 4-20mA temperature transmitter for immersion thermowells in industrial process pipelines.",
  },
];

const STANDARD_CATEGORIES = ["LEVEL", "FLOW", "PRESSURE", "TEMPERATURE", "ULTRASONIC"];
const STANDARD_SUBCATEGORIES = ["SWITCH", "TRANSMITTER", "GAUGE", "INDICATOR", "ACCESSORY"];

export default function CatalogManagement() {
  const [catalog, setCatalog] = useState(INITIAL_CATALOG);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, INACTIVE
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [toast, setToast] = useState(null);

  // Custom manual entry modes for Category & Subcategory
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomSubcategory, setIsCustomSubcategory] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    model_code_prefix: "",
    display_name: "",
    brand_owner: "TECHTROL",
    category: "LEVEL",
    subcategory: "SWITCH",
    sensing_principle: "",
    doc_code: "",
    base_price: "",
    uom: "NOS",
    is_configurable: true,
    is_active: true,
    description: "",
  });

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  // Dynamic Category list for tabs and filters
  const allCategories = useMemo(() => {
    const list = ["ALL", ...STANDARD_CATEGORIES];
    catalog.forEach((item) => {
      const cat = (item.category || "").trim().toUpperCase();
      if (cat && !list.includes(cat)) {
        list.push(cat);
      }
    });
    return list;
  }, [catalog]);

  // Unique categories count for KPI
  const uniqueCategoriesCount = useMemo(() => {
    const set = new Set(catalog.map((c) => (c.category || "").trim().toUpperCase()).filter(Boolean));
    return set.size;
  }, [catalog]);

  // Filtered Catalog items
  const filteredItems = useMemo(() => {
    return catalog.filter((item) => {
      const matchesSearch =
        item.model_code_prefix.toLowerCase().includes(search.toLowerCase()) ||
        item.display_name.toLowerCase().includes(search.toLowerCase()) ||
        (item.sensing_principle && item.sensing_principle.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory =
        selectedCategory === "ALL" || (item.category || "").toUpperCase() === selectedCategory.toUpperCase();

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && item.is_active) ||
        (statusFilter === "INACTIVE" && !item.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [catalog, search, selectedCategory, statusFilter]);

  function handleOpenAdd() {
    setIsNewItem(true);
    setIsCustomCategory(false);
    setIsCustomSubcategory(false);
    setFormData({
      model_code_prefix: "",
      display_name: "",
      brand_owner: "TECHTROL",
      category: "LEVEL",
      subcategory: "SWITCH",
      sensing_principle: "",
      doc_code: "",
      base_price: "",
      uom: "NOS",
      is_configurable: true,
      is_active: true,
      description: "",
    });
    setEditItem(true);
  }

  function handleOpenEdit(item) {
    setIsNewItem(false);
    const catIsCustom = !STANDARD_CATEGORIES.includes((item.category || "").toUpperCase());
    const subIsCustom = !STANDARD_SUBCATEGORIES.includes((item.subcategory || "").toUpperCase());
    setIsCustomCategory(catIsCustom);
    setIsCustomSubcategory(subIsCustom);
    setFormData({
      id: item.id,
      model_code_prefix: item.model_code_prefix,
      display_name: item.display_name,
      brand_owner: item.brand_owner || "TECHTROL",
      category: item.category || "LEVEL",
      subcategory: item.subcategory || "SWITCH",
      sensing_principle: item.sensing_principle || "",
      doc_code: item.doc_code || "",
      base_price: item.base_price || "",
      uom: item.uom || "NOS",
      is_configurable: item.is_configurable ?? true,
      is_active: item.is_active ?? true,
      description: item.description || "",
    });
    setEditItem(item);
  }

  function handleSaveForm(e) {
    e.preventDefault();
    const finalCategory = (formData.category || "GENERAL").trim().toUpperCase();
    const finalSubcategory = (formData.subcategory || "GENERAL").trim().toUpperCase();
    if (isNewItem) {
      const newItem = {
        ...formData,
        category: finalCategory,
        subcategory: finalSubcategory,
        id: Date.now(),
        base_price: Number(formData.base_price) || 0,
      };
      setCatalog([newItem, ...catalog]);
      showToast(`Model ${formData.model_code_prefix} created successfully`);
    } else {
      setCatalog(
        catalog.map((c) =>
          c.id === formData.id
            ? { ...formData, category: finalCategory, subcategory: finalSubcategory, base_price: Number(formData.base_price) || 0 }
            : c
        )
      );
      showToast(`Model ${formData.model_code_prefix} updated successfully`);
    }
    setEditItem(null);
  }

  function handleToggleActive(id) {
    setCatalog(
      catalog.map((c) => (c.id === id ? { ...c, is_active: !c.is_active } : c))
    );
    const item = catalog.find((c) => c.id === id);
    showToast(
      `Product ${item?.model_code_prefix} is now ${item?.is_active ? "Inactive" : "Active"}`
    );
  }

  return (
    <div className="page catalog-master-page">
      {/* Toast */}
      {toast && (
        <div className="toast-notif">
          <CheckCircle2 size={16} className="toast-icon" style={{ color: "var(--brand)" }} />
          <div>
            <div className="toast-title">{toast}</div>
          </div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* 1. Header */}
      <div className="catalog-header">
        <div>
          <div className="catalog-title-row">
            <h1 className="page-title" style={{ margin: 0 }}>Product Catalog Master</h1>
            <span className="catalog-badge">
              <BookOpen size={13} />
              {catalog.length} Models Registered
            </span>
          </div>
          <p className="page-sub" style={{ marginTop: 4 }}>
            Maintain model code prefixes, sensing principles, technical descriptions, and base catalog pricing.
          </p>
        </div>

        <div className="catalog-header-actions">
          <button type="button" className="btn btn-outline" onClick={() => showToast("Exporting catalog CSV…")}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button type="button" className="btn btn-approve" onClick={handleOpenAdd}>
            <Plus size={15} />
            <span>Add Model</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="catalog-kpi-grid">
        <div className="catalog-kpi-card">
          <div className="catalog-kpi-icon catalog-kpi-icon-brand">
            <Package size={18} />
          </div>
          <div>
            <div className="catalog-kpi-val">{catalog.filter((c) => c.is_active).length}</div>
            <div className="catalog-kpi-label">Active Models</div>
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
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <div className="catalog-kpi-val">{catalog.filter((c) => c.is_configurable).length}</div>
            <div className="catalog-kpi-label">Configurable Series</div>
          </div>
        </div>

        <div className="catalog-kpi-card">
          <div className="catalog-kpi-icon catalog-kpi-icon-slate">
            <FileText size={18} />
          </div>
          <div>
            <div className="catalog-kpi-val">{catalog.filter((c) => c.doc_code).length}</div>
            <div className="catalog-kpi-label">Datasheets Attached</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="catalog-filter-bar">
        <div className="cases-search-wrapper" style={{ maxWidth: 360 }}>
          <Search size={15} className="cases-search-icon" />
          <input
            type="text"
            className="cases-search-input"
            placeholder="Search by prefix, model name, or sensing principle…"
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

        <div className="catalog-category-tabs">
          {allCategories.map((cat) => (
            <button
              type="button"
              key={cat}
              className={`catalog-cat-pill ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <select
          className="status-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: "auto" }}
        >
          <option value="ALL">Status: All</option>
          <option value="ACTIVE">Status: Active only</option>
          <option value="INACTIVE">Status: Inactive only</option>
        </select>
      </div>

      {/* 4. Products Table */}
      <div className="catalog-table-card">
        <div className="review-table-scroll">
          <table className="review-modern-table">
            <thead>
              <tr>
                <th>Model Code</th>
                <th>Display Name</th>
                <th>Category / Subcategory</th>
                <th>Sensing Principle</th>
                <th>Base Price</th>
                <th>Datasheet</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="catalog-table-row">
                    <td>
                      <span className="catalog-model-badge">{item.model_code_prefix}</span>
                    </td>
                    <td>
                      <div className="catalog-name-cell">
                        <span className="catalog-display-name">{item.display_name}</span>
                        <span className="catalog-brand-owner">{item.brand_owner}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <span className="review-category-badge">{item.category}</span>
                        <span className="catalog-subcat-badge">{item.subcategory}</span>
                      </div>
                    </td>
                    <td>
                      <span className="catalog-principle-text">{item.sensing_principle || "—"}</span>
                    </td>
                    <td>
                      <span className="catalog-price-tag">
                        ₹{item.base_price.toLocaleString("en-IN")}
                        <span className="catalog-uom"> / {item.uom}</span>
                      </span>
                    </td>
                    <td>
                      {item.doc_code ? (
                        <span className="catalog-doc-badge" title={item.source_pdf_name}>
                          <FileText size={12} />
                          {item.doc_code}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`catalog-status-toggle ${item.is_active ? "is-active" : "is-inactive"}`}
                        onClick={() => handleToggleActive(item.id)}
                        title="Click to toggle active status"
                      >
                        <span className="catalog-status-dot" />
                        {item.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="catalog-row-actions">
                        <button
                          type="button"
                          className="catalog-btn-icon"
                          onClick={() => setViewItem(item)}
                          title="View Technical Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="catalog-btn-icon"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Specifications"
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                    No catalog models match your search or category filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. View Item Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal-panel model-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="model-modal-header">
              <div className="model-modal-header-left">
                <div className="model-modal-icon-badge">
                  <Package size={20} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="catalog-model-badge">{viewItem.model_code_prefix}</span>
                    <span className={`catalog-status-toggle ${viewItem.is_active ? "is-active" : "is-inactive"}`} style={{ pointerEvents: "none" }}>
                      <span className="catalog-status-dot" />
                      {viewItem.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h3 className="model-modal-title" style={{ marginTop: 4 }}>
                    {viewItem.display_name}
                  </h3>
                </div>
              </div>
              <button type="button" className="model-modal-close" onClick={() => setViewItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="model-modal-body">
              {/* Specification Grid */}
              <div className="model-spec-section">
                <span className="model-section-title">Technical Specifications</span>
                <div className="model-view-spec-grid">
                  <div className="model-spec-item">
                    <span className="model-spec-label">Brand Owner</span>
                    <span className="model-spec-val">{viewItem.brand_owner}</span>
                  </div>
                  <div className="model-spec-item">
                    <span className="model-spec-label">Category</span>
                    <span className="model-spec-val">{viewItem.category}</span>
                  </div>
                  <div className="model-spec-item">
                    <span className="model-spec-label">Subcategory</span>
                    <span className="model-spec-val">{viewItem.subcategory}</span>
                  </div>
                  <div className="model-spec-item">
                    <span className="model-spec-label">Sensing Principle</span>
                    <span className="model-spec-val">{viewItem.sensing_principle || "—"}</span>
                  </div>
                  <div className="model-spec-item">
                    <span className="model-spec-label">Base List Price</span>
                    <span className="model-spec-val" style={{ color: "var(--brand-dark)", fontWeight: 700 }}>
                      ₹{viewItem.base_price.toLocaleString("en-IN")} / {viewItem.uom}
                    </span>
                  </div>
                  <div className="model-spec-item">
                    <span className="model-spec-label">Configurable Model</span>
                    <span className="model-spec-val">{viewItem.is_configurable ? "Yes (Configurable Code)" : "Fixed Prefix"}</span>
                  </div>
                  <div className="model-spec-item" style={{ gridColumn: "span 2" }}>
                    <span className="model-spec-label">Linked Datasheet</span>
                    <span className="model-spec-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <FileText size={14} style={{ color: "#2563eb" }} />
                      <strong>{viewItem.doc_code || "—"}</strong>
                      <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                        ({viewItem.source_pdf_name || "No PDF document attached"})
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Application Description */}
              <div className="model-spec-section">
                <span className="model-section-title">Engineering Application & Limits</span>
                <div className="model-desc-box">
                  {viewItem.description || "No specific engineering application notes recorded."}
                </div>
              </div>
            </div>

            <div className="model-modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const toEdit = viewItem;
                  setViewItem(null);
                  handleOpenEdit(toEdit);
                }}
              >
                <Edit2 size={14} />
                <span>Edit Model</span>
              </button>
              <button type="button" className="btn btn-approve" onClick={() => setViewItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Edit / Add Item Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-panel model-modal-container" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveForm}>
              {/* Header */}
              <div className="model-modal-header">
                <div className="model-modal-header-left">
                  <div className="model-modal-icon-badge">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="model-modal-title">
                      {isNewItem ? "Add Master Product Model" : `Edit Model: ${formData.model_code_prefix}`}
                    </h3>
                    <p className="model-modal-sub">
                      {isNewItem
                        ? "Register a new instrument series into the AI recommendation catalogue."
                        : "Update technical parameters, sensing mechanisms, and base catalog pricing."}
                    </p>
                  </div>
                </div>
                <button type="button" className="model-modal-close" onClick={() => setEditItem(null)}>
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="model-modal-body">
                {/* 1. Identification Section */}
                <div className="model-form-section">
                  <span className="model-section-title">1. Nomenclature & Identification</span>
                  <div className="model-form-row model-form-row-2">
                    <div className="model-field">
                      <label className="model-field-label">
                        Model Prefix Code <span className="model-req">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. MLS-100"
                        value={formData.model_code_prefix}
                        onChange={(e) => setFormData({ ...formData, model_code_prefix: e.target.value })}
                        className="model-field-input model-code-input"
                      />
                      <span className="model-field-hint">Unique identifier used for automated tag matching</span>
                    </div>

                    <div className="model-field">
                      <label className="model-field-label">Brand Owner</label>
                      <input
                        type="text"
                        value={formData.brand_owner}
                        onChange={(e) => setFormData({ ...formData, brand_owner: e.target.value })}
                        className="model-field-input"
                        placeholder="e.g. TECHTROL"
                      />
                    </div>
                  </div>

                  <div className="model-field" style={{ marginTop: 12 }}>
                    <label className="model-field-label">
                      Full Display Name <span className="model-req">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Magnetic Level Switch - Miniature Top Mounted"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="model-field-input"
                    />
                  </div>
                </div>

                {/* 2. Classification & Sensing Section */}
                <div className="model-form-section">
                  <span className="model-section-title">2. Engineering Classification & Principle</span>
                  <div className="model-form-row model-form-row-3">
                    {/* Primary Category */}
                    <div className="model-field">
                      <div className="model-field-header-row">
                        <label className="model-field-label">
                          Primary Category <span className="model-req">*</span>
                        </label>
                        <button
                          type="button"
                          className="model-field-toggle-btn"
                          onClick={() => {
                            if (!isCustomCategory) {
                              setIsCustomCategory(true);
                            } else {
                              setIsCustomCategory(false);
                              if (!STANDARD_CATEGORIES.includes((formData.category || "").toUpperCase())) {
                                setFormData({ ...formData, category: "LEVEL" });
                              }
                            }
                          }}
                          title={isCustomCategory ? "Switch back to standard dropdown" : "Type category manually if not in list"}
                        >
                          {isCustomCategory ? "← Select from list" : "+ Write manually"}
                        </button>
                      </div>

                      {isCustomCategory ? (
                        <div className="model-custom-input-wrap">
                          <input
                            type="text"
                            required
                            placeholder="Type category (e.g. DENSITY, ANALYTICAL)…"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value.toUpperCase() })}
                            className="model-field-input"
                            autoFocus
                          />
                          <div className="model-field-hint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>Manual category entry</span>
                            <button
                              type="button"
                              style={{ background: "none", border: "none", color: "var(--brand)", fontSize: "0.72rem", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                              onClick={() => {
                                setIsCustomCategory(false);
                                setFormData({ ...formData, category: "LEVEL" });
                              }}
                            >
                              Reset to list
                            </button>
                          </div>
                        </div>
                      ) : (
                        <select
                          value={formData.category}
                          onChange={(e) => {
                            if (e.target.value === "__WRITE_MANUAL__") {
                              setIsCustomCategory(true);
                              setFormData({ ...formData, category: "" });
                            } else {
                              setFormData({ ...formData, category: e.target.value });
                            }
                          }}
                          className="model-field-select"
                        >
                          {STANDARD_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="__WRITE_MANUAL__">✍ + Write category manually…</option>
                        </select>
                      )}
                    </div>

                    {/* Subcategory */}
                    <div className="model-field">
                      <div className="model-field-header-row">
                        <label className="model-field-label">
                          Subcategory <span className="model-req">*</span>
                        </label>
                        <button
                          type="button"
                          className="model-field-toggle-btn"
                          onClick={() => {
                            if (!isCustomSubcategory) {
                              setIsCustomSubcategory(true);
                            } else {
                              setIsCustomSubcategory(false);
                              if (!STANDARD_SUBCATEGORIES.includes((formData.subcategory || "").toUpperCase())) {
                                setFormData({ ...formData, subcategory: "SWITCH" });
                              }
                            }
                          }}
                          title={isCustomSubcategory ? "Switch back to standard dropdown" : "Type subcategory manually if not in list"}
                        >
                          {isCustomSubcategory ? "← Select from list" : "+ Write manually"}
                        </button>
                      </div>

                      {isCustomSubcategory ? (
                        <div className="model-custom-input-wrap">
                          <input
                            type="text"
                            required
                            placeholder="Type subcategory (e.g. SENSOR, CONTROLLER)…"
                            value={formData.subcategory}
                            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value.toUpperCase() })}
                            className="model-field-input"
                            autoFocus
                          />
                          <div className="model-field-hint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>Manual subcategory entry</span>
                            <button
                              type="button"
                              style={{ background: "none", border: "none", color: "var(--brand)", fontSize: "0.72rem", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                              onClick={() => {
                                setIsCustomSubcategory(false);
                                setFormData({ ...formData, subcategory: "SWITCH" });
                              }}
                            >
                              Reset to list
                            </button>
                          </div>
                        </div>
                      ) : (
                        <select
                          value={formData.subcategory}
                          onChange={(e) => {
                            if (e.target.value === "__WRITE_MANUAL__") {
                              setIsCustomSubcategory(true);
                              setFormData({ ...formData, subcategory: "" });
                            } else {
                              setFormData({ ...formData, subcategory: e.target.value });
                            }
                          }}
                          className="model-field-select"
                        >
                          {STANDARD_SUBCATEGORIES.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                          <option value="__WRITE_MANUAL__">✍ + Write subcategory manually…</option>
                        </select>
                      )}
                    </div>

                    <div className="model-field">
                      <label className="model-field-label">Sensing Principle</label>
                      <input
                        type="text"
                        placeholder="e.g. Magnetic Float, Radar 80GHz"
                        value={formData.sensing_principle}
                        onChange={(e) => setFormData({ ...formData, sensing_principle: e.target.value })}
                        className="model-field-input"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Commercial & Documentation */}
                <div className="model-form-section">
                  <span className="model-section-title">3. Commercial Pricing & Datasheet</span>
                  <div className="model-form-row model-form-row-3">
                    <div className="model-field">
                      <label className="model-field-label">Base List Price (₹)</label>
                      <div className="model-input-addon-wrap">
                        <span className="model-input-addon">₹</span>
                        <input
                          type="number"
                          placeholder="12500"
                          value={formData.base_price}
                          onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                          className="model-field-input model-field-with-addon"
                        />
                      </div>
                    </div>

                    <div className="model-field">
                      <label className="model-field-label">Unit of Measure (UOM)</label>
                      <input
                        type="text"
                        placeholder="NOS, SET, MTR"
                        value={formData.uom}
                        onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                        className="model-field-input"
                      />
                    </div>

                    <div className="model-field">
                      <label className="model-field-label">Datasheet Code</label>
                      <input
                        type="text"
                        placeholder="e.g. DOC-MLS-01"
                        value={formData.doc_code}
                        onChange={(e) => setFormData({ ...formData, doc_code: e.target.value })}
                        className="model-field-input"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Description & Applications */}
                <div className="model-form-section">
                  <span className="model-section-title">4. Application Notes & Media Compatibility</span>
                  <div className="model-field">
                    <textarea
                      rows={3}
                      placeholder="Describe process fluid suitability, temperature/pressure limits, viscosity constraints, or mount requirements…"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="model-field-textarea"
                    />
                  </div>
                </div>

                {/* 5. Engine Status & Toggle Cards */}
                <div className="model-form-section" style={{ marginBottom: 0 }}>
                  <span className="model-section-title">5. AI Matching Engine Status</span>
                  <div className="model-toggle-grid">
                    <label className={`model-toggle-card ${formData.is_configurable ? "selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={formData.is_configurable}
                        onChange={(e) => setFormData({ ...formData, is_configurable: e.target.checked })}
                      />
                      <div className="model-toggle-content">
                        <span className="model-toggle-title">Configurable Series</span>
                        <span className="model-toggle-sub">
                          Generates structured custom order codes with process connection suffixes.
                        </span>
                      </div>
                    </label>

                    <label className={`model-toggle-card ${formData.is_active ? "selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                      <div className="model-toggle-content">
                        <span className="model-toggle-title">Active in Catalogue</span>
                        <span className="model-toggle-sub">
                          Eligible for automatic recommendation by the AI spec-matching algorithm.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Clean Sticky Footer */}
              <div className="model-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-approve">
                  <Check size={15} />
                  <span>{isNewItem ? "Create Product Model" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

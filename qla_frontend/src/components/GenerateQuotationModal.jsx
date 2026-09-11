import { useState } from "react";
import { api } from "../api/client";

export default function GenerateQuotationModal({ caseId, lines: initialLines, onClose, onGenerated }) {
  const [lines, setLines] = useState(
    initialLines.map((l) => ({ ...l, _unitPrice: "" }))
  );
  const [discountPct, setDiscountPct] = useState("");
  const [taxPct, setTaxPct] = useState("");
  const [freightAmount, setFreightAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateLineField(lineItemId, field, value) {
    setLines(lines.map((l) => (l.line_item_id === lineItemId ? { ...l, [field]: value } : l)));
  }

  async function handleApproveAndGenerate() {
    setSaving(true);
    setError("");
    try {
      // Save any edits to the line items (model/description/qty/spec).
      for (const l of lines) {
        await api.updateQuotationLine(caseId, l.line_item_id, {
          model_code: l.model_code, description: l.description,
          qty: l.qty, technical_spec_text: l.technical_spec_text,
        });
      }

      // Save pricing.
      await api.savePricing(caseId, {
        currency_code: "INR",
        discount_pct: discountPct || 0,
        tax_pct: taxPct || 0,
        freight_amount: freightAmount || 0,
        lines: lines.map((l) => ({
          quote_line_id: l.line_item_id,
          unit_price: l._unitPrice || 0,
        })),
      });

      // Generate the actual document.
      const result = await api.generateQuotation(caseId);
      onGenerated(result);
    } catch (e) {
      setError(e.message || "Failed to generate quotation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: "min(800px, 95vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-case-ref">Review & Generate Quotation</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="flash flash-error">{error}</div>}

          <h3 className="modal-section-heading">Line Items</h3>
          <table className="data-table" style={{ marginBottom: 20 }}>
            <thead>
              <tr><th>Model</th><th>Description</th><th>Qty</th><th>Unit Price (₹)</th></tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.line_item_id}>
                  <td>
                    <input value={l.model_code || ""} onChange={(e) => updateLineField(l.line_item_id, "model_code", e.target.value)}
                      style={{ width: 130, padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
                  </td>
                  <td>
                    <input value={l.description || ""} onChange={(e) => updateLineField(l.line_item_id, "description", e.target.value)}
                      style={{ width: "100%", padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
                  </td>
                  <td>
                    <input value={l.qty || ""} onChange={(e) => updateLineField(l.line_item_id, "qty", e.target.value)}
                      style={{ width: 60, padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
                  </td>
                  <td>
                    <input type="number" value={l._unitPrice} onChange={(e) => updateLineField(l.line_item_id, "_unitPrice", e.target.value)}
                      style={{ width: 100, padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} placeholder="0.00" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="modal-section-heading">Commercial Terms</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Discount %</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} style={{ width: "100%", padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Tax %</label>
              <input type="number" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} style={{ width: "100%", padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)", marginBottom: 4 }}>Freight (₹)</label>
              <input type="number" value={freightAmount} onChange={(e) => setFreightAmount(e.target.value)} style={{ width: "100%", padding: 6, border: "1px solid var(--border)", borderRadius: 6 }} />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-edit" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-approve" onClick={handleApproveAndGenerate} disabled={saving} style={{ marginLeft: 8 }}>
            {saving ? "Generating…" : "✓ Approve & Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
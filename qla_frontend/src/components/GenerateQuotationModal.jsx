import { useState, useMemo } from "react";
import { api } from "../api/client";

function formatCurrency(n) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + (Number(l._unitPrice) || 0) * (Number(l.qty) || 0), 0);
    const discountAmt = subtotal * ((Number(discountPct) || 0) / 100);
    const afterDiscount = subtotal - discountAmt;
    const taxAmt = afterDiscount * ((Number(taxPct) || 0) / 100);
    const freight = Number(freightAmount) || 0;
    const grandTotal = afterDiscount + taxAmt + freight;
    return { subtotal, discountAmt, taxAmt, freight, grandTotal };
  }, [lines, discountPct, taxPct, freightAmount]);

  async function handleApproveAndGenerate() {
    setSaving(true);
    setError("");
    try {
      for (const l of lines) {
        await api.updateQuotationLine(caseId, l.line_item_id, {
          model_code: l.model_code, description: l.description,
          qty: l.qty, technical_spec_text: l.technical_spec_text,
        });
      }

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
      <div className="modal-panel qgm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qgm-header">
          <div>
            <h3 className="qgm-title">Review and generate quotation</h3>
          </div>
          <button className="qgm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="qgm-body">
          {error && <div className="flash flash-error">{error}</div>}

          <p className="qgm-section-label">Line items</p>
          <div className="qgm-table-wrap">
            <table className="qgm-table">
              <thead>
                <tr><th>Model</th><th>Description</th><th>Qty</th><th>Unit price</th></tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.line_item_id}>
                    <td>
                      <input value={l.model_code || ""} onChange={(e) => updateLineField(l.line_item_id, "model_code", e.target.value)} />
                    </td>
                    <td>
                      <input value={l.description || ""} onChange={(e) => updateLineField(l.line_item_id, "description", e.target.value)} />
                    </td>
                    <td>
                      <input value={l.qty || ""} onChange={(e) => updateLineField(l.line_item_id, "qty", e.target.value)} className="qgm-qty" />
                    </td>
                    <td>
                      <input type="number" value={l._unitPrice} onChange={(e) => updateLineField(l.line_item_id, "_unitPrice", e.target.value)} placeholder="0.00" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="qgm-section-label">Commercial terms</p>
          <div className="qgm-terms-grid">
            <div>
              <label>Discount %</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label>Tax %</label>
              <input type="number" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} placeholder="18" />
            </div>
            <div>
              <label>Freight (₹)</label>
              <input type="number" value={freightAmount} onChange={(e) => setFreightAmount(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="qgm-totals">
            <div className="qgm-totals-row"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
            <div className="qgm-totals-row"><span>Discount</span><span>−{formatCurrency(totals.discountAmt)}</span></div>
            <div className="qgm-totals-row"><span>Tax</span><span>+{formatCurrency(totals.taxAmt)}</span></div>
            <div className="qgm-totals-row"><span>Freight</span><span>+{formatCurrency(totals.freight)}</span></div>
            <div className="qgm-totals-row qgm-grand-total"><span>Grand total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
          </div>
        </div>

        <div className="qgm-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn qgm-primary" onClick={handleApproveAndGenerate} disabled={saving}>
            {saving ? "Generating…" : "✓ Approve and generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
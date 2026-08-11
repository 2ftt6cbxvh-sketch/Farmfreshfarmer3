import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Printer, Edit3, Save, X, ShieldCheck, AlertTriangle } from "lucide-react";
import { apiGet, apiRequest, queryClient, imgUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface InvoiceItem {
  serialNo: number;
  id?: number;
  name: string;
  unit: string;
  hsn: string;
  qty: number;
  unitPrice: string;
  taxableValue: string;
  gstRate: number;
  cgstRate: number;
  cgstAmount: string;
  sgstRate: number;
  sgstAmount: string;
  lineTotal: string;
}

export interface InvoiceData {
  orderId: number;
  invoiceNumber: string;
  invoiceDate: string;
  orderDate: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  placeOfSupply: string;
  reverseCharge: string;
  company: {
    legalName: string;
    brandName: string;
    logoUrl: string;
    iconUrl: string;
    gstin: string;
    pan: string;
    fssai: string;
    cin: string;
    address: string;
    email: string;
    phone: string;
    website: string;
  };
  customer: {
    name: string;
    phone: string;
    address: string;
    email: string;
    gstin: string;
  };
  items: InvoiceItem[];
  summary: {
    taxableSubtotal: string;
    totalCgst: string;
    totalSgst: string;
    totalTax: string;
    subtotal: string;
    discount: string;
    firstOrderDiscount?: string;
    referralDiscount?: string;
    couponCode?: string | null;
    grandTotal: string;
    amountInWords: string;
  };
  signatory: {
    signatoryName: string;
    designation: string;
    companyName: string;
    signatureUrl: string;
    declaration: string;
  };
}

export function renderStandaloneInvoiceHtml(data: InvoiceData): string {
  const itemRows = data.items.map((it) => `
    <tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">${it.serialNo}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${it.name}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace; color: #475569;">${it.hsn}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155;">${it.qty} × ${it.unit}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #334155;">₹${it.unitPrice}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #334155;">₹${it.taxableValue}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-size: 11px; color: #475569;">₹${it.cgstAmount} <span style="font-size: 9px; color: #94a3b8;">(${it.cgstRate}%)</span></td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-size: 11px; color: #475569;">₹${it.sgstAmount} <span style="font-size: 9px; color: #94a3b8;">(${it.sgstRate}%)</span></td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold; color: #065f46;">₹${it.lineTotal}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${data.invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0 !important;
      padding: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-size: 12px;
      line-height: 1.4;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 24px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #065f46;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      color: #065f46;
      font-family: serif;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: bold;
      color: #047857;
      margin-top: 2px;
    }
    .badge {
      display: inline-block;
      background: #065f46;
      color: #ffffff;
      font-weight: 900;
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin: 16px 0;
    }
    th {
      background: #065f46;
      color: #ffffff;
      padding: 8px 10px;
      text-transform: uppercase;
      font-size: 9px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-top: 16px;
      border-top: 2px solid #e2e8f0;
      padding-top: 16px;
    }
    .summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      min-width: 260px;
    }
    .grand-total {
      display: flex;
      justify-content: space-between;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 900;
      color: #065f46;
      margin-top: 8px;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
    }
    .computer-slip-badge {
      display: inline-block;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      font-size: 11px;
      font-weight: 900;
      padding: 4px 10px;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header-row">
      <div>
        <div class="brand-title">FarmFresh<span style="color: #10b981;">Farmer</span></div>
        <div class="brand-subtitle">Organic · Farm to Home</div>
        <p style="font-weight: 800; color: #0f172a; margin: 8px 0 2px 0;">${data.company.legalName}</p>
        <p style="color: #475569; font-size: 11px; margin: 0 0 6px 0; max-width: 360px;">${data.company.address}</p>
        <div style="font-family: monospace; font-size: 10px; color: #475569; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          <span><b>GSTIN:</b> ${data.company.gstin}</span>
          <span><b>PAN:</b> ${data.company.pan}</span>
          <span><b>FSSAI Lic:</b> ${data.company.fssai}</span>
          <span><b>CIN:</b> ${data.company.cin}</span>
        </div>
      </div>

      <div style="text-align: right;">
        <div class="badge">TAX INVOICE / BILL OF SUPPLY</div>
        <p style="font-size: 10px; color: #64748b; margin: 4px 0 8px 0;">Original for Recipient</p>
        <p style="font-size: 11px; margin: 2px 0;"><b>Invoice #:</b> <span style="font-family: monospace; color: #065f46; font-weight: 800;">${data.invoiceNumber}</span></p>
        <p style="font-size: 11px; margin: 2px 0;"><b>Date:</b> ${data.invoiceDate}</p>
        <p style="font-size: 10px; color: #64748b; margin: 2px 0;">Order Ref: <b>#${data.orderId}</b></p>
        <p style="font-size: 10px; color: #64748b; margin: 2px 0;">Payment: <b style="text-transform: uppercase;">${data.paymentMethod} (${data.paymentStatus})</b></p>
        <p style="font-size: 10px; color: #64748b; margin: 2px 0;">Place of Supply: <b>${data.placeOfSupply}</b></p>
      </div>
    </div>

    <div class="grid-2">
      <div class="box">
        <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #065f46; margin: 0 0 6px 0; letter-spacing: 0.5px;">Billed & Shipped To</p>
        <p style="font-weight: 800; font-size: 13px; margin: 0 0 2px 0; color: #0f172a;">${data.customer.name}</p>
        <p style="color: #475569; font-size: 11px; margin: 0 0 4px 0;">${data.customer.address}</p>
        <p style="font-family: monospace; font-size: 11px; margin: 0; color: #334155;">📱 ${data.customer.phone}</p>
        ${data.customer.email ? `<p style="font-size: 10px; color: #64748b; margin: 2px 0 0 0;">✉️ ${data.customer.email}</p>` : ""}
      </div>

      <div class="box" style="text-align: right;">
        <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #065f46; margin: 0 0 6px 0; letter-spacing: 0.5px;">Delivery & Logistics</p>
        <p style="margin: 2px 0; font-size: 11px; color: #475569;">Order Status: <b style="color: #0f172a;">${data.orderStatus}</b></p>
        <p style="margin: 2px 0; font-size: 11px; color: #475569;">Order Placed: <b>${data.orderDate}</b></p>
        <p style="margin: 2px 0; font-size: 11px; color: #475569;">Reverse Charge: <b>${data.reverseCharge}</b></p>
        <p style="margin: 2px 0; font-size: 11px; color: #475569;">Customer GSTIN: <span style="font-family: monospace;">${data.customer.gstin}</span></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="border-top-left-radius: 6px;">#</th>
          <th>Item Description</th>
          <th style="text-align: center;">HSN</th>
          <th style="text-align: center;">Qty / Unit</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Taxable Val</th>
          <th style="text-align: right;">CGST</th>
          <th style="text-align: right;">SGST</th>
          <th style="text-align: right; border-top-right-radius: 6px;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="totals-row">
      <div style="flex: 1;">
        <div class="box" style="margin-bottom: 10px;">
          <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin: 0 0 2px 0;">Amount in Words:</p>
          <p style="font-weight: 800; color: #065f46; margin: 0; font-size: 12px;">${data.summary.amountInWords}</p>
        </div>

        <div class="box" style="background: #fffbeb; border-color: #fde68a;">
          <p style="font-weight: bold; color: #92400e; margin: 0 0 2px 0; font-size: 10px;">Terms & Conditions / Jurisdiction:</p>
          <p style="color: #78350f; font-size: 10px; margin: 0;">${data.signatory.declaration}</p>
        </div>
      </div>

      <div class="summary-box">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
          <span>Taxable Amount (Goods):</span>
          <span style="font-family: monospace;">₹${data.summary.taxableSubtotal}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
          <span>Total CGST:</span>
          <span style="font-family: monospace;">₹${data.summary.totalCgst}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
          <span>Total SGST:</span>
          <span style="font-family: monospace;">₹${data.summary.totalSgst}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-weight: bold;">
          <span>Subtotal:</span>
          <span style="font-family: monospace;">₹${data.summary.subtotal}</span>
        </div>
        ${parseFloat(data.summary.discount) > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-top: 4px; color: #059669; font-weight: bold;">
          <span>Discount Applied ${data.summary.couponCode ? `(${data.summary.couponCode})` : ""}:</span>
          <span style="font-family: monospace;">−₹${data.summary.discount}</span>
        </div>
        ` : ""}
        <div class="grand-total">
          <span>Grand Total (INR):</span>
          <span style="font-family: monospace;">₹${data.summary.grandTotal}</span>
        </div>
      </div>
    </div>

    <div class="footer-row">
      <div style="font-size: 10px; color: #64748b;">
        <p style="margin: 0 0 2px 0;">Customer Support: <b>${data.company.phone}</b> | <b>${data.company.email}</b></p>
        <p style="margin: 0;">Thank you for choosing certified fresh organic farming!</p>
      </div>

      <div style="text-align: right;">
        <div class="computer-slip-badge">🛡️ Computer Generated Slip</div>
        <p style="font-size: 9px; color: #64748b; font-style: italic; margin: 4px 0 2px 0;">
          This is a computer-generated slip. No physical signature is required.
        </p>
        <p style="font-size: 10px; font-weight: bold; color: #334155; text-transform: uppercase; margin: 4px 0 0 0; padding-top: 4px; border-top: 1px solid #e2e8f0;">
          For ${data.company.legalName}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

interface TaxInvoiceModalProps {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export function TaxInvoiceModal({ orderId, open, onOpenChange, isAdmin = false }: TaxInvoiceModalProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<InvoiceData | null>(null);

  const { data: invoice, isLoading, error } = useQuery<InvoiceData>({
    queryKey: ["/api/orders", orderId, "invoice"],
    queryFn: () => apiGet<InvoiceData>(`/api/orders/${orderId}/invoice`),
    enabled: open && orderId != null,
  });

  useEffect(() => {
    if (invoice) {
      setEditForm(JSON.parse(JSON.stringify(invoice)));
    }
  }, [invoice]);

  const saveMutation = useMutation({
    mutationFn: async (updatedData: InvoiceData) => {
      const res = await apiRequest("PATCH", `/api/admin/orders/${orderId}/invoice`, updatedData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", orderId, "invoice"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsEditing(false);
      toast({ title: "✨ Invoice Saved", description: "Customized GST bill updated successfully!" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save invoice", description: err?.message || "Server error", variant: "destructive" });
    },
  });

  const handlePrint = () => {
    if (!activeData) return;

    // 1. Try opening an isolated print popup window (Immune to all modal/dark mode bugs)
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(renderStandaloneInvoiceHtml(activeData));
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      return;
    }

    // 2. Fallback: Print via clean hidden iframe (works if popups blocked)
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(renderStandaloneInvoiceHtml(activeData));
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch (e) {}
        }, 1500);
      }, 300);
    } else {
      window.print();
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, val: any) => {
    if (!editForm) return;
    const newItems = [...editForm.items];
    newItems[index] = { ...newItems[index], [field]: val };

    // Recalculate line total if price, qty or tax changes
    if (field === "unitPrice" || field === "qty" || field === "gstRate") {
      const p = parseFloat(newItems[index].unitPrice) || 0;
      const q = parseInt(String(newItems[index].qty), 10) || 1;
      const r = parseFloat(String(newItems[index].gstRate)) || 0;
      const taxable = p * q; // Unit price and taxable value are same per unit
      const cgstRate = r / 2;
      const sgstRate = r / 2;
      const cgst = taxable * (cgstRate / 100);
      const sgst = taxable * (sgstRate / 100);
      const total = taxable + cgst + sgst;

      newItems[index].unitPrice = p.toFixed(2);
      newItems[index].taxableValue = taxable.toFixed(2);
      newItems[index].cgstRate = cgstRate;
      newItems[index].sgstRate = sgstRate;
      newItems[index].cgstAmount = cgst.toFixed(2);
      newItems[index].sgstAmount = sgst.toFixed(2);
      newItems[index].lineTotal = total.toFixed(2);
    }

    // Recompute summaries
    const taxableSubtotal = newItems.reduce((acc, it) => acc + (parseFloat(it.taxableValue) || 0), 0);
    const newCgst = newItems.reduce((acc, it) => acc + (parseFloat(it.cgstAmount) || 0), 0);
    const newSgst = newItems.reduce((acc, it) => acc + (parseFloat(it.sgstAmount) || 0), 0);
    const totalTax = newCgst + newSgst;
    const newSubtotal = taxableSubtotal + totalTax;
    const disc = parseFloat(editForm.summary.discount) || 0;
    const grand = Math.max(0, newSubtotal - disc);

    setEditForm({
      ...editForm,
      items: newItems,
      summary: {
        ...editForm.summary,
        taxableSubtotal: taxableSubtotal.toFixed(2),
        totalCgst: newCgst.toFixed(2),
        totalSgst: newSgst.toFixed(2),
        totalTax: totalTax.toFixed(2),
        subtotal: newSubtotal.toFixed(2),
        grandTotal: grand.toFixed(2),
      },
    });
  };

  const activeData = isEditing && editForm ? editForm : invoice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-0 bg-transparent shadow-2xl">
        <style dangerouslySetInnerHTML={{ __html: `
          .tax-invoice-modal-body input,
          .tax-invoice-modal-body textarea {
            background-color: #ffffff !important;
            color: #0f172a !important;
            -webkit-text-fill-color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            opacity: 1 !important;
          }
          .tax-invoice-modal-body input:focus,
          .tax-invoice-modal-body textarea:focus {
            background-color: #ffffff !important;
            color: #0f172a !important;
            -webkit-text-fill-color: #0f172a !important;
            border-color: #059669 !important;
            outline: 2px solid rgba(16, 185, 129, 0.2) !important;
          }
          .tax-invoice-modal-body input::placeholder,
          .tax-invoice-modal-body textarea::placeholder {
            color: #94a3b8 !important;
            -webkit-text-fill-color: #94a3b8 !important;
          }
          @media print {
            html, body {
              background-color: #ffffff !important;
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: auto !important;
              min-height: 100% !important;
              overflow: visible !important;
            }
            [data-radix-portal], [role="dialog"], div[data-state] {
              position: static !important;
              transform: none !important;
              background: transparent !important;
              box-shadow: none !important;
              max-height: none !important;
              overflow: visible !important;
            }
            .no-print, [data-radix-dialog-overlay] {
              display: none !important;
              visibility: hidden !important;
            }
            #printable-tax-invoice {
              display: block !important;
              visibility: visible !important;
              position: relative !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 16px !important;
              background-color: #ffffff !important;
              background: #ffffff !important;
              color: #0f172a !important;
              border: none !important;
              box-shadow: none !important;
            }
            #printable-tax-invoice * {
              visibility: visible !important;
              color-adjust: exact !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        ` }} />

        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print sticky top-0 z-20 flex items-center justify-between bg-slate-900/95 backdrop-blur-md px-6 py-3.5 border-b border-slate-800 text-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg border border-emerald-500/30">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">Official GST Tax Invoice</h3>
              <p className="text-[10px] text-slate-400">Order #{orderId} · {activeData?.invoiceNumber || "Generating..."}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className={`rounded-xl text-xs font-bold border ${isEditing ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-200 border-slate-700"}`}
              >
                <Edit3 size={13} className="mr-1.5" />
                <span>{isEditing ? "Cancel Edit" : "Edit Bill"}</span>
              </Button>
            )}

            {isEditing && editForm && (
              <Button
                type="button"
                size="sm"
                onClick={() => saveMutation.mutate(editForm)}
                disabled={saveMutation.isPending}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
              >
                <Save size={13} className="mr-1.5" />
                <span>{saveMutation.isPending ? "Saving..." : "Save Bill"}</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md"
            >
              <Printer size={13} className="mr-1.5" />
              <span>Print / Download PDF</span>
            </Button>

            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice Paper Body */}
        <div className="p-4 sm:p-6 bg-slate-950/40">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl">
              <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-xs font-bold">Compiling legal tax invoice & calculating HSN breakdown...</p>
            </div>
          ) : error || !activeData ? (
            <div className="p-12 text-center text-red-500 bg-white rounded-2xl space-y-2">
              <AlertTriangle size={32} className="mx-auto text-red-500" />
              <p className="text-sm font-bold">Failed to load invoice details.</p>
              <p className="text-xs text-slate-500">{error instanceof Error ? error.message : "Please check your connection and retry."}</p>
            </div>
          ) : (
            <div
              id="printable-tax-invoice"
              className="tax-invoice-modal-body bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200 font-sans text-xs space-y-6"
            >
              {/* Header: Brand, Company Info & Invoice Badge */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-emerald-800/20 pb-5">
                <div className="space-y-1.5 max-w-md w-full sm:w-auto">
                  {/* Redesigned Logo */}
                  <div className="flex items-center gap-2.5 mb-2">
                    <img
                      src={imgUrl("/images/logo-icon.png")}
                      alt="FarmFreshFarmer"
                      className="w-10 h-10 object-contain"
                    />
                    <div>
                      <span className="text-lg font-black tracking-tight text-emerald-900 font-serif">
                        FarmFresh<span className="text-emerald-600">Farmer</span>
                      </span>
                      <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-emerald-700">
                        Organic · Farm to Home
                      </p>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 text-[11px] bg-amber-50/80 p-3 rounded-xl border border-amber-300 shadow-inner">
                      <p className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1">
                        <span>✏️ Edit Our Company Info (Applies to all Bills):</span>
                      </p>
                      <div>
                        <span className="text-[9px] text-slate-600 font-bold block mb-0.5">Company Legal Name:</span>
                        <Input
                          value={editForm?.company.legalName}
                          onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, legalName: e.target.value } })}
                          placeholder="Company Legal Name"
                          className="h-7 text-xs font-bold !bg-white !text-slate-900 border-amber-300 shadow-sm"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-600 font-bold block mb-0.5">Registered Address:</span>
                        <Textarea
                          value={editForm?.company.address}
                          onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, address: e.target.value } })}
                          placeholder="Company Registered Address"
                          rows={2}
                          className="text-xs !bg-white !text-slate-900 border-amber-300 resize-none shadow-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                        <div>
                          <span className="text-[9px] text-slate-600 font-sans font-bold block mb-0.5">GSTIN:</span>
                          <Input
                            value={editForm?.company.gstin}
                            onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, gstin: e.target.value } })}
                            placeholder="GSTIN"
                            className="h-6 text-[10px] font-mono !bg-white !text-slate-900 border-amber-300"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-600 font-sans font-bold block mb-0.5">PAN:</span>
                          <Input
                            value={editForm?.company.pan}
                            onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, pan: e.target.value } })}
                            placeholder="PAN"
                            className="h-6 text-[10px] font-mono !bg-white !text-slate-900 border-amber-300"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-600 font-sans font-bold block mb-0.5">FSSAI Lic:</span>
                          <Input
                            value={editForm?.company.fssai}
                            onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, fssai: e.target.value } })}
                            placeholder="FSSAI License"
                            className="h-6 text-[10px] font-mono !bg-white !text-slate-900 border-amber-300"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-600 font-sans font-bold block mb-0.5">CIN:</span>
                          <Input
                            value={editForm?.company.cin}
                            onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, cin: e.target.value } })}
                            placeholder="CIN"
                            className="h-6 text-[10px] font-mono !bg-white !text-slate-900 border-amber-300"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-600 font-sans font-bold block mb-0.5">Support Phone:</span>
                          <Input
                            value={editForm?.company.phone}
                            onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, phone: e.target.value } })}
                            placeholder="Support Phone"
                            className="h-6 text-[10px] font-mono !bg-white !text-slate-900 border-amber-300"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-600 font-sans font-bold block mb-0.5">Support Email:</span>
                          <Input
                            value={editForm?.company.email}
                            onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, email: e.target.value } })}
                            placeholder="Support Email"
                            className="h-6 text-[10px] font-mono !bg-white !text-slate-900 border-amber-300"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-extrabold text-slate-900 text-xs">{activeData.company.legalName}</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{activeData.company.address}</p>
                      <div className="grid grid-cols-2 gap-x-3 text-[10px] text-slate-600 pt-1 font-mono">
                        <p><b>GSTIN:</b> {activeData.company.gstin}</p>
                        <p><b>PAN:</b> {activeData.company.pan}</p>
                        <p><b>FSSAI Lic:</b> {activeData.company.fssai}</p>
                        <p><b>CIN:</b> {activeData.company.cin}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Invoice Meta Tag */}
                <div className="sm:text-right space-y-1 self-stretch sm:self-auto bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200">
                  <div className="inline-block bg-emerald-700 text-white font-black px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider mb-1">
                    TAX INVOICE / BILL OF SUPPLY
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">Original for Recipient</p>

                  <div className="pt-1.5 space-y-0.5 text-xs">
                    <p className="font-extrabold text-slate-900 flex items-center sm:justify-end gap-1">
                      <span>Invoice #:</span>
                      {isEditing ? (
                        <Input
                          value={editForm?.invoiceNumber}
                          onChange={(e) => setEditForm({ ...editForm!, invoiceNumber: e.target.value })}
                          className="h-6 w-36 text-xs font-mono font-bold !bg-white !text-slate-900 border-amber-300"
                        />
                      ) : (
                        <span className="font-mono text-emerald-800">{activeData.invoiceNumber}</span>
                      )}
                    </p>
                    <p className="text-slate-600 text-[11px] flex items-center sm:justify-end gap-1">
                      <span>Date:</span>
                      {isEditing ? (
                        <Input
                          value={editForm?.invoiceDate}
                          onChange={(e) => setEditForm({ ...editForm!, invoiceDate: e.target.value })}
                          className="h-6 w-28 text-xs !bg-white !text-slate-900 border-amber-300"
                        />
                      ) : (
                        <b>{activeData.invoiceDate}</b>
                      )}
                    </p>
                    <p className="text-slate-600 text-[10px]">Order Ref: <b>#{activeData.orderId}</b></p>
                    <p className="text-slate-600 text-[10px]">Payment: <b className="uppercase">{activeData.paymentMethod} ({activeData.paymentStatus})</b></p>
                    <p className="text-slate-600 text-[10px] flex items-center sm:justify-end gap-1">
                      <span>Place of Supply:</span>
                      {isEditing ? (
                        <Input
                          value={editForm?.placeOfSupply}
                          onChange={(e) => setEditForm({ ...editForm!, placeOfSupply: e.target.value })}
                          placeholder="Place of Supply & State"
                          className="h-6 w-48 text-[10px] font-bold !bg-white !text-slate-900 border-amber-300"
                        />
                      ) : (
                        <b>{activeData.placeOfSupply}</b>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Billed To / Shipped To (Read-only as placed by customer) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider mb-1">Billed & Shipped To</p>
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-sm text-slate-900">{activeData.customer.name}</p>
                    <p className="text-slate-600 text-xs leading-relaxed">{activeData.customer.address}</p>
                    <p className="text-slate-700 text-xs font-mono pt-0.5">📱 {activeData.customer.phone}</p>
                    {activeData.customer.email && <p className="text-slate-500 text-[11px]">✉️ {activeData.customer.email}</p>}
                  </div>
                </div>

                <div className="sm:text-right space-y-1 text-slate-600 text-xs">
                  <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider mb-1">Delivery & Logistics</p>
                  <p>Order Status: <b className="text-slate-900">{activeData.orderStatus}</b></p>
                  <p>Order Placed: <span className="font-medium text-slate-800">{activeData.orderDate}</span></p>
                  <p>Reverse Charge Applicable: <b>{activeData.reverseCharge}</b></p>
                  <p>Customer GSTIN: <span className="font-mono">{activeData.customer.gstin}</span></p>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-800 text-white font-bold text-[10px] uppercase">
                      <th className="p-2.5 rounded-l-lg">#</th>
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5 text-center">HSN</th>
                      <th className="p-2.5 text-center">Qty / Unit</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5 text-right">Taxable Val</th>
                      <th className="p-2.5 text-right">CGST</th>
                      <th className="p-2.5 text-right">SGST</th>
                      <th className="p-2.5 text-right rounded-r-lg">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeData.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-500">{it.serialNo}</td>
                        <td className="p-2.5">
                          {isEditing ? (
                            <Input
                              value={it.name}
                              onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                              className="h-6 text-xs font-bold !bg-white !text-slate-900 border-amber-300"
                            />
                          ) : (
                            <span className="font-bold text-slate-900">{it.name}</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono text-[11px] text-slate-600">
                          {isEditing ? (
                            <Input
                              value={it.hsn}
                              onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                              className="h-6 w-16 text-center text-xs font-mono mx-auto !bg-white !text-slate-900 border-amber-300"
                            />
                          ) : (
                            it.hsn
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-center">
                              <Input
                                type="number"
                                value={it.qty}
                                onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                                className="h-6 w-12 text-center text-xs !bg-white !text-slate-900 border-amber-300"
                              />
                              <Input
                                value={it.unit}
                                onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                className="h-6 w-16 text-xs !bg-white !text-slate-900 border-amber-300"
                              />
                            </div>
                          ) : (
                            <span>{it.qty} × {it.unit}</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={it.unitPrice}
                              onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                              className="h-6 w-20 text-right text-xs font-mono ml-auto !bg-white !text-slate-900 border-amber-300 font-bold"
                            />
                          ) : (
                            `₹${it.unitPrice}`
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700">₹{it.taxableValue}</td>
                        <td className="p-2.5 text-right font-mono text-[11px] text-slate-600">
                          ₹{it.cgstAmount} <span className="text-[9px] text-slate-400">({it.cgstRate}%)</span>
                        </td>
                        <td className="p-2.5 text-right font-mono text-[11px] text-slate-600">
                          ₹{it.sgstAmount} <span className="text-[9px] text-slate-400">({it.sgstRate}%)</span>
                        </td>
                        <td className="p-2.5 text-right font-bold font-mono text-emerald-900">₹{it.lineTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Tax Summary Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t-2 border-slate-200">
                <div className="space-y-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Amount in Words:</p>
                    <p className="text-xs font-extrabold text-emerald-900 mt-0.5">{activeData.summary.amountInWords}</p>
                  </div>

                  <div className="text-[10px] text-slate-500 leading-relaxed bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                    <p className="font-bold text-amber-900 mb-0.5">Terms & Conditions / Jurisdiction:</p>
                    {isEditing ? (
                      <Textarea
                        value={editForm?.signatory.declaration}
                        onChange={(e) => setEditForm({ ...editForm!, signatory: { ...editForm!.signatory, declaration: e.target.value } })}
                        placeholder="e.g. All disputes subject to Visakhapatnam jurisdiction."
                        rows={2}
                        className="text-xs !bg-white !text-slate-900 border-amber-300 resize-none mt-1 shadow-sm"
                      />
                    ) : (
                      <p>{activeData.signatory.declaration}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">Taxable Amount (Goods):</span>
                    <span className="font-mono">₹{activeData.summary.taxableSubtotal}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">Total CGST:</span>
                    <span className="font-mono">₹{activeData.summary.totalCgst}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500">Total SGST:</span>
                    <span className="font-mono">₹{activeData.summary.totalSgst}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-t border-slate-200 pt-1">
                    <span className="font-semibold">Subtotal:</span>
                    <span className="font-mono font-bold">₹{activeData.summary.subtotal}</span>
                  </div>

                  {parseFloat(activeData.summary.discount) > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-600 font-bold">
                      <span>Discount / Promo Applied {activeData.summary.couponCode ? `(${activeData.summary.couponCode})` : ""}:</span>
                      <span className="font-mono">−₹{activeData.summary.discount}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-t-2 border-slate-900 mt-2 text-base font-black text-slate-900 bg-emerald-50 px-2.5 rounded-lg">
                    <span>Grand Total (INR):</span>
                    <span className="font-mono text-emerald-800">₹{activeData.summary.grandTotal}</span>
                  </div>
                </div>
              </div>

              {/* Signatory Footer — Computer Generated Slip */}
              <div className="flex flex-col sm:flex-row justify-between items-end gap-4 pt-4 border-t border-slate-200">
                {isEditing ? (
                  <div className="space-y-1 text-[11px] bg-amber-50/70 p-2.5 rounded-lg border border-amber-300">
                    <span className="font-bold text-amber-900 text-[10px] uppercase block">Customer Support Hotline & Email:</span>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={editForm?.company.phone}
                        onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, phone: e.target.value } })}
                        placeholder="Support Phone"
                        className="h-6 w-36 text-[10px] !bg-white !text-slate-900 border-amber-300 font-mono"
                      />
                      <Input
                        value={editForm?.company.email}
                        onChange={(e) => setEditForm({ ...editForm!, company: { ...editForm!.company, email: e.target.value } })}
                        placeholder="Support Email"
                        className="h-6 w-44 text-[10px] !bg-white !text-slate-900 border-amber-300 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">
                    <p>Customer Support: <b>{activeData.company.phone}</b> | <b>{activeData.company.email}</b></p>
                    <p>Thank you for choosing certified fresh organic farming!</p>
                  </div>
                )}

                <div className="text-right space-y-1.5 min-w-[260px]">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-black shadow-sm">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Computer Generated Slip</span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    This is a computer-generated slip. No physical signature is required.
                  </p>
                  <p className="text-[10px] font-bold text-slate-700 uppercase pt-1 border-t border-slate-200">
                    For {activeData.company.legalName}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

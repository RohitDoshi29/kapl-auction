import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  Download,
  Users,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllStoredRegistrations,
  exportRegistrationsToExcel,
  exportRegistrationsToText,
  RegistrationExportRow,
} from '@/lib/exportRegistrations';

interface ExportRegistrationsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ExportRegistrationsDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ExportRegistrationsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rows, setRows] = useState<RegistrationExportRow[]>([]);
  const [textContent, setTextContent] = useState('');
  const [viewMode, setViewMode] = useState<'summary' | 'rawText'>('summary');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getAllStoredRegistrations();
      setRows(data);
      const text = await exportRegistrationsToText(data);
      setTextContent(text);
    } catch (err: any) {
      toast.error('Failed to load auction players: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleDownloadExcel = async () => {
    try {
      const { count, filename } = await exportRegistrationsToExcel(rows);
      toast.success(`Downloaded ${filename} with ${count} player(s)!`);
    } catch (e: any) {
      toast.error('Excel export failed: ' + e.message);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      toast.success('All auction player records copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info('Please select all text inside the box and copy manually');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90dvh] flex flex-col p-4 sm:p-6 bg-card/95 backdrop-blur-2xl border border-amber-500/30 rounded-3xl shadow-2xl">
        <DialogHeader className="space-y-1.5 border-b border-white/[0.08] pb-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold px-2 py-0.5"
            >
              <ShieldCheck className="w-3 h-3 mr-1 text-amber-400" />
              AUCTION PLAYER POOL BACKUP
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-black font-display text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            Auction Players Export
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Download an Excel (.xlsx) spreadsheet or view plain-text records for all auction players and sale results.
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3">
          {/* Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-center">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Total Players
              </span>
              <span className="text-2xl font-black text-amber-400 mt-0.5 block">
                {rows.length}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-center">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Pending Auction
              </span>
              <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
                {rows.filter((r) => r['Auction Status'] === 'PENDING').length}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-center col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Sold to Squads
              </span>
              <span className="text-2xl font-black text-purple-400 mt-0.5 block">
                {rows.filter((r) => r['Auction Status'] === 'SOLD').length}
              </span>
            </div>
          </div>

          {/* Action Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <Button
              onClick={handleDownloadExcel}
              className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm gap-2 shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Download className="w-4 h-4" />
              Download Excel (.xlsx)
            </Button>

            <Button
              variant="outline"
              onClick={handleCopyText}
              className="h-11 rounded-2xl border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-foreground font-bold text-xs sm:text-sm gap-2 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-amber-400" />
                  Copy Text for Text Editor
                </>
              )}
            </Button>
          </div>

          {/* Toggle between preview table and raw text */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Player Pool Text Viewer
            </span>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg font-medium transition-colors ${
                  viewMode === 'summary'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('rawText')}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg font-medium transition-colors ${
                  viewMode === 'rawText'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Raw Text / CSV
              </button>
            </div>
          </div>

          {/* View Mode: Table or Raw Text */}
          {viewMode === 'rawText' ? (
            <div className="space-y-1.5">
              <Textarea
                readOnly
                value={textContent}
                className="font-mono text-[11px] leading-relaxed h-56 resize-none bg-black/50 border-white/10 rounded-2xl p-3 focus-visible:ring-amber-500/50"
              />
              <p className="text-[10px] text-muted-foreground text-right">
                Tip: Click "Copy Text" above or press Ctrl+A / Ctrl+C to paste directly into Notepad or VS Code.
              </p>
            </div>
          ) : (
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20 max-h-56 overflow-y-auto">
              {rows.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No auction players found in database or local storage yet.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06] text-xs">
                  {rows.map((r, i) => (
                    <div key={r['Player ID'] || i} className="p-2.5 hover:bg-white/[0.03] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground truncate">{r['Player Name']}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-semibold shrink-0">
                            {r['Playing Role']}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {r['Phone Number'] !== 'N/A' && <span>📞 {r['Phone Number']}</span>}
                          {r['Email'] !== 'N/A' && <span>✉️ {r['Email']}</span>}
                          <span>👕 #{r['Jersey Number']}</span>
                          <span>🏆 {r['Tournament']}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 block mb-0.5">
                          {r['Auction Status']}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          Base: ₹{r['Base Price (₹)']}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


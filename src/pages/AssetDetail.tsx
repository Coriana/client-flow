import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { formatDisplayDate } from "@/lib/dates";
import LocationSelector from "@/components/LocationSelector";
import {
  ArrowLeft,
  Save,
  Upload,
  History,
  ChevronDown,
  ChevronUp,
  Image,
  X,
  AlertCircle,
  Wrench,
  RefreshCw,
  Package,
  Bug,
  CheckCircle,
  FileText,
  Eye,
  Trash2,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type JobAsset = Tables<"job_assets">;
type AssetHistory = Tables<"asset_history">;
type Issue = Tables<"issues">;

interface JobAssetWithJob extends JobAsset {
  jobs?: {
    id: string;
    name: string;
    job_number: string;
  };
}

interface AssetHistoryWithDetails extends AssetHistory {
  // Additional fields from joins
}

interface IssueWithClient extends Issue {
  clients?: { name: string } | null;
}

interface AssetDocument {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
}

// Combined history item type
interface HistoryItem {
  id: string;
  date: string;
  type: "history" | "issue";
  eventType: string;
  description: string;
  issueStatus?: string;
  issueSeverity?: string;
  issueId?: string;
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useBranding();
  const isNew = id === "new";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [jobAssets, setJobAssets] = useState<JobAssetWithJob[]>([]);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryWithDetails[]>([]);
  const [assetIssues, setAssetIssues] = useState<IssueWithClient[]>([]);
  const [assetDocuments, setAssetDocuments] = useState<AssetDocument[]>([]);
  const [viewingDocument, setViewingDocument] = useState<AssetDocument | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [asset, setAsset] = useState<any>({
    asset_tag: "",
    name: "",
    description: "",
    asset_type: "",
    serial_number: "",
    status: "in_service",
    location: "",
    assigned_client_id: null,
    purchase_date: null,
    purchase_cost: null,
    warranty_end: null,
    current_firmware: "",
    notes: "",
    image_url: null,
    default_rental_rate: null,
    default_billing_frequency: "monthly",
  });

  useEffect(() => {
    fetchClients();
    if (!isNew && id) {
      fetchAsset();
      fetchRentalHistory();
      fetchAssetHistory();
      fetchAssetIssues();
      fetchAssetDocuments();
    }
  }, [id, isNew]);

  async function fetchClients() {
    const { data } = await supabase.from("clients").select("id, name").eq("is_active", true);
    setClients(data || []);
  }

  async function fetchAsset() {
    const { data, error } = await supabase.from("assets").select("*").eq("id", id).single();
    if (error) {
      navigate("/assets");
      return;
    }
    setAsset(data);
    setLoading(false);
  }

  async function fetchRentalHistory() {
    const { data } = await supabase
      .from("job_assets")
      .select("*, jobs(id, name, job_number)")
      .eq("asset_id", id)
      .order("rental_start_date", { ascending: false });
    setJobAssets(data || []);
  }

  async function fetchAssetHistory() {
    const { data } = await supabase
      .from("asset_history")
      .select("*")
      .eq("asset_id", id)
      .order("event_date", { ascending: false });
    setAssetHistory(data || []);
  }

  async function fetchAssetIssues() {
    // Fetch issues directly linked to asset OR via issue_assets junction table
    const [directIssues, linkedIssues] = await Promise.all([
      supabase.from("issues").select("*, clients(name)").eq("asset_id", id).order("created_at", { ascending: false }),
      supabase.from("issue_assets").select("issues(*, clients(name))").eq("asset_id", id!),
    ]);

    const directData = (directIssues.data || []) as IssueWithClient[];
    const linkedData = (linkedIssues.data || [])
      .map((ia) => ia.issues)
      .filter((i): i is NonNullable<typeof i> => i !== null);

    // Combine and deduplicate
    const allIssues: IssueWithClient[] = [...directData];
    linkedData.forEach((li) => {
      if (!allIssues.find((ai) => ai.id === li.id)) {
        allIssues.push(li as IssueWithClient);
      }
    });

    setAssetIssues(allIssues);
  }

  async function fetchAssetDocuments() {
    const { data } = await supabase
      .from("asset_documents")
      .select("*")
      .eq("asset_id", id)
      .order("created_at", { ascending: false });
    setAssetDocuments(data || []);
  }

  async function handlePdfUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast({ title: "Error", description: "Please select a PDF file", variant: "destructive" });
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Error", description: "PDF must be less than 20MB", variant: "destructive" });
      return;
    }

    setUploadingPdf(true);

    try {
      const fileName = `assets/${id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);

      // Save document record
      const { error: dbError } = await supabase.from("asset_documents").insert({
        asset_id: id,
        name: file.name,
        file_url: urlData.publicUrl,
        file_type: "pdf",
        file_size: file.size,
        uploaded_by: user?.id,
      });

      if (dbError) throw dbError;

      // Log to history
      await supabase.from("asset_history").insert({
        asset_id: id,
        event_type: "document_added",
        description: `Document uploaded: ${file.name}`,
        created_by: user?.id,
      });

      toast({ title: "Success", description: "PDF uploaded" });
      fetchAssetDocuments();
      fetchAssetHistory();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  async function handleDeleteDocument(doc: AssetDocument) {
    try {
      // Delete from storage
      const filePath = doc.file_url.split("/documents/")[1];
      if (filePath) {
        await supabase.storage.from("documents").remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase.from("asset_documents").delete().eq("id", doc.id);
      if (error) throw error;

      // Log to history
      await supabase.from("asset_history").insert({
        asset_id: id,
        event_type: "document_removed",
        description: `Document removed: ${doc.name}`,
        created_by: user?.id,
      });

      toast({ title: "Success", description: "Document deleted" });
      fetchAssetDocuments();
      fetchAssetHistory();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please select an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `assets/${id || "new"}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("images").upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);

      setAsset({ ...asset, image_url: urlData.publicUrl });
      toast({ title: "Success", description: "Image uploaded" });

      // Log history if not new
      if (!isNew && id) {
        await supabase.from("asset_history").insert({
          asset_id: id,
          event_type: "image_updated",
          description: "Asset image was updated",
          created_by: user?.id,
        });
        fetchAssetHistory();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage() {
    setAsset({ ...asset, image_url: null });
  }

  async function handleSave() {
    setSaving(true);
    if (!asset.name || !asset.asset_tag) {
      toast({ title: "Error", description: "Name and Asset Tag are required", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Remove rental-related fields that are now in job_assets
    const { is_rental, monthly_rate, rental_start_date, rented_to_client_id, next_invoice_date, ...assetData } = asset;

    if (isNew) {
      const { data, error } = await supabase
        .from("assets")
        .insert({ ...assetData, user_id: user?.id })
        .select()
        .single();
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        // Log creation history
        await supabase.from("asset_history").insert({
          asset_id: data.id,
          event_type: "created",
          description: "Asset was created",
          created_by: user?.id,
        });
        toast({ title: "Success", description: "Asset created" });
        navigate(`/assets/${data.id}`);
      }
    } else {
      // Get old asset for comparison
      const { data: oldAsset } = await supabase.from("assets").select("*").eq("id", id).single();

      const { error } = await supabase.from("assets").update(assetData).eq("id", id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        // Log changes to history
        const changes: string[] = [];
        if (oldAsset) {
          if (oldAsset.status !== asset.status) changes.push(`Status: ${oldAsset.status} → ${asset.status}`);
          if (oldAsset.location !== asset.location)
            changes.push(`Location: ${oldAsset.location || "none"} → ${asset.location || "none"}`);
          if (oldAsset.assigned_client_id !== asset.assigned_client_id) changes.push("Assigned client changed");
          if (oldAsset.current_firmware !== asset.current_firmware)
            changes.push(`Firmware: ${oldAsset.current_firmware || "none"} → ${asset.current_firmware || "none"}`);
        }

        if (changes.length > 0) {
          await supabase.from("asset_history").insert({
            asset_id: id,
            event_type: "updated",
            description: changes.join("; "),
            created_by: user?.id,
            old_values: oldAsset,
            new_values: assetData,
          });
          fetchAssetHistory();
        }

        toast({ title: "Success", description: "Asset updated" });
      }
    }
    setSaving(false);
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getHistoryIcon = (eventType: string) => {
    switch (eventType) {
      case "created":
        return <Package className="h-4 w-4 text-green-500" />;
      case "updated":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "maintenance":
        return <Wrench className="h-4 w-4 text-amber-500" />;
      case "issue":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "issue_open":
        return <Bug className="h-4 w-4 text-red-500" />;
      case "issue_resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "issue_closed":
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
      case "issue_in_progress":
        return <Bug className="h-4 w-4 text-amber-500" />;
      case "image_updated":
        return <Image className="h-4 w-4 text-purple-500" />;
      case "document_added":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "document_removed":
        return <FileText className="h-4 w-4 text-red-500" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Combine asset history with issues for comprehensive timeline
  const getCombinedHistory = (): HistoryItem[] => {
    const historyItems: HistoryItem[] = assetHistory.map((h) => ({
      id: h.id,
      date: h.event_date,
      type: "history" as const,
      eventType: h.event_type,
      description: h.description,
    }));

    const issueItems: HistoryItem[] = assetIssues.map((i) => ({
      id: i.id,
      date: i.created_at,
      type: "issue" as const,
      eventType: `issue_${i.status}`,
      description: i.title,
      issueStatus: i.status,
      issueSeverity: i.severity,
      issueId: i.id,
    }));

    return [...historyItems, ...issueItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const combinedHistory = getCombinedHistory();

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  // Find current active rental
  const activeRental = jobAssets.find(
    (ja) => ja.is_active && (!ja.rental_end_date || new Date(ja.rental_end_date) >= new Date()),
  );

  // History to display (5 or all) - now uses combined history
  const displayedHistory = showAllHistory ? combinedHistory : combinedHistory.slice(0, 5);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-amber-500">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-red-500">Open</Badge>;
      case "in_progress":
        return <Badge className="bg-amber-500">In Progress</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "closed":
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/assets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{isNew ? "New Asset" : asset.name}</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Image Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {asset.image_url ? (
              <div className="relative">
                <img src={asset.image_url} alt={asset.name} className="w-full h-48 object-cover rounded-lg border" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload image</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Image"}
            </Button>
          </CardContent>
        </Card>

        {/* PDF Documents Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {assetDocuments.length > 0 && (
              <div className="space-y-2">
                {assetDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="h-8 w-8 text-red-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => setViewingDocument(doc)} title="View PDF">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDocument(doc)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {assetDocuments.length === 0 && !isNew && (
              <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
            )}

            {isNew && <p className="text-sm text-muted-foreground">Save asset first to upload documents</p>}

            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => pdfInputRef.current?.click()}
              disabled={uploadingPdf || isNew}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingPdf ? "Uploading..." : "Upload PDF"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Tag *</Label>
                <Input value={asset.asset_tag} onChange={(e) => setAsset({ ...asset, asset_tag: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Input
                  value={asset.asset_type || ""}
                  onChange={(e) => setAsset({ ...asset, asset_type: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={asset.name} onChange={(e) => setAsset({ ...asset, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input
                value={asset.serial_number || ""}
                onChange={(e) => setAsset({ ...asset, serial_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={asset.status} onValueChange={(v: any) => setAsset({ ...asset, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_service">In Service</SelectItem>
                  <SelectItem value="spare">Spare</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned Client</Label>
              <Select
                value={asset.assigned_client_id || "none"}
                onValueChange={(v) => setAsset({ ...asset, assigned_client_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Available for rental)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {asset.assigned_client_id && (
                <p className="text-xs text-amber-600">Assigned assets cannot be rented out to jobs</p>
              )}
            </div>
            <LocationSelector
              value={asset.location_id || null}
              onChange={(locationId) => setAsset({ ...asset, location_id: locationId })}
            />
            <div className="space-y-2">
              <Label>Location Notes</Label>
              <Input value={asset.location || ""} onChange={(e) => setAsset({ ...asset, location: e.target.value })} placeholder="e.g. Rack 3, Shelf 2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purchase & Warranty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={asset.purchase_date || ""}
                onChange={(e) => setAsset({ ...asset, purchase_date: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Purchase Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={asset.purchase_cost || ""}
                onChange={(e) => setAsset({ ...asset, purchase_cost: parseFloat(e.target.value) || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Warranty End</Label>
              <Input
                type="date"
                value={asset.warranty_end || ""}
                onChange={(e) => setAsset({ ...asset, warranty_end: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Current Firmware</Label>
              <Input
                value={asset.current_firmware || ""}
                onChange={(e) => setAsset({ ...asset, current_firmware: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rental Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set default rental values that will pre-populate when adding this asset to a job.
            </p>
            <div className="space-y-2">
              <Label>Default Rental Rate</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 100.00"
                value={asset.default_rental_rate || ""}
                onChange={(e) => setAsset({ ...asset, default_rental_rate: parseFloat(e.target.value) || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Billing Frequency</Label>
              <Select
                value={asset.default_billing_frequency || "monthly"}
                onValueChange={(v) => setAsset({ ...asset, default_billing_frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Asset History Card - Now includes issues */}
        {!isNew && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Asset History & Issues
              </CardTitle>
              {combinedHistory.length > 5 && (
                <Button variant="ghost" size="sm" onClick={() => setShowAllHistory(!showAllHistory)}>
                  {showAllHistory ? (
                    <>
                      Show Less <ChevronUp className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Show All ({combinedHistory.length}) <ChevronDown className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {combinedHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm">No history recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {displayedHistory.map((item) => (
                    <div key={item.id} className="flex gap-3 items-start p-2 rounded hover:bg-muted/50">
                      <div className="mt-0.5">{getHistoryIcon(item.eventType)}</div>
                      <div className="flex-1 min-w-0">
                        {item.type === "issue" ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link to={`/issues/${item.issueId}`} className="font-medium text-sm hover:underline">
                                Issue: {item.description}
                              </Link>
                              {item.issueStatus && getStatusBadge(item.issueStatus)}
                              {item.issueSeverity && getSeverityBadge(item.issueSeverity)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{formatDate(item.date)}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium text-sm capitalize">{item.eventType.replace("_", " ")}</div>
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                            <div className="text-xs text-muted-foreground mt-1">{formatDate(item.date)}</div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isNew && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Rental History</CardTitle>
            </CardHeader>
            <CardContent>
              {activeRental && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="font-medium text-green-800 dark:text-green-200">Currently Rented</div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <Link to={`/jobs/${activeRental.jobs?.id}`} className="hover:underline">
                      {activeRental.jobs?.name} ({activeRental.jobs?.job_number})
                    </Link>
                    <span className="mx-2">•</span>
                    {formatCurrency(activeRental.rental_rate)}/{activeRental.billing_frequency}
                    <span className="mx-2">•</span>
                    Since {formatDisplayDate(activeRental.rental_start_date)}
                  </div>
                </div>
              )}

              {jobAssets.length === 0 ? (
                <p className="text-muted-foreground">
                  This asset has no rental history. Assign it to a job to start tracking rentals.
                </p>
              ) : (
                <div className="space-y-2">
                  {jobAssets.map((ja) => (
                    <div
                      key={ja.id}
                      className={`flex justify-between items-center p-3 rounded-lg border ${ja.is_active ? "bg-muted/50" : "opacity-60"}`}
                    >
                      <div>
                        <Link to={`/jobs/${ja.jobs?.id}`} className="font-medium hover:underline">
                          {ja.jobs?.name} ({ja.jobs?.job_number})
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(ja.rental_rate)}/{ja.billing_frequency}
                          <span className="mx-2">•</span>
                          {formatDisplayDate(ja.rental_start_date)} to {ja.rental_end_date ? formatDisplayDate(ja.rental_end_date) : "ongoing"}
                          {!ja.is_active && <span className="ml-2 text-amber-600">(Inactive)</span>}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">Next invoice: {ja.next_invoice_date ? formatDisplayDate(ja.next_invoice_date) : "N/A"}</div>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-sm text-muted-foreground">
                To add or modify rentals, go to the Job's Assets tab.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* PDF Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={(open) => !open && setViewingDocument(null)}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingDocument?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {viewingDocument && (
              <iframe src={viewingDocument.file_url} className="w-full h-full border-0" title={viewingDocument.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

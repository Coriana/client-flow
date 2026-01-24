import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, MessageSquare } from 'lucide-react';
import LinkKBArticleDialog from '@/components/kb/LinkKBArticleDialog';
import AddToIssuePopover from '@/components/issues/AddToIssuePopover';
import LinkedEntitiesCard from '@/components/issues/LinkedEntitiesCard';
import IssueActivityFeed from '@/components/issues/IssueActivityFeed';
import { format } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  user_name?: string;
}

interface LinkedJob {
  id: string;
  job_id: string;
  job_number: string;
  name: string;
}

interface LinkedAsset {
  id: string;
  asset_id: string;
  asset_tag: string;
  name: string;
}

interface LinkedItem {
  id: string;
  item_id: string;
  sku: string;
  name: string;
}

interface OriginalIssue {
  title: string;
  description: string | null;
  severity: string;
  status: string;
  due_date: string | null;
  vendor_id: string | null;
  purchase_id: string | null;
}

interface IssueBookmark {
  id: string;
  issue_id: string;
  bookmark_label: string;
  content: string;
  created_at: string;
  issue_title?: string;
}

interface LinkedBookmark {
  id: string;
  target_bookmark_id: string;
  bookmark: IssueBookmark;
}

interface LinkedArticle {
  id: string;
  article_id: string;
  link_type: string;
  stage_notes: string | null;
  helped_resolve: boolean | null;
  applied_at: string;
  article_title: string;
  article_category: string | null;
}

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNew = id === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  
  // KB Dialog state
  const [kbDialogOpen, setKbDialogOpen] = useState(false);
  
  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<IssueBookmark[]>([]);
  const [linkedBookmarks, setLinkedBookmarks] = useState<LinkedBookmark[]>([]);
  const [allBookmarks, setAllBookmarks] = useState<IssueBookmark[]>([]);
  
  // Linked entities
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [linkedArticles, setLinkedArticles] = useState<LinkedArticle[]>([]);
  
  // Track original state for history
  const originalIssue = useRef<OriginalIssue | null>(null);
  const originalJobIds = useRef<string[]>([]);
  const originalAssetIds = useRef<string[]>([]);
  const originalItemIds = useRef<string[]>([]);
  
  const [issue, setIssue] = useState<any>({
    title: '',
    description: '',
    severity: 'medium',
    status: 'open',
    due_date: null,
    vendor_id: null,
    purchase_id: null,
  });

  useEffect(() => {
    fetchJobs();
    fetchAssets();
    fetchVendors();
    fetchPurchases();
    fetchInventoryItems();
    fetchAllBookmarks();
    if (!isNew && id) {
      fetchIssue();
      fetchLinkedEntities();
      fetchComments();
      fetchBookmarks();
      fetchLinkedBookmarks();
      fetchLinkedArticles();
    }
  }, [id, isNew]);

  async function fetchLinkedArticles() {
    const { data } = await supabase
      .from('kb_article_issues')
      .select('id, article_id, link_type, stage_notes, helped_resolve, applied_at, kb_articles(title, category)')
      .eq('issue_id', id);
    
    setLinkedArticles((data || []).map((link: any) => ({
      id: link.id,
      article_id: link.article_id,
      link_type: link.link_type,
      stage_notes: link.stage_notes,
      helped_resolve: link.helped_resolve,
      applied_at: link.applied_at,
      article_title: link.kb_articles?.title || 'Unknown',
      article_category: link.kb_articles?.category,
    })));
  }

  async function fetchJobs() {
    const { data } = await supabase.from('jobs').select('id, name, job_number').order('name');
    setJobs(data || []);
  }

  async function fetchAssets() {
    const { data } = await supabase.from('assets').select('id, name, asset_tag').order('name');
    setAssets(data || []);
  }

  async function fetchVendors() {
    const { data } = await supabase.from('vendors').select('id, name').eq('is_active', true).order('name');
    setVendors(data || []);
  }

  async function fetchPurchases() {
    const { data } = await supabase
      .from('purchases')
      .select('id, description, date, vendor_id, vendors(name)')
      .order('date', { ascending: false })
      .limit(100);
    setPurchases(data || []);
  }

  async function fetchInventoryItems() {
    const { data } = await supabase.from('items').select('id, name, sku').eq('is_active', true).order('name');
    setInventoryItems(data || []);
  }

  async function fetchIssue() {
    const { data, error } = await supabase.from('issues').select('*').eq('id', id).single();
    
    if (error || !data) {
      toast({ title: 'Error', description: 'Issue not found', variant: 'destructive' });
      navigate('/issues');
    } else {
      setIssue(data);
      originalIssue.current = {
        title: data.title,
        description: data.description,
        severity: data.severity,
        status: data.status,
        due_date: data.due_date,
        vendor_id: data.vendor_id,
        purchase_id: data.purchase_id,
      };
    }
    setLoading(false);
  }

  async function fetchLinkedEntities() {
    const [jobsRes, assetsRes, itemsRes] = await Promise.all([
      supabase.from('issue_jobs').select('id, job_id, jobs(job_number, name)').eq('issue_id', id),
      supabase.from('issue_assets').select('id, asset_id, assets(asset_tag, name)').eq('issue_id', id),
      supabase.from('issue_items').select('id, item_id, items(sku, name)').eq('issue_id', id),
    ]);
    
    const linkedJobsData = (jobsRes.data || []).map((ij: any) => ({
      id: ij.id,
      job_id: ij.job_id,
      job_number: ij.jobs?.job_number || '',
      name: ij.jobs?.name || '',
    }));
    
    const linkedAssetsData = (assetsRes.data || []).map((ia: any) => ({
      id: ia.id,
      asset_id: ia.asset_id,
      asset_tag: ia.assets?.asset_tag || '',
      name: ia.assets?.name || '',
    }));

    const linkedItemsData = (itemsRes.data || []).map((ii: any) => ({
      id: ii.id,
      item_id: ii.item_id,
      sku: ii.items?.sku || '',
      name: ii.items?.name || '',
    }));
    
    setLinkedJobs(linkedJobsData);
    setLinkedAssets(linkedAssetsData);
    setLinkedItems(linkedItemsData);
    
    originalJobIds.current = linkedJobsData.map((j: LinkedJob) => j.job_id);
    originalAssetIds.current = linkedAssetsData.map((a: LinkedAsset) => a.asset_id);
    originalItemIds.current = linkedItemsData.map((i: LinkedItem) => i.item_id);
  }

  async function fetchComments() {
    const { data: commentsData } = await supabase
      .from('issue_comments')
      .select('*')
      .eq('issue_id', id)
      .order('created_at', { ascending: false });
    
    if (commentsData) {
      const userIds = [...new Set(commentsData.map(c => c.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name || p.email]));
      
      setComments(
        commentsData.map(c => ({
          ...c,
          user_name: c.user_id ? profileMap.get(c.user_id) || 'Unknown' : 'System',
        }))
      );
    }
  }

  async function fetchBookmarks() {
    const { data } = await supabase
      .from('issue_bookmarks')
      .select('*')
      .eq('issue_id', id)
      .order('created_at', { ascending: false });
    setBookmarks(data || []);
  }

  async function fetchLinkedBookmarks() {
    const { data } = await supabase
      .from('issue_bookmark_links')
      .select('id, target_bookmark_id, issue_bookmarks(id, issue_id, bookmark_label, content, created_at)')
      .eq('source_issue_id', id);
    
    if (data) {
      const linked: LinkedBookmark[] = [];
      for (const item of data) {
        if (item.issue_bookmarks) {
          const { data: issueData } = await supabase
            .from('issues')
            .select('title')
            .eq('id', (item.issue_bookmarks as any).issue_id)
            .single();
          
          linked.push({
            id: item.id,
            target_bookmark_id: item.target_bookmark_id,
            bookmark: {
              ...(item.issue_bookmarks as any),
              issue_title: issueData?.title || 'Unknown Issue',
            },
          });
        }
      }
      setLinkedBookmarks(linked);
    }
  }

  async function fetchAllBookmarks() {
    const { data } = await supabase
      .from('issue_bookmarks')
      .select('*, issues(title)')
      .order('created_at', { ascending: false });
    
    if (data) {
      setAllBookmarks(data.map((b: any) => ({
        ...b,
        issue_title: b.issues?.title || 'Unknown Issue',
      })));
    }
  }

  // Handlers for AddToIssuePopover
  async function handleAddNote(content: string) {
    const { error } = await supabase.from('issue_comments').insert({
      issue_id: id,
      user_id: user?.id,
      content: content,
    });
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchComments();
      toast({ title: 'Note added' });
    }
  }

  function handleLinkJob(jobId: string) {
    if (linkedJobs.some(j => j.job_id === jobId)) return;
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setLinkedJobs([...linkedJobs, {
        id: `pending-${Date.now()}`,
        job_id: job.id,
        job_number: job.job_number,
        name: job.name,
      }]);
      toast({ title: 'Job linked', description: 'Save to persist changes' });
    }
  }

  function handleRemoveJob(jobId: string) {
    setLinkedJobs(linkedJobs.filter(j => j.job_id !== jobId));
  }

  function handleLinkAsset(assetId: string) {
    if (linkedAssets.some(a => a.asset_id === assetId)) return;
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      setLinkedAssets([...linkedAssets, {
        id: `pending-${Date.now()}`,
        asset_id: asset.id,
        asset_tag: asset.asset_tag,
        name: asset.name,
      }]);
      toast({ title: 'Asset linked', description: 'Save to persist changes' });
    }
  }

  function handleRemoveAsset(assetId: string) {
    setLinkedAssets(linkedAssets.filter(a => a.asset_id !== assetId));
  }

  function handleLinkItem(itemId: string) {
    if (linkedItems.some(i => i.item_id === itemId)) return;
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      setLinkedItems([...linkedItems, {
        id: `pending-${Date.now()}`,
        item_id: item.id,
        sku: item.sku,
        name: item.name,
      }]);
      toast({ title: 'Item linked', description: 'Save to persist changes' });
    }
  }

  function handleRemoveItem(itemId: string) {
    setLinkedItems(linkedItems.filter(i => i.item_id !== itemId));
  }

  async function handleCreateBookmark(label: string, content: string) {
    const { error } = await supabase.from('issue_bookmarks').insert({
      issue_id: id,
      bookmark_label: label,
      content: content,
      created_by: user?.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchBookmarks();
      fetchAllBookmarks();
      await supabase.from('issue_comments').insert({
        issue_id: id,
        user_id: user?.id,
        content: `Created bookmark: "${label}"`,
      });
      fetchComments();
      toast({ title: 'Bookmark created' });
    }
  }

  async function handleDeleteBookmark(bookmarkId: string, label: string) {
    const { error } = await supabase.from('issue_bookmarks').delete().eq('id', bookmarkId);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchBookmarks();
      fetchAllBookmarks();
      await supabase.from('issue_comments').insert({
        issue_id: id,
        user_id: user?.id,
        content: `Removed bookmark: "${label}"`,
      });
      fetchComments();
      toast({ title: 'Bookmark deleted' });
    }
  }

  async function handleLinkBookmark(bookmarkId: string) {
    const { error } = await supabase.from('issue_bookmark_links').insert({
      source_issue_id: id,
      target_bookmark_id: bookmarkId,
      created_by: user?.id,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Error', description: 'This bookmark is already linked', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      fetchLinkedBookmarks();
      const bookmark = allBookmarks.find(b => b.id === bookmarkId);
      if (bookmark) {
        await supabase.from('issue_comments').insert({
          issue_id: id,
          user_id: user?.id,
          content: `Linked to resolution: "${bookmark.bookmark_label}" from issue "${bookmark.issue_title}"`,
        });
        fetchComments();
      }
      toast({ title: 'Resolution linked' });
    }
  }

  async function handleUnlinkBookmark(linkId: string, label: string) {
    const { error } = await supabase.from('issue_bookmark_links').delete().eq('id', linkId);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchLinkedBookmarks();
      await supabase.from('issue_comments').insert({
        issue_id: id,
        user_id: user?.id,
        content: `Unlinked resolution: "${label}"`,
      });
      fetchComments();
      toast({ title: 'Resolution unlinked' });
    }
  }

  function copyBookmarkLink(bookmark: IssueBookmark) {
    const url = `${window.location.origin}/issues/${bookmark.issue_id}#bookmark-${bookmark.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied', description: 'Bookmark link copied to clipboard' });
  }

  async function handleRemoveArticle(linkId: string) {
    const { error } = await supabase.from('kb_article_issues').delete().eq('id', linkId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchLinkedArticles();
      toast({ title: 'Article unlinked' });
    }
  }

  async function handleSave() {
    setSaving(true);
    
    if (!issue.title) {
      toast({ title: 'Error', description: 'Title required', variant: 'destructive' });
      setSaving(false);
      return;
    }

    const changes: string[] = [];
    
    if (!isNew && originalIssue.current) {
      const orig = originalIssue.current;
      
      if (orig.title !== issue.title) {
        changes.push(`Title changed from "${orig.title}" to "${issue.title}"`);
      }
      if (orig.description !== issue.description) {
        const oldDesc = orig.description ? `"${orig.description.substring(0, 50)}${orig.description.length > 50 ? '...' : ''}"` : 'empty';
        const newDesc = issue.description ? `"${issue.description.substring(0, 50)}${issue.description.length > 50 ? '...' : ''}"` : 'empty';
        changes.push(`Description changed from ${oldDesc} to ${newDesc}`);
      }
      if (orig.severity !== issue.severity) {
        changes.push(`Severity changed from "${orig.severity}" to "${issue.severity}"`);
      }
      if (orig.status !== issue.status) {
        changes.push(`Status changed from "${orig.status}" to "${issue.status}"`);
      }
      if (orig.due_date !== issue.due_date) {
        const oldDate = orig.due_date ? format(new Date(orig.due_date), 'MMM d, yyyy') : 'None';
        const newDate = issue.due_date ? format(new Date(issue.due_date), 'MMM d, yyyy') : 'None';
        changes.push(`Due date changed from "${oldDate}" to "${newDate}"`);
      }
      
      const currentJobIds = linkedJobs.map(j => j.job_id);
      const addedJobs = currentJobIds.filter(jid => !originalJobIds.current.includes(jid));
      const removedJobs = originalJobIds.current.filter(jid => !currentJobIds.includes(jid));
      
      for (const jobId of addedJobs) {
        const job = jobs.find(j => j.id === jobId);
        if (job) changes.push(`Added job: ${job.job_number} - ${job.name}`);
      }
      for (const jobId of removedJobs) {
        const job = jobs.find(j => j.id === jobId);
        if (job) changes.push(`Removed job: ${job.job_number} - ${job.name}`);
      }
      
      const currentAssetIds = linkedAssets.map(a => a.asset_id);
      const addedAssets = currentAssetIds.filter(aid => !originalAssetIds.current.includes(aid));
      const removedAssets = originalAssetIds.current.filter(aid => !currentAssetIds.includes(aid));
      
      for (const assetId of addedAssets) {
        const asset = assets.find(a => a.id === assetId);
        if (asset) changes.push(`Added asset: ${asset.asset_tag} - ${asset.name}`);
      }
      for (const assetId of removedAssets) {
        const asset = assets.find(a => a.id === assetId);
        if (asset) changes.push(`Removed asset: ${asset.asset_tag} - ${asset.name}`);
      }
    }

    const updateData = { ...issue };
    if (!isNew && originalIssue.current) {
      const statusChanged = originalIssue.current.status !== issue.status;
      
      if (statusChanged) {
        if ((issue.status === 'resolved' || issue.status === 'closed') && !issue.resolved_at) {
          updateData.resolved_at = new Date().toISOString();
        } else if (issue.status !== 'resolved' && issue.status !== 'closed') {
          updateData.resolved_at = null;
        }
        
        if (originalIssue.current.status === 'open' && !issue.first_response_date) {
          updateData.first_response_date = new Date().toISOString();
        }
      }
    }

    delete updateData.job_id;
    delete updateData.asset_id;

    if (isNew) {
      const { data, error } = await supabase
        .from('issues')
        .insert({ ...updateData, created_by: user?.id })
        .select()
        .single();
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      
      if (linkedJobs.length > 0) {
        await supabase.from('issue_jobs').insert(linkedJobs.map(j => ({ issue_id: data.id, job_id: j.job_id })));
      }
      if (linkedAssets.length > 0) {
        await supabase.from('issue_assets').insert(linkedAssets.map(a => ({ issue_id: data.id, asset_id: a.asset_id })));
      }
      if (linkedItems.length > 0) {
        await supabase.from('issue_items').insert(linkedItems.map(i => ({ issue_id: data.id, item_id: i.item_id })));
      }
      
      toast({ title: 'Issue created' });
      navigate(`/issues/${data.id}`);
    } else {
      const { error } = await supabase.from('issues').update(updateData).eq('id', id);
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      
      const currentJobIds = linkedJobs.map(j => j.job_id);
      const jobsToAdd = currentJobIds.filter(jid => !originalJobIds.current.includes(jid));
      const jobsToRemove = originalJobIds.current.filter(jid => !currentJobIds.includes(jid));
      
      if (jobsToRemove.length > 0) {
        await supabase.from('issue_jobs').delete().eq('issue_id', id).in('job_id', jobsToRemove);
      }
      if (jobsToAdd.length > 0) {
        await supabase.from('issue_jobs').insert(jobsToAdd.map(jid => ({ issue_id: id, job_id: jid })));
      }
      
      const currentAssetIds = linkedAssets.map(a => a.asset_id);
      const assetsToAdd = currentAssetIds.filter(aid => !originalAssetIds.current.includes(aid));
      const assetsToRemove = originalAssetIds.current.filter(aid => !currentAssetIds.includes(aid));
      
      if (assetsToRemove.length > 0) {
        await supabase.from('issue_assets').delete().eq('issue_id', id).in('asset_id', assetsToRemove);
      }
      if (assetsToAdd.length > 0) {
        await supabase.from('issue_assets').insert(assetsToAdd.map(aid => ({ issue_id: id, asset_id: aid })));
      }
      
      const currentItemIds = linkedItems.map(i => i.item_id);
      const itemsToAdd = currentItemIds.filter(iid => !originalItemIds.current.includes(iid));
      const itemsToRemove = originalItemIds.current.filter(iid => !currentItemIds.includes(iid));
      
      if (itemsToRemove.length > 0) {
        await supabase.from('issue_items').delete().eq('issue_id', id).in('item_id', itemsToRemove);
      }
      if (itemsToAdd.length > 0) {
        await supabase.from('issue_items').insert(itemsToAdd.map(iid => ({ issue_id: id, item_id: iid })));
      }

      if (changes.length > 0) {
        const changeComment = changes.join('\n');
        await supabase.from('issue_comments').insert({
          issue_id: id,
          user_id: user?.id,
          content: changeComment,
        });
      }
      
      originalIssue.current = {
        title: issue.title,
        description: issue.description,
        severity: issue.severity,
        status: issue.status,
        due_date: issue.due_date,
        vendor_id: issue.vendor_id,
        purchase_id: issue.purchase_id,
      };
      originalJobIds.current = currentJobIds;
      originalAssetIds.current = currentAssetIds;
      originalItemIds.current = currentItemIds;
      
      fetchLinkedEntities();
      fetchComments();
      toast({ title: 'Issue updated' });
    }
    setSaving(false);
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  }

  const availableJobs = jobs.filter(j => !linkedJobs.some(lj => lj.job_id === j.id));
  const availableAssets = assets.filter(a => !linkedAssets.some(la => la.asset_id === a.id));
  const availableItems = inventoryItems.filter(i => !linkedItems.some(li => li.item_id === i.id));
  const availableBookmarksToLink = allBookmarks.filter(
    b => b.issue_id !== id && !linkedBookmarks.some(lb => lb.target_bookmark_id === b.id)
  );
  const filteredPurchases = issue.vendor_id 
    ? purchases.filter(p => p.vendor_id === issue.vendor_id)
    : purchases;

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/issues"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{isNew ? 'Log Issue' : issue.title}</h1>
          {!isNew && (
            <div className="flex gap-2 mt-1">
              <Badge variant={getSeverityColor(issue.severity)}>{issue.severity}</Badge>
              <Badge variant="outline">{issue.status}</Badge>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Details Card */}
          <Card>
            <CardHeader><CardTitle>Issue Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input 
                  value={issue.title} 
                  onChange={(e) => setIssue({ ...issue, title: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={issue.description || ''} 
                  onChange={(e) => setIssue({ ...issue, description: e.target.value })} 
                  rows={4} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={issue.severity} onValueChange={(v) => setIssue({ ...issue, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={issue.status} onValueChange={(v) => setIssue({ ...issue, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input 
                  type="date" 
                  value={issue.due_date || ''} 
                  onChange={(e) => setIssue({ ...issue, due_date: e.target.value || null })} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Select 
                    value={issue.vendor_id || '__none__'} 
                    onValueChange={(v) => setIssue({ ...issue, vendor_id: v === '__none__' ? null : v, purchase_id: null })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {vendors.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Purchase</Label>
                  <Select 
                    value={issue.purchase_id || '__none__'} 
                    onValueChange={(v) => setIssue({ ...issue, purchase_id: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select purchase" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {filteredPurchases.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {format(new Date(p.date), 'dd/MM/yyyy')} - {p.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Activity Card */}
          {!isNew && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Notes & Activity
                </CardTitle>
                <AddToIssuePopover
                  onAddNote={handleAddNote}
                  onLinkJob={handleLinkJob}
                  onLinkAsset={handleLinkAsset}
                  onLinkItem={handleLinkItem}
                  onOpenKBDialog={() => setKbDialogOpen(true)}
                  onCreateBookmark={handleCreateBookmark}
                  onLinkBookmark={handleLinkBookmark}
                  availableJobs={availableJobs}
                  availableAssets={availableAssets}
                  availableItems={availableItems}
                  availableBookmarks={availableBookmarksToLink}
                />
              </CardHeader>
              <CardContent>
                <IssueActivityFeed comments={comments} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Linked Entities Card */}
          {!isNew && (
            <LinkedEntitiesCard
              linkedJobs={linkedJobs}
              linkedAssets={linkedAssets}
              linkedItems={linkedItems}
              linkedArticles={linkedArticles}
              bookmarks={bookmarks}
              linkedBookmarks={linkedBookmarks}
              onRemoveJob={handleRemoveJob}
              onRemoveAsset={handleRemoveAsset}
              onRemoveItem={handleRemoveItem}
              onRemoveArticle={handleRemoveArticle}
              onDeleteBookmark={handleDeleteBookmark}
              onUnlinkBookmark={handleUnlinkBookmark}
              onCopyBookmarkLink={copyBookmarkLink}
            />
          )}

          {/* Timeline Card */}
          {!isNew && (
            <Card>
              <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{issue.created_at ? format(new Date(issue.created_at), 'MMM d, yyyy') : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First Response</span>
                  <span>{issue.first_response_date ? format(new Date(issue.first_response_date), 'MMM d, yyyy') : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved</span>
                  <span>{issue.resolved_at ? format(new Date(issue.resolved_at), 'MMM d, yyyy') : '-'}</span>
                </div>
                {issue.due_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span>{format(new Date(issue.due_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* KB Article Dialog */}
      <LinkKBArticleDialog
        open={kbDialogOpen}
        onOpenChange={setKbDialogOpen}
        issueId={id!}
        existingArticleIds={linkedArticles.map(a => a.article_id)}
        onLinked={fetchLinkedArticles}
      />
    </div>
  );
}

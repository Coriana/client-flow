import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, MessageSquare, Briefcase, Package, Box, BookOpen, Bookmark, Link2 } from 'lucide-react';

interface Job {
  id: string;
  job_number: string;
  name: string;
}

interface Asset {
  id: string;
  asset_tag: string;
  name: string;
}

interface Item {
  id: string;
  sku: string;
  name: string;
}

interface BookmarkOption {
  id: string;
  bookmark_label: string;
  issue_title?: string;
}

interface AddToIssuePopoverProps {
  onAddNote: (content: string) => Promise<void>;
  onLinkJob: (jobId: string) => void;
  onLinkAsset: (assetId: string) => void;
  onLinkItem: (itemId: string) => void;
  onOpenKBDialog: () => void;
  onCreateBookmark: (label: string, content: string) => Promise<void>;
  onLinkBookmark: (bookmarkId: string) => void;
  availableJobs: Job[];
  availableAssets: Asset[];
  availableItems: Item[];
  availableBookmarks: BookmarkOption[];
  disabled?: boolean;
}

export default function AddToIssuePopover({
  onAddNote,
  onLinkJob,
  onLinkAsset,
  onLinkItem,
  onOpenKBDialog,
  onCreateBookmark,
  onLinkBookmark,
  availableJobs,
  availableAssets,
  availableItems,
  availableBookmarks,
  disabled = false,
}: AddToIssuePopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('note');
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [noteContent, setNoteContent] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [bookmarkContent, setBookmarkContent] = useState('');
  const [selectedBookmarkId, setSelectedBookmarkId] = useState('');

  const resetForm = () => {
    setNoteContent('');
    setSelectedJobId('');
    setSelectedAssetId('');
    setSelectedItemId('');
    setBookmarkLabel('');
    setBookmarkContent('');
    setSelectedBookmarkId('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'note':
          if (noteContent.trim()) {
            await onAddNote(noteContent.trim());
          }
          break;
        case 'job':
          if (selectedJobId) {
            onLinkJob(selectedJobId);
          }
          break;
        case 'asset':
          if (selectedAssetId) {
            onLinkAsset(selectedAssetId);
          }
          break;
        case 'item':
          if (selectedItemId) {
            onLinkItem(selectedItemId);
          }
          break;
        case 'kb':
          onOpenKBDialog();
          break;
        case 'bookmark':
          if (bookmarkLabel.trim() && bookmarkContent.trim()) {
            await onCreateBookmark(bookmarkLabel.trim(), bookmarkContent.trim());
          }
          break;
        case 'link-bookmark':
          if (selectedBookmarkId) {
            onLinkBookmark(selectedBookmarkId);
          }
          break;
      }
      resetForm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = () => {
    switch (activeTab) {
      case 'note': return !noteContent.trim();
      case 'job': return !selectedJobId;
      case 'asset': return !selectedAssetId;
      case 'item': return !selectedItemId;
      case 'kb': return false;
      case 'bookmark': return !bookmarkLabel.trim() || !bookmarkContent.trim();
      case 'link-bookmark': return !selectedBookmarkId;
      default: return true;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 gap-1 h-auto p-1">
            <TabsTrigger value="note" className="text-xs px-2 py-1.5">
              <MessageSquare className="h-3 w-3 mr-1" />
              Note
            </TabsTrigger>
            <TabsTrigger value="job" className="text-xs px-2 py-1.5">
              <Briefcase className="h-3 w-3 mr-1" />
              Job
            </TabsTrigger>
            <TabsTrigger value="asset" className="text-xs px-2 py-1.5">
              <Package className="h-3 w-3 mr-1" />
              Asset
            </TabsTrigger>
            <TabsTrigger value="item" className="text-xs px-2 py-1.5">
              <Box className="h-3 w-3 mr-1" />
              Item
            </TabsTrigger>
          </TabsList>
          <TabsList className="grid grid-cols-3 gap-1 h-auto p-1 mt-1">
            <TabsTrigger value="kb" className="text-xs px-2 py-1.5">
              <BookOpen className="h-3 w-3 mr-1" />
              KB Article
            </TabsTrigger>
            <TabsTrigger value="bookmark" className="text-xs px-2 py-1.5">
              <Bookmark className="h-3 w-3 mr-1" />
              Bookmark
            </TabsTrigger>
            <TabsTrigger value="link-bookmark" className="text-xs px-2 py-1.5">
              <Link2 className="h-3 w-3 mr-1" />
              Link Res.
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <TabsContent value="note" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Add a Note</Label>
                <Textarea
                  placeholder="Type your note..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="job" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Link a Job</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableJobs.length === 0 ? (
                      <SelectItem value="__none__" disabled>No jobs available</SelectItem>
                    ) : (
                      availableJobs.map(j => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.job_number} - {j.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="asset" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Link an Asset</Label>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssets.length === 0 ? (
                      <SelectItem value="__none__" disabled>No assets available</SelectItem>
                    ) : (
                      availableAssets.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.asset_tag} - {a.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="item" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Link an Inventory Item</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.length === 0 ? (
                      <SelectItem value="__none__" disabled>No items available</SelectItem>
                    ) : (
                      availableItems.map(i => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.sku} - {i.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="kb" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Link a Knowledge Base Article</Label>
                <p className="text-xs text-muted-foreground">
                  Search and link KB articles to this issue.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="bookmark" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Create a Resolution Bookmark</Label>
                <Input
                  placeholder="Label (e.g., Resolution #1)"
                  value={bookmarkLabel}
                  onChange={(e) => setBookmarkLabel(e.target.value)}
                />
                <Textarea
                  placeholder="Resolution content..."
                  value={bookmarkContent}
                  onChange={(e) => setBookmarkContent(e.target.value)}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="link-bookmark" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Link to Existing Resolution</Label>
                <Select value={selectedBookmarkId} onValueChange={setSelectedBookmarkId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBookmarks.length === 0 ? (
                      <SelectItem value="__none__" disabled>No resolutions available</SelectItem>
                    ) : (
                      availableBookmarks.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bookmark_label} - {b.issue_title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitDisabled() || loading}
              className="w-full"
              size="sm"
            >
              {loading ? 'Adding...' : activeTab === 'kb' ? 'Open KB Search' : 'Add'}
            </Button>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
